// Estimation engine (tech design §11): quantiles over class-matched history, never a
// model. Pure over its inputs — callers fetch receipt samples however they store them —
// so every estimate is reproducible from the basis it cites.
//
// Two branches, both from the design:
//   matched    — enough completed work in the same blast-radius class: quantiles over
//                those neighbors, basis = their receipt ids.
//   cold_start — not enough history: global medians scaled by radius, and the estimate
//                SAYS SO. A low-confidence range beats a confident fabrication.

export interface ReceiptSample {
  receipt_id: string;
  /** Blast-radius class of the work this receipt belongs to, when known. */
  radius_class?: RadiusClass;
  total_tokens: number;
  sessions: number;
}

export type RadiusClass = "S" | "M" | "L";

export interface WorkShape {
  blast_paths: string[];
  dependents: number;
}

export interface Estimate {
  radius_class: RadiusClass;
  tokens_p50: number;
  tokens_p90: number;
  sessions_p50: number;
  confidence: "matched" | "cold_start" | "none";
  basis: string[];
}

export function radiusClass(shape: WorkShape): RadiusClass {
  const size = shape.blast_paths.length + shape.dependents;
  if (size <= 2) return "S";
  if (size <= 8) return "M";
  return "L";
}

const RADIUS_SCALE: Record<RadiusClass, number> = { S: 0.6, M: 1, L: 2.2 };
const MIN_NEIGHBORS = 3;

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}

export function estimateWork(shape: WorkShape, history: ReceiptSample[]): Estimate {
  const cls = radiusClass(shape);
  const neighbors = history.filter((sample) => sample.radius_class === cls);

  if (neighbors.length >= MIN_NEIGHBORS) {
    const tokens = neighbors.map((sample) => sample.total_tokens).sort((a, b) => a - b);
    const sessions = neighbors.map((sample) => sample.sessions).sort((a, b) => a - b);
    return {
      radius_class: cls,
      tokens_p50: quantile(tokens, 0.5),
      tokens_p90: quantile(tokens, 0.9),
      sessions_p50: quantile(sessions, 0.5),
      confidence: "matched",
      basis: neighbors.map((sample) => sample.receipt_id),
    };
  }

  if (history.length) {
    const tokens = history.map((sample) => sample.total_tokens).sort((a, b) => a - b);
    const sessions = history.map((sample) => sample.sessions).sort((a, b) => a - b);
    const scale = RADIUS_SCALE[cls];
    return {
      radius_class: cls,
      tokens_p50: Math.round(quantile(tokens, 0.5) * scale),
      tokens_p90: Math.round(quantile(tokens, 0.9) * scale),
      sessions_p50: Math.max(1, Math.round(quantile(sessions, 0.5) * scale)),
      confidence: "cold_start",
      basis: history.slice(0, 10).map((sample) => sample.receipt_id),
    };
  }

  // No history at all: refuse to invent a number. "none" renders as "no estimate yet —
  // completes after the first few tracked changes", never as a fabricated range.
  return { radius_class: cls, tokens_p50: 0, tokens_p90: 0, sessions_p50: 0, confidence: "none", basis: [] };
}
