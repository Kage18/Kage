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
import { type DiffStats, git, stageAndMeasure } from "./git.js";
import type { ProgressSink } from "./progress.js";

const COMMAND_TIMEOUT_MS = 10 * 60_000;
// Exit codes shells use for "command not found" / "cannot execute". These mean we could
// not judge the claim — never that the claim passed.
const NO_ENV_EXIT_CODES = new Set([126, 127]);

// Exported so static-checks.ts (kernel-executed checks that are not part of a declared
// CheckSpec) can log evidence through the same mechanism the receipt already links to.
export function writeEvidence(projectDir: string, runId: string, checkId: string, content: string): string {
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

// Extensions that mark a slash-joined token as an actual source file, as opposed to an
// identifier pair like "state.room/state.pty" that merely happens to contain dots.
const KNOWN_FILE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "md", "mdx",
  "sh", "yml", "yaml", "toml", "txt", "html", "css", "scss",
  "py", "go", "rs", "rb", "lock",
]);

// Top-level directories this repo actually has. A token that starts with one of these is
// a repo path even without a recognizable extension (e.g. "mcp/delegation").
const KNOWN_TOP_LEVEL_PREFIXES = ["mcp/", "docs/", "shell/", "evals/", "alias/"];

// Path-shaped tokens the claim names. A claim that cites a file which does not exist in
// the work it produced is describing something imaginary — but ordinary prose is full of
// slash-joined tokens that are not paths at all (identifier pairs, Kage's own runtime
// artifacts under .agent_memory/), so a token only counts as a citation when it looks
// like a real source path: a known file extension on its final segment, or a known repo
// top-level prefix. .agent_memory/ is explicitly excluded — it holds Kage's own runtime
// state, never something an agent cites as a source it touched.
export function citedPaths(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/(?<![\w.])[.\w-]+(?:\/[\w.-]+)+/g)) {
    const token = match[0].replace(/[.,;:!?)]+$/, "");
    if (!token || token.startsWith(".agent_memory/")) continue;
    const lastSegment = token.slice(token.lastIndexOf("/") + 1);
    const extMatch = /\.([A-Za-z0-9]{1,8})$/.exec(lastSegment);
    const hasKnownExtension = extMatch ? KNOWN_FILE_EXTENSIONS.has(extMatch[1].toLowerCase()) : false;
    const hasKnownPrefix = KNOWN_TOP_LEVEL_PREFIXES.some((prefix) => token.startsWith(prefix));
    if (hasKnownExtension || hasKnownPrefix) found.add(token);
  }
  return [...found];
}

/**
 * A claim's text splits into two surfaces with different weight: `cited` is the formal
 * claim (the statement — "what is now true"), `prose` is everything narrative (unsure
 * notes, learnings) — an agent thinking out loud, not swearing to a file list. Only a
 * path in `cited` can fail the citations check; an unresolvable path in `prose` is a
 * warning, because this check exists to catch an agent citing files it never touched,
 * not to police its English.
 */
export interface CitationText {
  cited: string;
  prose: string;
}

// All files the worktree actually has, git's own view (respects .gitignore, and — since
// verifyRun always stages first via stageAndMeasure — includes files the agent created
// but never committed). Used to resolve a cited path by unique suffix below.
function trackedFiles(worktreeDir: string): string[] {
  const result = git(worktreeDir, ["ls-files"]);
  return result.ok ? result.stdout.split("\n").filter(Boolean) : [];
}

interface PathResolution {
  ok: boolean;
  resolvedTo?: string;
  ambiguous?: boolean;
}

// A cited path that isn't a direct hit may still be real, just cited by its short name
// ("adapters/index.ts" for "mcp/delegation/adapters/index.ts") — the extractor has no way
// to know the repo's layout. Resolve it as a UNIQUE suffix of a real tracked file: exactly
// one match resolves, zero is missing, two or more is ambiguous and left unresolved rather
// than guessed.
function resolveCitedPath(worktreeDir: string, token: string, files: string[]): PathResolution {
  if (existsSync(join(worktreeDir, token))) return { ok: true, resolvedTo: token };
  const matches = files.filter((file) => file === token || file.endsWith(`/${token}`));
  if (matches.length === 1) return { ok: true, resolvedTo: matches[0] };
  if (matches.length > 1) return { ok: false, ambiguous: true };
  return { ok: false };
}

function describeResolution(path: string, resolution: PathResolution): string {
  if (resolution.ok) {
    return resolution.resolvedTo && resolution.resolvedTo !== path
      ? `ok         ${path}  (resolved to ${resolution.resolvedTo})`
      : `ok         ${path}`;
  }
  if (resolution.ambiguous) return `AMBIGUOUS  ${path}  (matches more than one file in the worktree — not resolved)`;
  return `MISSING    ${path}`;
}

function runCitationCheck(projectDir: string, runId: string, worktreeDir: string, claimText: CitationText): CheckOutcome {
  const files = trackedFiles(worktreeDir);
  const cited = citedPaths(claimText.cited);
  const citedSet = new Set(cited);
  // A path already counted as a formal citation is not reported a second time as prose.
  const prose = citedPaths(claimText.prose).filter((path) => !citedSet.has(path));

  const citedResolved = cited.map((path) => ({ path, resolution: resolveCitedPath(worktreeDir, path, files) }));
  const proseResolved = prose.map((path) => ({ path, resolution: resolveCitedPath(worktreeDir, path, files) }));
  const missingCited = citedResolved.filter((entry) => !entry.resolution.ok);
  const missingProse = proseResolved.filter((entry) => !entry.resolution.ok);

  const evidenceSections: string[] = [];
  if (citedResolved.length) {
    evidenceSections.push(`cited (formal — a miss here fails the check):\n${citedResolved.map((entry) => describeResolution(entry.path, entry.resolution)).join("\n")}`);
  }
  if (proseResolved.length) {
    evidenceSections.push(`mentioned in prose only (a miss here is a warning, never a failure):\n${proseResolved.map((entry) => describeResolution(entry.path, entry.resolution)).join("\n")}`);
  }
  const evidence = writeEvidence(
    projectDir,
    runId,
    "citations",
    `${evidenceSections.length ? evidenceSections.join("\n\n") : "the claim cited no repo paths"}\n`,
  );

  const warnings = missingProse.map(
    (entry) => `"${entry.path}" mentioned in prose but not found in the worktree${entry.resolution.ambiguous ? " (ambiguous suffix match)" : ""} — not counted as a failure`,
  );

  return {
    id: "citations",
    kind: "citation",
    expect: "every formally cited path exists (directly, or as a unique suffix) in the worktree",
    result: missingCited.length ? "fail" : "pass",
    evidence,
    ...(warnings.length ? { warnings } : {}),
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
  claimText: CitationText,
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
  if (claim.reverified_at) {
    // A reader must never mistake a stale pass recorded at claim.created_at for one that
    // is actually fresh — say plainly that these verdicts were re-run, and when.
    lines.push(`│ ↻ reverified  ${claim.reverified_at} (checks re-run against the current worktree — not the original run)`);
  }
  for (const check of claim.checks) {
    const detail =
      check.result === "unverified_no_env"
        ? "could not run here — NOT counted as passing"
        : check.cmd
          ? `${check.cmd} → exit ${check.exit_code}`
          : check.expect;
    lines.push(`│ ${symbolFor(check.result)} ${check.id.padEnd(11)} ${detail}${check.evidence ? `   ${check.evidence}` : ""}`);
    for (const warning of check.warnings ?? []) lines.push(`│     ⚠ ${warning}`);
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
