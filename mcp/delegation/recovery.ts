// Recovering a run the product otherwise cannot bring back.
//
// Two shapes, both reproduced live on the same day this module was written:
//
// 1. STOPPED ON BUDGET. A run halts itself (contract.ts's checkRunBudget, enforced by
//    supervisor.ts) with real, correct work sitting in its worktree. `kage reverify`
//    refuses (stopped is not failed/ready) and the only remedy the kernel note used to
//    name — `kage dispatch --budget-usd <n>` — starts a DIFFERENT run from scratch. This
//    file's resumeStoppedRun raises the SAME run's budget and reattaches to its SAME
//    agent session (worktree, branch, and — unlike a plain `kage retry` — its context).
//
// 2. ORPHANED. A run's supervisor process dies while its hired agent keeps working,
//    unsupervised: nothing is tracking its spend, enforcing its budget, or waiting to
//    write its eventual claim. contract.ts's isOrphaned/displayState now name this state
//    instead of showing it as ordinary "working". Once the agent itself is gone (it
//    finished naturally, or a human killed it — killOrphanedAgent, never automatic),
//    adoptOrphanedRun verifies whatever real diff it left, honestly labelled as a claim
//    nobody wrote: the agent never got the chance to report, so nothing here is quoted
//    as its words. `kage reverify` cannot do this — it re-checks an EXISTING claim, and
//    an orphaned run's supervisor died before one was ever written.
import { existsSync } from "node:fs";
import {
  type ClaimRecord,
  type RunState,
  type TaskRecord,
  RESUME_STOPPED_RUN_COMMAND,
  appendRunLedger,
  buildClaim,
  displayState,
  isOrphaned,
  isProcessAlive,
  patchRun,
  reapRun,
  readClaim,
  readRun,
  transitionRun,
  writeClaim,
} from "./contract.js";
import type { Adapter } from "./adapters/types.js";
import { compileBrief } from "./brief.js";
import { runAllChecks } from "./checks.js";
import { strictVerify } from "./config.js";
import { dispatchDetached } from "./dispatch.js";
import { git } from "./git.js";
import { steerRun } from "./steer.js";
import type { CitationText } from "./verify.js";
import { commitWorktree, worktreePath } from "./worktree.js";

export interface ResumeResult {
  ok: boolean;
  task: TaskRecord;
  message: string;
}

/**
 * Resume a run the kernel stopped, either for crossing its usd budget (raised before
 * resuming) or for appearing stalled (resumed as-is — see below), with the SAME run id,
 * worktree and branch, and — reusing steer.ts's reattach machinery — the same agent
 * session, so the agent picks up with its own context intact rather than starting cold.
 *
 * usd is the only cap that still gates a resume: a run's `spend` is frozen the instant
 * it stops (recordSpend only ever runs on a live usage tick, never while stopped), so
 * comparing that frozen figure against the run's own usd budget — right here, not the
 * stop note's prose — says whether it needs raising. minutes never stops a run any more
 * (contract.ts's checkRunBudget), so it never blocks a resume either; a caller-supplied
 * budgetMinutes is still honoured if given (a harmless raise, never silently dropped),
 * it just isn't required.
 *
 * A run the STALL DETECTOR stopped (supervisor.ts) is a different shape entirely: its
 * note begins "stalled:" and names the evidence (a repeating failing command, or turns
 * of no worktree change) — not a spend figure, because a stall is not a cost overrun.
 * No budget raise can fix a loop, so this resumes it unconditionally, with a steer
 * message that quotes the evidence back to the agent so it changes approach instead of
 * repeating exactly what caused the stall.
 */
