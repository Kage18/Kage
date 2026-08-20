// The imperative shell: raw-mode terminal in, kernel effects out. Everything
// interesting (what a keystroke means, what a frame looks like) lives in the pure
// modules; this file only paints and performs.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadApprovedPackets } from "../../kernel.js";
import { packetProvenance } from "../provenance.js";
import { adapterByName, detectAgent } from "../adapters/index.js";
import { compileBrief, renderBrief } from "../brief.js";
import { diffBudget } from "../config.js";
import { CLAIM_PROTOCOL_VERSION, type ClaimRecord, type RunView, type TaskRecord, displayElapsedMs, listRuns, readClaim, readRun, runDir, runTranscriptPath } from "../contract.js";
import { dispatchDetached, dispatchRun, executeRun, INLINE_RUN_WARNING } from "../dispatch.js";
import { git } from "../git.js";
import { readJudgment, renderJudgment } from "../manager.js";
import { askManager } from "../manager-client.js";
import { formatElapsed, readActivity } from "../progress.js";
import { mergeRun, rejectRun } from "../ratify.js";
import { steerRun } from "../steer.js";
import { claimVerdict } from "../verify.js";
import { wrap } from "./ansi.js";
import { worktreePath } from "../worktree.js";
import {
  ALT_SCREEN_OFF,
  ALT_SCREEN_ON,
  CLEAR_ALL,
  CLEAR_BELOW,
  CLEAR_LINE_END,
  CURSOR_HIDE,
  CURSOR_HOME,
  CURSOR_SHOW,
  WRAP_OFF,
  WRAP_ON,
  decodeKey,
  setColorEnabled,
  splitKeys,
} from "./ansi.js";
import { renderLines } from "./render.js";
import { type Effect, type MemoryRow, type RunRow, type UiState, initialState, reduce, visibleRuns } from "./state.js";

function lastNote(task: TaskRecord): string {
  return [...task.state_history].reverse().find((change) => change.note)?.note ?? "";
}

export function loadRunRows(projectDir: string): RunRow[] {
  const now = Date.now();
  return listRuns(projectDir).map((task) => {
    // displayElapsedMs, not wall-clock since first "running" — a run stopped for an
    // hour must not read an hour more elapsed than it actually was (the same idle-time
    // bug recordSpend had, duplicated here on the read side; see contract.ts's
    // displayElapsedMs).
    const elapsedMs = displayElapsedMs(task, now);
    // One derivation for every surface — see contract.ts displayState.
    const stale = task.display_state === "dropped";
    let detail: string;
    let state: string = task.display_state;
    if (stale) {
      // The process is gone. Saying "running" here would be the sticky-state lie that
      // makes an orchestrator untrustworthy — report what is actually true.
      const activity = readActivity(runTranscriptPath(projectDir, task.id));
      detail = `agent process gone — last: ${activity.last_label} (kage tell to answer, or kage retry)`;
    } else if (task.state === "running") {
      const activity = readActivity(runTranscriptPath(projectDir, task.id));
      detail = `${activity.last_label}${activity.actions ? ` · ${activity.actions} actions` : ""}`;
    } else if (task.state === "blocked") {
      // The agent's actual question, not the word "blocked".
      detail = task.waiting_on?.needs || task.waiting_on?.detail || lastNote(task) || "needs a decision";
    } else if (task.state === "ready" || task.state === "failed") {
      const claim = readClaim(projectDir, task.id);
      detail = claim ? claimVerdict(claim).label.toLowerCase() : lastNote(task) || task.state;
    } else {
      detail = lastNote(task) || task.intent;
    }
    return {
      id: task.id,
      state,
      type: task.type,
      agent: task.agent,
      intent: task.intent,
      elapsed: Number.isFinite(elapsedMs) ? formatElapsed(elapsedMs) : "-",
      detail,
      needsYou: task.ownership === "needs_you",
    };
  });
}

export function loadMemoryRows(projectDir: string): MemoryRow[] {
  const { authorById } = packetProvenance(projectDir);
  return loadApprovedPackets(projectDir)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .map((packet) => ({
      id: packet.id,
      title: packet.title,
      type: packet.type,
      author: authorById.get(packet.id) ?? null,
      noted_at: (packet.created_at ?? "").slice(0, 10),
      paths: packet.paths ?? [],
      summary: packet.summary || packet.body.slice(0, 400),
    }));
}

