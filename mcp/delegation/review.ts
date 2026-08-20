// Agent-executed review gate. Modeled on ratify.ts's merge step and dispatch.ts's
// executeRun: hire a reviewer through the same Adapter abstraction every coding run
// uses (claude/codex/stub), never trust its prose, parse a structured fence, and write
// what happened to disk the same way a claim does.
//
// This is opt-in (contract.ts's review_required) and distinct from mcp/index.ts's
// kage_review_run tool: that one records the delegation MANAGER's own advisory verdict
// on a "ready" run (manager.ts's ReviewRecord, review.json) and never moves kernel
// state. reviewRun below hires an independent agent to judge the diff, and its verdict
// DOES move kernel state (ready -> reviewing -> approved | changes_requested) — see the
// long comment on REVIEW_PROTOCOL_VERSION in contract.ts for why the two mechanisms use
// different filenames and different verdict vocabularies rather than sharing either.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Adapter } from "./adapters/types.js";
import {
  type ClaimRecord,
  type ReviewVerdict,
  type RunView,
  type TaskRecord,
  REVIEW_PROTOCOL_INSTRUCTIONS,
  appendRunLedger,
  parseReviewFence,
  readClaim,
  readRun,
  runDir,
  runEvidenceDir,
  runWorkDir,
  transitionRun,
} from "./contract.js";
import { currentBranch, git } from "./git.js";
import { writeEvidence } from "./verify.js";
import { worktreePath } from "./worktree.js";

export interface AgentReviewRecord {
  schema_version: 1;
  run_id: string;
  at: string;
  verdict: ReviewVerdict;
  findings: string[];
  /** false whenever the reviewer's final message carried no valid kage-review fence —
   * the verdict is a safe default (changes_requested) in that case, never a guess. */
  protocol_ok: boolean;
}

// Deliberately NOT "review.json" — that name is already owned by manager.ts's
// ReviewRecord (the human/manager advisory note). Two different records with the same
// filename would silently clobber each other the moment both mechanisms touch one run.
function agentReviewPath(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "agent-review.json");
}

export function writeAgentReview(projectDir: string, review: AgentReviewRecord): void {
  const path = agentReviewPath(projectDir, review.run_id);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function readAgentReview(projectDir: string, runId: string): AgentReviewRecord | null {
  const path = agentReviewPath(projectDir, runId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as AgentReviewRecord;
  } catch {
    return null;
  }
}

// A prompt this large would blow the reviewer's own context for no benefit — it still
// has Read/Grep/Bash in workDir (the run's own worktree, still present at "ready") to
// look further if the excerpt below is not enough.
const MAX_DIFF_CHARS = 60_000;

function renderReviewBrief(task: TaskRecord, claim: ClaimRecord, diffText: string): string {
  const truncated = diffText.length > MAX_DIFF_CHARS;
  const body = truncated ? diffText.slice(0, MAX_DIFF_CHARS) : diffText;
  const lines = [
    `# Review: ${task.intent}`,
    "",
    `Run: ${task.id}`,
    `Claim: ${claim.statement}`,
    "",
    "## Checks the kernel already ran",
    ...(claim.checks.length
      ? claim.checks.map((check) => `- ${check.id}: ${check.result}${check.cmd ? ` (${check.cmd})` : ""}`)
      : ["(none recorded)"]),
    "",
    "## Diff",
    `${claim.diff.files} file(s), ${claim.diff.lines} changed line(s)`,
    "",
    "```diff",
    body || "(no diff produced)",
    truncated ? `\n... truncated at ${MAX_DIFF_CHARS} characters — read the worktree directly for the rest ...` : "",
    "```",
    "",
    REVIEW_PROTOCOL_INSTRUCTIONS,
  ];
  return lines.join("\n");
}

export interface ReviewRunResult {
  ok: boolean;
  review?: AgentReviewRecord;
  task?: RunView;
  message: string;
}

/**
 * Run an independent reviewer agent over a run's claim + diff, and record its verdict
 * as a kernel state transition. Only ever legal for a run that opted in
 * (task.review_required) and is sitting in "ready" — the same run that
 * kage_review_run/manager.ts can ALSO record an advisory note on, independently.
 */
export async function reviewRun(projectDir: string, runId: string, adapter: Adapter): Promise<ReviewRunResult> {
  const task = readRun(projectDir, runId);
  if (!task.review_required) {
    return { ok: false, message: `Run ${runId} does not require review (review_required is not set) — nothing to review.` };
  }
  if (task.state !== "ready") {
    return { ok: false, message: `Run ${runId} is ${task.state}, not ready. Only a run awaiting review can be reviewed.` };
  }
  const claim = readClaim(projectDir, runId);
  if (!claim) return { ok: false, message: `Run ${runId} has no claim to review.` };

  transitionRun(projectDir, runId, "reviewing", "kernel");

  const worktree = worktreePath(projectDir, runId);
  const workDir = existsSync(worktree) ? worktree : runWorkDir(projectDir, runId);
  const base = currentBranch(projectDir);
  const diff = git(projectDir, ["diff", `${base}...${task.branch}`]);
  const diffText = diff.ok ? diff.stdout : "";

  const outcome = await adapter.run({
    runId,
    workDir,
    briefBody: renderReviewBrief(task, claim, diffText),
    transcriptPath: join(runEvidenceDir(projectDir, runId), "review-transcript.jsonl"),
  });

  const fence = parseReviewFence(outcome.final_message);
  const protocolOk = fence !== null;
  // Never trust free prose into an approval: a missing or malformed fence degrades to
  // changes_requested, the same fail-safe direction claimVerdict already takes for a
  // claim the kernel could not confirm.
  const verdict: ReviewVerdict = fence?.verdict ?? "changes_requested";
  const findings = fence
    ? fence.findings
    : ["reviewer agent returned no valid kage-review fence — degraded to changes_requested"];

  const review: AgentReviewRecord = {
    schema_version: 1,
    run_id: runId,
    at: new Date().toISOString(),
    verdict,
    findings,
    protocol_ok: protocolOk,
  };
  writeAgentReview(projectDir, review);
  writeEvidence(projectDir, runId, "review", `verdict: ${verdict}\nprotocol_ok: ${protocolOk}\n\n${outcome.final_message}\n`);

  const updated = transitionRun(
    projectDir,
    runId,
    verdict,
    "kernel",
    protocolOk ? undefined : "malformed kage-review fence — degraded to changes_requested",
  );
  appendRunLedger(projectDir, { kind: "reviewed", run_id: runId, verdict, protocol_ok: protocolOk });

  return {
    ok: true,
    review,
    task: updated,
    message: `Run ${runId} reviewed: ${verdict}.${findings.length ? ` ${findings.length} finding(s).` : ""}`,
  };
}
