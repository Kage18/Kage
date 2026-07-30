// Kage — the desktop app's main process.
//
// This file is supervision and nothing else. Every rule with a decision in it lives in the
// compiled core (`mcp/vnext/desktop/`) where the main test suite covers it; what is here is the
// part that genuinely cannot be tested without Electron: windows, the custom scheme, the tray,
// notifications, and child processes.
//
// Security posture, and none of it is negotiable:
//   - nothing remote is ever loaded, so sandbox + contextIsolation hold with no exceptions
//   - the renderer gets no Node, only a narrow contextBridge surface
//   - the `kage://` handler forwards to loopback only, never an arbitrary host

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  net,
  Notification,
  protocol,
  shell,
  Tray,
  utilityProcess,
  type UtilityProcess,
} from "electron";
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { get as httpGet } from "node:http";
import { connect } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  cliPathFor,
  loadKageCore,
  resolveCoreDir,
  type AgentSession,
  type DesktopState,
  type KageCore,
} from "./kage-core.js";

// The scheme must be registered as privileged BEFORE the app is ready, or fetch/XHR from the
// renderer is blocked and every API call the portal makes fails silently.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "kage",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

const APP_ORIGIN = "kage://app";
const GROUND = "#0a0c0b"; // the theme's ground — the window must never flash white

let core: KageCore;
let coreDir: string;
let portalDir: string;
let state: DesktopState;
let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let supervisor: InstanceType<KageCore["DaemonSupervisor"]>;

/** Refs already alerted on, per repository. See the core's `decideAlerts` for the rules. */
const alertMemory = new Map<string, { seen: string[]; observedBefore: boolean }>();

// ── The system Node ──────────────────────────────────────────────────────────────────────────
// Electron's bundled Node is 20 and has no `node:sqlite`, which the portal's compiled-model routes
// require. The daemon therefore runs on the system Node, located once at startup.
function resolveNodeBinary(): string {
  if (process.env.KAGE_NODE && existsSync(process.env.KAGE_NODE)) return process.env.KAGE_NODE;
  try {
    const found = execFileSync("/usr/bin/which", ["node"], { encoding: "utf8" }).trim();
    if (found && existsSync(found)) return found;
  } catch {
    /* fall through to the well-known locations */
  }
  for (const candidate of ["/usr/local/bin/node", "/opt/homebrew/bin/node", "/usr/bin/node"]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("Node could not be found on PATH. Kage needs Node 22 or newer to run a repository daemon.");
}

function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    const settle = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => settle(true));
    socket.once("error", () => settle(false));
    socket.setTimeout(1000, () => settle(false));
  });
}

// ── The kage:// scheme ───────────────────────────────────────────────────────────────────────

function securityHeaders(contentType: string): Record<string, string> {
  return {
    "content-type": contentType,
    // Self-hosted assets only, and no remote anything. The app loads nothing off the network.
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
  };
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".map": "application/json; charset=utf-8",
};

function mimeFor(file: string): string {
  const dot = file.lastIndexOf(".");
  return (dot >= 0 && MIME[file.slice(dot)]) || "application/octet-stream";
}

/** Set KAGE_DEBUG=1 to trace every protocol decision. Off by default — this is a hot path. */
const DEBUG = process.env.KAGE_DEBUG === "1";