function tailOf(path: string, lines: number): string[] {
  try {
    const content = readFileSync(path, "utf8").trimEnd().split("\n");
    return content.slice(-lines);
  } catch {
    return [];
  }
}

// The verbose receipt. A reviewer needs more than a verdict: what was claimed, what was
// actually executed, what the output said, what the agent was unsure about, and what it
// wants the repo to remember. Failing checks show more of their log than passing ones,
// because that is where the reader is going next.
function verboseReceipt(projectDir: string, task: TaskRecord, claim: ClaimRecord | null): string[] {
  const lines: string[] = [];
  const push = (text = ""): number => lines.push(text);

  push(`RUN        ${task.id}`);
  push(`STATE      ${task.state}   type ${task.type}   agent ${task.agent}`);
  push(`BRANCH     ${task.branch}`);
  const started = task.state_history.find((change) => change.state === "running")?.at;
  const finished = task.state_history.find((change) => change.state === "ready" || change.state === "failed")?.at;
  if (started && finished) push(`TOOK       ${formatElapsed(Date.parse(finished) - Date.parse(started))}`);
  push(`BUDGETS    ≤${task.budgets.diff_lines} diff lines · ≤${task.budgets.minutes} min · ≤$${task.budgets.usd}`);
  if (task.spend.usd_est > 0 || task.spend.minutes > 0) {
    push(`SPEND      $${task.spend.usd_est.toFixed(2)} · ${task.spend.minutes.toFixed(1)} min`);
    // usd is the only cap that stops a run, so it is the only one that gets an alarm
    // line here — minutes past its budget is informational (already shown above),
    // never a problem to flag, since it never halted anything.
    const overUsd = task.spend.usd_est > task.budgets.usd;
    if (overUsd) push(`           over budget — spent $${task.spend.usd_est.toFixed(2)} against a $${task.budgets.usd.toFixed(2)} cap`);
  }
  push(`BRIEF BY   ${task.curated_by === "manager" ? "manager (curated)" : "kernel defaults"}`);
  push();
  for (const line of renderJudgment(readJudgment(projectDir, task.id))) push(line);
  push();
  push("INTENT");
  for (const line of wrap(task.intent, 92)) push(`  ${line}`);
  push();

  if (!claim) {
    push("No claim yet — this run has not produced one.");
    const note = [...task.state_history].reverse().find((change) => change.note)?.note;
    if (note) {
      push();
      push("LAST NOTE");
      for (const line of wrap(note, 92)) push(`  ${line}`);
    }
    return lines;
  }

  const verdict = claimVerdict(claim);
  push(`VERDICT    ${verdict.label}`);
  push(`           ${verdict.executed ? "at least one check was executed by Kage" : "nothing was executed — this was inspected, not verified"}`);
  push();
  push("CLAIM (the agent's words — not evidence)");
  for (const line of wrap(claim.statement, 92)) push(`  ${line}`);
  if (!claim.protocol_ok) push(`  ! the agent skipped the ${CLAIM_PROTOCOL_VERSION} fence; this was derived from the diff`);
  push();

  push(`CHECKS (${claim.checks.length}) — re-run by Kage in the run's own worktree`);
  for (const check of claim.checks) {
    const mark = check.result === "pass" ? "✓" : check.result === "fail" ? "✗" : check.result === "unverified_no_env" ? "?" : "·";
    push(`  ${mark} ${check.id}  [${check.kind}]  → ${check.result}${typeof check.exit_code === "number" ? ` (exit ${check.exit_code})` : ""}`);
    if (check.cmd) push(`      command:  ${check.cmd}`);
    push(`      expected: ${check.expect}`);
    if (check.evidence) {
      push(`      evidence: ${check.evidence}`);
      const tail = tailOf(join(projectDir, check.evidence), check.result === "pass" ? 3 : 14);
      for (const line of tail) push(`      │ ${line}`);
    }
    if (check.result === "unverified_no_env") push("      NOTE: could not run here — this is NOT a pass.");
    push();
  }

  push(`DIFF       ${claim.diff.files} file(s), ${claim.diff.lines} changed line(s) (budget ${diffBudget(projectDir)})`);
  if (claim.diff.lines > diffBudget(projectDir)) push("           too large to review well — consider asking for it in smaller pieces");
  push();

  push(`UNSURE (${claim.unsure.length}) — what the agent flagged for a human`);
  if (!claim.unsure.length) push("  (the agent raised nothing)");
  for (const item of claim.unsure) {
    const wrapped = wrap(item, 88);
    push(`  ⚠ ${wrapped[0] ?? ""}`);
    for (const line of wrapped.slice(1)) push(`     ${line}`);
  }
  push();

  push(`LEARNINGS (${claim.learnings.length}) — ratified into team memory if you merge`);
  if (!claim.learnings.length) push("  (nothing proposed)");
  for (const item of claim.learnings) {
    const wrapped = wrap(item, 88);
    push(`  + ${wrapped[0] ?? ""}`);
    for (const line of wrapped.slice(1)) push(`     ${line}`);
  }
  push();

  const finalMessage = readFinalMessage(projectDir, task.id);
  if (finalMessage.length) {
    push("AGENT'S CLOSING REPORT");
    for (const line of finalMessage) push(`  ${line}`);
    push();
  }
  push("m merge · x reject · o worktree path · v next view (diff, brief)");
  return lines;
}

