// The agent-facing surface — three MCP tools, and the only path by which a card reaches a
// working agent on demand.
//
// The BRIEF (brief.ts) is the passive tier: every session gets the same ≤200 lines whether or not
// they matter to the task. This file is the tier DIRECTION.md calls trigger-scoped recall — the
// one that fires when an agent touches a cited file — plus the agent's own inlet for filing what
// it just learned. Without it the loop is half-open: cards can be mined, proposed and approved,
// but nothing puts the right one in front of the agent at the moment it would change what it does.
//
// Four rules run through every branch here.
//
//   Nothing throws. A tool that throws surfaces as a broken tool call in someone's session, and a
//   memory system that breaks the session it was meant to help is worse than one nobody installed.
//   Every failure — a bad path, a missing store, an unknown verb — is a sentence.
//
//   Stale cards are never served, and the withholding is never silent. A silently shrinking answer
//   is indistinguishable from an empty store, so the count rides in a trailing line while the
//   card's content does not reach the agent at all.
//
//   The trust reading is computed at serve time, not read off the card. Between verification
//   sweeps a cited function can be deleted; what an agent is told must be true now.
//
//   Every served card writes a counted receipt. The Receipts surface replays events and shows
//   nothing else — a recall that served knowledge without recording it would make the product's
//   only honest number smaller than the truth.
//
// Everything routes through operations.ts for mutations and the store's reads for queries, exactly
// as the CLI and the app's IPC handlers do: three surfaces that each assembled "propose a card"
// themselves would eventually assemble it differently.

import { statSync } from "node:fs";

import { CARD_KINDS, CARD_STATES, cardId } from "./card.js";
import { ingestProposals, storeFor } from "./operations.js";
import { recallCards } from "./recall.js";
import { appendReceipt } from "./receipts.js";
import { getCard, listCards } from "./store.js";
import { auditCard } from "./verify.js";
import { isCodeCitation } from "./types.js";
import type { Card, CardKind, CardProposal, CardState, Citation, VerifyState } from "./types.js";

export interface LibrarianToolDeps {
  /** Store root override — tests point it at a scratch dir so the real ~/.kage is never touched. */
  storeRoot?: string;
  /** The clock, for receipt timestamps and provenance. Tests pin it. */
  now?: () => Date;
}

/** The MCP content envelope. One text block: agents read prose, not our internal shapes. */
type ToolResult = { content: Array<{ type: "text"; text: string }> };

// A recall injection is a budget spend; five is the ceiling recall.ts already defaults to.
const DEFAULT_SERVE_LIMIT = 5;
const MAX_SERVE_LIMIT = 10;
/**
 * Extra candidates pulled from the matcher so that a card which went stale since the last sweep
 * costs a slot rather than an answer: without headroom, one dead card would silently shrink a
 * five-card recall to four while a perfectly good sixth card sat unserved.
 */
const STALE_HEADROOM = 3;

const MAX_LIST_LIMIT = 50;
const DEFAULT_LIST_LIMIT = 20;

// ── The tool definitions ─────────────────────────────────────────────────────────────────────
//
// Descriptions are written for the agent that must decide whether to call, not for a docs page.
// Each says what comes back and when calling is the right move — a tool an agent never reaches
// for is indistinguishable from a tool that does not exist.

