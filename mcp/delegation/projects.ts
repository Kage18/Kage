// The known-projects registry.
//
// Kage's daemon is per-project by design — one repo, one kernel, one set of runs. That
// is right, but it left the app able to see exactly one project ever: the one the
// daemon was started for. AO keeps a projects list in a persistent sidebar and switches
// between them, which needs a registry that outlives any single daemon.
//
// This is that registry, and deliberately nothing more: a list of directories the user
// has opened, in ~/.kage/projects.json. It stores no state ABOUT a project — every fact
// still comes from that project's own .agent_memory, so the registry can never
// disagree with the kernel. Losing this file loses a convenience, never data.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

export interface KnownProject {
  dir: string;
  name: string;
  /** ISO timestamp of the last time this project was opened in the app. */
  last_opened_at: string;
}

export function projectsRegistryPath(): string {
  // KAGE_HOME is the existing override convention (kernel.ts uses the same one), which
  // is also what keeps tests from writing into the real user's registry.
  const override = process.env.KAGE_HOME?.trim();
  return join(override ? resolve(override) : join(homedir(), ".kage"), "projects.json");
}

export function readKnownProjects(): KnownProject[] {
  const path = projectsRegistryPath();
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as KnownProject[])
      .filter((entry) => entry && typeof entry.dir === "string")
      // A project the user has since deleted or moved should not haunt the sidebar.
      .filter((entry) => existsSync(entry.dir));
  } catch {
    return [];
  }
}

function writeKnownProjects(projects: KnownProject[]): void {
  const path = projectsRegistryPath();
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

/** Record a project as known/opened. Idempotent; most-recently-opened sorts first. */
export function rememberProject(projectDir: string): KnownProject[] {
  const dir = resolve(projectDir);
  const now = new Date().toISOString();
  const others = readKnownProjects().filter((entry) => resolve(entry.dir) !== dir);
  const entry: KnownProject = { dir, name: basename(dir) || dir, last_opened_at: now };
  const next = [entry, ...others];
  writeKnownProjects(next);
  return next;
}

export function forgetProject(projectDir: string): KnownProject[] {
  const dir = resolve(projectDir);
  // Forgetting only drops it from the list — it never touches the repo or its memory.
  const next = readKnownProjects().filter((entry) => resolve(entry.dir) !== dir);
  writeKnownProjects(next);
  return next;
}
