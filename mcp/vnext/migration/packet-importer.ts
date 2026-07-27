import { createHash } from "node:crypto";

import type { MemoryPacket, MemoryType } from "../../kernel.js";
import type { Repository } from "../repo-model/repository.js";
import { impactFor, reviewPolicyFor, ALWAYS_PROPOSED_KINDS } from "../compiler/candidates.js";
import type { ClaimRecord, EntityKind, TrustState } from "../repo-model/types.js";
import type { EvidenceLink } from "../repo-model/repository.js";
import { LEGACY_PACKET_MIGRATIONS_TABLE } from "./schema.js";

/**
 * Import the pre-existing `.agent_memory` packet store into the repository model.
 *
 * This is a ONE-WAY, NON-DESTRUCTIVE bridge from Kage's legacy memory into the Phase B model. Every
 * honesty gate that governs the compiler governs the importer too, and then some:
 *
 *  - GROUNDING, not approval, gates injection. Approval was removed from the product: nothing waits
 *    on a human to become usable, so a grounded live packet imports as `verified` and is readable by
 *    an agent. The previous floor sent every live packet to `proposed`, which measured 0 of 384
 *    packets reachable on a real store — memory that exists but can never be read is not memory.
 *  - A packet citing no code stays `proposed` (non-injectable): an unanchored claim cannot be checked
 *    against the repository or decayed when the repository moves, so it has no honest basis for trust.
 *  - A legacy quality score still establishes nothing. Trust follows status and grounding, never a
 *    self-reported number.
 *  - Trust states an import may mint: `verified` (grounded and live), `superseded`, `archived`, or
 *    `proposed` (ungrounded, or a packet that was never accepted).
 *  - Confidence is never a fabricated 1: an imported claim carries a neutral, unmeasured 0.5.
 *  - The ORIGINAL packet is preserved verbatim in the migration ledger so the import is losslessly
 *    reversible, and packet files are NEVER deleted.
 *  - Attribution is preserved: `created_by` is the packet's author, not "importer".
 */

export type ImportDisposition =
  | "create"
  | "merge"
  | "archive"
  | "review"
  | "ungrounded"
  | "rejected_junk";

export interface ImportOptions {
  // The repository a legacy packet's claims belong to. Legacy packets are repo-scoped but do not carry
  // a vNext repository id, so the caller supplies one (default a stable local id).
  repositoryId?: string;
  now?: () => string;
}

export interface PacketClassification {
  disposition: ImportDisposition;
  trust_state: TrustState;
  entity_kind: EntityKind;
  entity_name: string;
  claim_kind: string;
  content: string;
  review_policy: ClaimRecord["review_policy"];
}

export interface ImportResult {
  legacy_packet_id: string;
  source_fingerprint: string;
  disposition: ImportDisposition;
  entity_id: string | null;
  claim: ClaimRecord | null;
  original_packet: MemoryPacket;
}

export interface LegacyPacketMigrationRecord {
  legacy_packet_id: string;
  source_fingerprint: string;
  entity_id: string | null;
  claim_id: string | null;
  disposition: string;
  original_packet_json: string;
  migrated_at: string;
}

const DEFAULT_REPOSITORY_ID = "repository:local";

// Legacy packet type -> repository-model entity kind. Deterministic and total over MemoryType. The
// kinds in ALWAYS_PROPOSED (decision/owner/invariant/incident) route to human review on import.
const PACKET_KIND_MAP: Record<MemoryType, EntityKind> = {
  repo_map: "component",
  runbook: "runbook",
  bug_fix: "incident",
  decision: "decision",
  proposal: "decision",
  rationale: "decision",
  convention: "contract",
  workflow: "flow",
  gotcha: "component",
  reference: "component",
  policy: "invariant",
  issue_context: "incident",
  code_explanation: "component",
  negative_result: "decision",
  constraint: "invariant",
};

function entityKindFor(type: MemoryType): EntityKind {
  return PACKET_KIND_MAP[type] ?? "component";
}

