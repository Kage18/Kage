// Redo of a rejected run, with its failure understood. Two small Room fixes:
//
//   1. CHAT OPENS AT TOP — entering the Chat view rendered wherever the scroller's
//      scrollTop already happened to be (0 by default, i.e. the top) instead of the
//      newest turn, because renderRoom's own pin-to-bottom was gated ONLY on
//      "was the scroller already near the bottom" — never true on a fresh view.
//      app-client.ts now tracks a module-level roomEnteringView flag, set whenever
//      Chat is about to become visible (boot, a thread switch, toggling Chat/Terminal,
//      navigating back into Room), and renderRoom consumes it to pin unconditionally
//      on that one render — never on the polling renders in between, which still only
//      pin when the reader was already at the bottom (standard chat behavior).
//
//   2. COLD-PTY IDENTITY WINDOW — the prior (rejected) attempt raised
//      PTY_IDENTITY_POLL_TIMEOUT_MS from 5000 to 20000 directly, and the suite then
//      timed out at 1200s three times: every pty test that reaches resolvePtyReply's
//      identity-poll deflection path waits the full window in REAL time unless it
//      injects ctx.waitForRoomSessionIdentityFn (the existing seam). This file adds
//      the one test the brief calls for: the production constant really is 20000,
//      asserted by importing it directly — never by waiting it out.
//
// Its own file per this repo's rule — new behaviour gets a new test file, and
// mcp/delegation.test.ts is a known append-collision hotspot.
import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";

import { PTY_IDENTITY_POLL_TIMEOUT_MS } from "./delegation/api.js";
import { APP_CLIENT } from "./delegation/app-client.js";

// ---------------------------------------------------------------------------
// 2. The production identity-poll window, asserted without ever waiting it out.

// FAILS ON REVERT: reverting PTY_IDENTITY_POLL_TIMEOUT_MS back to 5000 (the prior
// value, before this run's redo) fails this assertion immediately — no timer involved.
test("PTY_IDENTITY_POLL_TIMEOUT_MS is 20000ms in production — a cold pty's identity write can take longer than the old 5s window", () => {
  assert.equal(PTY_IDENTITY_POLL_TIMEOUT_MS, 20_000);
});

// ---------------------------------------------------------------------------
// 1. Chat opens pinned to the newest turn — the real renderRoom code path, run in a
// DOM-less vm sandbox against a minimal element stub (same technique dead-ends.test.ts,
// receipt.test.ts, and render-calm.test.ts already use for app-client.ts).

interface FakeElement {
  tagName: string;
  className: string;
  textContent: string;
  children: FakeElement[];
  style: Record<string, string>;
  disabled: boolean;
  value: string;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  onclick: (() => void) | null;
  onkeydown: ((ev: unknown) => void) | null;
  classList: { add(...c: string[]): void; remove(...c: string[]): void; toggle(name: string, force?: boolean): void; contains(name: string): boolean };
  appendChild(child: FakeElement): FakeElement;
  addEventListener(): void;
  focus(): void;
  scrollIntoView(): void;
}

function makeFakeElement(): FakeElement {
  const classes = new Set<string>();
  const el = {
    tagName: "DIV",
    className: "",
    textContent: "",
    children: [] as FakeElement[],
    style: {} as Record<string, string>,
    disabled: false,
    value: "",
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    onclick: null,
    onkeydown: null,
    classList: {
      add: (...c: string[]) => c.forEach((x) => classes.add(x)),
      remove: (...c: string[]) => c.forEach((x) => classes.delete(x)),
      toggle: (name: string, force?: boolean) => {
        if (force === undefined) { if (classes.has(name)) classes.delete(name); else classes.add(name); }
        else if (force) classes.add(name); else classes.delete(name);
      },
      contains: (name: string) => classes.has(name),
    },
    addEventListener() {},
    focus() {},
    scrollIntoView() {},
  } as unknown as FakeElement;
  el.appendChild = (child: FakeElement) => { el.children.push(child); return child; };
  return el;
}

function fakeTurn(role: string, i: number): { role: string; text: string; tools: string[] } {
  return { role, text: "turn " + i, tools: [] };
}

