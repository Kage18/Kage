// Persisted history for the conversational room — the API-driven counterpart to
// `kage room`'s interactive terminal session. `askManager` is one-shot per call
// (composePrompt replays the last 8 turns into the prompt, since `claude -p` has no
// server-side session to resume), so continuity across page loads and daemon restarts
// depends entirely on this file. Every other piece of delegation state is a run under
// runs/<id>/; the room isn't a run, so it gets its own small store rather than being
// forced into that shape.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { roomDirFor } from "./room-sessions.js";

export interface RoomHistoryTurn {
  role: "you" | "kage";
  text: string;
  at: string;
  /** Delegation tools the manager used to produce this turn, e.g. kage_dispatch. */
  tools?: string[];
  /** Card numbers the manager restated and the kernel checked on the way out. */
  corrections?: string[];
}

export function roomHistoryPath(projectDir: string, session?: string): string {
  return join(roomDirFor(projectDir, session), "history.json");
}

export function readRoomHistory(projectDir: string, session?: string): RoomHistoryTurn[] {
  const path = roomHistoryPath(projectDir, session);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as RoomHistoryTurn[]) : [];
  } catch {
    // A torn file (mid-write crash) degrades to an empty room, never a thrown 500.
    return [];
  }
}

// composePrompt only ever replays the last 8 turns, so keeping much more on disk buys
// nothing but file size — trimmed the way the run ledger caps itself.
const MAX_TURNS = 200;

export function appendRoomTurn(
  projectDir: string,
  turn: Omit<RoomHistoryTurn, "at"> & { at?: string },
  session?: string,
): RoomHistoryTurn {
  const stamped: RoomHistoryTurn = { ...turn, at: turn.at ?? new Date().toISOString() };
  const history = [...readRoomHistory(projectDir, session), stamped].slice(-MAX_TURNS);
  const path = roomHistoryPath(projectDir, session);
  mkdirSync(dirname(path), { recursive: true });
  // Write-then-rename: a reader can never observe a half-written array.
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(history, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
  return stamped;
}