async function handleProtocol(request: Request): Promise<Response> {
  const active = core.activeRepo(state);
  const decision = core.routeDesktopRequest({ url: request.url, hasActiveRepo: !!active });
  if (DEBUG) console.log(`[kage://] ${request.method} ${request.url} -> ${decision.kind}`);

  if (decision.kind === "deny") {
    // 503 rather than 404: nothing is missing, the app just cannot answer yet.
    const status = decision.reason === "no repository is open" ? 503 : 400;
    return new Response(JSON.stringify({ ok: false, error: decision.reason }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  if (decision.kind === "forward") {
    // In-process, through the worker. No socket, so there is nothing to time out, exhaust or
    // leak — and a slow derivation cannot starve the requests behind it.
    const reply = await callApi(active!.path, decision.pathname, decision.search);
    if (DEBUG) console.log(`[kage://]   worker ${decision.pathname} -> ${reply.status}`);
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "content-type": "application/json" },
    });
  }

  // The daemon's own resolver: refuses traversal by falling back to the entry, and serves
  // index.html for client-side routes so History-API navigation works.
  const file = core.resolveAppAsset(portalDir, decision.pathname);
  if (!file || !existsSync(file)) {
    return new Response("The portal build is missing. Run `npm run build --prefix platform/web`.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  // The document is rewritten on the way out to mark itself as running in the app. Doing it here
  // rather than from the preload means the attribute is present in the FIRST parsed byte — a
  // preload can only touch the DOM once it exists, which shows a frame of web-shaped layout
  // before the window chrome corrects itself. Everything else streams untouched.
  if (file.endsWith("index.html")) {
    const html = (await (await net.fetch(pathToFileURL(file).toString())).text()).replace(
      "<html ",
      '<html data-kage-desktop="true" ',
    );
    return new Response(html, { status: 200, headers: securityHeaders(MIME[".html"]) });
  }

  const body = await net.fetch(pathToFileURL(file).toString());
  return new Response(body.body, { status: 200, headers: securityHeaders(mimeFor(file)) });
}

// ── Window ───────────────────────────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: GROUND,
    // Inset traffic lights, never redrawn — Apple's guidance, and the fastest tell of a fake
    // native app is a custom window control.
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // No flicker on first paint: show only once the renderer has something to draw.
  win.once("ready-to-show", () => win.show());

  if (DEBUG) {
    win.webContents.on("console-message", (_e, _level, message) => console.log(`[renderer] ${message}`));
    win.webContents.on("did-fail-load", (_e, code, description, url) =>
      console.error(`[renderer] load failed ${code} ${description} ${url}`),
    );
    win.webContents.openDevTools({ mode: "detach" });
  }

  // Nothing in this app may navigate away or open a window. External links go to the real browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_ORIGIN)) event.preventDefault();
  });

  void win.loadURL(`${APP_ORIGIN}/`);
  return win;
}

function showWindow(route?: string): void {
  if (!window || window.isDestroyed()) window = createWindow();
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  if (route) {
    void window.webContents.executeJavaScript(
      `window.dispatchEvent(new CustomEvent("kage:navigate",{detail:${JSON.stringify(route)}}))`,
    );
  }
}

// ── Repositories ─────────────────────────────────────────────────────────────────────────────

function persist(): void {
  core.saveState(homedir(), state);
  refreshTray();
  window?.webContents.send("kage:state", publicState());
}

function publicState() {
  return {
    repos: state.repos.map((repo) => ({
      path: repo.path,
      name: repo.name,
      port: repo.port,
      daemon: supervisor.statusFor(repo.path)?.state ?? "stopped",
    })),
    active: state.active,
  };
}

async function startRepo(path: string): Promise<void> {
  const repo = state.repos.find((entry) => entry.path === path);
  if (!repo) return;
  const status = await supervisor.start(repo.path, repo.port);
  if (status.state === "failed") {
    dialog.showErrorBox("Kage could not open that repository", status.detail ?? "The daemon did not start.");
  }
  persist();
}

async function addRepositoryByDialog(): Promise<void> {
  const picked = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    message: "Choose a git repository for Kage to watch",
  });
  if (picked.canceled || !picked.filePaths[0]) return;
  const result = core.addRepo(state, picked.filePaths[0]);
  if (!result.ok) {
    dialog.showErrorBox("That folder cannot be watched", result.error ?? "Unknown reason.");
    return;
  }
  state = result.state;
  persist();
  await startRepo(result.repo!.path);
}

// ── The API worker ───────────────────────────────────────────────────────────────────────────
//
// Reads no longer travel over HTTP to a separate daemon. They go to an Electron utility process
// that calls the same dispatcher the daemon uses. Deleted with the daemon: ports, supervision,
// health probes, cold-start races, and a forwarder that leaked a socket per SSE reconnect.
//
// The worker is a real process, so a synchronous derivation blocks neither the window nor the next
// request — which the daemon could not manage, being single-threaded. Measured: /v2/overview alone
// 0.059s, the same call while a board derived 12.65s.

