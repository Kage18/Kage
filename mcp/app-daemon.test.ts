import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ensureAppDaemon } from "./delegation/app-daemon.js";

function project(): string {
  return mkdtempSync(join(tmpdir(), "kage-appd-"));
}

/** Write the status file a running daemon would have left behind. */
function writeStatus(dir: string, status: { pid: number; host: string; rest_port: number }): void {
  const daemonDir = join(dir, ".agent_memory", "daemon");
  mkdirSync(daemonDir, { recursive: true });
  writeFileSync(
    join(daemonDir, "status.json"),
    JSON.stringify({ ok: true, project_dir: dir, viewer_port: 0, started_at: new Date(0).toISOString(), ...status }),
    "utf8",
  );
}

/** A stand-in daemon that answers /app exactly like the real one. */
async function serveApp(handler: (path: string) => number): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    res.writeHead(handler(req.url ?? "/"), { "content-type": "text/html" });
    res.end("<!doctype html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, port: (server.address() as AddressInfo).port };
}

test("a daemon that is alive AND serving /app is reused, never restarted", async () => {
  const dir = project();
  const { server, port } = await serveApp(() => 200);
  try {
    // process.pid is by definition alive, which is what makes this a live-daemon case.
    writeStatus(dir, { pid: process.pid, host: "127.0.0.1", rest_port: port });
    let spawned = 0;
    const result = await ensureAppDaemon(dir, { spawnFn: () => { spawned += 1; } });

    assert.equal(spawned, 0, "restarting a healthy daemon would kill the user's live runs");
    assert.equal(result.started, false);
    assert.equal(result.url, `http://127.0.0.1:${port}/app`);
    assert.equal(result.port, port);
  } finally {
    server.close();
  }
});

test("a live pid that does NOT serve /app is replaced — a live pid is not a live app", async () => {
  const dir = project();
  // Answers /health but 404s /app: exactly the older-build daemon that made `kage app`
  // open a dead page before this check existed.
  const { server, port } = await serveApp((path) => (path === "/health" ? 200 : 404));
  // A DISPOSABLE live process, not process.pid: this path SIGTERMs the stale daemon,
  // and naming the test runner as the stale daemon kills the test runner.
  const victim: ChildProcess = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
  try {
    writeStatus(dir, { pid: victim.pid!, host: "127.0.0.1", rest_port: port });
    const spawns: Array<{ command: string; args: string[] }> = [];
    await ensureAppDaemon(dir, { port: 4321, startupTimeoutMs: 200, spawnFn: (command, args) => spawns.push({ command, args }) }).catch(() => {
      // The fake spawn never brings a daemon up, so the wait times out — the assertion
      // under test is that a restart was ATTEMPTED, not that it succeeded.
    });
    assert.equal(spawns.length, 1, "a daemon that cannot serve /app must be replaced");
    assert.match(spawns[0].args.join(" "), /daemon start --project .* --port 4321/);
    // And it actually stopped the old one rather than leaving two daemons behind.
    assert.equal(victim.killed || victim.exitCode !== null || victim.signalCode !== null, true);
  } finally {
    try { victim.kill("SIGKILL"); } catch { /* already gone */ }
    server.close();
  }
});

test("no status file at all means start one, on the requested port", async () => {
  const dir = project();
  const spawns: string[][] = [];
  await ensureAppDaemon(dir, { port: 5544, startupTimeoutMs: 200, spawnFn: (_command, args) => spawns.push(args) }).catch(() => {});
  assert.equal(spawns.length, 1);
  assert.ok(spawns[0].includes("5544"));
  assert.ok(spawns[0].includes(dir));
  assert.ok(spawns[0][0].endsWith("cli.js"), "it must invoke the CLI entry, not a guessed path");
});

test("a stale status file pointing at a dead pid starts a fresh daemon", async () => {
  const dir = project();
  // A pid that cannot be running: pid 0 is never a normal process, and readDaemonStatus
  // treats a missing/zero pid as no daemon.
  writeStatus(dir, { pid: 0, host: "127.0.0.1", rest_port: 65000 });
  const spawns: string[][] = [];
  await ensureAppDaemon(dir, { startupTimeoutMs: 200, spawnFn: (_command, args) => spawns.push(args) }).catch(() => {});
  assert.equal(spawns.length, 1, "a dead pid must not stop the app from starting");
});

test("no explicit port means an ephemeral one is requested, never DEFAULT_APP_PORT", async () => {
  const dir = project();
  const spawns: string[][] = [];
  // No `port` in options — this is exactly the project-switching call: a new project's
  // daemon must never ask for the same fixed port the CURRENT daemon already holds.
  await ensureAppDaemon(dir, { startupTimeoutMs: 200, spawnFn: (_command, args) => spawns.push(args) }).catch(() => {});
  assert.equal(spawns.length, 1);
  assert.match(spawns[0].join(" "), /daemon start --project .* --port 0$/, "a fresh daemon with no requested port must ask the OS for one");
});

test("when the daemon never comes up, the error says how to see why", async () => {
  const dir = project();
  await assert.rejects(
    () => ensureAppDaemon(dir, { startupTimeoutMs: 200, spawnFn: () => {} }),
    // The message has to point somewhere useful; "failed" alone strands the user.
    /did not come up.*kage daemon start/s,
  );
});

test("the numeric second argument still works, so existing callers are unaffected", async () => {
  const dir = project();
  const { server, port } = await serveApp(() => 200);
  try {
    writeStatus(dir, { pid: process.pid, host: "127.0.0.1", rest_port: port });
    const result = await ensureAppDaemon(dir, port);
    assert.equal(result.started, false);
    assert.equal(result.url, `http://127.0.0.1:${port}/app`);
  } finally {
    server.close();
  }
});
