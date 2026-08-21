// The Room manager can end a turn with EMPTY text for a legitimate request — reproduced
// live 2026-08-21: the owner asked a browser-outside-tool-surface question ("can you use
// kage app from the browser and see how we can improve it"), the headless manager
// returned nothing, and the (correct, already-shipped) honesty rendering showed
// "(the manager returned nothing)". The honesty layer worked; the manager producing no
// usable text for a legitimate request is the bug this file guards against, at two
// layers: the manager is told never to do this (manager-prompt.ts), and the pipeline
// gives it exactly one nudged retry before giving up honestly (api.ts + manager-client.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

import {
  createDelegationFeed,
  createPtyState,
  createRoomState,
  handleDelegationRoute,
  type DelegationApiContext,
} from "./delegation/api.js";
import type { askManager, ManagerReply } from "./delegation/manager-client.js";
import { EMPTY_REPLY_RETRY_NUDGE } from "./delegation/manager-client.js";
import { MANAGER_CONSTITUTION } from "./delegation/manager-prompt.js";
import type { RoomHistoryTurn } from "./delegation/room-history.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-room-manager-empty-"));
}

function baseCtx(projectDir: string): DelegationApiContext {
  return { projectDir, feed: createDelegationFeed(projectDir, { heartbeatMs: 60_000 }), room: createRoomState(), pty: createPtyState() };
}

async function startRoomServer(ctx: DelegationApiContext): Promise<{ server: Server; port: number }> {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (await handleDelegationRoute(ctx, req, res, url)) return;
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  return { server, port: (server.address() as AddressInfo).port };
}

async function waitForTurns(port: number, min: number): Promise<RoomHistoryTurn[]> {
  const deadline = Date.now() + 4000;
  for (;;) {
    const out = (await (await fetch(`http://127.0.0.1:${port}/room`)).json()) as { turns: RoomHistoryTurn[] };
    if (out.turns.length >= min) return out.turns;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${min} turns, saw ${out.turns.length}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

// ---------------------------------------------------------------------------
// Layer 1 — the manager is told, in its own constitution, never to do this.

test("the manager constitution states the harness principle: no request is out of range, only undecomposed, and a turn must never end empty", () => {
  assert.match(MANAGER_CONSTITUTION, /no request is out of range|is never "outside what you can do"/i, "the constitution must reject capability-limit framing outright, not just tell the manager to be helpful");
  assert.match(MANAGER_CONSTITUTION, /turn it into work/i, "the default move for any actionable request must be turning it into a dispatched run or goal");
  assert.match(MANAGER_CONSTITUTION, /kage_dispatch/, "the rule must point the manager at the tool it actually has");
  assert.match(MANAGER_CONSTITUTION, /kage_goal_create/, "a request too large for one run must route to a goal, not a decline");
  assert.match(MANAGER_CONSTITUTION, /ONE clarifying question/, "the only other permitted non-work reply is exactly one clarifying question");
  assert.match(MANAGER_CONSTITUTION, /must NEVER end.{0,20}with empty text/i);
});

// ---------------------------------------------------------------------------
// Layer 2 — the askManager/headless leg retries exactly once on an empty reply, and only
// a double-empty persists a visible, enriched failure.

test("an empty first manager reply triggers exactly one retry, nudged, and a non-empty retry is persisted as a normal turn", async () => {
  const project = tempProject();
  const ctx = baseCtx(project);
  const calls: Array<{ question: string; history: Array<{ role: string; text: string }> }> = [];
  const fakeAsk: typeof askManager = async (options) => {
    calls.push({ question: options.question, history: options.history ?? [] });
    if (calls.length === 1) return { ok: false, text: "(the manager returned nothing)", tools: [] };
    return { ok: true, text: "I can't browse, but I dispatched a run to look at the app.", tools: ["mcp__kage__kage_dispatch"] };
  };
  ctx.askManagerFn = fakeAsk;

  const { server, port } = await startRoomServer(ctx);
  try {
    await fetch(`http://127.0.0.1:${port}/room/message`, { method: "POST", body: JSON.stringify({ message: "can you browse the app?" }) });
    const turns = await waitForTurns(port, 2);

    assert.equal(calls.length, 2, "REGRESSION GUARD: an empty first reply must trigger exactly one retry call");
    assert.equal(calls[1].question, EMPTY_REPLY_RETRY_NUDGE, "the retry must ask the manager to answer plainly, not repeat the original question verbatim");

    assert.equal(turns[1].role, "kage");
    assert.equal(turns[1].text, "I can't browse, but I dispatched a run to look at the app.", "a non-empty retry must be persisted as the turn's real text");
    assert.equal(turns[1].failed, undefined, "a recovered reply must not be marked failed");
  } finally {
    server.close();
    ctx.feed.close();
  }
});

test("a double-empty manager reply persists an enriched, visible failure turn instead of a blank one — reverting the retry loses this detail", async () => {
  const project = tempProject();
  const ctx = baseCtx(project);
  const calls: string[] = [];
  const fakeAsk: typeof askManager = async (options) => {
    calls.push(options.question);
    const reply: ManagerReply = { ok: false, text: "(the manager returned nothing)", tools: [], exitCode: 1, stderr: "permission denied on kage_dispatch" };
    return reply;
  };
  ctx.askManagerFn = fakeAsk;

  const { server, port } = await startRoomServer(ctx);
  try {
    await fetch(`http://127.0.0.1:${port}/room/message`, { method: "POST", body: JSON.stringify({ message: "can you browse the app?" }) });
    const turns = await waitForTurns(port, 2);

    assert.equal(calls.length, 2, "REGRESSION GUARD: the retry must be strictly bounded to one — a double-empty must never loop past two calls");
    assert.equal(turns[1].role, "kage");
    assert.notEqual(turns[1].text.trim(), "", "REGRESSION GUARD: a double-empty reply must never be persisted as blank text");
    assert.equal(turns[1].failed, true, "a double-empty reply must be marked failed so the renderer styles it as a failure");
    assert.match(turns[1].text, /twice/i, "the failure text must say the manager was asked twice, not just once");
    assert.match(turns[1].text, /exit code 1/, "the failure text must surface whatever diagnostic detail exists (exit code here)");
    assert.match(turns[1].text, /permission denied on kage_dispatch/, "the failure text must surface the stderr snippet, not just say it failed");
  } finally {
    server.close();
    ctx.feed.close();
  }
});
