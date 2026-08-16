// The room supervisor — one detached process holding ONE live manager session open for
// the whole conversation. This is the difference between what the room was and what
// AO's orchestrator actually is: AO's orchestrator is a literal held instance of
// claude/codex/etc — you watch its own banner, its own turns, its own native context.
// askManager() (manager-client.ts) is a one-shot `claude -p` per message, with
// continuity faked by replaying the last 8 turns as text into a fresh prompt each time.
// That works, but it re-pays context tokens every turn and caps memory at 8 exchanges.
//
// Verified empirically before building this (not assumed): a claude process spawned
// with --input-format stream-json, given a user frame, given ANOTHER user frame after
// its `result` WITHOUT closing stdin in between, answers the second turn with real
// knowledge of the first — the same mechanism the worker supervisor already holds open
// per run, just never kept alive across multiple turns before.
//
// Only claude gets this. codex and gemini have real --resume/session-id support (a
// fresh process per turn, native context restored) but no stream-json STDIN protocol
// to hold open — conflating "has an adapter" with "can be held live" would be exactly
// the kind of unverified claim this codebase has spent this whole session catching.
import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { createServer, connect, type Socket } from "node:net";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isProcessAlive } from "./contract.js";
import { DEFAULT_SESSION, normalizeSessionKey, roomDirFor } from "./room-sessions.js";
import { sessionIdFrom } from "./adapters/cli-agent.js";
import { managerEventFrom, guardManagerProse, type ManagerEvent } from "./manager-client.js";
import { MANAGER_CONSTITUTION } from "./manager-prompt.js";
import { writeRoomMcpConfig } from "./room.js";

function roomDir(projectDir: string, session?: string): string {
  return roomDirFor(projectDir, session);
}

export function roomSupervisorRecordPath(projectDir: string, session?: string): string {
  return join(roomDir(projectDir, session), "supervisor.json");
}

export function roomSessionPath(projectDir: string, session?: string): string {
  return join(roomDir(projectDir, session), "session.json");
}

/**
 * Same bounded-length hashing socketPath uses for runs — unix socket paths cap ~104
 * bytes. The thread key is part of the digest input so two threads can never collide
 * onto one socket and steer each other's manager.
 */
export function roomSocketPath(projectDir: string, session?: string): string {
  const key = normalizeSessionKey(session);
  // The default thread keeps its ORIGINAL digest input. Callers find a supervisor by
  // probing this path, so changing it for "main" would make a live manager look dead
  // on upgrade and silently respawn underneath a conversation in progress.
  const seed = key === DEFAULT_SESSION ? `${resolve(projectDir)}\0__room__` : `${resolve(projectDir)}\0__room__\0${key}`;
  const digest = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  return join(tmpdir(), `kage-room-${digest}.sock`);
}

export interface RoomSupervisorRecord {
  pid: number;
  socket: string;
  started_at: string;
}

export function readRoomSupervisorRecord(projectDir: string, session?: string): RoomSupervisorRecord | null {
  const path = roomSupervisorRecordPath(projectDir, session);
  if (!existsSync(path)) return null;
  try {
    const record = JSON.parse(readFileSync(path, "utf8")) as Partial<RoomSupervisorRecord>;
    if (!record.pid || !record.socket) return null;
    return record as RoomSupervisorRecord;
  } catch {
    return null;
  }
}

export function readRoomSessionId(projectDir: string, session?: string): string | undefined {
  const path = roomSessionPath(projectDir, session);
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { session_id?: string };
    return parsed.session_id;
  } catch {
    return undefined;
  }
}

