// The Librarian's terminal surface — nine verbs behind ONE exported function, and not a
// single console.log.
//
// Two shapes here are deliberate. It returns {exitCode, out} instead of printing, so every
// line a human reads is a string a test can assert on and mcp/cli.ts keeps its one job:
// turning that pair into stdout and an exit status. And the whole surface is one dispatcher,
// so cli.ts — 3.7k lines, ~130 command branches — gains ONE branch rather than nine, with the
// flag parsing for cards living beside the cards.
//
// Everything routes through operations.ts and the store's reads. The desktop app's IPC
// handlers call those same verbs; two surfaces that assembled "approve" themselves would
// eventually assemble it differently (operations.ts, file top).
//
// The output rules are the product's rules. Stale cards withheld from recall are printed as
// their own section, because a silent omission is indistinguishable from ignorance. Token
// usage that was never measured prints as "not measured", never as 0 — the old product died
// of a fabricated headline number.

import { approve, mineRepository, refreshBrief, reject, storeFor, verifySweep } from "./operations.js";
import { claudeProvider } from "./provider.js";
import { recallCards } from "./recall.js";
import { readReceipts, receiptCounts } from "./receipts.js";
import { getCard, listCards } from "./store.js";
import { CARD_KINDS, CARD_STATES } from "./card.js";
import { isCodeCitation } from "./types.js";
import type { Card, CardKind, CardState, Citation, LibrarianProvider } from "./types.js";

export interface CardsCliDeps {
  /** The clock, for the relative ages this surface prints. Tests pin it. */
  now?: () => Date;
  /** The LLM seam. Absent means the real one: the user's own agent, headless. */
  provider?: LibrarianProvider;
  /** Store root override — tests point it at a scratch dir so the real ~/.kage is untouched. */
  storeRoot?: string;
}

export interface CardsCliResult {
  exitCode: number;
  out: string;
}

const USAGE = [
  "kage cards — the Librarian's cards: propose, review, recall.",
  "",
  "  kage cards list [--state <state>] [--kind <kind>] [--json]    what the store holds, grouped by state",
  "  kage cards show <id> [--json]                                 one card whole: claim, citations, trigger, provenance",
  "  kage cards approve <id> [--note <text>]                       make it team knowledge (re-pins, verifies, refreshes the BRIEF)",
  "  kage cards reject <id> --reason <text>                        retire it with the reason on record",
  "  kage cards mine [--max-commits <n>] [--json]                  propose cards from this repo's own history",
  "  kage cards verify [--json]                                    re-check every approved card against the tree as it stands",
  "  kage cards brief [--json]                                     regenerate the fenced block in AGENTS.md/CLAUDE.md",
  '  kage cards recall "<query>" [--files a,b] [--json]            what an agent would be served for this action',
  "  kage cards receipts [--limit <n>] [--json]                    counted events only, never an estimate",
  "",
  `  states: ${CARD_STATES.join(", ")}    kinds: ${CARD_KINDS.join(", ")}`,
].join("\n");

const SUBCOMMANDS: ReadonlySet<string> = new Set([
  "list",
  "show",
  "approve",
  "reject",
  "mine",
  "verify",
  "brief",
  "recall",
  "receipts",
]);

/**
 * Flags that consume the token after them. Listed explicitly so positional arguments can be
 * found without a parser: `kage cards recall "tenant caps" --files a,b` must not read "a,b" as
 * a second positional. `--project` is in here because mcp/cli.ts resolves it and then hands us
 * the argv it came in on — we skip it rather than mistake its value for an id.
 */
const VALUE_FLAGS: ReadonlySet<string> = new Set([
  "--state",
  "--kind",
  "--note",
  "--reason",
  "--max-commits",
  "--limit",
  "--files",
  "--project",
]);

function has(argv: string[], name: string): boolean {
  return argv.includes(name);
}

/**
 * The value after `name`, or undefined. A value that is itself a flag counts as absent:
 * `kage cards reject <id> --reason --json` has no reason, and silently recording "--json" as
 * the reviewer's reasoning would be worse than refusing.
 */
function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) return undefined;
  return value;
}

function positionals(argv: string[]): string[] {
  const rest: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (VALUE_FLAGS.has(token)) {
      index += 1; // its value belongs to the flag, never to the verb
      continue;
    }
    if (token.startsWith("--")) continue;
    rest.push(token);
  }
  return rest;
}

