// The idle watcher — the thing that actually makes the Librarian run.
//
// DIRECTION.md puts capture at "session end / idle", and until this module existed nothing in
// production called distillSession: the pipeline was finished and unreachable. Claude Code emits
// no "session ended" event, so idleness is inferred from the only signal there is — the
// transcript's mtime, which advances on every appended turn. A session untouched for long enough
// is over, or at least paused long enough that reading it will not read half a thought.
//
// Every design choice below answers one cost: a distilled session spends the USER's own
// subscription tokens (Kage pays for zero inference, ever). So the watcher remembers what it has
// already read, keyed by the mtime it read it AT, and it marks a session seen after every
// outcome — a proposal, a triage refusal, even a provider that threw. A session that crashes the
// Librarian and is retried on every tick would burn tokens forever and never succeed; recorded
// and stepped past, it costs exactly once.

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { distillSession } from "./librarian.js";
import { ingestProposals } from "./operations.js";
import { appendReceipt } from "./receipts.js";
import { listCards, type CardStore } from "./store.js";
import { claudeTranscriptDir, digestTranscript, listSessionFiles } from "./transcripts.js";
import type { LibrarianProvider, Provenance } from "./types.js";

/**
 * What the watcher has already distilled: transcript path → the mtime it held when we read it.
 *
 * Machine-local by nature — these paths live under the user's home — so the file sits in the
 * store directory untracked and is never committed. The store's mutations only ever `git add`
 * the card paths they touched, so nothing here can leak into a team's shared history.
 */
export interface WatcherState {
  seen: Record<string, number>;
}

const STATE_FILE = "watcher.json";

/**
 * Read the state, or start over.
 *
 * Any failure — absent file, truncated write, someone's hand-edit — reads as "nothing seen".
 * The cost of that is one extra pass over sessions already distilled (the store's content
 * address dedupes what comes back, so no duplicate cards, only spend). The cost of throwing
 * instead would be a capture loop that stays dead until a human deletes a file they don't know
 * about. Between paying twice once and never capturing again, this pays.
 */
export function loadWatcherState(storeDir: string): WatcherState {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(storeDir, STATE_FILE), "utf8"));
    const seen = (parsed as { seen?: unknown } | null)?.seen;
    if (!seen || typeof seen !== "object") return { seen: {} };
    const clean: Record<string, number> = {};
    for (const [path, mtimeMs] of Object.entries(seen as Record<string, unknown>)) {
      // A non-numeric mtime can never equal a real one, so it would silently mean "distil this
      // again forever". Dropping the entry says the same thing once and honestly.
      if (typeof mtimeMs === "number" && Number.isFinite(mtimeMs)) clean[path] = mtimeMs;
    }
    return { seen: clean };
  } catch {
    return { seen: {} };
  }
}

/**
 * Write the state through a temp file and rename.
 *
 * A torn half-written JSON reads back as corrupt, and corrupt degrades to empty (above) — which
 * would re-distil every session on the machine. The rename makes that outcome impossible for the
 * price of two syscalls.
 */
export function saveWatcherState(storeDir: string, state: WatcherState): void {
  const target = join(storeDir, STATE_FILE);
  const temp = `${target}.tmp`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temp, target);
}

export interface IdleSession {
  path: string;
  mtimeMs: number;
  /** The session id — the transcript's basename, which is what provenance records. */
  sessionRef: string;
}

export interface WatcherOptions {
  /** Test seam for the home the transcripts live under; production reads the real one. */
  home?: string;
  idleMs?: number;
  /** Injected clock, so idleness is decided against a time the caller can pin. */
  now?: number;
}

/**
 * Ten minutes. Long enough that a coffee break mid-task is not mistaken for the end — distilling
 * a half-finished session extracts a conclusion nobody reached yet — and short enough that the
 * card is waiting in the Inbox by the time the user comes back to look.
 */
const DEFAULT_IDLE_MS = 600_000;

/**
 * Sessions that have gone quiet and have not been distilled at their current mtime.
 *
 * The seen check compares mtimes rather than asking whether the path is known, and that is the
 * whole reason state is a map instead of a set: a session that resumes after being distilled has
 * new material in it, and the earlier pass only ever saw the first half. Newest first, inherited
 * from listSessionFiles — when a run is capped, the sessions the user just finished are the ones
 * that get read.
 */
export function findIdleSessions(
  projectDir: string,
  state: WatcherState,
  opts: WatcherOptions = {},
): IdleSession[] {
  const idleMs = opts.idleMs ?? DEFAULT_IDLE_MS;
  const now = opts.now ?? Date.now();
  const idle: IdleSession[] = [];
  for (const file of listSessionFiles(claudeTranscriptDir(projectDir, opts.home))) {
    if (now - file.mtimeMs < idleMs) continue;
    if (state.seen[file.path] === file.mtimeMs) continue;
    idle.push({
      path: file.path,
      mtimeMs: file.mtimeMs,
      sessionRef: basename(file.path, ".jsonl"),
    });
  }
  return idle;
}

