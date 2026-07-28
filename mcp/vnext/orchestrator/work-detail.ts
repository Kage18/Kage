// The work item detail read model (tech design §8): everything about ONE item, which the
// board deliberately does not show. The board answers "what should I pick up"; this answers
// "what exactly is this, what does it touch, and how do we know what stage it is in".
//
// The stage log is the point. Every card on the board carries a stage nobody typed, so the
// obvious question is "why does it say that" — and the answer has to be inspectable, commit
// by commit, or the derivation is just a different kind of magic status field.

import { workItemBrief, loadApprovedPackets } from "../../kernel.js";
import { deriveWorkState } from "./derive.js";
import { cachedOpenPullRequestBranches } from "./pr-observer.js";
import { estimateWork, type Estimate } from "./estimate.js";

export interface StageStepDto {
  stage: string;
  at: string;
  /** Commit hashes, command event ids, or `pr:<branch>` — whatever actually caused the step. */
  caused_by: string[];
  /** Rendered explanation of the evidence, so a reader need not decode ids. */
  evidence_label: string;
}

export interface WorkDetailDto {
  work_id: string;
  title: string;
  body: string;
  stage: string;
  stored_stage: string;
  claimed_by: string | null;
  blast_paths: string[];
  /** Files that depend on the blast set — the radius beyond what the item cites. */
  dependents: string[];
  stage_log: StageStepDto[];
  evidence: Array<{ hash: string; branch: string; confidence: string }>;
  weak_evidence: number;
  estimate: Estimate;
  knowledge: Array<{ title: string; summary: string }>;
  errors: string[];
}

function evidenceLabel(step: { stage: string; caused_by: string[] }): string {
  const first = step.caused_by[0] ?? "";
  if (first.startsWith("pr:")) return `open pull request on ${first.slice(3)}`;
  if (first.startsWith("cmd-")) return "a logged command";
  if (first.startsWith("packet:")) return "the proposal itself";
  if (step.caused_by.length > 1) return `${step.caused_by.length} correlated commits`;
  return first ? `commit ${first.slice(0, 8)}` : "no evidence recorded";
}

/** Null when the id is not a work item at all — the caller renders a 404, not an empty page. */
export function buildWorkDetail(projectDir: string, workId: string): WorkDetailDto | null {
  const derived = deriveWorkState(projectDir, {
    openPullRequestBranches: () => cachedOpenPullRequestBranches(projectDir),
  }).items.find((item) => item.work_id === workId);
  if (!derived) return null;

  const packet = loadApprovedPackets(projectDir).find((entry) => entry.id === workId);
  const blast = packet?.paths ?? [];

  // The brief is the same one an agent receives. Board and detail and agent must not diverge,
  // so all three read this rather than each re-running recall with its own query.
  let knowledge: WorkDetailDto["knowledge"] = [];
  let dependents: string[] = [];
  let body = packet?.body ?? "";
  const errors: string[] = [];
  try {
    const brief = workItemBrief(projectDir, workId);
    if (brief.ok) {
      body = brief.work_item?.body ?? body;
      dependents = brief.blast_radius.filter((path) => !blast.includes(path));
      knowledge = brief.brief
        .split("\n")
        .filter((line) => line.startsWith("- ") && line.includes(": "))
        .slice(0, 6)
        .map((line) => {
          const text = line.replace(/^- /, "");
          const split = text.indexOf(": ");
          return { title: text.slice(split + 2), summary: text.slice(0, split) };
        });
    } else {
      errors.push(...brief.errors);
    }
  } catch (error) {
    // A brief failure costs detail, never the page.
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return {
    work_id: derived.work_id,
    title: derived.title,
    body,
    stage: derived.derived_stage,
    stored_stage: derived.stored_stage,
    claimed_by: derived.claimed_by,
    blast_paths: blast,
    dependents,
    stage_log: derived.stage_log.map((step) => ({
      stage: step.stage,
      at: step.at,
      caused_by: step.caused_by,
      evidence_label: evidenceLabel(step),
    })),
    evidence: derived.correlated_commits.map((commit) => ({
      hash: commit.hash.slice(0, 8),
      branch: commit.branch,
      confidence: commit.confidence,
    })),
    weak_evidence: derived.weak_evidence,
    // Receipts are not yet linked to work items, so this reports `none` rather than a
    // fabricated match — the same honesty the board and the Proof page hold to.
    estimate: estimateWork({ blast_paths: blast, dependents: dependents.length }, []),
    knowledge,
    errors,
  };
}
