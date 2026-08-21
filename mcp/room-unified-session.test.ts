// One manager session, the way AO does it: the interactive pty claude IS the
// orchestrator, and the headless -p supervisor is now its fallback, not a peer. These
// tests cover the new routing/identity/transcript machinery this run adds — the
// pre-existing pty and headless mechanics each already have their own test files
// (room-pty.test.ts, room-permission-trap.test.ts, orchestrator-session.test.ts),
// which stay untouched.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

import {
  createDelegationFeed,
  createPtyState,
  createRoomState,
  handleDelegationRoute,
  resolvePtyReply,
  resolveRoomReply,
  type DelegationApiContext,
} from "./delegation/api.js";
import { frameChatInputForPty, buildRoomPtyLaunch, type RoomPtyAttachment } from "./delegation/room-pty.js";
import { readRoomSessionMeta, writeRoomSessionMeta } from "./delegation/room-supervisor.js";
import {
  mungeClaudeProjectDir,
  parseNativeTranscript,
  readNativeTranscriptPage,
  resolveNativeTranscriptPath,
  waitForNewAssistantTurns,
  TRANSCRIPT_PAGE_CAP,
} from "./delegation/room-transcript.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-unified-session-"));
}

function fakeAttachment(onWrite: (data: string) => void): RoomPtyAttachment {
  return { write: onWrite, resize: () => {}, close: () => {} };
}

function baseCtx(projectDir: string): DelegationApiContext {
  return { projectDir, feed: createDelegationFeed(projectDir, { heartbeatMs: 60_000 }), room: createRoomState(), pty: createPtyState() };
}

// ---------------------------------------------------------------------------
// Routing: pty first, headless only as fallback.

test("resolveRoomReply routes a message to the pty session when it is available — reverting the pty-first branch in resolveRoomReply fails this test", async () => {
  const project = tempProject();
  const ctx = baseCtx(project);
  const written: string[] = [];
  ctx.ensurePtyAttachedFn = (async () => fakeAttachment((data) => written.push(data))) as never;
  // No session.json written for this project, so the identity poll would otherwise wait
  // out its real 5s timeout before this test's assertions ever run — an instant "already
  // exhausted" stub keeps the pty-routing behavior under test unchanged (this thread's
  // identity was never going to resolve either way) without the real wait.
  ctx.waitForRoomSessionIdentityFn = (async (readMeta: () => unknown) => readMeta()) as never;

  const reply = await resolveRoomReply(ctx, "hello pty", [], undefined);

  assert.equal(reply.manager, "pty", "a live pty must answer, not the headless fallback");
  assert.deepEqual(written, [frameChatInputForPty("hello pty")], "the exact framed message must reach the pty's stdin");
  ctx.feed.close();
});

test("resolvePtyReply returns null when the pty is unavailable — the signal resolveRoomReply falls back on", async () => {
  const project = tempProject();
  const ctx = baseCtx(project);
  ctx.ensurePtyAttachedFn = (async () => null) as never;

  const reply = await resolvePtyReply(ctx, "hello", undefined);

  assert.equal(reply, null, "node-pty being unavailable must read as 'try headless', never a fabricated pty reply");
  ctx.feed.close();
});

test("resolvePtyReply against the REAL ensurePtyAttached (no test seam) resolves fast when no pty is live, and never spawns one — reverting spawnIfNeeded to always-true fails this test with an 8s+ stall", async () => {
  // The regression this guards: chat routing must decide pty availability QUICKLY and
  // definitively. A version that dispatches a fresh pty supervisor and waits up to
  // PTY_STARTUP_TIMEOUT_MS (8s) whenever none is live — correct for the explicit
  // Terminal-open routes, wrong for a random chat message — turned every headless-only
  // room test in this repo into an 8s+ stall, and in an environment where node-pty IS
  // installed, into an attempt to actually spawn a real interactive claude session.
  const project = tempProject();
  const ctx = baseCtx(project);
  // No ensurePtyAttachedFn: exercises the real ensurePtyAttached(ctx, key, false).
  const started = Date.now();
  const reply = await resolvePtyReply(ctx, "hello", undefined);
  const elapsedMs = Date.now() - started;

  assert.equal(reply, null, "no pty session is live, and routing must never spawn one implicitly");
  assert.ok(elapsedMs < 2000, `resolved in ${elapsedMs}ms — a spawn-and-wait attempt would take 8000ms+`);
  ctx.feed.close();
});

