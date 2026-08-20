// Goals must survive their manager — due-wave derivation, the dispatch-wave path, and
// goal continuity for a brand-new manager session. Reproduced live: a goal's wave 2 sat
// undispatched for a day because the headless manager that owned it died in a daemon
// restart, and nothing else in the kernel advances a wave (the kernel never
// auto-dispatches — autonomy is judgment — and the app is read-only on goals). This file
// covers the fix: goalWaveStatus (a pure derivation, never persisted), POST
// /goals/:id/dispatch-wave (the same dispatch path kage_dispatch itself uses), and the
// open-goals digest every new manager session now gets at spawn time.
//
// Every test below carries an explicit timeout: a route or fixture that hangs must fail
// that ONE test loudly, never stall the whole suite the way an unbounded await would.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

import { createDelegationFeed, createPtyState, createRoomState, handleDelegationRoute, type DelegationApiContext, type DelegationFeed } from "./delegation/api.js";
import { guardRequest } from "./delegation/guard.js";
import { createRun, patchRun, readRun, transitionRun } from "./delegation/contract.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { superviseRun } from "./delegation/supervisor.js";
import { attachRunToGoal, createGoal, goalWaveStatus, openGoalsDigestLines, readGoal } from "./delegation/goal.js";
import { MANAGER_CONSTITUTION, managerPromptFor } from "./delegation/manager-prompt.js";
import { ensureOrchestratorWorktree } from "./delegation/room-pty.js";
import { buildHeadlessRoomArgs } from "./delegation/room-supervisor.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-goal-continuity-"));
}

function tempGitProject(): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeDelegationConfig(project, { test: "node -e \"process.exit(0)\"" });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

// A run that reaches a given terminal/non-terminal state via a legal path only —
// contract.ts's LEGAL_TRANSITIONS table is enforced, not assumed.
function runAt(project: string, intent: string, state: "running" | "merged" | "failed" | "rejected"): string {
  const run = createRun(project, { intent, type: "chore", agent: "stub" });
  transitionRun(project, run.id, "briefed", "kernel");
  transitionRun(project, run.id, "dispatched", "kernel");
  transitionRun(project, run.id, "running", "kernel");
  if (state === "running") return run.id;
  if (state === "failed") {
    transitionRun(project, run.id, "failed", "kernel", "stub failure");
    return run.id;
  }
  if (state === "rejected") {
    transitionRun(project, run.id, "failed", "kernel", "stub failure");
    transitionRun(project, run.id, "rejected", "user", "not what we wanted");
    return run.id;
  }
  transitionRun(project, run.id, "verifying", "kernel");
  transitionRun(project, run.id, "ready", "kernel");
  transitionRun(project, run.id, "merged", "user");
  return run.id;
}

/**
 * A fast, deterministic stand-in for dispatch.ts's real dispatchRun — used ONLY by the
 * two dispatch-wave-over-HTTP tests below, via the dispatchRunFn seam api.ts now exposes
 * on DelegationApiContext. Production code never uses this: the route always calls the
 * real dispatchRun when the seam is absent, so this changes nothing about what ships.
 * It still performs the two facts those tests actually assert on — a real run record
 * exists, and it is attached to the goal — without compileBrief's own work in the loop.
 */
async function fakeDispatchRun(
  projectDir: string,
  options: { intent: string; type?: string; goalId?: string },
): Promise<{ task: { id: string } }> {
  const task = createRun(projectDir, { intent: options.intent, type: (options.type as never) ?? "chore", agent: "stub" });
  transitionRun(projectDir, task.id, "briefed", "kernel");
  if (options.goalId) attachRunToGoal(projectDir, options.goalId, task.id);
  return { task: readRun(projectDir, task.id) };
}

const TOKEN = "test-token-0123456789abcdef0123456789abcdef";

/** Same daemon-in-miniature the delegation API's own tests use — guard first, then the
 * delegation handler — kept local to this file rather than imported from
 * delegation-api.test.ts, which is off-limits to touch. */
async function startApi(
  projectDir: string,
  options: { dispatchRunFn?: DelegationApiContext["dispatchRunFn"] } = {},
): Promise<{ server: Server; port: number; feed: DelegationFeed }> {
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
    if (await handleDelegationRoute({ projectDir, feed, room, pty, dispatchRunFn: options.dispatchRunFn }, req, res, url)) return;
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, port, feed };
}