// A POOL, not one worker, and the difference is the whole point: a utility process is still a
// single event loop, and the heavy work here is synchronous. One worker would serialise reads and
// reproduce exactly the head-of-line blocking this refactor exists to remove — measured on the
// daemon as /v2/overview taking 12.65s when issued while a board derived, against 0.059s alone.
//
// Three is chosen against the shape of the work rather than the machine: at most one genuinely
// expensive read (a cold board) is ever in flight, and everything else is fast, so two free lanes
// is enough for the slow one never to be in anybody's way.
const WORKER_COUNT = 3;

interface Worker {
  process: UtilityProcess;
  /** Requests currently assigned to it — the pool sends the next read to the quietest lane. */
  inFlight: number;
}

let workers: Worker[] = [];
let nextRequestId = 1;
const pending = new Map<number, { resolve: (reply: { status: number; body: unknown }) => void; worker: Worker }>();

function spawnWorker(): Worker {
  const worker: Worker = { process: utilityProcess.fork(join(__dirname, "api-host.js")), inFlight: 0 };
  worker.process.on("message", (reply: { id: number; status: number; body: unknown }) => {
    const waiting = pending.get(reply.id);
    if (!waiting) return;
    pending.delete(reply.id);
    waiting.worker.inFlight -= 1;
    waiting.resolve({ status: reply.status, body: reply.body });
  });
  // A worker that dies takes its in-flight reads with it. Fail them explicitly rather than leaving
  // promises that never settle — an unsettled promise is what left the window on "Loading
  // repository knowledge…" forever under the daemon, and it is the worst possible failure mode.
  worker.process.on("exit", () => {
    for (const [id, waiting] of pending) {
      if (waiting.worker !== worker) continue;
      waiting.resolve({ status: 503, body: { ok: false, error: "the Kage worker stopped" } });
      pending.delete(id);
    }
    workers = workers.filter((entry) => entry !== worker);
  });
  return worker;
}

function startApiWorker(): void {
  while (workers.length < WORKER_COUNT) workers.push(spawnWorker());
}

function callApi(projectDir: string, pathname: string, search: string): Promise<{ status: number; body: unknown }> {
  startApiWorker();
  // Least-busy, so a lane stuck on a cold board is simply not chosen.
  const worker = workers.reduce((best, entry) => (entry.inFlight < best.inFlight ? entry : best), workers[0]);
  const id = nextRequestId++;
  worker.inFlight += 1;
  return new Promise((resolve) => {
    pending.set(id, { resolve, worker });
    worker.process.postMessage({ id, coreDir, projectDir, pathname, search });
  });
}

// ── The live feed ────────────────────────────────────────────────────────────────────────────
//
// ONE subscription per active repository, held in main and pushed to the renderer over IPC.
//
// The renderer used to open this itself through the `kage://` scheme, and that leaked a socket on
// every EventSource reconnect: forwarding an endpoint that never ends never releases the
// connection, and Electron allows roughly six per host. Six reconnects exhausted the pool and every
// other request queued forever. Node's own http client is used rather than `net.fetch` precisely
// because the response stream is ours to destroy.

let liveFeed: { repo: string; destroy: () => void } | null = null;

function stopLiveFeed(): void {
  liveFeed?.destroy();
  liveFeed = null;
}

