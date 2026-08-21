// The verifier — Kage's moat.
//
// Every other product in this category delivers evidence; none executes it. Here a
// claim is never believed: the commands run again, in the run's worktree, and the
// verdict is the exit code. An agent that says "tests pass" over a red suite is caught
// by construction, which is the difference between a receipt and a rumor.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { diffBudget } from "./config.js";
import { type CheckOutcome, type CheckSpec, type ClaimRecord, type TaskRecord, runEvidenceDir } from "./contract.js";
import { currentBranch, type DiffStats, git } from "./git.js";
import type { ProgressSink } from "./progress.js";
import { acquireVerifyLock, formatLockNote } from "./verify-lock.js";

// 20 min, raised from 10 on 2026-08-20: the full suite (1060+ tests, several >10s
// integration tests) outgrew the old cap in a cold worktree under concurrent
// verification, and a run raising this constant in its OWN worktree can never
// benefit — checks execute in the supervisor's (main) build, so the harness cannot
// verify a fix to its own ceiling. Operator-landed for exactly that reason. The
// timeout still exists to catch hangs; it just needs room for the real suite.
const COMMAND_TIMEOUT_MS = 20 * 60_000;
// Exit codes shells use for "command not found" / "cannot execute". These mean we could
// not judge the claim — never that the claim passed.
const NO_ENV_EXIT_CODES = new Set([126, 127]);
// Exit code convention this file already used for a timed-out command before the tree-kill
// fix below; kept so evidence and CheckOutcome.exit_code read the same as always.
const TIMEOUT_EXIT_CODE = 124;

// Grace between a group-wide SIGTERM and the follow-up SIGKILL sweep in sweepProcessGroup
// below — long enough for a well-behaved tree to unwind on its own (npm/node/test workers
// flushing and exiting cleanly), short enough that a genuinely hung tree doesn't add much
// past COMMAND_TIMEOUT_MS before the verdict is final.
const TREE_KILL_GRACE_MS = 5_000;

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Signal 0 to a NEGATIVE pid probes the whole process GROUP, not one process — this is
// what lets sweepProcessGroup below know whether any descendant is still alive well after
// the one pid spawnSync itself tracked (and already reaped) is long gone.
function processGroupAlive(pgid: number): boolean {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch {
    return false;
  }
}

// Synchronous sleep with no busy-spin — parks the thread via the VM's own wait rather than
// polling in a tight loop. Safe only because this ever runs after spawnSync has already
// returned control to us; nothing else here needs the event loop during the grace window.
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// The actual fix: spawnSync's own `timeout`+`killSignal` only ever signals the ONE pid it
// tracks — Node's own docs for spawnSync say the parent "will wait until the child process
// has exited", meaning that single immediate child, never its descendants. A shell running
// `npm run test` forwards nothing to npm's own children when IT gets SIGTERM, so killing
// just the shell orphans `node --test` and every per-file worker it spawned, still running,
// still holding whatever the test suite held. Reproduced live: three such zombie suites
// accumulated across retry cycles overnight, and every later verification on the machine
// ran beside them and hung the same way (238 tests then stall) until they were killed by
// hand — the timeout was reporting real hangs caused by its own previous kills.
// `detached: true` on the spawnSync call below is what makes a real sweep possible: it
// makes the child its own process group leader, so `-pid` here reaches the whole tree that
// grew under it, not just the one pid Node itself was watching.
function sweepProcessGroup(pid: number, graceMs: number): void {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    return; // ESRCH — the group is already gone.
  }
  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline && processGroupAlive(pid)) sleepSync(100);
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // Exited on its own within the grace window — nothing left to force.
  }
}

export interface TreeKillSpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
  /** True only when this call's own timeout fired and a group sweep ran. */
  treeKilled: boolean;
  /** Milliseconds spent waiting for the per-machine verification lock before this command started. */
  lockWaitMs: number;
  /** Set only when a dead holder's stale verification lock was stolen to let this command run. */
  lockStolenFromPid?: number;
  /** True only when this command's lock was inherited from an ancestor that already holds it. */
  lockInherited: boolean;
}

