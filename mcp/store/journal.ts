// Append-only status journal for packet lifecycle transitions.
//
// Supersede, stale marking, reverify, gc's deprecation, and compact's
// hard-stale deprecation / dead-citation pruning used to rewrite a packet's
// frontmatter in place — the rewrite class that turns every one of those
// calls into a merge conflict the moment two branches touch the same packet.
// This module replaces the rewrite with an append: each transition becomes
// one JSONL line in a per-month file under `.agent_memory/journal/`, and the
// packet file itself is never touched for these transitions.
//
// Readers reconstruct the current status by folding a packet's events onto
// its on-disk baseline at load time (applyJournalOverlay) — the packet file
// plus its journal events is the source of truth, not the file alone. Two
// branches that append events for different packets (or the same packet at
// different times) land on different lines, which git's line-based merge
// combines without conflict; see p1b-packet-status-changes.test.ts for a
// merge-then-overlay test proving the result is order-independent.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MemoryPacket, MemoryStatus } from "../kernel.js";
import { resolveMemoryLayout } from "./memory-layout.js";

export type JournalEventKind = "superseded" | "deprecated" | "stale" | "restored" | "reverified" | "pruned";

export interface JournalEvent {
  id: string;
  at: string;
  packet_id: string;
  kind: JournalEventKind;
  // superseded / deprecated
  replacement_packet_id?: string;
  reason?: string;
  // stale
  stale_reasons?: string[];
  suggested_action?: string;
  // reverified / pruned
  refreshed_paths?: string[];
  missing_paths?: string[];
  path_fingerprints?: unknown[];
  // pruned
  removed_paths?: string[];
}

// Routes through resolveMemoryLayout (memory-layout.ts) the same way
// kernel.ts's packetsDir does, so a migrated project's journal follows
// packets onto the kage/memory branch worktree automatically.
export function journalDir(projectDir: string): string {
  return join(resolveMemoryLayout(projectDir).root, "journal");
}

function monthBucket(at: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(at);
  return match ? `${match[1]}${match[2]}` : "unknown";
}

// Two calls in the same process (e.g. refresh marks a packet stale, then an
// immediate reverify) can land on the same wall-clock millisecond -- ordinary
// clock resolution, not a bug in the caller. The overlay sorts by (at, id),
// and event ids are random, so a real tie would make fold order (and thus
// which event "wins") arbitrary. Bumping the timestamp by 1ms past whatever
// this process has already used keeps same-process events strictly ordered
// without touching cross-process/cross-branch semantics: those events were
// never going to collide with this process's clock anyway, and the bumped
// value is still a real, valid ISO timestamp others sort correctly against.
let lastEventAt = "";
function monotonicAt(candidate: string): string {
  if (candidate > lastEventAt) {
    lastEventAt = candidate;
    return candidate;
  }
  const bumped = new Date(Date.parse(lastEventAt) + 1).toISOString();
  lastEventAt = bumped;
  return bumped;
}

// Appends one event and returns it with its generated id. Never rewrites an
// existing line — this is the only write this module performs.
export function appendJournalEvent(projectDir: string, event: Omit<JournalEvent, "id">): JournalEvent {
  const full: JournalEvent = { id: `evt:${randomUUID()}`, ...event, at: monotonicAt(event.at) };
  const dir = journalDir(projectDir);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `events-${monthBucket(full.at)}.jsonl`);
  writeFileSync(file, `${JSON.stringify(full)}\n`, { encoding: "utf8", flag: "a" });
  return full;
}

export function loadJournalEvents(projectDir: string): JournalEvent[] {
  const dir = journalDir(projectDir);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((name) => /^events-\d{6}\.jsonl$/.test(name)).sort();
  const events: JournalEvent[] = [];
  for (const name of files) {
    const content = readFileSync(join(dir, name), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as Partial<JournalEvent>;
        if (
          parsed && typeof parsed.id === "string" && typeof parsed.at === "string"
          && typeof parsed.packet_id === "string" && typeof parsed.kind === "string"
        ) {
          events.push(parsed as JournalEvent);
        }
      } catch {
        // A malformed line (partial write, hand edit) is skipped rather than
        // failing the whole load — the rest of the journal is still honest.
      }
    }
  }
  return events;
}

