// Closes three confirmed app/design gaps against the committed mockups in
// docs/design/mockups/: FirstOpen.dc.html (the Room's first-open teach screen),
// Palette.dc.html (the command palette's go/do grouping), and BoardLight.dc.html
// (the light theme). The app is authored as TS template literals in
// mcp/delegation/app-client.ts / app-styles.ts / app-html.ts, so — per
// sessions-ui.test.ts's own convention — most of this reads the COMPOSED page as a
// string, never a DOM. paletteCommands() is the one exception: it is a pure function
// that touches no DOM, so dead-ends.test.ts's "run the actual code, not a text match"
// harness applies directly and catches an ordering regression regex could miss.
//
// REVERT CHECK, one per piece:
//  - first-open: the "firstOpen" computation, the primer-default/primer-firstopen
//    toggle, or renderPresenceBanner's firstOpen suppression vanish from the
//    composed script; or the teach card's own copy vanishes from the composed HTML.
//  - palette: "Next needing you" falls back outside paletteCommands("")'s default
//    12-item slice, and the pgrp/verb group-heading rendering vanishes.
//  - theme: "@media (prefers-color-scheme: light)" and ":root[data-theme=\"dark\"]"
//    vanish from the composed stylesheet.

import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";

import { delegationAppHtml } from "./delegation/app-html.js";
import { APP_CLIENT } from "./delegation/app-client.js";

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

// --- 1. first-open teach screen (FirstOpen.dc.html) ---------------------------------

test("renderRoom computes a firstOpen state (no orchestrator live, no turns, no runs) and swaps the primer's default/firstOpen children on it, never dropping the toggle into a per-tick rebuild", () => {
  const script = composedScript();
  assert.match(script, /var firstOpen = !state\.room\.live && !turns\.length && !\(state\.runs \|\| \[\]\)\.length/,
    "first-open must require no live orchestrator, no turns, and no dispatched runs");
  assert.match(script, /document\.getElementById\("primer-default"\)\.style\.display = firstOpen \? "none" : "block"/);
  assert.match(script, /document\.getElementById\("primer-firstopen"\)\.style\.display = firstOpen \? "block" : "none"/);
  // firstOpen folds state.runs into the room's render signature — otherwise a run
  // dispatched with the orchestrator still down would never flip the primer, since
  // runs.length was not previously part of what renderRoom gates a rebuild on.
  assert.match(script, /"\|" \+ \(firstOpen \? "1" : "0"\)/);
});

test("the thin \"no orchestrator\" presence banner is suppressed on first-open — the teach card already says it, with its own Start button", () => {
  const script = composedScript();
  assert.match(script, /function renderPresenceBanner\(firstOpen\)/);
  assert.match(script, /if \(state\.room\.live \|\| firstOpen\) \{ banner\.style\.display = "none"; return; \}/);
  assert.match(script, /renderPresenceBanner\(firstOpen\)/, "renderRoom must pass its own firstOpen down to the banner");
});

