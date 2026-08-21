// Goal state must reconcile on READ, not only on a live run transition — goal.ts's
// onRunTransition hook (syncGoalCompletion) only fires going forward from the moment it
// was registered. A goal whose runs already reached a terminal state before the hook
// existed — or via any path that mutates a run without going through transitionRun — is
// never revisited by the hook and sits stuck in 'planning'/'executing' forever. These
// tests write goal records directly to disk (bypassing attachRunToGoal/transitionGoal
// entirely) to simulate exactly that: a goal as it would look after upgrading into a
// repo with pre-existing, already-settled runs.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRun, transitionRun } from "./delegation/contract.js";
import { createGoal, goalDir, listGoals, readGoal, type GoalRecord, type GoalState } from "./delegation/goal.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-goal-reconcile-"));
}

/** Drive a freshly created run through the kernel's own legal chain to a terminal state,
 * exactly as a real dispatch/verify/ratify cycle would — never hand-write a run record. */
function settleRun(project: string, runId: string, terminal: "merged" | "rejected" | "failed"): void {
  transitionRun(project, runId, "briefed", "kernel");
  transitionRun(project, runId, "dispatched", "kernel");
  transitionRun(project, runId, "running", "kernel");
  if (terminal === "failed") {
    transitionRun(project, runId, "failed", "kernel");
    return;
  }
  transitionRun(project, runId, "verifying", "kernel");
  transitionRun(project, runId, "ready", "kernel");
  transitionRun(project, runId, terminal, "kernel");
}

/** Write a goal record straight to disk, bypassing createGoal/attachRunToGoal/
 * transitionGoal entirely — this is the "pre-hook" shape: a goal whose plan already
 * lists runs that later settled, but whose `state` field was never revisited. */
function writeGoalDirect(project: string, goal: GoalRecord): void {
  const dir = goalDir(project, goal.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "goal.json"), `${JSON.stringify(goal, null, 2)}\n`, "utf8");
}

function rawGoal(id: string, state: GoalState, runIds: string[], historyStates: GoalState[]): GoalRecord {
  const at = new Date(0).toISOString();
  return {
    schema_version: 1,
    id,
    intent: `fixture: ${id}`,
    state,
    plan: {
      waves: [
        {
          runs: runIds.map((_, i) => ({ intent: `part ${i + 1}`, type: "chore" as const, files_scope: [] })),
          run_ids: runIds,
        },
      ],
    },
    autonomy: "recommend",
    budgets: { usd: 20, runs: 10 },
    state_history: historyStates.map((s) => ({ state: s, at })),
    created_at: at,
    updated_at: at,
  };
}

test("readGoal: a goal written directly to disk in 'planning' with all-terminal runs reads back as 'done' (the production bug)", () => {
  const project = tempProject();
  const runA = createRun(project, { intent: "part one", type: "chore", agent: "stub" });
  const runB = createRun(project, { intent: "part two", type: "chore", agent: "stub" });
  settleRun(project, runA.id, "rejected");
  settleRun(project, runB.id, "merged");

  const goal = rawGoal("goal-preexisting-all-terminal", "planning", [runA.id, runB.id], ["planning"]);
  writeGoalDirect(project, goal);

  // Without read-time reconciliation this stays 'planning' forever — the exact bug
  // measured on the delegation repo itself (two real goals stuck this way).
  const read = readGoal(project, goal.id);
  assert.equal(read.state, "done");
  assert.equal(read.state_history.at(-1)?.state, "done");
  assert.equal(read.state_history.some((c) => c.state === "executing"), true, "must pass through executing, not jump straight there");
});

test("readGoal: a goal with one still-running run reads back 'executing', not 'done'", () => {
  const project = tempProject();
  const runA = createRun(project, { intent: "part one", type: "chore", agent: "stub" });
  const runB = createRun(project, { intent: "part two", type: "chore", agent: "stub" });
  settleRun(project, runA.id, "merged");
  transitionRun(project, runB.id, "briefed", "kernel");
  transitionRun(project, runB.id, "dispatched", "kernel");
  transitionRun(project, runB.id, "running", "kernel");

  const goal = rawGoal("goal-one-still-running", "planning", [runA.id, runB.id], ["planning"]);
  writeGoalDirect(project, goal);

  const read = readGoal(project, goal.id);
  assert.equal(read.state, "executing");
});

test("readGoal: an 'abandoned' goal with all-terminal runs stays 'abandoned' — terminal states never resurrect", () => {
  const project = tempProject();
  const runA = createRun(project, { intent: "part one", type: "chore", agent: "stub" });
  settleRun(project, runA.id, "merged");

  const goal = rawGoal("goal-abandoned-with-terminal-runs", "abandoned", [runA.id], ["planning", "abandoned"]);
  writeGoalDirect(project, goal);

  const read = readGoal(project, goal.id);
  assert.equal(read.state, "abandoned");
  assert.equal(read.state_history.length, 2, "reconcile must not touch an already-terminal goal's history");
});

test("readGoal: reconcile is idempotent — reading twice does not thrash the record or rewrite it a second time", () => {
  const project = tempProject();
  const runA = createRun(project, { intent: "part one", type: "chore", agent: "stub" });
  settleRun(project, runA.id, "merged");

  const goal = rawGoal("goal-idempotent-read", "planning", [runA.id], ["planning"]);
  writeGoalDirect(project, goal);

  const first = readGoal(project, goal.id);
  assert.equal(first.state, "done");
  const second = readGoal(project, goal.id);
  assert.equal(second.state, "done");
  assert.equal(second.state_history.length, first.state_history.length, "a second read must not append further transitions");
  assert.equal(second.updated_at, first.updated_at, "a second read must not perform another write");

  // listGoals goes through the same reconcile path — must agree, and stay idempotent too.
  const listed = listGoals(project).find((g) => g.id === goal.id);
  assert.equal(listed?.state, "done");
  assert.equal(listed?.state_history.length, first.state_history.length);
});

test("readGoal: a goal with no attached runs stays 'planning'", () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "nothing dispatched yet" });
  assert.equal(goal.state, "planning");

  const read = readGoal(project, goal.id);
  assert.equal(read.state, "planning");
  assert.equal(read.state_history.length, 1);
});
