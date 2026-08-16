// Kage desktop shell.
//
// The whole point of this file is what it does NOT contain: no HTML, no renderer
// logic, no state. It frames the daemon's own /app page in a native window and adds
// the four things a browser tab cannot do — a dock presence with a badge, a global
// hotkey, native notifications, and surviving as "the app" in the user's muscle
// memory. Orchestration logic lives in shared modules behind the API; a shell that
// grows opinions becomes a second renderer that drifts (the AO/TUI lesson).
"use strict";

const { app, BrowserWindow, globalShortcut, nativeImage, shell } = require("electron");
const { execFile, execFileSync } = require("node:child_process");
const { writeFileSync, existsSync, readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

/**
 * The app's own mark — the 影 seal the titlebar already shows.
 *
 * electron-builder bakes the icon into a packaged .app from build/icon.icns, but a dev
 * run (`npm start`, or `npx electron .`) gets Electron's default icon unless the dock
 * is told explicitly. Setting it here means the icon is right in both, which is the
 * whole point: a generic Electron diamond is the first thing a user sees.
 */
function applyDockIcon() {
  if (process.platform !== "darwin" || !app.dock) return;
  const icon = join(__dirname, "build", "icon.png");
  if (!existsSync(icon)) return;
  const image = nativeImage.createFromPath(icon);
  if (!image.isEmpty()) app.dock.setIcon(image);
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const projectDir = resolve(argValue("--project") || process.env.KAGE_PROJECT || process.cwd());

/**
 * Find the Kage CLI.
 *
 * In a dev checkout it sits next door at ../mcp/dist/cli.js. In a PACKAGED app that
 * path is inside the asar and does not exist, so fall back to the globally installed
 * `kage` — resolved through the login shell, because a GUI app launched from Finder
 * inherits almost no PATH (no /opt/homebrew/bin, no nvm), which is the classic way a
 * packaged Electron app "works from the terminal and not from the dock".
 */
function resolveCli() {
  const local = join(__dirname, "..", "mcp", "dist", "cli.js");
  if (existsSync(local)) return { command: process.execPath, args: [local], viaNode: true };
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    const found = execFileSync(shell, ["-lic", "command -v kage"], { encoding: "utf8" }).trim().split("\n").pop();
    if (found) return { command: found, args: [], viaNode: false };
  } catch {
    // Fall through to a bare name and let the spawn error say so plainly.
  }
  return { command: "kage", args: [], viaNode: false };
}

/**
 * `kage app --no-open` already knows how to find, health-check, and self-heal the
 * daemon (a live pid is not a live app). Reuse it instead of re-implementing daemon
 * management in a second place, and read the URL off its last line.
 *
 * ASYNC, deliberately. This used to be execFileSync, which blocks Electron's main
 * process — and it is not quick: measured 4.3s to return, 5.3s before the window was
 * shown, 6.6s to a usable app. All of that was spent with NOTHING on screen, because
 * a blocked main process cannot paint. The window now opens first and this resolves
 * behind it.
 */
/**
 * The fast path: is a daemon for this project already serving /app?
 *
 * Shelling out to `kage app` costs 2.33s EVEN WHEN THE DAEMON IS ALREADY RUNNING,
 * because it spawns node and loads the whole kernel just to read a status file and
 * probe a URL. Both of those the shell can do itself in milliseconds, and after the
 * first launch of a session this is the case that actually happens. The CLI is still
 * the authority when a daemon must be STARTED — that logic stays in one place.
 */
async function existingDaemonUrl() {
  try {
    const status = JSON.parse(readFileSync(join(projectDir, ".agent_memory", "daemon", "status.json"), "utf8"));
    if (!status || !status.pid || !status.rest_port) return null;
    // A live pid is not a live app: probe the route we are about to open.
    process.kill(status.pid, 0);
    const url = `http://${status.host || "127.0.0.1"}:${status.rest_port}/app`;
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.status === 200 ? url : null;
  } catch {
    return null;
  }
}

function ensureDaemon() {
  const cli = resolveCli();
  return new Promise((resolve, reject) => {
    // In the Electron main process, process.execPath is Electron itself — running the
    // CLI with it would launch a second app instance. ELECTRON_RUN_AS_NODE makes the
    // same binary behave as plain Node for this child. (Only needed when we invoke the
    // script through Electron's own node; a real `kage` binary needs no such help.)
    execFile(
      cli.command,
      [...cli.args, "app", "--project", projectDir, "--no-open"],
      {
        encoding: "utf8",
        timeout: 60_000,
        env: cli.viaNode ? { ...process.env, ELECTRON_RUN_AS_NODE: "1" } : process.env,
      },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(String(stderr || error.message).trim()));
        const match = String(stdout).match(/https?:\/\/[^\s]+/);
        if (!match) return reject(new Error(`kage app did not report a URL:\n${stdout}`));
        resolve(match[0]);
      },
    );
  });
}

