// The pre-edit hook's logic — the moment memory reaches an agent without anyone asking for it.
//
// DIRECTION.md's retrieval tier 2: "hooks match touched files against card triggers and citation
// paths; each injection is stamped with live verification state and writes a counted receipt".
// This module is that, whole, so the shell script beside it (plugin/hooks/kage-cards-context.sh)
// stays a pipe. Logic in bash is logic nobody tests, and this code runs before EVERY edit in
// EVERY session on the machine.
//
// Two costs shape every decision here:
//
//   Silence is the product. "" is the common case — most edits touch nothing any card cites —
//   and it must be cheap and produce no output at all. A hook that prints on every tool call
//   teaches people to skim past it, and then it is worth nothing on the day it matters.
//
//   A hook must never fail the edit. Every path out of hookResponse is a string; nothing here
//   throws, and the shell exits 0 regardless. A broken memory hook that blocks an edit is
//   strictly worse than no memory at all.
//
// One rule is enforced here that recall.ts alone cannot: the trust stamp is computed against the
// tree AS IT IS RIGHT NOW, not read off the card. The store heals on sweep, and between sweeps a
// cited file can vanish — serving that card as "verified" would be the exact failure this product
// exists to prevent. So matched cards are re-audited before they are rendered, and a card the
// tree no longer supports is withheld here even when the store still calls it verified.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { recallCards } from "./recall.js";
import { appendReceipt } from "./receipts.js";
import { defaultStoreRoot, listCards, repoStoreId, type CardStore } from "./store.js";
import { auditCard } from "./verify.js";
import { isCodeCitation, type Card, type VerifyState } from "./types.js";

/** The three hook events Kage acts on, normalized away from any one agent's vocabulary. */
export interface HookInput {
  event: "pre-tool" | "session-start" | "stop";
  toolName?: string;
  filePaths?: string[];
  prompt?: string;
  projectDir: string;
}

export interface HookDeps {
  /** Store root override — tests point it at a scratch dir so the real ~/.kage is untouched. */
  storeRoot?: string;
  /** The clock, for the age this surface stamps on a card. Tests pin it. */
  now?: () => Date;
}

/**
 * The tools that CHANGE code. A Read is not the moment memory pays for itself — the agent is
 * still gathering — and injecting there would double the spend for the same facts.
 */
const EDITING_TOOLS: ReadonlySet<string> = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

/**
 * Claude Code's names, plus the normalized ones this module exports, mapped onto our three.
 * Anything absent from this table — PostToolUse, UserPromptSubmit, SubagentStop — is an event
 * Kage does not act on, and parsing it must say so rather than guess a close-enough neighbour.
 */
const EVENTS: Readonly<Record<string, HookInput["event"]>> = {
  PreToolUse: "pre-tool",
  SessionStart: "session-start",
  Stop: "stop",
  "pre-tool": "pre-tool",
  "session-start": "session-start",
  stop: "stop",
};

/**
 * Three cards, not recall.ts's five. This block is spent on a single edit, mid-task, next to
 * whatever else the agent is carrying; the top three by score is what a human would actually
 * read before changing a line.
 */
const HOOK_RECALL_LIMIT = 3;

/** Citations shown per card. Past three the stamp stops being a stamp and becomes a list. */
const MAX_SHOWN_CITATIONS = 3;

// ── Parsing ──────────────────────────────────────────────────────────────────────────────────

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * The real payload arrives on stdin as one JSON object. Both spellings are accepted at every
 * field (`tool_name`/`toolName`) because hook payloads are somebody else's contract and have
 * changed shape before; the cost of tolerance here is three `||`, and the cost of intolerance is
 * a memory system that silently stops working after an agent release.
 *
 * Returns null — never a partial input — for an event Kage does not act on, so the caller has
 * exactly one "nothing to do" answer to handle.
 */
export function parseHookPayload(stdin: string, fallbackProjectDir: string): HookInput | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdin);
  } catch {
    return null; // Not JSON at all. Silence is the only honest response to a payload we can't read.
  }
  const payload = record(parsed);

  const event = EVENTS[str(payload.hook_event_name) || str(payload.hookEventName) || str(payload.event)];
  if (!event) return null;

  const toolInput = record(payload.tool_input ?? payload.toolInput);
  const paths: string[] = [];
  for (const candidate of [toolInput.file_path, toolInput.notebook_path, toolInput.path]) {
    const value = str(candidate);
    if (value && !paths.includes(value)) paths.push(value);
  }
  // The already-normalized shape, so a caller that assembled the input itself round-trips.
  for (const list of [payload.filePaths, payload.file_paths]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const value = str(entry);
      if (value && !paths.includes(value)) paths.push(value);
    }
  }

  const toolName = str(payload.tool_name) || str(payload.toolName);
  const prompt = str(payload.prompt) || str(payload.user_prompt);

  return {
    event,
    // The payload's own cwd is the truth about which repo this session is in; the fallback is
    // the launching environment's guess, used only when the payload carries none.
    projectDir: str(payload.cwd) || str(payload.project_dir) || str(payload.projectDir) || fallbackProjectDir,
    ...(toolName ? { toolName } : {}),
    ...(paths.length > 0 ? { filePaths: paths } : {}),
    ...(prompt ? { prompt } : {}),
  };
}

