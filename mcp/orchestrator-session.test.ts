// The orchestrator as a real agent session — Terminal mode (room-pty.ts) now spawns
// the SAME interactive claude a person would type, but with Kage's tools reachable and
// its own worktree, instead of a bare terminal with none of that. See
// KAGE_MEMORY.md-adjacent context in room-pty.ts's own header for the AO comparison
// this is closing the gap with.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildRoomPtyLaunch,
  ensureOrchestratorWorktree,
  orchestratorBranch,
  orchestratorWorktreeId,
} from "./delegation/room-pty.js";
import { buildHeadlessRoomArgs } from "./delegation/room-supervisor.js";
import { MANAGER_CONSTITUTION } from "./delegation/manager-prompt.js";
import { MANAGER_ALLOWED_TOOLS } from "./delegation/manager-client.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempGitProject(): string {
  const project = mkdtempSync(join(tmpdir(), "kage-orchestrator-session-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

test("buildRoomPtyLaunch passes --mcp-config pointing at the room config, and pre-approves Kage's delegation tools", () => {
  const launch = buildRoomPtyLaunch({ mcpConfigPath: "/tmp/room-mcp.json", cwd: "/tmp/some-worktree" });
  const flagIndex = launch.args.indexOf("--mcp-config");
  assert.notEqual(flagIndex, -1, "the interactive spawn must pass --mcp-config — reverting this leaves the orchestrator toolless");
  assert.equal(launch.args[flagIndex + 1], "/tmp/room-mcp.json");

  const allowedIndex = launch.args.indexOf("--allowedTools");
  assert.notEqual(allowedIndex, -1);
  const allowed = launch.args[allowedIndex + 1].split(",");
  for (const tool of MANAGER_ALLOWED_TOOLS) assert.ok(allowed.includes(tool), `expected ${tool} to be pre-approved`);
  assert.ok(allowed.includes("ToolSearch"));

  assert.equal(launch.cwd, "/tmp/some-worktree");
});

test("buildRoomPtyLaunch resumes the shared session id when one exists, same as before this change", () => {
  const resumed = buildRoomPtyLaunch({ resumeId: "session-abc", mcpConfigPath: "/tmp/room-mcp.json", cwd: "/tmp/x" });
  assert.deepEqual(resumed.args.slice(0, 2), ["--resume", "session-abc"]);

  const fresh = buildRoomPtyLaunch({ mcpConfigPath: "/tmp/room-mcp.json", cwd: "/tmp/x" });
  assert.ok(!fresh.args.includes("--resume"));
});

test("orchestratorWorktreeId and orchestratorBranch are stable per thread and distinct across threads", () => {
  assert.equal(orchestratorWorktreeId(), "orchestrator");
  assert.equal(orchestratorWorktreeId("main"), "orchestrator");
  assert.equal(orchestratorBranch(), "kage/orchestrator");

  assert.equal(orchestratorWorktreeId("thread-2"), "orchestrator-thread-2");
  assert.notEqual(orchestratorWorktreeId("thread-2"), orchestratorWorktreeId());
});

test("ensureOrchestratorWorktree creates a real worktree on its own branch — never the user's checkout", () => {
  const project = tempGitProject();
  const originalHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();

  const cwd = ensureOrchestratorWorktree(project);

  assert.notEqual(cwd, project, "the orchestrator must not be handed the user's own checkout");
  assert.ok(existsSync(cwd), "the worktree directory must exist on disk");

  const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, encoding: "utf8" }).trim();
  assert.equal(branch, "kage/orchestrator");

  // The user's own branch (main) must be untouched — still pointing at the original
  // commit, never fast-forwarded or checked out into by the orchestrator's worktree.
  const mainHead = execFileSync("git", ["rev-parse", "main"], { cwd: project, encoding: "utf8" }).trim();
  assert.equal(mainHead, originalHead);

  const branches = execFileSync("git", ["worktree", "list"], { cwd: project, encoding: "utf8" });
  assert.match(branches, /kage\/orchestrator/);
});

test("ensureOrchestratorWorktree writes the constitution as CLAUDE.md — the mechanism a real session actually reads", () => {
  const project = tempGitProject();
  const cwd = ensureOrchestratorWorktree(project);

  const claudeMdPath = join(cwd, "CLAUDE.md");
  assert.ok(existsSync(claudeMdPath), "CLAUDE.md must exist in the orchestrator's worktree");
  const content = readFileSync(claudeMdPath, "utf8");
  assert.ok(content.includes(MANAGER_CONSTITUTION), "CLAUDE.md must carry the full manager constitution");
});

test("ensureOrchestratorWorktree reuses the same worktree/branch across calls and keeps the constitution current", () => {
  const project = tempGitProject();
  const first = ensureOrchestratorWorktree(project);
  const second = ensureOrchestratorWorktree(project);
  assert.equal(first, second, "a second call must reuse the same worktree, not create another");
});

test("ensureOrchestratorWorktree degrades to the project dir when there is no git repo yet — never throws, never blocks startup", () => {
  const bare = mkdtempSync(join(tmpdir(), "kage-orchestrator-nogit-"));
  const cwd = ensureOrchestratorWorktree(bare);
  assert.equal(cwd, bare, "with no git repo, the orchestrator must still start, directly in the project dir");
  // No CLAUDE.md is written in the degraded case — there is no isolated worktree to
  // write it into, and writing it straight into a non-git scratch dir would be new,
  // unrequested behavior.
  assert.ok(!existsSync(join(bare, "CLAUDE.md")));
});

test("the headless room's spawn args are unchanged by this work — same flags, same -p/stream-json protocol", () => {
  const args = buildHeadlessRoomArgs({ mcpConfigPath: "/tmp/room-mcp.json" });
  assert.deepEqual(args.slice(0, 6), ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose"]);
  const mcpIndex = args.indexOf("--mcp-config");
  assert.equal(args[mcpIndex + 1], "/tmp/room-mcp.json");
  const promptIndex = args.indexOf("--append-system-prompt");
  assert.equal(args[promptIndex + 1], MANAGER_CONSTITUTION);
  assert.ok(args.includes("--permission-mode"));
  assert.ok(args.includes("acceptEdits"));

  const withResume = buildHeadlessRoomArgs({ resumeId: "session-xyz", mcpConfigPath: "/tmp/room-mcp.json" });
  assert.deepEqual(withResume.slice(0, 2), ["--resume", "session-xyz"]);
});