export interface DistillRunOptions extends WatcherOptions {
  /** Sessions to read in one run. See DEFAULT_LIMIT. */
  limit?: number;
}

/**
 * A fresh install faces a home directory holding every transcript the user has ever produced in
 * this project, none of them seen. Uncapped, the first tick would spawn one headless agent per
 * historical session and wedge whatever dispatched it. The cap costs latency and not knowledge:
 * an unread session is still unseen, so the next run picks it up.
 */
const DEFAULT_LIMIT = 20;

export interface DistillRunSummary {
  /** Sessions the Librarian judged worth extracting from and did. */
  distilled: number;
  /** Sessions that produced nothing — triage said no, or the run failed. The receipt says which. */
  skipped: number;
  proposed: number;
  deduped: number;
  rejected: number;
}

/**
 * One tick of the capture loop: find the quiet sessions, distil them, ingest what survives.
 *
 * Triage rejects ~90% of sessions by design, so `skipped` being the biggest number here is the
 * system working. The one thing that must never happen is a session being read twice, so `seen`
 * is stamped before the work rather than after it — see the file-top comment.
 */
export async function distillIdleSessions(
  provider: LibrarianProvider,
  store: CardStore,
  projectDir: string,
  opts: DistillRunOptions = {},
): Promise<DistillRunSummary> {
  const state = loadWatcherState(store.dir);
  // The same clock the idleness decision used, so a card's provenance and its run's receipt
  // agree about when the run happened.
  const at = new Date(opts.now ?? Date.now()).toISOString();
  const summary: DistillRunSummary = { distilled: 0, skipped: 0, proposed: 0, deduped: 0, rejected: 0 };

  const sessions = findIdleSessions(projectDir, state, opts).slice(0, opts.limit ?? DEFAULT_LIMIT);
  for (const session of sessions) {
    // Stamped first, so every path out of this iteration — including a throw — leaves the
    // session recorded at the mtime we read it at.
    state.seen[session.path] = session.mtimeMs;

    let digest: string;
    try {
      digest = digestTranscript(readFileSync(session.path, "utf8"));
    } catch {
      digest = ""; // Deleted or unreadable between listing and reading. Not our file to demand.
    }
    if (!digest.trim()) {
      // No receipt: nothing ran, nothing was spent, and the ledger records counted events only.
      summary.skipped += 1;
      continue;
    }

    try {
      const outcome = await distillSession(provider, {
        digest,
        sessionRef: session.sessionRef,
        // Read per session, not once per run: a card proposed by the previous session in this
        // very loop is knowledge the reconciler must already see.
        existing: listCards(store),
      });

      if (!outcome.triage.worthIt) {
        summary.skipped += 1;
        appendRun(store.dir, at, session.sessionRef, `nothing durable: ${outcome.triage.reason}`, outcome.usage);
        continue;
      }

      const provenance: Provenance = { source: "session", ref: session.sessionRef, at };
      // Every proposal goes to the gate, including the ones the reconciler called a noop: its
      // verdict is advice for the reviewer, while the store's content address is what actually
      // decides, and a duplicate comes back counted as deduped rather than silently dropped here.
      const ingested = ingestProposals(store, outcome.proposals, provenance);
      summary.distilled += 1;
      summary.proposed += ingested.proposed;
      summary.deduped += ingested.deduped;
      // Refusals from both gates — the Librarian's own and the store's — are the same fact about
      // extraction quality, and splitting them across two numbers would hide half of it.
      summary.rejected += ingested.rejected + outcome.rejected.length;
      appendRun(
        store.dir,
        at,
        session.sessionRef,
        `${ingested.proposed} proposed, ${ingested.deduped} deduped, ${ingested.rejected + outcome.rejected.length} rejected`,
        outcome.usage,
      );
    } catch (error) {
      // The provider died — no binary, a timeout, a network the daemon can't reach. The session
      // stays marked seen (retrying it forever is the failure mode this file exists to prevent),
      // and the receipt names the failure so the card that never appeared is explainable.
      summary.skipped += 1;
      appendRun(store.dir, at, session.sessionRef, `failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  saveWatcherState(store.dir, state);
  return summary;
}

/**
 * One counted run. Usage fields are spread in only when they were MEASURED — a provider that
 * reports nothing leaves them absent, which the Receipts surface renders as a dash. A zero here
 * would read as a measurement claiming the run was free.
 */
function appendRun(
  storeDir: string,
  at: string,
  sessionRef: string,
  detail: string,
  usage?: { inputTokens: number | null; outputTokens: number | null; costUsd: number | null },
): void {
  appendReceipt(storeDir, {
    type: "librarian_run",
    at,
    sessionRef,
    detail,
    ...(usage?.inputTokens != null ? { inputTokens: usage.inputTokens } : {}),
    ...(usage?.outputTokens != null ? { outputTokens: usage.outputTokens } : {}),
    ...(usage?.costUsd != null ? { costUsd: usage.costUsd } : {}),
  });
}
