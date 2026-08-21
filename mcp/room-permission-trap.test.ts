// The resumed-manager permission trap: a headless/pty room manager whose held session
// was spawned under an OLDER, smaller MANAGER_ALLOWED_TOOLS keeps running with that
// stale permission surface for the rest of its process life, because nothing ever
// re-spawns a live-and-healthy supervisor just because the code's allowlist changed.
// The manager then asks the user to "grant permission" for a tool that is, in the
// CURRENT code, already allowed — an instruction that can never be satisfied, since
// -p (and the pty's own headless launch) has no permission dialog anywhere in its path.
//
// Established empirically before writing this fix (not assumed): a real `claude -p
// --resume <id>` process DOES honor a freshly-passed --allowedTools, including a tool
// that was denied earlier in that exact same session, and including a brand-new MCP
// server introduced for the first time via --mcp-config on the resume call itself. See
// this run's claim for the three live experiments. That rules out "--resume silently
// discards --allowedTools" as the mechanism — the real bug is that a supervisor process,
// once alive, is never told to restart when the allowlist it was launched with goes
// stale, so resolveRoomResumeId below is what makes a FRESH spawn choose correctly, not
// a change to how --resume itself behaves.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  detectPermissionStuckMention,
  readRoomSessionId,
  readRoomSessionMeta,
  resolveRoomResumeId,
  roomPermissionDigest,
  roomSessionPath,
  writeRoomSessionId,
  writeRoomSessionMeta,
  type RoomSessionMeta,
} from "./delegation/room-supervisor.js";
import { MANAGER_ALLOWED_TOOLS } from "./delegation/manager-client.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-permission-trap-"));
}

function writeMcpConfig(project: string, serverNames: string[]): string {
  const path = join(project, "mcp-config.json");
  const mcpServers: Record<string, unknown> = {};
  for (const name of serverNames) mcpServers[name] = { type: "stdio", command: "node", args: [] };
  writeFileSync(path, JSON.stringify({ mcpServers }), "utf8");
  return path;
}

test("an unchanged permission surface still resumes — the regression that matters most: the thread must not restart on every message", () => {
  const project = tempProject();
  const configPath = writeMcpConfig(project, ["kage"]);
  const digest = roomPermissionDigest(configPath);

  const meta: RoomSessionMeta = { session_id: "session-abc", permission_digest: digest };
  const { resumeId, digestChanged } = resolveRoomResumeId(meta, digest);

  assert.equal(resumeId, "session-abc", "the same digest must keep resuming the held session");
  assert.equal(digestChanged, false);
});

test("a session with no stored digest yet (upgrading from an older session.json) still resumes — unknown is not treated as a change", () => {
  const project = tempProject();
  const configPath = writeMcpConfig(project, ["kage"]);
  const digest = roomPermissionDigest(configPath);

  const meta: RoomSessionMeta = { session_id: "session-abc" }; // no permission_digest field at all
  const { resumeId, digestChanged } = resolveRoomResumeId(meta, digest);

  assert.equal(resumeId, "session-abc");
  assert.equal(digestChanged, false);
});

test("a changed allowlist drops --resume and starts fresh — reverting resolveRoomResumeId to always-resume fails this test", () => {
  const project = tempProject();
  const configPath = writeMcpConfig(project, ["kage"]);
  const oldDigest = roomPermissionDigest(configPath);

  // Simulate MANAGER_ALLOWED_TOOLS having grown since this session was recorded: the
  // stored digest is stale relative to the digest a fresh spawn computes right now.
  const meta: RoomSessionMeta = { session_id: "session-abc", permission_digest: oldDigest };
  const currentDigest = "a-different-digest-entirely";
  const { resumeId, digestChanged } = resolveRoomResumeId(meta, currentDigest);

  assert.equal(resumeId, undefined, "a stale permission surface must never be resumed into");
  assert.equal(digestChanged, true);
});

