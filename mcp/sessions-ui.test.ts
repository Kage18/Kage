// Covers the W2 renderer pass: docs/design/SESSIONS_SURFACE.md's seven pieces, all
// implemented inside mcp/delegation/app-client.ts / app-styles.ts / app-html.ts (which
// are TS template literals — the composed page IS the product, so these tests read the
// composed string the same way delegation-api.test.ts and narrow-layout.test.ts already
// do, never a DOM). New behaviour gets its own file per repo convention;
// mcp/delegation.test.ts is off-limits for new tests.
//
// REVERT CHECK, one per piece (see individual test bodies for the exact assertion that
// would fail): sidebar fleet -> "renderSidebarFleet"/".pfleet" vanish; chat register ->
// the /room/transcript fetch and renderTranscriptTurns vanish; ghost text -> "ghost-on"
// and the Tab-accept branch vanish; cards -> the five-field cardCoreAtoms helper and the
// verdict chip vanish, and the old bespoke card labels ("awaiting merge" et al.) return;
// mode grammar -> "Delivers now"/"Queues" revert to "Deliver now"/"Queuing"; preflight
// space -> ".modal .preflight" loses "visibility:hidden"/"min-height"; memory numbers ->
// the "active" tile reverts to a bare mem.health.approved with no subtraction.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { delegationAppHtml } from "./delegation/app-html.js";

function composedHtml(): string {
  return delegationAppHtml("test-token");
}
function composedScript(): string {
  const html = composedHtml();
  const script = html.split("<script>")[1]?.split("</" + "script>")[0];
  assert.ok(script, "composed page must have a bare inline <script> with no src attribute");
  return script!;
}
function composedStyle(): string {
  const html = composedHtml();
  const match = html.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(match, "composed page must have an inline <style> block");
  return match![1];
}

test("piece 1 — sidebar fleet: the active project renders the orchestrator first, then non-terminal runs by display_name, each with its own dot", () => {
  const script = composedScript();
  assert.match(script, /function renderSidebarFleet/, "the sidebar fleet renderer must exist");
  assert.match(script, /"pfleet"/, "the fleet list must carry its own class");
  assert.match(script, /"Orchestrator"/, "the orchestrator row must be labelled, and painted first in source order");
  assert.match(script, /\["merged", "rejected"\]\.indexOf\(r\.display_state\) < 0/,
    "only non-terminal runs (not merged/rejected) belong in the fleet — the board is where a terminal run lives");
  assert.match(script, /displayName\(run\)/, "the fleet must read display_name (via the displayName helper), not runTitle's derived-from-intent title");
  // Only the ACTIVE project gets a fleet — renderProjects calls it inside `if (current)`.
  assert.match(script, /if \(current\) list\.appendChild\(renderSidebarFleet\(\)\)/);
});

test("piece 2 — chat becomes the session: the Room's Chat tab fetches /room/transcript and prefers it, with the old per-turn history rendering kept only as a documented fallback", () => {
  const script = composedScript();
  assert.match(script, /api\("\/room\/transcript\?session=" \+ encodeURIComponent\(state\.session\)\)/,
    "the Room must fetch the unified-session transcript endpoint");
  assert.match(script, /function renderTranscriptTurns/, "a real transcript renderer must exist");
  assert.match(script, /var useTranscript = Boolean\(state\.transcript && state\.transcript\.total > 0\)/,
    "renderRoom must prefer the real transcript once it has anything to show");
  // Not a SECOND competing rendering: history is the fallback for a thread the pty has
  // never answered (native_transcript_path is pty-only), and the two never render
  // side by side — only one branch of the if/else runs per paint.
  assert.match(script, /if \(useTranscript\) renderTranscriptTurns\(turnsEl, turns\);\s*\n\s*else renderHistoryTurns\(turnsEl, turns\);/);
  // The headless label is shown quietly (turn.manager, already reported by GET /room's
  // RoomHistoryTurn); the pty manager gets no such mention.
  assert.match(script, /turn\.manager === "headless"/);
});

test("piece 3 — Follow graduates to the session-transcript register: an opening prompt block, inline file diffs, exit codes, and duration lines", () => {
  const script = composedScript();
  assert.match(script, /var openPrompt = h\("div", "turn you"\)/, "Follow must open with the brief's intent as a prompt block");
  assert.match(script, /function fileDiffFor/, "Write/Edit toolcards must cross-reference the W1 files tree for inline +/- counts");
  assert.match(script, /function checkExitFor/, "command toolcards must cross-reference the claim's checks for an exit code");
  assert.match(script, /function formatGap/, "duration lines between blocks must be computed from real transcript timestamps");
});

test("piece 4 — the right panel: Receipt/Session Controls/Activity/Files, in that order, always visible rather than behind a tab", () => {
  const script = composedScript();
  assert.match(script, /function renderDetailPanel/, "a dedicated panel renderer must exist");
  const body = script.slice(script.indexOf("function renderDetailPanel"), script.indexOf("function renderDetail() {"));
  const receiptAt = body.indexOf("Receipt");
  const controlsAt = body.indexOf("Session controls");
  const activityAt = body.indexOf("Activity");
  const filesAt = body.indexOf("Files");
  assert.ok(receiptAt >= 0 && controlsAt > receiptAt && activityAt > controlsAt && filesAt > activityAt,
    "the four sections must appear in the design's own order: Receipt, Session Controls, Activity, Files");
  assert.match(body, /FINISHED_RECEIPT_STATES\.indexOf\(run\.display_state\) >= 0/,
    "the receipt is always visible for ready/merged/failed, not gated behind state.tab === \"receipt\"");
  assert.match(script, /run\.state_history/, "Activity must read the kernel's own state_history, never a re-derived summary");
});

