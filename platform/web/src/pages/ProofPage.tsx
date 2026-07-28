// Proof (orchestrator design §8): the renewal page. Everything here is either measured from
// the same event log the board derives from, or it is explicitly not measured — and the second
// case renders as an unlock, never as a zero. A dashboard that shows 0 for "we never looked"
// is worse than one that shows nothing, because it invites a decision on a fake number.

import React from "react";
import type { ProofMetricDto, ProofReportDto } from "../api/types";

function formatValue(metric: ProofMetricDto): string {
  if (metric.value === null) return "Not measured";
  switch (metric.unit) {
    case "days":
      return metric.value === 0 ? "under a day" : `${metric.value} ${metric.value === 1 ? "day" : "days"}`;
    case "percent":
      return `${metric.value}%`;
    case "tokens":
      return metric.value.toLocaleString();
    default:
      return String(metric.value);
  }
}

function MetricCard({ metric }: { metric: ProofMetricDto }): React.ReactElement {
  const measured = metric.value !== null;
  return (
    <li className={`proof-card${measured ? "" : " proof-card-unmeasured"}`}>
      <div className="entity-card-header">
        <span className="pill">{metric.label}</span>
      </div>
      <p className={measured ? "proof-value" : "proof-value proof-value-absent"}>{formatValue(metric)}</p>
      <p className="muted">{metric.formula}</p>
      {metric.unlock ? <p className="metric-unlock">To measure this: {metric.unlock}</p> : null}
    </li>
  );
}

export function ProofPage({ report }: { report: ProofReportDto }): React.ReactElement {
  return (
    <section>
      <header className="page-header">
        <h1>Proof</h1>
        <p className="page-subtitle">
          What Kage measurably did, computed from the same events the board derives from. Every
          number states how it was calculated. Anything not measured says so, and says what
          would make it measurable — no metric here is estimated and presented as fact.
        </p>
      </header>

      <ul className="proof-grid">
        {report.metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </ul>

      <h2>Cycle time by item</h2>
      {report.cycle_times.length === 0 ? (
        <p className="empty-state">
          No item has both ends observed yet. Cycle time is measured from the claim that started
          the work to the merge that shipped it, so it appears once a claimed item lands.
        </p>
      ) : (
        <ul className="entity-list">
          {report.cycle_times.map((entry) => (
            <li key={entry.work_id} className="entity-card">
              <div className="entity-card-header">
                <span>{entry.title}</span>
                <span className="muted">{entry.days === 0 ? "under a day" : `${entry.days} days`}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
