// Budget enforcement (mcp/run-budget.test.ts) can halt a run, but until this change
// there was no way to tell it what a run is worth: DEFAULT_RUN_BUDGETS was hardcoded,
// DelegationConfig had no budgets field, and `kage dispatch` had no per-task override.
// This file covers the fix: config.ts's configuredBudgets/effectiveBudgets precedence
// (override > config > default), that a partial config leaves the rest at their
// defaults, that dispatchRun actually wires an override into the created run's
// budgets, that the budget halt message names how to raise the limit, and that the
// legacy top-level `diff_budget` key and the new `budgets.diff_lines` key can never
// silently disagree.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkRunBudget, DEFAULT_RUN_BUDGETS } from "./delegation/contract.js";
import { configuredBudgets, diffBudget, effectiveBudgets, writeDelegationConfig } from "./delegation/config.js";
import { dispatchRun } from "./delegation/dispatch.js";
import { stubAdapter } from "./delegation/adapters/stub.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-budget-config-"));
}

// --- configuredBudgets / effectiveBudgets: pure precedence ------------------------

test("no config: configuredBudgets returns exactly the hardcoded default budgets", () => {
  const project = tempProject();
  assert.deepEqual(configuredBudgets(project), DEFAULT_RUN_BUDGETS);
});

test("config budgets override the defaults", () => {
  const project = tempProject();
  writeDelegationConfig(project, { budgets: { usd: 9, minutes: 90, diff_lines: 900 } });
  assert.deepEqual(configuredBudgets(project), { usd: 9, minutes: 90, diff_lines: 900 });
});

test("a partial config leaves unset fields at their defaults", () => {
  const project = tempProject();
  writeDelegationConfig(project, { budgets: { usd: 9 } });
  const budgets = configuredBudgets(project);
  assert.equal(budgets.usd, 9, "the field the config set");
  assert.equal(budgets.minutes, DEFAULT_RUN_BUDGETS.minutes, "untouched field stays at its default");
  assert.equal(budgets.diff_lines, DEFAULT_RUN_BUDGETS.diff_lines, "untouched field stays at its default");
});

test("config beats the hardcoded default when no override is given", () => {
  const project = tempProject();
  writeDelegationConfig(project, { budgets: { usd: 5 } });
  // REVERT CHECK: with DEFAULT_RUN_BUDGETS baked in and config.budgets never read, this
  // would still read 2 (DEFAULT_RUN_BUDGETS.usd) instead of the configured 5.
  assert.equal(effectiveBudgets(project).usd, 5);
});

test("an explicit per-dispatch override beats config, which beats the default", () => {
  const project = tempProject();
  writeDelegationConfig(project, { budgets: { usd: 5 } });
  assert.equal(effectiveBudgets(project, { usd: 12 }).usd, 12, "override wins over config");
  assert.equal(effectiveBudgets(project).minutes, DEFAULT_RUN_BUDGETS.minutes, "fields the override didn't touch fall through to config/default");
});

// --- dispatchRun: the override actually reaches the created run's budgets ---------

test("dispatchRun's budgetUsd option lands on the created run, ahead of repo config", async () => {
  const project = tempProject();
  writeDelegationConfig(project, { budgets: { usd: 5 } });
  // REVERT CHECK: if dispatch.ts stops passing `budgets: effectiveBudgets(...)` into
  // createRun (or drops options.budgetUsd from that call), this run's budgets.usd would
  // fall back to DEFAULT_RUN_BUDGETS.usd (2) or the configured 5, never the override.
  const held = await dispatchRun(project, { intent: "large synthesis job", type: "chore", briefOnly: true, budgetUsd: 25 }, stubAdapter());
  assert.equal(held.task.budgets.usd, 25);
});

test("dispatchRun with no override picks up the repo's configured budget, not the hardcoded default", async () => {
  const project = tempProject();
  writeDelegationConfig(project, { budgets: { usd: 5 } });
  const held = await dispatchRun(project, { intent: "ordinary chore", type: "chore", briefOnly: true }, stubAdapter());
  assert.equal(held.task.budgets.usd, 5);
});

// --- the halt message must tell the operator how to raise the limit ---------------

test("checkRunBudget's usd-exceeded reason names the CLI flag and the config key", () => {
  const result = checkRunBudget({ usd_est: 3, minutes: 1 }, { usd: 2, minutes: 30, diff_lines: 400 });
  assert.match(result.reason ?? "", /--budget-usd/, "must name the per-dispatch flag");
  assert.match(result.reason ?? "", /budgets\.usd/, "must name the config key");
});

test("checkRunBudget's minutes-exceeded reason names the config key", () => {
  const result = checkRunBudget({ usd_est: 0, minutes: 45 }, { usd: 2, minutes: 30, diff_lines: 400 });
  assert.match(result.reason ?? "", /budgets\.minutes/, "must name the config key that raises this cap");
});

// --- diff_lines vs the legacy diff_budget key: one number, never two --------------

test("budgets.diff_lines supersedes the legacy top-level diff_budget when both are set", () => {
  const project = tempProject();
  writeDelegationConfig(project, { diff_budget: 100, budgets: { diff_lines: 250 } });
  assert.equal(configuredBudgets(project).diff_lines, 250, "the new key wins over the legacy one");
  // The claim is not just "budgets.diff_lines wins" but that there is exactly ONE
  // number in play: diffBudget() (what actually gates the diff-size check) must read
  // the identical value configuredBudgets() reports, or the two paths could disagree.
  assert.equal(diffBudget(project), configuredBudgets(project).diff_lines);
});

test("legacy diff_budget alone still works when budgets.diff_lines is unset", () => {
  const project = tempProject();
  writeDelegationConfig(project, { diff_budget: 150 });
  assert.equal(configuredBudgets(project).diff_lines, 150);
  assert.equal(diffBudget(project), 150);
});
