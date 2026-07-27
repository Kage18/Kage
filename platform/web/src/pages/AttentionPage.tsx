// The landing page (orchestrator design §8/§10): only decisions a human must make,
// severity-sorted, each row one decision with its actions named. Empty is the goal state
// — an empty queue renders as success, never as a blank error.

import React from "react";
import type { AttentionItemDto } from "../api/types";

const KIND_LABEL: Record<AttentionItemDto["kind"], string> = {
  unclaimed_building: "unclaimed work",
  overlap_warning: "overlap",
  parked: "parked",
  contradiction: "contradiction",
  stale_critical: "stale",
};

export function AttentionPage({ items }: { items: AttentionItemDto[] }): React.ReactElement {
  return (
    <section>
      <header className="page-header">
        <h1>Attention</h1>
        <p className="page-subtitle">
          Decisions only a human can make, ranked by cost of delay. Everything else runs
          without you — the goal state of this page is empty.
        </p>
      </header>
      {items.length === 0 ? (
        <p className="empty-state">
          Nothing needs you. Stages derive from evidence, memory is healthy, and no claimed
          work overlaps. Check <a href="/app/work">Work</a> for what is in flight.
        </p>
      ) : (
        <ul className="entity-list">
          {items.map((item) => (
            <li key={`${item.kind}:${item.ref}`} className="entity-card">
              <div className="entity-card-header">
                <span className="pill">{KIND_LABEL[item.kind] ?? item.kind}</span>
                <span className="muted">severity {item.severity}</span>
              </div>
              <p>{item.summary}</p>
              <p className="muted">actions: {item.actions.join(" · ")}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
