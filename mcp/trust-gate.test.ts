// Trust gate: autonomy 'merge' must earn its unattended power from a TYPE's track
// record, not just from one claim passing. Two things under test:
//
// 1. computeTrackRecord's verified_first must not count a claim where nothing executed
//    (trackrecord.ts previously folded over claim.checks directly — every check passing
//    is true when only non-executing checks ever ran, which is exactly what
//    claimVerdict already calls "UNVERIFIED — nothing was executed").
// 2. autonomyGateForType/maybeAutoMerge must hold below MIN_TRACK_RECORD_SAMPLE dispatched
//    runs of a type, and hold above it when the (corrected) verified_first rate is poor —
//    falling back to 'recommend' behaviour either way, with the reason on the run ledger.
//
// A separate file rather than delegation.test.ts on purpose — see that file's own header
// on why: every run appends to its end and same-day merges collide there.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readClaim, readRun } from "./delegation/contract.js";
import { claimVerdict } from "./delegation/verify.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { dispatchRun } from "./delegation/dispatch.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { createGoal } from "./delegation/goal.js";
import { computeTrackRecord, MIN_TRACK_RECORD_SAMPLE, AUTO_MERGE_MIN_VERIFIED_RATE } from "./delegation/trackrecord.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempGitProject(options: { testCommand?: string } = {}): string {
  const project = mkdtempSync(join(tmpdir(), "kage-trust-gate-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  if (options.testCommand) writeDelegationConfig(project, { test: options.testCommand });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

// runsLedgerPath (contract.ts) is not exported — this mirrors it rather than exporting a
// test-only accessor for one file's worth of assertions.
function readLedgerEntries(project: string, runId: string): Array<Record<string, unknown>> {
  const path = join(project, ".agent_memory", "reports", "runs-ledger.jsonl");
  return readFileSync(path, "utf8")
    .trimEnd()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((entry) => entry.run_id === runId);
}

let seq = 0;
function editFile(): { path: string; content: string } {
  seq += 1;
  return { path: `src/f${seq}.ts`, content: `export const v${seq} = ${seq};\n` };
}

// THE FOUNDATION. Reverting the claimVerdict-based fix in computeTrackRecord makes this
// fail: the old fold (`claim.checks.length && every check === "pass"`) is true for a claim
// backed only by non-executing checks, so verified_first would read 1, not 0.
test("a claim where nothing executed does not count toward verified_first", async () => {
  const project = tempGitProject(); // no test command configured -> no executable check
  const { task } = await dispatchRun(project, { intent: "no test command here", type: "chore" }, stubAdapter({ editFile: editFile() }));

  const claim = readClaim(project, task.id);
  assert.ok(claim, "the run produced a claim");
  assert.equal(claim.checks.every((check) => check.result === "pass"), true, "every check that ran passed");
  assert.equal(claimVerdict(claim).executed, false, "but nothing was actually executed");

  const record = computeTrackRecord(project);
  assert.equal(record.chore?.dispatched, 1);
  assert.equal(record.chore?.verified_first, 0, "an unexecuted claim must not count as verified first try");
});

// THE SAMPLE FLOOR. Below MIN_TRACK_RECORD_SAMPLE dispatched runs of a type, autonomy
// 'merge' must fall back to 'recommend' and say exactly how thin the sample is.
test("a run type below the sample threshold is held with a reason naming the shortfall", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const goal = createGoal(project, { intent: "auto", autonomy: "merge" });
  const { task } = await dispatchRun(project, { intent: "first bugfix ever", type: "bugfix", goalId: goal.id }, stubAdapter({ editFile: editFile() }));

  assert.equal(claimVerdict(readClaim(project, task.id)!).passed, true, "the claim itself is fully verified");
  assert.notEqual(readRun(project, task.id).state, "merged", "one run is nowhere near a track record");

  const holds = readLedgerEntries(project, task.id).filter((entry) => entry.kind === "auto_merge_held");
  assert.equal(holds.length, 1, "the hold must be recorded on the run ledger");
  assert.match(String(holds[0].reason), /holding: only 1 bugfix run\(s\) on record, need \d+/);
});

// ABOVE THE FLOOR, GOOD RATE. Once a type has MIN_TRACK_RECORD_SAMPLE dispatched runs and
// every one of them was verified first try, autonomy 'merge' may act unattended.
test("a run type above the threshold with a good rate auto-merges", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const goal = createGoal(project, { intent: "auto", autonomy: "merge" });

  // Build the track record: MIN_TRACK_RECORD_SAMPLE - 1 clean history runs, unattached.
  for (let i = 0; i < MIN_TRACK_RECORD_SAMPLE - 1; i += 1) {
    await dispatchRun(project, { intent: `clean bugfix ${i}`, type: "bugfix" }, stubAdapter({ editFile: editFile() }));
  }
  const record = computeTrackRecord(project);
  assert.equal(record.bugfix?.dispatched, MIN_TRACK_RECORD_SAMPLE - 1);
  assert.equal(record.bugfix?.verified_first, MIN_TRACK_RECORD_SAMPLE - 1);

  // The run that tips the sample over the floor, attached to the merge-autonomy goal.
  const { task } = await dispatchRun(project, { intent: "the tipping bugfix", type: "bugfix", goalId: goal.id }, stubAdapter({ editFile: editFile() }));

  assert.equal(readRun(project, task.id).state, "merged", "sample floor met and a 100% verified-first rate should auto-merge");
  const merged = readLedgerEntries(project, task.id).filter((entry) => entry.kind === "auto_merged");
  assert.equal(merged.length, 1);
});

