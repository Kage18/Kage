// Trigger-scoped recall — the answer to "what does THIS action need", never "show me everything".
//
// Retrieval is the moment memory either pays for itself or poisons a session, so this module
// is pure and deterministic: cards in, query in, the same result every time, no I/O and no
// model. Intelligence already happened (the Librarian wrote the trigger and citations);
// judgment already happened (a human approved the card); what remains is matching, and
// matching that cannot be replayed cannot be trusted.
//
// The product's hardest rule lives here: an approved card whose verification is stale is
// WITHHELD, and the withholding is visible in the result — a bad memory is worse than none,
// and a silent omission is indistinguishable from ignorance. The caller writes the
// stale_withheld receipt; this function makes sure there is something honest to count.

import type { Card } from "./types.js";
import { isCodeCitation } from "./types.js";

export interface RecallQuery {
  /** Repo-relative paths the current action touches. */
  files?: string[];
  /** The task text — commit message, prompt, whatever names the action. */
  text?: string;
  limit?: number;
}

export interface RecallResult {
  served: Array<{ card: Card; score: number; why: string }>;
  withheld: Array<{ card: Card; reason: "stale" }>;
}

/** A recall injection is a budget spend; five cards is the default ceiling, not a target. */
const DEFAULT_LIMIT = 5;

/** Below four characters, "the", "fix", "and" match everything and mean nothing. */
const MIN_KEYWORD_LENGTH = 4;

/** Path citations are ground truth; trigger prose is the author's guess. The weights say so. */
const FILE_MATCH_SCORE = 3;
const TRIGGER_MATCH_SCORE = 1;
const TEXT_MATCH_SCORE = 0.5;

function extractKeywords(text: string | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  for (const word of text.toLowerCase().split(/[^a-z0-9_-]+/)) {
    if (word.length >= MIN_KEYWORD_LENGTH) seen.add(word);
  }
  return [...seen];
}

/**
 * Equal, or overlapping at a path-segment boundary in either direction: "limits.ts" reaches
 * "src/limits.ts", "src" reaches "src/limits.ts", and a deeper checkout prefix on the query
 * side still finds the repo-relative citation. Substring matches inside a segment do NOT
 * count — "imits.ts" is a typo, not a file.
 */
function pathsOverlap(a: string, b: string): boolean {
  return (
    a === b ||
    a.endsWith(`/${b}`) ||
    b.endsWith(`/${a}`) ||
    a.startsWith(`${b}/`) ||
    b.startsWith(`${a}/`)
  );
}

function scoreCard(
  card: Card,
  files: string[],
  keywords: string[],
): { score: number; why: string } {
  const citedPaths = card.citations.filter(isCodeCitation).map((c) => c.path);

  let score = 0;
  const matchedCitations = new Set<string>();
  for (const file of files) {
    const hit = citedPaths.find((path) => pathsOverlap(file, path));
    if (hit !== undefined) {
      score += FILE_MATCH_SCORE;
      matchedCitations.add(hit);
    }
  }

  const trigger = card.trigger.toLowerCase();
  const titleAndClaim = `${card.title}\n${card.claim}`.toLowerCase();
  const triggerHits: string[] = [];
  const textOnlyHits: string[] = [];
  for (const keyword of keywords) {
    const inTrigger = trigger.includes(keyword);
    if (inTrigger) {
      score += TRIGGER_MATCH_SCORE;
      triggerHits.push(keyword);
    }
    if (titleAndClaim.includes(keyword)) {
      score += TEXT_MATCH_SCORE;
      // A keyword already credited to the trigger still scores here, but naming it twice
      // in the why would read as double-counting to a human — list it once, where it
      // mattered most.
      if (!inTrigger) textOnlyHits.push(keyword);
    }
  }

  // The why is the receipt a human reads next to the injection: name what matched, in the
  // order of how much it is trusted.
  const parts: string[] = [];
  if (matchedCitations.size > 0) parts.push(`cites ${[...matchedCitations].join(", ")}`);
  if (triggerHits.length > 0) {
    parts.push(`trigger matched ${triggerHits.map((k) => `'${k}'`).join(", ")}`);
  }
  if (textOnlyHits.length > 0) {
    parts.push(`title/claim matched ${textOnlyHits.map((k) => `'${k}'`).join(", ")}`);
  }

  return { score, why: parts.join(", ") };
}

export function recallCards(cards: Card[], query: RecallQuery): RecallResult {
  const files = query.files ?? [];
  const keywords = extractKeywords(query.text);

  // An empty query serves nothing — and withholds nothing. Recall answers what THIS action
  // needs; with no action described, there is no honest answer, and dumping the store would
  // be the "show me everything" this module exists to refuse.
  if (files.length === 0 && keywords.length === 0) {
    return { served: [], withheld: [] };
  }

  const served: RecallResult["served"] = [];
  const withheld: RecallResult["withheld"] = [];

  for (const card of cards) {
    // Only approved knowledge is eligible, in any list. A proposed card hasn't passed the
    // gate; a superseded or retired card was explicitly replaced or withdrawn — surfacing
    // any of them, even as "withheld", would present non-knowledge as knowledge.
    if (card.state !== "approved") continue;

    const { score, why } = scoreCard(card, files, keywords);
    if (score <= 0) continue;

    // Withheld means: this action WOULD have been served this card, but a cited symbol or
    // file is gone, so serving it would be serving a claim about code that no longer
    // exists. It lands in the result — visible, counted — instead of vanishing. Stale
    // cards the query never asked for stay out: store-wide health is the Knowledge
    // surface's job, not this recall's.
    if (card.verify === "stale") {
      withheld.push({ card, reason: "stale" });
      continue;
    }

    served.push({ card, score, why });
  }

  // Deterministic order: score descending, id as the tiebreak so the same store always
  // renders the same list regardless of directory read order.
  served.sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));

  return { served: served.slice(0, query.limit ?? DEFAULT_LIMIT), withheld };
}
