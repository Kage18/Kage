// docs/design/SESSIONS_SURFACE.md cites real symbols at real file:line locations and
// names one piece of work as in-flight rather than landed. Same pattern as
// mcp/readme-claims.test.ts and mcp/context-doc.test.ts: a design doc that names code is
// a claim about the code, and this repo's standing failure mode is docs that outrun what
// actually shipped. This file keeps that claim honest four ways: every backtick-quoted
// repo path the doc cites must exist; every symbol an "exists"-style citation names must
// actually appear in the file it's cited against; the one gap the doc still leans its
// design on (no display_name on a run) must still be genuinely absent from the real
// source, not just asserted in prose — the stall-detector gap this file used to check the
// same way closed when the budget-circuit-breaker run landed `evaluateStallTurn`, so that
// check now runs in reverse (asserting the detector is real and the doc cites it as
// landed, not that it's absent); and the one remaining in-flight item, the unified-session
// work, must still read as in-flight, not as already landed.
//
// REGRESSION: delete docs/design/SESSIONS_SURFACE.md, or rename/remove any symbol in
// SYMBOL_CITATIONS below from the file it's cited against (e.g. rename workRow in
// mcp/delegation/app-client.ts), or add a display_name field without updating the doc's
// gap framing, or remove/rename the stall detector (`evaluateStallTurn`,
// `STALL_SAME_COMMAND_STREAK`) without reverting the doc to gap framing, or reword the doc
// to claim agent_session_id is not yet persisted live / the chat composer already writes
// into the orchestrator's own pty (i.e. drop the "in flight" language for the
// unified-session work) — any of those fails a test in this file.
//
// __dirname is mcp/dist/ at runtime (compiled test) — one ".." reaches sibling mcp/
// sources, two reaches the repo root. Same convention as readme-claims.test.ts and
// context-doc.test.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoPath = (...parts: string[]) => join(__dirname, "..", "..", ...parts);
const DOC_PATH = repoPath("docs", "design", "SESSIONS_SURFACE.md");

function readDoc(): string {
  return readFileSync(DOC_PATH, "utf8");
}

// Every backtick-quoted token that looks like a repo-relative file path (a known
// top-level segment, a slash, and a file extension), with an optional trailing
// :LINE or :LINE-LINE stripped before existence is checked. Same shape as
// context-doc.test.ts's PATH_TOKEN — this doc cites no illustrative globs, so there is
// no separate GLOB_TOKEN here.
const PATH_TOKEN = /`((?:mcp|docs|\.agent_memory)\/[\w.\-/]+\.\w+)(?::\d+(?:-\d+)?)?`/g;

function citedPaths(doc: string): string[] {
  const found = new Set<string>();
  for (const match of doc.matchAll(PATH_TOKEN)) found.add(match[1]);
  return [...found];
}