// The agent's own last words, straight from the transcript.
function readFinalMessage(projectDir: string, runId: string): string[] {
  const path = runTranscriptPath(projectDir, runId);
  if (!existsSync(path)) return [];
  try {
    let text = "";
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as { kind?: string; text?: string; label?: string; message?: string };
      if (event.kind === "say" && event.label) text = event.label;
      if (event.kind === "final" && event.message) text = event.message;
    }
    if (!text) return [];
    return text
      .split("\n")
      .filter((line) => !line.startsWith("```"))
      .flatMap((line) => wrap(line, 90))
      .slice(0, 12);
  } catch {
    return [];
  }
}

export function loadReview(projectDir: string, runId: string) {
  const task = readRun(projectDir, runId);
  const claim = readClaim(projectDir, runId);
  const workspace = worktreePath(projectDir, runId);
  const card = verboseReceipt(projectDir, task, claim);
  const brief = existsSync(join(runDir(projectDir, runId), "brief.md"))
    ? readFileSync(join(runDir(projectDir, runId), "brief.md"), "utf8").split("\n")
    : ["(no brief recorded)"];
  // Prefer the committed branch diff (it exists from claim time); fall back to staged
  // changes for runs made before that, or sandbox runs with no branch.
  // Show the work, not Kage's bookkeeping: derived stores are excluded even in older
  // repos whose .gitignore predates them. Packets stay visible — a learning riding the
  // branch is part of what you are reviewing.
  const exclude = [":(exclude).agent_memory/audit", ":(exclude).agent_memory/indexes", ":(exclude).agent_memory/reports", ":(exclude).agent_memory/structural", ":(exclude).agent_memory/graph", ":(exclude).agent_memory/code_graph"];
  let diff = existsSync(workspace) ? git(workspace, ["diff", "--cached", "--", ".", ...exclude]).stdout : "";
  if (!diff) diff = git(projectDir, ["diff", `HEAD...${task.branch}`, "--", ".", ...exclude]).stdout;
  return {
    runId,
    card,
    diff: diff ? diff.split("\n") : ["(no diff — the agent changed nothing, or the worktree is gone)"],
    brief,
    raw: readRawTranscript(projectDir, runId),
    intent: task.intent,
    state: task.state,
    workspace,
    ...(task.waiting_on ? { waiting: task.waiting_on } : {}),
  };
}

/**
 * The escape hatch: every transcript event, rendered readably but WITHOUT filtering.
 * The whole value of a raw view is that the reader can trust it is complete.
 */
export function readRawTranscript(projectDir: string, runId: string): string[] {
  const path = runTranscriptPath(projectDir, runId);
  if (!existsSync(path)) return ["(no transcript — this run never started an agent)"];
  const lines: string[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const at = String(event.at ?? "").slice(11, 19);
      const kind = String(event.kind ?? "event");
      const detail = String(event.label ?? event.text ?? event.message ?? event.detail ?? "");
      const rest = Object.entries(event)
        .filter(([key]) => !["at", "kind", "label", "text", "message", "detail"].includes(key))
        .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
        .join(" ");
      const head = `${at} ${kind.padEnd(8)} ${detail}`.trimEnd();
      lines.push(...wrap(rest ? `${head} ${rest}` : head, 110));
    } catch {
      lines.push(line);
    }
  }
  return lines.length ? lines : ["(transcript is empty)"];
}

