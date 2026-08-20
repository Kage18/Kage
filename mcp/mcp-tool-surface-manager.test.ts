// The review gate: kage_review_run gives the manager a place to record a structured
// verdict on a "ready" run — kernel-verified is not the same guarantee as
// human-reviewed. This file drives the whole surface the way the manager does: through
// callTool(name, args) for the tool itself, MANAGER_ALLOWED_TOOLS for the permission
// grant, MANAGER_CONSTITUTION for the instruction to use it, and the room-supervisor
// wake bridge for how a review verdict reaches a held manager session.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRun, readClaim, transitionRun, writeClaim } from "./delegation/contract.js";
import { readReview } from "./delegation/manager.js";
import { MANAGER_ALLOWED_TOOLS } from "./delegation/manager-client.js";
import { MANAGER_CONSTITUTION } from "./delegation/manager-prompt.js";
import { REVIEWED_EVENT_STATE, drainPendingGoalEvents, notifyManagerOfRunEvent } from "./delegation/room-supervisor.js";
import { attachRunToGoal, createGoal, readGoal } from "./delegation/goal.js";
import { setActiveGoal } from "./delegation/room-sessions.js";
import { callTool, listTools } from "./index.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-review-gate-"));
}

/** Drive a freshly created run to "ready" through the kernel's own legal chain — never
 * hand-write a run record. Mirrors manager-orchestration.test.ts's settleRun. */
function settleToReady(project: string, runId: string): void {
  transitionRun(project, runId, "briefed", "kernel");
  transitionRun(project, runId, "dispatched", "kernel");
  transitionRun(project, runId, "running", "kernel");
  transitionRun(project, runId, "verifying", "kernel");
  transitionRun(project, runId, "ready", "kernel");
}

function fixtureClaim(runId: string) {
  return {
    schema_version: 1 as const,
    run_id: runId,
    statement: "did the thing",
    checks: [],
    unsure: [],
    learnings: [],
    protocol_ok: true,
    diff: { files: 1, lines: 10 },
    created_at: new Date().toISOString(),
  };
}

// --- MCP tool surface: kage_review_run is listed and permitted ----------------------

test("kage_review_run is on the delegation tool surface and pre-approved for the manager", async () => {
  const prevRoom = process.env.KAGE_ROOM;
  process.env.KAGE_ROOM = "1";
  try {
    const tools = listTools().map((tool) => tool.name);
    assert.ok(tools.includes("kage_review_run"), "kage_review_run must be listed under KAGE_ROOM=1");
  } finally {
    if (prevRoom === undefined) delete process.env.KAGE_ROOM;
    else process.env.KAGE_ROOM = prevRoom;
  }
  assert.ok(
    MANAGER_ALLOWED_TOOLS.includes("mcp__kage__kage_review_run"),
    "a manager that cannot call kage_review_run cannot pass the review gate at all",
  );
});

// --- The review gate is written into the constitution the manager actually runs on ---