// Every id/selector the script touches gets a permissive fake element rather than
// null — a null return makes the FIRST top-level `document.getElementById(x).onclick =
// ...` wiring line (there are dozens, scattered through the file) throw and abort the
// whole script before module-level vars declared further down (roomLinkedRuns,
// roomPaintedCount, roomSignature, roomEnteringView — all read by renderRoom) ever get
// assigned. A generic fallback lets the script run all the way to the first genuinely
// unstubbable browser global (EventSource, inside connect() near the very end) — well
// past everything renderRoom/switchThread/setRoomMode/setView need.
function loadSandbox(roomScroll: FakeElement): Record<string, unknown> {
  const byId = new Map<string, FakeElement>();
  const getElementById = (id: string): FakeElement => {
    let el = byId.get(id);
    if (!el) { el = makeFakeElement(); byId.set(id, el); }
    return el;
  };
  const sandbox: Record<string, unknown> = {
    document: {
      createElement: () => makeFakeElement(),
      createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
      getElementById,
      querySelector: (sel: string) => (sel === "#v-room .room-scroll" ? roomScroll : makeFakeElement()),
      querySelectorAll: () => [],
      addEventListener: () => {},
      body: makeFakeElement(),
    },
    navigator: { userAgent: "" },
    window: { addEventListener: () => {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    console,
  };
  try {
    runInNewContext(APP_CLIENT, sandbox, { timeout: 2000 });
  } catch {
    // Expected: something further in the script (EventSource, fetch, xterm's Terminal,
    // ...) has no stub here. Function declarations are hoisted before any statement
    // runs, and every module-level var renderRoom/switchThread/setRoomMode/setView read
    // (state, roomLinkedRuns, roomPaintedCount, roomSignature, roomEnteringView) is
    // assigned well before the script can reach any of those unstubbed globals, so all
    // of it is live in the sandbox regardless of exactly where execution later aborts.
  }
  return sandbox;
}

// FAILS ON REVERT: the pre-redo renderRoom only pinned to the bottom when the scroller
// was ALREADY near it (scrollHeight - scrollTop - clientHeight < 80) or turns.length <=
// 2. A freshly loaded page's scroller starts at scrollTop 0, so with a real 10-turn
// history and a tall scrollHeight, that condition is false and the original code left
// scrollTop untouched at 0 — the exact "chat opens at the top" bug. This test's fixture
// (scrollTop 0, scrollHeight 5000, clientHeight 300) reproduces precisely that shape.
test("entering the Chat view for the first time pins to the newest turn even though the scroller starts at the top, not wherever it already was", () => {
  const scroll = makeFakeElement();
  scroll.scrollTop = 0;
  scroll.scrollHeight = 5000;
  scroll.clientHeight = 300;
  const sandbox = loadSandbox(scroll);
  const state = sandbox.state as { room: { turns: unknown[]; busy: boolean; live: boolean; activity_at: null; has_transcript: boolean } };
  state.room = { turns: Array.from({ length: 10 }, (_, i) => fakeTurn(i % 2 ? "kage" : "you", i)), busy: false, live: true, activity_at: null, has_transcript: false };

  (sandbox.renderRoom as () => void)();

  assert.equal(scroll.scrollTop, scroll.scrollHeight, "the very first render of a real history must pin to the newest turn, not leave scrollTop at its default 0");
});

// FAILS ON REVERT: without roomEnteringView, switchThread's reset of roomSignature
// forces a repaint but the repaint's own wasAtBottom check still reads whatever
// scrollTop the PREVIOUS thread left behind — here, deliberately non-bottom (400) —
// so the original code would leave the new thread's real history un-pinned too.
test("switching to a different thread pins the newly loaded history to the bottom, even though the previous thread's scroller was left scrolled up", () => {
  const scroll = makeFakeElement();
  scroll.scrollTop = 400; // the OLD thread's leftover position, deliberately not near the bottom
  scroll.scrollHeight = 3000;
  scroll.clientHeight = 300;
  const sandbox = loadSandbox(scroll);
  const state = sandbox.state as { session: string; sessions: unknown[]; room: { turns: unknown[]; busy: boolean; live: boolean; activity_at: null; has_transcript: boolean }; transcript: null; roomStreaming: unknown[]; threadBusy: Record<string, boolean>; roomMode: string };

  try {
    (sandbox.switchThread as (key: string) => void)("thread-b");
  } catch {
    // switchThread's own refreshRoom() call reaches api()/fetch, unstubbed here — by
    // then its synchronous renderRoom() call (the thing under test) already ran.
  }
  // The thread switch itself clears turns to [] (a real API round-trip fills them back
  // in) — simulate that round-trip's own renderRoom() call landing with real history,
  // the same shape a live app produces a moment after switchThread returns.
  state.room = { turns: Array.from({ length: 8 }, (_, i) => fakeTurn(i % 2 ? "kage" : "you", i)), busy: false, live: true, activity_at: null, has_transcript: false };
  scroll.scrollTop = 400; // still not near the bottom — proves the pin isn't accidental wasAtBottom math
  (sandbox.renderRoom as () => void)();

  assert.equal(scroll.scrollTop, scroll.scrollHeight, "the newly switched thread's history must render pinned to bottom, not at the old thread's scroll position");
});

// FAILS ON REVERT: same shape as the thread-switch case, for the Chat/Terminal toggle
// specifically — toggling back into Chat mid-conversation is "entering the Chat view"
// too, and the original code had no signal for that distinct from an ordinary poll.
test("toggling from Terminal back to Chat pins to the newest turn, not the scroll position Chat was left at", () => {
  const scroll = makeFakeElement();
  const sandbox = loadSandbox(scroll);
  const state = sandbox.state as { room: { turns: unknown[]; busy: boolean; live: boolean; activity_at: null; has_transcript: boolean } };
  state.room = { turns: Array.from({ length: 6 }, (_, i) => fakeTurn(i % 2 ? "kage" : "you", i)), busy: false, live: true, activity_at: null, has_transcript: false };
  (sandbox.renderRoom as () => void)(); // first paint, consumes the boot-time pin
  scroll.scrollTop = 42; // the reader scrolled up before switching to Terminal
  scroll.scrollHeight = 900;
  scroll.clientHeight = 200;

  (sandbox.setRoomMode as (mode: string) => void)("chat");
  (sandbox.renderRoom as () => void)();

  assert.equal(scroll.scrollTop, scroll.scrollHeight, "re-entering Chat must pin to the newest turn regardless of where Chat's scroller was left");
});

// Standard chat behavior, the other half: once a view is showing, a poll that adds a
// new turn must stay pinned ONLY if the reader was already at the bottom — never yank
// someone reading older history down to the newest turn out from under them. This
// already worked pre-redo (the wasAtBottom check), so it is not a fails-on-revert test
// by itself, but it pins down that the new roomEnteringView gate did not regress it.
test("once the Chat view is already open, a streamed turn stays pinned when the reader was at the bottom, and preserves position when they had scrolled up", () => {
  const scroll = makeFakeElement();
  const sandbox = loadSandbox(scroll);
  const state = sandbox.state as { room: { turns: unknown[]; busy: boolean; live: boolean; activity_at: null; has_transcript: boolean } };
  const turns = Array.from({ length: 10 }, (_, i) => fakeTurn(i % 2 ? "kage" : "you", i));
  state.room = { turns, busy: false, live: true, activity_at: null, has_transcript: false };
  scroll.scrollHeight = 5000;
  scroll.clientHeight = 300;
  (sandbox.renderRoom as () => void)(); // consumes the entering-view pin
  assert.equal(scroll.scrollTop, scroll.scrollHeight, "fixture setup: the initial render must be pinned before this test's own assertions begin");

  // Case A: reader is at the bottom when a new turn streams in — stays pinned.
  scroll.scrollHeight = 5300;
  state.room = { turns: turns.concat([fakeTurn("kage", 10)]), busy: false, live: true, activity_at: null, has_transcript: false };
  (sandbox.renderRoom as () => void)();
  assert.equal(scroll.scrollTop, scroll.scrollHeight, "a reader already at the bottom must stay pinned as new turns stream in");

  // Case B: reader scrolls up to read older history, then another turn streams in —
  // their position must be left alone, not yanked to the bottom.
  scroll.scrollTop = 250;
  state.room = { turns: turns.concat([fakeTurn("kage", 10), fakeTurn("you", 11)]), busy: false, live: true, activity_at: null, has_transcript: false };
  (sandbox.renderRoom as () => void)();
  assert.equal(scroll.scrollTop, 250, "a reader who scrolled up must keep their position when a turn streams in elsewhere in the thread");
});
