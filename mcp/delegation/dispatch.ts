// Dispatch: the whole delegation loop in one path — compile a brief from memory, hire
// an agent in an isolated workspace, execute the checks ourselves, and record a claim
// the user can act on in two minutes.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Adapter } from "./adapters/types.js";
import { type BriefPlan, compileBrief, renderBrief } from "./brief.js";
import { strictVerify } from "./config.js";
import {
  recordSpend,
  CLAIM_PROTOCOL_VERSION,
  type ClaimRecord,
  type RunType,
  RUN_SCHEMA_VERSION,
  type TaskRecord,
  appendRunLedger,
  createRun,
  parseReportFence,
  patchRun,
  readRun,
  runDir,
  runTranscriptPath,
  runWorkDir,
  transitionRun,
  writeBrief,
  buildClaim,
  writeClaim,
} from "./contract.js";
import { dirtyPaths } from "./git.js";
import { attachRunToGoal } from "./goal.js";
import { type JudgmentInput, type ManagerJudgment, buildJudgment, writeJudgment } from "./manager.js";
import { ProgressLine } from "./progress.js";
import { draftLearnings } from "./ratify.js";
import { runStaticChecks } from "./static-checks.js";
import { verifyRun } from "./verify.js";
import { commitWorktree, createWorktree, resolveWorkspaceKind, worktreePath } from "./worktree.js";

export interface DispatchOptions {
  intent: string;
  type?: RunType;
  /** Skip execution and return the compiled brief for approval (the dispatch gate). */
  briefOnly?: boolean;
  /** Render a live progress line while the hired agent works. */
  progress?: boolean;
  /**
   * The manager's judgment on this brief. Validated and recorded by the kernel — a
   * manager may drop memories with a reason and lower confidence, never the reverse.
   */
  judgment?: Omit<JudgmentInput, "offeredMemoryIds" | "kernelConfidence">;
  /**
   * Attach this run to a goal at CREATION — before the brief is written, long before the
   * agent runs — not after the run finishes. goalForRun(runId) must resolve for the
   * run's entire life, or the orchestrator wake-loop's event bridge (room-supervisor.ts's
   * notifyManagerOfRunEvent) bails at its first guard and never wakes the manager. An
   * unknown id is a warning on the result, never a reason to fail a dispatch that already
   * created a real run.
   */
  goalId?: string;
}

// A run branches from HEAD. Uncommitted work is therefore invisible to the agent and
// collides at merge time — say so at dispatch, when it is still cheap to fix.
export function dirtyTreeWarning(projectDir: string): string | null {
  const dirty = dirtyPaths(projectDir);
  if (!dirty.length) return null;
  return (
    `${dirty.length} uncommitted file(s) in your working tree — this run branches from HEAD and will not see them ` +
    `(${dirty.slice(0, 3).join(", ")}${dirty.length > 3 ? ", …" : ""}). Commit or stash first if the task depends on that work.`
  );
}

export interface DispatchResult {
  task: TaskRecord;
  plan: BriefPlan;
  claim?: ClaimRecord;
  workspace: string;
  workspace_kind: "worktree" | "sandbox";
  /** Set when options.goalId did not resolve to a real goal — the run still dispatched. */
  goalWarning?: string;
}

export interface SteerRecord {
  id: string;
  message: string;
  at: string;
  status: "queued" | "delivered";
  delivered_at?: string;
}

function steerPath(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "steer.jsonl");
}

function makeSteerId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

/** Atomic temp+rename rewrite of the whole log — same crash-safety as task.json. */
export function writeSteerRecords(projectDir: string, runId: string, records: SteerRecord[]): void {
  const path = steerPath(projectDir, runId);
  mkdirSync(runDir(projectDir, runId), { recursive: true });
  const body = records.map((record) => JSON.stringify(record)).join("\n");
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, body ? `${body}\n` : "", "utf8");
  renameSync(tmp, path);
}

/** Every steer this run ever received, oldest first. Pre-tracking lines ({at, message},
 * no id/status) are treated as delivered history so they never look re-deliverable. */
