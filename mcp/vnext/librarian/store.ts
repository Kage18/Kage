// The shadow-repo card store — team memory as a git repository the product repo never carries.
//
// DIRECTION.md's repo-clutter answer, made concrete: one separate git repo per product repo
// (<root>/<repo-id>/), one file per card, one commit per mutation. Git is the database on
// purpose — history, blame, revert, and diff come native, team sync is `git remote add` on a
// host the team already trusts, and the store stays inspectable with no Kage installed. This
// file is what retires the old model, where memory packets were 40% of the product repo's
// tracked files.
//
// Every mutation has one shape: write the touched file(s), then exactly ONE commit naming the
// action and the card. The commit log IS the audit trail — two mutations in one commit would
// blur it; one mutation across two commits would tear it.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import type { Card, CardFilter, CardProposal, Provenance, VerifyState } from "./types.js";
import type { CardProblem } from "./card.js";
import { canTransition, cardId, parseCard, serializeCard, validateProposal } from "./card.js";
import { scanForSecrets } from "./secretscan.js";

// ── Git plumbing ─────────────────────────────────────────────────────────────────────────────

function git(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    // Piped, never inherited: the store is a library, and its git plumbing must not write to
    // the caller's terminal. A failure surfaces as a thrown error carrying stderr.
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * The single mutation commit. Only the touched files are added — never `-A`, which would sweep
 * in whatever else is lying in the worktree and break "one mutation, one commit, only its
 * files". Identity is pinned so a card commit is attributable to the store, not to whatever
 * ~/.gitconfig says; signing is forced off because these commits happen headless and must
 * never hang on a key prompt.
 */
function commitTouched(dir: string, files: string[], message: string): void {
  git(dir, ["add", "--", ...files]);
  git(dir, [
    "-c", "user.name=Kage Librarian",
    "-c", "user.email=librarian@kage.local",
    "-c", "commit.gpgsign=false",
    "commit", "-m", message,
  ]);
}

/** "<action>: <id> <title…60>" — terse enough for a one-line log, specific enough to audit. */
function commitMessage(action: string, card: Card): string {
  return `${action}: ${card.id} ${card.title.slice(0, 60)}`;
}

// Posix on purpose: this string is handed to git as a pathspec relative to the store root.
function relCardPath(id: string): string {
  return `cards/${id}.md`;
}

function absCardPath(store: CardStore, id: string): string {
  return join(store.dir, "cards", `${id}.md`);
}

// ── Identity and location ────────────────────────────────────────────────────────────────────

/**
 * Which store a project belongs to. The remote origin URL when there is one — so every clone
 * of a repo, on every machine, resolves to the same store and therefore the same team memory —
 * else the absolute path, so a never-pushed local project still gets a stable store of its own.
 */
export function repoStoreId(projectDir: string): string {
  const abs = resolve(projectDir);
  let identity = abs;
  try {
    const remote = git(abs, ["config", "--get", "remote.origin.url"]).trim();
    if (remote) identity = remote;
  } catch {
    // Not a git repo, or no origin configured — the path is the identity. Never an error:
    // solo, offline, un-pushed projects are first-class (DIRECTION.md: "Solo: no remote").
  }
  return createHash("sha256").update(identity).digest("hex").slice(0, 12);
}

/** Where stores live by default. `home` is a parameter, not an env read — the CLI edge owns env. */
export function defaultStoreRoot(home?: string): string {
  return join(home ?? homedir(), ".kage", "store");
}

/** A handle to one product repo's shadow store — plain data, threaded explicitly. */
export interface CardStore {
  /** Absolute path of the product repo this store shadows. */
  projectDir: string;
  /** Absolute path of the shadow repo itself. */
  dir: string;
}

/**
 * Open (creating if needed) the shadow store for a project. Idempotent: reopening an existing
 * store touches nothing. A fresh store is born as a real git repo with one README commit so
 * HEAD exists before the first card does — every later mutation gets a parent, and log/blame
 * work from minute one.
 */
export function openStore(projectDir: string, root?: string): CardStore {
  const abs = resolve(projectDir);
  const dir = join(root ?? defaultStoreRoot(), repoStoreId(abs));
  mkdirSync(join(dir, "cards"), { recursive: true });
  if (!existsSync(join(dir, ".git"))) {
    git(dir, ["init", "-b", "main"]);
    // The README names which project this store shadows — the directory name is a hash, and a
    // human poking around ~/.kage/store deserves a plain answer to "what is this?".
    writeFileSync(join(dir, "README.md"), `Kage card store for ${abs}\n`);
    commitTouched(dir, ["README.md"], `init: ${abs}`);
  }
  return { projectDir: abs, dir };
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────

const CARD_ID_SHAPE = /^card_[0-9a-f]{8}$/;

export function getCard(store: CardStore, id: string): Card | null {
  // Ids arrive from every edge (CLI args, app routes). A path-shaped "id" must read as
  // "no such card", never as a file outside cards/.
  if (!CARD_ID_SHAPE.test(id)) return null;
  let content: string;
  try {
    content = readFileSync(absCardPath(store, id), "utf8");
  } catch {
    return null;
  }
  return parseCard(content);
}

export function listCards(store: CardStore, filter?: CardFilter): Card[] {
  let names: string[];
  try {
    names = readdirSync(join(store.dir, "cards"));
  } catch {
    return []; // A store that was never opened lists as empty, not as an exception.
  }
  const cards: Card[] = [];
  for (const name of names) {
    if (!name.endsWith(".md")) continue;
    let parsed: Card | null;
    try {
      parsed = parseCard(readFileSync(join(store.dir, "cards", name), "utf8"));
    } catch {
      parsed = null;
    }
    // One corrupt or hand-mangled file degrades to "skipped" — it must never take the whole
    // listing (and with it the app's Knowledge page) down.
    if (!parsed) continue;
    if (filter?.state && parsed.state !== filter.state) continue;
    if (filter?.kind && parsed.kind !== filter.kind) continue;
    if (filter?.verify && parsed.verify !== filter.verify) continue;
    if (filter?.text) {
      const haystack = `${parsed.title}\n${parsed.claim}`.toLowerCase();
      if (!haystack.includes(filter.text.toLowerCase())) continue;
    }
    cards.push(parsed);
  }
  // Newest change first; id as tiebreaker so equal timestamps still list deterministically.
  return cards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}

// ── Mutations ────────────────────────────────────────────────────────────────────────────────

/**
 * The deterministic half of the gate, then the write. Order matters: validation and the secret
 * scan both run before any disk or git effect, so a refused proposal leaves no trace at all.
 *
 * `supersedes` rides along as an optional extension of CardProposal because it is the only way
 * the reconciler's SUPERSEDE verdict can be recorded — the proposal carries the intent, and
 * approveCard enacts it. Supersede lands at approval time, never before.
 */
export function proposeCard(
  store: CardStore,
  proposal: CardProposal & { supersedes?: string },
  provenance: Provenance,
  now?: Date,
): { card: Card; deduped: boolean } | { problems: CardProblem[] } {
  const problems = validateProposal(proposal);
  // The scan covers every field the Librarian authors free-form. A leaked key here is an
  // incident, not a quality problem — the refusal is deterministic and cannot be argued with.
  for (const name of scanForSecrets(`${proposal.title}\n${proposal.claim}\n${proposal.trigger}`)) {
    problems.push({ field: "claim", reason: `secret detected: ${name}` });
  }
  if (problems.length > 0) return { problems };

  const id = cardId(proposal);
  // Content-addressed dedupe for free: the same claim from two sessions is the same file.
  // (A corrupt file squatting on the id parses to null and is repaired by the rewrite.)
  const existing = getCard(store, id);
  if (existing) return { card: existing, deduped: true };

  const at = (now ?? new Date()).toISOString();
  const card: Card = {
    id,
    kind: proposal.kind,
    state: "proposed",
    verify: "unverified",
    title: proposal.title.trim(),
    claim: proposal.claim.trim(),
    citations: proposal.citations,
    trigger: proposal.trigger.trim(),
    provenance,
    tags: proposal.tags ?? [],
    ...(proposal.supersedes ? { supersedes: proposal.supersedes } : {}),
    createdAt: at,
    updatedAt: at,
  };
  writeFileSync(absCardPath(store, id), serializeCard(card));
  commitTouched(store.dir, [relCardPath(id)], commitMessage("propose", card));
  return { card, deduped: false };
}

/**
 * The human gate's "yes". If the card records a supersede intent AND the state machine allows
 * the target to be superseded (i.e. the target is currently approved), the target flips in the
 * SAME commit — approval and the supersede it causes are one auditable event, and there is no
 * window where both cards read as live knowledge. A target that was never approved is left
 * alone: it was never team knowledge, so there is nothing to supersede.
 */
export function approveCard(
  store: CardStore,
  id: string,
  reviewer: string,
  note?: string,
  now?: Date,
): { card: Card } | { error: string } {
  const card = getCard(store, id);
  if (!card) return { error: `no card ${id}` };
  if (!canTransition(card.state, "approved")) {
    return { error: `cannot approve a ${card.state} card` };
  }
  const at = (now ?? new Date()).toISOString();
  const approved: Card = {
    ...card,
    state: "approved",
    reviewedBy: reviewer,
    updatedAt: at,
    ...(note !== undefined ? { reviewNote: note } : {}),
  };
  writeFileSync(absCardPath(store, approved.id), serializeCard(approved));
  const touched = [relCardPath(approved.id)];

  if (approved.supersedes) {
    const target = getCard(store, approved.supersedes);
    if (target && canTransition(target.state, "superseded")) {
      const superseded: Card = {
        ...target,
        state: "superseded",
        supersededBy: approved.id,
        updatedAt: at,
      };
      writeFileSync(absCardPath(store, superseded.id), serializeCard(superseded));
      touched.push(relCardPath(superseded.id));
    }
  }
  commitTouched(store.dir, touched, commitMessage("approve", approved));
  return { card: approved };
}

/**
 * The human gate's "no". Rejected cards are retired, never deleted — the reason stays on
 * record so the same junk is not re-proposed and re-reviewed forever.
 */
export function rejectCard(
  store: CardStore,
  id: string,
  reviewer: string,
  reason: string,
  now?: Date,
): { card: Card } | { error: string } {
  const card = getCard(store, id);
  if (!card) return { error: `no card ${id}` };
  if (!canTransition(card.state, "retired")) {
    return { error: `cannot reject a ${card.state} card` };
  }
  const retired: Card = {
    ...card,
    state: "retired",
    reviewedBy: reviewer,
    reviewNote: reason,
    updatedAt: (now ?? new Date()).toISOString(),
  };
  writeFileSync(absCardPath(store, retired.id), serializeCard(retired));
  commitTouched(store.dir, [relCardPath(retired.id)], commitMessage("reject", retired));
  return { card: retired };
}

/**
 * Move the trust reading without touching the lifecycle — verification is a fact about the
 * cited code, not a review decision, which is why this takes no reviewer and no guard beyond
 * the card existing. Committed like every other mutation: a card going stale and being
 * withheld from recall is exactly the kind of event the audit trail must show, never silence.
 */
export function setVerifyState(store: CardStore, id: string, verify: VerifyState, now?: Date): Card | null {
  const card = getCard(store, id);
  if (!card) return null;
  const updated: Card = { ...card, verify, updatedAt: (now ?? new Date()).toISOString() };
  writeFileSync(absCardPath(store, updated.id), serializeCard(updated));
  commitTouched(store.dir, [relCardPath(updated.id)], commitMessage("verify", updated));
  return updated;
}
