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
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isProcessAlive, readRun } from "./contract.js";
import { DEFAULT_SESSION, normalizeSessionKey, readActiveGoal, roomDirFor } from "./room-sessions.js";
import { sessionIdFrom } from "./adapters/cli-agent.js";
import {
  MANAGER_ALLOWED_TOOLS, collectManagerFacts, managerEventFrom, guardManagerProse, type ManagerEvent } from "./manager-client.js";
import { MANAGER_CONSTITUTION, managerPromptFor } from "./manager-prompt.js";
import { writeRoomMcpConfig } from "./room.js";
import { readRoomHistory, type RoomHistoryTurn } from "./room-history.js";
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

export interface RoomSessionMeta {
  /** The live agent's own session id — AO calls this agent_session_id; Kage's version
   * doubles as the --resume handle both the pty and headless managers share. */
  session_id?: string;
  /** roomPermissionDigest() at the moment this session was (re)started — see resolveRoomResumeId. */
  permission_digest?: string;
  /** Where claude's own native jsonl for `session_id` lives — AO's native_transcript_path.
   * Set only by the pty manager (room-pty.ts), which knows its cwd; the headless
   * manager's stream-json protocol has no equivalent file to point at. */
  native_transcript_path?: string;
  /** Set true the instant an ask (pty or headless) times out waiting for a reply, and
   * cleared back to false the instant an ask genuinely succeeds. A wedged claude
   * session answers `alive:true` to a process-liveness probe forever — this is the
   * only honest signal that the SESSION itself, not just its process, stopped
   * answering, and is what makes a wedged-forever session recyclable instead of
   * silently eating another full timeout window on every future ask. */
  last_ask_timed_out?: boolean;
}

export function readRoomSessionMeta(projectDir: string, session?: string): RoomSessionMeta {
  const path = roomSessionPath(projectDir, session);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as RoomSessionMeta;
  } catch {
    return {};
  }
}

/**
 * Merges onto whatever is already on disk rather than overwriting outright — a caller
 * that only knows about a subset of fields (or a field this file's own type has never
 * heard of, added by some future extension) must not silently wipe the rest just
 * because it wrote next. Only the keys actually present in `meta` change; every other
 * field already on disk survives untouched.
 */
export function writeRoomSessionMeta(projectDir: string, meta: RoomSessionMeta, session?: string): void {
  const path = roomSessionPath(projectDir, session);
  mkdirSync(dirname(path), { recursive: true });
  let existing: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      existing = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }
  const merged = { ...existing, ...meta };
  writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
}

export function readRoomSessionId(projectDir: string, session?: string): string | undefined {
  return readRoomSessionMeta(projectDir, session).session_id;
}

/** Preserves whatever digest is already on disk — only the id changes here. */
export function writeRoomSessionId(projectDir: string, sessionId: string, session?: string): void {
  const existing = readRoomSessionMeta(projectDir, session);
  writeRoomSessionMeta(projectDir, { ...existing, session_id: sessionId }, session);
}

/**
 * Retires a wedged session's identity so the NEXT spawn (headless or pty) can never
 * --resume the exact session id that stopped answering — killing and respawning the
 * *process* alone cannot fix this, because a fresh process just resumes the same
 * poisoned session again (resolveRoomResumeId trusts whatever session_id is on disk).
 * The old record is renamed aside, never overwritten in place, so a wedge stays
 * inspectable after the fact instead of vanishing the moment it's recovered from — the
 * same instinct behind hand-preserving a wedged session.json rather than deleting it.
 * A fresh, empty meta is left in its place: superviseRoom/superviseRoomPty then see no
 * session_id, spawn without --resume, and (since firstTurnPending tracks "no resumeId",
 * not "the permission digest changed") replay recent history so the thread still reads
 * as continuous despite the session underneath being brand new.
 */
