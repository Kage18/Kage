import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  capture,
  gcProject,
  kageConflicts,
  loadApprovedPackets,
  loadPendingPackets,
  packetsDir,
  proposeFromDiff,
  recall,
  refreshProject,
  supersedeMemory,
} from "./kernel.js";
import { callTool } from "./index.js";

if (!process.env.KAGE_HOME) process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-mqh-home-"));

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-mqh-"));
  mkdirSync(join(dir, ".agent_memory", "nodes"), { recursive: true });
  return dir;
}

function gitInit(project: string): void {
  execFileSync("git", ["init", "-q"], { cwd: project });
  execFileSync("git", ["config", "user.email", "c@c"], { cwd: project });
  execFileSync("git", ["config", "user.name", "c"], { cwd: project });
}

// ── Fix 1: admission gate ────────────────────────────────────────────────

test("capture rejects a near-duplicate (>=0.92 similarity) and names the packet to supersede instead", () => {
  const project = tempProject();
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "zeta.ts"), "export const zeta = 1;\n", "utf8");
  const body =
    "The zeta idempotency retry helper in src/zeta.ts must be called before every payment charge to avoid duplicate transactions, because retries without it caused double charges in production.";
  const first = capture({
    projectDir: project,
    title: "Zeta retry helper prevents double charges",
    body,
    type: "decision",
    paths: ["src/zeta.ts"],
  });
  assert.equal(first.ok, true, first.errors.join("; "));

  // Reverting the admission gate would let this second, near-identical capture through as
  // a second approved packet — exactly the near-duplicate bloat the gate exists to stop.
  const second = capture({
    projectDir: project,
    title: "Zeta retry helper prevents double charges",
    body,
    type: "decision",
    paths: ["src/zeta.ts"],
  });
  assert.equal(second.ok, false);
  assert.match(second.errors.join(" "), /similar to existing packet/i);
  assert.ok(second.errors.join(" ").includes(first.packet!.id), "names the packet it duplicates");
  assert.match(second.errors.join(" "), /kage_supersede/i);
  assert.equal(loadApprovedPackets(project).length, 1, "the duplicate was never written");
});

test("capture rejects a computed quality score below the admission floor unless allow_low_quality is passed", () => {
  const project = tempProject();

  // Reverting the floor would auto-approve this terse, unevidenced-beyond-capture packet —
  // the "auto-approved at quality score 54" bug the floor exists to close.
  const low = capture({ projectDir: project, title: "Terse note", body: "Short note here.", type: "reference" });
  assert.equal(low.ok, false);
  assert.match(low.errors.join(" "), /below the admission floor/i);
  assert.match(low.errors.join(" "), /allow_low_quality/i);
  assert.equal(loadApprovedPackets(project).length, 0);

  const allowed = capture({
    projectDir: project,
    title: "Terse note allowed",
    body: "Short note here too.",
    type: "reference",
    allowLowQuality: true,
  });
  assert.equal(allowed.ok, true, allowed.errors.join("; "));
  assert.equal(allowed.packet!.status, "approved");
  assert.ok(Number(allowed.packet!.quality.score) < 60, "the override does not inflate the stored score");
});

test("the admission floor does not double-penalize a deliberate replacement for a packet it will supersede", () => {
  // A packet written specifically to REPLACE an existing one is expected to read as similar
  // to it (below the hard 0.92 duplicate block, but still flagged "possible duplicate" by
  // evaluateMemoryQuality). If the quality floor counted that risk twice, writing the
  // replacement kage_supersede tells callers to use would itself be blocked.
  const project = tempProject();
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "core.js"), "export function core() { return 1; }\n", "utf8");
  const a = capture({
    projectDir: project,
    title: "Coverage packet B",
    body: "A grounded note about src/core.js to be superseded during coverage.",
    type: "reference",
    paths: ["src/core.js"],
  });
  assert.equal(a.ok, true, a.errors.join("; "));
  const b = capture({
    projectDir: project,
    title: "Coverage packet C",
    body: "The replacement note about src/core.js for supersede coverage.",
    type: "reference",
    paths: ["src/core.js"],
  });
  assert.equal(b.ok, true, b.errors.join("; "));
});

