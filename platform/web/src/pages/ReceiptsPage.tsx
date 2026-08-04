// Receipts — the honesty surface. Every figure on this page is a counted event, or it is not here.
//
// The product this replaced died by estimation: a 447.7M "tokens saved" headline against an 8.1M
// honest replay. So the rule here is structural rather than stylistic — a number may appear only
// if some line in the receipts ledger was counted to produce it (see mcp/vnext/librarian/receipts.ts).
//
// The corollary is the part that is easy to get wrong, and the reason this file exists at all.
// `receiptCounts` builds its map by counting the events it actually saw, so an event type with no
// occurrences is ABSENT from the map — and absent means "we never observed one", not "we observed
// none". Rendering that as 0 would invent a measurement and invite a decision on it. Missing
// therefore renders as a dash plus the action that would produce the first event; a key that IS
// present with the value 0 is a real reading and renders as 0. The two look different on purpose.
//
// Tokens and cost follow the same rule one step further. They are summed only from receipts that
// actually reported usage, and when none did the page says "not measured". It never estimates, and
// it never calls a partial sum a total.

import type { ReactElement } from "react";
import { PageHeader } from "../components/PageHeader";

/** One line of the ledger, shaped for display. */
export interface ReceiptsEventView {
  /**
   * The ledger's own event type, e.g. `recall_served`. Deliberately a plain string, not the
   * ReceiptEvent union: a type this page has no phrase for is still a counted event and must
   * still render, rather than vanish because the display vocabulary lagged the ledger.
   */
  type: string;
  at: string;
  cardId?: string;
  detail?: string;
  /** Present only when the runner reported usage. Absent is unmeasured, never zero. */
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

export interface ReceiptsView {
  /** Counted events by type. A MISSING key is unmeasured; a present 0 is a real reading. */
  counts: Partial<Record<string, number>>;
  /** The ledger tail, newest first. Not the whole ledger — nothing here may be called a total. */
  recent: ReceiptsEventView[];
  /**
   * The team scoreboard: cards authored in one person's session, delivered into another's agent.
   * Absent (undefined or null) for a solo store with no remote — and absent renders as NOTHING,
   * because a team number of 0 on a one-person store is a claim about a team that does not exist.
   */
  crossPollination?: { total: number; byAuthor: Array<{ author: string; delivered: number }> } | null;
}

/**
 * The ledger's vocabulary, in the human's voice. An unknown type falls through to its raw name:
 * an event we cannot phrase is still an event we counted, and hiding it would make the page lie
 * by omission.
 */
const EVENT_LABEL: Record<string, string> = {
  card_proposed: "card proposed",
  card_approved: "card approved",
  card_rejected: "card rejected",
  card_superseded: "card superseded",
  recall_served: "recall served",
  stale_withheld: "stale claim withheld",
  card_misleading: "card marked misleading",
  librarian_run: "librarian run",
  mining_run: "mining run",
};

/**
 * The lead figure is `recall_served` alone: it is the only event that answers "did this help".
 * The other three are the ledger's supporting counts and sit a rung down — the design allows
 * exactly one display-size number per screen, and a wall of four hero figures would say that
 * everything is the headline, which is the same as saying nothing is.
 */
const LEAD_UNLOCK = "Run an agent through `kage up` — every injection writes a receipt.";

const SUPPORTING_FIGURES: ReadonlyArray<{ type: string; label: string; unlock: string }> = [
  {
    type: "card_proposed",
    label: "Cards proposed",
    unlock: "Run `kage cards mine` — the Librarian proposes from git history.",
  },
  {
    type: "card_approved",
    label: "Cards approved",
    unlock: "Approve a proposal in the Inbox. Approval is the act that writes the event.",
  },
  {
    type: "stale_withheld",
    label: "Stale claims withheld",
    unlock: "Counted the first time a stale card is kept out of a recall.",
  },
];

/**
 * Relative time, clamped at the present. A receipt written by a machine with a skewed clock must
 * never render as "in 3h" — the event demonstrably already happened, so the future reads as now.
 * A timestamp we cannot parse is shown verbatim rather than guessed at.
 */
function relativeTime(at: string, now: number): string {
  const then = Date.parse(at);
  if (Number.isNaN(then)) return at;
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Sub-cent spend is real spend. Rounding it to "$0.00" would print a zero nobody measured. */
function formatCost(total: number): string {
  if (total === 0) return "$0.00";
  return total < 0.01 ? "<$0.01" : `$${total.toFixed(2)}`;
}

interface Usage {
  input: number | null;
  output: number | null;
  cost: number | null;
  /** How many receipts contributed — the denominator that keeps a partial sum from reading as a total. */
  reporting: number;
}

/**
 * Sum only the fields that are present. A receipt carrying no `inputTokens` is not a zero-token
 * receipt; it is a receipt whose usage nobody recorded, and adding 0 for it would quietly convert
 * "unknown" into "cheap".
 */
function usageOf(recent: ReceiptsEventView[]): Usage {
  const usage: Usage = { input: null, output: null, cost: null, reporting: 0 };
  for (const event of recent) {
    let reported = false;
    if (typeof event.inputTokens === "number") {
      usage.input = (usage.input ?? 0) + event.inputTokens;
      reported = true;
    }
    if (typeof event.outputTokens === "number") {
      usage.output = (usage.output ?? 0) + event.outputTokens;
      reported = true;
    }
    if (typeof event.costUsd === "number") {
      usage.cost = (usage.cost ?? 0) + event.costUsd;
      reported = true;
    }
    if (reported) usage.reporting += 1;
  }
  return usage;
}

/**
 * One supporting figure. `measured` lights the number; unmeasured shows a dash AND the action that
 * would produce the first event — a dash on its own tells the reader they have nothing without
 * telling them what to do about it, which is how honest empty states become dead ends.
 */
function Figure({
  label,
  count,
  unlock,
}: {
  label: string;
  /** undefined = the type was never observed. 0 = observed, and none happened. */
  count: number | undefined;
  unlock: string;
}): ReactElement {
  const measured = typeof count === "number";
  return (
    <li className="receipts-figure" data-confidence={measured ? "measured" : "unknown"}>
      <span className="receipts-figure-value" data-confidence={measured ? "measured" : "unknown"}>
        {measured ? count.toLocaleString() : "—"}
      </span>
      <span className="receipts-figure-label">{label}</span>
      {/* The unlock exists ONLY on the unmeasured side. Printing it under a real count would be
          telling someone how to start something they have already done. */}
      {!measured && <span className="fact receipts-figure-unlock">{unlock}</span>}
    </li>
  );
}

/** A measured-or-absent line for the usage figures, which are sums rather than event counts. */
function UsageRow({ label, value, note }: { label: string; value: string | null; note: string }): ReactElement {
  return (
    <li className="receipts-row" data-confidence={value === null ? "unknown" : "measured"}>
      <span className="receipts-row-label">{label}</span>
      <span className="fact receipts-row-value" data-confidence={value === null ? "unknown" : "measured"}>
        {value ?? "not measured"}
      </span>
      <span className="fact receipts-row-note">{note}</span>
    </li>
  );
}

export function ReceiptsPage({ view, loading }: { view: ReceiptsView | null; loading: boolean }): ReactElement {
  // Loading is a THIRD state, distinct from both "measured" and "nothing counted yet". Collapsing
  // it into the empty state tells the reader the ledger is empty before anyone has read it —
  // exactly the false claim the rest of this page is built to avoid.
  if (loading) {
    return (
      <section aria-label="Receipts">
        <PageHeader title="Receipts" />
        <p role="status" aria-live="polite" className="activity-empty">
          Reading the receipts ledger…
        </p>
      </section>
    );
  }

  if (view === null) {
    return (
      <section aria-label="Receipts">
        <PageHeader title="Receipts" />
        <p className="activity-empty">
          No receipts ledger yet. It is written the first time the Librarian runs — mine history
          with `kage cards mine`, or start an agent through `kage up` and let a session end.
        </p>
      </section>
    );
  }

  const now = Date.now();
  const recalls = view.counts.recall_served;
  const usage = usageOf(view.recent);
  // All three absent is the common case (no runner reported usage at all), and three rows each
  // saying "not measured" is the same sentence three times. One line says it once.
  const noUsage = usage.input === null && usage.output === null && usage.cost === null;
  const usageNote = `from ${usage.reporting} of ${view.recent.length} receipts shown`;

  return (
    <section aria-label="Receipts">
      <PageHeader
        title="Receipts"
        lede="Every figure here is a counted event. Nothing is estimated, and nothing unmeasured is shown as zero."
      />

      {typeof recalls === "number" ? (
        <>
          <div className="receipts-lead">
            <span className="receipts-lead-figure" data-confidence="measured">
              {recalls.toLocaleString()}
            </span>
            <p className="receipts-lead-caption">
              times an agent was handed something
              <br />
              the team already knew
            </p>
          </div>
          <p className="fact receipts-lead-note">counted recall_served receipts in the shadow store's ledger</p>
        </>
      ) : (
        // The one figure that answers "did this help" has no reading yet. A dashed rail and the
        // action that produces the first receipt — never a 0, which would read as "it did not help".
        <p className="receipts-unlock-band" data-confidence="unknown">
          <span className="receipts-unlock-band-label">No recall counted yet.</span>
          <span className="fact">{LEAD_UNLOCK}</span>
        </p>
      )}

      <ul className="receipts-figures">
        {SUPPORTING_FIGURES.map((figure) => (
          <Figure
            key={figure.type}
            label={figure.label}
            count={view.counts[figure.type]}
            unlock={figure.unlock}
          />
        ))}
      </ul>

      <p className="activity-band">
        Tokens and cost
        <span className="activity-band-sub">
          summed from the receipts below, not an all-time total
        </span>
      </p>
      {noUsage ? (
        <p className="activity-empty">
          Token usage and cost: not measured. The Librarian rides your own subscription, and usage
          appears here only when the runner reports it — an estimate would be a different kind of
          number wearing this one's clothes.
        </p>
      ) : (
        <ul className="receipts-rows">
          <UsageRow
            label="Input tokens"
            value={usage.input === null ? null : usage.input.toLocaleString()}
            note={usageNote}
          />
          <UsageRow
            label="Output tokens"
            value={usage.output === null ? null : usage.output.toLocaleString()}
            note={usageNote}
          />
          <UsageRow label="Cost" value={usage.cost === null ? null : formatCost(usage.cost)} note={usageNote} />
        </ul>
      )}

      {/* Absent renders as nothing at all — see the ReceiptsView comment. A solo store has no team
          to have a team number about, and 0 would be an answer to a question nobody asked. */}
      {view.crossPollination && (
        <>
          <p className="activity-band">Cross-pollination</p>
          <div className="receipts-xp">
            <span className="receipts-xp-figure" data-confidence="measured">
              {view.crossPollination.total.toLocaleString()}
            </span>
            <p className="receipts-xp-note">
              cards authored in one person's session and delivered into another person's agent. It
              is the honest team number because every one of them is a receipt — unlike "repeat
              failures prevented", which needs a counterfactual nobody can run.
            </p>
          </div>
          <ul className="receipts-rows">
            {view.crossPollination.byAuthor.map((entry) => (
              <li key={entry.author} className="receipts-row" data-confidence="measured">
                <span className="receipts-row-label">{entry.author}</span>
                <span className="fact receipts-row-value" data-confidence="measured">
                  {entry.delivered.toLocaleString()}
                </span>
                <span className="fact receipts-row-note">deliveries into other people's agents</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="activity-band">Recent receipts</p>
      {view.recent.length === 0 ? (
        <p className="activity-empty">
          No event counted yet. The first one arrives when the Librarian proposes a card, when you
          approve one in the Inbox, or when an agent is handed memory during a run.
        </p>
      ) : (
        <ul className="receipts-events">
          {view.recent.map((event, index) => (
            // The ledger is append-only and two events can share a timestamp, so position is part
            // of identity. Nothing here reorders, so the index is stable for the life of the view.
            <li key={`${event.type}-${event.at}-${index}`} className="receipts-event">
              <span className="fact receipts-event-type">{EVENT_LABEL[event.type] ?? event.type}</span>
              <span className="receipts-event-detail">{event.detail ?? event.cardId ?? ""}</span>
              {/* Each half is printed only if it was reported. Defaulting the missing side to 0 —
                  the obvious shortcut — would print an unmeasured number on the honesty page. */}
              {(typeof event.inputTokens === "number" || typeof event.outputTokens === "number") && (
                <span className="fact receipts-event-usage">
                  {[
                    typeof event.inputTokens === "number" ? `${event.inputTokens.toLocaleString()} in` : null,
                    typeof event.outputTokens === "number" ? `${event.outputTokens.toLocaleString()} out` : null,
                  ]
                    .filter((part): part is string => part !== null)
                    .join(" / ")}
                </span>
              )}
              <span className="fact receipts-event-at">{relativeTime(event.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