// ── Locating the store, without creating one ─────────────────────────────────────────────────

/**
 * The shadow store for this project, ONLY if it already exists.
 *
 * Deliberately not `storeFor()`: openStore creates the directory and `git init`s it, and this
 * function runs before every edit in every repo on the machine. A hook that brings a store into
 * existence as a side effect of typing would litter ~/.kage/store with a repo per project the
 * user never asked Kage about.
 */
function existingStore(projectDir: string, storeRoot?: string): CardStore | null {
  const dir = join(storeRoot ?? defaultStoreRoot(), repoStoreId(projectDir));
  if (!existsSync(join(dir, "cards"))) return null;
  return { projectDir: resolve(projectDir), dir };
}

/**
 * The touched paths, repo-relative, with anything outside the project dropped.
 *
 * Memory is repo-scoped: an agent editing ~/.zshrc or a second checkout mid-session must not be
 * matched against this repo's citations, and its path must not reach a receipt.
 */
function repoRelativeFiles(projectDir: string, paths: readonly string[]): string[] {
  const root = resolve(projectDir);
  const files: string[] = [];
  for (const raw of paths) {
    const value = str(raw);
    if (!value) continue;
    const absolute = isAbsolute(value) ? resolve(value) : resolve(root, value);
    if (absolute !== root && !absolute.startsWith(root + sep)) continue;
    // Citations are stored posix-style; a Windows checkout must still match them.
    const rel = relative(root, absolute).split(sep).join("/");
    if (rel && !files.includes(rel)) files.push(rel);
  }
  return files;
}

// ── Rendering ────────────────────────────────────────────────────────────────────────────────

/**
 * A human age from a real timestamp. An unparseable one reads "unknown" rather than resolving to
 * some age off the epoch — an invented age is an invented measurement.
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

function citedPaths(card: Card): string {
  const shown = card.citations
    .filter(isCodeCitation)
    .slice(0, MAX_SHOWN_CITATIONS)
    .map((citation) => `${citation.path}${citation.symbol ? `#${citation.symbol}` : ""}`);
  return shown.join(", ");
}

/**
 * The trust line — DIRECTION.md's "verified against a1b2c3, 2h ago", with one word changed for
 * honesty: `updatedAt` is the last recorded CHANGE to the card, which is the last check only when
 * the check changed something. It says "updated" because that is what it measures. A card with
 * no pin says so with a dash; a fabricated sha would claim a verification that never ran.
 */
function trustLine(card: Card, live: VerifyState, now: Date): string {
  const pin = card.citations.find((citation) => isCodeCitation(citation) && citation.blobSha);
  const sha = pin && isCodeCitation(pin) && pin.blobSha ? pin.blobSha.slice(0, 7) : "—";
  const age = ago(card.updatedAt, now);
  return live === "verified"
    ? `verified against ${sha}, updated ${age}`
    : `unverified — the cited code changed since ${sha} was checked, updated ${age}`;
}

/**
 * The injected block. Fenced with its own markers so a reader can tell Kage's words from the
 * agent's, and named for the cards it carries rather than the generic "context" the proxy's
 * capsule uses.
 */
function renderBlock(served: Array<{ card: Card; live: VerifyState }>, withheld: number, now: Date): string {
  const lines = [
    "<<<KAGE_MEMORY>>>",
    "Team memory for the file you are about to edit — approved by a human, re-checked against this tree just now.",
  ];
  for (const { card, live } of served) {
    lines.push("");
    lines.push(`- [${card.kind}] ${card.title}`);
    // Flattened: the claim is at most 160 words and a wrapped paragraph inside an injected block
    // is harder to skim than one long line.
    lines.push(`  ${card.claim.trim().replace(/\s+/g, " ")}`);
    lines.push(`  ${trustLine(card, live, now)} · ${citedPaths(card)} · ${card.id}`);
  }
  if (withheld > 0) {
    lines.push("");
    // Named, not silently dropped: an agent told "there was something here and it can no longer
    // be trusted" behaves differently from one told nothing.
    lines.push(
      `${withheld} card${withheld === 1 ? " was" : "s were"} withheld as stale — a cited file or symbol is gone. Re-verify: kage cards verify`,
    );
  }
  lines.push("<<<END_KAGE_MEMORY>>>");
  return lines.join("\n");
}

// ── The answer ───────────────────────────────────────────────────────────────────────────────

