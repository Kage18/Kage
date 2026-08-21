// Covers `addProject`/`resolveProjectPath` (mcp/delegation/add-project.ts) — the one
// place that decides whether a folder becomes a Kage project, shared by the app's
// add-project dialog and `kage projects add`. New behaviour gets its own file per repo
// convention; mcp/delegation.test.ts is off-limits for new tests.
//
// REVERT CHECK: reverting mcp/delegation/add-project.ts fails
// "adding a valid git repo registers it and returns the id the app needs to open its
// Room" first — addProject() and resolveProjectPath() would not exist at all.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { addProject, findNestedGitRepos, resolveProjectPath } from "./delegation/add-project.js";
import { readDelegationConfig } from "./delegation/config.js";
import { readKnownProjects } from "./delegation/projects.js";
import { delegationAppHtml } from "./delegation/app-html.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `kage-${prefix}-`));
}

function sandboxHome(): void {
  process.env.KAGE_HOME = tempDir("addproject-home");
}

function gitRepoWithCommit(dir: string): void {
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir, stdio: "ignore" });
  writeFileSync(join(dir, "README.md"), "# fixture\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: dir, stdio: "ignore", env: GIT_ENV });
}

test("adding a valid git repo registers it and returns the id the app needs to open its Room", () => {
  sandboxHome();
  const repo = tempDir("repo");
  gitRepoWithCommit(repo);

  const result = addProject(repo);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // `dir` is exactly what the app already knows how to turn into a live Room: the
  // same value /projects/open and /projects/add hand to ensureAppDaemon.
  assert.equal(result.dir, repo);
  assert.equal(result.kind, "worktree");
  assert.ok(readKnownProjects().some((p) => p.dir === repo), "the registry must know about it");
});

test("a non-git path is refused with a message naming the reason", () => {
  sandboxHome();
  const plain = tempDir("plain");
  writeFileSync(join(plain, "notes.txt"), "just a folder\n", "utf8");

  const result = addProject(plain);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "not_a_repo");
  assert.match(result.message, /not a git repository/);
  assert.ok(!readKnownProjects().some((p) => p.dir === plain), "a refused path must never be registered");
});

test("a path that does not exist is refused with a different, correct message", () => {
  sandboxHome();
  const missing = join(tempDir("parent"), "gone");

  const result = addProject(missing);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "not_found");
  assert.match(result.message, /does not exist/);
});

test("a repo with no commits yet is handled per resolveWorkspaceKind's existing rule, not a crash", () => {
  sandboxHome();
  const fresh = tempDir("fresh");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: fresh, stdio: "ignore" });

  const result = addProject(fresh);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.kind, "sandbox", "no commits means sandbox, exactly what resolveWorkspaceKind already says");
  assert.ok(readKnownProjects().some((p) => p.dir === fresh), "a commit-less repo is still a usable project, just a degraded one");
});

test("a folder holding several git repos is refused as ambiguous, listing candidates, never picked silently", () => {
  sandboxHome();
  const parent = tempDir("multi");
  const alpha = join(parent, "alpha");
  const beta = join(parent, "beta");
  mkdirSync(alpha, { recursive: true });
  mkdirSync(beta, { recursive: true });
  gitRepoWithCommit(alpha);
  gitRepoWithCommit(beta);

  const resolved = resolveProjectPath(parent);
  assert.equal(resolved.ok, false);
  if (resolved.ok) return;
  assert.equal(resolved.reason, "ambiguous");
  assert.deepEqual(new Set(resolved.candidates), new Set([alpha, beta]));

  // addProject must refuse the same way — no route into the registry that skips the pick.
  const added = addProject(parent);
  assert.equal(added.ok, false);
  if (added.ok) return;
  assert.equal(added.reason, "ambiguous");
  assert.ok(!readKnownProjects().some((p) => p.dir === parent));
});

test("findNestedGitRepos ignores dotfiles and build noise, one level deep only", () => {
  const parent = tempDir("nested");
  const real = join(parent, "real-repo");
  const nodeModules = join(parent, "node_modules");
  const hidden = join(parent, ".hidden");
  const grandchild = join(parent, "wrapper", "deep-repo");
  mkdirSync(real, { recursive: true });
  mkdirSync(nodeModules, { recursive: true });
  mkdirSync(hidden, { recursive: true });
  mkdirSync(grandchild, { recursive: true });
  gitRepoWithCommit(real);
  gitRepoWithCommit(nodeModules);
  gitRepoWithCommit(hidden);
  gitRepoWithCommit(grandchild);

  assert.deepEqual(findNestedGitRepos(parent), [real]);
});

test("a chosen worker agent is written to the project's own config, read back as default_agent", () => {
  sandboxHome();
  const repo = tempDir("agent-repo");
  gitRepoWithCommit(repo);

  const result = addProject(repo, { worker_agent: "codex" });
  assert.equal(result.ok, true);
  assert.equal(readDelegationConfig(repo).default_agent, "codex");
});

test("the composed app page still parses after the add-project dialog markup and script were added", () => {
  const html = delegationAppHtml("tok");
  assert.ok(html.includes('id="addproject-overlay"'), "the add-project dialog must be in the composed page");
  const script = html.split("<script>")[1].split("</" + "script>")[0];
  assert.doesNotThrow(() => new Function(script), "the emitted client script must still parse");
  assert.ok(script.includes("function addProject()"), "the client-side addProject entry point must be defined");
});
