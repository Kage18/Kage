// TUI state + reducer. Deliberately pure: every keystroke maps (state, key) → (state,
// effect), so the whole interaction model is unit-testable without a terminal. The
// imperative shell in app.ts only paints frames and performs effects.
import type { RunType } from "../contract.js";
import { RUN_TYPES } from "../contract.js";
import type { Key } from "./ansi.js";

export type ScreenName = "board" | "review" | "dispatch" | "memory" | "ask";

export const SCREENS: ScreenName[] = ["board", "review", "dispatch", "memory", "ask"];

export interface RunRow {
  id: string;
  state: string;
  type: string;
  agent: string;
  intent: string;
  elapsed: string;
  detail: string;
  needsYou: boolean;
}

export interface MemoryRow {
  id: string;
  title: string;
  type: string;
  author: string | null;
  noted_at: string;
  paths: string[];
  summary: string;
}

// "raw" is the escape hatch, and it must be genuinely raw — a density control whose
// top setting still hides things (Cursor's "Detailed" mode folding MCP calls) is worse
// than no control at all, because it teaches the user the tool lies about completeness.
export type ReviewTab = "receipt" | "diff" | "brief" | "raw";
export const REVIEW_TABS: ReviewTab[] = ["receipt", "diff", "brief", "raw"];

export interface ReviewData {
  runId: string;
  /** The verbose receipt: claim, every check with its evidence, unsure notes, learnings. */
  card: string[];
  diff: string[];
  /** What the agent was actually told — reviewing output without the instruction is guesswork. */
  brief: string[];
  /** Every transcript event, unfiltered. The escape hatch from every summary above. */
  raw: string[];
  intent: string;
  state: string;
  workspace: string;
  /** The question this agent is waiting on, if it is. */
  waiting?: { detail: string; needs: string };
}

export interface UiState {
  screen: ScreenName;
  runs: RunRow[];
  boardIndex: number;
  review: ReviewData | null;
  reviewTab: ReviewTab;
  /** Memory is loaded on first visit, not at startup — opening the console must be instant. */
  memoryLoaded: boolean;
  scroll: number;
  dispatchInput: string;
  dispatchType: RunType;
  dispatchBriefLines: string[] | null;
  dispatchBusy: boolean;
  memory: MemoryRow[];
  memoryIndex: number;
  memoryQuery: string;
  memoryTyping: boolean;
  /** Finished runs are hidden by default — the board is a worklist, not a history. */
  showClosed: boolean;
  /** The conversation with the manager: your own agent, wearing Kage's constitution. */
  ask: {
    history: Array<{ role: "you" | "kage"; text: string }>;
    input: string;
    busy: boolean;
    /** What the manager is doing right now, streamed rather than withheld until done. */
    streaming: string[];
  };
  prompt: { kind: "reject" | "answer"; runId: string; input: string } | null;
  message: string | null;
  help: boolean;
  quit: boolean;
}

export type Effect =
  | { kind: "none" }
  | { kind: "openReview"; runId: string }
  | { kind: "compileBrief"; intent: string; type: RunType }
  | { kind: "dispatch"; intent: string; type: RunType }
  | { kind: "merge"; runId: string }
  | { kind: "reject"; runId: string; reason: string }
  | { kind: "reveal"; runId: string }
  | { kind: "answer"; runId: string; text: string }
  | { kind: "loadMemory" }
  | { kind: "ask"; question: string }
  | { kind: "refresh" };

export function initialState(): UiState {
  return {
    screen: "board",
    runs: [],
    boardIndex: 0,
    review: null,
    reviewTab: "receipt",
    scroll: 0,
    dispatchInput: "",
    dispatchType: "chore",
    dispatchBriefLines: null,
    dispatchBusy: false,
    memory: [],
    memoryLoaded: false,
    memoryIndex: 0,
    memoryQuery: "",
    memoryTyping: false,
    showClosed: false,
    ask: { history: [], input: "", busy: false, streaming: [] },
    prompt: null,
    message: null,
    help: false,
    quit: false,
  };
}

const NONE: Effect = { kind: "none" };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const CLOSED_STATES = new Set(["merged", "rejected"]);

