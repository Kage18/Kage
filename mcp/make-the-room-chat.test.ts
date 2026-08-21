// Makes the Room chat interactable: the manager may end a reply with one fenced
// kage-actions block (room-actions.ts) so the user can click a chip or a Dispatch
// button instead of always typing. This file covers, each with a test that fails on
// revert:
//   1. the protocol parser — a valid block is extracted and stripped, a malformed one
//      is left completely alone (visible text, no silent loss) — mcp/delegation/room-actions.ts
//   2. the room-supervisor (headless) leg gets the SAME bounded empty-reply retry the
//      askManager leg already had, through a new DI seam (askRoomSupervisorFn) —
//      mcp/delegation/api.ts, mcp/delegation/room-supervisor.ts
//   3. RoomHistoryTurn.actions round-trips through the room history store, additively —
//      mcp/delegation/room-history.ts
//   4. the composed client actually renders kage-actions when present, and is gated so
//      a turn without them is untouched — mcp/delegation/app-client.ts, app-styles.ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { normalizeKageActions, parseKageActionsReply } from "./delegation/room-actions.js";
import { resolveRoomReply, createDelegationFeed, createPtyState, createRoomState, type DelegationApiContext } from "./delegation/api.js";
import { EMPTY_REPLY_RETRY_NUDGE } from "./delegation/manager-client.js";
import type { RoomStreamEvent } from "./delegation/room-supervisor.js";
import { isAgentInstalled } from "./delegation/adapters/index.js";
import { appendRoomTurn, readRoomHistory } from "./delegation/room-history.js";
import { APP_CLIENT } from "./delegation/app-client.js";
import { APP_STYLES } from "./delegation/app-styles.js";
import { MANAGER_CONSTITUTION } from "./delegation/manager-prompt.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-room-chat-actions-"));
}

function baseCtx(projectDir: string): DelegationApiContext {
  return { projectDir, feed: createDelegationFeed(projectDir, { heartbeatMs: 60_000 }), room: createRoomState(), pty: createPtyState() };
}

// ---------------------------------------------------------------------------
// 1. Protocol parse — valid shapes extracted and stripped, malformed left alone.

test("parseKageActionsReply extracts a valid question+options block and strips the fence from the visible text", () => {
  const raw =
    "I can start on either.\n\n" +
    '```kage-actions\n{"question": "Which run should I dispatch first?", "options": [' +
    '{"label": "The auth fix", "send": "dispatch the auth fix first"}, ' +
    '{"label": "The flaky test", "send": "dispatch the flaky test fix first"}]}\n```';

  const parsed = parseKageActionsReply(raw);
  assert.equal(parsed.text, "I can start on either.", "the fence must be stripped from the visible text");
  assert.ok(parsed.actions, "a valid block must produce actions");
  assert.equal(parsed.actions!.question, "Which run should I dispatch first?");
  assert.equal(parsed.actions!.options!.length, 2);
  assert.deepEqual(parsed.actions!.options![0], { label: "The auth fix", send: "dispatch the auth fix first" });
});

test("parseKageActionsReply extracts a valid proposals block", () => {
  const raw = '```kage-actions\n{"proposals": [{"intent": "fix the flaky retry test", "type": "bugfix"}]}\n```';
  const parsed = parseKageActionsReply(raw);
  assert.equal(parsed.text, "");
  assert.deepEqual(parsed.actions, { proposals: [{ intent: "fix the flaky retry test", type: "bugfix" }] });
});

test("parseKageActionsReply extracts a valid actions block with open_run/dispatch/create_goal kinds", () => {
  const raw =
    'Here is what I would do next.\n```kage-actions\n{"actions": [' +
    '{"label": "Open the run", "kind": "open_run", "payload": {"run_id": "r1"}}, ' +
    '{"label": "Dispatch a fix", "kind": "dispatch", "payload": {"intent": "fix it", "type": "bugfix"}}, ' +
    '{"label": "Track as a goal", "kind": "create_goal", "payload": {"intent": "modernize the auth flow"}}]}\n```';
  const parsed = parseKageActionsReply(raw);
  assert.equal(parsed.text, "Here is what I would do next.");
  assert.equal(parsed.actions!.actions!.length, 3);
  assert.equal(parsed.actions!.actions![0].kind, "open_run");
  assert.equal(parsed.actions!.actions![1].kind, "dispatch");
  assert.equal(parsed.actions!.actions![2].kind, "create_goal");
});

test("parseKageActionsReply with no fence at all returns the text completely unchanged", () => {
  const raw = "Just an ordinary reply, nothing attached.";
  assert.deepEqual(parseKageActionsReply(raw), { text: raw });
});

test("REGRESSION GUARD: malformed JSON inside the fence is left visible as text, not silently dropped", () => {
  const raw = 'I tried to attach options.\n```kage-actions\n{"question": "pick one", "options": [oops not json]}\n```';
  const parsed = parseKageActionsReply(raw);
  assert.equal(parsed.text, raw, "an unparseable block must leave the ENTIRE original reply, fence included, visible");
  assert.equal(parsed.actions, undefined);
});