/**
 * What the user looks at while the daemon comes up. Inlined as a data URL because there
 * is, by definition, no server yet — and painted in the app's own palette so the launch
 * reads as Kage starting rather than as a blank window that might be broken.
 */
function splashUrl(message) {
  const html = `<!doctype html><meta charset="utf-8"><style>
    :root{color-scheme:dark}
    html,body{height:100%;margin:0}
    body{background:#121413;color:#a4aba1;display:flex;align-items:center;justify-content:center;
      font:400 13px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-app-region:drag}
    .w{text-align:center;transform:translateY(-8px)}
    svg{width:52px;height:52px;display:block;margin:0 auto 18px;animation:b 2.4s ease-in-out infinite}
    @keyframes b{0%,92%,100%{opacity:1}96%{opacity:.35}}
    @media (prefers-reduced-motion:reduce){svg{animation:none}}
    h1{margin:0 0 5px;font:600 17px/1.2 "Fraunces","Iowan Old Style",Palatino,Georgia,serif;color:#edefe9;letter-spacing:.01em}
    p{margin:0;font-size:12.5px;color:#767d74}
    .e{color:#e07a8c;max-width:520px;text-align:left;font:400 12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}
  </style><div class="w">
    <svg viewBox="0 0 96 96"><defs><radialGradient id="i" cx="50%" cy="50%" r="58%"><stop offset="0" stop-color="#eafff4"/><stop offset=".32" stop-color="#39ff9a"/><stop offset=".72" stop-color="#0bbf67"/><stop offset="1" stop-color="#06351f"/></radialGradient></defs><path d="M9 49c9-15 22-23 39-23s30 8 39 23c-9 14-22 21-39 21S18 63 9 49Z" fill="#06130d" stroke="#39ff9a" stroke-width="3"/><circle cx="48" cy="48" r="16" fill="url(#i)"/><circle cx="48" cy="48" r="6" fill="#020405"/></svg>
    <h1>Kage</h1><p class="${message.includes("\n") ? "e" : ""}">${message.replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"))}</p>
  </div>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 760,
    minHeight: 480,
    title: "Kage",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 15 },
    backgroundColor: "#121413",
    // Linux/Windows take the window icon; macOS uses the dock icon set above.
    ...(process.platform === "darwin" || !existsSync(join(__dirname, "build", "icon.png"))
      ? {}
      : { icon: join(__dirname, "build", "icon.png") }),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // The renderer sets document.title to "Kage · N" when N decisions need a human.
  // The title is the one channel a sandboxed page and its shell already share, so
  // the dock badge needs no IPC surface at all.
  win.on("page-title-updated", (_event, title) => {
    if (process.platform !== "darwin") return;
    const match = title.match(/·\s*(\d+)/);
    app.dock.setBadge(match ? match[1] : "");
  });

  // External links (evidence files, PRs) belong in the default browser, not the shell.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });

  // Verification hook: KAGE_SHELL_SHOT=/path.png writes a capture of the real
  // window after load, so "the desktop app runs" is a checkable claim.
  const shot = process.env.KAGE_SHELL_SHOT;
  if (shot) {
    win.webContents.once("did-finish-load", () => {
      // did-finish-load fires on the HTML parse, not on the room/runs history actually
      // arriving — the page still has its own async fetch("/room")/fetch("/runs") to
      // do after that. A short delay here caught the empty primer mid-"connecting…"
      // once already; this margin is deliberately generous.
      setTimeout(async () => {
        try {
          const image = await win.webContents.capturePage();
          writeFileSync(shot, image.toPNG());
        } catch {
          // A failed capture must never take the app down.
        }
      }, 3500);
    });
  }
}

app.whenReady().then(async () => {
  applyDockIcon();
  // Window FIRST, daemon second. The old order blocked on a synchronous 4.3s call and
  // showed nothing for 5.3s; the user's first impression of the app was an empty
  // screen they could not tell from a hang.
  createWindow();
  win.loadURL(splashUrl("Starting…"));

  try {
    // Try the cheap check first; fall back to the CLI only when it cannot answer.
    const url = (await existingDaemonUrl()) || (await ensureDaemon());
    if (win && !win.isDestroyed()) win.loadURL(url);
  } catch (error) {
    // A failure belongs IN the window, where the user can read it — exiting the app
    // silently was indistinguishable from a crash.
    const detail = String(error && error.message ? error.message : error);
    if (win && !win.isDestroyed()) win.loadURL(splashUrl(`Kage could not start.\n\n${detail}`));
    console.error(detail);
  }

  // ⌥K from anywhere: summon Kage. (⌥L/⌥H next/prev-needing-you arrive with the
  // focused-run protocol; a summon key is useful from day one.)
  globalShortcut.register("Alt+K", () => {
    if (!win) return;
    if (win.isFocused()) win.hide();
    else {
      win.show();
      win.focus();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else win?.show();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  // Dock apps on macOS stay alive with no windows; anywhere else, quit.
  if (process.platform !== "darwin") app.quit();
});
