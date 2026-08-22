// Two defects found in a live incident (run p2b-memory-leaves-...-d911, 2026-08-22):
//
// 1. STOP MUST STOP — a manager stop transitioned the run's own record to "stopped" at
//    06:58:25, but the detached supervisor and its agent child kept running, untracked,
//    for 14+ minutes until an operator killed them by hand. `kage_stop` (mcp/index.ts)
//    used to call transitionRun directly and never told the live process anything — the
//    record and reality diverged the instant it ran. Fixed by control.ts's stopAndConfirm/
//    stopRun: always deliver the control op, poll liveness for a confirmation window, and
//    — if the process is unreachable or wedged — force a group-kill of its whole process
//    tree (the same SIGTERM/grace/SIGKILL sweep verify.ts's tree-kill machinery already
//    runs for a hung check command) before ever calling the run finished.
//
// 2. MANAGER STOPS MUST CARRY A REASON — that same stop landed with no reason recorded
//    anywhere on the run, leaving the operator to guess (it was the overlap guard).
//    Fixed by requiring `reason` on the `kage_stop` tool and threading it through the
//    `stop` control op into the eventual `stopped` transition's note, where the app's
//    Activity timeline and what-now line already render it.
//
// Its own file per this repo's rule — new behaviour gets a new test file, and
// mcp/delegation.test.ts is a known append-collision hotspot.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRun, isProcessAlive, listRuns, readRun, transitionRun } from "./delegation/contract.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { stopRun } from "./delegation/control.js";
import { callTool } from "./index.js";

const CLI = join(__dirname, "cli.js");

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

// A real git repo with a trivial, always-passing test command — mirrors
// dispatch-durability.test.ts's own fixture, the proven harness for a real detached
// `kage supervise` process under the stub adapter.
function tempGitProject(): string {
  const project = mkdtempSync(join(tmpdir(), "kage-run-control-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  writeDelegationConfig(project, { test: "true" });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

async function waitFor(check: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting for condition");
    await new Promise((r) => setTimeout(r, 50));
  }
}

function runningStubRun(project: string): string {
  const task = createRun(project, { intent: "needs a decision", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  return task.id;
}

// --- defect 1: STOP MUST STOP -------------------------------------------------------

test("REGRESSION: a manager stop confirms the run's detached supervisor pid is actually gone, not just the record", async () => {
  const project = tempGitProject();
  // KAGE_STUB_RUN_DELAY_MS holds the stub's non-live adapter.run() open well past this
  // test's own (deliberately short) confirmation window — the stub never spawns a live
  // child, so the control op alone cannot make it exit; only the force-kill escalation
  // (sweepProcessGroup) can, which is exactly the path this test exercises.
  const shell = spawn(
    process.execPath,
    [CLI, "dispatch", "leave a durable note", "--agent", "stub", "--project", project, "--quiet"],
    { cwd: project, stdio: "ignore", env: { ...process.env, KAGE_STUB_RUN_DELAY_MS: "30000" } },
  );

  let runId = "";
  try {
    await waitFor(() => {
      const runs = listRuns(project);
      if (!runs.length) return false;
      runId = runs[0].id;
      return runs[0].state === "running";
    });
    await waitFor(() => Boolean(readRun(project, runId).supervisor_pid));
    const supervisorPid = readRun(project, runId).supervisor_pid as number;
    assert.ok(isProcessAlive(supervisorPid), "the detached supervisor must actually be running before this test stops it");

    const { run, outcome } = await stopRun(project, runId, "manager", "incident: confirming a manager stop actually kills the process", {
      confirmWindowMs: 300,
      pollMs: 20,
      sweepGraceMs: 300,
    });

    // REVERT CHECK: before this fix, kage_stop (and this helper) only ever flipped the
    // run's own record — this pid would still be alive here, exactly like the
    // 14-minute-orphan incident this test is named after.
    assert.equal(isProcessAlive(supervisorPid), false, "the supervisor pid must actually be dead, not just recorded as stopped");
    assert.equal(outcome.swept, true, "a stub run with no live child can only be confirmed stopped by the group-kill sweep");
    assert.equal(outcome.confirmed, false);
    assert.equal(run.state, "stopped");
    assert.equal(readRun(project, runId).state, "stopped");

    // defect 2, exercised on the same run: the reason and actor must land on the record.
    const last = run.state_history[run.state_history.length - 1];
    assert.equal(last.by, "manager");
    assert.match(last.note ?? "", /incident: confirming a manager stop actually kills the process/);
  } finally {
    shell.kill("SIGTERM");
  }
});

test("stopAndConfirm reports a graceful stop as confirmed, never swept, when the process exits on its own", async () => {
  // A run with no supervisor at all (never dispatched) is the simplest honest case of
  // "nothing to stop" — isRunLive is false immediately, no sweep is ever attempted.
  const project = tempGitProject();
  const task = createRun(project, { intent: "never dispatched", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");

  const { run, outcome } = await stopRun(project, task.id, "manager", "no supervisor was ever live for this run", {
    confirmWindowMs: 100,
    pollMs: 10,
    sweepGraceMs: 100,
  });

  assert.equal(outcome.confirmed, true);
  assert.equal(outcome.swept, false);
  assert.equal(outcome.delivered, false, "nothing was ever listening — delivered must stay honest, not claim success");
  assert.equal(run.state, "stopped");
});

// --- defect 2: MANAGER STOPS MUST CARRY A REASON ------------------------------------

test("kage_stop refuses a manager stop with no reason, and leaves the run untouched", async () => {
  const project = tempGitProject();
  const runId = runningStubRun(project);

  const result = await callTool("kage_stop", { project_dir: project, run_id: runId });
  const message = (result as { content: Array<{ text: string }> }).content[0].text;

  assert.match(message, /needs a reason/i);
  // REVERT CHECK: before this fix, kage_stop transitioned unconditionally — this
  // assertion fails on a revert because the run would already be "stopped" here.
  assert.equal(readRun(project, runId).state, "running", "a refused stop must never touch the run");
});

test("kage_stop with a reason stops the run and records who and why in state_history", async () => {
  const project = tempGitProject();
  const runId = runningStubRun(project);

  const result = await callTool("kage_stop", {
    project_dir: project,
    run_id: runId,
    reason: "overlap guard tripped — a second run started against the same branch",
  });
  const message = (result as { content: Array<{ text: string }> }).content[0].text;
  assert.doesNotMatch(message, /needs a reason/i);

  const run = readRun(project, runId);
  assert.equal(run.state, "stopped");
  const last = run.state_history[run.state_history.length - 1];
  assert.equal(last.by, "manager");
  assert.match(last.note ?? "", /overlap guard tripped/);
});
