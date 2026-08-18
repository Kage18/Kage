// Merge-ratification: the novel mechanic. Learnings are committed onto the run's own
// branch as *pending* packets, so they are reviewed in the same diff as the code that
// taught them. Merging the branch is what promotes them to team memory — one act,
// no second inbox, git stays the review boundary.
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { capture, packetsDir, refreshProject } from "../kernel.js";
import { okfConceptToPacket, packetToOkfConcept } from "../okf.js";
import { KERNEL_APPENDED_CHECK_IDS, runAllChecks } from "./checks.js";
import {
  type CheckSpec,
  type ClaimRecord,
  type RunState,
  type TaskRecord,
  appendRunLedger,
  reapRun,
  readClaim,
  readRun,
  runTag,
  runWorkDir,
  transitionRun,
  writeClaim,
} from "./contract.js";
import { commitIdentityArgs, currentBranch, dirtyPaths, git } from "./git.js";
import type { CitationText } from "./verify.js";
import { commitWorktree, removeWorktree, worktreePath } from "./worktree.js";

// Rewrite a packet file's status in place, preserving the lossless OKF round-trip.
function setPacketStatus(path: string, status: "pending" | "approved"): boolean {
  try {
    const packet = okfConceptToPacket(readFileSync(path, "utf8"), { sourcePath: path });
    if (!packet) return false;
    packet.status = status;
    packet.updated_at = new Date().toISOString();
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, packetToOkfConcept(packet), "utf8");
    renameSync(tmp, path);
    return true;
  } catch {
    return false;
  }
}

function packetFilesForRun(projectDir: string, runId: string): string[] {
  const dir = packetsDir(projectDir);
  if (!existsSync(dir)) return [];
  const tag = runTag(runId);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(dir, name))
    .filter((path) => {
      try {
        return readFileSync(path, "utf8").includes(tag);
      } catch {
        return false;
      }
    });
}

export interface DraftedLearning {
  title: string;
  path: string;
  ok: boolean;
  error?: string;
}

// Write the run's learnings into the WORKTREE's packet store (same tracked directory,
// this checkout), pending until merge. Capture's full gate applies: secrets scan,
// citation validation, dump guard — a learning is memory, held to memory's standards.
export function draftLearnings(
  projectDir: string,
  task: TaskRecord,
  claim: ClaimRecord,
  paths: string[],
): DraftedLearning[] {
  const worktree = worktreePath(projectDir, task.id);
  if (!existsSync(worktree) || !claim.learnings.length) return [];
  const drafted: DraftedLearning[] = [];
  for (const learning of claim.learnings.slice(0, 3)) {
    const title = learning.length > 90 ? `${learning.slice(0, 87)}...` : learning;
    const result = capture({
      projectDir: worktree,
      title,
      body: `${learning}\n\nLearned while delivering: ${task.intent}\nVerified by: ${claim.checks
        .filter((check) => check.result === "pass")
        .map((check) => check.cmd ?? check.id)
        .join(", ") || "claim review"}`,
      type: task.type === "bugfix" ? "bug_fix" : "decision",
      tags: ["delegated-run", runTag(task.id)],
      paths: paths.slice(0, 6),
      strictCitations: false,
    });
    if (result.ok && result.path) {
      // Pending until the merge ratifies it: the file rides the branch and is visible
      // in review, but recall will not serve it yet.
      setPacketStatus(result.path, "pending");
      drafted.push({ title, path: result.path, ok: true });
    } else {
      drafted.push({ title, path: "", ok: false, error: result.errors[0] });
    }
  }
  return drafted;
}

export interface MergeResult {
  ok: boolean;
  merged: boolean;
  ratified: number;
  message: string;
}

