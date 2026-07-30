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
import { PageHeader } from "../components/PageHeader";
import { runTimeline } from "../run-timeline";

/** A session this app started. Streaming state arrives over IPC; see the desktop SessionManager. */
export interface RunningSession {
  session_id: string;
  agent: string;
  work_title: string | null;
  /** When the session started, ISO-8601 — the origin of the run strip's time axis. */
  started_at: string;
  /** Seconds since the session started. */
  elapsed_s: number;
  /** The latest step the agent reported, already summarised. */
  step: string | null;
  /** Ticks: one per tool call, at the time the app observed it in the agent's own stream. */
  ticks: Array<{ at: string; weight: number }>;
  /**
   * How many times memory actually reached the agent, counted from the proxy's delivery records
   * for this session's task. Exact — the app chose the proxy's session id, so its receipts are
   * attributable by construction rather than by timing.
   */
  recalls?: number;
  /**
   * The `delivered_at` of each of those deliveries, so the strip can place them on its axis. The
   * count above stays authoritative: a mark that cannot be placed does not reduce it.
   */
  recall_at?: string[];
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
 * The run strip: a run plotted on TIME.
 *
 * Two measured series on one axis — the tool calls the app observed as the agent's stream arrived,
 * and the moments the proxy recorded that it attached memory to a request. Both are readings from the
 * same system clock, because the app spawns the proxy itself.
 *
 * A recall mark is full height with a cap; a tool tick is short and dim. State never rides on colour
 * alone, so the two are different SHAPES before they are different colours.
 *
 * Nothing here is smoothed, interpolated, or inferred. Spacing is real elapsed time, which is why a
 * run that stalled looks stalled — and why no correspondence is drawn between a mark and a tick.
 */
export function RunStrip({
  ticks,
  recallAt = [],
  startedAt,
  elapsedS,
  compact = false,
}: {
  ticks: RunningSession["ticks"];
  recallAt?: readonly string[];
  startedAt: string;
  /** Elapsed as main last reported it — the same reading the clock beside the strip shows. */
  elapsedS: number;
  compact?: boolean;
}): ReactElement {
  const height = compact ? 14 : 30;
  // The x axis is a fixed user-space width stretched to the container; strokes opt out of that
  // scaling so a tick stays crisp at any width.
  const AXIS = 1000;
  const line = runTimeline({
    startedAt,
    now: Date.parse(startedAt) + elapsedS * 1000,
    ticks,
    recallAt,
  });

  const label = [
    `${ticks.length} tool ${ticks.length === 1 ? "call" : "calls"}`,
    line.recalls.length > 0
      ? `${line.recalls.length} ${line.recalls.length === 1 ? "moment" : "moments"} memory reached the agent`
      : "no memory delivered yet",
    line.unplacedRecalls > 0 ? `${line.unplacedRecalls} could not be placed in time` : null,
    `over ${Math.round(line.spanS)}s`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <svg
      className="run-strip"
      viewBox={`0 0 ${AXIS} ${height}`}
      style={{ height }}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {/* The axis itself, so a strip with one event still reads as a span of time. */}
      <line className="run-axis" x1="0" y1={height - 0.5} x2={AXIS} y2={height - 0.5} vectorEffect="non-scaling-stroke" />
      {line.ticks.map((tick, index) => (
        <line
          key={`tick-${index}`}
          className="run-tick"
          x1={tick.x * AXIS}
          x2={tick.x * AXIS}
          y1={height}
          y2={height - Math.max(3, tick.weight * height * 0.55)}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {line.recalls.map((x, index) => (
        <g key={`recall-${index}`} className="run-recall">
          <line x1={x * AXIS} x2={x * AXIS} y1={height} y2="0" vectorEffect="non-scaling-stroke" />
          {/* The cap is what makes a recall legible with colour switched off. */}
          <line className="run-recall-cap" x1={x * AXIS} x2={x * AXIS} y1="0" y2="3" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </svg>
  );
}

function RunningBand({
  sessions,
  onStop,
}: {
  sessions: RunningSession[];
  onStop?: (id: string) => void;
}): ReactElement {
  if (sessions.length === 0) {
    return (
      <p className="activity-empty">
        No agent is running. Start one on a work item, or run one yourself with{" "}
        <code>kage run -- claude</code> and it will appear here.
      </p>
    );
  }
  return (
    <ul className="running-list sessions-grid">
      {sessions.map((session) => {
        // The count comes from the delivery rows and nowhere else. There is no fallback to infer one
        // from the strip: a tick is a tool call, and counting those would be counting the wrong thing.
        const recalls = session.recalls ?? 0;
        return (
          <li
            key={session.session_id}
            className="running-session"
            data-confidence={recalls > 0 ? "measured" : undefined}
          >
            <div className="running-head">
              <span className="fact">{session.agent}</span>
              <span className="running-title">{session.work_title ?? "free-form task"}</span>
              <span className="fact running-clock">{clock(session.elapsed_s)}</span>
            </div>
            <RunStrip
              ticks={session.ticks}
              recallAt={session.recall_at}
              startedAt={session.started_at}
              elapsedS={session.elapsed_s}
            />
            <div className="running-foot">
              <span className="fact running-step">{session.step ?? "starting…"}</span>
              {/* Zero is left as a dash until a delivery is actually recorded. Early in a run
                  nothing has been delivered yet, and "0 recalls" would read as a measurement that
                  memory did not help rather than one that has not happened yet. */}
              <span className="fact running-recalls" data-confidence={recalls > 0 ? "measured" : "unknown"}>
                {recalls > 0 ? `${recalls} ${recalls === 1 ? "recall" : "recalls"}` : "—"}
              </span>
              {onStop && (
                <button type="button" className="running-stop" onClick={() => onStop(session.session_id)}>
                  Stop
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AgentLine({ agent }: { agent: AgentDto }): ReactElement {
  const working = agent.status === "active";
  // The status already carries a text glyph AND a word below. A lucide icon here was a third encoding
  // of one fact, and the design has no icon set.
  return (
    <li className="list-row" data-confidence={working ? "measured" : agent.status === "silent" ? "critical" : undefined}>
      <span className="list-row-primary">{agent.agent}</span>
      <span className="observed-state" data-status={working ? "measured" : agent.status === "silent" ? "critical" : undefined}>
        <span className="status-glyph" aria-hidden="true">{working ? "●" : agent.status === "silent" ? "▲" : "○"}</span>
        {working ? "Active" : agent.status === "silent" ? "Never seen" : "Idle"}
      </span>
      <span className="list-row-meta observed-count" data-confidence={agent.durable_observations > 0 ? "measured" : "unknown"}>
        {agent.durable_observations > 0 ? `${agent.durable_observations.toLocaleString()} learned` : "—"}
      </span>
    </li>
  );
}

/**
 * The headline band: the loop's outcome, given the visual weight it deserves.
 *
 * The design's mockup puts a lit band at the top of this screen reading "2 repeat failures prevented
 * this week". That number does not exist: preventing a repeat failure needs a counterfactual nobody
 * measured, and Kage records no such figure. Shipping it would be precisely the lie the confidence
 * ladder exists to stop.
 *
 * So the band keeps its form and states the strongest thing that IS measured — how many times memory
 * actually reached a running agent, counted from the proxy's own delivery rows. When that has not
 * happened there is NO NUMBER at all, and the rail goes dashed: a zero here would read as "memory did
 * not help" rather than "nothing has landed yet".
 */
function OutcomeBand({ sessions }: { sessions: RunningSession[] }): ReactElement {
  const recalls = sessions.reduce((sum, session) => sum + (session.recalls ?? 0), 0);

  if (recalls > 0) {
    return (
      <p className="outcome-band" data-confidence="measured">
        <b className="outcome-count">{recalls}</b>
        <span>
          {recalls === 1 ? "time" : "times"} memory reached a running agent — each one is a mark on its
          run strip
        </span>
      </p>
    );
  }

  return (
    <p className="outcome-band" data-confidence="unknown">
      <span>No memory has reached these agents yet — each delivery appears here, and on the run strip, as it lands.</span>
    </p>
  );
}

export function ActivityPage({
  sessions = [],
  attention,
  tasks,
  agents,
  canStartAgents = false,
  onStartAgent,
  onStopSession,
}: {
  sessions?: RunningSession[];
  attention: AttentionItemDto[];
  tasks: TaskSummaryDto[];
  agents: AgentsReportDto | null;
  /** Only the desktop app can spawn a process, so the browser never offers the button. */
  canStartAgents?: boolean;
  onStartAgent?: () => void;
  onStopSession?: (id: string) => void;
}): ReactElement {
  // Only the most urgent decision appears here. The rest live on Needs you — the home screen
  // surfaces the blocker without becoming the queue.
  const blocking = [...attention].sort((a, b) => b.severity - a.severity)[0] ?? null;
  const finished = tasks.filter((task) => task.ended_at).slice(0, 6);
  const observed = agents?.agents ?? [];

  return (
    <section aria-label="Activity">
      <PageHeader
        title="Activity"
        lede="Every agent touching this repo, however it got here — and the memory steering it."
        action={
          canStartAgents && (
            <button type="button" className="activity-start" onClick={onStartAgent}>
              Start an agent
            </button>
          )
        }
      />

      {/* No session means no loop state to report. The empty state below already says what would
          start one, and two elements delivering one message is worse than one. */}
      {sessions.length > 0 && <OutcomeBand sessions={sessions} />}

      {sessions.length > 0 && (
        <p className="activity-band">
          Running now<span className="activity-band-sub">— started here</span>
        </p>
      )}
      <RunningBand sessions={sessions} onStop={onStopSession} />

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
          <p className="activity-band">
            Earlier<span className="activity-band-sub">— finished, with receipts</span>
          </p>
          <ul className="finished-list">
            {finished.map((task) => (
              <li key={task.task_id}>
                <a className="finished-title" href={withBase(`/tasks/${encodeURIComponent(task.task_id)}`)}>
                  {/* A finished run's mark is a checked glyph in type, not an icon. */}
                  <span className="finished-glyph" aria-hidden="true">✓</span>
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
          <p className="activity-band">
            Observed elsewhere<span className="activity-band-sub">— seen, not launched here</span>
          </p>
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
