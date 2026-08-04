import test from "node:test";
import assert from "node:assert/strict";

import {
  CLAIM_WORD_CAP,
  canTransition,
  cardId,
  parseCard,
  serializeCard,
  validateProposal,
} from "./card.js";
import type { Card, CardProposal } from "./types.js";

function proposal(overrides: Partial<CardProposal> = {}): CardProposal {
  return {
    kind: "caution",
    title: "tenantLimit comparison is exclusive on purpose",
    claim: "withinLimit uses < rather than <= so a tenant at exactly the limit is refused. Two PRs flipped it and both were reverted.",
    citations: [{ path: "src/limits.ts", symbol: "withinLimit" }],
    trigger: "editing src/limits.ts or changing rate limit comparisons",
    ...overrides,
  };
}

function card(overrides: Partial<Card> = {}): Card {
  const base = proposal();
  return {
    id: cardId(base),
    state: "proposed",
    verify: "unverified",
    provenance: { source: "session", ref: "s-1", at: "2026-08-04T10:00:00.000Z" },
    tags: [],
    createdAt: "2026-08-04T10:00:00.000Z",
    updatedAt: "2026-08-04T10:00:00.000Z",
    ...base,
    ...overrides,
  };
}

// ── The gate's deterministic half ────────────────────────────────────────────────────────────

test("a well-formed proposal has no problems", () => {
  assert.deepEqual(validateProposal(proposal()), []);
});

// THE rule. A claim nothing can falsify is trivia, and the trust story rests on every claim
// naming what would invalidate it.
test("a card that cites nothing cannot exist", () => {
  const problems = validateProposal(proposal({ citations: [] }));
  assert.equal(problems.length, 1);
  assert.match(problems[0].reason, /cites nothing/);
});

test("a claim past the hard cap is refused — cards are claims, not documents", () => {
  const problems = validateProposal(proposal({ claim: Array(CLAIM_WORD_CAP + 1).fill("word").join(" ") }));
  assert.equal(problems[0].field, "claim");
});

test("citation paths are repo-relative — absolute or escaping paths cannot be verified", () => {
  for (const path of ["/etc/passwd", "../outside.ts"]) {
    const problems = validateProposal(proposal({ citations: [{ path }] }));
    assert.match(problems[0].reason, /repo-relative/, path);
  }
});

test("a ref citation is admissible on its own — history is evidence too", () => {
  assert.deepEqual(validateProposal(proposal({ citations: [{ ref: "commit:abc123" }] })), []);
});

test("a card without a trigger is refused — it could never be recalled on purpose", () => {
  const problems = validateProposal(proposal({ trigger: "  " }));
  assert.equal(problems[0].field, "trigger");
});

// ── Identity ─────────────────────────────────────────────────────────────────────────────────

test("the same claim from two sessions is the same card", () => {
  assert.equal(cardId(proposal()), cardId(proposal()));
  assert.notEqual(cardId(proposal()), cardId(proposal({ claim: "something else entirely" })));
});

// ── The state machine ────────────────────────────────────────────────────────────────────────

test("supersede and retire are terminal — nothing is ever deleted or resurrected", () => {
  assert.equal(canTransition("proposed", "approved"), true);
  assert.equal(canTransition("proposed", "retired"), true);
  assert.equal(canTransition("approved", "superseded"), true);
  assert.equal(canTransition("superseded", "approved"), false);
  assert.equal(canTransition("retired", "approved"), false);
  assert.equal(canTransition("proposed", "superseded"), false, "only approved knowledge can be superseded");
});

// ── Serialization ────────────────────────────────────────────────────────────────────────────

test("a card round-trips through its file byte-exactly on rewrite", () => {
  const original = card();
  const text = serializeCard(original);
  const parsed = parseCard(text);
  assert.ok(parsed);
  assert.deepEqual(parsed, original);
  // Identical cards must produce identical bytes — the store commits every mutation, and
  // nondeterministic serialization would turn every rewrite into a spurious diff.
  assert.equal(serializeCard(parsed), text);
});

test("the file is a readable document: frontmatter plus the bare claim", () => {
  const text = serializeCard(card());
  assert.match(text, /^---\n/);
  assert.ok(text.trimEnd().endsWith("Two PRs flipped it and both were reverted."));
  assert.ok(!text.includes("claim:"), "the claim is the body, not an escaped frontmatter string");
});

// One corrupt file must degrade to "skipped", never take a directory listing down.
test("corruption parses to null, not an exception", () => {
  for (const bad of ["", "no frontmatter at all", "---\nkind: not json\n---\nbody", "---\nid: \"x\"\n---\n"]) {
    assert.equal(parseCard(bad), null, JSON.stringify(bad.slice(0, 20)));
  }
});

test("optional fields survive the round trip only when present", () => {
  const reviewed = card({ state: "approved", reviewedBy: "kushal", reviewNote: "checked against main" });
  const parsed = parseCard(serializeCard(reviewed));
  assert.equal(parsed?.reviewedBy, "kushal");
  const bare = parseCard(serializeCard(card()));
  assert.equal(bare?.reviewedBy, undefined);
});