export function readSteerRecords(projectDir: string, runId: string): SteerRecord[] {
  const path = steerPath(projectDir, runId);
  if (!existsSync(path)) return [];
  const records: SteerRecord[] = [];
  let legacyIndex = 0;
  for (const line of readFileSync(path, "utf8").split("\n").filter(Boolean)) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const message = typeof parsed.message === "string" ? parsed.message : "";
    if (!message) continue;
    if (typeof parsed.id === "string" && typeof parsed.status === "string") {
      records.push({
        id: parsed.id,
        message,
        at: typeof parsed.at === "string" ? parsed.at : new Date(0).toISOString(),
        status: parsed.status === "delivered" ? "delivered" : "queued",
        ...(typeof parsed.delivered_at === "string" ? { delivered_at: parsed.delivered_at } : {}),
      });
    } else {
      legacyIndex += 1;
      records.push({
        id: `legacy-${legacyIndex}`,
        message,
        at: typeof parsed.at === "string" ? parsed.at : new Date(0).toISOString(),
        status: "delivered",
      });
    }
  }
  return records;
}

/** Compat: plain message text, for brief re-rendering (renderBrief's "## Steering" section). */
export function readSteers(projectDir: string, runId: string): string[] {
  return readSteerRecords(projectDir, runId).map((record) => record.message);
}

/** Record a new steer as queued. Delivery is marked separately, once it actually lands. */
export function appendSteerRecord(projectDir: string, runId: string, message: string): SteerRecord {
  const record: SteerRecord = { id: makeSteerId(), message, at: new Date().toISOString(), status: "queued" };
  const records = readSteerRecords(projectDir, runId);
  records.push(record);
  writeSteerRecords(projectDir, runId, records);
  appendRunLedger(projectDir, { kind: "steer", run_id: runId, message });
  return record;
}

/** Compat wrapper for callers that only ever wrote plain messages. */
export function appendSteer(projectDir: string, runId: string, message: string): void {
  appendSteerRecord(projectDir, runId, message);
}

/** Flip one queued steer to delivered. A no-op (returns null) if it is missing or already delivered. */
export function deliverQueuedSteer(projectDir: string, runId: string, steerId: string): SteerRecord | null {
  const records = readSteerRecords(projectDir, runId);
  const index = records.findIndex((record) => record.id === steerId);
  if (index === -1 || records[index].status === "delivered") return null;
  const delivered: SteerRecord = { ...records[index], status: "delivered", delivered_at: new Date().toISOString() };
  records[index] = delivered;
  writeSteerRecords(projectDir, runId, records);
  return delivered;
}

// Worktrees need a git repo with a branch point. Without one (a scratch directory, a
// fresh repo with no commits) the run still works in a sandbox — degraded isolation,
// stated plainly, never a silent difference.
function prepareWorkspace(projectDir: string, task: TaskRecord): { dir: string; kind: "worktree" | "sandbox" } {
  // resolveWorkspaceKind throws instead of returning "sandbox" when a .git entry is
  // present but git itself is in trouble — a transient failure must never silently
  // hand the agent an empty directory.
  if (resolveWorkspaceKind(projectDir) === "worktree") {
    const handle = createWorktree(projectDir, task.id, task.branch);
    return { dir: handle.path, kind: "worktree" };
  }
  const dir = runWorkDir(projectDir, task.id);
  mkdirSync(dir, { recursive: true });
  return { dir, kind: "sandbox" };
}

