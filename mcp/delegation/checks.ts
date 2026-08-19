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
import { runReachabilityCheck } from "./reachability.js";
import { runStaticChecks } from "./static-checks.js";
import { type CitationText, verifyRun } from "./verify.js";
import { detectWorktreeEscape, snapshotGuardedPaths } from "./worktree-guard.js";

// Every check id the KERNEL appends to a claim — never a declared CheckSpec the agent
// asked for. reverifyRun drops these when reconstructing the run's original declared
// checks, because runAllChecks re-derives them for real on each pass; feeding them back
// as declared checks would run them twice under the same id. Exported from here, the one
// module that owns check assembly, so a new kernel check cannot be added in one place and
// forgotten in the other — that drift already shipped once.
export const KERNEL_APPENDED_CHECK_IDS = new Set(["static-typecheck", "static-app-parse", "reachability", "worktree-boundary"]);

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
  // Snapshotted before anything runs, so the escape check below catches whatever ANY of
  // these did, not just what they claimed to — this is what would have caught the real
  // incident (a build landing in the project's own dist/ instead of the run's worktree).
  const guardBefore = snapshotGuardedPaths(projectDir, worktreeDir);
  const verification = verifyRun(projectDir, runId, worktreeDir, checkSpecs, claimText, onProgress);
  // Kernel-executed, never agent-declared: a narrowly declared (or missing) check must
  // never be the only thing standing between a broken build and 'ready'. These run on
  // every claim regardless of what the agent's own checks covered, and merge into the
  // same list the receipt's VERIFIED n/n line counts — attributed to Kage, not the agent.
  const staticResult = runStaticChecks(projectDir, runId, worktreeDir, verification.diff.paths);
  // Advisory, never blocking (see reachability.ts's own header): does anything on a real
  // entry point actually reach the code this run just landed? Assembled HERE rather than
  // at each call site — that is the whole reason this module exists.
  const reachabilityResult = runReachabilityCheck(projectDir, runId, worktreeDir, verification.diff.paths);
  // DETECTION, not prevention (see worktree-guard.ts's header): nothing here sandboxes a
  // check's command or the agent itself against escaping worktreeDir — this only refuses
  // to stay silent when one already did. Appended only when it actually fires, so a clean
  // run's check list is byte-for-byte what it was before this existed.
  const escapeCheck = detectWorktreeEscape(projectDir, runId, worktreeDir, guardBefore);
  const checks = [
    ...verification.checks,
    ...staticResult.checks,
    ...reachabilityResult.checks,
    ...(escapeCheck ? [escapeCheck] : []),
  ];
  return { checks, diff: verification.diff, passed: checks.every((check) => check.result === "pass") };
}
