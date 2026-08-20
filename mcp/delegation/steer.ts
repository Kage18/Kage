// Answering an agent, rather than restarting it.
//
// The first version of `kage tell` appended a message to a file and told the user to run
// `kage retry` — which compiles a fresh brief and hires a NEW agent, throwing away
// everything the blocked one had figured out. That is not steering, it is starting over
// while calling it steering.
//
// A blocked agent is a live conversation waiting on a reply: it has its own session, and
// `--resume` restores that session's full context. So answering it continues the same
// agent, with its own reasoning intact.
import type { Adapter } from "./adapters/types.js";
import {
  type TaskRecord,
  appendRunLedger,
  isProcessAlive,
  reapRun,
  readRun,
} from "./contract.js";
import { appendSteerRecord, dispatchDetached, readSteerRecords, writeSteerRecords, type SteerRecord } from "./dispatch.js";
import { sendControl } from "./control.js";

/**
 * How far the message actually got. Never collapsed into "sent":
 * `delivered` — written into a live agent's stdin (a supervisor answered);
 * `resumed`   — no supervisor survived to take it live, so a new one was reattached to
 *               the agent's own session, which will collect its eventual claim;
 * `stored`    — written to the run's steer log; nothing live has seen it;
 * `refused`   — nothing was done, and the message says why.
 */
export type SteerDelivery = "delivered" | "resumed" | "stored" | "refused";

export interface SteerResult {
  delivery: SteerDelivery;
  message: string;
  task: TaskRecord;
}

/** States a reattached supervisor can legally re-enter `running` from. `changes_requested`
 * (review.ts's reviewRun) reuses this exact resume path — see LEGAL_TRANSITIONS in
 * contract.ts, which already allows changes_requested -> running for this reason. */
const REENTRANT_STATES = new Set(["blocked", "stopped", "failed", "changes_requested"]);

/**
 * Steering is always recorded, and its delivery state is always reported honestly —
 * "accepted" is not "delivered", and a UI that conflates them teaches users to distrust
 * it (four separate bug reports in the field say so).
 */
export async function steerRun(
  projectDir: string,
  runId: string,
  message: string,
  adapterFor: (name: string) => Adapter,
  /**
   * Spawn the supervisor that will collect this run's eventual claim. Defaults to the
   * real detached spawn (`kage supervise <runId>`, same shape a fresh dispatch uses);
   * tests override it to reattach in-process against a scripted adapter instead.
   */
  reattach: (projectDir: string, task: TaskRecord) => { pid: number | undefined } = dispatchDetached,
): Promise<SteerResult> {
  const task = readRun(projectDir, runId);
  const record = appendSteerRecord(projectDir, runId, message);

  // A live supervisor holds the agent's stdin, so the message can genuinely reach it —
  // it lands at the agent's next tool-result boundary. The socket answering IS the proof
  // the agent is alive; we report what the write actually returned, never an assumption.
  // steerId rides along so the supervisor — the process that actually performs the
  // write — is the one that flips this record to delivered, at the moment it injects it.
  const live = await sendControl(projectDir, runId, { op: "tell", message, steerId: record.id });
  if (live?.delivered) {
    appendRunLedger(projectDir, { kind: "steer_delivered", run_id: runId, message });
    return {
      delivery: "delivered",
      task,
      message: `Delivered to ${runId} — the agent picks it up at its next step.`,
    };
  }

  // No supervisor listening. If the process still looks alive, nothing can reach it, so
  // the message is stored rather than delivered — saying otherwise would be the
  // accepted-is-not-delivered lie.
  if ((task.state === "running" || task.state === "dispatched") && isProcessAlive(task.agent_pid)) {
    return {
      delivery: "stored",
      task,
      message:
        `${runId} is working without a supervisor, so nothing can reach it live — your message is STORED, not ` +
        `delivered, and applies on retry. To redirect it now: kage stop ${runId}, then kage tell ${runId} "…".`,
    };
  }

  const resumable =
    task.state === "blocked" ||
    task.state === "stopped" ||
    task.state === "failed" ||
    task.state === "changes_requested" ||
    !isProcessAlive(task.agent_pid);
  if (!resumable) {
    return { delivery: "refused", task, message: `${runId} is ${task.state} — nothing to steer.` };
  }
  if (!task.agent_session_id) {
    return {
      delivery: "refused",
      task,
      message:
        `${runId} has no agent session recorded (it predates resume support), so its context cannot be restored. ` +
        `Use kage retry ${runId} to run it again with a fresh brief that includes your steer.`,
    };
  }

  // Fail fast on an unknown agent name, same as the old direct-resume path did — the
  // reattached supervisor resolves its own adapter after this function has returned, so
  // this is the only chance to report a bad agent name synchronously.
  adapterFor(task.agent);

  // No supervisor survived to take the tell live, but the agent's own session did.
  // Resuming it fire-and-forget (the old behavior here) is exactly what orphaned real
  // runs: the message was delivered, the agent finished a turn, and nobody was left to
  // collect its claim (observed three times live). Reattaching a real supervisor — the
  // same spawn shape a fresh dispatch uses — means the SAME process that takes this
  // steer is the one that collects its eventual claim.
  //
  // A raw in-flight state ("dropped" display) with a dead pid has no legal transition
  // straight to `running`; persist its death into `failed` first, the same thing
  // sweepDeadRuns does for any other dropped run, so re-entry has a legal move to make.
  const reentrant = REENTRANT_STATES.has(task.state) ? task : (reapRun(projectDir, runId) ?? task);
  appendRunLedger(projectDir, { kind: "steer_resumed", run_id: runId, message });
  reattach(projectDir, reentrant);

  return {
    delivery: "resumed",
    task: readRun(projectDir, runId),
    message: `${runId}'s supervisor is gone, so a new one is reattaching to the same agent session — your message will be answered once it picks up.`,
  };
}