test("the Start button on both the teach card and the thin banner share one startOrchestrator helper — no second start mechanism", () => {
  const script = composedScript();
  assert.match(script, /function startOrchestrator\(btn, label\)/);
  assert.match(script, /document\.getElementById\("fo-start"\)\.onclick = function \(\) \{\s*startOrchestrator\(document\.getElementById\("fo-start"\), "Start the orchestrator"\);/);
  assert.match(script, /start\.onclick = function \(\) \{ startOrchestrator\(start, "Start"\); \}/);
});

test("FirstOpen.dc.html's own copy — headline, Start button, and the three keystroke teach rows — reached the composed page, replacing whatever bare empty state existed before", () => {
  const html = composedHtml();
  assert.ok(html.includes('id="primer-firstopen"'), "the first-open variant must live in its own toggle target");
  assert.ok(html.includes("No orchestrator is running for this project."));
  assert.ok(html.includes('<button class="fo-start" id="fo-start">Start the orchestrator</button>'));
  assert.ok(html.includes("nothing is faked meanwhile"), "the line stating nothing is simulated while the board fills");
  assert.ok(html.includes('<span class="k">⏎</span>ask Kage anything about this repo'), "Enter = send/steer");
  assert.ok(html.includes('<span class="k">⌘⏎</span>dispatch a single run directly'), "Cmd+Enter = queue a run directly");
  assert.ok(html.includes('<span class="k">⌥⏎</span>orchestrate a multi-run goal'), "Alt+Enter = orchestrate as a goal");
});

// --- 2. command palette (Palette.dc.html) --------------------------------------------

interface FakeState {
  sessions: { key: string; title: string }[];
  projects: unknown[];
  runs: unknown[];
  session: string;
  projectDir: string;
}

function loadSandbox(): Record<string, unknown> {
  // paletteCommands touches no DOM at all — it only reads state.sessions/projects/runs
  // and builds an array of {grp, name, hint, run} — so the same "let the top-level
  // DOM wiring throw past the hoisted function declarations" trick dead-ends.test.ts
  // uses is enough here, with no DOM stubbing beyond what state assignment needs.
  const sandbox: Record<string, unknown> = {
    document: { getElementById: () => null, createElement: () => ({ children: [], appendChild() {} }), body: { classList: undefined } },
    navigator: { userAgent: "" },
    window: {},
    console,
  };
  try {
    runInNewContext(APP_CLIENT, sandbox, { timeout: 2000 });
  } catch {
    // Expected — see comment above. state (assigned before the throw point) and every
    // function declaration (hoisted regardless of the throw) are still usable.
  }
  return sandbox;
}

test("paletteCommands leads the \"do\" group with New run…, Orchestrate as a goal…, and Next needing you — Palette.dc.html's own order — and all three land inside the default query's 12-item cap", () => {
  const sandbox = loadSandbox();
  const state = sandbox.state as FakeState;
  assert.equal(state.runs.length, 0, "default state has no runs — sanity check that state actually initialized before the harness's expected throw");
  const paletteCommands = sandbox.paletteCommands as (q: string) => { grp: string; name: string; hint?: string; run: () => void }[];
  const cmds = paletteCommands("");
  assert.equal(cmds.length, 12, "the default (empty-query) listing is capped at 12");
  // cmds/names are built inside the vm sandbox's own realm — comparing them against
  // an outer-realm array/object literal with deepStrictEqual fails on prototype
  // identity alone even when every value matches, so primitive-by-primitive is the
  // safe comparison here (strings are primitives, unaffected by which realm made them).
  const names = cmds.map((c) => c.name).join("|");
  assert.equal(names.split("|").slice(0, 3).join("|"), "Room|Work|Memory", "the go group leads, in the mockup's order");
  const nameList = names.split("|");
  assert.equal(nameList[3], "New run…", "New run… must lead the do group");
  assert.equal(nameList[4], "Orchestrate as a goal…");
  assert.ok(nameList.indexOf("Next needing you") >= 0 && nameList.indexOf("Next needing you") < 12,
    "Next needing you must appear in the DEFAULT listing — it used to sit past the 12-item cap and never showed without typing a filter for it");
  assert.equal(cmds[0].grp, "go");
  assert.equal(cmds[0].name, "Room");
  assert.equal(cmds[0].hint, "1");
  assert.equal(typeof cmds[0].run, "function");
});

test("renderPalette groups rows under a per-group heading (Palette.dc.html's own GO/DO section labels) and tags go/do rows with their own verb, instead of repeating the group name on every row", () => {
  const script = composedScript();
  assert.match(script, /if \(c\.grp !== lastGrp\) \{\s*box\.appendChild\(h\("div", "pgrp", c\.grp\)\);/,
    "a group heading must be inserted whenever the group changes");
  assert.match(script, /if \(c\.grp === "go" \|\| c\.grp === "do"\) row\.appendChild\(h\("span", "verb", c\.grp\)\)/,
    "go/do rows must carry their own verb tag, the way the mockup's .verb does");
  assert.ok(!/row\.appendChild\(h\("span", "grp", c\.grp\)\)/.test(script),
    "the old per-row grp label (repeating the group name on every row) must be gone, replaced by the section heading");
});

test("the palette CSS matches Palette.dc.html's look: a group-heading rule, a verb tag, and a bordered keycap hint", () => {
  const css = composedStyle();
  assert.match(css, /\.palette \.pgrp \{[^}]*text-transform:uppercase/);
  assert.match(css, /\.palette \.row \.verb \{[^}]*color:var\(--green\)/);
  assert.match(css, /\.palette \.row \.hint \{[^}]*border:1px solid var\(--line\)/, "the hint must read as a keycap, like Palette.dc.html's .k");
});

// --- 3. light theme (BoardLight.dc.html) ---------------------------------------------

test("the light theme follows the OS via prefers-color-scheme, not only an explicit choice — applyTheme's own comment promised this before the CSS existed to back it", () => {
  const css = composedStyle();
  assert.match(css, /@media \(prefers-color-scheme: light\)/,
    "\"system\" mode removes data-theme and relies on the OS preference — without this media query it was silently always dark");
  assert.match(css, /:root:not\(\[data-theme="dark"\]\)\s*\{/,
    "the system-light block must not fire once dark was explicitly chosen, even when the OS itself prefers light");
  assert.match(css, /:root\[data-theme="dark"\]\s*\{/, "an explicit dark pick must be restated so it outranks the light media query");
});

test("the light palette matches BoardLight.dc.html exactly: bg #f2f4f1, green #1f9d63, ink text — in the explicit override and in the system-preference block alike", () => {
  const css = composedStyle();
  const lightBlockCount = (css.match(/--bg:#f2f4f1;/g) || []).length;
  assert.ok(lightBlockCount >= 2, "the light --bg must appear in both the [data-theme=light] override and the prefers-color-scheme block");
  assert.ok((css.match(/--green:#1f9d63;/g) || []).length >= 2);
  assert.ok((css.match(/--text:#141714;/g) || []).length >= 2);
  // Terminal/code surfaces stay dark in both themes, as designed — same --code-bg
  // regardless of which theme block is active.
  const codeBg = [...css.matchAll(/--code-bg:(#[0-9a-f]+);/g)].map((m) => m[1]);
  assert.ok(codeBg.length >= 3 && codeBg.every((v) => v === "#0e1110"), "code-bg must stay the same dark value in every theme block");
});
