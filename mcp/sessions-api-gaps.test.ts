// W1.1 of the sessions surface: closing the three API gaps W2's renderer run named in
// its claim's unsure notes and rightly did not touch itself (api.ts was out of its
// scope). Each field here has a real, wired consumer in app-client.ts — this file only
// proves the SERVER side; the consumer wiring is verified by the "composed page still
// parses" test at the bottom, the same parse gate delegation-api.test.ts already runs.
//
// Its own file per this repo's rule — new behaviour gets a new test file, and
// mcp/delegation.test.ts is a known append-collision hotspot.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

import { createDelegationFeed, createPtyState, createRoomState, handleDelegationRoute, type DelegationFeed } from "./delegation/api.js";
import { guardRequest } from "./delegation/guard.js";
import { RUN_SCHEMA_VERSION, createRun, patchRun, writeClaim, type ClaimRecord } from "./delegation/contract.js";
import { claimVerdict } from "./delegation/verify.js";
import { attachRunToGoal, createGoal } from "./delegation/goal.js";
import { DEFAULT_SESSION, setActiveGoal } from "./delegation/room-sessions.js";
import { writeRoomSessionMeta } from "./delegation/room-supervisor.js";
import { delegationAppHtml } from "./delegation/app-html.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-sessions-api-gaps-"));
}

const TOKEN = "test-token-0123456789abcdef0123456789abcdef";

/** Same miniature daemon-mount delegation-api.test.ts uses: guard first, then the route. */
async function startApi(projectDir: string): Promise<{ server: Server; port: number; feed: DelegationFeed }> {
  const feed = createDelegationFeed(projectDir, { heartbeatMs: 60_000 });
  const room = createRoomState();
  const pty = createPtyState();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const verdict = guardRequest(
      { method: req.method ?? "GET", headers: req.headers as Record<string, string | string[] | undefined>, pathname: url.pathname },
      { allowedOrigins: ["http://127.0.0.1"], token: TOKEN },
    );
    if (!verdict.ok) {
      res.writeHead(verdict.status, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: verdict.reason }));
      return;
    }
    if (await handleDelegationRoute({ projectDir, feed, room, pty }, req, res, url)) return;
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const port = (server.address() as AddressInfo).port;
  return { server, port, feed };
}

function apiFetch(port: number, path: string): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, { headers: { host: `127.0.0.1:${port}` } });
}

function fixtureClaim(runId: string, checks: ClaimRecord["checks"]): ClaimRecord {
  return {
    schema_version: RUN_SCHEMA_VERSION,
    run_id: runId,
    statement: "fixture statement",
    checks,
    unsure: [],
    learnings: [],
    protocol_ok: true,
    diff: { files: 1, lines: 10, paths: ["a.ts"] },
    created_at: "2026-08-20T00:00:00.000Z",
  };
}

// --- 1. verdict_label on the list/board response -----------------------------------------

// FAILS ON REVERT: withActivity() only ever attached claim_summary at the list level
// (never claimVerdict's own label) — before this change GET /runs' run objects for a
// finished run carry no `verdict_label` key at all, so this equality fails.
test("GET /runs carries verdict_label, read verbatim from claimVerdict, for a finished run with a claim", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const { id } = createRun(project, { intent: "add a health endpoint", type: "chore", agent: "stub" });
    const claim = fixtureClaim(id, [{ id: "tests", kind: "command", expect: "exit 0", cmd: "npm test", result: "pass", exit_code: 0 }]);
    writeClaim(project, id, claim);
    patchRun(project, id, { state: "ready" });

    const listed = (await (await apiFetch(port, "/runs")).json()) as { runs: Array<Record<string, unknown>> };
    const run = listed.runs.find((r) => r.id === id);
    assert.ok(run, "the run must be listed");
    assert.equal(run!.verdict_label, claimVerdict(claim).label, "verdict_label must match claimVerdict's own label verbatim");
  } finally {
    feed.close();
    server.close();
  }
});

