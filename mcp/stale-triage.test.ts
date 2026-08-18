// Tests for `kage stale` — the triage surface for memory withheld from recall because
// its cited paths moved (mcp/kernel.ts: staleTriage, formatStaleTriage). Deliberately its
// own file per repo convention: new behaviour gets its own test file, and
// mcp/delegation.test.ts is a known merge-conflict hotspot other runs collide in.
//
// The one property under test throughout: staleTriage must never itself reverify or
// clear a stale flag — it only reports what moved and prints the exact single-packet
// command (reverify or supersede) for a human to run. reverifyMemory (tested in
// kernel.test.ts) refreshes grounding, not the claim; a triage surface that quietly
// cleared flags for the caller would be exactly the "bulk reverify" the brief forbids.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { capture, formatStaleTriage, packetsDir, staleTriage } from "./kernel.js";
import { okfConceptToPacket, packetToOkfConcept } from "./okf.js";

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-stale-triage-"));
  mkdirSync(join(dir, ".agent_memory", "nodes"), { recursive: true });
  return dir;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readPacketFile(path: string): any {
  return okfConceptToPacket(readFileSync(path, "utf8"));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writePacketFile(path: string, packet: any): void {
  writeFileSync(path, packetToOkfConcept(packet), "utf8");
}

function packetFileFor(project: string, id: string): string {
  const dir = packetsDir(project);
  const name = readdirSync(dir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".json"))
    .find((f) => readPacketFile(join(dir, f))?.id === id);
  if (!name) throw new Error(`no packet file found for ${id}`);
  return join(dir, name);
}

// Mutates a captured packet's on-disk quality.score, so ranking tests don't depend on
// the derived quality scorer's internals — only on staleTriage's own weighting.
function setQualityScore(project: string, id: string, score: number): void {
  const path = packetFileFor(project, id);
  const packet = readPacketFile(path);
  packet.quality = { ...(packet.quality ?? {}), score };
  writePacketFile(path, packet);
}

test("lists a stale packet with the cited path that moved, and what changed under it", () => {
  const project = tempProject();
  writeFileSync(join(project, "src.ts"), "export const x = 1;\n", "utf8");
  const captured = capture({
    projectDir: project,
    title: "Src rule",
    body: "Src rule: the constant x lives in src.ts and must stay in sync with the config loader.",
    type: "decision",
    paths: ["src.ts"],
  });
  assert.equal(captured.ok, true, JSON.stringify(captured.errors));
  const id = captured.packet!.id;

  // Simulate the file moving out from under the packet (a rename/delete during a refactor).
  rmSync(join(project, "src.ts"));

  const result = staleTriage(project);
  assert.equal(result.total_stale, 1);
  const entry = result.entries.find((item) => item.id === id);
  assert.ok(entry, "moved packet should appear in triage");
  assert.deepEqual(entry!.moved_paths, ["src.ts"]);
  assert.deepEqual(entry!.missing_paths, ["src.ts"]);
  assert.equal(entry!.present_paths.length, 0);
  assert.equal(entry!.what_changed.length, 1);
  assert.equal(entry!.what_changed[0].path, "src.ts");
  assert.equal(typeof entry!.what_changed[0].summary, "string");
  assert.ok(entry!.what_changed[0].summary.length > 0);
  assert.equal(entry!.reasons.length > 0, true);
  // Every cited path is gone here, so the honest suggestion is supersede, not reverify.
  assert.equal(entry!.suggested_action, "supersede");
  assert.match(entry!.command, /^kage supersede --project .* --packet /);
});