test("roomPermissionDigest changes when the MCP server set changes, and is stable when it does not", () => {
  const project = tempProject();
  const onlyKage = roomPermissionDigest(writeMcpConfig(project, ["kage"]));
  const onlyKageAgain = roomPermissionDigest(writeMcpConfig(project, ["kage"]));
  const kageAndExtra = roomPermissionDigest(writeMcpConfig(project, ["kage", "extra"]));

  assert.equal(onlyKage, onlyKageAgain, "identical effective permission inputs must hash identically");
  assert.notEqual(onlyKage, kageAndExtra, "a changed MCP server set must change the digest");
});

test("roomPermissionDigest never throws on a missing or unreadable config file", () => {
  const project = tempProject();
  assert.doesNotThrow(() => roomPermissionDigest(join(project, "does-not-exist.json")));
});

test("the permission digest is written next to the session id and survives a round trip", () => {
  const project = tempProject();
  writeRoomSessionMeta(project, { session_id: "session-xyz", permission_digest: "deadbeef1234" }, "thread-a");

  const meta = readRoomSessionMeta(project, "thread-a");
  assert.equal(meta.session_id, "session-xyz");
  assert.equal(meta.permission_digest, "deadbeef1234");

  const onDisk = JSON.parse(readFileSync(roomSessionPath(project, "thread-a"), "utf8")) as RoomSessionMeta;
  assert.equal(onDisk.session_id, "session-xyz");
  assert.equal(onDisk.permission_digest, "deadbeef1234");
});

test("writeRoomSessionId (the existing, still-used call site) preserves an already-recorded digest instead of clobbering it", () => {
  const project = tempProject();
  writeRoomSessionMeta(project, { session_id: "session-old", permission_digest: "digest-1" }, "thread-b");

  writeRoomSessionId(project, "session-new", "thread-b");

  const meta = readRoomSessionMeta(project, "thread-b");
  assert.equal(meta.session_id, "session-new", "the id itself must still update");
  assert.equal(meta.permission_digest, "digest-1", "the digest must survive an id-only write");
  assert.equal(readRoomSessionId(project, "thread-b"), "session-new", "the old accessor keeps working unchanged");
});

test("detectPermissionStuckMention fires on the exact real-world phrasing, naming an already-allowed tool", () => {
  const stuck =
    "The kage_goal_create call needs your approval - please grant permission when prompted so I can open the goal and dispatch Wave 1.";
  assert.equal(detectPermissionStuckMention(stuck), "kage_goal_create");
});

test("detectPermissionStuckMention fires on the fully-qualified mcp__kage__ tool name too", () => {
  const stuck = "I need you to grant permission for mcp__kage__kage_dispatch before I can continue.";
  assert.equal(detectPermissionStuckMention(stuck), "kage_dispatch");
});

test("detectPermissionStuckMention does not fire on ordinary prose, even prose that mentions permission in passing", () => {
  assert.equal(detectPermissionStuckMention("Dispatched wave 1, no permission needed here."), null);
  assert.equal(detectPermissionStuckMention("Wave 1 is running; I'll report back when it's done."), null);
});

test("detectPermissionStuckMention does not fire when the named tool is genuinely outside the manager's allowlist — that denial is correct, not stuck", () => {
  const genuinelyDenied =
    "I don't have permission to use mcp__mini__test_tool right now — the call was denied. You'd need to grant permission for this tool before I can run it.";
  assert.equal(detectPermissionStuckMention(genuinelyDenied), null);
});

test("every tool MANAGER_ALLOWED_TOOLS grants is detectable by its bare name — the safety net covers the whole surface, not just kage_goal_create", () => {
  for (const fullName of MANAGER_ALLOWED_TOOLS) {
    const bareName = fullName.replace("mcp__kage__", "");
    const text = `The ${bareName} call needs your approval - please grant permission when prompted.`;
    assert.equal(detectPermissionStuckMention(text), bareName, `${bareName} must be detected`);
  }
});
