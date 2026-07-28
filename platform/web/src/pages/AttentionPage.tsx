// The landing page (orchestrator design §8/§10): only decisions a human must make,
// severity-sorted, each row one decision with its actions named. Empty is the goal state
// — an empty queue renders as success, never as a blank error.
//
// Actions are offered ONLY where a single click is genuinely the whole decision. Reverify is:
// it re-anchors a claim against the code as it stands now, and the kernel refuses to
// rubber-stamp one whose cited code is gone. Supersede needs a replacement packet chosen, and
// retire has no operation behind it at all — so those are named as next steps rather than
// dressed up as buttons that would fail on click.

import React, { useState } from "react";
import type { AttentionItemDto, AttentionActionResultDto } from "../api/types";

const KIND_LABEL: Record<AttentionItemDto["kind"], string> = {
  unclaimed_building: "unclaimed work",
  overlap_warning: "overlap",
  parked: "parked",
  contradiction: "contradiction",
  stale_critical: "stale",
};

// A refusal is as important to show as a success: reverify declines when the cited code is
// gone, and the operator needs the reason, not a silent no-op.
function outcomeText(result: AttentionActionResultDto): string {
  if (!result.ok) return result.error ?? "Reverify was refused.";
  const detail = result.result;
  if (!detail) return "Reverified.";
  const parts: string[] = [`re-anchored ${detail.refreshed_paths.length} path(s)`];
  if (detail.changed_paths.length) parts.push(`${detail.changed_paths.length} had changed`);
  if (detail.missing_paths.length) parts.push(`${detail.missing_paths.length} still missing`);
  return `Reverified — ${parts.join(", ")}.`;
}

export function AttentionPage({
  items,
  onReverify,
}: {
  items: AttentionItemDto[];
  /** Absent in read-only contexts; the row then names its actions without offering them. */
  onReverify?: (ref: string) => Promise<AttentionActionResultDto>;
}): React.ReactElement {
  const [pending, setPending] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});

  const runReverify = (ref: string): void => {
    if (!onReverify) return;
    setPending(ref);
    onReverify(ref)
      .then((result) => setOutcomes((prev) => ({ ...prev, [ref]: outcomeText(result) })))
      .catch((error: unknown) =>
        setOutcomes((prev) => ({ ...prev, [ref]: error instanceof Error ? error.message : String(error) })),
      )
      .finally(() => setPending(null));
  };

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
              <div className="entity-card-header">
                {item.kind === "stale_critical" && onReverify ? (
                  <button type="button" disabled={pending === item.ref} onClick={() => runReverify(item.ref)}>
                    {pending === item.ref ? "Reverifying…" : "Reverify"}
                  </button>
                ) : null}
                <span className="muted">
                  {item.kind === "stale_critical"
                    ? "or: supersede (needs a replacement packet) · retire"
                    : `next: ${item.actions.join(" · ")}`}
                </span>
              </div>
              {outcomes[item.ref] ? <p className="muted">{outcomes[item.ref]}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