test("ranks a decision with surviving grounding above a low-quality bug_fix that lost everything", () => {
  const project = tempProject();
  mkdirSync(join(project, "keep"), { recursive: true });
  writeFileSync(join(project, "keep", "a.ts"), "export const a = 1;\n", "utf8");
  writeFileSync(join(project, "keep", "gone-a.ts"), "export const b = 1;\n", "utf8");
  writeFileSync(join(project, "keep", "gone-b.ts"), "export const c = 1;\n", "utf8");

  const decision = capture({
    projectDir: project,
    title: "High-value decision",
    body: "High-value decision: we standardized on keep/a.ts and keep/gone-a.ts for this contract, chosen over the alternative because it isolates the boundary.",
    type: "decision",
    paths: ["keep/a.ts", "keep/gone-a.ts"],
  });
  assert.equal(decision.ok, true, JSON.stringify(decision.errors));
  setQualityScore(project, decision.packet!.id, 90);

  const bugFix = capture({
    projectDir: project,
    title: "Low-value bug fix",
    body: "Low-value bug fix: a null check was missing in keep/gone-a.ts and keep/gone-b.ts, causing a crash on empty input.",
    type: "bug_fix",
    paths: ["keep/gone-a.ts", "keep/gone-b.ts"],
  });
  assert.equal(bugFix.ok, true, JSON.stringify(bugFix.errors));
  setQualityScore(project, bugFix.packet!.id, 40);

  // Move only one of the decision's two paths (it keeps half its grounding); move both
  // of the bug fix's paths (it loses all of its grounding).
  rmSync(join(project, "keep", "gone-a.ts"));
  rmSync(join(project, "keep", "gone-b.ts"));

  const result = staleTriage(project);
  assert.equal(result.total_stale, 2);
  assert.equal(result.entries[0].id, decision.packet!.id, "the decision with more surviving grounding and a higher quality score should rank first");
  assert.equal(result.entries[1].id, bugFix.packet!.id);
  assert.ok(result.entries[0].rescue_score > result.entries[1].rescue_score);
  // The bug fix lost every citation, so it must be offered supersede, never reverify.
  assert.equal(result.entries[1].suggested_action, "supersede");
  assert.equal(result.entries[0].suggested_action, "reverify");
  assert.match(result.entries[0].command, /^kage reverify --project .* --packet /);
});

test("--limit caps the list and reports how many were withheld", () => {
  const project = tempProject();
  const ids: string[] = [];
  for (const name of ["p1", "p2", "p3"]) {
    writeFileSync(join(project, `${name}.ts`), `export const ${name} = 1;\n`, "utf8");
    const captured = capture({
      projectDir: project,
      title: `Rule about ${name}`,
      body: `Rule about ${name}: the ${name} constant lives in ${name}.ts and downstream code depends on it staying exported.`,
      type: "reference",
      paths: [`${name}.ts`],
    });
    assert.equal(captured.ok, true, JSON.stringify(captured.errors));
    ids.push(captured.packet!.id);
    rmSync(join(project, `${name}.ts`));
  }

  const full = staleTriage(project, { limit: 20 });
  assert.equal(full.total_stale, 3);
  assert.equal(full.shown, 3);
  assert.equal(full.withheld, 0);

  const capped = staleTriage(project, { limit: 1 });
  assert.equal(capped.total_stale, 3);
  assert.equal(capped.shown, 1);
  assert.equal(capped.entries.length, 1);
  assert.equal(capped.withheld, 2);

  const rendered = formatStaleTriage(capped, 1);
  assert.ok(rendered.some((line) => line.includes("2 more withheld by --limit 1")));
});

test("a repo with no stale memory prints a clean empty state that teaches the next action", () => {
  const project = tempProject();
  writeFileSync(join(project, "fine.ts"), "export const fine = 1;\n", "utf8");
  const captured = capture({
    projectDir: project,
    title: "Fine rule",
    body: "Fine rule: fine.ts holds a constant that nothing else depends on breaking.",
    type: "reference",
    paths: ["fine.ts"],
  });
  assert.equal(captured.ok, true, JSON.stringify(captured.errors));

  const result = staleTriage(project);
  assert.equal(result.ok, true);
  assert.equal(result.total_stale, 0);
  assert.equal(result.entries.length, 0);

  const rendered = formatStaleTriage(result, 20);
  assert.equal(rendered.length, 2);
  assert.match(rendered[0], /No stale memory to triage/);
  // Teaches the next action instead of just saying "nothing here".
  assert.match(rendered.join("\n"), /re-run it after a large refactor/);
});

test("staleTriage never mutates packets on disk (it is read-only triage, not bulk reverify)", () => {
  const project = tempProject();
  writeFileSync(join(project, "watched.ts"), "export const watched = 1;\n", "utf8");
  const captured = capture({
    projectDir: project,
    title: "Watched rule",
    body: "Watched rule: watched.ts holds a constant referenced by the billing job scheduler.",
    type: "decision",
    paths: ["watched.ts"],
  });
  assert.equal(captured.ok, true, JSON.stringify(captured.errors));
  const id = captured.packet!.id;
  rmSync(join(project, "watched.ts"));

  const before = readPacketFile(packetFileFor(project, id));
  staleTriage(project);
  const after = readPacketFile(packetFileFor(project, id));
  assert.deepEqual(before, after);
});
