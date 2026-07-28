// Agents — the half of "orchestrator of memory and agents" that had no surface at all.
//
// The question is deliberately not "is a config file present". It is "is this agent working,
// and is anything it learned surviving as knowledge". Those are different facts, and a page
// that conflates them shows green checkmarks for a system nobody is using. So the states are
// active / idle / silent (wired but never observed) / unwired (observed but not captured here),
// and anything that needs a human says what to do about it.

import React from "react";
import type { AgentDto, AgentsReportDto } from "../api/types";

// Mapped onto the shared confidence ladder rather than a private palette, so an agent's
// health reads the same way as a metric's or a work item's.
const STATE_COPY: Record<AgentDto["status"], { label: string; tone: string; meaning: string }> = {
  active: { label: "Active", tone: "measured", meaning: "working, and Kage is capturing it" },
  idle: { label: "Idle", tone: "neutral", meaning: "wired and has worked before, nothing recent" },
  silent: { label: "Never seen", tone: "critical", meaning: "wired, but Kage has never observed it" },
};

function relative(iso: string | null): string {
  if (!iso) return "never";
  const delta = Date.now() - Date.parse(iso);
  if (!Number.isFinite(delta)) return "never";
  const days = Math.floor(delta / 86_400_000);
  if (days > 1) return `${days} days ago`;
  const hours = Math.floor(delta / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  const minutes = Math.max(1, Math.floor(delta / 60_000));
  return `${minutes}m ago`;
}

function AgentCard({ agent }: { agent: AgentDto }): React.ReactElement {
  const state = STATE_COPY[agent.status];
  return (
    <li className="entity-card agent-card" data-confidence={state.tone === "measured" ? "measured" : state.tone}>
      <div className="agent-card-head">
        {/* An agent name is an identifier the machine knows, not prose. */}
        <span className="evidence agent-name">{agent.agent}</span>
        <span className="pill" data-tone={state.tone === "neutral" ? undefined : state.tone}>
          {state.label}
        </span>
      </div>
      <p className="muted agent-meaning">{state.meaning}</p>

      <dl className="agent-stats">
        <div>
          <dt>Last seen</dt>
          <dd>{relative(agent.last_seen_at)}</dd>
        </div>
        <div>
          <dt>Sessions</dt>
          <dd>{agent.sessions.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Observations</dt>
          <dd>{agent.observations.toLocaleString()}</dd>
        </div>
        <div>
          {/* The only number that means memory actually grew. */}
          <dt>Became knowledge</dt>
          <dd
            className="agent-stat-strong"
            data-confidence={agent.durable_observations > 0 ? "measured" : "unknown"}
          >
            {agent.durable_observations.toLocaleString()}
          </dd>
        </div>
      </dl>

      {agent.next_step ? <p className="agent-next">{agent.next_step}</p> : null}
      {agent.config_path ? <p className="muted agent-config">{agent.config_path}</p> : null}
    </li>
  );
}

export function AgentsPage({ report }: { report: AgentsReportDto }): React.ReactElement {
  const working = report.agents.filter((agent) => agent.status === "active").length;
  const needsAttention = report.agents.filter((agent) => agent.status === "silent").length;

  return (
    <section>
      <header className="page-header">
        <h1>Agents</h1>
        <p className="page-subtitle">
          Which coding agents are wired to this repository, whether they are actually working,
          and how much of what they learned survived as knowledge. Being configured and being
          useful are different facts, so they are shown separately.
        </p>
      </header>

      {report.never_observed ? (
        <p className="empty-state">
          No agent has been observed on this repository yet. Wire one with{" "}
          <code>kage setup claude-code --project . --write</code>, or run any agent through{" "}
          <code>kage up</code> so its work is captured.
        </p>
      ) : (
        <>
          <div className="agent-summary">
            <span className="pill" data-tone="measured">{working} working</span>
            {needsAttention > 0 ? (
              <span className="pill" data-tone="critical">
                {needsAttention} need attention
              </span>
            ) : (
              <span className="muted">every wired agent is reporting in</span>
            )}
          </div>
          <ul className="agent-grid">
            {report.agents.map((agent) => (
              <AgentCard key={agent.agent} agent={agent} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
