// Run API + SSE for the delegation layer.
//
// Mounted by the daemon behind guardRequest, but implemented here so the routes are
// testable with a bare http server. Two laws govern this file:
//
//   1. Events are notifications, never state. The SSE payload is {run_id, seq} and
//      nothing else; a client that misses one re-reads /runs and loses nothing.
//      (Accumulating event payloads is the mechanism behind AO's phantom-state bug.)
//   2. The response never invents facts. Every body is built from RunView / SteerResult /
//      MergeResult exactly as the kernel returns them — delivery vocabulary included.

import type { IncomingMessage, ServerResponse } from "node:http";
import { watch, type FSWatcher } from "node:fs";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  createRun,
  isBranchLanded,
  listRuns,
  readClaim,
  readRun,
  runDir,
  runsDir,
  runTranscriptPath,
  transitionRun,
  writeBrief,
  type ClaimRecord,
  type RunType,
  type RunView,
} from "./contract.js";
import { appendSteerRecord, dispatchDetached, dispatchRun, readSteerRecords } from "./dispatch.js";
import {
  abandonGoal,
  attachRunToGoal,
  checkGoalAcceptsNewRun,
  createGoal,
  goalForRun,
  goalWaveStatus,
  listGoals,
  readGoal,
  type GoalAutonomy,
  type GoalRecord,
  type GoalRunSpec,
} from "./goal.js";
import { compileBrief, renderBrief } from "./brief.js";
import { normalizeRunType, preflightForecast } from "./preflight.js";
import { deleteQueuedSteer, editQueuedSteer, reorderQueuedSteers, steerRun, type SteerQueueResult } from "./steer.js";
import { sendControl, isRunLive, stopRun } from "./control.js";
import { handBack, takeOverRun, type RunPtyAttachment } from "./run-pty.js";
import { mergeRun, rejectRun } from "./ratify.js";
import { readAgentReview, type AgentReviewRecord } from "./review.js";
import { adoptOrphanedRun, isWorktreeAdoptable, killOrphanedAgent, resumeStoppedRun } from "./recovery.js";
import { adapterByName, detectAgent } from "./adapters/index.js";
import { eventsSincePage } from "./report.js";
import { claimVerdict, renderClaimCard } from "./verify.js";
import { suggestedNextForRoom, suggestedNextPrompt } from "./suggest.js";
import { readActivity } from "./progress.js";
import { currentBranch, diffFileTree, git, type DiffFileEntry } from "./git.js";
import { worktreePath } from "./worktree.js";
import { askManager, EMPTY_REPLY_RETRY_NUDGE } from "./manager-client.js";
import { appendRoomTurn, readRoomHistory, type RoomHistoryTurn } from "./room-history.js";
import { parseKageActionsReply, type RoomActions } from "./room-actions.js";
import {
  askRoomSupervisor,
  detectPermissionStuckMention,
  dispatchRoomSupervisor,
  isRoomSupervisorLive,
  permissionStuckNote,
  readRoomSessionMeta,
  readRoomSupervisorRecord,
  writeRoomSessionMeta,
  type RoomStreamEvent,
} from "./room-supervisor.js";
import {
  readNativeTranscriptPage,
  waitForNewAssistantTurns,
  waitForRoomSessionIdentity,
  TRANSCRIPT_PAGE_CAP,
} from "./room-transcript.js";
import { ADAPTER_NAMES, isAgentInstalled } from "./adapters/index.js";
import { DEFAULT_DIFF_BUDGET, DEFAULT_MAX_CONCURRENT, readDelegationConfig, writeDelegationConfig } from "./config.js";
import { forgetProject, rememberProject } from "./projects.js";
import { addProject, installedAgents, resolveProjectPath, type AddProjectRefused } from "./add-project.js";
import { ensureAppDaemon } from "./app-daemon.js";
import { packetFlywheel, packetsTaughtByRun, readMemoryOverview, readMemoryPacket, recordMemoryFeedback } from "./memory-view.js";
import { blastRadiusFor, type BlastRadius } from "./blast-radius.js";
import {
  attachRoomPty,
  dispatchRoomPtySupervisor,
  frameChatInputForPty,
  isPtySupervisorStale,
  isRoomPtyLive,
  readRoomPtyRecord,
  retirePtyRoom,
  retireStructuredRoom,
  rotatePtySupervisor,
  type RoomPtyAttachment,
} from "./room-pty.js";
import {
  DEFAULT_SESSION,
  closeRoomSession,
  createRoomSession,
  listRoomSessions,
  normalizeSessionKey,
  readActiveGoal,
  renameRoomSession,
  setActiveGoal,
} from "./room-sessions.js";

const MAX_BODY_BYTES = 256 * 1024;

