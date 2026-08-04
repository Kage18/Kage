// The Librarian's contracts — the one file every module in this tree imports.
//
// The design (DIRECTION.md) in one line: intelligence where judgment is needed, determinism
// where trust is needed, a human where team knowledge is born. These types draw those three
// boundaries. Everything here runs on node builtins only — the desktop worker reaches this
// code, and the packaged app ships no node_modules (a lesson paid for twice).

/** Exactly three kinds. Anything finer is a tag — the old 15-type taxonomy became a gameable
 * admission exemption, with 54% of the legacy store typed "decision" to skip the gate. */
export type CardKind = "decision" | "runbook" | "caution";

/** The lifecycle. Supersede, never delete — provenance chains are the audit trail. */
export type CardState = "proposed" | "approved" | "superseded" | "retired";

/**
 * The live trust reading, separate from the lifecycle on purpose:
 *   verified    re-checked since the cited code last changed
 *   unverified  approved, but the cited code changed after the last check
 *   stale       a cited symbol or file is GONE — withheld from recall, counted, never silent
 */
export type VerifyState = "verified" | "unverified" | "stale";

/** A citation into the working tree. `blobSha` pins what the claim was written against. */
export interface CodeCitation {
  path: string;
  symbol?: string;
  /** git blob sha of the file at write/verify time — drift detection without line numbers. */
  blobSha?: string;
}

/** A citation into history: "commit:<sha>", "pr:<number>", or a URL. */
export interface RefCitation {
  ref: string;
}

export type Citation = CodeCitation | RefCitation;

export function isCodeCitation(c: Citation): c is CodeCitation {
  return typeof (c as CodeCitation).path === "string";
}

export interface Provenance {
  source: "session" | "mining" | "human";
  /** Session id, "history:<range>", or the human's name. */
  ref: string;
  at: string;
}

export interface Card {
  /** "card_" + 8 hex — content-addressed at proposal time. */
  id: string;
  kind: CardKind;
  state: CardState;
  verify: VerifyState;
  title: string;
  /** The claim body. ~120 words is the target the Librarian is prompted to; 160 is the hard cap. */
  claim: string;
  /** At least one, always. A card that cites nothing cannot exist. */
  citations: Citation[];
  /** When to recall it, in prose — matched against touched files and task text. */
  trigger: string;
  provenance: Provenance;
  tags: string[];
  supersedes?: string;
  supersededBy?: string;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewNote?: string;
}

/** What the Librarian proposes before the gate has seen it. */
export interface CardProposal {
  kind: CardKind;
  title: string;
  claim: string;
  citations: Citation[];
  trigger: string;
  tags?: string[];
}

/** The reconciler's verdict against similar existing cards. */
export type ReconcileAction =
  | { action: "add" }
  | { action: "update"; id: string }
  | { action: "supersede"; id: string }
  | { action: "noop"; reason: string };

/**
 * The LLM seam. Two implementations: the real one spawns the user's own agent headless
 * (`claude -p`), so Kage pays for zero inference; tests use a scripted fake. `tier` maps to
 * the cheapest model for triage and the working model for extraction.
 */
export interface LibrarianProvider {
  complete(input: { prompt: string; tier: "triage" | "extract" }): Promise<ProviderReply>;
}

export interface ProviderReply {
  text: string;
  /** Measured when the runner reports usage; null is honest and rendered as such. */
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

/** A counted event. Receipts are the only source any displayed number may have. */
export interface ReceiptEvent {
  type:
    | "card_proposed"
    | "card_approved"
    | "card_rejected"
    | "card_superseded"
    | "recall_served"
    | "stale_withheld"
    | "card_misleading"
    | "librarian_run"
    | "mining_run";
  at: string;
  cardId?: string;
  /** Session/agent reference when the event happened inside one. */
  sessionRef?: string;
  detail?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

/** Filters for listing cards. Absent field = no constraint. */
export interface CardFilter {
  state?: CardState;
  kind?: CardKind;
  verify?: VerifyState;
  /** Substring match on title + claim. */
  text?: string;
}
