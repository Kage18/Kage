import test from "node:test";
import assert from "node:assert/strict";
import { decodeKey, fit, setColorEnabled, splitKeys, stripAnsi, style, truncate, wrap } from "./delegation/tui/ansi.js";
import { paintCardLine, paintDiffLine, render, renderLines } from "./delegation/tui/render.js";
import { type UiState, closedCount, initialState, filteredMemory, reduce, visibleRuns } from "./delegation/tui/state.js";

setColorEnabled(false);
const VIEW = { width: 100, height: 24 };

function press(state: UiState, ...keys: string[]): { state: UiState; effects: string[] } {
  const effects: string[] = [];
  let next = state;
  for (const key of keys) {
    const result = reduce(next, decodeKey(key));
    next = result.state;
    if (result.effect.kind !== "none") effects.push(result.effect.kind);
  }
  return { state: next, effects };
}

function stateWithRuns(): UiState {
  return {
    ...initialState(),
    runs: [
      { id: "fix-flaky-auth-260812-44d3", state: "ready", type: "bugfix", agent: "claude", intent: "fix the flaky auth test", elapsed: "6m02s", detail: "verified 3/3", needsYou: true },
      { id: "payments-migration-260812-77c2", state: "blocked", type: "migration", agent: "claude", intent: "migrate payments", elapsed: "11m41s", detail: "users-first or orders-first?", needsYou: true },
      { id: "bump-vite-260812-0d9e", state: "running", type: "chore", agent: "codex", intent: "bump vite", elapsed: "2m14s", detail: "editing src/build.ts · 12 actions", needsYou: false },
    ],
  };
}

test("ansi helpers keep layout math correct without a terminal", () => {
  assert.equal(fit("abc", 6), "abc   ");
  assert.equal(truncate("abcdefgh", 4), "abc…");
  assert.equal(stripAnsi("[31mred[0m"), "red");
  assert.deepEqual(wrap("one two three four", 9), ["one two", "three", "four"]);
  assert.equal(decodeKey("[A").name, "up");
  assert.equal(decodeKey("\r").name, "enter");
  assert.equal(decodeKey("").ctrl, true);
});

test("the board lists runs, marks what needs you, and moves the selection", () => {
  const state = stateWithRuns();
  const frame = stripAnsi(render(state, VIEW));
  assert.match(frame, /3 open run\(s\) · 2 need you/);
  assert.match(frame, /fix-flaky-auth/);
  assert.match(frame, /editing src\/build\.ts · 12 actions/);

  const moved = press(state, "[B", "[B").state;
  assert.equal(moved.boardIndex, 2);
  // Selection cannot run off the end.
  assert.equal(press(moved, "[B", "[B").state.boardIndex, 2);
  assert.equal(press(moved, "[A", "[A", "[A").state.boardIndex, 0);
});

test("enter answers a waiting agent, and opens review for everything else", () => {
  const state = stateWithRuns();
  // Row 0 is the ready claim (needs-you sorts first) → review.
  assert.deepEqual(press(state, "\r").effects, ["openReview"]);

  // Row 1 is BLOCKED → enter opens an answer prompt right here, no run id to retype,
  // no screen to leave. Making the user go elsewhere to reply is how an orchestrator
  // gets bypassed for raw tmux.
  const onBlocked = press(state, "[B").state;
  const prompting = press(onBlocked, "\r");
  assert.deepEqual(prompting.effects, []);
  assert.equal(prompting.state.prompt?.kind, "answer");
  assert.equal(prompting.state.prompt?.runId, "payments-migration-260812-77c2");
  assert.match(stripAnsi(render(prompting.state, VIEW)), /your answer: .*enter sends it to the waiting agent/);

  // An empty answer is refused; a typed one is delivered to that run.
  assert.deepEqual(press(prompting.state, "\r").effects, []);
  const answered = press(prompting.state, "o", "r", "d", "e", "r", "s", "\r");
  assert.deepEqual(answered.effects, ["answer"]);
  assert.equal(answered.state.prompt, null);

  // "i" inspects a blocked run instead of answering it.
  assert.deepEqual(press(onBlocked, "i").effects, ["openReview"]);
});

