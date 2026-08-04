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
// A card file is a conformant Open Knowledge Format concept document. OKF standardizes the
// container — markdown, YAML frontmatter, `type` the only required key — and explicitly scopes
// OUT freshness, verification and staleness. That excluded part is exactly what a card's trust
// state is, so the two compose instead of competing: OKF says what the concept is, `x-kage-*`
// says whether it is still true. OKF reserves producer-prefixed keys and requires consumers to
// ignore what they don't recognize, so a vanilla OKF reader sees a clean concept and none of
// the machinery.
//
// Values are still written as JSON, which the hand-rolled parser can read without a YAML
// dependency and which is legal YAML regardless: JSON is a subset of YAML 1.2.
//
// Keys are written in a FIXED order so identical cards produce identical bytes — the store
// commits every mutation, and nondeterministic key order would make every rewrite a spurious diff.

/** OKF display form of a card kind — the value of the standard's one required field. */
const OKF_TYPE: Record<CardKind, string> = {
  decision: "Decision",
  runbook: "Runbook",
  caution: "Caution",
};

/**
 * OKF `description` — the claim's first sentence, so a reader that knows nothing about Kage
 * still gets the point without opening the body. Derived on write and ignored on read; the
 * claim in the body is the only copy that is authoritative.
 */
export function okfDescription(claim: string): string {
  const first = claim.trim().split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  return first.length > 200 ? `${first.slice(0, 199).trimEnd()}…` : first;
}

export function serializeCard(card: Card): string {
  const lines: string[] = ["---"];
  const put = (key: string, value: unknown) => {
    if (value === undefined) return;
    lines.push(`${key}: ${JSON.stringify(value)}`);
  };

  // OKF core — what any OKF consumer reads.
  put("type", OKF_TYPE[card.kind]);
  put("title", card.title);
  put("description", okfDescription(card.claim));
  // OKF `resource` is "the source of truth to verify against", which is precisely what a code
  // citation is. Ref-only cards (a commit, a PR) leave it absent rather than inventing a path.
  put("resource", card.citations.find(isCodeCitation)?.path);
  if (card.tags.length) put("tags", card.tags);
  put("timestamp", card.updatedAt);

  // Kage's trust extension.
  put("x-kage-id", card.id);
  put("x-kage-kind", card.kind);
  put("x-kage-state", card.state);
  put("x-kage-verify", card.verify);
  put("x-kage-citations", card.citations);
  put("x-kage-trigger", card.trigger);
  put("x-kage-provenance", card.provenance);
  put("x-kage-created-at", card.createdAt);
  put("x-kage-supersedes", card.supersedes);
  put("x-kage-superseded-by", card.supersededBy);
  put("x-kage-reviewed-by", card.reviewedBy);
  put("x-kage-review-note", card.reviewNote);

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

  // Read the OKF key, fall back to the pre-OKF one. Stores written before the format became
  // conformant must keep loading: cards are the product, not a cache that can be rebuilt.
  const at = (okfKey: string, legacyKey: string) => record[okfKey] ?? record[legacyKey];

  const claim = match[2].trim();
  const id = at("x-kage-id", "id");
  const kind = at("x-kage-kind", "kind");
  const state = at("x-kage-state", "state");
  const verify = at("x-kage-verify", "verify");
  const citations = at("x-kage-citations", "citations");
  const trigger = at("x-kage-trigger", "trigger");
  const createdAt = at("x-kage-created-at", "createdAt");
  const updatedAt = at("timestamp", "updatedAt");
  const supersedes = at("x-kage-supersedes", "supersedes");
  const supersededBy = at("x-kage-superseded-by", "supersededBy");
  const reviewedBy = at("x-kage-reviewed-by", "reviewedBy");
  const reviewNote = at("x-kage-review-note", "reviewNote");

  if (
    typeof id !== "string" ||
    !CARD_KINDS.includes(kind as CardKind) ||
    !CARD_STATES.includes(state as CardState) ||
    !VERIFY_STATES.includes(verify as VerifyState) ||
    typeof record.title !== "string" ||
    !Array.isArray(citations) ||
    typeof trigger !== "string" ||
    typeof createdAt !== "string" ||
    typeof updatedAt !== "string" ||
    !claim
  ) {
    return null;
  }

  return {
    id,
    kind: kind as CardKind,
    state: state as CardState,
    verify: verify as VerifyState,
    title: record.title,
    claim,
    citations: citations as Citation[],
    trigger,
    provenance: (at("x-kage-provenance", "provenance") ?? {
      source: "human",
      ref: "unknown",
      at: createdAt,
    }) as Card["provenance"],
    tags: Array.isArray(record.tags) ? (record.tags as string[]) : [],
    createdAt,
    updatedAt,
    // Optional fields are OMITTED when absent, not set to undefined — a parsed card must
    // deep-equal the card that was serialized, and serialization skips absent keys.
    ...(typeof supersedes === "string" ? { supersedes } : {}),
    ...(typeof supersededBy === "string" ? { supersededBy } : {}),
    ...(typeof reviewedBy === "string" ? { reviewedBy } : {}),
    ...(typeof reviewNote === "string" ? { reviewNote } : {}),
  };
}