test("resolveRoomReply still honors askManagerFn alone by skipping pty entirely — no ensurePtyAttachedFn call, matching the pre-existing headless-only test contract", async () => {
  const project = tempProject();
  const ctx = baseCtx(project);
  let ptyAttachAttempted = false;
  ctx.ensurePtyAttachedFn = (async () => {
    ptyAttachAttempted = true;
    return null;
  }) as never;
  ctx.askManagerFn = (async () => ({ ok: true, text: "fallback reply", tools: [] })) as never;

  const reply = await resolveRoomReply(ctx, "hi", [], undefined);

  assert.equal(ptyAttachAttempted, false, "askManagerFn alone must skip live routing (pty AND headless), same guarantee as before this run");
  assert.equal(reply.text, "fallback reply");
  assert.equal(reply.manager, "headless");
  ctx.feed.close();
});

// ---------------------------------------------------------------------------
// Native transcript path resolution.

test("resolveNativeTranscriptPath munges cwd the way claude's own CLI does — verified against this machine's real ~/.claude/projects/ directory naming", () => {
  const cwd = "/Users/kushaljain/code/Kage/.agent_memory/worktrees/some-run-id";
  const munged = mungeClaudeProjectDir(cwd);
  // Every non-alphanumeric character becomes '-', including '.' and '_' — not just
  // '/'. A "just replace slashes" implementation produces
  // "-Users-kushaljain-code-Kage-.agent_memory-worktrees-some-run-id" instead, which
  // does not match any real directory this machine's claude has ever created.
  assert.equal(munged, "-Users-kushaljain-code-Kage--agent-memory-worktrees-some-run-id");

  const path = resolveNativeTranscriptPath(cwd, "abc-123");
  assert.ok(path.endsWith(join(munged, "abc-123.jsonl")));
  assert.ok(path.includes(join(".claude", "projects")));
});

// ---------------------------------------------------------------------------
// Native transcript parsing — defensive against claude's own jsonl shape.

const FIXTURE_JSONL = [
  JSON.stringify({ type: "queue-operation", operation: "enqueue", sessionId: "s1" }), // unrelated line type
  JSON.stringify({
    type: "user",
    timestamp: "2026-08-20T00:00:00.000Z",
    message: { role: "user", content: "fix the flaky test" },
  }),
  "{{{ not even json",
  JSON.stringify({
    type: "assistant",
    timestamp: "2026-08-20T00:00:01.000Z",
    message: { role: "assistant", content: [{ type: "thinking", thinking: "let me look" }] },
  }),
  JSON.stringify({
    type: "assistant",
    timestamp: "2026-08-20T00:00:02.000Z",
    message: { role: "assistant", content: [{ type: "tool_use", name: "kage_goal_status", input: {} }] },
  }),
  JSON.stringify({
    type: "user",
    timestamp: "2026-08-20T00:00:03.000Z",
    message: { role: "user", content: [{ type: "tool_result", content: "ok" }] },
  }),
  JSON.stringify({
    type: "assistant",
    timestamp: "2026-08-20T00:00:04.000Z",
    message: { role: "assistant", content: [{ type: "text", text: "Fixed it." }] },
  }),
  JSON.stringify({ type: "mode", mode: "normal", sessionId: "s1" }), // another unrelated line type
].join("\n");

test("parseNativeTranscript keeps user/assistant turns, collapses tool_use to names, skips thinking/tool_result/unknown lines, and never throws on a malformed one", () => {
  const turns = parseNativeTranscript(FIXTURE_JSONL);

  // Bare thinking (no text/tool) and the bare tool_result carry no renderable signal —
  // dropped. The malformed JSON line is skipped, not thrown.
  assert.deepEqual(
    turns.map((t) => [t.role, t.text, t.tools]),
    [
      ["user", "fix the flaky test", []],
      ["assistant", "", ["kage_goal_status"]],
      ["assistant", "Fixed it.", []],
    ],
  );
  assert.equal(turns[0].timestamp, "2026-08-20T00:00:00.000Z");
});

test("readNativeTranscriptPage caps a page at TRANSCRIPT_PAGE_CAP turns and offers a cursor for the rest", () => {
  const project = tempProject();
  const path = join(project, "fixture.jsonl");
  const lines: string[] = [];
  for (let i = 0; i < TRANSCRIPT_PAGE_CAP + 20; i += 1) {
    lines.push(JSON.stringify({ type: "user", timestamp: `t${i}`, message: { role: "user", content: `turn ${i}` } }));
  }
  writeFileSync(path, lines.join("\n"), "utf8");

  const page = readNativeTranscriptPage(path);
  assert.equal(page.turns.length, TRANSCRIPT_PAGE_CAP, "a page must never exceed the stated cap");
  assert.equal(page.total, TRANSCRIPT_PAGE_CAP + 20);
  assert.notEqual(page.cursor, null, "more turns exist before this page — cursor must say so");
  assert.equal(page.turns[page.turns.length - 1].text, `turn ${TRANSCRIPT_PAGE_CAP + 19}`, "the LATEST turns are the default page, not the oldest");

  const olderPage = readNativeTranscriptPage(path, { cursor: page.cursor as number });
  assert.equal(olderPage.turns[olderPage.turns.length - 1].text, `turn ${(page.cursor as number) - 1}`, "cursor must page strictly to older turns");
});

