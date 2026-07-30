// Proof — what Kage measurably did, and the ONLY page that claims value.
//
// It absorbed Overview, which showed the same measured ledger in a second visual language. Two
// pages making the same claim two ways is not a richer product, it is two things to keep in sync
// and one of them going stale.
//
// The rule the whole screen exists to honour: a dash is never a zero. An unmeasured metric renders
// as "—" on a dashed rule with the condition that would unlock it, because a dashboard showing 0
// for "we never looked" is worse than one showing nothing — it invites a decision on a fake
// number. Estimates are labelled estimates and never wear the measured colour.

import React from "react";
import type { ProofMetricDto, ProofReportDto, TeamReportDto } from "../api/types";
import { PageHeader } from "../components/PageHeader";

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
}

function formatValue(metric: ProofMetricDto): string {
  if (metric.value === null) return "—";
  switch (metric.unit) {
    case "days":
      return metric.value === 0 ? "<1d" : `${metric.value}d`;
    case "percent":
      return `${metric.value}%`;
    case "tokens":
      return compactNumber(metric.value);
    default:
      return String(metric.value);
  }
}

/**
 * One measured line. Rows, not cards: a column of figures is a table the eye can scan, and cards
 * would put a border around every single fact on a page made entirely of facts.
 */
function StatRow({
  label,
  value,
  note,
  confidence,
}: {
  label: string;
  value: string;
  note: string;
  /** `measured` lights the figure. `estimated` and `unknown` deliberately do not. */
  confidence: "measured" | "estimated" | "unknown";
}): React.ReactElement {
  return (
    <li className="proof-row" data-confidence={confidence}>
      <span className="proof-row-label">{label}</span>
      <span className="fact proof-row-value" data-confidence={confidence}>{value}</span>
      <span className="fact proof-row-note">{note}</span>
    </li>
  );
}

/** An estimate is a MODEL, not a count, and must never wear the measured colour. */
function isEstimate(metric: ProofMetricDto): boolean {
  return /estimat/i.test(metric.label) || /estimat/i.test(metric.formula);
}

export function ProofPage({
  report,
  ledger,
}: {
  report: ProofReportDto;
  /** The value ledger. Null when it could not be assembled — stated, never faked. */
  ledger?: TeamReportDto | null;
}): React.ReactElement {
  // The lead figure comes from the METRIC, not the ledger, even though both carry it. The metric
  // carries its formula, and a page whose headline number cannot say how it was computed is the
  // thing this page exists not to be.
  //
  // Absorbing Overview made this a real defect first: the ledger's rows and the proof metrics
  // overlap, so the page rendered "Stale claims withheld" twice — once as 13.0k and once as
  // 12975 — and did the same for recalls and tokens. One source, or the reader has to work out
  // which number to believe.
  const lead = report.metrics.find((metric) => metric.id === "recalls_served" && metric.value !== null) ?? null;
  const rest = report.metrics.filter((metric) => metric.id !== lead?.id);
  const measured = rest.filter((metric) => metric.value !== null);
  const unmeasured = rest.filter((metric) => metric.value === null);

  return (
    <section aria-label="Proof">
      <PageHeader title="Proof" />

      {lead ? (
        <>
          {/* The only thing on this page at display size: memory an agent reused instead of
              rediscovering. It is the one number that answers "did this help". */}
          <div className="proof-lead">
            <span className="proof-lead-figure" data-confidence="measured">
              {compactNumber(lead.value as number)}
            </span>
            <p className="proof-lead-caption">
              times an agent was handed something
              <br />
              already known
            </p>
          </div>
          <p className="fact proof-lead-note">
            {lead.formula}
            {ledger ? ` · from ${ledger.composition.total_packets.toLocaleString()} captured memories` : ""}
          </p>
        </>
      ) : (
        // No generic instruction here when the rows below carry their own unlocks: each metric
        // names the specific input IT needs, and repeating a blanket "run an agent" above them
        // says the same thing twice while being less useful than either.
        report.metrics.length === 0 && (
          <p className="activity-empty">
            Nothing measured yet. A zero here would be a claim nobody made, so the page waits.
          </p>
        )
      )}

      {measured.length > 0 && (
        <ul className="proof-rows">
          {measured.map((metric) => (
            <StatRow
              key={metric.id}
              label={metric.label}
              value={formatValue(metric)}
              note={metric.formula}
              confidence={isEstimate(metric) ? "estimated" : "measured"}
            />
          ))}
        </ul>
      )}

      {unmeasured.length > 0 && (
        <ul className="proof-rows proof-rows-unmeasured">
          {unmeasured.map((metric) => (
            <StatRow
              key={metric.id}
              label={metric.label}
              value="—"
              note={metric.unlock ?? "not measured yet"}
              confidence="unknown"
            />
          ))}
        </ul>
      )}

      <p className="proof-honesty">A dash is not a zero. Nothing here is estimated and shown as fact.</p>

      <p className="activity-band">Cycle time by item</p>
      {report.cycle_times.length === 0 ? (
        <p className="activity-empty">
          No item has both ends observed yet. Cycle time runs from the claim that started the work
          to the merge that shipped it, so it appears once a claimed item lands.
        </p>
      ) : (
        <ul className="proof-cycle">
          {report.cycle_times.map((entry) => (
            <li key={entry.work_id}>
              <span className="proof-cycle-title">{entry.title}</span>
              <span className="fact">{entry.days === 0 ? "<1d" : `${entry.days}d`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