function startLiveFeed(repo: string, port: number): void {
  if (liveFeed?.repo === repo) return;
  stopLiveFeed();

  let stopped = false;
  let retry: NodeJS.Timeout | undefined;

  const connectOnce = (): void => {
    if (stopped) return;
    const request = httpGet({ host: "127.0.0.1", port, path: "/kage/events" }, (response) => {
      response.setEncoding("utf8");
      let buffer = "";
      response.on("data", (chunk: string) => {
        buffer += chunk;
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            const event = JSON.parse(line.slice(5).trim()) as { type?: string };
            if (event.type === "work_changed") window?.webContents.send("kage:changed");
          } catch { /* a heartbeat or a partial frame is not an error */ }
        }
      });
      // A closed stream is normal (the daemon restarts, the machine sleeps). Reconnect slowly —
      // this is a background signal, not a request anybody is waiting on.
      response.on("end", () => { if (!stopped) retry = setTimeout(connectOnce, 3000); });
    });
    request.on("error", () => { if (!stopped) retry = setTimeout(connectOnce, 3000); });
    liveFeed = {
      repo,
      destroy: () => {
        stopped = true;
        clearTimeout(retry);
        request.destroy();
      },
    };
  };

  connectOnce();
}

// ── Agent sessions ───────────────────────────────────────────────────────────────────────────
//
// Each session gets its OWN proxy on its own port. That is not defensiveness, it is what makes
// the run strip honest: the proxy generates its session id once per process, so every receipt and
// observation from that proxy belongs to this session by construction. Sharing one proxy would
// leave only timing to attribute recalls by, and a guess drawn as a measurement is exactly what
// this product exists to prevent.

interface LiveSession {
  session: AgentSession;
  repo: string;
  /** The proxy's session id, which WE chose — see startSession. */
  proxySessionId: string;
  /** Deliveries the proxy recorded for this session: memory that actually reached the agent. */
  recalls: number;
  /** When each of those deliveries happened, so the strip can place them. Same clock as the ticks. */
  recallAt: string[];
  /** Echoed back from the start request: main has no way to resolve a work id to a title. */
  workTitle: string | null;
  proxyPort: number;
  agentProcess: ReturnType<typeof spawn>;
  proxyProcess: ReturnType<typeof spawn>;
  startedAt: number;
}

const sessions = new Map<string, LiveSession>();
const SESSION_PORT_BASE = 8800;

function freeSessionPort(): number {
  const taken = new Set([...sessions.values()].map((s) => s.proxyPort));
  for (let port = SESSION_PORT_BASE; port < SESSION_PORT_BASE + 200; port += 1) {
    if (!taken.has(port)) return port;
  }
  throw new Error("no free port for a session proxy");
}

function publicSessions() {
  return [...sessions.values()].map((live) => ({
    session_id: live.session.session_id,
    work_id: live.session.work_id,
    work_title: live.workTitle,
    agent: live.session.agent,
    state: live.session.state,
    started_at: new Date(live.startedAt).toISOString(),
    elapsed_s: Math.round((Date.now() - live.startedAt) / 1000),
    step: [...live.session.events].reverse().find((e) => e.kind === "tool")?.summary ?? null,
    // Two measured series, both on this machine's clock, sent to the renderer to plot on one axis.
    //
    // Tool ticks carry the time the app OBSERVED them in the agent's stream. Recall marks carry the
    // `delivered_at` the proxy itself recorded. Neither is placed relative to the other, because
    // nothing measured says which tool call a given delivery informed — the strip shows only that
    // both happened, and when.
    ticks: core.stripTicks(live.session.events),
    recalls: live.recalls,
    recall_at: live.recallAt,
  }));
}

function pushSessions(): void {
  window?.webContents.send("kage:sessions", publicSessions());
}

function endSession(id: string, exitCode: number | null): void {
  const live = sessions.get(id);
  if (!live) return;
  live.session = core.closeSession(live.session, exitCode);
  try {
    live.proxyProcess.kill("SIGTERM");
  } catch {
    /* already gone */
  }
  pushSessions();
  // Keep the finished session visible briefly, then let Activity's "Earlier" band take over from
  // the receipt store — which is the durable record.
  setTimeout(() => {
    sessions.delete(id);
    pushSessions();
  }, 5_000);
}

