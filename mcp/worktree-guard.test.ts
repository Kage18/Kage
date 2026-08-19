// Tests for mcp/delegation/worktree-guard.ts — detection (not prevention) for a run's
// verification leaving a footprint outside its own worktree, in the project's own build
// output. Reproduced live on this same run: a build command executed against the wrong
// directory overwrote the project's own compiled dist/ with unreviewed code, and nothing
// in the product noticed. Its own file, matching this repo's "new behaviour gets its own
// file" rule.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectWorktreeEscape, guardedPaths, snapshotGuardedPaths } from "./delegation/worktree-guard.js";
import { runAllChecks } from "./delegation/checks.js";
import { writeDelegationConfig } from "./delegation/config.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-worktree-guard-"));
}

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

// A project with a real `mcp/dist` directory — the exact protected path — plus an
// isolated "worktree" subdirectory standing in for a real `git worktree add` checkout,
// so tests never need an actual second checkout to exercise the guard.
function projectWithDistAndWorktree(): { project: string; worktree: string } {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  mkdirSync(join(project, "mcp", "dist"), { recursive: true });
  writeFileSync(join(project, "mcp", "dist", "cli.js"), "// compiled\n", "utf8");
  writeDelegationConfig(project, { test: "true" });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  const worktree = join(project, "isolated-worktree");
  mkdirSync(worktree, { recursive: true });
  writeFileSync(join(worktree, "src.ts"), "export const x = 1;\n", "utf8");
  return { project, worktree };
}

test("guardedPaths: empty for a sandboxed run (worktree IS project), names the project's own mcp/dist otherwise", () => {
  const project = tempProject();
  assert.deepEqual(guardedPaths(project, project), [], "nothing to escape into when there is no separate worktree");
  const { project: p2, worktree } = projectWithDistAndWorktree();
  assert.deepEqual(guardedPaths(p2, worktree), [join(p2, "mcp", "dist")]);
});

test("detectWorktreeEscape is silent when nothing changed, and fails loudly on both a new AND a modified file", () => {
  const { project, worktree } = projectWithDistAndWorktree();
  const before = snapshotGuardedPaths(project, worktree);
  assert.equal(detectWorktreeEscape(project, "run-1", worktree, before), null, "an untouched dist must never be reported as an escape");

  // The exact shape of the real incident: something wrote into (and, separately,
  // overwrote a file already in) the PROJECT's dist while a DIFFERENT worktree was
  // supposedly being verified.
  writeFileSync(join(project, "mcp", "dist", "unreviewed.js"), "// escaped\n", "utf8");
  execFileSync("sleep", ["0.05"]); // mtime resolution can be coarse on some filesystems
  writeFileSync(join(project, "mcp", "dist", "cli.js"), "// recompiled with unreviewed changes\n", "utf8");

  const finding = detectWorktreeEscape(project, "run-1", worktree, before);
  assert.ok(finding, "an escape into the project's own dist must never pass silently");
  assert.equal(finding!.result, "fail");
  assert.equal(finding!.id, "worktree-boundary");
  const log = readFileSync(join(project, finding!.evidence!), "utf8");
  assert.match(log, /unreviewed\.js/, "a brand-new file must be named");
  assert.match(log, /cli\.js/, "an overwritten existing file must be named too, not just additions");
});

// --- integration: the escape check rides inside the real check pipeline ------------

test("runAllChecks reports the run as NOT passed when its own declared check escapes its worktree", () => {
  const { project, worktree } = projectWithDistAndWorktree();
  // A declared check whose command reaches OUTSIDE its cwd via an absolute path — the
  // exact mechanism this run's own operator found: a relative --prefix/path argument
  // that resolves against the wrong directory (or, as reproduced here, an explicit one).
  const escapingCmd = `node -e "require('fs').writeFileSync('${join(project, "mcp", "dist", "sneaked-in.js")}', '// bad')"`;

  const result = runAllChecks(
    project,
    "run-escape",
    worktree,
    [{ id: "tests", kind: "command", cmd: escapingCmd, expect: "exit code 0" }],
    { cited: "work delivered", prose: "" },
  );

  assert.equal(result.passed, false, "a run whose check escaped its worktree must never read as passed");
  const boundary = result.checks.find((check) => check.id === "worktree-boundary");
  assert.ok(boundary, "the escape must surface as its own named check, not a silent failure elsewhere");
  assert.equal(boundary!.result, "fail");
});

test("runAllChecks stays clean (no worktree-boundary entry at all) when nothing escapes", () => {
  const { project, worktree } = projectWithDistAndWorktree();
  const result = runAllChecks(
    project,
    "run-clean",
    worktree,
    [{ id: "tests", kind: "command", cmd: "true", expect: "exit code 0" }],
    { cited: "work delivered", prose: "" },
  );
  assert.equal(result.checks.some((check) => check.id === "worktree-boundary"), false, "a clean run's check list must be unchanged by this guard's existence");
});
