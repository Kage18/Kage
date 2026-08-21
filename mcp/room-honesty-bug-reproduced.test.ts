// The room honesty bug, reproduced live on 2026-08-20/21 (twice, both exactly 360s —
// ROOM_ASK_TIMEOUT_MS/PTY_REPLY_TIMEOUT_MS's own ceiling — after the user's message):
// when the manager failed to answer within the ask window, Kage persisted a NORMAL
// "kage" turn with empty text, and the app rendered a blank KAGE reply marked DONE.
//
// Root cause, found live rather than guessed: the wedge was the SESSION, not the
// process. /room/pty/status reported alive:true because the pty PROCESS still existed —
// but the claude SESSION inside it had been sitting on a pending MCP permission prompt
// since 08-19, and every respawned supervisor kept --resume-ing that exact poisoned
// session id, so recycling only the process could never recover. session.json also
// drifted (a session_id from one spawn paired with a native_transcript_path from
// another), and pty-supervisor.json was never cleaned when its pid died — both made a
// dead session look alive to the next reader.
//
// This file covers, each with a test that fails on revert:
//   1. an ask timeout is never persisted as a blank normal turn (queueRoomTurn's
//      backstop, and resolvePtyReply's own honest timeout text) — mcp/delegation/api.ts
//   2. a timed-out ask rotates BOTH the pty process and the session identity, and says
//      so in the failure turn — mcp/delegation/api.ts, room-pty.ts, room-supervisor.ts
//   3. a supervisor whose last ask timed out (or that is 12h+ old) is recycled BEFORE
//      the next ask reaches it — mcp/delegation/room-pty.ts
//   4. record-file drift is cleaned on retire, and a wedged session.json is preserved
//      for forensics rather than silently overwritten — mcp/delegation/room-pty.ts,
//      mcp/delegation/room-supervisor.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

import {
  createDelegationFeed,
  createPtyState,
  createRoomState,
  handleDelegationRoute,
  resolvePtyReply,
  type DelegationApiContext,
} from "./delegation/api.js";
import {
  isPtySupervisorStale,
  retirePtyRoom,
  roomPtyRecordPath,
  type RoomPtyAttachment,
  type RoomPtyRecord,
} from "./delegation/room-pty.js";
import { readRoomSessionMeta, retireRoomSession, writeRoomSessionMeta } from "./delegation/room-supervisor.js";
import type { RoomHistoryTurn } from "./delegation/room-history.js";
import { APP_CLIENT } from "./delegation/app-client.js";
import { APP_STYLES } from "./delegation/app-styles.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-room-honesty-"));
}

function fakeAttachment(onWrite: (data: string) => void): RoomPtyAttachment {
  return { write: onWrite, resize: () => {}, close: () => {} };
}

function baseCtx(projectDir: string): DelegationApiContext {
  return { projectDir, feed: createDelegationFeed(projectDir, { heartbeatMs: 60_000 }), room: createRoomState(), pty: createPtyState() };
}

// ---------------------------------------------------------------------------
// Requirement 3 — the pre-ask staleness guard is a pure decision, unit-testable
// without a real process or a real 12h wait.

test("isPtySupervisorStale: nothing to recycle with no record, a healthy fresh record is not stale, a timed-out last ask forces stale regardless of age, and 12h+ age forces stale on its own", () => {
  const now = Date.parse("2026-08-21T12:00:00.000Z");
  assert.equal(isPtySupervisorStale(null, {}, now), false, "a supervisor that has never run is never stale");

  const fresh: RoomPtyRecord = { pid: 1, socket: "/tmp/x.sock", started_at: "2026-08-21T11:00:00.000Z" };
  assert.equal(isPtySupervisorStale(fresh, {}, now), false, "a healthy 1h-old supervisor is not stale");
  assert.equal(
    isPtySupervisorStale(fresh, { last_ask_timed_out: true }, now),
    true,
    "a supervisor whose last completed ask timed out must be recycled before the next ask, no matter how young it is",
  );

  const thirteenHoursOld: RoomPtyRecord = { pid: 1, socket: "/tmp/x.sock", started_at: "2026-08-20T23:00:00.000Z" };
  assert.equal(isPtySupervisorStale(thirteenHoursOld, {}, now), true, "13h old must be stale even with a clean last-ask record");

  const justUnderTwelveHours: RoomPtyRecord = { pid: 1, socket: "/tmp/x.sock", started_at: "2026-08-21T00:01:00.000Z" };
  assert.equal(isPtySupervisorStale(justUnderTwelveHours, {}, now), false, "just under the 12h ceiling must not trigger the age guard");
});

