// docs/design/CONTEXT_ENGINE.md cites real symbols at real file:line locations and
// corrects a stale figure from the plan it was drafted from. Following the
// readme-claims.test.ts pattern (mcp/readme-claims.test.ts): a design doc that names
// code is a claim about the code, and this repo's standing failure mode is docs that
// outrun what actually shipped. This file keeps that claim honest two ways: every
// backtick-quoted repo path the doc cites must exist in the worktree, and every symbol
// an "Exists"-style citation names must actually appear in the file it's cited against.
//
// REGRESSION: delete docs/design/CONTEXT_ENGINE.md, or rename/remove any symbol in
// SYMBOL_CITATIONS below from the file it's cited against (e.g. rename compileBrief in
// mcp/delegation/brief.ts), or restore the plan's uncorrected "342K" kage_pr_check
// figure in place of the real 321,873 — any of those fails a test in this file.
//
// __dirname is mcp/dist/ at runtime (compiled test) — one ".." reaches sibling mcp/
// sources, two reaches the repo root. Same convention as readme-claims.test.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoPath = (...parts: string[]) => join(__dirname, "..", "..", ...parts);
const DOC_PATH = repoPath("docs", "design", "CONTEXT_ENGINE.md");

function readDoc(): string {
  return readFileSync(DOC_PATH, "utf8");
}

// Every backtick-quoted token that looks like a repo-relative file path (a known
// top-level segment, a slash, and a file extension), with an optional trailing
// :LINE or :LINE-LINE stripped before existence is checked. A literal glob
// (contains "*") is a deliberate illustrative path, not a citation of one real
// file, so it is collected separately and never checked with existsSync.
const PATH_TOKEN = /`((?:mcp|docs|\.agent_memory)\/[\w.\-/]+\.\w+)(?::\d+(?:-\d+)?)?`/g;

// The one deliberate illustrative glob the doc cites (evidence (a): the touch-set
// defect offering Kage's own memory storage as source files) — matched separately
// since `*` falls outside PATH_TOKEN's path-character class on purpose, so a glob
// can never be mistaken for a concrete file the "every cited path exists" check
// would otherwise try (and fail) to resolve with existsSync.
const GLOB_TOKEN = /`(\.agent_memory\/[\w.\-/]*\*[\w.\-/]*)`/g;

function citedPaths(doc: string): { concrete: string[]; globs: string[] } {
  const concrete = new Set<string>();
  const globs = new Set<string>();
  for (const match of doc.matchAll(PATH_TOKEN)) concrete.add(match[1]);
  for (const match of doc.matchAll(GLOB_TOKEN)) globs.add(match[1]);
  return { concrete: [...concrete], globs: [...globs] };
}

// Every `Symbol` this doc cites as existing code, paired with the file it names for
// that symbol — hand-curated against the doc's own "Exists" prose (verified against
// the real source before landing, not derived mechanically from the markdown, since
// the doc's sentences interleave symbol and citation with plain prose no regex should
// have to survive). This is the doc's own claim inventory: if the doc is edited to
// claim a new symbol exists, add it here so the claim stays checked.
const SYMBOL_CITATIONS: Array<{ symbol: string; file: string }> = [
  { symbol: "compileBrief", file: "mcp/delegation/brief.ts" },
  { symbol: "namedTouches", file: "mcp/delegation/brief.ts" },
  { symbol: "TOUCH_CAP", file: "mcp/delegation/brief.ts" },
  { symbol: "renderBrief", file: "mcp/delegation/brief.ts" },
  { symbol: "MANAGER_CONSTITUTION", file: "mcp/delegation/manager-prompt.ts" },
  { symbol: "MANAGER_ALLOWED_TOOLS", file: "mcp/delegation/manager-client.ts" },
  { symbol: "AGENT_ALLOWED_TOOLS", file: "mcp/delegation/adapters/index.ts" },
  { symbol: "preflightForecast", file: "mcp/delegation/preflight.ts" },
  { symbol: "listRuns", file: "mcp/delegation/contract.ts" },
  { symbol: "worktreePath", file: "mcp/delegation/worktree.ts" },
  { symbol: "dirtyPaths", file: "mcp/delegation/git.ts" },
  { symbol: "brief_memory_ids", file: "mcp/delegation/contract.ts" },
  { symbol: "packetsTaughtByRun", file: "mcp/delegation/memory-view.ts" },
  { symbol: "packetFlywheel", file: "mcp/delegation/memory-view.ts" },
  { symbol: "renderClaimCard", file: "mcp/delegation/verify.ts" },
  { symbol: "mergeRun", file: "mcp/delegation/ratify.ts" },
  { symbol: "draftLearnings", file: "mcp/delegation/ratify.ts" },
  { symbol: "setPacketStatus", file: "mcp/delegation/ratify.ts" },
  { symbol: "computeTrackRecord", file: "mcp/delegation/trackrecord.ts" },
  { symbol: "curationComparison", file: "mcp/delegation/trackrecord.ts" },
  { symbol: "roomPermissionDigest", file: "mcp/delegation/room-supervisor.ts" },
  { symbol: "resolveRoomResumeId", file: "mcp/delegation/room-supervisor.ts" },
  { symbol: "recall", file: "mcp/kernel.ts" },
  { symbol: "queryCodeGraph", file: "mcp/kernel.ts" },
  { symbol: "memoryAccessScore", file: "mcp/kernel.ts" },
  { symbol: "recallQualityScore", file: "mcp/kernel.ts" },
  { symbol: "packetFeedbackScore", file: "mcp/kernel.ts" },
  { symbol: "capCollection", file: "mcp/response-cap.ts" },
  { symbol: "responseCapLimit", file: "mcp/response-cap.ts" },
  { symbol: "capFields", file: "mcp/response-cap.ts" },
];

