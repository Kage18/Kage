// Dispatch: the whole delegation loop in one path — compile a brief from memory, hire
// an agent in an isolated workspace, execute the checks ourselves, and record a claim
// the user can act on in two minutes.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
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
import { dirtyPaths, hasCommits, isGitRepo } from "./git.js";
import { type JudgmentInput, type ManagerJudgment, buildJudgment, writeJudgment } from "./manager.js";
import { ProgressLine } from "./progress.js";
import { draftLearnings } from "./ratify.js";
import { verifyRun } from "./verify.js";
import { commitWorktree, createWorktree, worktreePath } from "./worktree.js";

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
}

function steerPath(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "steer.jsonl");
}

export function appendSteer(projectDir: string, runId: string, message: string): void {
  const path = steerPath(projectDir, runId);
  mkdirSync(runDir(projectDir, runId), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), message })}\n`, "utf8");
  appendRunLedger(projectDir, { kind: "steer", run_id: runId, message });
}

export function readSteers(projectDir: string, runId: string): string[] {
  const path = steerPath(projectDir, runId);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return (JSON.parse(line) as { message?: string }).message ?? "";
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

// Worktrees need a git repo with a branch point. Without one (a scratch directory, a
// fresh repo with no commits) the run still works in a sandbox — degraded isolation,
// stated plainly, never a silent difference.
function prepareWorkspace(projectDir: string, task: TaskRecord): { dir: string; kind: "worktree" | "sandbox" } {
  if (isGitRepo(projectDir) && hasCommits(projectDir)) {
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
  });
  if (judgment) writeJudgment(projectDir, { ...judgment, run_id: task.id });
  writeBrief(projectDir, task.id, renderBrief(task, plan));
  const briefed = transitionRun(projectDir, task.id, "briefed", "kernel");

  if (options.briefOnly) {
    return { task: briefed, plan, workspace: "", workspace_kind: "sandbox" };
  }
  return await executeRun(projectDir, task.id, plan, adapter, { progress: options.progress });
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

  const claim: ClaimRecord = buildClaim({ runId, statement, checks: verification.checks, fence, diff: verification.diff });
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
  const ready = verification.passed || !strict;
  task = transitionRun(
    projectDir,
    runId,
    ready ? "ready" : "failed",
    "kernel",
    ready ? undefined : verification.checks.filter((check) => check.result !== "pass").map((check) => check.id).join(", "),
  );
  appendRunLedger(projectDir, {
    kind: "verified",
    run_id: runId,
    type: task.type,
    passed: verification.passed,
    checks: verification.checks.map((check) => ({ id: check.id, result: check.result })),
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
