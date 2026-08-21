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

// A project with a real `mcp/dist` directory — the exact protected path — plus a real
// `git worktree add` checkout of its own branch. A real worktree (not a bare
// subdirectory) is what content-based attribution needs: it diffs the worktree's branch
// against the project's own branch to find the run's own changed source, so the fixture
// has to have real branch history for that to mean anything.
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
  execFileSync("git", ["worktree", "add", "-b", "kage/run-1", worktree, "HEAD"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  writeFileSync(join(worktree, "src.ts"), "export const x = 1;\n", "utf8");
  return { project, worktree };
}

test("guardedPaths: empty for a sandboxed run (worktree IS project), names the project's own mcp/dist otherwise", () => {
  const project = tempProject();
  assert.deepEqual(guardedPaths(project, project), [], "nothing to escape into when there is no separate worktree");
  const { project: p2, worktree } = projectWithDistAndWorktree();
  assert.deepEqual(guardedPaths(p2, worktree), [join(p2, "mcp", "dist")]);
});

test("detectWorktreeEscape is silent when nothing changed, and fails loudly when the escape actually carries this run's own code", () => {
  const { project, worktree } = projectWithDistAndWorktree();
  const before = snapshotGuardedPaths(project, worktree);
  assert.equal(detectWorktreeEscape(project, "run-1", worktree, before), null, "an untouched dist must never be reported as an escape");

  // The run's own worktree writes distinctive symbols nowhere in the project's committed
  // source — the markers content-attribution has to find.
  writeFileSync(
    join(worktree, "feature.ts"),
    "export function totallyDistinctiveLeakMarkerFn() {\n  return anotherUniqueMarkerToken;\n}\n",
    "utf8",
  );

  // The exact shape of the real incident: something wrote into (and, separately,
  // overwrote a file already in) the PROJECT's dist while a DIFFERENT worktree was
  // supposedly being verified — and this time the leaked content actually IS this run's
  // own code, not just coincidental drift.
  writeFileSync(
    join(project, "mcp", "dist", "unreviewed.js"),
    "function totallyDistinctiveLeakMarkerFn(){return anotherUniqueMarkerToken}\n",
    "utf8",
  );
  execFileSync("sleep", ["0.05"]); // mtime resolution can be coarse on some filesystems
  writeFileSync(
    join(project, "mcp", "dist", "cli.js"),
    "// recompiled with unreviewed changes: totallyDistinctiveLeakMarkerFn / anotherUniqueMarkerToken\n",
    "utf8",
  );

  const finding = detectWorktreeEscape(project, "run-1", worktree, before);
  assert.ok(finding, "an escape carrying this run's own code must never pass silently");
  assert.equal(finding!.result, "fail");
  assert.equal(finding!.id, "worktree-boundary");
  const log = readFileSync(join(project, finding!.evidence!), "utf8");
  assert.match(log, /unreviewed\.js/, "a brand-new file must be named");
  assert.match(log, /cli\.js/, "an overwritten existing file must be named too, not just additions");
  assert.match(log, /totallyDistinctiveLeakMarkerFn/, "the traceable marker itself must be named in the evidence");
});

// --- integration: the escape check rides inside the real check pipeline ------------

test("runAllChecks reports the run as NOT passed when its own declared check leaks the run's own code outside its worktree", () => {
  const { project, worktree } = projectWithDistAndWorktree();
  writeFileSync(
    join(worktree, "feature.ts"),
    "export function totallyDistinctiveLeakMarkerFn() {\n  return anotherUniqueMarkerToken;\n}\n",
    "utf8",
  );
  // A declared check whose command reaches OUTSIDE its cwd via an absolute path — the
  // exact mechanism this run's own operator found: a relative --prefix/path argument
  // that resolves against the wrong directory (or, as reproduced here, an explicit one) —
  // and writes this run's own distinctive code there, not just arbitrary bytes.
  const escapingCmd =
    `node -e "require('fs').writeFileSync('${join(project, "mcp", "dist", "sneaked-in.js")}', ` +
    `'function totallyDistinctiveLeakMarkerFn(){return anotherUniqueMarkerToken}')"`;

  const result = runAllChecks(
    project,
    "run-escape",
    worktree,
    [{ id: "tests", kind: "command", cmd: escapingCmd, expect: "exit code 0" }],
    { cited: "work delivered", prose: "" },
  );

  assert.equal(result.passed, false, "a run whose check leaked its own code outside its worktree must never read as passed");
  const boundary = result.checks.find((check) => check.id === "worktree-boundary");
  assert.ok(boundary, "the escape must surface as its own named check, not a silent failure elsewhere");
  assert.equal(boundary!.result, "fail");
});

test("runAllChecks does NOT flag drift in the project's dist that carries none of the run's own code", () => {
  const { project, worktree } = projectWithDistAndWorktree();
  // A declared check that touches the project's OWN dist, but with content that has
  // nothing to do with the run's worktree — the operator-rebuild shape: real drift, zero
  // traceable content. Must never be confused with an actual leak.
  const rebuildCmd = `node -e "require('fs').writeFileSync('${join(project, "mcp", "dist", "cli.js")}', '// rebuilt from main only')"`;

  const result = runAllChecks(
    project,
    "run-rebuild",
    worktree,
    [{ id: "tests", kind: "command", cmd: rebuildCmd, expect: "exit code 0" }],
    { cited: "work delivered", prose: "" },
  );

  assert.equal(result.checks.some((check) => check.id === "worktree-boundary"), false, "drift with no traceable content must not be reported as an escape");
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
