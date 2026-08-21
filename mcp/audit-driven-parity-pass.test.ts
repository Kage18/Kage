// Parity fixes from the audit-driven pass over docs/design/mockups/*.dc.html: closes
// gaps confirmed as real (not deliberate simplifications) across ReceiptFull,
// MemoryPacket, Memory, TakeOver, RunDetail, WorkList, Board, AddProject, Settings,
// Room, Notifications, and Goal — plus one global .btn.primary fix with wide leverage.
// Same convention as close-three-confirmed-app.test.ts: the app is TS template
// literals, so these read the COMPOSED page as a string, never a DOM.
//
// REVERT CHECK, one per group: the string/regex each test matches against vanishes
// from the composed script/style/HTML the moment its corresponding fix is reverted.

import test from "node:test";
import assert from "node:assert/strict";

import { delegationAppHtml } from "./delegation/app-html.js";
import { readMemoryPacket } from "./delegation/memory-view.js";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

// --- global: .btn.primary reads as a real primary CTA, not a plain filled button ----

test("primary buttons carry near-black bold text on the green fill, matching every mockup's .go/.save/.dispatch treatment — not the previous white/normal-weight look", () => {
  const css = composedStyle();
  assert.match(css, /\.btn\.primary \{ background:var\(--jade\); border-color:var\(--jade\); color:#0c130f; font-weight:700; \}/);
});

// --- ReceiptFull: reverification footer -----------------------------------------------

test("the receipt renders claim.reverified_at as a footer line — real data (contract.ts's ClaimRecord.reverified_at, set by ratify.ts, already served verbatim as detail.claim) that used to reach only the legacy plain-text receipt in verify.ts, never the app's structured card", () => {
  const script = composedScript();
  assert.match(script, /if \(claim\.reverified_at\) \{/);
  assert.match(script, /"checks re-run " \+ revText \+ " — a stale pass is never shown as fresh"/);
  const css = composedStyle();
  assert.match(css, /\.rc-rev \{/);
});

// --- MemoryPacket: header chips, prose body, relabeled feedback footer ----------------

test("readMemoryPacket forwards the catalog's type/status/paths/updated_at fields (already sitting on the matched catalog entry) instead of dropping everything but id/title/body", () => {
  const dir = mkdtempSync(join(tmpdir(), "kage-packet-"));
  mkdirSync(join(dir, ".agent_memory", "indexes"), { recursive: true });
  mkdirSync(join(dir, ".agent_memory", "packets"), { recursive: true });
  writeFileSync(
    join(dir, ".agent_memory", "indexes", "catalog.json"),
    JSON.stringify({
      packets: [
        { id: "repo:x:gotcha:a", title: "T", summary: "S", type: "gotcha", status: "active", tags: [], paths: ["a.ts"], updated_at: "2026-08-21T09:14:00.000Z" },
      ],
    }),
  );
  writeFileSync(join(dir, ".agent_memory", "packets", "a.md"), '---\nx-kage-id: "repo:x:gotcha:a"\n---\n\nbody text');
  const packet = readMemoryPacket(dir, "repo:x:gotcha:a");
  assert.equal(packet.ok, true);
  assert.equal(packet.type, "gotcha");
  assert.equal(packet.status, "active");
  assert.deepEqual(packet.paths, ["a.ts"]);
  assert.equal(packet.updated_at, "2026-08-21T09:14:00.000Z");
});

test("openPacket builds a type + age chip row from the now-available fields, and the overlay HTML carries the chip container plus the mockup's helpful/wrong/stale footer order with its persistent hint", () => {
  const script = composedScript();
  assert.match(script, /if \(out\.type\) chips\.appendChild\(h\("span", "chip", out\.type\)\);/);
  assert.match(script, /if \(out\.updated_at\) chips\.appendChild\(ageSpan\("chip", out\.updated_at, "", " ago"\)\);/);
  const html = composedHtml();
  assert.ok(html.includes('<div class="pchips" id="packet-chips"></div>'));
  assert.match(html, /<button class="fb" data-fb="helpful">helpful<\/button>\s*<button class="fb" data-fb="wrong">wrong<\/button>\s*<button class="fb" data-fb="stale">stale<\/button>/,
    "helpful/wrong/stale, in that order — the mockup's order, not the old Helpful/Out of date/Wrong");
  assert.ok(html.includes('feedback tunes what future briefs carry'));
});

test("the packet body reads as prose (full-brightness text, the shared sans face) instead of a dim monospace text dump", () => {
  const css = composedStyle();
  assert.match(css, /\.packet \.pbody \{ overflow-y:auto; padding:0 22px 24px; font-size:13\.5px; line-height:1\.65;\s*\n\s*white-space:pre-wrap; word-break:break-word; color:var\(--text\); \}/);
});

// --- Memory: chip anatomy -------------------------------------------------------------

test("memory type-filter chips use the panel radius (a soft rectangle, like every other chip in the app) and the selected chip gets a tinted fill, not just a color change", () => {
  const css = composedStyle();
  assert.match(css, /\.mem-chip \{ font-family:var\(--mono\); font-size:11px; padding:4px 10px; border-radius:var\(--r-panel\);/);
  assert.match(css, /\.mem-chip\.on \{ border-color:var\(--seal\); color:var\(--seal\); background:var\(--green-soft\); \}/);
});

// --- TakeOver: the supervision-paused banner, identity chips, friendly title ----------

test("taking over a run's terminal shows the amber supervision-paused banner, taken-over/same-session chips, and a closing hand-back note — none of which existed before, even though the mockup's whole scene is built around them", () => {
  const html = composedHtml();
  assert.ok(html.includes("Supervision is paused while you drive. Kage is not recording checks until you hand back."));
  assert.ok(html.includes('<span class="chip warn">taken over</span>'));
  assert.ok(html.includes('<span class="chip">same session — your keyboard now</span>'));
  assert.ok(html.includes("hand back to resume supervision — the kernel re-runs every check before this can merge, no matter what happens here"));
});

test("openRunTerminal labels the pane with the run's display title (displayName), not the bare run id, the same identity every other surface already uses", () => {
  const script = composedScript();
  assert.match(script, /var termRun = state\.runs\.filter\(function \(r\) \{ return r\.id === runId; \}\)\[0\];/);
  assert.match(script, /document\.getElementById\("run-term-run"\)\.textContent = termRun \? displayName\(termRun\) : runId;/);
});

// --- RunDetail: serif title, labeled session control -----------------------------------

test("the run title reads in the serif display face (matching the mockup's editorial h1), and the delivery-mode toggle carries its own 'Message delivery' label instead of floating unexplained", () => {
  const css = composedStyle();
  assert.match(css, /\.dhead h2 \{ margin:0 0 9px; padding-right:36px; font-family:var\(--serif\); font-size:19px;/);
  const script = composedScript();
  assert.match(script, /controlsRow\.appendChild\(h\("span", "pnl-ctl-label", "Message delivery"\)\);/);
});

// --- WorkList: running gets a real state chip ------------------------------------------

test("a running run's state chip renders green (chip.state-running), instead of silently falling back to the neutral gray base .chip", () => {
  const css = composedStyle();
  assert.match(css, /\.chip\.state-running \{ color:var\(--jade\);/);
});

// --- Board: verdict chip radius ---------------------------------------------------------

test("the board card's verdict chip uses the panel radius like the mockup's .vchip, not a fully-rounded pill", () => {
  const css = composedStyle();
  assert.match(css, /\.atom\.vchip \{ border:1px solid currentColor; border-radius:var\(--r-panel\);/);
});

// --- AddProject: CTA copy, styled orchestrator value -------------------------------------

test("the add-project CTA reads 'Create and open its Room' (the mockup's copy — it lands you there, it doesn't just start a service) and the orchestrator value renders as a styled pill instead of bare unstyled text", () => {
  const html = composedHtml();
  assert.ok(html.includes(">Create and open its Room</button>"));
  const script = composedScript();
  assert.match(script, /goBtn\.textContent = ap\.busy \? "Starting…" : "Create and open its Room";/);
  const css = composedStyle();
  assert.match(css, /#addproject-orchestrator-value \{ font-family:var\(--mono\);/);
});

// --- Settings: row label weight, description contrast, toggle knob ----------------------

test("settings row labels are bold (matching the mockup's .f .n), descriptions use the more legible text2 tone, and the toggle's knob turns near-black once it sits on the green track", () => {
  const css = composedStyle();
  assert.match(css, /\.srow \.label \{ font-size:13\.5px; font-weight:600; \}/);
  assert.match(css, /\.srow \.desc \{ font-size:11\.5px; color:var\(--text2\);/);
  assert.match(css, /\.srow \.toggle\.on i \{ left:22px; background:#0c130f; \}/);
});

// --- Room: send button contrast, thicker you-turn rule -----------------------------------

test("the room's send button matches the app's own dark-on-green CTA convention (already used by .fo-start) instead of white-on-green, and the 'you' turn's rule is 3px wide like the mockup, not 2px", () => {
  const css = composedStyle();
  assert.match(css, /\.room-send \{ background:var\(--seal\); color:#0c130f;/);
  assert.match(css, /\.turn\.you \.bubble2 \{ color:var\(--text2\); max-width:68ch;\s*\n\s*border-left:3px solid var\(--green\); padding-left:14px; \}/);
});

// --- Notifications: label convention, footer hint ----------------------------------------

test("the notifications panel header follows the app's own small-caps mono section-label convention, and a persistent footer hint explains why nothing is ever dismissed", () => {
  const css = composedStyle();
  assert.match(css, /\.notif \.nh \{ padding:13px 16px; border-bottom:1px solid var\(--line2\); font-family:var\(--mono\);/);
  const html = composedHtml();
  assert.ok(html.includes("Notifications resolve themselves when the state changes — nothing to dismiss."));
});

// --- Goal: chip copy, de-duplicated footer, primary dispatch CTA -------------------------

test("the goal overlay's age chip carries the mockup's 'started ... ago' copy instead of the bare age, the footer no longer repeats the spend chip a second time (the header chip row already shows it once), and the due-wave Dispatch button is a primary CTA, not a neutral small button", () => {
  const script = composedScript();
  assert.match(script, /chips\.appendChild\(h\("span", "chip", "started " \+ ago\(goal\.created_at\) \+ " ago"\)\);/);
  assert.match(script, /var dispatchBtn = h\("button", "btn primary sm", "Dispatch wave"\);/);
  assert.ok(!/foot\.appendChild\(h\("span", "atom", spend \|\| "no spend yet"\)\);/.test(script),
    "the footer's duplicate spend atom must be gone — the header chip row already shows it once");
});

// --- window.prompt()/confirm()/alert() are unsupported in Electron / the embedded ------
// browser (they throw "prompt() is not supported"), which silently killed Reject,
// Abandon, Close-thread, and Resume's budget-raise flow in any embedded context.

test("no call site relies on window.prompt/confirm/alert any more — every one of them was replaced by the in-DOM inlineAsk row", () => {
  const script = composedScript();
  // Matches an actual call (an argument follows the open-paren) — not the explanatory
  // comment above inlineAsk(), which names window.prompt()/confirm()/alert() in prose.
  assert.ok(!/window\.prompt\([^)]/.test(script), "window.prompt(...) must not be called anywhere in the composed script");
  assert.ok(!/window\.confirm\([^)]/.test(script), "window.confirm(...) must not be called anywhere in the composed script");
  assert.ok(!/window\.alert\([^)]/.test(script), "window.alert(...) must not be called anywhere in the composed script");
});

test("rejecting a run swaps the trigger for an inline reason row (optional reason, not required) via the shared rejectRunClick/inlineAsk helper, reused by both the actionbar Reject and the claimless-stopped-receipt Reject", () => {
  const script = composedScript();
  assert.match(script, /function rejectRunClick\(run, trigger, presetValue\) \{/);
  assert.match(script, /actOnRun\(run\.id, "reject", reason \? \{ reason: reason \} : \{\}, "Rejecting…", "rejected"\);/,
    "an empty reason must still reject the run, just without a reason in the payload");
  assert.match(script, /reject\.onclick = function \(\) \{ rejectRunClick\(run, reject\); \};/);
  assert.match(script, /receiptReject\.onclick = function \(\) \{ rejectRunClick\(run, receiptReject\); \};/);
});

test("inlineAsk restores the trigger element in place on Cancel/Escape and never touches window.prompt/confirm, with its keydown handler scoped to the row itself (not document) so a torn-down row cannot leak a listener", () => {
  const script = composedScript();
  assert.match(script, /function inlineAsk\(trigger, opts\) \{/);
  assert.match(script, /row\.addEventListener\("keydown", onKey\);/);
  assert.ok(!/document\.addEventListener\("keydown", onKey/.test(script),
    "the listener must be scoped to the row, not document, or a re-render that discards the row leaks it forever");
});
