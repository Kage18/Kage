// Detection, not prevention, for a real containment failure reproduced live: a hired
// agent (in this case, literally the one that wrote this file — see run
// a-run-that-is-stopped-or-orphaned-has-no-260819-4e38's claim) ran a build command
// against the wrong directory and overwrote the PROJECT's own compiled dist/ with
// unreviewed code, which the running daemon and every newly spawned supervisor then
// loaded. Nothing stopped it: verify.ts's runCommandCheck and static-checks.ts's
// runTypecheck both correctly scope their OWN cwd to the run's worktree, but a check's
// command string (or, for a real hired agent, its own Bash tool calls) can still `cd`
// or pass an absolute/relative path that escapes it — worktree isolation today is a
// convention, not a boundary anything enforces.
//
// Full sandboxing (a restricted subprocess, filesystem permissions, a container) is a
// much larger change than this run's scope. This is the fallback explicitly asked for
// instead: fail LOUDLY when a run's verification left a footprint outside its own
// worktree, in the exact class of path that broke live (the project's own build
// output) — silence is what let the real incident run for a while before anyone
// noticed the live daemon was serving unreviewed code.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CheckOutcome } from "./contract.js";
import { writeEvidence } from "./verify.js";

// Repo-root-relative. Compiled output only, for now — the one class of file this
// incident actually showed leaking. Extend this list only for another PROTECTED build
// artifact class actually observed escaping, not speculatively — a wildly broad guard
// would just relearn the reachability check's own "198 names on one receipt" lesson.
const PROTECTED_BUILD_DIRS = ["mcp/dist"];

type DirSnapshot = Map<string, number>;

function snapshotDir(dir: string): DirSnapshot {
  const map: DirSnapshot = new Map();
  if (!existsSync(dir)) return map;
  const walk = (current: string, prefix: string): void => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return; // Raced away mid-walk — treat as empty rather than crash a check.
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.isFile()) {
        try {
          map.set(rel, statSync(full).mtimeMs);
        } catch {
          // Raced away between readdir and stat — not evidence of anything.
        }
      }
    }
  };
  walk(dir, "");
  return map;
}

/**
 * The protected directories to snapshot before verification runs. Empty when the
 * worktree being verified IS the project directory itself — a repo with no worktree
 * support (git.ts's resolveWorkspaceKind falling back to a sandbox) legitimately
 * builds inside projectDir, and that is not an escape.
 */
export function guardedPaths(projectDir: string, worktreeDir: string): string[] {
  if (resolve(worktreeDir) === resolve(projectDir)) return [];
  return PROTECTED_BUILD_DIRS.map((rel) => join(projectDir, ...rel.split("/")));
}

export function snapshotGuardedPaths(projectDir: string, worktreeDir: string): Map<string, DirSnapshot> {
  const result = new Map<string, DirSnapshot>();
  for (const dir of guardedPaths(projectDir, worktreeDir)) result.set(dir, snapshotDir(dir));
  return result;
}

/**
 * Compares a `before` snapshot (taken just before this run's checks executed) against
 * the same directories NOW. Returns a failing CheckOutcome naming exactly what changed
 * when anything did, or null when the boundary held. Called AFTER every other check has
 * already run, so it catches whatever any of them (agent-declared commands, the kernel's
 * own static-typecheck) actually did, not just what they claimed to do.
 */
export function detectWorktreeEscape(
  projectDir: string,
  runId: string,
  worktreeDir: string,
  before: Map<string, DirSnapshot>,
): CheckOutcome | null {
  const escaped: string[] = [];
  for (const [dir, beforeSnap] of before) {
    const afterSnap = snapshotDir(dir);
    const rel = dir.slice(projectDir.length + 1);
    for (const [path, mtime] of afterSnap) {
      if (!beforeSnap.has(path)) escaped.push(`${rel}/${path} (new)`);
      else if (beforeSnap.get(path) !== mtime) escaped.push(`${rel}/${path} (modified)`);
    }
    for (const path of beforeSnap.keys()) {
      if (!afterSnap.has(path)) escaped.push(`${rel}/${path} (removed)`);
    }
  }
  if (!escaped.length) return null;
  const evidence = writeEvidence(
    projectDir,
    runId,
    "worktree-boundary",
    `verifying ${worktreeDir} left changes OUTSIDE it, in the project's own build output:\n${escaped.join("\n")}\n\n` +
      "This is the exact blast-radius class worktree isolation exists to prevent: a check's command, or the agent " +
      "itself, wrote somewhere no run should ever be able to reach. This is detection, not prevention — nothing " +
      "stopped the write, this only makes it impossible to miss.\n",
  );
  return {
    id: "worktree-boundary",
    kind: "analysis",
    expect: "no file changes outside the run's own worktree",
    result: "fail",
    evidence,
  };
}
