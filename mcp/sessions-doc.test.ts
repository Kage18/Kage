// docs/design/SESSIONS_SURFACE.md cites real symbols at real file:line locations and
// names two pieces of work as in-flight rather than landed. Same pattern as
// mcp/readme-claims.test.ts and mcp/context-doc.test.ts: a design doc that names code is
// a claim about the code, and this repo's standing failure mode is docs that outrun what
// actually shipped. This file keeps that claim honest four ways: every backtick-quoted
// repo path the doc cites must exist; every symbol an "exists"-style citation names must
// actually appear in the file it's cited against; the two gaps the doc leans its design
// on (no display_name on a run, no stall detector) must still be genuinely absent from
// the real source, not just asserted in prose; and the two in-flight items must still
// read as in-flight, not as already landed.
//
// REGRESSION: delete docs/design/SESSIONS_SURFACE.md, or rename/remove any symbol in
// SYMBOL_CITATIONS below from the file it's cited against (e.g. rename workRow in
// mcp/delegation/app-client.ts), or add a working stall detector or a display_name field
// without updating the doc's gap framing, or reword the doc to claim agent_session_id is
// already persisted live / the chat composer already writes into the orchestrator's own
// pty (i.e. drop the "in flight" language) — any of those fails a test in this file.
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
// PROPOSED field, not yet real) and any stall-detector symbol are deliberately absent
// from this list — they are gaps, checked by the separate test below instead.
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
  { symbol: "claimVerdict", file: "mcp/delegation/verify.ts" },
  { symbol: "renderClaimCard", file: "mcp/delegation/verify.ts" },
  { symbol: "verifyRun", file: "mcp/delegation/verify.ts" },
  { symbol: "MemoryOverview", file: "mcp/delegation/memory-view.ts" },
  { symbol: "kage_dispatch", file: "mcp/index.ts" },
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

test("the doc's display_name gap is real: no run record or dispatch tool has it yet", () => {
  // The doc's whole §2 (Named workers) is specified as new work because TaskRecord and
  // kage_dispatch's schema have no name field today. If either now does, §2 is stale.
  const contractSource = readFileSync(repoPath("mcp/delegation/contract.ts"), "utf8");
  assert.ok(!/display_name/.test(contractSource), "expected no display_name field on TaskRecord yet — if one now exists, doc §2 is stale");
  const indexSource = readFileSync(repoPath("mcp/index.ts"), "utf8");
  const dispatchToolMatch = /name:\s*"kage_dispatch"[\s\S]*?required:\s*\[[^\]]*\]\s*,?\s*}\s*,?\s*}/.exec(indexSource);
  assert.ok(dispatchToolMatch, "expected to find the kage_dispatch tool's inputSchema block in mcp/index.ts");
  assert.ok(
    !/display_name|"name":\s*{\s*type:\s*"string"/.test(dispatchToolMatch![0]),
    "expected kage_dispatch's inputSchema to have no name/display_name param yet — if one now exists, doc §2 is stale",
  );
});

test("the doc's stall-detector gap is real: no stall-detection code exists yet", () => {
  // The doc's §4 (Ghost suggestions) names a stalled-run suggestion as blocked on a
  // detector that doesn't exist yet. If one now does, that clause of §4 is stale.
  const delegationFiles = [
    "mcp/delegation/contract.ts",
    "mcp/delegation/supervisor.ts",
    "mcp/delegation/dispatch.ts",
    "mcp/delegation/steer.ts",
  ];
  // Word-boundary match: "stall"/"stalled"/"stalls" as a whole word, never a substring
  // hit inside "install"/"installed"/"installer" (this repo's actual most common word
  // containing "stall" — a plain /stall/i test false-positives on every one of them).
  const STALL_WORD = /\bstall(ed|s)?\b/i;
  for (const file of delegationFiles) {
    const source = readFileSync(repoPath(file), "utf8");
    assert.ok(!STALL_WORD.test(source), `expected no "stall" identifier in ${file} — if a stall detector now exists, doc §4 is stale`);
  }
});

test("the doc names both cited in-flight items as in-flight, not as already landed", () => {
  const doc = readDoc();
  // Markdown wraps prose at arbitrary columns, so a phrase spanning two source lines
  // (e.g. "...no new\nmechanism — **in flight...") must not be missed just because a
  // newline landed inside it — collapse all whitespace runs to a single space first.
  const flat = doc.replace(/\s+/g, " ").toLowerCase();
  const inFlightMentions = (flat.match(/in flight/g) || []).length;
  // Four uses today: the orchestrator-as-real-session heading (§1), the
  // agent_session_id/Take Over gap (§3b), the stall detector gap (§4), and the W3 row.
  // At least 3 keeps this from being satisfied by a single stray mention while still
  // tolerating minor rewording.
  assert.ok(inFlightMentions >= 3, `expected the doc to name multiple things as "in flight", found ${inFlightMentions}`);
  assert.ok(
    flat.includes("agent_session_id") && flat.includes("closes this gap with no new mechanism — **in flight, not done**"),
    "doc should name the agent_session_id/Take Over gap as in-flight, not as already closed",
  );
  assert.ok(
    flat.includes("unified-session work itself, in flight"),
    "doc's W3 row should state the unified-session work is in flight, not landed",
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