test("change-memory packets cap cited paths at 20 even when far more files changed", () => {
  const project = tempProject();
  gitInit(project);
  mkdirSync(join(project, "src"), { recursive: true });
  for (let i = 0; i < 30; i += 1) {
    writeFileSync(join(project, "src", `file-${i}.ts`), `export const value${i} = ${i};\n`, "utf8");
  }
  const result = proposeFromDiff(project);
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.ok(result.changedFiles.length > 20, "fixture actually changed more than 20 files");
  // Reverting the cap would restore all 30 (well, up to 40) as cited paths — a packet
  // citing that many paths grounds nothing and cannot be meaningfully reverified.
  assert.ok(result.packet!.paths.length <= 20, `expected <=20 cited paths, got ${result.packet!.paths.length}`);
});

// ── Fix 2: kage gc curation ───────────────────────────────────────────────

test("gc excludes deprecated packets from the stale surface instead of re-flagging their own status", () => {
  const project = tempProject();
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "gone.ts"), "export const gone = 1;\n", "utf8");
  const result = capture({
    projectDir: project,
    title: "Helper that will be removed",
    body: "Run npm test after changing the helper described here for this fixture.",
    type: "runbook",
    paths: ["src/gone.ts"],
  });
  assert.equal(result.ok, true, result.errors.join("; "));

  // Delete the cited file so the packet is genuinely stale, then let gc deprecate it.
  unlinkSync(join(project, "src", "gone.ts"));
  const gc = gcProject(project);
  assert.ok(gc.deprecated.some((p) => p.id === result.packet!.id));

  // Reverting the refreshPacketStaleness exclusion would surface this packet again in
  // stale_packets with reason "packet status is deprecated" — restating its own status,
  // not something a human can act on.
  const refresh = refreshProject(project);
  assert.equal(refresh.ok, true);
  assert.equal(
    refresh.stale_packets.some((p) => p.id === result.packet!.id),
    false,
    "a deprecated packet must not dominate the stale list with its own status as the reason"
  );
});

test("gc excludes already-superseded packets up front instead of clobbering their status back to deprecated", () => {
  const project = tempProject();
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "old.ts"), "export const old = 1;\n", "utf8");
  writeFileSync(join(project, "src", "new.ts"), "export const fresh = 1;\n", "utf8");
  const oldPacket = capture({
    projectDir: project,
    title: "Old convention for old.ts",
    body: "Run npm test after touching this old convention described in this fixture note.",
    type: "convention",
    paths: ["src/old.ts"],
  });
  const newPacket = capture({
    projectDir: project,
    title: "New convention for new.ts",
    body: "Run npm test after touching this new convention described in this fixture note.",
    type: "convention",
    paths: ["src/new.ts"],
  });
  assert.equal(oldPacket.ok, true, oldPacket.errors.join("; "));
  assert.equal(newPacket.ok, true, newPacket.errors.join("; "));
  const superseded = supersedeMemory(project, oldPacket.packet!.id, newPacket.packet!.id, "replaced for this test");
  assert.equal(superseded.ok, true);

  const gc = gcProject(project);
  // Reverting the "deprecated OR superseded" exclusion would let gc's stale loop pick this
  // packet back up (its own "packet status is superseded" reason counts as staleness) and
  // overwrite status back to "deprecated", destroying the supersede lineage just recorded.
  assert.equal(gc.deprecated.some((p) => p.id === oldPacket.packet!.id), false);
  assert.ok(gc.excluded_end_state.some((p) => p.id === oldPacket.packet!.id && p.status === "superseded"));
  const approved = loadApprovedPackets(project);
  const reloaded = [...approved, ...loadPendingPackets(project)];
  assert.equal(reloaded.some((p) => p.id === oldPacket.packet!.id), false, "superseded packet stays out of approved/pending");
});

