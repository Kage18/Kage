// Manager judgment, recorded.
//
// The manager's contribution — which memories belong in a brief, whether to ask before
// spending, how confident to be, which learnings are durable — was previously invisible:
// prose in a constitution with no trace. By Kage's own rule, an unrecorded act did not
// happen, so this module makes judgment a first-class artifact the kernel validates,
// stores, and reports on.
//
// The kernel does not trust the judgment it is handed: drops must reference memories
// that were actually offered, every drop needs a reason, and confidence may only be
// lowered. Rejected moves are recorded as violations rather than silently ignored.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runDir } from "./contract.js";

export type ConfidenceBand = "low" | "medium" | "high";
const BAND_ORDER: ConfidenceBand[] = ["low", "medium", "high"];

export interface MemoryDrop {
  id: string;
  reason: string;
}

export interface LearningJudgment {
  kept: string[];
  dropped: MemoryDrop[];
}

export interface ManagerJudgment {
  schema_version: 1;
  run_id: string;
  at: string;
  /** Everything recall offered the manager. */
  offered_memory_ids: string[];
  kept_memory_ids: string[];
  dropped: MemoryDrop[];
  confidence: { kernel: ConfidenceBand; manager: ConfidenceBand; reason?: string };
  /** The question asked before spending tokens, and what the human said. */
  clarification?: { question: string; answer?: string };
  notes?: string;
  learnings?: LearningJudgment;
  /** Moves the kernel refused, kept on the record. */
  violations: string[];
}

export interface JudgmentInput {
  offeredMemoryIds: string[];
  dropMemoryIds?: Array<{ id: string; reason?: string }>;
  kernelConfidence: ConfidenceBand;
  managerConfidence?: string;
  confidenceReason?: string;
  clarification?: { question: string; answer?: string };
  notes?: string;
}

export function buildJudgment(runId: string, input: JudgmentInput): ManagerJudgment {
  const violations: string[] = [];
  const offered = new Set(input.offeredMemoryIds);
  const dropped: MemoryDrop[] = [];

  for (const drop of input.dropMemoryIds ?? []) {
    if (!offered.has(drop.id)) {
      violations.push(`dropped a memory that was never offered: ${drop.id}`);
      continue;
    }
    const reason = (drop.reason ?? "").trim();
    if (!reason) {
      // A drop without a reason is an unexplained edit to what the agent will know.
      violations.push(`dropped ${drop.id} without a reason — kept it instead`);
      continue;
    }
    dropped.push({ id: drop.id, reason });
  }

  const droppedIds = new Set(dropped.map((entry) => entry.id));
  const kept = input.offeredMemoryIds.filter((id) => !droppedIds.has(id));

  // Confidence is earned from the track record. A manager may temper it; it may never
  // inflate it, because the number is what the human uses to decide how closely to look.
  let managerBand = input.kernelConfidence;
  const requested = String(input.managerConfidence ?? "").trim().toLowerCase();
  if (requested) {
    if (!BAND_ORDER.includes(requested as ConfidenceBand)) {
      violations.push(`unknown confidence band "${requested}" — kept ${input.kernelConfidence}`);
    } else if (BAND_ORDER.indexOf(requested as ConfidenceBand) > BAND_ORDER.indexOf(input.kernelConfidence)) {
      violations.push(`tried to raise confidence ${input.kernelConfidence} → ${requested} — refused`);
    } else {
      managerBand = requested as ConfidenceBand;
    }
  }

  return {
    schema_version: 1,
    run_id: runId,
    at: new Date().toISOString(),
    offered_memory_ids: input.offeredMemoryIds,
    kept_memory_ids: kept,
    dropped,
    confidence: {
      kernel: input.kernelConfidence,
      manager: managerBand,
      ...(input.confidenceReason ? { reason: input.confidenceReason } : {}),
    },
    ...(input.clarification?.question ? { clarification: input.clarification } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    violations,
  };
}

function judgmentPath(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "manager.json");
}

