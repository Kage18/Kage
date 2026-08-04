import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parsePacket, planImport, readPackets, summarizeSkips, truncateClaim, type LegacyPacket } from "./import.js";

function packet(overrides: Partial<LegacyPacket> = {}): LegacyPacket {
  return {
    file: "x.md",
    id: "repo:x:gotcha:thing",
    type: "gotcha",
    title: "The limit comparison is exclusive on purpose",
    body: "withinLimit uses < rather than <= so a tenant at exactly the limit is refused. Two PRs flipped it and both were reverted.",
    paths: ["src/limits.ts"],
    tags: ["limits"],
    status: "approved",
    verified: "verified",
    timestamp: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const FILE = `---
type: "Gotcha"
title: "The limit comparison is exclusive on purpose"
description: "a summary the legacy writer generated"
tags: ["limits", "tenant"]
timestamp: "2026-07-01T00:00:00.000Z"
x-kage-id: "repo:x:gotcha:the-limit-comparison"
x-kage-type: "gotcha"
x-kage-status: "approved"
x-kage-verified: "verified"
x-kage-paths: ["src/limits.ts", "src/billing.ts"]
---

# The limit comparison is exclusive on purpose

> a summary the legacy writer generated

withinLimit uses < rather than <=. Two PRs flipped it and both were reverted.
`;

test("a packet parses into its fields, dropping the writer's repeated heading and summary", () => {
  const parsed = parsePacket("x.md", FILE);
  assert.ok(parsed);
  assert.equal(parsed.type, "gotcha");
  assert.equal(parsed.title, "The limit comparison is exclusive on purpose");
  assert.deepEqual(parsed.paths, ["src/limits.ts", "src/billing.ts"]);
  assert.deepEqual(parsed.tags, ["limits", "tenant"]);
  // The `# heading` and `> summary` lines are the legacy writer's own duplication of the
  // frontmatter; carrying them into a 120-word claim would spend a third of it on repetition.
  assert.ok(!parsed.body.includes("#"));
  assert.ok(!parsed.body.includes(">"));
  assert.match(parsed.body, /^withinLimit uses/);
});

test("a malformed packet is null, not a guess", () => {
  for (const bad of ["", "no frontmatter", "---\ntitle: \"only a title\"\n---\nbody"]) {
    assert.equal(parsePacket("x.md", bad), null, JSON.stringify(bad.slice(0, 24)));
  }
});

test("one unreadable packet does not abort the migration", () => {
  const dir = mkdtempSync(join(tmpdir(), "kage-import-"));
  mkdirSync(join(dir, ".agent_memory", "packets"), { recursive: true });
  writeFileSync(join(dir, ".agent_memory", "packets", "good.md"), FILE);
  writeFileSync(join(dir, ".agent_memory", "packets", "bad.md"), "not a packet at all");
  assert.equal(readPackets(dir).length, 1);
});

test("an absent legacy store is an empty list, not an error", () => {
  assert.deepEqual(readPackets(mkdtempSync(join(tmpdir(), "kage-import-empty-"))), []);
});

// ── The refusals, which are the substance ────────────────────────────────────────────────────

test("the 15 legacy types collapse onto three kinds", () => {
  const cases: Array<[string, string]> = [
    ["decision", "decision"],
    ["proposal", "decision"],
    ["bug_fix", "caution"],
    ["gotcha", "caution"],
    ["runbook", "runbook"],
    ["workflow", "runbook"],
  ];
  for (const [legacy, expected] of cases) {
    const { candidates } = planImport([packet({ type: legacy })]);
    assert.equal(candidates[0]?.proposal.kind, expected, legacy);
  }
});

// repo_map and reference are DERIVABLE — the code and the index already answer them, which is
// exactly what the derivability gate exists to refuse.
test("derivable types are refused rather than migrated", () => {
  for (const type of ["repo_map", "reference"]) {
    const { candidates, skipped } = planImport([packet({ type })]);
    assert.equal(candidates.length, 0, type);
    assert.match(skipped[0].reason, /no home in the three kinds/);
  }
});

test("a packet that cites nothing cannot become a card", () => {
  const { candidates, skipped } = planImport([packet({ paths: [] })]);
  assert.equal(candidates.length, 0);
  assert.match(skipped[0].reason, /cites nothing/);
});

test("dead packets stay dead — migration is not resurrection", () => {
  for (const verified of ["deprecated", "stale", "superseded"]) {
    const { candidates, skipped } = planImport([packet({ verified })]);
    assert.equal(candidates.length, 0, verified);
    assert.match(skipped[0].reason, /already/);
  }
  const unapproved = planImport([packet({ status: "pending" })]);
  assert.equal(unapproved.candidates.length, 0);
});

test("the trigger is reconstructed from cited files, since the legacy store had none", () => {
  const { candidates } = planImport([packet({ paths: ["src/limits.ts", "src/billing.ts"] })]);
  assert.match(candidates[0].proposal.trigger, /src\/limits\.ts/);
});

test("imported cards are tagged so the migration is auditable afterwards", () => {
  const { candidates } = planImport([packet()]);
  assert.ok(candidates[0].proposal.tags?.includes("imported"));
});

// ── Truncation ───────────────────────────────────────────────────────────────────────────────

test("a short body passes through verbatim — a migration must not paraphrase", () => {
  const body = "withinLimit uses < rather than <=. Two PRs flipped it and both were reverted.";
  assert.equal(truncateClaim(body), body);
});

// A claim cut mid-sentence reads as corrupted and can invert its own meaning: "this is safe
// because" is not a safe claim.
test("a long body is cut at a sentence boundary, never mid-thought", () => {
  const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} says something about the system.`).join(" ");
  const claim = truncateClaim(long);
  assert.ok(claim);
  assert.match(claim, /\.$/);
  assert.ok(claim.split(" ").length <= 120);
});

test("a body with no sentence boundary is refused rather than mangled", () => {
  const noStop = Array.from({ length: 200 }, () => "word").join(" ");
  assert.equal(truncateClaim(noStop), null);
  const { skipped } = planImport([packet({ body: noStop })]);
  assert.match(skipped[0].reason, /mangling/);
});

test("an empty body is refused", () => {
  assert.equal(truncateClaim("   "), null);
});

test("skip reasons collapse into a readable summary rather than 229 unique lines", () => {
  const packets = [
    packet({ status: "pending" }),
    packet({ status: "draft" }),
    packet({ type: "repo_map" }),
    packet({ type: "reference" }),
    packet({ paths: [] }),
  ];
  const { skipped } = planImport(packets);
  const summary = summarizeSkips(skipped);
  assert.equal(summary.reduce((sum, entry) => sum + entry.count, 0), 5);
  assert.ok(summary.length < 5, "parameterised reasons must collapse");
  assert.equal(summary[0].count, 2);
});

// THE default that decides whether the migration is usable. Measured on this repository: 230
// surviving packets, 225 of which pass every other check — an inbox nobody would ever clear, and
// exactly the junk-inbox failure that made Cursor delete its Memories feature. Verification is a
// signal the legacy store already carries because a person already gave it.
test("only human-verified packets import by default; the rest wait behind an explicit flag", () => {
  const packets = [packet({ verified: "verified" }), packet({ title: "unconfirmed", verified: "unverified" })];

  const strict = planImport(packets);
  assert.equal(strict.candidates.length, 1);
  assert.equal(strict.candidates[0].packet.verified, "verified");
  assert.match(strict.skipped[0].reason, /never verified by a human/);

  const all = planImport(packets, { requireVerified: false });
  assert.equal(all.candidates.length, 2, "--all imports the unconfirmed ones too");
});

// A card written about a file that no longer exists is stale the instant it is created.
test("a packet whose cited file is gone cannot be imported", () => {
  const alive = planImport([packet()], { pathExists: () => true });
  assert.equal(alive.candidates.length, 1);

  const dead = planImport([packet()], { pathExists: () => false });
  assert.equal(dead.candidates.length, 0);
  assert.match(dead.skipped[0].reason, /no longer exists/);
});

test("path-resolution skips collapse to one summary line rather than one per file", () => {
  const packets = [packet({ paths: ["a.ts"] }), packet({ paths: ["b.ts"] }), packet({ paths: ["c.ts"] })];
  const { skipped } = planImport(packets, { pathExists: () => false });
  const summary = summarizeSkips(skipped);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].count, 3);
});

// Found by dogfooding the import itself: half the cards it first admitted were `Change memory:
// <branch>` packets whose body is a diff summary, and one was served to an agent by the pre-edit
// hook before anyone noticed. A changelog is not a claim — nothing in it can be true or false
// about the code — so it must fail even though it carries a citation and a real type.
test("generated bookkeeping is refused by SHAPE, since it was filed under ordinary types", () => {
  const cases: Array<Partial<LegacyPacket>> = [
    { title: "Change memory: release/v2.0.0", type: "workflow" },
    { title: "Diff proposal: fix the thing", type: "decision" },
    { title: "PR summary: branch/x", type: "decision" },
    { title: "A genuine decision", body: "What changed: - a.ts Diff summary: ```text ...```", type: "decision" },
  ];
  for (const overrides of cases) {
    const { candidates, skipped } = planImport([packet(overrides)]);
    assert.equal(candidates.length, 0, JSON.stringify(overrides.title));
    assert.match(skipped[0].reason, /bookkeeping/);
  }
});

test("a real claim that merely mentions a diff is still admitted", () => {
  const { candidates } = planImport([
    packet({ body: "The merge driver diffs packets by content rather than by extension, so raw-JSON packets auto-merge." }),
  ]);
  assert.equal(candidates.length, 1);
});
