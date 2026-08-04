// The day-one history miner — memory exists before the first session ends.
//
// A fresh install has no sessions to distill, but the repo has history, and reverts are gold:
// something was tried and undone, which is exactly a caution. The miner compresses git log into
// a readable digest (commits, reverts, hot files), asks the Librarian for cited cards in ONE
// extract-tier call — the user asked for mining explicitly, so there is nothing to triage —
// and runs every proposal through the same deterministic checks as session capture. Reviewing
// the batch doubles as an architecture tour (DIRECTION.md).

import { execFileSync } from "node:child_process";
import { validateProposal, type CardProblem } from "./card.js";
import { scanForSecrets } from "./secretscan.js";
import type { Card, CardKind, CardProposal, Citation, LibrarianProvider } from "./types.js";

export interface HistoryDigest {
  text: string;
  commits: number;
  reverts: number;
}

/** ~20k chars keeps the whole digest inside a comfortable prompt; commits absorb the trim. */
const DIGEST_CHAR_CAP = 20000;

const PROPOSAL_CAP = 10;

function gitLog(projectDir: string, args: string[]): string {
  return execFileSync("git", ["log", ...args], {
    cwd: projectDir,
    encoding: "utf8",
    // --name-only over 200 commits on a busy repo overflows the 1MB default.
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Compress the last `maxCommits` (default 200) commits into three sections the model can cite
 * from: COMMITS (sha|date|subject — the shas are the citation currency), REVERTS (pulled out
 * separately because they are the strongest caution signal), and HOT FILES (the 15 most-changed
 * paths, counted here in JS — no shell pipelines, so nothing to quote wrong).
 */
export function buildHistoryDigest(projectDir: string, opts?: { maxCommits?: number }): HistoryDigest {
  const maxCommits = opts?.maxCommits ?? 200;
  // --no-merges: a merge commit's subject is ceremony, not knowledge.
  const range = ["-n", String(maxCommits), "--no-merges", "--date=short"];

  const commitLines = gitLog(projectDir, [...range, "--pretty=format:%h|%ad|%s"])
    .split("\n")
    .filter(Boolean);
  // A revert is a commit whose SUBJECT is `Revert "..."` — the shape `git revert` writes.
  //
  // This was `--grep=Revert`, which searches the whole message and matched any commit that merely
  // DISCUSSED reverting. Caught by dogfooding: the commit introducing this module has a body
  // reading "Reverts are gold", so the miner reported it as reverted, and the Librarian duly
  // proposed a card warning that the Librarian had been rolled back. Filtering on the subject in
  // JS rather than asking git to grep is both correct and cheaper — the subjects are already here.
  const revertLines = commitLines.filter((line) => /^[^|]*\|[^|]*\|Revert[ "']/.test(line));

  // An empty pretty format leaves only file paths and blank separators — count the paths.
  const fileCounts = new Map<string, number>();
  for (const line of gitLog(projectDir, [...range, "--name-only", "--pretty=format:"]).split("\n")) {
    const path = line.trim();
    if (path) fileCounts.set(path, (fileCounts.get(path) ?? 0) + 1);
  }
  const hotFiles = [...fileCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

  const revertSection = [
    `REVERTS (${revertLines.length} — something was tried and undone)`,
    ...(revertLines.length ? revertLines : ["(none)"]),
  ].join("\n");
  const hotSection = [
    `HOT FILES (top ${hotFiles.length} by change count over the same range)`,
    ...(hotFiles.length ? hotFiles.map(([path, count]) => `${count}\t${path}`) : ["(none)"]),
  ].join("\n");

  // Reverts and hot files are small and always survive whole; commit lines fill what's left,
  // newest first, and a trim is announced with a count — elided, never silent.
  const commitHeader = `COMMITS (${commitLines.length} most recent, newest first)`;
  const budget = DIGEST_CHAR_CAP - commitHeader.length - revertSection.length - hotSection.length - 64;
  const kept: string[] = [];
  let used = 0;
  for (const line of commitLines) {
    if (used + line.length + 1 > budget) break;
    kept.push(line);
    used += line.length + 1;
  }
  if (kept.length < commitLines.length) {
    kept.push(`... [${commitLines.length - kept.length} older commits truncated] ...`);
  }

  return {
    text: [commitHeader, ...kept, "", revertSection, "", hotSection].join("\n"),
    commits: commitLines.length,
    reverts: revertLines.length,
  };
}

/**
 * The mining instruction. The constraints that matter are restated here even though the gate
 * enforces them deterministically — a model told the rules up front wastes fewer of the user's
 * own tokens on proposals the gate will refuse anyway.
 */
export function miningPrompt(digest: HistoryDigest, existingTitles: string[]): string {
  const existing = existingTitles.length
    ? existingTitles.map((title) => `- ${title}`).join("\n")
    : "(none yet)";
  return [
    "You are the Librarian mining this repository's history for durable team knowledge.",
    "",
    `From the digest below, propose up to ${PROPOSAL_CAP} cards. What qualifies:`,
    "- decision: what the team chose and WHY, when the history shows it and the code cannot.",
    "- caution: something tried and undone — the reverts and fix-loops below are the strongest signal.",
    "- runbook: ONLY when exact commands literally appear in the history.",
    "",
    "Rules:",
    "- Skip anything an agent could derive by reading the code today; cards hold what the code cannot say.",
    "- Each claim is at most 120 words.",
    '- Every card MUST cite its evidence: {"ref":"commit:<sha>"} using a sha that appears in the digest, or {"path":"<repo-relative path>"} for a hot file. A card that cites nothing will be discarded.',
    "- Do not re-propose these existing card titles:",
    existing,
    "",
    "Reply with the JSON array alone — no prose, no code fences. Each element:",
    '{"kind":"decision"|"runbook"|"caution","title":"...","claim":"...","citations":[{"ref":"commit:<sha>"}],"trigger":"when an agent should recall this","tags":["optional"]}',
    "",
    "HISTORY DIGEST",
    digest.text,
  ].join("\n");
}

/**
 * Mine the repo's history: ONE extract-tier call, then the deterministic half of the gate over
 * every proposal — validateProposal plus the secret scan — with refusals returned as data. The
 * human half (the Inbox) happens elsewhere; nothing here approves anything.
 */
export async function mineHistory(
  provider: LibrarianProvider,
  projectDir: string,
  existing: Card[],
  opts?: { maxCommits?: number },
): Promise<{
  proposals: CardProposal[];
  rejected: Array<{ proposal: CardProposal; problems: CardProblem[] }>;
  usage: { inputTokens: number | null; outputTokens: number | null; costUsd: number | null };
  digest: HistoryDigest;
}> {
  const digest = buildHistoryDigest(projectDir, opts);
  const reply = await provider.complete({
    prompt: miningPrompt(digest, existing.map((card) => card.title)),
    tier: "extract",
  });

  const proposals: CardProposal[] = [];
  const rejected: Array<{ proposal: CardProposal; problems: CardProblem[] }> = [];
  for (const raw of recoverJsonArray(reply.text).slice(0, PROPOSAL_CAP)) {
    const proposal = coerceProposal(raw);
    const problems = validateProposal(proposal);
    // The scan covers every field the model authored — a secret in a trigger syncs just as far.
    for (const name of scanForSecrets(`${proposal.title}\n${proposal.claim}\n${proposal.trigger}`)) {
      problems.push({ field: "claim", reason: `secret scan tripped: ${name}` });
    }
    if (problems.length) rejected.push({ proposal, problems });
    else proposals.push(proposal);
  }

  return {
    proposals,
    rejected,
    usage: { inputTokens: reply.inputTokens, outputTokens: reply.outputTokens, costUsd: reply.costUsd },
    digest,
  };
}

// Recovery and coercion live here, not in librarian.ts — the session pipeline is a sibling
// module being built alongside this one, and ten lines of local code beat a cross-module
// dependency that exists only to share them.

/** First "[" to last "]", parsed leniently: models wrap JSON in prose, and prose is not an error. */
function recoverJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Force whatever the model returned into a CardProposal SHAPE without judging it — judging is
 * validateProposal's job, and funnelling malformed entries through the same gate means every
 * refusal comes back as problems, never as a throw.
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
