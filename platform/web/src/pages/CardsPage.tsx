// Knowledge — the cards the team believes, and the ones that quietly stopped being true.
//
// The Inbox is where knowledge is BORN (proposed → a human verdict). This is where it LIVES: the
// approved set, its trust reading, and the supersede chains that are the audit trail. The two are
// deliberately separate rooms — a proposal nobody approved is not knowledge, and listing it beside
// approved cards would claim the team believes something it never agreed to.
//
// The honesty rules of this screen, each earned:
//
//   The trust reading is a WORD before it is a colour. This product's success green and critical
//   red sit at ΔE 2.1 under deuteranopia (validate_palette.js), so a reader who cannot separate
//   them would otherwise be unable to tell a verified card from a withheld one. Every state
//   carries a label, a glyph with its own silhouette, and a rail with its own BORDER STYLE.
//
//   Stale cards are shown to humans PROMINENTLY, which is the opposite of what agents get. A stale
//   card is withheld from recall — that is exactly why a person has to see it, because a person is
//   the only one who can fix it. So they sort to the top, they say what withheld them, and they say
//   what would end it.
//
//   Counts are measured or absent. Zero stale is a real reading and shows as 0; a count nobody has
//   taken yet (the store has not answered) is a dash, never a zero.

import { useMemo, type ReactElement } from "react";
import type { DesktopCard } from "../desktop";
import { PageHeader } from "../components/PageHeader";

export type CardKindFilter = "all" | DesktopCard["kind"];
export type TrustFilter = "all" | DesktopCard["verify"];

/** Both axes at once, held by the caller so a route or a tray click can preselect either. */
export interface CardsFilter {
  kind: CardKindFilter;
  trust: TrustFilter;
}

/**
 * A card as this page reads it.
 *
 * The chain fields are optional because the IPC `DesktopCard` does not carry them yet while the
 * store's `Card` does (`supersedes` / `supersededBy`, librarian/types.ts). Reading them as optional
 * means this page renders the chain the moment the bridge widens, and shows no link until then —
 * a link to a card nobody named is worse than no link at all. `staleReason` is the auditor's own
 * words (verify.ts `CitationCheck.reason`) when they reach the surface; without them the page
 * states only what "stale" means by construction, never a guess about which citation broke.
 */
export interface KnowledgeCard extends DesktopCard {
  supersedes?: string;
  supersededBy?: string;
  staleReason?: string;
}

const KINDS: Array<{ kind: DesktopCard["kind"]; label: string }> = [
  { kind: "decision", label: "Decision" },
  { kind: "runbook", label: "Runbook" },
  { kind: "caution", label: "Caution" },
];

// Word first, glyph second, colour last. The glyphs differ in SILHOUETTE (check, ring, triangle) —
// the same three the knowledge rows and agent status use, so one vocabulary covers health
// everywhere — and each survives with the colour channel switched off entirely.
const TRUST: Record<DesktopCard["verify"], { word: string; glyph: string }> = {
  verified: { word: "Verified", glyph: "✓" },
  unverified: { word: "Unverified", glyph: "○" },
  stale: { word: "Stale", glyph: "▲" },
};

const TRUST_FILTERS: Array<[TrustFilter, string]> = [
  ["all", "All"],
  ["verified", "Verified"],
  ["unverified", "Unverified"],
  ["stale", "Stale"],
];

function citationLabel(citation: DesktopCard["citations"][number]): string {
  if (citation.path) return citation.symbol ? `${citation.path}#${citation.symbol}` : citation.path;
  return citation.ref ?? "";
}

// The same shape the Inbox prints, because a card's origin must read identically wherever it is
// judged — provenance that changes wording between screens invites the reader to think it changed.
function provenanceLine(card: DesktopCard): string {
  const source =
    card.provenance.source === "mining"
      ? "mined from history"
      : card.provenance.source === "session"
        ? `from session ${card.provenance.ref}`
        : `by ${card.provenance.ref}`;
  return `${source} · ${card.provenance.at.slice(0, 10)}`;
}

