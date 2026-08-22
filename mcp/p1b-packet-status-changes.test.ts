// P1b: packet status changes (supersede, stale, reverify, gc's deprecate)
// become append-only. Today they rewrite a packet's frontmatter in place --
// the rewrite class that merge-conflicts the moment two branches touch the
// same packet. This file is new behaviour (repo rule: mcp/delegation.test.ts
// is off-limits, new behaviour gets its own file).
//
// REVERT CHECK: "supersede leaves both packet files byte-identical" fails if
// supersedeMemory in mcp/kernel.ts goes back to writeJson(oldEntry.path, ...)
// / writeJson(replacementEntry.path, ...) for the status transition -- the
// raw file snapshot taken before the call would no longer match the one taken
// after. "two branches' journal appends merge without conflict" fails the
// same way if reverify/stale/supersede go back to rewriting packet files,
// since two branches editing the same packet's frontmatter is exactly the
// conflict this change removes.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  capture,
  ensureJournalMergeAttributes,
  gcProject,
  loadApprovedPackets,
  packetsDir,
  refreshProject,
  reverifyMemory,
  supersedeMemory,
} from "./kernel.js";
import { migratePacketsToOkf, okfBundleDir, okfConceptFileName } from "./okf.js";
import { appendJournalEvent, applyJournalOverlay, journalDir, loadJournalEvents } from "./store/journal.js";

if (!process.env.KAGE_HOME) process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-p1b-test-home-"));

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-p1b-"));
  execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  mkdirSync(join(dir, "src"), { recursive: true });
  return dir;
}

const gitIdentityEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function commitAll(project: string, message: string): void {
  execFileSync("git", ["add", "."], { cwd: project, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", message], { cwd: project, stdio: "ignore", env: gitIdentityEnv });
}

function packetFilePath(project: string, id: string): string {
  const name = readdirSync(packetsDir(project)).find((f) => readFileSync(join(packetsDir(project), f), "utf8").includes(id))!;
  return join(packetsDir(project), name);
}

test("supersede leaves both packet files byte-identical and records one journal event", () => {
  const project = tempProject();
  writeFileSync(join(project, "src", "checkout.ts"), "export const checkout = 1;\n", "utf8");
  const oldPacket = capture({
    projectDir: project,
    title: "Old checkout retry note",
    body: "Old note says checkout retry logic can be merged.",
    type: "decision",
    paths: ["src/checkout.ts"],
  });
  const replacement = capture({
    projectDir: project,
    title: "Checkout retry split decision",
    body: "Callback retries use idempotency keys, checkout retries use session state. Do not merge.",
    type: "decision",
    paths: ["src/checkout.ts"],
  });
  assert.ok(oldPacket.packet && replacement.packet);
  commitAll(project, "seed packets");

  const oldPath = packetFilePath(project, oldPacket.packet!.id);
  const replacementPath = packetFilePath(project, replacement.packet!.id);
  const oldBefore = readFileSync(oldPath, "utf8");
  const replacementBefore = readFileSync(replacementPath, "utf8");

  const result = supersedeMemory(project, oldPacket.packet!.id, replacement.packet!.id, "Newer debugging proved the paths must stay separate.");
  assert.equal(result.ok, true);

  // The whole point: neither packet file was rewritten for the status change.
  assert.equal(readFileSync(oldPath, "utf8"), oldBefore);
  assert.equal(readFileSync(replacementPath, "utf8"), replacementBefore);

  // Yet the overlay reports the transition correctly...
  const active = loadApprovedPackets(project);
  assert.equal(active.some((p) => p.id === oldPacket.packet!.id), false);
  const overlaidOld = applyJournalOverlay(
    [oldPacket.packet!],
    loadJournalEvents(project),
  )[0];
  assert.equal(overlaidOld.status, "superseded");
  assert.equal(overlaidOld.quality.superseded_by, replacement.packet!.id);

  // ...because exactly one event landed in the journal.
  const events = loadJournalEvents(project).filter((e) => e.packet_id === oldPacket.packet!.id);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "superseded");
  assert.equal(events[0].replacement_packet_id, replacement.packet!.id);
});

test("stale flip and reverify travel through the journal; the packet file never changes", () => {
  const project = tempProject();
  writeFileSync(join(project, "src", "lib.ts"), "export const v = 1;\n", "utf8");
  const captured = capture({
    projectDir: project,
    title: "lib.ts holds the version constant",
    body: "lib.ts holds the version constant used across the app.",
    type: "reference",
    paths: ["src/lib.ts"],
    allowLowQuality: true,
  });
  assert.ok(captured.packet);
  const id = captured.packet!.id;
  commitAll(project, "seed packet");
  const path = packetFilePath(project, id);
  const baseline = readFileSync(path, "utf8");

  writeFileSync(join(project, "src", "lib.ts"), "export const v = 2;\n", "utf8");
  refreshProject(project);
  assert.equal(readFileSync(path, "utf8"), baseline, "stale flip must not rewrite the packet file");
  assert.equal(loadApprovedPackets(project).find((p) => p.id === id)?.quality.stale, true);

  const reverify = reverifyMemory(project, id);
  assert.equal(reverify.ok, true, JSON.stringify(reverify.errors));
  assert.equal(readFileSync(path, "utf8"), baseline, "reverify must not rewrite the packet file");
  const overlaid = loadApprovedPackets(project).find((p) => p.id === id)!;
  assert.equal(overlaid.quality.stale === true, false);
  assert.equal(typeof overlaid.quality.reverified_at, "string");
});

test("gc deprecates through the journal; the packet file stays byte-identical", () => {
  const project = tempProject();
  const captured = capture({
    projectDir: project,
    title: "Removed helper runbook",
    body: "Run tests with npm test after changing the removed helper.",
    type: "runbook",
    paths: ["src/removed-helper.ts"],
  });
  assert.ok(captured.packet);
  commitAll(project, "seed packet");
  const path = packetFilePath(project, captured.packet!.id);
  const baseline = readFileSync(path, "utf8");

  const gc = gcProject(project);
  assert.equal(gc.deprecated.some((p) => p.id === captured.packet!.id), true);
  assert.equal(readFileSync(path, "utf8"), baseline);
  assert.equal(loadApprovedPackets(project).some((p) => p.id === captured.packet!.id), false);

  const events = loadJournalEvents(project).filter((e) => e.packet_id === captured.packet!.id);
  assert.equal(events.some((e) => e.kind === "deprecated"), true);
});

test("applyJournalOverlay is order-independent for different packets and last-write-wins for the same packet", () => {
  const packetA = {
    schema_version: 2 as const, id: "a", title: "A", summary: "", body: "", type: "decision" as const,
    scope: "repo" as const, visibility: "team" as const, sensitivity: "internal" as const, status: "approved" as const,
    confidence: 1, tags: [], paths: [], stack: [], source_refs: [], freshness: {}, edges: [], quality: {},
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  };
  const packetB = { ...packetA, id: "b", title: "B" };

  const events = [
    { id: "e1", at: "2026-08-01T00:00:00.000Z", packet_id: "a", kind: "stale" as const, stale_reasons: ["from-e1"] },
    { id: "e2", at: "2026-08-02T00:00:00.000Z", packet_id: "b", kind: "deprecated" as const },
    // A later event for the SAME packet ("a") as e1 -- must win regardless of array order.
    { id: "e3", at: "2026-08-01T12:00:00.000Z", packet_id: "a", kind: "stale" as const, stale_reasons: ["from-e3"] },
  ];

  const forward = applyJournalOverlay([packetA, packetB], events);
  const shuffled = applyJournalOverlay([packetA, packetB], [events[2], events[0], events[1]]);
  const reversed = applyJournalOverlay([packetA, packetB], [...events].reverse());

  assert.deepEqual(forward, shuffled);
  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward[0].quality.stale_reasons, ["from-e3"], "later event (e3) wins over e1 for packet a");
  assert.equal(forward[1].status, "deprecated");
});

