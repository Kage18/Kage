import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { callTool } from "./index.js";
import { capture } from "./kernel.js";
import { capCollection } from "./response-cap.js";
import { okfConceptToPacket, packetToOkfConcept } from "./okf.js";

// Hermetic personal store: recall reads $KAGE_HOME/memory, so tool tests must
// never see the developer's real ~/.kage.
if (!process.env.KAGE_HOME) process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-response-size-home-"));

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-response-size-test-"));
  mkdirSync(join(dir, ".agent_memory", "nodes"), { recursive: true });
  return dir;
}

function textContent(result: Awaited<ReturnType<typeof callTool>>): string {
  const first = result.content[0];
  assert.equal(first.type, "text");
  return String(first.text);
}

// Each packet cites a path that does not exist, which refreshProject flags stale
// with suggested_action "update". Setting a packet's status to "deprecated" instead
// flags it "mark_stale" (higher urgency), used to exercise the ranking behavior.
function seedStalePackets(project: string, count: number, options: { deprecatedCount?: number } = {}): void {
  const deprecatedCount = options.deprecatedCount ?? 0;
  for (let i = 0; i < count; i++) {
    const result = capture({
      projectDir: project,
      title: `Stale fixture memory ${i}`,
      body: `This fixture packet cites a path that does not exist so refresh flags it stale. Verified by fixture ${i}.`,
      type: "gotcha",
      paths: [`src/missing-${i}.ts`],
      tags: ["fixture"],
    });
    assert.equal(result.ok, true, `capture ${i} should succeed: ${result.errors.join("; ")}`);
    if (i < deprecatedCount) {
      const packet = okfConceptToPacket(readFileSync(result.path!, "utf8"));
      assert.ok(packet);
      packet.status = "deprecated";
      writeFileSync(result.path!, packetToOkfConcept(packet), "utf8");
    }
  }
}

// Short body, no paths, no tags: base 45 + high-value-type 14 + always-present source
// evidence 12 - too-short 18 - not-grounded 10 = 43, under the 55 quality-score warning
// threshold. Enough near-identical fixtures also trip the duplicate-candidate warning.
function seedLowQualityPackets(project: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const result = capture({
      projectDir: project,
      title: `Thin note ${i}`,
      body: `Thin note ${i} body.`,
      type: "gotcha",
    });
    assert.equal(result.ok, true, `capture ${i} should succeed: ${result.errors.join("; ")}`);
  }
}

test("capCollection returns everything untouched when under the limit", () => {
  const result = capCollection(["a", "b"], 10, "widgets");
  assert.deepEqual(result.items, ["a", "b"]);
  assert.equal(result.total, 2);
  assert.equal(result.truncated, false);
  assert.equal(result.note, null);
});

test("capCollection truncates and states an honest total", () => {
  const items = Array.from({ length: 25 }, (_, i) => `item-${i}`);
  const result = capCollection(items, 10, "widgets");
  assert.equal(result.items.length, 10);
  assert.equal(result.total, 25);
  assert.equal(result.truncated, true);
  assert.equal(result.note, "showing 10 of 25 widgets");
});

test("kage_refresh caps stale_packets to at most 10 and states the true total", async () => {
  const project = tempProject();
  seedStalePackets(project, 15, { deprecatedCount: 3 });

  const result = await callTool("kage_refresh", { project_dir: project });
  const payload = JSON.parse(textContent(result));

  assert.equal(Array.isArray(payload.stale_packets), true);
  assert.ok(payload.stale_packets.length <= 10, `expected at most 10 stale_packets, got ${payload.stale_packets.length}`);
  assert.equal(payload.stale_packets_total, 15);
  assert.equal(payload.stale_packets_truncated, true);

  // (b) the truncation notice text actually appears in the returned payload.
  assert.match(textContent(result), /showing 10 of 15 stale packets/);
  assert.ok(payload.response_notes.includes("showing 10 of 15 stale packets"));

  // Ranking: the 3 deprecated (mark_stale, most urgent) findings must survive the cap
  // even though they were captured last, i.e. this is not an insertion-order slice.
  const shownActions = payload.stale_packets.map((entry: { suggested_action: string }) => entry.suggested_action);
  assert.equal(shownActions.filter((action: string) => action === "mark_stale").length, 3);
});

test("kage_refresh limit/verbose return more than the capped default", async () => {
  const project = tempProject();
  seedStalePackets(project, 15);

  const capped = JSON.parse(textContent(await callTool("kage_refresh", { project_dir: project })));
  assert.equal(capped.stale_packets.length, 10);

  const limited = JSON.parse(textContent(await callTool("kage_refresh", { project_dir: project, limit: 12 })));
  assert.equal(limited.stale_packets.length, 12);
  assert.equal(limited.stale_packets_truncated, true);

  const verbose = JSON.parse(textContent(await callTool("kage_refresh", { project_dir: project, verbose: true })));
  assert.equal(verbose.stale_packets.length, 15);
  assert.equal(verbose.stale_packets_total, 15);
  assert.equal(verbose.stale_packets_truncated, false);
});

test("kage_refresh leaves a repo with few stale packets unaffected", async () => {
  const project = tempProject();
  seedStalePackets(project, 2);

  const result = await callTool("kage_refresh", { project_dir: project });
  const payload = JSON.parse(textContent(result));

  assert.equal(payload.stale_packets.length, 2);
  assert.equal(payload.stale_packets_total, 2);
  assert.equal(payload.stale_packets_truncated, false);
  assert.equal(payload.response_notes.includes("showing 2 of 2 stale packets"), false);
});

test("kage_refresh caps validation warnings and states the true total", async () => {
  const project = tempProject();
  seedLowQualityPackets(project, 15);

  const result = await callTool("kage_refresh", { project_dir: project });
  const payload = JSON.parse(textContent(result));

  assert.ok(payload.validation.warnings_total >= 11, `expected fixture to produce >10 warnings, got ${payload.validation.warnings_total}`);
  assert.ok(payload.validation.warnings.length <= 10);
  assert.equal(payload.validation.warnings_truncated, true);
  assert.ok(payload.response_notes.some((note: string) => note.startsWith("showing 10 of") && note.endsWith("validation warnings")));
});

// This repo's own refresh call measured 149,739 chars (177 stale packets, 78 warnings)
// before this fix, large enough that the MCP client refused it outright. A fixture at
// comparable scale (60 stale packets, 15 deprecated) must stay well under a sane budget
// with the default cap applied. 40,000 bytes is ~3.7x under the previous overflow and
// leaves generous room for the index/metrics/graph fields that are never capped.
test("kage_refresh default response for a repo-scale fixture stays under a sane byte budget", async () => {
  const project = tempProject();
  seedStalePackets(project, 60, { deprecatedCount: 15 });

  const result = await callTool("kage_refresh", { project_dir: project });
  const text = textContent(result);
  const BYTE_BUDGET = 40_000;
  assert.ok(
    Buffer.byteLength(text, "utf8") < BYTE_BUDGET,
    `expected under ${BYTE_BUDGET} bytes, got ${Buffer.byteLength(text, "utf8")}`,
  );
});
