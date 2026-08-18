// Kage delegation kernel — run contract, state machine, and store.
//
// The kernel owns every guarantee. Only this module writes task.json, so an illegal
// state transition is impossible rather than discouraged: the manager (a rented agent)
// and the user REQUEST transitions; legality, history, and the append-only runs ledger
// are enforced here. All record writes are atomic (temp + rename), matching the value
// ledger's crash-safety pattern in kernel.ts.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const RUN_SCHEMA_VERSION = 1;

export const RUN_TYPES = ["bugfix", "feature", "refactor", "migration", "chore", "investigation"] as const;
export type RunType = (typeof RUN_TYPES)[number];

export const RUN_STATES = [
  "draft",
  "briefed",
  "dispatched",
  "running",
  "verifying",
  "ready",
  "blocked",
  "stopped",
  "failed",
  "merged",
  "rejected",
] as const;
export type RunState = (typeof RUN_STATES)[number];

// Lifecycle per docs/design/KAGE_DELEGATION_DESIGN.md: blocked/stopped are resumable, terminal
// states (merged/rejected/failed) have no exits.
const LEGAL_TRANSITIONS: Record<RunState, readonly RunState[]> = {
  draft: ["briefed", "failed"],
  briefed: ["dispatched", "failed"],
  dispatched: ["running", "failed"],
  running: ["verifying", "blocked", "stopped", "failed"],
  verifying: ["ready", "failed"],
  blocked: ["running", "stopped", "failed"],
  // A stopped run has no live process either — resume it, or reject it and keep why
  // as memory, same as a failed one.
  stopped: ["running", "failed", "rejected"],
  // `verifying` here is `kage reverify`: re-checking an already-ready run before merging
  // is legitimate (the worktree may have been hand-edited since), not a wasted step.
  ready: ["merged", "rejected", "verifying"],
  merged: [],
  rejected: [],
  // A failed verification is not the end of the story: retry with steering (-> running),
  // or reverify without re-running the agent at all when the defect was already fixed in
  // the worktree (-> verifying, `kage reverify`) — or reject and keep why it failed as
  // memory. Only merged/rejected are truly terminal.
  failed: ["running", "verifying", "rejected"],
};

export type RunActor = "kernel" | "manager" | "user";

export interface RunStateChange {
  state: RunState;
  at: string;
  by: RunActor;
  note?: string;
}

export interface RunBudgets {
  usd: number;
  minutes: number;
  diff_lines: number;
}

export interface RunConfidence {
  band: "low" | "medium" | "high";
  basis: string;
}

export interface TaskRecord {
  schema_version: typeof RUN_SCHEMA_VERSION;
  id: string;
  intent: string;
  type: RunType;
  state: RunState;
  agent: string;
  worktree: string | null;
  branch: string;
  budgets: RunBudgets;
  spend: { usd_est: number; minutes: number };
  /** input+output tokens the agent reported; absent when it reported nothing. */
  tokens_used?: number;
  confidence: RunConfidence;
  /**
   * Who shaped this brief: a manager agent that curated it, or kernel defaults. Recorded
   * so the value of manager judgment can be MEASURED against outcomes rather than assumed.
   */
  curated_by: "manager" | "kernel";
  /** The hired agent's own session handle — what makes answering it in place possible. */
  agent_session_id?: string;
  /** Last known child pid, so a dead process can never keep claiming to be running. */
  agent_pid?: number;
  /**
   * The detached supervisor's own pid (mcp/delegation/supervisor.ts). Verification runs
   * INSIDE the supervisor process after the hired agent's child has already exited, so
   * agent_pid alone going dead is expected mid-verification, not evidence of a dropped
   * run — liveState checks this too.
   */
  supervisor_pid?: number;
  /**
   * The memory packets the brief carried (post-judgment). One half of the flywheel:
   * a packet's view can say which runs it was briefed into. Absent on runs dispatched
   * before this field existed — the surface then says nothing, never guesses.
   */
  brief_memory_ids?: string[];
  /** The question the agent is waiting on, in its own words. */
  waiting_on?: { detail: string; needs: string };
  state_history: RunStateChange[];
  created_at: string;
  updated_at: string;
}

