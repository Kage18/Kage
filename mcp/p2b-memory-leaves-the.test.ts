// P2b: memory leaves the code working tree (design law 3, BELIEF_MEMORY.md
// storage section). An opt-in, one-time `kage memory-branch migrate` moves
// .agent_memory/packets and .agent_memory/journal onto a dedicated kage/memory
// branch, checked out as a hidden worktree at .agent_memory/.branch-worktree.
// Every reader/writer of packets/journal goes through resolveMemoryLayout
// (mcp/store/memory-layout.ts) — the ONE resolver seam this file proves.
//
// REVERT CHECK: "packetsDir and journalDir follow a migrated layout" fails if
// kernel.ts's packetsDir or store/journal.ts's journalDir go back to a bare
// join(projectDir, ".agent_memory", ...) instead of routing through
// resolveMemoryLayout — the migrated-project assertions in this file would
// then find packets/journal still resolving under the project's own
// .agent_memory instead of the branch worktree. "migrate removes packets and
// journal from the code branch's tracked tree" fails if
// removeLegacyMemoryFromCodeTree stops running (or migrateToMemoryBranch stops
// calling it) — `git ls-files` would then still list .agent_memory/packets on
// the code branch, which is exactly the "memory files are in the code tree"
// state law 4 exists to eliminate.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { capture, gcProject, loadApprovedPackets, packetsDir, prCheck, recall, refreshProject } from "./kernel.js";
import { journalDir } from "./store/journal.js";
import { MEMORY_BRANCH_NAME, memoryBranchStatus, memoryBranchWorktreeDir, migrateToMemoryBranch, resolveMemoryLayout } from "./store/memory-layout.js";

if (!process.env.KAGE_HOME) process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-p2b-test-home-"));

const gitIdentityEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempGitProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-p2b-"));
  execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "ignore" });
  writeFileSync(
    join(dir, ".gitignore"),
    [".agent_memory/*", "!.agent_memory/", "!.agent_memory/packets/", "!.agent_memory/packets/*.md"].join("\n") + "\n",
    "utf8",
  );
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "node --test" } }), "utf8");
  writeFileSync(join(dir, "src", "runner.js"), "export function run() { return 'ok'; }\n", "utf8");
  commitAll(dir, "initial");
  return dir;
}

function commitAll(project: string, message: string): void {
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", message], { cwd: project, stdio: "ignore", env: gitIdentityEnv });
}

function gitOut(project: string, args: string[]): string {
  return execFileSync("git", args, { cwd: project, encoding: "utf8" }).trim();
}

test("default layout is untouched until migration — packetsDir/journalDir resolve under the project's own .agent_memory", () => {
  const project = tempGitProject();
  const layout = resolveMemoryLayout(project);
  assert.equal(layout.mode, "default");
  assert.equal(packetsDir(project), join(project, ".agent_memory", "packets"));
  assert.equal(journalDir(project), join(project, ".agent_memory", "journal"));

  const status = memoryBranchStatus(project);
  assert.equal(status.mode, "default");
  assert.equal(status.worktree, null);
  assert.equal(status.branch, MEMORY_BRANCH_NAME);
});

test("migrate refuses a dirty tree with a plain message", () => {
  const project = tempGitProject();
  writeFileSync(join(project, "src", "runner.js"), "export function run() { return 'dirty'; }\n", "utf8");

  const result = migrateToMemoryBranch(project);
  assert.equal(result.ok, false);
  assert.equal(result.mode, "default");
  assert.match(result.message, /uncommitted changes/i);
  // Nothing was created — the refusal must be a no-op, not a partial migration.
  assert.equal(resolveMemoryLayout(project).mode, "default");
});

