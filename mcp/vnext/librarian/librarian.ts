// The session pipeline — two model passes, one deterministic gate, and a reconciler that never
// asks the model a third time.
//
// This is the module DIRECTION.md describes as "intelligence where judgment is needed,
// determinism where trust is needed". The model is asked exactly two questions — is anything
// here, and what is it — and every consequence of the answers is computed: what is admissible
// (validateProposal + the secret scan), what it collides with (content address, then title
// overlap), and what it cost (measured usage, or null). A reconcile pass that asked the model
// "is this the same as that?" would be unreplayable, so the reconciler is arithmetic instead —
// and it is exported, because miner.ts must answer "have we already got this?" the same way this
// file does or the Inbox fills with near-siblings from whichever path decided on its own.
//
// Two invariants hold this file to the ground:
//
//   Rejecting a session is success. Triage is expected to say NO to ~90% of sessions; a run
//   that proposes nothing is the normal outcome, not a failure to report anywhere.
//
//   Nothing here throws on a bad model day. The Librarian runs unattended from the daemon at
//   session end. Unparseable output degrades to an empty outcome — a session's knowledge lost
//   is recoverable (sessions recur, the miner exists); a crashed daemon is a dead product.

import { validateProposal, cardId, type CardProblem } from "./card.js";
import { extractPrompt, triagePrompt } from "./prompts.js";
import { scanForSecrets } from "./secretscan.js";
import type {
  Card,
  CardKind,
  CardProposal,
  Citation,
  LibrarianProvider,
  ProviderReply,
  ReconcileAction,
} from "./types.js";

export interface DistillInput {
  /** The ephemeral session digest. Raw transcripts are never stored; this string is not either. */
  digest: string;
  /**
   * Carried, deliberately NOT prompted: the caller stamps provenance {source:"session", ref} on
   * whatever survives review. A machine-local session id tells the model nothing and costs tokens.
   */
  sessionRef: string;
  /** What the store already holds — the reconciler's whole world. */
  existing: Card[];
}

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export interface DistillOutcome {
  triage: { worthIt: boolean; reason: string };
  /** Survivors of the deterministic gate, in the model's order, capped at three. */
  proposals: CardProposal[];
  /** actions[i] is the verdict for proposals[i]. Same length, always. */
  actions: ReconcileAction[];
  rejected: Array<{ proposal: CardProposal; problems: CardProblem[] }>;
  usage: TokenUsage;
}

/** DIRECTION.md's number. A session that "learned" four durable things learned one and padded. */
const PROPOSAL_CAP = 3;

/**
 * Above this title overlap, two cards are the same subject and the newer one is an UPDATE.
 * 0.6 is deliberately loose: an update lands in the same Inbox row a human reviews either way,
 * so the cost of merging two near-siblings is one glance, while the cost of missing the merge
 * is a store with two half-true cards about the same thing and no signal which is current.
 */
const NEAR_DUPLICATE_THRESHOLD = 0.6;

/**
 * Distill one session. Pass 1 triage (cheap tier) decides whether pass 2 (working tier) is worth
 * the user's own subscription tokens; most sessions end at pass 1, and that is the design.
 */
export async function distillSession(
  provider: LibrarianProvider,
  input: DistillInput,
): Promise<DistillOutcome> {
  const triageReply = await provider.complete({ prompt: triagePrompt(input.digest), tier: "triage" });
  let usage = addUsage(EMPTY_USAGE, triageReply);

  const triage = readTriage(triageReply.text);
  if (!triage.worthIt) {
    // The common case, and a cheap one: one small call, no extraction, nothing to review.
    return { triage, proposals: [], actions: [], rejected: [], usage };
  }

  const extractReply = await provider.complete({
    prompt: extractPrompt(input.digest, input.existing.map((card) => card.title)),
    tier: "extract",
  });
  usage = addUsage(usage, extractReply);

  const raw = recoverJsonArray(extractReply.text);
  if (raw === null) {
    // A working-tier reply we cannot read is a bad model day, not an exception. The triage
    // verdict still stands and the spend is still reported — the run is honest about having
    // cost something and produced nothing.
    return { triage, proposals: [], actions: [], rejected: [], usage };
  }

  const proposals: CardProposal[] = [];
  const actions: ReconcileAction[] = [];
  const rejected: DistillOutcome["rejected"] = [];

  // Extras are DROPPED, not queued for later: the cap exists to keep review cheap, and a
  // backlog of overflow proposals would smuggle the same volume in through the back door.
  for (const entry of raw.slice(0, PROPOSAL_CAP)) {
    const proposal = coerceProposal(entry);
    const problems = validateProposal(proposal);
    // Every field the model authored free-form is scanned — a key pasted into a trigger syncs
    // exactly as far as one in a claim. The refusal names the pattern so a human can see what
    // tripped without the card being shown to anyone.
    for (const name of scanForSecrets(`${proposal.title}\n${proposal.claim}\n${proposal.trigger}`)) {
      problems.push({ field: "claim", reason: `secret detected: ${name}` });
    }
    if (problems.length > 0) {
      rejected.push({ proposal, problems });
      continue;
    }
    proposals.push(proposal);
    actions.push(reconcileProposal(proposal, input.existing));
  }

  return { triage, proposals, actions, rejected, usage };
}

/**
 * Read the triage verdict. The prompt asks for "YES: <reason>" or "NO: <reason>", and anything
 * else is a reply we cannot read — which is treated as NO. That is the conservative reading on
 * purpose: pass 2 spends the user's working-tier tokens, ~90% of sessions have nothing in them,
 * and a session skipped is recoverable while a store filled with junk is not. The reason is kept
 * verbatim either way, so a run that stopped on garbled output can be told from one that stopped
 * on a real refusal.
 */
