// Sharing memory — the whole reason the store is a git repository and not a database.
//
// DIRECTION.md's team tier is one sentence: "Solo: no remote, fully offline. Team: add a remote
// on the git host the team already trusts." This file is that sentence made executable. There is
// no server here, no account, no bespoke sync protocol and no conflict algebra of our own,
// because the shadow store is already a repo: sharing is `git remote add`, sending is `push`,
// receiving is `fetch` + `merge`, and the audit trail teams ask for is the log they already know
// how to read. Every line of sync code we do not write is a line that cannot lose someone's card.
//
// Three rules hold this module together:
//
//   Nothing here throws. A store with no remote is the solo case — the majority case, and free
//   forever — so it must read as `configured: false`, never as an error a surface has to catch.
//   Network failures are values too: an offline laptop reports, it does not crash the app.
//
//   Conflicts are escalated, never resolved. Cards are one file each and content-addressed, so
//   real collisions are rare — but when two people assert different things about the same code,
//   that is a question for a human. Auto-picking a side would silently delete somebody's
//   knowledge, which is the one failure a memory product cannot come back from. We leave the
//   merge in place, hand back the card ids, and say so.
//
//   Remote URLs are validated before they reach git. This string ends up in `.git/config` and on
//   a git command line, and git has transports that execute commands (`ext::sh -c …`) and options
//   that spawn helpers (`--upload-pack=…`). Checking the shape here is the difference between a
//   configuration field and a remote-code-execution surface.

import { execFileSync } from "node:child_process";

import { readReceipts } from "./receipts.js";
import { listCards, type CardStore } from "./store.js";
import type { Card } from "./types.js";

// ── Git plumbing ─────────────────────────────────────────────────────────────────────────────

/** A git run as a value. Failure is data here — every caller in this file reports, none throw. */
interface GitRun {
  ok: boolean;
  out: string;
  err: string;
}

/**
 * A network git call can outlive the user's patience: a wrong URL, a VPN that is down, a host
 * that black-holes packets. The desktop app calls this on a button press, so it gets a ceiling.
 */
const NETWORK_TIMEOUT_MS = 60_000;

function run(dir: string, args: string[], opts?: { network?: boolean }): GitRun {
  try {
    const out = execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      // Piped, never inherited — this is a library, and its plumbing must not write to the
      // caller's terminal or the app's stdout.
      stdio: ["ignore", "pipe", "pipe"],
      ...(opts?.network
        ? {
            timeout: NETWORK_TIMEOUT_MS,
            env: {
              ...process.env,
              // Headless means no human is there to type a password. Without these, a private
              // remote turns "sync" into a hung process with no output and no way to cancel.
              GIT_TERMINAL_PROMPT: "0",
              GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes",
            },
          }
        : {}),
    });
    return { ok: true, out: out.trim(), err: "" };
  } catch (error) {
    const failure = error as { stderr?: string | Buffer; stdout?: string | Buffer; message?: string };
    const err = String(failure.stderr ?? "").trim() || failure.message?.trim() || "git failed";
    return { ok: false, out: String(failure.stdout ?? "").trim(), err };
  }
}

/**
 * Identity pinned exactly as store.ts pins it for card commits: a merge is a store event,
 * attributable to the store rather than to whatever ~/.gitconfig happens to say, and signing is
 * forced off because this runs headless and must never block on a key prompt.
 */
const COMMIT_IDENTITY = [
  "-c", "user.name=Kage Librarian",
  "-c", "user.email=librarian@kage.local",
  "-c", "commit.gpgsign=false",
];

/** "" when the store is detached or not a repo — callers refuse rather than guess a branch. */
function currentBranch(dir: string): string {
  const head = run(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!head.ok) return "";
  return head.out === "HEAD" ? "" : head.out;
}