test("migrate moves packets and journal onto kage/memory, out of the code branch's tracked tree, and is idempotent", () => {
  const project = tempGitProject();
  const captured = capture({
    projectDir: project,
    title: "Pre-migration note",
    body: "Captured before the memory branch migration to prove existing packets ride along.",
    type: "decision",
    paths: ["src/runner.js"],
  });
  assert.equal(captured.ok, true);
  // The packet file is tracked on the code branch before migration.
  assert.notEqual(gitOut(project, ["status", "--porcelain"]).length, -1); // sanity: git works
  commitAll(project, "capture pre-migration note");
  assert.ok(gitOut(project, ["ls-files", ".agent_memory/packets"]).length > 0, "packet must be tracked on the code branch before migration");

  const migrated = migrateToMemoryBranch(project);
  assert.equal(migrated.ok, true, migrated.message);
  assert.equal(migrated.mode, "branch");

  const layout = resolveMemoryLayout(project);
  assert.equal(layout.mode, "branch");
  assert.equal(layout.root, memoryBranchWorktreeDir(project));
  assert.equal(packetsDir(project), join(layout.root, "packets"));
  assert.equal(journalDir(project), join(layout.root, "journal"));

  // Law 4: the code branch itself no longer tracks packets or journal — nothing left for a
  // future merge to conflict on.
  assert.equal(gitOut(project, ["ls-files", ".agent_memory/packets", ".agent_memory/journal"]), "");
  // The pre-migration packet survived the move — it is findable inside the worktree.
  const movedPacket = loadApprovedPackets(project).find((p) => p.id === captured.packet!.id);
  assert.ok(movedPacket, "a packet captured before migration must still be readable after it");

  // The branch exists and carries the moved content.
  assert.equal(gitOut(project, ["rev-parse", "--verify", "--quiet", MEMORY_BRANCH_NAME]), gitOut(project, ["rev-parse", MEMORY_BRANCH_NAME]));

  // Idempotent: migrating again is a safe no-op that reports the already-active layout.
  const again = migrateToMemoryBranch(project);
  assert.equal(again.ok, true);
  assert.equal(again.mode, "branch");
  assert.match(again.message, /already migrated/i);
  assert.equal(resolveMemoryLayout(project).root, layout.root);
});

test("ratifying a learning onto the memory branch never commits it onto the checked-out code branch", () => {
  const project = tempGitProject();
  const migrated = migrateToMemoryBranch(project);
  assert.equal(migrated.ok, true, migrated.message);

  const beforeCodeHead = gitOut(project, ["rev-parse", "HEAD"]);

  const captured = capture({
    projectDir: project,
    title: "Post-migration learning",
    body: "Captured after migration to prove writes land in the memory worktree, not the code tree.",
    type: "decision",
    paths: ["src/runner.js"],
  });
  assert.equal(captured.ok, true);

  const layout = resolveMemoryLayout(project);
  // Mirrors ratify.ts's mergeRun: add + commit with the memory worktree as cwd.
  execFileSync("git", ["add", "-A"], { cwd: layout.root, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "kage: ratify 1 learning(s) from test-run"], { cwd: layout.root, stdio: "ignore", env: gitIdentityEnv });

  // The code branch's HEAD did not move — the ratification commit landed on kage/memory.
  assert.equal(gitOut(project, ["rev-parse", "HEAD"]), beforeCodeHead);
  assert.equal(gitOut(project, ["status", "--porcelain"]), "");
  const memoryLog = gitOut(project, ["log", "--oneline", MEMORY_BRANCH_NAME]);
  assert.match(memoryLog, /ratify 1 learning/);
});

test("migrated and unmigrated projects serve capture, recall, gc, and pr-check identically", () => {
  const unmigrated = tempGitProject();
  const migrated = tempGitProject();
  const setup = migrateToMemoryBranch(migrated);
  assert.equal(setup.ok, true, setup.message);

  for (const project of [unmigrated, migrated]) {
    const result = capture({
      projectDir: project,
      title: "Runner returns ok",
      body: "src/runner.js's run() returns the literal string 'ok' for callers that just need a smoke value.",
      type: "code_explanation",
      paths: ["src/runner.js"],
    });
    assert.equal(result.ok, true, `capture must succeed identically (project mode=${resolveMemoryLayout(project).mode})`);
  }

  const unmigratedRecall = recall(unmigrated, "runner returns ok");
  const migratedRecall = recall(migrated, "runner returns ok");
  assert.equal(unmigratedRecall.results.length, migratedRecall.results.length);
  assert.ok(unmigratedRecall.results.length > 0, "recall must actually find the captured packet");
  assert.equal(unmigratedRecall.results[0].packet.title, migratedRecall.results[0].packet.title);
  assert.equal(unmigratedRecall.results[0].packet.paths.join(","), migratedRecall.results[0].packet.paths.join(","));

  const unmigratedGc = gcProject(unmigrated, { dryRun: true });
  const migratedGc = gcProject(migrated, { dryRun: true });
  assert.equal(unmigratedGc.ok, migratedGc.ok);
  assert.equal(unmigratedGc.deprecated.length, migratedGc.deprecated.length);

  assert.equal(refreshProject(unmigrated).ok, true);
  assert.equal(refreshProject(migrated).ok, true);
  const unmigratedCheck = prCheck(unmigrated);
  const migratedCheck = prCheck(migrated);
  assert.equal(unmigratedCheck.code_graph_current, true);
  assert.equal(migratedCheck.code_graph_current, true);
  assert.equal(unmigratedCheck.memory_graph_current, true);
  assert.equal(migratedCheck.memory_graph_current, true);
});
