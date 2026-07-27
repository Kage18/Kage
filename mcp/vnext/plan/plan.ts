// The plan loop's deterministic core (orchestrator design §7): an intent becomes grounded,
// sized work items — using only ground truth. What the team already knows arrives via
// recall; what the change touches via the packets it grounds to; division follows the
// repository's own structure. The LLM drafting pass (design step 2) layers prose on top of
// this later, through the proxy loopback — it is an enhancement to grounding, never a
// substitute for it, so the deterministic core ships first and alone is useful.

import { capture, recall, kageRisk, type MemoryPacket } from "../../kernel.js";
import { estimateWork, type Estimate, type ReceiptSample } from "../orchestrator/estimate.js";

export interface PlannedItem {
  work_id: string;
  title: string;
  paths: string[];
  dependents: string[];
  estimate: Estimate;
}

export interface PlanResult {
  ok: boolean;
  project_dir: string;
  intent: string;
  /** Memory that bears on this intent — surfaced at plan time, not discovered at build time. */
  bearing_memory: Array<{ id: string; title: string; paths: string[] }>;
  items: PlannedItem[];
  errors: string[];
}

// Division rule: group grounded paths by their top-level directory. One cluster ≈ one work
// item — a change spanning `src/api` and `platform/web` is two units of work with an
// ordering question, not one ticket. Deliberately simple and inspectable; dependency-graph
// clustering (design §7 step 4) refines this, it does not replace its honesty.
function clusterPaths(paths: string[]): Map<string, string[]> {
  const clusters = new Map<string, string[]>();
  for (const path of paths) {
    const top = path.includes("/") ? path.slice(0, path.indexOf("/")) : ".";
    clusters.set(top, [...(clusters.get(top) ?? []), path]);
  }
  return clusters;
}

export function planIntent(
  projectDir: string,
  intent: string,
  options: { title?: string; receipts?: ReceiptSample[] } = {},
): PlanResult {
  const result: PlanResult = {
    ok: false,
    project_dir: projectDir,
    intent,
    bearing_memory: [],
    items: [],
    errors: [],
  };
  const trimmed = intent.trim();
  if (trimmed.length < 12) {
    result.errors.push("An intent needs a sentence, not a phrase — say what should become true.");
    return result;
  }

  // Ground: what does the team already know that bears on this? Recall is the same engine
  // that briefs agents — plan-time and build-time knowledge cannot diverge.
  const recalled = recall(projectDir, trimmed, 6).results.map((entry) => entry.packet);
  result.bearing_memory = recalled.map((packet: MemoryPacket) => ({
    id: packet.id,
    title: packet.title,
    paths: packet.paths,
  }));

  const groundedPaths = [...new Set(recalled.flatMap((packet) => packet.paths))].filter(Boolean);
  const clusters = groundedPaths.length ? clusterPaths(groundedPaths) : new Map([[".", [] as string[]]]);

  for (const [cluster, paths] of clusters) {
    const title = clusters.size > 1
      ? `${options.title ?? trimmed.slice(0, 60)} — ${cluster}`
      : options.title ?? trimmed.slice(0, 80);
    const created = capture({
      projectDir,
      type: "proposal",
      title,
      body: `${trimmed}\n\nPlanned from intent; grounded to ${paths.length ? paths.join(", ") : "no cited code yet — name the files before claiming"}.`,
      paths,
      tags: ["planned"],
    });
    if (!created.ok || !created.packet) {
      result.errors.push(`cluster ${cluster}: ${created.errors.join("; ") || "capture refused"}`);
      continue;
    }
    let dependents: string[] = [];
    try {
      const risk = kageRisk(projectDir, paths);
      dependents = [...new Set(Object.values(risk.targets).flatMap((target) => target.dependents ?? []))];
    } catch { /* risk is advisory; a plan without it still stands */ }

    result.items.push({
      work_id: created.packet.id,
      title,
      paths,
      dependents,
      estimate: estimateWork({ blast_paths: paths, dependents: dependents.length }, options.receipts ?? []),
    });
  }

  result.ok = result.items.length > 0;
  return result;
}
