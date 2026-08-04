import test from "node:test";
import assert from "node:assert/strict";

import { backoffCleared, emptyTickState, recordTick, shouldRunTick, type TickState } from "./schedule.js";

// This policy decides how often the user's own subscription gets spent, so both mistakes it can
// make are expensive in opposite directions: too eager and a background loop bills them forever
// for a Librarian that cannot work, too shy and the capture loop is the demo it was before
// anything called it. The tests below therefore pin the two numbers that bound that — the floor
// between runs and the failures it takes to give up — and pin the sentences, because a loop that
// has quietly stopped is indistinguishable from a broken one unless it can say why.

/** A fixed clock. Everything here is arithmetic on it, so the test owns time completely. */
const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

/** A state as it would be after a run at `ageMs` before NOW. */
function ranAt(ageMs: number, consecutiveFailures = 0): TickState {
  return { lastRunMs: NOW - ageMs, consecutiveFailures };
}

// ── The floor between runs ──────────────────────────────────────────────────────────────────

test("the first tick in a repository runs, because there is no earlier run to be too soon after", () => {
  const decision = shouldRunTick(emptyTickState(), { nowMs: NOW });

  assert.equal(decision.run, true);
  // Absence is stated as absence. "0 minutes ago" would be a measurement nobody took.
  assert.match(decision.reason, /has not read this repository's sessions yet/);
});

test("a second run inside the five-minute floor is refused, and allowed the moment the floor passes", () => {
  assert.equal(shouldRunTick(ranAt(2 * MINUTE), { nowMs: NOW }).run, false);
  assert.equal(shouldRunTick(ranAt(4 * MINUTE), { nowMs: NOW }).run, false);
  // Exactly at the floor is past it: the wait has been served, and a strict comparison here would
  // silently double the interval on any timer whose period divides it.
  assert.equal(shouldRunTick(ranAt(5 * MINUTE), { nowMs: NOW }).run, true);
  assert.equal(shouldRunTick(ranAt(41 * MINUTE), { nowMs: NOW }).run, true);
});

test("the floor applies to a run that failed exactly as it does to one that worked", () => {
  // A failed run still spawned a headless agent and still spent time. If failure skipped the
  // floor, a repository failing fast would tick as often as the timer fires — the runaway this
  // policy exists to prevent.
  const failed = recordTick(emptyTickState(), { ok: false, nowMs: NOW });

  assert.equal(failed.lastRunMs, NOW);
  assert.equal(shouldRunTick(failed, { nowMs: NOW + MINUTE }).run, false);
  assert.equal(shouldRunTick(failed, { nowMs: NOW + 6 * MINUTE }).run, true);
});

test("a clock that jumped backwards does not wedge the loop shut", () => {
  // Sleep and NTP both do this. The watcher already dedupes by the mtime it read, so a spurious
  // tick costs a directory listing — while refusing on a negative elapsed time would hold the
  // loop closed until the clock caught up to a moment that may never arrive.
  const decision = shouldRunTick(ranAt(-30 * MINUTE), { nowMs: NOW });

  assert.equal(decision.run, true);
  assert.match(decision.reason, /clock moved backwards/);
});

// ── Backing off, and coming back ────────────────────────────────────────────────────────────

test("three failures in a row stop the loop, and no amount of further waiting restarts it", () => {
  let state = emptyTickState();
  for (const at of [NOW, NOW + 6 * MINUTE, NOW + 12 * MINUTE]) {
    state = recordTick(state, { ok: false, nowMs: at });
  }

  assert.equal(state.consecutiveFailures, 3);
  assert.equal(shouldRunTick(state, { nowMs: NOW + 18 * MINUTE }).run, false);
  // The latch is not a wait. A missing binary is still missing tomorrow, and retrying it on a
  // schedule is an infinite bill that never produces a card.
  assert.equal(shouldRunTick(state, { nowMs: NOW + 7 * 24 * 60 * MINUTE }).run, false);
});

test("two failures are not three, so a machine that hiccuped once keeps its loop", () => {
  const state = recordTick(recordTick(emptyTickState(), { ok: false, nowMs: NOW }), {
    ok: false,
    nowMs: NOW + 6 * MINUTE,
  });

  assert.equal(state.consecutiveFailures, 2);
  assert.equal(shouldRunTick(state, { nowMs: NOW + 12 * MINUTE }).run, true);
});

test("one run that works clears every failure counted before it", () => {
  // The only honest evidence that an outside cause was fixed is a run that succeeded, so success
  // resets the counter outright rather than decrementing it.
  const failing = ranAt(0, 2);
  const recovered = recordTick(failing, { ok: true, nowMs: NOW });

  assert.equal(recovered.consecutiveFailures, 0);
  assert.equal(shouldRunTick(recovered, { nowMs: NOW + 6 * MINUTE }).run, true);
});

test("the latch outranks the floor, so the reason names what is actually wrong", () => {
  // A loop that has given up is also, always, a loop that ran recently. Reporting "it ran two
  // minutes ago" would be true and would hide that it is never going to run again.
  const stopped = ranAt(2 * MINUTE, 3);
  const decision = shouldRunTick(stopped, { nowMs: NOW });

  assert.equal(decision.run, false);
  assert.match(decision.reason, /failed 3 times in a row/);
  assert.match(decision.reason, /start it again yourself/, "a dead loop must name its way out");
});

test("backoffCleared is how a surface knows it owes the user a way in", () => {
  assert.equal(backoffCleared(emptyTickState()), true);
  assert.equal(backoffCleared(ranAt(MINUTE, 2)), true, "still trying — no button needed");
  assert.equal(backoffCleared(ranAt(MINUTE, 3)), false);
  assert.equal(backoffCleared(recordTick(ranAt(MINUTE, 3), { ok: true, nowMs: NOW })), true);
});

// ── The caller's dials ──────────────────────────────────────────────────────────────────────

test("the floor and the failure budget are both the caller's to set", () => {
  const recent = ranAt(90_000);
  assert.equal(shouldRunTick(recent, { nowMs: NOW }).run, false);
  assert.equal(shouldRunTick(recent, { nowMs: NOW, minIntervalMs: 60_000 }).run, true);

  const shaky = ranAt(30 * MINUTE, 1);
  assert.equal(shouldRunTick(shaky, { nowMs: NOW }).run, true);
  assert.equal(shouldRunTick(shaky, { nowMs: NOW, maxFailures: 1 }).run, false);
});

// ── Every answer is a sentence ──────────────────────────────────────────────────────────────

test("every decision explains itself in words a person can act on, refusals included", () => {
  const decisions = [
    shouldRunTick(emptyTickState(), { nowMs: NOW }),
    shouldRunTick(ranAt(30 * MINUTE), { nowMs: NOW }),
    shouldRunTick(ranAt(4 * MINUTE), { nowMs: NOW }),
    shouldRunTick(ranAt(30_000), { nowMs: NOW }),
    shouldRunTick(ranAt(3 * 60 * MINUTE), { nowMs: NOW }),
    shouldRunTick(ranAt(2 * MINUTE, 3), { nowMs: NOW }),
    shouldRunTick(ranAt(-MINUTE), { nowMs: NOW }),
  ];

  const refusals = decisions.filter((decision) => !decision.run);
  assert.equal(refusals.length, 3, "the refusing branches are all represented above");

  for (const { reason } of decisions) {
    assert.ok(reason.split(" ").length >= 5, `not a sentence: ${reason}`);
    // The reason is shown verbatim, so it may not leak the vocabulary of the code that produced
    // it: no identifiers, no raw milliseconds, and nothing that formatted an absent value.
    assert.doesNotMatch(reason, /[a-z][A-Z]/, `identifier leaked into a sentence: ${reason}`);
    assert.doesNotMatch(reason, /\d{4,}/, `a raw duration leaked into a sentence: ${reason}`);
    assert.doesNotMatch(reason, /undefined|NaN|null/, `an absent value was formatted: ${reason}`);
  }
});

test("elapsed time is said the way a person says it, at every scale", () => {
  assert.match(shouldRunTick(ranAt(20_000), { nowMs: NOW }).reason, /less than a minute ago/);
  assert.match(shouldRunTick(ranAt(MINUTE), { nowMs: NOW }).reason, /ran 1 minute ago/);
  assert.match(shouldRunTick(ranAt(45 * MINUTE), { nowMs: NOW }).reason, /last run was 45 minutes ago/);
  assert.match(shouldRunTick(ranAt(3 * 60 * MINUTE), { nowMs: NOW }).reason, /last run was 3 hours ago/);
});
