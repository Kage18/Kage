// The "while you were away" digest. One screen, outcome-first, observed numbers only.
// Research finding it encodes: agents generate far more notifiable events than any
// monitoring system, and every non-actionable ping is a withdrawal from trust. So this
// is the ONLY thing that reports — there are no other notifications.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type RunView, displayElapsedMs, listRuns, readClaim, runDir, runTranscriptPath } from "./contract.js";
import { formatElapsed, readActivity } from "./progress.js";
import { renderCurationLine, renderTrustLine } from "./trackrecord.js";
import { claimVerdict } from "./verify.js";

function markerPath(projectDir: string): string {
  return join(projectDir, ".agent_memory", "reports", "last-report-read");
}

export function markReportRead(projectDir: string): void {
  const path = markerPath(projectDir);
  mkdirSync(join(projectDir, ".agent_memory", "reports"), { recursive: true });
  writeFileSync(path, new Date().toISOString(), "utf8");
}

export function lastReportRead(projectDir: string): string | null {
  const path = markerPath(projectDir);
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8").trim() || null;
  } catch {
    return null;
  }
}

export interface ReportSection {
  heading: string;
  runs: RunView[];
}

export interface Report {
  since: string | null;
  ready: RunView[];
  blocked: RunView[];
  halted: RunView[];
  trust: string;
  quiet: boolean;
}

export function buildReport(projectDir: string, options: { all?: boolean } = {}): Report {
  const since = options.all ? null : lastReportRead(projectDir);
  const runs = listRuns(projectDir).filter((task) => (since ? task.updated_at > since : true));
  return {
    since,
    // display_state, never the raw record: a run whose process died must read the same
    // here as it does on the board and in the manager's view.
    ready: runs.filter((task) => task.display_state === "ready"),
    blocked: runs.filter((task) => task.display_state === "blocked"),
    halted: runs.filter((task) => ["stopped", "failed", "dropped"].includes(task.display_state)),
    trust: renderTrustLine(projectDir),
    quiet: runs.length === 0,
  };
}

function lastNote(task: RunView): string {
  return [...task.state_history].reverse().find((change) => change.note)?.note ?? "";
}

// Review-time estimate from observed diff size — a reviewer's actual question is "how
// long will this cost me", and a claim's size is the honest answer.
function reviewEstimate(projectDir: string, task: RunView): string {
  const claim = readClaim(projectDir, task.id);
  if (!claim) return "";
  const minutes = Math.max(1, Math.round(claim.diff.lines / 60));
  return ` (~${minutes} min review)`;
}

export function renderReport(projectDir: string, report: Report): string {
  const lines: string[] = [];
  lines.push(report.since ? `While you were away (since ${report.since.slice(0, 16).replace("T", " ")}):` : "All runs:");
  if (report.quiet) {
    lines.push("  Nothing to report — no runs changed state.");
    lines.push(`  ${report.trust}`);
    return lines.join("\n");
  }
  for (const task of report.ready) {
    const claim = readClaim(projectDir, task.id);
    const verdict = claim && claim.checks.length && claim.checks.every((check) => check.result === "pass")
      ? `verified ${claim.checks.length}/${claim.checks.length}`
      : "claim recorded";
    lines.push(`  ✓ ${task.id}  ${verdict} — ready${reviewEstimate(projectDir, task)}`);
  }
  for (const task of report.blocked) {
    lines.push(`  ⏸ ${task.id}  blocked: ${lastNote(task) || "needs a decision"}`);
  }
  for (const task of report.halted) {
    const why = task.display_state === "dropped" ? "agent process gone — answer it with kage tell, or kage retry" : lastNote(task);
    lines.push(`  ✗ ${task.id}  ${task.display_state}${why ? `: ${why}` : ""}`);
  }
  lines.push(`  ${report.trust}`);
  lines.push(`  ${renderCurationLine(projectDir)}`);
  return lines.join("\n");
}