async function startSession(input: {
  repo: string;
  work_id: string | null;
  work_title: string | null;
  agent: string;
  prompt: string;
}): Promise<{ ok: boolean; error?: string }> {
  const launch = core.agentCommand(input.agent, input.prompt);
  if (!launch) return { ok: false, error: `Kage does not know how to run "${input.agent}" headlessly.` };

  const proxyPort = freeSessionPort();
  const sessionId = `kage-${Date.now()}-${proxyPort}`;
  // WE choose the proxy's session id, so its receipts are attributable to this session by
  // construction rather than by timing. `proxy.ts` honours KAGE_PROXY_SESSION_ID.
  const proxySessionId = `kage-session-${sessionId}`;

  // The proxy first, in assist mode — assist is what injects memory, which is the entire point of
  // running the agent through Kage rather than directly.
  const proxyProcess = spawn(
    resolveNodeBinary(),
    [cliPathFor(coreDir), "proxy", "--project", input.repo, "--port", String(proxyPort), "--mode", "assist"],
    { cwd: input.repo, stdio: "ignore", env: { ...process.env, KAGE_PROXY_SESSION_ID: proxySessionId } },
  );

  // Spawning is not listening. Wait, or the agent's first request hits a closed port.
  let listening = false;
  for (let attempt = 0; attempt < 50 && !listening; attempt += 1) {
    await new Promise((r) => setTimeout(r, 200));
    listening = await probePort(proxyPort);
  }
  if (!listening) {
    proxyProcess.kill("SIGTERM");
    return { ok: false, error: `the session proxy did not start on ${proxyPort}` };
  }

  const agentProcess = spawn(launch.command, launch.args, {
    cwd: input.repo,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...core.agentEnv(proxyPort) },
  });

  const live: LiveSession = {
    session: core.newSession({ session_id: sessionId, work_id: input.work_id, agent: input.agent }),
    repo: input.repo,
    workTitle: input.work_title,
    proxySessionId,
    recalls: 0,
    recallAt: [],
    proxyPort,
    agentProcess,
    proxyProcess,
    startedAt: Date.now(),
  };
  sessions.set(sessionId, live);
  pushSessions();

  // The agent emits one JSON object per line. Buffer across chunk boundaries — a naive
  // split-per-chunk drops the event that straddles two reads, which is most of the interesting
  // ones on a busy run.
  let buffer = "";
  agentProcess.stdout?.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    // The clock is read HERE, at the process edge, because this is the only moment anything real is
    // known about when the event happened: the agent's stream carries no timestamps of its own.
    // Stamping here keeps `parseStreamLine` pure and makes the tick's time an observation rather
    // than a reconstruction.
    const at = new Date().toISOString();
    for (const line of lines) {
      for (const event of core.parseStreamLine(line)) {
        live.session = core.applyEvent(live.session, { ...event, at });
      }
    }
    pushSessions();
    void refreshRecalls(sessionId);
  });

  agentProcess.on("error", (error) => {
    live.session = core.applyEvent(live.session, {
      kind: "error",
      summary: error.message,
      at: new Date().toISOString(),
    });
    endSession(sessionId, null);
  });
  agentProcess.on("exit", (code) => endSession(sessionId, code));

  return { ok: true };
}

/**
 * How much memory actually reached this session's agent.
 *
 * Exact, not inferred: the proxy's session id is the one WE set, so `proxyTaskId` names its task
 * and every delivery on that task belongs to this session. A `delivered` record IS a moment memory
 * was injected.
 *
 * Each record's own `delivered_at` comes back with it, which is what lets the strip place these
 * moments in time. The app spawned the proxy, so that timestamp and the app's own observations of the
 * agent's stream are readings from one clock. What is still NOT claimed is which tool call a given
 * delivery informed — nothing recorded says that, so the strip never draws it.
 */