export type CheckResultKind = "pass" | "fail" | "unverified_no_env" | "not_run";

export interface CheckSpec {
  id: string;
  kind: "command" | "diff" | "citation";
  cmd?: string;
  expect: string;
}

export interface CheckOutcome extends CheckSpec {
  result: CheckResultKind;
  exit_code?: number;
  evidence?: string;
  /**
   * Non-failing notes on this check — e.g. a path mentioned only in prose (not formally
   * cited) that could not be resolved. Never affects `result`; shown on the receipt so a
   * reviewer sees it without having to open the evidence log.
   */
  warnings?: string[];
}

export interface ClaimRecord {
  schema_version: typeof RUN_SCHEMA_VERSION;
  run_id: string;
  statement: string;
  checks: CheckOutcome[];
  unsure: string[];
  // Freeform learned facts from the agent's claim fence in V0 step 1; they become
  // pending memory packet ids when merge-ratification lands (build step 5).
  learnings: string[];
  protocol_ok: boolean;
  /** paths is optional only because claims written before it existed lack it. */
  diff: { files: number; lines: number; paths?: string[] };
  created_at: string;
  /**
   * Set only by `kage reverify` (mcp/delegation/ratify.ts's reverifyRun): when the check
   * verdicts above were last re-run against the worktree, independent of `created_at`
   * (the original run). A reader must never mistake a stale pass recorded at `created_at`
   * for one that is actually fresh — this timestamp is the tell.
   */
  reverified_at?: string;
}

export const DEFAULT_RUN_BUDGETS: RunBudgets = { usd: 2, minutes: 30, diff_lines: 400 };

// ---------------------------------------------------------------------------
// Reporting protocol: how a hired agent ends its work. Embedded verbatim in every
// brief so the contract travels with the task. A missing/malformed fence never
// crashes anything — it degrades to a skeleton claim flagged protocol_ok=false.
export const CLAIM_PROTOCOL_VERSION = "kage-claim-v1";

export const CLAIM_PROTOCOL_INSTRUCTIONS = `## Reporting protocol (${CLAIM_PROTOCOL_VERSION})

End your FINAL message with exactly one fenced block.

When the work is done:

\`\`\`kage-claim
{"statement": "<one sentence: what is now true>", "unsure": ["<anything a reviewer should double-check>"], "learned": ["<durable, non-obvious facts discovered — empty if none>"]}
\`\`\`

When you cannot proceed without a decision or missing access:

\`\`\`kage-blocked
{"need": "<what you need>", "question": "<the single question that unblocks you>"}
\`\`\`

Before a large or risky change, propose your plan and wait for approval rather than just
starting — an explicit approval or revision is what resumes you:

\`\`\`kage-plan
{"plan": "<what you intend to do, and why>", "question": "<optional: what you want a reviewer to weigh in on>"}
\`\`\`

Never claim results of commands you did not run. Verification is executed independently;
a false claim will be caught. If a check fails or you hit a blocker, report it — do not
improvise around it.`;

export interface ReportFence {
  kind: "claim" | "blocked" | "plan";
  statement?: string;
  unsure: string[];
  learned: string[];
  need?: string;
  question?: string;
  plan?: string;
}

// Deterministic fence extraction: the LAST kage-claim/kage-blocked/kage-plan fence in
// the text wins (agents sometimes quote the protocol before following it). Malformed
// JSON or a missing required field returns null — callers degrade, never throw.
export function parseReportFence(text: string): ReportFence | null {
  const matches = [...text.matchAll(/```kage-(claim|blocked|plan)\s*\n([\s\S]*?)```/g)];
  const last = matches[matches.length - 1];
  if (!last) return null;
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(last[2]) as Record<string, unknown>;
  } catch {
    return null;
  }
  const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  if (last[1] === "claim") {
    if (typeof body.statement !== "string" || !body.statement.trim()) return null;
    return {
      kind: "claim",
      statement: body.statement.trim(),
      unsure: asStringArray(body.unsure),
      learned: asStringArray(body.learned),
    };
  }
  if (last[1] === "plan") {
    const plan = typeof body.plan === "string" ? body.plan.trim() : "";
    if (!plan) return null;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    return { kind: "plan", plan, question: question || undefined, unsure: [], learned: [] };
  }
  const need = typeof body.need === "string" ? body.need.trim() : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!need && !question) return null;
  return { kind: "blocked", need: need || undefined, question: question || undefined, unsure: [], learned: [] };
}