/**
 * spawnSync wrapped with the tree-kill fix: the child is spawned as its own process group
 * (`detached: true`) and a timeout sweeps the WHOLE group — SIGTERM, a TREE_KILL_GRACE_MS
 * grace, then SIGKILL — instead of leaving orphaned descendants running past the verdict
 * that was supposed to be their last word.
 *
 * Also the one choke point every executed check passes through, which is why the
 * per-machine verification lock (verify-lock.ts) is acquired HERE rather than in each
 * call site separately: declared "command" checks (below) and static-checks.ts's own
 * typecheck/app-parse commands both funnel through this one function, so locking it once
 * covers all of them. Held only for the duration of this one command, never the whole run.
 *
 * Reentrancy: when this call genuinely holds the lock (acquireVerifyLock's `held`), the
 * spawned command's env carries KAGE_VERIFY_LOCK_HELD=1 — so if that command is itself a
 * kernel verification (e.g. this repo's own `npm test` running its own suite of checks
 * against this very fix), any nested call back into this function inherits the lock instead
 * of blocking on its own still-alive ancestor, which the un-reentrant version could do until
 * the outer command's tree-kill timeout.
 *
 * Exported so static-checks.ts's kernel-executed checks (tsc, the composed-page parse)
 * share this exact fix instead of a second hand-rolled copy that could drift — same
 * reasoning as writeEvidence's export below.
 */
export function spawnWithTreeKill(
  cmd: string,
  args: string[],
  options: { cwd: string; shell?: boolean; maxBuffer?: number },
  timeoutMs: number,
): TreeKillSpawnResult {
  const lock = acquireVerifyLock();
  try {
    // @types/node's SpawnSyncOptions omits `detached` (it's only typed on the async
    // SpawnOptions), even though the underlying binding honors it for spawnSync exactly the
    // same way — confirmed empirically (see this run's claim). Built as a plain, unannotated
    // object rather than an inline literal argument so the extra property is structurally
    // allowed instead of tripping TS's excess-property check.
    const spawnOptions = {
      cwd: options.cwd,
      shell: options.shell ?? false,
      encoding: "utf8" as const,
      stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
      killSignal: "SIGTERM" as const,
      maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
      detached: true,
      // Only a genuine holder has a lock for a descendant to inherit — an `inherited` or
      // KAGE_NO_VERIFY_LOCK-skipped acquisition must not stamp the marker onto children that
      // never actually serialized against anything.
      env: lock.held ? { ...process.env, KAGE_VERIFY_LOCK_HELD: "1" } : process.env,
    };
    const result = spawnSync(cmd, args, spawnOptions);
    // SpawnSyncReturns types `error` as a plain Error — Node itself attaches `.code` (a
    // Node.js errno exception) at runtime, same as any other child_process spawn error.
    const spawnError = result.error as NodeJS.ErrnoException | undefined;
    const treeKilled = spawnError?.code === "ETIMEDOUT";
    if (treeKilled) sweepProcessGroup(result.pid, TREE_KILL_GRACE_MS);
    return {
      status: result.status,
      stdout: String(result.stdout ?? ""),
      stderr: String(result.stderr ?? ""),
      error: spawnError,
      treeKilled,
      lockWaitMs: lock.waitedMs,
      lockStolenFromPid: lock.stolenFromPid,
      lockInherited: lock.inherited === true,
    };
  } finally {
    lock.handle.release();
  }
}