test("docs/design/CONTEXT_ENGINE.md exists and is a substantial design doc", () => {
  assert.ok(existsSync(DOC_PATH), "docs/design/CONTEXT_ENGINE.md is missing");
  const doc = readDoc();
  assert.ok(doc.length > 4000, `expected a substantial design doc, got ${doc.length} chars`);
  assert.ok(doc.includes("# Kage's Context Engine"), "doc should open with the Context Engine title");
  for (const heading of ["## The four moments", "## Phases", "## The fifth surface"]) {
    assert.ok(doc.includes(heading), `doc should have a "${heading}" section`);
  }
});

test("every concrete repo path CONTEXT_ENGINE.md cites exists in the worktree", () => {
  const { concrete, globs } = citedPaths(readDoc());
  assert.ok(concrete.length >= 15, `expected many cited paths, found ${concrete.length}`);
  for (const path of concrete) {
    assert.ok(existsSync(repoPath(path)), `CONTEXT_ENGINE.md cites "${path}" but it does not exist in the worktree`);
  }
  // The doc illustrates the touch-set defect with a glob (.agent_memory/packets/*.md) —
  // that is deliberately not a single real file, so it must never sneak into the
  // concrete-path list above (which would make this test assert a glob "exists").
  assert.ok(globs.some((g) => g.includes("*")), "expected the doc to still cite the illustrative packets/*.md glob");
});

test("every symbol CONTEXT_ENGINE.md cites as existing code is a real identifier in its cited file", () => {
  assert.ok(SYMBOL_CITATIONS.length >= 20, `expected many symbol citations, found ${SYMBOL_CITATIONS.length}`);
  for (const { symbol, file } of SYMBOL_CITATIONS) {
    const fullPath = repoPath(file);
    assert.ok(existsSync(fullPath), `"${symbol}" is cited against "${file}", but that file does not exist`);
    const source = readFileSync(fullPath, "utf8");
    const identifier = new RegExp(`\\b${symbol}\\b`);
    assert.ok(identifier.test(source), `"${symbol}" is cited as existing in "${file}", but no such identifier appears there`);
  }
});

test("the doc corrects the plan's kage_pr_check figure instead of repeating it", () => {
  const doc = readDoc();
  assert.ok(doc.includes("321,873"), "doc should cite the real kage_pr_check response size on record (321,873 chars)");
  assert.ok(doc.includes("1,859,953"), "doc should cite the real kage_memory_lifecycle response size on record");
  // "342K" (the plan's wrong figure) may appear ONCE, only inside the sentence that
  // names it as the plan's error and points at the corrected number — never presented
  // as the doc's own stated fact. More than one occurrence, or the corrective phrase
  // missing, means the correction was lost (e.g. reverted back to stating it as fact).
  const occurrences = doc.split("342K").length - 1;
  assert.equal(occurrences, 1, `expected "342K" to appear exactly once (inside the correction note), found ${occurrences}`);
  assert.ok(doc.includes('cited "342K"'), 'doc should explicitly flag 342K as the plan\'s figure, not restate it as fact');
});

test("the doc corrects the plan's 'per-agent' mischaracterization of trackrecord.ts", () => {
  const doc = readDoc();
  assert.ok(
    doc.toLowerCase().includes("per-run-*type*") || doc.toLowerCase().includes("per-run-type") || doc.includes('called this "per-agent" — it isn\'t'),
    "doc should flag that trackrecord.ts buckets by run type, not by coding agent, correcting the plan's wording",
  );
});

test("the doc lists exactly the five phases with acceptance criteria", () => {
  const doc = readDoc();
  const phaseNames = ["Measure", "Mid-run pull", "Cross-run scoping", "Outcome tuning", "Orchestrator compaction"];
  for (const name of phaseNames) {
    assert.ok(doc.includes(name), `expected a phase named "${name}"`);
  }
  const tableRows = doc.split("\n").filter((line) => /^\|\s*\d+\s*—/.test(line));
  assert.equal(tableRows.length, 5, `expected exactly 5 numbered phase rows, found ${tableRows.length}`);
});

test("the doc names the worker's spawn as having zero MCP tools, not a restricted subset", () => {
  // The doc's Phase 2 (mid-run pull) only makes sense as a gap if this is true today —
  // verified directly against the adapter that spawns hired workers, not just asserted.
  const adapterSource = readFileSync(repoPath("mcp/delegation/adapters/index.ts"), "utf8");
  assert.ok(!adapterSource.includes("--mcp-config"), "expected no --mcp-config flag in the worker's one-shot/live spawn args — if one now exists, Phase 2 of the doc is stale");
});
