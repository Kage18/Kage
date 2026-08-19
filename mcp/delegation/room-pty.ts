// The room's Terminal mode — a REAL pseudo-terminal running the actual interactive
// `claude` binary (no -p, no --input-format: the same command a person would type),
// rendered unmodified. This is the literal thing AO's "Terminal" session mode shows;
// the structured Room (room-supervisor.ts) is Kage's own wrapper around claude's
// headless protocol, built so runs/receipts/dispatch can be parsed as structured
// events — a raw terminal can't give us that, which is why this is ADDITIVE, not a
// replacement. AO itself ships both a Terminal and a Chat mode side by side; so do we.
//
// Plain child_process pipes are not a tty (process.stdout.isTTY is undefined on one) —
// claude's real banner/interactive UI won't render into one. A genuine pty is required,
// which Node has no built-in way to allocate; node-pty (the same native addon VS Code's
// integrated terminal uses) is the dependency that makes this possible. Verified before
// depending on it: installs cleanly, and a real interactive claude session spawned
// through it renders its actual banner (confirmed live, not assumed).
import { createServer, connect, type Socket } from "node:net";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { isProcessAlive } from "./contract.js";
import {
  readRoomSessionMeta,
  readRoomSupervisorRecord,
  resolveRoomResumeId,
  roomPermissionDigest,
  writeRoomSessionMeta,
} from "./room-supervisor.js";
import { DEFAULT_SESSION, normalizeSessionKey, roomDirFor } from "./room-sessions.js";
import { MANAGER_ALLOWED_TOOLS } from "./manager-client.js";
import { MANAGER_CONSTITUTION } from "./manager-prompt.js";
import { writeRoomMcpConfig } from "./room.js";
import { createWorktree } from "./worktree.js";

function roomDir(projectDir: string, session?: string): string {
  return roomDirFor(projectDir, session);
}

export function roomPtySocketPath(projectDir: string, session?: string): string {
  const key = normalizeSessionKey(session);
  // Default thread keeps its original digest input, for the same reason the structured
  // socket does: a changed path makes a live pty look dead and respawns under it.
  const seed = key === DEFAULT_SESSION
    ? `${resolve(projectDir)}\0__room_pty__`
    : `${resolve(projectDir)}\0__room_pty__\0${key}`;
  const digest = createHash("sha256").update(seed).digest("hex").slice(0, 16);
  return join(tmpdir(), `kage-room-pty-${digest}.sock`);
}

export function roomPtyRecordPath(projectDir: string, session?: string): string {
  return join(roomDir(projectDir, session), "pty-supervisor.json");
}

export interface RoomPtyRecord {
  pid: number;
  socket: string;
  started_at: string;
}

export function readRoomPtyRecord(projectDir: string, session?: string): RoomPtyRecord | null {
  const path = roomPtyRecordPath(projectDir, session);
  if (!existsSync(path)) return null;
  try {
    const record = JSON.parse(readFileSync(path, "utf8")) as Partial<RoomPtyRecord>;
    if (!record.pid || !record.socket) return null;
    return record as RoomPtyRecord;
  } catch {
    return null;
  }
}

/**
 * node-pty ships prebuilt binaries, and on Unix `spawn()` does not fork directly — it
 * execs a small `spawn-helper` binary out of its own prebuilds directory. npm does not
 * reliably preserve the execute bit when extracting those prebuilds (it survives a
 * from-source `npm rebuild`, but not every plain `npm install`), and when it is lost
 * the failure surfaces as a bare `posix_spawnp failed.` from deep inside the native
 * addon — with no mention of permissions, the helper, or even which file. That error
 * is indistinguishable at a glance from a sandbox or entitlement problem, which is
 * exactly the wrong tree to bark up; a one-line chmod is the entire fix.
 *
 * So: repair it in-process, every time, before the first spawn. Idempotent, cheap, and
 * it means a fresh `npm i -g` on any machine works without the user ever seeing this.
 */
export function ensureSpawnHelperExecutable(): void {
  try {
    // Resolve through node-pty's own entry point so this follows the package wherever
    // npm actually put it (local, global, hoisted) rather than guessing a path.
    const ptyEntry = require.resolve("node-pty");
    const prebuilds = join(dirname(dirname(ptyEntry)), "prebuilds");
    if (!existsSync(prebuilds)) return;
    for (const platformDir of readdirSync(prebuilds)) {
      const helper = join(prebuilds, platformDir, "spawn-helper");
      if (!existsSync(helper)) continue;
      const mode = statSync(helper).mode;
      // Already executable by the owner — nothing to do.
      if (mode & 0o100) continue;
      chmodSync(helper, 0o755);
    }
  } catch {
    // Best effort: if anything here fails, the spawn below reports the real problem.
  }
}