// FAILS ON REVERT: without the guard around readClaim, a finished run with NO claim.json
// would either throw or invent a label; this proves the key is simply absent instead.
test("GET /runs has no verdict_label key for a finished run with no claim", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const { id } = createRun(project, { intent: "rename the config key", type: "chore", agent: "stub" });
    patchRun(project, id, { state: "ready" });

    const listed = (await (await apiFetch(port, "/runs")).json()) as { runs: Array<Record<string, unknown>> };
    const run = listed.runs.find((r) => r.id === id);
    assert.ok(run, "the run must be listed");
    assert.equal("verdict_label" in run!, false, "absence means absent — no claim, no key");
  } finally {
    feed.close();
    server.close();
  }
});

// --- 2. GET /room's suggested_next, the room-shaped wrapper onto suggestedNextPrompt -----

// FAILS ON REVERT: GET /room carries no suggested_next key at all before this change, so
// the first assertion (must equal null, the key must exist) and the second (must equal
// the waiting_on.detail question) both fail — the second because the key is simply
// undefined, never the run's own question.
test("GET /room's suggested_next is null with no active goal, and the blocked run's own question once one is waiting on approval", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const idle = (await (await apiFetch(port, "/room")).json()) as { suggested_next: string | null };
    assert.equal(idle.suggested_next, null, "no active goal has nothing honest to suggest");

    const { id: runId } = createRun(project, { intent: "migrate the users table", type: "migration", agent: "stub" });
    patchRun(project, runId, { state: "blocked", waiting_on: { needs: "plan approval", detail: "ok to drop the legacy_id column?" } });
    const goal = createGoal(project, { intent: "migrate the users table" });
    attachRunToGoal(project, goal.id, runId);
    setActiveGoal(project, DEFAULT_SESSION, goal.id);

    const waiting = (await (await apiFetch(port, "/room")).json()) as { suggested_next: string | null };
    assert.equal(waiting.suggested_next, "ok to drop the legacy_id column?", "the manager's own question, verbatim");
  } finally {
    feed.close();
    server.close();
  }
});

// --- 3. GET /room's has_transcript + transcript_turns -------------------------------------

// FAILS ON REVERT: GET /room carries neither key before this change — both assertions
// below read undefined, never true/1 or false/0.
test("GET /room's has_transcript is false with no native transcript, true with turns once one exists", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const before = (await (await apiFetch(port, "/room")).json()) as { has_transcript: boolean; transcript_turns: number };
    assert.equal(before.has_transcript, false, "no pty session has ever answered this thread");
    assert.equal(before.transcript_turns, 0);

    const transcriptPath = join(project, "fixture-transcript.jsonl");
    const line = JSON.stringify({
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "hello from the fixture transcript" }] },
    });
    writeFileSync(transcriptPath, `${line}\n`, "utf8");
    writeRoomSessionMeta(project, { native_transcript_path: transcriptPath });

    const after = (await (await apiFetch(port, "/room")).json()) as { has_transcript: boolean; transcript_turns: number };
    assert.equal(after.has_transcript, true);
    assert.equal(after.transcript_turns, 1);
  } finally {
    feed.close();
    server.close();
  }
});

// --- 4. the composed page still parses, with the three consumer edits wired in -----------

// FAILS ON REVERT: not on the field wiring itself, but on a broken template-literal
// escape in app-client.ts (the failure mode this gate exists for) — new Function()
// throws a SyntaxError the moment a stray backtick, ${, or single-escaped \n slips in.
test("the emitted client script still parses with verdict_label/suggested_next/has_transcript wired in", () => {
  const html = delegationAppHtml("tok");
  const script = html.split("<script>")[1].split("</" + "script>")[0];
  assert.doesNotThrow(() => new Function(script));
  assert.ok(!script.includes("innerHTML"), "the client script must never use innerHTML");
});
