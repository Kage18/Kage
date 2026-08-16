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
import { existsSync } from "node:fs";
import type { Adapter } from "./adapters/types.js";
import {
  type TaskRecord,
  appendRunLedger,
  isProcessAlive,
  patchRun,
  readRun,
  runTranscriptPath,
  runWorkDir,
  transitionRun,
} from "./contract.js";
import { appendSteer } from "./dispatch.js";
import { sendControl } from "./control.js";
import { worktreePath } from "./worktree.js";

/**
 * How far the message actually got. Never collapsed into "sent":
 * `delivered` — written into a live agent's stdin (a supervisor answered);
 * `resumed`   — the agent had exited; its own session was continued with the message;
 * `stored`    — written to the run's steer log; nothing live has seen it;
 * `refused`   — nothing was done, and the message says why.
 */
export type SteerDelivery = "delivered" | "resumed" | "stored" | "refused";

export interface SteerResult {
  delivery: SteerDelivery;
  message: string;
  task: TaskRecord;
}

function workspaceFor(projectDir: string, task: TaskRecord): string {
  const worktree = worktreePath(projectDir, task.id);
  return existsSync(worktree) ? worktree : runWorkDir(projectDir, task.id);
}

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
): Promise<SteerResult> {
  const task = readRun(projectDir, runId);
  appendSteer(projectDir, runId, message);

  // A live supervisor holds the agent's stdin, so the message can genuinely reach it —
  // it lands at the agent's next tool-result boundary. The socket answering IS the proof
  // the agent is alive; we report what the write actually returned, never an assumption.
  const live = await sendControl(projectDir, runId, { op: "tell", message });
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

  const resumable = task.state === "blocked" || task.state === "stopped" || task.state === "failed" || !isProcessAlive(task.agent_pid);
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

  const adapter = adapterFor(task.agent);
  const resumed = task.state === "blocked" || task.state === "stopped" || task.state === "failed"
    ? transitionRun(projectDir, runId, "running", "user", `answered: ${message.slice(0, 80)}`)
    : task;
  appendRunLedger(projectDir, { kind: "steer_resumed", run_id: runId, message });

  const outcome = await adapter.run({
    runId,
    workDir: workspaceFor(projectDir, resumed),
    // The agent already has the brief in its restored context; it needs the answer.
    briefBody: message,
    transcriptPath: runTranscriptPath(projectDir, runId),
    resumeSessionId: task.agent_session_id,
    onStart: (pid) => patchRun(projectDir, runId, { agent_pid: pid }),
  });

  patchRun(projectDir, runId, {
    ...(outcome.session_id ? { agent_session_id: outcome.session_id } : {}),
    ...(outcome.waiting ? { waiting_on: outcome.waiting } : { waiting_on: undefined }),
  });

  return {
    delivery: "resumed",
    task: readRun(projectDir, runId),
    message: `Answered ${runId} in place — the same agent continued with its context intact.`,
  };
}
