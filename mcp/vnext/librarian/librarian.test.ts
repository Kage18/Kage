import test from "node:test";
import assert from "node:assert/strict";

import { cardId } from "./card.js";
import { distillSession, recoverJsonArray, tokenJaccard } from "./librarian.js";
import { extractPrompt, triagePrompt } from "./prompts.js";
import { fakeProvider } from "./provider.js";
import type { Card, CardKind, CardState, LibrarianProvider, ProviderReply } from "./types.js";

// The pipeline is exercised entirely through the scripted provider seam: the two model calls are
// the only nondeterminism in the module, so scripting them makes every other behavior — the
// gate, the cap, the reconciler, the accounting — an exact assertion rather than a hope.

const DIGEST = [
  "USER: the rate limit check keeps getting flipped back, work out why",
  "TOOL: Read src/limits.ts",
  "ASSISTANT: withinLimit uses < on purpose; two PRs flipped it to <= and both were reverted",
].join("\n");

const TITLE = "tenantLimit comparison is exclusive on purpose";
const CLAIM =
  "withinLimit compares with < rather than <= so a tenant sitting exactly at the limit is refused. Two PRs flipped it and both were reverted.";

function proposalJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "caution",
    title: TITLE,
    claim: CLAIM,
    citations: [{ path: "src/limits.ts", symbol: "withinLimit" }],
    trigger: "editing src/limits.ts or changing a rate limit comparison",
    ...overrides,
  };
}

/** What a well-behaved extract pass returns: the JSON array alone. */
function extractReply(...proposals: Array<Record<string, unknown>>): string {
  return JSON.stringify(proposals);
}

