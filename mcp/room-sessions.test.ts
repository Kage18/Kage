import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  DEFAULT_SESSION,
  closeRoomSession,
  createRoomSession,
  listRoomSessions,
  normalizeSessionKey,
  renameRoomSession,
  roomDirFor,
} from "./delegation/room-sessions.js";
import { appendRoomTurn, readRoomHistory, roomHistoryPath } from "./delegation/room-history.js";
import { roomSessionPath, roomSocketPath } from "./delegation/room-supervisor.js";
import { roomPtySocketPath } from "./delegation/room-pty.js";

function project(): string {
  return mkdtempSync(join(tmpdir(), "kage-threads-"));
}

test("the default thread keeps the historical flat layout, so no install has to migrate", () => {
  const dir = project();
  assert.equal(roomDirFor(dir), join(dir, ".agent_memory", "room"));
  assert.equal(roomDirFor(dir, DEFAULT_SESSION), join(dir, ".agent_memory", "room"));
  assert.equal(roomHistoryPath(dir), join(dir, ".agent_memory", "room", "history.json"));
  assert.equal(roomSessionPath(dir), join(dir, ".agent_memory", "room", "session.json"));
});

test("the default thread's sockets keep their original digests, so upgrading never orphans a live manager", () => {
  const dir = project();
  // These are the exact seeds the code used before threads existed. If this test has to
  // change, a running supervisor somewhere is about to look dead and be respawned
  // underneath a conversation in progress.
  const structured = createHash("sha256").update(`${resolve(dir)}\0__room__`).digest("hex").slice(0, 16);
  const pty = createHash("sha256").update(`${resolve(dir)}\0__room_pty__`).digest("hex").slice(0, 16);
  assert.equal(roomSocketPath(dir), join(tmpdir(), `kage-room-${structured}.sock`));
  assert.equal(roomPtySocketPath(dir), join(tmpdir(), `kage-room-pty-${pty}.sock`));
});

test("two threads never share a socket, a directory, or a transcript", () => {
  const dir = project();
  assert.notEqual(roomSocketPath(dir, "thread-2"), roomSocketPath(dir, "thread-3"));
  assert.notEqual(roomSocketPath(dir, "thread-2"), roomSocketPath(dir));
  assert.notEqual(roomPtySocketPath(dir, "thread-2"), roomPtySocketPath(dir));
  assert.notEqual(roomDirFor(dir, "thread-2"), roomDirFor(dir, "thread-3"));

  appendRoomTurn(dir, { role: "you", text: "about the refactor" });
  appendRoomTurn(dir, { role: "you", text: "about the flaky test" }, "thread-2");
  assert.deepEqual(readRoomHistory(dir).map((t) => t.text), ["about the refactor"]);
  assert.deepEqual(readRoomHistory(dir, "thread-2").map((t) => t.text), ["about the flaky test"]);
});

test("keys are normalized into something safe to put in a path or socket name", () => {
  assert.equal(normalizeSessionKey("Thread Two!"), "thread-two");
  assert.equal(normalizeSessionKey("../../etc/passwd"), "etc-passwd");
  assert.equal(normalizeSessionKey(""), DEFAULT_SESSION);
  assert.equal(normalizeSessionKey(undefined), DEFAULT_SESSION);
  assert.equal(normalizeSessionKey("x".repeat(200)).length, 32);
});

test("a project always lists at least the default thread, even before anything is written", () => {
  const dir = project();
  const sessions = listRoomSessions(dir);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].key, DEFAULT_SESSION);
});

test("creating, renaming and closing threads", () => {
  const dir = project();
  const created = createRoomSession(dir, "Flaky test hunt");
  assert.equal(created.title, "Flaky test hunt");
  assert.equal(listRoomSessions(dir).length, 2);

  renameRoomSession(dir, created.key, "Renamed");
  assert.equal(listRoomSessions(dir).find((s) => s.key === created.key)?.title, "Renamed");

  appendRoomTurn(dir, { role: "you", text: "hello" }, created.key);
  assert.ok(existsSync(roomDirFor(dir, created.key)), "the thread has its own directory");

  const left = closeRoomSession(dir, created.key);
  assert.equal(left.length, 1);
  assert.ok(!existsSync(roomDirFor(dir, created.key)), "closing a thread takes its transcript with it");
});

test("the default thread cannot be closed — the app must always have somewhere to land", () => {
  const dir = project();
  appendRoomTurn(dir, { role: "you", text: "keep me" });
  assert.throws(() => closeRoomSession(dir, DEFAULT_SESSION), /cannot be closed/);
  assert.deepEqual(readRoomHistory(dir).map((t) => t.text), ["keep me"], "and its transcript is untouched");
  assert.ok(existsSync(roomDirFor(dir)));
});