/** Always tears down both the listening socket AND the feed's fs.watch handle — a bare
 * server.close() leaves that watcher's handle open and the process alive. */
function closeApi(handle: { server: Server; feed: DelegationFeed }): void {
  handle.feed.close();
  handle.server.close();
}

function apiFetch(port: number, path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { host: `127.0.0.1:${port}`, "content-type": "application/json" };
  if (options.method && options.method !== "GET") headers.authorization = `Bearer ${TOKEN}`;
  return fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers });
}

// --- goalWaveStatus: pure derivation, never persisted ---------------------------------

test("goalWaveStatus derives all five statuses from fixture run states", { timeout: 5_000 }, () => {
  const project = tempProject();

  // due: first wave, no runs attached yet.
  const dueGoal = createGoal(project, { intent: "due goal", plan: [[{ intent: "a", type: "chore", files_scope: [] }]] });
  assert.deepEqual(goalWaveStatus(project, readGoal(project, dueGoal.id)), [{ status: "due" }]);

  // waiting: second wave, no runs, but the first wave is still running (not merged).
  const waitingGoal = createGoal(project, {
    intent: "waiting goal",
    plan: [[{ intent: "a", type: "chore", files_scope: [] }], [{ intent: "b", type: "chore", files_scope: [] }]],
  });
  const runningId = runAt(project, "wave 0 run", "running");
  attachRunToGoal(project, waitingGoal.id, runningId, 0);
  const waitingStatuses = goalWaveStatus(project, readGoal(project, waitingGoal.id));
  assert.equal(waitingStatuses[0].status, "executing");
  assert.equal(waitingStatuses[1].status, "waiting");

  // merged: every attached run reached merged.
  const mergedGoal = createGoal(project, { intent: "merged goal", plan: [[{ intent: "a", type: "chore", files_scope: [] }]] });
  const mergedId = runAt(project, "merged run", "merged");
  attachRunToGoal(project, mergedGoal.id, mergedId, 0);
  assert.equal(goalWaveStatus(project, readGoal(project, mergedGoal.id))[0].status, "merged");

  // partial: every attached run settled, but not all merged — the failed one is named.
  const partialGoal = createGoal(project, {
    intent: "partial goal",
    plan: [[
      { intent: "keeper", type: "chore", files_scope: [] },
      { intent: "loser", type: "chore", files_scope: [] },
    ]],
  });
  const keptId = runAt(project, "keeper run", "merged");
  const failedId = runAt(project, "loser run", "failed");
  attachRunToGoal(project, partialGoal.id, keptId, 0);
  attachRunToGoal(project, partialGoal.id, failedId, 0);
  const partialStatus = goalWaveStatus(project, readGoal(project, partialGoal.id))[0];
  assert.equal(partialStatus.status, "partial");
  assert.deepEqual(partialStatus.failed_run_ids, [failedId]);
});

// --- POST /goals/:id/dispatch-wave -----------------------------------------------------

test("POST /goals/:id/dispatch-wave refuses a wave that is not due", { timeout: 15_000 }, async () => {
  const project = tempGitProject();
  const handle = await startApi(project);
  try {
    // wave 1 is 'waiting' — wave 0 has no run attached yet, so it is not merged.
    const waitingGoal = createGoal(project, {
      intent: "two wave goal",
      plan: [[{ intent: "a", type: "chore", files_scope: [] }], [{ intent: "b", type: "chore", files_scope: [] }]],
    });
    const waitingRes = await apiFetch(handle.port, `/goals/${waitingGoal.id}/dispatch-wave`, {
      method: "POST",
      body: JSON.stringify({ wave_index: 1 }),
    });
    assert.equal(waitingRes.status, 409);
    const waitingBody = (await waitingRes.json()) as { ok: boolean; error: string };
    assert.equal(waitingBody.ok, false);
    assert.match(waitingBody.error, /not due \(status: waiting\)/);

    // A wave that already has a run attached ('executing') is refused too — dispatching
    // it again would double-dispatch a wave already in flight.
    const busyGoal = createGoal(project, { intent: "busy goal", plan: [[{ intent: "a", type: "chore", files_scope: [] }]] });
    const runningId = runAt(project, "already dispatched", "running");
    attachRunToGoal(project, busyGoal.id, runningId, 0);
    const busyRes = await apiFetch(handle.port, `/goals/${busyGoal.id}/dispatch-wave`, { method: "POST", body: "{}" });
    assert.equal(busyRes.status, 409);
    const busyBody = (await busyRes.json()) as { ok: boolean; error: string };
    assert.equal(busyBody.ok, false);
    assert.match(busyBody.error, /no wave due for dispatch/);
  } finally {
    closeApi(handle);
  }
});

