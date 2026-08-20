// The run supervisor — one detached process per run, holding one agent's stdin.
//
// This is what turns a dispatch from a job into a *session*. AO's agents live in tmux
// panes for the whole session and answering means writing into the live pane; Conductor
// parks the agent on its own question rather than restarting it. Both are only possible
// because something holds the process. A one-shot `claude -p` cannot be steered, cannot
// be answered, and loses its context the moment it blocks.
//
// It is a separate process from the daemon on purpose: a daemon restart — crash, upgrade,
// `daemon stop` — must never kill a 45-minute agent mid-edit.
import type { ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { createServer, type Socket } from "node:net";
import { appendFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { adapterByName } from "./adapters/index.js";
import {
  usageFrom, sessionIdFrom, waitingSignal } from "./adapters/cli-agent.js";
import type { Adapter } from "./adapters/types.js";
import { compileBrief, renderBrief } from "./brief.js";
import { runAllChecks } from "./checks.js";
import { strictVerify } from "./config.js";
import { deliverQueuedSteer, readSteerRecords } from "./dispatch.js";
import { git } from "./git.js";
import {
  recordSpend,
  buildClaim,
  checkRunBudget,
  CLAIM_PROTOCOL_VERSION,
  type ClaimRecord,
  RUN_SCHEMA_VERSION,
  appendRunLedger,
  concurrencyStatus,
  parseReportFence,
  patchRun,
  readBrief,
  readRun,
  runDir,
  runSupervisorLogPath,
  runTranscriptPath,
  runWorkDir,
  transitionRun,
} from "./contract.js";
import { progressFromStreamEvent } from "./progress.js";
import { draftLearnings } from "./ratify.js";
import type { CitationText } from "./verify.js";
import { commitWorktree, createWorktree, resolveWorkspaceKind, worktreePath } from "./worktree.js";

export interface SupervisorRecord {
  run_id: string;
  pid: number;
  socket: string;
  started_at: string;
}

/**
 * Control sockets live in the system temp dir, NOT beside the run.
 *
 * Unix domain socket paths are capped at ~104 bytes; a run directory nested under a long
 * project path blows straight past that, and `listen` then fails asynchronously — which
 * killed the supervisor outright the first time this ran for real. A short hashed name
 * is bounded no matter how deep the repo lives.
 */
export function socketPath(projectDir: string, runId: string): string {
  const digest = createHash("sha256").update(`${resolve(projectDir)}\0${runId}`).digest("hex").slice(0, 16);
  return join(tmpdir(), `kage-${digest}.sock`);
}

export function supervisorRecordPath(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "supervisor.json");
}

export type ControlOp =
  | { op: "tell"; message: string; steerId?: string }
  | { op: "interrupt" }
  | { op: "stop" }
  | { op: "status" };

export interface ControlReply {
  ok: boolean;
  /** Honest delivery reporting: a buffered write is not a delivery. */
  delivered?: boolean;
  state?: string;
  detail?: string;
}

/** stream-json injection format, verified against the live CLI. */
export function userMessageFrame(message: string): string {
  return `${JSON.stringify({ type: "user", message: { role: "user", content: message }, parent_tool_use_id: null })}\n`;
}

export function interruptFrame(requestId = "kage-interrupt"): string {
  return `${JSON.stringify({ type: "control_request", request_id: requestId, request: { subtype: "interrupt" } })}\n`;
}

// ---------------------------------------------------------------------------
// Stall detection — the hazard per-run budgets were actually standing in for. Five
// runs stopped on budget in one day; all five were legitimate work that later merged
// clean, and zero runaways were ever caught. The real hazard at max_concurrent 3,
// unattended, is an agent LOOPING: retrying the same failing command, or grinding with
// no forward progress at all. Cost is a bad proxy for that — this looks at what the
// agent is actually doing instead.
//
// Evaluated once per TURN (a stream `result` event), never per tool call: a long single
// turn that runs many commands is exactly the shape of real, productive work and must
// never trip this on its own. Two independent triggers, both conservative on purpose:
//
//   (a) the SAME command fails with the SAME exit code STALL_SAME_COMMAND_STREAK turns
//       in a row — a classic retry loop. Broken by any turn without that failure.
//   (b) STALL_NO_DIFF_STREAK consecutive turns produce no change to the worktree's
//       `git diff --stat` — no forward progress at all. Six, not fewer: a legitimate
//       research/exploration phase (reading code, running different read-only commands,
//       no edits yet) must survive, so this needs a genuinely long run of turns with
//       truly nothing changing before it fires.
export const STALL_SAME_COMMAND_STREAK = 3;
export const STALL_NO_DIFF_STREAK = 6;
// A real shell exit code is never negative in practice; this sentinel means "the turn's
// tool result reported failure but no numeric code could be found in it" — still a
// valid signal for streak-counting (it is only ever compared for equality against the
// SAME command's own prior code), just never printed as if it were a real number.
const STALL_UNKNOWN_EXIT_CODE = -1;

export interface TurnCommandResult {
  command: string;
  exitCode: number;
  failed: boolean;
}

export interface StallTurnSummary {
  commands: TurnCommandResult[];
  /** sha256 of `git diff --stat` in the worktree at the end of this turn, or null when
   * there is no worktree to diff (a sandbox run) — never counted toward (b) either way. */
  diffHash: string | null;
}

export interface StallState {
  lastFailingCommand: string | null;
  lastFailingExitCode: number | null;
  sameCommandStreak: number;
  lastDiffHash: string | null;
  noDiffStreak: number;
}

export function initialStallState(): StallState {
  return { lastFailingCommand: null, lastFailingExitCode: null, sameCommandStreak: 0, lastDiffHash: null, noDiffStreak: 0 };
}

export interface StallTrigger {
  /** Leads with "stalled:" and names the exact evidence — never a generic "stopped". */
  reason: string;
}

/**
 * Pure state transition: one turn in, the next detector state and a trigger (if either
 * threshold was just crossed) out. Pure and side-effect-free so it is unit-testable
 * without a live agent process, same reasoning as contract.ts's checkRunBudget.
 */
export function evaluateStallTurn(
  state: StallState,
  turn: StallTurnSummary,
): { state: StallState; trigger: StallTrigger | null } {
  // (a) same failing command streak. Only the LAST failing command in the turn stands
  // for it — a turn with several different failures still ends on whatever the agent
  // most recently tried.
  const failing = [...turn.commands].reverse().find((c) => c.failed);
  let sameCommandStreak = 0;
  let lastFailingCommand: string | null = null;
  let lastFailingExitCode: number | null = null;
  let trigger: StallTrigger | null = null;

  if (failing) {
    const continuesStreak = failing.command === state.lastFailingCommand && failing.exitCode === state.lastFailingExitCode;
    sameCommandStreak = continuesStreak ? state.sameCommandStreak + 1 : 1;
    lastFailingCommand = failing.command;
    lastFailingExitCode = failing.exitCode;
    if (sameCommandStreak >= STALL_SAME_COMMAND_STREAK) {
      trigger = {
        reason:
          failing.exitCode === STALL_UNKNOWN_EXIT_CODE
            ? `stalled: \`${failing.command}\` failed on ${sameCommandStreak} consecutive turns`
            : `stalled: \`${failing.command}\` failed with exit ${failing.exitCode} on ${sameCommandStreak} consecutive turns`,
      };
    }
  }
  // A turn with no failing command breaks the streak — only CONSECUTIVE failures count.

  // (b) no-diff streak — independent of (a); either alone can trigger. The very first
  // turn (state.lastDiffHash === null) can never count as "unchanged": there is no prior
  // turn to compare against yet.
  const noDiffStreak =
    turn.diffHash !== null && state.lastDiffHash !== null && turn.diffHash === state.lastDiffHash ? state.noDiffStreak + 1 : 0;
  if (!trigger && noDiffStreak >= STALL_NO_DIFF_STREAK) {
    trigger = { reason: `stalled: ${noDiffStreak} consecutive turns produced no change to the worktree diff` };
  }

  return {
    state: {
      lastFailingCommand,
      lastFailingExitCode,
      sameCommandStreak,
      lastDiffHash: turn.diffHash ?? state.lastDiffHash,
      noDiffStreak,
    },
    trigger,
  };
}

/** `git -C <worktree> diff --stat`, hashed — one shell-out per turn, never more. */
function diffStatHash(worktree: string): string | null {
  const result = git(worktree, ["diff", "--stat"]);
  if (!result.ok) return null;
  return createHash("sha256").update(result.stdout).digest("hex");
}

/** Tracks Bash tool_use blocks awaiting their tool_result, keyed by tool_use_id. */
function recordBashToolUse(line: string, pending: Map<string, string>): void {
  let event: { message?: { content?: Array<{ type?: string; id?: string; name?: string; input?: Record<string, unknown> }> } };
  try {
    event = JSON.parse(line) as typeof event;
  } catch {
    return;
  }
  for (const block of event.message?.content ?? []) {
    if (block.type !== "tool_use" || block.name !== "Bash" || typeof block.id !== "string") continue;
    const command = block.input?.command;
    if (typeof command === "string") pending.set(block.id, command);
  }
}

function flattenToolResultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => (block && typeof block === "object" && typeof (block as { text?: unknown }).text === "string" ? (block as { text: string }).text : ""))
      .join("\n");
  }
  return "";
}

