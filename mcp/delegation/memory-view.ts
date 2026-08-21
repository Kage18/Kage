// The app's memory surface.
//
// Kage's pitch is memory, and until now the app showed only orchestration — Room,
// Inbox, Runs, Board. Three hundred packets, the gains ledger, and every health signal
// lived in a separate legacy viewer that takes minutes to start. A product whose core
// value is invisible in its own app is a product people churn out of.
//
// Everything here reads PRE-BUILT INDEXES, never the kernel's analysis functions. That
// is the whole design constraint: `kage refresh` already wrote catalog.json,
// metrics.json and the value ledger, and reading all three costs single-digit
// milliseconds. Calling kageRepoXray/kageContributors/kageRisk from a route instead
// would cost 80s/58s/39s — measured — which is exactly how the legacy viewer ended up
// appearing to hang for nearly four minutes before it served its first byte.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { RUN_TAG_PREFIX, type RunView, listRuns, runTag } from "./contract.js";

function readJson<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    // A torn or hand-edited index degrades to "nothing to show", never a 500.
    return fallback;
  }
}

export interface MemoryPacketSummary {
  id: string;
  title: string;
  summary: string;
  type: string;
  status: string;
  tags: string[];
  paths: string[];
  updated_at: string;
}

interface CatalogFile {
  packet_count?: number;
  packets?: Array<Partial<MemoryPacketSummary> & { source_refs?: unknown[] }>;
}

/**
 * What Kage measured versus what Kage estimated — kept apart on purpose.
 *
 * Counts of things that happened (recalls served, stale memories withheld, packets
 * written) are observed facts from the value ledger. `tokens_saved` is a model: the
 * greater of a read-vs-source estimate and a knowledge-replay estimate. Presenting
 * the two in the same voice is how a dashboard starts lying, so the surface labels
 * the estimate as one and leads with the observed numbers.
 */
export interface MemoryValue {
  observed: {
    recalls: number;
    stale_withheld: number;
    stale_caught: number;
    packets: number;
  };
  estimated: {
    tokens_saved: number;
  };
  /** True when nothing has been recalled yet — the surface should invite, not boast. */
  cold_start: boolean;
}

export interface MemoryHealth {
  approved: number;
  /** As of the last `kage refresh`, not live — `kage stale`'s count is the live, actionable one and can differ. */
  stale: number;
  high_signal: number;
  duplicate_pairs: number;
  average_quality: number;
  useful_ratio_percent: number;
  evidence_coverage_percent: number;
  /** Packets that exist but have never been recalled — the real "is this earning its keep" signal. */
  never_used: number;
  hot: number;
}

export interface MemoryOverview {
  ok: true;
  /**
   * False when metrics.json has not been written yet (a repo that has never run
   * `kage refresh`). Without this the UI cannot tell a measured zero from an unmeasured
   * one, and renders "0% avg quality" — which reads as "this memory is worthless"
   * rather than the truth, "nothing has been measured yet".
   */
  measured: boolean;
  value: MemoryValue;
  health: MemoryHealth;
  by_type: Array<{ type: string; count: number }>;
  packets: MemoryPacketSummary[];
  generated_at: string | null;
  /** True when this repo has no memory at all — a first-run repo, not a broken one. */
  empty: boolean;
}

function memoryDir(projectDir: string): string {
  return join(projectDir, ".agent_memory");
}

