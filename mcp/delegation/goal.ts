// Goal records — the orchestration substrate above runs.
//
// A goal is not a run: it never executes anything itself. It is the room manager's own
// bookkeeping for a multi-run intent — a plan of parallel waves, which runs each wave
// dispatched, and how much autonomy the user granted. The kernel owns this record the
// same way it owns task.json: atomic writes, one legality table, no surface allowed to
// invent a state transition.
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { RUN_TYPES, ensureDelegationIgnores, onRunTransition, readRun, type RunState, type RunType } from "./contract.js";
import { clearActiveGoalEverywhere } from "./room-sessions.js";

export const GOAL_SCHEMA_VERSION = 1;

export const GOAL_STATES = ["planning", "executing", "done", "abandoned"] as const;
export type GoalState = (typeof GOAL_STATES)[number];

export const GOAL_AUTONOMY = ["recommend", "merge"] as const;
export type GoalAutonomy = (typeof GOAL_AUTONOMY)[number];

// done/abandoned are terminal — a finished or abandoned goal is not resumed, a new one
// is created. Mirrors the run contract's own terminal-state shape (contract.ts).
const GOAL_LEGAL_TRANSITIONS: Record<GoalState, readonly GoalState[]> = {
  planning: ["executing", "abandoned"],
  executing: ["done", "abandoned"],
  done: [],
  abandoned: [],
};

export interface GoalRunSpec {
  intent: string;
  type: RunType;
  /** Advisory partition only — nothing enforces it, it is what the manager promised the user. */
  files_scope: string[];
}

export interface GoalWave {
  runs: GoalRunSpec[];
  run_ids: string[];
}

export interface GoalPlan {
  waves: GoalWave[];
}

export interface GoalBudgets {
  usd: number;
  runs: number;
}

export const DEFAULT_GOAL_BUDGETS: GoalBudgets = { usd: 20, runs: 10 };

export interface GoalStateChange {
  state: GoalState;
  at: string;
  note?: string;
}

export interface GoalRecord {
  schema_version: typeof GOAL_SCHEMA_VERSION;
  id: string;
  intent: string;
  state: GoalState;
  plan: GoalPlan;
  autonomy: GoalAutonomy;
  budgets: GoalBudgets;
  state_history: GoalStateChange[];
  created_at: string;
  updated_at: string;
}

export function goalsDir(projectDir: string): string {
  return join(projectDir, ".agent_memory", "goals");
}

export function goalDir(projectDir: string, goalId: string): string {
  return join(goalsDir(projectDir), goalId);
}

function goalPath(projectDir: string, goalId: string): string {
  return join(goalDir(projectDir, goalId), "goal.json");
}

function nowIso(): string {
  return new Date().toISOString();
}

function atomicWriteJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function makeGoalId(intent: string, at: Date = new Date()): string {
  const cleaned = intent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const slug = (cleaned || "goal").slice(0, 40).replace(/-+$/, "");
  const yymmdd = at.toISOString().slice(2, 10).replace(/-/g, "");
  const hash = createHash("sha256").update(`${intent}\n${at.toISOString()}\n${process.pid}`).digest("hex").slice(0, 4);
  return `${slug}-${yymmdd}-${hash}`;
}

function normalizeRunSpec(spec: Partial<GoalRunSpec>): GoalRunSpec {
  const intent = typeof spec.intent === "string" ? spec.intent.trim() : "";
  const type = RUN_TYPES.includes(spec.type as RunType) ? (spec.type as RunType) : "chore";
  const files_scope = Array.isArray(spec.files_scope)
    ? spec.files_scope.filter((entry): entry is string => typeof entry === "string")
    : [];
  return { intent, type, files_scope };
}

export interface CreateGoalInput {
  intent: string;
  /** Waves of run specs — run_ids start empty, filled in as runs are attached. */
  plan?: Array<Array<Partial<GoalRunSpec>>>;
  autonomy?: GoalAutonomy;
  budgets?: Partial<GoalBudgets>;
}

