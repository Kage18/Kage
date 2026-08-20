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

// vm-sandbox harness for the pure board-card functions, same technique
// render-calm.test.ts / dead-ends.test.ts / receipt.test.ts already use: APP_CLIENT is
// evaluated in a fresh vm context against a minimal DOM stub, and the real functions are
// called directly — no source-text pattern matching for the behaviour under test.
// Function declarations (midTruncate, fillBoardCard, cardCoreAtoms, ...) hoist ahead of
// the top-level DOM wiring that throws in this DOM-less context, so they are all live in
// the sandbox regardless of where execution later aborts.
function fakeElement(tag: string): Record<string, unknown> {
  const attrs: Record<string, string> = {};
  return {
    tagName: tag, className: "", textContent: "", style: {}, children: [] as unknown[],
    appendChild(c: unknown) { (this.children as unknown[]).push(c); return c; },
    setAttribute(k: string, v: string) { attrs[k] = v; },
    getAttribute(k: string) { return attrs[k] ?? null; },
  };
}
function loadClientSandbox(): Record<string, unknown> {
  const sandbox: Record<string, unknown> = {
    document: {
      createElement: (tag: string) => fakeElement(tag),
      createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
      getElementById: () => null,
      querySelectorAll: () => [],
      body: { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
    },
    navigator: { userAgent: "" },
    window: {},
    console,
  };
  try {
    runInNewContext(APP_CLIENT, sandbox, { timeout: 2000 });
  } catch {
    // Expected: top-level DOM wiring past the function declarations throws in this
    // DOM-less context — every function under test is still defined.
  }
  return sandbox;
}

// FAILS ON REVERT: the pre-fix fillBoardCard wrapped .at and .arow inside one shared
// "mid" div appended to a single grid cell — card.children.length would be 1, not 3,
// and that one child's own children (not card's) would hold the name/meta rows.
test("piece 6d — board cards: fillBoardCard renders name, slug and meta as three DIRECT SIBLING rows of the card, and the meta row excludes the raw (untruncated) branch slug", () => {
  const sandbox = loadClientSandbox();
  const fillBoardCard = sandbox.fillBoardCard as (card: Record<string, unknown>, run: Record<string, unknown>) => void;
  assert.equal(typeof fillBoardCard, "function", "fillBoardCard must be defined at the top level of app-client.ts");

  const run = {
    id: "r1", display_state: "running", branch: "kage/write-if-changed-finish-the-render-calm-260820-3502",
    updated_at: new Date().toISOString(), tokens_used: 12345, verdict_label: null,
    display_name: "Write-if-changed: finish the render calm", intent: "irrelevant",
  };
  const card = fakeElement("div");
  fillBoardCard(card, run);

  const rows = card.children as Record<string, unknown>[];
  assert.equal(rows.length, 3, "the card must have exactly three direct-child rows: name, slug, meta");
  assert.equal(rows[0].className, "at", "row 1 must be the name row");
  assert.equal(rows[0].textContent, "Write-if-changed: finish the render calm");
  assert.equal(rows[1].className, "aslug", "row 2 must be the branch/slug row");
  assert.equal(rows[2].className, "arow", "row 3 must be the meta cluster row");

  // Row 2 is middle-truncated (see the dedicated midTruncate test below); row 3 must
  // NOT also carry the full, untruncated branch text — the branch lives in row 2 only.
  const metaTexts = (rows[2].children as Record<string, unknown>[]).map((c) => c.textContent);
  assert.ok(!metaTexts.includes(run.branch) && !metaTexts.some((t) => typeof t === "string" && t.indexOf("write-if-changed-finish") >= 0),
    "the meta row (row 3) must not repeat the full branch slug — that belongs to row 2 only");
});

// FAILS ON REVERT: reverting to a plain shortBranch(run.branch) (no midTruncate call)
// makes the "exactly one ellipsis, capped length" assertions fail on any branch longer
// than 31 characters — real run slugs like write-if-changed-finish-the-render-calm-260820-3502 always are.
test("piece 6e — board cards: the middle-truncation helper keeps a leading and trailing slice with exactly one ellipsis, and never exceeds head + 1 + tail", () => {
  const sandbox = loadClientSandbox();
  const midTruncate = sandbox.midTruncate as (text: string, head: number, tail: number) => string;
  assert.equal(typeof midTruncate, "function", "midTruncate must be defined at the top level of app-client.ts");

  const long = "write-if-changed-finish-the-render-calm-260820-3502";
  const out = midTruncate(long, 18, 12);
  assert.equal(out, long.slice(0, 18) + "…" + long.slice(long.length - 12), "must be exactly the 18-char head + one ellipsis + 12-char tail");
  assert.equal((out.match(/…/g) || []).length, 1, "exactly one ellipsis character");
  assert.ok(out.length <= 18 + 1 + 12, "truncated output must never exceed head + 1 + tail characters");
  assert.ok(out.endsWith("260820-3502"), "the trailing -YYMMDD-serial must survive untouched, exactly as the brief requires");

  const short = "kage/fix-thing-1a2b";
  assert.equal(midTruncate(short, 18, 12), short, "text already within the cap must pass through unchanged, not gain a spurious ellipsis");
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
  assert.match(script, /if \(on\) \{[\s\S]*?clearFlash\(\);[\s\S]*?\}/,
    "reopening the modal must clear the previous dispatch's transient status text (now via the shared clearFlash() helper — see the flash-TTL tests below)");
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

// --- three topbar/app-shell defects, all confirmed live in the running app -----------
//
// 1. THE GEAR OPENED THE WRONG SURFACE — clicking #m-settings (title "project
//    settings") opened the New-run modal instead of the Project-settings overlay.
// 2. TRANSIENT FLASH TEXT SURVIVED INTO A FRESH MODAL — a freshly opened New-run
//    modal still showed .flash text ("dispatched") from a run dispatched an hour
//    earlier.
// 3. A STALE MUTATION TOKEN TURNED EVERY ACTION INTO A BARE "refused" — the daemon
//    restarting under an open tab left every mutating call 401ing with no recovery.

test("piece 8a — the topbar gear (#m-settings, title \"project settings\") opens Project settings, not the New-run modal — the two are bound to distinct openers", () => {
  const script = composedScript();
  const html = composedHtml();
  assert.match(html, /<button class="iconbtn" id="m-settings" title="project settings">/, "the gear button must carry its documented title");

  assert.match(script, /document\.getElementById\("m-new"\)\.onclick = function \(\) \{ showOverlay\(true\); \};/,
    "New-run's own icon button must open showOverlay(true)");
  assert.match(script, /document\.getElementById\("m-settings"\)\.onclick = function \(\) \{ showSettings\(true\); \};/,
    "the gear must open showSettings(true) — reproduced live: it opened the New-run modal instead, twice");

  // Generalized per the fix: no OTHER topbar icon button's own onclick wiring may
  // ALSO reference showOverlay(true) or showSettings(true) — two buttons silently
  // sharing one opener is exactly how the gear ended up on New-run's handler.
  ["m-palette", "m-theme", "m-bell"].forEach((id) => {
    const assignAt = script.indexOf("document.getElementById(\"" + id + "\").onclick");
    assert.ok(assignAt >= 0, "#" + id + " must have its own top-level onclick wiring");
    const nextAssignAt = script.indexOf("\ndocument.getElementById(", assignAt + 1);
    const body = script.slice(assignAt, nextAssignAt >= 0 ? nextAssignAt : assignAt + 400);
    assert.ok(!body.includes("showOverlay(true)"), "#" + id + " must not also open the New-run modal");
    assert.ok(!body.includes("showSettings(true)"), "#" + id + " must not also open Project settings");
  });
});

test("piece 8b — every overlay/modal-open path clears the stale flash, not just the dispatch modal it was first found in", () => {
  const script = composedScript();
  // Every gap is bounded (not open-ended [\s\S]*) so a revert that DROPS clearFlash()
  // from one function cannot pass by accidentally matching some unrelated, much later
  // clearFlash() call elsewhere in the script.
  const openers: Array<[string, RegExp]> = [
    ["showOverlay(true) — New-run modal", /function showOverlay\(on\) \{[\s\S]{0,200}?if \(on\) \{[\s\S]{0,400}?clearFlash\(\);/],
    ["showSettings(true) — Project settings", /function showSettings\(on\) \{[\s\S]{0,250}?clearFlash\(\);/],
    ["showAddProject(true) — Add project", /function showAddProject\(on\) \{[\s\S]{0,300}?clearFlash\(\);/],
    ["showPalette(true) — command palette", /function showPalette\(on\) \{[\s\S]{0,200}?if \(on\) \{[\s\S]{0,50}?clearFlash\(\);/],
    ["openGoalDetail — goal detail overlay", /function openGoalDetail\(goalId\) \{[\s\S]{0,50}?clearFlash\(\);/],
    ["openPacket — memory packet overlay", /function openPacket\(id\) \{[\s\S]{0,50}?clearFlash\(\);/],
  ];
  openers.forEach(([name, pattern]) => assert.match(script, pattern, name + " must clear stale flash content on open"));
});

// vm-sandbox harness for the pure flash-TTL functions, same technique as
// loadClientSandbox above — a fake document (with a real dispatch-flash stand-in) and
// FAKE, manually-fired timers so the TTL is provable without an actual wait.
function loadFlashSandbox() {
  const flashEl = { textContent: "" };
  const timers: Array<{ id: number; fn: () => void }> = [];
  let nextId = 1;
  const sandbox: Record<string, unknown> = {
    document: {
      createElement: (tag: string) => fakeElement(tag),
      createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
      getElementById: (id: string) => (id === "dispatch-flash" ? flashEl : null),
      querySelectorAll: () => [],
      body: { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
    },
    navigator: { userAgent: "" },
    window: {},
    console,
    setTimeout: (fn: () => void) => { const id = nextId++; timers.push({ id, fn }); return id; },
    clearTimeout: (id: number) => { const at = timers.findIndex((t) => t.id === id); if (at >= 0) timers.splice(at, 1); },
  };
  try {
    runInNewContext(APP_CLIENT, sandbox, { timeout: 2000 });
  } catch {
    // Expected — same DOM-less top-level abort every sandbox test in this file relies
    // on; setFlash/clearFlash/FLASH_TTL_MS are all defined well before the abort point.
  }
  return { sandbox, flashEl, pendingCount: () => timers.length, fireTimers: () => timers.splice(0).forEach((t) => t.fn()) };
}

// FAILS ON REVERT: dropping the TTL (setFlash back to a bare el.textContent = text,
// with no setTimeout) makes the "self-clears once its TTL elapses" assertion fail —
// firing the fake timers would find nothing scheduled and the text would still read
// "dispatched" forever, exactly the live-app defect for any path that never reopens
// the New-run modal at all (e.g. a dispatch fired from elsewhere).
test("piece 8c — the flash helper installs a real expiry: setFlash self-clears after FLASH_TTL_MS even if nothing ever reopens the modal", () => {
  const { sandbox, flashEl, fireTimers } = loadFlashSandbox();
  const setFlash = sandbox.setFlash as (el: unknown, text: string) => void;
  const ttl = sandbox.FLASH_TTL_MS as number;
  assert.equal(typeof ttl, "number", "FLASH_TTL_MS must be defined");
  assert.ok(ttl > 0 && ttl <= 10000, "the TTL must read as \"a few seconds\", not zero and not minutes");

  setFlash(flashEl, "dispatched");
  assert.equal(flashEl.textContent, "dispatched");
  fireTimers();
  assert.equal(flashEl.textContent, "", "the flash must self-clear once its own TTL timer fires");
});

test("piece 8c — clearFlash cancels a pending TTL timer immediately, and a later setFlash never leaves TWO timers racing to clear the same element", () => {
  const { sandbox, flashEl, fireTimers, pendingCount } = loadFlashSandbox();
  const setFlash = sandbox.setFlash as (el: unknown, text: string) => void;
  const clearFlash = sandbox.clearFlash as () => void;

  setFlash(flashEl, "dispatched");
  clearFlash();
  assert.equal(flashEl.textContent, "", "clearFlash must clear the text immediately, not wait for the TTL");
  assert.equal(pendingCount(), 0, "clearFlash must cancel the pending TTL timer, not just blank the text and leave it scheduled");

  // A second setFlash while a first is still pending must cancel the first's timer,
  // not stack a second one alongside it — otherwise a later, unrelated setFlash call
  // could be stomped by an earlier call's leaked timer.
  setFlash(flashEl, "first");
  setFlash(flashEl, "second");
  assert.equal(pendingCount(), 1, "setFlash must cancel any previous pending timer before installing its own");
  fireTimers();
  assert.equal(flashEl.textContent, "", "the one remaining timer still clears the element once its TTL elapses");
});

test("piece 8d — extractTokenFromHtml pulls the token out of a served page's own inline script, the exact shape /app serves at boot", () => {
  const sandbox = loadClientSandbox();
  const extractTokenFromHtml = sandbox.extractTokenFromHtml as (html: string) => string | null;
  assert.equal(extractTokenFromHtml(composedHtml()), "test-token", "must extract the real token app-html.ts embeds at serve time");
  assert.equal(extractTokenFromHtml(delegationAppHtml("a-different-token-99")), "a-different-token-99");
  assert.equal(extractTokenFromHtml("<html>no token in this page</html>"), null, "absent must mean null, not a crash or an empty-string false positive");
});

// FAILS ON REVERT: reverting apiRetryOnce to the old bare fetch-then-.json() (no
// status check, no retry) makes the "retried call's response is returned, not the
// original refused body" assertion fail — the caller would see {ok:false,
// error:"refused"} straight from the first, stale-token call instead.
test("piece 8e — apiRetryOnce: a mutating 401 re-fetches the token the SAME way the page boots with one (GET /app), retries ONCE, and adopts the fresh token on success", async () => {
  const sandbox = loadClientSandbox();
  const apiRetryOnce = sandbox.apiRetryOnce as (
    fetchImpl: (path: string, opts: Record<string, unknown>) => Promise<{ status: number; json?: () => Promise<unknown>; text?: () => Promise<string> }>,
    path: string, opts: Record<string, unknown>, token: string,
  ) => Promise<{ json: unknown; token: string | null }>;

  const calls: Array<{ path: string; opts: Record<string, unknown> }> = [];
  const freshHtml = delegationAppHtml("fresh-token");
  const fetchImpl = (path: string, opts: Record<string, unknown>) => {
    calls.push({ path, opts });
    const headers = (opts.headers || {}) as Record<string, string>;
    if (path === "/runs" && headers.authorization === "Bearer stale-token") {
      return Promise.resolve({ status: 401, json: () => Promise.resolve({ ok: false, error: "refused" }) });
    }
    if (path === "/app") return Promise.resolve({ status: 200, text: () => Promise.resolve(freshHtml) });
    if (path === "/runs" && headers.authorization === "Bearer fresh-token") {
      return Promise.resolve({ status: 200, json: () => Promise.resolve({ ok: true, run: { id: "r1" } }) });
    }
    throw new Error("unexpected fetch call: " + path + " " + JSON.stringify(opts));
  };

  const result = await apiRetryOnce(fetchImpl, "/runs", { method: "POST", body: { intent: "x" } }, "stale-token");
  assert.deepEqual(result.json, { ok: true, run: { id: "r1" } }, "the retried call's response must win, not the original 401's refused body");
  assert.equal(result.token, "fresh-token", "the fresh token must be surfaced so api() can adopt it for later calls");
  assert.equal(calls.length, 3, "exactly three fetches: the failed original, the /app re-fetch, and the retry");
  assert.equal(calls[1].path, "/app");
  assert.equal(calls[1].opts.method, "GET", "the re-fetch must be a plain read — the same unauthenticated mechanism the page boots through");
});

test("piece 8f — apiRetryOnce: still-refused after the retry surfaces an honest message, never the raw \"refused\" body — reproduced live as the Dispatch button's only feedback", async () => {
  const sandbox = loadClientSandbox();
  const apiRetryOnce = sandbox.apiRetryOnce as (
    fetchImpl: (path: string, opts: Record<string, unknown>) => Promise<{ status: number; json?: () => Promise<unknown>; text?: () => Promise<string> }>,
    path: string, opts: Record<string, unknown>, token: string,
  ) => Promise<{ json: unknown; token: string | null }>;

  const stillRefused = (path: string) => {
    if (path === "/runs") return Promise.resolve({ status: 401, json: () => Promise.resolve({ ok: false, error: "refused" }) });
    if (path === "/app") return Promise.resolve({ status: 200, text: () => Promise.resolve(delegationAppHtml("fresh-token-2")) });
    throw new Error("unexpected fetch call: " + path);
  };
  const result = await apiRetryOnce(stillRefused, "/runs", { method: "POST" }, "stale-token");
  // The honest-message object is constructed INSIDE apiRetryOnce, which runs in the vm
  // sandbox's own realm — JSON.parse(JSON.stringify(...)) normalizes it back into this
  // realm before comparing, the same cross-realm fix render-calm.test.ts documents for
  // keyedListPlan's return value (deepStrictEqual is a prototype-identity check, not a
  // structural one, so a same-shaped cross-realm object otherwise fails it).
  assert.deepEqual(JSON.parse(JSON.stringify(result.json)), { ok: false, error: "the daemon restarted - reload the page" });
  assert.equal(result.token, null, "no token to adopt when the retry itself still failed");

  // The honest-version escape hatch this brief allows: if the token is only ever
  // embedded in page HTML and the /app re-fetch cannot yield one (a malformed or
  // unexpected response), the same message must come back WITHOUT a second /runs
  // call ever firing with an empty token.
  let secondRunsCallMade = false;
  const noTokenRecoverable = (path: string) => {
    if (path === "/runs") {
      if (secondRunsCallMade) throw new Error("must not retry /runs a second time with no recovered token");
      secondRunsCallMade = true;
      return Promise.resolve({ status: 401, json: () => Promise.resolve({ ok: false, error: "refused" }) });
    }
    if (path === "/app") return Promise.resolve({ status: 200, text: () => Promise.resolve("<html>no token here</html>") });
    throw new Error("unexpected fetch call: " + path);
  };
  const result2 = await apiRetryOnce(noTokenRecoverable, "/runs", { method: "POST" }, "stale-token");
  assert.deepEqual(JSON.parse(JSON.stringify(result2.json)), { ok: false, error: "the daemon restarted - reload the page" });
});

test("piece 8g — apiRetryOnce never enters the retry dance for a GET, even on a 401: reads are unauthenticated, so a GET 401 is a different failure and must pass through as-is", async () => {
  const sandbox = loadClientSandbox();
  const apiRetryOnce = sandbox.apiRetryOnce as (
    fetchImpl: (path: string, opts: Record<string, unknown>) => Promise<{ status: number; json: () => Promise<unknown> }>,
    path: string, opts: Record<string, unknown>, token: string,
  ) => Promise<{ json: unknown; token: string | null }>;
  let calls = 0;
  const fetchImpl = () => { calls += 1; return Promise.resolve({ status: 401, json: () => Promise.resolve({ ok: false, error: "refused" }) }); };
  const result = await apiRetryOnce(fetchImpl, "/runs", { method: "GET" }, "stale-token");
  assert.equal(calls, 1, "a GET's 401 must never trigger the retry-refetch dance");
  assert.deepEqual(result.json, { ok: false, error: "refused" });
});

test("piece 8h — api() is wired through apiRetryOnce with the real fetch, and adopts a refreshed token onto TOKEN for future calls", () => {
  const script = composedScript();
  assert.match(script, /function api\(path, opts\) \{\s*return apiRetryOnce\(fetch, path, opts, TOKEN\)\.then\(function \(result\) \{\s*if \(result\.token\) TOKEN = result\.token;\s*return result\.json;\s*\}\);\s*\}/,
    "api() must delegate to the pure apiRetryOnce and persist any refreshed token onto the module-level TOKEN");
});
