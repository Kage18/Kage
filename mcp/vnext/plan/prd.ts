// The plan engine's drafting pass: turning a grounded work item into a PRD a human can read.
//
// The deterministic core already does the part that must never be guessed — recall what the
// team knows, cluster by repository structure, size by blast radius. It produces items that are
// CORRECT and terse. This adds the part a model is genuinely better at: acceptance criteria and
// a statement of what "done" means, in prose.
//
// The ordering is the whole design. Grounding first, prose second, and prose can only ever
// DESCRIBE what grounding already established:
//
//   Every path in the draft must already be in the item's blast set. A model that invents a
//   file has invented work, and a plan that cites a file nobody chose is how an agent ends up
//   editing something no one agreed to touch.
//
//   A refusal is a RESULT, not an error. No credentials, no model, a malformed reply — the
//   deterministic item stands exactly as it was and says the draft is absent. A plan is useful
//   without prose; a plan with invented prose is worse than useless.

import type { ModelExtractionProvider } from "../compiler/model-provider.js";

export interface PrdDraft {
  /** One sentence: what becomes true when this lands. */
  outcome: string;
  /** Checkable statements. Each must be verifiable against the repository, not an aspiration. */
  acceptance: string[];
  /** Paths the draft references — always a SUBSET of the item's blast set. */
  cited_paths: string[];
}

export interface PrdDraftResult {
  ok: boolean;
  draft: PrdDraft | null;
  /** Present when there is no draft. Names the cause so an operator can act on it. */
  reason?: string;
  /** Paths the model proposed that were NOT in the blast set, dropped and reported. */
  rejected_paths: string[];
}

export interface DraftPrdInput {
  title: string;
  intent: string;
  /** The item's grounded blast set. The draft may cite these and nothing else. */
  blast_paths: string[];
  /** What the team already knows, from the same recall the brief uses. */
  bearing_memory: ReadonlyArray<{ title: string; summary?: string }>;
}

/**
 * The prompt. Deliberately carries titles and paths, never file CONTENTS: a planning draft does
 * not need the source, and sending it would put repository code through the loopback for a
 * paragraph of prose.
 */
export function buildPrdPrompt(input: DraftPrdInput): string {
  const knowledge = input.bearing_memory.length
    ? input.bearing_memory.slice(0, 6).map((entry) => `- ${entry.title}`).join("\n")
    : "- (nothing recorded yet)";
  return [
    `Work item: ${input.title}`,
    `Intent: ${input.intent}`,
    "",
    "Files this work is grounded to (you may reference ONLY these):",
    ...input.blast_paths.map((path) => `- ${path}`),
    "",
    "What the team already knows about this code:",
    knowledge,
    "",
    "Reply with JSON only: {\"outcome\": string, \"acceptance\": string[], \"cited_paths\": string[]}",
    "`outcome` is one sentence describing what becomes true when this lands.",
    "`acceptance` are statements checkable against the repository — not aspirations.",
    "`cited_paths` must be a subset of the files listed above.",
  ].join("\n");
}

function parseDraft(text: string): PrdDraft | null {
  // A model reply is untrusted text. Find the JSON body rather than assuming the whole reply is
  // JSON — a preamble is common and is not a failure.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<PrdDraft>;
    const outcome = typeof parsed.outcome === "string" ? parsed.outcome.trim() : "";
    if (!outcome) return null;
    return {
      outcome,
      acceptance: Array.isArray(parsed.acceptance)
        ? parsed.acceptance.filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        : [],
      cited_paths: Array.isArray(parsed.cited_paths)
        ? parsed.cited_paths.filter((p): p is string => typeof p === "string")
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * Draft a PRD for one grounded work item.
 *
 * Never throws: the deterministic plan must survive every failure of the optional pass.
 */
export async function draftPrd(
  input: DraftPrdInput,
  provider: ModelExtractionProvider | null,
): Promise<PrdDraftResult> {
  if (!provider) {
    return { ok: false, draft: null, reason: "no model provider configured", rejected_paths: [] };
  }
  if (input.blast_paths.length === 0) {
    // With no grounding there is nothing to constrain the draft to, so every path it proposed
    // would be invented by definition.
    return { ok: false, draft: null, reason: "the item is not grounded to any file yet", rejected_paths: [] };
  }

  let text: string;
  try {
    const response = await provider.extract({
      repository_id: "plan",
      episode_id: `plan:${input.title}`,
      redacted_summary: buildPrdPrompt(input),
      allowed_event_ids: [],
      allowed_entity_kinds: ["feature"],
      max_candidates: 1,
    });
    text = typeof (response as { raw_text?: unknown }).raw_text === "string"
      ? String((response as { raw_text?: unknown }).raw_text)
      : JSON.stringify(response);
  } catch (error) {
    return {
      ok: false,
      draft: null,
      reason: error instanceof Error ? error.message : String(error),
      rejected_paths: [],
    };
  }

  const parsed = parseDraft(text);
  if (!parsed) {
    return { ok: false, draft: null, reason: "the model reply was not a usable draft", rejected_paths: [] };
  }

  // The grounding gate. A path the item is not grounded to is invented work, and it is dropped
  // and REPORTED rather than silently trimmed — a caller has to be able to see the model tried.
  const allowed = new Set(input.blast_paths);
  const rejected = parsed.cited_paths.filter((path) => !allowed.has(path));
  return {
    ok: true,
    draft: { ...parsed, cited_paths: parsed.cited_paths.filter((path) => allowed.has(path)) },
    rejected_paths: rejected,
  };
}
