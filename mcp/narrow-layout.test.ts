// Covers the narrow-width (phone) layout in mcp/delegation/app-styles.ts and the
// mobile-detail toggle in mcp/delegation/app-client.ts — the follow-through on LAN
// mode: a phone can now reach the daemon, and this is the page it lands on. New
// behaviour gets its own file per repo convention; mcp/delegation.test.ts is
// off-limits for new tests.
//
// Three measured defects at 390px clientWidth drove this file:
//   1. .top overflowed (390 clientWidth vs 565 scrollWidth) with no wrap/scroll.
//   2. #work-split's .list resolved max-height:38% against an implicit grid row,
//      compounding into a 235px dead zone between the list and the detail pane.
//   3. .board's two 220px-floor columns could not fit under a 390px viewport.
//
// REVERT CHECK: reverting the app-styles.ts narrow-media-query change fails
// "the narrow media query fixes each of the three measured defects" first — the
// block would go back to grid-template-columns:1fr / max-height:38% / a two-column
// board with no narrow topbar rules at all. Reverting the app-client.ts mobile-detail
// change fails "renderWork/selectRun drive the narrow single-pane Work toggle" first.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { delegationAppHtml } from "./delegation/app-html.js";

function composedStyle(): string {
  const html = delegationAppHtml("test-token");
  const match = html.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(match, "composed page must have an inline <style> block");
  return match![1];
}

function composedScript(): string {
  const html = delegationAppHtml("test-token");
  const scriptMatches = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  const inline = scriptMatches.filter((m) => !/\bsrc\s*=/.test(m[1] ?? "")).pop()?.[2];
  assert.ok(inline, "composed page must have an inline <script> with no src attribute");
  return inline!;
}

// Extracts the single narrow-width media block by counting braces from its opening
// `{` — the block itself nests one level of rule braces, so a naive first-`}` match
// would truncate it.
function narrowMediaBlock(style: string): string {
  const at = style.indexOf("@media (max-width:900px)");
  assert.ok(at >= 0, "app-styles.ts must define the @media (max-width:900px) narrow breakpoint");
  const open = style.indexOf("{", at);
  assert.ok(open >= 0);
  let depth = 0;
  for (let i = open; i < style.length; i++) {
    if (style[i] === "{") depth++;
    else if (style[i] === "}") {
      depth--;
      if (depth === 0) return style.slice(open + 1, i);
    }
  }
  throw new Error("unbalanced braces in the narrow media block");
}

test("exactly one narrow breakpoint exists — a real narrow design, not a second patch stacked on the first", () => {
  const style = composedStyle();
  const count = (style.match(/@media \(max-width:900px\)/g) || []).length;
  assert.equal(count, 1, "there must be exactly one @media (max-width:900px) block, not a fourth patch alongside a third");
});

test("defect 1 fixed: the narrow topbar sheds the wordmark, the seg keycaps, and New run's label so every control fits at 390px", () => {
  const block = narrowMediaBlock(composedStyle());
  assert.match(block, /\.appname\s*\{[^}]*display:\s*none/, "the wordmark must collapse at narrow width");
  assert.match(block, /\.seg button \.k\s*\{[^}]*display:\s*none/, "the seg buttons' keycap hints must collapse at narrow width");
  assert.match(block, /\.mnew-lbl\s*\{[^}]*display:\s*none/, "New run's text label must collapse to its icon at narrow width");
  assert.match(block, /\.mnew-ic\s*\{[^}]*display:\s*inline-block/, "New run's icon must take over once the label is gone");
});