export function readMemoryOverview(projectDir: string): MemoryOverview {
  const base = memoryDir(projectDir);
  const catalog = readJson<CatalogFile>(join(base, "indexes", "catalog.json"), {});
  const metrics = readJson<Record<string, Record<string, number>>>(join(base, "metrics.json"), {});
  const ledger = readJson<{ totals?: Record<string, number> }>(join(base, "reports", "value.json"), {});
  const measured = existsSync(join(base, "metrics.json"));

  const packets: MemoryPacketSummary[] = (catalog.packets ?? []).map((entry) => ({
    id: String(entry.id ?? ""),
    title: String(entry.title ?? "(untitled)"),
    summary: String(entry.summary ?? ""),
    type: String(entry.type ?? "unknown"),
    status: String(entry.status ?? "active"),
    tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
    paths: Array.isArray(entry.paths) ? entry.paths.map(String) : [],
    updated_at: String(entry.updated_at ?? ""),
  }));

  const totals = ledger.totals ?? {};
  const graph = metrics.memory_graph ?? {};
  const quality = (metrics.quality ?? {}) as Record<string, unknown>;
  const qualityTotals = (quality.totals ?? {}) as Record<string, number>;
  const access = metrics.memory_access ?? {};

  const recalls = Number(totals.recalls ?? 0);
  return {
    ok: true,
    measured,
    value: {
      observed: {
        recalls,
        stale_withheld: Number(totals.stale_withheld ?? 0),
        stale_caught: Number(totals.stale_caught ?? 0),
        packets: packets.length,
      },
      estimated: { tokens_saved: Number(totals.tokens_saved ?? 0) },
      cold_start: recalls === 0,
    },
    health: {
      approved: Number(graph.approved_packets ?? packets.length),
      stale: Number(qualityTotals.stale ?? 0),
      high_signal: Number(qualityTotals.high_signal ?? 0),
      duplicate_pairs: Number(graph.duplicate_candidate_pairs ?? 0),
      average_quality: Number(graph.average_quality_score ?? 0),
      useful_ratio_percent: Number((quality.useful_memory_ratio_percent as number) ?? 0),
      evidence_coverage_percent: Number(graph.evidence_coverage_percent ?? 0),
      never_used: Number(access.active_packets_without_access ?? 0),
      hot: Number(access.hot_packets ?? 0),
    },
    by_type: countByType(packets),
    packets,
    generated_at: typeof metrics.generated_at === "string" ? (metrics.generated_at as unknown as string) : null,
    empty: packets.length === 0,
  };
}

function countByType(packets: MemoryPacketSummary[]): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  for (const packet of packets) counts.set(packet.type, (counts.get(packet.type) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

/**
 * One packet's readable body.
 *
 * Packets are OKF markdown with `x-kage-*` frontmatter and a trailing machine-state
 * fence. The reader wants the prose, so the frontmatter and the fence are stripped —
 * but the file is found by matching the catalog id, never by joining a caller-supplied
 * string onto a path, so a crafted id cannot walk out of the packets directory.
 */
export function readMemoryPacket(
  projectDir: string,
  id: string,
): {
  ok: boolean;
  id: string;
  title?: string;
  body?: string;
  type?: string;
  status?: string;
  paths?: string[];
  updated_at?: string;
  error?: string;
} {
  const catalog = readJson<CatalogFile>(join(memoryDir(projectDir), "indexes", "catalog.json"), {});
  const match = (catalog.packets ?? []).find((entry) => String(entry.id) === id);
  if (!match) return { ok: false, id, error: "no such memory in this repo" };

  const packetsDir = join(memoryDir(projectDir), "packets");
  const file = findPacketFile(packetsDir, id);
  if (!file) return { ok: false, id, error: "the catalog lists this memory but its file is missing — run kage refresh" };

  const raw = readFileSync(file, "utf8");
  return {
    ok: true,
    id,
    title: String(match.title ?? ""),
    body: stripPacketChrome(raw),
    type: match.type ? String(match.type) : undefined,
    status: match.status ? String(match.status) : undefined,
    paths: Array.isArray(match.paths) ? match.paths.map(String) : [],
    updated_at: match.updated_at ? String(match.updated_at) : undefined,
  };
}

function findPacketFile(packetsDir: string, id: string): string | null {
  if (!existsSync(packetsDir)) return null;
  try {
    for (const name of readdirSync(packetsDir)) {
      if (!name.endsWith(".md")) continue;
      const path = join(packetsDir, name);
      if (!statSync(path).isFile()) continue;
      // The id lives in frontmatter as x-kage-id; matching on content rather than on
      // a filename guess keeps this correct regardless of the slugging rules.
      const head = readFileSync(path, "utf8").slice(0, 2000);
      if (head.includes(`"${id}"`)) return path;
    }
  } catch {
    return null;
  }
  return null;
}

/** Strip OKF frontmatter and the trailing machine-state fence; keep the prose. */
export function stripPacketChrome(raw: string): string {
  let text = raw;
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end >= 0) text = text.slice(end + 4);
  }
  const fence = text.indexOf("## Kage state");
  if (fence >= 0) text = text.slice(0, fence);
  return text.trim();
}