function storedCard(fields: { kind?: CardKind; title: string; claim: string; state?: CardState }): Card {
  const kind = fields.kind ?? "caution";
  return {
    id: cardId({ kind, title: fields.title, claim: fields.claim }),
    kind,
    state: fields.state ?? "approved",
    verify: "verified",
    title: fields.title,
    claim: fields.claim,
    citations: [{ path: "src/limits.ts" }],
    trigger: "editing src/limits.ts",
    provenance: { source: "session", ref: "s-0", at: "2026-08-04T00:00:00.000Z" },
    tags: [],
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}

function distill(provider: LibrarianProvider, existing: Card[] = []) {
  return distillSession(provider, { digest: DIGEST, sessionRef: "session-1", existing });
}

/** fakeProvider always reports null usage; this one reports whatever a test wants measured. */
function meteredProvider(replies: ProviderReply[]): LibrarianProvider {
  let next = 0;
  return {
    async complete() {
      if (next >= replies.length) throw new Error("meteredProvider exhausted");
      return replies[next++];
    },
  };
}

// ── The triage pass ──────────────────────────────────────────────────────────────────────────

// Saying NO is the job being done well. fakeProvider throws on an unscripted call, so scripting
// exactly one reply is itself the assertion that the working tier was never reached.
test("a NO from triage ends the session with one cheap call and nothing to review", async () => {
  const provider = fakeProvider(["NO: a rename with no reasoning anyone could not re-derive"]);
  const outcome = await distill(provider);

  assert.equal(provider.calls.length, 1);
  assert.equal(provider.calls[0].tier, "triage");
  assert.equal(outcome.triage.worthIt, false);
  assert.match(outcome.triage.reason, /a rename with no reasoning/);
  assert.deepEqual(outcome.proposals, []);
  assert.deepEqual(outcome.actions, []);
  assert.deepEqual(outcome.rejected, []);
});

test("a lowercase no is still a no — the model is not held to the shape of its refusal", async () => {
  const provider = fakeProvider(["no — nothing durable here"]);
  const outcome = await distill(provider);
  assert.equal(outcome.triage.worthIt, false);
  assert.equal(provider.calls.length, 1);
});

test("a YES sends the digest to the working tier and the card comes back", async () => {
  const provider = fakeProvider(["YES: a revert-backed caution about the limit comparison", extractReply(proposalJson())]);
  const outcome = await distill(provider);

  assert.equal(provider.calls.length, 2);
  assert.equal(provider.calls[1].tier, "extract");
  assert.ok(provider.calls[1].prompt.includes(DIGEST), "the extract pass sees the same digest triage did");
  assert.equal(outcome.triage.worthIt, true);
  assert.equal(outcome.proposals.length, 1);
  assert.equal(outcome.proposals[0].title, TITLE);
  assert.deepEqual(outcome.actions, [{ action: "add" }]);
});

// ── The cap ──────────────────────────────────────────────────────────────────────────────────

test("at most three cards survive one session — the extras are dropped, not queued", async () => {
  const many = Array.from({ length: 5 }, (_, i) =>
    proposalJson({ title: `caution number ${i}`, claim: `the ${i}th thing that went wrong, and why` }),
  );
  const outcome = await distill(fakeProvider(["YES: five things", extractReply(...many)]));

  assert.equal(outcome.proposals.length, 3);
  assert.equal(outcome.actions.length, 3, "every survivor carries exactly one verdict");
  assert.deepEqual(outcome.rejected, [], "an over-cap proposal is dropped, not reported as refused");
  assert.deepEqual(
    outcome.proposals.map((p) => p.title),
    ["caution number 0", "caution number 1", "caution number 2"],
  );
});

// ── The deterministic gate ───────────────────────────────────────────────────────────────────

test("a proposal that cites nothing is refused before any human sees it", async () => {
  const outcome = await distill(fakeProvider(["YES: something", extractReply(proposalJson({ citations: [] }))]));

  assert.deepEqual(outcome.proposals, []);
  assert.deepEqual(outcome.actions, []);
  assert.equal(outcome.rejected.length, 1);
  assert.equal(outcome.rejected[0].proposal.title, TITLE);
  assert.equal(outcome.rejected[0].problems[0].field, "citations");
  assert.match(outcome.rejected[0].problems[0].reason, /cites nothing/);
});

// A leaked key in a claim is an incident, not a quality problem: the refusal is deterministic,
// happens before the Inbox, and names the pattern so a human knows what tripped.
test("a secret in a claim is refused by name", async () => {
  const leaky = proposalJson({
    claim: "The staging deploy authenticates with AKIAIOSFODNN7EXAMPLE, which is set in CI.",
  });
  const outcome = await distill(fakeProvider(["YES: a runbook", extractReply(leaky)]));

  assert.deepEqual(outcome.proposals, []);
  assert.equal(outcome.rejected.length, 1);
  const secret = outcome.rejected[0].problems.find((p) => p.reason.startsWith("secret detected:"));
  assert.ok(secret, "the refusal names the scan that tripped");
  assert.match(secret.reason, /aws access key/);
  assert.equal(secret.field, "claim");
});

// ── The reconciler ───────────────────────────────────────────────────────────────────────────

test("a claim the store already holds comes back as a noop citing the card it duplicates", async () => {
  const existing = storedCard({ title: TITLE, claim: CLAIM });
  const outcome = await distill(fakeProvider(["YES: the same thing again", extractReply(proposalJson())]), [existing]);

  assert.equal(outcome.proposals.length, 1, "the proposal survives the gate; the verdict is what changes");
  assert.deepEqual(outcome.actions, [{ action: "noop", reason: `duplicate of ${existing.id}` }]);
});

test("a near-duplicate title updates the card it echoes instead of forking the subject", async () => {
  const existing = storedCard({ title: TITLE, claim: CLAIM });
  const echo = proposalJson({
    title: `${TITLE}, verified`,
    claim: "The exclusive comparison was re-checked against main this week and still holds.",
  });
  const outcome = await distill(fakeProvider(["YES: a re-check", extractReply(echo)]), [existing]);

  assert.deepEqual(outcome.actions, [{ action: "update", id: existing.id }]);
});

test("a different subject is an add, however familiar the words around it", async () => {
  const existing = storedCard({ title: TITLE, claim: CLAIM });
  const other = proposalJson({
    kind: "runbook",
    title: "regenerating the tray badge assets",
    claim: "Run the asset script; the monochrome template must stay 22x22 or the tray renders it blurred.",
  });
  const outcome = await distill(fakeProvider(["YES: a runbook", extractReply(other)]), [existing]);

  assert.deepEqual(outcome.actions, [{ action: "add" }]);
});

// Folding a proposal into a card the team explicitly withdrew would resurrect a decision that
// was already made.
test("a superseded card is never echoed — only live knowledge can be updated", async () => {
  const dead = storedCard({ title: TITLE, claim: CLAIM, state: "superseded" });
  const echo = proposalJson({ title: `${TITLE}, verified`, claim: "Re-checked against main; still holds." });
  const outcome = await distill(fakeProvider(["YES: a re-check", extractReply(echo)]), [dead]);

  assert.deepEqual(outcome.actions, [{ action: "add" }]);
});

// ── A bad model day ──────────────────────────────────────────────────────────────────────────

// The Librarian runs unattended from the daemon at session end: a session's knowledge lost is
// recoverable, a crashed daemon is a dead product.
test("an unreadable extract reply ends in an empty outcome, never a throw", async () => {
  const outcome = await distill(fakeProvider(["YES: something is here", "I'm sorry, I couldn't produce that."]));

  assert.equal(outcome.triage.worthIt, true, "the triage verdict still stands");
  assert.deepEqual(outcome.proposals, []);
  assert.deepEqual(outcome.actions, []);
  assert.deepEqual(outcome.rejected, []);
});

test("a truncated JSON array is unreadable, not half a batch", async () => {
  const outcome = await distill(fakeProvider(["YES: something", '[{"kind":"caution","title":"tenant']));
  assert.deepEqual(outcome.proposals, []);
});

// ── Accounting ───────────────────────────────────────────────────────────────────────────────

test("usage sums what both passes measured", async () => {
  const provider = meteredProvider([
    { text: "YES: a caution", inputTokens: 800, outputTokens: 12, costUsd: 0.125 },
    { text: extractReply(proposalJson()), inputTokens: 1200, outputTokens: 240, costUsd: 0.5 },
  ]);
  const outcome = await distill(provider);

  assert.deepEqual(outcome.usage, { inputTokens: 2000, outputTokens: 252, costUsd: 0.625 });
});

// Null is the honest reading of "not measured" and renders as a dash. A zero here would read as
// a measurement claiming the run was free.
test("usage stays null when nothing was ever measured — no invented zero", async () => {
  const outcome = await distill(fakeProvider(["YES: a caution", extractReply(proposalJson())]));
  assert.deepEqual(outcome.usage, { inputTokens: null, outputTokens: null, costUsd: null });
});

test("an unmeasured pass contributes nothing and erases nothing", async () => {
  const provider = meteredProvider([
    { text: "YES: a caution", inputTokens: 800, outputTokens: 12, costUsd: 0.25 },
    { text: extractReply(proposalJson()), inputTokens: null, outputTokens: null, costUsd: null },
  ]);
  const outcome = await distill(provider);

  assert.deepEqual(outcome.usage, { inputTokens: 800, outputTokens: 12, costUsd: 0.25 });
});

test("a rejected session still reports what triage cost", async () => {
  const provider = meteredProvider([{ text: "NO: nothing here", inputTokens: 700, outputTokens: 9, costUsd: 0.125 }]);
  const outcome = await distill(provider);

  assert.deepEqual(outcome.usage, { inputTokens: 700, outputTokens: 9, costUsd: 0.125 });
});

// ── The two pure helpers ─────────────────────────────────────────────────────────────────────

test("tokenJaccard is set overlap over the words that carry meaning", () => {
  assert.equal(tokenJaccard("rate limit checks", "rate limit checks"), 1);
  assert.equal(tokenJaccard("rate limit checks", "electron tray badge"), 0);
  assert.equal(tokenJaccard("Rate Limit", "rate limit"), 1, "case is not a difference in subject");
  assert.equal(tokenJaccard("src/limits.ts guard", "guard limits src"), 1, "punctuation splits, it does not distinguish");
  // Words under three characters are dropped: they appear in every title and would drag every
  // pair of cards toward each other, which is how a similarity threshold misfires silently.
  assert.equal(tokenJaccard("a limit of it is on", "limit"), 1);
  assert.equal(tokenJaccard("", "anything at all"), 0, "an empty title matches nothing rather than everything");
  // Three shared of five distinct.
  assert.equal(tokenJaccard("alpha beta gamma", "alpha beta gamma delta epsilon"), 0.6);
});

test("recoverJsonArray digs the array out of whatever prose a model wrapped it in", () => {
  assert.deepEqual(recoverJsonArray('Sure — here you go:\n```json\n[{"kind":"caution"}]\n```\nHope that helps!'), [
    { kind: "caution" },
  ]);
  assert.deepEqual(recoverJsonArray("[]"), [], "an empty batch is a readable answer, not a failure");
  assert.equal(recoverJsonArray("there was nothing worth writing down"), null);
  assert.equal(recoverJsonArray('[{"kind":"caution"'), null);
  assert.equal(recoverJsonArray('{"kind":"caution"}'), null, "one object is not a batch");
});

// ── The prompts ──────────────────────────────────────────────────────────────────────────────

test("the triage prompt tells the model outright that NO is the expected answer", () => {
  const prompt = triagePrompt(DIGEST);
  assert.match(prompt, /NO is the expected answer/);
  assert.match(prompt, /YES: </);
  assert.match(prompt, /derive by reading the code/, "the derivability rule is stated, not implied");
  assert.ok(prompt.includes(DIGEST));
});

test("the extract prompt names the cards the store already holds so they are not re-proposed", () => {
  const prompt = extractPrompt(DIGEST, [TITLE]);
  assert.match(prompt, /Do not re-propose/);
  assert.ok(prompt.includes(`- ${TITLE}`));
  assert.match(prompt, /At most 3 cards/);
  assert.match(prompt, /literally appear in the digest/, "invented citations fail later as a mystery");
  assert.ok(prompt.includes(DIGEST));
  assert.match(extractPrompt(DIGEST, []), /\(none yet\)/, "an empty store still reads as a complete instruction");
});
