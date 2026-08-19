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
import { isProcessAlive, readRun } from "./contract.js";
import { DEFAULT_SESSION, normalizeSessionKey, readActiveGoal, roomDirFor } from "./room-sessions.js";
import { sessionIdFrom } from "./adapters/cli-agent.js";
import {
  MANAGER_ALLOWED_TOOLS, collectManagerFacts, managerEventFrom, guardManagerProse, type ManagerEvent } from "./manager-client.js";
import { MANAGER_CONSTITUTION } from "./manager-prompt.js";
import { writeRoomMcpConfig } from "./room.js";
import {
  appendGoalEvent,
  goalForRun,
  markGoalEventsDelivered,
  readGoal,
  readPendingGoalEvents,
  type GoalEventRecord,
  type GoalRecord,
} from "./goal.js";

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
  | { kind: "final"; text: string; tools: string[]; corrections?: string[] }
  | { kind: "error"; text: string };

function userFrame(message: string): string {
  return `${JSON.stringify({ type: "user", message: { role: "user", content: message }, parent_tool_use_id: null })}\n`;
}

/**
 * Runs for the life of the room: one child process, held open across every turn.
 * Returns only if the child exits or is told to stop — a daemon restart never reaches
 * this process at all, since it is spawned detached, exactly like a run's supervisor.
 */
/**
 * Pure arg-building for the headless room, pulled out only so it is unit-testable
 * without spawning a real `claude` process — the array itself is unchanged from before
 * this extraction, byte for byte.
 */
export function buildHeadlessRoomArgs(options: { resumeId?: string; mcpConfigPath: string }): string[] {
  return [
    ...(options.resumeId ? ["--resume", options.resumeId] : []),
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--mcp-config",
    options.mcpConfigPath,
    "--append-system-prompt",
    MANAGER_CONSTITUTION,
    "--permission-mode",
    "acceptEdits",
    // Without this, the held manager is permission-denied on EVERY kage tool, forever:
    // -p is headless, so there is no dialog anywhere for a human to approve, and the
    // manager loops asking the user to "check the permission prompt" that does not
    // exist. The one-shot fallback in manager-client.ts always passed this — the two
    // spawn sites drifted, so the fallback could dispatch and the live session (the
    // path that actually runs) never could. acceptEdits covers file edits only; MCP
    // tools need an explicit allow in headless mode.
    "--allowedTools",
    [...MANAGER_ALLOWED_TOOLS, "ToolSearch"].join(","),
  ];
}

export async function superviseRoom(projectDir: string, session?: string): Promise<void> {
  const dir = roomDir(projectDir, session);
  mkdirSync(dir, { recursive: true });
  const mcpConfigPath = writeRoomMcpConfig(projectDir, session);
  const resumeId = readRoomSessionId(projectDir, session);

  const args = buildHeadlessRoomArgs({ resumeId, mcpConfigPath });
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
          const guarded = guardManagerProse(rawText || "(the manager returned nothing)", collectManagerFacts(projectDir));
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
            ...(guarded.corrections.length ? { corrections: guarded.corrections } : {}),
          });
          // Now idle: pick up anything the event bridge left pending while this turn
          // was in flight. Self-dials the control socket we are about to listen on
          // (below) — by the time this connects, busy is already false, so it lands
          // as an ordinary "ask" and reuses the exact same delivery path a human
          // message takes. Best-effort: a failure here just leaves events pending for
          // the next idle window, never a crash of the held session.
          drainPendingGoalEvents(projectDir, session).catch(() => {});
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

// ---------------------------------------------------------------------------
// Event bridge — the manager as an event-driven orchestrator, not just a chat partner.
//
// A run finishing outside any goal must never wake the manager: a human-only run is the
// user's own business, and injecting an unsolicited turn into their conversation would
// be exactly the kind of surprise this product exists to prevent. Only a run attached to
// an ACTIVE goal (planning or executing — never done/abandoned) qualifies.

export interface RunBridgeEvent {
  state: string;
  detail?: string;
}

/** Test seam: real production dependencies, injectable so tests never spawn a real process. */
export interface NotifyManagerDeps {
  isLiveFn?: (projectDir: string, session?: string) => Promise<boolean>;
  goalForRunFn?: (projectDir: string, runId: string) => GoalRecord | null;
  sendFrameFn?: (projectDir: string, message: string, session?: string) => Promise<boolean>;
  appendGoalEventFn?: (
    projectDir: string,
    goalId: string,
    event: { run_id: string; state: string; detail?: string },
  ) => GoalEventRecord;
  markGoalEventsDeliveredFn?: (projectDir: string, goalId: string, ids: string[]) => void;
}

const WAVE_TERMINAL_STATES = new Set(["merged", "rejected", "failed"]);