test("piece 5 — ghost suggestion: dim placeholder text, Tab or click accepts it, Escape dismisses, absent means absent", () => {
  const script = composedScript();
  const style = composedStyle();
  assert.match(script, /function applyGhostSuggestion/);
  assert.match(script, /function wireGhostInput/);
  assert.match(script, /ev\.key === "Tab" && !inputEl\.value && inputEl\.dataset\.ghost/, "Tab must accept the ghost suggestion into an empty input");
  assert.match(script, /ev\.key === "Escape" && inputEl\.dataset\.ghost/, "Escape must dismiss the ghost suggestion");
  assert.match(script, /inputEl\.classList\.toggle\("ghost-on"/, "the dim styling hook must be a real class, toggled by whether a suggestion exists");
  assert.match(style, /\.ghost-on::placeholder/, "the ghost class must actually be styled dim");
  assert.match(script, /applyGhostSuggestion\(input, d\.suggested_next \|\| null, "Message the agent…"\)/,
    "the run composer must be fed the real suggested_next the API already attaches to run detail");
  // Never auto-sends: accepting only ever assigns inputEl.value, nothing here calls a
  // send function.
  const tabBranch = script.slice(script.indexOf('ev.key === "Tab"'), script.indexOf('ev.key === "Tab"') + 200);
  assert.ok(!/tellRun|sendRoomMessage|dispatchNow/.test(tabBranch), "accepting a ghost suggestion must only fill the input, never send it");
});

test("piece 6 — cards: exactly display_name, branch, state+dot, tokens, age, plus the verdict chip on a finished run; the old bespoke per-state labels are gone", () => {
  const script = composedScript();
  assert.match(script, /function cardCoreAtoms/, "one shared card shape must back every card-shaped surface");
  assert.match(script, /shortBranch\(run\.branch\)/);
  assert.match(script, /stateAtom\.appendChild\(document\.createTextNode\(run\.display_state\)\)/, "the state WORD must render, not only the dot");
  assert.match(script, /compact\(run\.tokens_used\) \+ " tok"/);
  assert.match(script, /function verdictChipFor/, "the VERIFIED n/n chip must read claimVerdict's own label, never a re-derived guess");
  assert.match(script, /verdict\.label\.indexOf\("UNVERIFIED"\)/);
  // Regression guard: the mismatched, per-renderer decoration this design killed.
  assert.ok(!script.includes('"awaiting merge"'), 'the bespoke "awaiting merge" atom must be gone from both card renderers');
  assert.ok(!script.includes('"? waiting"'), 'the bespoke "? waiting" atom must be gone');
  assert.ok(!script.includes('"resumable"'), 'the bespoke "resumable" atom must be gone');
});

test("piece 6b — the mode toggle's two positions share one grammar: both state words, not a command beside a gerund", () => {
  const script = composedScript();
  assert.match(script, /state\.steerQueueMode \? "Queues" : "Delivers now"/);
  assert.ok(!script.includes('"Deliver now"'), "the old imperative label must be gone");
  assert.ok(!script.includes('"Queuing"'), "the old gerund label — the mismatched half of the standing defect — must be gone");
});

test("piece 6c — the Memory dashboard's active tile is total minus stale, never the bare total, and the two stale windows carry distinct labels", () => {
  const script = composedScript();
  assert.match(script, /var activeCount = Math\.max\(0, \(mem\.health\.approved \|\| 0\) - \(mem\.health\.stale \|\| 0\)\)/,
    "active must be derived as total minus stale");
  assert.match(script, /num\(activeCount\), "active"/, "the active tile must render the derived count, not mem.health.approved directly");
  assert.match(script, /"stale packets \(as of last refresh\)"/);
  assert.match(script, /"stale recalls withheld"/, "a second, differently-windowed stale quantity must carry its own distinct label");
  // The two access cards that do not partition the active total get that caveat where
  // a reader can see it, not only in a source comment.
  assert.match(script, /"used recently", false, "One access slice, not a partition/);
  assert.match(script, /"never recalled", false, "One access slice, not a partition/);
});

test("piece 7 — presence banner and the dispatch-modal fixes: an explicit Start action when no orchestrator is live, reserved preflight space, and a cleared status on reopen", () => {
  const script = composedScript();
  const style = composedStyle();
  assert.match(script, /function renderPresenceBanner/);
  assert.match(script, /"No orchestrator is running"/);
  assert.match(script, /api\("\/room\/pty\/snapshot\?session=" \+ encodeURIComponent\(state\.session\)\)/,
    "Start must wire into the SAME pty-attach path the Terminal tab already uses, not a new mechanism");
  assert.match(style, /\.modal \.preflight \{[^}]*visibility:hidden/, "the modal's forecast box must reserve its space via visibility, not display:none");
  assert.match(style, /\.modal \.preflight \{[^}]*min-height:/);
  assert.match(script, /document\.getElementById\("dispatch-flash"\)\.textContent = "";/,
    "reopening the modal must clear the previous dispatch's transient status text");
});

test("the composed page still parses as valid JavaScript after the renderer pass", () => {
  const script = composedScript();
  const dir = mkdtempSync(join(tmpdir(), "kage-sessions-ui-test-"));
  try {
    const file = join(dir, "composed-app.js");
    writeFileSync(file, script, "utf8");
    execFileSync(process.execPath, ["--check", file], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the client script still never assigns innerHTML, even after the renderer pass added a right panel, a fleet list and a transcript view", () => {
  const script = composedScript();
  assert.ok(!script.includes("innerHTML"), "every new element must be built with h(), never a string of HTML");
});
