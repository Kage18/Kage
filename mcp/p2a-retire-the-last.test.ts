// P2a: retire the last in-place packet mutator -- kage compact
// (compactProject in mcp/kernel.ts) still rewrote packet frontmatter in
// place for hard-stale deprecation and dead-citation pruning, the one
// mutation class P1b's journal migration (supersede/stale/reverify/gc) left
// out of scope. This file proves compact now routes both transitions
// through the same append-only journal (mcp/store/journal.ts) instead.
//
// REVERT CHECK: "compact deprecates and prunes citations through the
// journal; the packets directory is byte-identical before and after" fails
// if compactProject in mcp/kernel.ts goes back to writePacketToDisk(path, ...)
// / writeJson(path, ...) for either transition -- the directory snapshot
// taken before compact would no longer match the one taken after.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { capture, compactProject, loadApprovedPackets, packetsDir } from "./kernel.js";
import { loadJournalEvents } from "./store/journal.js";

if (!process.env.KAGE_HOME) process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-p2a-test-home-"));

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-p2a-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  return dir;
}

function snapshotDir(dir: string): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    snapshot[name] = readFileSync(join(dir, name), "utf8");
  }
  return snapshot;
}

test("compact deprecates and prunes citations through the journal; the packets directory is byte-identical before and after", () => {
  const project = tempProject();
  writeFileSync(join(project, "src", "a.ts"), "export const a = 1;\n", "utf8");
  writeFileSync(join(project, "src", "b.ts"), "export const b = 1;\n", "utf8");
  const partial = capture({
    projectDir: project,
    title: "Partial cite compact note",
    body: "Touches src/a.ts and src/b.ts together for the compact citation-prune path.",
    type: "decision",
    paths: ["src/a.ts", "src/b.ts"],
  });
  const gone = capture({
    projectDir: project,
    title: "Gone cite compact note",
    body: "All about src/b.ts cleanup work for the compact hard-stale-deprecate path.",
    type: "decision",
    paths: ["src/b.ts"],
  });
  assert.equal(partial.ok && gone.ok, true);
  // b.ts disappearing makes "Partial cite" a citation-prune case (one live path
  // remains, src/a.ts) and "Gone cite" a hard-stale-deprecate case (its only
  // cited path is gone).
  unlinkSync(join(project, "src", "b.ts"));

  const dir = packetsDir(project);
  const before = snapshotDir(dir);

  const applied = compactProject(project, { dryRun: false });
  assert.equal(applied.pruned_citations.some((entry) => entry.id === partial.packet!.id && entry.removed_paths.includes("src/b.ts")), true);
  assert.equal(applied.deprecated.some((entry) => entry.id === gone.packet!.id), true);

  // The whole point: neither packet file was rewritten for either transition.
  const after = snapshotDir(dir);
  assert.deepEqual(after, before, "compact must not rewrite any packet file on disk");

  // Yet the overlay (packet + journal events) reports both transitions correctly.
  const approved = loadApprovedPackets(project);
  assert.equal(approved.some((p) => p.id === gone.packet!.id), false, "hard-stale packet must be excluded from recall via the overlay");
  const overlaidPartial = approved.find((p) => p.id === partial.packet!.id)!;
  assert.ok(overlaidPartial, "the citation-pruned packet stays approved and recallable");
  assert.deepEqual(overlaidPartial.paths, ["src/a.ts"], "the dead citation must be dropped from the overlaid view");

  const events = loadJournalEvents(project);
  const deprecatedEvent = events.find((e) => e.packet_id === gone.packet!.id && e.kind === "deprecated");
  assert.ok(deprecatedEvent, "compact must append a 'deprecated' journal event for the hard-stale packet");
  const prunedEvent = events.find((e) => e.packet_id === partial.packet!.id && e.kind === "pruned");
  assert.ok(prunedEvent, "compact must append a 'pruned' journal event for the citation-pruned packet");
  assert.deepEqual(prunedEvent!.removed_paths, ["src/b.ts"]);
  assert.deepEqual(prunedEvent!.refreshed_paths, ["src/a.ts"]);
});

test("compact dry-run reports transitions but appends no journal events and touches no packet file", () => {
  const project = tempProject();
  writeFileSync(join(project, "src", "dry-run.ts"), "export const dryRun = 1;\n", "utf8");
  const gone = capture({
    projectDir: project,
    title: "Dry-run gone cite compact note",
    body: "All about src/dry-run.ts cleanup work for the compact hard-stale-deprecate dry-run path.",
    type: "decision",
    paths: ["src/dry-run.ts"],
  });
  assert.equal(gone.ok, true);
  // Delete the only cited path AFTER capture, so it has a stored fingerprint that
  // is now gone -- the "all cited files deleted since capture" hard-stale case
  // (recallHardStaleReason ignores citations that never existed at capture time).
  unlinkSync(join(project, "src", "dry-run.ts"));

  const dir = packetsDir(project);
  const before = snapshotDir(dir);

  const dry = compactProject(project, { dryRun: true });
  assert.equal(dry.dry_run, true);
  assert.equal(dry.deprecated.some((entry) => entry.id === gone.packet!.id), true);

  assert.deepEqual(snapshotDir(dir), before, "a dry run must not touch any packet file");
  assert.equal(loadJournalEvents(project).length, 0, "a dry run must not append journal events either");
  assert.equal(loadApprovedPackets(project).some((p) => p.id === gone.packet!.id), true, "dry run must not actually deprecate the packet");
});
