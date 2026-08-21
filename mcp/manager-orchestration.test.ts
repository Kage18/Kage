// The manager is instructed (manager-prompt.ts's "Orchestrating a goal" section) to open
// goals, report on them, and stop them early — but until this file's subject landed, none
// of those verbs existed on the MCP surface: MANAGER_ALLOWED_TOOLS listed only run verbs,
// and a goal could only be created from the app's own POST /goals route. These tests drive
// the three new tools (kage_goal_create, kage_goal_status, kage_goal_finish) the same way
// the manager does: through callTool(name, args), never by calling goal.ts directly.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRun, transitionRun } from "./delegation/contract.js";
import {
  attachRunToGoal,
  createGoal,
  goalDir,
  goalForRun,
  listGoals,
  readGoal,
  type GoalRecord,
  type GoalState,
} from "./delegation/goal.js";
import { DEFAULT_SESSION, readActiveGoal, setActiveGoal } from "./delegation/room-sessions.js";
import { notifyManagerOfRunEvent } from "./delegation/room-supervisor.js";
import { MANAGER_ALLOWED_TOOLS } from "./delegation/manager-client.js";
import { callTool, listTools } from "./index.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-manager-orch-"));
}

/** Drive a freshly created run through the kernel's own legal chain to a terminal state —
 * never hand-write a run record. Mirrors goal-reconcile.test.ts's helper of the same name. */
function settleRun(project: string, runId: string, terminal: "merged" | "rejected" | "failed"): void {
  transitionRun(project, runId, "briefed", "kernel");
  transitionRun(project, runId, "dispatched", "kernel");
  transitionRun(project, runId, "running", "kernel");
  if (terminal === "failed") {
    transitionRun(project, runId, "failed", "kernel");
    return;
  }
  transitionRun(project, runId, "verifying", "kernel");
  transitionRun(project, runId, "ready", "kernel");
  transitionRun(project, runId, terminal, "kernel");
}

/** Run a callback with KAGE_ROOM (and optionally KAGE_ROOM_SESSION) set, restoring both
 * afterward — mirrors delegation.test.ts's dispatchInRoom env-juggling exactly. */
async function inRoom<T>(sessionKey: string | undefined, fn: () => Promise<T>): Promise<T> {
  const prevRoom = process.env.KAGE_ROOM;
  const prevSession = process.env.KAGE_ROOM_SESSION;
  process.env.KAGE_ROOM = "1";
  if (sessionKey) process.env.KAGE_ROOM_SESSION = sessionKey;
  else delete process.env.KAGE_ROOM_SESSION;
  try {
    return await fn();
  } finally {
    if (prevRoom === undefined) delete process.env.KAGE_ROOM;
    else process.env.KAGE_ROOM = prevRoom;
    if (prevSession === undefined) delete process.env.KAGE_ROOM_SESSION;
    else process.env.KAGE_ROOM_SESSION = prevSession;
  }
}

/** Write a goal record straight to disk, bypassing createGoal/attachRunToGoal/
 * transitionGoal — the "pre-hook" shape goal-reconcile.test.ts also uses: a goal whose
 * plan already lists runs that later settled, but whose `state` field was never revisited
 * by the live onRunTransition hook. Proves kage_goal_status reads through readGoal's
 * reconciling path rather than the raw record. */
function writeGoalDirect(project: string, goal: GoalRecord): void {
  const dir = goalDir(project, goal.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "goal.json"), `${JSON.stringify(goal, null, 2)}\n`, "utf8");
}

function rawGoal(id: string, state: GoalState, runIds: string[]): GoalRecord {
  const at = new Date(0).toISOString();
  return {
    schema_version: 1,
    id,
    intent: `fixture: ${id}`,
    state,
    plan: { waves: [{ runs: runIds.map((_, i) => ({ intent: `part ${i + 1}`, type: "chore" as const, files_scope: [] })), run_ids: runIds }] },
    autonomy: "recommend",
    budgets: { usd: 20, runs: 10 },
    state_history: [{ state, at }],
    created_at: at,
    updated_at: at,
  };
}

