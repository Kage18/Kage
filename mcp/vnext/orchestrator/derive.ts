// The derivation engine (tech design §5–§6): work stages as a pure reduction over the
// command log plus observed git state. Nothing here writes a packet — the stored stage on
// a proposal remains command-asserted through the kernel's single-writer transition path,
// while the DERIVED stage layers observed evidence (branches, commits) on top. Consumers
// (the board, attention, the app) read the derivation; humans never update a status.
//
// Derives the full local loop: `claimed` from a command, `building` from correlated commits
// on an unmerged branch, and `done` from those commits reaching the default branch — merging
// is observable, so shipping needs no human assertion. An approved gate also closes an item,
// for work that ships some other way.
//
// `verifying` (PR open, pre-merge) is the one stage local git cannot see; it needs PR events
// from the GitHub App. Absent observers degrade DERIVATION DEPTH, never correctness (tenet T4).

import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadApprovedPackets, type MemoryPacket } from "../../kernel.js";
import { readCommandEvents, type CommandEvent } from "./events.js";
import { correlateCommit, type Correlation, type WorkItemRef } from "./correlate.js";

export type DerivedStage = "proposed" | "claimed" | "building" | "verifying" | "done";

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
  /** Reachable from the default branch — the work landed. */
  merged: boolean;
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