/**
 * Stop the structured room supervisor, if one is holding the session.
 *
 * Exported so the API can call the mirror of this before a chat turn. Best effort by
 * design: a supervisor that is already gone, or whose pid was reused, must not stop
 * the caller from taking the room.
 */
export function retireStructuredRoom(projectDir: string, session?: string): void {
  const record = readRoomSupervisorRecord(projectDir, session);
  if (!record || !isProcessAlive(record.pid)) return;
  try {
    process.kill(record.pid, "SIGTERM");
  } catch {
    // Already gone between the check and the signal.
  }
}

/**
 * The orchestrator's own worktree id/branch — the reserved counterpart to a run's id.
 * Run worktrees already live under .agent_memory/worktrees/<runId> (worktree.ts); the
 * orchestrator reuses that exact mechanism with a fixed id instead of a run id, so it
 * gets a dedicated branch and directory the same way AO's orchestrator does
 * (~/.ao/data/worktrees/<project>/orchestrator/...) — never the user's own checkout.
 */
export function orchestratorWorktreeId(session?: string): string {
  const key = normalizeSessionKey(session);
  return key === DEFAULT_SESSION ? "orchestrator" : `orchestrator-${key}`;
}

export function orchestratorBranch(session?: string): string {
  return `kage/${orchestratorWorktreeId(session)}`;
}

/**
 * Creates (or reuses) the orchestrator's worktree and drops the constitution into it as
 * CLAUDE.md — the mechanism a real interactive session actually reads on its own,
 * exactly what AO's own welcome banner points a user at with /init. This is deliberately
 * NOT --append-system-prompt: that flag rides on `-p`, the headless protocol this
 * session does not use, and a real session's own onboarding path is CLAUDE.md, not a
 * hidden prompt injection a person watching the terminal would never see.
 *
 * Returns the worktree path to use as cwd, or projectDir unchanged when no worktree can
 * be made (no git repo yet, no commits yet) — the orchestrator must still start rather
 * than fail outright, same degraded-isolation fallback every other delegation entry
 * point in this codebase already uses.
 */
export function ensureOrchestratorWorktree(projectDir: string, session?: string): string {
  try {
    const id = orchestratorWorktreeId(session);
    const handle = createWorktree(projectDir, id, orchestratorBranch(session));
    // Rewritten every time, even on a reused worktree: an updated constitution must
    // reach an orchestrator that already has a worktree from a prior session.
    writeFileSync(join(handle.path, "CLAUDE.md"), `${MANAGER_CONSTITUTION}\n`, "utf8");
    return handle.path;
  } catch {
    return projectDir;
  }
}

export interface RoomPtyLaunch {
  args: string[];
  cwd: string;
}

/**
 * Pure arg-building, mirroring buildManagerArgs/buildRoomLaunch elsewhere in this
 * package — testable without spawning a real pty or a real claude process.
 */
export function buildRoomPtyLaunch(options: { resumeId?: string; mcpConfigPath: string; cwd: string }): RoomPtyLaunch {
  return {
    args: [
      ...(options.resumeId ? ["--resume", options.resumeId] : []),
      "--mcp-config",
      options.mcpConfigPath,
      // Pre-approved so the orchestrator can act the moment it starts, same list the
      // headless manager gets (MANAGER_ALLOWED_TOOLS) — everything else (file edits,
      // shell) still goes through the normal interactive permission prompt, because
      // unlike the headless path this session has a real terminal a person can answer.
      "--allowedTools",
      [...MANAGER_ALLOWED_TOOLS, "ToolSearch"].join(","),
    ],
    cwd: options.cwd,
  };
}

export type RoomPtyOp = { op: "write"; data: string } | { op: "resize"; cols: number; rows: number } | { op: "status" };
export type RoomPtyFrame = { kind: "data"; bytes: string } | { kind: "status"; alive: boolean } | { kind: "exit" };

/**
 * Holds ONE real interactive claude session alive in a pty for the room's life.
 * Every attached control connection gets the full output broadcast (so more than one
 * browser tab can watch the same terminal) and may write keystrokes or resize it —
 * there is only ever one underlying session, same as opening the same tmux pane twice.
 */
/** Stop the pty room, if one is holding the session. Mirror of retireStructuredRoom. */
export function retirePtyRoom(projectDir: string, session?: string): void {
  const record = readRoomPtyRecord(projectDir, session);
  if (!record || !isProcessAlive(record.pid)) return;
  try {
    process.kill(record.pid, "SIGTERM");
  } catch {
    // Already gone.
  }
}

