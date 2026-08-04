// Inbox — the ambient approval console, and the design's heart.
//
// Everything awaiting a human judgment arrives here as one ranked stream. Today that is the
// Librarian's proposed cards; spec approvals join later. Deliberately boring, like code review:
// each proposal shows its claim, its citations, its trigger and where it came from, and takes
// exactly one of two verdicts. Nothing becomes team knowledge without passing through this room —
// that is the design's third gate, and the whole reason the Librarian can propose freely.
//
// The honesty rules of this screen:
//   A proposal renders its provenance, always — knowledge with no origin cannot be judged.
//   The mining CTA states the cost basis plainly: the Librarian runs on the user's own
//   subscription, and measured token usage is shown after, or "not measured", never a guess.

import { useCallback, useEffect, useState, type ReactElement } from "react";
import type { DesktopCard, MineOutcome } from "../desktop";
import { PageHeader } from "../components/PageHeader";

function citationLabel(citation: DesktopCard["citations"][number]): string {
  if (citation.path) return citation.symbol ? `${citation.path}#${citation.symbol}` : citation.path;
  return citation.ref ?? "";
}

function provenanceLine(card: DesktopCard): string {
  const source =
    card.provenance.source === "mining"
      ? "mined from history"
      : card.provenance.source === "session"
        ? `from session ${card.provenance.ref}`
        : `by ${card.provenance.ref}`;
  return `${source} · ${card.provenance.at.slice(0, 10)}`;
}

export function InboxPage({
  cards,
  busy,
  mining,
  lastMine,
  error,
  onApprove,
  onReject,
  onMine,
  canMutate,
}: {
  /** Null while loading — an empty inbox is a fact, not a fallback. */
  cards: DesktopCard[] | null;
  busy: string | null;
  mining: boolean;
  lastMine: MineOutcome | null;
  error: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onMine: () => void;
  /** Approval mutates the shadow store, so only the desktop app may offer the verdict buttons. */
  canMutate: boolean;
}): ReactElement {
  const pending = cards?.filter((card) => card.state === "proposed") ?? null;
  const [selected, setSelected] = useState(0);

  // Keyboard is the primary instrument here — clearing an inbox by mouse is a chore, and the
  // design says this room should feel like code review: j/k to move, a to approve, r to reject.
  const act = useCallback(
    (event: KeyboardEvent) => {
      if (!canMutate || !pending || pending.length === 0) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      if (event.key === "j") setSelected((index) => Math.min(index + 1, pending.length - 1));
      if (event.key === "k") setSelected((index) => Math.max(index - 1, 0));
      if (event.key === "a" && pending[selected]) onApprove(pending[selected].id);
      if (event.key === "r" && pending[selected]) onReject(pending[selected].id, "rejected in review");
    },
    [canMutate, pending, selected, onApprove, onReject],
  );

  useEffect(() => {
    window.addEventListener("keydown", act);
    return () => window.removeEventListener("keydown", act);
  }, [act]);

  useEffect(() => {
    // A verdict shrinks the list; the selection must never point past its end.
    if (pending && selected >= pending.length) setSelected(Math.max(0, pending.length - 1));
  }, [pending, selected]);

  return (
    <section aria-label="Inbox">
      <PageHeader
        title="Inbox"
        lede={
          pending === null
            ? "Loading proposals…"
            : pending.length === 0
              ? "Nothing awaits your judgment."
              : `${pending.length} ${pending.length === 1 ? "proposal" : "proposals"} · approve with a, reject with r, move with j/k`
        }
        action={
          canMutate && (
            <button type="button" className="activity-start" onClick={onMine} disabled={mining}>
              {mining ? "Mining history…" : "Mine history"}
            </button>
          )
        }
      />

      {error && <p className="sheet-error">{error}</p>}

      {lastMine && !mining && (
        <p className="inbox-mine-result" data-confidence={lastMine.ok ? "measured" : undefined}>
          {lastMine.ok
            ? `Mining proposed ${lastMine.proposed} ${lastMine.proposed === 1 ? "card" : "cards"}` +
              (lastMine.rejected > 0 ? `, gate refused ${lastMine.rejected}` : "") +
              (lastMine.deduped > 0 ? `, ${lastMine.deduped} already known` : "") +
              // The token line is measured or absent — never an estimate dressed as a reading.
              (lastMine.outputTokens !== null
                ? ` · ${(lastMine.inputTokens ?? 0).toLocaleString()} in / ${lastMine.outputTokens.toLocaleString()} out tokens on your subscription`
                : " · token usage not measured")
            : `Mining failed: ${lastMine.error ?? "unknown"}`}
        </p>
      )}

      {pending !== null && pending.length === 0 && (
        <p className="activity-empty">
          The Librarian proposes cards after agent sessions end, and from history when you mine.
          Everything it proposes waits here — nothing becomes team knowledge without your yes.
        </p>
      )}

      <ul className="inbox-list">
        {(pending ?? []).map((card, index) => (
          <li
            key={card.id}
            className="inbox-card"
            data-kind={card.kind}
            data-selected={canMutate && index === selected ? "true" : undefined}
          >
            <div className="inbox-card-head">
              <span className="fact inbox-kind">[{card.kind}]</span>
              <span className="inbox-title">{card.title}</span>
            </div>
            <p className="inbox-claim">{card.claim}</p>
            <p className="fact inbox-citations">
              {card.citations.map(citationLabel).filter(Boolean).join(" · ")}
            </p>
            <div className="inbox-card-foot">
              <span className="fact inbox-provenance">{provenanceLine(card)}</span>
              <span className="fact inbox-trigger">recalls when: {card.trigger}</span>
              {canMutate && (
                <span className="inbox-verdict">
                  <button
                    type="button"
                    className="inbox-approve"
                    disabled={busy === card.id}
                    onClick={() => onApprove(card.id)}
                  >
                    {busy === card.id ? "…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="inbox-reject"
                    disabled={busy === card.id}
                    onClick={() => onReject(card.id, "rejected in review")}
                  >
                    Reject
                  </button>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