function listValue(value: string | undefined): string[] {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function ok(out: string): CardsCliResult {
  return { exitCode: 0, out };
}

/** A refusal is a report with a nonzero status — never a thrown stack trace at a human. */
function refuse(out: string): CardsCliResult {
  return { exitCode: 1, out };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * A human-readable age from a real timestamp. An unparseable timestamp reads "unknown" rather
 * than resolving to some age off the epoch — an invented age is an invented measurement.
 */
function ago(at: string, now: Date): string {
  const then = Date.parse(at);
  if (Number.isNaN(then)) return "unknown";
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

// ── Rendering ────────────────────────────────────────────────────────────────────────────────

/**
 * One card, one line, id first — the id is what every other verb takes as its argument, so it
 * leads rather than trailing behind a title that may wrap. Verify state is printed only for
 * cards that have been approved: on a proposed card the field reads "unverified" because
 * nothing has checked it yet, and showing that word next to an unreviewed card would look like
 * a verdict on the claim.
 */
function cardLine(card: Card): string {
  const trust = card.state === "proposed" ? "" : `  ${card.verify.padEnd(10)}`;
  return `  ${card.id}  ${card.kind.padEnd(8)}${trust}  ${card.title}`;
}

/** Inbox first: the whole point of the listing is what is waiting on a human. */
const STATE_ORDER: readonly CardState[] = ["proposed", "approved", "superseded", "retired"];

function renderList(cards: Card[], filtered: boolean): string {
  if (cards.length === 0) {
    return filtered
      ? "No cards match that filter."
      : "No cards yet.\nRun `kage cards mine` to propose them from this repo's own history.";
  }
  const lines: string[] = [];
  for (const state of STATE_ORDER) {
    const group = cards.filter((card) => card.state === state);
    if (group.length === 0) continue;
    if (lines.length > 0) lines.push("");
    lines.push(`${state} (${group.length})`);
    for (const card of group) lines.push(cardLine(card));
  }
  return lines.join("\n");
}

function citationLine(citation: Citation): string {
  if (!isCodeCitation(citation)) return citation.ref;
  const symbol = citation.symbol ? `#${citation.symbol}` : "";
  // A citation with no pin has never been checked against the tree. The dash says exactly
  // that; a fake sha or an omitted column would imply a verification that never ran.
  return `${citation.path}${symbol}  pinned ${citation.blobSha ? citation.blobSha.slice(0, 7) : "—"}`;
}

/** The trust reading in the words the type comments define it in, not a bare enum value. */
function verifyLine(card: Card): string {
  if (card.state === "proposed") return "not checked until it is approved";
  if (card.verify === "verified") return "verified — re-checked since the cited code last changed";
  if (card.verify === "unverified") return "unverified — the cited code changed after the last check";
  return "stale — a cited file or symbol is GONE; withheld from recall and dropped from the BRIEF";
}

function renderCard(card: Card, now: Date): string {
  const lines = [
    `${card.id}  ${card.kind}  ${card.state}`,
    card.title,
    "",
    card.claim,
    "",
    `Trigger      ${card.trigger}`,
    `Verify       ${verifyLine(card)}`,
    `Citations    ${citationLine(card.citations[0] ?? { ref: "(none)" })}`,
    ...card.citations.slice(1).map((citation) => `             ${citationLine(citation)}`),
    `Provenance   ${card.provenance.source} · ${card.provenance.ref} · ${card.provenance.at}`,
    `Updated      ${card.updatedAt} (${ago(card.updatedAt, now)})`,
  ];
  if (card.tags.length > 0) lines.push(`Tags         ${card.tags.join(", ")}`);
  if (card.reviewedBy) {
    lines.push(`Reviewed     ${card.reviewedBy}${card.reviewNote ? ` — ${card.reviewNote}` : ""}`);
  }
  if (card.supersedes) lines.push(`Supersedes   ${card.supersedes}`);
  if (card.supersededBy) lines.push(`Superseded by ${card.supersededBy}`);
  return lines.join("\n");
}

// ── The dispatcher ───────────────────────────────────────────────────────────────────────────

export async function runCardsCommand(
  argv: string[],
  projectDir: string,
  deps: CardsCliDeps = {},
): Promise<CardsCliResult> {
  const args = positionals(argv);
  // Bare `kage cards` is the listing: the most common thing a human wants is "what is waiting
  // on me", and making them type a verb for it would be ceremony.
  const sub = args[0] ?? "list";
  const wantsJson = has(argv, "--json");
  const now = (deps.now ?? (() => new Date()))();

  if (has(argv, "--help") || sub === "help") return ok(USAGE);
  if (!SUBCOMMANDS.has(sub)) {
    return refuse(`Unknown subcommand '${sub}'.\n\n${USAGE}`);
  }

  // Opened only after the verb is known to exist: openStore creates and git-inits a store
  // directory, and a typo must never leave one behind.
  const store = storeFor(projectDir, deps.storeRoot);

  if (sub === "list") {
    const state = flagValue(argv, "--state");
    const kind = flagValue(argv, "--kind");
    // An unrecognized filter value would list nothing, and "nothing" would read as "this repo
    // has no such cards" instead of "you typed it wrong".
    if (state !== undefined && !CARD_STATES.includes(state as CardState)) {
      return refuse(`Unknown --state '${state}'. One of: ${CARD_STATES.join(", ")}`);
    }
    if (kind !== undefined && !CARD_KINDS.includes(kind as CardKind)) {
      return refuse(`Unknown --kind '${kind}'. One of: ${CARD_KINDS.join(", ")}`);
    }
    const cards = listCards(store, {
      ...(state ? { state: state as CardState } : {}),
      ...(kind ? { kind: kind as CardKind } : {}),
    });
    return ok(wantsJson ? json(cards) : renderList(cards, state !== undefined || kind !== undefined));
  }

  if (sub === "show") {
    const id = args[1];
    if (!id) return refuse("show needs a card id:  kage cards show <id>");
    const card = getCard(store, id);
    if (!card) return refuse(`No card ${id}. Run \`kage cards list\` to see what the store holds.`);
    return ok(wantsJson ? json(card) : renderCard(card, now));
  }

  if (sub === "approve") {
    const id = args[1];
    if (!id) return refuse("approve needs a card id:  kage cards approve <id> [--note <text>]");
    // The reviewer is whoever is at this terminal. Empty is treated as absent, not recorded as
    // an empty name — the review trail's whole value is that it attributes.
    const reviewer = process.env.USER?.trim() || "local-operator";
    const note = flagValue(argv, "--note");
    const result = approve(store, projectDir, id, reviewer, note);
    if (!result.ok || !result.card) return refuse(`Could not approve ${id}: ${result.error ?? "unknown error"}`);

    // approve() already refreshed the BRIEF; this idempotent second pass is how we report the
    // honest count of what actually reached the file rather than guessing "+1". composeBrief
    // drops stale cards and caps lines, so the approved card is not necessarily in there.
    const brief = refreshBrief(store, projectDir);
    return ok(
      [
        `Approved ${result.card.id} — ${result.card.verify}.`,
        `  ${result.card.title}`,
        // Approval does not imply trust: a card whose evidence had already moved is approved
        // AND withheld, and the operator must be told that in the same breath, not discover it
        // when recall stays silent.
        ...(result.card.verify === "verified" ? [] : [`  ${verifyLine(result.card)}`]),
        `BRIEF: ${brief.path} (${plural(brief.cards, "card")})`,
      ].join("\n"),
    );
  }

  if (sub === "reject") {
    const id = args[1];
    if (!id) return refuse("reject needs a card id:  kage cards reject <id> --reason <text>");
    const reason = flagValue(argv, "--reason");
    // Required, always. The reason is the only signal the extractor gets back about what it
    // should stop proposing; a rejection without one teaches nothing and the same junk returns.
    if (!reason) {
      return refuse(
        "reject needs --reason <text>: a rejection with no reason teaches the extractor nothing.",
      );
    }
    const reviewer = process.env.USER?.trim() || "local-operator";
    const result = reject(store, id, reviewer, reason);
    if (!result.ok || !result.card) return refuse(`Could not reject ${id}: ${result.error ?? "unknown error"}`);
    return ok([`Rejected ${result.card.id} — ${reason}`, `  ${result.card.title}`].join("\n"));
  }

  if (sub === "mine") {
    const maxCommitsRaw = flagValue(argv, "--max-commits");
    const maxCommits = maxCommitsRaw === undefined ? undefined : Number(maxCommitsRaw);
    if (maxCommits !== undefined && (!Number.isSafeInteger(maxCommits) || maxCommits <= 0)) {
      return refuse(`--max-commits takes a positive whole number, not '${maxCommitsRaw}'.`);
    }
    // The real provider spawns the user's OWN agent in this repo. Kage pays for zero inference,
    // so cwd matters: the runner should see the project it is mining.
    const provider = deps.provider ?? claudeProvider({ cwd: projectDir });
    const summary = await mineRepository(
      provider,
      store,
      projectDir,
      maxCommits === undefined ? undefined : { maxCommits },
    );
    if (wantsJson) return { exitCode: summary.ok ? 0 : 1, out: json(summary) };
    if (!summary.ok) return refuse(`Mining failed: ${summary.error ?? "unknown error"}`);

    const lines = [
      `Mined ${plural(summary.commits, "commit")}, ${plural(summary.reverts, "revert")}.`,
      // Deduped is the system working; refused is a quality signal about the extractor. They
      // stay separate columns for exactly that reason (operations.ts, ingestProposals).
      `  ${summary.proposed} proposed · ${summary.deduped} already known · ${summary.rejected} refused by the gate`,
    ];
    // Measured or nothing. A run whose runner reported no usage says so; printing 0 tokens
    // would claim a measurement that never happened.
    if (summary.inputTokens === null && summary.outputTokens === null && summary.costUsd === null) {
      lines.push("  token usage not measured");
    } else {
      const inTokens = summary.inputTokens === null ? "—" : String(summary.inputTokens);
      const outTokens = summary.outputTokens === null ? "—" : String(summary.outputTokens);
      const cost = summary.costUsd === null ? "cost not measured" : `$${summary.costUsd.toFixed(4)}`;
      lines.push(`  tokens ${inTokens} in / ${outTokens} out · ${cost}`);
    }
    for (const problem of summary.problems) lines.push(`  refused: ${problem}`);
    if (summary.proposed > 0) lines.push("Review them: kage cards list --state proposed");
    return ok(lines.join("\n"));
  }

  if (sub === "verify") {
    const counts = verifySweep(store, projectDir);
    if (wantsJson) return ok(json(counts));
    if (counts.checked === 0) {
      return ok("No approved cards to check yet — verification is a fact about approved knowledge.");
    }
    const lines = [
      `Checked ${plural(counts.checked, "approved card")}: ${counts.verified} verified, ${counts.unverified} unverified, ${counts.stale} stale.`,
    ];
    if (counts.stale > 0) {
      lines.push("Stale cards are withheld from recall and dropped from the BRIEF until re-verified.");
    }
    return ok(lines.join("\n"));
  }

  if (sub === "brief") {
    const brief = refreshBrief(store, projectDir);
    if (wantsJson) return ok(json(brief));
    return ok(
      brief.cards === 0
        ? `BRIEF: ${brief.path} — no approved cards reached the file yet.`
        : `BRIEF: ${brief.path} — ${plural(brief.cards, "card")}.`,
    );
  }

  if (sub === "recall") {
    const query = args[1];
    const files = listValue(flagValue(argv, "--files"));
    // Recall answers what THIS action needs. With no action described there is no honest
    // answer, and dumping the store is the "show me everything" recall exists to refuse.
    if (!query && files.length === 0) {
      return refuse('recall needs a query or --files:  kage cards recall "<query>" [--files a,b]');
    }
    // Only approved cards are eligible knowledge; recallCards enforces it too, but asking the
    // store for the approved set keeps the CLI honest about what it is searching.
    const result = recallCards(listCards(store, { state: "approved" }), {
      ...(query ? { text: query } : {}),
      ...(files.length > 0 ? { files } : {}),
    });
    // No receipt is written here. The ledger counts what agents were actually served; a human
    // running a dry run at the terminal must not inflate the numbers the Receipts surface
    // replays.
    if (wantsJson) return ok(json({ query: query ?? null, files, ...result }));

    const lines = [`Recall for ${query ? `"${query}"` : "(no text)"}${files.length ? ` · files: ${files.join(", ")}` : ""}`];
    lines.push("");
    if (result.served.length === 0) {
      lines.push("Served nothing — no approved card cites this action.");
    } else {
      lines.push(`Served ${result.served.length}`);
      for (const entry of result.served) {
        lines.push(cardLine(entry.card));
        lines.push(`      why: ${entry.why}`);
      }
    }
    // The withholding is the point of the product, so it gets its own section and its own
    // reason. A stale card that simply vanished from the list would be indistinguishable from
    // a card that never existed.
    if (result.withheld.length > 0) {
      lines.push("");
      lines.push(`Withheld ${result.withheld.length} — stale: a cited file or symbol is gone, so the claim is about code that no longer exists`);
      for (const entry of result.withheld) lines.push(cardLine(entry.card));
      lines.push("Re-verify with: kage cards verify");
    }
    return ok(lines.join("\n"));
  }

  // receipts — the only numbers this product is allowed to show.
  const limitRaw = flagValue(argv, "--limit");
  const limit = limitRaw === undefined ? 10 : Number(limitRaw);
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    return refuse(`--limit takes a positive whole number, not '${limitRaw}'.`);
  }
  const counts = receiptCounts(store.dir);
  const recent = readReceipts(store.dir, { limit });
  if (wantsJson) return ok(json({ counts, recent }));

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (entries.length === 0) {
    return ok("Nothing counted yet.\nRun `kage cards mine`, then approve a card — receipts are written by events, never estimated.");
  }
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const lines = ["Receipts — counted events only, never an estimate."];
  // Event types with no events are absent rather than zero: an absent measurement is an unlock
  // action, and a printed 0 would claim a measurement that never ran.
  for (const [type, count] of entries) lines.push(`  ${type.padEnd(16)} ${count}`);
  lines.push("");
  lines.push(`Recent ${Math.min(recent.length, limit)} of ${total}`);
  for (const event of recent) {
    const parts = [event.cardId, event.sessionRef, event.detail].filter(Boolean).join("  ");
    lines.push(`  ${event.at}  ${event.type.padEnd(16)} ${parts}  (${ago(event.at, now)})`);
  }
  return ok(lines.join("\n"));
}
