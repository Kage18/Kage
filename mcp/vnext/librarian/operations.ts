// The Librarian's verbs, in one place.
//
// Every surface — the CLI, the desktop app's IPC handlers, the read API — calls these and
// nothing below them. That matters because approving a card is not one write: it flips state,
// re-pins citations against the current tree, resolves a supersede, appends a receipt, and
// regenerates the BRIEF block the agents actually read. Any surface that assembled that
// sequence itself would eventually assemble it differently, and the two would drift.
//
// These functions own the clock and the filesystem; everything below them is pure or explicit.

import { readFileSync, writeFileSync } from "node:fs";
import { applyBrief, briefTarget, composeBrief } from "./brief.js";
import { appendReceipt } from "./receipts.js";
import { approveCard, listCards, openStore, proposeCard, rejectCard, setVerifyState, type CardStore } from "./store.js";
import { auditCard, repinCitations } from "./verify.js";
import type { Card, CardProposal, LibrarianProvider, Provenance } from "./types.js";

export interface ApplyResult {
  ok: boolean;
  card?: Card;
  error?: string;
}

/**
 * Regenerate the one artifact Kage writes into the product repo.
 *
 * Called after every approval and every verification sweep, because the BRIEF is a projection
 * of approved state — leaving it stale would mean agents read yesterday's answer while the app
 * shows today's. Returns the path so callers can report what changed.
 */
export function refreshBrief(store: CardStore, projectDir: string): { path: string; cards: number } {
  const approved = listCards(store, { state: "approved" });
  const brief = composeBrief(approved);
  const path = briefTarget(projectDir);
  let existing: string | null = null;
  try {
    existing = readFileSync(path, "utf8");
  } catch {
    existing = null; // First run: the file does not exist yet and applyBrief creates it.
  }
  writeFileSync(path, applyBrief(existing, brief));
  // Not `approved.length` — composeBrief drops stale cards and enforces a line cap, so the
  // honest count is what actually reached the file.
  return { path, cards: brief.split("\n").filter((line) => line.startsWith("- ")).length };
}

/**
 * Approve a proposal into team knowledge.
 *
 * Citations are re-pinned FIRST, against the tree as it stands at the moment of approval. A
 * card approved today should read "verified" today — pinning at proposal time would mean every
 * card arrived already drifted if the reviewer took an afternoon to get to it.
 */
export function approve(
  store: CardStore,
  projectDir: string,
  id: string,
  reviewer: string,
  note?: string,
): ApplyResult {
  const result = approveCard(store, id, reviewer, note);
  if ("error" in result) return { ok: false, error: result.error };

  const repinned = { ...result.card, citations: repinCitations(projectDir, result.card.citations) };
  const audit = auditCard(projectDir, repinned);
  const card = setVerifyState(store, id, audit.verify) ?? result.card;

  appendReceipt(store.dir, { type: "card_approved", at: new Date().toISOString(), cardId: id });
  refreshBrief(store, projectDir);
  return { ok: true, card };
}

export function reject(store: CardStore, id: string, reviewer: string, reason: string): ApplyResult {
  const result = rejectCard(store, id, reviewer, reason);
  if ("error" in result) return { ok: false, error: result.error };
  appendReceipt(store.dir, { type: "card_rejected", at: new Date().toISOString(), cardId: id, detail: reason });
  return { ok: true, card: result.card };
}

export interface IngestSummary {
  proposed: number;
  deduped: number;
  rejected: number;
  problems: string[];
}

/**
 * Put a batch of proposals through the store's gate.
 *
 * Deduping is counted separately from rejection on purpose: "we already knew that" is the
 * system working, while "the gate refused this" is a quality signal about the extractor. Fusing
 * them into one number would hide whichever is degrading.
 */
export function ingestProposals(
  store: CardStore,
  proposals: readonly CardProposal[],
  provenance: Provenance,
): IngestSummary {
  const summary: IngestSummary = { proposed: 0, deduped: 0, rejected: 0, problems: [] };
  for (const proposal of proposals) {
    const result = proposeCard(store, proposal, provenance);
    if ("problems" in result) {
      summary.rejected += 1;
      summary.problems.push(`${proposal.title}: ${result.problems.map((p) => p.reason).join("; ")}`);
      continue;
    }
    if (result.deduped) {
      summary.deduped += 1;
      continue;
    }
    summary.proposed += 1;
    appendReceipt(store.dir, {
      type: "card_proposed",
      at: new Date().toISOString(),
      cardId: result.card.id,
      sessionRef: provenance.ref,
    });
  }
  return summary;
}

export interface MineSummary extends IngestSummary {
  ok: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  commits: number;
  reverts: number;
  error?: string;
}

/**
 * Day one: read the repository's own history and propose what it already knows.
 *
 * This is the cold-start answer. A memory product with no memories is a dead demo, so the first
 * cards come from history the team already wrote rather than from usage that has not happened.
 */
export async function mineRepository(
  provider: LibrarianProvider,
  store: CardStore,
  projectDir: string,
  opts?: { maxCommits?: number },
): Promise<MineSummary> {
  const { mineHistory } = await import("./miner.js");
  const existing = listCards(store);
  const empty: MineSummary = {
    ok: false,
    proposed: 0,
    deduped: 0,
    rejected: 0,
    problems: [],
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    commits: 0,
    reverts: 0,
  };

  let result;
  try {
    result = await mineHistory(provider, projectDir, existing, opts);
  } catch (error) {
    // A failed mining run is a report, not a crash — the user pressed a button and deserves to
    // be told what happened to it.
    return { ...empty, error: error instanceof Error ? error.message : String(error) };
  }

  const provenance: Provenance = {
    source: "mining",
    ref: `history:${result.digest.commits}`,
    at: new Date().toISOString(),
  };
  const ingested = ingestProposals(store, result.proposals, provenance);
  ingested.rejected += result.rejected.length;
  for (const entry of result.rejected) {
    ingested.problems.push(`${entry.proposal.title}: ${entry.problems.map((p) => p.reason).join("; ")}`);
  }

  appendReceipt(store.dir, {
    type: "mining_run",
    at: provenance.at,
    detail: `${result.digest.commits} commits, ${result.digest.reverts} reverts`,
    ...(result.usage.inputTokens !== null ? { inputTokens: result.usage.inputTokens } : {}),
    ...(result.usage.outputTokens !== null ? { outputTokens: result.usage.outputTokens } : {}),
    ...(result.usage.costUsd !== null ? { costUsd: result.usage.costUsd } : {}),
  });

  return {
    ok: true,
    ...ingested,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    costUsd: result.usage.costUsd,
    commits: result.digest.commits,
    reverts: result.digest.reverts,
  };
}

/**
 * Re-check every approved card against the tree as it stands now.
 *
 * The store heals on read rather than on a schedule: a claim whose code moved must stop being
 * served before it misleads anyone, and the sweep is cheap because verification is deterministic.
 */
export function verifySweep(store: CardStore, projectDir: string): { checked: number; stale: number; unverified: number; verified: number } {
  const counts = { checked: 0, stale: 0, unverified: 0, verified: 0 };
  for (const card of listCards(store, { state: "approved" })) {
    const audit = auditCard(projectDir, card);
    counts.checked += 1;
    counts[audit.verify] += 1;
    if (audit.verify !== card.verify) setVerifyState(store, card.id, audit.verify);
  }
  refreshBrief(store, projectDir);
  return counts;
}

/** Open the store for a project — the entry every surface starts from. */
export function storeFor(projectDir: string, root?: string): CardStore {
  return openStore(projectDir, root);
}