export async function runTui(projectDir: string): Promise<number> {
  const out = process.stdout;
  if (!out.isTTY || !process.stdin.isTTY) {
    console.error("kage ui needs an interactive terminal. Use `kage status`, `kage runs`, or `kage review <id>` instead.");
    return 2;
  }
  setColorEnabled(true);

  // Memory is deliberately NOT loaded here — the console must open instantly, and the
  // notebook is one keypress away when it is wanted.
  let state: UiState = { ...initialState(), runs: loadRunRows(projectDir) };
  let dirty = true;

  let fullClear = true;
  const paint = (): void => {
    if (!dirty) return;
    dirty = false;
    const lines = renderLines(state, { width: out.columns || 80, height: out.rows || 24 });
    // \r\n and an erase-to-end-of-line per row: without the erase, a shorter line
    // leaves the previous frame's tail on screen (the classic "garbage everywhere"
    // artifact); without the \r, output that is not translating newlines staircases.
    const frame = lines.map((line) => `${line}${CLEAR_LINE_END}`).join("\r\n");
    out.write(`${fullClear ? CLEAR_ALL : ""}${CURSOR_HOME}${frame}${CLEAR_BELOW}`);
    fullClear = false;
  };
  const touch = (): void => {
    dirty = true;
  };

  const refreshRuns = (): void => {
    // Keep the cursor on the SAME run across refreshes: rows arrive sorted by
    // needs-you, so a run changing state would otherwise yank the selection to a
    // different row underneath the user's fingers.
    const before = visibleRuns(state)[state.boardIndex]?.id;
    const next = { ...state, runs: loadRunRows(projectDir) };
    const rows = visibleRuns(next);
    const moved = before ? rows.findIndex((run) => run.id === before) : -1;
    state = { ...next, boardIndex: moved >= 0 ? moved : Math.min(state.boardIndex, Math.max(0, rows.length - 1)) };
    touch();
  };

  const perform = async (effect: Effect): Promise<void> => {
    try {
      if (effect.kind === "openReview") {
        state = { ...state, screen: "review", review: loadReview(projectDir, effect.runId), reviewTab: "receipt", scroll: 0, message: null };
      } else if (effect.kind === "compileBrief") {
        const plan = compileBrief(projectDir, effect.intent, effect.type);
        const preview = renderBrief(
          { id: "(pending)", intent: effect.intent, type: effect.type } as unknown as TaskRecord,
          plan,
        ).split("\n");
        state = { ...state, dispatchBriefLines: preview, scroll: 0, message: null };
      } else if (effect.kind === "dispatch") {
        const agent = detectAgent() ?? "stub";
        state = { ...state, message: `dispatching to ${agent}…`, dispatchInput: "" };
        touch();
        // Fire and forget: the kernel writes state to disk, so the board reflects
        // progress on the next poll. Blocking here would freeze the UI for minutes.
        // Brief, then hand off to a detached supervisor — closing this TUI (or the
        // terminal it runs in) must not kill the agent mid-work, the same defect
        // dispatchDetached fixed for the CLI and the kage_dispatch MCP tool.
        void dispatchRun(projectDir, { intent: effect.intent, type: effect.type, briefOnly: true }, adapterByName(agent))
          .then((held) => {
            const spawned = dispatchDetached(projectDir, held.task);
            if (spawned.pid) {
              state = { ...state, message: `${held.task.id} → dispatched (pid ${spawned.pid})`, dispatchBusy: false };
              refreshRuns();
              return;
            }
            // Detaching failed outright — fall back to the old inline path (same as
            // the CLI) rather than silently drop a run that was already created.
            state = { ...state, message: `${held.task.id} → ${INLINE_RUN_WARNING}`, dispatchBusy: false };
            touch();
            void executeRun(projectDir, held.task.id, held.plan, adapterByName(agent))
              .then((result) => {
                state = { ...state, message: `${result.task.id} → ${result.task.state}`, dispatchBusy: false };
                refreshRuns();
              })
              .catch((error: unknown) => {
                state = { ...state, message: `dispatch failed: ${error instanceof Error ? error.message : String(error)}`, dispatchBusy: false };
                touch();
              });
          })
          .catch((error: unknown) => {
            state = { ...state, message: `dispatch failed: ${error instanceof Error ? error.message : String(error)}`, dispatchBusy: false };
            touch();
          });
      } else if (effect.kind === "merge") {
        const result = mergeRun(projectDir, effect.runId);
        state = { ...state, message: result.message, review: result.ok ? null : state.review, screen: result.ok ? "board" : state.screen };
        refreshRuns();
      } else if (effect.kind === "reject") {
        const result = rejectRun(projectDir, effect.runId, effect.reason);
        state = { ...state, message: result.message, review: null, screen: "board" };
        refreshRuns();
      } else if (effect.kind === "answer") {
        state = { ...state, message: `answering ${effect.runId}…` };
        touch();
        paint();
        const result = await steerRun(projectDir, effect.runId, effect.text, adapterByName);
        state = { ...state, message: result.message };
        refreshRuns();
      } else if (effect.kind === "reveal") {
        state = { ...state, message: state.review?.workspace ?? "" };
      } else if (effect.kind === "ask") {
        // The manager runs out-of-band: the console stays live, the board keeps
        // updating, and anything the manager does lands through the same kernel.
        const history = state.ask.history.slice(0, -1);
        void askManager({
          projectDir,
          question: effect.question,
          history,
          onEvent: (event) => {
            const line = event.kind === "tool" ? `· ${event.text}` : event.text;
            state = { ...state, ask: { ...state.ask, streaming: [...state.ask.streaming, line] } };
            touch();
          },
        })
          .then((reply) => {
            const used = reply.tools.length
              ? `\n   (used ${[...new Set(reply.tools.map((tool) => tool.replace("mcp__kage__", "")))].join(", ")})`
              : "";
            // Say so when the kernel edited the manager's prose: a silent correction
            // would be its own small dishonesty.
            const corrected = reply.corrections?.length
              ? `\n   (kernel checked ${reply.corrections.length} restated card number${reply.corrections.length === 1 ? "" : "s"}: ${reply.corrections.join(", ")} — read the card, not the summary)`
              : "";
            const suffix = `${used}${corrected}`;
            state = {
              ...state,
              ask: { ...state.ask, busy: false, streaming: [], history: [...state.ask.history, { role: "kage", text: `${reply.text}${suffix}` }] },
            };
            refreshRuns();
          })
          .catch((error: unknown) => {
            state = {
              ...state,
              ask: {
                ...state.ask,
                busy: false,
                streaming: [],
                history: [...state.ask.history, { role: "kage", text: `could not reach the manager: ${String(error)}` }],
              },
            };
            touch();
          });
      } else if (effect.kind === "loadMemory") {
        state = { ...state, message: "loading memory…" };
        touch();
        paint();
        state = { ...state, memory: loadMemoryRows(projectDir), memoryLoaded: true, message: null };
      } else if (effect.kind === "refresh") {
        state = {
          ...state,
          runs: loadRunRows(projectDir),
          memory: state.memoryLoaded ? loadMemoryRows(projectDir) : state.memory,
          message: null,
        };
      }
    } catch (error) {
      state = { ...state, message: `could not do that: ${error instanceof Error ? error.message : String(error)}` };
    }
    touch();
  };

  out.write(ALT_SCREEN_ON + CURSOR_HIDE + WRAP_OFF);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  const restore = (): void => {
    try {
      process.stdin.setRawMode(false);
    } catch {
      // Terminal already torn down.
    }
    out.write(WRAP_ON + CURSOR_SHOW + ALT_SCREEN_OFF);
  };
  // Leave the terminal usable even if something throws or the process is killed.
  process.on("exit", restore);

  const onResize = (): void => {
    // A resize invalidates every cell; repaint from a clean screen.
    fullClear = true;
    touch();
  };
  out.on("resize", onResize);
  // Live data: runs poll for state written by background dispatches and other shells.
  const poll = setInterval(() => {
    if (state.screen === "board" || state.runs.some((run) => run.state === "running")) refreshRuns();
    else touch();
  }, 1500);
  const painter = setInterval(paint, 80);

  await new Promise<void>((resolve) => {
    const onData = (chunk: string): void => {
      for (const raw of splitKeys(chunk)) {
        const { state: next, effect } = reduce(state, decodeKey(raw));
        state = next;
        if (effect.kind !== "none") void perform(effect);
      }
      touch();
      if (state.quit) {
        process.stdin.off("data", onData);
        resolve();
      }
    };
    process.stdin.on("data", onData);
  });

  clearInterval(poll);
  clearInterval(painter);
  out.off("resize", onResize);
  restore();
  return 0;
}