// ---------------------------------------------------------------------------
// Store layout + IO

export function runsDir(projectDir: string): string {
  return join(projectDir, ".agent_memory", "runs");
}

export function worktreesDir(projectDir: string): string {
  return join(projectDir, ".agent_memory", "worktrees");
}

export function runDir(projectDir: string, runId: string): string {
  return join(runsDir(projectDir), runId);
}

export function runWorkDir(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "work");
}

export function runTranscriptPath(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "transcript.jsonl");
}

export function runEvidenceDir(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "evidence");
}

function taskPath(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "task.json");
}

function claimPath(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "claim.json");
}

function briefPath(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "brief.md");
}

function runsLedgerPath(projectDir: string): string {
  return join(projectDir, ".agent_memory", "reports", "runs-ledger.jsonl");
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

export function makeRunId(intent: string, at: Date = new Date()): string {
  // Own sanitizer (not kernel slugify, whose fallback word is "memory"): run ids must
  // be predictable from the intent alone.
  const cleaned = intent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const slug = (cleaned || "run").slice(0, 40).replace(/-+$/, "");
  const yymmdd = at.toISOString().slice(2, 10).replace(/-/g, "");
  const hash = createHash("sha256").update(`${intent}\n${at.toISOString()}\n${process.pid}`).digest("hex").slice(0, 4);
  return `${slug}-${yymmdd}-${hash}`;
}

// Runs and worktrees are local working state — the durable record of accepted work is
// the PR plus ratified packets plus the runs ledger. Keep both out of version control;
// idempotent so repeat dispatches never duplicate lines.
//
// The derived stores matter here too: a run's worktree writes audit/index/report files
// as a side effect of capture, and if those are tracked they land in the run's commit
// and pollute the review diff with bookkeeping (seen on the first real dogfood run).
// Only packets/ — the knowledge itself — is meant to travel.
export function ensureDelegationIgnores(projectDir: string): void {
  const ignorePath = join(projectDir, ".gitignore");
  const needed = [
    ".agent_memory/runs/",
    ".agent_memory/goals/",
    ".agent_memory/worktrees/",
    ".agent_memory/audit/",
    ".agent_memory/indexes/",
    ".agent_memory/reports/",
    ".agent_memory/graph/",
    ".agent_memory/code_graph/",
    ".agent_memory/structural/",
    ".agent_memory/review/",
    ".agent_memory/pending/",
  ];
  const existing = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
  const lines = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
  const missing = needed.filter((line) => !lines.has(line));
  if (!missing.length) return;
  const prefix = existing.length && !existing.endsWith("\n") ? "\n" : "";
  appendFileSync(ignorePath, `${prefix}${missing.join("\n")}\n`, "utf8");
}

// Monotonic per-process sequence. Timestamps cannot order this log: transitionRun and
// appendRunLedger fire back to back and routinely share a millisecond, so a
// timestamp-based cursor drops the second event of any such pair FOREVER. The manager
// polls that cursor at every turn boundary, so those drops are silent and permanent.
let ledgerSeq = 0;

function nextSeq(projectDir: string): number {
  if (ledgerSeq === 0) {
    // Resume above whatever is already on disk so ids stay monotonic across processes.
    try {
      const lines = readFileSync(runsLedgerPath(projectDir), "utf8").trimEnd().split("\n").filter((line) => line.trim());
      for (let index = lines.length - 1; index >= 0 && ledgerSeq === 0; index -= 1) {
        const seq = Number((JSON.parse(lines[index]) as { seq?: unknown }).seq);
        if (Number.isFinite(seq) && seq > 0) ledgerSeq = seq;
      }
      // A ledger written before sequencing has no seq at all. Readers treat those lines
      // as seq = line number, so start after the last one or new events would collide
      // with the implicit numbering and be replayed forever.
      if (ledgerSeq === 0) ledgerSeq = lines.length;
    } catch {
      // No ledger yet, or an unreadable one: start from zero.
    }
  }
  ledgerSeq += 1;
  return ledgerSeq;
}

export function appendRunLedger(projectDir: string, event: Record<string, unknown>): void {
  try {
    const path = runsLedgerPath(projectDir);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify({ at: nowIso(), seq: nextSeq(projectDir), ...event })}\n`, "utf8");
  } catch {
    // The ledger is telemetry for reports/track record; it must never break a run.
    // (This swallow is correct for telemetry and would be fatal for an event bus —
    // which is why the bus is SSE notifications over task.json, not this file.)
  }
}

export interface CreateRunInput {
  intent: string;
  type: RunType;
  agent: string;
  budgets?: Partial<RunBudgets>;
  confidence?: RunConfidence;
  curatedBy?: "manager" | "kernel";
  briefMemoryIds?: string[];
}

/**
 * Tag written onto every packet a run ratifies, linking memory back to the run that
 * taught it — the other half of the flywheel. Owned here so ratification (writer)
 * and the memory view (reader) can never drift apart on the format.
 */
export const RUN_TAG_PREFIX = "kage-run:";
export function runTag(runId: string): string {
  return `${RUN_TAG_PREFIX}${runId}`;
}

const RUN_TITLE_MAX_LENGTH = 96;

/**
 * Short display title derived from a run's raw intent. Intents are meant to be detailed
 * ("what should change, and how you'll know it worked") and can run to thousands of
 * characters, so every display surface renders this instead of task.intent directly —
 * pure derivation, never changes what is sent to the kernel or stored on the record.
 */
export function runTitle(run: TaskRecord): string {
  const raw = (run.intent ?? "").trim();
  if (!raw) return run.id;
  const firstLine = raw.split(/\r?\n/)[0];
  const sentenceMatch = firstLine.match(/^[^.!?]*[.!?]/);
  const picked = sentenceMatch ? sentenceMatch[0] : firstLine;
  const collapsed = picked.replace(/\s+/g, " ").trim().replace(/[.,;:!?]+$/, "").trim();
  const title = collapsed || run.id;
  if (title.length <= RUN_TITLE_MAX_LENGTH) return title;
  const ellipsis = "…";
  const budget = RUN_TITLE_MAX_LENGTH - ellipsis.length;
  let truncated = title.slice(0, budget);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 0) truncated = truncated.slice(0, lastSpace);
  return `${truncated.trimEnd()}${ellipsis}`;
}

export function createRun(projectDir: string, input: CreateRunInput): RunView {
  const intent = input.intent.trim();
  if (!intent) throw new Error("Run intent must be a non-empty string.");
  if (!RUN_TYPES.includes(input.type)) throw new Error(`Unknown run type: ${input.type}. One of: ${RUN_TYPES.join(", ")}`);
  const at = nowIso();
  const id = makeRunId(intent);
  const task: TaskRecord = {
    schema_version: RUN_SCHEMA_VERSION,
    id,
    intent,
    type: input.type,
    state: "draft",
    agent: input.agent,
    worktree: null,
    branch: `kage/${id}`,
    budgets: { ...DEFAULT_RUN_BUDGETS, ...(input.budgets ?? {}) },
    spend: { usd_est: 0, minutes: 0 },
    confidence: input.confidence ?? { band: "low", basis: "no track record yet" },
    curated_by: input.curatedBy ?? "kernel",
    ...(input.briefMemoryIds?.length ? { brief_memory_ids: input.briefMemoryIds } : {}),
    state_history: [{ state: "draft", at, by: "kernel" }],
    created_at: at,
    updated_at: at,
  };
  ensureDelegationIgnores(projectDir);
  atomicWriteJson(taskPath(projectDir, id), task);
  appendRunLedger(projectDir, { kind: "run_created", run_id: id, type: task.type, agent: task.agent, curated_by: task.curated_by });
  return toRunView(task);
}

export function readRun(projectDir: string, runId: string): RunView {
  const path = taskPath(projectDir, runId);
  if (!existsSync(path)) throw new Error(`No run found: ${runId}`);
  return toRunView(JSON.parse(readFileSync(path, "utf8")) as TaskRecord);
}

export function listRuns(projectDir: string): RunView[] {
  const dir = runsDir(projectDir);
  if (!existsSync(dir)) return [];
  const runs: RunView[] = [];
  for (const entry of readdirSync(dir)) {
    const path = taskPath(projectDir, entry);
    if (!existsSync(path)) continue;
    try {
      runs.push(toRunView(JSON.parse(readFileSync(path, "utf8")) as TaskRecord));
    } catch {
      // A torn record never breaks listing; repair tooling can pick it up later.
    }
  }
  return runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Merge fields into a run record without touching its state machine. */
/**
 * Record what a run actually cost, from the agent CLI's own report. One function,
 * called by BOTH execution paths (dispatch foreground, supervisor detached), because
 * the claim assembly drifted the last time each path hand-rolled the same write.
 * Never estimates: absent usage leaves spend untouched rather than inventing zeros
 * that read as "measured free".
 */
export function recordSpend(
  projectDir: string,
  runId: string,
  usage: { usd: number; tokens: number } | undefined,
): void {
  if (!usage || (usage.usd <= 0 && usage.tokens <= 0)) return;
  const task = readRun(projectDir, runId);
  const started = task.state_history.find((entry) => entry.state === "running")?.at ?? task.created_at;
  const minutes = Math.max(0, (Date.now() - new Date(started).getTime()) / 60_000);
  patchRun(projectDir, runId, {
    spend: { usd_est: Math.round(usage.usd * 10_000) / 10_000, minutes: Math.round(minutes * 10) / 10 },
    tokens_used: usage.tokens,
  });
}

export function patchRun(projectDir: string, runId: string, patch: Partial<TaskRecord>): RunView {
  const task = { ...readRun(projectDir, runId), ...patch, updated_at: nowIso() };
  atomicWriteJson(join(runDir(projectDir, runId), "task.json"), task);
  return toRunView(task);
}

/**
 * A process that is gone cannot be "running". Sticky states with no second source of
 * truth are the classic orchestrator lie (AO shipped a phantom `waiting_input` that
 * stuck forever); the pid is a fact we already hold, so cross-check against it.
 */
export function isProcessAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function liveState(task: TaskRecord): { state: RunState; stale: boolean } {
  // verifying counts as in-flight: the checks run inside the same supervisor process,
  // so a verifying record with no live pid is exactly as dead as a running one. Rows
  // sat at "verifying · no activity yet" for sixteen hours because this list missed it.
  //
  // During verifying, the hired agent's child has already exited BY DESIGN — the
  // supervisor performs the checks itself after the agent is gone — so agent_pid alone
  // is dead for the entire verification phase even on a perfectly healthy run. Alive
  // means either the agent or its supervisor is still around; only when neither exists
  // is the run actually stale.
  const inFlight = task.state === "running" || task.state === "dispatched" || task.state === "verifying";
  if (inFlight && !isProcessAlive(task.agent_pid) && !isProcessAlive(task.supervisor_pid)) {
    return { state: task.state, stale: true };
  }
  return { state: task.state, stale: false };
}

/**
 * What a run IS, as far as any human-facing surface is concerned.
 *
 * There must be exactly one answer to this question. The first version derived it in two
 * of four surfaces, so the TUI called a dead run "dropped" while the manager's room state
 * and the while-you-were-away digest still called it "running" — the same product
 * reporting two different truths about the same run, which is the one thing it cannot
 * afford. `readRun`/`listRuns` now attach this, so rendering the raw state is an opt-out.
 */
export type DisplayState = RunState | "dropped";

export function displayState(task: TaskRecord): DisplayState {
  return liveState(task).stale ? "dropped" : task.state;
}

/** Who owns the next move — the question a board's columns should answer. */
export type Ownership = "working" | "needs_you" | "done";

export function ownership(task: TaskRecord): Ownership {
  const shown = displayState(task);
  if (shown === "merged" || shown === "rejected") return "done";
  // "stopped" belongs here too: a stopped run cannot make progress by itself — a
  // human must resume or reject it. It was mapped to "working" for months and the
  // three-door UI hid the contradiction (the inbox never listed it, the run list
  // filed it under Working, the board filed it under Lost); the unified work
  // surface showed all three stories at once and exposed it.
  if (shown === "ready" || shown === "blocked" || shown === "failed" || shown === "dropped" || shown === "stopped") {
    return "needs_you";
  }
  return "working";
}

/** A run record with its derived truth attached, so surfaces cannot disagree. */
export interface RunView extends TaskRecord {
  display_state: DisplayState;
  ownership: Ownership;
  /** True when the recorded state and reality disagree (process gone). */
  stale: boolean;
}

/**
 * Persist death.
 *
 * Display state is derived, but "this process is gone" is a FACT, and leaving it underived
 * means the run holds a concurrency slot forever and the state machine disagrees with
 * every board on every read. Called by anything that notices; safe to call repeatedly.
 */
export function reapRun(projectDir: string, runId: string, note = "agent process gone"): RunView | null {
  const task = readRun(projectDir, runId);
  if (task.display_state !== "dropped") return null;
  // `failed` keeps it retryable and rejectable — a lost run is not a terminal verdict.
  const reaped = transitionRun(projectDir, runId, "failed", "kernel", note);
  appendRunLedger(projectDir, { kind: "reaped", run_id: runId, note });
  return reaped;
}

/**
 * Persist death for every run that has derived it. reapRun existed with ZERO callers —
 * the law was written and never executed, so a dead run stayed a derived "dropped"
 * forever: holding its concurrency slot, sitting in Lost with no ledger entry, and
 * showing "no activity yet" for as long as anyone cared to look. The daemon calls this
 * at startup and on a timer; it is idempotent and cheap (one listRuns pass).
 */
export function sweepDeadRuns(projectDir: string, graceMs = 5 * 60_000): RunView[] {
  const reaped: RunView[] = [];
  for (const run of listRuns(projectDir)) {
    if (run.display_state !== "dropped") continue;
    // Grace: a supervisor that just started may not have written its pid yet.
    const last = run.state_history[run.state_history.length - 1];
    if (last && Date.now() - new Date(last.at).getTime() < graceMs) continue;
    const result = reapRun(projectDir, run.id);
    if (result) reaped.push(result);
  }
  return reaped;
}

export function toRunView(task: TaskRecord): RunView {
  const { stale } = liveState(task);
  return { ...task, display_state: displayState(task), ownership: ownership(task), stale };
}

/**
 * How many runs are genuinely in flight. Counted from the records themselves, because a
 * "running" record whose process is gone must not hold a concurrency slot forever — the
 * failure mode where a fleet silently stops dispatching and nobody knows why.
 */
export function activeRunCount(projectDir: string): number {
  return listRuns(projectDir).filter((run) => run.display_state === "running" || run.display_state === "dispatched").length;
}

export class ConcurrencyLimitError extends Error {
  constructor(readonly limit: number) {
    super(`${limit} run(s) already in flight — this is the configured limit (kage config --max-concurrent N to change it)`);
    this.name = "ConcurrencyLimitError";
  }
}

/**
 * The gate lives HERE, at the transition into `running`, rather than in whichever surface
 * happens to dispatch. The CLI, the TUI and the daemon all pass through this function, so
 * one limit governs them all; a scheduler in the daemon alone would be bypassed by the
 * other two.
 */
function assertConcurrencyAllows(projectDir: string, task: TaskRecord, to: RunState): void {
  if (to !== "running") return;
  if (task.state === "running") return;
  // Resuming a blocked/stopped run is not new work — it is finishing existing work, and
  // refusing it would strand the very runs that need a human most.
  if (task.state === "blocked" || task.state === "stopped" || task.state === "failed") return;
  const limit = readMaxConcurrent(projectDir);
  if (limit <= 0) return;
  if (activeRunCount(projectDir) >= limit) throw new ConcurrencyLimitError(limit);
}

// Read the limit without importing config.ts (which imports this module).
function readMaxConcurrent(projectDir: string): number {
  try {
    const raw = JSON.parse(readFileSync(join(projectDir, ".agent_memory", "config.json"), "utf8")) as {
      max_concurrent?: number;
      delegation?: { max_concurrent?: number };
    };
    const value = Number(raw.delegation?.max_concurrent ?? raw.max_concurrent);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_CONCURRENT;
  } catch {
    return DEFAULT_MAX_CONCURRENT;
  }
}

export const DEFAULT_MAX_CONCURRENT = 3;

export function transitionRun(projectDir: string, runId: string, to: RunState, by: RunActor, note?: string): RunView {
  const task = readRun(projectDir, runId);
  const legal = LEGAL_TRANSITIONS[task.state] ?? [];
  if (!legal.includes(to)) {
    throw new Error(`Illegal transition for ${runId}: ${task.state} → ${to} (legal: ${legal.join(", ") || "none — terminal state"})`);
  }
  assertConcurrencyAllows(projectDir, task, to);
  const at = nowIso();
  const change: RunStateChange = { state: to, at, by, ...(note ? { note } : {}) };
  const from = task.state;
  task.state = to;
  task.updated_at = at;
  task.state_history.push(change);
  atomicWriteJson(taskPath(projectDir, runId), task);
  appendRunLedger(projectDir, { kind: "state", run_id: runId, from, to, by, ...(note ? { note } : {}) });
  return toRunView(task);
}

export function writeBrief(projectDir: string, runId: string, content: string): void {
  const path = briefPath(projectDir, runId);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, path);
}

export function readBrief(projectDir: string, runId: string): string {
  return readFileSync(briefPath(projectDir, runId), "utf8");
}

/**
 * The ONE place a ClaimRecord is assembled. dispatch.ts (foreground runs) and
 * supervisor.ts (detached runs — the path real users hit) each hand-rolled this
 * object, and they drifted: a schema addition landed in one and not the other, so
 * every detached run silently lacked the new field while every test that exercised
 * the foreground path passed. If the claim grows a field, it grows here.
 */
export function buildClaim(input: {
  runId: string;
  statement: string;
  checks: ClaimRecord["checks"];
  fence: { unsure?: string[]; learned?: string[] } | null;
  diff: { files: number; lines: number; paths: string[] };
}): ClaimRecord {
  return {
    schema_version: RUN_SCHEMA_VERSION,
    run_id: input.runId,
    statement: input.statement,
    checks: input.checks,
    unsure: input.fence?.unsure ?? [],
    learnings: input.fence?.learned ?? [],
    protocol_ok: Boolean(input.fence),
    diff: { files: input.diff.files, lines: input.diff.lines, paths: input.diff.paths },
    created_at: new Date().toISOString(),
  };
}

export function writeClaim(projectDir: string, runId: string, claim: ClaimRecord): void {
  atomicWriteJson(claimPath(projectDir, runId), claim);
}

export function readClaim(projectDir: string, runId: string): ClaimRecord | null {
  const path = claimPath(projectDir, runId);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as ClaimRecord;
}

// ---------------------------------------------------------------------------
// Card rendering: kernel facts render as cards; the manager narrates in prose but
// never restates these numbers (constitution law 11).

export function renderRunLine(task: TaskRecord): string {
  const intent = task.intent.length > 64 ? `${task.intent.slice(0, 61)}...` : task.intent;
  return `[${task.state}] ${task.id} · ${task.type} · ${task.agent} · ${intent}`;
}

export function renderRunCard(task: TaskRecord, claim?: ClaimRecord | null): string {
  const lines = [renderRunLine(task)];
  const lastNote = [...task.state_history].reverse().find((change) => change.note)?.note;
  if (task.state === "blocked" && lastNote) lines.push(`  blocked  ${lastNote}`);
  if (claim) {
    const checksRun = claim.checks.filter((check) => check.result !== "not_run").length;
    const checksPassed = claim.checks.filter((check) => check.result === "pass").length;
    lines.push(`  claim    "${claim.statement}"${claim.protocol_ok ? "" : " · protocol MISSED (skeleton from diff)"}`);
    lines.push(`  checks   ${checksPassed}/${checksRun} passed (${claim.checks.length} defined) · diff ${claim.diff.files} files / ${claim.diff.lines} lines`);
    if (claim.unsure.length) lines.push(`  unsure   ${claim.unsure.join(" · ")}`);
    if (claim.learnings.length) lines.push(`  learned  ${claim.learnings.length} candidate(s)`);
  }
  return lines.join("\n");
}
