// Kernel contract for the opt-in review gate: new run states (reviewing / approved /
// changes_requested), reviewRun's agent-executed verdict, and mergeRun's opt-in refusal.
// A separate file per the brief — delegation.test.ts is a same-day merge-conflict
// hotspot several runs already collide in.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AdapterOutcome } from "./delegation/adapters/types.js";
import { createRun, patchRun, readRun, transitionRun } from "./delegation/contract.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { dispatchRun } from "./delegation/dispatch.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { mergeRun } from "./delegation/ratify.js";
import { readAgentReview, reviewRun } from "./delegation/review.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-review-contract-"));
}

// Same fixture shape as delegation.test.ts's tempGitProject — duplicated rather than
// imported, since importing across test files is not how this suite is organized and
// delegation.test.ts is off-limits to touch for this run.
function tempGitProject(): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  writeDelegationConfig(project, { test: "true" });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

// A reviewer whose entire "run" is returning a canned final message — no filesystem
// activity, same role a fixture playback plays in dispatch-side tests, exercised here
// against reviewRun instead of executeRun.
function fixtureReviewer(finalMessage: string): Adapter {
  return {
    name: "fixture-reviewer",
    async run(): Promise<AdapterOutcome> {
      return { exit_code: 0, final_message: finalMessage };
    },
  };
}

const APPROVED_FENCE = ["Looks correct.", "", "```kage-review", JSON.stringify({ verdict: "approved", findings: [] }), "```"].join("\n");

const CHANGES_REQUESTED_FENCE = [
  "Not yet.",
  "",
  "```kage-review",
  JSON.stringify({ verdict: "changes_requested", findings: ["the new check has no negative-path test"] }),
  "```",
].join("\n");

async function readyRun(project: string, intent: string) {
  const { task } = await dispatchRun(
    project,
    { intent, type: "chore" },
    stubAdapter({ editFile: { path: `src/${intent.replace(/\s+/g, "-")}.ts`, content: "export const ok = true;\n" } }),
  );
  assert.equal(task.state, "ready", "fixture run must reach ready before a review-gate test can use it");
  return task;
}

test("reviewing is legal only under review_required; the default ready->merged path is untouched", async () => {
  const project = tempGitProject();
  const task = await readyRun(project, "default path stays ready to merged");
  assert.equal(task.review_required, undefined);

  // The opt-in state is structurally reachable from "ready" (LEGAL_TRANSITIONS), but the
  // policy gate refuses it for a run that never asked for review — this would revert
  // silently to "always allowed" if assertReviewOptIn were ever removed from transitionRun.
  assert.throws(() => transitionRun(project, task.id, "reviewing", "kernel"), /has not opted into review/);

  // Merging a run that never set review_required is byte-for-byte the old behavior:
  // state "ready" is sufficient, exactly as before this change existed.
  const merged = mergeRun(project, task.id);
  assert.equal(merged.ok, true);
  assert.equal(merged.merged, true);
  assert.equal(readRun(project, task.id).state, "merged");
});

test("review_required flips the gate on: reviewing becomes legal, and reviewRun drives ready -> reviewing -> approved", async () => {
  const project = tempGitProject();
  const task = await readyRun(project, "review required approve path");
  patchRun(project, task.id, { review_required: true });

  const result = await reviewRun(project, task.id, fixtureReviewer(APPROVED_FENCE));
  assert.equal(result.ok, true);
  assert.equal(result.review?.verdict, "approved");
  assert.equal(result.review?.protocol_ok, true);
  assert.equal(result.task?.state, "approved");

  const stored = readAgentReview(project, task.id);
  assert.equal(stored?.verdict, "approved");

  // approved (not ready) is what mergeRun now requires for a review_required run.
  const merged = mergeRun(project, task.id);
  assert.equal(merged.ok, true);
  assert.equal(readRun(project, task.id).state, "merged");
});

test("a changes_requested verdict blocks merge until resolved, and the fixture fence is what drove it", async () => {
  const project = tempGitProject();
  const task = await readyRun(project, "review required changes requested path");
  patchRun(project, task.id, { review_required: true });

  const result = await reviewRun(project, task.id, fixtureReviewer(CHANGES_REQUESTED_FENCE));
  assert.equal(result.ok, true);
  assert.equal(result.review?.verdict, "changes_requested");
  assert.deepEqual(result.review?.findings, ["the new check has no negative-path test"]);
  assert.equal(result.task?.state, "changes_requested");

  // merge refuses an unapproved review_required run — this is the assertion that would
  // fail if this test's changes ever got reverted back to the old unconditional "ready"
  // check on mergeRun.
  const refused = mergeRun(project, task.id);
  assert.equal(refused.ok, false);
  assert.match(refused.message, /not approved/);
  assert.match(refused.message, /requires review/);

  // changes_requested resumes back to running via the same transition running already
  // uses from blocked/stopped/failed — the kernel-level half of "the existing resume
  // machinery"; steer.ts's own resumability check recognizing this state is a separate
  // follow-up (see the claim's `unsure` notes).
  const resumed = transitionRun(project, task.id, "running", "kernel", "steered after changes_requested");
  assert.equal(resumed.state, "running");
});

test("a malformed kage-review fence degrades to changes_requested with protocol_ok:false, never a crash", async () => {
  const project = tempGitProject();
  const task = await readyRun(project, "malformed fence path");
  patchRun(project, task.id, { review_required: true });

  const noFence = await reviewRun(project, task.id, fixtureReviewer("I looked at it. Seems fine, no notes."));
  assert.equal(noFence.ok, true);
  assert.equal(noFence.review?.protocol_ok, false);
  assert.equal(noFence.review?.verdict, "changes_requested");
  assert.equal(readRun(project, task.id).state, "changes_requested");
});

test("reviewRun refuses a run that never opted in, and refuses one that is not ready", async () => {
  const project = tempGitProject();
  const task = await readyRun(project, "not opted in");

  const notRequired = await reviewRun(project, task.id, fixtureReviewer(APPROVED_FENCE));
  assert.equal(notRequired.ok, false);
  assert.match(notRequired.message, /does not require review/);
  // No state change, no review record written on refusal.
  assert.equal(readRun(project, task.id).state, "ready");

  patchRun(project, task.id, { review_required: true });
  transitionRun(project, task.id, "reviewing", "kernel");
  transitionRun(project, task.id, "approved", "kernel");

  const notReady = await reviewRun(project, task.id, fixtureReviewer(APPROVED_FENCE));
  assert.equal(notReady.ok, false);
  assert.match(notReady.message, /not ready/);
});

test("a bare run created with createRun defaults review_required to unset, matching every run before this field existed", () => {
  const project = tempProject();
  const task = createRun(project, { intent: "plain run", type: "chore", agent: "stub" });
  assert.equal(task.review_required, undefined);
});
