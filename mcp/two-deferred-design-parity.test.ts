// Two deferred design-parity gaps from the audit run (docs/design/mockups/ as spec):
//
// 1. DIFF GUTTER — Diff.dc.html shows a mono, tabular-nums line-number gutter per
//    hunk; the app's diff view had none. The numbers come from the SAME hunk header
//    git already writes ("@@ -oldStart,oldCount +newStart,newCount @@") — this reads
//    the numbers already present in the diff text, it never re-diffs client-side.
//
// 2. WORKLIST INLINE ACTIONS — WorkList.dc.html shows row-level Adopt/Resume/Reject
//    on a lost-or-failed triage row, wired to the SAME action functions the run-detail
//    actionbar already used (adopt/resume/reject/merge), reachable without opening the
//    detail overlay.
//
// Same vm-sandbox technique as fix-two-app-client.test.ts / dead-ends.test.ts /
// sessions-ui.test.ts: APP_CLIENT is a TS template literal, evaluated in a fresh vm
// context against a minimal fake DOM, and the real functions under test are called
// directly — no source-text pattern matching for behaviour.
import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";

import { APP_CLIENT } from "./delegation/app-client.js";

type FakeEl = {
  tagName: string;
  className: string;
  textContent: string;
  value: string;
  type: string;
  placeholder: string;
  style: Record<string, unknown>;
  children: FakeEl[];
  parentNode: FakeEl | null;
  onclick: ((ev: Record<string, unknown>) => void) | null;
  disabled: boolean;
  title: string;
  _listeners: Record<string, Array<(ev: Record<string, unknown>) => void>>;
  appendChild(c: FakeEl): FakeEl;
  removeChild(c: FakeEl): void;
  replaceChild(next: FakeEl, prev: FakeEl): void;
  insertBefore(next: FakeEl, ref: FakeEl | null): FakeEl;
  addEventListener(type: string, fn: (ev: Record<string, unknown>) => void): void;
  fire(type: string, ev?: Record<string, unknown>): void;
  focus(): void;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | null;
  querySelector(sel: string): FakeEl | null;
};

// document.querySelector only ever needs a single bare class selector (".qt", ".qbtns",
// …) anywhere in app-client.ts's own patchWorkRow/renderDetail code — this is a
// deliberately narrow shim, not a general CSS engine. This file's own findDescendant/
// findAll helpers additionally accept a multi-token selector ("dline add", "scell
// del") and require every token to be present, since h() joins multi-word classNames
// with a single space (className = "dline add", not two separate attributes).
function matchesClass(el: FakeEl, sel: string): boolean {
  const want = sel.trim().split(/\s+/);
  const have = (el.className || "").split(/\s+/);
  return want.every((w) => have.indexOf(w) >= 0);
}
function findDescendant(el: FakeEl, cls: string): FakeEl | null {
  for (const c of el.children || []) {
    if (matchesClass(c, cls)) return c;
    const nested = findDescendant(c, cls);
    if (nested) return nested;
  }
  return null;
}

function fakeElement(tag: string): FakeEl {
  const attrs: Record<string, string> = {};
  const el: FakeEl = {
    tagName: tag, className: "", textContent: "", value: "", type: "", placeholder: "",
    style: {}, children: [], parentNode: null, onclick: null, disabled: false, title: "",
    _listeners: {},
    appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
    removeChild(c) {
      const at = el.children.indexOf(c);
      if (at < 0) throw new Error("removeChild: not a child");
      el.children.splice(at, 1);
      c.parentNode = null;
    },
    replaceChild(next, prev) {
      const at = el.children.indexOf(prev);
      if (at < 0) throw new Error("replaceChild: not a child");
      el.children[at] = next;
      next.parentNode = el;
      prev.parentNode = null;
    },
    insertBefore(next, ref) {
      const at = ref ? el.children.indexOf(ref) : -1;
      if (ref && at < 0) throw new Error("insertBefore: ref is not a child");
      if (at < 0) el.children.push(next);
      else el.children.splice(at, 0, next);
      next.parentNode = el;
      return next;
    },
    addEventListener(type, fn) { (el._listeners[type] = el._listeners[type] || []).push(fn); },
    fire(type, ev) { (el._listeners[type] || []).forEach((fn) => fn(ev || {})); },
    focus() {},
    setAttribute(k, v) { attrs[k] = v; },
    getAttribute(k) { return attrs[k] ?? null; },
    querySelector(sel) { return findDescendant(el, sel.replace(/^\./, "")); },
  };
  (el as unknown as Record<string, unknown>).classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  (el as unknown as Record<string, unknown>).dataset = {};
  (el as unknown as Record<string, unknown>).tabIndex = 0;
  (el as unknown as Record<string, unknown>).removeEventListener = () => {};
  (el as unknown as Record<string, unknown>).blur = () => {};
  (el as unknown as Record<string, unknown>).click = () => {};
  (el as unknown as Record<string, unknown>).scrollIntoView = () => {};
  (el as unknown as Record<string, unknown>).querySelectorAll = () => [];
  return el;
}