export function retireRoomSession(projectDir: string, session?: string, reason = "wedged"): void {
  const path = roomSessionPath(projectDir, session);
  if (existsSync(path)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    try {
      renameSync(path, `${path}.${reason}-${stamp}`);
    } catch {
      // Best effort: if the rename fails (e.g. a concurrent writer), the fresh write
      // below still lands — losing the forensic copy is much better than never
      // recovering the session at all.
    }
  }
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify({}, null, 2)}\n`, "utf8");
  } catch {
    // Nothing more this function can do if even a fresh write fails — the next reader
    // falls back to readRoomSessionMeta's own torn-file handling.
  }
}

/**
 * The effective permission surface a headless/pty manager session is granted: the tool
 * allowlist plus which MCP servers are wired in (read back from the config file actually
 * written for this launch, not re-derived, so a future change to the server set is
 * caught the same way a change to the tool list is). Verified NOT to be the mechanism
 * behind the observed "needs your approval" stall (see room-permission-trap.test.ts and
 * the claim for this run for the live `claude --resume` experiments that ruled it out) —
 * this digest exists to catch a DIFFERENT, real bug: a long-lived supervisor process
 * that was spawned under an older, smaller MANAGER_ALLOWED_TOOLS never re-spawns on its
 * own, so it keeps running with args baked in at whatever moment it started, for as long
 * as the process stays alive. A digest mismatch is the signal that the currently-recorded
 * session was (or may have been) started under a different permission surface than the
 * one about to spawn a fresh process now.
 */
export function roomPermissionDigest(mcpConfigPath: string): string {
  let mcpServerNames: string[] = [];
  try {
    const config = JSON.parse(readFileSync(mcpConfigPath, "utf8")) as { mcpServers?: Record<string, unknown> };
    mcpServerNames = Object.keys(config.mcpServers ?? {}).sort();
  } catch {
    // A missing/unreadable config file still yields a stable (empty-server) digest
    // rather than throwing — the caller's own writeRoomMcpConfig call already handles
    // the write side; this is read-only and must never block a room from starting.
  }
  const allowedTools = [...MANAGER_ALLOWED_TOOLS, "ToolSearch"];
  return createHash("sha256").update(JSON.stringify({ allowedTools, mcpServerNames })).digest("hex").slice(0, 16);
}

/**
 * Whether a (re)spawning supervisor should pass --resume, and whether it is dropping a
 * previously-recorded session id to do so. Pure so the two cases that matter most — an
 * unchanged permission surface keeps resuming, a changed one starts fresh — are directly
 * unit-testable without spawning a process (mcp/room-permission-trap.test.ts).
 *
 * No stored digest at all (a session.json from before this field existed, or a thread
 * that has never started) is treated as "unknown, not a change" — trusting resume rather
 * than gratuitously restarting every existing conversation the moment this ships.
 */
export function resolveRoomResumeId(
  meta: RoomSessionMeta,
  currentDigest: string,
): { resumeId?: string; digestChanged: boolean } {
  const digestChanged = Boolean(meta.permission_digest) && meta.permission_digest !== currentDigest;
  return { resumeId: digestChanged ? undefined : meta.session_id, digestChanged };
}

// ---------------------------------------------------------------------------
// Safety net: a manager that asks the user to "grant permission" for a tool it already
// holds is not describing reality — headless (-p) and pty rooms have no permission
// dialog anywhere in their path. Rewriting the digest is the real fix (above); this
// catches whatever slips past it — a race, a manually-copied session.json, a model that
// misreads an unrelated error as a permission denial — and turns a "wait forever"
// instruction into something the user can actually act on.
const PERMISSION_STUCK_PATTERN = /\b(grant(?:ed)?\s+permission|needs?\s+your\s+approval|when\s+prompted|permission\s+to\s+use)\b/i;

/**
 * Returns the bare tool name (e.g. "kage_goal_create") the manager named, when its own
 * reply both (a) uses stuck-waiting-for-a-prompt language and (b) names a tool that is
 * ALREADY in MANAGER_ALLOWED_TOOLS — i.e. the manager is asking for something that both
 * cannot happen (no dialog exists) and should not be necessary (the tool is already
 * allowed). Returns null on ordinary text, and null when the named tool genuinely is
 * outside the manager's surface — that is a correct, honest denial, not a stuck state.
 */
export function detectPermissionStuckMention(text: string): string | null {
  if (!PERMISSION_STUCK_PATTERN.test(text)) return null;
  for (const fullName of MANAGER_ALLOWED_TOOLS) {
    const bareName = fullName.replace("mcp__kage__", "");
    if (text.includes(fullName) || text.includes(bareName)) return bareName;
  }
  return null;
}

/**
 * Exported so the pty reply path (api.ts) can apply the exact same honesty guard the
 * headless supervisor already applies to its own replies — a manager narrating that it
 * is stuck waiting for a permission prompt is never true in EITHER headless or pty
 * rooms (both pre-approve MANAGER_ALLOWED_TOOLS), so both paths must catch it the same
 * way instead of only one of them silently accepting the impossible claim as prose.
 */
export function permissionStuckNote(toolName: string): string {
  return (
    `(Kage note: ${toolName} is already permitted for this session — there is no permission ` +
    "prompt to grant in this headless room. If this repeats, try again in a moment or reopen the Room.)"
  );
}

/** Last 8 turns, replayed as plain text ahead of the real first message — same bound and
 * "User:"/"You:" convention as composePrompt (manager-client.ts), reused here because a
 * freshly-started (non-resumed) session has none of a resumed session's native context. */
function historyReplayPrefix(history: RoomHistoryTurn[]): string {
  if (!history.length) return "";
  const lines = history.slice(-8).map((turn) => `${turn.role === "you" ? "User" : "You"}: ${turn.text}`);
  return `[This session restarted — recent conversation for context:]\n${lines.join("\n")}\n\n`;
}

const SESSION_RESTART_NOTICE =
  "[kage] this session restarted because the manager's tool permissions changed since last time — " +
  "recent conversation was replayed so the thread continues.";

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
 * claude sets CLAUDE_CODE_CHILD_SESSION=1 on every subagent/child process it spawns
 * (confirmed by inspecting the installed claude CLI). When Kage's own daemon is itself
 * launched from inside such a child — e.g. an agent session running Kage's dev server —
 * that marker leaks into every `claude` process Kage spawns in turn, and an INTERACTIVE
 * one reads it as "I am a nested child, do not persist my own transcript", printing
 * "Transcript saving is off — inherited CLAUDE_CODE_CHILD_SESSION marker" and never
 * writing the native jsonl room-transcript.ts (and Chat's has_transcript flag) depend
 * on. Kage's orchestrator is never actually a subagent of whatever spawned the daemon —
 * it is its own top-level session — so this must always be scrubbed, and
 * CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 set as belt-and-suspenders (the same escape
 * hatch the CLI's own warning names). Used for every `claude` process this module
 * spawns, interactive or headless: the marker is harmless to strip either way, and a
 * future claude release could widen which spawn shapes it affects.
 */
const CHILD_SESSION_MARKER_VARS = ["CLAUDE_CODE_CHILD_SESSION"];

export function orchestratorSpawnEnv(base: NodeJS.ProcessEnv): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (CHILD_SESSION_MARKER_VARS.includes(key)) continue;
    if (value !== undefined) next[key] = value;
  }
  next.CLAUDE_CODE_FORCE_SESSION_PERSISTENCE = "1";
  return next;
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
export function buildHeadlessRoomArgs(options: { resumeId?: string; mcpConfigPath: string; systemPrompt?: string }): string[] {
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
    options.systemPrompt ?? MANAGER_CONSTITUTION,
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
  const currentDigest = roomPermissionDigest(mcpConfigPath);
  const { resumeId, digestChanged } = resolveRoomResumeId(readRoomSessionMeta(projectDir, session), currentDigest);
  // Persisted immediately, before the child even spawns: a crash before the first turn
  // completes must still leave the NEW digest on disk, not the stale one that triggered
  // this restart — otherwise the next spawn would see the same mismatch and loop.
  writeRoomSessionMeta(projectDir, { session_id: resumeId, permission_digest: currentDigest }, session);

  // The open-goals digest is folded into the system prompt at spawn time, never cached —
  // a headless manager that restarts (the exact failure mode goals must survive) gets a
  // brief that reflects whatever the goal directory says RIGHT NOW, not what it said the
  // last time this session came up.
  const args = buildHeadlessRoomArgs({ resumeId, mcpConfigPath, systemPrompt: managerPromptFor(projectDir) });
  const child: ChildProcess = spawn("claude", args, {
    cwd: projectDir,
    stdio: ["pipe", "pipe", "pipe"],
    env: orchestratorSpawnEnv(process.env),
  });

  let sessionId: string | undefined = resumeId;
  let busy = false;
  let pending = "";
  // True only until the FIRST turn of a freshly-restarted (non-resumed) session is sent
  // or completed — a resumed session never touches this. Keyed on "no resumeId at all",
  // not on digestChanged specifically: a session can also start fresh because
  // retireRoomSession rotated away a wedged session_id, and that history replay is just
  // as necessary there as it is on a permission-digest change (readRoomHistory is a
  // no-op on a brand-new room either way, so this is never wrong to set too broadly).
  let firstTurnPending = !resumeId;
  // The restart NOTICE, unlike the replay above, is specific wording about permissions
  // changing — it must stay tied to digestChanged alone, or a wedge-recovery restart
  // would tell the user something false ("tool permissions changed") about why it
  // restarted. The failure turn recorded at the moment of the timeout (api.ts) is what
  // tells the truth for a wedge recovery instead.
  let noticePending = digestChanged;
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
          let text = guarded.text;
          // Safety net: the manager asking to "grant permission" for a tool it already
          // holds cannot be satisfied — there is no dialog in this headless path — so
          // replace the impossible instruction with something the user can act on.
          const stuckTool = detectPermissionStuckMention(text);
          if (stuckTool) text = `${text}\n\n${permissionStuckNote(stuckTool)}`;
          if (noticePending) {
            text = `${SESSION_RESTART_NOTICE} ${text}`;
            noticePending = false;
          }
          turn.done({
            kind: "final",
            text,
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
      // A freshly-restarted (non-resumed) session has none of a resumed session's
      // native context — replay recent history ahead of the real first message so the
      // thread survives the restart instead of the manager waking up amnesiac.
      let outgoing = op.message;
      if (firstTurnPending) {
        outgoing = `${historyReplayPrefix(readRoomHistory(projectDir, session))}${op.message}`;
        firstTurnPending = false;
      }
      child.stdin?.write(userFrame(outgoing));
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
 * Synthetic wake states the review gate sends (mcp/index.ts's kage_review_run) — never a
 * kernel RunState (contract.ts's RUN_STATES). A run under review stays "ready" in the
 * kernel's own eyes the whole time; the review verdict rides the SAME event bridge as a
 * real state change so a held manager session learns about it without a second channel,
 * but it needs its own phrasing here: "run X is now reviewed" reads as a kernel fact it
 * is not, so these get the plain "review verdict:" wording below instead.
 */
export const REVIEWED_EVENT_STATE = "reviewed";
export const REVIEW_EVENT_STATES = new Set([REVIEWED_EVENT_STATE]);

function isReviewEvent(state: string): boolean {
  return REVIEW_EVENT_STATES.has(state);
}

/** The single-event wake's own middle clause — "(goal intent) is now X: detail" for an
 * ordinary state, "(goal intent) review verdict: X" for a review event — kept as one
 * function so the two wordings can never drift apart from where this is called. */
function eventClause(goalIntent: string, event: { state: string; detail?: string }): string {
  if (isReviewEvent(event.state)) return `(${goalIntent}) review verdict: ${event.detail ?? "no detail"}`;
  return `(${goalIntent}) is now ${event.state}${event.detail ? `: ${event.detail}` : ""}`;
}

/** One event's line for the coalesced drain (no goal intent — that's stated once in the
 * frame's own preamble, see drainPendingGoalEvents below). */
function eventLine(runId: string, event: { state: string; detail?: string }): string {
  if (isReviewEvent(event.state)) return `run ${runId} review verdict: ${event.detail ?? "no detail"}`;
  return `run ${runId} is now ${event.state}${event.detail ? `: ${event.detail}` : ""}`;
}

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
  const message = `[kage event] run ${runId} ${eventClause(goal.intent, event)}${note ? ` — ${note}` : ""}`;
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
  const lines = shown.map((evt) => eventLine(evt.run_id, evt));
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
