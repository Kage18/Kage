// The memory-branch resolver — design law 3 (docs/design/BELIEF_MEMORY.md,
// "Storage architecture"): memory can leave the code working tree onto a
// dedicated branch (kage/memory), checked out as a hidden worktree, so code
// branches stop carrying memory commits and can never merge-conflict on them.
//
// This is opt-in and reversible. Nothing calls migrateToMemoryBranch on its
// own — a project stays in the default layout (packets/journal inside
// .agent_memory/ on whatever branch is checked out) until an operator runs
// `kage memory-branch migrate`. resolveMemoryLayout is the ONE seam every
// reader/writer of packets or the journal goes through (kernel.ts's
// packetsDir, store/journal.ts's journalDir, delegation/memory-view.ts's
// packet lookup): it decides, purely by checking whether a live worktree
// checkout of kage/memory exists on disk, which root to hand back. Nothing
// else needs to know which layout is active.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

export const MEMORY_BRANCH_NAME = "kage/memory";

interface PlumbResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

function git(cwd: string, args: string[], env?: NodeJS.ProcessEnv): PlumbResult {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_EDITOR: "true", GIT_TERMINAL_PROMPT: "0", ...env },
    });
    return { ok: true, stdout: stdout.trim(), stderr: "" };
  } catch (error) {
    const shell = error as { stdout?: string | Buffer; stderr?: string | Buffer };
    return { ok: false, stdout: String(shell.stdout ?? "").trim(), stderr: String(shell.stderr ?? (error as Error).message ?? "").trim() };
  }
}

function commitIdentityArgs(cwd: string): string[] {
  const email = git(cwd, ["config", "user.email"]);
  if (email.ok && email.stdout) return [];
  return ["-c", "user.name=kage", "-c", "user.email=kage@localhost"];
}

/** Repo-root-relative so the same hidden path works from any projectDir. */
export function memoryBranchWorktreeDir(projectDir: string): string {
  return join(projectDir, ".agent_memory", ".branch-worktree");
}

export interface MemoryLayout {
  mode: "default" | "branch";
  /** Directory that directly contains packets/ and journal/. */
  root: string;
}

/**
 * The one place that decides where packets and the journal live. A "branch"
 * layout is active exactly when a real git worktree checkout is sitting at
 * memoryBranchWorktreeDir — nothing else (no config flag, no env var) is
 * consulted, so the on-disk state is always the truth and there is no way
 * for the resolver's answer to drift from what `git worktree list` would say.
 */
export function resolveMemoryLayout(projectDir: string): MemoryLayout {
  const worktree = memoryBranchWorktreeDir(projectDir);
  if (existsSync(join(worktree, ".git"))) {
    return { mode: "branch", root: worktree };
  }
  return { mode: "default", root: join(projectDir, ".agent_memory") };
}

export interface MemoryBranchStatus {
  mode: "default" | "branch";
  branch: string;
  branch_exists: boolean;
  worktree: string | null;
  packets_root: string;
  journal_root: string;
}

export function memoryBranchStatus(projectDir: string): MemoryBranchStatus {
  const layout = resolveMemoryLayout(projectDir);
  const branchExists = git(projectDir, ["rev-parse", "--verify", "--quiet", MEMORY_BRANCH_NAME]).ok;
  return {
    mode: layout.mode,
    branch: MEMORY_BRANCH_NAME,
    branch_exists: branchExists,
    worktree: layout.mode === "branch" ? layout.root : null,
    packets_root: join(layout.root, "packets"),
    journal_root: join(layout.root, "journal"),
  };
}

