// Two operator-dogfooding defects in mcp/delegation/app-client.ts, fixed together:
//
// DEFECT 1 — waveGateStatus read a boolean goal.plan.waves[i].status.due that no
// server code ever wrote; api.ts's withWaveStatus ships the derived status as a
// TOP-LEVEL goal.wave_status array (goal.ts's goalWaveStatus) of { status: "due" |
// "waiting" | "merged" | "executing" | "partial" } — the shapes never met, so a due
// wave's banner and "Dispatch wave" button never rendered for any goal, ever.
//
// DEFECT 2 — an open inlineAsk row (e.g. the Reject reason field) lived only in the
// DOM. renderDetail's revision-gated rebuild (a background poll noticing the run
// changed) tears out and recreates the actionbar from scratch, which silently deleted
// an open row and whatever the user had typed into it. openInlineAsks now mirrors the
// open row's key + live text outside the DOM, and both call sites (rejectRunClick,
// resumeRunClick) check it after building a fresh trigger button to reopen themselves
// with the preserved text instead of leaving a bare button behind.
//
// Same convention as sessions-ui.test.ts/audit-driven-parity-pass.test.ts: app-client.ts
// is a TS template literal, so behavioural assertions run the composed script in a vm
// sandbox against a minimal fake DOM; a couple of source-text pins back that up for the
// exact call sites the reproduced bugs lived in.

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

// A fuller fake element than the read-only fixtures elsewhere in this suite need:
// inlineAsk performs a real trigger<->row swap (parent.replaceChild) and wires a real
// "input" listener to track typed text, so the DOM shim here has to support both.
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
  onclick: (() => void) | null;
  _listeners: Record<string, Array<(ev: Record<string, unknown>) => void>>;
  appendChild(c: FakeEl): FakeEl;
  removeChild(c: FakeEl): void;
  replaceChild(next: FakeEl, prev: FakeEl): void;
  addEventListener(type: string, fn: (ev: Record<string, unknown>) => void): void;
  fire(type: string, ev?: Record<string, unknown>): void;
  focus(): void;
  setAttribute(k: string, v: string): void;
  getAttribute(k: string): string | null;
};
function fakeElement(tag: string): FakeEl {
  const attrs: Record<string, string> = {};
  const el: FakeEl = {
    tagName: tag, className: "", textContent: "", value: "", type: "", placeholder: "",
    style: {}, children: [], parentNode: null, onclick: null, _listeners: {},
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
    addEventListener(type, fn) { (el._listeners[type] = el._listeners[type] || []).push(fn); },
    fire(type, ev) { (el._listeners[type] || []).forEach((fn) => fn(ev || {})); },
    focus() {},
    setAttribute(k, v) { attrs[k] = v; },
    getAttribute(k) { return attrs[k] ?? null; },
  };
  return el;
}
// document.createTextNode's plain { nodeType: 3, textContent } has no .children — a
// leaf, so it never gets recursed into.
function findByClass(root: FakeEl, cls: string): FakeEl | undefined {
  for (const c of root.children || []) {
    if (c.className === cls) return c;
    if (!c.children) continue;
    const nested = findByClass(c, cls);
    if (nested) return nested;
  }
  return undefined;
}
function findByText(root: FakeEl, text: string): FakeEl | undefined {
  for (const c of root.children || []) {
    if (c.textContent === text) return c;
    if (!c.children) continue;
    const nested = findByText(c, text);
    if (nested) return nested;
  }
  return undefined;
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
    // Expected — same DOM-less top-level abort every sandbox test in this file relies on;
    // every top-level function declaration (hoisted ahead of the throwing statement) is
    // still fully defined on `sandbox` afterwards.
  }
  return sandbox;
}

// --- DEFECT 1: goal.wave_status (string) vs. goal.plan.waves[i].status.due (never sent) ---

function makeOverlayElement(clearChildrenOnEmptyText: boolean): FakeEl {
  const el = fakeElement("div");
  let text = "";
  Object.defineProperty(el, "textContent", {
    get() { return text; },
    set(v: string) {
      text = v;
      if (clearChildrenOnEmptyText && v === "") el.children.length = 0;
    },
  });
  (el as unknown as Record<string, unknown>).classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  return el;
}
function loadGoalSandbox(): { sandbox: Record<string, unknown>; elements: Record<string, FakeEl> } {
  const elements: Record<string, FakeEl> = {
    "goal-title": makeOverlayElement(false),
    "goal-body": makeOverlayElement(true),
    "goal-overlay": makeOverlayElement(false),
  };
  const sandbox: Record<string, unknown> = {
    document: {
      createElement: (tag: string) => fakeElement(tag),
      createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
      getElementById: (id: string) => elements[id] || null,
      querySelectorAll: () => [],
      body: { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
    },
    navigator: { userAgent: "" },
    window: {},
    console,
    fetch: () => Promise.reject(new Error("fetch not stubbed in this goal-sandbox test")),
  };
  try {
    runInNewContext(APP_CLIENT, sandbox, { timeout: 2000 });
  } catch {
    // Expected, see loadClientSandbox.
  }
  return { sandbox, elements };
}
function kids(el: FakeEl): FakeEl[] {
  return el.children || [];
}
function makeGoal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "g1",
    intent: "Ship the checkout redesign.",
    state: "executing",
    autonomy: "recommend",
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    plan: { waves: [{ runs: [], run_ids: ["r1"] }] },
    ...overrides,
  };
}