test("readNativeTranscriptPage on a missing file returns an honest empty page, never throws", () => {
  const page = readNativeTranscriptPage("/does/not/exist.jsonl");
  assert.deepEqual(page, { turns: [], cursor: null, total: 0 });
});

// ---------------------------------------------------------------------------
// GET /room/transcript — the HTTP surface, response-capped the same way.

async function startTranscriptOnlyServer(projectDir: string): Promise<{ server: Server; port: number; ctx: DelegationApiContext }> {
  const ctx = baseCtx(projectDir);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (await handleDelegationRoute(ctx, req, res, url)) return;
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  // ctx.feed opens an un-unref'd fs.watch — a caller that closes only `server` leaves
  // the test runner's process alive forever with nothing left to do (this is exactly
  // what looked like a hang before this fix). Callers must close ctx.feed too.
  return { server, port: (server.address() as AddressInfo).port, ctx };
}

test("GET /room/transcript returns the native jsonl parsed into turns, capped, with the recorded session id", async () => {
  const project = tempProject();
  mkdirSync(join(project, ".agent_memory", "room"), { recursive: true });
  const transcriptPath = join(project, "native-transcript.jsonl");
  writeFileSync(
    transcriptPath,
    [
      JSON.stringify({ type: "user", timestamp: "t0", message: { role: "user", content: "hi" } }),
      JSON.stringify({ type: "assistant", timestamp: "t1", message: { role: "assistant", content: [{ type: "text", text: "hello!" }] } }),
    ].join("\n"),
    "utf8",
  );
  writeRoomSessionMeta(project, { session_id: "sess-xyz", native_transcript_path: transcriptPath });

  const { server, port, ctx } = await startTranscriptOnlyServer(project);
  try {
    const body = (await (await fetch(`http://127.0.0.1:${port}/room/transcript`)).json()) as {
      ok: boolean;
      session_id: string;
      native_transcript_path: string;
      cap: number;
      total: number;
      turns: Array<{ role: string; text: string }>;
    };
    assert.equal(body.ok, true);
    assert.equal(body.session_id, "sess-xyz");
    assert.equal(body.native_transcript_path, transcriptPath);
    assert.equal(body.cap, TRANSCRIPT_PAGE_CAP);
    assert.equal(body.total, 2);
    assert.deepEqual(
      body.turns.map((t) => [t.role, t.text]),
      [
        ["user", "hi"],
        ["assistant", "hello!"],
      ],
    );
  } finally {
    server.close();
    ctx.feed.close();
  }
});

test("GET /room/transcript never returns more than TRANSCRIPT_PAGE_CAP turns even when the native file has more, and honors an explicit smaller limit", async () => {
  const project = tempProject();
  mkdirSync(join(project, ".agent_memory", "room"), { recursive: true });
  const transcriptPath = join(project, "native-transcript.jsonl");
  const lines: string[] = [];
  for (let i = 0; i < TRANSCRIPT_PAGE_CAP + 30; i += 1) {
    lines.push(JSON.stringify({ type: "user", timestamp: `t${i}`, message: { role: "user", content: `m${i}` } }));
  }
  writeFileSync(transcriptPath, lines.join("\n"), "utf8");
  writeRoomSessionMeta(project, { session_id: "sess-abc", native_transcript_path: transcriptPath });

  const { server, port, ctx } = await startTranscriptOnlyServer(project);
  try {
    const uncapped = (await (await fetch(`http://127.0.0.1:${port}/room/transcript`)).json()) as { turns: unknown[]; total: number };
    assert.equal(uncapped.turns.length, TRANSCRIPT_PAGE_CAP, "the response cap must hold even though the file has more");
    assert.equal(uncapped.total, TRANSCRIPT_PAGE_CAP + 30);

    const limited = (await (await fetch(`http://127.0.0.1:${port}/room/transcript?limit=5`)).json()) as { turns: unknown[] };
    assert.equal(limited.turns.length, 5, "an explicit smaller limit must be honored, never exceeded");
  } finally {
    server.close();
    ctx.feed.close();
  }
});

test("GET /room/transcript on a thread with no recorded pty session returns an honest empty page, not a 404", async () => {
  const project = tempProject();
  const { server, port, ctx } = await startTranscriptOnlyServer(project);
  try {
    const body = (await (await fetch(`http://127.0.0.1:${port}/room/transcript`)).json()) as {
      ok: boolean;
      session_id: string | null;
      turns: unknown[];
      total: number;
    };
    assert.equal(body.ok, true);
    assert.equal(body.session_id, null);
    assert.deepEqual(body.turns, []);
    assert.equal(body.total, 0);
  } finally {
    server.close();
    ctx.feed.close();
  }
});