// ---------------------------------------------------------------------------
// The queue as a first-class object (Conductor parity): edit/delete/reorder what has
// not been delivered yet. A delivered record is history — rewriting it would make the
// transcript lie about what the agent was actually told — so every mutation here
// refuses outright rather than silently no-oping.

export interface SteerQueueResult {
  ok: boolean;
  reason?: string;
  records: SteerRecord[];
}

export function editQueuedSteer(projectDir: string, runId: string, steerId: string, message: string): SteerQueueResult {
  const records = readSteerRecords(projectDir, runId);
  const index = records.findIndex((record) => record.id === steerId);
  if (index === -1) return { ok: false, reason: `no steer with id ${steerId}`, records };
  if (records[index].status === "delivered") return { ok: false, reason: "delivered steers are immutable history", records };
  const trimmed = message.trim();
  if (!trimmed) return { ok: false, reason: "message must be non-empty", records };
  const next = [...records];
  next[index] = { ...next[index], message: trimmed };
  writeSteerRecords(projectDir, runId, next);
  return { ok: true, records: next };
}

export function deleteQueuedSteer(projectDir: string, runId: string, steerId: string): SteerQueueResult {
  const records = readSteerRecords(projectDir, runId);
  const record = records.find((entry) => entry.id === steerId);
  if (!record) return { ok: false, reason: `no steer with id ${steerId}`, records };
  if (record.status === "delivered") return { ok: false, reason: "delivered steers are immutable history", records };
  const next = records.filter((entry) => entry.id !== steerId);
  writeSteerRecords(projectDir, runId, next);
  return { ok: true, records: next };
}

/**
 * Reorders only the still-queued tail. Delivered records keep their original (already
 * chronological) order ahead of it — they are the run's real history, so a reorder can
 * never move a queued message ahead of one the agent has already seen.
 */
export function reorderQueuedSteers(projectDir: string, runId: string, orderedIds: string[]): SteerQueueResult {
  const records = readSteerRecords(projectDir, runId);
  const delivered = records.filter((record) => record.status === "delivered");
  const queued = records.filter((record) => record.status === "queued");
  if (orderedIds.some((id) => delivered.some((record) => record.id === id))) {
    return { ok: false, reason: "delivered steers are immutable history", records };
  }
  const queuedIds = new Set(queued.map((record) => record.id));
  const orderedSet = new Set(orderedIds);
  const sameSet = orderedIds.length === queued.length && queued.every((record) => orderedSet.has(record.id)) && orderedIds.every((id) => queuedIds.has(id));
  if (!sameSet) return { ok: false, reason: "order must include exactly the currently queued steer ids", records };
  const byId = new Map(queued.map((record) => [record.id, record]));
  const next = [...delivered, ...orderedIds.map((id) => byId.get(id)!)];
  writeSteerRecords(projectDir, runId, next);
  return { ok: true, records: next };
}
