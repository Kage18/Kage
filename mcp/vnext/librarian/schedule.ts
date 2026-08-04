// When the Librarian is allowed to wake — and when it must stop trying.
//
// `watcher.ts` knows which sessions have gone quiet. It does not know whether waking at all is a
// good idea right now, and that question cannot live where it naturally wants to: a `setInterval`
// in Electron's main process. Nothing in this repo can unit-test Electron, so a rule written
// there is a rule nobody can check — and this rule spends the user's money. The timer therefore
// stays dumb (read the clock, ask `shouldRunTick`, hand the outcome back to `recordTick`) and
// every decision with a cost attached lives here: pure, tested, and carrying a sentence it can
// say out loud to the person whose subscription is paying.
//
// Two costs shape all of it:
//
//   1. A run may spawn headless agents on the USER's own subscription — Kage pays for zero
//      inference, ever. The floor between runs is therefore a spending decision rather than a
//      throttling one, which is why it is measured in minutes and not in seconds.
//   2. A Librarian that fails almost never fails transiently. `claude` is not installed, a login
//      expired, a ToS prompt is blocking the runner, the transcript format drifted under an agent
//      upgrade. A timer retrying that every few minutes is an infinite bill that never produces a
//      card, so repeated failure LATCHES the loop off and hands the retry to the only party that
//      can fix the cause: the person looking at the app.
//
// Nothing here reads a clock or a filesystem. `nowMs` arrives from the caller, which is what lets
// a test own time and what keeps this policy honest about being arithmetic rather than behaviour.

export interface TickState {
  /** When the last run finished, ok or not. Null means nothing has ever run in this repository. */
  lastRunMs: number | null;
  /** Runs that failed since the last success. At the ceiling, the loop stops calling itself. */
  consecutiveFailures: number;
}

export function emptyTickState(): TickState {
  return { lastRunMs: null, consecutiveFailures: 0 };
}

/**
 * Five minutes between runs.
 *
 * Chosen against the watcher's ten-minute idle threshold, not against a load target: a session
 * that has just gone quiet waits at most five more minutes before anyone looks at it, which is
 * still "the card was waiting when I came back". Shorter buys nothing — the sessions are not
 * getting quieter — and every tick that finds nothing still costs a directory walk plus, on the
 * ticks that find something, real tokens.
 */
const DEFAULT_MIN_INTERVAL_MS = 5 * 60_000;

/**
 * Three failures in a row and the loop stops calling itself.
 *
 * Deliberately a latch rather than an exponential backoff. Exponential backoff assumes the cause
 * heals with time; these causes do not — a missing binary stays missing, an expired login stays
 * expired — so doubling the wait only means spending the same wasted tokens later. Three, rather
 * than one, because a single failure genuinely can be a machine going to sleep mid-spawn.
 */
const DEFAULT_MAX_FAILURES = 3;

export interface TickOptions {
  nowMs: number;
  minIntervalMs?: number;
  maxFailures?: number;
}

export interface TickDecision {
  run: boolean;
  /** Why, in a sentence a surface can show a person verbatim. Present on every decision. */
  reason: string;
}

/**
 * May the loop run right now?
 *
 * The reason is not a debug string. It is the only explanation the app has for a Librarian that
 * appears to be doing nothing, and "doing nothing" is indistinguishable from "broken" without
 * one — so every branch, including the ones that say yes, answers in words.
 */
export function shouldRunTick(state: TickState, opts: TickOptions): TickDecision {
  const maxFailures = opts.maxFailures ?? DEFAULT_MAX_FAILURES;
  const minIntervalMs = opts.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;

  // The latch is checked FIRST because it is the more useful sentence. A loop that has given up
  // is also, necessarily, a loop that ran recently — and answering "it ran two minutes ago" would
  // hide the fact that it is never going to run again on its own.
  if (state.consecutiveFailures >= maxFailures) {
    return {
      run: false,
      reason:
        `the Librarian failed ${plural(state.consecutiveFailures, "time")} in a row and has stopped trying — ` +
        "start it again yourself once the cause is fixed",
    };
  }

  if (state.lastRunMs === null) {
    return { run: true, reason: "the Librarian has not read this repository's sessions yet" };
  }

  const elapsed = opts.nowMs - state.lastRunMs;
  // A clock that moved backwards — a laptop waking from sleep, an NTP correction, a timezone
  // library that was never the right tool — leaves an elapsed time no schedule can reason about.
  // Running is the cheap wrong answer: the watcher already dedupes by the mtime it read, so a
  // spurious tick costs a directory listing, while refusing on a negative number would hold the
  // loop shut until the clock caught back up to a moment that may never arrive.
  if (elapsed < 0) {
    return { run: true, reason: "the clock moved backwards since the last run, so the wait cannot be trusted" };
  }

  if (elapsed < minIntervalMs) {
    return {
      run: false,
      reason: `the Librarian ran ${ago(elapsed)}; it waits ${duration(minIntervalMs)} between runs`,
    };
  }

  return { run: true, reason: `the last run was ${ago(elapsed)}` };
}

/**
 * Fold a finished run back into the state.
 *
 * The clock is stamped whether the run worked or not, because a failed run still spawned
 * something and still spent time: letting failure skip the floor would mean a repository that
 * fails fast ticks as often as the timer fires, which is exactly the loop this file exists to
 * prevent. One success resets the counter completely — a Librarian that works is not "less
 * broken than before", it is working.
 */
export function recordTick(state: TickState, outcome: { ok: boolean; nowMs: number }): TickState {
  return {
    lastRunMs: outcome.nowMs,
    consecutiveFailures: outcome.ok ? 0 : state.consecutiveFailures + 1,
  };
}

/**
 * Is the loop still willing to run itself?
 *
 * False means the latch is engaged: nothing further happens on its own, so the surface owes the
 * user a way in — a "run it now" affordance that calls the distil verb directly and reports its
 * outcome back through `recordTick`. A single success clears the latch, and that is the right
 * test: the cause of a repeated failure lives outside Kage, and the only evidence that it has
 * been fixed is a run that works.
 *
 * Takes no options because a caller asking this is deciding whether to draw a button, not
 * re-deriving the schedule; anyone tuning `maxFailures` should ask `shouldRunTick`, which answers
 * against the same threshold it enforced.
 */
export function backoffCleared(state: TickState): boolean {
  return state.consecutiveFailures < DEFAULT_MAX_FAILURES;
}

function plural(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : `${noun}s`}`;
}

/** Minutes, because the floor is minutes and nothing a person reads here is finer than that. */
function ago(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "less than a minute ago";
  if (minutes < 90) return `${plural(minutes, "minute")} ago`;
  return `${plural(Math.round(minutes / 60), "hour")} ago`;
}

function duration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes >= 1 ? plural(minutes, "minute") : plural(Math.round(ms / 1000), "second");
}