test("gc auto-merges near-duplicate approved packets (>=0.95) by superseding the lower-quality one, with lineage recorded", () => {
  const project = tempProject();
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "dup.ts"), "export const dup = 1;\n", "utf8");
  const base = capture({
    projectDir: project,
    title: "Duplicate note about dup.ts",
    body: "Run npm test after changing src/dup.ts because of this duplicate-note fixture body.",
    type: "reference",
    paths: ["src/dup.ts"],
  });
  assert.equal(base.ok, true, base.errors.join("; "));

  // Use the freshly captured packet purely as a schema template, then simulate the existing
  // 695-packet backlog: two near-identical approved packets written before the admission
  // gate existed. capture() itself would now refuse the second one via that gate, so this
  // writes both directly to disk and removes the original template file.
  unlinkSync(base.path!);
  const highQuality = { ...base.packet!, id: `${base.packet!.id}-hi`, quality: { ...base.packet!.quality, score: 90 } };
  const lowQuality = { ...base.packet!, id: `${base.packet!.id}-lo`, quality: { ...base.packet!.quality, score: 40 } };
  writeFileSync(join(packetsDir(project), "dup-hi.json"), JSON.stringify(highQuality, null, 2), "utf8");
  writeFileSync(join(packetsDir(project), "dup-lo.json"), JSON.stringify(lowQuality, null, 2), "utf8");

  const gc = gcProject(project);
  assert.equal(gc.merged_duplicates.length, 1, JSON.stringify(gc.merged_duplicates));
  const merge = gc.merged_duplicates[0];
  assert.ok(merge.score >= 0.95);
  // Reverting the merge pass would leave both approved forever, never resolving on its own.
  assert.equal(merge.kept.id, highQuality.id, "the higher-quality packet must be the one kept");
  assert.equal(merge.superseded.id, lowQuality.id);
  const afterLow = loadApprovedPackets(project).find((p) => p.id === lowQuality.id);
  assert.equal(afterLow, undefined, "the merged-away packet is no longer approved");
  assert.ok(loadApprovedPackets(project).some((p) => p.id === highQuality.id));
});

test("gc lists contradiction pairs ranked by recall traffic with a suggestion, but never auto-resolves them", () => {
  const project = tempProject();
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "webhook.ts"), "export const x = 1;\n", "utf8");
  const affirmative = capture({
    projectDir: project,
    title: "Use the zephyr retry wrapper for webhook calls",
    summary: "Always use the zephyr retry wrapper when calling the webhook endpoint.",
    body: "Always use the zephyr retry wrapper for webhook calls — it handles transient failures.",
    type: "convention",
    paths: ["src/webhook.ts"],
  });
  const negated = capture({
    projectDir: project,
    title: "Use the zephyr retry wrapper for webhook calls",
    summary: "Do not use the zephyr retry wrapper when calling the webhook endpoint.",
    body: "Do not use the zephyr retry wrapper for webhook calls — it is not safe. Avoid it.",
    type: "convention",
    paths: ["src/webhook.ts"],
  });
  assert.equal(affirmative.ok, true, affirmative.errors.join("; "));
  assert.equal(negated.ok, true, negated.errors.join("; "));
  assert.equal(kageConflicts(project).count, 1, "fixture actually contradicts itself");

  // Build recall traffic on this pair so recall_traffic_30d is provably non-zero.
  recall(project, "zephyr retry wrapper webhook", 5, false, { trackAccess: true });

  const gc = gcProject(project, { dryRun: true });
  assert.equal(gc.contradiction_pairs.length, 1);
  const pair = gc.contradiction_pairs[0];
  assert.ok(pair.recall_traffic_30d > 0, "recall traffic was recorded and surfaced");
  assert.match(pair.suggestion, /supersede/i);
  // Listing is automatic; resolving stays a human/operator call — gc must not have touched
  // either packet's status.
  const approved = loadApprovedPackets(project);
  assert.ok(approved.some((p) => p.id === affirmative.packet!.id));
  assert.ok(approved.some((p) => p.id === negated.packet!.id));
});