async function refreshRecalls(id: string): Promise<void> {
  const live = sessions.get(id);
  if (!live) return;
  try {
    const taskId = core.proxyTaskId(live.repo, live.proxySessionId);
    // Through the worker, not over HTTP. The old version fetched `/v2/tasks/:id` from the daemon and
    // read `body.deliveries` — a key that route has never had (its body is `{task, receipt_count}`),
    // so the count resolved to `undefined` and fell to zero on every poll. `/v2/recalls` is the route
    // that actually reads the delivery records, and it drains the proxy's spool on the way.
    const reply = await callApi(live.repo, "/v2/recalls", `?task=${encodeURIComponent(taskId)}`);
    if (reply.status !== 200) return;
    const body = reply.body as { count?: number | null; delivered_at?: string[] };
    // Null means the store could not be read. Leave the previous reading alone rather than replace a
    // measurement with a zero nobody took.
    if (typeof body.count !== "number") return;
    const at = (body.delivered_at ?? []).filter((stamp) => typeof stamp === "string" && stamp.length > 0);
    if (body.count !== live.recalls || at.length !== live.recallAt.length) {
      live.recalls = body.count;
      live.recallAt = at;
      pushSessions();
    }
  } catch {
    // The delivery lands after the request completes; a miss here is normal, never an error.
  }
}

function stopSession(id: string): void {
  const live = sessions.get(id);
  if (!live) return;
  try {
    live.agentProcess.kill("SIGTERM");
  } catch {
    /* already gone */
  }
  // `exit` fires and endSession does the rest, including reaping the proxy.
}

// ── Alerts ───────────────────────────────────────────────────────────────────────────────────

const POLL_MS = 30_000;

async function pollRepo(repoPath: string): Promise<number> {
  const repo = state.repos.find((entry) => entry.path === repoPath);
  if (!repo || supervisor.statusFor(repoPath)?.state !== "running") return 0;

  let candidates: Array<{ ref: string; kind: string; severity: number; summary: string }> = [];
  try {
    const response = await net.fetch(`${core.daemonOrigin(repo.port)}/v2/attention`);
    if (!response.ok) return 0;
    const body = (await response.json()) as { items?: typeof candidates };
    candidates = body.items ?? [];
  } catch {
    return 0; // a daemon still starting is not an error worth surfacing
  }

  const memory = alertMemory.get(repoPath) ?? { seen: [], observedBefore: false };
  const decision = core.decideAlerts({
    repoName: repo.name,
    candidates,
    seen: memory.seen,
    observedBefore: memory.observedBefore,
  });
  alertMemory.set(repoPath, { seen: decision.seen, observedBefore: true });

  if (decision.alert && Notification.isSupported()) {
    const notification = new Notification({ title: decision.alert.title, body: decision.alert.body });
    notification.on("click", () => showWindow(decision.alert!.route));
    notification.show();
  }
  return decision.seen.length;
}

async function pollAll(): Promise<void> {
  let blocked = 0;
  for (const repo of state.repos) blocked += await pollRepo(repo.path);
  refreshTray(blocked);
}

// ── Tray ─────────────────────────────────────────────────────────────────────────────────────

let lastBlockedCount = 0;

function refreshTray(blocked = lastBlockedCount): void {
  lastBlockedCount = blocked;
  if (!tray) return;
  // The badge is the whole point of the menubar presence: how many decisions are waiting on a
  // human, across every repository at once.
  tray.setTitle(blocked > 0 ? ` ${blocked}` : "");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: blocked > 0 ? `${blocked} decisions need you` : "Nothing needs you", enabled: false },
      { type: "separator" },
      ...state.repos.map((repo) => ({
        label: `${repo.name}${supervisor.statusFor(repo.path)?.state === "running" ? "" : "  (stopped)"}`,
        click: () => {
          state = core.openRepo(state, repo.path);
          persist();
          showWindow();
        },
      })),
      { type: "separator" },
      { label: "Add a repository…", click: () => void addRepositoryByDialog() },
      { label: "Open Kage", accelerator: "Cmd+O", click: () => showWindow() },
      { type: "separator" },
      { label: "Quit Kage", role: "quit" },
    ]),
  );
}

function createTray(): void {
  const iconPath = join(__dirname, "..", "assets", "trayTemplate.png");
  // A template image is monochrome with alpha; macOS tints it for the current menubar. A coloured
  // tray icon is the classic tell of a non-native app.
  const image = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  image.setTemplateImage(true);
  tray = new Tray(image);
  tray.setToolTip("Kage");
  refreshTray(0);
}

