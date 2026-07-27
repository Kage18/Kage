// The derivation engine (tech design §5–§6): work stages as a pure reduction over the
// command log plus observed git state. Nothing here writes a packet — the stored stage on
// a proposal remains command-asserted through the kernel's single-writer transition path,
// while the DERIVED stage layers observed evidence (branches, commits) on top. Consumers
// (the board, attention, the app) read the derivation; humans never update a status.
//
// v1 derives through `building` from local git, and `done` from an approved gate. The
// `verifying` step needs PR events (GitHub App), which arrive in a later slice — absent
// observers degrade DERIVATION DEPTH, never correctness (tenet T4).

import { execFileSync } from "node:child_process";
import { loadApprovedPackets, type MemoryPacket } from "../../kernel.js";
import { readCommandEvents, type CommandEvent } from "./events.js";
import { correlateCommit, type Correlation, type WorkItemRef } from "./correlate.js";

export type DerivedStage = "proposed" | "claimed" | "building" | "done";

export interface StageStep {
  stage: DerivedStage;
  at: string;
  /** Event ids / commit hashes that caused this step — every transition names its evidence. */
  caused_by: string[];
}

export interface DerivedWorkItem {
  work_id: string;
  title: string;
  stored_stage: string;
  claimed_by: string | null;
  derived_stage: DerivedStage;
  stage_log: StageStep[];
  /** Commits correlated at explicit/strong confidence — the evidence behind `building`. */
  correlated_commits: Array<{ hash: string; branch: string; confidence: Correlation["confidence"] }>;
  /** Weak-only matches, surfaced for the timeline but never sufficient for a transition. */
  weak_evidence: number;
}

export interface WorkStateProjection {
  project_dir: string;
  derived_at: string;
  items: DerivedWorkItem[];
}

interface ObservedCommit {
  hash: string;
  branch: string;
  message: string;
  changed_paths: string[];
  at: string;
}

function git(projectDir: string, ...args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: projectDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

function defaultBranch(projectDir: string): string | null {
  for (const candidate of ["main", "master"]) {
    if (git(projectDir, "rev-parse", "--verify", "-q", candidate) !== null) return candidate;
  }
  return null;
}

const BRANCH_CAP = 20;
const COMMITS_PER_BRANCH = 30;

// Feature-branch commits not reachable from the default branch — where building happens.
// Caps keep this O(small) on real repositories; the board is a glance, not an audit.
function observedCommits(projectDir: string): ObservedCommit[] {
  const base = defaultBranch(projectDir);
  const refs = git(projectDir, "for-each-ref", "--format=%(refname:short)", "refs/heads");
  if (!refs) return [];
  const commits: ObservedCommit[] = [];
  for (const branch of refs.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, BRANCH_CAP)) {
    if (branch === base) continue;
    const range = base ? `${base}..${branch}` : branch;
    const raw = git(projectDir, "log", "-n", String(COMMITS_PER_BRANCH), "--format=%H%x1f%cI%x1f%B%x1e", range);
    if (!raw) continue;
    for (const record of raw.split("\x1e")) {
      if (!record.trim()) continue;
      const [hash, at, message] = record.split("\x1f");
      if (!hash?.trim() || !message) continue;
      const changed = git(projectDir, "diff-tree", "--no-commit-id", "--name-only", "-r", hash.trim());
      commits.push({
        hash: hash.trim(),
        branch,
        message,
        changed_paths: (changed ?? "").split("\n").map((line) => line.trim()).filter(Boolean),
        at: at?.trim() || new Date().toISOString(),
      });
    }
  }
  return commits.sort((a, b) => a.at.localeCompare(b.at));
}

function claimStep(workId: string, packet: MemoryPacket, commands: CommandEvent[]): StageStep | null {
  const command = commands.find((event) => event.kind === "task.claimed" && event.work_id === workId);
  if (command) return { stage: "claimed", at: command.ts, caused_by: [command.event_id] };
  // A claim asserted through the kernel path alone (older flows) still counts — the
  // packet's audited stage field is command-grade evidence, cited as such.
  if (packet.stage && packet.stage !== "proposed") {
    return { stage: "claimed", at: packet.claimed_at ?? packet.updated_at, caused_by: [`packet:${workId}:stage`] };
  }
  return null;
}

export function deriveWorkState(projectDir: string): WorkStateProjection {
  const proposals = loadApprovedPackets(projectDir).filter((packet) => packet.type === "proposal");
  const commands = readCommandEvents(projectDir);
  const commits = observedCommits(projectDir);
  const refs: WorkItemRef[] = proposals.map((packet) => ({ work_id: packet.id, blast_paths: packet.paths }));

  const items = proposals.map((packet): DerivedWorkItem => {
    const log: StageStep[] = [{ stage: "proposed", at: packet.created_at, caused_by: [`packet:${packet.id}`] }];
    const correlated: DerivedWorkItem["correlated_commits"] = [];
    let weak = 0;

    const claimed = claimStep(packet.id, packet, commands);
    if (claimed) log.push(claimed);

    for (const commit of commits) {
      const match = correlateCommit(
        { message: commit.message, branch: commit.branch, changed_paths: commit.changed_paths },
        refs,
      );
      if (!match || match.work_id !== packet.id) continue;
      if (match.confidence === "weak") {
        weak += 1; // recorded, surfaced, and — by design — never a transition on its own
        continue;
      }
      correlated.push({ hash: commit.hash, branch: commit.branch, confidence: match.confidence });
    }

    // building requires BOTH a claim and correlated work — an unclaimed item with commits
    // is an attention case (someone building unclaimed work), not a silent stage change.
    if (claimed && correlated.length) {
      log.push({
        stage: "building",
        at: commits.find((commit) => commit.hash === correlated[0].hash)?.at ?? claimed.at,
        caused_by: correlated.map((entry) => entry.hash),
      });
    }

    const gate = commands.find((event) => event.kind === "gate.approved" && event.work_id === packet.id);
    if (gate) log.push({ stage: "done", at: gate.ts, caused_by: [gate.event_id] });

    return {
      work_id: packet.id,
      title: packet.title,
      stored_stage: packet.stage ?? "proposed",
      claimed_by: packet.claimed_by ?? null,
      derived_stage: log[log.length - 1].stage,
      stage_log: log,
      correlated_commits: correlated,
      weak_evidence: weak,
    };
  });

  return { project_dir: projectDir, derived_at: new Date().toISOString(), items };
}
