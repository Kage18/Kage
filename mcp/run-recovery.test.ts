// Tests for mcp/delegation/recovery.ts — bringing back a run that is stopped on budget
// or orphaned (its supervisor died while its agent kept working). Deliberately its own
// file, not appended to delegation.test.ts (append-collision merge conflicts) or
// run-budget.test.ts (a different concern: enforcement, not recovery).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createRun,
  patchRun,
  readRun,
  sweepDeadRuns,
  transitionRun,
  writeClaim,
} from "./delegation/contract.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { adapterByName } from "./delegation/adapters/index.js";
import { superviseRun } from "./delegation/supervisor.js";
import { createWorktree, worktreePath } from "./delegation/worktree.js";
import { adoptOrphanedRun, killOrphanedAgent, resumeStoppedRun } from "./delegation/recovery.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-run-recovery-"));
}

function tempGitProject(options: { testCommand?: string } = {}): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  if (options.testCommand) writeDelegationConfig(project, { test: options.testCommand });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

// A pid essentially guaranteed not to be alive on any real machine or CI runner —
// the same convention delegation.test.ts's own dead-supervisor regression test uses.
const DEAD_PID = 999_999;

// --- resumeStoppedRun: same run id, worktree, branch and agent session -----------

test("a stopped run resumes with a raised budget and keeps its id, worktree and branch", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, {
    intent: "narrow layout work",
    type: "bugfix",
    agent: "stub",
    budgets: { usd: 2, minutes: 30, diff_lines: 400 },
  });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  const worktree = createWorktree(project, task.id, task.branch);
  patchRun(project, task.id, {
    worktree: worktree.path,
    agent_session_id: "orig-session",
    spend: { usd_est: 5.22, minutes: 20.9 },
  });
  transitionRun(
    project,
    task.id,
    "stopped",
    "kernel",
    "estimated spend $5.22 exceeded the $2.00 budget — resume it with `kage resume-run <run-id> --budget-usd <n>`",
  );
  assert.equal(readRun(project, task.id).state, "stopped");

  // REVERT CHECK: without resumeStoppedRun reusing steer.ts's reattach machinery, this
  // run has no way back short of `kage retry` (which starts a NEW agent session, losing
  // context) — the reattached spawn below must carry `--resume orig-session`, not a
  // fresh `--session-id`.
  const liveStub = stubAdapter({ live: { question: "n/a", firstResult: "claim" }, statement: "continued and finished" });
  const spawnCalls: Array<{ sessionId?: string; resumeSessionId?: string }> = [];
  const realSpawnLive = liveStub.spawnLive!;
  liveStub.spawnLive = (input) => {
    spawnCalls.push({ sessionId: input.sessionId, resumeSessionId: input.resumeSessionId });
    return realSpawnLive(input);
  };

  let supervised: Promise<void> | null = null;
  const reattach = (_projectDir: string, reentrantTask: { id: string }): { pid: number | undefined } => {
    supervised = superviseRun(project, reentrantTask.id, liveStub);
    return { pid: 424_242 };
  };

  const result = await resumeStoppedRun(project, task.id, 8, () => liveStub, reattach);
  assert.equal(result.ok, true, result.message);
  assert.ok(supervised, "resuming a stopped run must reattach a supervisor");
  await supervised!;

  assert.equal(spawnCalls[0]?.resumeSessionId, "orig-session", "resume must continue the SAME agent session, not start a new one");
  assert.equal(spawnCalls[0]?.sessionId, undefined);

  const finished = readRun(project, task.id);
  assert.equal(finished.id, task.id, "resume must not create a different run");
  assert.equal(finished.branch, task.branch);
  assert.equal(finished.worktree, worktree.path);
  assert.equal(finished.budgets.usd, 8, "the budget must actually be raised");
  assert.equal(finished.state, "ready", "the reattached supervisor's claim must actually be collected");
});