function extractExitCode(text: string): number | null {
  const match = text.match(/exit\s*(?:code|status)\s*:?\s*(-?\d+)/i);
  return match ? Number(match[1]) : null;
}

/** Resolves a Bash tool_result against its recorded tool_use, if this line is one. */
function bashResultFromStreamEvent(line: string, pending: Map<string, string>): TurnCommandResult | null {
  let event: { message?: { content?: Array<{ type?: string; tool_use_id?: string; is_error?: boolean; content?: unknown }> } };
  try {
    event = JSON.parse(line) as typeof event;
  } catch {
    return null;
  }
  for (const block of event.message?.content ?? []) {
    if (block.type !== "tool_result" || typeof block.tool_use_id !== "string") continue;
    const command = pending.get(block.tool_use_id);
    if (!command) continue;
    pending.delete(block.tool_use_id);
    if (block.is_error !== true) return { command, exitCode: 0, failed: false };
    const exitCode = extractExitCode(flattenToolResultText(block.content)) ?? STALL_UNKNOWN_EXIT_CODE;
    return { command, exitCode, failed: true };
  }
  return null;
}

interface SupervisorState {
  usage?: { usd: number; tokens: number };
  waiting?: { detail: string; needs: string };
  sessionId?: string;
  finalMessage: string;
  stopped: boolean;
  /**
   * Set instead of a generic "stopped by request" note when the kernel itself halted
   * the run for crossing its budget — names the limit and the actual figure so the
   * final `stopped` transition (and everything that reads its note) can tell a budget
   * halt apart from a user-requested stop.
   */
  budgetHalted?: string;
  /**
   * Set instead of a generic "stopped by request" note when the STALL DETECTOR halted
   * the run — names the exact evidence (a repeating failing command, or turns of no
   * worktree change), never a spend figure, because a stall is not a cost overrun.
   */
  stallHalted?: string;
}

