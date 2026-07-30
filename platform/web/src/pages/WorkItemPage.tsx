// One work item in full. The board answers "what should I pick up"; this answers the question the
// board provokes — every card shows a stage nobody typed, so "why does it say that" has to be
// answerable transition by transition, in words, or derivation is just a nicer magic field.
//
// Laid out as bands separated by space rather than a stack of cards: this is one subject read top
// to bottom, not a list of peers, and a border around each section would say otherwise.

import React from "react";
import type { WorkDetailDto } from "../api/types";
import { withBase } from "../router";

function Band({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <>
      <p className="activity-band">{label}</p>
      {children}
    </>
  );
}

function Estimate({ detail }: { detail: WorkDetailDto }): React.ReactElement {
  const { estimate } = detail;
  if (estimate.confidence === "none") {
    // An estimate without a basis is invented, so the absence is stated instead.
    return (
      <p className="detail-prose">
        No estimate — sizing needs finished work with measured receipts to compare against, and
        none are linked yet.
      </p>
    );
  }
  return (
    <p className="detail-prose">
      <span className="fact" data-confidence="measured">
        ~{estimate.tokens_p50.toLocaleString()} tokens
      </span>{" "}
      <span className="fact">
        p90 {estimate.tokens_p90.toLocaleString()} · {estimate.radius_class} ·{" "}
        {estimate.confidence === "matched" ? "from similar finished work" : "cold start, scaled from all history"}
      </span>
    </p>
  );
}

export function WorkItemPage({ detail }: { detail: WorkDetailDto }): React.ReactElement {
  return (
    <section aria-label={detail.title}>
      <p className="detail-back">
        <a href={withBase("/work")}>← Board</a>
      </p>

      <h1 className="detail-title">{detail.title}</h1>
      <p className="fact detail-identity">
        {detail.stage}
        {detail.claimed_by ? ` · claimed by ${detail.claimed_by}` : ""}
        {/* Surfaced rather than hidden: the stored field is command-asserted and the derived stage
            layers observed evidence on top, so they legitimately differ mid-flight. */}
        {detail.stored_stage !== detail.stage ? ` · stored as ${detail.stored_stage}` : ""}
      </p>

      {detail.body ? <p className="detail-prose detail-body">{detail.body}</p> : null}

      <Band label="How this stage was derived">
        <ol className="derivation">
          {detail.stage_log.map((step) => (
            <li key={`${step.stage}:${step.at}`}>
              <span className="fact derivation-stage">{step.stage}</span>
              {/* What CAUSED the step is the answer this page exists to give. */}
              <span className="derivation-why">{step.evidence_label}</span>
              <span className="fact derivation-when">{new Date(step.at).toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </Band>

      <Band label="Estimate">
        <Estimate detail={detail} />
      </Band>

      <Band label="Blast radius">
        {detail.blast_paths.length === 0 ? (
          <p className="activity-empty">
            No files cited yet. Name the files this touches before claiming it — an item with no
            blast set cannot be correlated to commits or checked for overlap.
          </p>
        ) : (
          <>
            <p className="fact detail-paths">{detail.blast_paths.join(" · ")}</p>
            {detail.dependents.length ? (
              <p className="fact detail-dependents">
                depended on by {detail.dependents.slice(0, 12).join(" · ")}
              </p>
            ) : null}
          </>
        )}
      </Band>

      {detail.evidence.length ? (
        <Band label="Correlated commits">
          <ul className="commit-list">
            {detail.evidence.map((commit) => (
              <li key={commit.hash}>
                <span className="fact commit-hash">{commit.hash}</span>
                <span className="fact commit-branch">{commit.branch}</span>
                {/* The confidence rung IS the reason this commit counted. */}
                <span className="fact commit-confidence" data-confidence={commit.confidence === "explicit" ? "measured" : "derived"}>
                  {commit.confidence}
                </span>
              </li>
            ))}
          </ul>
          {detail.weak_evidence > 0 ? (
            <p className="fact detail-weak">
              {detail.weak_evidence} weakly correlated — recorded, never enough to move a stage on
              their own
            </p>
          ) : null}
        </Band>
      ) : null}

      {detail.knowledge.length ? (
        <Band label="What's already known">
          <ul className="board-card-knowledge detail-knowledge">
            {detail.knowledge.map((entry) => (
              <li key={entry.title}>{entry.title}</li>
            ))}
          </ul>
        </Band>
      ) : null}

      {detail.errors.length ? (
        <p className="fact detail-errors">Some detail was unavailable: {detail.errors.join("; ")}</p>
      ) : null}
    </section>
  );
}