export function writeRoomSessionId(projectDir: string, sessionId: string, session?: string): void {
  const path = roomSessionPath(projectDir, session);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ session_id: sessionId }, null, 2)}\n`, "utf8");
}

export type RoomControlOp = { op: "ask"; message: string } | { op: "status" } | { op: "stop" };

/**
 * One line of the streamed reply. "final" ends the turn; the process stays alive
 * after it. kind matches ManagerEvent's own vocabulary exactly ("tool" | "text") —
 * not the worker transcript's "say", a different protocol this one must not borrow
 * naming from by accident.
 */
export type RoomStreamEvent =
  | { kind: "tool" | "text"; text: string }
  | { kind: "final"; text: string; tools: string[]; redactions?: string[] }
  | { kind: "error"; text: string };

function userFrame(message: string): string {
  return `${JSON.stringify({ type: "user", message: { role: "user", content: message }, parent_tool_use_id: null })}\n`;
}

/**
 * Runs for the life of the room: one child process, held open across every turn.
 * Returns only if the child exits or is told to stop — a daemon restart never reaches
 * this process at all, since it is spawned detached, exactly like a run's supervisor.
 */
export async function superviseRoom(projectDir: string, session?: string): Promise<void> {
  const dir = roomDir(projectDir, session);
  mkdirSync(dir, { recursive: true });
  const mcpConfigPath = writeRoomMcpConfig(projectDir);
  const resumeId = readRoomSessionId(projectDir, session);

  const args = [
    ...(resumeId ? ["--resume", resumeId] : []),
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--mcp-config",
    mcpConfigPath,
    "--append-system-prompt",
    MANAGER_CONSTITUTION,
    "--permission-mode",
    "acceptEdits",
  ];
  const child: ChildProcess = spawn("claude", args, { cwd: projectDir, stdio: ["pipe", "pipe", "pipe"] });

  let sessionId: string | undefined = resumeId;
  let busy = false;
  let pending = "";
  // Set only while a turn is in flight, so stdout parsing can route events to the
  // control connection that asked for them instead of the next caller entirely.
  let activeTurn: { onEvent: (event: RoomStreamEvent) => void; tools: string[]; done: (event: RoomStreamEvent) => void } | null = null;

  child.stdout?.on("data", (chunk: Buffer) => {
    pending += chunk.toString("utf8");
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const id = sessionIdFrom(line);
      if (id && id !== sessionId) {
        sessionId = id;
        writeRoomSessionId(projectDir, id, session);
      }
      const event: ManagerEvent | null = managerEventFrom(line);
      if (event && activeTurn) {
        if (event.kind === "tool") activeTurn.tools.push(event.text);
        activeTurn.onEvent({ kind: event.kind, text: event.text });
      }
      try {
        const parsed = JSON.parse(line) as { type?: string; result?: unknown };
        if (parsed.type === "result" && activeTurn) {
          const rawText = typeof parsed.result === "string" ? parsed.result : "";
          const guarded = guardManagerProse(rawText || "(the manager returned nothing)");
          // Tool names arrived interleaved with "say" text in the tool-push above —
          // separate them back out by re-deriving from the raw lines would duplicate
          // parsing, so keep a dedicated tool list instead of reusing `text` pushes.
          const turn = activeTurn;
          activeTurn = null;
          busy = false;
          turn.done({
            kind: "final",
            text: guarded.text,
            tools: turn.tools,
            ...(guarded.redactions.length ? { redactions: guarded.redactions } : {}),
          });
        }
      } catch {
        // not a result line
      }
    }
  });
  child.stderr?.on("data", () => {
    // Swallowed deliberately: stderr noise from a long-lived process (deprecation
    // warnings, etc.) must never be mistaken for the manager's own words.
  });

  const record: RoomSupervisorRecord = { pid: process.pid, socket: roomSocketPath(projectDir, session), started_at: new Date().toISOString() };
  writeFileSync(roomSupervisorRecordPath(projectDir, session), `${JSON.stringify(record, null, 2)}\n`, "utf8");

  const server = createServer((connection: Socket) => {
    connection.setEncoding("utf8");
    let buf = "";
    connection.on("data", (raw: string) => {
      buf += raw;
      const nl = buf.indexOf("\n");
      const line = nl >= 0 ? buf.slice(0, nl) : buf;
      if (nl < 0 && buf.length < 4) return; // wait for a full line
      let op: RoomControlOp;
      try {
        op = JSON.parse(line) as RoomControlOp;
      } catch {
        connection.end(`${JSON.stringify({ kind: "error", text: "unreadable control message" })}\n`);
        return;
      }
      if (op.op === "status") {
        connection.end(`${JSON.stringify({ kind: "final", text: busy ? "busy" : "idle", tools: [] })}\n`);
        return;
      }
      if (op.op === "stop") {
        connection.end(`${JSON.stringify({ kind: "final", text: "stopping", tools: [] })}\n`);
        server.close();
        child.kill("SIGTERM");
        return;
      }
      // op.op === "ask"
      if (busy || activeTurn) {
        connection.end(`${JSON.stringify({ kind: "error", text: "a turn is already in flight" })}\n`);
        return;
      }
      busy = true;
      activeTurn = {
        tools: [],
        onEvent: (event) => {
          try {
            connection.write(`${JSON.stringify(event)}\n`);
          } catch {
            // The asking client went away; the turn still finishes and gets persisted
            // by whoever reconnects and reads /room next.
          }
        },
        done: (event) => {
          try {
            connection.end(`${JSON.stringify(event)}\n`);
          } catch {
            // Same as above — best effort only.
          }
        },
      };
      child.stdin?.write(userFrame(op.message));
    });
    connection.on("error", () => {
      // A dropped connection mid-turn must not crash the room; the turn still runs to
      // completion against child.stdout and just has nowhere to stream to.
    });
  });
  try {
    rmSync(record.socket, { force: true });
    server.listen(record.socket);
  } catch {
    // If the socket can't bind, the room still runs — it just can't be reached, and
    // the daemon-side caller's connect attempt will fail and fall back honestly.
  }

  await new Promise<void>((resolveExit) => {
    child.on("close", () => resolveExit());
    child.on("error", () => resolveExit());
  });

  try {
    server.close();
    rmSync(record.socket, { force: true });
    rmSync(roomSupervisorRecordPath(projectDir), { force: true });
  } catch {
    // Cleanup is best effort.
  }
}

/** Spawn the room supervisor detached and return immediately — mirrors dispatchDetached. */
export function dispatchRoomSupervisor(projectDir: string, session?: string): { pid: number | undefined } {
  const entry = join(__dirname, "..", "cli.js");
  const key = normalizeSessionKey(session);
  const child = spawn(
    process.execPath,
    [entry, "supervise-room", "--project", projectDir, ...(key === DEFAULT_SESSION ? [] : ["--session", key])],
    { cwd: projectDir, detached: true, stdio: "ignore" },
  );
  child.unref();
  return { pid: child.pid };
}

const ROOM_CONTROL_TIMEOUT_MS = 3000;
// A turn can run for minutes; only the CONNECTION needs a long ceiling, individual
// events reset nothing — this bounds one full "ask" round trip, not each event.
const ROOM_ASK_TIMEOUT_MS = 6 * 60_000;

/**
 * Ask the live room supervisor one message, streaming its progress and resolving with
 * the final reply. Resolves null when nothing is listening (no supervisor running, or
 * it died) — the caller's job is to fall back honestly, never to guess.
 */
export function askRoomSupervisor(
  projectDir: string,
  message: string,
  onEvent?: (event: RoomStreamEvent) => void,
  session?: string,
): Promise<RoomStreamEvent | null> {
  const path = roomSocketPath(projectDir, session);
  if (!existsSync(path)) return Promise.resolve(null);
  return new Promise((resolvePromise) => {
    let settled = false;
    const finish = (value: RoomStreamEvent | null): void => {
      if (settled) return;
      settled = true;
      resolvePromise(value);
    };
    const socket = connect(path);
    const timer = setTimeout(() => {
      socket.destroy();
      finish(null);
    }, ROOM_ASK_TIMEOUT_MS);
    socket.setEncoding("utf8");
    let buffer = "";
    socket.on("connect", () => socket.write(`${JSON.stringify({ op: "ask", message } satisfies RoomControlOp)}\n`));
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let event: RoomStreamEvent;
        try {
          event = JSON.parse(line) as RoomStreamEvent;
        } catch {
          continue;
        }
        if (event.kind === "final" || event.kind === "error") {
          clearTimeout(timer);
          finish(event);
        } else {
          onEvent?.(event);
        }
      }
    });
    socket.on("error", () => {
      clearTimeout(timer);
      finish(null);
    });
    socket.on("close", () => {
      clearTimeout(timer);
      finish(null);
    });
  });
}

export async function isRoomSupervisorLive(projectDir: string, session?: string): Promise<boolean> {
  const path = roomSocketPath(projectDir, session);
  if (!existsSync(path)) return false;
  const reply = await new Promise<boolean>((resolvePromise) => {
    const socket = connect(path);
    const timer = setTimeout(() => {
      socket.destroy();
      resolvePromise(false);
    }, ROOM_CONTROL_TIMEOUT_MS);
    socket.on("connect", () => socket.write(`${JSON.stringify({ op: "status" } satisfies RoomControlOp)}\n`));
    socket.on("data", () => {
      clearTimeout(timer);
      socket.end();
      resolvePromise(true);
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolvePromise(false);
    });
  });
  if (reply) return true;
  const record = readRoomSupervisorRecord(projectDir);
  return record ? isProcessAlive(record.pid) : false;
}