// ABOVE THE FLOOR, POOR RATE. Enough samples, but the corrected verified_first rate is
// below AUTO_MERGE_MIN_VERIFIED_RATE — autonomy 'merge' must still hold, and say why.
test("a run type above the threshold with a poor rate is held", async () => {
  const project = tempGitProject();
  const goal = createGoal(project, { intent: "auto", autonomy: "merge" });

  // A minority of clean history runs...
  writeDelegationConfig(project, { test: "true" });
  await dispatchRun(project, { intent: "clean bugfix 1", type: "bugfix" }, stubAdapter({ editFile: editFile() }));
  await dispatchRun(project, { intent: "clean bugfix 2", type: "bugfix" }, stubAdapter({ editFile: editFile() }));

  // ...and a majority that executed but failed, so they count against the rate without
  // ever reaching auto-merge themselves (a failing check is already held on its own).
  writeDelegationConfig(project, { test: "exit 1" });
  await dispatchRun(project, { intent: "broken bugfix 1", type: "bugfix" }, stubAdapter({ editFile: editFile() }));
  await dispatchRun(project, { intent: "broken bugfix 2", type: "bugfix" }, stubAdapter({ editFile: editFile() }));

  assert.equal(MIN_TRACK_RECORD_SAMPLE, 5, "this fixture is sized for a floor of 5 — update it if the constant moves");

  // The fifth run's OWN claim is fully verified — this isolates the rate gate from the
  // per-claim gate the previous test already covers.
  writeDelegationConfig(project, { test: "true" });
  const { task } = await dispatchRun(project, { intent: "the deciding bugfix", type: "bugfix", goalId: goal.id }, stubAdapter({ editFile: editFile() }));

  assert.equal(claimVerdict(readClaim(project, task.id)!).passed, true, "this run's own claim is fine");
  const record = computeTrackRecord(project);
  assert.equal(record.bugfix?.dispatched, 5);
  assert.equal(record.bugfix?.verified_first, 3, "2 clean + this one; the 2 broken runs do not count");
  assert.ok(3 / 5 < AUTO_MERGE_MIN_VERIFIED_RATE, "fixture must actually sit below the bar being tested");

  assert.notEqual(readRun(project, task.id).state, "merged", "a poor type-level rate must hold even a clean claim");
  const holds = readLedgerEntries(project, task.id).filter((entry) => entry.kind === "auto_merge_held");
  assert.equal(holds.length, 1, "the hold must be recorded on the run ledger");
  assert.match(String(holds[0].reason), /holding: bugfix verified-first rate is 3\/5 \(60%\)/);
});
