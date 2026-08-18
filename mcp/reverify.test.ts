// Tests for the two verification-loop fixes: citations distinguishing a formal citation
// from prose (mcp/delegation/verify.ts), and `kage reverify <run-id>` — the lighter path
// back from a failed run that never re-runs the agent (mcp/delegation/ratify.ts).
//
// Deliberately its own file, not appended to delegation.test.ts: that file has had
// append-collision merge conflicts from parallel runs landing on the same trailing block.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readClaim, readRun } from "./delegation/contract.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { dispatchRun } from "./delegation/dispatch.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { mergeRun, reverifyRun } from "./delegation/ratify.js";
import { renderClaimCard, verifyRun } from "./delegation/verify.js";
import { worktreePath } from "./delegation/worktree.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-reverify-"));
}

// A real git repo, with a nested file tree deep enough to exercise unique-suffix and
// ambiguous-suffix resolution: src/deep/nested/index.ts is unambiguous; src/x/onedir/dup.ts
// and src/y/onedir/dup.ts share the suffix "onedir/dup.ts" on purpose.
function citationFixture(): string {
  const dir = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir, stdio: "ignore" });
  mkdirSync(join(dir, "src", "deep", "nested"), { recursive: true });
  writeFileSync(join(dir, "src", "deep", "nested", "index.ts"), "export const x = 1;\n", "utf8");
  mkdirSync(join(dir, "src", "x", "onedir"), { recursive: true });
  mkdirSync(join(dir, "src", "y", "onedir"), { recursive: true });
  writeFileSync(join(dir, "src", "x", "onedir", "dup.ts"), "export const a = 1;\n", "utf8");
  writeFileSync(join(dir, "src", "y", "onedir", "dup.ts"), "export const b = 1;\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: dir, stdio: "ignore", env: GIT_ENV });
  return dir;
}

// A real git repo whose test check reads flag.txt through a shell command — so a test
// can flip the "defect" by editing flag.txt in the run's worktree, with no compiler or
// interpreter dependency beyond `test`/`cat`, same as this repo's own `exit 1` / `true`
// fixtures use for the declared "tests" check.
function reverifiableProject(flag: "pass" | "fail"): string {
  const dir = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir, stdio: "ignore" });
  writeFileSync(join(dir, "flag.txt"), `${flag}\n`, "utf8");
  writeFileSync(join(dir, "README.md"), "# fixture\n", "utf8");
  writeDelegationConfig(dir, { test: `[ "$(cat flag.txt)" = "pass" ]` });
  execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: dir, stdio: "ignore", env: GIT_ENV });
  return dir;
}

// --- citations: formal (statement) vs prose (unsure/learned) ---------------------------

test("a formally cited path resolves as a unique suffix of a real repo file, and passes", () => {
  const dir = citationFixture();
  const result = verifyRun(
    dir,
    "run-unique-suffix",
    dir,
    [{ id: "citations", kind: "citation", expect: "every cited path exists" }],
    { cited: "fixed the bug in deep/nested/index.ts", prose: "" },
  );
  const citation = result.checks.find((check) => check.id === "citations");
  assert.equal(citation?.result, "pass");
  assert.equal(result.passed, true);
});

test("an ambiguous suffix (matches two files) is not resolved, and fails a formal citation", () => {
  const dir = citationFixture();
  const result = verifyRun(
    dir,
    "run-ambiguous-suffix",
    dir,
    [{ id: "citations", kind: "citation", expect: "every cited path exists" }],
    { cited: "changed onedir/dup.ts", prose: "" },
  );
  const citation = result.checks.find((check) => check.id === "citations");
  assert.equal(citation?.result, "fail");
  assert.equal(result.passed, false);
});

test("a formally cited path that resolves nowhere still fails the check", () => {
  const dir = citationFixture();
  const result = verifyRun(
    dir,
    "run-invented",
    dir,
    [{ id: "citations", kind: "citation", expect: "every cited path exists" }],
    { cited: "added mcp/delegation/does-not-exist.ts", prose: "" },
  );
  const citation = result.checks.find((check) => check.id === "citations");
  assert.equal(citation?.result, "fail");
  assert.equal(existsSync(join(dir, "mcp", "delegation", "does-not-exist.ts")), false);
});