test("two branches append journal events for the same packet and merge cleanly via git; overlay applies last-write-wins", () => {
  const project = tempProject();
  writeFileSync(join(project, "src", "retry.ts"), "export const retryMode = 1;\n", "utf8");
  const captured = capture({
    projectDir: project,
    title: "Retry mode note",
    body: "Retry mode note describing how retries behave.",
    type: "decision",
    paths: ["src/retry.ts"],
  });
  assert.ok(captured.packet);
  const id = captured.packet!.id;
  // Wire the union merge driver (what a real repo gets from `kage init`) so two
  // branches appending different lines to the same monthly journal file combine
  // instead of hitting git's default "ambiguous insertion point" conflict.
  ensureJournalMergeAttributes(project);
  // Seed the journal file on main first (a real repo's journal is a tracked,
  // already-committed file by the time two branches diverge and append to it
  // concurrently) so the two branches below are appending to a SHARED file
  // with common history, not independently creating the same new path.
  appendJournalEvent(project, { at: "2026-07-01T00:00:00.000Z", packet_id: id, kind: "reverified", refreshed_paths: ["src/retry.ts"] });
  commitAll(project, "seed packet and journal");
  execFileSync("git", ["branch", "-M", "main"], { cwd: project, stdio: "ignore" });

  // Two branches diverge from main and each append one event for the SAME
  // packet, into the SAME monthly journal file -- the exact shape that would
  // conflict under a rewrite-in-place design.
  execFileSync("git", ["checkout", "-b", "wave-1"], { cwd: project, stdio: "ignore" });
  appendJournalEvent(project, { at: "2026-08-01T00:00:00.000Z", packet_id: id, kind: "stale", stale_reasons: ["wave-1 reason"] });
  commitAll(project, "wave-1: mark stale");

  execFileSync("git", ["checkout", "main"], { cwd: project, stdio: "ignore" });
  execFileSync("git", ["checkout", "-b", "wave-2"], { cwd: project, stdio: "ignore" });
  appendJournalEvent(project, { at: "2026-08-01T01:00:00.000Z", packet_id: id, kind: "stale", stale_reasons: ["wave-2 reason (later)"] });
  commitAll(project, "wave-2: mark stale differently");

  execFileSync("git", ["checkout", "main"], { cwd: project, stdio: "ignore" });
  execFileSync("git", ["merge", "--no-edit", "wave-1"], { cwd: project, stdio: "ignore", env: gitIdentityEnv });
  // The second merge is the real test: two branches both appended to the same
  // file. This must not conflict.
  execFileSync("git", ["merge", "--no-edit", "wave-2"], { cwd: project, stdio: "ignore", env: gitIdentityEnv });

  const journalFile = readdirSync(journalDir(project)).find((f) => f.endsWith(".jsonl"))!;
  const journalContent = readFileSync(join(journalDir(project), journalFile), "utf8");
  assert.ok(!journalContent.includes("<<<<<<<"), "journal file must not contain git conflict markers");

  const events = loadJournalEvents(project).filter((e) => e.packet_id === id);
  assert.equal(events.length, 3, "the seed event plus both branches' events survive the merge");

  const overlaid = loadApprovedPackets(project).find((p) => p.id === id)!;
  assert.equal(overlaid.quality.stale, true);
  assert.deepEqual(overlaid.quality.stale_reasons, ["wave-2 reason (later)"], "the later timestamp wins regardless of merge order");
});

test("OKF export reflects the journal overlay, not just the packet's on-disk baseline", () => {
  const project = tempProject();
  writeFileSync(join(project, "src", "lib.ts"), "export const v = 1;\n", "utf8");
  const captured = capture({
    projectDir: project,
    title: "lib.ts version constant note",
    body: "lib.ts holds the version constant used across the app.",
    type: "reference",
    paths: ["src/lib.ts"],
    allowLowQuality: true,
  });
  assert.ok(captured.packet);
  const id = captured.packet!.id;
  commitAll(project, "seed packet");

  writeFileSync(join(project, "src", "lib.ts"), "export const v = 2;\n", "utf8");
  refreshProject(project);
  const reverify = reverifyMemory(project, id);
  assert.equal(reverify.ok, true, JSON.stringify(reverify.errors));

  const overlaid = loadApprovedPackets(project).find((p) => p.id === id)!;
  const migration = migratePacketsToOkf(project);
  assert.equal(migration.written >= 1, true);
  const exportedPath = join(okfBundleDir(project), "reference", okfConceptFileName(overlaid));
  const exportedText = readFileSync(exportedPath, "utf8");
  assert.ok(
    exportedText.includes(String(overlaid.freshness.last_verified_at)),
    "exported OKF concept must carry the reverified timestamp from the journal overlay, not the stale baseline",
  );
});