// document.createTextNode's plain { nodeType: 3, textContent } has no .children, so it
// is never recursed into by findDescendant.
//
// Unlike the lighter try/catch sandboxes elsewhere in this suite (which let the
// DOM-less top level abort partway through and rely on function DECLARATIONS being
// hoisted ahead of the throw), this sandbox is deliberately permissive enough — a
// catch-all getElementById, documentElement, EventSource, localStorage, timers — that
// APP_CLIENT's top level runs to completion with no throw at all. That matters here
// because pendingActions/DIFF_HUNK_RE/openInlineAsks are `var`-initialized partway
// through the file, not hoisted-with-value like a function declaration: a run that
// aborts before reaching those lines leaves them `undefined`, and buildDecisionBtnGroup
// (which reads pendingActions[run.id]) would throw on every call.
function loadClientSandbox(): Record<string, unknown> {
  const idElements: Record<string, FakeEl> = {};
  const sandbox: Record<string, unknown> = {
    document: {
      createElement: (tag: string) => fakeElement(tag),
      createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
      getElementById: (id: string) => idElements[id] || (idElements[id] = fakeElement("div")),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      documentElement: { setAttribute() {}, removeAttribute() {}, style: {} },
      body: fakeElement("body"),
    },
    navigator: { userAgent: "" },
    window: { addEventListener() {}, location: { search: "" }, history: {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
    requestAnimationFrame: () => 0,
    fetch: () => Promise.reject(new Error("fetch not stubbed in this sandbox")),
    EventSource: function (this: Record<string, unknown>) {
      this.close = () => {};
      this.addEventListener = () => {};
    },
  };
  runInNewContext(APP_CLIENT, sandbox, { timeout: 2000 });
  return sandbox;
}

function findAll(el: FakeEl, cls: string): FakeEl[] {
  const out: FakeEl[] = [];
  (el.children || []).forEach((c) => {
    if (matchesClass(c, cls)) out.push(c);
    out.push(...findAll(c, cls));
  });
  return out;
}

// ======================================================================================
// 1. DIFF GUTTER
// ======================================================================================

// A single-hunk fixture with a del run, two adds, and context on either side —
// old file lines 10-13, new file lines 10-14 (the hunk header's own +10,4 count is a
// touch off from the 5 new-side lines actually shown below, same as real truncated
// hunks: the header describes the hunk's span, not necessarily every line rendered).
const FIXTURE_LINES = [
  "diff --git a/foo.ts b/foo.ts",
  "--- a/foo.ts",
  "+++ b/foo.ts",
  "@@ -10,3 +10,4 @@ function foo()",
  " context one",
  "-old line",
  "+new line a",
  "+new line b",
  " context two",
];
const FIXTURE_TEXT = FIXTURE_LINES.join("\n");

// FAILS ON REVERT: hunkLineNumbers does not exist without this change — the unified
// gutter has nothing to read numbers from.
// Not assert.deepEqual against a plain object literal: each entry was created inside
// the vm sandbox's own realm, so its Object prototype differs from this file's — a
// cross-realm deepStrictEqual fails on "same fields, not reference-equal" even when
// genuinely identical (same convention fix-two-app-client.test.ts's openInlineAsks
// comment documents). Compare fields directly instead.
function assertNums(entry: { old: number | null; new: number | null } | null, old: number | null, nw: number | null, msg: string): void {
  assert.ok(entry, msg + " (expected a {old,new} entry, got null)");
  assert.equal(entry!.old, old, msg + " — old");
  assert.equal(entry!.new, nw, msg + " — new");
}

test("hunkLineNumbers reads old/new line numbers from the hunk header already in the diff text, never re-diffing", () => {
  const sandbox = loadClientSandbox();
  const hunkLineNumbers = sandbox.hunkLineNumbers as (lines: string[]) => Array<{ old: number | null; new: number | null } | null>;
  const nums = hunkLineNumbers(FIXTURE_LINES);
  assert.equal(nums.length, FIXTURE_LINES.length);
  assert.equal(nums[0], null, "diff --git carries no line number");
  assert.equal(nums[1], null, "--- carries no line number");
  assert.equal(nums[2], null, "+++ carries no line number");
  assert.equal(nums[3], null, "the @@ header itself carries no line number");
  assertNums(nums[4], 10, 10, "ctx line reads both sides at the hunk's own start");
  assertNums(nums[5], 11, null, "a del line only advances/holds the old side");
  assertNums(nums[6], null, 11, "an add line only advances/holds the new side");
  assertNums(nums[7], null, 12, "the second add continues the new-side count");
  assertNums(nums[8], 12, 13, "ctx after a 1-del/2-add imbalance: old advanced by 1, new by 2");
});

// FAILS ON REVERT: splitRows previously carried only left/right text (see the pre-fix
// signature in app-client.ts's history) — lno/rno did not exist, so a side-by-side
// gutter would have nothing to render.
test("splitRows pairs dels with the adds that replaced them and keeps each side's own gutter number", () => {
  const sandbox = loadClientSandbox();
  const splitRows = sandbox.splitRows as (lines: string[]) => Array<Record<string, unknown>>;
  const rows = splitRows(FIXTURE_LINES);
  const contentRows = rows.filter((r) => r.hunk === undefined);
  // ctx one (its own row) + the paired del/add row + the lone extra add's blank-left
  // row (flush()'s 1-del/2-add imbalance) + ctx two (its own row) = 4.
  assert.equal(contentRows.length, 4, "ctx one, the paired del/add row, the lone extra add, ctx two");

  assert.equal(contentRows[0].left, "context one");
  assert.equal(contentRows[0].lno, 10);
  assert.equal(contentRows[0].right, "context one");
  assert.equal(contentRows[0].rno, 10);

  assert.equal(contentRows[1].left, "old line");
  assert.equal(contentRows[1].lno, 11);
  assert.equal(contentRows[1].lcls, "del");
  assert.equal(contentRows[1].right, "new line a");
  assert.equal(contentRows[1].rno, 11);
  assert.equal(contentRows[1].rcls, "add");

  assert.equal(contentRows[2].left, "", "no second del to pair with the second add");
  assert.equal(contentRows[2].lno, null);
  assert.equal(contentRows[2].lcls, "blank");
  assert.equal(contentRows[2].right, "new line b");
  assert.equal(contentRows[2].rno, 12);

  assert.equal(contentRows[3].left, "context two");
  assert.equal(contentRows[3].lno, 12);
  assert.equal(contentRows[3].right, "context two");
  assert.equal(contentRows[3].rno, 13);
});

// FAILS ON REVERT: pre-fix renderDiff built each unified row as a bare text div
// (h("div", diffLineClass(line), line)) — no ".no" child would exist at all.
test("renderDiff (unified view) renders a mono gutter span with old/new numbers alongside each content line", () => {
  const sandbox = loadClientSandbox();
  const state = sandbox.state as Record<string, unknown>;
  state.diffView = "unified";
  state.collapsedDiff = {};
  const renderDiff = sandbox.renderDiff as (body: FakeEl, diffText: string) => void;
  const body = fakeElement("div");
  renderDiff(body, FIXTURE_TEXT);

  const dlines = findAll(body, "dline add").concat(findAll(body, "dline del"));
  assert.ok(dlines.length >= 3, "at least the del and two add lines must render");

  function gutterOf(row: FakeEl): { o: string; n: string } {
    const no = row.children.find((c) => c.className === "no");
    assert.ok(no, "a content dline must carry a .no gutter child");
    const [o, n] = no!.children;
    assert.equal(o.className, "o");
    assert.equal(n.className, "n");
    return { o: o.textContent, n: n.textContent };
  }
  function codeOf(row: FakeEl): string {
    const code = row.children.find((c) => c.className === "code");
    assert.ok(code, "a content dline must carry a .code child holding the line text");
    return code!.textContent;
  }

  const delRow = dlines.find((r) => codeOf(r).indexOf("old line") >= 0)!;
  assert.deepEqual(gutterOf(delRow), { o: "11", n: "" }, "a del row shows only its old-side number");

  const addRows = dlines.filter((r) => codeOf(r).indexOf("+new line") >= 0);
  assert.equal(addRows.length, 2);
  assert.deepEqual(gutterOf(addRows[0]), { o: "", n: "11" });
  assert.deepEqual(gutterOf(addRows[1]), { o: "", n: "12" });

  // The @@ hunk-header row and the diff --git/---/+++ meta rows must NOT grow a
  // gutter — they carry no line number of their own.
  const hunkRow = findAll(body, "dline hunk")[0];
  assert.ok(hunkRow);
  assert.ok(!hunkRow.children.some((c) => c.className === "no"), "the hunk header row must not render a gutter");
});

// FAILS ON REVERT: pre-fix split view built each scell as h("div", cls, text) directly
// — no nested ".no"/".code" children, so a gutter column could not exist without
// breaking the existing side-by-side text rendering.
test("renderDiff (split view) gives each side of the side-by-side pane its own gutter number", () => {
  const sandbox = loadClientSandbox();
  const state = sandbox.state as Record<string, unknown>;
  state.diffView = "split";
  state.collapsedDiff = {};
  const renderDiff = sandbox.renderDiff as (body: FakeEl, diffText: string) => void;
  const body = fakeElement("div");
  renderDiff(body, FIXTURE_TEXT);

  const delCells = findAll(body, "scell del");
  assert.equal(delCells.length, 1);
  const delNo = delCells[0].children.find((c) => c.className === "no")!;
  assert.equal(delNo.textContent, "11");
  const delCode = delCells[0].children.find((c) => c.className === "code")!;
  assert.equal(delCode.textContent, "old line");

  const addCells = findAll(body, "scell add");
  assert.equal(addCells.length, 2);
  assert.equal(addCells[0].children.find((c) => c.className === "no")!.textContent, "11");
  assert.equal(addCells[1].children.find((c) => c.className === "no")!.textContent, "12");

  const blankCells = findAll(body, "scell blank");
  assert.equal(blankCells.length, 1, "the unmatched second add pairs with a blank left cell");
  assert.equal(blankCells[0].children.find((c) => c.className === "no")!.textContent, "", "a blank cell carries no number");
});

// ======================================================================================
// 2. WORKLIST INLINE ACTIONS
// ======================================================================================

function makeRun(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "r1", display_state: "running", ownership: "needs_you", branch: "kage/fix-thing-1a2b",
    updated_at: new Date().toISOString(), tokens_used: 100, verdict_label: null,
    display_name: "Fix the thing", intent: "fix the thing", waiting_on: null,
    ...overrides,
  };
}

// FAILS ON REVERT: buildDecisionBtnGroup does not exist without this change — a lost or
// failed row's actHost only ever grew a merge group (buildMergeBtnGroup), which does
// not fire for these states.
test("buildDecisionBtnGroup renders Resume + Reject for a stopped row, reusing resumeRunClick/rejectRunClick", () => {
  const sandbox = loadClientSandbox();
  const buildDecisionBtnGroup = sandbox.buildDecisionBtnGroup as (run: Record<string, unknown>) => FakeEl;
  const run = makeRun({ display_state: "stopped", state_history: [{ state: "stopped", note: "estimated spend $5.22 exceeded the $2.00 budget" }] });
  const group = buildDecisionBtnGroup(run);
  const labels = group.children.map((c) => c.textContent);
  assert.deepEqual(labels, ["Resume", "Reject…"], "a stopped row offers exactly Resume then Reject, no Adopt");
});

test("buildDecisionBtnGroup renders Adopt + Reject for a failed, worktree-adoptable row", () => {
  const sandbox = loadClientSandbox();
  const buildDecisionBtnGroup = sandbox.buildDecisionBtnGroup as (run: Record<string, unknown>) => FakeEl;
  const run = makeRun({ display_state: "failed", worktree_adoptable: true });
  const group = buildDecisionBtnGroup(run);
  const labels = group.children.map((c) => c.textContent);
  assert.deepEqual(labels, ["Adopt", "Reject…"]);
  assert.match(group.children[0].title, /Verify the work it left behind/);
});

test("buildDecisionBtnGroup renders only Reject for a failed row that is not worktree-adoptable — no Adopt for a case it can't cure", () => {
  const sandbox = loadClientSandbox();
  const buildDecisionBtnGroup = sandbox.buildDecisionBtnGroup as (run: Record<string, unknown>) => FakeEl;
  const run = makeRun({ display_state: "failed", worktree_adoptable: false });
  const group = buildDecisionBtnGroup(run);
  assert.deepEqual(group.children.map((c) => c.textContent), ["Reject…"]);
});

// A click anywhere inside the button group (the buttons themselves, or the input/
// confirm/cancel row inlineAsk swaps in) must never bubble up to the row's own
// onclick — that onclick is what opens the detail overlay, and WorkList.dc.html's
// whole point is deciding WITHOUT opening it.
test("buildDecisionBtnGroup stops a click from bubbling past itself, so it never opens the detail overlay it lives inside", () => {
  const sandbox = loadClientSandbox();
  const buildDecisionBtnGroup = sandbox.buildDecisionBtnGroup as (run: Record<string, unknown>) => FakeEl;
  const run = makeRun({ display_state: "stopped" });
  const group = buildDecisionBtnGroup(run);
  let stopped = false;
  group.fire("click", { stopPropagation: () => { stopped = true; } });
  assert.ok(stopped, "the qbtns container must stop click propagation");
});

// FAILS ON REVERT: pre-fix workRow/patchWorkRow never inserted a .whatnow line and
// actHost only ever appended buildMergeBtnGroup — a stopped or failed row rendered no
// what-now sentence and no way to act on it without opening the detail overlay.
test("workRow renders WorkList.dc.html's what-now line plus its Resume/Reject buttons for a stopped row, without needing the detail overlay", () => {
  const sandbox = loadClientSandbox();
  const state = sandbox.state as Record<string, unknown>;
  state.selected = null;
  const workRow = sandbox.workRow as (run: Record<string, unknown>) => FakeEl;
  const run = makeRun({
    display_state: "stopped", ownership: "needs_you",
    state_history: [{ state: "stopped", note: "estimated spend $5.22 exceeded the $2.00 budget" }],
  });
  const row = workRow(run);

  const whatNow = findDescendant(row, "whatnow");
  assert.ok(whatNow, "a stopped row must render the what-now line");
  assert.match(whatNow!.textContent, /stopped by the kernel:.*Resume, take over, or reject\./);

  const qbtns = findDescendant(row, "qbtns");
  assert.ok(qbtns, "a stopped row must render its own decision buttons");
  assert.deepEqual(qbtns!.children.map((c) => c.textContent), ["Resume", "Reject…"]);
});

test("workRow renders no what-now line and no decision buttons for a run mid-flight", () => {
  const sandbox = loadClientSandbox();
  const state = sandbox.state as Record<string, unknown>;
  state.selected = null;
  const workRow = sandbox.workRow as (run: Record<string, unknown>) => FakeEl;
  const run = makeRun({ display_state: "running", ownership: "working" });
  const row = workRow(run);
  assert.equal(findDescendant(row, "whatnow"), null);
  assert.equal(findDescendant(row, "qbtns"), null, "a running row has nothing to decide yet — no button group at all");
});

// The pre-existing Merge affordance (buildMergeBtnGroup) must survive unchanged now
// that actHost's branch also handles failed/stopped — a ready row must still merge,
// and must never also pick up Adopt/Resume/Reject.
test("workRow still renders the pre-existing Merge button for a ready row, and only Merge", () => {
  const sandbox = loadClientSandbox();
  const state = sandbox.state as Record<string, unknown>;
  state.selected = null;
  const workRow = sandbox.workRow as (run: Record<string, unknown>) => FakeEl;
  const run = makeRun({ display_state: "ready", ownership: "needs_you" });
  const row = workRow(run);
  const qbtns = findDescendant(row, "qbtns")!;
  assert.deepEqual(qbtns.children.map((c) => c.textContent), ["Merge"]);
  assert.match(findDescendant(row, "whatnow")!.textContent, /verified — review the receipt and merge\./);
});

// Reuses inlineAsk exactly as the detail actionbar's own Reject does (rejectRunClick) —
// clicking Reject… swaps the trigger in place for a reason input, tracked live in
// openInlineAsks so a background rebuild can restore it (see the next test).
test("row-level Reject reuses inlineAsk: clicking swaps the trigger for a reason row and tracks the typed text in openInlineAsks", () => {
  const sandbox = loadClientSandbox();
  const openInlineAsks = sandbox.openInlineAsks as Record<string, { value: string }>;
  const buildDecisionBtnGroup = sandbox.buildDecisionBtnGroup as (run: Record<string, unknown>) => FakeEl;
  const run = makeRun({ id: "r9", display_state: "failed", worktree_adoptable: false });
  const group = buildDecisionBtnGroup(run);
  const rejectBtn = group.children.find((c) => c.textContent === "Reject…")!;
  rejectBtn.onclick!({ stopPropagation() {} });

  assert.ok(openInlineAsks["reject:r9"], "opening the row-level Reject must register in openInlineAsks, same key the detail actionbar uses");
  const askRow = group.children.find((c) => c.className === "inline-ask")!;
  assert.ok(askRow, "the trigger must be replaced in place by an inline-ask row");
  const input = askRow.children.find((c) => c.tagName === "input")!;
  input.value = "closed: superseded";
  input.fire("input");
  assert.equal(openInlineAsks["reject:r9"].value, "closed: superseded");
});

// FAILS ON REVERT: without threading openInlineAsks back through buildDecisionBtnGroup
// (mirroring the detail actionbar's own resumeRunClick/rejectRunClick reopen calls), a
// background poll rebuilding this row mid-type would silently drop the typed reason —
// the exact bug fix-two-app-client.test.ts's DEFECT 2 fixed for the detail overlay,
// reproduced here for the new row-level surface.
test("an open row-level Reject row survives a rebuild — buildDecisionBtnGroup reopens itself from openInlineAsks with the typed text intact", () => {
  const sandbox = loadClientSandbox();
  const openInlineAsks = sandbox.openInlineAsks as Record<string, { value: string }>;
  const buildDecisionBtnGroup = sandbox.buildDecisionBtnGroup as (run: Record<string, unknown>) => FakeEl;
  const run = makeRun({ id: "r9", display_state: "failed", worktree_adoptable: false });

  const first = buildDecisionBtnGroup(run);
  const rejectBtn = first.children.find((c) => c.textContent === "Reject…")!;
  rejectBtn.onclick!({ stopPropagation() {} });
  const input = first.children.find((c) => c.className === "inline-ask")!.children.find((c) => c.tagName === "input")!;
  input.value = "closed: superseded by a newer run";
  input.fire("input");

  // Simulate a background rebuild: actHost tears the whole qbtns out and asks for a
  // fresh one, same as patchWorkRow does on every hash change.
  const rebuilt = buildDecisionBtnGroup(run);
  const askRow = rebuilt.children.find((c) => c.className === "inline-ask");
  assert.ok(askRow, "the rebuilt group must reopen the inline-ask row itself, not a bare Reject… button");
  const reopenedInput = askRow!.children.find((c) => c.tagName === "input")!;
  assert.equal(reopenedInput.value, "closed: superseded by a newer run", "the typed reason must survive the rebuild");
});
