// Pure rendering: state → array of lines. No terminal calls here, which is what makes
// every screen assertable in a unit test.
import { type Style, fit, style, truncate, visibleWidth, wrap } from "./ansi.js";
import { REVIEW_TABS, SCREENS, type UiState, closedCount, filteredMemory, visibleRuns } from "./state.js";

export interface Viewport {
  width: number;
  height: number;
}

const TAB_LABELS: Record<string, string> = {
  board: "1 Board",
  review: "2 Review",
  dispatch: "3 Dispatch",
  memory: "4 Memory",
  ask: "5 Ask",
};

function header(state: UiState, view: Viewport): string {
  const tabs = SCREENS.map((name) =>
    name === state.screen ? style(` ${TAB_LABELS[name]} `, "reverse", "bold") : style(` ${TAB_LABELS[name]} `, "dim"),
  ).join("");
  const brand = style(" kage ", "bold", "brightMagenta");
  return fit(`${brand}${tabs}`, view.width);
}

function footer(state: UiState, view: Viewport): string {
  if (state.prompt) {
    const label = state.prompt.kind === "answer" ? "your answer" : "reason";
    const hint = state.prompt.kind === "answer" ? "enter sends it to the waiting agent" : "enter to reject";
    return style(fit(`  ${label}: ${state.prompt.input}▌  (${hint} · esc to cancel)`, view.width), "brightYellow");
  }
  if (state.message) return style(fit(`  ${state.message}`, view.width), "brightCyan");
  const hints: Record<string, string> = {
    board: "↑↓ select · enter answer/review · i inspect · d dispatch · a show finished · r refresh · ? help",
    review: "↑↓/pgdn scroll · v/←→ receipt·diff·brief·raw · m merge · x reject · o worktree · g/G top/end",
    dispatch: "type an intent · ↑↓ changes type · enter compiles the brief · tab next screen · esc back",
    memory: "↑↓ select · / search · tab next screen · q quit",
    ask: "type a question or an instruction · enter sends · ctrl-l clears · esc back",
  };
  return style(fit(`  ${hints[state.screen] ?? ""}`, view.width), "dim");
}

function stateStyle(runState: string): Style {
  if (runState === "running") return "brightCyan";
  // reviewing is deliberately its own color (the brand accent, matching the header) —
  // never brightGreen/brightYellow, both of which already read as a verdict here.
  if (runState === "reviewing") return "brightMagenta";
  if (runState === "ready" || runState === "approved") return "brightGreen";
  if (runState === "blocked" || runState === "changes_requested") return "brightYellow";
  if (runState === "failed") return "red";
  if (runState === "merged") return "green";
  return "gray";
}

function badge(runState: string): string {
  const marks: Record<string, string> = {
    running: "▶", ready: "✓", blocked: "⏸", failed: "✗", merged: "◆", rejected: "·", stopped: "■",
    reviewing: "◐", approved: "✓", changes_requested: "↺",
  };
  return marks[runState] ?? "·";
}

function renderBoard(state: UiState, view: Viewport, body: number): string[] {
  const rows = visibleRuns(state);
  const closed = closedCount(state);
  if (!rows.length) {
    return [
      "",
      style(state.runs.length ? "  Nothing open — every run is finished." : "  No runs yet.", "dim"),
      "",
      '  Press "d" to dispatch one, or run:  kage dispatch "<intent>"',
      ...(closed ? ["", style(`  ${closed} finished run(s) hidden — press "a" to show them.`, "dim")] : []),
    ];
  }
  const idWidth = Math.min(38, Math.max(...rows.map((run) => Math.min(run.id.length, 38))));
  const needsAttention = rows.filter((run) => run.needsYou).length;
  const lines: string[] = [
    "",
    style(
      `  ${rows.length} ${state.showClosed ? "run(s)" : "open run(s)"}${needsAttention ? ` · ${needsAttention} need${needsAttention === 1 ? "s" : ""} you` : ""}` +
        (closed && !state.showClosed ? style(`   (${closed} finished · "a" to show)`, "dim") : ""),
      "bold",
    ),
    "",
  ];
  const rowsFit = Math.max(1, body - 4);
  const start = Math.max(0, Math.min(state.boardIndex - Math.floor(rowsFit / 2), Math.max(0, rows.length - rowsFit)));
  rows.slice(start, start + rowsFit).forEach((run, offset) => {
    const index = start + offset;
    const selected = index === state.boardIndex;
    const detailWidth = Math.max(8, view.width - idWidth - 26);
    const row = `${badge(run.state)} ${fit(run.id, idWidth)} ${fit(run.state, 8)} ${run.elapsed.padStart(7)}  ${fit(truncate(run.detail, detailWidth), detailWidth)}`;
    lines.push(selected ? style(fit(`  ${row}`, view.width), "reverse") : `  ${style(row, stateStyle(run.state))}`);
  });
  return lines;
}

function reviewSource(state: UiState): string[] {
  if (!state.review) return [];
  if (state.reviewTab === "diff") return state.review.diff;
  if (state.reviewTab === "brief") return state.review.brief;
  if (state.reviewTab === "raw") return state.review.raw;
  return state.review.card;
}