export async function superviseRoomPty(projectDir: string, session?: string): Promise<void> {
  // Imported lazily: node-pty is a native addon, and every other command this CLI
  // supports must keep working even where it fails to load.
  let pty: typeof import("node-pty");
  try {
    pty = await import("node-pty");
  } catch {
    throw new Error(
      "The terminal view needs node-pty, which is not installed on this machine (it is an optional native module). Everything else in Kage works without it.",
    );
  }
  ensureSpawnHelperExecutable();

  const dir = roomDir(projectDir, session);
  mkdirSync(dir, { recursive: true });

  // Two live processes resuming the SAME claude session would fork its context and
  // race each other's writes, which is the opposite of the unification this exists
  // for. The room is one conversation, so only one incarnation of it holds the
  // session: taking the terminal view retires the structured supervisor, and the
  // structured side does the same in reverse (see api.ts).
  retireStructuredRoom(projectDir, session);

  const claudeBin = process.env.KAGE_CLAUDE_BIN || "claude";
  // ONE session, two views — not two agents.
  //
  // Chat and Terminal previously spawned independent claude processes, so they held
  // separate contexts and separate bills: say something in one and the other had never
  // heard it. AO does not do that; its chat process runs with `--resume=<session-id>`,
  // and the session id is the shared handle between its renderings (confirmed by
  // reading its live process args). Kage now does the same: both modes resume the id
  // in room/session.json, so switching view keeps the conversation.
  // The whole point of this being a REAL session: it needs Kage's own tools to actually
  // orchestrate (kage_dispatch, kage_goal_status, kage_tell, ...), the same MCP config
  // the headless room already writes — one config path, not a second one for this view.
  const mcpConfigPath = writeRoomMcpConfig(projectDir, session);
  // Same trap the headless room has: a resumed pty session held open across a
  // MANAGER_ALLOWED_TOOLS change would otherwise carry whatever permission surface was
  // baked in at whenever it was first spawned. Same digest, same pure decision function
  // as room-supervisor.ts — see roomPermissionDigest's own comment for why this exists
  // and what it does NOT fix (--resume itself was verified fine; see this run's claim).
  const currentDigest = roomPermissionDigest(mcpConfigPath);
  const { resumeId, digestChanged } = resolveRoomResumeId(readRoomSessionMeta(projectDir, session), currentDigest);
  writeRoomSessionMeta(projectDir, { session_id: resumeId, permission_digest: currentDigest }, session);
  // Its own worktree/branch, never the user's checkout — mirrors how every run already
  // gets one (worktree.ts), just under a reserved orchestrator id instead of a run id.
  const cwd = ensureOrchestratorWorktree(projectDir, session);
  const { args } = buildRoomPtyLaunch({ resumeId, mcpConfigPath, cwd });
  const term = pty.spawn(claudeBin, args, {
    name: "xterm-256color",
    cols: 100,
    rows: 30,
    cwd,
    env: process.env as Record<string, string>,
  });

  const clients = new Set<Socket>();
  // Scrollback. A terminal's screen is CUMULATIVE — it is the sum of every byte ever
  // written, not just the latest one. Without replaying that to a newly attached
  // client, anything printed before it connected is lost forever, so a browser opening
  // the Terminal tab one second after the session started sees a blank pane even
  // though everything works. (Exactly the symptom that made this look broken.) Real
  // terminal multiplexers keep the same buffer for the same reason.
  const SCROLLBACK_LIMIT = 256 * 1024;
  let scrollback = "";

  const broadcast = (frame: RoomPtyFrame): void => {
    const line = `${JSON.stringify(frame)}\n`;
    for (const client of clients) {
      try {
        client.write(line);
      } catch {
        // A dead client socket is cleaned up by its own 'close' handler.
      }
    }
  };
  term.onData((data: string) => {
    scrollback += data;
    // Trim from the front: the most recent screen state is what matters, and an
    // unbounded buffer would grow for the life of a long session.
    if (scrollback.length > SCROLLBACK_LIMIT) scrollback = scrollback.slice(-SCROLLBACK_LIMIT);
    broadcast({ kind: "data", bytes: data });
  });

  // Say so, even in a raw terminal: this view has no structured reply text to prepend a
  // notice to (guardManagerProse's post-processing never runs here — raw bytes only), so
  // the notice is broadcast as its own terminal line instead, before the real session's
  // own output starts. Scrollback keeps it visible to a client that attaches later too.
  if (digestChanged) {
    const notice = "[kage] session restarted — tool permissions changed since last time, starting fresh.\r\n\r\n";
    scrollback += notice;
    broadcast({ kind: "data", bytes: notice });
  }

  const record: RoomPtyRecord = { pid: process.pid, socket: roomPtySocketPath(projectDir, session), started_at: new Date().toISOString() };
  writeFileSync(roomPtyRecordPath(projectDir, session), `${JSON.stringify(record, null, 2)}\n`, "utf8");

  const server = createServer((connection: Socket) => {
    clients.add(connection);
    connection.setEncoding("utf8");
    // Replay first, before any live frame — the client's screen must start from what
    // is already on the terminal, not from the next keystroke.
    if (scrollback) {
      try {
        connection.write(`${JSON.stringify({ kind: "data", bytes: scrollback } satisfies RoomPtyFrame)}\n`);
      } catch {
        // A client that dies during replay is handled by its own close handler.
      }
    }
    let buf = "";
    connection.on("data", (raw: string) => {
      buf += raw;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let op: RoomPtyOp;
        try {
          op = JSON.parse(line) as RoomPtyOp;
        } catch {
          continue;
        }
        if (op.op === "write") term.write(op.data);
        else if (op.op === "resize") {
          try {
            term.resize(Math.max(1, op.cols | 0), Math.max(1, op.rows | 0));
          } catch {
            // A resize during a bad terminal state must never take the session down.
          }
        } else if (op.op === "status") {
          try {
            connection.write(`${JSON.stringify({ kind: "status", alive: true } satisfies RoomPtyFrame)}\n`);
          } catch {
            // Best effort.
          }
        }
      }
    });
    connection.on("close", () => clients.delete(connection));
    connection.on("error", () => clients.delete(connection));
  });
  try {
    rmSync(record.socket, { force: true });
    server.listen(record.socket);
  } catch {
    // The pty still runs even if nothing can attach — a later reconnect attempt will
    // simply keep failing honestly rather than the whole session refusing to start.
  }

  await new Promise<void>((resolveExit) => {
    term.onExit(() => {
      broadcast({ kind: "exit" });
      resolveExit();
    });
  });

  try {
    server.close();
    for (const client of clients) client.destroy();
    rmSync(record.socket, { force: true });
    rmSync(roomPtyRecordPath(projectDir, session), { force: true });
  } catch {
    // Cleanup is best effort.
  }
}