export async function resumeStoppedRun(
  projectDir: string,
  runId: string,
  budgetUsd: number | undefined,
  budgetMinutes: number | undefined,
  adapterFor: (name: string) => Adapter,
  // Test seam: steerRun itself defaults `reattach` to dispatchDetached; threaded through
  // here so a test can reattach in-process against a scripted adapter instead of
  // spawning a real `kage supervise` child.
  reattach: (projectDir: string, task: TaskRecord) => { pid: number | undefined } = dispatchDetached,
): Promise<ResumeResult> {
  const task = readRun(projectDir, runId);
  if (task.state !== "stopped") {
    return {
      ok: false,
      task,
      message: `${runId} is ${task.state} — resume only makes sense for a run the kernel stopped (state "stopped").`,
    };
  }

  const lastStopNote = [...task.state_history].reverse().find((change) => change.note)?.note ?? "";
  const stalled = lastStopNote.startsWith("stalled:");

  const usdExceeded = task.spend.usd_est > task.budgets.usd;
  const usdRaised = budgetUsd !== undefined && Number.isFinite(budgetUsd) && budgetUsd > task.budgets.usd;
  const minutesRaised = budgetMinutes !== undefined && Number.isFinite(budgetMinutes) && budgetMinutes > task.budgets.minutes;

  if (!stalled && usdExceeded && !usdRaised) {
    return {
      ok: false,
      task,
      message:
        `${runId} stopped at $${task.spend.usd_est.toFixed(2)} spend against a $${task.budgets.usd.toFixed(2)} budget. ` +
        `Resume it with a higher usd budget: ${RESUME_STOPPED_RUN_COMMAND} — e.g. --budget-usd ${Math.max(task.spend.usd_est + 2, task.budgets.usd * 2).toFixed(2)}.`,
    };
  }

  const nextBudgets = { ...task.budgets };
  const raises: string[] = [];
  if (usdRaised) {
    nextBudgets.usd = budgetUsd as number;
    raises.push(`$${(budgetUsd as number).toFixed(2)} usd`);
  }
  if (minutesRaised) {
    nextBudgets.minutes = budgetMinutes as number;
    raises.push(`${budgetMinutes} min`);
  }
  const raiseNote = raises.length ? `budget raised (${raises.join(", ")})` : "no budget cap had tripped";

  patchRun(projectDir, runId, { budgets: nextBudgets });
  appendRunLedger(projectDir, {
    kind: "resumed",
    run_id: runId,
    budget_usd: nextBudgets.usd,
    budget_minutes: nextBudgets.minutes,
    prior_spend_usd: task.spend.usd_est,
    prior_spend_minutes: task.spend.minutes,
    ...(stalled ? { stalled: true } : {}),
  });
  const steerMessage = stalled
    ? `Resuming — this run appeared stalled and was stopped: ${lastStopNote.slice("stalled:".length).trim()}. ` +
      "Try a genuinely different approach instead of repeating whatever caused the stall."
    : `Resuming — ${raiseNote} (it stopped at $${task.spend.usd_est.toFixed(2)} / ${task.spend.minutes.toFixed(1)} min). Continue the work from where you left off.`;
  const steered = await steerRun(projectDir, runId, steerMessage, adapterFor, reattach);
  return {
    ok: true,
    task: readRun(projectDir, runId),
    message: `Resumed ${runId} — ${stalled ? "was stalled, no budget change needed" : raiseNote}. ${steered.message}`,
  };
}

export interface KillResult {
  ok: boolean;
  task: TaskRecord;
  message: string;
}

/**
 * Kill a live orphaned agent — a DELIBERATE user action, never automatic cleanup
 * (sweepDeadRuns only ever reaps a run once BOTH its supervisor and its agent are gone;
 * it must stay that way, or real in-progress work gets destroyed on a timer). The spend
 * shown is the last figure any supervisor recorded — honestly caveated, since nothing
 * has been counting it since the supervisor died.
 */
export function killOrphanedAgent(projectDir: string, runId: string): KillResult {
  const task = readRun(projectDir, runId);
  if (displayState(task) !== "orphaned") {
    return { ok: false, task, message: `${runId} is not orphaned (its supervisor is alive, or so is nothing) — nothing to kill.` };
  }
  const spendNote =
    `last recorded spend $${task.spend.usd_est.toFixed(2)} — stale: nothing has been counting it since supervisor pid ` +
    `${task.supervisor_pid} died`;
  try {
    process.kill(task.agent_pid!, "SIGTERM");
  } catch {
    // Already gone between the check above and here — fine, the transition below still
    // needs to happen so the run stops reading as orphaned.
  }
  // dispatched has no "stopped" exit in the state machine (only running does); both
  // funnel to "failed" so the SAME follow-up (kage adopt) works regardless of which
  // in-flight state the kill caught it in.
  const to: RunState = "failed";
  const updated = transitionRun(projectDir, runId, to, "user", `orphan killed by user — ${spendNote}`);
  appendRunLedger(projectDir, { kind: "orphan_killed", run_id: runId, spend_usd: task.spend.usd_est });
  return {
    ok: true,
    task: updated,
    message: `Killed ${runId}'s orphaned agent (pid ${task.agent_pid}). ${spendNote}. Recover its worktree with: kage adopt ${runId}`,
  };
}

export interface AdoptResult {
  ok: boolean;
  state: RunState;
  message: string;
}

/**
 * Whether a failed run is the orphan-shaped case adoptOrphanedRun exists for — its
 * agent gone, its note the kernel's own "agent process gone" (reapRun's default,
 * contract.ts), and a worktree still sitting there with real changes. Extracted so
 * api.ts can expose it (worktree_adoptable) as a display hint without running the
 * actual verify-and-transition adopt does just to find out; deliberately narrower than
 * what adoptOrphanedRun itself will accept (it takes any failed run with no claim and
 * a dirty worktree, orphan-shaped or not) — this is only the "show the Adopt button"
 * signal, not the route's own gate.
 */
