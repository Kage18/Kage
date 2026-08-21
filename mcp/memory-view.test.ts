import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readMemoryOverview, readMemoryPacket, stripPacketChrome } from "./delegation/memory-view.js";

function project(): string {
  return mkdtempSync(join(tmpdir(), "kage-mem-"));
}

function seed(dir: string, options: { metrics?: boolean; ledger?: boolean } = {}): void {
  mkdirSync(join(dir, ".agent_memory", "indexes"), { recursive: true });
  mkdirSync(join(dir, ".agent_memory", "packets"), { recursive: true });
  mkdirSync(join(dir, ".agent_memory", "reports"), { recursive: true });
  writeFileSync(
    join(dir, ".agent_memory", "indexes", "catalog.json"),
    JSON.stringify({
      packet_count: 2,
      packets: [
        { id: "repo:x:decision:a", title: "Use worktrees", summary: "why", type: "decision", status: "active", tags: ["t"], paths: ["a.ts"], updated_at: "2026-08-01T00:00:00.000Z" },
        { id: "repo:x:bug_fix:b", title: "Fix the retry", summary: "cause", type: "bug_fix", status: "active", tags: [], paths: [], updated_at: "2026-08-02T00:00:00.000Z" },
      ],
    }),
  );
  writeFileSync(
    join(dir, ".agent_memory", "packets", "decision-a.md"),
    ['---', 'type: "Decision"', 'x-kage-id: "repo:x:decision:a"', '---', '', '# Use worktrees', '', 'The prose a reader wants.', '', '## Kage state', '', '```json kage-state', '{"noise": true}', '```', ''].join("\n"),
  );
  if (options.metrics) {
    writeFileSync(
      join(dir, ".agent_memory", "metrics.json"),
      JSON.stringify({
        memory_graph: { approved_packets: 2, average_quality_score: 97, evidence_coverage_percent: 100, duplicate_candidate_pairs: 1 },
        quality: { totals: { stale: 3, high_signal: 2 }, useful_memory_ratio_percent: 90 },
        memory_access: { hot_packets: 1, active_packets_without_access: 1 },
      }),
    );
  }
  if (options.ledger) {
    writeFileSync(
      join(dir, ".agent_memory", "reports", "value.json"),
      JSON.stringify({ totals: { tokens_saved: 12345, stale_withheld: 4, stale_caught: 9, recalls: 7 } }),
    );
  }
}

test("the overview reads the catalog and counts by type", () => {
  const dir = project();
  seed(dir);
  const view = readMemoryOverview(dir);
  assert.equal(view.packets.length, 2);
  assert.equal(view.empty, false);
  assert.deepEqual(view.by_type, [
    { type: "bug_fix", count: 1 },
    { type: "decision", count: 1 },
  ]);
});

test("a repo with no memory reads as empty, not as broken", () => {
  const view = readMemoryOverview(project());
  assert.equal(view.empty, true);
  assert.equal(view.measured, false);
  assert.deepEqual(view.packets, []);
  assert.equal(view.value.cold_start, true);
});

test("measured:false is what stops the UI rendering an unmeasured metric as 0%", () => {
  const dir = project();
  seed(dir); // no metrics.json
  const bare = readMemoryOverview(dir);
  assert.equal(bare.measured, false, "without metrics.json nothing has been measured");
  assert.equal(bare.health.average_quality, 0, "the number is zero...");
  // ...and `measured` is the only thing that tells the surface that zero means
  // "not measured" rather than "scored nothing". Rendering it as 0% told the user
  // their memory was worthless.

  const dir2 = project();
  seed(dir2, { metrics: true });
  const full = readMemoryOverview(dir2);
  assert.equal(full.measured, true);
  assert.equal(full.health.average_quality, 97);
  assert.equal(full.health.stale, 3);
});

test("observed counts and the token estimate stay separate", () => {
  const dir = project();
  seed(dir, { metrics: true, ledger: true });
  const view = readMemoryOverview(dir);
  // Counted events.
  assert.equal(view.value.observed.recalls, 7);
  assert.equal(view.value.observed.stale_caught, 9);
  assert.equal(view.value.observed.packets, 2);
  assert.equal(view.value.cold_start, false);
  // A model, kept in its own bucket so a surface cannot present it as measurement.
  assert.equal(view.value.estimated.tokens_saved, 12345);
});

test("a torn index degrades to empty instead of throwing", () => {
  const dir = project();
  seed(dir);
  writeFileSync(join(dir, ".agent_memory", "indexes", "catalog.json"), "{ not json");
  const view = readMemoryOverview(dir);
  assert.equal(view.empty, true, "a damaged index must never take the app down");
});

test("a packet reads back as prose, with frontmatter and machine state stripped", () => {
  const dir = project();
  seed(dir);
  const packet = readMemoryPacket(dir, "repo:x:decision:a");
  assert.equal(packet.ok, true);
  assert.equal(packet.title, "Use worktrees");
  assert.match(packet.body!, /The prose a reader wants\./);
  assert.ok(!packet.body!.includes("x-kage-id"), "frontmatter is chrome, not content");
  assert.ok(!packet.body!.includes("kage-state"), "the machine-state fence is not for humans");
});

test("an unknown id is a clean 'not found', never a path escape", () => {
  const dir = project();
  seed(dir);
  for (const id of ["nope", "../../../etc/passwd", "repo:x:decision:missing"]) {
    const packet = readMemoryPacket(dir, id);
    assert.equal(packet.ok, false, `${id} must not resolve`);
    assert.match(packet.error!, /no such memory/);
  }
});

test("stripPacketChrome leaves a body that has neither", () => {
  assert.equal(stripPacketChrome("plain body"), "plain body");
  assert.equal(stripPacketChrome("---\na: 1\n---\n\nbody"), "body");
});