// FAILS ON REVERT: pre-fix, waveGateStatus read wave.status.due — a shape the server
// never sends (withWaveStatus in api.ts puts wave_status on the GOAL, one level up, as
// a string). With wave_status set but no wave.status field anywhere in this fixture,
// the pre-fix code returns null for every wave: no "due now" line, no Dispatch button.
test("a goal whose wave_status is [merged, due] renders the due-now line and a Dispatch wave button for the due wave, reading the real top-level array shape", () => {
  const goal = makeGoal({
    plan: { waves: [
      { runs: [], run_ids: ["r1"] },
      { runs: [{ intent: "Add the retry-queue worker.", type: "feature", files_scope: [] }], run_ids: [] },
    ] },
    wave_status: [{ status: "merged" }, { status: "due" }],
  });
  const { sandbox, elements } = loadGoalSandbox();
  const state = sandbox.state as Record<string, unknown>;
  state.goals = [goal];
  state.runs = [{ id: "r1", display_state: "merged", display_name: "wave 1 run" }];
  (sandbox.openGoalDetail as (id: string) => void)("g1");

  const blocks = kids(elements["goal-body"]).filter((c) => c.className === "gd-wave-block");
  assert.equal(blocks.length, 2, "both waves must render their own block");
  const wave2 = blocks[1];

  const statusLine = kids(wave2).find((c) => c.className.indexOf("gd-wave-status") >= 0);
  assert.ok(statusLine, "wave 2's due status must produce a gd-wave-status line");
  assert.match(String(statusLine!.textContent), /due now/, "a due wave must read as due now, not waiting");
  assert.ok(statusLine!.className.indexOf("due") >= 0, "the due line must carry the .due modifier class");

  const dispatchBtn = kids(wave2).find((c) => c.textContent === "Dispatch wave");
  assert.ok(dispatchBtn, "a due, run-less wave must offer the Dispatch wave button");
  assert.equal(typeof dispatchBtn!.onclick, "function");
});

// Same fixture, checked from fillGoalCard's own "wave N due" chip (dueWaveIndex) — the
// two rendering paths (card summary, detail overlay) must read the same field.
test("dueWaveIndex/fillGoalCard surface the same due wave as a 'wave 2 due' chip on the goal card", () => {
  const goal = makeGoal({
    plan: { waves: [
      { runs: [], run_ids: ["r1"] },
      { runs: [], run_ids: [] },
    ] },
    wave_status: [{ status: "merged" }, { status: "due" }],
  });
  const sandbox = loadClientSandbox();
  const state = sandbox.state as Record<string, unknown>;
  state.runs = [{ id: "r1", display_state: "merged", display_name: "wave 1 run" }];
  const card = fakeElement("div") as unknown as Record<string, unknown>;
  (sandbox.fillGoalCard as (card: unknown, goal: unknown) => void)(card, goal);
  const head = findByClass(card as unknown as FakeEl, "ghead");
  assert.ok(head, "fillGoalCard must build a head row");
  const dueChip = findByText(head as unknown as FakeEl, "wave 2 due");
  assert.ok(dueChip, "the due wave must surface as a 'wave 2 due' chip on the card, matching the detail overlay");
});

// A waiting wave (not due) must never grow the button — pins the due/waiting branch,
// not just the due one.
test("a goal whose wave_status is [waiting] never offers Dispatch wave", () => {
  const goal = makeGoal({
    plan: { waves: [
      { runs: [{ intent: "Add the retry-queue worker.", type: "feature", files_scope: [] }], run_ids: [] },
    ] },
    wave_status: [{ status: "waiting" }],
  });
  const { sandbox, elements } = loadGoalSandbox();
  const state = sandbox.state as Record<string, unknown>;
  state.goals = [goal];
  state.runs = [];
  (sandbox.openGoalDetail as (id: string) => void)("g1");
  const wave = kids(elements["goal-body"]).find((c) => c.className === "gd-wave-block")!;
  assert.ok(!kids(wave).some((c) => c.textContent === "Dispatch wave"), "a waiting (not due) wave must not offer the button");
});