// Every `Symbol` this doc cites as existing code, paired with the file it names for
// that symbol — hand-curated against the doc's own "Exists"/"exists today" prose
// (verified against the real source before landing, not derived mechanically from the
// markdown). This is the doc's own claim inventory for shipped code: display_name (a
// PROPOSED field, not yet real) is deliberately absent from this list — it is the one
// remaining gap, checked by the separate test below instead. The stall-detector symbols
// are included here now that the detector has landed.
const SYMBOL_CITATIONS: Array<{ symbol: string; file: string }> = [
  { symbol: "TaskRecord", file: "mcp/delegation/contract.ts" },
  { symbol: "displayState", file: "mcp/delegation/contract.ts" },
  { symbol: "ownership", file: "mcp/delegation/contract.ts" },
  { symbol: "toRunView", file: "mcp/delegation/contract.ts" },
  { symbol: "makeRunId", file: "mcp/delegation/contract.ts" },
  { symbol: "transitionRun", file: "mcp/delegation/contract.ts" },
  { symbol: "state_history", file: "mcp/delegation/contract.ts" },
  { symbol: "waiting_on", file: "mcp/delegation/contract.ts" },
  { symbol: "tokens_used", file: "mcp/delegation/contract.ts" },
  { symbol: "ClaimRecord", file: "mcp/delegation/contract.ts" },
  { symbol: "RoomSupervisorRecord", file: "mcp/delegation/room-supervisor.ts" },
  { symbol: "RoomSessionMeta", file: "mcp/delegation/room-supervisor.ts" },
  { symbol: "roomPermissionDigest", file: "mcp/delegation/room-supervisor.ts" },
  { symbol: "resolveRoomResumeId", file: "mcp/delegation/room-supervisor.ts" },
  { symbol: "retireStructuredRoom", file: "mcp/delegation/room-pty.ts" },
  { symbol: "buildRoomPtyLaunch", file: "mcp/delegation/room-pty.ts" },
  { symbol: "renderRoom", file: "mcp/delegation/app-client.ts" },
  { symbol: "renderWorkList", file: "mcp/delegation/app-client.ts" },
  { symbol: "workRow", file: "mcp/delegation/app-client.ts" },
  { symbol: "renderBoard", file: "mcp/delegation/app-client.ts" },
  { symbol: "shortBranch", file: "mcp/delegation/app-client.ts" },
  { symbol: "renderConversation", file: "mcp/delegation/app-client.ts" },
  { symbol: "renderEntry", file: "mcp/delegation/app-client.ts" },
  { symbol: "renderDiff", file: "mcp/delegation/app-client.ts" },
  { symbol: "parseDiff", file: "mcp/delegation/app-client.ts" },
  { symbol: "renderPreflight", file: "mcp/delegation/app-client.ts" },
  { symbol: "renderReceipt", file: "mcp/delegation/app-client.ts" },
  { symbol: "renderMemory", file: "mcp/delegation/app-client.ts" },
  { symbol: "queueToggle", file: "mcp/delegation/app-client.ts" },
  { symbol: "takeOverRun", file: "mcp/delegation/run-pty.ts" },
  { symbol: "handBack", file: "mcp/delegation/run-pty.ts" },
  { symbol: "SEIZABLE_STATES", file: "mcp/delegation/run-pty.ts" },
  { symbol: "executeRun", file: "mcp/delegation/dispatch.ts" },
  { symbol: "randomUUID", file: "mcp/delegation/dispatch.ts" },
  { symbol: "sessionIdFrom", file: "mcp/delegation/supervisor.ts" },
  { symbol: "evaluateStallTurn", file: "mcp/delegation/supervisor.ts" },
  { symbol: "STALL_SAME_COMMAND_STREAK", file: "mcp/delegation/supervisor.ts" },
  { symbol: "STALL_NO_DIFF_STREAK", file: "mcp/delegation/supervisor.ts" },
  { symbol: "claimVerdict", file: "mcp/delegation/verify.ts" },
  { symbol: "renderClaimCard", file: "mcp/delegation/verify.ts" },
  { symbol: "verifyRun", file: "mcp/delegation/verify.ts" },
  { symbol: "MemoryOverview", file: "mcp/delegation/memory-view.ts" },
  { symbol: "kage_dispatch", file: "mcp/index.ts" },
  // W1 backend (this run): display_name is no longer the doc's one deliberate absence —
  // see the dedicated landed-gap test below for the negative-direction check.
  { symbol: "display_name", file: "mcp/delegation/contract.ts" },
  { symbol: "deriveDisplayName", file: "mcp/delegation/contract.ts" },
  { symbol: "suggestedNextPrompt", file: "mcp/delegation/suggest.ts" },
];

test("docs/design/SESSIONS_SURFACE.md exists and is a substantial design doc", () => {
  assert.ok(existsSync(DOC_PATH), "docs/design/SESSIONS_SURFACE.md is missing");
  const doc = readDoc();
  assert.ok(doc.length > 4000, `expected a substantial design doc, got ${doc.length} chars`);
  assert.ok(doc.includes("# Kage's Session Surface"), "doc should open with the Session Surface title");
  for (const heading of [
    "## 1. Vocabulary",
    "## 2. Named workers",
    "## 3. The worker view",
    "## 4. Ghost suggestions",
    "## 5. Cards",
    "## 6. Orchestrator presence",
    "## 7. What Kage refuses to copy",
    "## 8. Implementation split",
  ]) {
    assert.ok(doc.includes(heading), `doc should have a "${heading}" section`);
  }
});