// Ignored by the pre-existing `.agent_memory/*` blanket rule in every project
// this ships to (verified: a fresh gitignore with just that rule + the
// packets/ un-ignore already hides .branch-worktree from `git add -A`). This
// is a defensive backstop for a project whose .gitignore does not already
// cover it — without it, `git add -A` on the code branch would stage the new
// worktree as an embedded-repo gitlink (confirmed by hand: git prints
// "warning: adding embedded git repository" and stages a gitlink entry),
// which is exactly the kind of surprise commit this whole feature exists to
// prevent.
function ensureWorktreeIgnored(projectDir: string, worktreeDir: string): void {
  const relPath = relative(projectDir, worktreeDir).split(sep).join("/");
  if (git(projectDir, ["check-ignore", "-q", relPath]).ok) return;
  const gitignorePath = join(projectDir, ".gitignore");
  const line = `${relPath}/`;
  let content = "";
  try {
    content = readFileSync(gitignorePath, "utf8");
  } catch {
    // No .gitignore yet — starting one is fine.
  }
  if (content.split("\n").some((existing) => existing.trim() === line)) return;
  const needsNewline = content.length > 0 && !content.endsWith("\n");
  writeFileSync(gitignorePath, `${content}${needsNewline ? "\n" : ""}${line}\n`, "utf8");
}