test("an unresolvable path mentioned only in prose warns, and never fails the check", () => {
  const dir = citationFixture();
  const result = verifyRun(
    dir,
    "run-prose-only",
    dir,
    [{ id: "citations", kind: "citation", expect: "every cited path exists" }],
    { cited: "work delivered", prose: "not sure this matters, but dist/x.js and shell/app may need a follow-up" },
  );
  const citation = result.checks.find((check) => check.id === "citations");
  assert.equal(citation?.result, "pass");
  assert.equal(result.passed, true);
  assert.ok(citation?.warnings?.some((warning) => warning.includes("dist/x.js")));
  assert.ok(citation?.warnings?.some((warning) => warning.includes("shell/app")));
});

test("an ambiguous suffix mentioned only in prose also warns, never fails", () => {
  const dir = citationFixture();
  const result = verifyRun(
    dir,
    "run-prose-ambiguous",
    dir,
    [{ id: "citations", kind: "citation", expect: "every cited path exists" }],
    { cited: "work delivered", prose: "might also touch onedir/dup.ts later" },
  );
  const citation = result.checks.find((check) => check.id === "citations");
  assert.equal(citation?.result, "pass");
  assert.ok(citation?.warnings?.some((warning) => warning.includes("onedir/dup.ts")));
});

// --- kage reverify: failed/ready -> verifying -> ready/failed, no agent re-run ---------

test("reverify moves a failed run to ready once the worktree now passes, and stamps reverified_at", async () => {
  const project = reverifiableProject("fail");
  const { task } = await dispatchRun(project, { intent: "fix the flag check", type: "bugfix" }, stubAdapter());
  assert.equal(task.state, "failed");
  const original = readClaim(project, task.id);
  assert.equal(original?.reverified_at, undefined);

  // The defect gets fixed directly in the run's worktree — no agent turn, exactly what
  // `kage open <run-id>` + a manual edit would produce.
  writeFileSync(join(worktreePath(project, task.id), "flag.txt"), "pass\n", "utf8");

  const result = reverifyRun(project, task.id);
  assert.equal(result.ok, true);
  assert.equal(result.passed, true);
  assert.equal(result.state, "ready");

  const after = readRun(project, task.id);
  assert.equal(after.state, "ready");

  const claim = readClaim(project, task.id);
  assert.ok(claim?.reverified_at, "claim must record when it was reverified");
  assert.equal(claim?.checks.find((check) => check.id === "tests")?.result, "pass");
  // The claim's own words are untouched — only verdicts and state moved.
  assert.equal(claim?.statement, original?.statement);

  const card = renderClaimCard(claim!, { budget: 400 });
  assert.match(card, /reverified/i);
});

test("reverify leaves a run failed when the worktree still does not pass", async () => {
  const project = reverifiableProject("fail");
  const { task } = await dispatchRun(project, { intent: "still broken", type: "bugfix" }, stubAdapter());
  assert.equal(task.state, "failed");

  const result = reverifyRun(project, task.id);
  assert.equal(result.ok, true);
  assert.equal(result.passed, false);
  assert.equal(result.state, "failed");
  assert.equal(readRun(project, task.id).state, "failed");
  assert.ok(readClaim(project, task.id)?.reverified_at);
});

test("reverify is refused on a merged run", async () => {
  const project = reverifiableProject("pass");
  const { task } = await dispatchRun(project, { intent: "clean work", type: "chore" }, stubAdapter());
  assert.equal(task.state, "ready");
  const merge = mergeRun(project, task.id);
  assert.equal(merge.ok, true);
  assert.equal(readRun(project, task.id).state, "merged");

  const result = reverifyRun(project, task.id);
  assert.equal(result.ok, false);
  assert.equal(result.state, "merged");
  assert.match(result.message, /merged/i);
  // Refusing must not disturb the terminal state.
  assert.equal(readRun(project, task.id).state, "merged");
});