// ---------------------------------------------------------------------------
// Requirement 1 (session rotation) + requirement 4 (forensics, not silent overwrite).

test("retireRoomSession renames a wedged session.json aside for forensics and leaves a fresh, empty one — reverting to an in-place overwrite loses the forensic copy this test checks for", () => {
  const project = tempProject();
  writeRoomSessionMeta(project, { session_id: "poisoned-session", native_transcript_path: "/tmp/old.jsonl", permission_digest: "d1" });

  retireRoomSession(project, undefined, "wedged");

  const after = readRoomSessionMeta(project);
  assert.equal(after.session_id, undefined, "the fresh session.json must carry no session_id, or the next spawn would --resume the exact wedged session");
  assert.equal(after.native_transcript_path, undefined);

  const dir = join(project, ".agent_memory", "room");
  const forensic = readdirSync(dir).find((name) => name.startsWith("session.json.wedged-"));
  assert.ok(forensic, "the original record must survive under a renamed forensic copy, never be deleted outright");
  const preserved = JSON.parse(readFileSync(join(dir, forensic as string), "utf8")) as { session_id?: string };
  assert.equal(preserved.session_id, "poisoned-session", "the forensic copy must be the exact pre-rotation record, for inspecting what wedged");
});

// ---------------------------------------------------------------------------
// Requirement 4 — record-file drift: a stale pty-supervisor.json (dead/reused pid)
// must not linger and lie to the next reader.

test("retirePtyRoom removes the record file even when the recorded pid is already dead — a lingering record is what makes a later reader believe a reused pid is still this session", () => {
  const project = tempProject();
  mkdirSync(join(project, ".agent_memory", "room"), { recursive: true });
  const path = roomPtyRecordPath(project);
  writeFileSync(path, `${JSON.stringify({ pid: 999999, socket: "/tmp/dead.sock", started_at: new Date(0).toISOString() })}\n`, "utf8");
  assert.ok(existsSync(path));

  retirePtyRoom(project);

  assert.equal(existsSync(path), false, "the stale record must be removed even though signalling the dead pid is a silent no-op");
});

// ---------------------------------------------------------------------------
// Requirements 1+2 — the actual timeout path: never blank, always says what happened,
// always rotates (process AND session identity).

test("resolvePtyReply: an ask that times out becomes an honest failed reply, never empty text, and rotates the supervisor exactly once — the timeout-empty case this bug's regression test must cover", async () => {
  const project = tempProject();
  writeRoomSessionMeta(project, { session_id: "wedged-session", native_transcript_path: join(project, "native.jsonl") });
  writeFileSync(join(project, "native.jsonl"), "", "utf8");

  const ctx = baseCtx(project);
  ctx.ensurePtyAttachedFn = (async () => fakeAttachment(() => {})) as never;
  // Simulates the real ~6-minute PTY_REPLY_TIMEOUT_MS wait resolving to "nothing ever
  // arrived" — without this seam the same assertion would need to wait for real.
  ctx.waitForNewAssistantTurnsFn = (async () => []) as never;
  const recycled: Array<[string, string | undefined]> = [];
  ctx.recyclePtySupervisorFn = ((dir: string, session?: string) => {
    recycled.push([dir, session]);
    return { pid: undefined };
  }) as never;

  const reply = await resolvePtyReply(ctx, "are you there?", undefined);

  assert.ok(reply, "a timeout must still resolve to a reply object — null means 'no pty at all', a different, already-handled case");
  assert.notEqual(reply!.text.trim(), "", "REGRESSION GUARD: an empty-text reply must never come back from a timed-out ask");
  assert.match(reply!.text, /did not answer/i, "the failure text must say plainly that the manager did not answer");
  assert.match(reply!.text, /rotated|fresh/i, "the failure text must say what recovery happened, per the brief");
  assert.equal(reply!.failed, true, "must be marked failed so the renderer styles it as a failure, not prose");
  assert.equal(recycled.length, 1, "the supervisor must be rotated exactly once, immediately after the timeout is detected");
  assert.equal(recycled[0][0], project);

  assert.equal(
    readRoomSessionMeta(project).last_ask_timed_out,
    true,
    "the timeout must be recorded durably, so the pre-ask staleness guard can still catch it even if the reactive rotate above were ever skipped",
  );
  ctx.feed.close();
});

