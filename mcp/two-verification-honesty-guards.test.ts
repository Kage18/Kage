// Tests for two verification-honesty guards, both reproduced live on real runs before
// this file existed:
//
// 1. ratify.ts's mergeRun refuses to merge a feature/bugfix/refactor/migration branch
//    that adds no commits beyond its fork point — the shape that let a run merge reading
//    VERIFIED 5/5 over nothing, then had the worktree holding its only real copy of the
//    work deleted by merge cleanup. chore/investigation may still merge empty (a
//    legitimate no-change conclusion), but must say "EMPTY DIFF" loudly when they do.
//
// 2. verify.ts's citation check treats a slash-joined enumeration of real files
//    ("contract.ts/ratify.ts/review.ts/review-contract.test.ts") as a list, not one
//    invented path — four real claims failed citations on exactly this shape.
//
// Kept out of delegation.test.ts deliberately: that file is a merge-conflict hotspot
// several runs collide in on the same day.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildClaim, createRun, readClaim, readRun, transitionRun, writeClaim } from "./delegation/contract.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { dispatchRun } from "./delegation/dispatch.js";
import { mergeRun } from "./delegation/ratify.js";
import { verifyRun } from "./delegation/verify.js";
import { createWorktree } from "./delegation/worktree.js";
import { writeDelegationConfig } from "./delegation/config.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-honesty-guards-"));
}

function tempGitProject(options: { testCommand?: string } = {}): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  if (options.testCommand) writeDelegationConfig(project, { test: options.testCommand });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

