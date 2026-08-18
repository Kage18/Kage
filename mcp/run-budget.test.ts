// Budgets are written onto every run record and shown per-run in the app, but only
// diff_lines was ever actually enforced — usd and minutes were decoration. This file
// covers the fix: checkRunBudget's pure decision, supervisor.ts halting a live run the
// moment its streamed usage crosses budgets.usd, and the overrun staying visible on a
// finished run's receipt even when nothing stopped it mid-flight.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkRunBudget, createRun, patchRun, readRun, transitionRun } from "./delegation/contract.js";
import { superviseRun } from "./delegation/supervisor.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { worktreePath } from "./delegation/worktree.js";
import { loadReview } from "./delegation/tui/app.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-run-budget-"));
}

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

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

// --- checkRunBudget: the pure decision, unit-tested without a live agent ----------

test("checkRunBudget: spend inside both caps is untouched", () => {
  const result = checkRunBudget({ usd_est: 1.5, minutes: 10 }, { usd: 2, minutes: 30, diff_lines: 400 });
  assert.equal(result.exceeded, false);
  assert.equal(result.reason, undefined);
});

test("checkRunBudget: usd over the cap names both the limit and the actual figure", () => {
  const result = checkRunBudget({ usd_est: 3.4124, minutes: 13.2 }, { usd: 2, minutes: 30, diff_lines: 400 });
  assert.equal(result.exceeded, true);
  assert.match(result.reason ?? "", /\$3\.41/);
  assert.match(result.reason ?? "", /\$2\.00/);
});

test("checkRunBudget: minutes over the cap (usd still fine) also names both figures", () => {
  const result = checkRunBudget({ usd_est: 0.5, minutes: 45 }, { usd: 2, minutes: 30, diff_lines: 400 });
  assert.equal(result.exceeded, true);
  assert.match(result.reason ?? "", /45\.0 min/);
  assert.match(result.reason ?? "", /30 min/);
});

// --- supervisor.ts: enforcement on a live, streaming run --------------------------

test("a run whose streamed usage crosses its usd budget is halted, not run to completion", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, {
    intent: "over budget check",
    type: "chore",
    agent: "stub",
    budgets: { usd: 0.01, minutes: 30, diff_lines: 400 },
  });
  transitionRun(project, task.id, "briefed", "kernel");

  // firstResult: "claim" answers on the very first line, carrying total_cost_usd well
  // past the $0.01 budget — REVERT CHECK: with the enforcement removed, this same line
  // is a normal claim fence and the run finishes "ready", not "stopped".
  const liveStub = stubAdapter({ live: { question: "n/a", firstResult: "claim", usd: 0.5 } });
  await superviseRun(project, task.id, liveStub);

  const finished = readRun(project, task.id);
  assert.equal(finished.state, "stopped", "an over-budget run must halt, never reach ready");
  const last = finished.state_history[finished.state_history.length - 1];
  assert.equal(last.by, "kernel", "a budget halt is the kernel's own decision, not a user stop");
  assert.match(last.note ?? "", /\$0\.50/, "the note must name the actual estimated spend");
  assert.match(last.note ?? "", /\$0\.01/, "the note must name the budget it crossed");
});

test("a run whose streamed usage stays under budget completes normally, untouched", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, {
    intent: "under budget check",
    type: "chore",
    agent: "stub",
    budgets: { usd: 2, minutes: 30, diff_lines: 400 },
  });
  transitionRun(project, task.id, "briefed", "kernel");

  const liveStub = stubAdapter({ live: { question: "n/a", firstResult: "claim", usd: 0.01 } });
  await superviseRun(project, task.id, liveStub);

  const finished = readRun(project, task.id);
  assert.equal(finished.state, "ready", "well under budget, the run must reach its normal verified outcome");
  assert.ok(finished.spend.usd_est < finished.budgets.usd);
});

test("a budget halt keeps the run's worktree and partial diff intact for merge or resume", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, {
    intent: "worktree survives budget halt",
    type: "chore",
    agent: "stub",
    budgets: { usd: 0.01, minutes: 30, diff_lines: 400 },
  });
  transitionRun(project, task.id, "briefed", "kernel");

  const liveStub = stubAdapter({
    live: { question: "n/a", firstResult: "claim", usd: 0.5 },
    editFile: { path: "PARTIAL_WORK.md", content: "work in progress\n" },
  });
  await superviseRun(project, task.id, liveStub);

  assert.equal(readRun(project, task.id).state, "stopped");
  const workspace = worktreePath(project, task.id);
  assert.equal(existsSync(workspace), true, "the worktree must not be torn down on a budget halt");
  assert.equal(existsSync(join(workspace, "PARTIAL_WORK.md")), true, "the agent's partial edit must survive the halt");
});

// --- honest reporting after the fact: the receipt never hides an overrun ----------

test("a completed run whose final spend exceeded its budget shows the overrun on its receipt", () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, {
    intent: "receipt overrun check",
    type: "chore",
    agent: "stub",
    budgets: { usd: 2, minutes: 30, diff_lines: 400 },
  });
  for (const state of ["briefed", "dispatched", "running", "verifying", "ready"] as const) {
    transitionRun(project, task.id, state, "kernel");
  }
  // REVERT CHECK: without the receipt change, verboseReceipt prints only the static
  // BUDGETS line — this figure (measured on the real regression this brief cites) would
  // never appear anywhere on the card.
  patchRun(project, task.id, { spend: { usd_est: 3.4124, minutes: 13.2 } });

  const review = loadReview(project, task.id);
  const cardText = review.card.join("\n");
  assert.match(cardText, /over budget/i, "an over-budget completed run must say so on its own receipt");
  assert.match(cardText, /\$3\.41/, "the receipt must name the actual spend");
  assert.match(cardText, /\$2\.00/, "the receipt must name the budget it exceeded");
});

test("a completed run under budget shows no overrun on its receipt", () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, {
    intent: "receipt honesty, under budget",
    type: "chore",
    agent: "stub",
    budgets: { usd: 2, minutes: 30, diff_lines: 400 },
  });
  for (const state of ["briefed", "dispatched", "running", "verifying", "ready"] as const) {
    transitionRun(project, task.id, state, "kernel");
  }
  patchRun(project, task.id, { spend: { usd_est: 0.42, minutes: 5 } });

  const review = loadReview(project, task.id);
  const cardText = review.card.join("\n");
  assert.doesNotMatch(cardText, /over budget/i);
});