// ── Lifecycle ────────────────────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    coreDir = resolveCoreDir(process.resourcesPath);
    core = loadKageCore(process.resourcesPath);
  } catch (error) {
    dialog.showErrorBox("Kage cannot start", error instanceof Error ? error.message : String(error));
    app.quit();
    return;
  }

  portalDir = core.resolvePortalDir(coreDir);
  state = core.loadState(homedir());

  try {
    supervisor = new core.DaemonSupervisor(
      {
        spawn: (command, args, cwd) => {
          const child = spawn(command, args, { cwd, stdio: "ignore", detached: false });
          // Node reports "no pid yet" as undefined; the supervisor's contract is null. Normalise
          // rather than widen the contract — null is a value the tests can assert on.
          return { pid: child.pid ?? null, kill: (signal) => { child.kill(signal as NodeJS.Signals); } };
        },
        probe: probePort,
        wait: (ms) => new Promise((r) => setTimeout(r, ms)),
      },
      resolveNodeBinary(),
      cliPathFor(coreDir),
    );
  } catch (error) {
    dialog.showErrorBox("Kage cannot start", error instanceof Error ? error.message : String(error));
    app.quit();
    return;
  }

  protocol.handle("kage", handleProtocol);

  ipcMain.handle("kage:state", () => publicState());
  ipcMain.handle("kage:repos:add", () => addRepositoryByDialog());
  ipcMain.handle("kage:repos:remove", (_event, path: string) => {
    supervisor.stop(path);
    state = core.removeRepo(state, path);
    alertMemory.delete(path);
    persist();
    return publicState();
  });
  ipcMain.handle("kage:sessions", () => publicSessions());
  ipcMain.handle("kage:sessions:start", (_event, input: { work_id: string | null; work_title: string | null; agent: string; prompt: string }) => {
    const active = core.activeRepo(state);
    if (!active) return { ok: false, error: "no repository is open" };
    return startSession({ ...input, repo: active.path });
  });
  ipcMain.handle("kage:sessions:stop", (_event, id: string) => {
    stopSession(id);
    return publicSessions();
  });
  ipcMain.handle("kage:repos:switch", async (_event, path: string) => {
    state = core.openRepo(state, path);
    persist();
    await startRepo(path);
    const opened = core.activeRepo(state);
    if (opened) startLiveFeed(opened.path, opened.port);
    return publicState();
  });

  createTray();

  // ORDER MATTERS, and getting it wrong is invisible until you look: the window fires its first
  // `/v2/overview` the instant it loads. Created before the daemon is listening, that fetch hits a
  // closed port, and the SPA has no retry — it sits on "Loading repository knowledge…" forever
  // even though the daemon comes up a second later. So the active repository's daemon is awaited
  // BEFORE the window exists.
  // The window no longer waits for anything: reads go to the worker, which starts on first use
  // and needs no port. The daemon start that used to gate this is gone, and with it the cold-start
  // race that left the window on "Loading repository knowledge…" forever.
  startApiWorker();
  window = createWindow();

  // Daemons still run, but ONLY for the live feed — watching the filesystem is genuinely a
  // server's job. Nothing reads through them, so they start behind the window and a slow one
  // costs nothing but a late "Live" indicator.
  const active = core.activeRepo(state);
  for (const repo of state.repos) {
    void startRepo(repo.path).then(() => {
      if (repo.path === active?.path) startLiveFeed(repo.path, repo.port);
    });
  }
  void pollAll();
  setInterval(() => void pollAll(), POLL_MS);

  app.on("activate", () => showWindow());
});

// The menubar is the product's whole reason for being resident, so closing the window does not
// quit — it hides. Quit is explicit, from the tray or Cmd+Q.
app.on("window-all-closed", () => { /* stay resident */ });

// A daemon — or a running agent, or its proxy — outliving the app is a process nobody can find to
// kill. Agents first: they are the ones that cost money while nobody is watching.
app.on("before-quit", () => {
  stopLiveFeed();
  for (const worker of workers) worker.process.kill();
  for (const id of [...sessions.keys()]) stopSession(id);
  supervisor?.stopAll();
});
