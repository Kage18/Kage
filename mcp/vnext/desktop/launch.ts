// `kage app` — opening the desktop app from the command line.
//
// Two ways the app can exist, and the resolution has to try both rather than assume one. That
// single-path assumption is exactly what shipped a 404 portal in 4.0.0:
//
//   Installed  /Applications/Kage.app — opened with `open -a`, the way any Mac app is opened.
//   Source     platform/desktop/dist/main.js — run through the checkout's own Electron.
//
// Adding a repository on the way in is deliberately done through the SAME state file the app
// writes, not through a flag the app has to interpret. One writer, one format.

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { addRepo, loadState, saveState } from "./workspace.js";

export interface LaunchResult {
  ok: boolean;
  message: string;
  /** How the app was found, for a caller that wants to say so. */
  via?: "installed" | "source";
}

/** Where an installed Kage.app would be. */
export function installedAppPaths(): string[] {
  return ["/Applications/Kage.app", join(homedir(), "Applications", "Kage.app")];
}

/** The built shell inside a source checkout, relative to the compiled core (mcp/dist). */
export function sourceShellPaths(coreDir: string): { main: string; electron: string } {
  const repo = resolve(coreDir, "..", "..");
  return {
    main: join(repo, "platform", "desktop", "dist", "main.js"),
    electron: join(repo, "platform", "desktop", "node_modules", ".bin", "electron"),
  };
}

export interface LaunchOptions {
  /** Added to the watch list before the app opens. Null leaves the list untouched. */
  project_dir?: string | null;
  /** Seams for tests. */
  exists?: (path: string) => boolean;
  openInstalled?: (appPath: string) => void;
  runSource?: (electron: string, main: string) => void;
  home?: string;
}

export function openDesktopApp(options: LaunchOptions = {}): LaunchResult {
  const exists = options.exists ?? existsSync;
  const home = options.home ?? homedir();

  // Adding the repository BEFORE launching means the app opens already watching it, rather than
  // opening empty and needing a second action.
  if (options.project_dir) {
    const result = addRepo(loadState(home), options.project_dir);
    if (!result.ok) return { ok: false, message: `Kage cannot watch that path: ${result.error}` };
    saveState(home, result.state);
  }

  for (const appPath of installedAppPaths()) {
    if (!exists(appPath)) continue;
    const open = options.openInstalled ?? ((path: string) => {
      execFileSync("/usr/bin/open", ["-a", path], { stdio: "ignore" });
    });
    open(appPath);
    return { ok: true, via: "installed", message: `Opened ${appPath}` };
  }

  const source = sourceShellPaths(resolve(__dirname, "..", ".."));
  if (exists(source.main) && exists(source.electron)) {
    const run = options.runSource ?? ((electron: string, main: string) => {
      // Detached: the app outlives the shell that launched it, which is the whole point.
      spawn(electron, [main], { detached: true, stdio: "ignore" }).unref();
    });
    run(source.electron, source.main);
    return { ok: true, via: "source", message: "Opened the Kage app from this checkout." };
  }

  return {
    ok: false,
    message:
      "The Kage app is not installed and no built shell was found.\n" +
      "  From a checkout:  npm start --prefix platform/desktop\n" +
      "  To package it:    npm run dist:mac --prefix platform/desktop",
  };
}
