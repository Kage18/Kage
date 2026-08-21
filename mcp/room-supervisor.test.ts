import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  askRoomSupervisor,
  isRoomSupervisorLive,
  readRoomSupervisorRecord,
  roomSocketPath,
  roomSupervisorRecordPath,
} from "./delegation/room-supervisor.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-room-sup-"));
}

test("roomSocketPath is deterministic, bounded, and distinct per project", () => {
  const a = tempProject();
  const b = tempProject();
  assert.equal(roomSocketPath(a), roomSocketPath(a), "same project must hash to the same path every time");
  assert.notEqual(roomSocketPath(a), roomSocketPath(b));
  // Unix socket paths are capped around 104 bytes; the worker supervisor learned this
  // the hard way (a deep project path made `listen()` fail asynchronously). The room's
  // socket must stay short no matter how nested the project directory is.
  assert.ok(roomSocketPath(a).length < 100, `socket path too long: ${roomSocketPath(a)}`);
});

test("roomSocketPath stays short even under a very deeply nested project path", () => {
  const deep = join(tempProject(), "a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z");
  assert.ok(roomSocketPath(deep).length < 100);
});

test("readRoomSupervisorRecord is null with no file, and null on a torn file — never throws", () => {
  const project = tempProject();
  assert.equal(readRoomSupervisorRecord(project), null);

  const path = roomSupervisorRecordPath(project);
  mkdirSync(join(project, ".agent_memory", "room"), { recursive: true });
  writeFileSync(path, "not valid json{{{", "utf8");
  assert.equal(readRoomSupervisorRecord(project), null);

  writeFileSync(path, JSON.stringify({ pid: 123 }), "utf8"); // missing socket
  assert.equal(readRoomSupervisorRecord(project), null);

  writeFileSync(path, JSON.stringify({ pid: 123, socket: "/tmp/x.sock", started_at: "now" }), "utf8");
  const record = readRoomSupervisorRecord(project);
  assert.deepEqual(record, { pid: 123, socket: "/tmp/x.sock", started_at: "now" });
});

test("with no room supervisor running, askRoomSupervisor and isRoomSupervisorLive both report absence honestly", async () => {
  const project = tempProject();
  assert.equal(await askRoomSupervisor(project, "hello"), null);
  assert.equal(await isRoomSupervisorLive(project), false);
});