// ---------------------------------------------------------------------------
// Session meta round-trips with unknown fields preserved.

test("writeRoomSessionMeta preserves fields it doesn't know about, and fields another writer already set — reverting the merge-on-write fix loses them", () => {
  const project = tempProject();
  writeRoomSessionMeta(project, { session_id: "s1", permission_digest: "d1" });
  // Simulate a field this file's TypeScript type has never heard of, written by some
  // future extension directly onto the same record.
  const meta1 = readRoomSessionMeta(project) as Record<string, unknown>;
  writeFileSync(
    join(project, ".agent_memory", "room", "session.json"),
    `${JSON.stringify({ ...meta1, future_field: "kept me" }, null, 2)}\n`,
    "utf8",
  );

  // A later writer only knows about native_transcript_path — it must not clobber
  // permission_digest or the field it has never heard of.
  writeRoomSessionMeta(project, { native_transcript_path: "/tmp/x.jsonl" });

  const after = readRoomSessionMeta(project) as Record<string, unknown>;
  assert.equal(after.session_id, "s1");
  assert.equal(after.permission_digest, "d1");
  assert.equal(after.native_transcript_path, "/tmp/x.jsonl");
  assert.equal(after.future_field, "kept me", "an unknown field must survive a rewrite by a different writer");
});

// ---------------------------------------------------------------------------
// buildRoomPtyLaunch: --session-id on a fresh launch, never alongside --resume.

test("buildRoomPtyLaunch pins a fresh session with --session-id, and never emits it alongside --resume", () => {
  const fresh = buildRoomPtyLaunch({ sessionId: "brand-new-id", mcpConfigPath: "/tmp/room-mcp.json", cwd: "/tmp/x" });
  assert.deepEqual(fresh.args.slice(0, 2), ["--session-id", "brand-new-id"]);
  assert.ok(!fresh.args.includes("--resume"));

  const resumed = buildRoomPtyLaunch({ resumeId: "old-id", sessionId: "brand-new-id", mcpConfigPath: "/tmp/room-mcp.json", cwd: "/tmp/x" });
  assert.deepEqual(resumed.args.slice(0, 2), ["--resume", "old-id"], "resumeId must win — never both flags at once");
  assert.ok(!resumed.args.includes("--session-id"));
});

// ---------------------------------------------------------------------------
// The reply-wait poller — deterministic via injected sleep/now, no real timers.

test("waitForNewAssistantTurns waits out the quiet window before returning, and returns [] honestly on timeout", async () => {
  let clock = 0;
  const sleepCalls: number[] = [];
  const sleep = async (ms: number) => {
    sleepCalls.push(ms);
    clock += ms;
  };
  const now = () => clock;

  // Simulates: after 2 polls, an assistant turn lands; it must then wait out the full
  // quiet window (no further growth) before treating it as settled.
  let poll = 0;
  const readPage = () => {
    poll += 1;
    if (poll < 3) return { turns: [], cursor: null, total: 5 }; // unchanged — still the pre-message total
    return {
      turns: [{ role: "assistant" as const, text: "done", tools: [] }],
      cursor: null,
      total: 6,
    };
  };

  const result = await waitForNewAssistantTurns(readPage, {
    beforeTotal: 5,
    timeoutMs: 100_000,
    pollMs: 10,
    quietMs: 25,
    sleep,
    now,
  });

  assert.deepEqual(result, [{ role: "assistant", text: "done", tools: [] }]);
  assert.ok(poll >= 3, "must not return before the transcript actually grew");

  // Timeout path: growth never happens.
  clock = 0;
  const neverGrows = () => ({ turns: [], cursor: null, total: 5 });
  const timedOut = await waitForNewAssistantTurns(neverGrows, {
    beforeTotal: 5,
    timeoutMs: 30,
    pollMs: 10,
    quietMs: 25,
    sleep,
    now,
  });
  assert.deepEqual(timedOut, [], "a reply that never arrives must resolve to an honest empty array, never a fabricated one");
});

// ---------------------------------------------------------------------------
// frameChatInputForPty — bracketed paste, trailing \r (not \n).

test("frameChatInputForPty wraps the message in bracketed paste and submits with a trailing carriage return", () => {
  const framed = frameChatInputForPty("multi\nline message");
  assert.equal(framed, "\x1b[200~multi\nline message\x1b[201~\r");
  assert.ok(framed.endsWith("\r"), "Enter on a real terminal sends \\r, not \\n");
});