test("resolvePtyReply: a successful ask clears any prior last_ask_timed_out flag, so a recovered session is not perpetually treated as stale", async () => {
  const project = tempProject();
  writeRoomSessionMeta(project, { session_id: "recovered-session", native_transcript_path: join(project, "native.jsonl"), last_ask_timed_out: true });
  writeFileSync(join(project, "native.jsonl"), "", "utf8");

  const ctx = baseCtx(project);
  ctx.ensurePtyAttachedFn = (async () => fakeAttachment(() => {})) as never;
  ctx.waitForNewAssistantTurnsFn = (async () => [{ role: "assistant" as const, text: "I'm here.", tools: [] }]) as never;

  const reply = await resolvePtyReply(ctx, "hello again", undefined);

  assert.equal(reply!.text, "I'm here.");
  assert.equal(reply!.failed, undefined, "a real answer must not be marked failed");
  assert.equal(readRoomSessionMeta(project).last_ask_timed_out, false, "a genuine answer must clear the stale flag");
  ctx.feed.close();
});

test("resolvePtyReply rotates a supervisor whose last ask already timed out BEFORE the next message even attaches — a wedged session must never get a second silent 6-minute chance", async () => {
  const project = tempProject();
  writeRoomSessionMeta(project, { last_ask_timed_out: true });
  mkdirSync(join(project, ".agent_memory", "room"), { recursive: true });
  writeFileSync(
    roomPtyRecordPath(project),
    `${JSON.stringify({ pid: 999999, socket: "/tmp/x.sock", started_at: new Date().toISOString() })}\n`,
    "utf8",
  );

  const ctx = baseCtx(project);
  let attachAttempted = false;
  let recycledBeforeAttach = false;
  ctx.recyclePtySupervisorFn = (() => {
    recycledBeforeAttach = !attachAttempted;
    return { pid: undefined };
  }) as never;
  ctx.ensurePtyAttachedFn = (async () => {
    attachAttempted = true;
    // The freshly-rotated supervisor hasn't come back up yet — an honest null so the
    // caller falls back to headless, never a fabricated reply.
    return null;
  }) as never;

  const reply = await resolvePtyReply(ctx, "hello", undefined);

  assert.equal(recycledBeforeAttach, true, "the stale check must recycle before attaching, not react to a second timeout");
  assert.equal(reply, null, "no live pty yet must read as an honest null, never a guessed reply");
  ctx.feed.close();
});

// ---------------------------------------------------------------------------
// Requirement 2, generalized — an empty-text reply from ANY leg (not only pty) must
// become a visible failure turn, never a blank turn marked done.

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

test("queueRoomTurn: an empty-text reply from any leg is persisted as a visible failure, not a blank turn silently marked done — reverting the blank-text backstop fails this test", async () => {
  const project = tempProject();
  const ctx = baseCtx(project);
  ctx.askRoomFn = (async () => ({ text: "", tools: [] })) as never;

  const { server, port } = await startRoomServer(ctx);
  try {
    await fetch(`http://127.0.0.1:${port}/room/message`, { method: "POST", body: JSON.stringify({ message: "hi" }) });
    const turns = await waitForTurns(port, 2);
    assert.equal(turns[1].role, "kage");
    assert.notEqual(turns[1].text.trim(), "", "REGRESSION GUARD: an empty reply must never be persisted as blank text");
    assert.equal(turns[1].failed, true, "must be marked failed so it can never render as an ordinary silently-answered turn");
  } finally {
    server.close();
    ctx.feed.close();
  }
});

// ---------------------------------------------------------------------------
// The renderer actually reads RoomHistoryTurn.failed and styles it distinctly — a flag
// nothing reads would satisfy every test above while the UI still shows plain prose.

test("the composed app client renders a failed kage turn with a distinct class and label, and app-styles.ts gives it a distinct (crimson) treatment", () => {
  assert.match(APP_CLIENT, /turn\.failed/, "renderHistoryTurns must actually read RoomHistoryTurn.failed");
  assert.match(APP_CLIENT, /turn-failed/, "a failed turn must carry its own CSS class");
  assert.match(APP_CLIENT, /who-fail/, "a failed turn must carry a visible label, not just a silent class");
  assert.match(APP_STYLES, /\.turn-failed/, "app-styles.ts must actually style the failed-turn class");
  assert.match(APP_STYLES, /who-fail/);
});