// -- MANAGER_ALLOWED_TOOLS names the new verbs -------------------------------------------

test("MANAGER_ALLOWED_TOOLS lists the three goal verbs, matching the tools actually registered", () => {
  for (const name of ["kage_goal_create", "kage_goal_status", "kage_goal_finish"]) {
    assert.ok(MANAGER_ALLOWED_TOOLS.includes(`mcp__kage__${name}`), `${name} should be in MANAGER_ALLOWED_TOOLS`);
  }
});

// -- kage_goal_create ----------------------------------------------------------------------

test("kage_goal_create makes the goal and sets it active under KAGE_ROOM=1; a dispatch with no goal_id afterwards attaches to it", async () => {
  const project = tempProject();

  const created = await inRoom(undefined, () =>
    callTool("kage_goal_create", {
      project_dir: project,
      intent: "ship the widget",
      plan: [
        [{ intent: "wave one part", type: "chore", files_scope: ["src/a.ts"] }],
        [{ intent: "wave two part", type: "chore", files_scope: ["src/b.ts"] }],
      ],
    }),
  );
  const createdText = created.content[0].text as string;
  assert.doesNotMatch(createdText, /Could not do that/);

  const goal = listGoals(project).find((g) => g.intent === "ship the widget");
  assert.ok(goal, "the goal should exist");
  assert.equal(goal!.plan.waves.length, 2);

  // Reverted, this would be false: no code path outside kage_goal_create sets the active
  // goal for a fresh thread, so without the setActiveGoal call this assertion fails.
  assert.equal(readActiveGoal(project, DEFAULT_SESSION), goal!.id, "creating a goal inside a room thread must make it active");

  const dispatched = await inRoom(undefined, () =>
    callTool("kage_dispatch", { project_dir: project, intent: "wave one part", type: "chore", agent: "stub" }),
  );
  const dispatchedText = dispatched.content[0].text as string;
  assert.doesNotMatch(dispatchedText, /Could not attach/);
  const run = listGoals(project).find((g) => g.id === goal!.id)!.plan.waves[0].run_ids[0];
  assert.ok(run, "the dispatched run should have attached into wave one");
  assert.equal(goalForRun(project, run)?.id, goal!.id, "dispatch with no goal_id attaches to the goal just created");
});

test("kage_goal_create outside a room thread does not set any thread's active goal", async () => {
  const project = tempProject();
  const created = await callTool("kage_goal_create", { project_dir: project, intent: "no room here" });
  assert.doesNotMatch(created.content[0].text as string, /Could not do that/);
  assert.equal(readActiveGoal(project, DEFAULT_SESSION), null);
});

test("kage_goal_create requires an intent", async () => {
  const project = tempProject();
  const result = await callTool("kage_goal_create", { project_dir: project });
  assert.match(result.content[0].text as string, /needs an intent/);
});

// -- kage_goal_status ------------------------------------------------------------------------