/**
 * When runId is the last run of its wave to reach a terminal state, and the goal plans a
 * further wave after it, this is the fact the manager keeps getting wrong by inference:
 * that the wave is DONE and what comes next. Returns the explicit note to append to the
 * event frame, or null when the wave isn't fully settled yet, runId isn't in any wave, or
 * the completed wave is the goal's last one (nothing further to announce).
 */
function waveCompletionNote(projectDir: string, goal: GoalRecord, runId: string): string | null {
  const waves = goal.plan.waves;
  const waveIndex = waves.findIndex((wave) => wave.run_ids.includes(runId));
  if (waveIndex === -1) return null;
  const wave = waves[waveIndex];
  if (!wave.run_ids.length || wave.run_ids.length < wave.runs.length) return null; // still filling
  const states: string[] = [];
  for (const id of wave.run_ids) {
    let state: string;
    try {
      state = readRun(projectDir, id).state;
    } catch {
      return null; // a vanished run means this wave can never be called settled
    }
    if (!WAVE_TERMINAL_STATES.has(state)) return null; // some run in the wave is still in flight
    states.push(state);
  }
  const nextWave = waves[waveIndex + 1];
  if (!nextWave || !nextWave.runs.length) return null; // no further wave planned

  const tally = new Map<string, number>();
  for (const state of states) tally.set(state, (tally.get(state) ?? 0) + 1);
  const tallyText = [...tally.entries()].map(([state, count]) => `${count} ${state}`).join(", ");
  const nextSpecs = nextWave.runs
    .map((spec) => `"${spec.intent}" (${spec.type}: ${spec.files_scope.join(", ") || "no files_scope"})`)
    .join("; ");
  return `wave ${waveIndex + 1} of ${waves.length} complete: ${tallyText}. Wave ${waveIndex + 2} is next: ${nextSpecs}`;
}

const RUN_EVENT_RATE_LIMIT_MS = 30_000;
const lastRunEventByKey = new Map<string, { state: string; at: number }>();

function runEventKey(projectDir: string, runId: string, session?: string): string {
  return `${resolve(projectDir)}\0${normalizeSessionKey(session)}\0${runId}`;
}

/** Real send path: an ordinary "ask" round trip, same protocol a human message uses. */
async function sendFrameToHeldSession(projectDir: string, message: string, session?: string): Promise<boolean> {
  const reply = await askRoomSupervisor(projectDir, message, undefined, session);
  return reply?.kind === "final";
}

/**
 * Wakes the held manager session with a compact context frame when a goal-owned run
 * changes state — "[kage event] run <id> (<goal intent>) is now <state>: <detail>".
 * Rate-limited per run: a repeat of the same state is always dropped, and no run gets a
 * second frame within 30s regardless of state.
 *
 * ALWAYS appends the event to the goal's durable pending log first (goal.ts) — a busy
 * or dead manager must never turn a real state change into a silent drop. Immediate
 * delivery is then attempted best-effort; on success the just-appended event is marked
 * delivered, on failure it simply stays pending for the room supervisor's idle-drain
 * (drainPendingGoalEvents, below) or a later live call to pick up. Resolves false
 * whenever nothing was sent this call — callers treat this as fire-and-forget and must
 * never let a false break a request; it does NOT mean the event was lost.
 */
export async function notifyManagerOfRunEvent(
  projectDir: string,
  runId: string,
  event: RunBridgeEvent,
  session?: string,
  deps: NotifyManagerDeps = {},
): Promise<boolean> {
  const findGoal = deps.goalForRunFn ?? goalForRun;
  const goal = findGoal(projectDir, runId);
  if (!goal || (goal.state !== "planning" && goal.state !== "executing")) return false;

  const key = runEventKey(projectDir, runId, session);
  const now = Date.now();
  const last = lastRunEventByKey.get(key);
  if (last && (last.state === event.state || now - last.at < RUN_EVENT_RATE_LIMIT_MS)) return false;
  lastRunEventByKey.set(key, { state: event.state, at: now });

  const append = deps.appendGoalEventFn ?? appendGoalEvent;
  const record = append(projectDir, goal.id, { run_id: runId, state: event.state, ...(event.detail ? { detail: event.detail } : {}) });

  const isLive = deps.isLiveFn ?? isRoomSupervisorLive;
  if (!(await isLive(projectDir, session))) return false;

  const note = WAVE_TERMINAL_STATES.has(event.state) ? waveCompletionNote(projectDir, goal, runId) : null;
  const message = `[kage event] run ${runId} (${goal.intent}) is now ${event.state}${event.detail ? `: ${event.detail}` : ""}${note ? ` — ${note}` : ""}`;
  const send = deps.sendFrameFn ?? sendFrameToHeldSession;
  const delivered = await send(projectDir, message, session);
  if (delivered) (deps.markGoalEventsDeliveredFn ?? markGoalEventsDelivered)(projectDir, goal.id, [record.id]);
  return delivered;
}

