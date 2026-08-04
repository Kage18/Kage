// One card, one file — parsing, serialization, validation, and the state machine.
//
// The file format is markdown with a strict frontmatter: every value after `key: ` is JSON.
// That one rule buys a hand-rolled parser that cannot be wrong about quoting or nesting —
// JSON.parse does the hard part — while the file stays a document a person can read, diff,
// and blame. This matters because the shadow store's whole pitch is that memory is inspectable
// without Kage installed.

import { createHash } from "node:crypto";
import type { Card, CardKind, CardProposal, CardState, Citation, VerifyState } from "./types.js";
import { isCodeCitation } from "./types.js";

export const CARD_KINDS: readonly CardKind[] = ["decision", "runbook", "caution"];
export const CARD_STATES: readonly CardState[] = ["proposed", "approved", "superseded", "retired"];
export const VERIFY_STATES: readonly VerifyState[] = ["verified", "unverified", "stale"];

/** The Librarian is prompted to ~120 words; this is the hard stop, not the target. */
export const CLAIM_WORD_CAP = 160;

/** Every reason a proposal can be refused, as data — the gate reports, it never throws. */
export interface CardProblem {
  field: string;
  reason: string;
}

/**
 * Validate a proposal before it becomes a card. Deterministic and total: a list of problems,
 * empty when admissible. The two load-bearing rules:
 *
 *   A card with zero citations cannot exist. A claim nothing can falsify is trivia, and the
 *   whole trust story rests on every claim naming what would invalidate it.
 *
 *   The claim is capped. Cards are claims, not documents — a 400-word "card" is a doc that
 *   dodged review, and the cap forces the Librarian to propose the fact, not the transcript.
 */
export function validateProposal(proposal: CardProposal): CardProblem[] {
  const problems: CardProblem[] = [];

  if (!CARD_KINDS.includes(proposal.kind)) {
    problems.push({ field: "kind", reason: `kind must be one of ${CARD_KINDS.join(", ")}` });
  }
  if (!proposal.title?.trim()) {
    problems.push({ field: "title", reason: "a card needs a title" });
  }
  if (!proposal.claim?.trim()) {
    problems.push({ field: "claim", reason: "a card with no claim is not a card" });
  } else {
    const words = proposal.claim.trim().split(/\s+/).length;
    if (words > CLAIM_WORD_CAP) {
      problems.push({ field: "claim", reason: `claim is ${words} words; the cap is ${CLAIM_WORD_CAP}` });
    }
  }
  if (!Array.isArray(proposal.citations) || proposal.citations.length === 0) {
    problems.push({ field: "citations", reason: "a card that cites nothing cannot exist" });
  } else {
    proposal.citations.forEach((citation, index) => {
      if (isCodeCitation(citation)) {
        if (!citation.path.trim()) {
          problems.push({ field: `citations[${index}]`, reason: "a code citation needs a path" });
        } else if (citation.path.includes("..") || citation.path.startsWith("/")) {
          // Repo-relative only. An absolute or escaping path can't be verified against the
          // worktree and would leak machine-specific detail into shared memory.
          problems.push({ field: `citations[${index}]`, reason: "citation paths are repo-relative" });
        }
      } else if (!citation.ref?.trim()) {
        problems.push({ field: `citations[${index}]`, reason: "a ref citation needs a ref" });
      }
    });
  }
  if (!proposal.trigger?.trim()) {
    problems.push({ field: "trigger", reason: "a card without a trigger can never be recalled on purpose" });
  }

  return problems;
}

/** Content-addressed: the same claim from two sessions is the same card, and dedupe is free. */
export function cardId(proposal: Pick<CardProposal, "kind" | "title" | "claim">): string {
  const digest = createHash("sha256")
    .update(`${proposal.kind}\n${proposal.title.trim()}\n${proposal.claim.trim()}`)
    .digest("hex");
  return `card_${digest.slice(0, 8)}`;
}

/**
 * The state machine, as the single authority both the store and the app consult.
 * Supersede/retire are terminal; nothing is ever deleted.
 */
export function canTransition(from: CardState, to: CardState): boolean {
  const allowed: Record<CardState, CardState[]> = {
    proposed: ["approved", "retired"],
    approved: ["superseded", "retired"],
    superseded: [],
    retired: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

// ── Serialization ─────────────────────────────────────────────────────────────────────────────
//
// Frontmatter keys are written in a FIXED order so that identical cards produce identical
// bytes — the store commits every mutation, and nondeterministic key order would turn every
// rewrite into a spurious diff.

const FRONTMATTER_ORDER: readonly (keyof Card)[] = [
  "id",
  "kind",
  "state",
  "verify",
  "title",
  "citations",
  "trigger",
  "provenance",
  "tags",
  "supersedes",
  "supersededBy",
  "createdAt",
  "updatedAt",
  "reviewedBy",
  "reviewNote",
];

export function serializeCard(card: Card): string {
  const lines: string[] = ["---"];
  for (const key of FRONTMATTER_ORDER) {
    const value = card[key];
    if (value === undefined) continue;
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push("---", "", card.claim.trim(), "");
  return lines.join("\n");
}

/**
 * Parse one card file. Returns null rather than throwing: the store reads whole directories,
 * and one corrupt file must degrade to "this file was skipped", never take the listing down.
 */
export function parseCard(content: string): Card | null {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(content);
  if (!match) return null;

  const record: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(": ");
    if (colon <= 0) continue;
    const key = line.slice(0, colon);
    try {
      record[key] = JSON.parse(line.slice(colon + 2));
    } catch {
      return null; // A frontmatter value that isn't JSON is corruption, not a variant.
    }
  }

  const claim = match[2].trim();
  if (
    typeof record.id !== "string" ||
    !CARD_KINDS.includes(record.kind as CardKind) ||
    !CARD_STATES.includes(record.state as CardState) ||
    !VERIFY_STATES.includes(record.verify as VerifyState) ||
    typeof record.title !== "string" ||
    !Array.isArray(record.citations) ||
    typeof record.trigger !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string" ||
    !claim
  ) {
    return null;
  }

  return {
    id: record.id,
    kind: record.kind as CardKind,
    state: record.state as CardState,
    verify: record.verify as VerifyState,
    title: record.title,
    claim,
    citations: record.citations as Citation[],
    trigger: record.trigger,
    provenance: (record.provenance ?? { source: "human", ref: "unknown", at: record.createdAt }) as Card["provenance"],
    tags: Array.isArray(record.tags) ? (record.tags as string[]) : [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    // Optional fields are OMITTED when absent, not set to undefined — a parsed card must
    // deep-equal the card that was serialized, and serialization skips absent keys.
    ...(typeof record.supersedes === "string" ? { supersedes: record.supersedes } : {}),
    ...(typeof record.supersededBy === "string" ? { supersededBy: record.supersededBy } : {}),
    ...(typeof record.reviewedBy === "string" ? { reviewedBy: record.reviewedBy } : {}),
    ...(typeof record.reviewNote === "string" ? { reviewNote: record.reviewNote } : {}),
  };
}