test("kage_goal_status reports each wave's runs with their current states and names the next wave", async () => {
  const project = tempProject();
  const goal = createGoal(project, {
    intent: "two-wave rollout",
    plan: [
      [
        { intent: "part A", type: "chore", files_scope: ["a.ts"] },
        { intent: "part B", type: "chore", files_scope: ["b.ts"] },
      ],
      [{ intent: "part C", type: "chore", files_scope: ["c.ts"] }],
    ],
  });
  const runA = createRun(project, { intent: "part A", type: "chore", agent: "stub" });
  const runB = createRun(project, { intent: "part B", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal.id, runA.id);
  attachRunToGoal(project, goal.id, runB.id);
  settleRun(project, runA.id, "merged");
  settleRun(project, runB.id, "rejected");

  const result = await callTool("kage_goal_status", { project_dir: project, goal_id: goal.id });
  const status = JSON.parse(result.content[0].text as string);

  assert.equal(status.goal_id, goal.id);
  assert.equal(status.state, "executing", "wave two is still unfilled, so the goal cannot be done yet");
  assert.equal(status.waves.length, 2);
  assert.deepEqual(
    status.waves[0].run_states.sort((x: { run_id: string }, y: { run_id: string }) => x.run_id.localeCompare(y.run_id)),
    [
      { run_id: runA.id, state: "merged" },
      { run_id: runB.id, state: "rejected" },
    ].sort((x, y) => x.run_id.localeCompare(y.run_id)),
  );
  assert.equal(status.waves[1].run_ids.length, 0, "wave two has no run attached yet");
  assert.equal(status.next_wave, 1, "wave one is full; wave two is next to dispatch");
});

test("kage_goal_status on a goal whose runs all settled reports 'done' — proving it reads through the reconciling readGoal, not the raw record", async () => {
  const project = tempProject();
  const run = createRun(project, { intent: "only part", type: "chore", agent: "stub" });
  settleRun(project, run.id, "merged");

  // Written directly to disk in 'executing', bypassing the onRunTransition hook entirely —
  // exactly the pre-existing-goal shape goal-reconcile.test.ts exercises against readGoal.
  const goal = rawGoal("goal-stuck-executing", "executing", [run.id]);
  writeGoalDirect(project, goal);

  const result = await callTool("kage_goal_status", { project_dir: project, goal_id: goal.id });
  const status = JSON.parse(result.content[0].text as string);
  assert.equal(status.state, "done");
  assert.equal(status.next_wave, null, "a done goal has nothing left to dispatch");

  // The record on disk must actually have been repaired, not just reported as healed.
  assert.equal(readGoal(project, goal.id).state, "done");
});

test("kage_goal_status defaults to the room thread's active goal when goal_id is omitted", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "implicit status target" });
  setActiveGoal(project, DEFAULT_SESSION, goal.id);

  const result = await inRoom(undefined, () => callTool("kage_goal_status", { project_dir: project }));
  const status = JSON.parse(result.content[0].text as string);
  assert.equal(status.goal_id, goal.id);
});

test("kage_goal_status with no goal_id and no active goal reports it cannot proceed, rather than guessing", async () => {
  const project = tempProject();
  const result = await callTool("kage_goal_status", { project_dir: project });
  assert.match(result.content[0].text as string, /needs a goal_id/);
});

// -- kage_goal_finish -----------------------------------------------------------------------

test("kage_goal_finish abandons the goal with the reason recorded", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "cut short" });

  const result = await callTool("kage_goal_finish", {
    project_dir: project,
    goal_id: goal.id,
    reason: "the user changed direction mid-wave",
  });
  assert.doesNotMatch(result.content[0].text as string, /Could not do that/);

  const after = readGoal(project, goal.id);
  assert.equal(after.state, "abandoned");
  assert.equal(after.state_history.at(-1)?.note, "the user changed direction mid-wave");
});

test("kage_goal_finish requires a reason", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "no reason given" });
  const result = await callTool("kage_goal_finish", { project_dir: project, goal_id: goal.id });
  assert.match(result.content[0].text as string, /needs a reason/);
  assert.equal(readGoal(project, goal.id).state, "planning", "an unfinished call must not abandon the goal");
});

// -- No tool can force a goal to 'done' ------------------------------------------------------

