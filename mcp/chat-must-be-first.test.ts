// Chat must be first-class even when a thread is pty-bound — two views, one
// orchestrator. Live repro: with a room pty alive, a Chat message came back as a
// 182-char paraphrase ("Kage sent your message to the terminal session, but hasn't
// recorded its identity yet... check the Terminal tab for the real reply") instead of
// the manager's actual reply, and pty-leg replies never carried the kage-actions
// payload the headless legs already parse. This file covers, each with a test that
// fails on revert:
//   1. resolvePtyReply extracts the manager's ACTUAL reply text from the native
//      transcript and runs it through the SAME kage-actions parser the headless legs
//      use — mcp/delegation/api.ts
//   2. resolvePtyReply polls briefly for the pty's session identity to land, within
//      the same ask, instead of deflecting on the very first read — mcp/delegation/api.ts,
//      mcp/delegation/room-transcript.ts
//   3. the deflection fallback fires ONLY once the identity is genuinely unresolvable
//      by the poll deadline, and carries an actionable open_terminal chip instead of
//      only prose — mcp/delegation/api.ts, mcp/delegation/room-actions.ts,
//      mcp/delegation/app-client.ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDelegationFeed,
  createPtyState,
  createRoomState,
  resolvePtyReply,
  type DelegationApiContext,
} from "./delegation/api.js";
import { frameChatInputForPty, type RoomPtyAttachment } from "./delegation/room-pty.js";
import { readRoomSessionMeta, writeRoomSessionMeta } from "./delegation/room-supervisor.js";
import { waitForRoomSessionIdentity } from "./delegation/room-transcript.js";
import { normalizeKageActions, parseKageActionsReply } from "./delegation/room-actions.js";
import { APP_CLIENT } from "./delegation/app-client.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-chat-first-"));
}

function fakeAttachment(onWrite: (data: string) => void): RoomPtyAttachment {
  return { write: onWrite, resize: () => {}, close: () => {} };
}

function baseCtx(projectDir: string): DelegationApiContext {
  return { projectDir, feed: createDelegationFeed(projectDir, { heartbeatMs: 60_000 }), room: createRoomState(), pty: createPtyState() };
}

// ---------------------------------------------------------------------------
// 1. Real reply text, run through the same kage-actions parser as the headless legs.

test("resolvePtyReply: a transcript reply carrying a trailing kage-actions block yields a chat turn with the fence stripped and actions persisted — reverting the pty-leg parse call loses the chips on terminal-answered threads", async () => {
  const project = tempProject();
  const transcriptPath = join(project, "native.jsonl");
  writeRoomSessionMeta(project, { session_id: "sess-1", native_transcript_path: transcriptPath });

  const ctx = baseCtx(project);
  const written: string[] = [];
  ctx.ensurePtyAttachedFn = (async () => fakeAttachment((data) => written.push(data))) as never;
  const rawReply =
    'Two runs are ready to go.\n\n```kage-actions\n{"question": "Which one first?", "options": [' +
    '{"label": "The auth fix", "send": "dispatch the auth fix first"}, ' +
    '{"label": "The flaky test", "send": "dispatch the flaky test fix first"}]}\n```';
  ctx.waitForNewAssistantTurnsFn = (async () => [{ role: "assistant" as const, text: rawReply, tools: [] }]) as never;

  const reply = await resolvePtyReply(ctx, "what's ready?", undefined);

  assert.ok(reply, "a resolved transcript reply must not be null");
  assert.equal(reply!.text, "Two runs are ready to go.", "the fence must be stripped from the visible text, same as the headless legs");
  assert.deepEqual(
    reply!.actions,
    {
      question: "Which one first?",
      options: [
        { label: "The auth fix", send: "dispatch the auth fix first" },
        { label: "The flaky test", send: "dispatch the flaky test fix first" },
      ],
    },
    "the parsed actions must ride the pty-leg reply exactly like a headless one",
  );
  assert.equal(reply!.manager, "pty");
  assert.equal(reply!.failed, undefined, "a real answer must never be marked failed");
  assert.deepEqual(written, [frameChatInputForPty("what's ready?")]);
  ctx.feed.close();
});

test("resolvePtyReply: a transcript reply with no fence is returned unchanged — the parser never touches ordinary prose", async () => {
  const project = tempProject();
  const transcriptPath = join(project, "native.jsonl");
  writeRoomSessionMeta(project, { session_id: "sess-1", native_transcript_path: transcriptPath });

  const ctx = baseCtx(project);
  ctx.ensurePtyAttachedFn = (async () => fakeAttachment(() => {})) as never;
  ctx.waitForNewAssistantTurnsFn = (async () => [{ role: "assistant" as const, text: "Done, no follow-up needed.", tools: [] }]) as never;

  const reply = await resolvePtyReply(ctx, "status?", undefined);

  assert.equal(reply!.text, "Done, no follow-up needed.");
  assert.equal(reply!.actions, undefined);
  ctx.feed.close();
});

// ---------------------------------------------------------------------------
// 2. Brief identity poll instead of an instant deflect.

