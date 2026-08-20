// Adapters + dispatch/supervisor wiring for the reviewer role: reviewer-mode adapter
// argv builders (reusing claude/codex), scripted stub reviewer behavior for tests, and
// dispatchReviewer wired automatically via contract.ts's onRunTransition hook. A separate
// file per the repo's test-placement rule — delegation.test.ts is a same-day merge-conflict
// hotspot several runs collide in.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AGENT_ALLOWED_TOOLS,
  claudeOneShotArgs,
  claudeReviewerArgs,
  codexArgs,
  codexReviewerArgs,
  REVIEWER_ALLOWED_TOOLS,
  reviewerAdapterByName,
} from "./delegation/adapters/index.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { buildClaim, createRun, parseReviewFence, patchRun, readRun, transitionRun, writeClaim } from "./delegation/contract.js";
import { dispatchReviewer, maybeDispatchReviewer } from "./delegation/dispatch.js";
import { readAgentReview } from "./delegation/review.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempGitProject(): string {
  const project = mkdtempSync(join(tmpdir(), "kage-review-wiring-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  writeDelegationConfig(project, { test: "true" });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

/** Walk a run all the way to "ready" with a real claim, without a real worktree/agent —
 * reviewRun only needs a claim and a "ready" state; the diff it reads against a branch
 * that was never actually created just comes back empty, which is fine for these tests. */
function readyReviewRun(project: string, review_required = true) {
  const task = createRun(project, { intent: "reviewer wiring fixture", type: "chore", agent: "stub" });
  if (review_required) patchRun(project, task.id, { review_required: true });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  transitionRun(project, task.id, "verifying", "kernel");
  const claim = buildClaim({
    runId: task.id,
    statement: "fixture work delivered",
    checks: [{ id: "tests", kind: "command", cmd: "true", expect: "exit code 0", result: "pass" }],
    fence: null,
    diff: { files: 1, lines: 1, paths: ["src/retry.ts"] },
  });
  writeClaim(project, task.id, claim);
  return transitionRun(project, task.id, "ready", "kernel");
}

async function waitFor(check: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting for condition");
    await new Promise((r) => setTimeout(r, 50));
  }
}

// ---------------------------------------------------------------------------
// Adapter argv builders

test("claudeReviewerArgs strips Write/Edit and the acceptEdits permission mode a worker gets", () => {
  const workerArgs = claudeOneShotArgs("brief text", {});
  const reviewerArgs = claudeReviewerArgs("brief text", {});

  assert.ok(AGENT_ALLOWED_TOOLS.includes("Write") && AGENT_ALLOWED_TOOLS.includes("Edit"), "sanity: worker tools include Write/Edit");
  assert.ok(!REVIEWER_ALLOWED_TOOLS.includes("Write") && !REVIEWER_ALLOWED_TOOLS.includes("Edit"), "reviewer tools must exclude Write/Edit");

  const toolsIndex = reviewerArgs.indexOf("--allowedTools");
  assert.notEqual(toolsIndex, -1, "reviewer argv must pass --allowedTools");
  assert.equal(reviewerArgs[toolsIndex + 1], REVIEWER_ALLOWED_TOOLS.join(","));
  assert.ok(!reviewerArgs.includes("Write") && !reviewerArgs[toolsIndex + 1].includes("Write"));

  // REVERT CHECK: if claudeReviewerArgs ever started reusing AGENT_ALLOWED_TOOLS instead
  // of its own restricted set, this equality would start passing — it must not.
  assert.notDeepEqual(reviewerArgs, workerArgs);
  assert.ok(!reviewerArgs.includes("--permission-mode"), "a reviewer never accepts edits — nothing to accept");
});

test("codex has no verified read-only review flag, so codexReviewerArgs deliberately reuses codexArgs", () => {
  // Documents the known limitation from adapters/index.ts's own comment rather than
  // silently drifting: if this ever stops being a plain alias, this test should be
  // rewritten to check whatever real restriction replaced it.
  assert.deepEqual(codexReviewerArgs("brief"), codexArgs("brief"));
});

test("reviewerAdapterByName resolves claude/codex/stub, throws on an unknown agent", () => {
  assert.equal(reviewerAdapterByName("claude").name, "claude");
  assert.equal(reviewerAdapterByName("codex").name, "codex");
  assert.equal(reviewerAdapterByName("stub").name, "stub");
  assert.throws(() => reviewerAdapterByName("nonexistent"), /Unknown agent/);
});

// ---------------------------------------------------------------------------
// Scripted stub reviewer behavior

test("stub adapter's review mode emits a parseable kage-review fence and never touches the worktree", async () => {
  const project = tempGitProject();
  const adapter = stubAdapter({ review: { verdict: "changes_requested", findings: ["missing a negative-path test"] } });
  const outcome = await adapter.run({
    runId: "stub-review-fixture",
    workDir: project,
    briefBody: "review this",
    transcriptPath: join(project, ".agent_memory", "runs", "stub-review-fixture", "review-transcript.jsonl"),
  });
  const fence = parseReviewFence(outcome.final_message);
  assert.ok(fence, "stub's review-mode final message must carry a valid kage-review fence");
  assert.equal(fence?.verdict, "changes_requested");
  assert.deepEqual(fence?.findings, ["missing a negative-path test"]);

  // The plain (non-review) stub always writes STUB_NOTE.md by default — the review mode
  // must never do that: a reviewer judges, it does not edit.
  assert.equal(existsSync(join(project, "STUB_NOTE.md")), false, "a scripted reviewer stub must not edit the worktree");
});

test("stub adapter's review mode defaults to an approved verdict with no findings", async () => {
  const adapter = stubAdapter({ review: {} });
  const outcome = await adapter.run({
    runId: "stub-review-default",
    workDir: mkdtempSync(join(tmpdir(), "kage-review-wiring-stub-")),
    briefBody: "review this",
    transcriptPath: join(tmpdir(), "kage-review-wiring-stub-transcript.jsonl"),
  });
  const fence = parseReviewFence(outcome.final_message);
  assert.equal(fence?.verdict, "approved");
  assert.deepEqual(fence?.findings, []);
});

// ---------------------------------------------------------------------------
// dispatchReviewer (in-process, adapterOverride — the same test seam superviseRun offers)

test("dispatchReviewer drives a review_required run from ready to approved via the resolved adapter", async () => {
  const project = tempGitProject();
  const task = readyReviewRun(project);

  const result = await dispatchReviewer(project, task.id, stubAdapter({ review: { verdict: "approved" } }));
  assert.equal(result.ok, true);
  assert.equal(result.task?.state, "approved");
  assert.equal(readAgentReview(project, task.id)?.verdict, "approved");
});

test("dispatchReviewer drives a review_required run from ready to changes_requested via the resolved adapter", async () => {
  const project = tempGitProject();
  const task = readyReviewRun(project);

  const result = await dispatchReviewer(project, task.id, stubAdapter({ review: { verdict: "changes_requested", findings: ["x"] } }));
  assert.equal(result.ok, true);
  assert.equal(result.task?.state, "changes_requested");
  assert.deepEqual(readAgentReview(project, task.id)?.findings, ["x"]);
});

test("dispatchReviewer with no adapterOverride resolves the reviewer adapter by the run's own agent brand", async () => {
  const project = tempGitProject();
  const task = readyReviewRun(project); // agent: "stub" — reviewerAdapterByName("stub") approves by default
  const result = await dispatchReviewer(project, task.id);
  assert.equal(result.ok, true);
  assert.equal(result.task?.state, "approved");
});

// ---------------------------------------------------------------------------
// maybeDispatchReviewer — the onRunTransition hook's gating logic, proven with a spy in
// place of a real detached spawn (mirrors dispatch.ts's own reclaimQueuedRuns test seam).

test("maybeDispatchReviewer only spawns a reviewer for a review_required run reaching ready", () => {
  const project = tempGitProject();
  let spawnCount = 0;
  const spy = (): { pid: number | undefined } => {
    spawnCount += 1;
    return { pid: 1 };
  };

  const requiredTask = createRun(project, { intent: "opted in", type: "chore", agent: "stub" });
  patchRun(project, requiredTask.id, { review_required: true });
  maybeDispatchReviewer(project, requiredTask.id, "ready", spy);
  assert.equal(spawnCount, 1, "a review_required run reaching ready must spawn a reviewer");

  // REVERT CHECK: dropping either half of the gate (the "ready" check, or the
  // review_required check) would make one of these two also fire — both must stay at 0.
  maybeDispatchReviewer(project, requiredTask.id, "running", spy);
  assert.equal(spawnCount, 1, "any state other than ready must never spawn a reviewer");

  const plainTask = createRun(project, { intent: "not opted in", type: "chore", agent: "stub" });
  maybeDispatchReviewer(project, plainTask.id, "ready", spy);
  assert.equal(spawnCount, 1, "a run that never set review_required must never spawn a reviewer, even at ready");
});

// ---------------------------------------------------------------------------
// End-to-end: the real onRunTransition hook, registered at module scope by importing
// dispatch.ts, actually fires a REAL detached child process when a review_required run
// reaches ready through the ordinary transitionRun path — not just when a test calls
// maybeDispatchReviewer directly. This is the test that fails if the hook registration
// itself (the `onRunTransition((projectDir, runId, to) => maybeDispatchReviewer(...))`
// call at the bottom of dispatch.ts) is ever removed or never wired in the first place.
test("REGRESSION: transitioning a review_required run to ready spawns a real detached reviewer that lands a verdict", async () => {
  const project = tempGitProject();
  const task = readyReviewRun(project); // review_required: true, agent: "stub" — the real hook fires here

  await waitFor(() => {
    const state = readRun(project, task.id).state;
    return state === "approved" || state === "changes_requested";
  }, 15_000);

  const finished = readRun(project, task.id);
  assert.equal(finished.state, "approved", "reviewerAdapterByName('stub') approves by default — the real detached review-run must have executed it");
  assert.equal(readAgentReview(project, task.id)?.verdict, "approved");

  const logPath = join(project, ".agent_memory", "runs", task.id, "review-supervisor.log");
  assert.equal(existsSync(logPath), true, "dispatchReviewerDetached must leave its own diagnostic log, mirroring dispatchDetached's supervisor log");
});