test("gc prints an honest before/after count line: a dry run changes nothing so after equals before", () => {
  const project = tempProject();
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "removable.ts"), "export const removable = 1;\n", "utf8");
  const result = capture({
    projectDir: project,
    title: "Removable helper runbook",
    body: "Run npm test after changing the removable helper described in this fixture note.",
    type: "runbook",
    paths: ["src/removable.ts"],
  });
  assert.equal(result.ok, true, result.errors.join("; "));
  unlinkSync(join(project, "src", "removable.ts"));

  const dry = gcProject(project, { dryRun: true });
  assert.equal(dry.before.total_packets, dry.after.total_packets, "dry run must not claim a change it did not write");
  assert.equal(dry.before.stale, dry.after.stale);
  assert.ok(loadApprovedPackets(project).some((p) => p.id === result.packet!.id), "dry run wrote nothing to disk");

  const real = gcProject(project);
  assert.ok(real.after.total_packets <= real.before.total_packets || real.after.stale < real.before.stale);
  assert.equal(
    loadApprovedPackets(project).some((p) => p.id === result.packet!.id),
    false,
    "the real run actually deprecated the stale packet"
  );
});

// ── Fix 3: metric honesty ────────────────────────────────────────────────

test("refresh reports a real average_quality_score instead of the hardcoded 0", () => {
  const project = tempProject();
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "scored.ts"), "export const scored = 1;\n", "utf8");
  const result = capture({
    projectDir: project,
    title: "Scored packet for metric honesty",
    body: "Run npm test after changing src/scored.ts because of this scored-packet fixture, verified by test output.",
    type: "decision",
    paths: ["src/scored.ts"],
  });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.ok(Number(result.packet!.quality.score) > 0);

  const refresh = refreshProject(project);
  // Reverting the fix would report 0 here even though the packet on disk carries a real,
  // positive quality.score — exactly the discrepancy the operator flagged.
  assert.ok(
    refresh.metrics.memory_graph.average_quality_score > 0,
    `expected a real average_quality_score, got ${refresh.metrics.memory_graph.average_quality_score}`
  );
});

test("kage_recall's gains line states its estimation basis inline instead of reading as a measurement", async () => {
  const project = tempProject();
  mkdirSync(join(project, "src"), { recursive: true });
  // Large enough that recallTokensSaved (cited source bytes/4, capped at 1500 tokens) is
  // provably positive against the small recall context block, so the gains line always
  // renders its tokens-saved clause instead of only sometimes.
  const bigSource = `export function measured() {\n${"  // padding line to size this file up.\n".repeat(200)}  return 1;\n}\n`;
  writeFileSync(join(project, "src", "measured.ts"), bigSource, "utf8");
  const result = capture({
    projectDir: project,
    title: "Measured helper for gains-line coverage",
    body: "The measured() helper in src/measured.ts is used for gains-line estimation-basis coverage, verified by test output.",
    type: "decision",
    paths: ["src/measured.ts"],
  });
  assert.equal(result.ok, true, result.errors.join("; "));

  const reply = await callTool("kage_recall", { project_dir: project, query: "measured helper gains line" });
  const text = String(reply.content[0].text ?? "");
  assert.match(text, /tokens saved by this recall/i, "fixture must actually trigger the tokens-saved clause");
  // Reverting the estimation-basis wording would go back to a bare "est. ~N tokens saved"
  // with no basis named — indistinguishable from a real measurement.
  assert.match(text, /est\. by indexed-source token proxy/i, "the savings figure must name what it is an estimate of");
});