test("review shows the receipt, toggles to a coloured diff, and offers merge/reject", () => {
  const state: UiState = {
    ...stateWithRuns(),
    screen: "review",
    review: {
      runId: "fix-flaky-auth-260812-44d3",
      card: ["┌ CLAIM · fix-flaky-auth — VERIFIED 3/3", "│ ✓ tests       npm test → exit 0", "│ ⚠ unsure      the timeout constant"],
      diff: ["diff --git a/src/retry.ts b/src/retry.ts", "@@ -1,3 +1,4 @@", "+const seen = new Set();", "-let count = 0;"],
      brief: ["# Brief: fix the flaky auth test", "## What this repo already knows"],
      raw: ["09:00:01 tool     editing src/retry.ts"],
      intent: "fix the flaky auth test",
      state: "ready",
      workspace: "/tmp/wt",
    },
  };
  const receipt = stripAnsi(render(state, VIEW));
  assert.match(receipt, /VERIFIED 3\/3/);
  assert.match(receipt, /⚠ unsure/);
  assert.doesNotMatch(receipt, /diff --git/);

  const diffView = press(state, "v").state;
  assert.equal(diffView.reviewTab, "diff");
  const diffFrame = stripAnsi(render(diffView, VIEW));
  assert.match(diffFrame, /diff --git/);
  assert.match(diffFrame, /\+const seen/);

  assert.deepEqual(press(state, "m").effects, ["merge"]);
  assert.deepEqual(press(state, "o").effects, ["reveal"]);
});

test("rejecting demands a reason, and typing it never triggers shortcuts", () => {
  const state: UiState = {
    ...stateWithRuns(),
    screen: "review",
    review: { runId: "run-1", card: [], diff: [], brief: [], raw: [], intent: "x", state: "ready", workspace: "" },
  };
  const prompting = press(state, "x").state;
  assert.ok(prompting.prompt);

  // "m" and "q" are merge/quit shortcuts — inside the prompt they must be plain text.
  const typed = press(prompting, "m", "q", "!").state;
  assert.equal(typed.prompt?.input, "mq!");
  assert.equal(typed.quit, false);

  // An empty reason is refused: the reason is the memory.
  const empty = press({ ...prompting, prompt: { kind: "reject", runId: "run-1", input: "  " } }, "\r");
  assert.deepEqual(empty.effects, []);
  assert.match(empty.state.message ?? "", /reason is required/);

  const done = press(typed, "\r");
  assert.deepEqual(done.effects, ["reject"]);
  assert.equal(done.state.prompt, null);
});

test("dispatch takes an intent, cycles type, compiles, then confirms", () => {
  const start: UiState = { ...initialState(), screen: "dispatch" };
  const typed = press(start, "f", "i", "x", " ", "i", "t").state;
  assert.equal(typed.dispatchInput, "fix it");
  assert.match(stripAnsi(render(typed, VIEW)), /intent {2}fix it/);

  // Tab means "next screen" on every screen; the run type cycles with arrows.
  assert.equal(press(typed, "\t").state.screen, "memory");
  const retyped = press(typed, "\u001b[B").state;
  assert.notEqual(retyped.dispatchType, typed.dispatchType);
  assert.equal(press(retyped, "\u001b[A").state.dispatchType, typed.dispatchType);

  const compiling = press(retyped, "\r");
  assert.deepEqual(compiling.effects, ["compileBrief"]);

  // With a compiled brief on screen, enter dispatches and esc holds.
  const withBrief: UiState = { ...retyped, dispatchBriefLines: ["# Brief: fix it", "## What this repo already knows"] };
  assert.match(stripAnsi(render(withBrief, VIEW)), /this is what the agent will be told/);
  assert.deepEqual(press(withBrief, "\r").effects, ["dispatch"]);
  const held = press(withBrief, "");
  assert.deepEqual(held.effects, []);
  assert.match(held.state.message ?? "", /Held/);
});

