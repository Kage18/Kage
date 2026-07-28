// One work item in full. The board answers "what should I pick up"; this answers the question
// the board provokes — every card shows a stage nobody typed, so "why does it say that" has to
// be answerable transition by transition, in words, or derivation is just a nicer magic field.

import React from "react";
import type { WorkDetailDto } from "../api/types";

function Estimate({ detail }: { detail: WorkDetailDto }): React.ReactElement {
  const { estimate } = detail;
  if (estimate.confidence === "none") {
    return (
      <p className="muted">
        No estimate — sizing needs finished work with measured receipts to compare against, and
        none are linked yet. A number here without that basis would be invented.
      </p>
    );
  }
  return (
    <p>
      {estimate.radius_class} · ~{estimate.tokens_p50.toLocaleString()} tokens (p50),{" "}
      {estimate.tokens_p90.toLocaleString()} (p90){" "}
      <span className="muted">
        — {estimate.confidence === "matched" ? "from similar finished work" : "cold start, scaled from all history"}
      </span>
    </p>
  );
}

export function WorkItemPage({ detail }: { detail: WorkDetailDto }): React.ReactElement {
  return (
    <section>
      <header className="page-header">
        <p className="muted">
          <a href="/app/work">← Work</a>
        </p>
        <h1>{detail.title}</h1>
        <div className="entity-card-header">
          <span className="pill">{detail.stage}</span>
          {detail.claimed_by ? <span className="muted">claimed by {detail.claimed_by}</span> : null}
          {detail.stored_stage !== detail.stage ? (
            // Surfaced rather than hidden: the stored field is command-asserted and the derived
            // stage layers observed evidence on top, so they legitimately differ mid-flight.
            <span className="muted">stored as {detail.stored_stage}</span>
          ) : null}
        </div>
      </header>

      {detail.body ? <p>{detail.body}</p> : null}

      <h2>How this stage was derived</h2>
      <ul className="entity-list">
        {detail.stage_log.map((step) => (
          <li key={`${step.stage}:${step.at}`} className="entity-card">
            <div className="entity-card-header">
              <span className="pill">{step.stage}</span>
              <span className="muted">{new Date(step.at).toLocaleString()}</span>
            </div>
            <p className="muted">{step.evidence_label}</p>
          </li>
        ))}
      </ul>

      <h2>Estimate</h2>
      <Estimate detail={detail} />

      <h2>Blast radius</h2>
      {detail.blast_paths.length === 0 ? (
        <p className="empty-state">
          No files cited yet. Name the files this touches before claiming it — an item with no
          blast set cannot be correlated to commits or checked for overlap.
        </p>
      ) : (
        <>
          <p>Touches: {detail.blast_paths.join(", ")}</p>
          {detail.dependents.length ? (
            <p className="muted">Depends on it: {detail.dependents.slice(0, 12).join(", ")}</p>
          ) : null}
        </>
      )}

      {detail.evidence.length ? (
        <>
          <h2>Correlated commits</h2>
          <ul className="entity-list">
            {detail.evidence.map((commit) => (
              <li key={commit.hash} className="entity-card">
                <div className="entity-card-header">
                  <span className="pill">{commit.confidence}</span>
                  <code>{commit.hash}</code>
                  <span className="muted">{commit.branch}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {detail.weak_evidence > 0 ? (
        <p className="muted">
          {detail.weak_evidence} weakly-correlated commit(s) — recorded, but never enough to move
          a stage on their own.
        </p>
      ) : null}

      {detail.knowledge.length ? (
        <>
          <h2>What the team already knows</h2>
          <ul>
            {detail.knowledge.map((entry) => (
              <li key={entry.title}>{entry.title}</li>
            ))}
          </ul>
        </>
      ) : null}

      {detail.errors.length ? (
        <p className="muted">Some detail was unavailable: {detail.errors.join("; ")}</p>
      ) : null}
    </section>
  );
}
