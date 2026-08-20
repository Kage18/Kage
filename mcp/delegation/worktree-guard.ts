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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CheckOutcome } from "./contract.js";
import { currentBranch, git } from "./git.js";
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

// Distinctive identifiers/strings this codebase's own symbols look like: mixed-case
// tokens (camelCase/PascalCase — e.g. "detectWorktreeEscape") at least this long. Every
// JS/TS reserved word and every common English word used as an identifier fragment is
// all-lowercase, so requiring an internal case transition filters those out for free —
// no keyword blocklist to maintain, and a BRAND NEW file's tokens (nothing in main to
// diff against) still don't hand back a false marker just because it contains ordinary
// language like "function" or "constructor".
const MARKER_MIN_LENGTH = 8;

function extractMarkers(source: string): Set<string> {
  const markers = new Set<string>();
  for (const match of source.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g)) {
    const token = match[0];
    if (token.length < MARKER_MIN_LENGTH) continue;
    if (/[a-z]/.test(token) && /[A-Z]/.test(token)) markers.add(token);
  }
  return markers;
}

/**
 * Distinctive tokens THIS run's worktree introduced or changed in its own source, that do
 * not already exist in the main checkout's currently COMMITTED version of the same file —
 * i.e. tokens that could only have reached compiled output through this run's own work,
 * never through whatever the main checkout already had on disk. Returns an empty set (no
 * markers, so the caller attributes nothing) when there is no real branch history to diff
 * against — a sandboxed run with no separate worktree, or any other state where the
 * worktree is not a genuine `git worktree add` checkout.
 */
function runSourceMarkers(projectDir: string, worktreeDir: string): Set<string> {
  // Untracked new source is part of the run's work, and `git diff <ref>` (below) only
  // ever sees tracked/staged paths.
  git(worktreeDir, ["add", "-A"]);
  const base = currentBranch(projectDir);
  const mergeBase = git(worktreeDir, ["merge-base", "HEAD", base]);
  if (!mergeBase.ok || !mergeBase.stdout) return new Set();
  const changed = git(worktreeDir, ["diff", mergeBase.stdout, "--name-only"]);
  if (!changed.ok || !changed.stdout) return new Set();

  const markers = new Set<string>();
  for (const relPath of changed.stdout.split("\n").filter(Boolean)) {
    if (!/\.tsx?$/.test(relPath)) continue;
    const worktreeFile = join(worktreeDir, relPath);
    if (!existsSync(worktreeFile)) continue; // deleted in the worktree — nothing to attribute
    let worktreeSource: string;
    try {
      worktreeSource = readFileSync(worktreeFile, "utf8");
    } catch {
      continue;
    }
    const mainAtHead = git(projectDir, ["show", `HEAD:${relPath}`]);
    const mainMarkers = mainAtHead.ok ? extractMarkers(mainAtHead.stdout) : new Set<string>();
    for (const token of extractMarkers(worktreeSource)) {
      if (!mainMarkers.has(token)) markers.add(token);
    }
  }
  return markers;
}

// Requiring more than one independent marker match — not just one coincidental
// substring hit — is the same margin of safety the real 2026-08-19 leak was caught
// with: any single distinctive-looking token could in principle collide by chance, but
// two unrelated tokens from the run's own source both landing in the same changed build
// output is not a coincidence worth explaining away.
const MIN_MATCHED_MARKERS = 2;

/**
 * Compares a `before` snapshot (taken just before this run's checks executed) against
 * the same directories NOW. Returns a failing CheckOutcome naming exactly what changed
 * when anything did, or null when the boundary held. Called AFTER every other check has
 * already run, so it catches whatever any of them (agent-declared commands, the kernel's
 * own static-typecheck) actually did, not just what they claimed to do.
 *
 * Drift alone used to be the whole signal, and that read the OPERATOR's own legitimate
 * work as an escape: a post-merge `npm run build` in the main checkout touches this exact
 * same mcp/dist, in this exact same shape, as a real leak would — reproduced live on run
 * m1-of-the-memory-store-build-the-storeba-260820-3ff8, flagged for a rebuild the run
 * never touched (see that run's evidence/worktree-boundary.log). A guard that cries wolf
 * on every rebuild gets ignored, which is worse than no guard — so this attributes by
 * CONTENT instead: drift only fails the check when the changed build output actually
 * contains code traceable to THIS run's own worktree source (runSourceMarkers above).
 */
export function detectWorktreeEscape(
  projectDir: string,
  runId: string,
  worktreeDir: string,
  before: Map<string, DirSnapshot>,
): CheckOutcome | null {
  const escaped: string[] = [];
  const changedAbsPaths: string[] = [];
  for (const [dir, beforeSnap] of before) {
    const afterSnap = snapshotDir(dir);
    const rel = dir.slice(projectDir.length + 1);
    for (const [path, mtime] of afterSnap) {
      if (!beforeSnap.has(path)) {
        escaped.push(`${rel}/${path} (new)`);
        changedAbsPaths.push(join(dir, path));
      } else if (beforeSnap.get(path) !== mtime) {
        escaped.push(`${rel}/${path} (modified)`);
        changedAbsPaths.push(join(dir, path));
      }
    }
    for (const path of beforeSnap.keys()) {
      // A removal has no content left to attribute to anything — named in the log if
      // something else already flagged the run, but never itself the reason to flag one.
      if (!afterSnap.has(path)) escaped.push(`${rel}/${path} (removed)`);
    }
  }
  if (!escaped.length) return null;

  const markers = runSourceMarkers(projectDir, worktreeDir);
  const matched = new Set<string>();
  if (markers.size) {
    for (const absPath of changedAbsPaths) {
      let content: string;
      try {
        content = readFileSync(absPath, "utf8");
      } catch {
        continue;
      }
      for (const marker of markers) {
        if (content.includes(marker)) matched.add(marker);
      }
    }
  }
  if (matched.size < MIN_MATCHED_MARKERS) return null;

  const evidence = writeEvidence(
    projectDir,
    runId,
    "worktree-boundary",
    `verifying ${worktreeDir} left changes OUTSIDE it, in the project's own build output:\n${escaped.join("\n")}\n\n` +
      `Traceable to THIS run's own worktree source (${matched.size} distinct marker(s) from its changed .ts files ` +
      `found in the changed build output, absent from the main checkout's committed source): ${[...matched].join(", ")}\n\n` +
      "This is the exact blast-radius class worktree isolation exists to prevent: a check's command, or the agent " +
      "itself, wrote somewhere no run should ever be able to reach. This is detection, not prevention — nothing " +
      "stopped the write, this only makes it impossible to miss.\n",
  );
  return {
    id: "worktree-boundary",
    kind: "analysis",
    expect: "no file changes outside the run's own worktree traceable to its own source",
    result: "fail",
    evidence,
  };
}