test("defect 2 fixed: no percentage max-height on .list at narrow width, and the single visible pane fills the full height", () => {
  const block = narrowMediaBlock(composedStyle());
  assert.ok(!/max-height:\s*38%/.test(block), "the percentage max-height that compounded into a 235px dead zone must be gone");
  assert.match(block, /\.list\s*\{[^}]*max-height:\s*none/, ".list must no longer be capped by a percentage of an implicit grid row");
  assert.match(block, /\.runs\s*\{[^}]*grid-template-columns:\s*1fr/, "the work split collapses to one column at narrow width");
  // The single-pane-at-a-time model: only one of .list/.detail is visible per state,
  // gated on #v-work.mobile-detail (set by selectRun/renderWork in app-client.ts).
  assert.match(block, /#v-work\.mobile-detail:not\(\.layout-board\)\s*\.list\s*\{[^}]*display:\s*none/);
  assert.match(block, /#v-work\.mobile-detail:not\(\.layout-board\)\s*\.detail\s*\{[^}]*display:\s*flex/);
});

test("defect 3 fixed: .board is single-column below the phone breakpoint, not a two-column layout with a 220px floor", () => {
  const block = narrowMediaBlock(composedStyle());
  assert.ok(!/repeat\(2,\s*minmax\(220px/.test(block), "the two-220px-column board that forced sideways scroll must be gone");
  assert.match(block, /\.board\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, ".board must resolve to exactly one column at narrow width");
});

test("desktop rules are unchanged: the list-beside-detail split and the four-column board still hold at full width", () => {
  const style = composedStyle();
  assert.match(style, /\.runs\s*\{\s*display:grid;\s*grid-template-columns:340px 1fr;\s*flex:1;\s*min-height:0;\s*\}/,
    "the desktop 340px-list + detail split must be byte-identical to before this change");
  assert.match(style, /\.board\s*\{\s*display:grid;\s*grid-template-columns:repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
    "the desktop four-column board must be unchanged");
});

test("touch targets are widened only inside the narrow block — desktop hit areas are untouched", () => {
  const style = composedStyle();
  const block = narrowMediaBlock(style);
  assert.match(block, /\.wrow\s*\{[^}]*min-height:\s*44px/, "work rows must grow a real tap target at narrow width");
  assert.match(block, /\.gwchip\s*\{[^}]*width:\s*22px/, "goal-wave chips (16x16 at desktop) must grow to a tappable size at narrow width");
  // The desktop .wrow rule (outside the media block) must not carry a min-height —
  // that would be a regression to the primary desktop surface.
  const desktopWrow = style.slice(0, style.indexOf("@media (max-width:900px)")).match(/\.wrow\s*\{[^}]*\}/);
  assert.ok(desktopWrow && !/min-height/.test(desktopWrow[0]), "desktop's .wrow must not gain a min-height from this change");
});

test("the project rail's switch/remove controls, hidden with .side below 900px, are reachable via the palette trigger and the settings modal", () => {
  const style = composedStyle();
  const block = narrowMediaBlock(style);
  // .narrow-only is off by default (so nothing changes at desktop) and only
  // switched on inside the narrow block, where .side goes display:none.
  assert.match(style.slice(0, style.indexOf("@media (max-width:900px)")), /\.narrow-only\s*\{[^}]*display:\s*none/);
  assert.match(block, /\.narrow-only\s*\{[^}]*display:\s*inline-block/, "the narrow-only palette trigger must become reachable under the breakpoint");
  // Reused inside the settings modal, the rail's own .pforget must not depend on
  // :hover — there is no hover on a phone.
  assert.match(style, /\.settings-projects \.prow \.pforget\s*\{[^}]*display:\s*block/,
    "the settings-modal project list must show its remove control unconditionally, not on :hover like the rail");
});

test("app-client.ts wires selectRun/renderWork/Escape to the narrow mobile-detail toggle and the palette trigger button", () => {
  const script = composedScript();
  assert.match(script, /state\.mobileDetailOpen = true/, "selecting a run must open the narrow detail pane");
  assert.match(script, /view\.classList\.toggle\("mobile-detail"/, "renderWork must drive the CSS class the narrow media block reads");
  assert.match(script, /getElementById\("m-palette"\)\.onclick/, "the narrow-only topbar button must open the command palette");
  assert.match(script, /Other projects/, "the settings modal must render the narrow-width project list");
});

test("the composed app page still parses as valid JS after the narrow-layout changes", () => {
  const script = composedScript();
  const dir = mkdtempSync(join(tmpdir(), "kage-narrow-layout-test-"));
  try {
    const file = join(dir, "composed-app.js");
    writeFileSync(file, script, "utf8");
    // Same class of bug the receipt redesign guarded against: a raw backtick or
    // un-escaped ${ inside app-client.ts breaks the composed page even though
    // app-client.ts alone is valid TypeScript.
    execFileSync(process.execPath, ["--check", file], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