function renderReview(state: UiState, view: Viewport, body: number): string[] {
  if (!state.review) {
    return ["", style("  No run selected — pick one on the Board and press enter.", "dim")];
  }
  const tabs = REVIEW_TABS.map((name) =>
    name === state.reviewTab ? style(` ${name} `, "reverse") : style(` ${name} `, "dim"),
  ).join(" ");
  const source = reviewSource(state);
  const waiting = state.review.waiting
    ? [style(`  ⏸ waiting on you: ${state.review.waiting.needs || state.review.waiting.detail}`, "brightYellow", "bold"), ""]
    : [];
  const head = ["", `  ${tabs}    ${style(`${source.length} line(s)`, "dim")}`, "", ...waiting];
  const room = Math.max(1, body - head.length - 1);
  const visible = source.slice(state.scroll, state.scroll + room);
  const paint = state.reviewTab === "diff" ? paintDiffLine : paintCardLine;
  const painted = visible.map((line) => `  ${paint(line, view.width - 4)}`);
  const remaining = source.length - state.scroll - visible.length;
  const footerLine = remaining > 0
    ? style(`  ↓ ${remaining} more line(s)  ·  ${Math.round(((state.scroll + visible.length) / source.length) * 100)}%`, "dim")
    : style("  — end —", "dim");
  return [...head, ...painted, footerLine];
}

// Diff colouring is the one place a terminal genuinely beats a plain CLI dump.
export function paintDiffLine(line: string, width: number): string {
  const clipped = truncate(line, width);
  if (clipped.startsWith("+++") || clipped.startsWith("---")) return style(clipped, "bold");
  if (clipped.startsWith("@@")) return style(clipped, "brightCyan");
  if (clipped.startsWith("+")) return style(clipped, "green");
  if (clipped.startsWith("-")) return style(clipped, "red");
  if (clipped.startsWith("diff --git")) return style(clipped, "bold", "brightBlue");
  return style(clipped, "gray");
}