test("memory search filters, and typing in it does not fire shortcuts", () => {
  const state: UiState = {
    ...initialState(),
    screen: "memory",
    memoryLoaded: true,
    memory: [
      { id: "1", title: "Retry path must be idempotent", type: "decision", author: "Dana Dev", noted_at: "2026-08-12", paths: ["src/retry.ts"], summary: "retries must be idempotent" },
      { id: "2", title: "Viewer assets ship from dist", type: "gotcha", author: null, noted_at: "2026-07-01", paths: ["mcp/daemon.ts"], summary: "packaged assets differ" },
    ],
  };
  const frame = stripAnsi(render(state, VIEW));
  assert.match(frame, /Retry path must be idempotent/);
  assert.match(frame, /Dana Dev, 2026-08-12/);
  assert.match(frame, /cites: src\/retry\.ts/);

  const searching = press(state, "/", "v", "i", "e", "w").state;
  assert.equal(searching.memoryQuery, "view");
  assert.equal(searching.quit, false);
  assert.deepEqual(filteredMemory(searching).map((row) => row.id), ["2"]);
});

test("screen switching, help, and quit behave", () => {
  const state = stateWithRuns();
  assert.equal(press(state, "2").state.screen, "review");
  assert.equal(press(state, "\t").state.screen, "review");
  // Memory loads on first visit, not at startup, so the console opens instantly.
  assert.equal(press(state, "4").effects[0], "loadMemory");
  assert.deepEqual(press({ ...state, memoryLoaded: true }, "4").effects, []);
  assert.equal(press(state, "q").state.quit, true);
  assert.equal(press(state, "").state.quit, true);

  const helped = press(state, "?").state;
  assert.match(stripAnsi(render(helped, VIEW)), /only executed checks do that/);
  // Any key dismisses help rather than acting.
  assert.equal(press(helped, "m").state.help, false);
});

// --- the Ask pane: talking to the manager ---------------------------------------

test("asking the manager records your turn, marks it busy, and never fires shortcuts", () => {
  const start: UiState = { ...initialState(), screen: "ask" };
  // "q" and "m" are quit/merge elsewhere; here they are just letters.
  const typed = press(start, "w", "h", "a", "t", " ", "q", "m", "?").state;
  assert.equal(typed.ask.input, "what qm?");
  assert.equal(typed.quit, false);

  const sent = press(typed, "\r");
  assert.deepEqual(sent.effects, ["ask"]);
  assert.equal(sent.state.ask.busy, true);
  assert.equal(sent.state.ask.input, "");
  assert.deepEqual(sent.state.ask.history, [{ role: "you", text: "what qm?" }]);

  // While busy, enter does not queue a second manager run.
  const again = press({ ...sent.state, ask: { ...sent.state.ask, input: "again" } }, "\r");
  assert.deepEqual(again.effects, []);

  const frame = stripAnsi(render(sent.state, VIEW));
  assert.match(frame, /you {2}what qm\?/);
  assert.match(frame, /working…/);
});

