// Every orphaned run over the last two days traced back to the SAME mechanism: the
// concurrency cap was enforced inside transitionRun's briefed→dispatched→running
// bookkeeping, which superviseRun only reaches AFTER it has already created a worktree
// and spawned the agent child. A full slate meant: admit at dispatch, spawn, THEN
// check, then die — killing the supervisor while a live, already-working agent kept
// running unwatched, unbudgeted, and unrecorded. Reproduced live in a real
// supervisor.log: 'supervisor started' -> 'brief compiled' -> 'worktree created and
// persisted' -> 'agent spawned live, pid 87556' -> the ConcurrencyLimitError's own
// message -> dead.
//
// This file covers the fix: supervisor.ts now checks admission BEFORE creating a
// worktree or spawning anything, and a run that queues at the cap is left in a legal,
// resumable state (not failed, not orphaned) with a note naming the cap — re-admitted
// by dispatch.ts's reclaimQueuedRuns, called from the daemon's existing reap timer.
//
// A second, sharper bug surfaced from two more real orphans after the above was first
// diagnosed: the concurrency check COUNTED THE RUN ITSELF. By the time a fresh dispatch's
// SECOND transitionRun call (dispatched→running) was checked, its own FIRST transition
// (briefed→dispatched) was already on disk — so at max_concurrent 3, two genuinely
// running runs plus the third run's own now-"dispatched" record read as 3 active. A
// configured cap of N behaved as a cap of N-1 plus a guaranteed-orphaned agent on every
// Nth dispatch, independent of the ordering bug above. Fixed by excluding the asking
// run's own id from activeRunCount/concurrencyStatus everywhere they decide a run's own
// admission (contract.ts's assertConcurrencyAllows and supervisor.ts's pre-spawn gate).
//
// Deliberately its own file per the repo's test-placement rule — this is a distinct
// concern from the stall detector, and mcp/delegation.test.ts is off-limits.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeRunCount, createRun, patchRun, readRun, transitionRun, type TaskRecord } from "./delegation/contract.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { reclaimQueuedRuns } from "./delegation/dispatch.js";
import { superviseRun } from "./delegation/supervisor.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import type { Adapter } from "./delegation/adapters/types.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempGitProject(options: { testCommand?: string; maxConcurrent?: number } = {}): string {
  const project = mkdtempSync(join(tmpdir(), "kage-concurrency-queue-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  writeDelegationConfig(project, {
    ...(options.testCommand ? { test: options.testCommand } : {}),
    ...(options.maxConcurrent ? { max_concurrent: options.maxConcurrent } : {}),
  });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

function occupyASlot(project: string, intent: string): TaskRecord {
  const task = createRun(project, { intent, type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  // A "running" record with no live pid displays as "dropped" (contract.ts's
  // liveState), which activeRunCount does not count as in flight — this stand-in pid
  // (this test process's own, same trick delegation.test.ts's concurrency tests use)
  // is what makes it read as genuinely active.
  patchRun(project, task.id, { agent_pid: process.pid });
  return readRun(project, task.id);
}

function spyAdapter(inner: Adapter): { adapter: Adapter; spawnCount: number } {
  const spy = { adapter: inner, spawnCount: 0 };
  if (inner.spawnLive) {
    const original = inner.spawnLive;
    spy.adapter = {
      ...inner,
      spawnLive: (input) => {
        spy.spawnCount += 1;
        return original(input);
      },
    };
  }
  return spy;
}

// --- the pre-spawn admission gate --------------------------------------------------

test("REGRESSION: at the concurrency cap, a supervised run queues instead of spawning an agent", async () => {
  const project = tempGitProject({ testCommand: "true", maxConcurrent: 1 });
  occupyASlot(project, "already running, fills the one slot");

  const task = createRun(project, { intent: "should queue, not orphan", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");

  const spy = spyAdapter(stubAdapter({ live: { question: "n/a", firstResult: "claim" } }));

  // REVERT CHECK: before this fix, superviseRun spawned the agent child FIRST and only
  // discovered the cap afterward (inside transitionRun's briefed→dispatched→running
  // bookkeeping) — spy.spawnCount would read 1 here, and the process would have thrown
  // instead of returning, exactly the crash that orphaned every run behind a full slate.
  await superviseRun(project, task.id, spy.adapter);

  assert.equal(spy.spawnCount, 0, "the agent child must never be spawned when the run queues at the cap");
  const queued = readRun(project, task.id);
  assert.equal(queued.state, "briefed", "a queued run is left exactly where it was — a legal, resumable state");
  assert.equal(queued.worktree, null, "no worktree may be created for a run that queues");
  assert.equal(queued.waiting_on?.needs, "a free run slot");
  assert.match(queued.waiting_on?.detail ?? "", /1 run\(s\) already in flight/, "the note must name the cap");
  assert.match(queued.waiting_on?.detail ?? "", /--max-concurrent/, "the note must name how to raise it");
});

test("below the concurrency cap, a supervised run proceeds normally — the agent child IS spawned", async () => {
  const project = tempGitProject({ testCommand: "true", maxConcurrent: 2 });
  occupyASlot(project, "one slot used, one still free");

  const task = createRun(project, { intent: "room to run", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");

  const spy = spyAdapter(stubAdapter({ live: { question: "n/a", firstResult: "claim" }, statement: "finished normally" }));
  await superviseRun(project, task.id, spy.adapter);

  assert.equal(spy.spawnCount, 1, "under the cap, the agent child must still be spawned exactly as before");
  assert.equal(readRun(project, task.id).state, "ready");
});

// --- reclaimQueuedRuns: the other half — re-admitting once a slot frees -----------

test("REGRESSION: a queued run is re-admitted once a slot frees, and its queued marker is cleared", async () => {
  const project = tempGitProject({ testCommand: "true", maxConcurrent: 1 });
  const occupied = occupyASlot(project, "occupies the only slot, then finishes");

  const task = createRun(project, { intent: "queued, then reclaimed", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  const spy = spyAdapter(stubAdapter({ live: { question: "n/a", firstResult: "claim" }, statement: "reclaimed and finished" }));
  await superviseRun(project, task.id, spy.adapter);
  assert.equal(spy.spawnCount, 0, "sanity check: it queued, exactly like the test above");
  assert.equal(readRun(project, task.id).waiting_on?.needs, "a free run slot");

  // Free the slot the earlier run was holding.
  transitionRun(project, occupied.id, "verifying", "kernel");
  transitionRun(project, occupied.id, "ready", "kernel");

  let reattached: Promise<void> | null = null;
  const reattach = (projectDir: string, reentrantTask: { id: string }): { pid: number | undefined } => {
    reattached = superviseRun(projectDir, reentrantTask.id, spy.adapter);
    return { pid: 424_242 };
  };

  // REVERT CHECK: without reclaimQueuedRuns, this run — never failed, never dropped,
  // just left "briefed" with a queued marker — would sit there forever; nothing else in
  // the codebase ever revisits a plain "briefed" run on its own.
  const admitted = reclaimQueuedRuns(project, reattach);
  assert.equal(admitted.length, 1);
  assert.equal(admitted[0].id, task.id);
  assert.ok(reattached, "reclaiming a queued run must actually re-dispatch it");
  await reattached!;

  const finished = readRun(project, task.id);
  assert.equal(finished.waiting_on, undefined, "the queued marker must be cleared once re-admitted");
  assert.equal(finished.state, "ready", "the reclaimed run must actually run to completion this time");
  assert.equal(spy.spawnCount, 1, "the agent child is spawned on the SECOND attempt, once room exists");
});

test("reclaimQueuedRuns admits nothing when still at the cap", async () => {
  const project = tempGitProject({ testCommand: "true", maxConcurrent: 1 });
  occupyASlot(project, "still occupying the only slot");

  const task = createRun(project, { intent: "stays queued", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  patchRun(project, task.id, {
    waiting_on: { needs: "a free run slot", detail: "1 run(s) already in flight — the configured limit (kage config --max-concurrent N to change it)" },
  });

  let called = false;
  const reattach = (): { pid: number | undefined } => {
    called = true;
    return { pid: undefined };
  };
  const admitted = reclaimQueuedRuns(project, reattach);
  assert.equal(admitted.length, 0);
  assert.equal(called, false, "must not attempt to re-dispatch while still at the cap");
  assert.equal(readRun(project, task.id).waiting_on?.needs, "a free run slot", "an unreclaimed run keeps its queued marker");
});

// --- off-by-self: a run's own record must never count against its own admission ---

test("REGRESSION: with exactly 2 other runs running, a 3rd dispatched run at max_concurrent 3 proceeds — not queued, not orphaned", async () => {
  const project = tempGitProject({ testCommand: "true", maxConcurrent: 3 });
  occupyASlot(project, "one of two others running");
  occupyASlot(project, "two of two others running");

  const task = createRun(project, { intent: "the third — must proceed", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  const spy = spyAdapter(stubAdapter({ live: { question: "n/a", firstResult: "claim" }, statement: "proceeded fine" }));

  // REVERT CHECK: before excluding the run's own id from activeRunCount, this run's own
  // "dispatched" record (written by superviseRun's own briefed→dispatched transition,
  // moments before this check) counted as a THIRD active run alongside the two genuine
  // ones — 3 >= max_concurrent 3, so it queued (or, before the ordering fix, orphaned)
  // even though only 2 OTHER runs were actually in flight.
  await superviseRun(project, task.id, spy.adapter);

  assert.equal(spy.spawnCount, 1, "the third run must actually spawn its agent — 2 others running is under the cap of 3");
  assert.equal(readRun(project, task.id).state, "ready", "it must run to completion, not sit queued behind its own phantom count");
  assert.notEqual(readRun(project, task.id).waiting_on?.needs, "a free run slot");
});

test("REGRESSION: activeRunCount excludes the asking run's own now-'dispatched' record from its own admission check", () => {
  const project = tempGitProject({ testCommand: "true", maxConcurrent: 3 });
  occupyASlot(project, "one");
  occupyASlot(project, "two");

  // Reproduce the exact bug shape at the transitionRun layer directly: the run's own
  // FIRST transition (briefed→dispatched) has already landed on disk, exactly as it has
  // by the time superviseRun's real briefed→dispatched→running sequence reaches its
  // second call.
  const third = createRun(project, { intent: "three", type: "chore", agent: "stub" });
  transitionRun(project, third.id, "briefed", "kernel");
  transitionRun(project, third.id, "dispatched", "kernel");
  // Same reason as occupyASlot: a "dispatched" record with no live pid displays as
  // "dropped", not "dispatched" — this stand-in is what makes it read as genuinely
  // in flight, matching what superviseRun's own agent_pid patch would have set by now.
  patchRun(project, third.id, { agent_pid: process.pid });

  assert.equal(activeRunCount(project), 3, "sanity check: unexcluded, the count reads 3 — the run's own record IS in there");
  assert.equal(activeRunCount(project, third.id), 2, "excluding the run's own id must read exactly the 2 OTHER runs");

  // REVERT CHECK: without excludeRunId threaded through assertConcurrencyAllows, this
  // throws ConcurrencyLimitError — the third run counting itself and refusing its own
  // admission, even though only 2 other runs are genuinely in flight.
  assert.doesNotThrow(() => transitionRun(project, third.id, "running", "kernel"));
});