test("every concrete repo path SESSIONS_SURFACE.md cites exists in the worktree", () => {
  const paths = citedPaths(readDoc());
  assert.ok(paths.length >= 12, `expected many cited paths, found ${paths.length}`);
  for (const path of paths) {
    assert.ok(existsSync(repoPath(path)), `SESSIONS_SURFACE.md cites "${path}" but it does not exist in the worktree`);
  }
});

test("every symbol SESSIONS_SURFACE.md cites as existing code is a real identifier in its cited file", () => {
  assert.ok(SYMBOL_CITATIONS.length >= 20, `expected many symbol citations, found ${SYMBOL_CITATIONS.length}`);
  for (const { symbol, file } of SYMBOL_CITATIONS) {
    const fullPath = repoPath(file);
    assert.ok(existsSync(fullPath), `"${symbol}" is cited against "${file}", but that file does not exist`);
    const source = readFileSync(fullPath, "utf8");
    const identifier = new RegExp(`\\b${symbol}\\b`);
    assert.ok(identifier.test(source), `"${symbol}" is cited as existing in "${file}", but no such identifier appears there`);
  }
});

test("the doc's display_name gap is landed and cited: TaskRecord and kage_dispatch's schema both carry it now", () => {
  // The doc's whole §2 (Named workers) used to specify display_name as new work because
  // neither TaskRecord nor kage_dispatch's schema had a name field. This W1 run landed
  // both (TaskRecord.display_name + deriveDisplayName in contract.ts, kage_dispatch's
  // display_name param in mcp/index.ts) — this checks the same disagreement in the
  // opposite direction, same precedent as the stall-detector test below: if either is
  // ever removed, or the doc ever reverts to claiming the gap is still open, this fails.
  const contractSource = readFileSync(repoPath("mcp/delegation/contract.ts"), "utf8");
  assert.ok(/\bdisplay_name\b/.test(contractSource), "expected TaskRecord to carry display_name now — if it was removed, doc §2 is stale in the other direction");
  assert.ok(/\bderiveDisplayName\b/.test(contractSource), "expected deriveDisplayName to exist in contract.ts");
  const indexSource = readFileSync(repoPath("mcp/index.ts"), "utf8");
  const dispatchToolMatch = /name:\s*"kage_dispatch"[\s\S]*?required:\s*\[[^\]]*\]\s*,?\s*}\s*,?\s*}/.exec(indexSource);
  assert.ok(dispatchToolMatch, "expected to find the kage_dispatch tool's inputSchema block in mcp/index.ts");
  assert.ok(/display_name/.test(dispatchToolMatch![0]), "expected kage_dispatch's inputSchema to carry display_name now — if it was removed, doc §2 is stale in the other direction");
  const doc = readDoc();
  assert.ok(
    doc.includes("TaskRecord.display_name") && doc.includes("deriveDisplayName"),
    "doc's §2 should cite the real display_name/deriveDisplayName symbols now that the gap has landed",
  );
  assert.ok(!/\*\*gap, confirmed\.\*\*\s*`TaskRecord` has no name field/i.test(doc), "doc should no longer describe display_name as an unbuilt gap");
});

test("the doc's ghost-suggestion derivation is landed and cited: suggestedNextPrompt is real, and the doc no longer calls it fully unbuilt", () => {
  // §4 used to open with "Does not exist today, at all." This W1 run landed the one
  // server-side derivation function plus its API attachment (suggested_next); wiring an
  // actual composer to read it is still open (W2) — the doc must say exactly that, not
  // claim the whole feature is unbuilt.
  const suggestSource = readFileSync(repoPath("mcp/delegation/suggest.ts"), "utf8");
  assert.ok(/\bsuggestedNextPrompt\b/.test(suggestSource), "expected suggestedNextPrompt to exist in mcp/delegation/suggest.ts");
  const apiSource = readFileSync(repoPath("mcp/delegation/api.ts"), "utf8");
  assert.ok(/\bsuggested_next\b/.test(apiSource), "expected the run detail API to attach suggested_next");
  const doc = readDoc();
  assert.ok(
    doc.includes("suggestedNextPrompt") && doc.includes("suggested_next"),
    "doc's §4 should cite the real suggestedNextPrompt/suggested_next symbols now that the derivation has landed",
  );
  assert.ok(!/does not exist today, at all/i.test(doc), "doc should no longer describe ghost suggestions as fully unbuilt");
});

