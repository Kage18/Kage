// Visual foundation pass over the Room chat, sidebar, and board headers — presentation
// only, checked against docs/design/mockups/Main.dc.html and Board.dc.html. Same
// convention as audit-driven-parity-pass.test.ts: the app is TS template literals, so
// these read the COMPOSED page as a string, never a DOM.
//
// REVERT CHECK, one per group: the string/regex each test matches against vanishes
// from the composed script/style the moment its corresponding fix is reverted.

import test from "node:test";
import assert from "node:assert/strict";

import { delegationAppHtml } from "./delegation/app-html.js";

function composedScript(): string {
  const html = delegationAppHtml("test-token");
  const script = html.split("<script>")[1]?.split("</" + "script>")[0];
  assert.ok(script, "composed page must have a bare inline <script> with no src attribute");
  return script!;
}
function composedStyle(): string {
  const html = delegationAppHtml("test-token");
  const match = html.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(match, "composed page must have an inline <style> block");
  return match![1];
}

test("the chat thread column and its composer share the same 712px content width, not two independently-centered boxes", () => {
  const css = composedStyle();
  assert.match(css, /\.room-col \{ max-width:760px; width:100%; margin:0 auto; padding:32px 24px 8px;/);
  assert.match(css, /\.room-cwrap \{ display:flex; gap:10px; align-items:flex-end; background:var\(--inset\); border:1px solid var\(--line\);\s*\n\s*border-radius:var\(--r-card\); padding:10px 14px; max-width:712px; margin:0 auto; \}/);
});

test("a kage reply reads as real prose (15px/1.7) while a you turn gets a tinted, radiused block instead of a bare rule down the side", () => {
  const css = composedStyle();
  assert.match(css, /\.turn\.kage \.bubble2 \{ color:var\(--text\); max-width:68ch; font-size:15px; line-height:1\.7; \}/);
  assert.match(css, /\.turn\.you \.bubble2 \{ background:var\(--surface\); border-radius:12px; padding:12px 16px; \}/);
});

test("the DONE/AGE turn-boundary rule is gone from the history-fallback renderer — a quiet done/age/tool-count line hangs off the kage reply it reports on instead", () => {
  const script = composedScript();
  assert.match(script, /function turnMetaLine\(atIso, toolCount\) \{/);
  assert.match(script, /if \(turn\.role === "kage"\) wrap\.appendChild\(turnMetaLine\(turn\.at, turn\.tools \? turn\.tools\.length : 0\)\);/);
  // The old floating separator's own construction (a rule + a "done" label built
  // from the PREVIOUS turn, inserted ahead of the next "you" turn) must be gone —
  // not just unused, since a leftover copy would silently keep firing.
  assert.ok(!/turn\.role === "you" && index > 0/.test(script),
    "the old before-the-next-you-turn boundary check must be gone, not merely dead code beside the new one");
});

test("consecutive tool-call lines collapse into one shared, expandable toolgroup chip — reused by both the transcript and history-fallback renderers instead of two diverging implementations", () => {
  const script = composedScript();
  assert.match(script, /function toolGroupChip\(tools\) \{/);
  const historyBody = script.slice(script.indexOf("function renderHistoryTurns"), script.indexOf("function renderTranscriptTurns"));
  assert.match(historyBody, /wrap\.appendChild\(toolGroupChip\(turn\.tools\)\);/);
  const transcriptBody = script.slice(script.indexOf("function renderTranscriptTurns"));
  assert.match(transcriptBody.slice(0, transcriptBody.indexOf("\nfunction ", 10)), /wrap\.appendChild\(toolGroupChip\(turn\.tools\)\);/);
});

test("turn rhythm matches the pass's own numbers: 26px between turns, 6px label-to-block (the turn's own flex gap), 8px reply-to-meta (gap plus the meta line's own 2px)", () => {
  const css = composedStyle();
  assert.match(css, /gap:26px; flex:1; box-sizing:border-box; \}/);
  assert.match(css, /\.turn \{ display:flex; flex-direction:column; gap:6px; max-width:100%; align-self:stretch; \}/);
  assert.match(css, /\.turn \.meta2 \{ font-family:var\(--mono\); font-size:10px; color:var\(--text3\); padding:0 3px; margin-top:2px; \}/);
});

test("every project row carries a dot (green when active, dim otherwise), and the sidebar fleet indents under the active one with a 12px left rule", () => {
  const script = composedScript();
  assert.match(script, /pn\.appendChild\(h\("span", "pdot" \+ \(current \? "" : " dim"\)\)\);/);
  const css = composedStyle();
  assert.match(css, /\.prow \.pdot \{ width:6px; height:6px; border-radius:50%; background:var\(--green\); flex:none; \}/);
  assert.match(css, /\.prow \.pdot\.dim \{ background:var\(--line-strong\); \}/);
  assert.match(css, /\.pfleet \{ margin-left:12px; padding:2px 2px 8px 12px; border-left:1px solid var\(--line\);/);
});

test("board zone header words are sentence case, not letter-spaced small caps — the dot beside each one already carries the state, and 14px still clears before the first card", () => {
  const css = composedStyle();
  assert.match(css, /\.bh \{ display:flex; align-items:center; gap:7px; font-family:var\(--mono\); font-size:10px;\s*\n\s*color:var\(--text3\); margin:4px 6px 14px; \}/);
  assert.ok(!/\.bh \{[^}]*text-transform:uppercase/.test(css), "the board zone header must not be forced to uppercase any more");
});

// --- section 9: DE-TEXT (owner feedback mid-run) -----------------------------------

test("de-text 9a — the sidebar path only renders on the active project row; an inactive row is just its name, no permanently-visible path text", () => {
  const script = composedScript();
  assert.match(script, /if \(current\) row\.appendChild\(h\("div", "pp", project\.dir\.replace/);
});

test("de-text 9b — the composer teaches at most two shortcuts, in one centered line, and hides itself for good once a real send AND a real dispatch have both succeeded", () => {
  const html = delegationAppHtml("test-token");
  assert.ok(html.includes('<div class="room-hint" id="room-hint">⏎ ask Kage · ⌘⏎ dispatch a run now</div>'),
    "the hint row must carry an id (so JS can hide it) and at most two shortcuts");
  const script = composedScript();
  assert.match(script, /function markComposerTaught\(flag\) \{/);
  assert.match(script, /function updateRoomHintVisibility\(\) \{/);
  assert.match(script, /taught = localStorage\.getItem\("kageSentMsg"\) === "1" && localStorage\.getItem\("kageDispatchedRun"\) === "1";/);
  assert.match(script, /markComposerTaught\("kageSentMsg"\)/, "a successful room message must mark the send half taught");
  assert.match(script, /markComposerTaught\("kageDispatchedRun"\)/, "a successful ⌘⏎ dispatch must mark the dispatch half taught");
});

test("de-text 9c — the status bar keeps the counts that matter plus one Cmd+K affordance, not the full keyboard-shortcut sentence", () => {
  const html = delegationAppHtml("test-token");
  assert.ok(html.includes('<span class="right"><span id="st-counts"></span><span>⌘K commands</span></span>'));
  assert.ok(!html.includes("⌘N new run"), "the New-run and next-needing-you shortcut hints must be gone from the status bar's permanent text");
});

test("de-text 9e — the history-fallback's transcript-availability note is one short dim line, not a full sentence", () => {
  const script = composedScript();
  assert.match(script, /turnsEl\.appendChild\(h\("div", "meta2", state\.room\.has_transcript \? "summary — transcript loading" : "summary only"\)\);/);
  assert.ok(!script.includes("showing the manager's summary"), "the old two-sentence version must be gone, not left beside the new one");
});