export function createGoal(projectDir: string, input: CreateGoalInput): GoalRecord {
  const intent = input.intent.trim();
  if (!intent) throw new Error("Goal intent must be a non-empty string.");
  const autonomy = input.autonomy ?? "recommend";
  if (!GOAL_AUTONOMY.includes(autonomy)) {
    throw new Error(`Unknown goal autonomy: ${autonomy}. One of: ${GOAL_AUTONOMY.join(", ")}`);
  }
  const at = nowIso();
  const id = makeGoalId(intent, new Date(at));
  const waves: GoalWave[] = (input.plan ?? []).map((runs) => ({ runs: runs.map(normalizeRunSpec), run_ids: [] }));
  const goal: GoalRecord = {
    schema_version: GOAL_SCHEMA_VERSION,
    id,
    intent,
    state: "planning",
    plan: { waves },
    autonomy,
    budgets: { ...DEFAULT_GOAL_BUDGETS, ...(input.budgets ?? {}) },
    state_history: [{ state: "planning", at }],
    created_at: at,
    updated_at: at,
  };
  ensureDelegationIgnores(projectDir);
  atomicWriteJson(goalPath(projectDir, id), goal);
  return goal;
}

/** Disk-truth read, no reconciliation — used by the state-machine functions themselves
 * (transitionGoal, patchGoal) so reconciling never recurses back into a transition that
 * is already in flight. Only the public readGoal/listGoals reconcile. */
function loadGoalRaw(projectDir: string, goalId: string): GoalRecord {
  const path = goalPath(projectDir, goalId);
  if (!existsSync(path)) throw new Error(`No goal found: ${goalId}`);
  return JSON.parse(readFileSync(path, "utf8")) as GoalRecord;
}

/** Disk-truth listing, no reconciliation — used by goalForRun so a run transition's
 * onRunTransition hook (below) keeps its original, narrow cost: settling the ONE goal
 * that owns the transitioning run, not reconciling every goal in the directory. */