test("the ask pane shows the exchange and the empty state explains what it can do", () => {
  const empty = stripAnsi(render({ ...initialState(), screen: "ask" }, VIEW));
  assert.match(empty, /wearing Kage's constitution/);
  assert.match(empty, /every judgment it makes is recorded/);

  const withHistory: UiState = {
    ...initialState(),
    screen: "ask",
    ask: {
      history: [
        { role: "you", text: "what needs me?" },
        { role: "kage", text: "One claim is ready and one run is blocked on a backfill question.\n   (used kage_room_state)" },
      ],
      input: "",
      busy: false,
      streaming: [],
    },
  };
  const frame = stripAnsi(render(withHistory, VIEW));
  assert.match(frame, /you {2}what needs me\?/);
  assert.match(frame, /kage One claim is ready/);
  assert.match(frame, /used kage_room_state/);
});

test("the ask pane streams what the manager is doing instead of a blank stare", () => {
  const working: UiState = {
    ...initialState(),
    screen: "ask",
    ask: {
      history: [{ role: "you", text: "what needs me?" }],
      input: "",
      busy: true,
      streaming: ["· kage_room_state", "Checking the board now.", "· kage_compile_brief: fix the flaky auth test"],
    },
  };
  const frame = stripAnsi(render(working, VIEW));
  assert.match(frame, /· kage_room_state/);
  assert.match(frame, /Checking the board now\./);
  assert.match(frame, /· kage_compile_brief: fix the flaky auth test/);
  assert.match(frame, /working…/);
  // You can keep typing while it works.
  assert.match(frame, /type your next message any time/);
});

test("review's raw tab is a genuine escape hatch, reachable in one keystroke", () => {
  const state: UiState = {
    ...initialState(),
    screen: "review",
    review: {
      runId: "r",
      card: ["summary only"],
      diff: ["diff --git a/x b/x"],
      brief: ["# Brief"],
      raw: ["09:00:01 tool     editing src/retry.ts", "09:00:02 stdout   {\"raw\":\"event\"}"],
      intent: "i",
      state: "blocked",
      workspace: "",
      waiting: { detail: "asking: which name?", needs: "reply with the new name" },
    },
  };
  // A waiting agent says so at the top of every view.
  assert.match(stripAnsi(render(state, VIEW)), /⏸ waiting on you: reply with the new name/);

  // v cycles receipt → diff → brief → raw, and raw shows unfiltered transcript events.
  const tabs = ["diff", "brief", "raw"];
  let cycled = state;
  for (const expected of tabs) {
    cycled = press(cycled, "v").state;
    assert.equal(cycled.reviewTab, expected);
  }
  const raw = stripAnsi(render(cycled, VIEW));
  assert.match(raw, /09:00:01 tool     editing src\/retry\.ts/);
  assert.match(raw, /"raw":"event"/);
});

test("screen 5 reaches Ask and tab cycles through all five screens", () => {
  const state = stateWithRuns();
  assert.equal(press(state, "5").state.screen, "ask");
  let cycled = state;
  const seen: string[] = [];
  for (let index = 0; index < 5; index += 1) {
    cycled = press(cycled, "\t").state;
    seen.push(cycled.screen);
  }
  assert.deepEqual(seen, ["review", "dispatch", "memory", "ask", "board"]);
});

// --- regressions for the rendering bugs found on first real use -----------------

test("multi-key chunks split correctly, so held arrows and pastes are not dropped", () => {
  assert.deepEqual(splitKeys("[A[B"), ["[A", "[B"]);
  assert.deepEqual(splitKeys("abc"), ["a", "b", "c"]);
  assert.deepEqual(splitKeys("[5~x"), ["[5~", "x"]);
  assert.deepEqual(splitKeys(""), [""]);
  // A held arrow key arrives as one chunk of repeats; every repeat must register.
  const state = stateWithRuns();
  let next = state;
  for (const raw of splitKeys("[B[B")) next = reduce(next, decodeKey(raw)).state;
  assert.equal(next.boardIndex, 2);
});

test("no frame line reaches the final column (auto-wrap would scroll the screen)", () => {
  const view = { width: 60, height: 14 };
  for (const line of renderLines(stateWithRuns(), view)) {
    assert.ok(stripAnsi(line).length <= view.width - 1, `line touches the last column: ${JSON.stringify(stripAnsi(line))}`);
  }
});

test("truncating styled text closes its escape sequence instead of leaking it", () => {
  setColorEnabled(true);
  const styled = style("abcdefghij", "green");
  const cut = truncate(styled, 5);
  assert.ok(stripAnsi(cut).length <= 5);
  assert.ok(cut.endsWith("[0m"), "a cut line must reset styling or the colour bleeds down the screen");
  setColorEnabled(false);
});

test("review scrolling stops at the end of the content", () => {
  const state: UiState = {
    ...initialState(),
    screen: "review",
    review: { runId: "r", card: ["a", "b", "c"], diff: ["d1"], brief: ["b1"], raw: ["r1"], intent: "i", state: "ready", workspace: "" },
  };
  let scrolled = state;
  for (let index = 0; index < 30; index += 1) scrolled = press(scrolled, "[B").state;
  assert.equal(scrolled.scroll, 2, "receipt scroll must clamp to its last line");

  const onDiff = press({ ...scrolled, scroll: 0 }, "v").state;
  let diffScrolled = onDiff;
  for (let index = 0; index < 10; index += 1) diffScrolled = press(diffScrolled, "[B").state;
  assert.equal(diffScrolled.scroll, 0, "a one-line diff cannot scroll");
  assert.equal(press(diffScrolled, "G").state.scroll, 0);
});

test("the board hides finished runs, keeps needs-you first, and can show them on demand", () => {
  const state: UiState = {
    ...stateWithRuns(),
    runs: [
      { id: "merged-one", state: "merged", type: "chore", agent: "claude", intent: "done", elapsed: "1m", detail: "merged", needsYou: false },
      { id: "running-one", state: "running", type: "chore", agent: "claude", intent: "working", elapsed: "2m", detail: "editing", needsYou: false },
      { id: "ready-one", state: "ready", type: "chore", agent: "claude", intent: "awaits you", elapsed: "3m", detail: "verified 3/3", needsYou: true },
    ],
  };
  const rows = visibleRuns(state);
  assert.deepEqual(rows.map((row) => row.id), ["ready-one", "running-one"]);
  assert.equal(closedCount(state), 1);

  const frame = stripAnsi(render(state, VIEW));
  assert.match(frame, /2 open run\(s\) · 1 needs you/);
  assert.match(frame, /\(1 finished · "a" to show\)/);
  assert.doesNotMatch(frame, /merged-one/);

  const all = press(state, "a").state;
  assert.equal(visibleRuns(all).length, 3);
  assert.match(stripAnsi(render(all, VIEW)), /merged-one/);
});

test("enter acts on the run the cursor is actually on after sorting", () => {
  const state: UiState = {
    ...initialState(),
    runs: [
      { id: "running-one", state: "running", type: "chore", agent: "claude", intent: "w", elapsed: "2m", detail: "editing", needsYou: false },
      { id: "blocked-one", state: "blocked", type: "chore", agent: "claude", intent: "b", elapsed: "3m", detail: "a question", needsYou: true },
    ],
  };
  // needs-you sorts first, so index 0 is the blocked run, not the first in the array —
  // and a blocked run gets the answer prompt rather than the review screen.
  const prompted = reduce(state, decodeKey("\r"));
  assert.deepEqual(prompted.effect, { kind: "none" });
  assert.equal(prompted.state.prompt?.runId, "blocked-one");
  assert.deepEqual(reduce(state, decodeKey("i")).effect, { kind: "openReview", runId: "blocked-one" });
});

test("frames always fit the viewport", () => {
  const narrow = { width: 40, height: 12 };
  const frame = render(stateWithRuns(), narrow);
  const lines = frame.split("\n");
  assert.equal(lines.length, narrow.height);
  for (const line of lines) assert.ok(stripAnsi(line).length <= narrow.width, `line too wide: ${JSON.stringify(line)}`);
});

test("diff and receipt painting mark the lines that matter", () => {
  setColorEnabled(true);
  assert.match(paintDiffLine("+added", 40), /\[32m/);
  assert.match(paintDiffLine("-removed", 40), /\[31m/);
  assert.match(paintCardLine("│ ✗ tests  exit 1", 40), /\[31m/);
  // The honesty case: an unverified claim must never render in the "all good" colour.
  const unverified = paintCardLine("┌ CLAIM — UNVERIFIED — nothing was executed", 60);
  // (Combined styles emit one sequence, e.g. ESC[93;1m for brightYellow+bold.)
  assert.match(unverified, /\[93[;m]/);
  assert.doesNotMatch(unverified, /\[92[;m]/);
  assert.match(paintCardLine("┌ CLAIM — VERIFIED 3/3", 60), /\[92[;m]/);
  setColorEnabled(false);
});
