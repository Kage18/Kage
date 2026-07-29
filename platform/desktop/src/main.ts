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
} from "electron";
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { connect } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { cliPathFor, loadKageCore, resolveCoreDir, type DesktopState, type KageCore } from "./kage-core.js";

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
    const target = `${core.daemonOrigin(active!.port)}${decision.pathname}${decision.search}`;
    try {
      const init: RequestInit = { method: request.method, headers: request.headers };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = await request.arrayBuffer();
      }
      const response = await net.fetch(target, init);
      if (DEBUG) console.log(`[kage://]   forwarded to ${target} -> ${response.status}`);
      return response;
    } catch (error) {
      if (DEBUG) console.error(`[kage://]   forward FAILED ${target}:`, error);
      return new Response(
        JSON.stringify({ ok: false, error: `the repository daemon is not answering: ${String(error)}` }),
        { status: 502, headers: { "content-type": "application/json" } },
      );
    }
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
  ipcMain.handle("kage:repos:switch", async (_event, path: string) => {
    state = core.openRepo(state, path);
    persist();
    await startRepo(path);
    return publicState();
  });

  createTray();

  // ORDER MATTERS, and getting it wrong is invisible until you look: the window fires its first
  // `/v2/overview` the instant it loads. Created before the daemon is listening, that fetch hits a
  // closed port, and the SPA has no retry — it sits on "Loading repository knowledge…" forever
  // even though the daemon comes up a second later. So the active repository's daemon is awaited
  // BEFORE the window exists.
  const active = core.activeRepo(state);
  if (active) await startRepo(active.path);

  window = createWindow();

  // The rest can come up behind the window — nothing is fetching them yet.
  for (const repo of state.repos) {
    if (repo.path !== active?.path) await startRepo(repo.path);
  }
  void pollAll();
  setInterval(() => void pollAll(), POLL_MS);

  app.on("activate", () => showWindow());
});

// The menubar is the product's whole reason for being resident, so closing the window does not
// quit — it hides. Quit is explicit, from the tray or Cmd+Q.
app.on("window-all-closed", () => { /* stay resident */ });

// A daemon outliving the app is a process nobody can find to kill.
app.on("before-quit", () => supervisor?.stopAll());
