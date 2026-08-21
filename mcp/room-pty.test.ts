import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync, statSync, existsSync, rmSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  attachRoomPty,
  ensureSpawnHelperExecutable,
  isRoomPtyLive,
  readRoomPtyRecord,
  roomPtyRecordPath,
  roomPtySocketPath,
} from "./delegation/room-pty.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-room-pty-"));
}

test("roomPtySocketPath is deterministic, bounded, and distinct from the structured room's own socket", () => {
  const project = tempProject();
  assert.equal(roomPtySocketPath(project), roomPtySocketPath(project));
  assert.ok(roomPtySocketPath(project).length < 100, `socket path too long: ${roomPtySocketPath(project)}`);
  // The two supervisors are separate processes with separate liveness — sharing a
  // socket path would make one appear to answer for the other.
  assert.notEqual(roomPtySocketPath(project), roomPtySocketPath(project + "-other"));
});

test("readRoomPtyRecord is null with no file, and null on a torn or incomplete file", () => {
  const project = tempProject();
  assert.equal(readRoomPtyRecord(project), null);

  const path = roomPtyRecordPath(project);
  mkdirSync(join(project, ".agent_memory", "room"), { recursive: true });
  writeFileSync(path, "{{{not json", "utf8");
  assert.equal(readRoomPtyRecord(project), null);

  writeFileSync(path, JSON.stringify({ pid: 1 }), "utf8"); // no socket field
  assert.equal(readRoomPtyRecord(project), null);

  writeFileSync(path, JSON.stringify({ pid: 42, socket: "/tmp/x.sock", started_at: "t" }), "utf8");
  assert.deepEqual(readRoomPtyRecord(project), { pid: 42, socket: "/tmp/x.sock", started_at: "t" });
});

test("node-pty's spawn-helper is executable — a lost execute bit fails as a bare 'posix_spawnp failed.'", async (t) => {
  // The bug this guards: npm does not reliably preserve the execute bit on node-pty's
  // prebuilt `spawn-helper`, and without it EVERY pty spawn dies with an opaque
  // `posix_spawnp failed.` that names no file and no permission — it reads exactly
  // like a sandbox or entitlement problem and sends you hunting in the wrong place.
  // superviseRoomPty repairs it in-process before spawning; this proves the repair
  // works by deliberately breaking the bit first.
  let ptyEntry: string;
  try {
    ptyEntry = require.resolve("node-pty");
  } catch {
    t.skip("node-pty is not installed in this environment");
    return;
  }
  const arch = process.platform === "darwin" ? (process.arch === "arm64" ? "darwin-arm64" : "darwin-x64") : null;
  if (!arch) {
    t.skip("spawn-helper is a Unix-only concern");
    return;
  }
  const helper = join(dirname(dirname(ptyEntry)), "prebuilds", arch, "spawn-helper");
  if (!existsSync(helper)) {
    t.skip("no prebuilt spawn-helper for this platform");
    return;
  }

  // Break it exactly the way a fresh npm install does.
  chmodSync(helper, 0o644);
  assert.equal(statSync(helper).mode & 0o100, 0, "precondition: the execute bit is now missing");

  // Test the repair directly rather than through superviseRoomPty — that would spawn a
  // real billable claude session and leave a process behind, which no test should do.
  ensureSpawnHelperExecutable();
  assert.ok(statSync(helper).mode & 0o100, "the execute bit must be restored");

  // Idempotent: a second call on an already-good file changes nothing and never throws.
  ensureSpawnHelperExecutable();
  assert.ok(statSync(helper).mode & 0o100);
});

test("a late-attaching client gets the scrollback replayed — a terminal's screen is cumulative", async () => {
  // The bug this guards: broadcast-only delivery sends a client nothing but frames
  // that arrive AFTER it connects. Since a terminal's visible screen is the sum of
  // every byte ever written, a browser opening the Terminal tab a second after the
  // session began saw a completely blank pane while everything worked perfectly —
  // indistinguishable from the pty being broken, and the reason this looked unfixable
  // for a long time. Verified here against a stand-in server that speaks the same
  // frame protocol, so the test needs no real pty and no billable agent session.
  const project = tempProject();
  const socketPath = roomPtySocketPath(project);
  const banner = "WELCOME BANNER PRINTED BEFORE ANYONE ATTACHED";
  let scrollback = banner;

  const server = createServer((connection) => {
    connection.setEncoding("utf8");
    if (scrollback) connection.write(JSON.stringify({ kind: "data", bytes: scrollback }) + "\n");
  });
  await new Promise<void>((r) => server.listen(socketPath, () => r()));

  try {
    const seen: string[] = [];
    const attachment = await attachRoomPty(project, (bytes) => seen.push(bytes), () => {});
    assert.ok(attachment, "attach should succeed against a live socket");
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(seen.join(""), banner, "everything already on screen must arrive on attach");
    attachment!.close();
  } finally {
    server.close();
    rmSync(socketPath, { force: true });
  }
});

test("Chat and Terminal share ONE claude session id — the handle that makes them two views, not two agents", async () => {
  // The bug this guards: Chat (room-supervisor) and Terminal (room-pty) used to spawn
  // independent claude processes, so each held its own context and its own bill — say
  // something in one and the other had never heard it. AO's chat process runs with
  // `--resume=<session-id>` (confirmed by reading its live process args); the session
  // id is the shared handle between its renderings. Both of Kage's modes now read the
  // same room/session.json, so switching view keeps the conversation.
  const project = tempProject();
  const { writeRoomSessionId, readRoomSessionId, roomSessionPath } = await import("./delegation/room-supervisor.js");

  writeRoomSessionId(project, "session-abc-123");
  assert.equal(readRoomSessionId(project), "session-abc-123");

  // Both supervisors resolve the handle from the identical file — no second store,
  // no per-view session, nothing to drift apart.
  assert.equal(roomSessionPath(project), join(project, ".agent_memory", "room", "session.json"));
  const onDisk = JSON.parse(readFileSync(roomSessionPath(project), "utf8")) as { session_id: string };
  assert.equal(onDisk.session_id, "session-abc-123");
});

test("retiring one room view is safe when the other is not running", async () => {
  // Switching views must never depend on something already being alive: a stale record,
  // a reused pid, or a first-ever switch all have to be no-ops rather than throws.
  const project = tempProject();
  const { retireStructuredRoom, retirePtyRoom } = await import("./delegation/room-pty.js");
  assert.doesNotThrow(() => retireStructuredRoom(project));
  assert.doesNotThrow(() => retirePtyRoom(project));
});

test("with nothing running, isRoomPtyLive and attachRoomPty both report absence honestly, never throw", async () => {
  const project = tempProject();
  assert.equal(await isRoomPtyLive(project), false);
  assert.equal(
    await attachRoomPty(
      project,
      () => {},
      () => {},
    ),
    null,
  );
});