/**
 * Runs the whole life of one run, in this process, until the agent finishes.
 * Returns when verification is written and the run has left `running`.
 *
 * `adapterOverride` exists for tests: superviseRun otherwise resolves the adapter from
 * the task's stored agent name, but a stub with a scripted spawnLive is how the
 * blocked → tell → claim loop gets exercised without a real coding-agent CLI installed.
 */
export async function superviseRun(projectDir: string, runId: string, adapterOverride?: Adapter): Promise<void> {
  const dir = runDir(projectDir, runId);
  mkdirSync(dir, { recursive: true });
  // The supervisor's own trail, written synchronously (appendFileSync, not a stream) so
  // a step is durable on disk the instant it happens — a crash one line later must never
  // erase the line before it. This is the FIRST thing superviseRun does, ahead of even
  // reading the run record, so a death during brief compilation or worktree creation
  // (reproduced live: dead within seconds of dispatch) still leaves a last-known-step.
  const slog = (label: string): void => {
    try {
      appendFileSync(runSupervisorLogPath(projectDir, runId), `${new Date().toISOString()} ${label}\n`, "utf8");
    } catch {
      // The diagnostic log must never be why a run fails.
    }
  };
  slog(`supervisor started, pid ${process.pid}`);

  const task = readRun(projectDir, runId);

  // Concurrency admission — BEFORE any resource is committed (worktree, agent child),
  // not after. The gate used to live only in transitionRun's own briefed→dispatched→
  // running bookkeeping, which this function only reaches AFTER spawning the agent
  // child: admit at dispatch, spawn, THEN check, then die on a full slate — orphaning a
  // live, already-working agent that nothing was left tracking, budgeting, or waiting to
  // collect a claim from. Reproduced live: every orphan traced back to a full slate at
  // exactly this moment. A resume (blocked/stopped/failed) is exempt, same as
  // assertConcurrencyAllows below — it is finishing existing work, not new work, and the
  // run it would strand is the one that most needs a human already.
  const isResuming = task.state === "blocked" || task.state === "stopped" || task.state === "failed";
  if (!isResuming) {
    // Exclude runId itself — see contract.ts's activeRunCount for the reproduced bug: a
    // run counting its OWN record turns a configured cap of N into an effective N-1 plus
    // an orphaned agent on every Nth dispatch.
    const status = concurrencyStatus(projectDir, runId);
    if (!status.admits) {
      slog(`queued — ${status.active}/${status.limit} run(s) already in flight; waiting for a free slot, no agent spawned`);
      // Left exactly where it was (typically "briefed") rather than transitioned or
      // failed — a legal, resumable state. waiting_on names why, the same field a
      // blocked run uses, so any surface that already renders it shows this too.
      // dispatch.ts's reclaimQueuedRuns is what re-admits it: the daemon's existing
      // reap timer calls it on the same cadence as sweepDeadRuns, and it re-dispatches
      // any run carrying exactly this marker once a slot frees up.
      patchRun(projectDir, runId, {
        waiting_on: {
          needs: "a free run slot",
          detail: `${status.limit} run(s) already in flight — the configured limit (kage config --max-concurrent N to change it)`,
        },
      });
      appendRunLedger(projectDir, { kind: "queued_at_cap", run_id: runId, limit: status.limit, active: status.active });
      return;
    }
  }

  const plan = compileBrief(projectDir, task.intent, task.type);
  slog("brief compiled");
  // Recorded before anything else: verification (below) runs in THIS process after the
  // hired agent's child has already exited, so liveState needs this pid to know the run
  // is still alive once agent_pid alone goes dead by design.
  patchRun(projectDir, runId, { supervisor_pid: process.pid });

  // Workspace: a real worktree when git allows, else a sandbox — stated, never silent.
  // resolveWorkspaceKind throws rather than choosing "sandbox" when a .git entry is
  // present but git itself is in trouble (not merely "no commits yet") — a transient
  // failure must never silently hand the agent an empty directory.
  let workspace: string;
  const workspaceKind = resolveWorkspaceKind(projectDir);
  if (workspaceKind === "worktree") {
    workspace = createWorktree(projectDir, runId, task.branch).path;
    // Durable before the agent is spawned below — this is the exact fact recovery had to
    // reconstruct by hand (lsof on a live orphan's cwd) when the record never carried it.
    patchRun(projectDir, runId, { worktree: workspace });
    slog(`worktree created and persisted: ${workspace}`);
  } else {
    workspace = runWorkDir(projectDir, runId);
    mkdirSync(workspace, { recursive: true });
    slog(`sandbox workspace created: ${workspace}`);
  }

  const brief = existsSync(join(dir, "brief.md")) ? readBrief(projectDir, runId) : renderBrief(task, plan);
  const adapter = adapterOverride ?? adapterByName(task.agent);
  const state: SupervisorState = { finalMessage: "", stopped: false };

  // RESUME: an existing session plus a queued steer means this call is a REATTACH —
  // steer.ts's fallback spawns exactly this when no live socket could take a tell, so a
  // fire-and-forget resume no longer orphans its claim. ALL still-queued steers are
  // redelivered here, oldest first (not just the newest), and marked delivered at the
  // moment they are injected — a delivered one already answered live is never replayed.
  const pendingSteers = readSteerRecords(projectDir, runId).filter((record) => record.status === "queued");
  const isResume = Boolean(task.agent_session_id) && pendingSteers.length > 0;
  const firstMessage = isResume ? pendingSteers.map((record) => record.message).join("\n\n") : brief;
  if (isResume) for (const record of pendingSteers) deliverQueuedSteer(projectDir, runId, record.id);

  // The agent, with stdin held open for its whole life — only an adapter that offers
  // spawnLive supports this (today: claude). Earlier this branch spawned a
  // `node -e process.exit(0)` placeholder for every other agent — real, awaited work
  // only ever happened through the IN-PROCESS dispatch path (dispatch.ts's
  // executeRun). Any run started through the web app or `POST /runs` (which always
  // detaches) got a verdict built from that placeholder's empty stdout: an untouched
  // worktree, a canned "agent skipped the fence" statement, and generic checks passing
  // trivially against a zero-line diff — VERIFIED 3/3 for work that never happened.
  // Found while checking the app's live Follow view actually had something to render.
  // Non-live adapters now run for real, through the exact same Adapter.run() the
  // in-process path already trusted.
  const child: ChildProcess | null = adapter.spawnLive
    ? adapter.spawnLive({
        workDir: workspace,
        ...(isResume ? { resumeSessionId: task.agent_session_id } : { sessionId: task.agent_session_id }),
      })
    : null;
  slog(child ? `agent spawned live, pid ${child.pid}` : "agent has no live spawn — running via one-shot adapter.run()");

  if (child) {
    // Record the pid BEFORE handing the agent anything to do — writing to stdin is the
    // step that actually starts it working (and spending budget), so persisting the pid
    // has to happen first or a crash in between leaves a live, spending agent process
    // with no pid recorded anywhere: worse than the reproduced orphan case, where
    // agent_pid at least survived because supervisor_pid had already been persisted.
    // Same ordering principle as the worktree-path fix above: what the supervisor knows
    // must be durable before the next irreversible step, not after it.
    patchRun(projectDir, runId, { agent_pid: child.pid });
    // The brief IS the first user message on the open stdin — or, on a reattach, the
    // pending steer the agent is actually waiting on.
    child.stdin?.write(userMessageFrame(firstMessage));
  } else {
    // No live child to key liveness off; the supervisor process itself is what's
    // "running" for the run's duration, so stand in with its own pid.
    patchRun(projectDir, runId, { agent_pid: process.pid });
  }
  // The run is genuinely in flight now — a supervisor that never moved the state left
  // every surface reporting "briefed" while an agent worked (found on the first live run).
  //
  // skipConcurrencyCheck on both: the admission DECISION already happened above, before
  // the worktree existed or the agent child was spawned. These two calls only RECORD
  // that a decision already made — a live child by now genuinely exists (or this run is
  // sandboxed), and letting either throw here would orphan it exactly the way the old
  // post-spawn gate did.
  if (readRun(projectDir, runId).state === "briefed") {
    transitionRun(projectDir, runId, "dispatched", "kernel", undefined, { skipConcurrencyCheck: true });
  }
  if (readRun(projectDir, runId).state === "dispatched") {
    transitionRun(
      projectDir,
      runId,
      "running",
      "kernel",
      workspaceKind === "sandbox" ? "no git worktree — running in a sandbox" : undefined,
      { skipConcurrencyCheck: true },
    );
  }
  // A reattach starts from blocked/stopped/failed, never briefed/dispatched — bring it
  // into running the same way a fresh dispatch does, so no surface is left reporting a
  // state the agent has already moved past. Already exempt via assertConcurrencyAllows'
  // own state check, but skipConcurrencyCheck is passed here too for the same reason as
  // above: the child already exists by this point, so this call must never be the one
  // that throws.
  if (isResume) {
    const resumedFrom = readRun(projectDir, runId).state;
    if (resumedFrom === "blocked" || resumedFrom === "stopped" || resumedFrom === "failed") {
      transitionRun(projectDir, runId, "running", "kernel", "resumed — a supervisor reattached to answer it", { skipConcurrencyCheck: true });
    }
  }
  const record: SupervisorRecord = {
    run_id: runId,
    pid: process.pid,
    socket: socketPath(projectDir, runId),
    started_at: new Date().toISOString(),
  };
  writeFileSync(supervisorRecordPath(projectDir, runId), `${JSON.stringify(record, null, 2)}\n`, "utf8");

  const transcriptPath = runTranscriptPath(projectDir, runId);
  mkdirSync(dirname(transcriptPath), { recursive: true });
  const log = (event: Record<string, unknown>): void => {
    try {
      writeFileSync(transcriptPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, { flag: "a" });
    } catch {
      // Never let logging break a run.
    }
  };
  log({ kind: "start", adapter: adapter.name, run_id: runId, supervisor_pid: process.pid });

  // Control socket: how any surface reaches this live agent.
  const server = createServer((connection: Socket) => {
    connection.setEncoding("utf8");
    connection.on("data", (raw: string) => {
      let reply: ControlReply;
      try {
        const op = JSON.parse(raw) as ControlOp;
        reply = handleControl(op);
      } catch (error) {
        reply = { ok: false, detail: `unreadable control message: ${String(error)}` };
      }
      connection.end(`${JSON.stringify(reply)}\n`);
    });
  });
  // A socket failure must never take the run down with it: listen() reports errors
  // asynchronously, so an unhandled 'error' event would crash the supervisor and strand
  // the agent. Without a socket the run still completes — it just cannot be steered.
  server.on("error", (error) => log({ kind: "control_socket_error", error: String(error) }));
  try {
    rmSync(record.socket, { force: true });
    mkdirSync(dirname(record.socket), { recursive: true });
    server.listen(record.socket);
  } catch (error) {
    log({ kind: "control_socket_error", error: String(error) });
  }

  /**
   * Node's `Writable.write()` return value reports BACKPRESSURE (the internal buffer is
   * full, queue it), not delivery — a scripted child that doesn't drain its stdin
   * promptly can make a perfectly queued frame look like a failed write. The honest
   * signal is whether the stream could accept the write at all: no live child, or a
   * stdin already ended/destroyed. A real write error surfaces asynchronously via the
   * write callback (logged, not blocking the reply) rather than the return value.
   */
  function writeFrame(frame: string): boolean {
    const stdin = child?.stdin;
    if (!stdin || !stdin.writable) return false;
    stdin.write(frame, (error) => {
      if (error) log({ kind: "control_socket_error", error: String(error) });
    });
    return true;
  }

  function handleControl(op: ControlOp): ControlReply {
    if (op.op === "status") {
      return { ok: true, state: state.waiting ? "waiting" : "working", detail: state.waiting?.needs };
    }
    if (op.op === "stop") {
      state.stopped = true;
      // Best-effort for a non-claude agent: there is no live process handle to kill,
      // only an in-flight Adapter.run() promise with no cancellation of its own — the
      // run will still be marked stopped once it returns, same honesty the fake
      // placeholder child offered, just without pretending work happened meanwhile.
      child?.kill("SIGTERM");
      return { ok: true, delivered: Boolean(child), detail: child ? "agent stopped" : `${adapter.name} has no live process to interrupt — it will stop once its current turn returns` };
    }
    if (op.op === "interrupt") {
      // A true interrupt: the in-flight tool is rejected and the process stays alive.
      const delivered = writeFrame(interruptFrame());
      return { ok: delivered, delivered, detail: delivered ? "interrupt sent" : "no live agent stdin" };
    }
    // `tell`: a message the agent receives at its next tool-result boundary.
    const delivered = writeFrame(userMessageFrame(op.message));
    // The held-socket path: this supervisor is the process that actually performs the
    // write, so it is the one that flips the steer record to delivered — at the exact
    // moment the message lands in the live agent's stdin, not before.
    if (delivered && op.steerId) deliverQueuedSteer(projectDir, runId, op.steerId);
    // Blocked is a WAITING state, not an exit: the child stayed alive holding stdin
    // open specifically so this write could land in the SAME session, rather than a
    // later `kage retry` starting a fresh one that discards the agent's context. This
    // is the only path that resumes a blocked run — queued/auto steers never do.
    if (delivered && readRun(projectDir, runId).state === "blocked") {
      transitionRun(projectDir, runId, "running", "user", `answered: ${op.message.slice(0, 80)}`);
      state.waiting = undefined;
      patchRun(projectDir, runId, { waiting_on: undefined });
      log({ kind: "resumed", label: "answered — the same session continues" });
    }
    return { ok: delivered, delivered, detail: delivered ? "delivered to the live agent" : "no live agent stdin" };
  }

  if (child) {
    // Stall-detector bookkeeping: lives for the whole held-stdin session, not per line —
    // a command's tool_use and its tool_result usually land on different lines, and the
    // streak state must survive across turns to count CONSECUTIVE ones.
    const pendingBashCalls = new Map<string, string>();
    let turnCommands: TurnCommandResult[] = [];
    let stallState = initialStallState();
    await new Promise<void>((resolve) => {
      let pending = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        pending += chunk.toString("utf8");
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const signal = waitingSignal(line);
          if (signal) {
            state.waiting = signal;
            patchRun(projectDir, runId, { waiting_on: signal });
            log({ kind: "waiting", ...signal });
          }
          const id = sessionIdFrom(line);
          // Persisted the FIRST time the stream reports it, not only in the exit
          // cleanup block below — Take Over (run-pty.ts's takeOverRun) needs this field
          // live for the run's ENTIRE working life, and it used to be null the whole
          // time a run was visibly streaming (reproduced live: "Take Over" refused a
          // run mid-stream with "no agent session recorded"). The exit-time write below
          // stays too, as belt-and-braces for a run that ends before this ever fires.
          if (id && id !== state.sessionId) {
            state.sessionId = id;
            patchRun(projectDir, runId, { agent_session_id: id });
          }
          const bashResult = bashResultFromStreamEvent(line, pendingBashCalls);
          if (bashResult) turnCommands.push(bashResult);
          else recordBashToolUse(line, pendingBashCalls);
          // THIRD stream consumer, third chance to drop data. Cost capture went into
          // cli-agent.run first and a real held-stdin run still recorded zero, because
          // this loop parses the same result event independently. Every consumer of
          // the agent stream must capture usage, or the one real users hit will not.
          const turnUsage = usageFrom(line);
          if (turnUsage) {
            state.usage = {
              usd: (state.usage?.usd ?? 0) + turnUsage.usd,
              tokens: (state.usage?.tokens ?? 0) + turnUsage.tokens,
            };
            log({ kind: "usage", usd: turnUsage.usd, tokens: turnUsage.tokens });
            recordSpend(projectDir, runId, state.usage);
            // Enforce the budget the run was DISPATCHED with, not whatever it was
            // patched to mid-run (budgets aren't mutable in flight, but reading the
            // original avoids a race with any future editor of this record). Checked
            // on every turn boundary — the only point this loop has fresh usage at all.
            //
            // HONESTY, not a defect to silently patch: the check interval is one TURN,
            // not one tool call or one token — usageFrom only ever has a figure to read
            // when the agent's own `result` line reports it, and a single turn can run
            // many tool calls (edits, greps, a full test suite) before it ever yields
            // one. A run that overshoots by 2-3x in one long turn (observed live: $5.22
            // against a $2.00 cap) is this granularity working as designed, not failing.
            // Tightening it below "per turn" would mean asking the agent CLI's own
            // stream-json protocol for a cost figure it does not emit mid-turn — an
            // upstream dependency, not something addable here without adding real
            // per-tool-call overhead (a cost query before every single tool use) for a
            // guarantee the product does not otherwise need.
            if (!state.stopped) {
              const check = checkRunBudget(readRun(projectDir, runId).spend, task.budgets);
              if (check.exceeded) {
                state.stopped = true;
                state.budgetHalted = check.reason;
                log({ kind: "budget_halt", reason: check.reason });
                child.kill("SIGTERM");
              }
            }
          }
          const event = progressFromStreamEvent(line);
          if (event) log(event as unknown as Record<string, unknown>);
          else log({ kind: "stdout", text: line });
          try {
            const parsed = JSON.parse(line) as { type?: string; result?: unknown };
            if (typeof parsed.result === "string" && parsed.result.trim()) state.finalMessage = parsed.result;
            // Holding stdin open is what makes a run steerable — but it also means the
            // agent waits for more input instead of exiting, so process death can never be
            // the "turn is over" signal. The `result` event is what ends a TURN. Whether it
            // ends the SUPERVISION depends on what the turn actually reported: a claim
            // closes stdin so the agent shuts down cleanly into verification, but a block
            // must NOT — the whole point of holding stdin open is that a blocked turn stays
            // a live, answerable session instead of a process a later steer has to restart
            // from scratch (found live: a finished blocked turn closed stdin same as a
            // claim, killing the very session `kage tell` needed to answer).
            if (parsed.type === "result" && !state.stopped) {
              // Stall check: once per turn boundary, ahead of the fence handling below —
              // a stall halt overrides whatever the turn itself reported (a claim, a
              // block, a plan), the same way a budget halt already does.
              const commandsThisTurn = turnCommands;
              turnCommands = [];
              const diffHash = workspaceKind === "worktree" ? diffStatHash(workspace) : null;
              const evaluated = evaluateStallTurn(stallState, { commands: commandsThisTurn, diffHash });
              stallState = evaluated.state;
              if (evaluated.trigger) {
                state.stopped = true;
                state.stallHalted = evaluated.trigger.reason;
                log({ kind: "stall_halt", reason: evaluated.trigger.reason });
                child.kill("SIGTERM");
              }
            }
            if (parsed.type === "result" && !state.stopped) {
              const fence = parseReportFence(state.finalMessage);
              if (fence?.kind === "plan") {
                // A plan is a proposal, not a claim: it holds stdin open exactly like a
                // block, but names WHY it is waiting — approval, not an open question —
                // so a reviewer sees "plan approval" rather than a generic block.
                if (readRun(projectDir, runId).state === "running") {
                  patchRun(projectDir, runId, { waiting_on: { needs: "plan approval", detail: fence.plan ?? "" } });
                  transitionRun(projectDir, runId, "blocked", "kernel", fence.question ?? "awaiting plan approval");
                }
                log({ kind: "turn_complete", label: `agent proposed a plan, waiting for approval: ${fence.plan}` });
              } else if (fence?.kind === "blocked" || (!fence && state.waiting)) {
                const note = fence?.question ?? fence?.need ?? state.waiting?.detail ?? "blocked without a stated question";
                if (readRun(projectDir, runId).state === "running") transitionRun(projectDir, runId, "blocked", "kernel", note);
                log({ kind: "turn_complete", label: `agent is blocked, waiting for a tell: ${note}` });
              } else if (readRun(projectDir, runId).state === "blocked") {
                // Order-independent: this line's own in-memory signals (fence, state.waiting)
                // say "finished", but the PERSISTED state is the authority, and it already
                // says blocked — a prior line (or an unrelated stray result, e.g. a control
                // write a scripted stub misreads as a turn) must never be allowed to close
                // stdin out from under a session a tell is still supposed to be able to reach.
                log({ kind: "turn_complete", label: "agent turn finished while the run is already blocked — holding stdin open" });
              } else {
                log({ kind: "turn_complete", label: "agent finished its turn" });
                try {
                  child.stdin?.end();
                } catch {
                  // If stdin is already gone the close handler still fires.
                }
              }
            }
          } catch {
            // not a result line
          }
        }
      });
      child.stderr?.on("data", (chunk: Buffer) => log({ kind: "stderr", text: chunk.toString("utf8") }));
      child.on("error", (error) => {
        log({ kind: "spawn_error", error: String(error) });
        resolve();
      });
      child.on("close", (code) => {
        log({ kind: "final", exit_code: code ?? 0, session_id: state.sessionId });
        resolve();
      });
    });
  } else {
    // No live stdin to hold: run the adapter the same way the in-process path does
    // (dispatch.ts's executeRun) and wait for its one real answer.
    try {
      // No onProgress here: every adapter already journals its own events straight to
      // transcriptPath (stub.ts, cli-agent.ts both do) — onProgress is a SEPARATE side
      // channel for a live console line (dispatch.ts's ProgressLine uses it that way).
      // Wiring it to log() too double-wrote every event (caught immediately by looking
      // at a real transcript after this fix landed).
      const outcome = await adapter.run({
        runId,
        workDir: workspace,
        briefBody: firstMessage,
        transcriptPath,
        ...(isResume ? { resumeSessionId: task.agent_session_id } : { sessionId: task.agent_session_id ?? undefined }),
        onStart: (pid) => {
          if (pid) patchRun(projectDir, runId, { agent_pid: pid });
      recordSpend(projectDir, runId, outcome.usage);
        },
      });
      state.finalMessage = outcome.final_message;
      if (outcome.waiting) {
        state.waiting = outcome.waiting;
        patchRun(projectDir, runId, { waiting_on: outcome.waiting });
      }
      if (outcome.session_id) state.sessionId = outcome.session_id;
      // NOT kind:"final" — the adapter already wrote its own {kind:"final", message}
      // for its real answer (stub.ts does; renderConversation renders that as a
      // bubble). A second "final" with no .message field would render as an empty
      // bubble right after the real one. "turn_complete" is the claude branch's own
      // name for this exact bookkeeping moment — reused here for the same reason:
      // it's a marker the transcript view already knows to leave unrendered.
      log({ kind: "turn_complete", label: "agent finished its turn", exit_code: outcome.exit_code, session_id: state.sessionId });
    } catch (error) {
      log({ kind: "spawn_error", error: String(error) });
    }
  }

  slog(
    `agent turn ended${state.stopped ? " (stopped)" : ""}` +
      `${state.budgetHalted ? ` — budget halted: ${state.budgetHalted}` : ""}` +
      `${state.stallHalted ? ` — ${state.stallHalted}` : ""}`,
  );

  try {
    server.close();
    rmSync(record.socket, { force: true });
    rmSync(supervisorRecordPath(projectDir, runId), { force: true });
  } catch {
    // Cleanup is best effort.
  }

  patchRun(projectDir, runId, {
    agent_pid: undefined,
    ...(state.sessionId ? { agent_session_id: state.sessionId } : {}),
  });

  if (state.stopped) {
    // A budget or stall halt is the kernel's own decision, not a user action — and its
    // note names either the limit and the figure that crossed it, or the stall's exact
    // evidence, so "stopped" never reads as a generic user-requested stop when it wasn't
    // one. budgetHalted and stallHalted are mutually exclusive (whichever check fires
    // first sets state.stopped, and both checks bail out once it's already true).
    const haltNote = state.budgetHalted ?? state.stallHalted;
    transitionRun(projectDir, runId, "stopped", haltNote ? "kernel" : "user", haltNote ?? "stopped by request");
    return;
  }

  const fence = parseReportFence(state.finalMessage);
  if (fence?.kind === "plan") {
    // Same re-entrancy guard as the blocked branch below: the live-child loop may
    // already have made this transition before the child actually exited.
    if (readRun(projectDir, runId).state !== "blocked") {
      patchRun(projectDir, runId, { waiting_on: { needs: "plan approval", detail: fence.plan ?? "" } });
      transitionRun(projectDir, runId, "blocked", "kernel", fence.question ?? "awaiting plan approval");
    }
    return;
  }
  if (fence?.kind === "blocked" || state.waiting) {
    // The live-child branch above already transitions to `blocked` the moment the fence
    // appears, without ending the run — so by the time execution reaches here (the child
    // died some other way while still waiting, e.g. crashed rather than being told or
    // stopped) the run is very likely blocked already. Re-transitioning into the same
    // state is an illegal jump; only act if something upstream has not already said so.
    if (readRun(projectDir, runId).state !== "blocked") {
      const note = fence?.question ?? fence?.need ?? state.waiting?.detail ?? "blocked without a stated question";
      transitionRun(projectDir, runId, "blocked", "kernel", note);
    }
    return;
  }

  transitionRun(projectDir, runId, "verifying", "kernel");
  slog("verifying");
  const statement = fence?.statement ?? `work delivered — see diff (agent skipped the ${CLAIM_PROTOCOL_VERSION} fence)`;
  // Only the statement is a formal citation — unsure notes and learnings are prose: an
  // unresolvable path there is a warning, never a failure (see verify.ts's CitationText).
  const claimText: CitationText = { cited: statement, prose: [...(fence?.unsure ?? []), ...(fence?.learned ?? [])].join("\n") };
  const { checks, diff, passed } = runAllChecks(projectDir, runId, workspace, plan.checks, claimText);
  const claim: ClaimRecord = buildClaim({ runId, statement, checks, fence, diff });
  writeFileSync(join(dir, "claim.json"), `${JSON.stringify(claim, null, 2)}\n`, "utf8");

  if (workspaceKind === "worktree") {
    if (claim.learnings.length) draftLearnings(projectDir, readRun(projectDir, runId), claim, diff.paths);
    commitWorktree(projectDir, runId, `kage: ${task.intent}\n\nRun: ${runId}\nClaim: ${claim.statement}`);
  }

  const ready = passed || !strictVerify(projectDir);
  transitionRun(
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
  slog(`claim written, ${ready ? "ready" : "failed"}`);
}