// A run that reached "ready" but whose branch never got anything committed onto it —
// exactly `createWorktree` with nothing written afterward, the same shape a run leaves
// behind when its worktree sat idle (or its real work never made it past `git add`).
function readyRunWithEmptyBranch(project: string, type: "feature" | "bugfix" | "refactor" | "migration" | "chore" | "investigation") {
  const task = createRun(project, { intent: `empty ${type} run`, type, agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  const worktree = createWorktree(project, task.id, task.branch);
  transitionRun(project, task.id, "verifying", "kernel");
  const claim = buildClaim({
    runId: task.id,
    statement: "the work is done",
    checks: [
      { id: "tests", kind: "command", cmd: "true", expect: "exit code 0", result: "pass", exit_code: 0 },
      { id: "diff-size", kind: "diff", expect: "at most 400 changed lines", result: "pass" },
      { id: "citations", kind: "citation", expect: "every formally cited path exists (directly, or as a unique suffix) in the worktree", result: "pass" },
    ],
    fence: { unsure: [], learned: [] },
    diff: { files: 0, lines: 0, paths: [] },
  });
  writeClaim(project, task.id, claim);
  transitionRun(project, task.id, "ready", "kernel");
  return { task, worktree };
}

// --- 1. mergeRun refuses an empty feature/bugfix/refactor/migration diff --------------

test("a feature run whose branch adds zero commits is refused at merge, and its worktree is left intact", () => {
  const project = tempGitProject();
  const { task, worktree } = readyRunWithEmptyBranch(project, "feature");

  // REVERT CHECK: without commitsSinceFork's zero-commit refusal in mergeRun, this call
  // merges cleanly — every check the claim recorded passed honestly (there is no test
  // command, an empty diff is trivially under any cap) — exactly the shape that let a
  // real run merge reading VERIFIED 5/5 over nothing.
  const result = mergeRun(project, task.id);
  assert.equal(result.ok, false);
  assert.equal(result.merged, false);
  assert.ok(result.message.includes(task.branch), "the refusal must name the branch tip");
  assert.match(result.message, /adds no commits/);
  assert.match(result.message, /worktree may still hold it/);

  assert.equal(readRun(project, task.id).state, "ready", "a refused merge must not move the run to merged");
  assert.ok(existsSync(worktree.path), "the worktree must survive a refused merge — it may hold the only copy of the work");
});

test("a bugfix/refactor/migration run with zero commits is refused the same way as feature", () => {
  const project = tempGitProject();
  for (const type of ["bugfix", "refactor", "migration"] as const) {
    const { task } = readyRunWithEmptyBranch(project, type);
    const result = mergeRun(project, task.id);
    assert.equal(result.ok, false, `${type} with zero commits must be refused`);
  }
});

test("a chore run whose branch adds zero commits merges successfully, with EMPTY DIFF leading both the merge output and the claim receipt", () => {
  const project = tempGitProject();
  const { task, worktree } = readyRunWithEmptyBranch(project, "chore");

  const result = mergeRun(project, task.id);
  assert.equal(result.ok, true);
  assert.equal(result.merged, true);
  // REVERT CHECK: without the EMPTY DIFF prefix, this message just reads "Merged
  // kage/... into main." — true, but a human skimming it has no way to tell an empty
  // no-change conclusion apart from real landed work.
  assert.match(result.message, /^EMPTY DIFF —/);

  assert.equal(readRun(project, task.id).state, "merged");
  const claim = readClaim(project, task.id);
  assert.match(claim!.statement, /^EMPTY DIFF — /, "the receipt (the claim's own statement) must lead with EMPTY DIFF too");
  assert.equal(existsSync(worktree.path), false, "a successful merge still cleans up its worktree as before");
});

test("a normal non-empty feature merge is unchanged: it merges and never reads EMPTY DIFF", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { task } = await dispatchRun(
    project,
    { intent: "add a real feature", type: "feature" },
    stubAdapter({ editFile: { path: "src/feature.ts", content: "export const feature = true;\n" } }),
  );
  const result = mergeRun(project, task.id);
  assert.equal(result.ok, true);
  assert.equal(result.merged, true);
  assert.match(result.message, /^Merged /);
  assert.doesNotMatch(result.message, /EMPTY DIFF/);
  assert.equal(readRun(project, task.id).state, "merged");
});

// --- 2. citation check: slash-joined enumeration is a list, not one path --------------

function citationFixtureProject(): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "mcp", "delegation"), { recursive: true });
  writeFileSync(join(project, "mcp", "delegation", "contract.ts"), "export {};\n", "utf8");
  writeFileSync(join(project, "mcp", "delegation", "ratify.ts"), "export {};\n", "utf8");
  writeFileSync(join(project, "mcp", "delegation", "review.ts"), "export {};\n", "utf8");
  writeFileSync(join(project, "mcp", "delegation", "review-contract.test.ts"), "export {};\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

const CITATION_CHECK = [
  { id: "citations", kind: "citation" as const, expect: "every formally cited path exists (directly, or as a unique suffix) in the worktree" },
];

test("the citation check reads a slash-joined enumeration of real files as a list, not one missing path", () => {
  const project = citationFixtureProject();
  const claimText = {
    cited: "Touched contract.ts/ratify.ts/review.ts/review-contract.test.ts across the delegation kernel.",
    prose: "",
  };
  const result = verifyRun(project, "citation-enum-run", project, CITATION_CHECK, claimText);
  // REVERT CHECK: without the enumeration fallback, the whole slash-joined token is read
  // as one path, which resolves nowhere, and this check fails — exactly what happened on
  // four real claims before this fix.
  assert.equal(result.checks[0].result, "pass", `evidence: ${result.checks[0].evidence}`);
});

test("the citation check still fails an enumeration when one segment is invented", () => {
  const project = citationFixtureProject();
  const claimText = {
    cited: "Touched contract.ts/ratify.ts/nonexistent-file.ts across the delegation kernel.",
    prose: "",
  };
  const result = verifyRun(project, "citation-enum-invented-run", project, CITATION_CHECK, claimText);
  assert.equal(result.checks[0].result, "fail", "one invented segment must keep the whole token failing");
});

test("the citation check leaves a single real path and a real directory-joined path untouched", () => {
  const project = citationFixtureProject();
  const claimText = {
    cited: "See mcp/delegation/contract.ts and mcp/delegation for context.",
    prose: "",
  };
  const result = verifyRun(project, "citation-untouched-run", project, CITATION_CHECK, claimText);
  assert.equal(result.checks[0].result, "pass");
});