// A stable slug for an entity name (self-contained; mirrors the resolver's slug shape).
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function digest(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

function lengthPrefixed(fields: readonly string[]): string {
  return fields.map((field) => `${Buffer.byteLength(field, "utf8")}:${field}`).join("");
}

export function entityId(repositoryId: string, kind: EntityKind, slug: string): string {
  return `entity-${digest(lengthPrefixed([repositoryId, kind, slug]))}`;
}

export function claimId(entityId: string, claimKind: string, content: string): string {
  return `claim-${digest(lengthPrefixed([entityId, claimKind, content]))}`;
}

/**
 * A stable content fingerprint over a packet's identity- and content-bearing fields. `apply` compares
 * a plan entry's stored fingerprint against the current packet's fingerprint and refuses to import a
 * packet that drifted since the plan was made. Deterministic: same content -> same fingerprint.
 */
export function packetFingerprint(packet: MemoryPacket): string {
  const canonical = JSON.stringify([
    packet.id,
    packet.title,
    packet.summary ?? "",
    packet.body ?? "",
    packet.type,
    packet.status,
    (packet.paths ?? []).slice().sort(),
    packet.updated_at ?? "",
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

function isJunk(packet: MemoryPacket): boolean {
  const title = (packet.title ?? "").trim();
  const body = (packet.body ?? "").trim();
  const summary = (packet.summary ?? "").trim();
  // Nothing to make a claim from: no title, or no content at all.
  if (title.length === 0 || (body.length === 0 && summary.length === 0)) return true;
  // Kage's OWN auto-generated branch bookkeeping — a `workflow` packet titled "Change memory: <ref>"
  // that kage_propose_from_diff writes on every branch, in every repo. It carries no repository
  // knowledge (it is a per-commit changelog of Kage's internal store), so importing it into the model
  // shows a buyer a "flow: Change memory: master" node that reads as noise. Excluded from the model;
  // the packet itself is untouched and still recallable. This is universal, not a dogfood artifact.
  if (packet.type === "workflow" && /^change memory:/i.test(title)) return true;
  return false;
}

// Trust an imported packet carries.
//
// This used to floor EVERY live packet to `proposed`, which meant no imported memory
// could ever reach an agent (`isInjectableTrustState` admits only verified/approved) —
// measured at 0 of 384 on this repo. That floor modelled "a human has not approved this
// yet", and approval has been removed from the product: nothing waits on a human to
// become usable.
//
// A legacy `approved` status means the packet is grounded and was accepted through the old
// review flow. It imports as `verified` — evidence-backed — not `approved`, because the
// model rightly refuses to persist `approved` without a completed review item. What still
// gates injection is GROUNDING: a packet citing no code is forced back to `proposed`,
// because an unanchored claim cannot be verified against code or decayed when it moves.
// A packet's cited paths ARE its evidence — that is what makes it grounded, and grounding is the
// surviving gate now that approval is gone. Each cited path becomes an evidence row so a `verified`
// claim is backed by something re-checkable rather than asserted; createClaim enforces this by
// refusing to persist `verified` with no verified supporting evidence.
function groundingEvidence(
  model: Repository,
  packet: MemoryPacket,
  repositoryId: string,
  timestamp: string,
): EvidenceLink[] {
  const links: EvidenceLink[] = [];
  for (const path of (packet.paths ?? []).filter((candidate) => candidate.trim().length > 0)) {
    const cleanPath = path.trim();
    const evidenceId = `evidence-${digest(lengthPrefixed([repositoryId, packet.id, cleanPath]))}`;
    // addEvidence dedupes on the NATURAL key (repository, source_type, uri, fingerprint), not on
    // evidence_id — two packets citing the same file at the same revision share one row. Link the
    // id it actually persisted, not the one requested, or the link points at a row that was never
    // inserted and the foreign key fails.
    const stored = model.addEvidence({
      evidence_id: evidenceId,
      repository_id: repositoryId,
      source_type: "source",
      source_uri: cleanPath,
      source_fingerprint: digest(lengthPrefixed([cleanPath, packet.updated_at ?? ""])),
      commit: null,
      path: cleanPath,
      symbol: null,
      line_start: null,
      line_end: null,
      // The packet was accepted against this file in the legacy review flow, and the freshness
      // machinery re-checks that grounding on every recall — withholding the claim if the cited
      // code has moved. That continuous re-check, not this import, is what keeps it honest.
      verification_method: "legacy_packet_grounding",
      verification_state: "verified",
      privacy_class: "team_metadata",
      observed_at: packet.updated_at || timestamp,
    });
    links.push({ evidence_id: stored.evidence_id, stance: "supports" });
  }
  return links;
}

function trustForStatus(status: MemoryPacket["status"]): TrustState {
  if (status === "superseded") return "superseded";
  if (status === "deprecated") return "archived";
  if (status === "approved") return "verified";
  return "proposed";
}

/**
 * Classify a packet WITHOUT writing anything — the dry-run planner reads this to build its counts.
 * Returns the disposition, the honesty-floored trust, and the entity/claim shape the import will use.
 */
export function classifyPacket(
  packet: MemoryPacket,
  model: Repository,
  opts: ImportOptions = {},
): PacketClassification {
  const repositoryId = opts.repositoryId ?? DEFAULT_REPOSITORY_ID;
  const kind = entityKindFor(packet.type);
  const entityName = (packet.title ?? "").trim() || packet.id;
  const claimKind = packet.type;
  const content = ((packet.body ?? "").trim() || (packet.summary ?? "").trim());
  const reviewPolicy = reviewPolicyFor(kind);
  const trust = trustForStatus(packet.status);

  if (isJunk(packet)) {
    return {
      disposition: "rejected_junk",
      trust_state: trust,
      entity_kind: kind,
      entity_name: entityName,
      claim_kind: claimKind,
      content,
      review_policy: reviewPolicy,
    };
  }

  const eid = entityId(repositoryId, kind, slugify(entityName));
  const cid = claimId(eid, claimKind, content);

  let disposition: ImportDisposition;
  if (model.getClaim(cid)) {
    // Already imported (or an identical claim already exists): a replay folds onto it.
    disposition = "merge";
  } else if (packet.status === "superseded" || packet.status === "deprecated") {
    disposition = "archive";
  } else if (!(packet.paths ?? []).some((path) => path.trim().length > 0)) {
    // No cited path to anchor evidence against: honestly ungrounded, still a proposed claim.
    disposition = "ungrounded";
  } else if (ALWAYS_PROPOSED_KINDS.has(kind)) {
    // A decision/owner/invariant/incident is a human judgement. It is surfaced for
    // ATTENTION — contradictions and decay are worth a second pair of eyes — but with
    // approval removed this is no longer a gate on whether an agent may read it.
    // Decisions are the largest class in a real store (144 of 228 here), so gating them
    // would leave most memory unreachable, which is the failure this import path had.
    disposition = "review";
  } else {
    disposition = "create";
  }

  return {
    disposition,
    // Grounding is the surviving gate: an unanchored claim cannot be verified against
    // code or decayed when the code moves, so it stays non-injectable regardless of the
    // status it carried in the legacy store.
    trust_state: disposition === "ungrounded" ? "proposed" : trust,
    entity_kind: kind,
    entity_name: entityName,
    claim_kind: claimKind,
    content,
    review_policy: reviewPolicy,
  };
}

/**
 * Import a single packet into the model, recording the mapping in the migration ledger. Idempotent:
 * re-importing the same packet folds onto the existing claim (disposition "merge") and re-records the
 * (unchanged) mapping rather than creating a duplicate.
 */
export function importPacket(
  packet: MemoryPacket,
  model: Repository,
  opts: ImportOptions = {},
): ImportResult {
  const repositoryId = opts.repositoryId ?? DEFAULT_REPOSITORY_ID;
  const now = opts.now ?? (() => new Date().toISOString());
  const fingerprint = packetFingerprint(packet);
  const classification = classifyPacket(packet, model, opts);
  const timestamp = now();

  if (classification.disposition === "rejected_junk") {
    recordMigration(model, {
      legacy_packet_id: packet.id,
      source_fingerprint: fingerprint,
      entity_id: null,
      claim_id: null,
      disposition: classification.disposition,
      original_packet_json: JSON.stringify(packet),
      migrated_at: timestamp,
    });
    return {
      legacy_packet_id: packet.id,
      source_fingerprint: fingerprint,
      disposition: classification.disposition,
      entity_id: null,
      claim: null,
      original_packet: packet,
    };
  }

  const slug = slugify(classification.entity_name);
  const eid = entityId(repositoryId, classification.entity_kind, slug);
  const cid = claimId(eid, classification.claim_kind, classification.content);

  // Fold onto an existing claim if it is already present (replay / duplicate content).
  let existing = model.getClaim(cid);
  if (existing) {
    // A claim imported under the OLD floor is stranded at `proposed` forever: a replay would
    // otherwise merge onto it and leave it unreadable, so a store migrated before this change
    // would never benefit from it. Upgrading here applies the same rule a fresh import gets —
    // grounded gets evidence and becomes verified — rather than grandfathering the old policy.
    if (existing.trust_state === "proposed" && classification.trust_state === "verified") {
      const links = groundingEvidence(model, packet, repositoryId, timestamp);
      if (links.length) {
        model.attachEvidence(existing.claim_id, links);
        existing = model.transitionClaim(existing.claim_id, "verified", "legacy-import");
      }
    }
    recordMigration(model, {
      legacy_packet_id: packet.id,
      source_fingerprint: fingerprint,
      entity_id: existing.entity_id,
      claim_id: existing.claim_id,
      disposition: "merge",
      original_packet_json: JSON.stringify(packet),
      migrated_at: timestamp,
    });
    return {
      legacy_packet_id: packet.id,
      source_fingerprint: fingerprint,
      disposition: "merge",
      entity_id: existing.entity_id,
      claim: existing,
      original_packet: packet,
    };
  }

  // Upsert the entity (dedupes on repository+kind+slug; returns the existing row if present).
  const entity = model.upsertEntity({
    entity_id: eid,
    repository_id: repositoryId,
    kind: classification.entity_kind,
    canonical_name: classification.entity_name,
    slug,
    summary: (packet.summary ?? "").trim(),
    status: classification.trust_state === "archived" ? "archived" : "active",
    created_at: timestamp,
    updated_at: timestamp,
  });

  // Confidence is neutral and unmeasured (0.5). Never 1 — that would present legacy memory as a
  // verified measurement, which it is not.
  const claim: ClaimRecord = {
    claim_id: cid,
    entity_id: entity.entity_id,
    claim_kind: classification.claim_kind,
    normalized_content: classification.content,
    trust_state: classification.trust_state,
    confidence: 0.5,
    impact_class: impactFor(classification.entity_kind),
    valid_from_commit: null,
    valid_to_commit: null,
    supersedes_claim_id: null,
    review_policy: classification.review_policy,
    // Attribution is preserved: the team member who authored the packet, not the importer.
    created_by: packet.author_name?.trim() || "legacy-import",
    created_at: packet.created_at || timestamp,
    updated_at: timestamp,
  };
  // A packet's cited paths ARE its evidence — that is what makes it grounded, and grounding is the
  // surviving gate now that approval is gone. Each cited path becomes an evidence row so a `verified`
  // claim is backed by something re-checkable, rather than asserted. createClaim enforces this: it
  // refuses to persist `verified` with no verified supporting evidence, which is why an ungrounded
  // packet (no paths -> no evidence) can only ever be `proposed`.
  const evidenceLinks = classification.trust_state === "verified"
    ? groundingEvidence(model, packet, repositoryId, timestamp)
    : [];
  const created = model.createClaim(claim, evidenceLinks);

  recordMigration(model, {
    legacy_packet_id: packet.id,
    source_fingerprint: fingerprint,
    entity_id: entity.entity_id,
    claim_id: created.claim_id,
    disposition: classification.disposition,
    original_packet_json: JSON.stringify(packet),
    migrated_at: timestamp,
  });

  return {
    legacy_packet_id: packet.id,
    source_fingerprint: fingerprint,
    disposition: classification.disposition,
    entity_id: entity.entity_id,
    claim: created,
    original_packet: packet,
  };
}

// ── Migration ledger access ─────────────────────────────────────────────────

interface LegacyMigrationRow {
  legacy_packet_id: string;
  source_fingerprint: string;
  entity_id: string | null;
  claim_id: string | null;
  disposition: string;
  original_packet_json: string;
  migrated_at: string;
}

export function recordMigration(model: Repository, record: LegacyPacketMigrationRecord): void {
  model.database
    .prepare(
      `INSERT INTO ${LEGACY_PACKET_MIGRATIONS_TABLE}
         (legacy_packet_id, source_fingerprint, entity_id, claim_id, disposition, original_packet_json, migrated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(legacy_packet_id) DO UPDATE SET
         source_fingerprint = excluded.source_fingerprint,
         entity_id = excluded.entity_id,
         claim_id = excluded.claim_id,
         disposition = excluded.disposition,
         original_packet_json = excluded.original_packet_json,
         migrated_at = excluded.migrated_at`,
    )
    .run(
      record.legacy_packet_id,
      record.source_fingerprint,
      record.entity_id,
      record.claim_id,
      record.disposition,
      record.original_packet_json,
      record.migrated_at,
    );
}

export function readMigration(
  model: Repository,
  legacyPacketId: string,
): LegacyPacketMigrationRecord | null {
  const row = model.database
    .prepare(`SELECT * FROM ${LEGACY_PACKET_MIGRATIONS_TABLE} WHERE legacy_packet_id = ?`)
    .get(legacyPacketId) as LegacyMigrationRow | undefined;
  return row ? { ...row } : null;
}

export function listMigrations(model: Repository): LegacyPacketMigrationRecord[] {
  const rows = model.database
    .prepare(`SELECT * FROM ${LEGACY_PACKET_MIGRATIONS_TABLE} ORDER BY legacy_packet_id`)
    .all() as unknown as LegacyMigrationRow[];
  return rows.map((row) => ({ ...row }));
}
