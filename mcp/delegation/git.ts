// Git helper for delegation. Never throws on a failed command — callers decide what a
// non-zero exit means, because "git said no" is often a legitimate outcome (no commits
// yet, merge conflict, nothing to commit) rather than a crash.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export function git(cwd: string, args: string[]): GitResult {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, GIT_EDITOR: "true", GIT_TERMINAL_PROMPT: "0" },
    });
    return { ok: true, stdout: stdout.trim(), stderr: "" };
  } catch (error) {
    const shell = error as { stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      ok: false,
      stdout: String(shell.stdout ?? "").trim(),
      stderr: String(shell.stderr ?? (error as Error).message ?? "").trim(),
    };
  }
}

// Lock contention is the one git failure a retry can fix: two `git worktree add`
// (or one of those plus a `commit`) racing in the same parallel wave both want
// .git/index.lock or a ref lock for a moment. Every other failure — not a repo,
// no commits yet, a real merge conflict — is a genuine answer, not a stall, and
// retrying it would just return the same answer slower.
function isTransientLockFailure(stderr: string): boolean {
  return /index\.lock|cannot lock ref|unable to create .*: File exists/i.test(stderr);
}

function sleepSync(ms: number): void {
  // git() is synchronous throughout this module (every caller relies on that), so the
  // backoff between retries has to block the thread rather than await a timer.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Retry a git invocation a few times when it looks like lock contention, not a real
 * "no". Exported mainly so the retry behavior itself is unit-testable with an injected
 * closure — real index.lock contention is timing-dependent and not worth chasing in a
 * test.
 */
export function retryTransient(run: () => GitResult, attempts = 3, backoffMs = 100): GitResult {
  let result = run();
  for (let attempt = 1; attempt < attempts && isTransientLockFailure(result.stderr); attempt++) {
    sleepSync(backoffMs * attempt);
    result = run();
  }
  return result;
}

export function isGitRepo(projectDir: string): boolean {
  return retryTransient(() => git(projectDir, ["rev-parse", "--git-dir"])).ok;
}

export function hasCommits(projectDir: string): boolean {
  return retryTransient(() => git(projectDir, ["rev-parse", "--verify", "HEAD"])).ok;
}

// Cheap, retry-free check: is there a `.git` entry on disk at all (directory for a
// normal repo, file for a worktree's gitdir pointer)? This is how the workspace
// decision tells "genuinely not a git project" apart from "git commands are failing
// even though this really is one" — the latter must never quietly degrade to a sandbox.
export function looksLikeGitRepo(projectDir: string): boolean {
  return existsSync(join(projectDir, ".git"));
}

export function currentBranch(projectDir: string): string {
  const result = git(projectDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return result.ok ? result.stdout : "HEAD";
}

// Identity for Kage's own commits when the repo has none configured (CI, fresh clones).
export function commitIdentityArgs(projectDir: string): string[] {
  const email = git(projectDir, ["config", "user.email"]);
  if (email.ok && email.stdout) return [];
  return ["-c", "user.name=kage", "-c", "user.email=kage@localhost"];
}

// Files modified but not committed. A run branches from HEAD, so uncommitted work is
// invisible to the hired agent AND collides at merge time if it touches the same files.
// Kage's own first delegated run hit exactly this: the agent refactored yesterday's
// committed code while a day of uncommitted work sat in the tree.
export function dirtyPaths(projectDir: string): string[] {
  const status = git(projectDir, ["status", "--porcelain", "-uno"]);
  if (!status.ok || !status.stdout) return [];
  return status.stdout
    .split("\n")
    // Status codes are 1-2 chars, but git() trims stdout — which eats porcelain's
    // leading space and breaks any fixed-column slice. Parse by shape instead:
    // "<code(s)> <path>", taking the rename target when one is present.
    .map((line) => {
      const match = line.trim().match(/^\S{1,2}\s+(.*)$/);
      const path = match?.[1]?.trim() ?? "";
      const target = path.includes(" -> ") ? path.split(" -> ")[1].trim() : path;
      // git quotes paths containing spaces or specials; unquote so these compare
      // equal to the plain paths `git diff --name-only` reports.
      return target.startsWith('"') && target.endsWith('"') ? target.slice(1, -1) : target;
    })
    .filter(Boolean);
}

export interface DiffStats {
  files: number;
  lines: number;
  paths: string[];
}

export interface DiffFileEntry {
  path: string;
  status: "added" | "modified" | "deleted";
  added: number;
  removed: number;
}

/**
 * Per-file breakdown for ONE diff invocation — numstat for the +/- counts, name-status
 * for added/modified/deleted, both run with the SAME diffArgs so the two views of the
 * same diff can never disagree with each other. Callers pick diffArgs to match their own
 * situation (a single ref against the working tree, or a two-dot committed-only range) —
 * this helper makes no assumption about which, so it stays reusable without becoming a
 * second place that decides HOW a run's diff is measured (that decision lives with the
 * caller, mirroring verify.ts's measureDiff so the two can never disagree on totals).
 */
export function diffFileTree(cwd: string, diffArgs: string[]): DiffFileEntry[] {
  const numstat = git(cwd, ["diff", ...diffArgs, "--numstat"]);
  if (!numstat.ok || !numstat.stdout) return [];
  const nameStatus = git(cwd, ["diff", ...diffArgs, "--name-status"]);
  const statusByPath = new Map<string, DiffFileEntry["status"]>();
  if (nameStatus.ok && nameStatus.stdout) {
    for (const row of nameStatus.stdout.split("\n")) {
      const cols = row.split("\t");
      const code = cols[0]?.[0];
      // A rename/copy row is "R100\told\tnew" — the destination (last column) is the
      // path numstat itself reports, so that is the one this map must key on.
      const path = cols[cols.length - 1];
      if (!code || !path) continue;
      statusByPath.set(path, code === "A" ? "added" : code === "D" ? "deleted" : "modified");
    }
  }
  const entries: DiffFileEntry[] = [];
  for (const row of numstat.stdout.split("\n")) {
    const [added, removed, path] = row.split("\t");
    if (!path) continue;
    entries.push({
      path,
      status: statusByPath.get(path) ?? "modified",
      added: Number(added) || 0,
      removed: Number(removed) || 0,
    });
  }
  return entries;
}

// Stage everything (including untracked files the agent created) and measure the change
// against the branch point. Staging is how untracked work becomes visible to `git diff`;
// it is also exactly what the commit at claim time needs.
export function stageAndMeasure(worktreeDir: string): DiffStats {
  git(worktreeDir, ["add", "-A"]);
  const numstat = git(worktreeDir, ["diff", "--cached", "--numstat"]);
  if (!numstat.ok || !numstat.stdout) return { files: 0, lines: 0, paths: [] };
  let lines = 0;
  const paths: string[] = [];
  for (const row of numstat.stdout.split("\n")) {
    const [added, removed, path] = row.split("\t");
    if (!path) continue;
    paths.push(path);
    // "-" marks a binary file: it contributes a file but no countable lines.
    lines += (Number(added) || 0) + (Number(removed) || 0);
  }
  return { files: paths.length, lines, paths };
}