// Exported so static-checks.ts (kernel-executed checks that are not part of a declared
// CheckSpec) can log evidence through the same mechanism the receipt already links to.
export function writeEvidence(projectDir: string, runId: string, checkId: string, content: string): string {
  const dir = runEvidenceDir(projectDir, runId);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${checkId}.log`);
  writeFileSync(path, content, "utf8");
  return path.slice(projectDir.length + 1);
}

// timeoutMs defaults to COMMAND_TIMEOUT_MS but is overridable — exported so
// mcp/tree-kill.test.ts can exercise the real evidence-writing path (not a reimplementation
// of it) against a short timeout instead of waiting out the real 20-minute ceiling.
export function runCommandCheck(
  projectDir: string,
  runId: string,
  worktreeDir: string,
  check: CheckSpec,
  timeoutMs: number = COMMAND_TIMEOUT_MS,
): CheckOutcome {
  if (!check.cmd) return { ...check, result: "not_run", evidence: undefined };
  const spawned = spawnWithTreeKill(check.cmd, [], { cwd: worktreeDir, shell: true }, timeoutMs);
  const exitCode = spawned.treeKilled
    ? TIMEOUT_EXIT_CODE
    : typeof spawned.status === "number"
      ? spawned.status
      : 1;
  // The success path only ever reported stdout (stderr silently dropped) before this fix
  // and still does — only a non-zero/timed-out outcome pulls stderr into the evidence too.
  const stdout = exitCode === 0 ? spawned.stdout : `${spawned.stdout}\n${spawned.stderr}`;
  const treeKillNote = spawned.treeKilled ? ` (timeout after ${timeoutMs / 1000}s - process tree killed)` : "";
  const lockNote = formatLockNote(spawned.lockWaitMs, spawned.lockStolenFromPid, spawned.lockInherited);
  const evidence = writeEvidence(
    projectDir,
    runId,
    check.id,
    `$ ${check.cmd}\n(cwd: ${worktreeDir})\n\n${stdout}\n\n--- exit code: ${exitCode}${treeKillNote}${lockNote} ---\n`,
  );
  // A missing interpreter/binary means the environment could not run the check. Saying
  // "unverified" here is the whole honesty contract: absence of proof is never proof.
  const result = exitCode === 0 ? "pass" : NO_ENV_EXIT_CODES.has(exitCode) ? "unverified_no_env" : "fail";
  return { ...check, result, exit_code: exitCode, evidence };
}

function parseNumstat(stdout: string): DiffStats {
  if (!stdout) return { files: 0, lines: 0, paths: [] };
  let lines = 0;
  const paths: string[] = [];
  for (const row of stdout.split("\n")) {
    const [added, removed, path] = row.split("\t");
    if (!path) continue;
    paths.push(path);
    // "-" marks a binary file: it contributes a file but no countable lines.
    lines += (Number(added) || 0) + (Number(removed) || 0);
  }
  return { files: paths.length, lines, paths };
}

/**
 * The full diff a run's worktree has produced: committed work since the branch's fork
 * point from the project's base branch, PLUS whatever is still uncommitted. Runs commit
 * their work at claim time (worktree.ts's commitWorktree), so by the time `kage reverify`
 * re-runs this the working tree is clean — a measurement that only ever looked at
 * uncommitted changes (git.ts's stageAndMeasure, this function's predecessor) read a real
 * ~1,400-line committed change as "0 file(s), 0 changed line(s)" (see
 * .agent_memory/runs/budgets-become-a-circuit-breaker-not-a-t-260820-e70a/evidence/diff-size.log).
 *
 * `git diff <merge-base>` (no `--cached`, a single ref) compares that commit straight
 * against the WORKING TREE, which already folds in every committed change since the fork
 * point AND whatever is staged/unstaged on top, in one pass — no risk of double-counting a
 * file that has both a committed and an uncommitted edit the way summing two separate
 * numstats (merge-base..HEAD, then HEAD..working-tree) would.
 *
 * This is verifyRun's own data source, and verifyRun is the one function every path that
 * runs checks (claim-time execution, `kage reverify`, `kage adopt`) calls through — fixing
 * the measurement here fixes it on all three at once.
 */
export function measureDiff(projectDir: string, worktreeDir: string): DiffStats {
  // Untracked files an agent created are part of its work; staging is what makes them
  // visible to `git diff` at all (mirrors the old stageAndMeasure's own first step).
  git(worktreeDir, ["add", "-A"]);
  const base = currentBranch(projectDir);
  const mergeBase = git(worktreeDir, ["merge-base", "HEAD", base]);
  if (mergeBase.ok && mergeBase.stdout) {
    const diff = git(worktreeDir, ["diff", mergeBase.stdout, "--numstat"]);
    if (diff.ok) return parseNumstat(diff.stdout);
  }
  // No usable merge-base (a sandbox workspace with no real worktree branch, detached
  // history, or worktreeDir simply not a git repo at all) — fall back to whatever is
  // staged right now rather than silently reporting zero.
  const staged = git(worktreeDir, ["diff", "--cached", "--numstat"]);
  return staged.ok ? parseNumstat(staged.stdout) : { files: 0, lines: 0, paths: [] };
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
// Exported so the brief compiler can recognize a bare filename ("app-styles.ts", no
// slash) with the same extension whitelist citedPaths uses for slash-joined ones —
// one list, not two that can quietly drift apart.
export const KNOWN_FILE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "md", "mdx",
  "sh", "yml", "yaml", "toml", "txt", "html", "css", "scss",
  "py", "go", "rs", "rb", "lock",
]);

// Top-level directories this repo actually has. A token that starts with one of these is
// a repo path even without a recognizable extension (e.g. "mcp/delegation"). Exported so
// the brief compiler can recognize these as structural, not content, words — "mcp" is in
// the name of nearly every file in this repo and correlates with everything, i.e. nothing.
export const KNOWN_TOP_LEVEL_PREFIXES = ["mcp/", "docs/", "shell/", "evals/", "alias/"];

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

// A token joined by '/' can be an enumeration an agent wrote as a shorthand list
// ("contract.ts/ratify.ts/review.ts/review-contract.test.ts") rather than one path —
// reproduced on four real claims before this existed, each failing citations on exactly
// this shape. Tried only as a FALLBACK, after the token has already failed to resolve as
// one real path via resolveCitedPath above: a genuine directory ("mcp/delegation") or a
// real single file resolves there directly (existsSync/suffix match), so this is never
// even reached for those — the guard's teeth stay intact for a real path shaped like one.
// Every segment must independently resolve (directly or by the same unique-suffix rule) —
// one invented segment keeps the whole token failing exactly as before splitting existed.
function resolveEnumeration(worktreeDir: string, token: string, files: string[]): PathResolution {
  const segments = token.split("/").filter(Boolean);
  if (segments.length < 2) return { ok: false };
  const resolvedSegments: string[] = [];
  for (const segment of segments) {
    const resolution = resolveCitedPath(worktreeDir, segment, files);
    if (!resolution.ok) return { ok: false };
    resolvedSegments.push(resolution.resolvedTo ?? segment);
  }
  return { ok: true, resolvedTo: resolvedSegments.join(", ") };
}

function resolveCitation(worktreeDir: string, token: string, files: string[]): PathResolution {
  const direct = resolveCitedPath(worktreeDir, token, files);
  if (direct.ok) return direct;
  const enumeration = resolveEnumeration(worktreeDir, token, files);
  return enumeration.ok ? enumeration : direct;
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

  const citedResolved = cited.map((path) => ({ path, resolution: resolveCitation(worktreeDir, path, files) }));
  const proseResolved = prose.map((path) => ({ path, resolution: resolveCitation(worktreeDir, path, files) }));
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
  const diff = measureDiff(projectDir, worktreeDir);
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

// Did THIS check actually execute code, or only inspect static facts (diff size, a cited
// path existing, a kernel analysis)? Both are legitimate evidence, but they are not the
// same KIND of evidence, and a card that lists them in the same register is the exact
// ambiguity claimVerdict exists to resolve. Kept as a three-way register rather than a
// boolean so a command that COULD NOT run (no interpreter, no cmd at all) reads as
// "not run" rather than lying in either direction.
function checkRegister(check: CheckOutcome): "ran" | "inspected" | "not run" {
  if (check.kind !== "command") return "inspected";
  return check.result === "pass" || check.result === "fail" ? "ran" : "not run";
}

// The bill, when the caller has it. Cost lives on the TaskRecord (what the run spent),
// not the ClaimRecord (what was found true) — optional so callers that only have the
// claim keep compiling unchanged; callers that also hold the task should pass it so cost
// reads next to the diff it bought, not as metadata looked up somewhere else.
function formatSpend(task?: TaskRecord): string | undefined {
  if (!task) return undefined;
  const usd = task.spend.usd_est > 0 ? `$${task.spend.usd_est.toFixed(2)}` : undefined;
  const minutes = task.spend.minutes > 0 ? `${task.spend.minutes.toFixed(1)} min` : undefined;
  return usd || minutes ? [usd, minutes].filter(Boolean).join(" · ") : undefined;
}

// The receipt — the one artifact competitors do not have. Ranked by what a reader needs
// next, not by when the kernel computed it: (1) who checked this — the sentence that IS
// the product, leading the card rather than trailing it in parentheses; (2) what actually
// ran vs. what was merely inspected, per check; (3) what the agent itself flagged unsure,
// since that is frequently the most useful sentence on the card; (4) the bill — diff and
// cost — last, because a reviewer reads evidence before they read what it cost.
export function renderClaimCard(claim: ClaimRecord, options: { budget: number; task?: TaskRecord }): string {
  const symbolFor = (result: CheckOutcome["result"]): string =>
    result === "pass" ? "✓" : result === "fail" ? "✗" : result === "unverified_no_env" ? "?" : "·";
  const decision = claimVerdict(claim);
  const verdict = decision.label;
  const lines = [
    `┌ ${verdict} — checks run by Kage, not the agent · ${claim.run_id}`,
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
    lines.push(
      `│ ${symbolFor(check.result)} ${check.id.padEnd(11)} ${checkRegister(check).padEnd(9)} ${detail}${check.evidence ? `   ${check.evidence}` : ""}`,
    );
    for (const warning of check.warnings ?? []) lines.push(`│     ⚠ ${warning}`);
  }
  if (!decision.executed) {
    lines.push("│ ! no test     no command ran here — set one with `kage config --test \"<cmd>\"`,");
    lines.push("│               or review this diff yourself before trusting it");
  }
  if (!claim.protocol_ok) lines.push("│ ! protocol    agent skipped the claim fence — statement derived from the diff");
  for (const unsure of claim.unsure) lines.push(`│ ⚠ unsure      ${unsure}`);
  const spend = formatSpend(options.task);
  lines.push(`│ · touched     ${claim.diff.files} file(s), ${claim.diff.lines} line(s)${spend ? `  ·  cost ${spend}` : ""}`);
  for (const learning of claim.learnings) lines.push(`│ + learned     ${learning}`);
  lines.push("└────────────────────────────────────────────────────────────────");
  if (claim.diff.lines > options.budget) {
    lines.push(`  This diff (${claim.diff.lines} lines) is too large to review well — consider asking for it in smaller pieces.`);
  }
  return lines.join("\n");
}