// Commits that can move an item: unmerged feature-branch work (building) and recent
// default-branch history (merged — the work shipped).
//
// Scanning the default branch matters more than it looks: once a branch merges, `base..branch`
// is empty, so an item whose work actually landed would lose all its evidence and fall BACK to
// `claimed`. Reading merged commits is what lets the loop close instead of regressing.
//
// Caps keep this O(small) on real repositories; the board is a glance, not an audit.
function observedCommits(projectDir: string): ObservedCommit[] {
  const base = defaultBranch(projectDir);
  // Ordered by most recent commit, NOT alphabetically. With the old ordering a repo with more
  // branches than the cap scanned the alphabetically-first ones and silently skipped the rest
  // — on this repo, 92 branches meant the branch actually being worked on was never read, so
  // the board could not see the developer's own commits.
  const refs = git(projectDir, "for-each-ref", "--sort=-committerdate", "--format=%(refname:short)", "refs/heads");
  if (!refs) return [];
  const commits: ObservedCommit[] = [];

  // `--name-only` returns the changed paths in the SAME call. This used to fork a separate
  // `git diff-tree` per commit, so a board load cost up to 20 branches x 30 commits = 600
  // extra processes and took 6-7 seconds on every request. One spawn per branch now.
  const readRange = (branch: string, range: string, merged: boolean): void => {
    const raw = git(
      projectDir,
      "log",
      "-n",
      String(COMMITS_PER_BRANCH),
      "--no-renames",
      "--name-only",
      "--format=\x1e%H\x1f%cI\x1f%B\x1f",
      range,
    );
    if (!raw) return;
    for (const record of raw.split("\x1e")) {
      if (!record.trim()) continue;
      const [hash, at, message, paths = ""] = record.split("\x1f");
      if (!hash?.trim() || !message) continue;
      commits.push({
        hash: hash.trim(),
        branch,
        message,
        changed_paths: paths.split("\n").map((line) => line.trim()).filter(Boolean),
        at: at?.trim() || new Date().toISOString(),
        merged,
      });
    }
  };

  const ordered = refs.split("\n").map((line) => line.trim()).filter(Boolean);
  // The checked-out branch is never optional. Recency ordering already puts it near the front
  // in practice, but "the work I am doing right now is on the board" must not depend on that.
  const current = git(projectDir, "rev-parse", "--abbrev-ref", "HEAD")?.trim();
  const scanned = new Set<string>();
  if (current && current !== "HEAD" && current !== base) scanned.add(current);
  for (const branch of ordered) {
    if (scanned.size >= BRANCH_CAP) break;
    if (branch !== base) scanned.add(branch);
  }

  for (const branch of scanned) {
    readRange(branch, base ? `${base}..${branch}` : branch, false);
  }
  if (base) readRange(base, base, true);

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

export interface DeriveOptions {
  /**
   * Branch names with an open pull request. Injected so derivation stays a pure reduction and
   * so a test never depends on a live `gh`. Omitted entirely when no PR observer is configured
   * — which costs the `verifying` stage and nothing else.
   */
  openPullRequestBranches?: () => Set<string>;
}

// Derivation is the shared floor under Attention, Proof, the Board and work-item detail — FIVE
// callers, all of which paid for it separately. Measured on this repository: 1.4s cold, 0.78s
// warm, essentially all of it in the branch scan (`observedCommits`) and the correlation loop;
// packets and commands together are under 30ms. Opening the app therefore cost it three times
// before a single screen had rendered.
//
// The signature is the same one the board cache uses, and for the same reason: derivation reduces
// over commits (git), commands (the log) and proposals (packets), so it is stale exactly when one
// of those three changes and never otherwise. Whether a PR observer was supplied is part of the
// key because it decides whether `verifying` can be reached at all.
interface DeriveCacheEntry {
  signature: string;
  projection: WorkStateProjection;
}
let deriveCache: { project: string; entry: DeriveCacheEntry } | null = null;

function deriveSignature(projectDir: string, withPrObserver: boolean): string {
  const parts: string[] = [withPrObserver ? "pr" : "no-pr"];
  parts.push(git(projectDir, "rev-parse", "HEAD") ?? "no-git");
  parts.push(git(projectDir, "for-each-ref", "--format=%(objectname)", "refs/heads") ?? "");
  const stamp = (path: string): void => {
    try {
      const info = statSync(path);
      parts.push(`${path}:${info.mtimeMs}:${info.size}`);
    } catch { /* absent is itself a stable input */ }
  };
  stamp(join(projectDir, ".agent_memory", "work", "commands.jsonl"));
  const packets = join(projectDir, ".agent_memory", "packets");
  try {
    // Per-file, not the directory: a directory's mtime does not change when a file is edited in
    // place, so keying on it would serve a stale projection after any packet edit.
    for (const name of readdirSync(packets).sort()) stamp(join(packets, name));
  } catch { /* no packets yet */ }
  return parts.join("|");
}

export function deriveWorkState(projectDir: string, options: DeriveOptions = {}): WorkStateProjection {
  const signature = deriveSignature(projectDir, !!options.openPullRequestBranches);
  if (deriveCache && deriveCache.project === projectDir && deriveCache.entry.signature === signature) {
    return deriveCache.entry.projection;
  }
  const projection = computeWorkState(projectDir, options);
  deriveCache = { project: projectDir, entry: { signature, projection } };
  return projection;
}

function computeWorkState(projectDir: string, options: DeriveOptions): WorkStateProjection {
  const proposals = loadApprovedPackets(projectDir).filter((packet) => packet.type === "proposal");
  const commands = readCommandEvents(projectDir);
  const commits = observedCommits(projectDir);
  const openPrBranches = options.openPullRequestBranches?.() ?? null;
  const refs: WorkItemRef[] = proposals.map((packet) => ({ work_id: packet.id, blast_paths: packet.paths }));

  const items = proposals.map((packet): DerivedWorkItem => {
    const log: StageStep[] = [{ stage: "proposed", at: packet.created_at, caused_by: [`packet:${packet.id}`] }];
    const correlated: DerivedWorkItem["correlated_commits"] = [];
    const merged: ObservedCommit[] = [];
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
      if (commit.merged) merged.push(commit);
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

    // An open PR on a correlated branch means the work is in REVIEW, not still being written —
    // a different decision for a lead. Git cannot see this, so it needs the PR observer; with
    // no observer the item simply stays `building`.
    const reviewing = openPrBranches
      ? correlated.filter((entry) => openPrBranches.has(entry.branch))
      : [];
    if (reviewing.length && !merged.length) {
      log.push({
        stage: "verifying",
        at: commits.find((commit) => commit.hash === reviewing[0].hash)?.at ?? claimed?.at ?? packet.created_at,
        caused_by: reviewing.map((entry) => `pr:${entry.branch}`),
      });
    }

    // Merging is the honest end of the loop: the work is in the default branch, so it shipped.
    // Checked after `verifying` and gated on `!merged` above, so a stale PR listing can never
    // drag a shipped item backwards — the merge is the stronger, locally-verifiable fact.
    // No command is required, because nothing about a merge needs a human to assert it.
    if (merged.length) {
      log.push({
        stage: "done",
        at: merged[merged.length - 1].at,
        caused_by: merged.map((commit) => commit.hash),
      });
    }
    const gate = commands.find((event) => event.kind === "gate.approved" && event.work_id === packet.id);
    if (gate && log[log.length - 1].stage !== "done") {
      log.push({ stage: "done", at: gate.ts, caused_by: [gate.event_id] });
    }

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
