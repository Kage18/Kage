// Goal records — the orchestration substrate above runs.
//
// A goal is not a run: it never executes anything itself. It is the room manager's own
// bookkeeping for a multi-run intent — a plan of parallel waves, which runs each wave
// dispatched, and how much autonomy the user granted. The kernel owns this record the
// same way it owns task.json: atomic writes, one legality table, no surface allowed to
// invent a state transition.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { RUN_TYPES, ensureDelegationIgnores, type RunType } from "./contract.js";

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

export function readGoal(projectDir: string, goalId: string): GoalRecord {
  const path = goalPath(projectDir, goalId);
  if (!existsSync(path)) throw new Error(`No goal found: ${goalId}`);
  return JSON.parse(readFileSync(path, "utf8")) as GoalRecord;
}

export function listGoals(projectDir: string): GoalRecord[] {
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

/** Merge fields into a goal record without touching its state machine. */
export function patchGoal(projectDir: string, goalId: string, patch: Partial<GoalRecord>): GoalRecord {
  const goal = { ...readGoal(projectDir, goalId), ...patch, updated_at: nowIso() };
  atomicWriteJson(goalPath(projectDir, goalId), goal);
  return goal;
}

export function transitionGoal(projectDir: string, goalId: string, to: GoalState, note?: string): GoalRecord {
  const goal = readGoal(projectDir, goalId);
  const legal = GOAL_LEGAL_TRANSITIONS[goal.state] ?? [];
  if (!legal.includes(to)) {
    throw new Error(`Illegal transition for ${goalId}: ${goal.state} → ${to} (legal: ${legal.join(", ") || "none — terminal state"})`);
  }
  const at = nowIso();
  goal.state = to;
  goal.updated_at = at;
  goal.state_history.push({ state: to, at, ...(note ? { note } : {}) });
  atomicWriteJson(goalPath(projectDir, goalId), goal);
  return goal;
}

export function abandonGoal(projectDir: string, goalId: string, note?: string): GoalRecord {
  return transitionGoal(projectDir, goalId, "abandoned", note);
}

/**
 * Attach a dispatched run to a goal's wave — the other half of the flywheel that lets
 * the event bridge find "does this run belong to a goal" in one lookup (goalForRun).
 * Defaults to the LAST wave, or creates an empty wave if the plan has none yet (a goal
 * created with no plan, dispatched into ad hoc).
 */
export function attachRunToGoal(projectDir: string, goalId: string, runId: string, waveIndex?: number): GoalRecord {
  const goal = readGoal(projectDir, goalId);
  const waves = goal.plan.waves.length
    ? goal.plan.waves.map((wave) => ({ runs: wave.runs, run_ids: [...wave.run_ids] }))
    : [{ runs: [], run_ids: [] }];
  const index = typeof waveIndex === "number" && waveIndex >= 0 && waveIndex < waves.length ? waveIndex : waves.length - 1;
  if (!waves[index].run_ids.includes(runId)) waves[index].run_ids.push(runId);
  return patchGoal(projectDir, goalId, { plan: { waves } });
}

/** Reverse lookup: which goal (if any) owns this run. Linear over goals, which stay few. */
export function goalForRun(projectDir: string, runId: string): GoalRecord | null {
  for (const goal of listGoals(projectDir)) {
    if (goal.plan.waves.some((wave) => wave.run_ids.includes(runId))) return goal;
  }
  return null;
}