export function paintCardLine(line: string, width: number): string {
  const clipped = truncate(line, width);
  if (clipped.includes("VERIFIED") && !clipped.includes("NOT VERIFIED") && !clipped.includes("UNVERIFIED")) return style(clipped, "brightGreen", "bold");
  if (clipped.includes("NOT VERIFIED") || clipped.includes("UNVERIFIED")) return style(clipped, "brightYellow", "bold");
  // Section headings in the verbose receipt (RUN, CHECKS, UNSURE, LEARNINGS…).
  if (/^[A-Z][A-Z' ]{3,}/.test(clipped)) return style(clipped, "bold", "brightBlue");
  if (/^\s*│?\s*✓/.test(clipped)) return style(clipped, "green");
  if (/^\s*│?\s*✗/.test(clipped)) return style(clipped, "red");
  if (/^\s*│?\s*[?!]/.test(clipped)) return style(clipped, "yellow");
  if (/^\s*│?\s*⚠/.test(clipped)) return style(clipped, "brightYellow");
  if (/^\s*│?\s*\+/.test(clipped)) return style(clipped, "brightMagenta");
  // Evidence-log excerpts are quoted with a bar; keep them visually subordinate.
  if (/^\s*│ /.test(clipped)) return style(clipped, "gray");
  if (/^\s{6}(command|expected|evidence):/.test(clipped)) return style(clipped, "dim");
  return clipped;
}

function renderDispatch(state: UiState, view: Viewport, body: number): string[] {
  if (state.dispatchBriefLines) {
    const visible = state.dispatchBriefLines.slice(state.scroll, state.scroll + body - 5);
    return [
      "",
      style("  Brief compiled — this is what the agent will be told:", "bold"),
      "",
      ...visible.map((line) => `  ${truncate(line, view.width - 4)}`),
      "",
      style("  enter/y dispatch it · esc/n hold · ↑↓ scroll", "brightCyan"),
    ];
  }
  return [
    "",
    style("  What should Kage delegate?", "bold"),
    "",
    `  ${style("intent", "dim")}  ${state.dispatchInput}${style("▌", "brightCyan")}`,
    `  ${style("type  ", "dim")}  ${style(state.dispatchType, "brightMagenta")} ${style("(↑↓ to change)", "dim")}`,
    "",
    style("  Kage will compile a brief from repo memory before anything runs.", "dim"),
  ];
}

function renderMemory(state: UiState, view: Viewport, body: number): string[] {
  if (!state.memoryLoaded) return ["", style("  loading memory…", "dim")];
  const rows = filteredMemory(state);
  const lines = [
    "",
    `  ${style("search", "dim")} ${state.memoryQuery}${state.memoryTyping ? style("▌", "brightCyan") : ""}   ${style(`${rows.length} verified memor${rows.length === 1 ? "y" : "ies"}`, "dim")}`,
    "",
  ];
  if (!rows.length) {
    lines.push(style("  Nothing matches. Memory grows as runs are merged.", "dim"));
    return lines;
  }
  const listHeight = Math.max(3, Math.floor((body - 4) / 2));
  const start = Math.max(0, Math.min(state.memoryIndex - Math.floor(listHeight / 2), Math.max(0, rows.length - listHeight)));
  rows.slice(start, start + listHeight).forEach((row, offset) => {
    const index = start + offset;
    const meta = `${row.author ? `${row.author}, ` : ""}${row.noted_at}`;
    const text = `${fit(row.type, 10)} ${fit(truncate(row.title, view.width - 34), view.width - 34)} ${style(meta, "dim")}`;
    lines.push(index === state.memoryIndex ? style(fit(`  ${text}`, view.width), "reverse") : `  ${text}`);
  });
  const selected = rows[state.memoryIndex];
  if (selected) {
    lines.push("", style(`  ${"─".repeat(Math.max(0, view.width - 4))}`, "dim"));
    for (const line of wrap(selected.summary, view.width - 6).slice(0, Math.max(2, body - listHeight - 8))) {
      lines.push(`  ${style(line, "dim")}`);
    }
    if (selected.paths.length) lines.push("", style(`  cites: ${truncate(selected.paths.join(", "), view.width - 12)}`, "brightBlue"));
  }
  return lines;
}

function renderAsk(state: UiState, view: Viewport, body: number): string[] {
  const width = view.width - 6;
  const lines: string[] = [""];
  if (!state.ask.history.length) {
    lines.push(
      style("  Ask Kage — your own coding agent, wearing Kage's constitution.", "bold"),
      "",
      style("  It can read the board, compile a brief, dispatch, steer, merge, or reject —", "dim"),
      style("  and every judgment it makes is recorded with the run.", "dim"),
      "",
      style('  Try: "what needs me?"  ·  "fix the flaky auth test"  ·  "why is payments blocked?"', "dim"),
      "",
    );
  }
  // Newest exchange stays visible: an assistant pane that scrolls away from the answer
  // you just asked for is useless.
  const rendered: string[] = [];
  for (const turn of state.ask.history) {
    const label = turn.role === "you" ? style("  you ", "dim") : style("  kage", "brightMagenta");
    const wrapped = wrap(turn.text, width);
    rendered.push(`${label} ${wrapped[0] ?? ""}`);
    for (const line of wrapped.slice(1)) rendered.push(`       ${line}`);
    rendered.push("");
  }
  // While the manager works, show what it is doing as it does it. A pane that stares
  // back blankly for twenty seconds reads as broken, however good the eventual answer.
  if (state.ask.busy) {
    for (const line of state.ask.streaming.slice(-6)) {
      rendered.push(line.startsWith("·") ? style(`  ${line}`, "dim") : `  ${style("kage", "brightMagenta")} ${truncate(line, width)}`);
    }
  }
  const room = Math.max(2, body - lines.length - 3);
  lines.push(...rendered.slice(-room));
  lines.push(
    state.ask.busy
      ? style("  kage  working…  (the board keeps updating; type your next message any time)", "brightCyan")
      : `  ${style("›", "brightMagenta")} ${state.ask.input}${style("▌", "brightCyan")}`,
  );
  return lines;
}

const HELP = [
  "",
  "  kage — delegation console",
  "",
  "  1/2/3/4 or tab   switch screens",
  "  Board            ↑↓ select · enter answers a waiting agent (or opens review) · i inspect",
  "                   d dispatch · a show finished · r refresh",
  "  Review           ↑↓/pgup/pgdn scroll · v cycles receipt · diff · brief · raw",
  "                   m merge · x reject · o worktree path · g/G top/end",
  "  Dispatch         type an intent · ↑↓ cycles type · enter compiles · enter again dispatches",
  "  Memory           / search · ↑↓ select",
  "  Ask              talk to the manager: it can dispatch, steer, merge, reject",
  "  q                quit",
  "",
  "  Nothing here can mark a claim verified — only executed checks do that.",
  "",
  "  press any key to go back",
];

export function renderLines(state: UiState, view: Viewport): string[] {
  // Never draw into the final column: a glyph in the last cell can trigger the
  // terminal's auto-wrap and scroll the entire frame up by a row.
  const width = Math.max(20, view.width - 1);
  const inner = { width, height: view.height };
  const bodyHeight = Math.max(3, view.height - 2);
  let body: string[];
  if (state.help) body = HELP.map((line) => style(line, "dim"));
  else if (state.screen === "board") body = renderBoard(state, inner, bodyHeight);
  else if (state.screen === "review") body = renderReview(state, inner, bodyHeight);
  else if (state.screen === "dispatch") body = renderDispatch(state, inner, bodyHeight);
  else if (state.screen === "ask") body = renderAsk(state, inner, bodyHeight);
  else body = renderMemory(state, inner, bodyHeight);

  const lines = [header(state, inner)];
  for (let index = 0; index < bodyHeight; index += 1) {
    const line = body[index] ?? "";
    lines.push(visibleWidth(line) > width ? truncate(line, width) : line);
  }
  lines.push(footer(state, inner));
  return lines;
}

export function render(state: UiState, view: Viewport): string {
  return renderLines(state, view).join("\n");
}
