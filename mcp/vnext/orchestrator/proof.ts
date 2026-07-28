// The Proof surface (orchestrator design §8): what Kage measurably did, computed from the
// stage log and the value ledger. The design's rule holds here more than anywhere — a metric
// is measured or it is absent, and an absent one says what would unlock it. Nothing on this
// page is estimated and presented as fact, because this is the page a team renews on.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { valueSummary } from "../../kernel.js";
import { deriveWorkState, type DerivedWorkItem } from "./derive.js";
import { attentionQueue } from "./attention.js";

export interface ProofMetricDto {
  id: string;
  label: string;
  /** Null when unmeasured. Never a zero standing in for "we don't know". */
  value: number | null;
  unit: "count" | "days" | "percent" | "tokens";
  /** Exactly how this number was produced, so a reader can audit it. */
  formula: string;
  /** Present only when value is null: what the team must do to make it measurable. */
  unlock?: string;
}

export interface ProofReportDto {
  project_dir: string;
  generated_at: string;
  metrics: ProofMetricDto[];
  /** Per-item cycle times that were actually measurable, newest first. */
  cycle_times: Array<{ work_id: string; title: string; days: number }>;
}

const DAY_MS = 86_400_000;
const LEDGER_UNLOCK = "Run an agent through `kage up` — recalls are only counted when Kage is in the loop.";

// Git records commit times to the SECOND, while command events carry milliseconds. Work that
// claims and merges inside the same second therefore lands with `done` fractionally BEFORE
// `claimed` — a clock artifact, not an inverted history. Absorb exactly that much and no more:
// a larger inversion is a genuine data problem and must stay unmeasurable rather than clamp
// quietly to zero.
const CLOCK_GRANULARITY_MS = 1000;

// Cycle time is only real when BOTH ends were observed: the claim that started it and the
// merge or gate that ended it. An item still in flight has no cycle time — not a zero.
function cycleDays(item: DerivedWorkItem): number | null {
  const start = item.stage_log.find((step) => step.stage === "claimed");
  const end = item.stage_log.find((step) => step.stage === "done");
  if (!start || !end) return null;
  const delta = Date.parse(end.at) - Date.parse(start.at);
  if (!Number.isFinite(delta)) return null;
  if (delta < 0) return delta >= -CLOCK_GRANULARITY_MS ? 0 : null;
  return Math.round((delta / DAY_MS) * 100) / 100;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

interface ValueTotals {
  recalls: number;
  stale_withheld: number;
  tokens_saved: number;
}

// The kernel owns the ledger's shape, so read it through the kernel rather than re-parsing
// its file. The existence check is what separates "measured zero" from "never measured" —
// `valueSummary` returns zeros for a missing ledger, and a zero shown as fact would be a lie.
function valueTotals(projectDir: string): ValueTotals | null {
  if (!existsSync(join(projectDir, ".agent_memory", "reports", "value.json"))) return null;
  try {
    const all = valueSummary(projectDir).all_time;
    return { recalls: all.recalls, stale_withheld: all.stale_withheld, tokens_saved: all.tokens_saved };
  } catch {
    return null;
  }
}

export function buildProof(projectDir: string): ProofReportDto {
  const board = deriveWorkState(projectDir);
  const totals = valueTotals(projectDir);

  const measured = board.items
    .map((item) => ({ item, days: cycleDays(item) }))
    .filter((entry): entry is { item: DerivedWorkItem; days: number } => entry.days !== null);

  const metrics: ProofMetricDto[] = [
    {
      id: "cycle_time_median",
      label: "Cycle time (median)",
      value: median(measured.map((entry) => entry.days)),
      unit: "days",
      formula: "median(done.at − claimed.at) over items where both stages were observed",
      ...(measured.length ? {} : { unlock: "Claim an item and merge its branch — cycle time needs both ends observed." }),
    },
    {
      id: "items_shipped",
      label: "Items shipped",
      value: board.items.filter((item) => item.derived_stage === "done").length,
      unit: "count",
      formula: "work items whose commits reached the default branch, or whose gate was approved",
    },
    {
      id: "attention_open",
      label: "Attention items open",
      value: attentionQueue(projectDir).length,
      unit: "count",
      formula: "live count of decisions only a human can make — the number this product exists to drive to zero",
    },
    {
      id: "rework_prevented",
      label: "Stale claims withheld",
      value: totals ? totals.stale_withheld : null,
      unit: "count",
      formula: "ledger events where memory was withheld because its cited code had moved",
      ...(totals ? {} : { unlock: LEDGER_UNLOCK }),
    },
    {
      id: "recalls_served",
      label: "Recalls served",
      value: totals ? totals.recalls : null,
      unit: "count",
      formula: "ledger events where memory was injected instead of rediscovered",
      ...(totals ? {} : { unlock: LEDGER_UNLOCK }),
    },
    {
      id: "tokens_saved",
      label: "Tokens saved (estimated)",
      value: totals ? totals.tokens_saved : null,
      unit: "tokens",
      // Labelled estimated because it is: read-vs-source, the same basis `kage gains` reports.
      formula: "estimated read-vs-source difference per served recall, summed over the ledger",
      ...(totals ? {} : { unlock: LEDGER_UNLOCK }),
    },
    {
      id: "estimate_accuracy",
      label: "Estimate accuracy",
      // Deliberately null: receipts are not yet linked to work items, so there is no honest
      // actual to compare an estimate against. Showing a number here would be inventing one.
      value: null,
      unit: "percent",
      formula: "median(|actual − p50| / p50) per blast-radius class",
      unlock: "Needs receipts linked to work items; estimates currently report `none` for the same reason.",
    },
  ];

  return {
    project_dir: projectDir,
    generated_at: new Date().toISOString(),
    metrics,
    cycle_times: measured
      .sort((a, b) => b.days - a.days)
      .map((entry) => ({ work_id: entry.item.work_id, title: entry.item.title, days: entry.days })),
  };
}
