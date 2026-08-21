// Worktree lifecycle: every run gets its own checkout so parallel agents cannot
// collide, and so the human's working tree is never touched by delegated work.
// Isolation without exile — `kage open <run>` hands the same directory to the user's
// own terminal or IDE.
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readDelegationConfig } from "./config.js";
import { worktreesDir } from "./contract.js";
import { commitIdentityArgs, git, hasCommits, isGitRepo, looksLikeGitRepo, retryTransient, type GitResult } from "./git.js";

export interface WorktreeHandle {
  path: string;
  branch: string;
  base_commit: string;
}

export type WorkspaceKind = "worktree" | "sandbox";

/**
 * Worktrees need a git repo with a branch point. Without one (a scratch directory, a
 * fresh repo with no commits) a run still works in a sandbox — degraded isolation,
 * stated plainly, never a silent difference.
 *
 * A sandbox is only ever the right call for a genuinely non-git or commit-less
 * project — never because git was momentarily busy. isGitRepo/hasCommits already
 * retry transient lock contention; if isGitRepo is STILL false while a `.git` entry
 * sits right there on disk, that is not "not a repo", it is git in real trouble
 * (corruption, permissions, a broken worktree pointer), and the caller must not
 * silently hand the agent an empty directory over it.
 */
export function resolveWorkspaceKind(projectDir: string): WorkspaceKind {
  if (isGitRepo(projectDir)) return hasCommits(projectDir) ? "worktree" : "sandbox";
  if (looksLikeGitRepo(projectDir)) {
    throw new Error(
      `${projectDir} has a .git entry on disk but git still reports it is not a repository, even after retries. ` +
        "This looks like git trouble (lock contention, corruption, permissions), not a non-git project — refusing to silently sandbox it.",
    );
  }
  return "sandbox";
}

export function worktreePath(projectDir: string, runId: string): string {
  return join(worktreesDir(projectDir), runId);
}

export function createWorktree(
  projectDir: string,
  runId: string,
  branch: string,
  deps: { runGit?: (cwd: string, args: string[]) => GitResult } = {},
): WorktreeHandle {
  const runGit = deps.runGit ?? git;
  if (!isGitRepo(projectDir)) {
    throw new Error("Kage delegation needs a git repository — run `git init` first.");
  }
  if (!hasCommits(projectDir)) {
    throw new Error("This repo has no commits yet. Make one commit so agents have a branch point to work from.");
  }
  const path = worktreePath(projectDir, runId);
  if (existsSync(path)) return { path, branch, base_commit: git(path, ["rev-parse", "HEAD"]).stdout };

  // A concurrent `git worktree add`/`commit` in the same parallel wave can hold the
  // ref lock this needs for a moment; retry through it instead of failing the run.
  const added = retryTransient(() => runGit(projectDir, ["worktree", "add", "-b", branch, path, "HEAD"]));
  if (!added.ok) throw new Error(`Could not create worktree for ${runId}: ${added.stderr}`);

  const setup = readDelegationConfig(projectDir).setup;
  if (setup) {
    try {
      execFileSync(setup, { cwd: path, shell: true, stdio: "ignore", timeout: 10 * 60_000 });
    } catch {
      // A failed setup is not fatal: the agent may not need deps, and the verifier
      // will report `unverified_no_env` rather than pass a check it could not run.
    }
  }
  return { path, branch, base_commit: git(projectDir, ["rev-parse", "HEAD"]).stdout };
}

// Commit whatever the agent produced onto the run branch. This is what makes a run
// reviewable as a real branch/PR and mergeable by plain git. Returns false when there
// was nothing to commit (agent changed nothing).
export function commitWorktree(projectDir: string, runId: string, message: string): boolean {
  const path = worktreePath(projectDir, runId);
  if (!existsSync(path)) return false;
  git(path, ["add", "-A"]);
  const staged = git(path, ["diff", "--cached", "--name-only"]);
  if (!staged.ok || !staged.stdout) return false;
  const committed = git(path, [...commitIdentityArgs(projectDir), "commit", "-m", message]);
  return committed.ok;
}

export function removeWorktree(projectDir: string, runId: string): void {
  const path = worktreePath(projectDir, runId);
  if (!existsSync(path)) return;
  const removed = git(projectDir, ["worktree", "remove", "--force", path]);
  if (!removed.ok) {
    // Fall back to a filesystem removal plus prune so a locked/dirty worktree can never
    // wedge the run lifecycle.
    rmSync(path, { recursive: true, force: true });
    git(projectDir, ["worktree", "prune"]);
  }
}

// Branches outlive their worktrees on purpose: a rejected or failed run stays
// inspectable (`git log kage/<id>`) until it is pruned deliberately.
export function deleteRunBranch(projectDir: string, branch: string): void {
  git(projectDir, ["branch", "-D", branch]);
}
