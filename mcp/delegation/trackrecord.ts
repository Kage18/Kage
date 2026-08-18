// Track record: the calibration display. Research finding behind it — users trust an
// agent they can predict, and an agent's self-reported confidence is worthless next to
// its batting average. Every number here is derived from runs on disk, so it cannot
// drift from what actually happened and cannot be inflated.
import { type RunType, type TaskRecord, listRuns, readClaim } from "./contract.js";
import { claimVerdict } from "./verify.js";

export interface TypeRecord {
  dispatched: number;
  verified_first: number;
  merged: number;
  rejected: number;
}

export type TrackRecord = Partial<Record<RunType, TypeRecord>>;

function emptyRecord(): TypeRecord {
  return { dispatched: 0, verified_first: 0, merged: 0, rejected: 0 };
}

export function computeTrackRecord(projectDir: string, runs?: TaskRecord[]): TrackRecord {
  const record: TrackRecord = {};
  for (const task of runs ?? listRuns(projectDir)) {
    const entry = (record[task.type] ??= emptyRecord());
    entry.dispatched += 1;
    if (task.state === "merged") entry.merged += 1;
    if (task.state === "rejected") entry.rejected += 1;
    const claim = readClaim(projectDir, task.id);
    // "Every check passed" is not "verified" — a claim with no executed command can pass
    // every check it has (diff size, citations, reachability all run no code) and
    // claimVerdict is the one place that distinction lives. Ask it rather than re-deriving
    // pass/fail by folding over checks a second time.
    if (claim) {
      const verdict = claimVerdict(claim);
      if (verdict.passed && verdict.executed) entry.verified_first += 1;
    }
  }
  return record;
}

export interface ConfidenceVerdict {
  band: "low" | "medium" | "high";
  basis: string;
}

// Bands are deterministic and always carry their basis, so the user can audit the
// claim. The manager may lower a band, never raise it.
export function confidenceFor(projectDir: string, type: RunType, extra?: { memories: number }): ConfidenceVerdict {
  const entry = computeTrackRecord(projectDir)[type];
  const memoryNote = extra && extra.memories > 0 ? `, ${extra.memories} relevant ${extra.memories === 1 ? "memory" : "memories"}` : ", no relevant memory yet";
  if (!entry || entry.dispatched < 3) {
    return { band: "low", basis: `new task type for me (${entry?.dispatched ?? 0} prior ${type} run(s))${memoryNote}` };
  }
  const rate = entry.verified_first / entry.dispatched;
  const rateNote = `${entry.verified_first}/${entry.dispatched} ${type} runs verified first try${memoryNote}`;
  if (rate >= 0.8) return { band: "high", basis: rateNote };
  if (rate >= 0.5) return { band: "medium", basis: rateNote };
  return { band: "low", basis: rateNote };
}

export interface CurationComparison {
  manager: TypeRecord;
  kernel: TypeRecord;
}

// The point of recording judgment: find out whether it EARNS its tokens. Same metric,
// split by who shaped the brief. Nobody in this category can answer this question about
// their own agent; with the record in place, Kage can.
export function curationComparison(projectDir: string, runs?: TaskRecord[]): CurationComparison {
  const out: CurationComparison = { manager: emptyRecord(), kernel: emptyRecord() };
  for (const task of runs ?? listRuns(projectDir)) {
    const bucket = out[task.curated_by === "manager" ? "manager" : "kernel"];
    bucket.dispatched += 1;
    if (task.state === "merged") bucket.merged += 1;
    if (task.state === "rejected") bucket.rejected += 1;
    const claim = readClaim(projectDir, task.id);
    // Same rule as computeTrackRecord above: a fold over claim.checks alone cannot tell
    // "nothing executed" from "verified" — ask claimVerdict, which can.
    if (claim) {
      const verdict = claimVerdict(claim);
      if (verdict.passed && verdict.executed) bucket.verified_first += 1;
    }
  }
  return out;
}