export const LIBRARIAN_TOOL_DEFINITIONS: Array<{ name: string; description: string; inputSchema: object }> = [
  {
    name: "kage_recall",
    description:
      "What this team already learned about the code you are about to touch. Pass the files you are editing and the task in your own words; you get back approved, cited cards — decisions, verified procedures, and past failures — each stamped with its trust state as of right now. Call it before the first edit, not after the second bug. Cards whose cited code no longer exists are withheld and counted, never quietly dropped.",
    inputSchema: {
      type: "object",
      properties: {
        project_dir: { type: "string", description: "Absolute path to the project root" },
        query: {
          type: "string",
          description: "The task in your own words — matched against each card's trigger, title, and claim",
        },
        files: {
          type: "array",
          items: { type: "string" },
          description:
            "Repo-relative paths this action touches. The strongest signal there is: a cited path is ground truth, trigger prose is only the author's guess.",
        },
        limit: {
          type: "number",
          description: `Max cards to serve (default ${DEFAULT_SERVE_LIMIT}, capped at ${MAX_SERVE_LIMIT} — an injection is a budget spend)`,
        },
      },
      required: ["project_dir"],
    },
  },
  {
    name: "kage_remember",
    description:
      "File what you just learned as a card: a decision and why, a procedure you verified, or a failure and its cause. It enters a human review queue — it is not team knowledge until someone approves it. Every card must cite the code or commit it is about; a claim nothing can falsify is refused with the reasons named, so you can fix it and send it again.",
    inputSchema: {
      type: "object",
      properties: {
        project_dir: { type: "string", description: "Absolute path to the project root" },
        kind: {
          type: "string",
          enum: [...CARD_KINDS],
          description:
            "decision (what we chose and why), runbook (a verified procedure), or caution (a failure, its cause, its fix)",
        },
        title: { type: "string", description: "One line naming the claim, not the topic" },
        claim: {
          type: "string",
          description: "The claim itself, at most 160 words. A card is a claim, not a document.",
        },
        citations: {
          type: "array",
          description:
            'At least one, always. Either {path, symbol?} into this repo (repo-relative) or {ref} holding "commit:<sha>", "pr:<number>", or a URL. A card that cites nothing cannot exist.',
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "Repo-relative file path" },
              symbol: { type: "string", description: "Optional function or constant name inside that file" },
              ref: { type: "string", description: '"commit:<sha>", "pr:<number>", or a URL' },
            },
          },
        },
        trigger: {
          type: "string",
          description: "When a future agent should be told this, in prose — e.g. 'editing the tenant limit check'",
        },
        tags: { type: "array", items: { type: "string" }, description: "Optional free-form tags" },
        session_id: { type: "string", description: "Your session id, recorded as the provenance of the claim" },
      },
      required: ["project_dir", "kind", "title", "claim", "citations", "trigger"],
    },
  },
  {
    name: "kage_cards",
    description:
      "What this team already believes, as a list. Use it to orient in an unfamiliar repo, or to check whether a claim is already on record before filing a new one with kage_remember. For the cards that matter to a specific action, with live trust state, use kage_recall instead.",
    inputSchema: {
      type: "object",
      properties: {
        project_dir: { type: "string", description: "Absolute path to the project root" },
        state: {
          type: "string",
          enum: [...CARD_STATES],
          description: "Default approved — the only state that is team knowledge",
        },
        kind: { type: "string", enum: [...CARD_KINDS], description: "Narrow to one kind" },
        limit: { type: "number", description: `Max cards to list (default ${DEFAULT_LIST_LIMIT})` },
      },
      required: ["project_dir"],
    },
  },
];

// ── Argument handling ────────────────────────────────────────────────────────────────────────

