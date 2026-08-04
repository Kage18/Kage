// The two session prompts, kept as prose in their own file — they ARE the judgment.
//
// Everything else in this tree is deterministic: the gate, the reconciler, recall, the brief.
// The only place the product exercises taste is in what it asks the model, so that text lives
// apart from the pipeline that spends it, where it can be read, diffed, and argued with as
// writing. The named risk (DIRECTION.md) is precision: one junk week and the user mutes the
// Inbox forever. So both prompts are written to make refusal easy and cheap — the triage prompt
// says outright that NO is the expected answer, and the extract prompt states the rules the gate
// will enforce anyway, because a model told the rules up front wastes fewer of the user's own
// subscription tokens on proposals that were never admissible.

/**
 * Pass one, cheapest tier: is there anything durable here at all? The three categories are
 * stated positively and the disqualifiers negatively, because "summarize this session" is what
 * a model does by default and it is exactly wrong — a session summary is a diary, and a diary
 * of what the code already says is the noise this product exists to not produce.
 */
export function triagePrompt(digest: string): string {
  return [
    "You are the Librarian for this repository. One coding session just ended. Decide whether it",
    "left behind anything worth keeping as durable team knowledge.",
    "",
    "Durable knowledge is exactly one of three things:",
    "- a decision and the WHY behind it: what was chosen, what was rejected, and the reason.",
    "- a procedure that was actually run and verified to work.",
    "- a failure and its cause: what broke, why it broke, and what that cost.",
    "",
    "NOT durable:",
    "- anything an agent could derive by reading the code as it stands today. The code is already",
    "  there to read; a card restating it is noise that costs a human a review.",
    "- a narration of what the session did. That is a diary, not knowledge.",
    "- plans, intentions, and anything not yet confirmed to be true.",
    "",
    "Most sessions contain nothing durable. NO is the expected answer, and answering NO is doing",
    "this job well — not failing at it.",
    "",
    "Reply with ONE line, in exactly one of these two forms, and nothing else:",
    "YES: <the durable thing that is here>",
    "NO: <why there is nothing durable here>",
    "",
    "SESSION DIGEST",
    digest,
  ].join("\n");
}

/**
 * Pass two, working tier: write the durable thing down, cited. The citation rule is the one that
 * carries the whole trust story — a claim that names nothing falsifiable is trivia — so it is
 * stated twice over: cite evidence, and cite only evidence that LITERALLY APPEARS in the digest.
 * A model asked for citations without that second half invents plausible paths, and an invented
 * path fails verification days later as a mystery rather than here as a refusal.
 */
export function extractPrompt(digest: string, existingTitles: string[]): string {
  const existing = existingTitles.length
    ? existingTitles.map((title) => `- ${title}`).join("\n")
    : "(none yet)";
  return [
    "You are the Librarian for this repository. Triage found something durable in the session",
    "below. Write it down as cards.",
    "",
    "A card's kind is one of:",
    "- decision: what the team chose, and WHY.",
    "- runbook: a procedure that was actually run in this session and verified to work.",
    "- caution: something that broke or was undone, and what caused it.",
    "",
    "Rules:",
    "- At most 3 cards. Fewer is normal — one true card beats three padded ones, and there is no",
    "  credit for filling the quota.",
    "- Each claim is at most 120 words. A card is a claim, not a document.",
    '- Every card MUST cite its evidence: {"path":"<repo-relative path>","symbol":"<optional>"} or',
    '  {"ref":"commit:<sha>"}. Cite ONLY paths and shas that literally appear in the digest below.',
    "  Do not reconstruct, guess, or complete a path from memory. A card that cites nothing is discarded.",
    "- Skip anything an agent could derive by reading the code today.",
    "- trigger is prose describing when a future agent should be shown this: the files, the task,",
    "  the situation. It is how the card gets recalled at all.",
    "- Do not re-propose these existing card titles:",
    existing,
    "",
    "Reply with the JSON array alone — no prose, no code fences, no explanation. Each element:",
    '{"kind":"decision"|"runbook"|"caution","title":"...","claim":"...","citations":[{"path":"src/x.ts","symbol":"fn"}],"trigger":"when an agent should recall this","tags":["optional"]}',
    "",
    "SESSION DIGEST",
    digest,
  ].join("\n");
}
