// Talking to a live run's supervisor, and deciding when one is genuinely gone.
//
// The socket is also the liveness probe, and it is strictly better than a pid check:
// `process.kill(pid, 0)` lies after pid reuse, and a supervisor that answers its own
// socket with its own run id cannot be impersonated by whatever inherited its number.
import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import type { ControlOp, ControlReply } from "./supervisor.js";
import { socketPath, supervisorRecordPath } from "./supervisor.js";
import { isProcessAlive } from "./contract.js";

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
