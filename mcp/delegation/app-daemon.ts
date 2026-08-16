// Ensuring a project has a live app daemon.
//
// This was inline in `kage app`, which was fine while exactly one surface needed it.
// The projects sidebar needs the same thing — switching to another project means
// pointing the window at THAT project's daemon — and a second copy of "is it alive,
// is it current, else restart it" would drift from the first. Law 4: orchestration
// logic lives in a shared module, never in one surface's code.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

import { readDaemonStatus } from "../daemon.js";

export const DEFAULT_APP_PORT = 3111;

function pidAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * A live pid is not a live APP: a daemon from an older build answers /health but 404s
 * /app, and trusting it sends the user to a dead page. Probe the route we are about to
 * open, never merely the process.
 */
async function servesApp(host: string, port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}/app`, { signal: AbortSignal.timeout(2000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

function cliEntry(): string {
  // dist/delegation/app-daemon.js → dist/cli.js
  return join(dirname(__dirname), "cli.js");
}

export interface EnsureAppResult {
  url: string;
  host: string;
  port: number;
  /** True when this call had to start or restart the daemon. */
  started: boolean;
}

/**
 * Return a URL that is serving /app for `projectDir`, starting a detached daemon if
 * there isn't one. Detached matters: the daemon must outlive whatever asked for it —
 * a CLI invocation that returns, or an HTTP request that ends.
 */
export async function ensureAppDaemon(projectDir: string, port = DEFAULT_APP_PORT): Promise<EnsureAppResult> {
  let status = readDaemonStatus(projectDir);
  let healthy = Boolean(status) && pidAlive(status!.pid) && (await servesApp(status!.host, status!.rest_port));
  let started = false;

  if (!healthy) {
    if (status && pidAlive(status.pid)) {
      // Predates the app routes — replace it rather than opening a dead page.
      try {
        process.kill(status.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
      await new Promise((pause) => setTimeout(pause, 500));
    }
    const child = spawn(
      process.execPath,
      [cliEntry(), "daemon", "start", "--project", projectDir, "--port", String(port)],
      { detached: true, stdio: "ignore" },
    );
    child.unref();
    started = true;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      status = readDaemonStatus(projectDir);
      if (status && pidAlive(status.pid) && (await servesApp(status.host, status.rest_port))) {
        healthy = true;
        break;
      }
      await new Promise((pause) => setTimeout(pause, 250));
    }
  }

  if (!healthy || !status) {
    throw new Error("The daemon did not come up within 15s — try `kage daemon start` in the foreground to see why.");
  }
  return {
    url: `http://${status.host}:${status.rest_port}/app`,
    host: status.host,
    port: status.rest_port,
    started,
  };
}
