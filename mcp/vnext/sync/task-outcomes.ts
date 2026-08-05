// The PRODUCER of privacy-safe team task outcomes, from what a local install actually recorded.
//
// Everything downstream of this module (suppression, the pilot comparison, the portal panel) was written
// against hand-made fixtures. This is the only place where a REAL task becomes a team metric, so it is
// where the honesty and privacy rules have to hold on data nobody curated:
//
//   1. MEASURED OR NULL — NEVER ZERO. A cost is emitted only when every request in the task was priced
//      on BOTH sides. A quantity this install does not record at all (which knowledge a capsule reused,
//      how many review decisions a task caused) is emitted as NULL, not 0/[]. Zero is a measurement
//      ("we looked, there was none"); null is the truth ("nobody measured this").
//
//   2. NO IDENTITY LEAVES. The local `tasks.user_id` (an email or login) never travels. What travels is
//      a SALTED hash of it — enough for the workspace to count distinct PEOPLE and enforce a per-person
//      k-anonymity floor, not enough to name one. The salt is per install, so the pseudonym is not a
//      dictionary lookup away from the address it came from.
//
//   3. ONLY TASKS KAGE TOUCHED. A task with no context delivery has no measured delivery outcome; it is
//      skipped entirely rather than reported with an invented status.
import { createHash } from "node:crypto";
import type { TransformationReceipt } from "../protocol/index.js";
import type { LocalDatabase } from "../storage/database.js";
import type { StoredContextDelivery } from "../storage/delivery-store.js";
import { calculateCohort } from "../gateway/cohort-metrics.js";
import { validateTaskOutcome } from "../sync/team-metrics.js";
import type {
  MeasurementQualityClass,
  TaskDeliveryStatus,
  TaskMode,
  TeamTaskOutcomeRecord,
} from "../sync/team-metrics.js";

/** The stores a collection reads. Narrow interfaces so a caller can pass its live stores directly. */
export interface TaskOutcomeSources {
  database: LocalDatabase;
  receipts: { forTask(taskId: string): TransformationReceipt[] };
  deliveries: { forTask(taskId: string): StoredContextDelivery[] };
}

export interface TaskOutcomeOptions {
  /**
   * Per-install secret mixed into the actor pseudonym. REQUIRED: an unsalted hash of an email address is
   * reversible by anyone with a list of addresses, which would make the "pseudonym" an identifier.
   */
  actorSalt: string;
  /** Restrict to one repository; omitted means every repository in the local store. */
  repositoryId?: string;
  /** Only tasks started at or after this ISO instant. */
  since?: string;
}

interface TaskRow {
  task_id: string;
  repository_id: string;
  agent_surface: string;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
}

/**
 * A salted, truncated pseudonym for the person who ran a task. Truncation to 128 bits keeps it short
 * while leaving collisions negligible; collisions would only ever UNDER-count distinct people, which
 * fails toward more suppression, never less.
 */
export function actorPseudonym(userId: string | null, salt: string): string {
  const material = userId === null || userId === "" ? "unattributed" : userId;
  return `actor-${createHash("sha256").update(`${salt}\u0000${material}`).digest("hex").slice(0, 32)}`;
}