export function mergeRun(projectDir: string, runId: string): MergeResult {
  const task = readRun(projectDir, runId);
  if (task.state !== "ready") {
    return { ok: false, merged: false, ratified: 0, message: `Run ${runId} is ${task.state}, not ready. Only a verified claim can be merged.` };
  }
  const claim = readClaim(projectDir, runId);
  if (!claim) return { ok: false, merged: false, ratified: 0, message: `Run ${runId} has no claim to merge.` };

  // The work was already committed at claim time; this catches only late edits made by
  // a reviewer poking around in the worktree via `kage open`.
  commitWorktree(projectDir, runId, `kage: review edits for ${runId}`);

  const base = currentBranch(projectDir);
  // Refuse rather than let git spray a wall of red: a merge that would clobber the
  // reviewer's own uncommitted work is a decision for them, not for us.
  const collisions = dirtyPaths(projectDir);
  if (collisions.length) {
    const branchFiles = git(projectDir, ["diff", "--name-only", `${base}...${task.branch}`]).stdout.split("\n").filter(Boolean);
    const overlap = branchFiles.filter((path) => collisions.includes(path));
    if (overlap.length) {
      return {
        ok: false,
        merged: false,
        ratified: 0,
        message:
          `Not merging: you have uncommitted changes to ${overlap.length} file(s) this run also touched ` +
          `(${overlap.slice(0, 4).join(", ")}${overlap.length > 4 ? ", …" : ""}). ` +
          `Commit or stash your work first — merging now would overwrite it.`,
      };
    }
  }
  const merge = git(projectDir, [...commitIdentityArgs(projectDir), "merge", "--no-ff", task.branch, "-m", `kage: merge ${runId} — ${task.intent}`]);
  if (!merge.ok) {
    return {
      ok: false,
      merged: false,
      ratified: 0,
      message: `Merge into ${base} hit a conflict — resolve it in the repo, then re-run kage merge.\n${merge.stderr}`,
    };
  }

  // Ratification: the packets that rode the branch become team memory now, because you
  // merged. Committed as their own step so the promotion is visible in history.
  const ratifiedFiles = packetFilesForRun(projectDir, runId).filter((path) => setPacketStatus(path, "approved"));
  if (ratifiedFiles.length) {
    git(projectDir, ["add", ...ratifiedFiles]);
    git(projectDir, [...commitIdentityArgs(projectDir), "commit", "-m", `kage: ratify ${ratifiedFiles.length} learning(s) from ${runId}`]);
  }

  removeWorktree(projectDir, runId);
  transitionRun(projectDir, runId, "merged", "user");
  appendRunLedger(projectDir, { kind: "merged", run_id: runId, type: task.type, ratified: ratifiedFiles.length });
  try {
    refreshProject(projectDir);
  } catch {
    // Index refresh is best-effort; the merge itself already landed.
  }
  return {
    ok: true,
    merged: true,
    ratified: ratifiedFiles.length,
    message: `Merged ${task.branch} into ${base}.${ratifiedFiles.length ? ` Ratified ${ratifiedFiles.length} learning(s) — the next brief will carry them.` : ""}`,
  };
}

export interface RejectResult {
  ok: boolean;
  captured: boolean;
  message: string;
}

const REJECTABLE_STATES = new Set<RunState>(["ready", "failed", "stopped"]);

// None of ready/failed/stopped/dropped has a live agent process, so there is nothing a
// reject would interrupt. blocked does — an agent is genuinely waiting on an answer — so
// that one alone needs "stop it first". The rest get a message that fits their state
// instead of the same canned line.
function rejectRefusal(runId: string, state: RunState): string {
  if (state === "blocked") return `Run ${runId} is blocked — an agent is waiting on you. Stop it, then reject.`;
  if (state === "running" || state === "dispatched" || state === "verifying") {
    return `Run ${runId} is ${state} — a live agent is still working. Stop it, then reject.`;
  }
  return `Run ${runId} is ${state} — nothing to reject yet.`;
}

// Rejection is not a delete — it is the one moment a team reliably learns something
// ("we tried that; here's why not"). The reason becomes a negative_result packet,
// grounded on the paths the attempt touched, so the next brief carries it.
export function rejectRun(projectDir: string, runId: string, reason: string): RejectResult {
  let task = readRun(projectDir, runId);
  if (task.display_state === "dropped") {
    // The recorded state (running/dispatched/verifying) says "in flight", but the process
    // is gone — persist that reality first so the transition below judges the run by what
    // it actually is (failed), not by a stale in-flight state that would otherwise refuse it.
    reapRun(projectDir, runId);
    task = readRun(projectDir, runId);
  }
  if (!REJECTABLE_STATES.has(task.state)) {
    return { ok: false, captured: false, message: rejectRefusal(runId, task.state) };
  }
  const claim = readClaim(projectDir, runId);
  const paths = (claim?.checks ?? []).length ? [] : [];
  const captured = capture({
    projectDir,
    title: `Rejected approach: ${task.intent}`.slice(0, 90),
    body: `A delegated attempt at "${task.intent}" was rejected.\n\nReason: ${reason}\n\nClaimed: ${claim?.statement ?? "(no claim)"}\nBranch kept for inspection: ${task.branch}`,
    type: "negative_result",
    tags: ["delegated-run", "rejected", runTag(runId)],
    paths,
    strictCitations: false,
    allowMissingPaths: true,
  });

  removeWorktree(projectDir, runId);
  transitionRun(projectDir, runId, "rejected", "user", reason);
  appendRunLedger(projectDir, { kind: "rejected", run_id: runId, type: task.type, reason });
  return {
    ok: true,
    captured: captured.ok,
    message: captured.ok
      ? `Rejected ${runId}. Why it was rejected is now repo memory — future briefs will carry it. Branch ${task.branch} kept for inspection.`
      : `Rejected ${runId}. (Could not capture the reason as memory: ${captured.errors[0] ?? "unknown"})`,
  };
}

