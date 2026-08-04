import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { recallCards } from "./recall.js";
import { appendReceipt, readReceipts, receiptCounts } from "./receipts.js";
import type { Card, ReceiptEvent } from "./types.js";

function approvedCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card_00000000",
    kind: "caution",
    state: "approved",
    verify: "verified",
    title: "tenant cap comparison is exclusive on purpose",
    claim: "withinLimit uses < rather than <= so a tenant at exactly the cap is refused.",
    citations: [{ path: "src/limits.ts", symbol: "withinLimit" }],
    trigger: "editing tenant caps",
    provenance: { source: "session", ref: "s-1", at: "2026-08-04T10:00:00.000Z" },
    tags: [],
    createdAt: "2026-08-04T10:00:00.000Z",
    updatedAt: "2026-08-04T10:00:00.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<ReceiptEvent> = {}): ReceiptEvent {
  return { type: "recall_served", at: "2026-08-04T10:00:00.000Z", ...overrides };
}

// ── Scoring — a citation is ground truth, a trigger is the author's guess ────────────────────

test("a cited-path match outranks a keyword match, and each why names what matched", () => {
  const pathCard = approvedCard({ id: "card_aaaaaaaa" });
  const keywordCard = approvedCard({
    id: "card_bbbbbbbb",
    title: "backoff doubling is deliberate",
    claim: "the retry backoff doubles by design; two PRs flattened it and both regressed.",
    citations: [{ ref: "commit:abc123" }],
    trigger: "changing rate limit behavior",
  });

  const { served } = recallCards([keywordCard, pathCard], {
    files: ["src/limits.ts"],
    text: "adjust the rate limits",
  });

  assert.equal(served.length, 2);
  assert.equal(served[0].card.id, "card_aaaaaaaa", "the file the action touches beats prose overlap");
  assert.ok(served[0].score > served[1].score);
  assert.match(served[0].why, /cites src\/limits\.ts/);
  assert.match(served[1].why, /trigger matched 'rate'/);
});

test("path overlap works at segment boundaries in both directions, never inside a segment", () => {
  const card = approvedCard();
  // A deeper checkout path still reaches the repo-relative citation; a bare directory does too.
  for (const file of ["src/limits.ts", "worktree/src/limits.ts", "src"]) {
    assert.equal(recallCards([card], { files: [file] }).served.length, 1, file);
  }
  // A substring inside a segment is a typo, not a file.
  assert.equal(recallCards([card], { files: ["imits.ts"] }).served.length, 0);
});

// ── The hardest rule — stale is withheld, visibly ────────────────────────────────────────────

test("a stale approved card lands in withheld, never in served", () => {
  const stale = approvedCard({ id: "card_cccccccc", verify: "stale" });
  const result = recallCards([stale], { files: ["src/limits.ts"] });

  assert.equal(result.served.length, 0);
  assert.equal(result.withheld.length, 1);
  assert.deepEqual(result.withheld[0], { card: stale, reason: "stale" });
});

test("withholding answers this query — a stale card the action never touched stays out", () => {
  const unrelatedStale = approvedCard({
    id: "card_dddddddd",
    verify: "stale",
    citations: [{ path: "src/other.ts" }],
    trigger: "editing the deploy pipeline",
  });
  const result = recallCards([unrelatedStale], { files: ["src/limits.ts"] });
  assert.deepEqual(result, { served: [], withheld: [] });
});

// ── Eligibility — only approved knowledge exists to recall ───────────────────────────────────

test("proposed, superseded, and retired cards never appear anywhere, however well they match", () => {
  const cards: Card[] = [
    approvedCard({ id: "card_11111111", state: "proposed" }),
    approvedCard({ id: "card_22222222", state: "superseded" }),
    approvedCard({ id: "card_33333333", state: "retired" }),
  ];
  const result = recallCards(cards, { files: ["src/limits.ts"], text: "tenant caps" });
  assert.deepEqual(result, { served: [], withheld: [] });
});

