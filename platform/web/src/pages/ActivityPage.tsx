// Activity — the home screen, and the half of "orchestrator of memory and agents" that never had
// a surface.
//
// Agents reach a repository three different ways, and a page that shows only one of them lies:
//
//   Running now       sessions this app started and is streaming. Live.
//   Needs you         the single most urgent decision, inline — the home screen must never hide
//                     the thing that is blocking you behind another click.
//   Earlier           finished sessions with receipts.
//   Observed elsewhere agents seen through hooks or the proxy but not launched here. Someone
//                     running `claude` in a terminal still has to appear.
//
// The honesty rule that governs the whole screen: a band with nothing in it says what would put
// something there. It never renders a zero dressed up as a measurement.

import type { ReactElement } from "react";
import type { AgentDto, AgentsReportDto, AttentionItemDto, TaskSummaryDto } from "../api/types";
import { withBase } from "../router";

/** A session this app started. Streaming state arrives over IPC; see the desktop SessionManager. */
export interface RunningSession {
  agent: string;
  work_title: string;
  /** Seconds since the session started. */
  elapsed_s: number;
  /** The latest step the agent reported, already summarised. */
  step: string | null;
  /** Ticks: one per tool call. `recall` marks a moment Kage injected a memory mid-run. */
  ticks: Array<{ recall: boolean; weight: number }>;
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function duration(startedAt: string, endedAt: string | null): string | null {
  if (!endedAt) return null;
  const delta = (Date.parse(endedAt) - Date.parse(startedAt)) / 1000;
  return Number.isFinite(delta) && delta >= 0 ? clock(delta) : null;
}

/**
 * The run strip: one tick per tool call, height by duration, and a full-height accent tick at
 * every moment memory reached the agent.
 *
 * This is the product's thesis made watchable — and it is drawn only from recorded events, so it
 * can never show a tick that did not happen.
 */
export function RunStrip({ ticks, compact = false }: { ticks: RunningSession["ticks"]; compact?: boolean }): ReactElement {
  const height = compact ? 12 : 28;
  const step = compact ? 6 : 11;
  const width = Math.max(ticks.length * step, step);
  return (
    <svg
      className="run-strip"
      viewBox={`0 0 ${width} ${height}`}
      style={{ height, width: compact ? width : "100%" }}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${ticks.length} steps, ${ticks.filter((t) => t.recall).length} of them using memory`}
    >
      {ticks.map((tick, index) => {
        const h = tick.recall ? height : Math.max(3, Math.round(tick.weight * height * 0.7));
        return (
          <rect
            key={index}
            x={index * step}
            y={height - h}
            width="2"
            height={h}
            className={tick.recall ? "run-tick run-tick-recall" : "run-tick"}
          />
        );
      })}
    </svg>
  );
}

function RunningBand({ sessions }: { sessions: RunningSession[] }): ReactElement {
  if (sessions.length === 0) {
    return (
      <p className="activity-empty">
        No agent is running. Start one on a work item from the <a href={withBase("/work")}>board</a>,
        or run one yourself with <code>kage run -- claude</code> and it will appear here.
      </p>
    );
  }
  return (
    <ul className="running-list">
      {sessions.map((session) => (
        <li key={`${session.agent}:${session.work_title}`} className="running-session">
          <div className="running-head">
            <span className="fact">{session.agent}</span>
            <span className="running-title">{session.work_title}</span>
            <span className="fact running-clock">{clock(session.elapsed_s)}</span>
          </div>
          <RunStrip ticks={session.ticks} />
          <div className="running-foot">
            <span className="fact running-step">{session.step ?? "starting…"}</span>
            <span className="fact running-recalls" data-confidence="measured">
              {session.ticks.filter((tick) => tick.recall).length} recalls
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AgentLine({ agent }: { agent: AgentDto }): ReactElement {
  const working = agent.status === "active";
  return (
    <li className="observed-agent">
      <span className="fact">{agent.agent}</span>
      <span className="observed-state" data-status={working ? "measured" : agent.status === "silent" ? "critical" : undefined}>
        <span className="status-glyph" aria-hidden="true">{working ? "●" : agent.status === "silent" ? "▲" : "○"}</span>
        {working ? "Active" : agent.status === "silent" ? "Never seen" : "Idle"}
      </span>
      <span className="fact observed-count" data-confidence={agent.durable_observations > 0 ? "measured" : "unknown"}>
        {agent.durable_observations > 0 ? `${agent.durable_observations.toLocaleString()} learned` : "—"}
      </span>
    </li>
  );
}

export function ActivityPage({
  sessions = [],
  attention,
  tasks,
  agents,
}: {
  sessions?: RunningSession[];
  attention: AttentionItemDto[];
  tasks: TaskSummaryDto[];
  agents: AgentsReportDto | null;
}): ReactElement {
  // Only the most urgent decision appears here. The rest live on Needs you — the home screen
  // surfaces the blocker without becoming the queue.
  const blocking = [...attention].sort((a, b) => b.severity - a.severity)[0] ?? null;
  const finished = tasks.filter((task) => task.ended_at).slice(0, 6);
  const observed = agents?.agents ?? [];

  return (
    <section aria-label="Activity">
      <h1 className="visually-hidden">Activity</h1>

      <RunningBand sessions={sessions} />

      {blocking && (
        <div className="activity-blocking">
          <span className="fact activity-severity" data-status={blocking.severity >= 80 ? "critical" : "attention"}>
            {Math.round(blocking.severity)}
          </span>
          <div>
            <p className="activity-blocking-summary">{blocking.summary}</p>
            <a className="activity-blocking-link" href={withBase("/attention")}>
              {attention.length > 1 ? `and ${attention.length - 1} more decisions` : "Open it"}
            </a>
          </div>
        </div>
      )}

      {finished.length > 0 && (
        <>
          <p className="activity-band">Earlier</p>
          <ul className="finished-list">
            {finished.map((task) => (
              <li key={task.task_id}>
                <a className="finished-title" href={withBase(`/tasks/${encodeURIComponent(task.task_id)}`)}>
                  {task.outcome ?? task.task_id}
                </a>
                <span className="fact finished-meta">{duration(task.started_at, task.ended_at) ?? "—"}</span>
                <span className="fact finished-agent">{task.agent_surface}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {observed.length > 0 && (
        <>
          <p className="activity-band">Observed elsewhere</p>
          <ul className="observed-list">
            {observed.map((agent) => (
              <AgentLine key={agent.agent} agent={agent} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
