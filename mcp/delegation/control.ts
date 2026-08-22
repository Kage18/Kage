// Talking to a live run's supervisor, and deciding when one is genuinely gone.
//
// The socket is also the liveness probe, and it is strictly better than a pid check:
// `process.kill(pid, 0)` lies after pid reuse, and a supervisor that answers its own
// socket with its own run id cannot be impersonated by whatever inherited its number.
import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import type { ControlOp, ControlReply } from "./supervisor.js";
import { socketPath, supervisorRecordPath } from "./supervisor.js";
import { isProcessAlive, readRun, transitionRun, type RunActor, type RunView } from "./contract.js";
import { sweepProcessGroup } from "./verify.js";

const CONTROL_TIMEOUT_MS = 3000;

export function readSupervisorRecord(projectDir: string, runId: string): { pid: number; socket: string } | null {
  const path = supervisorRecordPath(projectDir, runId);
  if (!existsSync(path)) return null;
  try {
    const record = JSON.parse(readFileSync(path, "utf8")) as { pid?: number; socket?: string };
    if (!record.pid || !record.socket) return null;
    return { pid: record.pid, socket: record.socket };
  } catch {
    return null;
  }
}

/** Send one control op. Resolves null when nothing is listening — i.e. no live agent. */
export function sendControl(projectDir: string, runId: string, op: ControlOp): Promise<ControlReply | null> {
  const path = socketPath(projectDir, runId);
  if (!existsSync(path)) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: ControlReply | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const socket = connect(path);
    const timer = setTimeout(() => {
      socket.destroy();
      finish(null);
    }, CONTROL_TIMEOUT_MS);
    socket.setEncoding("utf8");
    let buffer = "";
    socket.on("connect", () => socket.write(JSON.stringify(op)));
    socket.on("data", (chunk: string) => (buffer += chunk));
    socket.on("error", () => {
      clearTimeout(timer);
      finish(null);
    });
    socket.on("close", () => {
      clearTimeout(timer);
      try {
        finish(buffer.trim() ? (JSON.parse(buffer) as ControlReply) : null);
      } catch {
        finish(null);
      }
    });
  });
}

export async function isRunLive(projectDir: string, runId: string): Promise<boolean> {
  const reply = await sendControl(projectDir, runId, { op: "status" });
  if (reply?.ok) return true;
  // Fall back to the supervisor's pid: a supervisor may be alive but mid-write.
  const record = readSupervisorRecord(projectDir, runId);
  return record ? isProcessAlive(record.pid) : false;
}

// Reproduced live 2026-08-22 (run p2b-memory-leaves-...-d911): a manager stop flipped the
// run's own record to "stopped" while its detached supervisor and agent child kept
// running, unmonitored, for 14+ minutes until an operator killed them by hand — the old
// `kage_stop` handler (mcp/index.ts) just called transitionRun directly and never told
// the live process anything. "Stopped" must mean stopped: this always delivers the
// control op AND confirms the process tree is actually gone before it is honest to call
// the run finished.
const STOP_CONFIRM_WINDOW_MS = 5000;
const STOP_CONFIRM_POLL_MS = 100;
// Same grace spawnWithTreeKill (verify.ts) gives a hung check between its SIGTERM and the
// follow-up SIGKILL — long enough for a well-behaved process to unwind, short enough that
// a genuinely wedged one doesn't stall the caller much past the confirmation window above.
const STOP_SWEEP_GRACE_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

export interface StopOutcome {
  /** True if a live supervisor actually answered the control op (never true for "nothing was listening"). */
  delivered: boolean;
  /** True once isRunLive was observed false within the confirmation window — a graceful exit. */
  confirmed: boolean;
  /** True only when confirmation failed and a group-kill of the supervisor's process tree ran. */
  swept: boolean;
  /** Honest, human-readable delivery status — never a generic "stopped", always one of the
   * three real outcomes: confirmed, swept, or nothing was ever live to begin with. */
  note: string;
}

/** Overridable timing — tests shrink these to seconds/milliseconds instead of waiting out
 * the real "a few seconds" confirmation window and sweep grace on every run. */
export interface StopConfirmOptions {
  confirmWindowMs?: number;
  pollMs?: number;
  sweepGraceMs?: number;
}

/**
 * Deliver `stop` to a run's supervisor and CONFIRM the process tree actually exits —
 * never just send the signal and hope. Polls liveness for a confirmation window and, if
 * the supervisor is unreachable or wedged past it, force-kills its whole process group
 * (the exact SIGTERM/grace/SIGKILL sweep verify.ts's tree-kill machinery already runs for
 * a hung check command — sweepProcessGroup, reused here rather than a second hand-rolled
 * copy). The supervisor is spawned `detached: true` (dispatch.ts), making it its own
 * process group leader, so one sweep of its pid reaches its live agent child too.
 */
export async function stopAndConfirm(
  projectDir: string,
  runId: string,
  reason?: string,
  actor: RunActor = "user",
  options: StopConfirmOptions = {},
): Promise<StopOutcome> {
  const confirmWindowMs = options.confirmWindowMs ?? STOP_CONFIRM_WINDOW_MS;
  const pollMs = options.pollMs ?? STOP_CONFIRM_POLL_MS;
  const sweepGraceMs = options.sweepGraceMs ?? STOP_SWEEP_GRACE_MS;

  const reply = await sendControl(projectDir, runId, { op: "stop", reason, actor });
  const deadline = Date.now() + confirmWindowMs;
  let live = await isRunLive(projectDir, runId);
  while (live && Date.now() < deadline) {
    await sleep(pollMs);
    live = await isRunLive(projectDir, runId);
  }
  if (!live) {
    return {
      delivered: reply?.ok === true,
      confirmed: true,
      swept: false,
      note: reply?.ok === true ? "stop delivered and confirmed" : "no live supervisor — nothing to stop",
    };
  }
  // Still live past the confirmation window — the control op alone was not enough
  // (a wedged event loop, or a signal that never reached a grandchild). Force it.
  const record = readSupervisorRecord(projectDir, runId);
  if (record) sweepProcessGroup(record.pid, sweepGraceMs);
  const stillLive = await isRunLive(projectDir, runId);
  return {
    delivered: reply?.ok === true,
    confirmed: false,
    swept: !stillLive,
    note: stillLive
      ? "stop recorded but process unreachable — sweep could not confirm exit"
      : "stop recorded but process unreachable — killed by sweep",
  };
}

/**
 * The one place a run is actually stopped from outside its own supervisor — used by both
 * the manager's `kage_stop` tool and the API's `stop` action so neither hand-rolls its own
 * partial version of this again. A graceful stop is transitioned by the supervisor itself
 * (superviseRun's own exit path, now carrying this call's actor/reason via the control
 * op) — this function only writes the transition itself when the process could not do it
 * for itself: force-killed by the sweep above, or already dead with nothing ever running.
 */
export async function stopRun(
  projectDir: string,
  runId: string,
  actor: RunActor,
  reason?: string,
  options: StopConfirmOptions = {},
): Promise<{ run: RunView; outcome: StopOutcome }> {
  const outcome = await stopAndConfirm(projectDir, runId, reason, actor, options);
  let run = readRun(projectDir, runId);
  if (run.state === "running" || run.state === "blocked") {
    const note = reason ? `${reason} — ${outcome.note}` : outcome.note;
    run = transitionRun(projectDir, runId, "stopped", actor, note);
  }
  return { run, outcome };
}
