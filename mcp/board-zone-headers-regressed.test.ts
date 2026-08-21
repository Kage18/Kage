// Board zone headers regressed visually after the visual-foundation merge: a compound
// column like "Idle / Working / Reviewing" wrapped word-by-word, its joined "0 / 0 / 0"
// count fragmented into a vertical stack, the "/" separators between wrapped words read
// as stray bar glyphs, and card chips like "6.4M tok" split "tok" onto its own line.
// Root cause: .bh's dot/word/sep/count children had no grouping or nowrap treatment, so
// a narrow column let the browser wrap the header's plain text and inline elements at
// every space instead of truncating.
//
// Same convention as audit-driven-parity-pass.test.ts: the app is TS template literals,
// so these read the COMPOSED page as a string, never a DOM.
//
// REVERT CHECK: reverting the app-client.ts renderBoard() change (dropping the
// "bh-label" wrapper span so dots/words/sep go straight onto .bh alongside .n) fails
// "renderBoard groups each zone's dot(s) and word(s) into one bh-label atom, separate
// from the count atom" first. Reverting the app-styles.ts change (removing white-space
// treatment from .bh-label/.bh .n/.atom) fails the two CSS-behavior tests below first.

import test from "node:test";
import assert from "node:assert/strict";

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

test("renderBoard groups each zone's dot(s) and word(s) into one bh-label atom, separate from the count atom", () => {
  const script = composedScript();
  assert.match(script, /var label = h\("span", "bh-label"\);/, "the dot/word/sep parts must be built into a dedicated label element, not appended straight onto .bh");
  // The label is filled (dots, words, "/" separators) before it — not the count span —
  // is appended to .bh, and the count span is appended as .bh's second and only other
  // child, carrying the ALREADY-JOINED "0 / 0 / 0" string as one atom.
  const labelBuild = script.slice(script.indexOf('var label = h("span", "bh-label");'));
  assert.match(labelBuild, /label\.appendChild\(dot\);/, "each part's dot must land inside the label, not directly on .bh");
  assert.match(labelBuild, /label\.appendChild\(document\.createTextNode\(part\[0\]\)\);/, "each part's word must land inside the label, not directly on .bh");
  assert.match(labelBuild, /head\.appendChild\(label\);\s*\n\s*head\.appendChild\(h\("span", "n", colBuilt\.counts\.join\(" \/ "\)\)\);/,
    "the label must be appended to .bh before the single joined count span, and the count span must stay the one other child of .bh");
});

test("the .bh-label atom shrinks and ellipsizes instead of wrapping — the count atom next to it never wraps or shrinks", () => {
  const css = composedStyle();
  assert.match(css, /\.bh-label \{[^}]*white-space:nowrap[^}]*\}/, "the label (dots + words) must never wrap word-by-word");
  assert.match(css, /\.bh-label \{[^}]*overflow:hidden[^}]*text-overflow:ellipsis[^}]*\}/, "a too-narrow label must truncate with an ellipsis, not overflow or wrap");
  assert.match(css, /\.bh-label \{[^}]*min-width:0[^}]*\}/, "the label needs min-width:0 to actually shrink inside .bh's flex row instead of forcing .bh wider");
  assert.match(css, /\.bh \.n \{[^}]*white-space:nowrap[^}]*\}/, "the joined count atom (e.g. \"0 / 0 / 0\") must never wrap internally");
  assert.match(css, /\.bh \.n \{[^}]*flex:none[^}]*\}/, "the count atom must hold its natural width rather than shrinking alongside the label");
  // .bh itself is pinned byte-for-byte by visual-foundation-pass-on.test.ts's
  // "board zone header words are sentence case" test — this fix must not touch it.
  assert.match(css, /\.bh \{ display:flex; align-items:center; gap:7px; font-family:var\(--mono\); font-size:10px;\s*\n\s*color:var\(--text3\); margin:4px 6px 14px; \}/,
    "this fix must add sibling rules, not edit .bh's own pinned declaration block");
});

test("card chips and stat atoms (branch, state, '6.4M tok', 'VERIFIED n/n') never split a word across lines", () => {
  const css = composedStyle();
  assert.match(css, /\.atom \{[^}]*white-space:nowrap[^}]*\}/,
    "every .atom (cardCoreAtoms' branch/state/token chips, verdictChipEl's VERIFIED chip) must carry white-space:nowrap so e.g. '6.4M tok' never wraps 'tok' onto its own line");
});
