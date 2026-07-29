import test from "node:test";
import assert from "node:assert/strict";

import { decideAlerts, INTERRUPT_AT, type AlertCandidate } from "./alerts.js";

function candidate(overrides: Partial<AlertCandidate> = {}): AlertCandidate {
  return {
    ref: "packet:one",
    kind: "unclaimed_building",
    severity: 80,
    summary: "Nobody has claimed the work on feat/limits",
    ...overrides,
  };
}

function decide(candidates: AlertCandidate[], seen: string[] = [], observedBefore = true) {
  return decideAlerts({ repoName: "Kage", candidates, seen, observedBefore });
}

// THE rule that makes an app installable. A first launch that replays a month of backlog at you
// is how an icon gets muted on day one and is worth nothing forever after.
test("first sight of a repository notifies about nothing, and records it all as history", () => {
  const result = decideAlerts({
    repoName: "Kage",
    candidates: [candidate({ ref: "a" }), candidate({ ref: "b" }), candidate({ ref: "c" })],
    seen: [],
    observedBefore: false,
  });
  assert.equal(result.alert, null, "no banner on first observation");
  assert.deepEqual(result.seen.sort(), ["a", "b", "c"], "but it is all remembered, so it stays quiet");
});

test("a new urgent item interrupts once, and never again while it is still there", () => {
  const first = decide([candidate({ ref: "a" })]);
  assert.ok(first.alert, "the first sighting speaks");
  assert.match(first.alert!.body, /Nobody has claimed/);

  // Same item, still open, next poll.
  const second = decide([candidate({ ref: "a" })], first.seen);
  assert.equal(second.alert, null, "silence for something already said");
});

// Resolution clears it, so a genuine recurrence is genuine news. This is also what keeps the
// seen-set bounded by what is live rather than growing without limit.
test("an item that is resolved and later recurs is allowed to speak again", () => {
  const first = decide([candidate({ ref: "a" })]);
  const resolved = decide([], first.seen);
  assert.deepEqual(resolved.seen, [], "resolved items leave the set");

  const recurred = decide([candidate({ ref: "a" })], resolved.seen);
  assert.ok(recurred.alert, "a recurrence is new information");
});

test("below the cost-of-delay threshold nothing interrupts anyone", () => {
  const result = decide([
    candidate({ ref: "parked", kind: "parked", severity: 40 }),
    candidate({ ref: "stale", kind: "stale_critical", severity: INTERRUPT_AT - 1 }),
  ]);
  assert.equal(result.alert, null);
});

// The subtle one. A quiet item must NOT be recorded as seen, because severity ages upward — if
// it were recorded now, the moment it finally became urgent it would be silently suppressed.
test("a quiet item is not recorded, so it can still speak when age makes it urgent", () => {
  const quiet = decide([candidate({ ref: "aging", severity: 55 })]);
  assert.deepEqual(quiet.seen, [], "not remembered while it is merely untidy");

  const aged = decide([candidate({ ref: "aging", severity: 82 })], quiet.seen);
  assert.ok(aged.alert, "once it is costing the team, it speaks");
});

test("many at once is one summary, not one banner each", () => {
  const result = decide([
    candidate({ ref: "a", severity: 72, summary: "Least urgent" }),
    candidate({ ref: "b", severity: 95, summary: "Two agents are editing the same file" }),
    candidate({ ref: "c", severity: 80, summary: "Middle" }),
    candidate({ ref: "d", severity: 78, summary: "Also middle" }),
    candidate({ ref: "e", severity: 74, summary: "Nearly least" }),
  ]);
  assert.ok(result.alert);
  assert.match(result.alert!.title, /5 decisions need you/);
  // A summary is useless if it does not say which one matters most.
  assert.match(result.alert!.body, /Two agents are editing the same file/);
  assert.equal(result.alert!.refs.length, 5, "clicking it must be able to reach all of them");
});

test("two new items name the first and count the rest", () => {
  const result = decide([
    candidate({ ref: "a", severity: 90, summary: "The urgent one" }),
    candidate({ ref: "b", severity: 75, summary: "The other one" }),
  ]);
  assert.match(result.alert!.body, /The urgent one \(\+1 more\)/);
});

test("an alert carries the route that answers it", () => {
  const result = decide([candidate({ ref: "a" })]);
  assert.equal(result.alert!.route, "/attention");
});

test("no candidates is quiet and stays quiet", () => {
  const result = decide([]);
  assert.equal(result.alert, null);
  assert.deepEqual(result.seen, []);
});
