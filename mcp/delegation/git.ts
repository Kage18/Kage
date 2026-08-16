// Git helper for delegation. Never throws on a failed command — callers decide what a
// non-zero exit means, because "git said no" is often a legitimate outcome (no commits
// yet, merge conflict, nothing to commit) rather than a crash.
import { execFileSync } from "node:child_process";

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

export function isGitRepo(projectDir: string): boolean {
  return git(projectDir, ["rev-parse", "--git-dir"]).ok;
}

export function hasCommits(projectDir: string): boolean {
  return git(projectDir, ["rev-parse", "--verify", "HEAD"]).ok;
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
