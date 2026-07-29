// The set of repositories the desktop app watches, and where each one's daemon lives.
//
// This is the difference between an app and the page it replaced. `kage viewer` serves exactly
// one project, from a terminal you had to already be standing in. An orchestrator of memory and
// agents is not a per-directory command — agents work across the repositories you own, and the
// thing that watches them has to outlive any one shell.
//
// Two decisions here are load-bearing:
//
//   A repository is identified by its REAL path. The same repo reached through a symlink, a
//   trailing slash or a relative path is one entry, not four — otherwise the app happily runs
//   four daemons over the same `.agent_memory` and they fight.
//
//   A repository's port is DERIVED from its path, not handed out in arrival order. It stays the
//   same across relaunches, so a window that was on :3141 yesterday is on :3141 today and
//   anything remembering that address still works.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export interface WatchedRepo {
  /** Absolute, symlink-resolved. The identity of the repository. */
  path: string;
  name: string;
  added_at: string;
  last_opened_at: string | null;
  /** Stable across relaunches. See `portForPath`. */
  port: number;
}

export interface DesktopState {
  version: 1;
  repos: WatchedRepo[];
  /** Path of the repository the window is showing, or null when none is. */
  active: string | null;
}

export function emptyState(): DesktopState {
  return { version: 1, repos: [], active: null };
}

// A high, unprivileged range that no common dev server squats on.
const PORT_MIN = 3100;
const PORT_SPAN = 400;

/** FNV-1a. Small, dependency-free, and good enough to scatter paths across the range. */
function hashPath(path: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < path.length; i += 1) {
    hash ^= path.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The port for a repository: derived from its path so it is stable, then linear-probed so two
 * repositories can never collide. `taken` is the set already assigned to other repositories.
 */
export function portForPath(path: string, taken: ReadonlySet<number>): number {
  const start = PORT_MIN + (hashPath(path) % PORT_SPAN);
  for (let offset = 0; offset < PORT_SPAN; offset += 1) {
    const candidate = PORT_MIN + ((start - PORT_MIN + offset) % PORT_SPAN);
    if (!taken.has(candidate)) return candidate;
  }
  // Every port in the range is spoken for — 400 open repositories. Fall back rather than loop.
  return PORT_MIN + PORT_SPAN;
}

export interface AddResult {
  ok: boolean;
  state: DesktopState;
  repo?: WatchedRepo;
  /** Why it was refused, in words a person can act on. */
  error?: string;
}

/** Resolved identity, or null when the path cannot be one. */
function identify(path: string): string | null {
  try {
    const absolute = resolve(path);
    if (!existsSync(absolute) || !statSync(absolute).isDirectory()) return null;
    return realpathSync(absolute);
  } catch {
    return null;
  }
}

function isGitRepo(path: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], { cwd: path, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export interface AddOptions {
  now?: string;
  /** Seam for tests; production asks git. */
  isRepo?: (path: string) => boolean;
}

export function addRepo(state: DesktopState, path: string, options: AddOptions = {}): AddResult {
  const now = options.now ?? new Date().toISOString();
  const identified = identify(path);
  if (!identified) {
    return { ok: false, state, error: `${path} is not a directory that exists` };
  }

  const repoCheck = options.isRepo ?? isGitRepo;
  if (!repoCheck(identified)) {
    // Kage's memory, its code grounding and its work derivation are all defined against a git
    // history. A directory without one cannot have any of it, so adding it would produce an
    // entry that could only ever be empty.
    return { ok: false, state, error: `${identified} is not a git repository` };
  }

  const existing = state.repos.find((repo) => repo.path === identified);
  if (existing) {
    // Adding something already watched is not an error — it is a request to look at it.
    return { ok: true, state: { ...state, active: identified }, repo: existing };
  }

  const taken = new Set(state.repos.map((repo) => repo.port));
  const repo: WatchedRepo = {
    path: identified,
    name: basename(identified),
    added_at: now,
    last_opened_at: null,
    port: portForPath(identified, taken),
  };
  return {
    ok: true,
    repo,
    state: { ...state, repos: [...state.repos, repo], active: identified },
  };
}

export function removeRepo(state: DesktopState, path: string): DesktopState {
  const repos = state.repos.filter((repo) => repo.path !== path);
  // Never leave `active` pointing at something that is gone — a window with no repository is a
  // blank app, and the fix is to show one of the others.
  const active = state.active === path ? (repos[0]?.path ?? null) : state.active;
  return { ...state, repos, active };
}

export function openRepo(state: DesktopState, path: string, now = new Date().toISOString()): DesktopState {
  if (!state.repos.some((repo) => repo.path === path)) return state;
  return {
    ...state,
    active: path,
    repos: state.repos.map((repo) => (repo.path === path ? { ...repo, last_opened_at: now } : repo)),
  };
}

export function activeRepo(state: DesktopState): WatchedRepo | null {
  return state.repos.find((repo) => repo.path === state.active) ?? null;
}

/** Where the app's own state lives — beside the user's config, not inside any repository. */
export function statePath(home: string): string {
  return join(home, ".kage", "desktop.json");
}

/**
 * Load, tolerating everything. An app that refuses to launch because a JSON file got truncated
 * is a broken app; the correct behaviour is to start empty and let the user re-add.
 */
export function loadState(home: string): DesktopState {
  try {
    const raw = JSON.parse(readFileSync(statePath(home), "utf8")) as Partial<DesktopState>;
    if (!raw || !Array.isArray(raw.repos)) return emptyState();
    const repos = raw.repos.filter(
      (repo): repo is WatchedRepo =>
        !!repo && typeof repo.path === "string" && typeof repo.port === "number",
    );
    const active = typeof raw.active === "string" && repos.some((r) => r.path === raw.active)
      ? raw.active
      : (repos[0]?.path ?? null);
    return { version: 1, repos, active };
  } catch {
    return emptyState();
  }
}

export function saveState(home: string, state: DesktopState): void {
  const target = statePath(home);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(state, null, 2));
}