function laterOf(a: string, b: string): string {
  return b > a ? b : a;
}

// Folds one event onto a packet's current (baseline-or-already-folded) shape.
// Each kind only ever touches its own slice of quality/freshness, so folding
// events for a packet in ascending timestamp order is commutative across
// different kinds and last-write-wins within the same kind.
function foldEvent(packet: MemoryPacket, event: JournalEvent): MemoryPacket {
  const updated_at = laterOf(packet.updated_at, event.at);
  switch (event.kind) {
    case "superseded":
      return {
        ...packet,
        status: "superseded" as MemoryStatus,
        updated_at,
        quality: { ...packet.quality, superseded_by: event.replacement_packet_id, superseded_reason: event.reason },
        freshness: {
          ...packet.freshness,
          superseded_at: event.at,
          superseded_by: event.replacement_packet_id,
          superseded_reason: event.reason,
        },
      };
    case "deprecated":
      return { ...packet, status: "deprecated" as MemoryStatus, updated_at };
    case "stale":
      return {
        ...packet,
        updated_at,
        quality: {
          ...packet.quality,
          stale: true,
          stale_reasons: event.stale_reasons ?? [],
          suggested_action: event.suggested_action,
        },
      };
    case "restored": {
      const { stale: _stale, stale_reasons: _staleReasons, suggested_action: _suggestedAction, ...rest } = packet.quality;
      return { ...packet, updated_at, quality: rest };
    }
    case "reverified": {
      const { stale: _stale, stale_reasons: _staleReasons, suggested_action: _suggestedAction, ...rest } = packet.quality;
      return {
        ...packet,
        updated_at,
        paths: event.refreshed_paths && event.refreshed_paths.length ? event.refreshed_paths : packet.paths,
        quality: { ...rest, reverified_at: event.at },
        freshness: {
          ...packet.freshness,
          last_verified_at: event.at,
          ...(event.path_fingerprints ? { path_fingerprints: event.path_fingerprints } : {}),
        },
      };
    }
    case "pruned":
      // Unlike "reverified" (which only widens/refreshes an agent-confirmed citation
      // set and therefore never intentionally empties it), compact's dead-citation
      // pruning can legitimately drop every path a packet cited -- so an empty
      // refreshed_paths must still win over the baseline, not fall back to it.
      return {
        ...packet,
        updated_at,
        paths: event.refreshed_paths !== undefined ? event.refreshed_paths : packet.paths,
        freshness: {
          ...packet.freshness,
          last_verified_at: event.at,
          ...(event.path_fingerprints ? { path_fingerprints: event.path_fingerprints } : {}),
        },
      };
    default:
      return packet;
  }
}

// Reconstructs each packet's effective state as (on-disk baseline) + (its
// journal events, folded oldest to newest). Packets with no events pass
// through unchanged. This is the one shared overlay function every reader —
// recall staleness, gc, stale triage, pr check, the viewer, OKF export —
// picks up for free by loading packets through kernel.ts's packet loaders.
export function applyJournalOverlay(packets: MemoryPacket[], events: JournalEvent[]): MemoryPacket[] {
  if (!events.length) return packets;
  const byPacket = new Map<string, JournalEvent[]>();
  for (const event of events) {
    const list = byPacket.get(event.packet_id);
    if (list) list.push(event);
    else byPacket.set(event.packet_id, [event]);
  }
  if (!byPacket.size) return packets;
  return packets.map((packet) => {
    const list = byPacket.get(packet.id);
    if (!list || !list.length) return packet;
    // Sort by (at, id) — not file/read order — so the fold result is the same
    // regardless of how git interleaved two branches' appended lines.
    const sorted = [...list].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    return sorted.reduce(foldEvent, packet);
  });
}