// ── the flywheel, made visible ────────────────────────────────────────────────
// Memory and runs already reference each other — a ratified packet carries the
// run's tag, and a run records the packets its brief carried — but until now
// neither surface showed the other's half. These two readers close the loop:
// a packet can name the run that taught it and the runs it was briefed into; a
// merged run can name the packets it left behind. Runs from before these fields
// existed simply have no edges, and the surfaces then say nothing.

export interface FlywheelRunRef {
  id: string;
  intent: string;
  display_state: string;
}

function runRef(run: RunView): FlywheelRunRef {
  return { id: run.id, intent: run.intent, display_state: run.display_state };
}

export function packetFlywheel(
  projectDir: string,
  id: string,
): { born_from_run: FlywheelRunRef | null; used_by_runs: FlywheelRunRef[] } {
  const catalog = readJson<CatalogFile>(join(memoryDir(projectDir), "indexes", "catalog.json"), {});
  const entry = (catalog.packets ?? []).find((packet) => String(packet.id) === id);
  const tags = (entry?.tags ?? []).map(String);
  let runs: RunView[] = [];
  try {
    runs = listRuns(projectDir);
  } catch {
    runs = [];
  }
  const bornTag = tags.find((tag) => tag.startsWith(RUN_TAG_PREFIX));
  const bornRun = bornTag ? runs.find((run) => run.id === bornTag.slice(RUN_TAG_PREFIX.length)) : undefined;
  return {
    born_from_run: bornRun ? runRef(bornRun) : null,
    used_by_runs: runs.filter((run) => (run.brief_memory_ids ?? []).includes(id)).map(runRef),
  };
}

export function packetsTaughtByRun(
  projectDir: string,
  runId: string,
): Array<{ id: string; title: string; status: string }> {
  const catalog = readJson<CatalogFile>(join(memoryDir(projectDir), "indexes", "catalog.json"), {});
  const tag = runTag(runId);
  return (catalog.packets ?? [])
    .filter((packet) => Array.isArray(packet.tags) && packet.tags.map(String).includes(tag))
    .map((packet) => ({
      id: String(packet.id ?? ""),
      title: String(packet.title ?? "(untitled)"),
      status: String(packet.status ?? "active"),
    }));
}

/**
 * Record a reader's verdict on one memory.
 *
 * Browsing memory you cannot correct is a read-only museum: the moment a packet is
 * visibly wrong or stale, the reader is exactly the right person to say so, and
 * making them leave for a terminal is how bad memory survives. The kernel owns the
 * write (recordFeedback) — this only validates the input and forwards it, so the app
 * can never record a verdict the CLI could not.
 */
export function recordMemoryFeedback(
  projectDir: string,
  id: string,
  kind: string,
): { ok: boolean; id: string; kind?: string; error?: string } {
  const allowed = ["helpful", "wrong", "stale"];
  if (!allowed.includes(kind)) {
    return { ok: false, id, error: `kind must be one of ${allowed.join(", ")}` };
  }
  // Only ids this repo actually has — the same catalog check readMemoryPacket uses,
  // so a crafted id cannot reach the kernel's writer.
  const catalog = readJson<CatalogFile>(join(memoryDir(projectDir), "indexes", "catalog.json"), {});
  if (!(catalog.packets ?? []).some((entry) => String(entry.id) === id)) {
    return { ok: false, id, error: "no such memory in this repo" };
  }
  try {
    // Imported lazily: kernel.ts is large, and the memory view's read path must stay
    // cheap enough to serve on every page load.
    const { recordFeedback } = require("../kernel.js") as typeof import("../kernel.js");
    const result = recordFeedback(projectDir, id, kind as never);
    if (!result.ok) return { ok: false, id, error: result.errors.join("; ") };
    return { ok: true, id, kind };
  } catch (error) {
    return { ok: false, id, error: (error as Error).message };
  }
}
