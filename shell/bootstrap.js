// Closes the dmg-first onboarding gap: a user who downloads Kage.app before ever
// running the npm install has no `kage` on PATH. Left alone, resolveCli() in main.js
// falls back to a bare 'kage' and the resulting spawn ENOENT reads as a broken app,
// not a missing dependency. This module runs BEFORE any of that spawning happens and
// gives the user a real choice: install the engine, or quit and do it themselves.
//
// WHY NO UNIT TESTS: every path here either touches the `electron` module (dialog,
// shell.openExternal) or spawns a real login shell to resolve PATH the way a packaged,
// Finder-launched app must — neither exists inside mcp's plain `node --test` process
// (requiring "electron" outside an Electron runtime resolves to a path string, not the
// API). This matches main.js and update.js, which have the same gap for the same
// reason: verification here is manual — launch the packaged app with no `kage` on
// PATH (or with KAGE_NO_BOOTSTRAP=1) and confirm the dialog/skip behavior by hand.
"use strict";

const { dialog, app, shell } = require("electron");
const { execFileSync, execFile } = require("node:child_process");

const NODEJS_URL = "https://nodejs.org";
const INSTALL_COMMAND = "npx -y @kage-core/kage-graph-mcp install";

/**
 * Same technique resolveCli() already uses to find the global `kage` binary: a
 * Finder-launched app inherits almost none of the user's PATH, so the only reliable
 * way to ask "is X on this user's PATH" is to ask their own login shell, not ours.
 */
function loginShellHas(command) {
  try {
    const shellBin = process.env.SHELL || "/bin/zsh";
    const found = execFileSync(shellBin, ["-lic", `command -v ${command}`], { encoding: "utf8" }).trim();
    return Boolean(found);
  } catch {
    return false;
  }
}

function engineInstalled() {
  return loginShellHas("kage");
}

function nodeToolingAvailable() {
  return loginShellHas("node") && loginShellHas("npx");
}

/** Runs the official install through the user's own login shell, so it resolves node
 * the same way their terminal would (nvm, Homebrew node, etc.) rather than whatever
 * Electron's own PATH happens to be. */
function runInstall() {
  return new Promise((resolvePromise, reject) => {
    const shellBin = process.env.SHELL || "/bin/zsh";
    execFile(
      shellBin,
      ["-lic", INSTALL_COMMAND],
      { encoding: "utf8", timeout: 5 * 60_000 },
      (error, _stdout, stderr) => {
        if (error) return reject(new Error(String(stderr || error.message).trim()));
        resolvePromise();
      },
    );
  });
}

/**
 * Called once, before resolveCli()/ensureDaemon() ever spawn anything.
 *
 * Returns `{ ok: true }` when the caller may proceed with the normal launch path
 * (engine already present, install just succeeded, or KAGE_NO_BOOTSTRAP=1 explicitly
 * asked to skip this whole flow). Returns `{ ok: false, message }` when nothing more
 * can be done this launch — node/npx missing, the user declined, or the install
 * failed — and the caller should show `message` instead of attempting a spawn.
 *
 * `localCliExists` lets a dev checkout (../mcp/dist/cli.js present) skip every check
 * below: that path never needs a global `kage` and never will.
 * `onInstalling` is an optional callback fired right before the install command runs,
 * so the caller can show its own "installing…" state — this module owns no window.
 */
async function ensureEngineAvailable({ localCliExists, onInstalling } = {}) {
  if (localCliExists) return { ok: true };
  if (process.env.KAGE_NO_BOOTSTRAP === "1") return { ok: true };
  if (engineInstalled()) return { ok: true };

  if (!nodeToolingAvailable()) {
    await dialog.showMessageBox({
      type: "warning",
      message: "Node.js was not found",
      detail:
        "Kage runs on a local engine installed via npm, which needs Node.js — and Node.js was not found on this machine.\n\nOpening nodejs.org. Install Node.js, then relaunch Kage.",
      buttons: ["OK"],
    });
    shell.openExternal(NODEJS_URL);
    return {
      ok: false,
      message: `Node.js was not found.\n\nKage's engine installs via npm, which needs Node.js. Install it from ${NODEJS_URL}, then relaunch Kage.`,
    };
  }

  const { response } = await dialog.showMessageBox({
    type: "info",
    message: "Kage needs its engine",
    detail: "Kage runs on a local engine installed via npm. Install it now?",
    buttons: ["Install engine", "Quit"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) {
    app.quit();
    return { ok: false, message: "Installation declined." };
  }

  if (onInstalling) onInstalling();

  try {
    await runInstall();
  } catch (error) {
    const detail = String(error && error.message ? error.message : error);
    return {
      ok: false,
      message: `Kage's engine failed to install.\n\n${detail}\n\nRun this yourself in a terminal:\n${INSTALL_COMMAND}`,
    };
  }

  if (!engineInstalled()) {
    return {
      ok: false,
      message: `Kage's engine still isn't on your PATH after installing.\n\nRun this yourself in a terminal:\n${INSTALL_COMMAND}`,
    };
  }

  return { ok: true };
}

module.exports = { ensureEngineAvailable, engineInstalled, nodeToolingAvailable, INSTALL_COMMAND, NODEJS_URL };