// Builds the memory branch's FIRST commit from whatever packets/journal
// content sits in the code tree right now, using plumbing so the new
// branch's tree has packets/ and journal/ at its root (not nested under
// .agent_memory/) without ever checking that branch out over the code tree.
// Deliberately an orphan commit (no parent) rather than `git subtree split`:
// it does not rewrite or touch a single existing commit on the code branch —
// "old paths left in code-branch history untouched" — it just gives the new
// branch a starting point equal to today's state.
function seedMemoryBranch(projectDir: string): { ok: boolean; message: string } {
  const legacyMemoryDir = join(projectDir, ".agent_memory");
  const legacyPackets = join(legacyMemoryDir, "packets");
  const legacyJournal = join(legacyMemoryDir, "journal");
  const toSeed = [existsSync(legacyPackets) ? "packets" : null, existsSync(legacyJournal) ? "journal" : null].filter(
    (name): name is string => name !== null,
  );

  const tmpIndexDir = mkdtempSync(join(tmpdir(), "kage-memory-branch-index-"));
  const tmpIndex = join(tmpIndexDir, "index");
  const env = { GIT_INDEX_FILE: tmpIndex };
  try {
    if (toSeed.length) {
      const add = git(projectDir, ["--git-dir", join(projectDir, ".git"), "--work-tree", legacyMemoryDir, "add", ...toSeed], env);
      if (!add.ok) return { ok: false, message: `failed to stage existing memory files for the new branch: ${add.stderr || add.stdout}` };
    }
    const writeTree = git(projectDir, ["--git-dir", join(projectDir, ".git"), "write-tree"], env);
    if (!writeTree.ok) return { ok: false, message: `failed to build the memory branch's tree: ${writeTree.stderr || writeTree.stdout}` };
    const commit = git(projectDir, ["commit-tree", writeTree.stdout, "-m", "kage: seed memory branch from current .agent_memory state"]);
    if (!commit.ok) return { ok: false, message: `failed to create the memory branch's first commit: ${commit.stderr || commit.stdout}` };
    const branch = git(projectDir, ["branch", MEMORY_BRANCH_NAME, commit.stdout]);
    if (!branch.ok) return { ok: false, message: `failed to create branch "${MEMORY_BRANCH_NAME}": ${branch.stderr || branch.stdout}` };
    return { ok: true, message: "seeded" };
  } finally {
    try {
      rmSync(tmpIndexDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup of a scratch temp dir; leaving it behind costs nothing correctness-wise.
    }
  }
}

// Removes packets/journal from the CODE branch's own tracked tree and working
// directory — the step that actually satisfies "memory files are not in the
// code tree" (a merge can only conflict on files a branch tracks). A no-op,
// committing nothing, when neither path is tracked here — e.g. a second
// machine whose clone already reflects a prior machine's removal commit.
function removeLegacyMemoryFromCodeTree(projectDir: string): { ok: boolean; message: string } {
  const tracked = git(projectDir, ["ls-files", "--", ".agent_memory/packets", ".agent_memory/journal"]);
  if (!tracked.ok || !tracked.stdout) return { ok: true, message: "nothing tracked under .agent_memory/packets or .agent_memory/journal" };
  const rm = git(projectDir, ["rm", "-r", "-q", "--", ".agent_memory/packets", ".agent_memory/journal"]);
  // A path can legitimately be missing (e.g. journal never existed for this project)
  // -- retry naming only the paths that are actually tracked rather than failing outright.
  if (!rm.ok) {
    const paths = tracked.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
    const retry = git(projectDir, ["rm", "-q", "--", ...paths]);
    if (!retry.ok) return { ok: false, message: `failed to remove memory files from the code branch: ${retry.stderr || retry.stdout}` };
  }
  const commit = git(projectDir, [...commitIdentityArgs(projectDir), "commit", "-m", "kage: move memory to the kage/memory branch — packets and journal no longer live in the code tree"]);
  if (!commit.ok) return { ok: false, message: `failed to commit the memory removal on the code branch: ${commit.stderr || commit.stdout}` };
  return { ok: true, message: "removed" };
}

export interface MigrateResult {
  ok: boolean;
  message: string;
  mode: "default" | "branch";
}

/**
 * The one-time, explicit move onto the memory branch. Never called
 * automatically — an operator runs `kage memory-branch migrate`. Refuses a
 * dirty tree (the seed step reads packets/journal straight off disk, and a
 * migration is not the moment to also decide what happens to unrelated
 * uncommitted work) and is idempotent: calling it again once migrated is a
 * safe no-op that reports the already-active layout.
 */
export function migrateToMemoryBranch(projectDir: string): MigrateResult {
  if (!existsSync(join(projectDir, ".git"))) {
    return { ok: false, message: "not a git repository — memory-branch migration requires git.", mode: "default" };
  }

  const already = resolveMemoryLayout(projectDir);
  if (already.mode === "branch") {
    return { ok: true, message: `already migrated — the "${MEMORY_BRANCH_NAME}" branch is checked out at ${already.root}.`, mode: "branch" };
  }

  const dirty = git(projectDir, ["status", "--porcelain"]);
  if (dirty.stdout.trim()) {
    return {
      ok: false,
      message: "refusing to migrate: the working tree has uncommitted changes. Commit or stash them, then re-run `kage memory-branch migrate`.",
      mode: "default",
    };
  }

  const localBranchExists = git(projectDir, ["rev-parse", "--verify", "--quiet", MEMORY_BRANCH_NAME]).ok;
  if (!localBranchExists) {
    // Best-effort: a second machine converging onto a branch a teammate already
    // pushed should track it, not seed a divergent sibling with different history.
    git(projectDir, ["fetch", "origin", MEMORY_BRANCH_NAME]);
    const remoteBranchExists = git(projectDir, ["rev-parse", "--verify", "--quiet", `origin/${MEMORY_BRANCH_NAME}`]).ok;
    const created = remoteBranchExists
      ? git(projectDir, ["branch", "--track", MEMORY_BRANCH_NAME, `origin/${MEMORY_BRANCH_NAME}`])
      : null;
    if (created && !created.ok) {
      return { ok: false, message: `failed to track the existing "${MEMORY_BRANCH_NAME}" branch: ${created.stderr || created.stdout}`, mode: "default" };
    }
    if (!created) {
      const seeded = seedMemoryBranch(projectDir);
      if (!seeded.ok) return { ok: false, message: seeded.message, mode: "default" };
    }
  }

  const worktreeDir = memoryBranchWorktreeDir(projectDir);
  mkdirSync(join(projectDir, ".agent_memory"), { recursive: true });
  const added = git(projectDir, ["worktree", "add", worktreeDir, MEMORY_BRANCH_NAME]);
  if (!added.ok) {
    return { ok: false, message: `failed to check out the memory branch worktree: ${added.stderr || added.stdout}`, mode: "default" };
  }
  mkdirSync(join(worktreeDir, "packets"), { recursive: true });
  mkdirSync(join(worktreeDir, "journal"), { recursive: true });
  ensureWorktreeIgnored(projectDir, worktreeDir);

  const removed = removeLegacyMemoryFromCodeTree(projectDir);
  if (!removed.ok) {
    return { ok: false, message: `worktree checked out, but ${removed.message}`, mode: "branch" };
  }

  return {
    ok: true,
    message: `migrated memory to branch "${MEMORY_BRANCH_NAME}", checked out at ${worktreeDir}. Packets and journal no longer live in the code tree.`,
    mode: "branch",
  };
}