function listGoalsRaw(projectDir: string): GoalRecord[] {
  const dir = goalsDir(projectDir);
  if (!existsSync(dir)) return [];
  const goals: GoalRecord[] = [];
  for (const entry of readdirSync(dir)) {
    const path = goalPath(projectDir, entry);
    if (!existsSync(path)) continue;
    try {
      goals.push(JSON.parse(readFileSync(path, "utf8")) as GoalRecord);
    } catch {
      // A torn record never breaks listing.
    }
  }
  return goals.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function readGoal(projectDir: string, goalId: string): GoalRecord {
  return reconcileGoalState(projectDir, loadGoalRaw(projectDir, goalId));
}

export function listGoals(projectDir: string): GoalRecord[] {
  return listGoalsRaw(projectDir).map((goal) => reconcileGoalState(projectDir, goal));
}

/** Merge fields into a goal record without touching its state machine. */
export function patchGoal(projectDir: string, goalId: string, patch: Partial<GoalRecord>): GoalRecord {
  const goal = { ...loadGoalRaw(projectDir, goalId), ...patch, updated_at: nowIso() };
  atomicWriteJson(goalPath(projectDir, goalId), goal);
  return goal;
}

export function transitionGoal(projectDir: string, goalId: string, to: GoalState, note?: string): GoalRecord {
  const goal = loadGoalRaw(projectDir, goalId);
  const legal = GOAL_LEGAL_TRANSITIONS[goal.state] ?? [];
  if (!legal.includes(to)) {
    throw new Error(`Illegal transition for ${goalId}: ${goal.state} → ${to} (legal: ${legal.join(", ") || "none — terminal state"})`);
  }
  const at = nowIso();
  goal.state = to;
  goal.updated_at = at;
  goal.state_history.push({ state: to, at, ...(note ? { note } : {}) });
  atomicWriteJson(goalPath(projectDir, goalId), goal);
  // Terminal: no thread may keep dispatching into a goal that is done or abandoned.
  if (to === "done" || to === "abandoned") clearActiveGoalEverywhere(projectDir, goalId);
  return goal;
}

export function abandonGoal(projectDir: string, goalId: string, note?: string): GoalRecord {
  return transitionGoal(projectDir, goalId, "abandoned", note);
}

type MutableWave = { runs: GoalRunSpec[]; run_ids: string[] };

/** The first wave still owed a run for one of its planned specs, or the last wave if
 * every wave is already full (or the plan is empty) — never the last wave just because
 * it is last. */
function firstOpenWaveIndex(waves: readonly MutableWave[]): number {
  const open = waves.findIndex((wave) => wave.run_ids.length < wave.runs.length);
  return open === -1 ? waves.length - 1 : open;
}

/**
 * Attach a dispatched run to a goal's wave — the other half of the flywheel that lets
 * the event bridge find "does this run belong to a goal" in one lookup (goalForRun).
 * An implicit attach (no waveIndex) targets the first wave with an unfilled run spec,
 * not the last — a plan with two waves must fill wave one before wave two ever sees a
 * run. Creates an empty wave if the plan has none yet (a goal created with no plan,
 * dispatched into ad hoc).
 */
export function attachRunToGoal(projectDir: string, goalId: string, runId: string, waveIndex?: number): GoalRecord {
  const goal = loadGoalRaw(projectDir, goalId);
  const waves: MutableWave[] = goal.plan.waves.length
    ? goal.plan.waves.map((wave) => ({ runs: wave.runs, run_ids: [...wave.run_ids] }))
    : [{ runs: [], run_ids: [] }];
  const index = typeof waveIndex === "number" && waveIndex >= 0 && waveIndex < waves.length ? waveIndex : firstOpenWaveIndex(waves);
  if (!waves[index].run_ids.includes(runId)) waves[index].run_ids.push(runId);
  const updated = patchGoal(projectDir, goalId, { plan: { waves } });
  // A goal's first attached run is the fact that turns intent into motion — a goal
  // could sit in "planning" forever while it owned running, verified, even merged work
  // (this is the exact drift the module header warns about: the kernel owns this
  // record so no surface can leave it lying about what is actually happening). Only the
  // FIRST attach flips it; later attaches into an already-executing goal are a no-op.
  if (updated.state === "planning") return transitionGoal(projectDir, goalId, "executing");
  return updated;
}

/** Reverse lookup: which goal (if any) owns this run. Linear over goals, which stay few. */
export function goalForRun(projectDir: string, runId: string): GoalRecord | null {
  for (const goal of listGoalsRaw(projectDir)) {
    if (goal.plan.waves.some((wave) => wave.run_ids.includes(runId))) return goal;
  }
  return null;
}

const RUN_TERMINAL_STATES = new Set<RunState>(["merged", "rejected", "failed"]);

/** True when every run this goal owns has settled into a terminal state AND no wave
 * still has an unfilled run spec. The one place that rule is computed — both
 * syncGoalCompletion (the live path) and reconcileGoalState (the read-time path) ask
 * this same question so they can never disagree about what "done" means. */
function goalRunsAllSettled(projectDir: string, goal: GoalRecord): boolean {
  const runIds = goal.plan.waves.flatMap((wave) => wave.run_ids);
  if (!runIds.length) return false;
  const allSettled = runIds.every((id) => {
    try {
      return RUN_TERMINAL_STATES.has(readRun(projectDir, id).state);
    } catch {
      return false;
    }
  });
  const noOpenSpecs = goal.plan.waves.every((wave) => wave.run_ids.length >= wave.runs.length);
  return allSettled && noOpenSpecs;
}

/**
 * Derives executing -> done the moment every run this goal owns has settled into a
 * terminal state AND no wave still has an unfilled run spec — never from a manager's
 * opinion. Hooked into EVERY run-state transition via contract.ts's onRunTransition
 * (registered below), so this cannot drift out of sync the way the top-level run_ids
 * field did: whichever surface (dispatch, supervisor, reap, ratify) settles the run,
 * this fires.
 */
export function syncGoalCompletion(projectDir: string, runId: string): GoalRecord | null {
  const goal = goalForRun(projectDir, runId);
  if (!goal || goal.state !== "executing") return null;
  if (!goalRunsAllSettled(projectDir, goal)) return null;
  return transitionGoal(projectDir, goal.id, "done", "every run reached a terminal state");
}

onRunTransition((projectDir, runId, to) => {
  if (to === "merged" || to === "rejected" || to === "failed") syncGoalCompletion(projectDir, runId);
});

/**
 * The read-time counterpart to the onRunTransition hook above — "derive display;
 * persist death", same law contract.ts already applies to runs (liveState/displayState
 * derive truth at read time rather than trusting whatever was last written). The hook
 * only fires on a LIVE run transition; a goal whose runs all reached a terminal state
 * before the hook existed, or via any path that mutates a run without going through
 * transitionRun, is never revisited by it and sits stuck in 'planning'/'executing'
 * forever. Called from readGoal/listGoals so every read repairs that drift.
 *
 * Never called on (and never produces) a terminal state transition out of done/
 * abandoned — those are final, checked by the early return below. Idempotent: a goal
 * already at the state its runs imply makes no further transitionGoal call, so a
 * second read never rewrites the record.
 */
function reconcileGoalState(projectDir: string, goal: GoalRecord): GoalRecord {
  if (goal.state !== "planning" && goal.state !== "executing") return goal;
  const runIds = goal.plan.waves.flatMap((wave) => wave.run_ids);
  if (!runIds.length) return goal;
  let current = goal;
  // Any attached run at all means the goal is at least under way.
  if (current.state === "planning") {
    current = transitionGoal(projectDir, current.id, "executing");
  }
  if (current.state === "executing" && goalRunsAllSettled(projectDir, current)) {
    current = transitionGoal(projectDir, current.id, "done", "every run reached a terminal state");
  }
  return current;
}

// ---------------------------------------------------------------------------
// Pre-dispatch gates: files_scope disjointness and budgets. Both are checked BEFORE a
// new run is created, never after — a plan that cannot be safely parallelized, or a
// goal that is already spent, must never get as far as a real run record.

export interface GoalSpend {
  usd: number;
  runs: number;
}

/** Sums exactly what the goal card already sums (app-client.ts's goalSpendLabel) —
 * one definition of "how much has this goal spent". */
export function goalSpend(projectDir: string, goal: GoalRecord): GoalSpend {
  let usd = 0;
  let runs = 0;
  for (const wave of goal.plan.waves) {
    for (const runId of wave.run_ids) {
      runs += 1;
      try {
        usd += readRun(projectDir, runId).spend.usd_est;
      } catch {
        // A run record that vanished contributes nothing further to the tally.
      }
    }
  }
  return { usd, runs };
}

function overlappingPaths(a: readonly string[], b: readonly string[]): string[] {
  const hits = new Set<string>();
  for (const pathA of a) {
    for (const pathB of b) {
      if (pathA === pathB || pathA.startsWith(`${pathB}/`) || pathB.startsWith(`${pathA}/`)) {
        hits.add(pathA.length <= pathB.length ? pathA : pathB);
      }
    }
  }
  return [...hits];
}

export interface WaveScopeCollision {
  specA: string;
  specB: string;
  paths: string[];
}

/** Pairwise collisions among a wave's DECLARED (planned) files_scope — the plan itself,
 * not what a run actually touches, since this exists to catch a bad plan before any
 * agent starts working from it (manager-prompt.ts's whole "disjoint file scopes"
 * premise, unverified until now). */
export function waveScopeCollisions(wave: GoalWave): WaveScopeCollision[] {
  const collisions: WaveScopeCollision[] = [];
  for (let i = 0; i < wave.runs.length; i++) {
    for (let j = i + 1; j < wave.runs.length; j++) {
      const paths = overlappingPaths(wave.runs[i].files_scope, wave.runs[j].files_scope);
      if (paths.length) collisions.push({ specA: wave.runs[i].intent, specB: wave.runs[j].intent, paths });
    }
  }
  return collisions;
}

export type GoalGate = { ok: true } | { ok: false; message: string };

/**
 * The pre-dispatch gate for D (scope disjointness) and E (budgets) — called by
 * dispatch.ts's dispatchRun and api.ts's /runs POST before a new run is created for a
 * goal. Resolves silently (ok: true) for an unknown goal id: an unresolvable goal_id is
 * a warn-only concern handled where the attach itself is attempted, not this gate's job.
 */
export function checkGoalAcceptsNewRun(projectDir: string, goalId: string): GoalGate {
  let goal: GoalRecord;
  try {
    // Non-reconciling read on purpose: this gate runs pre-dispatch, before the run it is
    // deciding about even exists, and never inspects goal.state (only plan.waves and
    // budgets below) — so there is no reason to risk reconcileGoalState persisting a
    // planning->done transition as a side effect of a check that doesn't care either way.
    goal = loadGoalRaw(projectDir, goalId);
  } catch {
    return { ok: true };
  }
  if (goal.plan.waves.length) {
    const waves: MutableWave[] = goal.plan.waves.map((wave) => ({ runs: wave.runs, run_ids: [...wave.run_ids] }));
    const wave = goal.plan.waves[firstOpenWaveIndex(waves)];
    const collisions = waveScopeCollisions(wave);
    if (collisions.length) {
      const detail = collisions.map((c) => `"${c.specA}" vs "${c.specB}" on ${c.paths.join(", ")}`).join("; ");
      return { ok: false, message: `Refusing to dispatch — wave has overlapping files_scope: ${detail}` };
    }
  }
  const spend = goalSpend(projectDir, goal);
  if (spend.runs >= goal.budgets.runs) {
    return {
      ok: false,
      message: `Goal "${goal.intent}" is already at its run budget (${spend.runs}/${goal.budgets.runs} runs) — refusing to attach another.`,
    };
  }
  if (spend.usd >= goal.budgets.usd) {
    return {
      ok: false,
      message: `Goal "${goal.intent}" is already at its spend budget ($${spend.usd.toFixed(2)}/$${goal.budgets.usd.toFixed(2)}) — refusing to attach another run.`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pending events log — the durable half of the manager event bridge. A run's state
// change is recorded here BEFORE anyone attempts to deliver it to the held manager
// session, so a busy or dead manager never turns into a silent drop: the event just
// waits here until the room supervisor's idle-drain (room-supervisor.ts) or a later
// live delivery picks it up. Same atomic temp+rename rewrite as the steer log
// (dispatch.ts's writeSteerRecords) — read the whole log, mutate, rewrite it whole.

export interface GoalEventRecord {
  id: string;
  run_id: string;
  state: string;
  detail?: string;
  at: string;
  status: "pending" | "delivered";
  delivered_at?: string;
}

function goalEventsPath(projectDir: string, goalId: string): string {
  return join(goalDir(projectDir, goalId), "events.jsonl");
}

function readGoalEvents(projectDir: string, goalId: string): GoalEventRecord[] {
  const path = goalEventsPath(projectDir, goalId);
  if (!existsSync(path)) return [];
  const records: GoalEventRecord[] = [];
  for (const line of readFileSync(path, "utf8").split("\n").filter(Boolean)) {
    let parsed: Partial<GoalEventRecord>;
    try {
      parsed = JSON.parse(line) as Partial<GoalEventRecord>;
    } catch {
      continue;
    }
    if (typeof parsed.id !== "string" || typeof parsed.run_id !== "string" || typeof parsed.state !== "string") continue;
    records.push({
      id: parsed.id,
      run_id: parsed.run_id,
      state: parsed.state,
      ...(typeof parsed.detail === "string" ? { detail: parsed.detail } : {}),
      at: typeof parsed.at === "string" ? parsed.at : new Date(0).toISOString(),
      status: parsed.status === "delivered" ? "delivered" : "pending",
      ...(typeof parsed.delivered_at === "string" ? { delivered_at: parsed.delivered_at } : {}),
    });
  }
  return records;
}

function writeGoalEvents(projectDir: string, goalId: string, records: GoalEventRecord[]): void {
  const path = goalEventsPath(projectDir, goalId);
  mkdirSync(dirname(path), { recursive: true });
  const body = records.map((record) => JSON.stringify(record)).join("\n");
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, body ? `${body}\n` : "", "utf8");
  renameSync(tmp, path);
}

/** Record a run's state change as pending. Delivery is marked separately, once it actually lands. */
export function appendGoalEvent(
  projectDir: string,
  goalId: string,
  event: { run_id: string; state: string; detail?: string },
): GoalEventRecord {
  const record: GoalEventRecord = {
    id: randomUUID().replace(/-/g, "").slice(0, 8),
    run_id: event.run_id,
    state: event.state,
    ...(event.detail ? { detail: event.detail } : {}),
    at: nowIso(),
    status: "pending",
  };
  const records = readGoalEvents(projectDir, goalId);
  records.push(record);
  writeGoalEvents(projectDir, goalId, records);
  return record;
}

/** Every event this goal is still owed, oldest first. */
export function readPendingGoalEvents(projectDir: string, goalId: string): GoalEventRecord[] {
  return readGoalEvents(projectDir, goalId).filter((record) => record.status === "pending");
}

/** Flip the given pending events to delivered. Unknown or already-delivered ids are no-ops. */
export function markGoalEventsDelivered(projectDir: string, goalId: string, ids: string[]): void {
  if (!ids.length) return;
  const idSet = new Set(ids);
  const at = nowIso();
  const records = readGoalEvents(projectDir, goalId).map((record) =>
    idSet.has(record.id) && record.status === "pending" ? { ...record, status: "delivered" as const, delivered_at: at } : record,
  );
  writeGoalEvents(projectDir, goalId, records);
}