test("resolvePtyReply: an identity that lands mid-poll is used, not treated as unresolved — the deflect branch must not fire just because the FIRST read raced the write", async () => {
  const project = tempProject();
  const transcriptPath = join(project, "native.jsonl");
  // Deliberately no writeRoomSessionMeta before the ask — the first read inside
  // resolvePtyReply sees an empty session.json, exactly the startup-race window.

  const ctx = baseCtx(project);
  ctx.ensurePtyAttachedFn = (async () => fakeAttachment(() => {})) as never;
  let identityPolls = 0;
  ctx.waitForRoomSessionIdentityFn = (async (readMeta: () => { session_id?: string; native_transcript_path?: string }) => {
    identityPolls += 1;
    // Simulate superviseRoomPty's write landing between this ask's first read and the
    // poller's own read — the exact race the brief describes.
    writeRoomSessionMeta(project, { session_id: "sess-late", native_transcript_path: transcriptPath });
    return readMeta();
  }) as never;
  ctx.waitForNewAssistantTurnsFn = (async () => [{ role: "assistant" as const, text: "Got it, on it.", tools: [] }]) as never;

  const reply = await resolvePtyReply(ctx, "hello", undefined);

  assert.equal(identityPolls, 1, "resolvePtyReply must consult the identity poller when the first read is unresolved");
  assert.equal(reply!.text, "Got it, on it.", "an identity that resolves within the poll must be used for a real reply, not a deflection");
  assert.equal(reply!.failed, undefined);
  ctx.feed.close();
});

test("waitForRoomSessionIdentity polls until session_id and native_transcript_path both land, and gives up honestly at the deadline — deterministic via injected sleep/now, no real timers", async () => {
  let clock = 0;
  const now = () => clock;
  const sleep = async (ms: number) => {
    clock += ms;
  };

  let reads = 0;
  const resolves = () => {
    reads += 1;
    if (reads < 3) return {};
    return { session_id: "s1", native_transcript_path: "/tmp/x.jsonl" };
  };
  const resolved = await waitForRoomSessionIdentity(resolves, { timeoutMs: 100_000, pollMs: 10, sleep, now });
  assert.deepEqual(resolved, { session_id: "s1", native_transcript_path: "/tmp/x.jsonl" });
  assert.ok(reads >= 3, "must not return before the identity actually landed");

  clock = 0;
  const neverResolves = () => ({});
  const unresolved = await waitForRoomSessionIdentity(neverResolves, { timeoutMs: 50, pollMs: 10, sleep, now });
  assert.deepEqual(unresolved, {}, "timeout must return whatever the last read produced, never fabricate an identity");
});

// ---------------------------------------------------------------------------
// 3. The deflection fallback only fires when truly unresolvable, and carries an
// actionable open_terminal chip, not just prose.

test("resolvePtyReply: an identity that never resolves by the poll deadline deflects honestly, still delivers the message, and carries an open_terminal action — REGRESSION GUARD for the live repro's 182-char paraphrase turn", async () => {
  const project = tempProject();
  const ctx = baseCtx(project);
  const written: string[] = [];
  ctx.ensurePtyAttachedFn = (async () => fakeAttachment((data) => written.push(data))) as never;
  // Instant "still unresolved" — exercises the deflect branch without a real 5s wait.
  ctx.waitForRoomSessionIdentityFn = (async (readMeta: () => unknown) => readMeta()) as never;

  const reply = await resolvePtyReply(ctx, "can you browse the app for me?", undefined);

  assert.ok(reply, "an unresolved identity must still resolve to a reply object, never null (null means 'no pty at all')");
  assert.equal(reply!.failed, true);
  assert.match(reply!.text, /still processing/i, "the fallback must say what IS known — the terminal is working on it — not just that Chat has nothing");
  assert.deepEqual(
    reply!.actions,
    { actions: [{ label: "Open Terminal", kind: "open_terminal" }] },
    "the Terminal reference must be an actionable chip via kage-actions, not only prose",
  );
  assert.deepEqual(written, [frameChatInputForPty("can you browse the app for me?")], "the message must still reach the real pty session even when Chat can't summarize the reply");
  ctx.feed.close();
});

test("normalizeKageActions accepts an open_terminal action, and parseKageActionsReply extracts it from a fence like any other action kind", () => {
  assert.deepEqual(normalizeKageActions({ actions: [{ label: "Open Terminal", kind: "open_terminal" }] }), {
    actions: [{ label: "Open Terminal", kind: "open_terminal" }],
  });

  const raw = 'Still working.\n\n```kage-actions\n{"actions": [{"label": "Open Terminal", "kind": "open_terminal"}]}\n```';
  const parsed = parseKageActionsReply(raw);
  assert.equal(parsed.text, "Still working.");
  assert.deepEqual(parsed.actions, { actions: [{ label: "Open Terminal", kind: "open_terminal" }] });
});

test("the composed client script wires an open_terminal action chip to setRoomMode(\"terminal\") — the same door the rm-terminal tab button uses", () => {
  assert.match(APP_CLIENT, /a\.kind === "open_terminal"/, "the action-chip click handler must recognize the open_terminal kind");
  assert.match(APP_CLIENT, /setRoomMode\("terminal"\)/, "clicking it must open the same Terminal tab, not a new mechanism");
});

// ---------------------------------------------------------------------------
// last_ask_timed_out bookkeeping must still hold once a reply is real (unrelated to
// this run's change, but the identity-poll insertion sits right before it — pin it).

test("resolvePtyReply clears last_ask_timed_out on a genuine transcript-extracted reply, identity poll or not", async () => {
  const project = tempProject();
  const transcriptPath = join(project, "native.jsonl");
  writeRoomSessionMeta(project, { session_id: "sess-1", native_transcript_path: transcriptPath, last_ask_timed_out: true });

  const ctx = baseCtx(project);
  ctx.ensurePtyAttachedFn = (async () => fakeAttachment(() => {})) as never;
  ctx.waitForNewAssistantTurnsFn = (async () => [{ role: "assistant" as const, text: "back online", tools: [] }]) as never;

  await resolvePtyReply(ctx, "hi", undefined);

  assert.equal(readRoomSessionMeta(project).last_ask_timed_out, false);
  ctx.feed.close();
});