export interface ReverifyResult {
  ok: boolean;
  passed: boolean;
  state: RunState;
  message: string;
}

const REVERIFIABLE_STATES = new Set<RunState>(["failed", "ready"]);


/**
 * Re-checks a run: same kernel-executed checks (verify.ts + static-checks.ts, via
 * checks.ts's runAllChecks — the exact assembly executeRun and superviseRun use), against
 * the run's CURRENT worktree contents. No agent turn, no brief recompile, and the claim's
 * statement/unsure/learnings are left untouched — only the check verdicts and the run's
 * state move.
 *
 * contract.ts's LEGAL_TRANSITIONS allowed failed -> running ("retry with steering") from
 * the day it was written, but a run that failed on a technicality — a false-positive
 * check, an environment hiccup already fixed by hand in the worktree — had no path back
 * short of a full agent retry or a reject that throws away correct work. This is that
 * lighter path: failed/ready -> verifying -> ready/failed, wired to `kage reverify`.
 */
export function reverifyRun(projectDir: string, runId: string): ReverifyResult {
  let task = readRun(projectDir, runId);
  if (task.display_state === "dropped") {
    reapRun(projectDir, runId);
    task = readRun(projectDir, runId);
  }
  if (!REVERIFIABLE_STATES.has(task.state)) {
    return {
      ok: false,
      passed: false,
      state: task.state,
      message: `Run ${runId} is ${task.state} — reverify only makes sense from failed or ready (merged/rejected are terminal, nothing left to recheck).`,
    };
  }
  const claim = readClaim(projectDir, runId);
  if (!claim) {
    return { ok: false, passed: false, state: task.state, message: `Run ${runId} has no claim to reverify.` };
  }
  const worktree = worktreePath(projectDir, runId);
  const worktreeDir = existsSync(worktree) ? worktree : runWorkDir(projectDir, runId);
  if (!existsSync(worktreeDir)) {
    return { ok: false, passed: false, state: task.state, message: `Run ${runId}'s worktree is gone — nothing to reverify.` };
  }

  const declaredChecks: CheckSpec[] = claim.checks
    .filter((check) => !KERNEL_APPENDED_CHECK_IDS.has(check.id))
    .map((check) => ({ id: check.id, kind: check.kind, cmd: check.cmd, expect: check.expect }));

  transitionRun(projectDir, runId, "verifying", "kernel", "reverify requested");
  // The claim's statement is still the formal citation; unsure/learnings are still prose
  // — same split executeRun/superviseRun apply, just replayed against unchanged text.
  const claimText: CitationText = { cited: claim.statement, prose: [...claim.unsure, ...claim.learnings].join("\n") };
  const result = runAllChecks(projectDir, runId, worktreeDir, declaredChecks, claimText);

  const reverifiedClaim: ClaimRecord = { ...claim, checks: result.checks, diff: result.diff, reverified_at: new Date().toISOString() };
  writeClaim(projectDir, runId, reverifiedClaim);

  const failing = result.checks.filter((check) => check.result !== "pass").map((check) => check.id).join(", ");
  const newState: RunState = result.passed ? "ready" : "failed";
  transitionRun(projectDir, runId, newState, "kernel", result.passed ? "reverified — now passing" : `reverified — still failing: ${failing}`);
  appendRunLedger(projectDir, {
    kind: "reverified",
    run_id: runId,
    passed: result.passed,
    checks: result.checks.map((check) => ({ id: check.id, result: check.result })),
  });

  return {
    ok: true,
    passed: result.passed,
    state: newState,
    message: result.passed
      ? `Reverified ${runId}: now passing — ready to merge.`
      : `Reverified ${runId}: still failing (${failing}).`,
  };
}