function readTriage(text: string): { worthIt: boolean; reason: string } {
  const trimmed = text.trim();
  const match = /^(yes|no)\b[\s:.,\-—]*([\s\S]*)$/i.exec(trimmed);
  if (!match) {
    return { worthIt: false, reason: `unreadable triage reply: ${firstLine(trimmed) || "(empty)"}` };
  }
  const reason = firstLine(match[2]) || (match[1].toLowerCase() === "yes" ? "no reason given" : "nothing durable");
  return { worthIt: match[1].toLowerCase() === "yes", reason };
}

function firstLine(text: string): string {
  return text.split("\n")[0].trim().slice(0, 300);
}

/**
 * The reconciler: deterministic, model-free, and total.
 *
 *   Same content address  → NOOP. The card id is a hash of kind+title+claim, so an identical
 *                           claim from a second session IS the existing card. Re-proposing it
 *                           would spend a human's review on a file that already exists.
 *   Same kind, same subject → UPDATE against the live card it echoes, so the two never sit in
 *                           the store as rival half-truths.
 *   Otherwise             → ADD.
 *
 * SUPERSEDE is in the vocabulary (types.ts) but is never chosen here: superseding is a claim
 * that the old knowledge is now WRONG, and that judgment belongs to the human at the gate, who
 * can see both cards. An update the reviewer decides is a replacement can still be approved as
 * one; a supersede the machine guessed cannot be un-guessed.
 *
 * EXPORTED because it is a law, not a helper. Session capture and history mining both produce
 * proposals against the same store, and the day the two paths answer "have we already got this?"
 * differently is the day the Inbox fills with near-siblings from whichever path forgot — which
 * is measurably what happened: mining ran without it and re-proposed ten cards as brand new.
 * One implementation, two callers, no second opinion.
 */
export function reconcileProposal(proposal: CardProposal, existing: readonly Card[]): ReconcileAction {
  const id = cardId(proposal);
  const duplicate = existing.find((card) => card.id === id);
  if (duplicate) return { action: "noop", reason: `duplicate of ${duplicate.id}` };

  // Only live knowledge can be echoed. A superseded or retired card was explicitly replaced or
  // withdrawn; folding a new proposal into it would resurrect a decision the team already made.
  const candidates = existing
    .filter((card) => card.kind === proposal.kind && (card.state === "approved" || card.state === "proposed"))
    .map((card) => ({ card, overlap: tokenJaccard(proposal.title, card.title) }))
    .filter((entry) => entry.overlap > NEAR_DUPLICATE_THRESHOLD)
    // Best overlap wins; the id breaks ties so the same store always reconciles the same way
    // regardless of the order the store handed the cards over in.
    .sort((a, b) => b.overlap - a.overlap || a.card.id.localeCompare(b.card.id));

  return candidates.length > 0 ? { action: "update", id: candidates[0].card.id } : { action: "add" };
}

/**
 * Title similarity as set overlap. Lowercased, split on non-alphanumerics, and tokens under
 * three characters dropped — "is", "a", "on", "the" are in every title and would drag every
 * pair toward each other, which is the one way a similarity threshold silently misfires.
 */
export function tokenJaccard(a: string, b: string): number {
  const left = tokenize(a);
  const right = tokenize(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared / (left.size + right.size - shared);
}

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const token of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (token.length >= 3) tokens.add(token);
  }
  return tokens;
}

/**
 * First "[" to last "]", parsed. Models wrap JSON in apologies and code fences, and prose around
 * the array is not an error — but a reply with no array in it, or one that will not parse, is
 * reported as null rather than as an empty array: "the model returned nothing" and "the model
 * returned something we could not read" are different facts, and only the caller can decide
 * whether either is worth a retry.
 */
export function recoverJsonArray(text: string): unknown[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Force whatever the model returned into a CardProposal SHAPE without judging it — judging is
 * validateProposal's job. Funnelling malformed entries through the same gate means every refusal
 * comes back as problems a human can read, never as a throw that loses the whole batch.
 * (miner.ts keeps its own copy of this on purpose: ten lines of local code beat a cross-module
 * dependency that exists only to share them.)
 */
function coerceProposal(raw: unknown): CardProposal {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const citations = Array.isArray(record.citations)
    ? (record.citations.filter((c) => c !== null && typeof c === "object") as Citation[])
    : [];
  const proposal: CardProposal = {
    kind: record.kind as CardKind, // validateProposal refuses anything outside the three kinds
    title: typeof record.title === "string" ? record.title : "",
    claim: typeof record.claim === "string" ? record.claim : "",
    citations,
    trigger: typeof record.trigger === "string" ? record.trigger : "",
  };
  if (Array.isArray(record.tags)) {
    proposal.tags = record.tags.filter((tag): tag is string => typeof tag === "string");
  }
  return proposal;
}

const EMPTY_USAGE: TokenUsage = { inputTokens: null, outputTokens: null, costUsd: null };

/**
 * Sum what was MEASURED. An unmeasured reply contributes nothing and erases nothing: two calls
 * where only one reported usage sum to that one, and two calls where neither did stay null.
 * Null is the honest reading of "not measured" and renders as a dash; a zero would render as a
 * measurement that says this run was free.
 */
function addUsage(total: TokenUsage, reply: ProviderReply): TokenUsage {
  return {
    inputTokens: addMeasured(total.inputTokens, reply.inputTokens),
    outputTokens: addMeasured(total.outputTokens, reply.outputTokens),
    costUsd: addMeasured(total.costUsd, reply.costUsd),
  };
}

function addMeasured(total: number | null, next: number | null): number | null {
  if (next === null) return total;
  return (total ?? 0) + next;
}