export function dispatchRoomPtySupervisor(projectDir: string, session?: string): { pid: number | undefined } {
  const entry = join(__dirname, "..", "cli.js");
  const key = normalizeSessionKey(session);
  const child = spawn(
    process.execPath,
    [entry, "supervise-room-pty", "--project", projectDir, ...(key === DEFAULT_SESSION ? [] : ["--session", key])],
    { cwd: projectDir, detached: true, stdio: "ignore" },
  );
  child.unref();
  return { pid: child.pid };
}

const PTY_CONTROL_TIMEOUT_MS = 3000;

export async function isRoomPtyLive(projectDir: string, session?: string): Promise<boolean> {
  const path = roomPtySocketPath(projectDir, session);
  if (!existsSync(path)) return false;
  const reply = await new Promise<boolean>((resolvePromise) => {
    const socket = connect(path);
    const timer = setTimeout(() => {
      socket.destroy();
      resolvePromise(false);
    }, PTY_CONTROL_TIMEOUT_MS);
    socket.on("connect", () => socket.write(`${JSON.stringify({ op: "status" } satisfies RoomPtyOp)}\n`));
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
  const record = readRoomPtyRecord(projectDir, session);
  return record ? isProcessAlive(record.pid) : false;
}

export interface RoomPtyAttachment {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  close(): void;
}

/**
 * Opens ONE persistent duplex connection: the caller's onData keeps firing for as
 * long as the pty lives, and .write()/.resize() send keystrokes/size changes back
 * over the same socket. Resolves null when nothing is listening — same honesty as
 * every other "is a live thing there" check in this codebase.
 */
export function attachRoomPty(
  projectDir: string,
  onData: (bytes: string) => void,
  onExit: () => void,
  session?: string,
): Promise<RoomPtyAttachment | null> {
  const path = roomPtySocketPath(projectDir, session);
  if (!existsSync(path)) return Promise.resolve(null);
  return new Promise((resolvePromise) => {
    let settled = false;
    const socket = connect(path);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePromise(null);
    }, PTY_CONTROL_TIMEOUT_MS);
    socket.setEncoding("utf8");
    let buf = "";
    socket.on("connect", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({
        write: (data: string) => {
          try {
            socket.write(`${JSON.stringify({ op: "write", data } satisfies RoomPtyOp)}\n`);
          } catch {
            // The socket closing mid-write surfaces via onExit, not here.
          }
        },
        resize: (cols: number, rows: number) => {
          try {
            socket.write(`${JSON.stringify({ op: "resize", cols, rows } satisfies RoomPtyOp)}\n`);
          } catch {
            // Same as above.
          }
        },
        close: () => socket.end(),
      });
    });
    socket.on("data", (chunk: string) => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let frame: RoomPtyFrame;
        try {
          frame = JSON.parse(line) as RoomPtyFrame;
        } catch {
          continue;
        }
        if (frame.kind === "data") onData(frame.bytes);
        else if (frame.kind === "exit") onExit();
      }
    });
    socket.on("close", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolvePromise(null);
      } else {
        onExit();
      }
    });
    socket.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(null);
    });
  });
}
