// The manager's replies used to be unreadable: guardManagerProse (manager-client.ts)
// blindly redacted every number-shaped thing it saw, punishing a correct restatement
// exactly as hard as a fabricated one, and rewriting "verified" INSIDE "hand-verified".
// This file covers the fix — verify against ground truth instead of censoring — and is
// its own file per repo convention (manager-client.test.ts already tests the guard's
// older fallback behavior; delegation.test.ts is off-limits to new behavior entirely).
import test from "node:test";
import assert from "node:assert/strict";
import { guardManagerProse } from "./delegation/manager-client.js";

test("acceptance: operator hand-verified 742+12 tests survives unchanged", () => {
  // Reverting the word-boundary fix (dropping the case-sensitive, hyphen-excluding
  // VERDICT_PATTERN back to the old case-insensitive /\b(...)\\b/gi) makes this fail:
  // "verified" inside "hand-verified" matches on a plain \b boundary (a hyphen is a
  // non-word character), rewriting it to "hand-[verdict on the card]".
  const reply = guardManagerProse("operator hand-verified 742+12 tests");
  assert.equal(reply.text, "operator hand-verified 742+12 tests");
  assert.deepEqual(reply.corrections, []);
});

test("word-boundary regression: unverified claims (ordinary prose) survives unchanged", () => {
  // Same fix, the other half of the brief's example: the old pattern was case-INsensitive,
  // so plain lowercase English ("unverified claims") matched the UNVERIFIED alternative
  // even though it is not a restatement of any card's exact-caps verdict token. Reverting
  // to case-insensitive matching makes this fail.
  const reply = guardManagerProse("3 unverified claims remain in the queue");
  assert.equal(reply.text, "3 unverified claims remain in the queue");
  assert.deepEqual(reply.corrections, []);
});

test("acceptance: a run's true VERIFIED 5/5 survives unchanged when checked against its card", () => {
  // Reverting to blind redaction (dropping the `facts` comparison) makes this fail: the
  // old guard replaced every VERIFIED/n-of-n match unconditionally, even an accurate one.
  const facts = [{ run_id: "run-abc", verdict: "VERIFIED 5/5" }];
  const reply = guardManagerProse("Run run-abc is VERIFIED 5/5, ready to merge.", facts);
  assert.equal(reply.text, "Run run-abc is VERIFIED 5/5, ready to merge.");
  assert.deepEqual(reply.corrections, []);
});

test("acceptance: a false VERIFIED 5/5 is corrected to the card's true NOT VERIFIED 3/5, and recorded", () => {
  // Reverting to blind redaction makes this fail differently: the wrong figure would be
  // replaced with an opaque "[verdict on the card]" placeholder instead of the true
  // value, and the correction record would just be the manager's wrong text rather than
  // naming both what was said and what the card actually says.
  const facts = [{ run_id: "run-abc", verdict: "NOT VERIFIED 3/5" }];
  const reply = guardManagerProse("Run run-abc is VERIFIED 5/5, ready to merge.", facts);
  assert.equal(reply.text, "Run run-abc is NOT VERIFIED 3/5, ready to merge.");
  assert.equal(reply.corrections.length, 1);
  assert.match(reply.corrections[0], /VERIFIED 5\/5/);
  assert.match(reply.corrections[0], /NOT VERIFIED 3\/5/);
});

test("acceptance: a dollar figure matching the run's recorded spend survives", () => {
  // Reverting to blind redaction makes this fail: the old guard replaced every "$N" with
  // "[cost on the card]" unconditionally, whether or not it matched the run's actual spend.
  const facts = [{ run_id: "run-abc", spend_usd: 12.5 }];
  const reply = guardManagerProse("That run cost $12.50 to verify.", facts);
  assert.equal(reply.text, "That run cost $12.50 to verify.");
  assert.deepEqual(reply.corrections, []);
});

test("a mismatched dollar figure is corrected to the recorded spend", () => {
  const facts = [{ run_id: "run-abc", spend_usd: 4.1 }];
  const reply = guardManagerProse("That run cost $9.99 to verify.", facts);
  assert.equal(reply.text, "That run cost $4.10 to verify.");
  assert.equal(reply.corrections.length, 1);
  assert.match(reply.corrections[0], /\$9\.99/);
  assert.match(reply.corrections[0], /\$4\.10/);
});

test("a mismatched diff size is corrected to the card's true figure", () => {
  const facts = [{ run_id: "run-abc", diff: { files: 2, lines: 40 } }];
  const reply = guardManagerProse("The diff was 3 files changed.", facts);
  assert.equal(reply.text, "The diff was 2 files changed.");
  assert.equal(reply.corrections.length, 1);
});

test("an unrelated dollar figure is left alone, not redacted, when several runs are in play", () => {
  // A budget cap or ledger figure that has nothing to do with any run's recorded spend
  // must not be silently erased — that would be noise, not safety. With more than one
  // run's spend in scope, a mismatch is at least as likely to be a different number
  // entirely as a wrong restatement, so the guard does not guess which run it "should" be.
  const facts = [{ run_id: "run-a", spend_usd: 4.1 }, { run_id: "run-b", spend_usd: 9.0 }];
  const reply = guardManagerProse("The per-run cap is $25.00.", facts);
  assert.equal(reply.text, "The per-run cap is $25.00.");
  assert.deepEqual(reply.corrections, []);
});

test("with a verdict fact present but no diff/spend fact, size and cost figures are still left alone", () => {
  const facts = [{ run_id: "run-abc", verdict: "VERIFIED 5/5" }];
  const reply = guardManagerProse("Run run-abc is VERIFIED 5/5, and it cost $3.00 for 2 files changed.", facts);
  assert.equal(reply.text, "Run run-abc is VERIFIED 5/5, and it cost $3.00 for 2 files changed.");
  assert.deepEqual(reply.corrections, []);
});