export function writeJudgment(projectDir: string, judgment: ManagerJudgment): void {
  const path = judgmentPath(projectDir, judgment.run_id);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(judgment, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function readJudgment(projectDir: string, runId: string): ManagerJudgment | null {
  const path = judgmentPath(projectDir, runId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ManagerJudgment;
  } catch {
    return null;
  }
}

/** Record which proposed learnings the manager considered durable. */
export function recordLearningJudgment(
  projectDir: string,
  runId: string,
  proposed: string[],
  keep: string[] | undefined,
  reasons: Record<string, string> = {},
): ManagerJudgment | null {
  const judgment = readJudgment(projectDir, runId);
  if (!judgment) return null;
  const kept = keep ? proposed.filter((item) => keep.includes(item)) : proposed;
  const dropped = proposed
    .filter((item) => !kept.includes(item))
    .map((item) => ({ id: item, reason: reasons[item] ?? "manager judged it not durable" }));
  const updated: ManagerJudgment = { ...judgment, learnings: { kept, dropped } };
  writeJudgment(projectDir, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// The review gate: a run reaching "ready" means the KERNEL verified it — checks ran,
// a diff exists. It does not mean anyone with judgment looked at it. kage_review_run
// (mcp/index.ts) records that second, human-shaped pass the same way this file already
// records brief judgment: an artifact the kernel stores and a card can render, not prose
// that evaporates once the manager's next reply overwrites it.

export type ReviewVerdict = "approve" | "request_changes";

export interface ReviewRecord {
  schema_version: 1;
  run_id: string;
  at: string;
  verdict: ReviewVerdict;
  notes?: string;
}

function reviewPath(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "review.json");
}

export function writeReview(projectDir: string, review: ReviewRecord): void {
  const path = reviewPath(projectDir, review.run_id);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function readReview(projectDir: string, runId: string): ReviewRecord | null {
  const path = reviewPath(projectDir, runId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ReviewRecord;
  } catch {
    return null;
  }
}

/** Human-readable section for the verbose receipt — same shape renderJudgment renders. */
export function renderReview(review: ReviewRecord | null): string[] {
  if (!review) return ["REVIEW", "  (none — not yet reviewed)"];
  const lines = ["REVIEW", `  verdict: ${review.verdict}`];
  if (review.notes) lines.push(`  notes: ${review.notes}`);
  return lines;
}

/** Human-readable section for the verbose receipt. */
export function renderJudgment(judgment: ManagerJudgment | null): string[] {
  if (!judgment) {
    return [
      "MANAGER JUDGMENT",
      "  (none — this brief used kernel defaults: every recalled memory, unedited confidence)",
    ];
  }
  const lines = ["MANAGER JUDGMENT"];
  lines.push(`  memories: kept ${judgment.kept_memory_ids.length} of ${judgment.offered_memory_ids.length} offered`);
  for (const drop of judgment.dropped) lines.push(`    − dropped ${drop.id}: ${drop.reason}`);
  const { kernel, manager, reason } = judgment.confidence;
  lines.push(
    kernel === manager
      ? `  confidence: ${manager} (unchanged from the track record)`
      : `  confidence: lowered ${kernel} → ${manager}${reason ? ` — ${reason}` : ""}`,
  );
  if (judgment.clarification) {
    lines.push(`  asked first: ${judgment.clarification.question}`);
    if (judgment.clarification.answer) lines.push(`    answered: ${judgment.clarification.answer}`);
  }
  if (judgment.notes) lines.push(`  note: ${judgment.notes}`);
  if (judgment.learnings) {
    lines.push(`  learnings: kept ${judgment.learnings.kept.length}, dropped ${judgment.learnings.dropped.length}`);
    for (const drop of judgment.learnings.dropped) lines.push(`    − ${drop.id}: ${drop.reason}`);
  }
  for (const violation of judgment.violations) lines.push(`  ! refused: ${violation}`);
  return lines;
}
