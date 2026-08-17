// Pre-flight blast radius: risk BEFORE work, which nobody else can do.
//
// The receipt's blast radius is measured after the diff exists. This is the same
// question asked before any code is written: the brief compiler already predicts
// where a task will land (memory citations + the code graph's answer for the
// intent), so the forecast is literally what the brief will carry — not a second,
// separate guess that could disagree with it. blastRadiusFor then counts what
// imports that predicted area.
//
// Honesty contract: this is a FORECAST and every surface must label it as one.
// When memory and the graph both have nothing to say, the answer is null and the
// surface says nothing — a confident-looking prediction from no evidence would be
// the pre-flight lying in the reassuring direction.
import { blastRadiusFor, type BlastRadius } from "./blast-radius.js";
import { compileBrief } from "./brief.js";
import { RUN_TYPES, type RunType } from "./contract.js";

export interface PreflightForecast {
  /** The brief's own predicted touch set (memory citations first, then the graph). */
  touches: string[];
  /** How many memory packets the brief will carry. */
  memories: number;
  memory_titles: string[];
  confidence: { band: string; basis: string };
  /** Dependents of the predicted area — null when the imports index cannot say. */
  blast: BlastRadius | null;
}

export function normalizeRunType(raw: string | null | undefined): RunType {
  return (RUN_TYPES as readonly string[]).includes(raw ?? "") ? (raw as RunType) : "chore";
}

export function preflightForecast(projectDir: string, intent: string, type: RunType): PreflightForecast | null {
  const trimmed = intent.trim();
  // A few characters is a keystroke, not an intent — too little signal to forecast.
  if (trimmed.length < 8) return null;
  let plan;
  try {
    plan = compileBrief(projectDir, trimmed, type);
  } catch {
    return null;
  }
  if (!plan.touches.length && !plan.memories.length) return null;
  // The dependents question is asked of the MEMORY-CITED paths — the actual
  // "briefs like this touched X" evidence — not the full predicted touch set.
  // The code graph expands touches with every file matching the intent's terms,
  // which happily includes the dependents themselves; blastRadiusFor would then
  // exclude them as intra-change and the forecast would undercount exactly the
  // risk it exists to show. Graph touches are the basis only when memory is silent.
  const memoryPaths = [...new Set(plan.memories.flatMap((memory) => memory.paths))];
  const blastBasis = memoryPaths.length ? memoryPaths : plan.touches;
  return {
    touches: plan.touches,
    memories: plan.memories.length,
    memory_titles: plan.memories.slice(0, 2).map((memory) => memory.title),
    confidence: { band: plan.confidence.band, basis: plan.confidence.basis },
    blast: blastBasis.length ? blastRadiusFor(projectDir, blastBasis) : null,
  };
}