test("the constitution instructs the manager to review before it recommends or performs a merge", () => {
  assert.match(MANAGER_CONSTITUTION, /kage_review_run/);
  assert.match(MANAGER_CONSTITUTION, /request_changes/);
  assert.match(MANAGER_CONSTITUTION, /## The review gate/);
  // The existing "ready" merge-recommendation rule must now route through review first,
  // not sit unchanged beside a gate the manager never has to touch.
  assert.match(MANAGER_CONSTITUTION, /call kage_review_run first[\s\S]*RECOMMEND the merge/);
});

// --- kage_review_run: refusals ------------------------------------------------------

test("kage_review_run refuses a run that is not ready", async () => {
  const project = tempProject();
  const run = createRun(project, { intent: "still cooking", type: "chore", agent: "stub" });
  const reply = await callTool("kage_review_run", { project_dir: project, run_id: run.id, verdict: "approve" });
  const body = (reply.content[0] as { text: string }).text;
  assert.match(body, /not ready/);
  assert.equal(readReview(project, run.id), null);
});

test("kage_review_run refuses an unknown verdict", async () => {
  const project = tempProject();
  const run = createRun(project, { intent: "bad verdict", type: "chore", agent: "stub" });
  settleToReady(project, run.id);
  writeClaim(project, run.id, fixtureClaim(run.id));
  const reply = await callTool("kage_review_run", { project_dir: project, run_id: run.id, verdict: "lgtm" });
  assert.match((reply.content[0] as { text: string }).text, /needs verdict "approve" or "request_changes"/);
});

test("kage_review_run refuses request_changes with no notes — a verdict with no reason is not a review", async () => {
  const project = tempProject();
  const run = createRun(project, { intent: "needs a reason", type: "chore", agent: "stub" });
  settleToReady(project, run.id);
  writeClaim(project, run.id, fixtureClaim(run.id));
  const reply = await callTool("kage_review_run", { project_dir: project, run_id: run.id, verdict: "request_changes" });
  assert.match((reply.content[0] as { text: string }).text, /needs notes/);
  assert.equal(readReview(project, run.id), null);
});

test("kage_review_run refuses a run with no claim to review", async () => {
  const project = tempProject();
  const run = createRun(project, { intent: "no claim yet", type: "chore", agent: "stub" });
  settleToReady(project, run.id);
  assert.equal(readClaim(project, run.id), null);
  const reply = await callTool("kage_review_run", { project_dir: project, run_id: run.id, verdict: "approve" });
  assert.match((reply.content[0] as { text: string }).text, /has no claim to review/);
});

// --- kage_review_run: recording a verdict -------------------------------------------

test("kage_review_run records an approve verdict, readable back from the run", async () => {
  const project = tempProject();
  const run = createRun(project, { intent: "looks fine", type: "chore", agent: "stub" });
  settleToReady(project, run.id);
  writeClaim(project, run.id, fixtureClaim(run.id));

  const reply = await callTool("kage_review_run", { project_dir: project, run_id: run.id, verdict: "approve" });
  const body = (reply.content[0] as { text: string }).text;
  assert.match(body, /verdict: approve/);

  const review = readReview(project, run.id);
  assert.equal(review?.verdict, "approve");
  assert.equal(review?.run_id, run.id);
});

test("kage_review_run records a request_changes verdict with its notes", async () => {
  const project = tempProject();
  const run = createRun(project, { intent: "needs another pass", type: "chore", agent: "stub" });
  settleToReady(project, run.id);
  writeClaim(project, run.id, fixtureClaim(run.id));

  await callTool("kage_review_run", {
    project_dir: project,
    run_id: run.id,
    verdict: "request_changes",
    notes: "the retry loop has no backoff",
  });
  const review = readReview(project, run.id);
  assert.equal(review?.verdict, "request_changes");
  assert.equal(review?.notes, "the retry loop has no backoff");
});

// --- room-supervisor wake bridge: the new "reviewed" event ---------------------------
// notifyManagerOfRunEvent/drainPendingGoalEvents already wake on ANY kernel state
// change; a review verdict is not a kernel RunState (the run stays "ready" throughout),
// so it rides the same bridge under a synthetic state. These tests would fail if that
// state's wording collapsed back to the generic "is now reviewed" phrasing, which reads
// as a kernel fact the review gate never asserts.

test("notifyManagerOfRunEvent phrases a review verdict distinctly from a kernel state change", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "ship the reviewer role", plan: [[{ intent: "part one", type: "chore", files_scope: [] }]] });
  const run = createRun(project, { intent: "part one", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal.id, run.id);

  const sent: string[] = [];
  const deps = {
    isLiveFn: async () => true,
    sendFrameFn: async (_p: string, message: string) => {
      sent.push(message);
      return true;
    },
  };

  const delivered = await notifyManagerOfRunEvent(
    project,
    run.id,
    { state: REVIEWED_EVENT_STATE, detail: "approve: looks good" },
    undefined,
    deps,
  );
  assert.equal(delivered, true);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /review verdict: approve: looks good/);
  assert.doesNotMatch(sent[0], /is now reviewed/);
});

test("a review verdict for one run never gets pulled into another run's rate-limit window", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "two runs", plan: [[{ intent: "part one", type: "chore", files_scope: [] }, { intent: "part two", type: "chore", files_scope: [] }]] });
  const runA = createRun(project, { intent: "part one", type: "chore", agent: "stub" });
  const runB = createRun(project, { intent: "part two", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal.id, runA.id);
  attachRunToGoal(project, goal.id, runB.id);

  const sent: string[] = [];
  const deps = {
    isLiveFn: async () => true,
    sendFrameFn: async (_p: string, message: string) => {
      sent.push(message);
      return true;
    },
  };

  await notifyManagerOfRunEvent(project, runA.id, { state: "ready" }, undefined, deps);
  const delivered = await notifyManagerOfRunEvent(project, runB.id, { state: REVIEWED_EVENT_STATE, detail: "approve" }, undefined, deps);
  assert.equal(delivered, true, "runB's review event must not be rate-limited by runA's recent wake");
  assert.equal(sent.length, 2);
  assert.match(sent[1], new RegExp(`run ${runB.id} .*review verdict: approve`));
});

test("drainPendingGoalEvents coalesces a review verdict with the same review-verdict wording as the live wake", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "batched review", plan: [[{ intent: "part one", type: "chore", files_scope: [] }]] });
  const run = createRun(project, { intent: "part one", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal.id, run.id);
  setActiveGoal(project, "main", goal.id);

  const sent: string[] = [];
  const deps = {
    isLiveFn: async () => false, // busy/dead at the moment the event happens — it must queue
    sendFrameFn: async (_p: string, message: string) => {
      sent.push(message);
      return true;
    },
  };
  await notifyManagerOfRunEvent(project, run.id, { state: REVIEWED_EVENT_STATE, detail: "request_changes: fix the retry loop" }, undefined, deps);
  assert.equal(sent.length, 0, "nothing delivered while the session looked dead — it must still be pending");

  const drained = await drainPendingGoalEvents(project, "main", { ...deps, isLiveFn: async () => true });
  assert.equal(drained, true);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /run .* review verdict: request_changes: fix the retry loop/);

  const persisted = readGoal(project, goal.id);
  assert.ok(persisted.id);
});