test("the doc's stall-detector gap is landed and cited: the detector is real and the doc names it, not as a gap", () => {
  // The doc's §4 (Ghost suggestions) used to name a stalled-run suggestion as blocked on
  // a detector that didn't exist. The budget-circuit-breaker run landed one
  // (evaluateStallTurn and the STALL_* constants, mcp/delegation/supervisor.ts) — this
  // checks the same disagreement in the opposite direction: if the detector is ever
  // removed or renamed, or the doc ever reverts to claiming it's still missing, this
  // should fail.
  const supervisorSource = readFileSync(repoPath("mcp/delegation/supervisor.ts"), "utf8");
  assert.ok(
    /\bevaluateStallTurn\b/.test(supervisorSource) &&
      /\bSTALL_SAME_COMMAND_STREAK\b/.test(supervisorSource) &&
      /\bSTALL_NO_DIFF_STREAK\b/.test(supervisorSource),
    "expected the stall detector (evaluateStallTurn, STALL_SAME_COMMAND_STREAK, STALL_NO_DIFF_STREAK) to exist in supervisor.ts — if it was removed, doc §4 is now stale in the other direction",
  );
  const doc = readDoc();
  assert.ok(
    doc.includes("evaluateStallTurn") && doc.includes("STALL_SAME_COMMAND_STREAK") && doc.includes("STALL_NO_DIFF_STREAK"),
    "doc's §4 should cite the real stall-detector symbols now that the detector has landed",
  );
  assert.ok(
    !/no stall detector exists yet/i.test(doc),
    "doc should no longer describe the stall detector as an unbuilt gap",
  );
});

test("the doc names the one remaining in-flight item as in-flight, and no longer calls agent_session_id in-flight", () => {
  const doc = readDoc();
  // Markdown wraps prose at arbitrary columns, so a phrase spanning two source lines
  // must not be missed just because a newline landed inside it — collapse all whitespace
  // runs to a single space first.
  const flat = doc.replace(/\s+/g, " ").toLowerCase();
  const inFlightMentions = (flat.match(/in flight/g) || []).length;
  // Two uses remain after the budget-circuit-breaker run landed both the
  // agent_session_id fix (§3b) and the stall detector (§4): the orchestrator-as-real-
  // session heading (§1) and the W3 row, both naming the same still-open unified-session
  // gap. At least 2 keeps this from being satisfied by a single stray mention while
  // still tolerating minor rewording.
  assert.ok(inFlightMentions >= 2, `expected the doc to still name the unified-session work as in flight, found ${inFlightMentions} "in flight" mentions`);
  assert.ok(
    flat.includes("unified-session work itself, in flight"),
    "doc's W3 row should state the unified-session work is in flight, not landed",
  );
  assert.ok(
    flat.includes("landed: `agent_session_id` is now written to disk the moment the stream first reports it"),
    "doc should describe agent_session_id's mid-run persistence as landed, not in-flight",
  );
  assert.ok(
    !flat.includes("closes this gap with no new mechanism — **in flight, not done**"),
    "doc should no longer describe agent_session_id's mid-run persistence as in-flight — it landed with the budget-circuit-breaker run",
  );
});

test("the doc does not claim the chat composer already writes into the orchestrator's own pty", () => {
  const doc = readDoc();
  assert.ok(
    doc.includes("retireStructuredRoom") && doc.includes("mutually exclusive"),
    "doc should ground the chat/pty distinction in retireStructuredRoom making the two views mutually exclusive today, not shared",
  );
});

test("the doc lists the three standing UI defects inside the W2 wave, not as a separate deferred wave", () => {
  const doc = readDoc();
  const w2Index = doc.indexOf("W2 — renderer");
  const w3Index = doc.indexOf("W3 —");
  assert.ok(w2Index >= 0 && w3Index > w2Index, "expected W2 to precede W3 in the implementation split table");
  const defectsIndex = doc.indexOf("The three standing defects");
  assert.ok(defectsIndex > w3Index, "expected the standing-defects list to follow the implementation split table");
  for (const defect of ["Dispatch button drops", "mode pill mixes grammars", "active/stale arithmetic"]) {
    assert.ok(doc.includes(defect), `expected the doc to name the defect "${defect}"`);
  }
});
