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
const { execFileSync } = require("node:child_process");
const { writeFileSync, existsSync } = require("node:fs");
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
 */
function ensureDaemon() {
  const cli = resolveCli();
  // In the Electron main process, process.execPath is Electron itself — running the
  // CLI with it would launch a second app instance. ELECTRON_RUN_AS_NODE makes the
  // same binary behave as plain Node for this child. (Only needed when we invoke the
  // script through Electron's own node; a real `kage` binary needs no such help.)
  const out = execFileSync(cli.command, [...cli.args, "app", "--project", projectDir, "--no-open"], {
    encoding: "utf8",
    timeout: 30_000,
    env: cli.viaNode ? { ...process.env, ELECTRON_RUN_AS_NODE: "1" } : process.env,
  });
  const match = out.match(/https?:\/\/[^\s]+/);
  if (!match) throw new Error(`kage app did not report a URL:\n${out}`);
  return match[0];
}

let win = null;

function createWindow(url) {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 760,
    minHeight: 480,
    title: "Kage",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 15 },
    backgroundColor: "#121619",
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
  win.loadURL(url);

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

app.whenReady().then(() => {
  applyDockIcon();
  let url;
  try {
    url = ensureDaemon();
  } catch (error) {
    console.error(String(error && error.message ? error.message : error));
    app.exit(2);
    return;
  }
  createWindow(url);

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
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
    else win?.show();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  // Dock apps on macOS stay alive with no windows; anywhere else, quit.
  if (process.platform !== "darwin") app.quit();
});