function say(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A list of strings from whatever the agent sent. A comma-separated string is accepted where the
 * schema asks for an array because models routinely send one: reading "a.ts,b.ts" as a single
 * path would match nothing, and "nothing" reads to the agent as "this repo has no memory".
 */
function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function boundedInt(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(str(value));
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function nowOf(deps: LibrarianToolDeps): Date {
  return (deps.now ?? (() => new Date()))();
}

/**
 * The project directory, or a sentence saying why not.
 *
 * Checked before anything else because storeFor CREATES a store: an empty project_dir would
 * resolve to the process's cwd and leave a git-initialized store behind for a repo nobody asked
 * about — memory attributed to the wrong project is worse than no memory.
 */
function projectDirOf(args: Record<string, unknown>, tool: string): { dir: string } | { problem: string } {
  const dir = str(args.project_dir);
  if (!dir) {
    return { problem: `${tool} needs project_dir — the absolute path of the repo you are working in. Nothing was read.` };
  }
  let isDirectory = false;
  try {
    isDirectory = statSync(dir).isDirectory();
  } catch {
    isDirectory = false; // Missing is an answer, not an exception.
  }
  if (!isDirectory) {
    return { problem: `${tool} could not read '${dir}' — it is not a directory on this machine. Nothing was read.` };
  }
  return { dir };
}

/**
 * Citations as the agent sent them. Objects are taken at their word — {path, symbol?} or {ref} —
 * and the deterministic gate judges them. Bare strings are accepted too and split by shape,
 * because agents routinely send ["src/limits.ts"] where the schema asks for objects, and refusing
 * that on a technicality would cost a round trip that teaches nothing about the actual claim.
 * Anything unreadable is dropped and shows up as the gate's "cites nothing", which is the
 * accurate report: a citation nobody can resolve is not a citation.
 */
function parseCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  const citations: Citation[] = [];
  for (const raw of value) {
    if (typeof raw === "string") {
      const item = raw.trim();
      if (!item) continue;
      citations.push(/^(?:commit:|pr:|https?:\/\/)/.test(item) ? { ref: item } : { path: item });
      continue;
    }
    if (raw === null || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const path = str(record.path);
    if (path) {
      const symbol = str(record.symbol);
      citations.push({ path, ...(symbol ? { symbol } : {}) });
      continue;
    }
    const ref = str(record.ref);
    if (ref) citations.push({ ref });
  }
  return citations;
}

// ── Rendering ────────────────────────────────────────────────────────────────────────────────

function citationText(citation: Citation): string {
  if (!isCodeCitation(citation)) return citation.ref;
  return citation.symbol ? `${citation.path}#${citation.symbol}` : citation.path;
}

/**
 * The live reading, computed here rather than read off the card.
 *
 * A card can go stale between verification sweeps: someone deletes the cited function at 10:04 and
 * an agent asks at 10:05. The whole promise is that what an agent is served is true at the moment
 * it is served, and auditing a handful of cards is deterministic and cheap. The fresh reading is
 * deliberately NOT written back — a read path that commits to the store would turn every agent
 * question into a mutation, and verifySweep already owns that job.
 */
function liveVerify(projectDir: string, card: Card): VerifyState {
  try {
    return auditCard(projectDir, card).verify;
  } catch {
    // The auditor touches the filesystem and git. When it cannot answer, the last written reading
    // is what we honestly know — and it is never upgraded to "verified" by a failure to check.
    return card.verify;
  }
}

/**
 * The trust stamp, inline on the card. "verified against a1b2c3" is the sentence that makes the
 * claim actionable: it names the exact bytes the claim was checked against, so an agent can tell
 * a fact from a lead. Stale never reaches this function — stale cards are not served at all.
 */
function trustStamp(card: Card, live: VerifyState): string {
  if (live === "verified") {
    const pin = card.citations.find(isCodeCitation)?.blobSha;
    // No pin means the citations are refs (a commit, a PR, a URL) — there is nothing local to
    // hold the claim to. Saying so beats printing a sha we do not have.
    return pin ? `verified against ${pin.slice(0, 7)}` : "verified — cites history, nothing local to pin against";
  }
  return "unverified — the cited file changed since this was checked; treat the claim as a lead, not a fact";
}

/** One card as an agent can act on it: what it says, what it cites, how far to trust it, why it came. */
function renderServed(card: Card, live: VerifyState, why: string): string {
  const lines = [
    `[${card.kind}] ${card.title}  (${card.id})`,
    `  ${card.claim.trim().replace(/\s+/g, " ")}`,
    `  cites: ${card.citations.map(citationText).join(", ")}`,
    `  trust: ${trustStamp(card, live)}`,
  ];
  // The why is the honest justification for spending the agent's context on this card. It is
  // omitted rather than faked when the matcher had nothing quotable to say.
  if (why) lines.push(`  why:   ${why}`);
  return lines.join("\n");
}

/**
 * The withholding line. It carries the COUNT and the reason and nothing else — naming the card
 * would put the stale claim's content in front of the agent by the back door, which is the exact
 * thing being prevented.
 */
function withheldLine(count: number): string {
  return (
    `Withheld ${plural(count, "stale card")}: a cited file or symbol is gone, so the claim is about code that no longer exists. ` +
    "Nothing from them was served. Re-check with `kage cards verify`."
  );
}

/** Compact listing line, id first — the id is what every other verb takes as its argument. */
function listLine(card: Card): string {
  // Trust is shown only once a human has approved the card: on a proposed card the field reads
  // "unverified" because nothing has checked it yet, and that word beside an unreviewed claim
  // would look like a verdict on the claim itself.
  const trust = card.state === "proposed" ? "" : `  ${card.verify.padEnd(10)}`;
  return `  ${card.id}  ${card.kind.padEnd(8)}${trust}  ${card.title}`;
}

// ── kage_recall ──────────────────────────────────────────────────────────────────────────────

function handleRecall(args: Record<string, unknown>, deps: LibrarianToolDeps): ToolResult {
  const resolved = projectDirOf(args, "kage_recall");
  if ("problem" in resolved) return say(resolved.problem);

  const query = str(args.query);
  const files = stringList(args.files);
  if (!query && files.length === 0) {
    // Recall answers what THIS action needs. With no action described there is no honest answer,
    // and dumping the store is the "show me everything" this tier exists to refuse.
    return say(
      "kage_recall needs a query or files — it answers what the action you are about to take needs, " +
        "so with no action described there is no honest answer. Use kage_cards for a plain listing.",
    );
  }

  const limit = boundedInt(args.limit, DEFAULT_SERVE_LIMIT, MAX_SERVE_LIMIT);
  const store = storeFor(resolved.dir, deps.storeRoot);
  // Only approved cards are eligible knowledge. recallCards enforces this too, but asking the
  // store for the approved set keeps this surface honest about what it is searching.
  const matched = recallCards(listCards(store, { state: "approved" }), {
    ...(query ? { text: query } : {}),
    ...(files.length > 0 ? { files } : {}),
    limit: limit + STALE_HEADROOM,
  });

  const served: Array<{ card: Card; live: VerifyState; why: string }> = [];
  const withheld: Card[] = matched.withheld.map((entry) => entry.card);
  for (const entry of matched.served) {
    if (served.length >= limit) break; // The headroom is for replacing stale cards, not for exceeding the budget.
    const live = liveVerify(resolved.dir, entry.card);
    if (live === "stale") {
      withheld.push(entry.card);
      continue;
    }
    served.push({ card: entry.card, live, why: entry.why });
  }

  // Receipts are written for what an AGENT was actually served — this is the tool agents call, so
  // unlike the CLI's dry run it counts. Both sides of the ledger are recorded: knowledge served,
  // and knowledge correctly refused.
  const at = nowOf(deps).toISOString();
  for (const entry of served) {
    appendReceipt(store.dir, { type: "recall_served", at, cardId: entry.card.id });
  }
  for (const card of withheld) {
    appendReceipt(store.dir, { type: "stale_withheld", at, cardId: card.id });
  }

  const lines: string[] = [];
  if (served.length === 0) {
    // A plain sentence. Not an apology, and never an invented suggestion — a fabricated "you
    // might also look at…" is the failure mode that teaches agents to distrust the whole tool.
    lines.push("No approved card covers this action.");
  } else {
    lines.push(
      `Kage — ${plural(served.length, "approved card")} for this action, each approved by a human and stamped with its trust state as of now.`,
    );
    for (const entry of served) {
      lines.push("");
      lines.push(renderServed(entry.card, entry.live, entry.why));
    }
  }
  if (withheld.length > 0) {
    lines.push("");
    lines.push(withheldLine(withheld.length));
  }
  return say(lines.join("\n"));
}

// ── kage_remember ────────────────────────────────────────────────────────────────────────────

function handleRemember(args: Record<string, unknown>, deps: LibrarianToolDeps): ToolResult {
  const resolved = projectDirOf(args, "kage_remember");
  if ("problem" in resolved) return say(resolved.problem);

  const proposal: CardProposal = {
    // Cast, not check: the gate owns validity. An unknown kind must come back to the agent as a
    // named problem it can correct, never as a value this surface quietly repaired.
    kind: str(args.kind).toLowerCase() as CardKind,
    title: str(args.title),
    claim: str(args.claim),
    citations: parseCitations(args.citations),
    trigger: str(args.trigger),
    tags: stringList(args.tags),
  };

  const store = storeFor(resolved.dir, deps.storeRoot);
  const at = nowOf(deps).toISOString();
  const summary = ingestProposals(store, [proposal], {
    source: "session",
    // The agent's own claim about which session it is. "agent" when it does not say — honest and
    // unattributed beats a fabricated id in a provenance chain that exists to be audited.
    ref: str(args.session_id) || "agent",
    at,
  });

  if (summary.rejected > 0) {
    // Verbatim, every one. The gate's reasons are the only feedback an agent gets about what it
    // should stop proposing; paraphrasing them into "invalid card" would make the next attempt a
    // guess, and the attempt after that the same guess.
    return say(
      [
        "Refused by the gate. Nothing was written.",
        ...summary.problems.map((problem) => `  - ${problem}`),
        "The gate is deterministic: fix exactly what it named and send it again.",
      ].join("\n"),
    );
  }

  // Content-addressed, so the id is derivable from what was sent — no need to thread it back out
  // of the ingest summary, and it resolves the same for the admitted and the deduped case.
  const id = cardId(proposal);
  if (summary.deduped > 0) {
    const existing = getCard(store, id);
    return say(
      [
        `Already known — ${id} holds this exact claim${existing ? ` (${existing.state})` : ""}. Nothing was written.`,
        `  [${proposal.kind}] ${proposal.title}`,
      ].join("\n"),
    );
  }

  return say(
    [
      `Proposed ${id}. It is in the review queue.`,
      `  [${proposal.kind}] ${proposal.title}`,
      // Said plainly so the agent does not report to its user that the team now knows this.
      "A human approves cards; until then it is served to nobody and appears in no brief.",
    ].join("\n"),
  );
}

// ── kage_cards ───────────────────────────────────────────────────────────────────────────────

function handleCards(args: Record<string, unknown>, deps: LibrarianToolDeps): ToolResult {
  const resolved = projectDirOf(args, "kage_cards");
  if ("problem" in resolved) return say(resolved.problem);

  const state = str(args.state).toLowerCase();
  const kind = str(args.kind).toLowerCase();
  // An unrecognized filter would list nothing, and "nothing" reads as "this repo has no such
  // cards" rather than "you asked for a state that does not exist".
  if (state && !CARD_STATES.includes(state as CardState)) {
    return say(`kage_cards does not know the state '${state}'. One of: ${CARD_STATES.join(", ")}.`);
  }
  if (kind && !CARD_KINDS.includes(kind as CardKind)) {
    return say(`kage_cards does not know the kind '${kind}'. One of: ${CARD_KINDS.join(", ")}.`);
  }

  // Default approved: "what the team already believes" is the approved set. A proposed card is a
  // suggestion nobody has agreed to, and listing it beside approved knowledge would present the
  // two as the same thing.
  const effective = (state || "approved") as CardState;
  const store = storeFor(resolved.dir, deps.storeRoot);
  const cards = listCards(store, { state: effective, ...(kind ? { kind: kind as CardKind } : {}) });
  const limit = boundedInt(args.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);

  if (cards.length === 0) {
    const scope = kind ? `${kind} ` : "";
    return say(
      effective === "approved" && !kind
        ? "This repo has no approved cards yet. Nothing is being withheld — the store is empty. `kage cards mine` proposes cards from the repo's own history."
        : `No ${effective} ${scope}cards in this repo.`,
    );
  }

  const shown = cards.slice(0, limit);
  const header =
    shown.length < cards.length
      ? `${plural(cards.length, `${effective} ${kind ? `${kind} ` : ""}card`)}, showing ${shown.length}:`
      : `${plural(cards.length, `${effective} ${kind ? `${kind} ` : ""}card`)}:`;

  const lines = [header, ...shown.map(listLine)];
  if (effective === "approved") {
    const waiting = listCards(store, { state: "proposed" }).length;
    // Only when there are some. A "0 waiting" line would claim a measurement of an empty queue
    // as if it were news; absent is the honest rendering of nothing.
    if (waiting > 0) {
      lines.push("");
      lines.push(`${plural(waiting, "card")} proposed and waiting on a human — not yet served to anyone.`);
    }
  }
  lines.push("");
  lines.push("Use kage_recall with the files you are about to touch to get the cards that matter, with live trust state.");
  return say(lines.join("\n"));
}

// ── The dispatcher ───────────────────────────────────────────────────────────────────────────

/**
 * One entry point, one promise: this returns a sentence no matter what happens.
 *
 * Every handler is synchronous today; the async signature is the contract with mcp/index.ts's
 * callTool, and keeping it means adding an awaited step later is not a breaking change at the
 * only place these tools are wired in.
 */
export async function callLibrarianTool(
  name: string,
  args: Record<string, unknown>,
  deps: LibrarianToolDeps = {},
): Promise<ToolResult> {
  const input = args ?? {};
  try {
    if (name === "kage_recall") return handleRecall(input, deps);
    if (name === "kage_remember") return handleRemember(input, deps);
    if (name === "kage_cards") return handleCards(input, deps);
    // An unknown verb is a sentence naming the real ones, not a throw: the agent that guessed a
    // name can correct itself from this reply, and a thrown error would just end the tool call.
    return say(
      `${name.slice(0, 60)} is not one of the Kage card tools. There are three: ` +
        `${LIBRARIAN_TOOL_DEFINITIONS.map((tool) => tool.name).join(", ")}.`,
    );
  } catch (error) {
    // The last line of defence. Anything the handlers did not anticipate — an unreadable store, a
    // git binary that vanished, a corrupt card file — becomes a report about the memory system,
    // never a broken tool call in the middle of someone's work.
    const detail = error instanceof Error ? error.message : String(error);
    return say(
      `Kage could not complete ${name.slice(0, 60)}: ${detail}. Nothing was written. ` +
        "This is a memory tool; carry on without it rather than working around it.",
    );
  }
}