test("REGRESSION GUARD: a kage-actions block with an out-of-range option count (fewer than 2 or more than 4) is rejected, not silently truncated", () => {
  const oneOption = '```kage-actions\n{"question": "ok?", "options": [{"label": "Yes", "send": "yes"}]}\n```';
  assert.equal(parseKageActionsReply(oneOption).actions, undefined, "one option is below the 2-4 floor and must be rejected wholesale");

  const fiveOptions =
    '```kage-actions\n{"question": "pick", "options": [' +
    '{"label": "a", "send": "a"}, {"label": "b", "send": "b"}, {"label": "c", "send": "c"}, ' +
    '{"label": "d", "send": "d"}, {"label": "e", "send": "e"}]}\n```';
  assert.equal(parseKageActionsReply(fiveOptions).actions, undefined, "five options is above the 2-4 ceiling and must be rejected wholesale");
});

test("REGRESSION GUARD: an actions block naming a kind outside open_run/dispatch/create_goal is rejected", () => {
  const raw = '```kage-actions\n{"actions": [{"label": "do a thing", "kind": "delete_everything", "payload": {}}]}\n```';
  assert.equal(parseKageActionsReply(raw).actions, undefined);
});

test("normalizeKageActions rejects a plain object with none of the three recognized shapes", () => {
  assert.equal(normalizeKageActions({ hello: "world" }), null);
  assert.equal(normalizeKageActions("not even an object"), null);
  assert.equal(normalizeKageActions(null), null);
});

// ---------------------------------------------------------------------------
// 2. The room-supervisor leg's own empty-reply retry, through the new askRoomSupervisorFn
// seam — mirrors the askManager leg's already-shipped retry-once + enriched-failure.

test("REGRESSION GUARD: an empty (ok:false) first reply from the headless supervisor leg triggers exactly one retry through askRoomSupervisorFn, and a non-empty retry is persisted as a normal turn", async (t) => {
  if (!isAgentInstalled("claude")) {
    t.skip("claude CLI not installed in this environment — the headless leg is only reached when isAgentInstalled('claude')");
    return;
  }
  const project = tempProject();
  const ctx = baseCtx(project);
  try {
    ctx.ensurePtyAttachedFn = (async () => null) as never; // no pty available — fall through to headless

    const calls: Array<{ message: string }> = [];
    const fakeAskSupervisor = (async (_projectDir: string, message: string): Promise<RoomStreamEvent | null> => {
      calls.push({ message });
      if (calls.length === 1) return { kind: "final", text: "(the manager returned nothing)", tools: [], ok: false };
      return { kind: "final", text: "I dispatched a run to look into it.", tools: ["mcp__kage__kage_dispatch"], ok: true };
    }) as never;
    ctx.askRoomSupervisorFn = fakeAskSupervisor;

    const reply = await resolveRoomReply(ctx, "can you look into this?", [], undefined);

    assert.equal(calls.length, 2, "REGRESSION GUARD: an empty first reply must trigger exactly one retry call through the seam");
    assert.equal(calls[1].message, EMPTY_REPLY_RETRY_NUDGE, "the retry must nudge the manager to answer plainly, not repeat the original message");
    assert.equal(reply.text, "I dispatched a run to look into it.");
    assert.equal(reply.manager, "headless");
    assert.equal(reply.failed, undefined, "a recovered reply must not be marked failed");
  } finally {
    ctx.feed.close();
  }
});

test("REGRESSION GUARD: a double-empty headless-leg reply persists an enriched, visible failure instead of a blank one, and the retry is strictly bounded to one call", async (t) => {
  if (!isAgentInstalled("claude")) {
    t.skip("claude CLI not installed in this environment — the headless leg is only reached when isAgentInstalled('claude')");
    return;
  }
  const project = tempProject();
  const ctx = baseCtx(project);
  try {
    ctx.ensurePtyAttachedFn = (async () => null) as never;

    let calls = 0;
    ctx.askRoomSupervisorFn = (async (): Promise<RoomStreamEvent | null> => {
      calls += 1;
      return { kind: "final", text: "(the manager returned nothing)", tools: [], ok: false };
    }) as never;

    const reply = await resolveRoomReply(ctx, "can you look into this?", [], undefined);

    assert.equal(calls, 2, "REGRESSION GUARD: a double-empty reply must never loop past two calls");
    assert.equal(reply.failed, true, "a double-empty reply must be marked failed");
    assert.notEqual(reply.text.trim(), "", "REGRESSION GUARD: a double-empty reply must never be persisted as blank text");
    assert.match(reply.text, /twice/i, "the failure text must say the manager was asked twice");
  } finally {
    ctx.feed.close();
  }
});