export function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
      } catch {
        reject(new Error("request body is not valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

/**
 * Serve a file straight out of an installed npm dependency's own package — no vendoring
 * into this repo, no CDN. `require.resolve` finds it wherever npm actually placed it
 * (local install, global install, monorepo hoist), which is the only way this stays
 * correct across every install shape after the v4.0.1 lesson: assets that exist in a
 * dev checkout but 404 from the published package.
 */
function serveDependencyFile(res: ServerResponse, specifier: string, contentType: string): void {
  try {
    const path = require.resolve(specifier);
    res.writeHead(200, { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" });
    res.end(readFileSync(path));
  } catch (error) {
    json(res, 404, { ok: false, error: `${specifier} is not available: ${(error as Error).message}` });
  }
}

// ---------------------------------------------------------------------------
// SSE feed
// ---------------------------------------------------------------------------

export interface DelegationFeed {
  handleRequest(req: IncomingMessage, res: ServerResponse): void;
  /** Notify subscribers that a run changed. Called directly by API mutations. */
  notify(runId: string): void;
  /**
   * Live deltas from an in-flight manager turn (text as it forms, tools as it's
   * called). Unlike run events this payload DOES carry content, not just an id —
   * but it is still not the source of truth: the persisted room history is, and a
   * client that misses a delta just re-fetches /room once the turn's "final" event
   * lands. No corruption risk, only a possibly-choppy typing animation.
   */
  notifyRoom(payload: Record<string, unknown>): void;
  /**
   * Raw pty output/exit, broadcast to every connected client verbatim. The frame
   * carries its thread key so a client watching one terminal never paints another
   * thread's bytes into it — the SSE stream is shared, the screens are not.
   */
  notifyPty(frame: ({ kind: "data"; bytes: string } | { kind: "exit" }) & { session?: string }): void;
  clientCount(): number;
  close(): void;
}

/**
 * fs.watch covers mutations from OTHER processes (CLI, TUI, supervisors); API mutations
 * call notify() directly so an app driving the API never depends on watcher latency.
 */
export function createDelegationFeed(projectDir: string, options: { heartbeatMs?: number } = {}): DelegationFeed {
  const clients = new Set<ServerResponse>();
  let seq = 0;
  let watcher: FSWatcher | null = null;
  let debounce: NodeJS.Timeout | null = null;

  const send = (event: string, data: Record<string, unknown>) => {
    seq += 1;
    const frame = `event: ${event}\ndata: ${JSON.stringify({ seq, ...data })}\n\n`;
    for (const client of clients) client.write(frame);
  };

  const dir = runsDir(projectDir);
  try {
    mkdirSync(dir, { recursive: true });
    watcher = watch(dir, { recursive: true }, (_event, filename) => {
      const file = String(filename ?? "");
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        // The run id is the first path segment under runs/. Fall back to "*" —
        // the client re-reads the list either way.
        const runId = file.split(/[\\/]/)[0] || "*";
        send("run", { run_id: runId });
      }, 120);
    });
  } catch {
    watcher = null; // API-driven notify() still works without a watcher.
  }

  const heartbeat = setInterval(() => {
    for (const client of clients) client.write(`: heartbeat\n\n`);
  }, options.heartbeatMs ?? 25_000);
  heartbeat.unref?.();

  return {
    handleRequest(req: IncomingMessage, res: ServerResponse): void {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      // A deterministic handshake so clients (and tests) know the stream is live
      // before any run changes.
      res.write(`event: hello\ndata: ${JSON.stringify({ seq })}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
    },
    notify(runId: string): void {
      send("run", { run_id: runId });
    },
    notifyRoom(payload: Record<string, unknown>): void {
      send("room", payload);
    },
    notifyPty(frame: ({ kind: "data"; bytes: string } | { kind: "exit" }) & { session?: string }): void {
      send("pty", frame);
    },
    clientCount: () => clients.size,
    close(): void {
      clearInterval(heartbeat);
      watcher?.close();
      for (const client of clients) client.end();
      clients.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * Serializes manager turns (askManager shells to a real CLI process; two POSTs racing
 * would interleave their appendRoomTurn read-modify-writes) and reports whether one is
 * in flight. `pending` is a counter, not a boolean — a boolean flipped false by the
 * FIRST of two queued turns finishing would report "idle" while the second still runs.
 * Lives on the context (one instance per daemon, created alongside the feed) rather
 * than as a module-level variable so each test's own daemon-in-miniature stays isolated.
 */
export interface RoomState {
  pending: number;
  chain: Promise<void>;
}

export function createRoomState(): RoomState {
  return { pending: 0, chain: Promise.resolve() };
}

/** Holds the daemon's ONE persistent duplex connection to the pty supervisor, if any. */
export interface PtyState {
  attachment: RoomPtyAttachment | null;
  connecting: Promise<RoomPtyAttachment | null> | null;
  /**
   * The daemon's own copy of the terminal screen.
   *
   * The supervisor replays its scrollback when the DAEMON attaches — but the daemon
   * attaches once and lives for hours, fanning out to N browser tabs over SSE. A tab
   * opened after that single attach would receive only bytes that arrive from then on,
   * so it renders a blank terminal even though everything works. (Precisely the
   * symptom that made this look broken.) The supervisor's buffer fixes late daemons;
   * this one fixes late browsers, and /room/pty/snapshot hands it over on open.
   */
  scrollback: string;
}

const DAEMON_SCROLLBACK_LIMIT = 256 * 1024;

export function createPtyState(): PtyState {
  return { attachment: null, connecting: null, scrollback: "" };
}

export interface DelegationApiContext {
  projectDir: string;
  feed: DelegationFeed;
  /** The DEFAULT thread's state. Other threads get their own, lazily, in the maps below. */
  room: RoomState;
  pty: PtyState;
  /**
   * Per-thread state for non-default conversation threads. Kept off to the side rather
   * than replacing `room`/`pty` outright so the default thread — every install that
   * predates threads — keeps the exact object and lifecycle it always had.
   */
  rooms?: Map<string, RoomState>;
  ptys?: Map<string, PtyState>;
  /** Test seam: inject a fake manager so route tests never shell out to a real CLI. */
  askManagerFn?: typeof askManager;
  /** Test seam: replace the whole live-supervisor-or-fallback orchestration below. */
  askRoomFn?: (message: string, history: RoomHistoryTurn[], onEvent: (event: { kind: string; text: string }) => void) => Promise<{ text: string; tools: string[]; corrections?: string[] }>;
  /** Test seam: replace the held headless supervisor's own ask (askRoomSupervisor,
   * room-supervisor.ts) so a test can exercise the empty-reply retry (below) — and the
   * kage-actions parsing that rides the same leg — without spawning a real `claude`
   * process or a real control socket. Production always uses the real askRoomSupervisor. */
  askRoomSupervisorFn?: typeof askRoomSupervisor;
  /** Test seam: replace real pty spawning/attaching entirely. */
  ensurePtyAttachedFn?: (ctx: DelegationApiContext) => Promise<RoomPtyAttachment | null>;
  /** Test seam: replace the real reply-wait poller, so a pty-ask-timeout test can force
   * an instant "nothing arrived" without actually waiting PTY_REPLY_TIMEOUT_MS (6min). */
  waitForNewAssistantTurnsFn?: typeof waitForNewAssistantTurns;
  /** Test seam: replace the real session-identity poller, so a test can force an instant
   * "still unresolved" (or an instant resolve) without actually waiting
   * PTY_IDENTITY_POLL_TIMEOUT_MS. */
  waitForRoomSessionIdentityFn?: typeof waitForRoomSessionIdentity;
  /** Test seam: replace the real kill-and-respawn-fresh action a wedged pty supervisor
   * triggers, so a test can assert it was called without spawning a real detached
   * process (rotatePtySupervisor's own dispatchRoomPtySupervisor call is real-process
   * spawning, exactly what every other test seam in this file exists to avoid). */
  recyclePtySupervisorFn?: typeof rotatePtySupervisor;
  /** Test seam: replace real take-over pty spawning entirely — never a real claude. */
  takeOverRunFn?: typeof takeOverRun;
  /** Test seam: replace the real kill-and-reattach hand-back entirely. */
  handBackFn?: typeof handBack;
  /**
   * Test seam: replace the real dispatch-a-run call the /goals/:id/dispatch-wave route
   * uses. Production always uses the real dispatchRun (dispatch.ts) — the same path
   * kage_dispatch itself calls — so this exists only so a test can avoid the real
   * compileBrief/checkGoalAcceptsNewRun path per spec in a wave without changing
   * production behavior at all.
   */
  dispatchRunFn?: typeof dispatchRun;
}

/**
 * Live take-over attachments, one per run currently seized in a terminal. Module scope,
 * NOT a field on DelegationApiContext: a ctx object is caller-constructed (the daemon
 * builds one long-lived object; a test harness may build a fresh one per request), and
 * an attachment set by one POST /takeover must still be there for the NEXT request's
 * GET /pty/snapshot regardless of which shape the caller chose. Unlike the room's pty
 * (a socket-served view held by a DETACHED process), a take-over's pty runs directly in
 * THIS process — see run-pty.ts — so this map is the only record of it that exists
 * anywhere, and it must survive at the process's own lifetime, not a request's.
 */
const runPtyAttachments = new Map<string, RunPtyAttachment>();

/** The serialization chain and pending counter belong to ONE thread, never shared. */
export function roomStateFor(ctx: DelegationApiContext, session?: string): RoomState {
  const key = normalizeSessionKey(session);
  if (key === DEFAULT_SESSION) return ctx.room;
  if (!ctx.rooms) ctx.rooms = new Map();
  let state = ctx.rooms.get(key);
  if (!state) {
    state = createRoomState();
    ctx.rooms.set(key, state);
  }
  return state;
}

/** Likewise the attachment and scrollback: one terminal screen per thread. */
export function ptyStateFor(ctx: DelegationApiContext, session?: string): PtyState {
  const key = normalizeSessionKey(session);
  if (key === DEFAULT_SESSION) return ctx.pty;
  if (!ctx.ptys) ctx.ptys = new Map();
  let state = ctx.ptys.get(key);
  if (!state) {
    state = createPtyState();
    ctx.ptys.set(key, state);
  }
  return state;
}

const PTY_STARTUP_TIMEOUT_MS = 8000;

/**
 * Ensures the daemon holds a live, attached connection to the room's pty supervisor,
 * reusing one across calls — one held duplex socket for the daemon's whole life, not
 * one per keystroke. Concurrent callers (a write racing a resize) share the same
 * in-flight connect attempt via `connecting` rather than each spawning their own
 * supervisor.
 *
 * `spawnIfNeeded` (default true, matching every pre-existing caller below) dispatches a
 * fresh pty supervisor and waits up to PTY_STARTUP_TIMEOUT_MS for it to come up when
 * none is live — correct for the explicit Terminal-open routes, where a person just
 * asked for a session. resolveRoomReply (api routing for chat) passes `false`: pty
 * preference must be decided QUICKLY, and a random chat message must never implicitly
 * start a brand-new interactive claude session — attachRoomPty's own existsSync check
 * already resolves null near-instantly when nothing is listening.
 */
async function ensurePtyAttached(ctx: DelegationApiContext, session?: string, spawnIfNeeded = true): Promise<RoomPtyAttachment | null> {
  const { projectDir, feed } = ctx;
  const key = normalizeSessionKey(session);
  const pty = ptyStateFor(ctx, key);
  if (pty.attachment) return pty.attachment;
  if (pty.connecting) return pty.connecting;
  pty.connecting = (async () => {
    if (spawnIfNeeded && !(await isRoomPtyLive(projectDir, key))) {
      dispatchRoomPtySupervisor(projectDir, key);
      const deadline = Date.now() + PTY_STARTUP_TIMEOUT_MS;
      while (Date.now() < deadline && !(await isRoomPtyLive(projectDir, key))) {
        await new Promise((pause) => setTimeout(pause, 200));
      }
    }
    const attachment = await attachRoomPty(
      projectDir,
      (bytes) => {
        pty.scrollback += bytes;
        if (pty.scrollback.length > DAEMON_SCROLLBACK_LIMIT) {
          pty.scrollback = pty.scrollback.slice(-DAEMON_SCROLLBACK_LIMIT);
        }
        feed.notifyPty({ kind: "data", bytes, session: key });
      },
      () => {
        pty.attachment = null;
        // Drop the screen with the session it belonged to: replaying a dead terminal's
        // final frame to a new tab would be showing something that no longer exists.
        pty.scrollback = "";
        feed.notifyPty({ kind: "exit", session: key });
      },
      key,
    );
    pty.attachment = attachment;
    return attachment;
  })();
  const result = await pty.connecting;
  pty.connecting = null;
  return result;
}

const ROOM_SUPERVISOR_STARTUP_TIMEOUT_MS = 8000;
// Matches ROOM_ASK_TIMEOUT_MS's own ceiling below — pty and headless give a human the
// same patience before this endpoint reports the message as sent-but-pending.
const PTY_REPLY_TIMEOUT_MS = 6 * 60_000;
const PTY_REPLY_POLL_MS = 400;
// A turn can arrive as several jsonl lines (thinking, a tool call, its result, more
// text) — how long the transcript must stop growing before it's treated as settled.
const PTY_REPLY_QUIET_MS = 1200;
// How long resolvePtyReply waits for superviseRoomPty to have recorded its session
// identity before giving up and deflecting. In the overwhelmingly common case (an
// already-settled pty) the identity is already on disk and this never pays out at
// all; it only matters against the narrow startup-race window right after a fresh
// spawn, but a COLD pty (first spawn on a machine, no warm claude process cache) can
// take longer than a few seconds to write that identity, so this is generous rather
// than tight — a test that reaches this path must inject a short wait via
// ctx.waitForRoomSessionIdentityFn (see DelegationApiContext's own doc) rather than
// ever sleeping this out in real time. Exported so a test can assert the production
// value without importing api.ts's entire runtime surface just to read one constant.
export const PTY_IDENTITY_POLL_TIMEOUT_MS = 20_000;
const PTY_IDENTITY_POLL_MS = 300;
// Kage's own synthesized fallback action (never emitted by the manager) that opens the
// Terminal tab — the honest reply is "there is nothing to summarize", not "there is
// nothing you can do about it".
const OPEN_TERMINAL_ACTION: RoomActions = { actions: [{ label: "Open Terminal", kind: "open_terminal" }] };

type RoomManagerLabel = "pty" | "headless";
interface RoomReply {
  text: string;
  tools: string[];
  corrections?: string[];
  manager?: RoomManagerLabel;
  /** True when `text` is Kage's own honest report of a failure — never the manager's
   * own prose. Propagated straight onto the persisted turn (RoomHistoryTurn.failed) so
   * the renderer can style it as a visible failure instead of an ordinary reply. */
  failed?: boolean;
  /** Parsed from a trailing kage-actions fence (room-actions.ts) on every leg that
   * produces a manager turn — the headless supervisor, askManager, and the pty leg's
   * transcript-extracted reply (see resolveRoomReply, resolvePtyReply). Also synthesized
   * directly by Kage itself (OPEN_TERMINAL_ACTION) on the pty leg's own honest-deflection
   * fallback. Undefined when the reply carried no valid block. */
  actions?: RoomActions;
}

/**
 * Writes the message into the SAME interactive session Terminal shows (no second
 * channel), then waits for claude's own native transcript to grow with a new assistant
 * turn. Returns null — quickly, never spawning a new session to find out — when no pty
 * is ALREADY live; either way the caller falls back to headless honestly, never
 * guessing at a reply and never blocking a chat message behind a fresh interactive
 * claude spawn (see ensurePtyAttached's `spawnIfNeeded` doc — that spawn is for the
 * explicit Terminal-open routes only).
 */
export async function resolvePtyReply(ctx: DelegationApiContext, message: string, session?: string): Promise<RoomReply | null> {
  const { projectDir } = ctx;
  const key = normalizeSessionKey(session);
  const recycle = ctx.recyclePtySupervisorFn ?? rotatePtySupervisor;

  // Guard against a wedged-forever session BEFORE this ask ever reaches it: a
  // supervisor whose last ask timed out, or that has been holding the same session
  // open for 12h+, gets rotated (fresh process, fresh session identity) here rather
  // than being trusted on the strength of a process-liveness probe alone — see
  // isPtySupervisorStale's own doc for why that probe can't tell a wedged session from
  // a healthy one.
  if (isPtySupervisorStale(readRoomPtyRecord(projectDir, key), readRoomSessionMeta(projectDir, key))) {
    recycle(projectDir, key);
  }

  const ensureAttached = ctx.ensurePtyAttachedFn ?? ensurePtyAttached;
  const attachment = await ensureAttached(ctx, key, false);
  if (!attachment) return null;

  // One session, two views: if the structured (headless) side currently holds this
  // thread's session, retire it before pty takes over — two live processes resuming
  // one session id would fork its context and race each other's writes.
  retireStructuredRoom(projectDir, key);

  let meta = readRoomSessionMeta(projectDir, key);
  if (!meta.session_id || !meta.native_transcript_path) {
    // The pty may be live but superviseRoomPty hasn't (yet) recorded its identity — a
    // startup race, not a failure of the session itself, and one that's normally already
    // over by the time a caller can attach at all (see waitForRoomSessionIdentity's own
    // doc). Give it a brief chance to land before treating it as unresolved, rather than
    // deflecting on the very first read.
    const pollIdentity = ctx.waitForRoomSessionIdentityFn ?? waitForRoomSessionIdentity;
    meta = await pollIdentity(() => readRoomSessionMeta(projectDir, key), {
      timeoutMs: PTY_IDENTITY_POLL_TIMEOUT_MS,
      pollMs: PTY_IDENTITY_POLL_MS,
    });
  }
  if (!meta.session_id || !meta.native_transcript_path) {
    // Still unresolved by the deadline. The message still reaches the real session;
    // there is just nothing to poll a reply out of for THIS turn — say so plainly rather
    // than persisting a blank "done" turn, and hand over an actual door into the
    // Terminal tab rather than only telling the user to go find it themselves.
    attachment.write(frameChatInputForPty(message));
    return {
      text: "Kage sent your message to the terminal session, but hasn't recorded its identity yet, so there is nothing to summarize here for this turn — the terminal is still processing it.",
      tools: [],
      manager: "pty",
      failed: true,
      actions: OPEN_TERMINAL_ACTION,
    };
  }

  const readPage = () => readNativeTranscriptPage(meta.native_transcript_path as string, { limit: TRANSCRIPT_PAGE_CAP });
  const beforeTotal = readPage().total;
  attachment.write(frameChatInputForPty(message));
  const wait = ctx.waitForNewAssistantTurnsFn ?? waitForNewAssistantTurns;
  const newTurns = await wait(readPage, {
    beforeTotal,
    timeoutMs: PTY_REPLY_TIMEOUT_MS,
    pollMs: PTY_REPLY_POLL_MS,
    quietMs: PTY_REPLY_QUIET_MS,
  });

  if (!newTurns.length) {
    // The manager did not answer within the window. A process-liveness probe (e.g.
    // /room/pty/status) would still report this session alive — it only checks that
    // the pid exists, not that it answers — so "alive" can never again be treated as
    // "answering" here: recycle now, honestly, rather than let the NEXT message eat
    // another full timeout against the same wedged session.
    recycle(projectDir, key);
    writeRoomSessionMeta(projectDir, { last_ask_timed_out: true }, key);
    const minutes = Math.round(PTY_REPLY_TIMEOUT_MS / 60_000);
    return {
      text: `The manager did not answer within ${minutes} minutes — its session stopped responding. Kage rotated it to a fresh session, so your next message reaches a live manager instead of another ${minutes}-minute wait.`,
      tools: [],
      manager: "pty",
      failed: true,
    };
  }
  writeRoomSessionMeta(projectDir, { last_ask_timed_out: false }, key);

  let text = newTurns
    .map((turn) => turn.text)
    .filter(Boolean)
    .join("\n\n");
  const tools = [...new Set(newTurns.flatMap((turn) => turn.tools))];
  // The pty manager runs with every delegation tool pre-approved (MANAGER_ALLOWED_TOOLS)
  // the same as the headless supervisor — a permission prompt is never real here either,
  // so a reply that narrates waiting on one gets the same honest correction the headless
  // path already applies, rather than being taken at face value as ordinary prose.
  const stuckTool = detectPermissionStuckMention(text);
  if (stuckTool) text = `${text}\n\n${permissionStuckNote(stuckTool)}`;
  // Same protocol, same parser, as the headless legs (room-actions.ts) — a trailing
  // kage-actions fence rides a terminal-answered thread identically to a headless one.
  const parsed = parseKageActionsReply(text);
  return { text: parsed.text, tools, manager: "pty", ...(parsed.actions ? { actions: parsed.actions } : {}) };
}

/**
 * The live path, then an honest fallback. Pty is tried first whenever this is a real
 * (non-test) request: it is the ONE real interactive session Terminal already shows,
 * so routing chat there is what makes Chat a view of that session, not a second
 * manager. Headless — a live -p supervisor, proven to support a held-open multi-turn
 * session — is the fallback used only when pty is unavailable, and the one-shot
 * askManager path is the fallback of THAT fallback.
 */
export async function resolveRoomReply(
  ctx: DelegationApiContext,
  message: string,
  historyBefore: RoomHistoryTurn[],
  session?: string,
): Promise<RoomReply> {
  const { projectDir, feed } = ctx;
  const key = normalizeSessionKey(session);
  // Deltas carry their thread so a client watching thread A never animates typing
  // into it because thread B's manager is mid-sentence.
  const onDelta = (event: { kind: string; text: string }) =>
    feed.notifyRoom({ kind: event.kind, text: event.text, session: key });

  if (ctx.askRoomFn) return ctx.askRoomFn(message, historyBefore, onDelta);

  // A test that sets askManagerFn is explicitly asking to exercise the fallback path
  // without touching a real CLI — every existing room test relies on exactly that, so
  // this gate gets checked before EITHER live path (pty or headless). A test that wants
  // pty routing instead injects ensurePtyAttachedFn, still only reached when isProduction
  // is true.
  const isProduction = !ctx.askManagerFn;
  if (isProduction) {
    const ptyReply = await resolvePtyReply(ctx, message, key);
    if (ptyReply) return ptyReply;
    // node-pty unavailable, or the pty never came up within its own startup window —
    // fall through to headless, honestly, never a fabricated pty reply.
  }
  if (isProduction && isAgentInstalled("claude")) {
    // One session, two views, reversed direction: if pty currently holds this thread's
    // session (it just failed to answer above, or died between calls), retire it
    // before headless resumes the same id.
    const ptyState = ptyStateFor(ctx, key);
    if (ptyState.attachment || (await isRoomPtyLive(projectDir, key))) {
      retirePtyRoom(projectDir, key);
      ptyState.attachment = null;
      ptyState.scrollback = "";
    }
    const askSupervisor = ctx.askRoomSupervisorFn ?? askRoomSupervisor;
    let live: RoomStreamEvent | null = await askSupervisor(projectDir, message, onDelta, key);
    if (!live) {
      dispatchRoomSupervisor(projectDir, key);
      const deadline = Date.now() + ROOM_SUPERVISOR_STARTUP_TIMEOUT_MS;
      while (Date.now() < deadline && !(await isRoomSupervisorLive(projectDir, key))) {
        await new Promise((pause) => setTimeout(pause, 200));
      }
      live = await askSupervisor(projectDir, message, onDelta, key);
    }
    if (live?.kind === "final") {
      if (live.ok === false) {
        // Same bounded retry as the askManager leg below, through the same seam this
        // leg already asks its questions through — never a loop, never a second retry.
        const retryLive = await askSupervisor(projectDir, EMPTY_REPLY_RETRY_NUDGE, onDelta, key);
        if (retryLive?.kind === "final" && retryLive.ok !== false) {
          live = retryLive;
        } else {
          return {
            text: "The manager returned an empty reply twice in a row (returned empty twice) — nothing to show for this turn.",
            tools: live.tools,
            manager: "headless",
            failed: true,
          };
        }
      }
      const parsed = parseKageActionsReply(live.text);
      return {
        text: parsed.text,
        tools: live.tools,
        ...(live.corrections?.length ? { corrections: live.corrections } : {}),
        manager: "headless",
        ...(parsed.actions ? { actions: parsed.actions } : {}),
      };
    }
    // live?.kind === "error", or still null after the startup wait — fall through.
  }

  const ask = ctx.askManagerFn ?? askManager;
  const priorTurns = historyBefore.map((turn) => ({ role: turn.role, text: turn.text }));
  let reply = await ask({ projectDir, question: message, history: priorTurns, onEvent: onDelta });
  if (!reply.ok) {
    // One bounded retry, never a loop: a manager turn that resolved with no text gets
    // exactly one more chance, nudged to answer plainly, before this leg gives up and
    // reports an honest failure. See EMPTY_REPLY_RETRY_NUDGE's own doc.
    const retryHistory = [...priorTurns, { role: "you" as const, text: message }, { role: "kage" as const, text: reply.text }];
    reply = await ask({ projectDir, question: EMPTY_REPLY_RETRY_NUDGE, history: retryHistory, onEvent: onDelta });
  }
  if (!reply.ok) {
    const detail = [
      reply.exitCode !== undefined ? `exit code ${reply.exitCode}` : null,
      reply.stderr ? `stderr: ${reply.stderr.slice(0, 200)}` : null,
    ].filter((part): part is string => Boolean(part));
    const why = detail.length ? detail.join("; ") : "returned empty twice";
    return {
      text: `The manager returned an empty reply twice in a row (${why}) — nothing to show for this turn.`,
      tools: reply.tools,
      manager: "headless",
      failed: true,
    };
  }
  const parsed = parseKageActionsReply(reply.text);
  return {
    text: parsed.text,
    tools: reply.tools,
    ...(reply.corrections?.length ? { corrections: reply.corrections } : {}),
    manager: "headless",
    ...(parsed.actions ? { actions: parsed.actions } : {}),
  };
}

/**
 * Run one manager turn once every turn ahead of it in the queue has settled, then
 * append the result and clear the room's busy count. Errors become a "kage" turn
 * (visible in the transcript) rather than a silently dropped promise.
 */
function queueRoomTurn(
  ctx: DelegationApiContext,
  message: string,
  historyBefore: RoomHistoryTurn[],
  session?: string,
): void {
  const { projectDir, feed } = ctx;
  const key = normalizeSessionKey(session);
  // Each thread serializes independently: two threads talking at once is the point,
  // and sharing one chain would make the second wait behind the first for no reason.
  const room = roomStateFor(ctx, key);
  room.pending += 1;
  room.chain = room.chain.then(async () => {
    try {
      const reply = await resolveRoomReply(ctx, message, historyBefore, key);
      // Last-resort backstop, independent of which leg produced the reply: an empty
      // reply is never a valid "done" turn — a blank bubble marked DONE is exactly the
      // symptom that made a wedged manager session read as a silently-answered message
      // instead of the failure it was. Every leg that KNOWS why it's empty (the pty
      // timeout/startup-race branches above) already sets failed:true with an honest
      // explanation; this only fires for a leg that slips through with blank text some
      // other way. A reply carrying valid kage-actions but no other prose (a bare
      // clarifying question rendered entirely as chips) is not blank — actions ARE the
      // content of that turn.
      const blank = (!reply.text || !reply.text.trim()) && !reply.actions;
      appendRoomTurn(projectDir, {
        role: "kage",
        text: blank ? "The manager returned an empty reply — nothing to show for this turn." : reply.text,
        tools: reply.tools,
        ...(reply.corrections?.length ? { corrections: reply.corrections } : {}),
        ...(reply.manager ? { manager: reply.manager } : {}),
        ...(reply.actions ? { actions: reply.actions } : {}),
        ...(blank || reply.failed ? { failed: true } : {}),
      }, key);
    } catch (error) {
      appendRoomTurn(projectDir, { role: "kage", text: `Manager error: ${(error as Error).message}`, failed: true }, key);
    } finally {
      feed.notifyRoom({ kind: "final", done: true, session: key });
      room.pending -= 1;
    }
  });
}

// Finished states a card's verdict chip can show — the same four the client's own
// VERDICT_CARD_STATES lists (app-client.ts), since a merged/rejected run keeps the
// claim.json it was decided from just as much as a ready/failed one still awaiting
// that decision.
const VERDICT_LIST_STATES = new Set<RunView["display_state"]>(["ready", "failed", "merged", "rejected"]);

type DeadFields = { branch_landed?: boolean; worktree_adoptable?: boolean };

// branch_landed/worktree_adoptable each shell out to git (contract.ts's isBranchLanded,
// recovery.ts's isWorktreeAdoptable) and withActivity() used to recompute both on every
// /runs poll for every stopped/failed run, live or not — the server-side half of the
// flicker fix, per docs/design note folded into this run: a poll of a run whose
// updated_at hasn't moved never needs to ask git again. Keyed on run id + updated_at
// (not branch@HEAD like isBranchLanded's own cache) so it also invalidates the instant
// THIS run's own record changes, independent of whether HEAD moved — same unbounded
// Map-per-process shape contract.ts's own branchLandedCache already uses.
const deadFieldsCache = new Map<string, DeadFields>();

// isBranchLanded (contract.ts) is `git merge-base --is-ancestor branch HEAD` alone — a
// run branch with ZERO commits beyond where it forked sits exactly AT that merge-base,
// so the ancestor check passes VACUOUSLY for it (a commit is trivially its own
// ancestor). That is precisely the shape of an orphaned run whose work never got
// committed: the UI offered both "Adopt" (worktree_adoptable, correctly) and "Close as
// landed" (branch_landed, wrongly) for the same run, and clicking the latter would
// reject a record that was never actually landed.
//
// Comparing the branch tip against `git merge-base branch HEAD` does NOT distinguish
// this — once isBranchLanded's own ancestor check has already passed (which is the only
// time this function is even called, see computeDeadFields below), branch is BY
// DEFINITION an ancestor of HEAD, and the merge-base of an ancestor and its descendant
// is ALWAYS the ancestor itself. That makes tip === merge-base true for EVERY landed
// branch, real commits or not — comparing against HEAD after a merge is comparing
// against a value the merge itself already contaminated. Comparing commit TIMESTAMPS
// against the run's own created_at was tried and dropped too: git's commit-date format
// is second-precision while created_at is millisecond-precision, so a commit landing in
// the same wall-clock second as run creation is a genuine race between two different
// clocks, not a property of the branch.
//
// The robust signal instead: the branch's own reflog. `git worktree add -b branch
// <start>` writes exactly one reflog entry ("branch: Created from ...") when nothing has
// happened to it since; every real commit on the branch adds another entry on top. This
// is unaffected by merges elsewhere (a branch's reflog only records updates to ITS OWN
// ref) and by wall-clock timing entirely — it is git's own record of whether this ref
// has ever moved.
function branchHasRealCommits(projectDir: string, branch: string): boolean {
  const reflog = git(projectDir, ["log", "-g", "--format=%H", branch]);
  if (!reflog.ok || !reflog.stdout) return false;
  const entries = reflog.stdout.split("\n").filter(Boolean);
  return entries.length > 1;
}

function computeDeadFields(projectDir: string, run: RunView): DeadFields {
  const cacheKey = `${run.id}@${run.updated_at}`;
  const cached = deadFieldsCache.get(cacheKey);
  if (cached) return cached;
  // The zombie-record signal (finding 3): a stopped/failed run whose branch is
  // already an ancestor of HEAD, AND actually diverged from it (see
  // branchHasRealCommits above) — landed by hand or some other path, but the record
  // never learned.
  const dead: DeadFields =
    (run.display_state === "stopped" || run.display_state === "failed") &&
    isBranchLanded(projectDir, run.branch) &&
    branchHasRealCommits(projectDir, run.branch)
      ? { branch_landed: true }
      : {};
  // The Adopt affordance (finding 4): only for the orphan-shaped failed run
  // isWorktreeAdoptable actually recognizes — a plainer "unrecognized failure" never
  // grows this field, so the button never appears for a case Adopt can't cure.
  if (run.display_state === "failed" && isWorktreeAdoptable(projectDir, run)) dead.worktree_adoptable = true;
  deadFieldsCache.set(cacheKey, dead);
  return dead;
}

/**
 * "What is it doing right now" — computed from the transcript the adapters already
 * write, never asserted by the agent. Attached only to in-flight runs so the list
 * stays cheap and a finished run never shows a stale activity line.
 */
function withActivity(
  projectDir: string,
  run: RunView,
): RunView & {
  activity?: ReturnType<typeof readActivity>;
  claim_summary?: string;
  blast?: BlastRadius;
  verdict_label?: string;
  branch_landed?: boolean;
  worktree_adoptable?: boolean;
} {
  const dead = computeDeadFields(projectDir, run);

  if (VERDICT_LIST_STATES.has(run.display_state)) {
    const claim = readClaim(projectDir, run.id);
    if (claim) {
      // The verdict chip's own label, read verbatim from the SAME claimVerdict() the
      // receipt and the per-run detail route already use — never re-derived client
      // side (the exact bug this product exists to prevent: a client recount showing
      // VERIFIED for a run the kernel had already failed). Absent entirely when there
      // is no claim, same "absence means absent" convention as claim_summary below.
      const verdictLabel = claimVerdict(claim).label;
      // A run awaiting a decision carries the one fact needed to make it: how much
      // changed, and whether the kernel's checks passed. Without it the inbox could
      // only repeat the intent back, so every decision meant opening the run to find
      // out.
      if (run.display_state === "ready" || run.display_state === "failed") {
        const passed = claim.checks.filter((check) => check.result === "pass").length;
        const files = claim.diff?.files ?? 0;
        const lines = claim.diff?.lines ?? 0;
        const change = files ? `${files} file${files === 1 ? "" : "s"} · ${lines} line${lines === 1 ? "" : "s"}` : "no changes";
        // The code graph's one sentence at the decision point: how load-bearing is what
        // changed? Omitted entirely when the index or the claim's paths are missing —
        // "0 dependents" invented from a missing index would reassure falsely.
        const blast = blastRadiusFor(projectDir, claim.diff?.paths ?? []);
        return {
          ...run,
          ...dead,
          verdict_label: verdictLabel,
          claim_summary: `${change} · ${passed}/${claim.checks.length} checks`,
          ...(blast ? { blast } : {}),
        };
      }
      return { ...run, ...dead, verdict_label: verdictLabel };
    }
  }
  const inFlight =
    run.display_state === "running" ||
    run.display_state === "dispatched" ||
    run.display_state === "verifying" ||
    run.display_state === "orphaned";
  if (!inFlight) return { ...run, ...dead };
  const activity = readActivity(runTranscriptPath(projectDir, run.id));
  return { ...run, ...dead, activity };
}

/**
 * The run's real diff: what its branch adds over the base, plus anything still
 * uncommitted in its worktree. Unified format, rendered by prefix on the client —
 * no diff library on either side.
 */
function runDiffText(projectDir: string, runId: string): string {
  const run = readRun(projectDir, runId);
  const parts: string[] = [];
  const worktree = worktreePath(projectDir, runId);
  const branchExists = git(projectDir, ["rev-parse", "--verify", "--quiet", run.branch]).ok;
  if (branchExists) {
    const base = git(projectDir, ["merge-base", "HEAD", run.branch]);
    if (base.ok && base.stdout) {
      const committed = git(projectDir, ["diff", `${base.stdout}..${run.branch}`]);
      if (committed.ok && committed.stdout) parts.push(committed.stdout);
    }
  }
  if (existsSync(worktree)) {
    const dirty = git(worktree, ["diff", "HEAD"]);
    if (dirty.ok && dirty.stdout) parts.push(`# uncommitted in the worktree\n${dirty.stdout}`);
  }
  return parts.join("\n");
}

/**
 * The run's diff as a per-file tree — path, added/modified/deleted, +/- lines — the data
 * behind the FILES panel (docs/design/SESSIONS_SURFACE.md §3c/4). Uses the SAME
 * single-ref technique verify.ts's measureDiff already uses at claim/reverify time
 * (merge-base against the working tree, one git invocation family) whenever the run's
 * own worktree is still on disk, so this can never disagree with the diff-size check's
 * own totals the way summing two separately-measured diffs (committed range, then a
 * second uncommitted-only diff) could double-count a file touched both ways — exactly
 * the class of bug the diff-size check itself was just fixed for. Falls back to a
 * two-dot committed-only range in the PROJECT's own checkout only once the run's
 * worktree is gone (a merged or cleaned-up run has no working tree left to fold in).
 */
export function runFilesTree(projectDir: string, runId: string): DiffFileEntry[] {
  const run = readRun(projectDir, runId);
  const worktree = worktreePath(projectDir, runId);
  if (existsSync(worktree)) {
    git(worktree, ["add", "-A"]);
    const base = currentBranch(projectDir);
    const mergeBase = git(worktree, ["merge-base", "HEAD", base]);
    if (mergeBase.ok && mergeBase.stdout) return diffFileTree(worktree, [mergeBase.stdout]);
  }
  const branchExists = git(projectDir, ["rev-parse", "--verify", "--quiet", run.branch]).ok;
  if (branchExists) {
    const mergeBase = git(projectDir, ["merge-base", "HEAD", run.branch]);
    if (mergeBase.ok && mergeBase.stdout) return diffFileTree(projectDir, [`${mergeBase.stdout}..${run.branch}`]);
  }
  return [];
}

/**
 * Whether the orchestrator's own session (Room, docs/design/SESSIONS_SURFACE.md §6) is
 * live for this project, plus when it last did anything — the data behind the presence
 * banner. "Live" means either register a person could be talking to right now: the
 * structured (headless) supervisor, or the pty Terminal — `retireStructuredRoom` keeps
 * the two mutually exclusive per thread, but either one being up counts as the
 * orchestrator being up. Sourced from the SAME liveness probes (isRoomSupervisorLive,
 * isRoomPtyLive) every other surface already trusts, never a separate guess. Activity
 * prefers the last recorded room turn (the freshest signal); a live session with no
 * turns yet (just started) falls back to its own record's started_at rather than
 * reporting no activity at all for a session that plainly exists.
 */
export async function orchestratorPresence(projectDir: string, session?: string): Promise<{ live: boolean; activity_at: string | null }> {
  const [supervisorLive, ptyLive] = await Promise.all([isRoomSupervisorLive(projectDir, session), isRoomPtyLive(projectDir, session)]);
  const turns = readRoomHistory(projectDir, session);
  const lastTurnAt = turns.length ? turns[turns.length - 1].at : null;
  const supervisorRecord = readRoomSupervisorRecord(projectDir, session);
  const ptyRecord = readRoomPtyRecord(projectDir, session);
  return {
    live: supervisorLive || ptyLive,
    activity_at: lastTurnAt ?? supervisorRecord?.started_at ?? ptyRecord?.started_at ?? null,
  };
}

/**
 * The Room composer's ghost text (docs/design/SESSIONS_SURFACE.md §4/§6). A thread's
 * "state" is borrowed from whichever runs its active goal (room-sessions.ts's
 * `active_goal_id`) has dispatched — a thread with no active goal, or a goal with no
 * run currently blocked, has nothing honest to suggest and returns null, same
 * "absence means absent" rule suggestedNextPrompt itself follows. Reuses
 * suggestedNextForRoom's one rule (suggest.ts) rather than inventing a room-specific one.
 */
function roomSuggestedNext(projectDir: string, session: string): string | null {
  const goalId = readActiveGoal(projectDir, session);
  if (!goalId) return null;
  let runIds: string[];
  try {
    runIds = readGoal(projectDir, goalId).plan.waves.flatMap((wave) => wave.run_ids);
  } catch {
    // The active goal pointer outlived the goal record itself (e.g. hand-deleted) —
    // nothing honest to suggest, not a 500.
    return null;
  }
  const runs: RunView[] = [];
  for (const runId of runIds) {
    try {
      runs.push(readRun(projectDir, runId));
    } catch {
      // A run_id the goal still lists but whose own file is gone contributes nothing.
    }
  }
  return suggestedNextForRoom(runs);
}

/** GET /goals and GET /goals/:id both carry the derived per-wave status alongside the
 * raw record, so a surface renders "wave 2 is due" without re-deriving goalWaveStatus
 * itself from every run it lists. */
function withWaveStatus(projectDir: string, goal: GoalRecord): GoalRecord & { wave_status: ReturnType<typeof goalWaveStatus> } {
  return { ...goal, wave_status: goalWaveStatus(projectDir, goal) };
}

function runDetail(projectDir: string, runId: string): Record<string, unknown> {
  const run = readRun(projectDir, runId);
  const owningGoal = goalForRun(projectDir, runId);
  const detail: Record<string, unknown> = { run: { ...withActivity(projectDir, run), goal_id: owningGoal ? owningGoal.id : null } };
  const briefFile = join(runDir(projectDir, runId), "brief.md");
  if (existsSync(briefFile)) detail.brief = readFileSync(briefFile, "utf8");
  const claimFile = join(runDir(projectDir, runId), "claim.json");
  let claim: ClaimRecord | null = null;
  if (existsSync(claimFile)) {
    try {
      claim = JSON.parse(readFileSync(claimFile, "utf8")) as ClaimRecord;
      detail.claim = claim;
      detail.receipt = renderClaimCard(claim, { budget: run.budgets.diff_lines, task: run });
      // The verdict travels WITH the claim, computed by the kernel that ran the checks.
      // A client that re-derives it can disagree with the kernel — caught live: a GUI
      // recomputation showed a green "VERIFIED 2/3" for a run the kernel had already
      // marked failed, because it counted an unrunnable check as merely absent rather
      // than as a reason not to certify. Exactly the overclaim this product exists to
      // prevent, so the verdict is now a fact the surface renders, never one it decides.
      detail.verdict = claimVerdict(claim);
    } catch {
      claim = null;
      // A torn claim never breaks the detail view; the receipt tab shows nothing.
    }
  }
  // The composer's pre-filled ghost suggestion, derived server-side from the SAME
  // verdict the receipt already reads — never the transcript tail. Absent means
  // absent: a run with nothing honest to suggest carries no suggested_next key at all,
  // same convention as `taught` below.
  const suggestion = suggestedNextPrompt(run, claim);
  if (suggestion) detail.suggested_next = suggestion;
  // The reviewer role's verdict (review.ts's reviewRun) — a DIFFERENT record from claim
  // above, and absent for every run that never opted into review_required, same
  // absent-means-absent convention as `taught` below.
  const agentReview = readAgentReview(projectDir, runId);
  if (agentReview) detail.agent_review = agentReview;
  detail.files = runFilesTree(projectDir, runId);
  // The flywheel's backward edge: the packets this run ratified into team memory.
  // Empty until a merge ratifies something — the surface then says nothing.
  const taught = packetsTaughtByRun(projectDir, runId);
  if (taught.length) detail.taught = taught;
  return detail;
}

/**
 * Handle a delegation route. Returns false when the path is not ours so the daemon can
 * fall through to its other handlers. Guard checks happen in the caller — every request
 * that reaches here has already passed loopback Host + Origin (+ token for mutations).
 */
export async function handleDelegationRoute(
  ctx: DelegationApiContext,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  const { projectDir, feed } = ctx;
  const method = req.method ?? "GET";
  const path = url.pathname;

  if (path === "/runs/events" && method === "GET") {
    feed.handleRequest(req, res);
    return true;
  }

  // Memory. Kage's core product, and until now absent from its own app. These routes
  // read pre-built indexes only — see memory-view.ts for why calling the kernel's
  // analysis functions from a request would be a four-minute mistake.
  if (path === "/memory" && method === "GET") {
    json(res, 200, readMemoryOverview(projectDir));
    return true;
  }

  // Pre-flight: risk before the work exists. The forecast is the brief compiler's
  // own touch prediction plus the imports graph's dependents count — the composer
  // shows it while you type, labeled as the forecast it is. Null means "nothing
  // honest to say", and the surface then says nothing.
  if (path === "/preflight" && method === "GET") {
    const intent = url.searchParams.get("intent") ?? "";
    const type = normalizeRunType(url.searchParams.get("type"));
    json(res, 200, { ok: true, forecast: preflightForecast(projectDir, intent, type) });
    return true;
  }

  // A reader who spots wrong or stale memory is the right person to say so, and the
  // app is where they are standing when they spot it.
  if (path === "/memory/feedback" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const id = typeof body.id === "string" ? body.id : "";
    const kind = typeof body.kind === "string" ? body.kind : "";
    if (!id) {
      json(res, 400, { ok: false, error: "id is required" });
      return true;
    }
    const result = recordMemoryFeedback(projectDir, id, kind);
    json(res, result.ok ? 200 : 400, result);
    return true;
  }

  if (path.startsWith("/memory/") && method === "GET") {
    const id = decodeURIComponent(path.slice("/memory/".length));
    const packet = readMemoryPacket(projectDir, id);
    // The flywheel travels with the packet: the run that taught it, the runs its
    // knowledge was briefed into. Old runs recorded no edges — then there are none.
    json(res, packet.ok ? 200 : 404, packet.ok ? { ...packet, ...packetFlywheel(projectDir, id) } : packet);
    return true;
  }

  // Projects. The registry is only a list of directories the user has opened; every
  // fact about a project still comes from that project's own daemon, so the sidebar
  // can never assert something the kernel would contradict.
  if (path === "/projects" && method === "GET") {
    // Opening the app for a project is what makes it "known" — no separate add step.
    const projects = rememberProject(projectDir);
    // installedAgents rides along here because the add-project dialog needs it before
    // any project-specific daemon exists to ask — this daemon's own agent detection
    // answers for the whole machine, not just this repo.
    json(res, 200, { ok: true, projects, current: resolve(projectDir), agents: installedAgents() });
    return true;
  }

  // A read-only probe the add-project dialog calls as the user types — resolves a path
  // the same way /projects/add will, but never registers or starts anything, so typing
  // has no side effects until "Create and start" is actually pressed.
  if (path === "/projects/resolve" && method === "GET") {
    const raw = url.searchParams.get("path") ?? "";
    const resolved = resolveProjectPath(raw);
    json(res, 200, resolved.ok ? { ok: true, dir: resolved.dir, name: basename(resolved.dir) || resolved.dir } : resolved);
    return true;
  }

  // Adding a project, honestly: validate the path against the SAME rule a dispatched
  // run's worktree goes through (resolveWorkspaceKind, via addProject), refuse plainly
  // when it's not usable, disambiguate a folder that holds several repos instead of
  // picking one, then start that project's own daemon and hand back its Room URL so
  // the app can land the user there directly — never back on an empty board.
  if (path === "/projects/add" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const dir = typeof body.dir === "string" ? body.dir : "";
    if (!dir) {
      json(res, 400, { ok: false, error: "dir is required" });
      return true;
    }
    const workerAgent = typeof body.worker_agent === "string" && body.worker_agent ? body.worker_agent : undefined;
    if (workerAgent && !installedAgents().includes(workerAgent as (typeof ADAPTER_NAMES)[number])) {
      json(res, 400, { ok: false, error: `${workerAgent} is not installed on this machine.` });
      return true;
    }
    const added = addProject(dir, workerAgent ? { worker_agent: workerAgent as "claude" | "codex" } : {});
    if (!added.ok) {
      const refused = added as AddProjectRefused;
      json(res, refused.reason === "ambiguous" ? 409 : 400, refused);
      return true;
    }
    try {
      const app = await ensureAppDaemon(added.dir);
      json(res, 200, { ok: true, dir: added.dir, name: added.name, kind: added.kind, url: app.url, started: app.started });
    } catch (error) {
      json(res, 502, { ok: false, error: (error as Error).message });
    }
    return true;
  }

  // Switching projects hands back the URL of THAT project's daemon, starting it if
  // needed. Kage stays one-daemon-per-project — the alternative, a daemon that
  // retargets, would mean live runs and a held manager session pointing at a repo
  // that is no longer the current one. The client navigates; nothing is retargeted.
  if (path === "/projects/open" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const dir = typeof body.dir === "string" ? body.dir : "";
    if (!dir) {
      json(res, 400, { ok: false, error: "dir is required" });
      return true;
    }
    if (!existsSync(join(dir, ".git")) && !existsSync(join(dir, ".agent_memory"))) {
      json(res, 400, { ok: false, error: `${dir} is not a git repo or a Kage project` });
      return true;
    }
    try {
      const app = await ensureAppDaemon(dir);
      rememberProject(dir);
      json(res, 200, { ok: true, url: app.url, started: app.started });
    } catch (error) {
      json(res, 502, { ok: false, error: (error as Error).message });
    }
    return true;
  }

  if (path === "/projects/forget" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const dir = typeof body.dir === "string" ? body.dir : "";
    if (!dir) {
      json(res, 400, { ok: false, error: "dir is required" });
      return true;
    }
    if (resolve(dir) === resolve(projectDir)) {
      json(res, 400, { ok: false, error: "cannot forget the project this daemon is serving" });
      return true;
    }
    json(res, 200, { ok: true, projects: forgetProject(dir) });
    return true;
  }

  // Settings. Kage had no settings surface at all — every knob lived in config.json or
  // a CLI flag, which is fine for a CLI and invisible in an app. These expose the SAME
  // file the CLI and kernel already read, so the two can never drift.
  if (path === "/settings" && method === "GET") {
    const config = readDelegationConfig(projectDir);
    json(res, 200, {
      ok: true,
      settings: {
        test: config.test ?? null,
        setup: config.setup ?? null,
        diff_budget: config.diff_budget ?? DEFAULT_DIFF_BUDGET,
        max_concurrent: config.max_concurrent ?? DEFAULT_MAX_CONCURRENT,
        // strict_verify defaults TRUE: any non-passing check blocks ready. Reporting
        // the effective value (not the raw undefined) keeps the UI honest about what
        // the kernel will actually do.
        strict_verify: config.strict_verify !== false,
      },
      defaults: { diff_budget: DEFAULT_DIFF_BUDGET, max_concurrent: DEFAULT_MAX_CONCURRENT, strict_verify: true },
      agents: { installed: ADAPTER_NAMES.filter((name) => name === "stub" || isAgentInstalled(name)) },
      project_dir: projectDir,
    });
    return true;
  }

  if (path === "/settings" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const patch: Record<string, unknown> = {};
    if (typeof body.test === "string") patch.test = body.test.trim() || undefined;
    if (typeof body.setup === "string") patch.setup = body.setup.trim() || undefined;
    if (body.diff_budget !== undefined) {
      const n = Number(body.diff_budget);
      if (!Number.isFinite(n) || n <= 0) {
        json(res, 400, { ok: false, error: "diff_budget must be a positive number" });
        return true;
      }
      patch.diff_budget = Math.floor(n);
    }
    if (body.max_concurrent !== undefined) {
      const n = Number(body.max_concurrent);
      if (!Number.isFinite(n) || n <= 0) {
        json(res, 400, { ok: false, error: "max_concurrent must be a positive number" });
        return true;
      }
      patch.max_concurrent = Math.floor(n);
    }
    if (typeof body.strict_verify === "boolean") patch.strict_verify = body.strict_verify;
    const saved = writeDelegationConfig(projectDir, patch as never);
    json(res, 200, { ok: true, settings: saved });
    return true;
  }

  if (path === "/room" && method === "GET") {
    const key = normalizeSessionKey(url.searchParams.get("session"));
    // The presence banner's data (docs/design/SESSIONS_SURFACE.md §6): whether an
    // orchestrator session is live for this project, and when it last did anything.
    const presence = await orchestratorPresence(projectDir, key);
    // Whether claude's own native transcript exists for this thread's pty session, so
    // Chat can say WHY it fell back to /room's own (paraphrased) history instead of the
    // client guessing from an empty page — the SAME meta.native_transcript_path
    // /room/transcript itself reads (room-supervisor.ts), read here too rather than
    // duplicated logic.
    const meta = readRoomSessionMeta(projectDir, key);
    const transcript = meta.native_transcript_path ? readNativeTranscriptPage(meta.native_transcript_path, { limit: 1 }) : null;
    json(res, 200, {
      ok: true,
      session: key,
      sessions: listRoomSessions(projectDir),
      turns: readRoomHistory(projectDir, key),
      busy: roomStateFor(ctx, key).pending > 0,
      orchestrator_live: presence.live,
      orchestrator_activity_at: presence.activity_at,
      has_transcript: Boolean(transcript && transcript.total > 0),
      transcript_turns: transcript ? transcript.total : 0,
      suggested_next: roomSuggestedNext(projectDir, key),
    });
    return true;
  }

  // Threads are conversations with the manager, not workspaces — dispatching from any
  // of them still produces an ordinary run on the same board.
  if (path === "/room/sessions" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const created = createRoomSession(projectDir, typeof body.title === "string" ? body.title : undefined);
    json(res, 200, { ok: true, session: created, sessions: listRoomSessions(projectDir) });
    return true;
  }

  if (path === "/room/sessions/close" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const key = normalizeSessionKey(body.session);
    try {
      // Stop whatever is holding this thread's session before deleting its files,
      // or a live supervisor keeps writing into a directory that no longer exists.
      retirePtyRoom(projectDir, key);
      retireStructuredRoom(projectDir, key);
      ctx.rooms?.delete(key);
      const pty = ctx.ptys?.get(key);
      pty?.attachment?.close();
      ctx.ptys?.delete(key);
      const sessions = closeRoomSession(projectDir, key);
      json(res, 200, { ok: true, sessions });
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
    }
    return true;
  }

  if (path === "/room/sessions/rename" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const key = normalizeSessionKey(body.session);
    const title = typeof body.title === "string" ? body.title : "";
    if (!title.trim()) {
      json(res, 400, { ok: false, error: "title is required" });
      return true;
    }
    json(res, 200, { ok: true, sessions: renameRoomSession(projectDir, key, title) });
    return true;
  }

  if (path === "/room/message" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      json(res, 400, { ok: false, error: "message is required" });
      return true;
    }
    // Snapshot BEFORE persisting the new turn: composePrompt renders `history` then
    // appends "User: {question}" itself, so passing the post-append array would echo
    // this message twice into the manager's prompt.
    const key = normalizeSessionKey(url.searchParams.get("session") ?? body.session);
    const historyBefore = readRoomHistory(projectDir, key);
    appendRoomTurn(projectDir, { role: "you", text: message }, key);
    feed.notifyRoom({ kind: "you", session: key });
    queueRoomTurn(ctx, message, historyBefore, key);
    // 202: accepted, not answered — the reply streams over SSE and lands in /room
    // when the manager (a real, possibly slow, CLI process) finishes.
    json(res, 202, { ok: true, accepted: true });
    return true;
  }

  // Claude's own native transcript for the thread's pty session, parsed into turns —
  // what makes Chat a VIEW of the real session Terminal shows. Response-capped at
  // TRANSCRIPT_PAGE_CAP turns per page (room-transcript.ts), same precedent as
  // eventsSincePage (report.ts). No recorded pty session gets an honest empty page,
  // never a 404 — the room itself already exists even when this session doesn't.
  if (path === "/room/transcript" && method === "GET") {
    const key = normalizeSessionKey(url.searchParams.get("session"));
    const meta = readRoomSessionMeta(projectDir, key);
    const limitParam = Number(url.searchParams.get("limit"));
    const cursorParam = url.searchParams.get("cursor");
    const cursor = cursorParam != null && cursorParam !== "" ? Number(cursorParam) : undefined;
    const page = meta.native_transcript_path
      ? readNativeTranscriptPage(meta.native_transcript_path, {
          ...(Number.isFinite(limitParam) && limitParam > 0 ? { limit: limitParam } : {}),
          ...(cursor != null && Number.isFinite(cursor) ? { cursor } : {}),
        })
      : { turns: [], cursor: null, total: 0 };
    json(res, 200, {
      ok: true,
      session_id: meta.session_id ?? null,
      native_transcript_path: meta.native_transcript_path ?? null,
      cap: TRANSCRIPT_PAGE_CAP,
      ...page,
    });
    return true;
  }

  // Terminal mode: a REAL pty running interactive claude, unmodified — not Kage's own
  // wrapper. xterm.js needs its own JS/CSS on the page; served from the installed
  // dependency itself so a global install always has them, no vendoring step to forget.
  if (path === "/vendor/xterm.js" && method === "GET") {
    serveDependencyFile(res, "@xterm/xterm/lib/xterm.js", "application/javascript; charset=utf-8");
    return true;
  }
  if (path === "/vendor/xterm.css" && method === "GET") {
    serveDependencyFile(res, "@xterm/xterm/css/xterm.css", "text/css; charset=utf-8");
    return true;
  }
  if (path === "/vendor/xterm-addon-fit.js" && method === "GET") {
    serveDependencyFile(res, "@xterm/addon-fit/lib/addon-fit.js", "application/javascript; charset=utf-8");
    return true;
  }

  if (path === "/room/pty/status" && method === "GET") {
    const key = normalizeSessionKey(url.searchParams.get("session"));
    const attach = ctx.ensurePtyAttachedFn ?? ensurePtyAttached;
    const attachment = await attach(ctx, key);
    json(res, 200, { ok: true, alive: Boolean(attachment) });
    return true;
  }

  // The current screen, for a tab that just opened Terminal mode. Without this a late
  // client sees only bytes arriving from now on — i.e. a blank terminal attached to a
  // perfectly healthy session.
  if (path === "/room/pty/snapshot" && method === "GET") {
    const key = normalizeSessionKey(url.searchParams.get("session"));
    const attach = ctx.ensurePtyAttachedFn ?? ensurePtyAttached;
    const attachment = await attach(ctx, key);
    json(res, 200, { ok: true, alive: Boolean(attachment), scrollback: ptyStateFor(ctx, key).scrollback });
    return true;
  }

  if (path === "/room/pty/write" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const data = typeof body.data === "string" ? body.data : "";
    if (!data) {
      json(res, 400, { ok: false, error: "data is required" });
      return true;
    }
    const attach = ctx.ensurePtyAttachedFn ?? ensurePtyAttached;
    const attachment = await attach(ctx, normalizeSessionKey(url.searchParams.get("session") ?? body.session));
    if (!attachment) {
      json(res, 503, { ok: false, error: "no live terminal session — it may still be starting" });
      return true;
    }
    attachment.write(data);
    json(res, 202, { ok: true });
    return true;
  }

  if (path === "/room/pty/resize" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const cols = Number(body.cols);
    const rows = Number(body.rows);
    if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols <= 0 || rows <= 0) {
      json(res, 400, { ok: false, error: "cols and rows must be positive numbers" });
      return true;
    }
    const attach = ctx.ensurePtyAttachedFn ?? ensurePtyAttached;
    const attachment = await attach(ctx, normalizeSessionKey(url.searchParams.get("session") ?? body.session));
    if (!attachment) {
      json(res, 503, { ok: false, error: "no live terminal session — it may still be starting" });
      return true;
    }
    attachment.resize(Math.floor(cols), Math.floor(rows));
    json(res, 202, { ok: true });
    return true;
  }

  // Goals: the room manager's own bookkeeping for a multi-run intent. Runs stay the unit
  // of dispatch — a goal only records the plan and which runs belong to which wave.
  if (path === "/goals" && method === "GET") {
    json(res, 200, { ok: true, goals: listGoals(projectDir).map((goal) => withWaveStatus(projectDir, goal)) });
    return true;
  }

  if (path === "/goals" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const intent = typeof body.intent === "string" ? body.intent.trim() : "";
    if (!intent) {
      json(res, 400, { ok: false, error: "intent is required" });
      return true;
    }
    const autonomy = typeof body.autonomy === "string" ? (body.autonomy as GoalAutonomy) : undefined;
    const plan = Array.isArray(body.plan)
      ? (body.plan as unknown[]).map((wave) => (Array.isArray(wave) ? (wave as Array<Partial<GoalRunSpec>>) : []))
      : undefined;
    const budgets = body.budgets && typeof body.budgets === "object" ? (body.budgets as Record<string, unknown>) : undefined;
    // A goal created from a room thread is owned by that thread: its manager dispatches
    // into it without ever having to pass goal_id, so the wave cannot silently detach.
    const session = normalizeSessionKey(body.session);
    try {
      const goal = createGoal(projectDir, {
        intent,
        plan,
        autonomy,
        budgets: budgets as never,
      });
      setActiveGoal(projectDir, session, goal.id);
      json(res, 201, { ok: true, goal });
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
    }
    return true;
  }

  const goalMatch = path.match(/^\/goals\/([A-Za-z0-9._-]+)(?:\/(abandon|activate))?$/);
  if (goalMatch) {
    const [, goalId, goalAction] = goalMatch;
    if (!goalAction && method === "GET") {
      try {
        json(res, 200, { ok: true, goal: withWaveStatus(projectDir, readGoal(projectDir, goalId)) });
      } catch (error) {
        json(res, 404, { ok: false, error: (error as Error).message });
      }
      return true;
    }
    if (goalAction === "abandon" && method === "POST") {
      let body: Record<string, unknown> = {};
      try {
        body = await readJsonBody(req);
      } catch {
        // abandon needs no body — a reason is optional, so an unreadable/empty one is fine.
      }
      const note = typeof body.reason === "string" ? body.reason.trim() || undefined : undefined;
      try {
        const goal = abandonGoal(projectDir, goalId, note);
        json(res, 200, { ok: true, goal });
      } catch (error) {
        const message = (error as Error).message;
        json(res, message.startsWith("No goal found") ? 404 : 400, { ok: false, error: message });
      }
      return true;
    }
    if (goalAction === "activate" && method === "POST") {
      let body: Record<string, unknown> = {};
      try {
        body = await readJsonBody(req);
      } catch {
        // A default-session activation needs no body.
      }
      try {
        const goal = readGoal(projectDir, goalId);
        setActiveGoal(projectDir, normalizeSessionKey(body.session), goal.id);
        json(res, 200, { ok: true, goal });
      } catch (error) {
        const message = (error as Error).message;
        json(res, message.startsWith("No goal found") ? 404 : 400, { ok: false, error: message });
      }
      return true;
    }
    return false;
  }

  // A goal's life must not depend on the one manager conversation that planned it — the
  // manager that owned goal X can die (daemon restart, closed session) with wave 2 fully
  // planned and never dispatched, and nothing else in the kernel moves it forward: the
  // kernel never auto-dispatches (autonomy is judgment, not automation) and the app is
  // read-only on goals. This route is the other half of that: dispatch exactly one wave,
  // through the SAME path kage_dispatch itself uses (dispatchRun briefOnly, then hand off
  // to a detached supervisor — dispatch.ts), refusing outright unless goalWaveStatus
  // already agrees the wave is 'due'. Merge gating is unchanged, so this is safe under
  // every autonomy level: dispatching a run is not deciding its fate.
  const dispatchWaveMatch = path.match(/^\/goals\/([A-Za-z0-9._-]+)\/dispatch-wave$/);
  if (dispatchWaveMatch && method === "POST") {
    const [, goalId] = dispatchWaveMatch;
    let goal: GoalRecord;
    try {
      goal = readGoal(projectDir, goalId);
    } catch (error) {
      json(res, 404, { ok: false, error: (error as Error).message });
      return true;
    }
    let body: Record<string, unknown> = {};
    try {
      body = await readJsonBody(req);
    } catch {
      // No body required — with no wave_index, this dispatches the goal's own due wave.
    }
    const statuses = goalWaveStatus(projectDir, goal);
    const waveIndex = typeof body.wave_index === "number" ? body.wave_index : statuses.findIndex((s) => s.status === "due");
    const status = waveIndex >= 0 ? statuses[waveIndex] : undefined;
    if (waveIndex < 0 || !status) {
      json(res, 409, { ok: false, error: `Goal "${goal.intent}" has no wave due for dispatch.` });
      return true;
    }
    if (status.status !== "due") {
      json(res, 409, { ok: false, error: `Wave ${waveIndex} is not due (status: ${status.status}) — refusing to dispatch.` });
      return true;
    }
    const wave = goal.plan.waves[waveIndex];
    const agentName = typeof body.agent === "string" && body.agent ? body.agent : detectAgent() ?? "stub";
    const adapter = adapterByName(agentName);
    // Test seam, same convention POST /runs already uses (body.hold === true): skips the
    // real detached `kage supervise` spawn so a test can assert the attach without a
    // stray child process outliving it.
    const hold = body.hold === true;
    const doDispatch = ctx.dispatchRunFn ?? dispatchRun;
    const runIds: string[] = [];
    const warnings: string[] = [];
    for (const spec of wave.runs) {
      try {
        // briefOnly + dispatchDetached mirrors kage_dispatch (index.ts) exactly — a
        // second, divergent dispatch path is exactly what this route must not become.
        const held = await doDispatch(projectDir, { intent: spec.intent, type: spec.type, briefOnly: true, goalId: goal.id }, adapter);
        runIds.push(held.task.id);
        const spawned = hold ? { pid: undefined } : dispatchDetached(projectDir, held.task);
        if (!hold && !spawned.pid) warnings.push(`${held.task.id}: could not hand off to a detached supervisor`);
      } catch (error) {
        warnings.push(`"${spec.intent}": ${(error as Error).message}`);
      }
    }
    json(res, 200, { ok: true, goal_id: goal.id, wave_index: waveIndex, run_ids: runIds, ...(warnings.length ? { warnings } : {}) });
    return true;
  }

  if (path === "/runs" && method === "GET") {
    // One goals read for the whole list, not one goalForRun lookup per run — goals
    // stay few, but this route is polled every 30s and must not turn into O(runs*goals).
    const goalIndex = new Map<string, string>();
    for (const g of listGoals(projectDir)) {
      for (const wave of g.plan.waves) for (const runId of wave.run_ids) goalIndex.set(runId, g.id);
    }
    json(res, 200, {
      ok: true,
      runs: listRuns(projectDir).map((run) => ({ ...withActivity(projectDir, run), goal_id: goalIndex.get(run.id) ?? null })),
    });
    return true;
  }

  if (path === "/runs" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
      return true;
    }
    const intent = typeof body.intent === "string" ? body.intent.trim() : "";
    if (!intent) {
      json(res, 400, { ok: false, error: "intent is required" });
      return true;
    }
    const agent = typeof body.agent === "string" && body.agent ? body.agent : readDelegationConfig(projectDir).default_agent ?? "claude";
    const type = (typeof body.type === "string" && body.type ? body.type : "chore") as RunType;
    const goalId = typeof body.goal_id === "string" ? body.goal_id.trim() : "";
    try {
      // A resolvable goal already over budget or planning a colliding wave is refused
      // before anything is created; an unresolvable goal_id is a separate, warn-only
      // concern that the attach below already fails the whole request for.
      if (goalId) {
        const gate = checkGoalAcceptsNewRun(projectDir, goalId);
        if (!gate.ok) throw new Error(gate.message);
      }
      // Compile the brief and freeze it, then hand the run to a DETACHED supervisor —
      // the daemon must never hold a live agent (a daemon restart cannot be allowed to
      // kill a 45-minute run).
      const plan = compileBrief(projectDir, intent, type);
      // briefMemoryIds here too, not only in dispatchRun — this route is the path the
      // app's ⌘N and ⌘⏎ actually take, and every previous drift in this codebase was
      // exactly "the fallback path got the field, the live path did not".
      const task = createRun(projectDir, {
        intent,
        type,
        agent,
        confidence: plan.confidence,
        briefMemoryIds: plan.memories.map((memory) => memory.id),
      });
      writeBrief(projectDir, task.id, renderBrief(task, plan));
      const briefed = transitionRun(projectDir, task.id, "briefed", "kernel");
      if (goalId) attachRunToGoal(projectDir, goalId, task.id);
      const spawned = body.hold === true ? { pid: undefined } : dispatchDetached(projectDir, briefed);
      feed.notify(task.id);
      json(res, 201, { ok: true, run: readRun(projectDir, task.id), supervisor_pid: spawned.pid ?? null });
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
    }
    return true;
  }

  // Take-over's pty write/resize/snapshot: a different shape than the other run actions
  // (a sub-action, not a single verb), so it gets its own match ahead of the general one.
  const runPtyMatch = path.match(/^\/runs\/([A-Za-z0-9._-]+)\/pty\/(write|resize|snapshot)$/);
  if (runPtyMatch) {
    const [, ptyRunId, sub] = runPtyMatch;
    const attachment = runPtyAttachments.get(ptyRunId) ?? null;
    if (sub === "snapshot" && method === "GET") {
      json(res, 200, { ok: true, alive: Boolean(attachment), scrollback: attachment ? attachment.snapshot() : "" });
      return true;
    }
    if (sub === "write" && method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        json(res, 400, { ok: false, error: (error as Error).message });
        return true;
      }
      const data = typeof body.data === "string" ? body.data : "";
      if (!data) {
        json(res, 400, { ok: false, error: "data is required" });
        return true;
      }
      if (!attachment) {
        json(res, 503, { ok: false, error: "no active take-over — take over the run first" });
        return true;
      }
      attachment.write(data);
      json(res, 202, { ok: true });
      return true;
    }
    if (sub === "resize" && method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        json(res, 400, { ok: false, error: (error as Error).message });
        return true;
      }
      const cols = Number(body.cols);
      const rows = Number(body.rows);
      if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols <= 0 || rows <= 0) {
        json(res, 400, { ok: false, error: "cols and rows must be positive numbers" });
        return true;
      }
      if (!attachment) {
        json(res, 503, { ok: false, error: "no active take-over — take over the run first" });
        return true;
      }
      attachment.resize(Math.floor(cols), Math.floor(rows));
      json(res, 202, { ok: true });
      return true;
    }
    return false;
  }

  const runMatch = path.match(
    /^\/runs\/([A-Za-z0-9._-]+)(?:\/(tell|stop|interrupt|merge|reject|raw|diff|steers|review|takeover|handback|resume-run|adopt|orphan-kill))?$/,
  );
  if (!runMatch) return false;
  const [, runId, action] = runMatch;

  if (action === "steers" && method === "GET") {
    try {
      readRun(projectDir, runId);
    } catch (error) {
      json(res, 404, { ok: false, error: (error as Error).message });
      return true;
    }
    json(res, 200, { ok: true, steers: readSteerRecords(projectDir, runId) });
    return true;
  }

  // The review-verdict route: an independent reviewer agent's verdict on this run
  // (review.ts's reviewRun), distinct from the manager's own advisory kage_review_run
  // note and from the kernel's own claim verdict. Absent (404) is the honest answer for
  // any run that never opted into review_required, or one still sitting in "reviewing" —
  // never a guessed/default verdict.
  if (action === "review" && method === "GET") {
    try {
      readRun(projectDir, runId);
    } catch (error) {
      json(res, 404, { ok: false, error: (error as Error).message });
      return true;
    }
    const review: AgentReviewRecord | null = readAgentReview(projectDir, runId);
    if (!review) {
      json(res, 404, { ok: false, error: `no reviewer verdict recorded for ${runId}` });
      return true;
    }
    json(res, 200, { ok: true, review });
    return true;
  }

  if (action === "raw" && method === "GET") {
    // The genuine escape hatch: the transcript exactly as the adapter wrote it.
    // A density control whose top setting still hides things is worse than none.
    try {
      readRun(projectDir, runId);
    } catch (error) {
      json(res, 404, { ok: false, error: (error as Error).message });
      return true;
    }
    const transcript = runTranscriptPath(projectDir, runId);
    const body = existsSync(transcript) ? readFileSync(transcript, "utf8") : "";
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(body || "no transcript yet");
    return true;
  }

  if (action === "diff" && method === "GET") {
    try {
      const body = runDiffText(projectDir, runId);
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(body || "no changes yet");
    } catch (error) {
      json(res, 404, { ok: false, error: (error as Error).message });
    }
    return true;
  }

  if (!action && method === "GET") {
    try {
      json(res, 200, { ok: true, ...runDetail(projectDir, runId), events: eventsSincePage(projectDir, Number(url.searchParams.get("since") ?? 0)) });
    } catch (error) {
      json(res, 404, { ok: false, error: (error as Error).message });
    }
    return true;
  }

  if (!action || method !== "POST") return false;

  try {
    if (action === "tell") {
      const body = await readJsonBody(req);
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message) {
        json(res, 400, { ok: false, error: "message is required" });
        return true;
      }
      const result = await steerRun(projectDir, runId, message, adapterByName);
      feed.notify(runId);
      json(res, 200, { ok: true, delivery: result.delivery, detail: result.message, run: readRun(projectDir, runId) });
      return true;
    }
    if (action === "stop") {
      const body = await readJsonBody(req);
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      // A BLOCKED run with a dead supervisor has no other way forward — nothing is
      // waiting on it, stop can never otherwise succeed, and reject refuses blocked
      // states because it assumes an agent might still answer. stopRun's own fallback
      // transition (writing "stopped" when the supervisor never could) covers exactly
      // this, so there is no special case left to hand-roll here.
      const { run, outcome } = await stopRun(projectDir, runId, "user", reason || undefined);
      feed.notify(runId);
      json(res, 200, { ok: true, stopped: run.state === "stopped", detail: outcome.note, run });
      return true;
    }
    if (action === "interrupt") {
      readRun(projectDir, runId); // 404s for an unknown run before the honest-503 check below.
      // Unlike stop, a true interrupt leaves the process and session alive.
      if (!(await isRunLive(projectDir, runId))) {
        json(res, 503, { ok: false, error: "no live supervisor" });
        return true;
      }
      const reply = await sendControl(projectDir, runId, { op: "interrupt" });
      feed.notify(runId);
      json(res, 200, { ok: true, delivered: reply?.delivered === true, detail: reply?.detail ?? "interrupt sent", run: readRun(projectDir, runId) });
      return true;
    }
    if (action === "steers") {
      const body = await readJsonBody(req);
      const op = typeof body.op === "string" ? body.op : "";
      readRun(projectDir, runId); // 404s for an unknown run before the mutation runs.
      let result: SteerQueueResult;
      if (op === "edit") {
        const id = typeof body.id === "string" ? body.id : "";
        const message = typeof body.message === "string" ? body.message : "";
        if (!id || !message.trim()) {
          json(res, 400, { ok: false, error: "id and message are required" });
          return true;
        }
        result = editQueuedSteer(projectDir, runId, id, message);
      } else if (op === "delete") {
        const id = typeof body.id === "string" ? body.id : "";
        if (!id) {
          json(res, 400, { ok: false, error: "id is required" });
          return true;
        }
        result = deleteQueuedSteer(projectDir, runId, id);
      } else if (op === "reorder") {
        const order = Array.isArray(body.order) ? body.order.filter((entry): entry is string => typeof entry === "string") : [];
        result = reorderQueuedSteers(projectDir, runId, order);
      } else if (op === "add") {
        // Pure queue append — no delivery attempt. This is the "queue for later"
        // half of the composer's delivery choice; "tell" (deliver now) stays separate.
        const message = typeof body.message === "string" ? body.message : "";
        if (!message.trim()) {
          json(res, 400, { ok: false, error: "message is required" });
          return true;
        }
        appendSteerRecord(projectDir, runId, message.trim());
        result = { ok: true, records: readSteerRecords(projectDir, runId) };
      } else {
        json(res, 400, { ok: false, error: `unknown op: ${op || "(none)"}` });
        return true;
      }
      feed.notify(runId);
      json(res, result.ok ? 200 : 409, { ok: result.ok, error: result.ok ? undefined : result.reason, steers: result.records });
      return true;
    }
    if (action === "takeover") {
      readRun(projectDir, runId); // 404s for an unknown run before the mutation runs.
      const existing = runPtyAttachments.get(runId);
      if (existing) {
        json(res, 200, { ok: true, already: true, run: readRun(projectDir, runId) });
        return true;
      }
      const takeOver = ctx.takeOverRunFn ?? takeOverRun;
      const result = await takeOver(projectDir, runId);
      if (!result.ok) {
        json(res, 409, { ok: false, error: result.reason });
        return true;
      }
      runPtyAttachments.set(runId, result.attachment);
      // Bytes stream over the SAME pty channel the room uses, keyed by session so a run
      // terminal and a room terminal never paint into each other's screen.
      result.attachment.onData((bytes) => feed.notifyPty({ kind: "data", bytes, session: `run:${runId}` }));
      result.attachment.onExit(() => {
        runPtyAttachments.delete(runId);
        feed.notifyPty({ kind: "exit", session: `run:${runId}` });
        feed.notify(runId);
      });
      feed.notify(runId);
      json(res, 200, { ok: true, pid: result.pid, run: readRun(projectDir, runId) });
      return true;
    }
    if (action === "handback") {
      readRun(projectDir, runId); // 404s for an unknown run before the mutation runs.
      const doHandBack = ctx.handBackFn ?? handBack;
      const result = await doHandBack(projectDir, runId);
      runPtyAttachments.delete(runId);
      feed.notify(runId);
      json(res, result.ok ? 200 : 409, { ok: result.ok, error: result.ok ? undefined : result.reason, run: result.ok ? result.task : readRun(projectDir, runId) });
      return true;
    }
    if (action === "merge") {
      const result = mergeRun(projectDir, runId);
      feed.notify(runId);
      json(res, result.ok ? 200 : 409, { ok: result.ok, detail: result.message, run: readRun(projectDir, runId) });
      return true;
    }
    if (action === "reject") {
      const body = await readJsonBody(req);
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!reason) {
        // A rejection without a reason is a learning thrown away; the kernel refuses it
        // everywhere, so the API refuses it too.
        json(res, 400, { ok: false, error: "reason is required — the rejection is kept as memory" });
        return true;
      }
      const result = rejectRun(projectDir, runId, reason);
      feed.notify(runId);
      json(res, result.ok ? 200 : 409, { ok: result.ok, detail: result.message, run: readRun(projectDir, runId) });
      return true;
    }
    // Reachable exactly when a human is not at a terminal: a stranded run needs a
    // recovery a phone can reach as much as a laptop can.
    if (action === "resume-run") {
      const body = await readJsonBody(req);
      const budgetUsd = typeof body.budget_usd === "number" ? body.budget_usd : Number(body.budget_usd);
      const budgetMinutes = typeof body.budget_minutes === "number" ? body.budget_minutes : Number(body.budget_minutes);
      const result = await resumeStoppedRun(
        projectDir,
        runId,
        Number.isFinite(budgetUsd) ? budgetUsd : undefined,
        Number.isFinite(budgetMinutes) ? budgetMinutes : undefined,
        adapterByName,
      );
      feed.notify(runId);
      json(res, result.ok ? 200 : 409, { ok: result.ok, detail: result.message, run: result.task });
      return true;
    }
    if (action === "adopt") {
      const result = adoptOrphanedRun(projectDir, runId);
      feed.notify(runId);
      json(res, result.ok ? 200 : 409, { ok: result.ok, detail: result.message, run: readRun(projectDir, runId) });
      return true;
    }
    if (action === "orphan-kill") {
      const result = killOrphanedAgent(projectDir, runId);
      feed.notify(runId);
      json(res, result.ok ? 200 : 409, { ok: result.ok, detail: result.message, run: result.task });
      return true;
    }
  } catch (error) {
    const message = (error as Error).message ?? String(error);
    json(res, message.startsWith("No run found") ? 404 : 400, { ok: false, error: message });
    return true;
  }
  return false;
}