export async function dispatchRun(projectDir: string, options: DispatchOptions, adapter: Adapter): Promise<DispatchResult> {
  const type = options.type ?? "chore";
  let plan = compileBrief(projectDir, options.intent, type);

  // Manager judgment is applied here, before the brief is frozen — and it is recorded
  // either way, so a kernel-default brief is distinguishable from a curated one.
  let judgment: ManagerJudgment | null = null;
  if (options.judgment) {
    judgment = buildJudgment("(pending)", {
      ...options.judgment,
      offeredMemoryIds: plan.memories.map((memory) => memory.id),
      kernelConfidence: plan.confidence.band,
    });
    const kept = new Set(judgment.kept_memory_ids);
    plan = {
      ...plan,
      memories: plan.memories.filter((memory) => kept.has(memory.id)),
      confidence: {
        band: judgment.confidence.manager,
        basis:
          judgment.confidence.manager === judgment.confidence.kernel
            ? plan.confidence.basis
            : `${plan.confidence.basis}; manager lowered it${judgment.confidence.reason ? ` — ${judgment.confidence.reason}` : ""}`,
      },
    };
  }

  const task = createRun(projectDir, {
    intent: options.intent,
    type,
    agent: adapter.name,
    confidence: plan.confidence,
    curatedBy: judgment ? "manager" : "kernel",
    // The flywheel's forward edge: which packets this brief carries (post-judgment,
    // so a memory the manager dropped is not claimed as briefed).
    briefMemoryIds: plan.memories.map((memory) => memory.id),
  });
  // Attach to the goal BEFORE the brief is written and long before the agent runs —
  // dispatchRun executes the whole run (agent work plus verification), so attaching
  // post-hoc left goalForRun(runId) returning null for the run's entire life.
  let goalWarning: string | undefined;
  if (options.goalId) {
    try {
      attachRunToGoal(projectDir, options.goalId, task.id);
    } catch (error) {
      // The run is already real — an unknown goal id is a warning, not a reason to fail
      // a dispatch that already happened.
      goalWarning = `Could not attach this run to goal ${options.goalId}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (judgment) writeJudgment(projectDir, { ...judgment, run_id: task.id });
  writeBrief(projectDir, task.id, renderBrief(task, plan));
  const briefed = transitionRun(projectDir, task.id, "briefed", "kernel");

  if (options.briefOnly) {
    return { task: briefed, plan, workspace: "", workspace_kind: "sandbox", ...(goalWarning ? { goalWarning } : {}) };
  }
  const result = await executeRun(projectDir, task.id, plan, adapter, { progress: options.progress });
  return goalWarning ? { ...result, goalWarning } : result;
}

// Execution is separate from dispatch so a held brief can be released later, and so a
// failed or blocked run can be retried with steering without recompiling its history.
export async function executeRun(
  projectDir: string,
  runId: string,
  plan: BriefPlan,
  adapter: Adapter,
  options: { progress?: boolean } = {},
): Promise<DispatchResult> {
  let task = readRun(projectDir, runId);
  const workspace = prepareWorkspace(projectDir, task);

  const steers = readSteers(projectDir, runId);
  if (steers.length) writeBrief(projectDir, runId, renderBrief(task, plan, steers));

  if (task.state === "briefed") task = transitionRun(projectDir, runId, "dispatched", "kernel");
  task = transitionRun(projectDir, runId, "running", "kernel", workspace.kind === "sandbox" ? "no git worktree — running in a sandbox" : undefined);

  const line = options.progress ? new ProgressLine(`${task.agent} · ${runId}`) : null;
  line?.start();
  line?.update({ kind: "phase", label: `${task.agent} is reading the brief` });
  // Pre-assign the session so the run can be ANSWERED later rather than restarted.
  const sessionId = randomUUID();
  patchRun(projectDir, runId, { agent_session_id: sessionId });
  const outcome = await adapter.run({
    runId,
    workDir: workspace.dir,
    briefBody: readFileSync(join(runDir(projectDir, runId), "brief.md"), "utf8"),
    transcriptPath: runTranscriptPath(projectDir, runId),
    onProgress: line ? (event) => line.update(event) : undefined,
    sessionId,
    onStart: (pid) => patchRun(projectDir, runId, { agent_pid: pid }),
  });
  recordSpend(projectDir, runId, outcome.usage);
  patchRun(projectDir, runId, { agent_session_id: outcome.session_id ?? sessionId });

  const fence = parseReportFence(outcome.final_message);
  if (fence?.kind === "plan") {
    patchRun(projectDir, runId, { waiting_on: { needs: "plan approval", detail: fence.plan ?? "" } });
    task = transitionRun(projectDir, runId, "blocked", "kernel", fence.question ?? "awaiting plan approval");
    line?.stop("⏸ blocked: awaiting plan approval");
    return { task, plan, workspace: workspace.dir, workspace_kind: workspace.kind };
  }
  // Two independent signals that an agent wants a human: its own protocol fence, and
  // the stream's blocked summary (which fires even when it asks in plain prose).
  if (fence?.kind === "blocked" || outcome.waiting) {
    const note = fence?.question ?? fence?.need ?? outcome.waiting?.detail ?? "blocked without a stated question";
    if (outcome.waiting) patchRun(projectDir, runId, { waiting_on: outcome.waiting });
    task = transitionRun(projectDir, runId, "blocked", "kernel", note);
    line?.stop(`⏸ blocked: ${note}`);
    return { task, plan, workspace: workspace.dir, workspace_kind: workspace.kind };
  }

  task = transitionRun(projectDir, runId, "verifying", "kernel");
  const statement =
    fence?.statement ?? `work delivered — see diff (agent skipped the ${CLAIM_PROTOCOL_VERSION} fence)`;
  const verification = verifyRun(
    projectDir,
    runId,
    workspace.dir,
    plan.checks,
    `${statement}\n${(fence?.learned ?? []).join("\n")}`,
    (event) => line?.update(event),
  );

  // Kernel-executed, never agent-declared: a narrowly declared (or missing) check must
  // never be the only thing standing between a broken build and 'ready'. These run on
  // every claim regardless of what the agent's own checks covered, and merge into the
  // same list the receipt's VERIFIED n/n line counts — attributed to Kage, not the agent.
  const staticResult = runStaticChecks(projectDir, runId, workspace.dir, verification.diff.paths);
  const checks = [...verification.checks, ...staticResult.checks];
  const passed = checks.every((check) => check.result === "pass");
  const claim: ClaimRecord = buildClaim({ runId, statement, checks, fence, diff: verification.diff });
  writeClaim(projectDir, runId, claim);

  // Learnings ride the branch as pending packets so they are reviewed with the code.
  if (workspace.kind === "worktree" && claim.learnings.length) {
    draftLearnings(projectDir, task, claim, verification.diff.paths);
  }
  // Commit at CLAIM time, not merge time: until the work is a commit there is no branch
  // to push, no PR to open, and nothing for a teammate to review — which defeats the
  // point of running in a branch at all. (Found on Kage's own first delegated run,
  // where `git merge` reported "Already up to date" over 66 lines of real work.)
  if (workspace.kind === "worktree") {
    commitWorktree(projectDir, runId, `kage: ${task.intent}\n\nRun: ${runId}\nClaim: ${claim.statement}`);
  }

  const strict = strictVerify(projectDir);
  const ready = passed || !strict;
  task = transitionRun(
    projectDir,
    runId,
    ready ? "ready" : "failed",
    "kernel",
    ready ? undefined : checks.filter((check) => check.result !== "pass").map((check) => check.id).join(", "),
  );
  appendRunLedger(projectDir, {
    kind: "verified",
    run_id: runId,
    type: task.type,
    passed,
    checks: checks.map((check) => ({ id: check.id, result: check.result })),
  });
  line?.stop(ready ? "✓ claim ready for review" : "✗ verification failed");
  return { task, plan, claim, workspace: workspace.dir, workspace_kind: workspace.kind };
}

/**
 * Dispatch a run under a DETACHED supervisor and return immediately.
 *
 * This is what makes a run a session rather than a job: the supervisor outlives this
 * process, so closing the console, restarting the daemon, or upgrading Kage does not kill
 * a 45-minute agent — and because the supervisor holds the agent's stdin, the run can be
 * answered and steered while it works.
 */
export function dispatchDetached(projectDir: string, task: TaskRecord): { pid: number | undefined } {
  // CommonJS build: __dirname is dist/delegation, so the CLI is one level up.
  const entry = join(__dirname, "..", "cli.js");
  const child = spawn(process.execPath, [entry, "supervise", task.id, "--project", projectDir], {
    cwd: projectDir,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  appendRunLedger(projectDir, { kind: "supervisor_spawned", run_id: task.id, pid: child.pid });
  return { pid: child.pid };
}

export function runWorkspacePath(projectDir: string, task: TaskRecord): string {
  const worktree = worktreePath(projectDir, task.id);
  return existsSync(worktree) ? worktree : runWorkDir(projectDir, task.id);
}