// What the board shows: open work, with whatever needs a human first. A board that
// accumulates every finished run becomes a log nobody reads.
export function visibleRuns(state: UiState): RunRow[] {
  const rows = state.showClosed ? state.runs : state.runs.filter((run) => !CLOSED_STATES.has(run.state));
  return [...rows].sort((a, b) => Number(b.needsYou) - Number(a.needsYou));
}

export function closedCount(state: UiState): number {
  return state.runs.filter((run) => CLOSED_STATES.has(run.state)).length;
}

export function filteredMemory(state: UiState): MemoryRow[] {
  const query = state.memoryQuery.trim().toLowerCase();
  if (!query) return state.memory;
  return state.memory.filter((row) =>
    `${row.title} ${row.summary} ${row.paths.join(" ")} ${row.type}`.toLowerCase().includes(query),
  );
}

// One reducer for every screen. Text-entry modes (dispatch input, memory search, the
// reject prompt) swallow printable keys first so typing never triggers a shortcut —
// the classic TUI bug where typing "m" in a search box merges a branch.
export function reduce(state: UiState, key: Key): { state: UiState; effect: Effect } {
  if (key.ctrl && (key.name === "c" || key.name === "d")) return { state: { ...state, quit: true }, effect: NONE };

  // Modal: rejecting a claim, or answering a blocked agent without leaving the board.
  if (state.prompt) {
    if (key.name === "escape") return { state: { ...state, prompt: null, message: "Cancelled." }, effect: NONE };
    if (key.name === "enter") {
      const value = state.prompt.input.trim();
      if (state.prompt.kind === "answer") {
        if (!value) return { state: { ...state, message: "Type your answer — it goes straight to the waiting agent." }, effect: NONE };
        return { state: { ...state, prompt: null }, effect: { kind: "answer", runId: state.prompt.runId, text: value } };
      }
      if (!value) return { state: { ...state, message: "A reason is required — it becomes memory." }, effect: NONE };
      return { state: { ...state, prompt: null }, effect: { kind: "reject", runId: state.prompt.runId, reason: value } };
    }
    if (key.name === "backspace") {
      return { state: { ...state, prompt: { ...state.prompt, input: state.prompt.input.slice(0, -1) } }, effect: NONE };
    }
    if (key.raw.length === 1 && key.raw >= " ") {
      return { state: { ...state, prompt: { ...state.prompt, input: state.prompt.input + key.raw } }, effect: NONE };
    }
    return { state, effect: NONE };
  }

  if (state.help) {
    return { state: { ...state, help: false }, effect: NONE };
  }

  // Text entry: dispatch intent.
  if (state.screen === "dispatch" && !state.dispatchBriefLines) {
    if (key.name === "enter" && state.dispatchInput.trim()) {
      return { state: { ...state, message: "compiling brief…" }, effect: { kind: "compileBrief", intent: state.dispatchInput.trim(), type: state.dispatchType } };
    }
    if (key.name === "backspace") return { state: { ...state, dispatchInput: state.dispatchInput.slice(0, -1) }, effect: NONE };
    // Tab means ONE thing everywhere: next screen. The run type cycles with the arrow
    // keys, which are otherwise unused while typing an intent.
    if (key.name === "tab") {
      const next = SCREENS[(SCREENS.indexOf(state.screen) + 1) % SCREENS.length];
      return { state: { ...state, screen: next, scroll: 0 }, effect: NONE };
    }
    if (key.name === "down" || key.name === "right") {
      const next = RUN_TYPES[(RUN_TYPES.indexOf(state.dispatchType) + 1) % RUN_TYPES.length];
      return { state: { ...state, dispatchType: next }, effect: NONE };
    }
    if (key.name === "up" || key.name === "left") {
      const next = RUN_TYPES[(RUN_TYPES.indexOf(state.dispatchType) + RUN_TYPES.length - 1) % RUN_TYPES.length];
      return { state: { ...state, dispatchType: next }, effect: NONE };
    }
    if (key.name === "escape") return { state: { ...state, screen: "board", dispatchInput: "" }, effect: NONE };
    if (key.raw.length === 1 && key.raw >= " ") {
      return { state: { ...state, dispatchInput: state.dispatchInput + key.raw }, effect: NONE };
    }
    return { state, effect: NONE };
  }

  // Text entry: talking to the manager. Like every other text mode, printable keys are
  // swallowed here before any global shortcut can fire.
  if (state.screen === "ask") {
    if (key.name === "enter" && state.ask.input.trim() && !state.ask.busy) {
      const question = state.ask.input.trim();
      return {
        state: {
          ...state,
          ask: { history: [...state.ask.history, { role: "you", text: question }], input: "", busy: true, streaming: [] },
        },
        effect: { kind: "ask", question },
      };
    }
    if (key.name === "backspace") return { state: { ...state, ask: { ...state.ask, input: state.ask.input.slice(0, -1) } }, effect: NONE };
    if (key.name === "escape") return { state: { ...state, screen: "board" }, effect: NONE };
    // Digits are text here (you may want to type "fix issue 3"), so tab is the only way
    // out to another screen — it must not be swallowed by the input.
    if (key.name === "tab") {
      const next = SCREENS[(SCREENS.indexOf(state.screen) + 1) % SCREENS.length];
      return { state: { ...state, screen: next, scroll: 0 }, effect: NONE };
    }
    if (key.ctrl && key.name === "l") return { state: { ...state, ask: { ...state.ask, history: [] } }, effect: NONE };
    if (key.raw.length === 1 && key.raw >= " ") {
      return { state: { ...state, ask: { ...state.ask, input: state.ask.input + key.raw } }, effect: NONE };
    }
    return { state, effect: NONE };
  }

  // Text entry: memory search.
  if (state.screen === "memory" && state.memoryTyping) {
    if (key.name === "enter" || key.name === "escape") return { state: { ...state, memoryTyping: false }, effect: NONE };
    if (key.name === "backspace") return { state: { ...state, memoryQuery: state.memoryQuery.slice(0, -1), memoryIndex: 0 }, effect: NONE };
    if (key.raw.length === 1 && key.raw >= " ") {
      return { state: { ...state, memoryQuery: state.memoryQuery + key.raw, memoryIndex: 0 }, effect: NONE };
    }
    return { state, effect: NONE };
  }

  // Global navigation.
  if (key.name === "q") return { state: { ...state, quit: true }, effect: NONE };
  if (key.name === "?") return { state: { ...state, help: true }, effect: NONE };
  if (key.name === "1") return { state: { ...state, screen: "board", scroll: 0 }, effect: NONE };
  if (key.name === "2") return { state: { ...state, screen: "review", scroll: 0 }, effect: NONE };
  if (key.name === "3") return { state: { ...state, screen: "dispatch", scroll: 0, dispatchBriefLines: null }, effect: NONE };
  if (key.name === "4") {
    return {
      state: { ...state, screen: "memory", scroll: 0 },
      effect: state.memoryLoaded ? NONE : { kind: "loadMemory" },
    };
  }
  if (key.name === "5") return { state: { ...state, screen: "ask", scroll: 0 }, effect: NONE };
  if (key.name === "tab") {
    const next = SCREENS[(SCREENS.indexOf(state.screen) + 1) % SCREENS.length];
    return { state: { ...state, screen: next, scroll: 0 }, effect: NONE };
  }
  if (key.name === "r" && state.screen === "board") return { state, effect: { kind: "refresh" } };

  if (state.screen === "board") {
    const rows = visibleRuns(state);
    const last = Math.max(0, rows.length - 1);
    if (key.name === "up" || key.name === "k") return { state: { ...state, boardIndex: clamp(state.boardIndex - 1, 0, last) }, effect: NONE };
    if (key.name === "down" || key.name === "j") return { state: { ...state, boardIndex: clamp(state.boardIndex + 1, 0, last) }, effect: NONE };
    if (key.name === "a") return { state: { ...state, showClosed: !state.showClosed, boardIndex: 0 }, effect: NONE };
    // Answer a waiting agent from the overview. Making someone leave the board, find a
    // run id and retype it is how an orchestrator gets bypassed for raw tmux.
    if (key.name === "enter") {
      const run = rows[state.boardIndex];
      if (!run) return { state, effect: NONE };
      if (run.state === "blocked" || run.state === "dropped") {
        return { state: { ...state, prompt: { kind: "answer", runId: run.id, input: "" } }, effect: NONE };
      }
      return { state, effect: { kind: "openReview", runId: run.id } };
    }
    if (key.name === "i") {
      const run = rows[state.boardIndex];
      return run ? { state, effect: { kind: "openReview", runId: run.id } } : { state, effect: NONE };
    }
    if (key.name === "d") return { state: { ...state, screen: "dispatch", dispatchBriefLines: null }, effect: NONE };
    return { state, effect: NONE };
  }

  if (state.screen === "review") {
    if (!state.review) return { state, effect: NONE };
    // Scrolling must stop at the end of the content; an unbounded counter walks the
    // reader off into blank screens with no way to tell how far they have gone.
    const source = state.reviewTab === "receipt" ? state.review.card : state.review.diff;
    const maxScroll = Math.max(0, source.length - 1);
    if (key.name === "up" || key.name === "k") return { state: { ...state, scroll: Math.max(0, state.scroll - 1) }, effect: NONE };
    if (key.name === "down" || key.name === "j") return { state: { ...state, scroll: clamp(state.scroll + 1, 0, maxScroll) }, effect: NONE };
    if (key.name === "pageup") return { state: { ...state, scroll: Math.max(0, state.scroll - 15) }, effect: NONE };
    if (key.name === "pagedown") return { state: { ...state, scroll: clamp(state.scroll + 15, 0, maxScroll) }, effect: NONE };
    if (key.name === "home" || key.name === "g") return { state: { ...state, scroll: 0 }, effect: NONE };
    if (key.name === "end" || key.name === "G") return { state: { ...state, scroll: maxScroll }, effect: NONE };
    if (key.name === "v" || key.name === "right") {
      const next = REVIEW_TABS[(REVIEW_TABS.indexOf(state.reviewTab) + 1) % REVIEW_TABS.length];
      return { state: { ...state, reviewTab: next, scroll: 0 }, effect: NONE };
    }
    if (key.name === "left") {
      const next = REVIEW_TABS[(REVIEW_TABS.indexOf(state.reviewTab) + REVIEW_TABS.length - 1) % REVIEW_TABS.length];
      return { state: { ...state, reviewTab: next, scroll: 0 }, effect: NONE };
    }
    if (key.name === "m") return { state, effect: { kind: "merge", runId: state.review.runId } };
    if (key.name === "x") return { state: { ...state, prompt: { kind: "reject", runId: state.review.runId, input: "" } }, effect: NONE };
    if (key.name === "o") return { state, effect: { kind: "reveal", runId: state.review.runId } };
    return { state, effect: NONE };
  }

  if (state.screen === "dispatch" && state.dispatchBriefLines) {
    if (key.name === "enter" || key.name === "y") {
      return {
        state: { ...state, dispatchBriefLines: null, dispatchBusy: true, message: "dispatching…", screen: "board" },
        effect: { kind: "dispatch", intent: state.dispatchInput.trim(), type: state.dispatchType },
      };
    }
    if (key.name === "escape" || key.name === "n") {
      return { state: { ...state, dispatchBriefLines: null, message: "Held — nothing dispatched." }, effect: NONE };
    }
    const maxBriefScroll = Math.max(0, state.dispatchBriefLines.length - 1);
    if (key.name === "up") return { state: { ...state, scroll: Math.max(0, state.scroll - 1) }, effect: NONE };
    if (key.name === "down") return { state: { ...state, scroll: clamp(state.scroll + 1, 0, maxBriefScroll) }, effect: NONE };
    return { state, effect: NONE };
  }

  if (state.screen === "memory") {
    const rows = filteredMemory(state);
    if (key.name === "/") return { state: { ...state, memoryTyping: true }, effect: NONE };
    if (key.name === "up" || key.name === "k") return { state: { ...state, memoryIndex: clamp(state.memoryIndex - 1, 0, Math.max(0, rows.length - 1)) }, effect: NONE };
    if (key.name === "down" || key.name === "j") return { state: { ...state, memoryIndex: clamp(state.memoryIndex + 1, 0, Math.max(0, rows.length - 1)) }, effect: NONE };
    return { state, effect: NONE };
  }

  return { state, effect: NONE };
}
