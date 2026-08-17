// Blast radius: which files depend on what a run changed.
//
// This is the code graph earning its keep at the exact moment it matters — the merge
// decision. "1 file · 20 lines · 2/2 checks" says the change is small and green; it
// says nothing about whether the one file is a leaf or load-bearing. The imports index
// the kernel already builds knows the difference.
//
// The whole implementation is a read of a PREBUILT index, cached by mtime. It must
// never call the kernel's analysis functions: kageRisk was measured at 39 seconds on
// this repo, and this lookup serves inside `GET /runs`. Same law as memory-view.ts.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

interface ImportEdge {
  from_path?: string | null;
  to_path?: string | null;
}

interface CacheEntry {
  mtimeMs: number;
  /** file → the set of files that import it. */
  dependents: Map<string, Set<string>>;
}

const cache = new Map<string, CacheEntry>();

function importsPath(projectDir: string): string {
  return join(projectDir, ".agent_memory", "structural", "imports.json");
}

function reverseMap(projectDir: string): Map<string, Set<string>> | null {
  const path = importsPath(projectDir);
  let mtimeMs: number;
  try {
    if (!existsSync(path)) return null;
    mtimeMs = statSync(path).mtimeMs;
  } catch {
    return null;
  }
  const cached = cache.get(projectDir);
  if (cached && cached.mtimeMs === mtimeMs) return cached.dependents;

  let edges: ImportEdge[];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return null;
    edges = parsed as ImportEdge[];
  } catch {
    // A torn index means "no answer", never a wrong one.
    return null;
  }
  const dependents = new Map<string, Set<string>>();
  for (const edge of edges) {
    // to_path is null for external packages — only intra-repo edges matter here.
    if (!edge.to_path || !edge.from_path || edge.to_path === edge.from_path) continue;
    let set = dependents.get(edge.to_path);
    if (!set) {
      set = new Set();
      dependents.set(edge.to_path, set);
    }
    set.add(edge.from_path);
  }
  cache.set(projectDir, { mtimeMs, dependents });
  return dependents;
}

export interface BlastRadius {
  /** How many OTHER repo files import something the run changed. */
  dependents: number;
  /** A few of them, most useful first (shortest paths tend to be the core ones). */
  sample: string[];
}

/**
 * Null when there is nothing honest to say: no index (repo never indexed), no changed
 * paths (old claim), or no dependents recorded. The surface must then say nothing —
 * inventing "0 dependents" from a missing index would be the dashboard lying in the
 * reassuring direction, which is the worst direction.
 */
export function blastRadiusFor(projectDir: string, changedPaths: string[]): BlastRadius | null {
  if (!changedPaths.length) return null;
  const dependents = reverseMap(projectDir);
  if (!dependents) return null;
  const changed = new Set(changedPaths);
  const hit = new Set<string>();
  for (const path of changedPaths) {
    for (const importer of dependents.get(path) ?? []) {
      // A run's own edited files importing each other is not blast, it is the change.
      if (!changed.has(importer)) hit.add(importer);
    }
  }
  const sample = [...hit].sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, 3);
  return { dependents: hit.size, sample };
}