test("the headless leg strips a valid kage-actions block from a successful (non-retried) reply and carries it on RoomReply.actions", async (t) => {
  if (!isAgentInstalled("claude")) {
    t.skip("claude CLI not installed in this environment — the headless leg is only reached when isAgentInstalled('claude')");
    return;
  }
  const project = tempProject();
  const ctx = baseCtx(project);
  try {
    ctx.ensurePtyAttachedFn = (async () => null) as never;
    ctx.askRoomSupervisorFn = (async (): Promise<RoomStreamEvent | null> => ({
      kind: "final",
      text: 'Sure — which one first?\n```kage-actions\n{"question": "Which one first?", "options": [{"label": "A", "send": "do a"}, {"label": "B", "send": "do b"}]}\n```',
      tools: [],
      ok: true,
    })) as never;

    const reply = await resolveRoomReply(ctx, "there are two options", [], undefined);

    assert.equal(reply.text, "Sure — which one first?");
    assert.ok(reply.actions, "a valid trailing block must be parsed onto RoomReply.actions");
    assert.equal(reply.actions!.question, "Which one first?");
  } finally {
    ctx.feed.close();
  }
});

// ---------------------------------------------------------------------------
// 3. RoomHistoryTurn.actions round-trips through the history store, additively.

test("appendRoomTurn/readRoomHistory round-trip a turn's actions field, and a turn with no actions still round-trips with the field entirely absent", () => {
  const project = tempProject();
  appendRoomTurn(project, {
    role: "kage",
    text: "Which one first?",
    actions: { question: "Which one first?", options: [{ label: "A", send: "do a" }, { label: "B", send: "do b" }] },
  });
  appendRoomTurn(project, { role: "kage", text: "an ordinary reply with nothing attached" });

  const turns = readRoomHistory(project);
  assert.equal(turns.length, 2);
  assert.deepEqual(turns[0].actions, { question: "Which one first?", options: [{ label: "A", send: "do a" }, { label: "B", send: "do b" }] });
  assert.equal("actions" in turns[1], false, "REGRESSION GUARD: a turn recorded with no actions must round-trip additively, with the field simply absent — never a stray null/undefined key");
});

// ---------------------------------------------------------------------------
// The manager constitution actually instructs the protocol it is supposed to speak —
// a parser with nothing telling the manager to use it is a feature nobody sees.

test("the manager constitution requires a kage-actions options block on every clarifying question, and names the three protocol shapes", () => {
  assert.match(MANAGER_CONSTITUTION, /kage-actions/, "the constitution must name the protocol fence label");
  assert.match(MANAGER_CONSTITUTION, /2 to 4/, "it must state the option-count floor and ceiling the parser actually enforces");
  assert.match(MANAGER_CONSTITUTION, /MUST carry a kage-actions block/i, "a clarifying question must be required, not merely suggested, to carry options");
  assert.match(MANAGER_CONSTITUTION, /"proposals"/, "the proposals shape must be documented");
  assert.match(MANAGER_CONSTITUTION, /open_run.*dispatch.*create_goal/, "all three action kinds the client actually renders must be named");
});

// ---------------------------------------------------------------------------
// 4. The composed client actually renders kage-actions, gated on turn.actions being set —
// source-level assertions, the same idiom every other client-rendering test in this repo
// uses (there is no DOM/browser available to this test suite).

test("the composed client script renders kage-actions chips/cards, gated so a turn with no actions is never touched by that code path", () => {
  assert.match(APP_CLIENT, /function renderTurnActions/, "a dedicated renderer for kage-actions must exist");
  // The call site must be conditional on turn.actions — a turn recorded before this
  // field existed (actions undefined) must take the exact same render path it always
  // did, never falling into renderTurnActions at all.
  assert.match(APP_CLIENT, /turn\.role === "kage" && turn\.actions\) renderTurnActions\(/, "renderTurnActions must only run for a kage turn that actually carries actions");
  assert.match(APP_CLIENT, /turn-actions-q/, "a question's own text must render");
  assert.match(APP_CLIENT, /"chiprow"/, "question options must render as a row of chips");
  assert.match(APP_CLIENT, /"turn-proposal"/, "a proposal must render as its own card");
  assert.match(APP_CLIENT, /"btn primary sm", "Dispatch"/, "a proposal card must carry a Dispatch button wired to the existing dispatch styling");
  // Every control must reuse the existing token-guarded API helper and existing action
  // functions — never a second delivery path.
  assert.match(APP_CLIENT, /api\("\/runs", \{ method: "POST"/, "a proposal/dispatch action must reuse the existing POST \/runs call, not invent a new one");
  assert.match(APP_CLIENT, /api\("\/goals", \{ method: "POST"/, "a create_goal action must reuse the existing POST \/goals call, not invent a new one");
  assert.match(APP_CLIENT, /sendRoomMessage\(\)/, "a question option's click must reuse the existing composer send path");
  assert.doesNotMatch(APP_CLIENT, /innerHTML/, "no rendering path in this file may use innerHTML, kage-actions included");

  assert.match(APP_STYLES, /\.turn-actions \{/, "the actions container must be styled");
  assert.match(APP_STYLES, /\.chip\.action-chip/, "clickable action chips must have their own styled state");
  assert.match(APP_STYLES, /\.turn-proposal \{/, "the proposal card must be styled");
});
