// The Work board read model (tech design §8, §13): everything a lead or an agent needs to
// decide what to pick up and whether it is on track, assembled from the derivation engine,
// the brief compiler, and receipt history. Read-only and pure over the project — the app
// binds to this and issues COMMANDS separately; nothing here mutates.

import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { workItemBrief, loadApprovedPackets, type MemoryPacket } from "../../kernel.js";
import { deriveWorkState, type DerivedStage } from "./derive.js";
import { cachedOpenPullRequestBranches } from "./pr-observer.js";
import { estimateWork, radiusClass, type Estimate, type ReceiptSample } from "./estimate.js";
import { buildReceiptHistory, type MeasuredReceipt } from "./receipt-history.js";
import { readStoredReceipts } from "./stored-receipts.js";

export interface WorkCardDto {
  work_id: string;
  title: string;
  stage: DerivedStage;
  claimed_by: string | null;
  /** Files the item is grounded to — its blast set. */
  blast_paths: string[];
  /** Commits correlated at explicit/strong confidence, newest first. */
  evidence: Array<{ hash: string; branch: string; confidence: string }>;
  /** Weak-only matches: shown for context, never advanced a stage. */
  weak_evidence: number;
  stage_log: Array<{ stage: string; at: string; caused_by: string[] }>;
  estimate: Estimate;
  /** What the team already knows about this code, the first lines of the brief. */
  knowledge: Array<{ title: string; summary: string }>;
}

export interface WorkBoardDto {
  project_dir: string;
  derived_at: string;
  items: WorkCardDto[];
  /** Stage totals, for the board header. */
  totals: Record<string, number>;
}

// Receipts, joined to work items. This used to hard-return `[]` — receipts are measured per
// agent SESSION and work is tracked per ITEM, and nothing joined the two, so every estimate on
// the board honestly reported `confidence: "none"`. `WorkItemRecord.receipt_ids` is that join.
//
// Still degrades to `[]` when the receipt store is unavailable (an older Node without
// node:sqlite, a runtime that never ran): no history means `none`, which is the truthful
// answer, never a fabricated match.
function receiptHistory(projectDir: string, blastByWorkId: Map<string, string[]>): ReceiptSample[] {
  const receiptsById = new Map<string, MeasuredReceipt>();
  for (const receipt of readStoredReceipts(projectDir)) receiptsById.set(receipt.receipt_id, receipt);
  if (receiptsById.size === 0) return [];
  return buildReceiptHistory(projectDir, { blastByWorkId, receiptsById });
}

// The board is a pure function of on-disk state, and the app re-derives it on every request:
// `GET /v2/work` took 6-10 SECONDS every single page load (2.8s of git walking plus a recall
// per item for the brief). Caching it is safe precisely because it is pure — but only against
// a signature that captures everything capable of changing the answer.
//
// The signature is deliberately content-sensitive, not directory-sensitive: a directory's
// mtime does NOT change when an existing file is edited in place, so keying on the packet
// DIRECTORY would serve a stale board after any packet edit. Per-file mtimes catch that.
interface CachedBoard {
  signature: string;
  board: WorkBoardDto;
}
let boardCache: { project: string; entry: CachedBoard } | null = null;

/**
 * The per-item knowledge cache, kept SEPARATE from the board cache and keyed only on the packet
 * store.
 *
 * Measured, and it is why the board took 38 seconds: each card's knowledge comes from
 * `workItemBrief`, which runs a full `recall` (~3.2s) plus `kageRisk` (~1.6s). Five cards is
 * ~18s of the ~21s total. The board's own signature also folds in every branch tip, so an
 * ordinary commit — or writing a single memory packet — invalidated everything and paid for all
 * five recalls again.
 *
 * Splitting them means a commit rebuilds the cheap part (~2.5s) and REUSES knowledge, because
 * recall depends on the packet store and not on git. Writing a packet still recomputes it, which
 * is correct: the recalled set genuinely may have changed.
 */
const knowledgeCache = new Map<string, { signature: string; knowledge: WorkCardDto["knowledge"] }>();