test("source pin: waveGateStatus reads goal.wave_status[index], never a boolean wave.status.due", () => {
  const script = composedScript();
  assert.match(script, /function waveGateStatus\(goal, index\) \{/);
  assert.match(script, /var entry = goal\.wave_status && goal\.wave_status\[index\];/);
  assert.ok(!/wave\.status\.due/.test(script), "the dead wave.status.due read must be gone");
});

// --- DEFECT 2: an open inlineAsk row (and its typed text) used to vanish on rebuild ---

test("openInlineAsks starts empty and inlineAsk's opts.key tracks a row's live text as the user types", () => {
  const sandbox = loadClientSandbox();
  const openInlineAsks = sandbox.openInlineAsks as Record<string, { value: string }>;
  // Not assert.deepEqual: openInlineAsks was created inside the vm sandbox's own
  // realm, so its Object prototype differs from this file's — a cross-realm
  // deepStrictEqual fails on "same structure but not reference-equal" even when
  // genuinely empty.
  assert.deepEqual(Object.keys(openInlineAsks), []);

  const parent = fakeElement("div");
  const trigger = fakeElement("button");
  parent.appendChild(trigger);
  (sandbox.inlineAsk as (trigger: FakeEl, opts: Record<string, unknown>) => void)(trigger, {
    type: "text",
    key: "reject:r1",
    onConfirm: () => {},
  });
  assert.ok(openInlineAsks["reject:r1"], "opts.key must register an entry in openInlineAsks");
  assert.equal(openInlineAsks["reject:r1"].value, "");

  const row = parent.children[0];
  const input = row.children[0];
  input.value = "closed: superseded by a newer run";
  input.fire("input");
  assert.equal(openInlineAsks["reject:r1"].value, "closed: superseded by a newer run",
    "typing must mirror into openInlineAsks, not live only in the DOM");
});

// FAILS ON REVERT: pre-fix, rejectRunClick/renderClaimlessStoppedReceipt never
// consulted any state keyed by run — a second render call (this test's stand-in for
// renderDetail's revision-gated rebuild, which throws the whole actionbar away and
// rebuilds it from scratch on any background poll change) always produced a bare
// "Reject" trigger button, with the typed reason gone for good.
test("an open Reject row survives a rebuild: reopens itself with the typed reason intact instead of reverting to a bare trigger button", () => {
  const sandbox = loadClientSandbox();
  const openInlineAsks = sandbox.openInlineAsks as Record<string, { value: string }>;
  const renderClaimlessStoppedReceipt = sandbox.renderClaimlessStoppedReceipt as (body: FakeEl, run: unknown) => void;
  const run = { id: "r1", display_state: "stopped" };

  // First render: nothing open yet, just the two bare trigger buttons.
  const body1 = fakeElement("div");
  renderClaimlessStoppedReceipt(body1, run);
  const rejectTrigger = findByText(body1, "Reject");
  assert.ok(rejectTrigger, "a bare Reject trigger button must render when nothing is open");

  // User opens the row and types a reason — this is rejectRunClick's real onclick,
  // not a hand-rolled stand-in for it.
  (rejectTrigger!.onclick as () => void)();
  assert.ok(openInlineAsks["reject:r1"], "opening the row must register it in openInlineAsks");
  const openRow = findByClass(body1, "inline-ask");
  assert.ok(openRow, "the trigger must be swapped for an .inline-ask row");
  const input = openRow!.children[0];
  input.value = "closed: superseded by a newer run";
  input.fire("input");
  assert.equal(openInlineAsks["reject:r1"].value, "closed: superseded by a newer run");

  // Simulate the rebuild: a fresh, empty container, exactly what renderDetail's
  // el.textContent = "" followed by a full rebuild produces — same pattern
  // renderClaimlessStoppedReceipt is reused by (see app-client.ts's actionbar).
  const body2 = fakeElement("div");
  renderClaimlessStoppedReceipt(body2, run);

  // Checked structurally, not by searching for the text "Reject" — the reopened row's
  // own confirm button is ALSO labeled "Reject" (rejectRunClick's confirmLabel), so a
  // text search alone cannot tell a reopened row apart from a bare trigger button.
  const receiptActs2 = body2.children[1];
  assert.ok(receiptActs2, "the actions row must exist");
  const rejectSlot = receiptActs2.children[1];
  assert.equal(rejectSlot.className, "inline-ask",
    "the Reject slot must hold the reopened inline-ask row, not a bare trigger button — the row was open, so it must reopen instead");
  const reopenedRow = rejectSlot;
  const reopenedInput = reopenedRow.children[0];
  assert.equal(reopenedInput.value, "closed: superseded by a newer run",
    "the typed reason must survive the rebuild, not reset to empty");

  // Cancelling must still work normally and clear the tracked state (a stale open
  // entry would otherwise force every future rebuild to reopen a row nobody wants).
  const cancelBtn = reopenedRow!.children[reopenedRow!.children.length - 1];
  (cancelBtn.onclick as () => void)();
  assert.ok(!openInlineAsks["reject:r1"], "Cancel must clear the tracked entry, not just swap the DOM back");
});

test("source pin: the actionbar's Reject and Resume triggers reopen themselves from openInlineAsks after a rebuild", () => {
  const script = composedScript();
  assert.match(script, /if \(!pendingLabel && openInlineAsks\["reject:" \+ run\.id\]\) rejectRunClick\(run, reject, openInlineAsks\["reject:" \+ run\.id\]\.value\);/);
  assert.match(script, /if \(!pendingLabel && openInlineAsks\["resume:" \+ run\.id\]\) resumeRunClick\(run, resume, openInlineAsks\["resume:" \+ run\.id\]\.value\);/);
});