// The live board: every run, what it is doing right now, how long it has been at it.
// This is the answer to "I am blind while it works" — one screen, refreshable, no log
// stream. Running runs show their current activity read from the transcript.
export function renderStatusBoard(projectDir: string): string {
  const runs = listRuns(projectDir).filter((task) => task.ownership !== "done");
  if (!runs.length) return 'No open runs. Dispatch one:  kage dispatch "<intent>"';
  const now = Date.now();
  const rows = runs.map((task) => {
    // displayElapsedMs, not wall-clock since first "running" — a run stopped for an
    // hour must not read an hour more elapsed than it actually was (REVERT CHECK: the
    // old `now - Date.parse(first "running" entry)` formula counted every minute a
    // stopped run sat idle, defeating `kage resume-run` for the exact runs it exists to
    // rescue — reproduced live: a run read 26.8m when the kernel stopped it, sat idle
    // with nothing running, and later read 128.0m with zero work done in between).
    const elapsedMs = displayElapsedMs(task, now);
    const elapsed = Number.isFinite(elapsedMs) ? formatElapsed(elapsedMs) : "-";
    const stale = task.display_state === "dropped";
    const badge = stale
      ? "!"
      : task.state === "running" ? "▶" : task.state === "ready" ? "✓" : task.state === "blocked" ? "⏸" : task.state === "failed" ? "✗" : "·";
    let detail: string;
    if (stale) {
      detail = "agent process gone — answer it with kage tell, or kage retry";
    } else if (task.state === "running") {
      const activity = readActivity(runTranscriptPath(projectDir, task.id));
      detail = `${activity.last_label}${activity.actions ? ` · ${activity.actions} actions` : ""}`;
    } else if (task.state === "ready") {
      const claim = readClaim(projectDir, task.id);
      detail = claim ? claimVerdict(claim).label.toLowerCase() : "awaiting review";
    } else if (task.state === "blocked") {
      detail = task.waiting_on?.needs || task.waiting_on?.detail || lastNote(task) || "needs a decision";
    } else {
      detail = lastNote(task) || task.state;
    }
    return { badge, id: task.id, state: task.display_state, elapsed, detail, agent: task.agent };
  });
  const idWidth = Math.min(46, Math.max(...rows.map((row) => row.id.length)));
  const lines = rows.map(
    (row) => `${row.badge} ${row.id.padEnd(idWidth)}  ${row.state.padEnd(8)} ${row.elapsed.padStart(7)}  ${row.detail}`,
  );
  return [`${runs.length} open run(s)  ·  ${new Date().toISOString().slice(11, 19)}`, ...lines].join("\n");
}

/** Compact machine view for the manager's clock-in. */
export function roomState(projectDir: string): Record<string, unknown> {
  const runs = listRuns(projectDir);
  return {
    runs: runs.slice(0, 20).map((task) => ({
      id: task.id,
      // The manager must never be told "running" about a process that is gone — it would
      // reassure the user on the strength of a fact the kernel already knows is false.
      state: task.display_state,
      ownership: task.ownership,
      type: task.type,
      intent: task.intent,
      agent: task.agent,
      note: task.display_state === "dropped" ? "agent process gone" : lastNote(task) || undefined,
      waiting_on: task.waiting_on ?? undefined,
      updated_at: task.updated_at,
      has_claim: existsSync(join(runDir(projectDir, task.id), "claim.json")),
    })),
    needs_you: runs
      .filter((task) => task.ownership === "needs_you")
      .map((task) => ({
        id: task.id,
        state: task.display_state,
        note: task.waiting_on?.needs || (task.display_state === "dropped" ? "agent process gone" : lastNote(task)) || undefined,
      })),
    trust: renderTrustLine(projectDir),
    curation: renderCurationLine(projectDir),
    last_report_read: lastReportRead(projectDir),
  };
}

const EVENT_PAGE = 100;

export interface EventPage {
  events: Array<Record<string, unknown>>;
  /** Pass this back next time. Sequence, not time — see appendRunLedger. */
  cursor: number;
  /** How many events were skipped because the page was full. Never hidden. */
  dropped: number;
}

/**
 * Events since a cursor — the manager pulls this at every turn boundary.
 *
 * Two bugs this replaces: the page limit was applied AFTER filtering, so asking for
 * "everything since T" silently returned a truncated answer; and the cursor was a string
 * comparison on an ISO timestamp, so two events written in the same millisecond lost the
 * second one permanently. Sequence numbers fix ordering; reporting `dropped` fixes the
 * silence.
 */
export function eventsSincePage(projectDir: string, sinceSeq = 0): EventPage {
  const path = join(projectDir, ".agent_memory", "reports", "runs-ledger.jsonl");
  if (!existsSync(path)) return { events: [], cursor: sinceSeq, dropped: 0 };
  const matched: Array<Record<string, unknown>> = [];
  let highest = sinceSeq;
  let lineNumber = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    lineNumber += 1;
    try {
      const event = JSON.parse(line) as Record<string, unknown> & { seq?: number };
      // Lines written before sequencing existed have no seq; their line number IS their
      // sequence. Without this the cursor never advances on an existing ledger and every
      // poll re-reads the whole history.
      const seq = Number.isFinite(Number(event.seq)) && Number(event.seq) > 0 ? Number(event.seq) : lineNumber;
      if (seq > highest) highest = seq;
      if (seq > sinceSeq) matched.push(event);
    } catch {
      // A torn ledger line is skipped, never fatal.
    }
  }
  const events = matched.slice(-EVENT_PAGE);
  return { events, cursor: highest, dropped: matched.length - events.length };
}

/** Back-compat shape for callers that only want the events. */
export function eventsSince(projectDir: string, sinceSeq = 0): Array<Record<string, unknown>> {
  return eventsSincePage(projectDir, sinceSeq).events;
}