test("an empty query serves nothing — recall answers an action, not a browse", () => {
  const result = recallCards([approvedCard()], {});
  assert.deepEqual(result, { served: [], withheld: [] });
});

// ── The cap ──────────────────────────────────────────────────────────────────────────────────

test("the limit is honored and the best-scored cards win the budget", () => {
  const cards = Array.from({ length: 7 }, (_, i) =>
    approvedCard({
      id: `card_0000000${i}`,
      citations: [{ path: "src/app.ts" }],
      // The first three also match a keyword, so they must outrank the rest.
      trigger: i < 3 ? "editing src/app.ts during deploy" : "editing src/app.ts",
    }),
  );

  const capped = recallCards(cards, { files: ["src/app.ts"], text: "deploy", limit: 2 });
  assert.equal(capped.served.length, 2);
  assert.ok(capped.served.every((s) => s.score === 4), "only keyword-boosted cards fit the budget");

  const defaulted = recallCards(cards, { files: ["src/app.ts"], text: "deploy" });
  assert.equal(defaulted.served.length, 5, "the default cap is 5, not everything that matched");
});

// ── Receipts — every displayed number is an event that happened ──────────────────────────────

test("receipts round-trip: appended events read back newest first, bucketed by month, counted", () => {
  const storeDir = mkdtempSync(join(tmpdir(), "kage-receipts-"));
  appendReceipt(storeDir, event({ type: "recall_served", at: "2026-07-31T10:00:00.000Z" }));
  appendReceipt(storeDir, event({ type: "card_proposed", at: "2026-08-01T09:00:00.000Z" }));
  appendReceipt(storeDir, event({ type: "recall_served", at: "2026-08-02T09:00:00.000Z" }));

  assert.ok(existsSync(join(storeDir, "receipts", "2026-07.jsonl")), "events bucket by their own month");
  assert.ok(existsSync(join(storeDir, "receipts", "2026-08.jsonl")));

  const all = readReceipts(storeDir);
  assert.deepEqual(
    all.map((e) => e.at),
    ["2026-08-02T09:00:00.000Z", "2026-08-01T09:00:00.000Z", "2026-07-31T10:00:00.000Z"],
  );

  const limited = readReceipts(storeDir, { limit: 2 });
  assert.equal(limited.length, 2);
  assert.equal(limited[0].at, "2026-08-02T09:00:00.000Z");

  assert.deepEqual(receiptCounts(storeDir), { recall_served: 2, card_proposed: 1 });
});

test("a corrupt receipt line is skipped, not fatal — one torn write cannot kill the ledger", () => {
  const storeDir = mkdtempSync(join(tmpdir(), "kage-receipts-"));
  appendReceipt(storeDir, event({ at: "2026-08-01T09:00:00.000Z" }));
  // A crash mid-append, and a line that is valid JSON but not a receipt.
  appendFileSync(join(storeDir, "receipts", "2026-08.jsonl"), '{"type": "recall_serv\n');
  appendFileSync(join(storeDir, "receipts", "2026-08.jsonl"), '{"type": 42, "at": true}\n');
  appendReceipt(storeDir, event({ at: "2026-08-02T09:00:00.000Z" }));

  const events = readReceipts(storeDir);
  assert.equal(events.length, 2);
  assert.deepEqual(receiptCounts(storeDir), { recall_served: 2 });
});

test("appendReceipt cannot throw, even when the receipts path is unwritable", () => {
  const storeDir = mkdtempSync(join(tmpdir(), "kage-receipts-"));
  // A plain file squatting where the directory must go makes mkdir -p fail deterministically,
  // on any platform, for any user — including root, which ignores permission bits.
  writeFileSync(join(storeDir, "receipts"), "not a directory");

  assert.doesNotThrow(() => appendReceipt(storeDir, event()));
  assert.deepEqual(readReceipts(storeDir), [], "an unreadable ledger reads as empty, not as an error");
});
