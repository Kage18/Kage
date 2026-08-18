import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRun, patchRun, readRun, transitionRun } from "./delegation/contract.js";
import { createWorktree, worktreePath } from "./delegation/worktree.js";
import { handBack, readRunPtyRecord, runPtyRecordPath, takeOverRun, takeOverState, type PtyLike } from "./delegation/run-pty.js";

const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: "Test Author", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test Author", GIT_COMMITTER_EMAIL: "test@example.com" };

function tempGitProject(): string {
  const project = mkdtempSync(join(tmpdir(), "kage-run-pty-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

/** A fake pty: no real process, no billable claude session, fully scriptable. */
function fakePty(pid = 424_242) {
  const dataCbs: Array<(data: string) => void> = [];
  const exitCbs: Array<() => void> = [];
  const writes: string[] = [];
  const resizes: Array<[number, number]> = [];
  const pty: PtyLike = {
    pid,
    onData: (cb) => dataCbs.push(cb),
    onExit: (cb) => exitCbs.push(cb),
    write: (data) => writes.push(data),
    resize: (cols, rows) => resizes.push([cols, rows]),
    kill: () => {},
  };
  return { pty, emitData: (b: string) => dataCbs.forEach((cb) => cb(b)), emitExit: () => exitCbs.forEach((cb) => cb()), writes, resizes };
}

function seizableRun(project: string, options: { withWorktree?: boolean; withSession?: boolean; state?: "running" | "blocked" | "stopped" | "failed" } = {}): string {
  const { withWorktree = true, withSession = true, state = "blocked" } = options;
  const task = createRun(project, { intent: "fix the flaky test", type: "bugfix", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  if (state !== "running") transitionRun(project, task.id, state, "kernel", "test setup");
  if (withSession) patchRun(project, task.id, { agent_session_id: `session-${task.id}` });
  if (withWorktree) createWorktree(project, task.id, task.branch);
  return task.id;
}

// --- refusals: plain reasons, before ever touching a process ---------------------------

test("takeOverRun refuses with plain reasons: no session, a terminal state, a gone worktree", async () => {
  const project = tempGitProject();

  const noSession = seizableRun(project, { withSession: false });
  const r1 = await takeOverRun(project, noSession);
  assert.equal(r1.ok, false);
  if (!r1.ok) assert.match(r1.reason, /no agent session/);

  const draft = createRun(project, { intent: "not dispatched", type: "chore", agent: "stub" });
  patchRun(project, draft.id, { agent_session_id: "session-x" });
  const r2 = await takeOverRun(project, draft.id);
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.match(r2.reason, /draft/);

  const noWorktree = seizableRun(project, { withWorktree: false });
  const r3 = await takeOverRun(project, noWorktree);
  assert.equal(r3.ok, false);
  if (!r3.ok) assert.match(r3.reason, new RegExp(worktreePath(project, noWorktree).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

// --- the live-supervisor handoff --------------------------------------------------------

test("takeOverRun stops a live supervisor first via the EXISTING stop control, never fighting it for the session", async () => {
  const project = tempGitProject();
  const runId = seizableRun(project, { state: "blocked" });
  const stopCalls: unknown[] = [];
  const { pty } = fakePty();
  let liveCheckCount = 0;

  const result = await takeOverRun(project, runId, {
    // Live on the first check (decides whether to stop it); stopped by the second
    // (confirms the held child actually exited before proceeding).
    isRunLive: async () => (liveCheckCount += 1) === 1,
    sendControl: async (_p, _r, op) => {
      stopCalls.push(op);
      transitionRun(project, runId, "stopped", "kernel", "stopped by request");
      return { ok: true, delivered: true };
    },
    ptyFactory: async () => pty,
  });

  assert.equal(liveCheckCount, 2, "must check liveness before stopping, and confirm it after");
  assert.deepEqual(stopCalls, [{ op: "stop" }]);
  assert.equal(result.ok, true);
  assert.equal(readRun(project, runId).state, "running");
});

test("takeOverRun refuses if a supervisor never stops, and never touches the control when nothing is live", async () => {
  const project = tempGitProject();

  const stuck = seizableRun(project, { state: "blocked" });
  const stuckResult = await takeOverRun(project, stuck, { isRunLive: async () => true, sendControl: async () => ({ ok: true, delivered: true }), pollMs: 5, maxWaitMs: 30 });
  assert.equal(stuckResult.ok, false);
  if (!stuckResult.ok) assert.match(stuckResult.reason, /did not stop in time/);

  const idle = seizableRun(project, { state: "stopped" });
  let sendControlCalls = 0;
  const { pty } = fakePty();
  const idleResult = await takeOverRun(project, idle, { isRunLive: async () => false, sendControl: async () => { sendControlCalls += 1; return null; }, ptyFactory: async () => pty });
  assert.equal(sendControlCalls, 0);
  assert.equal(idleResult.ok, true);
});

// --- state transitions, agent_pid, and honest liveness ----------------------------------

test("takeOverRun transitions blocked/stopped/failed/already-running to running, by user, with agent_pid keyed off the pty", async () => {
  for (const state of ["blocked", "stopped", "failed", "running"] as const) {
    const project = tempGitProject();
    const runId = seizableRun(project, { state });
    const { pty } = fakePty(555_555);

    const result = await takeOverRun(project, runId, { isRunLive: async () => false, ptyFactory: async () => pty });
    assert.equal(result.ok, true, `state ${state} must be seizable`);

    const task = readRun(project, runId);
    assert.equal(task.state, "running");
    assert.equal(task.agent_pid, 555_555, "agent_pid must land even when starting from an already-running (supervisor-less) run");
    const last = task.state_history[task.state_history.length - 1];
    if (state === "running") {
      // running → running is an illegal self-transition, so no new history entry —
      // the state simply never left running.
      assert.notEqual(last.note, "taken over in a terminal");
    } else {
      assert.equal(last.by, "user");
      assert.equal(last.note, "taken over in a terminal");
    }
  }
});

test("takeOverRun writes an honest pty record, and takeOverState reports it truthfully", async () => {
  const project = tempGitProject();
  const runId = seizableRun(project, { state: "blocked" });
  const { pty } = fakePty(111_222);

  assert.deepEqual(takeOverState(project, runId), { active: false });
  const result = await takeOverRun(project, runId, { ptyFactory: async () => pty });
  assert.equal(result.ok, true);
  assert.equal(readRunPtyRecord(project, runId)?.pid, 111_222);
  assert.deepEqual(takeOverState(project, runId, { isProcessAlive: (pid) => pid === 111_222 }), { active: true, pid: 111_222 });
  assert.deepEqual(takeOverState(project, runId, { isProcessAlive: () => false }), { active: false });
});

// --- the attachment surface: write/resize/snapshot/onData/onExit/detach ----------------

test("the returned attachment delegates write/resize to the pty seam and accumulates a cumulative snapshot", async () => {
  const project = tempGitProject();
  const runId = seizableRun(project, { state: "blocked" });
  const rig = fakePty();
  const result = await takeOverRun(project, runId, { ptyFactory: async () => rig.pty });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  result.attachment.write("ls -la\n");
  assert.deepEqual(rig.writes, ["ls -la\n"]);
  result.attachment.resize(120, 40);
  assert.deepEqual(rig.resizes, [[120, 40]]);

  rig.emitData("total 0\n");
  rig.emitData("drwxr-xr-x  ...\n");
  assert.equal(result.attachment.snapshot(), "total 0\ndrwxr-xr-x  ...\n");

  const seen: string[] = [];
  result.attachment.onData((bytes) => seen.push(bytes));
  rig.emitData("more output\n");
  assert.deepEqual(seen, ["more output\n"]);

  let exited = false;
  result.attachment.onExit(() => (exited = true));
  rig.emitExit();
  assert.equal(exited, true);

  const seenAfterDetach: string[] = [];
  result.attachment.onData((bytes) => seenAfterDetach.push(bytes));
  result.attachment.detach();
  rig.emitData("should not be seen");
  assert.deepEqual(seenAfterDetach, [], "detach stops listening, but never kills the underlying session");
});

// --- handBack: kill, transition, reattach — the full circle -----------------------------

test("handBack refuses when there is no active take-over", async () => {
  const project = tempGitProject();
  const runId = seizableRun(project, { state: "blocked" });
  const result = await handBack(project, runId);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /no active terminal take-over/);
});

test("handBack waits for the pty to die, lands the run at stopped, clears the record, and spawns the reattach supervisor with the run's own id", async () => {
  const project = tempGitProject();
  const runId = seizableRun(project, { state: "blocked" });
  const rig = fakePty(333_444);
  const takeOver = await takeOverRun(project, runId, { ptyFactory: async () => rig.pty });
  assert.equal(takeOver.ok, true);

  let aliveChecks = 0;
  const reattachCalls: Array<{ id: string; state: string }> = [];
  const result = await handBack(project, runId, {
    isProcessAlive: () => (aliveChecks += 1) < 3, // dies on the third check
    pollMs: 5,
    reattach: (_projectDir, task) => {
      reattachCalls.push({ id: task.id, state: task.state });
      return { pid: 999_000 };
    },
  });

  assert.ok(aliveChecks >= 3, "must actually poll until the pty is gone before reattaching");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.task.state, "stopped");
  const last = result.task.state_history[result.task.state_history.length - 1];
  assert.equal(last.note, "handed back from take-over");
  assert.equal(last.by, "user");

  assert.deepEqual(reattachCalls, [{ id: runId, state: "stopped" }], "reattach must see the run already landed at stopped");
  assert.equal(readRunPtyRecord(project, runId), null, "the record must be cleared so takeOverState reports honestly");
  assert.deepEqual(takeOverState(project, runId), { active: false });

  // A torn record — mirroring room-pty.test.ts's own record-hygiene pattern — must
  // never throw, just report absence honestly.
  const tornPath = runPtyRecordPath(project, runId);
  writeFileSync(tornPath, "{{{not json", "utf8");
  assert.equal(readRunPtyRecord(project, runId), null);
});
