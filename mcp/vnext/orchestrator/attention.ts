// Attention derivation (tech design §10): the queue of decisions only a human can make,
// computed on read, never stored. Split into a PURE ruleset over explicit inputs and a
// loader that assembles those inputs from the project — the rules are the contract, and
// pure rules are testable without a repository.
//
// Severity is cost-of-delay: a base per kind, aged upward. Deliberately simple — a rank
// the eye can verify beats a model nobody can audit (tenet T6).

import { loadApprovedPackets, kageMemoryLifecycle } from "../../kernel.js";
import { deriveWorkState, type DerivedWorkItem } from "./derive.js";

export type AttentionKind =
  | "unclaimed_building"
  | "overlap_warning"
  | "parked"
  | "contradiction"
  | "stale_critical";

export interface AttentionItem {
  kind: AttentionKind;
  severity: number;
  ref: string;
  summary: string;
  actions: string[];
}

export interface AttentionInputs {
  now: string;
  work_items: DerivedWorkItem[];
  /** Approved packets that contradict another packet, with the ids they contradict. */
  contradictions: Array<{ packet_id: string; title: string; contradicts: string[] }>;
  /** Memory the lifecycle report already grades as untrustworthy. */
  stale_critical: Array<{ packet_id: string; title: string; reason: string }>;
}

const BASE_SEVERITY: Record<AttentionKind, number> = {
  unclaimed_building: 80,
  contradiction: 75,
  overlap_warning: 60,
  stale_critical: 55,
  parked: 40,
};

const PARKED_AFTER_DAYS = 14;

function ageDays(now: string, since: string | undefined): number {
  const from = Date.parse(since ?? now);
  if (!Number.isFinite(from)) return 0;
  return Math.max(0, (Date.parse(now) - from) / 86_400_000);
}

export function deriveAttention(inputs: AttentionInputs): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const item of inputs.work_items) {
    // Correlated commits on an item nobody claimed: real work is happening outside the
    // queue. The reducer deliberately refuses to advance the stage (a silent transition
    // would hide the process gap) — so it lands here instead, as a decision.
    if (!item.claimed_by && item.correlated_commits.length) {
      items.push({
        kind: "unclaimed_building",
        severity: BASE_SEVERITY.unclaimed_building,
        ref: item.work_id,
        summary: `Commits reference "${item.title}" but nobody has claimed it`,
        actions: ["claim it", "release the branch"],
      });
    }
    // A claim with no observed work for two weeks is a stuck item, not a busy one.
    if (item.claimed_by && !item.correlated_commits.length && item.derived_stage === "claimed") {
      const idle = ageDays(inputs.now, item.stage_log.find((step) => step.stage === "claimed")?.at);
      if (idle >= PARKED_AFTER_DAYS) {
        items.push({
          kind: "parked",
          severity: BASE_SEVERITY.parked + Math.min(20, idle - PARKED_AFTER_DAYS),
          ref: item.work_id,
          summary: `"${item.title}" claimed by ${item.claimed_by} with no observed work for ${Math.floor(idle)} days`,
          actions: ["release the claim", "close it"],
        });
      }
    }
  }

  // Two claimed items whose blast sets intersect will collide at merge time — cheaper to
  // sequence them now than to reconcile them later.
  const claimed = inputs.work_items.filter((item) => item.claimed_by && item.derived_stage !== "done");
  for (let i = 0; i < claimed.length; i++) {
    for (let j = i + 1; j < claimed.length; j++) {
      const a = new Set(claimed[i].correlated_commits.map((c) => c.branch));
      void a; // branches differ by construction; overlap is judged on blast paths below
      const overlap = claimed[i].stage_log && claimed[j].stage_log
        ? blastOverlap(claimed[i], claimed[j])
        : [];
      if (overlap.length) {
        items.push({
          kind: "overlap_warning",
          severity: BASE_SEVERITY.overlap_warning + Math.min(15, overlap.length * 5),
          ref: `${claimed[i].work_id}+${claimed[j].work_id}`,
          summary: `"${claimed[i].title}" and "${claimed[j].title}" both touch ${overlap.slice(0, 3).join(", ")}`,
          actions: ["sequence them", "merge them"],
        });
      }
    }
  }

  for (const conflict of inputs.contradictions) {
    items.push({
      kind: "contradiction",
      severity: BASE_SEVERITY.contradiction,
      ref: conflict.packet_id,
      summary: `"${conflict.title}" contradicts ${conflict.contradicts.length} other claim(s)`,
      actions: ["keep one (supersede)", "scope both"],
    });
  }

  for (const stale of inputs.stale_critical) {
    items.push({
      kind: "stale_critical",
      severity: BASE_SEVERITY.stale_critical,
      ref: stale.packet_id,
      summary: `"${stale.title}" — ${stale.reason}`,
      actions: ["reverify", "supersede", "retire"],
    });
  }

  return items.sort((a, b) => b.severity - a.severity);
}

// Blast paths ride on the derived item indirectly (the proposal's cited paths). The
// loader threads them through; the pure rule only needs the intersection.
const blastByItem = new WeakMap<DerivedWorkItem, string[]>();
export function attachBlast(item: DerivedWorkItem, paths: string[]): DerivedWorkItem {
  blastByItem.set(item, paths);
  return item;
}
function blastOverlap(a: DerivedWorkItem, b: DerivedWorkItem): string[] {
  const left = new Set(blastByItem.get(a) ?? []);
  return (blastByItem.get(b) ?? []).filter((path) => left.has(path));
}

export function loadAttentionInputs(projectDir: string): AttentionInputs {
  const packets = loadApprovedPackets(projectDir);
  const blastById = new Map(packets.map((packet) => [packet.id, packet.paths]));
  const work = deriveWorkState(projectDir).items.map((item) =>
    attachBlast(item, blastById.get(item.work_id) ?? []),
  );

  const contradictions = packets
    .map((packet) => ({
      packet_id: packet.id,
      title: packet.title,
      contradicts: (Array.isArray((packet.quality as Record<string, unknown>)?.contradicts)
        ? ((packet.quality as Record<string, unknown>).contradicts as string[])
        : []),
    }))
    .filter((entry) => entry.contradicts.length > 0);

  let staleCritical: AttentionInputs["stale_critical"] = [];
  try {
    const lifecycle = kageMemoryLifecycle(projectDir) as unknown as { items?: Array<{ id: string; title: string; health: string; reasons?: string[] }> };
    staleCritical = (lifecycle.items ?? [])
      .filter((entry) => entry.health === "stale" || entry.health === "disputed")
      .slice(0, 10)
      .map((entry) => ({ packet_id: entry.id, title: entry.title, reason: entry.reasons?.[0] ?? entry.health }));
  } catch {
    // Lifecycle unavailable degrades the queue's depth, never its correctness.
  }

  return { now: new Date().toISOString(), work_items: work, contradictions, stale_critical: staleCritical };
}

export function attentionQueue(projectDir: string): AttentionItem[] {
  return deriveAttention(loadAttentionInputs(projectDir));
}
