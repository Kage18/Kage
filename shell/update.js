// Auto-update policy for the packaged desktop app, split out of main.js so the policy
// reads as a whole: check on launch and every 4 hours, download in background, surface
// a ready update non-modally (dock badge + native notification + a "Restart to Update…"
// menu item), never a dialog that interrupts a working session.
//
// RELEASE FLOW (do this in order — electron-builder trusts you to keep it in order):
//   1. Bump the version in mcp/package.json, then run mcp's tests once — the
//      "distribution manifests stay in version lockstep" test in mcp/release.test.ts
//      fails the build if shell/package.json (and server.json, the plugin manifests)
//      drift from it. Bump shell/package.json's version to match by hand.
//   2. `npm run dmg --prefix shell` locally to sanity-check the build, or go straight to
//      step 3 if CI/local signing is already trusted.
//   3. `npm run release --prefix shell` — builds dmg + zip and publishes a GitHub
//      Release on kage-core/Kage (electron-builder.config.js's `publish` block), which
//      is what makes electron-builder emit and upload latest-mac.yml alongside the
//      artifacts. Needs a GH_TOKEN in the environment with release-upload rights.
//   4. Confirm the release page has: Kage-<version>.dmg, Kage-<version>-mac.zip, and
//      latest-mac.yml. Without the zip and the yml, existing installs never learn a new
//      version exists — the dmg alone only serves a fresh human download.
//
// WHY NO UNIT TESTS: every function here either touches the `electron` module (app,
// Notification, autoUpdater) or macOS's real Squirrel.Mac/code-signing behavior, neither
// of which exists inside mcp's `node --test` process — requiring "electron" outside an
// Electron runtime resolves to a path string, not the API, so there is no seam to import
// this file into a plain Node test without mocking out the very thing under test. This
// matches the rest of shell/: main.js has no unit tests either; its own verification
// path is packaging plus a real-window screenshot (KAGE_SHELL_SHOT). This file is
// verified the same way — build with `npm run dmg --prefix shell`, launch the result,
// and watch the console log line it prints at startup for which path it took.
"use strict";

const { app, Notification, shell } = require("electron");

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const RELEASES_URL = "https://github.com/kage-core/Kage/releases";

/** Never run in dev (unpackaged), and always honor the explicit kill-switch. */
function autoUpdateDisabled() {
  return !app.isPackaged || process.env.KAGE_NO_AUTO_UPDATE === "1";
}

/**
 * electron-builder.config.js decides, at build time, whether the bundle carries a real
 * Developer ID signature or only an ad-hoc one (see its own header for why ad-hoc still
 * happens unconditionally). That decision rides into the packaged package.json as
 * `autoUpdateSigned` via `extraMetadata`. Squirrel.Mac verifies a downloaded update
 * against the running app's own signature before applying it — an ad-hoc signature has
 * no certificate behind it to verify against, so an ad-hoc build can check for updates
 * but must never attempt to install one.
 */
function builtWithInstallableSignature() {
  try {
    return Boolean(require("./package.json").autoUpdateSigned);
  } catch {
    return false;
  }
}

let autoUpdaterRef = null;

/** Wired to both the notification's click and the "Restart to Update…" menu item. */
function restartToUpdate() {
  if (autoUpdaterRef) autoUpdaterRef.quitAndInstall();
}

function openReleasesPage() {
  shell.openExternal(RELEASES_URL);
}

function notify(title, body, onClick) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body });
  if (onClick) notification.on("click", onClick);
  notification.show();
}

/**
 * Start the update policy. Call this once, after the window has been shown — never
 * before, so a slow or failing update check can never be what a user's first launch is
 * waiting on.
 *
 * `onReady(version)` fires once an update has actually finished downloading and is safe
 * to install with restartToUpdate(); main.js uses it to flip the dock badge and add the
 * menu item. It never fires on an ad-hoc build, which never downloads at all.
 */
function startAutoUpdate(onReady) {
  if (autoUpdateDisabled()) return;

  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch (error) {
    console.warn(`[kage] electron-updater unavailable: ${error.message}`);
    return;
  }
  autoUpdaterRef = autoUpdater;

  const signed = builtWithInstallableSignature();
  console.log(`[kage] auto-update: ${signed ? "Developer-ID signed, installs enabled" : "ad-hoc signed, notify-only"}`);

  autoUpdater.autoDownload = signed;
  // main.js drives the actual restart explicitly (via the notification click or the
  // menu item) — never on quit, which would be a surprise mid-session.
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", (info) => {
    if (signed) return; // downloading already started in the background; wait for update-downloaded.
    notify("Kage update available", `Version ${info.version} is available.`, openReleasesPage);
  });

  autoUpdater.on("update-downloaded", (info) => {
    notify("Kage update ready", `Version ${info.version} downloaded. Click to restart and update.`, restartToUpdate);
    if (onReady) onReady(info.version);
  });

  // Catches everything else: a Developer-ID build that still fails Squirrel.Mac's
  // verification for some other reason, a network error, a missing latest-mac.yml. This
  // degrades to silence — an update check that never happened — rather than a crash or
  // a stuck "checking…" state a user has no way to dismiss.
  autoUpdater.on("error", (error) => {
    console.warn(`[kage] auto-update error: ${error.message}`);
  });

  const check = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.warn(`[kage] update check failed: ${error.message}`);
    });
  };

  check();
  setInterval(check, CHECK_INTERVAL_MS).unref();
}

module.exports = { startAutoUpdate, restartToUpdate, autoUpdateDisabled };
