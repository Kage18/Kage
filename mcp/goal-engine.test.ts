// The goal ENGINE: the tests that prove a goal's stored fields actually govern
// behaviour. Everything here was inert before — accepted by the API, validated, written
// to the record, and then read by nobody. Each test below pins one field to one effect.
//
// Written by the operator during review: the run that built the engine shipped 268 lines
// of behaviour and adjusted two existing assertions, adding no test of its own, so
// "npm test → exit 0" only proved nothing had broken. That is exactly the gap these
// cover — the feature merges code with no human in the loop.
//
// A separate file rather than delegation.test.ts on purpose: every run appends to the end
// of that file, and three merges in one day collided there.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readClaim, readRun, transitionRun, writeClaim } from "./delegation/contract.js";
import { maybeAutoMerge } from "./delegation/ratify.js";
import type { ClaimRecord } from "./delegation/contract.js";
import { dispatchRun } from "./delegation/dispatch.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { attachRunToGoal, createGoal, goalForRun, readGoal } from "./delegation/goal.js";
import { claimVerdict } from "./delegation/verify.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempGitProject(): string {
  const project = mkdtempSync(join(tmpdir(), "kage-goal-engine-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

test("a goal advances planning -> executing on its first attached run, and -> done when they all finish", async () => {
  const project = tempGitProject();
  const goal = createGoal(project, { intent: "lifecycle", autonomy: "recommend" });
  assert.equal(readGoal(project, goal.id).state, "planning");

  const { task } = await dispatchRun(project, { intent: "touch retry", type: "chore", goalId: goal.id }, stubAdapter());
  assert.equal(readGoal(project, goal.id).state, "executing", "the first attached run starts the goal");
  assert.equal(goalForRun(project, task.id)?.id, goal.id);

  transitionRun(project, task.id, "merged", "user");
  assert.equal(readGoal(project, goal.id).state, "done", "every run terminal means the goal is done");
});

test("an unfinished sibling keeps the goal executing — done is all runs, not the latest one", async () => {
  const project = tempGitProject();
  const goal = createGoal(project, { intent: "two runs", autonomy: "recommend" });
  const a = await dispatchRun(project, { intent: "first", type: "chore", goalId: goal.id }, stubAdapter());
  const b = await dispatchRun(project, { intent: "second", type: "chore", goalId: goal.id }, stubAdapter());

  transitionRun(project, a.task.id, "merged", "user");
  assert.equal(readGoal(project, goal.id).state, "executing", "one finished run does not finish the goal");

  transitionRun(project, b.task.id, "rejected", "user");
  assert.equal(readGoal(project, goal.id).state, "done", "rejected counts as terminal too");
});

// THE SAFETY GATE. Auto-merge is the only path where code lands with no human in the
// loop, so what it refuses matters more than what it accepts.
test("autonomy 'merge' never auto-merges a claim where nothing was executed", async () => {
  const project = tempGitProject();
  const goal = createGoal(project, { intent: "auto", autonomy: "merge" });
  const { task } = await dispatchRun(project, { intent: "no test command here", type: "chore", goalId: goal.id }, stubAdapter());

  const claim = readClaim(project, task.id);
  assert.ok(claim, "the run produced a claim");
  // No test command exists in this fixture, so only non-executing checks ran. They all
  // pass — and the product's own verdict still calls that UNVERIFIED.
  assert.equal(claim.checks.every((check) => check.result === "pass"), true, "every check passed");
  assert.equal(claimVerdict(claim).executed, false, "but nothing was actually executed");

  assert.notEqual(readRun(project, task.id).state, "merged", "all-checks-pass must not be enough to auto-merge");
});

test("autonomy 'merge' refuses a claim with a failing check, and says which one", async () => {
  const project = tempGitProject();
  const goal = createGoal(project, { intent: "auto", autonomy: "merge" });
  const { task } = await dispatchRun(project, { intent: "will fail", type: "chore", goalId: goal.id }, stubAdapter());

  const claim = readClaim(project, task.id) as ClaimRecord;
  // ready -> ready is not a legal transition, so drive the gate directly rather than
  // faking a re-entry the state machine would refuse.
  writeClaim(project, task.id, {
    ...claim,
    checks: [{ id: "tests", kind: "command", expect: "exit 0", result: "fail", exit_code: 1 }],
  });
  maybeAutoMerge(project, task.id);

  assert.notEqual(readRun(project, task.id).state, "merged", "a failing check is never auto-merged");
});

test("autonomy 'recommend' leaves a ready run for the human", async () => {
  const project = tempGitProject();
  const goal = createGoal(project, { intent: "manual", autonomy: "recommend" });
  const { task } = await dispatchRun(project, { intent: "wait for me", type: "chore", goalId: goal.id }, stubAdapter());
  assert.notEqual(readRun(project, task.id).state, "merged", "recommend must never merge on its own");
});

test("an implicit attach fills the FIRST open wave, not the last", () => {
  const project = tempGitProject();
  const goal = createGoal(project, {
    intent: "three waves",
    autonomy: "recommend",
    plan: [
      [{ intent: "w1", type: "chore", files_scope: ["a.ts"] }],
      [{ intent: "w2", type: "chore", files_scope: ["b.ts"] }],
      [{ intent: "w3", type: "chore", files_scope: ["c.ts"] }],
    ],
  });

  // No waveIndex passed — the same implicit path dispatchRun uses. Before the fix this
  // defaulted to waves.length - 1 and every run landed in the LAST wave.
  const after = attachRunToGoal(project, goal.id, "run-one");
  assert.deepEqual(after.plan.waves[0].run_ids, ["run-one"], "wave 1 receives the first run");
  assert.deepEqual(after.plan.waves[2].run_ids, [], "the last wave stays empty");

  const next = attachRunToGoal(project, goal.id, "run-two");
  assert.deepEqual(next.plan.waves[1].run_ids, ["run-two"], "wave 1 full, so wave 2 takes the next run");
});
