// One timeline over both event stores.
//
// Kage has kept two disconnected records of what happened:
//
//   .agent_memory/work/commands.jsonl   the DECISIONS — claims and gates. Read only by derive.
//   evidence_events (sqlite)            the OBSERVATIONS — prompts, tool results, file changes.
//                                       Read only by the vNext compiler.
//
// Nothing read both, so "what happened to this work item" had no answer: the decisions lived in
// one file and the evidence in a database, and no id joined them.
//
// This unifies the READ rather than the STORAGE, deliberately. A physical merge means migrating
// a live sqlite table into a JSONL file (or the reverse), which risks losing evidence for a
// benefit — one query path — that a read model delivers without touching either store. The two
// writers stay exactly as they are, each still the single writer of its own kind of fact.
//
// The envelope the design specified is applied HERE, at the join: every entry carries `source`
// so a reader can always tell a decision someone made from something the machine observed. That
// distinction is the product's whole thesis, and flattening the two would destroy it precisely
// when a reader most needs it — while reconstructing why an item is in the state it is.

import { readCommandEvents } from "./events.js";

export type TimelineSource = "command" | "wire" | "git";

export interface TimelineEntry {
  ts: string;
  source: TimelineSource;
  kind: string;
  /** Who decided it. Null for an observation — nobody "actors" a tool result. */
  actor: string | null;
  /** The work item this belongs to, when it is attributable to one. */
  work_ref: string | null;
  summary: string;
  /** The id in whichever store it came from, so a reader can go back to the original. */
  ref: string;
}

export interface TimelineInputs {
  /** Wire observations, supplied by the caller so this module never imports node:sqlite. */
  wire?: ReadonlyArray<{ event_id: string; type: string; at: string; session_id?: string | null }>;
  /** Correlated commits, from the derivation the board already computed. */
  git?: ReadonlyArray<{ hash: string; branch: string; at: string; work_id: string | null }>;
}

function describeCommand(kind: string, actor: string): string {
  switch (kind) {
    case "task.claimed": return `${actor} claimed the work`;
    case "task.released": return `${actor} released it`;
    case "gate.approved": return `${actor} approved the ship gate`;
    case "gate.held": return `${actor} held the gate`;
    default: return `${actor}: ${kind}`;
  }
}

/**
 * Every recorded fact, in time order, tagged with which store it came from.
 *
 * `work_ref` filters to one item. Wire observations are session-scoped rather than
 * item-scoped, so they are included only in the unfiltered view — attributing a tool result to
 * a work item on timing alone would be a guess, and this codebase does not guess: the
 * correlation ladder already refuses to move a stage on weak evidence, and inventing a link
 * here would smuggle in exactly what that rule forbids.
 */
export function buildTimeline(
  projectDir: string,
  options: { work_ref?: string; inputs?: TimelineInputs } = {},
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const event of readCommandEvents(projectDir)) {
    if (options.work_ref && event.work_id !== options.work_ref) continue;
    entries.push({
      ts: event.ts,
      source: "command",
      kind: event.kind,
      actor: event.actor,
      work_ref: event.work_id,
      summary: describeCommand(event.kind, event.actor),
      ref: event.event_id,
    });
  }

  for (const commit of options.inputs?.git ?? []) {
    if (options.work_ref && commit.work_id !== options.work_ref) continue;
    entries.push({
      ts: commit.at,
      source: "git",
      kind: "commit",
      actor: null,
      work_ref: commit.work_id,
      summary: `commit ${commit.hash.slice(0, 8)} on ${commit.branch}`,
      ref: commit.hash,
    });
  }

  // Session-scoped, so only in the whole-repo view. See the doc comment.
  if (!options.work_ref) {
    for (const event of options.inputs?.wire ?? []) {
      entries.push({
        ts: event.at,
        source: "wire",
        kind: event.type,
        actor: null,
        work_ref: null,
        summary: `observed ${event.type}`,
        ref: event.event_id,
      });
    }
  }

  return entries.sort((a, b) => a.ts.localeCompare(b.ts) || a.ref.localeCompare(b.ref));
}

/** How many facts each store contributed — the answer to "is either half of this dark?". */
export function timelineCoverage(entries: readonly TimelineEntry[]): Record<TimelineSource, number> {
  const counts: Record<TimelineSource, number> = { command: 0, wire: 0, git: 0 };
  for (const entry of entries) counts[entry.source] += 1;
  return counts;
}