test(
  "POST /goals/:id/dispatch-wave dispatches a due wave through the SAME path kage_dispatch uses, attaching every spec",
  { timeout: 15_000 },
  async () => {
    const project = tempGitProject();
    const handle = await startApi(project, { dispatchRunFn: fakeDispatchRun as never });
    try {
      const goal = createGoal(project, {
        intent: "ship the feature",
        plan: [[
          { intent: "part one", type: "chore", files_scope: ["a.ts"] },
          { intent: "part two", type: "chore", files_scope: ["b.ts"] },
        ]],
      });
      const res = await apiFetch(handle.port, `/goals/${goal.id}/dispatch-wave`, {
        method: "POST",
        body: JSON.stringify({ agent: "stub", hold: true }),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { ok: boolean; goal_id: string; wave_index: number; run_ids: string[] };
      assert.equal(body.ok, true);
      assert.equal(body.wave_index, 0);
      assert.equal(body.run_ids.length, 2, "every spec in the due wave must produce a run");

      const reread = readGoal(project, goal.id);
      assert.deepEqual([...reread.plan.waves[0].run_ids].sort(), [...body.run_ids].sort());
      for (const runId of body.run_ids) assert.equal(readRun(project, runId).state, "briefed");
    } finally {
      closeApi(handle);
    }
  },
);

test(
  "dispatch-wave attaches every spec regardless of max_concurrent, and an over-cap run still queues through the kernel's own admission gate",
  { timeout: 15_000 },
  async () => {
    const project = tempGitProject();
    writeDelegationConfig(project, { max_concurrent: 1 });
    const handle = await startApi(project, { dispatchRunFn: fakeDispatchRun as never });
    try {
      // Occupy the one available slot with a genuinely live, unrelated run.
      const occupying = createRun(project, { intent: "holding the slot", type: "chore", agent: "stub" });
      transitionRun(project, occupying.id, "briefed", "kernel");
      transitionRun(project, occupying.id, "dispatched", "kernel");
      transitionRun(project, occupying.id, "running", "kernel");
      patchRun(project, occupying.id, { agent_pid: process.pid });

      const goal = createGoal(project, {
        intent: "two runs, one slot",
        plan: [[
          { intent: "spec one", type: "chore", files_scope: [] },
          { intent: "spec two", type: "chore", files_scope: [] },
        ]],
      });
      const res = await apiFetch(handle.port, `/goals/${goal.id}/dispatch-wave`, {
        method: "POST",
        body: JSON.stringify({ agent: "stub", hold: true }),
      });
      const body = (await res.json()) as { ok: boolean; run_ids: string[] };
      assert.equal(body.ok, true);
      // dispatch-wave itself never throttles by max_concurrent — it dispatches everything
      // the due wave planned, exactly as the brief's "excess queue as the kernel already
      // handles" describes.
      assert.equal(body.run_ids.length, 2);

      for (const runId of body.run_ids) {
        await superviseRun(project, runId, stubAdapter());
        const run = readRun(project, runId);
        assert.equal(run.state, "briefed", "a run created over the cap must be left queued, not run");
        assert.equal(run.waiting_on?.needs, "a free run slot");
      }
    } finally {
      closeApi(handle);
    }
  },
);

// --- goal reads carry the derived wave status ------------------------------------------

test("GET /goals and GET /goals/:id carry the derived wave_status", { timeout: 15_000 }, async () => {
  const project = tempProject();
  const handle = await startApi(project);
  try {
    const goal = createGoal(project, {
      intent: "two waves",
      plan: [[{ intent: "a", type: "chore", files_scope: [] }], [{ intent: "b", type: "chore", files_scope: [] }]],
    });

    const list = (await (await apiFetch(handle.port, "/goals")).json()) as { goals: Array<{ id: string; wave_status: unknown }> };
    const listed = list.goals.find((g) => g.id === goal.id);
    assert.ok(listed, "the created goal must be in the list");
    assert.deepEqual(listed?.wave_status, [{ status: "due" }, { status: "waiting" }]);

    const single = (await (await apiFetch(handle.port, `/goals/${goal.id}`)).json()) as { goal: { wave_status: unknown } };
    assert.deepEqual(single.goal.wave_status, [{ status: "due" }, { status: "waiting" }]);
  } finally {
    closeApi(handle);
  }
});

// --- goal continuity for a brand-new manager session ------------------------------------

test(
  "the open-goals digest includes a due goal's wave-is-due phrasing and omits terminal goals",
  { timeout: 5_000 },
  () => {
    const project = tempProject();

    const openGoal = createGoal(project, { intent: "still open\nsecond line ignored", plan: [[{ intent: "a", type: "chore", files_scope: [] }]] });

    const doneGoal = createGoal(project, { intent: "finished goal", plan: [[{ intent: "a", type: "chore", files_scope: [] }]] });
    const mergedId = runAt(project, "finishing run", "merged");
    attachRunToGoal(project, doneGoal.id, mergedId, 0);
    assert.equal(readGoal(project, doneGoal.id).state, "done", "fixture sanity: the goal must actually be terminal");

    const lines = openGoalsDigestLines(project);
    assert.equal(lines.length, 1, "a terminal goal must never appear in the digest");
    assert.match(lines[0], new RegExp(openGoal.id));
    assert.match(lines[0], /still open/);
    assert.ok(!lines[0].includes("second line ignored"), "only the intent's first line is used");
    assert.match(lines[0], /wave 0 is due — dispatch it or say why not/);
    assert.ok(!lines.some((line) => line.includes(doneGoal.id)));

    const prompt = managerPromptFor(project);
    assert.ok(prompt.startsWith(MANAGER_CONSTITUTION), "the digest is appended, never replaces the constitution");
    assert.match(prompt, new RegExp(openGoal.id));
    assert.ok(!prompt.includes(doneGoal.id));
  },
);

test("the open-goals digest is capped at 3 goals", { timeout: 5_000 }, () => {
  const project = tempProject();
  for (let i = 0; i < 5; i++) {
    createGoal(project, { intent: `goal number ${i}`, plan: [[{ intent: "a", type: "chore", files_scope: [] }]] });
  }
  assert.equal(openGoalsDigestLines(project).length, 3);
});

test("managerPromptFor is exactly the constitution when there are no open goals", { timeout: 5_000 }, () => {
  const project = tempProject();
  assert.equal(managerPromptFor(project), MANAGER_CONSTITUTION);
});

test(
  "ensureOrchestratorWorktree (room-pty.ts) writes the open-goals digest into CLAUDE.md alongside the constitution",
  { timeout: 15_000 },
  () => {
    const project = tempGitProject();
    const goal = createGoal(project, { intent: "inherit me", plan: [[{ intent: "a", type: "chore", files_scope: [] }]] });

    const cwd = ensureOrchestratorWorktree(project);
    const content = readFileSync(join(cwd, "CLAUDE.md"), "utf8");
    assert.ok(content.includes(MANAGER_CONSTITUTION), "the full constitution must still be present");
    assert.match(content, new RegExp(goal.id));
    assert.match(content, /wave 0 is due — dispatch it or say why not/);
  },
);

test(
  "buildHeadlessRoomArgs (room-supervisor.ts) carries the open-goals digest when given managerPromptFor's output",
  { timeout: 5_000 },
  () => {
    const project = tempProject();
    const goal = createGoal(project, { intent: "headless inherit me", plan: [[{ intent: "a", type: "chore", files_scope: [] }]] });

    const args = buildHeadlessRoomArgs({ mcpConfigPath: "/tmp/room-mcp.json", systemPrompt: managerPromptFor(project) });
    const promptIndex = args.indexOf("--append-system-prompt");
    assert.notEqual(promptIndex, -1);
    const prompt = args[promptIndex + 1];
    assert.ok(prompt.startsWith(MANAGER_CONSTITUTION));
    assert.match(prompt, new RegExp(goal.id));

    // Omitting systemPrompt (every pre-existing caller) is unchanged — the fallback is the
    // bare constitution, same as before this file existed.
    const bare = buildHeadlessRoomArgs({ mcpConfigPath: "/tmp/room-mcp.json" });
    assert.equal(bare[bare.indexOf("--append-system-prompt") + 1], MANAGER_CONSTITUTION);
  },
);