test("there is no tool that can force a goal to 'done' — only kage_goal_finish exists, and it only ever abandons", async () => {
  const prevRoom = process.env.KAGE_ROOM;
  process.env.KAGE_ROOM = "1";
  let names: string[];
  try {
    names = listTools()
      .map((tool: { name: string }) => tool.name)
      .filter((name: string) => name.startsWith("kage_goal_"));
  } finally {
    if (prevRoom === undefined) delete process.env.KAGE_ROOM;
    else process.env.KAGE_ROOM = prevRoom;
  }
  assert.deepEqual([...names].sort(), ["kage_goal_create", "kage_goal_finish", "kage_goal_status"]);

  // The only state-changing goal tool is kage_goal_finish, and abandonGoal (which it wraps)
  // has no legal transition into 'done' — transitionGoal's own legality table only reaches
  // 'done' from 'executing', and only the runs-settled reconciliation path calls it that way.
  const project = tempProject();
  const goal = createGoal(project, { intent: "cannot be forced done" });
  await callTool("kage_goal_finish", { project_dir: project, goal_id: goal.id, reason: "trying to force it" });
  assert.equal(readGoal(project, goal.id).state, "abandoned", "kage_goal_finish never produces 'done'");
});

// -- Wave-advance: the frame names the next wave --------------------------------------------

test("the wave-complete frame names the next wave's run specs when the last run of a wave settles", async () => {
  const project = tempProject();
  const goal = createGoal(project, {
    intent: "three-part rollout",
    plan: [
      [
        { intent: "wave one, part one", type: "chore", files_scope: ["a.ts"] },
        { intent: "wave one, part two", type: "chore", files_scope: ["b.ts"] },
      ],
      [{ intent: "wave two, the only part", type: "feature", files_scope: ["c.ts"] }],
    ],
  });
  const runA = createRun(project, { intent: "wave one, part one", type: "chore", agent: "stub" });
  const runB = createRun(project, { intent: "wave one, part two", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal.id, runA.id);
  attachRunToGoal(project, goal.id, runB.id);
  settleRun(project, runA.id, "merged");
  settleRun(project, runB.id, "rejected");

  const sent: string[] = [];
  const deps = {
    isLiveFn: async () => true,
    sendFrameFn: async (_project: string, message: string) => {
      sent.push(message);
      return true;
    },
  };
  // runB is the LAST run of wave one to settle — this is the event that should carry the
  // wave-complete note, not merely "run <id> is now rejected".
  const delivered = await notifyManagerOfRunEvent(project, runB.id, { state: "rejected" }, undefined, deps);
  assert.equal(delivered, true);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /wave 1 of 2 complete: 1 merged, 1 rejected\./);
  assert.match(sent[0], /Wave 2 is next:/);
  assert.match(sent[0], /wave two, the only part/, "the next wave's run spec intent must be named, not just its count");
});

test("no wave-complete note when the settling run leaves other runs in its wave still in flight", async () => {
  const project = tempProject();
  const goal = createGoal(project, {
    intent: "two-part wave, one still running",
    plan: [
      [
        { intent: "finishes first", type: "chore", files_scope: ["a.ts"] },
        { intent: "still running", type: "chore", files_scope: ["b.ts"] },
      ],
      [{ intent: "next wave part", type: "chore", files_scope: ["c.ts"] }],
    ],
  });
  const runA = createRun(project, { intent: "finishes first", type: "chore", agent: "stub" });
  const runB = createRun(project, { intent: "still running", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal.id, runA.id);
  attachRunToGoal(project, goal.id, runB.id);
  settleRun(project, runA.id, "merged");
  transitionRun(project, runB.id, "briefed", "kernel");
  transitionRun(project, runB.id, "dispatched", "kernel");
  transitionRun(project, runB.id, "running", "kernel");

  const sent: string[] = [];
  const deps = {
    isLiveFn: async () => true,
    sendFrameFn: async (_project: string, message: string) => {
      sent.push(message);
      return true;
    },
  };
  const delivered = await notifyManagerOfRunEvent(project, runA.id, { state: "merged" }, undefined, deps);
  assert.equal(delivered, true);
  assert.equal(sent.length, 1);
  assert.doesNotMatch(sent[0], /complete/, "the wave is not done while runB is still running");
});
