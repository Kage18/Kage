// The one place declared checks (verify.ts) and kernel-executed static checks
// (static-checks.ts) are combined into a single check list. dispatch.ts's executeRun
// (foreground runs), supervisor.ts's superviseRun (detached runs) and ratify.ts's
// reverifyRun (`kage reverify`) all call this — buildClaim in contract.ts already learned
// the hard way that hand-rolling the same assembly in two places drifts; this is the same
// fix applied to check assembly. Deliberately its own module, not folded into verify.ts:
// static-checks.ts imports writeEvidence from verify.ts, so verify.ts importing
// static-checks.ts back would be a require() cycle that resolves to undefined functions
// in the compiled CommonJS output.
import type { CheckOutcome, CheckSpec } from "./contract.js";
import type { DiffStats } from "./git.js";
import type { ProgressSink } from "./progress.js";
import { runStaticChecks } from "./static-checks.js";
import { type CitationText, verifyRun } from "./verify.js";

export interface AllChecksResult {
  checks: CheckOutcome[];
  diff: DiffStats;
  passed: boolean;
}

export function runAllChecks(
  projectDir: string,
  runId: string,
  worktreeDir: string,
  checkSpecs: CheckSpec[],
  claimText: CitationText,
  onProgress?: ProgressSink,
): AllChecksResult {
  const verification = verifyRun(projectDir, runId, worktreeDir, checkSpecs, claimText, onProgress);
  // Kernel-executed, never agent-declared: a narrowly declared (or missing) check must
  // never be the only thing standing between a broken build and 'ready'. These run on
  // every claim regardless of what the agent's own checks covered, and merge into the
  // same list the receipt's VERIFIED n/n line counts — attributed to Kage, not the agent.
  const staticResult = runStaticChecks(projectDir, runId, worktreeDir, verification.diff.paths);
  const checks = [...verification.checks, ...staticResult.checks];
  return { checks, diff: verification.diff, passed: checks.every((check) => check.result === "pass") };
}
