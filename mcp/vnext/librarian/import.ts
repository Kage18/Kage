// Migrating the legacy packet store into cards.
//
// 229 packets survive in `.agent_memory/packets/`. They are not simply copied across: the whole
// point of the new core is that admission is scarce and every claim is falsifiable, so a packet
// earns a card only by passing the same gate a fresh proposal would. Most will not, and that is
// the intended outcome — the legacy store's own audit found 43% of it dead and its admission gate
// exempted anything labelled `decision`, which is why 54% of it carried that label.
//
// What this module does NOT do: rewrite claims. A packet's body is its author's words, and a
// migration that paraphrased would quietly invent memory the team never wrote. Bodies are
// truncated at a sentence boundary and otherwise carried verbatim; anything that cannot survive
// that unchanged is reported as skipped rather than fixed up.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CardKind, CardProposal, Citation } from "./types.js";

/** The 15 legacy types collapse onto three kinds. Anything unmapped is deliberately not imported. */
const KIND_MAP: Record<string, CardKind> = {
  decision: "decision",
  proposal: "decision",
  negative_result: "decision",
  code_explanation: "decision",
  bug_fix: "caution",
  gotcha: "caution",
  incident: "caution",
  runbook: "runbook",
  workflow: "runbook",
  convention: "runbook",
};

/**
 * Types with no honest home in the new model, listed so the reason is on the record rather than
 * implied by absence. `repo_map` and `reference` are DERIVABLE — the code and the index already
 * answer them, which is exactly what the derivability gate exists to refuse.
 */
export const UNMAPPED_TYPES = ["repo_map", "reference", "session_summary", "change_memory"] as const;

/**
 * Bookkeeping the legacy writers generated about their own runs, recognised by SHAPE rather than
 * by type — which is the only way to catch it, because these were filed under ordinary types
 * (`workflow`, `decision`) and so slip past the type map.
 *
 * Found by dogfooding the import: half the cards it first admitted were `Change memory: <branch>`
 * packets whose body is a diff summary, and one of them was served to an agent by the pre-edit
 * hook. A changelog is not a claim — nothing in it can be true or false about the code — so it
 * fails the store's first rule even though it carries a citation.
 */
function isBookkeeping(packet: LegacyPacket): boolean {
  if (/^(change memory|diff proposal|session summary|pr summary)\b/i.test(packet.title.trim())) return true;
  // A body that is mostly a fenced dump or a file list is a record of a run, not a claim about
  // the system. The legacy `Diff summary:` header is the reliable marker.
  if (/diff summary:/i.test(packet.body)) return true;
  return false;
}

export interface LegacyPacket {
  file: string;
  id: string;
  type: string;
  title: string;
  body: string;
  paths: string[];
  tags: string[];
  status: string;
  verified: string;
  timestamp: string;
}

const frontmatterValue = (block: string, key: string): string | undefined => {
  const line = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(block);
  if (!line) return undefined;
  const raw = line[1].trim();
  try {
    return typeof JSON.parse(raw) === "string" ? (JSON.parse(raw) as string) : raw;
  } catch {
    return raw.replace(/^"|"$/g, "");
  }
};