/**
 * What this hook event is worth saying, as the block itself. "" means say nothing.
 *
 *   pre-tool       an editing tool with in-repo paths → the approved cards that cite them
 *   session-start  nothing. The BRIEF already reaches every session through CLAUDE.md/AGENTS.md;
 *                  repeating it here would spend the context budget twice for the same facts.
 *   stop           nothing. Capture is the watcher's job, on an idle timer, in the desktop tick —
 *                  distilling from inside the agent's own stop path would make the user wait for
 *                  a headless run they did not ask for.
 *
 * Never throws: the outermost catch is the promise this function makes to the session.
 */
export function hookResponse(input: HookInput, deps: HookDeps = {}): string {
  try {
    // Cheapest checks first, in the order that eliminates the most calls: most invocations are
    // not edits at all, and none of those should reach the filesystem, git, or the store.
    if (input.event !== "pre-tool") return "";
    if (!input.toolName || !EDITING_TOOLS.has(input.toolName)) return "";
    const files = repoRelativeFiles(input.projectDir, input.filePaths ?? []);
    if (files.length === 0) return "";

    const store = existingStore(input.projectDir, deps.storeRoot);
    if (!store) return ""; // Kage was never set up here. Not an error; not our repo to annotate.

    // Files only, deliberately. A PreToolUse payload carries no prompt, and matching on the edit's
    // paths is what makes this injection precise enough to be worth its bytes — keyword overlap
    // against whatever else is in flight is the "show me everything" recall exists to refuse.
    const result = recallCards(listCards(store, { state: "approved" }), {
      files,
      limit: HOOK_RECALL_LIMIT,
    });
    if (result.served.length === 0 && result.withheld.length === 0) return "";

    // The live gate (see the file-top comment): the store's reading can be older than the tree,
    // so a card matched here is re-audited before it is served, and one the tree no longer
    // supports joins the cards recall already withheld.
    const served: Array<{ card: Card; live: VerifyState }> = [];
    const withheld: Card[] = result.withheld.map((entry) => entry.card);
    for (const entry of result.served) {
      const live = auditCard(input.projectDir, entry.card).verify;
      if (live === "stale") {
        withheld.push(entry.card);
        continue;
      }
      served.push({ card: entry.card, live });
    }

    const at = (deps.now ?? (() => new Date()))();
    const stamp = at.toISOString();
    const where = `pre-edit: ${files.join(", ")}`;
    // Receipts are written for what actually reached an agent AND for what was kept from one.
    // Both are counted events — the Receipts surface may replay nothing else — and a withholding
    // that left no trace would be indistinguishable from a card that never existed.
    for (const { card } of served) {
      appendReceipt(store.dir, { type: "recall_served", at: stamp, cardId: card.id, detail: where });
    }
    for (const card of withheld) {
      appendReceipt(store.dir, { type: "stale_withheld", at: stamp, cardId: card.id, detail: where });
    }

    // Nothing survived the trust gate. The withholding is counted above and visible to a human on
    // the Receipts surface; spending the agent's context to advertise knowledge Kage refuses to
    // stand behind would be noise it cannot act on.
    if (served.length === 0) return "";

    return renderBlock(served, withheld.length, at);
  } catch {
    // A corrupt store, a vanished directory, a git that isn't there. All of it is "no memory for
    // this edit", never a failed edit.
    return "";
  }
}

/**
 * The compiled entry, and the whole of what the shell script does: payload in, one line of
 * stdout out. The envelope is Claude Code's PreToolUse contract — the same shape the older
 * file-context hooks print — and an empty block prints NOTHING at all rather than an envelope
 * carrying "", which would still show up as an (empty) injection.
 */
export function runHook(stdin: string, fallbackProjectDir: string, deps: HookDeps = {}): string {
  const input = parseHookPayload(stdin, fallbackProjectDir);
  if (!input) return "";
  const block = hookResponse(input, deps);
  if (!block) return "";
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: block },
  });
}

// `node hook.js [projectDir]` — reached only when this file IS the process entry, so importing it
// (tests, the desktop worker) runs nothing.
if (require.main === module) {
  let out = "";
  try {
    // The one place env is read: this is the CLI edge, and everything below it takes the store
    // root as a parameter (store.ts). KAGE_STORE_ROOT lets the shipped hook be pointed at a
    // scratch store — for a smoke test, or for a dev running two stores — without any surface
    // below here learning what an environment variable is.
    const storeRoot = process.env.KAGE_STORE_ROOT?.trim();
    // fd 0 synchronously: the payload is already piped in, and an async read would need a
    // lifecycle this script does not otherwise have.
    out = runHook(readFileSync(0, "utf8"), process.argv[2] || process.cwd(), {
      ...(storeRoot ? { storeRoot } : {}),
    });
  } catch {
    out = "";
  }
  if (out) process.stdout.write(`${out}\n`);
}