/** Normalize a local timestamp to an ISO instant the workspace validator accepts, or null. */
function isoOrNull(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

/**
 * The measurement class for one task's requests. `exact` demands that EVERY request was classed exact
 * AND priced on both sides — one unpriced request in the task makes the task's economics partial, because
 * summing the priced subset and calling it the task's cost would silently drop the unmeasured requests.
 */
function qualityFor(receipts: readonly TransformationReceipt[], pricedRequests: number): MeasurementQualityClass {
  if (receipts.length === 0) return "unavailable";
  const allExact = receipts.every((receipt) => receipt.measurement_quality === "exact");
  if (allExact && pricedRequests === receipts.length) return "exact";
  return pricedRequests > 0 || receipts.some((r) => r.measurement_quality !== "unavailable")
    ? "partial"
    : "unavailable";
}

/** The task's delivery outcome: a failed-open anywhere in the task is the outcome that matters. */
function deliveryStatusFor(deliveries: readonly StoredContextDelivery[]): TaskDeliveryStatus | null {
  if (deliveries.length === 0) return null;
  if (deliveries.some((delivery) => delivery.status === "failed_open")) return "failed_open";
  if (deliveries.some((delivery) => delivery.status === "delivered")) return "delivered";
  return "skipped";
}

/** The task's mode: the mode its requests ran in; assist wins over audit when a task mixed them. */
function modeFor(receipts: readonly TransformationReceipt[]): TaskMode {
  if (receipts.some((receipt) => receipt.mode === "protect")) return "protect";
  if (receipts.some((receipt) => receipt.mode === "assist")) return "assist";
  return "audit";
}

/**
 * Roll this install's local records into privacy-safe team task outcomes. Deterministic: same store,
 * same salt, same output. Every returned record has passed the workspace's own ingest validator, so a
 * record this function emits can never be the thing that rejects a batch.
 */
export function collectTaskOutcomes(
  sources: TaskOutcomeSources,
  options: TaskOutcomeOptions,
): TeamTaskOutcomeRecord[] {
  if (!options.actorSalt) {
    throw new Error("collectTaskOutcomes requires an actorSalt; an unsalted actor hash is an identifier");
  }
  const clauses: string[] = [];
  const params: string[] = [];
  if (options.repositoryId) {
    clauses.push("repository_id = ?");
    params.push(options.repositoryId);
  }
  if (options.since) {
    clauses.push("started_at >= ?");
    params.push(options.since);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const rows = sources.database
    .prepare(
      `SELECT task_id, repository_id, agent_surface, user_id, started_at, ended_at
         FROM tasks${where} ORDER BY started_at, task_id`,
    )
    .all(...params) as unknown as TaskRow[];

  const outcomes: TeamTaskOutcomeRecord[] = [];
  for (const row of rows) {
    const deliveries = sources.deliveries.forTask(row.task_id);
    const deliveryStatus = deliveryStatusFor(deliveries);
    // A task Kage never delivered into has no measured outcome. Reporting one would be an invention.
    if (deliveryStatus === null) continue;

    const receipts = sources.receipts.forTask(row.task_id);
    const cohort = calculateCohort(receipts);
    const quality = qualityFor(receipts, cohort.cost_delta_receipts);
    const started = isoOrNull(row.started_at);
    if (started === null) continue;

    const record: TeamTaskOutcomeRecord = {
      task_id: row.task_id,
      repository_id: row.repository_id,
      actor_id: actorPseudonym(row.user_id, options.actorSalt),
      agent_surface: row.agent_surface,
      mode: modeFor(receipts),
      measurement_quality: quality,
      // The quality class governs: a partial task contributes its presence and no economics at all.
      net_input_cost_delta_usd: quality === "exact" ? cohort.total_net_input_cost_delta_usd : null,
      kage_processing_cost_usd:
        quality === "exact" && cohort.kage_processing_cost_receipts > 0
          ? cohort.kage_processing_cost_total_usd
          : null,
      latency_ms: cohort.latency_samples > 0 ? cohort.p50_latency_ms : null,
      delivery_status: deliveryStatus,
      // Verification lifecycle timestamps are not recorded locally (no claim carries a verified_at for
      // the change a task produced), so this install cannot measure it. `unavailable` + null says that;
      // "unverified" would be a claim about the work, and a verified_at would be an invention.
      verification_outcome: "unavailable",
      // NULL, not []: this install does not record which knowledge a delivered capsule reused, and an
      // empty array would publish "this team reuses nothing" as if it had been measured.
      knowledge_ids_reused: null,
      // NULL, not 0: review decisions are recorded per claim, not per task, so none are attributable here.
      review_decisions: null,
      started_at: started,
      ended_at: isoOrNull(row.ended_at),
      verified_at: null,
    };
    outcomes.push(validateTaskOutcome(record));
  }
  return outcomes;
}
