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
import { join, resolve } from "node:path";

import {
  createRun,
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
import { appendSteerRecord, dispatchDetached, readSteerRecords } from "./dispatch.js";
import {
  abandonGoal,
  attachRunToGoal,
  createGoal,
  goalForRun,
  listGoals,
  readGoal,
  type GoalAutonomy,
  type GoalRunSpec,
} from "./goal.js";
import { compileBrief, renderBrief } from "./brief.js";
import { normalizeRunType, preflightForecast } from "./preflight.js";
import { deleteQueuedSteer, editQueuedSteer, reorderQueuedSteers, steerRun, type SteerQueueResult } from "./steer.js";
import { sendControl, isRunLive } from "./control.js";
import { handBack, takeOverRun, type RunPtyAttachment } from "./run-pty.js";
import { mergeRun, rejectRun } from "./ratify.js";
import { adapterByName } from "./adapters/index.js";
import { eventsSincePage } from "./report.js";
import { claimVerdict, renderClaimCard } from "./verify.js";
import { readActivity } from "./progress.js";
import { git } from "./git.js";
import { worktreePath } from "./worktree.js";
import { askManager } from "./manager-client.js";
import { appendRoomTurn, readRoomHistory, type RoomHistoryTurn } from "./room-history.js";
import { askRoomSupervisor, dispatchRoomSupervisor, isRoomSupervisorLive, type RoomStreamEvent } from "./room-supervisor.js";
import { ADAPTER_NAMES, isAgentInstalled } from "./adapters/index.js";
import { DEFAULT_DIFF_BUDGET, DEFAULT_MAX_CONCURRENT, readDelegationConfig, writeDelegationConfig } from "./config.js";
import { forgetProject, rememberProject } from "./projects.js";
import { ensureAppDaemon } from "./app-daemon.js";
import { packetFlywheel, packetsTaughtByRun, readMemoryOverview, readMemoryPacket, recordMemoryFeedback } from "./memory-view.js";
import { blastRadiusFor, type BlastRadius } from "./blast-radius.js";
import { attachRoomPty, dispatchRoomPtySupervisor, isRoomPtyLive, retirePtyRoom, retireStructuredRoom, type RoomPtyAttachment } from "./room-pty.js";
import {
  DEFAULT_SESSION,
  closeRoomSession,
  createRoomSession,
  listRoomSessions,
  normalizeSessionKey,
  renameRoomSession,
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
  askRoomFn?: (message: string, history: RoomHistoryTurn[], onEvent: (event: { kind: string; text: string }) => void) => Promise<{ text: string; tools: string[]; redactions?: string[] }>;
  /** Test seam: replace real pty spawning/attaching entirely. */
  ensurePtyAttachedFn?: (ctx: DelegationApiContext) => Promise<RoomPtyAttachment | null>;
  /** Test seam: replace real take-over pty spawning entirely — never a real claude. */
  takeOverRunFn?: typeof takeOverRun;
  /** Test seam: replace the real kill-and-reattach hand-back entirely. */
  handBackFn?: typeof handBack;
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
 * spawning one if needed, and reuses it across calls — one held duplex socket for the
 * daemon's whole life, not one per keystroke. Concurrent callers (a write racing a
 * resize) share the same in-flight connect attempt via `connecting` rather than each
 * spawning their own supervisor.
 */
async function ensurePtyAttached(ctx: DelegationApiContext, session?: string): Promise<RoomPtyAttachment | null> {
  const { projectDir, feed } = ctx;
  const key = normalizeSessionKey(session);
  const pty = ptyStateFor(ctx, key);
  if (pty.attachment) return pty.attachment;
  if (pty.connecting) return pty.connecting;
  pty.connecting = (async () => {
    if (!(await isRoomPtyLive(projectDir, key))) {
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

/**
 * The live path, then an honest fallback. Only claude's protocol is verified to
 * support a held-open multi-turn session (proven empirically before this was built:
 * a live claude process given a second stdin frame after the first turn's `result`,
 * with stdin never closed in between, answers with real memory of the first turn) —
 * so this is the ONLY agent that gets tried live. Anything else, or any failure at
 * any step, falls through to askManager's one-shot-with-replayed-history path, which
 * already works and already has its own tests. No conflating "detected" with "proven
 * to hold a session live" — that gap is exactly what this whole session has been
 * about closing everywhere else.
 */
async function resolveRoomReply(
  ctx: DelegationApiContext,
  message: string,
  historyBefore: RoomHistoryTurn[],
  session?: string,
): Promise<{ text: string; tools: string[]; redactions?: string[] }> {
  const { projectDir, feed } = ctx;
  const key = normalizeSessionKey(session);
  // Deltas carry their thread so a client watching thread A never animates typing
  // into it because thread B's manager is mid-sentence.
  const onDelta = (event: { kind: string; text: string }) =>
    feed.notifyRoom({ kind: event.kind, text: event.text, session: key });

  if (ctx.askRoomFn) return ctx.askRoomFn(message, historyBefore, onDelta);

  // A test that sets askManagerFn is explicitly asking to exercise the fallback path
  // without touching a real CLI — every existing room test relies on exactly that.
  // Respecting it here matters more than "try live first": this machine has claude
  // genuinely on PATH, so skipping this check would make those tests spawn a real
  // detached supervisor process instead of calling the fake they injected.
  const isProduction = !ctx.askManagerFn;
  if (isProduction && isAgentInstalled("claude")) {
    // One session, two views: if the terminal view currently holds the room's claude
    // session, retire it before the structured side resumes the same id. Two live
    // processes on one session fork its context and race each other's writes.
    const ptyState = ptyStateFor(ctx, key);
    if (ptyState.attachment || (await isRoomPtyLive(projectDir, key))) {
      retirePtyRoom(projectDir, key);
      ptyState.attachment = null;
      ptyState.scrollback = "";
    }
    let live: RoomStreamEvent | null = await askRoomSupervisor(projectDir, message, onDelta, key);
    if (!live) {
      dispatchRoomSupervisor(projectDir, key);
      const deadline = Date.now() + ROOM_SUPERVISOR_STARTUP_TIMEOUT_MS;
      while (Date.now() < deadline && !(await isRoomSupervisorLive(projectDir, key))) {
        await new Promise((pause) => setTimeout(pause, 200));
      }
      live = await askRoomSupervisor(projectDir, message, onDelta, key);
    }
    if (live?.kind === "final") return { text: live.text, tools: live.tools, ...(live.redactions?.length ? { redactions: live.redactions } : {}) };
    // live?.kind === "error", or still null after the startup wait — fall through.
  }

  const ask = ctx.askManagerFn ?? askManager;
  const reply = await ask({
    projectDir,
    question: message,
    history: historyBefore.map((turn) => ({ role: turn.role, text: turn.text })),
    onEvent: onDelta,
  });
  return { text: reply.text, tools: reply.tools, ...(reply.redactions?.length ? { redactions: reply.redactions } : {}) };
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
      appendRoomTurn(projectDir, {
        role: "kage",
        text: reply.text,
        tools: reply.tools,
        ...(reply.redactions?.length ? { redactions: reply.redactions } : {}),
      }, key);
    } catch (error) {
      appendRoomTurn(projectDir, { role: "kage", text: `Manager error: ${(error as Error).message}` }, key);
    } finally {
      feed.notifyRoom({ kind: "final", done: true, session: key });
      room.pending -= 1;
    }
  });
}

/**
 * "What is it doing right now" — computed from the transcript the adapters already
 * write, never asserted by the agent. Attached only to in-flight runs so the list
 * stays cheap and a finished run never shows a stale activity line.
 */
function withActivity(
  projectDir: string,
  run: RunView,
): RunView & { activity?: ReturnType<typeof readActivity>; claim_summary?: string; blast?: BlastRadius } {
  // A run awaiting a decision carries the one fact needed to make it: how much
  // changed, and whether the kernel's checks passed. Without it the inbox could only
  // repeat the intent back, so every decision meant opening the run to find out.
  if (run.display_state === "ready" || run.display_state === "failed") {
    const claim = readClaim(projectDir, run.id);
    if (claim) {
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
        claim_summary: `${change} · ${passed}/${claim.checks.length} checks`,
        ...(blast ? { blast } : {}),
      };
    }
  }
  const inFlight = run.display_state === "running" || run.display_state === "dispatched" || run.display_state === "verifying";
  if (!inFlight) return run;
  const activity = readActivity(runTranscriptPath(projectDir, run.id));
  return { ...run, activity };
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

function runDetail(projectDir: string, runId: string): Record<string, unknown> {
  const run = readRun(projectDir, runId);
  const owningGoal = goalForRun(projectDir, runId);
  const detail: Record<string, unknown> = { run: { ...withActivity(projectDir, run), goal_id: owningGoal ? owningGoal.id : null } };
  const briefFile = join(runDir(projectDir, runId), "brief.md");
  if (existsSync(briefFile)) detail.brief = readFileSync(briefFile, "utf8");
  const claimFile = join(runDir(projectDir, runId), "claim.json");
  if (existsSync(claimFile)) {
    try {
      const claim = JSON.parse(readFileSync(claimFile, "utf8")) as ClaimRecord;
      detail.claim = claim;
      detail.receipt = renderClaimCard(claim, { budget: run.budgets.diff_lines });
      // The verdict travels WITH the claim, computed by the kernel that ran the checks.
      // A client that re-derives it can disagree with the kernel — caught live: a GUI
      // recomputation showed a green "VERIFIED 2/3" for a run the kernel had already
      // marked failed, because it counted an unrunnable check as merely absent rather
      // than as a reason not to certify. Exactly the overclaim this product exists to
      // prevent, so the verdict is now a fact the surface renders, never one it decides.
      detail.verdict = claimVerdict(claim);
    } catch {
      // A torn claim never breaks the detail view; the receipt tab shows nothing.
    }
  }
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
    json(res, 200, { ok: true, projects, current: resolve(projectDir) });
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
    json(res, 200, {
      ok: true,
      session: key,
      sessions: listRoomSessions(projectDir),
      turns: readRoomHistory(projectDir, key),
      busy: roomStateFor(ctx, key).pending > 0,
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
    json(res, 200, { ok: true, goals: listGoals(projectDir) });
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
    try {
      const goal = createGoal(projectDir, {
        intent,
        plan,
        autonomy,
        budgets: budgets as never,
      });
      json(res, 201, { ok: true, goal });
    } catch (error) {
      json(res, 400, { ok: false, error: (error as Error).message });
    }
    return true;
  }

  const goalMatch = path.match(/^\/goals\/([A-Za-z0-9._-]+)(?:\/(abandon))?$/);
  if (goalMatch) {
    const [, goalId, goalAction] = goalMatch;
    if (!goalAction && method === "GET") {
      try {
        json(res, 200, { ok: true, goal: readGoal(projectDir, goalId) });
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
    return false;
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
    const agent = typeof body.agent === "string" && body.agent ? body.agent : "claude";
    const type = (typeof body.type === "string" && body.type ? body.type : "chore") as RunType;
    try {
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
      const goalId = typeof body.goal_id === "string" ? body.goal_id.trim() : "";
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

  const runMatch = path.match(/^\/runs\/([A-Za-z0-9._-]+)(?:\/(tell|stop|interrupt|merge|reject|raw|diff|steers|takeover|handback))?$/);
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
      const reply = await sendControl(projectDir, runId, { op: "stop" });
      let detail = reply?.detail;
      if (!reply?.ok) {
        // No live supervisor answered. For most states that just means "nothing to
        // stop" — but a BLOCKED run has no other way forward: nothing is waiting on
        // it, stop can never succeed, and reject refuses blocked states because it
        // assumes an agent might still answer. If the supervisor is confirmed dead,
        // persist that reality so the run can actually be rejected or retried instead
        // of being stuck forever.
        const current = readRun(projectDir, runId);
        if (current.state === "blocked" && !(await isRunLive(projectDir, runId))) {
          transitionRun(projectDir, runId, "stopped", "user", "supervisor gone; nothing was waiting");
          detail = "supervisor gone; nothing was waiting — marked stopped";
        }
      }
      feed.notify(runId);
      const run = readRun(projectDir, runId);
      json(res, 200, {
        ok: true,
        stopped: reply?.ok === true || run.state === "stopped",
        detail: detail ?? "no live supervisor — nothing to stop",
        run,
      });
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
  } catch (error) {
    const message = (error as Error).message ?? String(error);
    json(res, message.startsWith("No run found") ? 404 : 400, { ok: false, error: message });
    return true;
  }
  return false;
}