// Stale sinks nothing and buries nothing: still-believed cards come first (a superseded card is
// history, however broken its citations are), then the worst trust reading, then most recent.
const TRUST_RANK: Record<DesktopCard["verify"], number> = { stale: 0, unverified: 1, verified: 2 };

function order(a: KnowledgeCard, b: KnowledgeCard): number {
  const believed = Number(a.state !== "approved") - Number(b.state !== "approved");
  if (believed !== 0) return believed;
  const trust = TRUST_RANK[a.verify] - TRUST_RANK[b.verify];
  if (trust !== 0) return trust;
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function CardsPage({
  cards,
  filter,
  onFilter,
  onSupersede,
}: {
  /** Null while the store is being read — an empty shelf and an unanswered question differ. */
  cards: KnowledgeCard[] | null;
  filter: CardsFilter;
  onFilter: (next: CardsFilter) => void;
  /**
   * Supersede is the one mutation this room offers, and it writes to the shadow store — so it is
   * null in the browser portal, where the same list renders read-only. An action that cannot
   * execute must not be drawn.
   */
  onSupersede: ((id: string) => void) | null;
}): ReactElement {
  // A proposal is not knowledge. It waits in the Inbox; showing it here would double-count the
  // approval queue and imply the team believes something nobody said yes to.
  const pool = useMemo(
    () => (cards ?? []).filter((card) => card.state !== "proposed").slice().sort(order),
    [cards],
  );

  const visible = useMemo(
    () =>
      pool.filter(
        (card) =>
          (filter.kind === "all" || card.kind === filter.kind) &&
          (filter.trust === "all" || card.verify === filter.trust),
      ),
    [pool, filter],
  );

  // Every card is reachable by id, including ones the current filter hides — a chain must resolve
  // to a title, not to an opaque id, or "superseded" tells the reader nothing they can act on.
  const byId = useMemo(() => new Map(pool.map((card) => [card.id, card])), [pool]);

  const measured = cards !== null;
  const verified = pool.filter((card) => card.verify === "verified").length;
  const stale = pool.filter((card) => card.verify === "stale").length;
  // A dash is the mark for "nobody has taken this reading". Zero stale, once the store has
  // answered, is a real measurement and is allowed to be a zero.
  const count = (value: number): string => (measured ? value.toLocaleString() : "—");

  return (
    <section aria-label="Knowledge cards">
      <PageHeader
        title="Knowledge"
        lede={
          <>
            {`${count(pool.length)} ${pool.length === 1 && measured ? "card" : "cards"} · ${count(verified)} verified · ${count(stale)} stale`}
            {!measured && " · reading the shadow store…"}
          </>
        }
        action={
          // Prominence with a purpose: the number is measured, and pressing it goes straight to the
          // only cards a human can do something about. Absent when there are none — a "0 stale"
          // button is a control that does nothing.
          measured && stale > 0 ? (
            <button
              type="button"
              className="activity-start"
              onClick={() => onFilter({ ...filter, trust: "stale" })}
            >
              Show {stale} stale
            </button>
          ) : undefined
        }
      />

      <div className="knowledge-controls">
        <div className="kind-chips" role="group" aria-label="Filter by kind">
          <button
            type="button"
            className="kind-chip"
            aria-pressed={filter.kind === "all"}
            onClick={() => onFilter({ ...filter, kind: "all" })}
          >
            All <span className="kind-count">{count(pool.length)}</span>
          </button>
          {KINDS.map(({ kind, label }) => {
            const total = pool.filter((card) => card.kind === kind).length;
            return (
              <button
                key={kind}
                type="button"
                className="kind-chip"
                aria-pressed={filter.kind === kind}
                // Visible and disabled rather than hidden: "we have no runbooks" is information a
                // lead needs, and hiding the chip makes that absence invisible.
                disabled={measured && total === 0}
                onClick={() => onFilter({ ...filter, kind })}
              >
                {label} <span className="kind-count">{count(total)}</span>
              </button>
            );
          })}
        </div>

        <div className="list-filters" role="group" aria-label="Filter by trust">
          {TRUST_FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="list-filter"
              aria-pressed={filter.trust === value}
              onClick={() => onFilter({ ...filter, trust: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Never print a filtered count as if it were the total: a memory tool that appears to have
          lost knowledge is the worst thing this screen can imply. */}
      {measured && visible.length !== pool.length && (
        <p className="muted">
          {visible.length.toLocaleString()} of {pool.length.toLocaleString()} shown
        </p>
      )}

      {measured && visible.length === 0 && (
        <p className="empty-state">
          {pool.length === 0
            ? "Cards arrive from the Librarian: it proposes them when an agent session ends, and from your git history when you mine it. Every proposal waits in the Inbox until you approve it, and approved cards land here."
            : `Nothing matches that filter. ${pool.length.toLocaleString()} ${pool.length === 1 ? "card is" : "cards are"} here — switch back to All.`}
        </p>
      )}

      <ul className="inbox-list">
        {visible.map((card) => {
          const trust = TRUST[card.verify];
          const replacement = card.supersededBy ? byId.get(card.supersededBy) : undefined;
          return (
            <li key={card.id} id={card.id} className="card-row" data-kind={card.kind} data-verify={card.verify}>
              <div className="inbox-card-head">
                <span className="fact inbox-kind">[{card.kind}]</span>
                <span className="inbox-title">{card.title}</span>
                <span className="status card-trust" data-verify={card.verify}>
                  <span className="status-glyph" aria-hidden="true">
                    {trust.glyph}
                  </span>
                  {trust.word}
                </span>
                {card.state !== "approved" && <span className="fact card-state">{card.state}</span>}
              </div>

              <p className="inbox-claim">{card.claim}</p>
              <p className="fact inbox-citations">
                {card.citations.map(citationLabel).filter(Boolean).join(" · ")}
              </p>

              {card.verify === "stale" && (
                <p className="card-stale">
                  <strong>Withheld from agents.</strong>{" "}
                  {/* The reason is the auditor's when we have it, and otherwise the definition of
                      the state — never a guess about which citation broke. */}
                  {card.staleReason
                    ? card.staleReason
                    : "A cited file or symbol no longer resolves in this repository, so the claim cannot be re-checked against the tree."}{" "}
                  It comes back by restoring the citation and re-verifying, or by superseding this
                  card with one that cites what exists now.
                </p>
              )}

              {card.state === "superseded" && (
                <p className="card-chain">
                  {replacement ? (
                    <>
                      Replaced by{" "}
                      {/* An in-page anchor, and the filter is cleared on the way — the only thing
                          that could hide the target is the filter, and a link that scrolls to
                          nothing is a broken promise. */}
                      <a href={`#${replacement.id}`} onClick={() => onFilter({ kind: "all", trust: "all" })}>
                        {replacement.title}
                      </a>
                    </>
                  ) : (
                    // Honest about the gap rather than silent: the chain names a card this view
                    // does not hold, and saying so beats printing nothing.
                    <>Replaced by {card.supersededBy ?? "a card that is not recorded"} — not in this view.</>
                  )}
                </p>
              )}

              <div className="inbox-card-foot">
                <span className="fact inbox-provenance">{provenanceLine(card)}</span>
                <span className="fact inbox-trigger">recalls when: {card.trigger}</span>
                {/* Offered on cards the team still believes. A superseded or retired card has
                    already left the belief set, so there is nothing left to replace. */}
                {onSupersede && card.state === "approved" && (
                  <button type="button" className="card-supersede" onClick={() => onSupersede(card.id)}>
                    Supersede
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
