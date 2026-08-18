// "Every check passed" is not "verified" — the fold `claim.checks.every(c => c.result ===
// "pass")` is true when nothing was executed, because in a repo with no configured test
// command the only checks that ever run are non-executing ones (diff-size, citations,
// reachability). claimVerdict (delegation/verify.ts) is the one place this distinction
// lives; trackrecord.ts previously re-folded checks directly in three places instead of
// asking it. computeTrackRecord's verified_first was fixed first (see trust-gate.test.ts);
// this file covers the other two call sites in the same file: curationComparison and
// renderTrustLine's claimsVerified tally.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildClaim, createRun, type CheckOutcome, type TaskRecord, writeClaim } from "./delegation/contract.js";
import { curationComparison, renderTrustLine } from "./delegation/trackrecord.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-verified-fold-"));
}

// Two non-executing checks (diff-size, citations) — both pass, nothing ran a command.
// This is exactly the shape a fresh repo with no test command configured produces on
// every run: claimVerdict calls it "UNVERIFIED — nothing was executed".
const UNEXECUTED_PASSING_CHECKS: CheckOutcome[] = [
  { id: "diff-size", kind: "diff", expect: "at most 400 changed lines", result: "pass" },
  { id: "citations", kind: "citation", expect: "every cited path exists", result: "pass" },
];

// A real executed command, passing — the shape claimVerdict calls "VERIFIED".
const EXECUTED_PASSING_CHECKS: CheckOutcome[] = [
  { id: "tests", kind: "command", cmd: "true", expect: "exit 0", result: "pass", exit_code: 0 },
  { id: "diff-size", kind: "diff", expect: "at most 400 changed lines", result: "pass" },
];

function fakeTask(id: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    schema_version: 1 as unknown as TaskRecord["schema_version"],
    id,
    intent: `intent for ${id}`,
    type: "chore",
    state: "merged",
    agent: "stub",
    worktree: null,
    branch: `kage/${id}`,
    budgets: { usd: 2, minutes: 30, diff_lines: 400 },
    spend: { usd_est: 0, minutes: 0 },
    confidence: { band: "low", basis: "test fixture" },
    curated_by: "kernel",
    state_history: [],
    created_at: "2026-08-18T00:00:00.000Z",
    updated_at: "2026-08-18T00:00:00.000Z",
    ...overrides,
  };
}

function writeClaimFor(project: string, runId: string, checks: CheckOutcome[]): void {
  writeClaim(project, runId, buildClaim({
    runId,
    statement: "did the thing",
    checks,
    fence: { unsure: [], learned: [] },
    diff: { files: 1, lines: 5, paths: ["src/f.ts"] },
  }));
}

// THE FOUNDATION for curationComparison. Reverting the fix in curationComparison makes
// this fail: the old fold (`claim.checks.length && every check === "pass"`) is true for
// a claim backed only by non-executing checks, so verified_first would read 1, not 0.
test("curationComparison does not count a claim where nothing executed", () => {
  const project = tempProject();
  const task = fakeTask("run-unexecuted", { curated_by: "kernel" });
  writeClaimFor(project, task.id, UNEXECUTED_PASSING_CHECKS);

  const { kernel } = curationComparison(project, [task]);
  assert.equal(kernel.dispatched, 1);
  assert.equal(kernel.verified_first, 0, "an unexecuted claim must not count toward curationComparison's verified_first");
});

// A normally-verified claim (an executed command that passed) must still count — the fix
// must not have swung the other way into undercounting real verification.
test("curationComparison still counts a claim that actually executed and passed", () => {
  const project = tempProject();
  const task = fakeTask("run-executed", { curated_by: "manager" });
  writeClaimFor(project, task.id, EXECUTED_PASSING_CHECKS);

  const { manager } = curationComparison(project, [task]);
  assert.equal(manager.dispatched, 1);
  assert.equal(manager.verified_first, 1, "a genuinely verified claim must still count toward curationComparison");
});

// THE FOUNDATION for renderTrustLine. Reverting the fix makes this fail: the tally would
// read "1/1 claims fully verified" for a claim backed only by non-executing checks,
// telling a user to trust a run that proved nothing.
test("renderTrustLine's claimsVerified tally does not count a claim where nothing executed", () => {
  const project = tempProject();
  createRun(project, { intent: "no test command configured here", type: "chore", agent: "stub" });
  const runId = readdirSync(join(project, ".agent_memory", "runs"))[0];
  writeClaimFor(project, runId, UNEXECUTED_PASSING_CHECKS);

  const line = renderTrustLine(project);
  assert.match(line, /Trust: 0\/1 claims fully verified/, `expected the unexecuted claim to be excluded, got: "${line}"`);
});

// A normally-verified claim still counts in renderTrustLine's tally too.
test("renderTrustLine's claimsVerified tally still counts a claim that actually executed and passed", () => {
  const project = tempProject();
  createRun(project, { intent: "has a real test command", type: "chore", agent: "stub" });
  const runId = readdirSync(join(project, ".agent_memory", "runs"))[0];
  writeClaimFor(project, runId, EXECUTED_PASSING_CHECKS);

  const line = renderTrustLine(project);
  assert.match(line, /Trust: 1\/1 claims fully verified/, `expected the executed, passing claim to count, got: "${line}"`);
});

// THE GUARD. A fourth call site re-folding claim.checks.every(...) to decide verification
// would reintroduce this exact bug a fourth time, silently. Fail the build instead of
// waiting for a fourth agent to notice: trackrecord.ts must always ask claimVerdict,
// never re-derive pass/fail by folding over checks itself.
test("trackrecord.ts never re-folds checks.every to decide verification — it must call claimVerdict", () => {
  const source = readFileSync(join(__dirname, "..", "delegation", "trackrecord.ts"), "utf8");
  assert.ok(
    !/\.checks\.every\(/.test(source),
    "trackrecord.ts contains a bare `.checks.every(...)` fold. That fold is TRUE when " +
      "nothing executed — in a repo with no configured test command, the only checks that " +
      "ever run (diff-size, citations, reachability) all pass, so the fold silently reports " +
      "a fully-unverified claim as verified. Call claimVerdict(claim) instead and require " +
      "both .passed and .executed; do not re-derive pass/fail by folding over checks here.",
  );
});
