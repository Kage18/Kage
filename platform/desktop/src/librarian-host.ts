// The Librarian, as the desktop app holds it.
//
// `main.ts` supervises processes and windows; this file is the only place that knows the shape of
// a review. It keeps one store handle per repository, converts the core's `Card` into the exact
// object the renderer's Inbox expects, and owns the two decisions the shell genuinely has to make:
// which identity signs an approval, and which binary the Librarian borrows to think with.
//
// It re-implements no step of a review. Approving a card flips state, re-pins citations against the
// tree as it stands now, resolves a supersede, appends a receipt and regenerates the BRIEF block —
// one sequence, owned by `mcp/vnext/librarian/operations.ts`, where it is tested. A surface that
// assembled that sequence itself would eventually assemble it differently, and the two would drift.
//
// Reached through the `KageCore` facade rather than by importing anything: the packaged app ships
// `mcp/dist` WITHOUT node_modules, so every core module is located at runtime and required. See the
// packaging note in kage-core.ts — this repo has paid for that lesson twice.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";

import type { CardStore, KageCore, LibrarianCard } from "./kage-core.js";

/** A card over the IPC bridge. Mirrors `DesktopCard` in platform/web/src/desktop.ts exactly. */
export interface DesktopCard {
  id: string;
  kind: "decision" | "runbook" | "caution";
  state: "proposed" | "approved" | "superseded" | "retired";
  verify: "verified" | "unverified" | "stale";
  title: string;
  claim: string;
  citations: Array<{ path?: string; symbol?: string; ref?: string }>;
  trigger: string;
  provenance: { source: "session" | "mining" | "human"; ref: string; at: string };
  tags: string[];
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface MineOutcome {
  ok: boolean;
  proposed: number;
  rejected: number;
  deduped: number;
  /** Measured when the runner reported usage; null is honest and rendered as such. */
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  error?: string;
}

export interface CardVerdict {
  ok: boolean;
  error?: string;
}

export interface LibrarianHost {
  listCards(repo: string, filter?: { state?: DesktopCard["state"] }): DesktopCard[];
  approve(repo: string, id: string): CardVerdict;
  reject(repo: string, id: string, reason: string): CardVerdict;
  /** Minutes long. Two runs in one repository are refused rather than raced — see `mine` below. */
  mine(repo: string): Promise<MineOutcome>;
  /** Proposals waiting on a human here, or null when the store could not be read at all. */
  proposedCount(repo: string): number | null;
}

/**
 * A mining outcome that never ran, carrying the reason.
 *
 * Exported so `main.ts` never hand-builds the shape: the counts here are zero because this call
 * proposed nothing, and the three usage fields are null because nothing was measured. Those are
 * different kinds of nothing, and the Inbox renders them differently.
 */
export function mineFailed(error: string): MineOutcome {
  return {
    ok: false,
    proposed: 0,
    rejected: 0,
    deduped: 0,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    error,
  };
}

/**
 * Where the Librarian's thinking happens — the user's own `claude`, headless.
 *
 * Resolved rather than assumed, because a GUI app inherits launchd's PATH and not the shell's: a
 * `claude` installed by npm, Homebrew or the native installer is simply invisible to `spawn`, and
 * the failure would otherwise surface as "spawn claude ENOENT" at the end of a mining run the user
 * had been watching. Null means genuinely not found, which is a sentence the Inbox can print.
 */
function resolveClaudeCommand(): string | null {
  if (process.env.KAGE_CLAUDE && existsSync(process.env.KAGE_CLAUDE)) return process.env.KAGE_CLAUDE;
  try {
    const found = execFileSync("/usr/bin/which", ["claude"], { encoding: "utf8" }).trim();
    if (found && existsSync(found)) return found;
  } catch {
    /* not on the app's PATH — fall through to the well-known install locations */
  }
  for (const candidate of [
    join(homedir(), ".claude", "local", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    join(homedir(), ".local", "bin", "claude"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Who signed the approval.
 *
 * The store's own commits are authored by "Kage Librarian", so this field is the only record of
 * which human said yes — and it travels to the whole team with the card. The repository's git
 * identity is therefore the right name: it is the one the team already reads in blame.
 */
function resolveReviewer(repo: string): string {
  try {
    const name = execFileSync("git", ["-C", repo, "config", "--get", "user.name"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (name) return name;
  } catch {
    /* no git identity configured, or not a git repo — the OS account is the next honest answer */
  }
  try {
    return userInfo().username;
  } catch {
    return "desktop";
  }
}

/**
 * Core card → bridge card, field by field rather than by spread.
 *
 * `blobSha` is dropped on purpose: it is the verifier's pin, meaningless to a reviewer, and copying
 * it would put a hash on screen that looks like evidence and is not. Everything the Inbox actually
 * renders — the claim, the citations, the trigger, the provenance — comes across whole.
 */
function toDesktopCard(card: LibrarianCard): DesktopCard {
  return {
    id: card.id,
    kind: card.kind,
    state: card.state,
    verify: card.verify,
    title: card.title,
    claim: card.claim,
    citations: card.citations.map((citation) =>
      "path" in citation
        ? { path: citation.path, ...(citation.symbol ? { symbol: citation.symbol } : {}) }
        : { ref: citation.ref },
    ),
    trigger: card.trigger,
    provenance: card.provenance,
    tags: card.tags,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    ...(card.reviewedBy !== undefined ? { reviewedBy: card.reviewedBy } : {}),
    ...(card.reviewNote !== undefined ? { reviewNote: card.reviewNote } : {}),
  };
}

export function createLibrarianHost(core: KageCore): LibrarianHost {
  // One handle per repository, for the run of the app. `storeFor` is idempotent but not free — it
  // creates and git-inits the shadow repo on first call — and every read below would otherwise pay
  // for that check, including the tray refresh that runs on a timer.
  const stores = new Map<string, CardStore>();
  const reviewers = new Map<string, string>();
  // Repositories with a mining run in flight. A second run would spend the user's tokens on the
  // same history and race the first one's commits into the same store, so it is refused with a
  // sentence rather than started.
  const mining = new Set<string>();

  function storeFor(repo: string): CardStore {
    const cached = stores.get(repo);
    if (cached) return cached;
    // The env override is read HERE because this is the app's edge; the core takes the root as a
    // parameter and reads no environment of its own. Unset — the normal case — means ~/.kage/store,
    // exactly where the CLI looks.
    const store = core.storeFor(repo, process.env.KAGE_STORE_ROOT || undefined);
    stores.set(repo, store);
    return store;
  }

  function reviewerFor(repo: string): string {
    const cached = reviewers.get(repo);
    if (cached) return cached;
    const reviewer = resolveReviewer(repo);
    reviewers.set(repo, reviewer);
    return reviewer;
  }

  return {
    listCards(repo, filter) {
      return core.listCards(storeFor(repo), filter).map(toDesktopCard);
    },

    approve(repo, id) {
      const result = core.approveCard(storeFor(repo), repo, id, reviewerFor(repo));
      return result.ok ? { ok: true } : { ok: false, error: result.error ?? "the approval was refused" };
    },

    reject(repo, id, reason) {
      const result = core.rejectCard(storeFor(repo), id, reviewerFor(repo), reason);
      return result.ok ? { ok: true } : { ok: false, error: result.error ?? "the rejection was refused" };
    },

    /**
     * Day-one mining, off the main process's back.
     *
     * The minutes are spent inside `claude -p`, which the core runs as an async child process, so
     * the event loop keeps turning the whole time: the window stays live, other reads still land,
     * and the renderer simply holds its "Mining history…" state until this promise settles. The only
     * synchronous work is git plumbing on either side of that call — one `git log` for the digest,
     * then at most ten small commits into the shadow store.
     */
    async mine(repo) {
      if (mining.has(repo)) return mineFailed("a mining run is already going in this repository");
      const command = resolveClaudeCommand();
      if (!command) {
        return mineFailed(
          "Kage could not find the `claude` command. Mining runs on your own Claude subscription — " +
            "install Claude Code, or point KAGE_CLAUDE at the binary.",
        );
      }

      mining.add(repo);
      try {
        const summary = await core.mineRepository(
          // cwd is the repository, so the run reads the project the cards will describe.
          //
          // Ten minutes rather than the core's three: that default exists to stop a hung runner
          // wedging the daemon that dispatched it, and there is no queue here — one window, one
          // visible spinner, one button the user pressed on purpose. Extraction over two hundred
          // commits of history genuinely outlasts three minutes. It is still a bound, and the same
          // bound decides how long an orphaned run survives the app being quit mid-mine.
          core.claudeProvider({ command, cwd: repo, timeoutMs: 600_000 }),
          storeFor(repo),
          repo,
        );
        return {
          ok: summary.ok,
          proposed: summary.proposed,
          rejected: summary.rejected,
          deduped: summary.deduped,
          inputTokens: summary.inputTokens,
          outputTokens: summary.outputTokens,
          costUsd: summary.costUsd,
          ...(summary.error !== undefined ? { error: summary.error } : {}),
        };
      } catch (error) {
        // `mineRepository` reports a failed run rather than throwing, so reaching here means the
        // store or the core itself failed. Still a report: the user pressed a button.
        return mineFailed(error instanceof Error ? error.message : String(error));
      } finally {
        mining.delete(repo);
      }
    },

    proposedCount(repo) {
      try {
        return core.listCards(storeFor(repo), { state: "proposed" }).length;
      } catch {
        // A store that cannot be opened — no git on PATH, an unreadable home — contributes NOTHING
        // to the badge rather than a zero. Zero is a count; this is the absence of one.
        return null;
      }
    },
  };
}