const GOAL_EVENT_DRAIN_CAP = 5;

/** Group by run, latest state wins; cap how many distinct runs make it into one frame.
 * Also collects the wave-completion note (if any) for each shown run that just settled —
 * same fact notifyManagerOfRunEvent surfaces on the single-event path, reused here rather
 * than left to the manager to infer from a batch of individual run lines. */
function coalesceGoalEvents(
  events: GoalEventRecord[],
  projectDir: string,
  goal: GoalRecord,
): {
  lines: string[];
  ids: string[];
  supersededCount: number;
  omittedCount: number;
  notes: string[];
} {
  const latestByRun = new Map<string, GoalEventRecord>();
  for (const evt of events) latestByRun.set(evt.run_id, evt);
  const runs = [...latestByRun.values()];
  const shown = runs.slice(0, GOAL_EVENT_DRAIN_CAP);
  const lines = shown.map((evt) => `run ${evt.run_id} is now ${evt.state}${evt.detail ? `: ${evt.detail}` : ""}`);
  const notes = new Set<string>();
  for (const evt of shown) {
    if (!WAVE_TERMINAL_STATES.has(evt.state)) continue;
    const note = waveCompletionNote(projectDir, goal, evt.run_id);
    if (note) notes.add(note);
  }
  return {
    lines,
    ids: events.map((evt) => evt.id),
    supersededCount: events.length - runs.length,
    omittedCount: runs.length - shown.length,
    notes: [...notes],
  };
}

/**
 * Drains whatever goal events are pending for the thread's ACTIVE goal (room-sessions.ts)
 * into one coalesced frame, delivered as the next user frame into the held session.
 * Called at the moment a turn completes and the room goes idle (superviseRoom, above) so
 * events dropped by notifyManagerOfRunEvent while busy are never lost — only delayed.
 * Resolves false (nothing delivered — events remain pending) when there is no active
 * goal, no goal events are pending, the goal already finished, the session isn't live,
 * or delivery itself failed (e.g. a race re-grabbed busy first).
 */
export async function drainPendingGoalEvents(
  projectDir: string,
  session?: string,
  deps: NotifyManagerDeps & {
    readActiveGoalFn?: (projectDir: string, session?: string) => string | null;
    readGoalFn?: (projectDir: string, goalId: string) => GoalRecord;
    readPendingGoalEventsFn?: (projectDir: string, goalId: string) => GoalEventRecord[];
  } = {},
): Promise<boolean> {
  const getActiveGoal = deps.readActiveGoalFn ?? readActiveGoal;
  // readActiveGoal's real signature takes a required thread key, not an optional one —
  // a drain with no explicit session means the default thread, same normalization every
  // other session-keyed lookup in this file already applies (roomSocketPath, runEventKey).
  const goalId = getActiveGoal(projectDir, normalizeSessionKey(session));
  if (!goalId) return false;

  const getPending = deps.readPendingGoalEventsFn ?? readPendingGoalEvents;
  const pending = getPending(projectDir, goalId);
  if (!pending.length) return false;

  const getGoal = deps.readGoalFn ?? readGoal;
  let goal: GoalRecord;
  try {
    goal = getGoal(projectDir, goalId);
  } catch {
    return false;
  }
  if (goal.state !== "planning" && goal.state !== "executing") return false;

  const isLive = deps.isLiveFn ?? isRoomSupervisorLive;
  if (!(await isLive(projectDir, session))) return false;

  const { lines, ids, supersededCount, omittedCount, notes } = coalesceGoalEvents(pending, projectDir, goal);
  const suffixParts: string[] = [];
  if (supersededCount > 0) suffixParts.push(`${supersededCount} superseded update${supersededCount === 1 ? "" : "s"} coalesced`);
  if (omittedCount > 0) suffixParts.push(`${omittedCount} more run${omittedCount === 1 ? "" : "s"} not shown`);
  const suffix = suffixParts.length ? ` (${suffixParts.join("; ")})` : "";
  const noteSuffix = notes.length ? ` ${notes.join(" ")}` : "";
  const message = `[kage event] ${goal.intent}: ${lines.join("; ")}${suffix}${noteSuffix}`;

  const send = deps.sendFrameFn ?? sendFrameToHeldSession;
  const delivered = await send(projectDir, message, session);
  if (delivered) (deps.markGoalEventsDeliveredFn ?? markGoalEventsDelivered)(projectDir, goalId, ids);
  return delivered;
}
