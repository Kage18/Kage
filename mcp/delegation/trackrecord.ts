// Track record: the calibration display. Research finding behind it — users trust an
// agent they can predict, and an agent's self-reported confidence is worthless next to
// its batting average. Every number here is derived from runs on disk, so it cannot
// drift from what actually happened and cannot be inflated.
import { type RunType, type TaskRecord, listRuns, readClaim } from "./contract.js";

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
    if (claim && claim.checks.length && claim.checks.every((check) => check.result === "pass")) {
      entry.verified_first += 1;
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
    if (claim && claim.checks.length && claim.checks.every((check) => check.result === "pass")) bucket.verified_first += 1;
  }
  return out;
}

// Deliberately refuses to compare on thin data: a difference drawn from three runs is
// noise, and this product does not ship numbers it cannot stand behind.
export function renderCurationLine(projectDir: string): string {
  const { manager, kernel } = curationComparison(projectDir);
  if (!manager.dispatched && !kernel.dispatched) return "Manager judgment: no runs yet.";
  const rate = (record: TypeRecord): string =>
    record.dispatched ? `${record.verified_first}/${record.dispatched} verified first try` : "no runs";
  const line = `Manager-curated briefs: ${rate(manager)} · kernel-default briefs: ${rate(kernel)}`;
  const thin = manager.dispatched < 5 || kernel.dispatched < 5;
  return thin ? `${line} (too few runs to compare — collecting)` : line;
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
    if (claim.checks.every((check) => check.result === "pass")) claimsVerified += 1;
  }
  const perType = types
    .sort((a, b) => b[1].dispatched - a[1].dispatched)
    .slice(0, 3)
    .map(([type, entry]) => `${type} ${entry.verified_first}/${entry.dispatched}`)
    .join(" · ");
  return `Trust: ${claimsVerified}/${claimsTotal} claims fully verified · ${perType}`;
}