export function isWorktreeAdoptable(projectDir: string, task: TaskRecord): boolean {
  if (task.state !== "failed") return false;
  if (isProcessAlive(task.agent_pid)) return false;
  if (readClaim(projectDir, task.id)) return false;
  const lastNote = [...task.state_history].reverse().find((change) => change.note)?.note ?? "";
  if (!/agent process gone/i.test(lastNote)) return false;
  const worktree = worktreePath(projectDir, task.id);
  if (!existsSync(worktree)) return false;
  const branchDiff = git(projectDir, ["diff", "--name-only", "HEAD", task.branch]);
  const worktreeStatus = git(worktree, ["status", "--porcelain"]);
  const hasUncommitted = worktreeStatus.ok && worktreeStatus.stdout.trim().length > 0;
  return hasUncommitted || (branchDiff.ok && Boolean(branchDiff.stdout.trim()));
}

/**
 * Verify an orphaned run's worktree when no agent claim was ever written — the gap
 * `kage reverify` cannot cross, since it re-checks an EXISTING claim's declared checks
 * and this run's supervisor died before one existed. Builds a claim from the brief's
 * own checks, honestly labelled as adopted: the statement is never attributed to the
 * agent, because the agent was never asked and never answered.
 */
export function adoptOrphanedRun(projectDir: string, runId: string): AdoptResult {
  let task = readRun(projectDir, runId);
  if (displayState(task) === "dropped") {
    reapRun(projectDir, runId);
    task = readRun(projectDir, runId);
  }
  if (isProcessAlive(task.agent_pid)) {
    return {
      ok: false,
      state: task.state,
      message: `${runId}'s agent (pid ${task.agent_pid}) is still alive — adopting now would race its writes. Kill it first (kage orphan-kill ${runId}, shows spend) or wait for it to finish.`,
    };
  }
  if (readClaim(projectDir, runId)) {
    return { ok: false, state: task.state, message: `${runId} already has a claim — use kage reverify ${runId} instead.` };
  }
  if (task.state !== "failed") {
    return {
      ok: false,
      state: task.state,
      message: `${runId} is ${task.state}, not failed with no claim — nothing to adopt.`,
    };
  }
  const worktree = worktreePath(projectDir, runId);
  if (!existsSync(worktree)) {
    return { ok: false, state: task.state, message: `${runId}'s worktree is gone — nothing to adopt.` };
  }
  const branchDiff = git(projectDir, ["diff", "--name-only", "HEAD", `${task.branch}`]);
  // dirtyPaths (git.ts) is `-uno` — deliberately blind to untracked files for its own
  // merge-collision use case. That is exactly wrong here: an agent killed mid-turn most
  // often leaves a brand-NEW file it never got to `git add`, which is the orphaned work
  // this command exists to rescue, not overlook.
  const worktreeStatus = git(worktree, ["status", "--porcelain"]);
  const hasUncommitted = worktreeStatus.ok && worktreeStatus.stdout.trim().length > 0;
  if (!hasUncommitted && (!branchDiff.ok || !branchDiff.stdout.trim())) {
    return { ok: false, state: task.state, message: `${runId}'s worktree has no changes — nothing to adopt.` };
  }

  const plan = compileBrief(projectDir, task.intent, task.type);
  const statement =
    "Adopted — no agent claim was recorded (its supervisor died before the agent's work could be verified). " +
    "The checks below assess the worktree exactly as the agent left it; this statement is Kage's own description, not the agent's.";
  const claimText: CitationText = { cited: statement, prose: "" };
  transitionRun(projectDir, runId, "verifying", "kernel", "adopted — verifying an orphaned worktree with no agent claim");
  const { checks, diff, passed } = runAllChecks(projectDir, runId, worktree, plan.checks, claimText);
  const claim: ClaimRecord = buildClaim({ runId, statement, checks, fence: null, diff });
  writeClaim(projectDir, runId, claim);
  commitWorktree(projectDir, runId, `kage: adopted — ${task.intent}\n\nRun: ${runId}\nAdopted, no agent claim.`);

  const ready = passed || !strictVerify(projectDir);
  const updated = transitionRun(
    projectDir,
    runId,
    ready ? "ready" : "failed",
    "kernel",
    ready ? "adopted, now verified" : checks.filter((check) => check.result !== "pass").map((check) => check.id).join(", "),
  );
  appendRunLedger(projectDir, { kind: "adopted", run_id: runId, passed, checks: checks.map((check) => ({ id: check.id, result: check.result })) });
  return {
    ok: true,
    state: updated.state,
    message: ready
      ? `Adopted ${runId}: verified — ready to review and merge (no agent claim; Kage's own checks passed).`
      : `Adopted ${runId}: verified, but still failing (${checks.filter((check) => check.result !== "pass").map((check) => check.id).join(", ")}).`,
  };
}