function countOf(result: GitRun): number {
  const n = Number(result.out);
  return result.ok && Number.isFinite(n) ? n : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────────────────────

export interface RemoteStatus {
  configured: boolean;
  url: string | null;
  /** Local commits the remote does not have. One commit is one mutation, so this counts cards. */
  ahead: number;
  /** Commits waiting on the remote, as of the last fetch — pull is what makes this current. */
  behind: number;
  branch: string;
  dirty: boolean;
  error?: string;
}

/**
 * What sharing looks like right now. Never throws, and never reports the solo case as a problem:
 * a store with no remote is a supported, free-forever configuration, so it reads
 * `configured: false` and the surface renders an invitation rather than a failure.
 *
 * `ahead` has one definition in both branches below — "commits the remote does not have" — which
 * is why a configured-but-never-pushed store reports its whole history as ahead instead of
 * reporting 0. A zero there would read as "in sync" on a store that has never shared a byte, and
 * this product does not display numbers it has not measured.
 */
export function remoteStatus(store: CardStore): RemoteStatus {
  const branch = currentBranch(store.dir);
  // Untracked files are excluded on purpose: the receipts ledger is deliberately never committed
  // (it is one machine's counted events), so counting it would leave every store permanently
  // "dirty" and the flag would stop meaning anything. Tracked changes — chiefly a merge a human
  // has not finished resolving — are what a person needs to be warned about before they push.
  const status = run(store.dir, ["status", "--porcelain", "--untracked-files=no"]);
  const dirty = status.ok && status.out.length > 0;

  const remote = run(store.dir, ["remote", "get-url", "origin"]);
  if (!remote.ok || !remote.out) {
    return {
      configured: false,
      url: null,
      ahead: 0,
      behind: 0,
      branch,
      dirty,
      // An unreadable store is a real error; a store with no origin is not. Only the former
      // gets to say something went wrong.
      ...(status.ok ? {} : { error: status.err }),
    };
  }

  // left = commits only upstream has (behind), right = commits only we have (ahead).
  const divergence = run(store.dir, ["rev-list", "--left-right", "--count", "@{u}...HEAD"]);
  if (divergence.ok) {
    const [behind, ahead] = divergence.out.split(/\s+/).map((n) => Number(n));
    return {
      configured: true,
      url: remote.out,
      ahead: Number.isFinite(ahead) ? ahead : 0,
      behind: Number.isFinite(behind) ? behind : 0,
      branch,
      dirty,
    };
  }

  // No upstream yet — the remote was configured but nothing has been pushed, so every local
  // commit is unshared. Behind stays 0 because we have never fetched anything to be behind of;
  // the first pull is what makes that number mean something.
  return {
    configured: true,
    url: remote.out,
    ahead: countOf(run(store.dir, ["rev-list", "--count", "HEAD"])),
    behind: 0,
    branch,
    dirty,
  };
}

// ── Configuring the remote ───────────────────────────────────────────────────────────────────

/**
 * The shapes git can be trusted with. Everything else is refused before it is written anywhere,
 * because this string is handed to git twice — once as an argv, once as a config value — and git
 * treats some strings as instructions:
 *
 *   `ext::sh -c "curl …"` is a real transport that RUNS the command.
 *   `--upload-pack=…` in argv position is an option, not a URL, and spawns a program.
 *   A newline in a config value can forge additional `.git/config` keys.
 *
 * So: an allowlist of the four ways a team actually shares a repo, no control characters, and
 * nothing that could be read as a flag. A local path is written as a path, not as `file://`.
 */
function isSharableRemoteUrl(url: string): boolean {
  if (!url || url !== url.trim()) return false;
  // Control characters first: a newline inside a config value can forge extra .git/config keys.
  if (/[\u0000-\u001f\u007f]/.test(url)) return false;
  if (url.startsWith("-")) return false;
  if (/^https?:\/\/\S+$/.test(url)) return true;
  if (/^ssh:\/\/\S+$/.test(url)) return true;
  if (/^git@[^\s:/]+:\S+$/.test(url)) return true; // scp-style, what every git host prints
  // An absolute path may contain spaces (a shared drive, a bare repo in a home directory) and
  // that is safe: nothing here goes through a shell, arguments are passed as argv.
  return url.startsWith("/");
}

/**
 * Point this store at the team's remote. Idempotent: setting a different URL on a store that
 * already has an origin re-points it rather than failing, because "we moved the store to a new
 * host" is a normal Tuesday and should not require deleting anything.
 */
export function setRemote(store: CardStore, url: string): { ok: boolean; error?: string } {
  if (!isSharableRemoteUrl(url)) {
    return {
      ok: false,
      // Quoted, because a rejected value may itself contain newlines — echoing it raw would let
      // the refused string reshape the message that refuses it.
      error: `not a shareable git remote: ${JSON.stringify(url)} — use https://, ssh://, git@host:path, or an absolute path`,
    };
  }
  const existing = run(store.dir, ["remote", "get-url", "origin"]);
  const result = existing.ok && existing.out
    ? run(store.dir, ["remote", "set-url", "origin", url])
    : run(store.dir, ["remote", "add", "origin", url]);
  return result.ok ? { ok: true } : { ok: false, error: result.err };
}

// ── Sending ──────────────────────────────────────────────────────────────────────────────────

export interface PushResult {
  ok: boolean;
  /** Commits shared. One mutation is one commit, so this is "how much memory left this machine". */
  pushed: number;
  error?: string;
}

/**
 * Share everything this machine has approved. `--set-upstream` on every push rather than only the
 * first: it is idempotent, and it re-heals a store whose tracking config was lost or whose remote
 * was re-pointed, so the ahead/behind reading above cannot silently go blind.
 *
 * Never `--force`. A rejected push means someone else pushed first, and the honest answer is
 * "pull, look at what arrived, then push" — not "overwrite your colleague".
 */
export function pushCards(store: CardStore): PushResult {
  const status = remoteStatus(store);
  if (!status.configured) {
    return { ok: false, pushed: 0, error: "no remote configured — this store is solo" };
  }
  if (!status.branch) {
    return { ok: false, pushed: 0, error: "the store has no branch checked out" };
  }
  // Nothing to send is a success with nothing counted, and it costs no network call — a store
  // that is already in sync must not fail just because the laptop is offline.
  if (status.ahead === 0) return { ok: true, pushed: 0 };

  const push = run(store.dir, ["push", "--set-upstream", "origin", status.branch], { network: true });
  if (!push.ok) return { ok: false, pushed: 0, error: push.err };
  // Counted before the push, from the divergence git itself reported — not estimated from the
  // push output, which is prose.
  return { ok: true, pushed: status.ahead };
}

// ── Receiving ────────────────────────────────────────────────────────────────────────────────

export interface PullResult {
  ok: boolean;
  /** Card files that changed on disk because of this pull — the honest "what arrived" number. */
  merged: number;
  /** Ids of cards two people wrote differently. Returned for a human, never resolved here. */
  conflicts: string[];
  error?: string;
}

const CARD_PATH = /^cards\/(card_[0-9a-f]{8})\.md$/;

/** Paths git reports as unmerged, split into the knowledge ones and the housekeeping ones. */
function unmergedPaths(dir: string): string[] {
  return run(dir, ["diff", "--name-only", "--diff-filter=U"])
    .out.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Fetch and merge the team's cards.
 *
 * `--allow-unrelated-histories` is deliberate and load-bearing. Two teammates each open a store
 * for the same product repo before anyone adds a remote, so each store is born with its own root
 * commit; git's guard exists to stop someone accidentally welding two source trees together, but
 * a card store is a SET of independent one-file documents with content-addressed ids, and union
 * is exactly the right merge for it. Without this flag the very first team sync fails, forever.
 *
 * Conflicts under cards/ are handed back, not resolved — see the file header. Conflicts anywhere
 * else (in practice the README signpost each store writes at init) are store-local cosmetics
 * rather than knowledge, so those we settle in favour of this machine and carry on; blocking a
 * team's first sync on a README would be absurd.
 */
export function pullCards(store: CardStore): PullResult {
  const status = remoteStatus(store);
  if (!status.configured) {
    return { ok: false, merged: 0, conflicts: [], error: "no remote configured — this store is solo" };
  }
  if (!status.branch) {
    return { ok: false, merged: 0, conflicts: [], error: "the store has no branch checked out" };
  }

  const fetched = run(store.dir, ["fetch", "origin"], { network: true });
  if (!fetched.ok) return { ok: false, merged: 0, conflicts: [], error: fetched.err };

  const remoteRef = `origin/${status.branch}`;
  if (!run(store.dir, ["rev-parse", "--verify", "--quiet", `${remoteRef}^{commit}`]).ok) {
    // The remote exists but nobody has pushed this branch yet. That is the first day of a team,
    // not a failure: nothing arrived because nothing was sent.
    return { ok: true, merged: 0, conflicts: [] };
  }

  const before = run(store.dir, ["rev-parse", "HEAD"]).out;
  const merge = run(store.dir, [
    ...COMMIT_IDENTITY,
    "merge",
    "--no-edit",
    "--allow-unrelated-histories",
    remoteRef,
  ]);

  if (!merge.ok) {
    const unmerged = unmergedPaths(store.dir);
    const cards = unmerged.filter((path) => path.startsWith("cards/"));
    if (cards.length > 0) {
      // Stop here, on purpose, with the merge still in progress. The worktree now holds both
      // versions with conflict markers and `git status` explains itself — a human can resolve it
      // with the tools they already have, and until they do, remoteStatus reports the store dirty.
      return {
        ok: false,
        merged: 0,
        conflicts: cards.map((path) => CARD_PATH.exec(path)?.[1] ?? path),
        error:
          `${cards.length} card(s) were written differently by two people; ` +
          `the merge is left in ${store.dir} for you to resolve, then commit`,
      };
    }
    if (unmerged.length === 0) {
      // Not a conflict at all — a dirty worktree, a missing object, a broken index. Report it.
      return { ok: false, merged: 0, conflicts: [], error: merge.err };
    }
    for (const path of unmerged) {
      const ours = run(store.dir, ["checkout", "--ours", "--", path]);
      if (!ours.ok) return { ok: false, merged: 0, conflicts: [], error: ours.err };
      const staged = run(store.dir, ["add", "--", path]);
      if (!staged.ok) return { ok: false, merged: 0, conflicts: [], error: staged.err };
    }
    const finish = run(store.dir, [...COMMIT_IDENTITY, "commit", "--no-edit"]);
    if (!finish.ok) return { ok: false, merged: 0, conflicts: [], error: finish.err };
  }

  // What actually landed, measured against the tree: card files added or changed between the
  // commit we were on and the one we are on now. "Already up to date" honestly reports 0.
  const changed = run(store.dir, ["diff", "--name-only", before, "HEAD", "--", "cards"])
    .out.split("\n")
    .filter((line) => CARD_PATH.test(line.trim()));
  return { ok: true, merged: changed.length, conflicts: [] };
}

// ── The team scoreboard ──────────────────────────────────────────────────────────────────────

export interface CrossPollination {
  total: number;
  byAuthor: Array<{ author: string; delivered: number }>;
}

/**
 * Who a card belongs to, as a person.
 *
 * The approver wins over the proposer because approval is where team knowledge is born: the
 * Librarian drafts, a human takes responsibility, and `reviewedBy` is the only field that names
 * a human by name. `provenance.ref` is a session id ("s-42") or a mining range ("history:200")
 * for everything except human-authored cards — a run, not a person.
 *
 * null when nothing names a human. That card is real knowledge, but it cannot be credited to
 * anyone, and inventing an author would be exactly the kind of fabricated number this product
 * exists to stop shipping.
 */
export function cardAuthor(card: Card): string | null {
  const reviewer = card.reviewedBy?.trim();
  if (reviewer) return reviewer;
  const proposer = card.provenance?.source === "human" ? card.provenance.ref.trim() : "";
  return proposer || null;
}

/**
 * The one team number that is honest: how often somebody else's card was delivered into YOUR
 * agent, counted from your own receipts.
 *
 * This is deliberately not "repeat failures prevented" — that needs a counterfactual run of a
 * world where the memory did not exist, which nobody can perform, and the old product died
 * shipping exactly that kind of estimate. A recall_served receipt for a card another human
 * approved is a fact: their knowledge reached your session, on this machine, at that timestamp.
 *
 * Deliveries of the same card count each time. A card that answered ten questions helped ten
 * times, and collapsing that to "1 card" would undersell the only thing worth measuring.
 */
export function crossPollination(store: CardStore, me: string): CrossPollination {
  const mine = me.trim().toLowerCase();
  // With no identity there is no "somebody else" to measure against. Counting every attributed
  // delivery as cross-pollination would flatter the number by exactly the amount you contributed.
  if (!mine) return { total: 0, byAuthor: [] };

  const authorOfCard = new Map<string, string>();
  for (const card of listCards(store)) {
    const author = cardAuthor(card);
    if (author) authorOfCard.set(card.id, author);
  }

  let total = 0;
  // Keyed by the folded name so "Dana" and "dana" are one teammate. The value keeps the spelling
  // from the most recent delivery — receipts read newest first, so the first one seen wins —
  // because a scoreboard that renames people is a scoreboard nobody trusts.
  const tally = new Map<string, { author: string; delivered: number }>();
  for (const event of readReceipts(store.dir)) {
    if (event.type !== "recall_served" || !event.cardId) continue;
    const author = authorOfCard.get(event.cardId);
    // No author means the card is gone from the store or names no human — either way it cannot
    // be credited to a teammate.
    if (!author) continue;
    const key = author.toLowerCase();
    if (key === mine) continue;
    total += 1;
    const entry = tally.get(key) ?? { author, delivered: 0 };
    entry.delivered += 1;
    tally.set(key, entry);
  }

  return {
    total,
    // Most delivered first, name as the tiebreak — the same receipts always render the same board.
    byAuthor: [...tally.values()].sort(
      (a, b) => b.delivered - a.delivered || a.author.localeCompare(b.author),
    ),
  };
}