const frontmatterList = (block: string, key: string): string[] => {
  const line = new RegExp(`^${key}:\\s*(\\[.*\\])$`, "m").exec(block);
  if (!line) return [];
  try {
    const parsed = JSON.parse(line[1]) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
};

/** Parse one packet file. Returns null on anything malformed — a bad file is skipped, never guessed at. */
export function parsePacket(file: string, content: string): LegacyPacket | null {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(content);
  if (!match) return null;
  const [, front, rest] = match;

  const title = frontmatterValue(front, "title");
  const id = frontmatterValue(front, "x-kage-id");
  const type = frontmatterValue(front, "x-kage-type");
  if (!title || !id || !type) return null;

  // The body: strip everything the legacy writer generated ABOUT the packet, keeping only the
  // prose a human actually wrote.
  //
  // The fenced ```json kage-state block is the OKF "lossless round-trip" payload — the whole
  // packet re-serialized inside its own file, which is why DIRECTION.md records that the format
  // doubled every packet. Left in, it flows straight into the claim: dogfooding showed a card
  // reaching the Inbox whose text was `{"schema_version":2,"id":"repo:memory:decision:...`.
  // Serialized state is not a claim about anything.
  const withoutState = rest.replace(/```[a-z-]*\s*kage-state[\s\S]*?```/gi, "").replace(/```[\s\S]*?```/g, "");
  const body = withoutState
    .split("\n")
    .filter((line) => !line.startsWith("# ") && !line.startsWith("> "))
    .join("\n")
    .trim();

  return {
    file,
    id,
    type,
    title,
    body,
    paths: frontmatterList(front, "x-kage-paths"),
    tags: frontmatterList(front, "tags"),
    status: frontmatterValue(front, "x-kage-status") ?? "unknown",
    verified: frontmatterValue(front, "x-kage-verified") ?? "unverified",
    timestamp: frontmatterValue(front, "timestamp") ?? "",
  };
}

export function readPackets(projectDir: string): LegacyPacket[] {
  const dir = join(projectDir, ".agent_memory", "packets");
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const packets: LegacyPacket[] = [];
  for (const file of files) {
    try {
      const packet = parsePacket(file, readFileSync(join(dir, file), "utf8"));
      if (packet) packets.push(packet);
    } catch {
      // Unreadable file: skipped. One bad packet must not abort a 229-file migration.
    }
  }
  return packets;
}

/** ~120 words is what the Librarian is asked for; a legacy body is cut to the same shape. */
const CLAIM_WORD_TARGET = 120;

/**
 * Truncate at a SENTENCE boundary, never mid-thought.
 *
 * A claim cut mid-sentence reads as corrupted and, worse, can invert its own meaning — "this is
 * safe because" is not a safe claim. If no sentence boundary fits, the packet is refused rather
 * than mangled.
 */
export function truncateClaim(body: string): string | null {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return null;
  if (flat.split(" ").length <= CLAIM_WORD_TARGET) return flat;

  const sentences = flat.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return null;

  let claim = "";
  for (const sentence of sentences) {
    const next = (claim + sentence).trim();
    if (next.split(" ").length > CLAIM_WORD_TARGET) break;
    claim = next;
  }
  return claim.split(" ").length >= 8 ? claim : null;
}

export interface ImportCandidate {
  packet: LegacyPacket;
  proposal: CardProposal;
}

export interface ImportSkip {
  packet: LegacyPacket;
  reason: string;
}

export interface ImportOptions {
  /**
   * Import only packets a human actually confirmed. ON by default, and this is the load-bearing
   * default of the whole migration.
   *
   * Measured on this repository: 230 surviving packets, of which 225 pass every other check — an
   * inbox nobody would ever clear, which is precisely the junk-inbox failure that made Cursor
   * delete its Memories feature. `x-kage-verified: verified` is a signal the legacy store already
   * carries and that a person already gave: 35 packets, a reviewable batch. Everything else stays
   * where it is, retrievable with `--all` by someone who has decided to do that work.
   */
  requireVerified?: boolean;
  /** Citations must resolve against the tree as it stands. A claim about a deleted file is not evidence. */
  pathExists?: (path: string) => boolean;
}

/**
 * Turn packets into proposals, refusing everything that cannot become an honest card.
 *
 * The refusals are the substance of this function. A packet is skipped when it is dead, when its
 * type has no home, when it cites nothing (the new store's first rule), or when its body cannot be
 * cut to a claim without mangling it. None of those are repaired, because repairing them would mean
 * inventing the missing part.
 */
export function planImport(
  packets: readonly LegacyPacket[],
  options: ImportOptions = {},
): { candidates: ImportCandidate[]; skipped: ImportSkip[] } {
  const requireVerified = options.requireVerified ?? true;
  const candidates: ImportCandidate[] = [];
  const skipped: ImportSkip[] = [];

  for (const packet of packets) {
    if (packet.status !== "approved") {
      skipped.push({ packet, reason: `status is ${packet.status}, not approved` });
      continue;
    }
    if (["deprecated", "stale", "superseded"].includes(packet.verified)) {
      skipped.push({ packet, reason: `already ${packet.verified} in the legacy store` });
      continue;
    }
    if (isBookkeeping(packet)) {
      skipped.push({ packet, reason: "generated bookkeeping about a run, not a claim about the code" });
      continue;
    }
    const kind = KIND_MAP[packet.type];
    if (!kind) {
      skipped.push({ packet, reason: `type '${packet.type}' has no home in the three kinds` });
      continue;
    }
    if (requireVerified && packet.verified !== "verified") {
      skipped.push({ packet, reason: "never verified by a human — import it explicitly with --all" });
      continue;
    }
    if (packet.paths.length === 0) {
      skipped.push({ packet, reason: "cites nothing — a claim nothing can falsify is trivia" });
      continue;
    }
    // A packet whose cited file is gone cannot be re-grounded, and importing it would create a
    // card that is stale the instant it is written.
    const missing = options.pathExists ? packet.paths.filter((path) => !options.pathExists!(path)) : [];
    if (missing.length) {
      skipped.push({ packet, reason: `cited path no longer exists: ${missing[0]}` });
      continue;
    }
    const claim = truncateClaim(packet.body);
    if (!claim) {
      skipped.push({ packet, reason: "body could not be cut to a claim without mangling it" });
      continue;
    }

    const citations: Citation[] = packet.paths.slice(0, 6).map((path) => ({ path }));
    candidates.push({
      packet,
      proposal: {
        kind,
        title: packet.title.slice(0, 160),
        claim,
        citations,
        // The legacy store had no triggers — it retrieved by query similarity, which is the axis the
        // new design rejects. The honest reconstruction is the files the packet already cites.
        trigger: `working on ${packet.paths.slice(0, 3).join(", ")}`,
        tags: [...new Set([...packet.tags, "imported"])].slice(0, 8),
      },
    });
  }

  return { candidates, skipped };
}

/** A one-line reason summary, so a human can see WHY a migration dropped what it dropped. */
export function summarizeSkips(skipped: readonly ImportSkip[]): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>();
  for (const skip of skipped) {
    // Collapse the parameterised reasons so the summary is readable rather than 229 unique lines.
    const key = skip.reason
      .replace(/status is \w+/, "status is not approved")
      .replace(/type '[^']+'/, "type")
      .replace(/already \w+ in/, "already dead in")
      .replace(/cited path no longer exists: .*/, "cited path no longer exists");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}
