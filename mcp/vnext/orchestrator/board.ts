// The Work board read model (tech design §8, §13): everything a lead or an agent needs to
// decide what to pick up and whether it is on track, assembled from the derivation engine,
// the brief compiler, and receipt history. Read-only and pure over the project — the app
// binds to this and issues COMMANDS separately; nothing here mutates.

import { workItemBrief, loadApprovedPackets, type MemoryPacket } from "../../kernel.js";
import { deriveWorkState, type DerivedStage } from "./derive.js";
import { cachedOpenPullRequestBranches } from "./pr-observer.js";
import { estimateWork, radiusClass, type Estimate, type ReceiptSample } from "./estimate.js";

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

// Receipts are per-agent-session today and not yet linked to work items, so the board reads
// none and every estimate is honestly "none"/"cold_start" rather than a fabricated match.
// When task->receipt linkage lands this is the only function that changes.
function receiptHistory(): ReceiptSample[] {
  return [];
}

export function buildWorkBoard(projectDir: string): WorkBoardDto {
  const derived = deriveWorkState(projectDir, {
    openPullRequestBranches: () => cachedOpenPullRequestBranches(projectDir),
  });
  const packets = new Map<string, MemoryPacket>(
    loadApprovedPackets(projectDir).map((packet) => [packet.id, packet]),
  );
  const history = receiptHistory();

  const items = derived.items.map((item): WorkCardDto => {
    const packet = packets.get(item.work_id);
    const blast = packet?.paths ?? [];
    let knowledge: WorkCardDto["knowledge"] = [];
    try {
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
    } catch { /* a brief failure must not blank the board */ }

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