function gitSignature(projectDir: string): string {
  try {
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: projectDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    // Branch TIPS, not just HEAD: a commit on any observed branch changes the derivation.
    const refs = execFileSync("git", ["for-each-ref", "--format=%(objectname)", "refs/heads"], {
      cwd: projectDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return `${head}|${refs}`;
  } catch {
    return "no-git";
  }
}

/**
 * The packet store's content signature. Deliberately content-sensitive, not directory-sensitive:
 * a directory's mtime does NOT change when an existing file is edited in place, so keying on the
 * packet DIRECTORY would serve stale memory after any packet edit. Per-file mtimes catch that.
 */
function packetSignature(projectDir: string): string {
  const parts: string[] = [];
  const stamp = (path: string): void => {
    try {
      const info = statSync(path);
      parts.push(`${path}:${info.mtimeMs}:${info.size}`);
    } catch { /* absent is itself a stable input */ }
  };
  stamp(join(projectDir, ".agent_memory", "work", "commands.jsonl"));
  const packetsDir = join(projectDir, ".agent_memory", "packets");
  try {
    for (const name of readdirSync(packetsDir).sort()) stamp(join(packetsDir, name));
  } catch { /* no packets yet */ }
  return parts.join("|");
}

function boardSignature(projectDir: string): string {
  return `${gitSignature(projectDir)}|${packetSignature(projectDir)}`;
}

export interface BuildBoardOptions {
  /**
   * Whether each card carries its recalled knowledge titles.
   *
   * Off is roughly 8× faster because it skips one recall + risk report PER CARD. Callers that
   * only need the list — picking a work item to start an agent on, say — should turn it off; the
   * work item DETAIL route carries the full brief anyway, so nothing is lost, it is just not paid
   * for up front.
   */
  knowledge?: boolean;
}

export function buildWorkBoard(projectDir: string, options: BuildBoardOptions = {}): WorkBoardDto {
  const includeKnowledge = options.knowledge !== false;
  const signature = `${boardSignature(projectDir)}|k=${includeKnowledge}`;
  if (boardCache && boardCache.project === projectDir && boardCache.entry.signature === signature) {
    return boardCache.entry.board;
  }
  const board = computeWorkBoard(projectDir, includeKnowledge);
  boardCache = { project: projectDir, entry: { signature, board } };
  return board;
}

function computeWorkBoard(projectDir: string, includeKnowledge = true): WorkBoardDto {
  const derived = deriveWorkState(projectDir, {
    openPullRequestBranches: () => cachedOpenPullRequestBranches(projectDir),
  });
  const packets = new Map<string, MemoryPacket>(
    loadApprovedPackets(projectDir).map((packet) => [packet.id, packet]),
  );
  const blastByWorkId = new Map<string, string[]>(
    [...packets.values()].map((packet) => [packet.id, packet.paths]),
  );
  const history = receiptHistory(projectDir, blastByWorkId);

  // Knowledge depends on the packet store, never on git — so it survives a commit-triggered
  // board rebuild. Computed once here and reused across rebuilds.
  const packetsSig = packetSignature(projectDir);

  const items = derived.items.map((item): WorkCardDto => {
    const packet = packets.get(item.work_id);
    const blast = packet?.paths ?? [];
    let knowledge: WorkCardDto["knowledge"] = [];
    if (includeKnowledge) {
      const cacheKey = `${projectDir}|${item.work_id}`;
      const cached = knowledgeCache.get(cacheKey);
      if (cached && cached.signature === packetsSig) {
        knowledge = cached.knowledge;
      } else {
        try {
          // The expensive call: a full recall plus a risk report, ~4.8s per card measured on a
          // 283-packet store. Everything around it is cheap; this is why the cache exists.
          const brief = workItemBrief(projectDir, item.work_id);
          if (brief.ok) {
            // The brief renders prose; the board wants the recalled titles only. Parse the
            // section rather than re-running recall, so board and brief can never disagree.
            knowledge = brief.brief
              .split("\n")
              .filter((line) => line.startsWith("- ") && line.includes(":"))
              .slice(0, 4)
              .map((line) => {
                const text = line.replace(/^- /, "");
                const split = text.indexOf(": ");
                return split > 0
                  ? { title: text.slice(split + 2), summary: text.slice(0, split) }
                  : { title: text, summary: "" };
              });
          }
          knowledgeCache.set(cacheKey, { signature: packetsSig, knowledge });
        } catch { /* a brief failure must not blank the board */ }
      }
    }

    return {
      work_id: item.work_id,
      title: item.title,
      stage: item.derived_stage,
      claimed_by: item.claimed_by,
      blast_paths: blast,
      evidence: item.correlated_commits.map((commit) => ({
        hash: commit.hash.slice(0, 8),
        branch: commit.branch,
        confidence: commit.confidence,
      })),
      weak_evidence: item.weak_evidence,
      stage_log: item.stage_log,
      estimate: estimateWork({ blast_paths: blast, dependents: 0 }, history),
      knowledge,
    };
  });

  const totals: Record<string, number> = {};
  for (const item of items) totals[item.stage] = (totals[item.stage] ?? 0) + 1;

  return { project_dir: projectDir, derived_at: derived.derived_at, items, totals };
}

export { radiusClass };