test("a stopped run with no budget raise is refused with a message naming the resume command", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, {
    intent: "over budget work",
    type: "bugfix",
    agent: "stub",
    budgets: { usd: 2, minutes: 30, diff_lines: 400 },
  });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  patchRun(project, task.id, { agent_session_id: "orig-session", spend: { usd_est: 5.22, minutes: 20.9 } });
  transitionRun(project, task.id, "stopped", "kernel", "estimated spend $5.22 exceeded the $2.00 budget");

  // REVERT CHECK: without the refusal, this call would silently reattach with no budget
  // change and halt again on the very next usage tick.
  const omitted = await resumeStoppedRun(project, task.id, undefined, adapterByName);
  assert.equal(omitted.ok, false);
  assert.match(omitted.message, /kage resume-run <run-id> --budget-usd <n>/, "the refusal must name the actual resume command");
  assert.equal(readRun(project, task.id).state, "stopped", "a refused resume must not touch run state");

  const tooLow = await resumeStoppedRun(project, task.id, 2, adapterByName);
  assert.equal(tooLow.ok, false, "a budget no higher than the one that stopped it must also be refused");
  assert.match(tooLow.message, /kage resume-run/);
});

// --- orphan detection: supervisor dead, agent alive is its own state -------------

test("a dead-supervisor-plus-live-agent run resolves to the orphan state, not working or lost", () => {
  const project = tempGitProject();
  const task = createRun(project, { intent: "orphan detection", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  // process.pid (this test process) is guaranteed alive; DEAD_PID is not.
  patchRun(project, task.id, { agent_pid: process.pid, supervisor_pid: DEAD_PID });

  const view = readRun(project, task.id);
  // REVERT CHECK: without isOrphaned, displayState falls through to raw task.state
  // ("running") — exactly the misleading "working" the board showed live.
  assert.equal(view.display_state, "orphaned");
  assert.equal(view.stale, false, "an orphan is not the same as dropped — its agent is still alive");
  assert.equal(view.ownership, "needs_you", "nothing is coming back to finish this run on its own");
});

test("both supervisor and agent dead still reaps exactly as before — orphan detection changes nothing here", () => {
  const project = tempGitProject();
  const task = createRun(project, { intent: "both dead", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  patchRun(project, task.id, { agent_pid: DEAD_PID, supervisor_pid: DEAD_PID - 1 });

  const view = readRun(project, task.id);
  assert.equal(view.display_state, "dropped");
  assert.equal(view.stale, true);

  // graceMs 0: no grace window, so a genuinely dead run reaps immediately in this test.
  const reaped = sweepDeadRuns(project, 0);
  assert.equal(reaped.length, 1);
  assert.equal(reaped[0].id, task.id);
  const after = readRun(project, task.id);
  assert.equal(after.state, "failed", "reaping must still persist death exactly as it did before orphan detection existed");
});

// --- ordering: the worktree path must be durable BEFORE the agent is ever spawned -

test("the worktree path is durable before the agent is spawned, not after", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "ordering check", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");

  const liveStub = stubAdapter({ live: { question: "n/a", firstResult: "claim" } });
  const realSpawnLive = liveStub.spawnLive!;
  let worktreeAtSpawnTime: string | null | undefined;
  liveStub.spawnLive = (input) => {
    // The exact moment the agent process is about to start — read the run record AS IT
    // STANDS right now, not after superviseRun finishes.
    worktreeAtSpawnTime = readRun(project, task.id).worktree;
    return realSpawnLive(input);
  };

  await superviseRun(project, task.id, liveStub);

  // REVERT CHECK: without patchRun(..., { worktree }) landing BEFORE adapter.spawnLive
  // in supervisor.ts, this reads null — the exact shape that made recovering an orphan
  // require shelling out to `lsof` on its live process's cwd.
  assert.equal(worktreeAtSpawnTime, worktreePath(project, task.id), "the worktree must be persisted before the agent is ever spawned");
});

// --- adoptOrphanedRun: verifying a worktree with no agent claim ------------------

function orphanedFailedRun(project: string, testCommand: string): { runId: string; worktree: string } {
  const task = createRun(project, { intent: "adopt me", type: "bugfix", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  const worktree = createWorktree(project, task.id, task.branch);
  patchRun(project, task.id, { worktree: worktree.path });
  // The exact shape a dead supervisor leaves: no claim was ever written because it died
  // before the agent's work could be verified.
  transitionRun(project, task.id, "failed", "kernel", "agent process gone");
  writeDelegationConfig(project, { test: testCommand });
  return { runId: task.id, worktree: worktree.path };
}

test("adopt verifies an orphaned worktree with no agent claim and reaches ready", () => {
  const project = tempGitProject({ testCommand: "true" });
  const { runId, worktree } = orphanedFailedRun(project, "true");
  // Real, uncommitted work — exactly what a killed-mid-turn agent leaves behind.
  writeFileSync(join(worktree, "PARTIAL_WORK.md"), "orphaned work\n", "utf8");

  const result = adoptOrphanedRun(project, runId);
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state, "ready");

  const finished = readRun(project, runId);
  assert.equal(finished.state, "ready");
});

test("adopt refuses in three cases: agent still alive, a claim already exists, or there is nothing to adopt", () => {
  const stillAliveProject = tempGitProject({ testCommand: "true" });
  const stillAlive = orphanedFailedRun(stillAliveProject, "true");
  writeFileSync(join(stillAlive.worktree, "PARTIAL_WORK.md"), "still working\n", "utf8");
  patchRun(stillAliveProject, stillAlive.runId, { agent_pid: process.pid });
  const aliveResult = adoptOrphanedRun(stillAliveProject, stillAlive.runId);
  assert.equal(aliveResult.ok, false);
  assert.match(aliveResult.message, /still alive/, "adopting a live orphan would race its writes");
  assert.equal(readRun(stillAliveProject, stillAlive.runId).state, "failed", "a refused adopt must not touch run state");

  // A claim DID get written for this run (the ordinary path, not the orphan gap) — adopt
  // must defer to reverify rather than re-verifying it a second, different way.
  const claimedProject = tempGitProject({ testCommand: "true" });
  const claimed = orphanedFailedRun(claimedProject, "true");
  writeFileSync(join(claimed.worktree, "PARTIAL_WORK.md"), "already claimed\n", "utf8");
  writeClaim(claimedProject, claimed.runId, {
    schema_version: 1,
    run_id: claimed.runId,
    statement: "already reported by the agent",
    checks: [],
    unsure: [],
    learnings: [],
    protocol_ok: true,
    diff: { files: 0, lines: 0 },
    created_at: new Date(0).toISOString(),
  });
  const claimedResult = adoptOrphanedRun(claimedProject, claimed.runId);
  assert.equal(claimedResult.ok, false);
  assert.match(claimedResult.message, /kage reverify/);

  const emptyProject = tempGitProject({ testCommand: "true" });
  const empty = orphanedFailedRun(emptyProject, "true");
  const emptyResult = adoptOrphanedRun(emptyProject, empty.runId);
  assert.equal(emptyResult.ok, false);
  assert.match(emptyResult.message, /nothing to adopt/);
});

// --- killOrphanedAgent: deliberate only, spend shown ------------------------------

test("orphan-kill refuses a non-orphaned run, and kills a real live orphan while showing its last recorded spend", async () => {
  const freshProject = tempGitProject();
  const fresh = createRun(freshProject, { intent: "not orphaned", type: "chore", agent: "stub" });
  const refused = killOrphanedAgent(freshProject, fresh.id);
  assert.equal(refused.ok, false);
  assert.match(refused.message, /not orphaned/);

  const project = tempGitProject();
  const task = createRun(project, { intent: "kill me", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  // A real, killable child of THIS test process stands in for the orphaned agent.
  const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
  await new Promise((resolve) => child.once("spawn", resolve));
  patchRun(project, task.id, { agent_pid: child.pid, supervisor_pid: DEAD_PID, spend: { usd_est: 0.73, minutes: 4 } });

  const result = killOrphanedAgent(project, task.id);
  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /\$0\.73/, "the spend shown must be the last recorded figure");
  assert.match(result.message, /kage adopt/, "killing must point at the follow-up recovery command");
  assert.equal(readRun(project, task.id).state, "failed");

  const exited = await new Promise<boolean>((resolve) => {
    child.once("exit", () => resolve(true));
    setTimeout(() => resolve(false), 2000);
  });
  assert.equal(exited, true, "the agent process must actually be killed, not just marked dead in the record");
});
