// Regression tests for three meter/guard integrity defects, each a check or meter that
// reported in the reassuring direction when its measurement window was wrong:
//
//   1. reverify's diff-size check read only the worktree's UNCOMMITTED changes, so a run
//      committed at claim time (worktree.ts's commitWorktree) reverified as "0 file(s),
//      0 changed line(s)" no matter how large its real, committed diff was. Fixed by
//      verify.ts's measureDiff, which compares merge-base..HEAD-plus-working-tree instead
//      of just the index.
//   2. recordSpend overwrote a run's spend with the agent CLI's latest report, and a
//      resumed run starts a FRESH agent session whose own cumulative usage starts at
//      zero — so resuming could make total spend go DOWN. Fixed by contract.ts's
//      recordSpend sealing each session's own report in a per-session ledger and summing
//      across sessions, never across ticks of the same session (which the CLI already
//      reports cumulatively).
//   3. The worktree-boundary guard flagged on drift alone, so an operator's own
//      unrelated rebuild of mcp/dist read exactly like a real leak. Fixed by
//      worktree-guard.ts attributing by CONTENT: only flagging when the changed build
//      output actually contains distinctive tokens traceable to the run's own worktree
//      source.
//
// Its own file per this repo's rule — new behaviour gets a new test file, and
// mcp/delegation.test.ts is a known append-collision hotspot.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRun, readClaim, readRun } from "./delegation/contract.js";
import { recordSpend } from "./delegation/contract.js";
import { dispatchRun } from "./delegation/dispatch.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { reverifyRun } from "./delegation/ratify.js";
import { verifyRun } from "./delegation/verify.js";
import { worktreePath } from "./delegation/worktree.js";
import { detectWorktreeEscape, snapshotGuardedPaths } from "./delegation/worktree-guard.js";
import { writeDelegationConfig } from "./delegation/config.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-meter-integrity-"));
}

function tempGitProject(): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

// --- 1. diff-size: committed work must still count -------------------------------------

// FAILS ON REVERT: without measureDiff, reverify's diff-size check re-reads only the
// worktree's uncommitted changes (git.ts's old stageAndMeasure) — a clean, fully committed
// worktree measures as 0 files / 0 lines, and this assertion on the real ~50-line change
// fails.
test("reverify's diff-size check counts a fully committed worktree's real change, not zero", async () => {
  const project = tempGitProject();
  const content = `${Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n")}\n`;
  const { task } = await dispatchRun(
    project,
    { intent: "add fifty lines", type: "chore" },
    stubAdapter({ editFile: { path: "big-change.ts", content } }),
  );
  assert.equal(task.state, "ready");

  // Confirm the run's work is genuinely committed — exactly the state that made the old
  // check pass vacuously: `git status` on the worktree is clean.
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: worktreePath(project, task.id), encoding: "utf8" });
  assert.equal(status.trim(), "", "the run's work must already be committed onto its branch, like a real claim-time commit");

  const result = reverifyRun(project, task.id);
  assert.equal(result.ok, true);
  assert.equal(result.passed, true);

  const claim = readClaim(project, task.id);
  const diffCheck = claim?.checks.find((check) => check.id === "diff-size");
  assert.ok(diffCheck, "diff-size must still be one of the reverified checks");
  assert.equal(diffCheck?.result, "pass");
  assert.equal(claim?.diff.files, 1);
  assert.ok((claim?.diff.lines ?? 0) >= 50, `expected the real ~50-line committed change to be counted, got ${claim?.diff.lines}`);
});

// FAILS ON REVERT: the old stageAndMeasure only ever measured `git diff --cached`
// (uncommitted work), so the committed file's 10 lines would be invisible and this
// assertion (which requires BOTH files and >=15 total lines) fails.
test("diff measurement counts committed AND uncommitted changes together, not just one", () => {
  const project = tempGitProject();
  const worktree = join(project, "wt");
  execFileSync("git", ["worktree", "add", "-b", "kage/run-mixed", worktree, "HEAD"], { cwd: project, stdio: "ignore", env: GIT_ENV });

  // A committed change on the run's own branch.
  writeFileSync(join(worktree, "committed.ts"), `${Array.from({ length: 10 }, (_, i) => `c${i}`).join("\n")}\n`, "utf8");
  execFileSync("git", ["add", "-A"], { cwd: worktree, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "wip"], { cwd: worktree, stdio: "ignore", env: GIT_ENV });

  // Then a further, never-committed change on top.
  writeFileSync(join(worktree, "uncommitted.ts"), `${Array.from({ length: 5 }, (_, i) => `u${i}`).join("\n")}\n`, "utf8");

  const result = verifyRun(
    project,
    "run-mixed",
    worktree,
    [{ id: "diff-size", kind: "diff", expect: "at most 400 changed lines" }],
    { cited: "work delivered", prose: "" },
  );
  assert.equal(result.diff.files, 2, "both the committed and the uncommitted file must be counted");
  assert.ok(result.diff.lines >= 15, `expected at least 15 lines (10 committed + 5 uncommitted), got ${result.diff.lines}`);
  assert.deepEqual([...result.diff.paths].sort(), ["committed.ts", "uncommitted.ts"]);
});

