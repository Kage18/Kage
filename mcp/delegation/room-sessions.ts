// Room sessions — several conversations with the manager, in one project.
//
// A deliberate framing choice: these are CONVERSATION THREADS, not workspaces. In AO a
// session is the unit of work, so its tabs are how you get parallelism. In Kage the
// units of work are runs, each in its own worktree, and the room is the manager who
// dispatches them. Tabs here exist for the other reason — so "plan the refactor" and
// "debug this failure" don't pollute each other's context — and dispatching from any
// thread still produces an ordinary run on the same board. If a tab ever starts to
// feel like a workspace, that is the bug.
//
// Storage: the default thread keeps the historical flat layout under .agent_memory/room
// so no existing install has to migrate anything (a migration that can half-fail is a
// bad trade for a convenience feature); additional threads nest under room/s/<key>/.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const DEFAULT_SESSION = "main";

/** Keys land in paths and socket names, so keep them boring and bounded. */
export function normalizeSessionKey(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_SESSION;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return cleaned || DEFAULT_SESSION;
}

export function roomRoot(projectDir: string): string {
  return join(projectDir, ".agent_memory", "room");
}

/**
 * Where one thread's files live. "main" stays at the historical flat path on purpose —
 * every install that predates threads keeps working with nothing moved.
 */
export function roomDirFor(projectDir: string, key = DEFAULT_SESSION): string {
  const normalized = normalizeSessionKey(key);
  return normalized === DEFAULT_SESSION ? roomRoot(projectDir) : join(roomRoot(projectDir), "s", normalized);
}

export interface RoomSessionMeta {
  key: string;
  title: string;
  created_at: string;
  /** The goal this thread's manager dispatches into when a run carries no explicit goal_id. */
  active_goal_id?: string | null;
}

function indexPath(projectDir: string): string {
  return join(roomRoot(projectDir), "sessions.json");
}

function writeIndex(projectDir: string, sessions: RoomSessionMeta[]): void {
  const path = indexPath(projectDir);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(sessions, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

/**
 * Every project always has the default thread, whether or not anything has been
 * written yet — the room must never render zero tabs.
 */
export function listRoomSessions(projectDir: string): RoomSessionMeta[] {
  const fallback: RoomSessionMeta = { key: DEFAULT_SESSION, title: "Room", created_at: new Date(0).toISOString() };
  const path = indexPath(projectDir);
  if (!existsSync(path)) return [fallback];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [fallback];
    const sessions = (parsed as RoomSessionMeta[]).filter((entry) => entry && typeof entry.key === "string");
    if (!sessions.some((entry) => entry.key === DEFAULT_SESSION)) sessions.unshift(fallback);
    return sessions;
  } catch {
    return [fallback];
  }
}

export function createRoomSession(projectDir: string, title?: string): RoomSessionMeta {
  const sessions = listRoomSessions(projectDir);
  const taken = new Set(sessions.map((entry) => entry.key));
  let index = 2;
  while (taken.has(`thread-${index}`)) index += 1;
  const key = `thread-${index}`;
  const created: RoomSessionMeta = {
    key,
    title: (title || "").trim().slice(0, 48) || `Thread ${index}`,
    created_at: new Date().toISOString(),
  };
  writeIndex(projectDir, [...sessions, created]);
  return created;
}

export function renameRoomSession(projectDir: string, key: string, title: string): RoomSessionMeta[] {
  const normalized = normalizeSessionKey(key);
  const sessions = listRoomSessions(projectDir).map((entry) =>
    entry.key === normalized ? { ...entry, title: title.trim().slice(0, 48) || entry.title } : entry,
  );
  writeIndex(projectDir, sessions);
  return sessions;
}

/**
 * Closing a thread drops its transcript and session handle. The default thread is not
 * closable — it is the room itself, and an app with no room has nowhere to land.
 */
export function closeRoomSession(projectDir: string, key: string): RoomSessionMeta[] {
  const normalized = normalizeSessionKey(key);
  if (normalized === DEFAULT_SESSION) throw new Error("the default thread cannot be closed");
  const sessions = listRoomSessions(projectDir).filter((entry) => entry.key !== normalized);
  writeIndex(projectDir, sessions);
  const dir = roomDirFor(projectDir, normalized);
  // Only ever inside room/s/<key> — never the flat room root.
  if (dir !== roomRoot(projectDir) && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  return sessions;
}

/**
 * A thread's active goal is what makes goal attachment IMPLICIT: kage_dispatch, called
 * with no goal_id from inside a room thread, attaches to whatever this returns instead
 * of relying on the manager to remember to pass one. Creates the session entry on first
 * use — the default thread otherwise never appears in sessions.json until renamed.
 */
export function setActiveGoal(projectDir: string, sessionKey: string, goalId: string | null): void {
  const normalized = normalizeSessionKey(sessionKey);
  const sessions = listRoomSessions(projectDir);
  const idx = sessions.findIndex((entry) => entry.key === normalized);
  if (idx === -1) {
    sessions.push({
      key: normalized,
      title: normalized === DEFAULT_SESSION ? "Room" : normalized,
      created_at: new Date().toISOString(),
      active_goal_id: goalId,
    });
  } else {
    sessions[idx] = { ...sessions[idx], active_goal_id: goalId };
  }
  writeIndex(projectDir, sessions);
}

export function readActiveGoal(projectDir: string, sessionKey: string): string | null {
  const normalized = normalizeSessionKey(sessionKey);
  const entry = listRoomSessions(projectDir).find((session) => session.key === normalized);
  return entry?.active_goal_id ?? null;
}

/**
 * Called when a goal is abandoned or reaches done — a terminal goal must stop being
 * anyone's active target, or every dispatch after that silently misattaches to a dead
 * goal. Linear over threads, which stay few, same as goalForRun over goals.
 */
export function clearActiveGoalEverywhere(projectDir: string, goalId: string): void {
  const sessions = listRoomSessions(projectDir);
  let changed = false;
  const next = sessions.map((entry) => {
    if (entry.active_goal_id !== goalId) return entry;
    changed = true;
    return { ...entry, active_goal_id: null };
  });
  if (changed) writeIndex(projectDir, next);
}

/** Threads whose directory exists on disk, used to spot orphans after a manual delete. */
export function roomSessionDirsOnDisk(projectDir: string): string[] {
  const nested = join(roomRoot(projectDir), "s");
  if (!existsSync(nested)) return [];
  try {
    return readdirSync(nested, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}
