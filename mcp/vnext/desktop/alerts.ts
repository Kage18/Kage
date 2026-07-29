// What is worth interrupting a human for.
//
// This is the whole reason Kage wants to be a desktop app rather than a page you visit. The
// product's premise is that agents drive and humans approve gates — and a gate that is waiting
// on a human is, by definition, a thing the human does not know about yet. A browser tab cannot
// tell you. A menubar app can.
//
// So the rules here are about restraint, because an app that over-notifies gets muted once and
// is then worth nothing forever:
//
//   1. Only decisions ONLY a human can make. The attention queue already computes exactly that,
//      with a severity that is cost-of-delay. Below the threshold it goes on a page, not into
//      your afternoon.
//
//   2. Never twice for the same thing.
//
//   3. Nothing on first sight of a repository. Installing an app must not replay a month of
//      backlog at you — the single fastest way to teach someone to ignore an icon.
//
//   4. Many at once is ONE notification. Twelve items is a summary, not twelve banners.

export interface AlertCandidate {
  /** Stable identity of the underlying item. Dedup is by this, never by summary text. */
  ref: string;
  kind: string;
  severity: number;
  summary: string;
}

export interface Alert {
  title: string;
  body: string;
  /** The refs this alert covers, so a click can route to them. */
  refs: string[];
  /** Route the app should open when the notification is clicked. */
  route: string;
}

export interface AlertDecision {
  alert: Alert | null;
  /**
   * The refs to remember as already-alerted. Always the full current candidate set, never an
   * accumulation: an item that is RESOLVED leaves the set, so if it ever recurs it is genuinely
   * new and is allowed to speak again. This also keeps the set bounded by what is live rather
   * than growing forever.
   */
  seen: string[];
}

/**
 * Cost-of-delay at which something stops being a page and starts being an interruption.
 *
 * Calibrated against the attention engine's own base severities: `unclaimed_building` (80) and
 * `contradiction` (75) always clear it — an agent building something nobody owns, and memory
 * that disagrees with itself, are both actively costing the team while they sit. `overlap_warning`
 * (60) and `stale_critical` (55) clear it only once age or usage has pushed them up, which is
 * the correct behaviour: a stale claim nobody reads is untidy, not urgent. `parked` (40) never
 * interrupts anyone.
 */
export const INTERRUPT_AT = 70;

/** Above this many new items, send one summary instead of a banner per item. */
const SUMMARY_ABOVE = 3;

export interface DecideAlertsInput {
  repoName: string;
  candidates: AlertCandidate[];
  /** Refs already alerted on. */
  seen: readonly string[];
  /**
   * False until this repository has been observed at least once. On the first observation the
   * current state is the BACKLOG, not news, so it is recorded silently.
   */
  observedBefore: boolean;
}

export function decideAlerts(input: DecideAlertsInput): AlertDecision {
  const urgent = input.candidates.filter((c) => c.severity >= INTERRUPT_AT);
  // The seen-set tracks urgent items only. A non-urgent item was never alerted on, so recording
  // it would silence it later if age pushed it over the threshold — exactly when it matters.
  const seenNow = urgent.map((c) => c.ref);

  if (!input.observedBefore) {
    // Rule 3. Everything present at first sight is history.
    return { alert: null, seen: seenNow };
  }

  const already = new Set(input.seen);
  const fresh = urgent.filter((c) => !already.has(c.ref));
  if (fresh.length === 0) return { alert: null, seen: seenNow };

  // Most urgent first, so a summary names the one that matters most.
  fresh.sort((a, b) => b.severity - a.severity);

  if (fresh.length > SUMMARY_ABOVE) {
    return {
      alert: {
        title: `${input.repoName}: ${fresh.length} decisions need you`,
        body: `Most urgent: ${fresh[0].summary}`,
        refs: fresh.map((c) => c.ref),
        route: "/attention",
      },
      seen: seenNow,
    };
  }

  const lead = fresh[0];
  return {
    alert: {
      title: input.repoName,
      body: fresh.length === 1 ? lead.summary : `${lead.summary} (+${fresh.length - 1} more)`,
      refs: fresh.map((c) => c.ref),
      route: "/attention",
    },
    seen: seenNow,
  };
}
