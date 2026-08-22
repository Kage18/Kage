// P1a: derived state (.agent_memory/indexes, code_graph, graph, structural,
// metrics.json, and friends) must never be committed again -- they were most
// of a 127-conflict master merge. This file is new behaviour (repo rule:
// mcp/delegation.test.ts is off-limits, new behaviour gets its own file).
//
// REVERT CHECK: "pr check rebuilds missing graph artifacts locally instead of
// failing" fails if prCheck's rebuild-on-missing branch in mcp/kernel.ts is
// reverted -- prCheck would go back to reporting ok:false with a "Generated
// graph artifacts are missing or not current" error on a fresh checkout that
// has simply never run `kage refresh`, since gitignored artifacts are gone.
// "ensureDelegationIgnores covers every derived .agent_memory subdirectory"
// fails if the `needed` list in mcp/delegation/contract.ts is reverted to
// its old runs/goals/worktrees/audit/indexes/reports/graph/code_graph/
// structural/review/pending set, missing store/branches/daemon/marketplace/
// observations/public-bundle/public-candidates/slots/global-cdn/metrics.json.
// "kage-sync workflow stages only packets/" fails if .github/workflows/
// kage-sync.yml is reverted to `git add .agent_memory/`.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { codeGraphDir, graphDir, packetsDir, prCheck, recall, refreshProject } from "./kernel.js";
import { ensureDelegationIgnores } from "./delegation/contract.js";

if (!process.env.KAGE_HOME) process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-p1a-test-home-"));

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-p1a-"));
  mkdirSync(join(dir, ".agent_memory", "packets"), { recursive: true });
  return dir;
}

const gitIdentityEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function commitAll(project: string, message: string): void {
  execFileSync("git", ["add", "."], { cwd: project, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", message], { cwd: project, stdio: "ignore", env: gitIdentityEnv });
}

function writeApprovedPacket(project: string, slug: string, paths: string[]): void {
  const frontmatter = [
    "---",
    `id: repo:fixture:decision:${slug}`,
    "type: decision",
    "status: approved",
    `title: ${JSON.stringify(`Fixture decision ${slug}`)}`,
    `paths: ${JSON.stringify(paths)}`,
    `tags: []`,
    `updated_at: "2026-08-22T00:00:00.000Z"`,
    "---",
  ].join("\n");
  writeFileSync(join(packetsDir(project), `${slug}.md`), `${frontmatter}\nFixture packet body for ${slug}.\n`, "utf8");
}

function initRepoWithSource(project: string): void {
  execFileSync("git", ["init"], { cwd: project, stdio: "ignore" });
  ensureDelegationIgnores(project);
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "node --test" } }), "utf8");
  writeFileSync(join(project, "src", "runner.js"), "export function run() { return 'ok'; }\n", "utf8");
  writeApprovedPacket(project, "fixture-a", ["src/runner.js"]);
  commitAll(project, "initial");
}

test("ensureDelegationIgnores covers every derived .agent_memory subdirectory, not just runs/worktrees", () => {
  const project = tempProject();
  ensureDelegationIgnores(project);
  const ignore = readFileSync(join(project, ".gitignore"), "utf8");
  for (const line of [
    ".agent_memory/runs/",
    ".agent_memory/worktrees/",
    ".agent_memory/store/",
    ".agent_memory/branches/",
    ".agent_memory/daemon/",
    ".agent_memory/marketplace/",
    ".agent_memory/observations/",
    ".agent_memory/public-bundle/",
    ".agent_memory/public-candidates/",
    ".agent_memory/slots/",
    ".agent_memory/global-cdn/",
    ".agent_memory/metrics.json",
  ]) {
    assert.equal(ignore.includes(line), true, `expected .gitignore to contain ${line}`);
  }
});

test("ensureDelegationIgnores is idempotent and never duplicates entries it already wrote", () => {
  const project = tempProject();
  ensureDelegationIgnores(project);
  const once = readFileSync(join(project, ".gitignore"), "utf8");
  ensureDelegationIgnores(project);
  const twice = readFileSync(join(project, ".gitignore"), "utf8");
  assert.equal(twice, once);
});

test("pr check rebuilds missing graph artifacts locally instead of failing", () => {
  const project = tempProject();
  initRepoWithSource(project);

  // No refreshProject() call: this is a fresh checkout that never ran `kage
  // refresh`, so the gitignored .agent_memory/graph and .agent_memory/code_graph
  // artifacts simply do not exist on disk yet.
  assert.equal(existsSync(join(codeGraphDir(project), "graph.json")), false);
  assert.equal(existsSync(join(graphDir(project), "graph.json")), false);

  const check = prCheck(project);
  assert.equal(check.graph_artifacts_rebuilt, true);
  assert.equal(check.code_graph_current, true);
  assert.equal(check.memory_graph_current, true);
  assert.equal(check.errors.some((error) => error.includes("graph artifacts")), false);
  assert.equal(check.warnings.some((warning) => warning.includes("rebuilt automatically")), true);

  // The rebuild must actually persist local artifacts -- not just claim success in memory.
  assert.equal(existsSync(join(codeGraphDir(project), "graph.json")), true);
  assert.equal(existsSync(join(graphDir(project), "graph.json")), true);
});

test("pr check still fails when an existing graph artifact is stale from an un-refreshed source edit", () => {
  const project = tempProject();
  initRepoWithSource(project);
  const refresh = refreshProject(project);
  assert.equal(refresh.ok, true);

  // The artifact now EXISTS -- this is drift, not absence, and must still be caught
  // rather than silently auto-healed away (that would defeat the "did you refresh
  // before merging" signal this gate exists for).
  writeFileSync(join(project, "src", "runner.js"), "export function run() { return 'changed'; }\n", "utf8");

  const check = prCheck(project);
  assert.equal(check.graph_artifacts_rebuilt, false);
  assert.equal(check.ok, false);
  assert.match(check.errors.join("\n"), /graph artifacts/);
});

test("recall serves memory on a fresh checkout with no derived graph artifacts present, rebuilding locally", () => {
  const project = tempProject();
  initRepoWithSource(project);

  assert.equal(existsSync(join(graphDir(project), "graph.json")), false);

  const result = recall(project, "fixture decision", 5);
  assert.equal(result.results.length > 0, true);

  // Serving the query rebuilds the knowledge graph as a side effect (the same
  // self-heal buildKnowledgeGraph already gives every kernel reader), so the
  // local artifact exists afterward even though it was never committed.
  assert.equal(existsSync(join(graphDir(project), "graph.json")), true);
});

test("refresh produces zero git-visible churn outside .agent_memory/packets/", () => {
  const project = tempProject();
  initRepoWithSource(project);

  const refresh = refreshProject(project);
  assert.equal(refresh.ok, true);

  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore" });
  const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: project, encoding: "utf8" })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const outsidePackets = staged.filter((path) => path.startsWith(".agent_memory/") && !path.startsWith(".agent_memory/packets/"));
  assert.deepEqual(outsidePackets, []);
});

test("kage-sync workflow stages only .agent_memory/packets/, never the whole derived tree", () => {
  const workflowPath = join(__dirname, "..", "..", ".github", "workflows", "kage-sync.yml");
  const workflow = readFileSync(workflowPath, "utf8");
  assert.equal(/git add \.agent_memory\/packets\//.test(workflow), true);
  assert.equal(/git add \.agent_memory\/\s*$/m.test(workflow), false);
});
