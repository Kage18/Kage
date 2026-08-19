// Budget recovery: the minutes cap must be raisable, and the meter must measure work.
//
// Every one of these covers a defect observed live on 2026-08-19, when four consecutive
// runs stranded themselves: `--budget-minutes` was parsed and silently discarded, the
// refusal named the dollar cap for a run stopped on time, and the minutes meter kept
// climbing while a run sat stopped with nothing running.
import assert from "node:assert/strict";
import test from "node:test";

import { checkRunBudget, workingMinutes, type TaskRecord } from "./delegation/contract.js";

const MINUTE = 60_000;
const T0 = Date.parse("2026-08-19T10:00:00.000Z");

function taskWith(history: Array<{ state: string; at: number }>): TaskRecord {
  return {
    created_at: new Date(T0).toISOString(),
    state_history: history.map((entry) => ({ state: entry.state, at: new Date(entry.at).toISOString() })),
  } as unknown as TaskRecord;
}

test("the minutes meter counts work, not the hours a run spends stopped", () => {
  // Ran 20 minutes, then sat stopped for two hours. The meter must read 20, not 140 —
  // this is the exact shape that made a real run climb from 26.8 to 128.0 minutes while
  // no supervisor and no agent existed for it.
  const task = taskWith([
    { state: "running", at: T0 },
    { state: "stopped", at: T0 + 20 * MINUTE },
  ]);
  assert.equal(workingMinutes(task, T0 + 140 * MINUTE), 20);
});

test("resumed work accumulates across intervals instead of restarting the clock", () => {
  const task = taskWith([
    { state: "running", at: T0 },
    { state: "stopped", at: T0 + 20 * MINUTE },
    { state: "running", at: T0 + 80 * MINUTE },
  ]);
  // 20 worked, an hour idle, then 5 more worked: 25, not 85.
  assert.equal(workingMinutes(task, T0 + 85 * MINUTE), 25);
});

test("a repeated running entry does not drop the interval already accumulated", () => {
  // A reattaching supervisor can re-announce `running`; treating that as a fresh start
  // would silently discard the first interval.
  const task = taskWith([
    { state: "running", at: T0 },
    { state: "running", at: T0 + 10 * MINUTE },
  ]);
  assert.equal(workingMinutes(task, T0 + 30 * MINUTE), 30);
});

test("a run with no history at all falls back to wall clock rather than a confident zero", () => {
  assert.equal(workingMinutes(taskWith([]), T0 + 7 * MINUTE), 7);
});

test("a minutes-exceeded stop names the minutes command, never the dollar one", () => {
  const check = checkRunBudget({ usd_est: 2.78, minutes: 59.8 }, { usd: 40, minutes: 30, diff_lines: 400 });
  assert.equal(check.exceeded, true);
  assert.match(check.reason ?? "", /--budget-minutes/);
  // The live bug: $2.78 against a $40 cap was reported as the reason, sending the reader
  // to raise a budget that was never the constraint.
  assert.doesNotMatch(check.reason ?? "", /--budget-usd/);
  assert.match(check.reason ?? "", /59\.8 min of work exceeded the 30 min budget/);
});

test("a spend-exceeded stop still names the dollar command", () => {
  const check = checkRunBudget({ usd_est: 8.62, minutes: 4 }, { usd: 2, minutes: 30, diff_lines: 400 });
  assert.equal(check.exceeded, true);
  assert.match(check.reason ?? "", /--budget-usd/);
  assert.doesNotMatch(check.reason ?? "", /--budget-minutes/);
});

test("the minutes stop warns that a running daemon caches config", () => {
  // `kage config --budget-minutes` was advised by this very message while a long-lived
  // daemon kept stamping the old cap on every new run.
  const check = checkRunBudget({ usd_est: 1, minutes: 91.2 }, { usd: 40, minutes: 30, diff_lines: 400 });
  assert.match(check.reason ?? "", /restart/i);
});

test("neither cap crossed is not an exceeded budget", () => {
  assert.equal(checkRunBudget({ usd_est: 1, minutes: 5 }, { usd: 2, minutes: 30, diff_lines: 400 }).exceeded, false);
});