// --- 2. spend: resuming must never make total spend go down ----------------------------

// FAILS ON REVERT: the old recordSpend overwrote `spend` with whatever `usage` it was
// last handed — recording session B's $2.95 after session A's $30.96 would leave total
// spend at $2.95, not $33.91, and this assertion fails.
test("recordSpend accumulates across a resumed session instead of resetting", () => {
  const project = tempProject();
  const { id: runId } = createRun(project, { intent: "spend across resume", type: "chore", agent: "stub" });

  // Session A works, stops having spent $30.96.
  recordSpend(project, runId, { usd: 30.96, tokens: 12_000 }, "session-A");
  assert.equal(readRun(project, runId).spend.usd_est, 30.96);

  // Resume starts a FRESH agent session (new session id) whose own usage report starts
  // low — the exact shape observed live: $30.96 before a stop read as $2.95 after resuming.
  recordSpend(project, runId, { usd: 2.95, tokens: 900 }, "session-B");
  const afterResume = readRun(project, runId);
  assert.equal(afterResume.spend.usd_est, 33.91, "total spend must be prior + new, never just the new session's figure");

  // The SAME session ticking again (the CLI reports cumulative-per-session on every
  // tick) must REPLACE its own entry, not add another $2.95 on top of it.
  recordSpend(project, runId, { usd: 4.1, tokens: 1_500 }, "session-B");
  assert.equal(readRun(project, runId).spend.usd_est, 30.96 + 4.1, "a repeated report for the SAME session must replace, not add to, its own prior report");
});

// --- 3. worktree-boundary: attribute by content, not drift ------------------------------

// A project with a real `mcp/dist` directory and a real `git worktree add` checkout —
// content attribution needs genuine branch history to diff the run's own source against.
function projectWithRealWorktree(runId: string): { project: string; worktree: string } {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  mkdirSync(join(project, "mcp", "dist"), { recursive: true });
  writeFileSync(join(project, "mcp", "dist", "cli.js"), "// compiled v1\n", "utf8");
  writeDelegationConfig(project, { test: "true" });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  const worktree = join(project, "wt");
  execFileSync("git", ["worktree", "add", "-b", `kage/${runId}`, worktree, "HEAD"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return { project, worktree };
}

// FAILS ON REVERT: the old drift-only guard flags ANY change under mcp/dist regardless of
// content, so this operator rebuild (unrelated to the run) would be reported as an
// escape — this asserts it is NOT.
test("worktree-boundary does not flag an operator's own rebuild of unrelated code", () => {
  const { project, worktree } = projectWithRealWorktree("run-rebuild");
  // The run's own worktree makes a real, but unrelated (non-distinctive), change.
  writeFileSync(join(worktree, "feature.ts"), "export const ownChange = 1;\n", "utf8");
  const before = snapshotGuardedPaths(project, worktree);

  // The OPERATOR rebuilds the main checkout's dist from ITS OWN committed source (e.g. a
  // post-merge `npm run build`) — real drift, with nothing to do with this run at all.
  // Reproduced live on run m1-of-the-memory-store-build-the-storeba-260820-3ff8: mcp/dist
  // changed from a merge the run never touched, and the old guard flagged it anyway.
  execFileSync("sleep", ["0.05"]);
  writeFileSync(join(project, "mcp", "dist", "cli.js"), "// recompiled by the operator, unrelated to this run\n", "utf8");

  const finding = detectWorktreeEscape(project, "run-rebuild", worktree, before);
  assert.equal(finding, null, "drift with no content traceable to the run's own worktree must never be reported as an escape");
});

// FAILS ON REVERT: this only tests that content attribution CAN flag a real leak — a
// revert doesn't break this one on its own (the old code already flagged drift), but it
// is kept alongside the not-flagged case above as the required pair: together they prove
// the new check discriminates on content, not merely drift.
test("worktree-boundary flags when the main checkout's build output actually contains this run's own code", () => {
  const { project, worktree } = projectWithRealWorktree("run-leak");
  writeFileSync(
    join(worktree, "feature.ts"),
    "export function totallyDistinctiveLeakMarkerFn() {\n  return anotherUniqueMarkerToken;\n}\n",
    "utf8",
  );
  const before = snapshotGuardedPaths(project, worktree);

  execFileSync("sleep", ["0.05"]);
  writeFileSync(
    join(project, "mcp", "dist", "leaked.js"),
    "function totallyDistinctiveLeakMarkerFn(){return anotherUniqueMarkerToken}\n",
    "utf8",
  );

  const finding = detectWorktreeEscape(project, "run-leak", worktree, before);
  assert.ok(finding, "content traceable to this run's own worktree source must be flagged");
  assert.equal(finding!.result, "fail");
  assert.equal(finding!.id, "worktree-boundary");
});
