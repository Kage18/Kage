// The verifier — Kage's moat.
//
// Every other product in this category delivers evidence; none executes it. Here a
// claim is never believed: the commands run again, in the run's worktree, and the
// verdict is the exit code. An agent that says "tests pass" over a red suite is caught
// by construction, which is the difference between a receipt and a rumor.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { diffBudget } from "./config.js";
import { type CheckOutcome, type CheckSpec, type ClaimRecord, runEvidenceDir } from "./contract.js";
import { type DiffStats, stageAndMeasure } from "./git.js";
import type { ProgressSink } from "./progress.js";

const COMMAND_TIMEOUT_MS = 10 * 60_000;
// Exit codes shells use for "command not found" / "cannot execute". These mean we could
// not judge the claim — never that the claim passed.
const NO_ENV_EXIT_CODES = new Set([126, 127]);

function writeEvidence(projectDir: string, runId: string, checkId: string, content: string): string {
  const dir = runEvidenceDir(projectDir, runId);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${checkId}.log`);
  writeFileSync(path, content, "utf8");
  return path.slice(projectDir.length + 1);
}

function runCommandCheck(projectDir: string, runId: string, worktreeDir: string, check: CheckSpec): CheckOutcome {
  if (!check.cmd) return { ...check, result: "not_run", evidence: undefined };
  let stdout = "";
  let exitCode = 0;
  try {
    stdout = execFileSync(check.cmd, {
      cwd: worktreeDir,
      shell: true,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    const shell = error as { status?: number | null; stdout?: string | Buffer; stderr?: string | Buffer; code?: string };
    stdout = `${String(shell.stdout ?? "")}\n${String(shell.stderr ?? "")}`;
    exitCode = typeof shell.status === "number" ? shell.status : shell.code === "ETIMEDOUT" ? 124 : 1;
  }
  const evidence = writeEvidence(
    projectDir,
    runId,
    check.id,
    `$ ${check.cmd}\n(cwd: ${worktreeDir})\n\n${stdout}\n\n--- exit code: ${exitCode} ---\n`,
  );
  // A missing interpreter/binary means the environment could not run the check. Saying
  // "unverified" here is the whole honesty contract: absence of proof is never proof.
  const result = exitCode === 0 ? "pass" : NO_ENV_EXIT_CODES.has(exitCode) ? "unverified_no_env" : "fail";
  return { ...check, result, exit_code: exitCode, evidence };
}

function runDiffCheck(projectDir: string, runId: string, diff: DiffStats): CheckOutcome {
  const budget = diffBudget(projectDir);
  const evidence = writeEvidence(
    projectDir,
    runId,
    "diff-size",
    `${diff.files} file(s), ${diff.lines} changed line(s), budget ${budget}\n\n${diff.paths.join("\n")}\n`,
  );
  return {
    id: "diff-size",
    kind: "diff",
    expect: `at most ${budget} changed lines`,
    result: diff.lines <= budget ? "pass" : "fail",
    evidence,
  };
}

// Path-shaped tokens the claim names. A claim that cites a file which does not exist in
// the work it produced is describing something imaginary.
export function citedPaths(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\b[\w.-]+(?:\/[\w.-]+)+\.[A-Za-z]{1,6}\b/g)) found.add(match[0]);
  return [...found];
}

function runCitationCheck(projectDir: string, runId: string, worktreeDir: string, claimText: string): CheckOutcome {
  const paths = citedPaths(claimText);
  const missing = paths.filter((path) => !existsSync(join(worktreeDir, path)));
  const evidence = writeEvidence(
    projectDir,
    runId,
    "citations",
    paths.length
      ? `checked ${paths.length} cited path(s):\n${paths.map((path) => `${missing.includes(path) ? "MISSING" : "ok     "}  ${path}`).join("\n")}\n`
      : "the claim cited no repo paths\n",
  );
  return {
    id: "citations",
    kind: "citation",
    expect: "every cited path exists in the worktree",
    result: missing.length ? "fail" : "pass",
    evidence,
  };
}

export interface VerificationResult {
  checks: CheckOutcome[];
  diff: DiffStats;
  passed: boolean;
}

export function verifyRun(
  projectDir: string,
  runId: string,
  worktreeDir: string,
  checks: CheckSpec[],
  claimText: string,
  onProgress?: ProgressSink,
): VerificationResult {
  // Stage first: untracked files an agent created are part of its work, and the diff
  // measurement must see them.
  const diff = stageAndMeasure(worktreeDir);
  const outcomes: CheckOutcome[] = [];
  for (const check of checks) {
    onProgress?.({ kind: "check", label: `verifying: ${check.cmd ?? check.id}` });
    if (check.kind === "command") outcomes.push(runCommandCheck(projectDir, runId, worktreeDir, check));
    else if (check.kind === "diff") outcomes.push(runDiffCheck(projectDir, runId, diff));
    else outcomes.push(runCitationCheck(projectDir, runId, worktreeDir, claimText));
  }
  return { checks: outcomes, diff, passed: outcomes.every((outcome) => outcome.result === "pass") };
}

// Did anything actually EXECUTE? Static checks (diff size, citation existence) are
// necessary but they run no code — a claim backed only by them has been inspected, not
// verified, and saying "VERIFIED" there is the exact overclaim this product exists to
// prevent. Found the hard way on Kage's own first delegated run.
export function claimVerdict(claim: ClaimRecord): { label: string; executed: boolean; passed: boolean } {
  const executed = claim.checks.some((check) => check.kind === "command" && check.result !== "not_run");
  const passedAll = claim.checks.length > 0 && claim.checks.every((check) => check.result === "pass");
  const passedCount = claim.checks.filter((check) => check.result === "pass").length;
  if (!claim.checks.length) return { label: "NO CHECKS DEFINED", executed: false, passed: false };
  if (!passedAll) return { label: `NOT VERIFIED ${passedCount}/${claim.checks.length}`, executed, passed: false };
  if (!executed) return { label: `UNVERIFIED — nothing was executed (${passedCount}/${claim.checks.length} static checks)`, executed: false, passed: true };
  return { label: `VERIFIED ${passedCount}/${claim.checks.length}`, executed: true, passed: true };
}

// The receipt. Verdicts first, diff second — reviewers read evidence, not walls of diff.
export function renderClaimCard(claim: ClaimRecord, options: { budget: number }): string {
  const symbolFor = (result: CheckOutcome["result"]): string =>
    result === "pass" ? "✓" : result === "fail" ? "✗" : result === "unverified_no_env" ? "?" : "·";
  const decision = claimVerdict(claim);
  const verdict = decision.label;
  const lines = [
    `┌ CLAIM · ${claim.run_id} — ${verdict} (checks run by Kage, not the agent)`,
    `│ "${claim.statement}"`,
  ];
  for (const check of claim.checks) {
    const detail =
      check.result === "unverified_no_env"
        ? "could not run here — NOT counted as passing"
        : check.cmd
          ? `${check.cmd} → exit ${check.exit_code}`
          : check.expect;
    lines.push(`│ ${symbolFor(check.result)} ${check.id.padEnd(11)} ${detail}${check.evidence ? `   ${check.evidence}` : ""}`);
  }
  lines.push(`│ · diff        ${claim.diff.files} file(s), ${claim.diff.lines} line(s)`);
  if (!decision.executed) {
    lines.push("│ ! no test     no command ran here — set one with `kage config --test \"<cmd>\"`,");
    lines.push("│               or review this diff yourself before trusting it");
  }
  if (!claim.protocol_ok) lines.push("│ ! protocol    agent skipped the claim fence — statement derived from the diff");
  for (const unsure of claim.unsure) lines.push(`│ ⚠ unsure      ${unsure}`);
  for (const learning of claim.learnings) lines.push(`│ + learned     ${learning}`);
  lines.push("└────────────────────────────────────────────────────────────────");
  if (claim.diff.lines > options.budget) {
    lines.push(`  This diff (${claim.diff.lines} lines) is too large to review well — consider asking for it in smaller pieces.`);
  }
  return lines.join("\n");
}
