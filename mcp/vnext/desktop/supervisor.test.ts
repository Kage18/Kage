import test from "node:test";
import assert from "node:assert/strict";

import { DaemonSupervisor, daemonCommand, type SpawnedProcess, type SupervisorDeps } from "./supervisor.js";

interface Recorder {
  deps: SupervisorDeps;
  spawns: Array<{ command: string; args: string[]; cwd: string }>;
  killed: string[];
}

/** A supervisor whose world is entirely fake: nothing is spawned, nothing is probed over TCP. */
function harness(options: { listensAfter?: number; spawnThrows?: string } = {}): Recorder {
  const spawns: Recorder["spawns"] = [];
  const killed: string[] = [];
  let probes = 0;
  const listensAfter = options.listensAfter ?? 0;

  const deps: SupervisorDeps = {
    spawn(command, args, cwd) {
      if (options.spawnThrows) throw new Error(options.spawnThrows);
      spawns.push({ command, args, cwd });
      const pid = 1000 + spawns.length;
      const child: SpawnedProcess = {
        pid,
        kill: (signal) => killed.push(`${pid}:${signal ?? "SIGTERM"}`),
      };
      return child;
    },
    async probe() {
      probes += 1;
      return probes > listensAfter;
    },
    async wait() { /* time does not pass in a test */ },
  };
  return { deps, spawns, killed };
}

function supervisor(rec: Recorder): DaemonSupervisor {
  return new DaemonSupervisor(rec.deps, "/usr/local/bin/node", "/opt/kage/dist/cli.js");
}

test("the daemon is started on the system Node with the repository passed explicitly", () => {
  const { command, args } = daemonCommand("/usr/local/bin/node", "/opt/kage/dist/cli.js", "/repo", 3141);
  assert.equal(command, "/usr/local/bin/node", "not Electron's bundled Node — it has no node:sqlite");
  assert.deepEqual(args, ["/opt/kage/dist/cli.js", "viewer", "--project", "/repo", "--port", "3141"]);
});

test("a daemon reports running only once the port actually accepts", async () => {
  const rec = harness({ listensAfter: 3 });
  const status = await supervisor(rec).start("/repo", 3141);
  assert.equal(status.state, "running");
  assert.equal(status.port, 3141);
  assert.ok(status.pid);
});

// Two daemons over one `.agent_memory` are not a duplicate, they are two writers. The app calls
// start() on launch, on add and on switch, so idempotence is the normal path, not an edge case.
test("starting an already-running repository spawns nothing new", async () => {
  const rec = harness();
  const sup = supervisor(rec);
  await sup.start("/repo", 3141);
  await sup.start("/repo", 3141);
  assert.equal(rec.spawns.length, 1, "one repository, one daemon");
});

test("a port already serving another repository is refused, not quietly reused", async () => {
  const rec = harness();
  const sup = supervisor(rec);
  await sup.start("/repo-a", 3141);
  const clash = await sup.start("/repo-b", 3141);
  assert.equal(clash.state, "failed");
  assert.match(clash.detail!, /already serving another repository/);
  assert.equal(rec.spawns.length, 1, "the second daemon was never spawned");
});

// Spawning is not serving. Reporting running too early loads the window against a socket that is
// not there and shows a blank shell.
test("a daemon that never listens is failed AND killed, so the port does not leak", async () => {
  const rec = harness({ listensAfter: Number.POSITIVE_INFINITY });
  const status = await supervisor(rec).start("/repo", 3141);
  assert.equal(status.state, "failed");
  assert.match(status.detail!, /did not accept connections/);
  assert.equal(rec.killed.length, 1, "the unresponsive child was terminated");
});

test("a repository whose daemon failed to start can be started again", async () => {
  const rec = harness({ listensAfter: Number.POSITIVE_INFINITY });
  const sup = supervisor(rec);
  await sup.start("/repo", 3141);
  // The failed attempt must not have left the repo registered as running, or a retry is impossible.
  const retry = await sup.start("/repo", 3141);
  assert.equal(rec.spawns.length, 2, "a retry actually retries");
  assert.equal(retry.state, "failed");
});

test("a spawn that throws is reported with its reason rather than crashing the app", async () => {
  const rec = harness({ spawnThrows: "ENOENT: node not found on PATH" });
  const status = await supervisor(rec).start("/repo", 3141);
  assert.equal(status.state, "failed");
  assert.match(status.detail!, /node not found on PATH/);
});

test("stopping kills the child and reports stopped", async () => {
  const rec = harness();
  const sup = supervisor(rec);
  await sup.start("/repo", 3141);
  sup.stop("/repo");
  assert.equal(rec.killed.length, 1);
  assert.equal(sup.statusFor("/repo")!.state, "stopped");
});

test("stopping something that was never started is a no-op, not a crash", () => {
  const rec = harness();
  supervisor(rec).stop("/never-started");
  assert.equal(rec.killed.length, 0);
});

// A daemon outliving the window is a process nobody can find to kill.
test("quitting stops every daemon", async () => {
  const rec = harness();
  const sup = supervisor(rec);
  await sup.start("/repo-a", 3141);
  await sup.start("/repo-b", 3142);
  sup.stopAll();
  assert.equal(rec.killed.length, 2);
  assert.equal(sup.all().filter((s) => s.state === "stopped").length, 2);
});

test("several repositories run side by side on their own ports", async () => {
  const rec = harness();
  const sup = supervisor(rec);
  await sup.start("/repo-a", 3141);
  await sup.start("/repo-b", 3142);
  await sup.start("/repo-c", 3143);
  const ports = sup.all().map((s) => s.port);
  assert.equal(new Set(ports).size, 3);
  assert.equal(sup.all().every((s) => s.state === "running"), true);
});