// Below this many dispatched runs, a rate is noise, not a track record. renderCurationLine
// set this bar first (refusing to compare manager-vs-kernel judgment on thin data); the
// autonomy gate below reuses the same number rather than inventing a second threshold.
export const MIN_TRACK_RECORD_SAMPLE = 5;

// Deliberately refuses to compare on thin data: a difference drawn from three runs is
// noise, and this product does not ship numbers it cannot stand behind.
export function renderCurationLine(projectDir: string): string {
  const { manager, kernel } = curationComparison(projectDir);
  if (!manager.dispatched && !kernel.dispatched) return "Manager judgment: no runs yet.";
  const rate = (record: TypeRecord): string =>
    record.dispatched ? `${record.verified_first}/${record.dispatched} verified first try` : "no runs";
  const line = `Manager-curated briefs: ${rate(manager)} · kernel-default briefs: ${rate(kernel)}`;
  const thin = manager.dispatched < MIN_TRACK_RECORD_SAMPLE || kernel.dispatched < MIN_TRACK_RECORD_SAMPLE;
  return thin ? `${line} (too few runs to compare — collecting)` : line;
}

// The bar for handing a run TYPE unattended merge power. Same cutoff confidenceFor already
// uses to call a type's calibration "high" — autonomy should never trust a type more
// loosely than the number already shown to the user on every report.
export const AUTO_MERGE_MIN_VERIFIED_RATE = 0.8;

export type AutonomyGateVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Whether a run TYPE has earned autonomy 'merge''s unattended power, based on the
 * corrected track record above (nothing-executed no longer counts as verified). Below
 * MIN_TRACK_RECORD_SAMPLE dispatched runs of this type there is not enough data to trust
 * either way, so this holds and says exactly how thin the sample is — the same "collecting,
 * not concluding" stance renderCurationLine already takes. Above the sample floor, the
 * type's verified_first rate must clear AUTO_MERGE_MIN_VERIFIED_RATE.
 */
export function autonomyGateForType(projectDir: string, type: RunType): AutonomyGateVerdict {
  const entry = computeTrackRecord(projectDir)[type] ?? emptyRecord();
  if (entry.dispatched < MIN_TRACK_RECORD_SAMPLE) {
    return {
      ok: false,
      reason: `holding: only ${entry.dispatched} ${type} run(s) on record, need ${MIN_TRACK_RECORD_SAMPLE}`,
    };
  }
  const rate = entry.verified_first / entry.dispatched;
  if (rate < AUTO_MERGE_MIN_VERIFIED_RATE) {
    return {
      ok: false,
      reason:
        `holding: ${type} verified-first rate is ${entry.verified_first}/${entry.dispatched} ` +
        `(${Math.round(rate * 100)}%) — below the ${Math.round(AUTO_MERGE_MIN_VERIFIED_RATE * 100)}% bar for auto-merge`,
    };
  }
  return { ok: true };
}

export function renderTrustLine(projectDir: string): string {
  const runs = listRuns(projectDir);
  const record = computeTrackRecord(projectDir, runs);
  const types = Object.entries(record) as Array<[RunType, TypeRecord]>;
  if (!types.length) return "Trust: no runs yet.";
  let claimsVerified = 0;
  let claimsTotal = 0;
  for (const task of runs) {
    const claim = readClaim(projectDir, task.id);
    if (!claim || !claim.checks.length) continue;
    claimsTotal += 1;
    // Same rule again: "every check passed" is not "verified" when nothing executed.
    const verdict = claimVerdict(claim);
    if (verdict.passed && verdict.executed) claimsVerified += 1;
  }
  const perType = types
    .sort((a, b) => b[1].dispatched - a[1].dispatched)
    .slice(0, 3)
    .map(([type, entry]) => `${type} ${entry.verified_first}/${entry.dispatched}`)
    .join(" · ");
  return `Trust: ${claimsVerified}/${claimsTotal} claims fully verified · ${perType}`;
}
