// Per-run terminal take-over — the AO-parity raw-access model, but for a RUN. Modeled
// on room-pty.ts (pty lifecycle, spawn-helper repair, scrollback). Unlike the room's
// Terminal (a socket-served VIEW held by a detached process), a take-over runs in
// whichever process calls it; the pid record on disk is what lets a LATER call
// (handBack, takeOverState) find and honestly report on it from a different process.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isRunLive as realIsRunLive, sendControl as realSendControl } from "./control.js";
import {
  type RunState,
  type TaskRecord,
  isProcessAlive as realIsProcessAlive,
  patchRun,
  readRun,
  runDir,
  transitionRun,
} from "./contract.js";
import { dispatchDetached } from "./dispatch.js";
import { ensureSpawnHelperExecutable } from "./room-pty.js";
import { worktreePath } from "./worktree.js";

export interface PtyLike {
  pid: number;
  onData(callback: (data: string) => void): void;
  onExit(callback: (event: { exitCode: number }) => void): void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
}

type PtyOptions = { name: string; cols: number; rows: number; cwd: string; env: Record<string, string> };
export type PtyFactory = (file: string, args: string[], options: PtyOptions) => Promise<PtyLike> | PtyLike;

// Lazy import: node-pty is a native addon; every other command must keep working even
// where it fails to load.
async function defaultPtyFactory(file: string, args: string[], options: PtyOptions): Promise<PtyLike> {
  const pty = await import("node-pty");
  ensureSpawnHelperExecutable();
  return pty.spawn(file, args, options) as unknown as PtyLike;
}

/** States a human may seize a run's terminal from — never the truly terminal ones. */
const SEIZABLE_STATES = new Set<RunState>(["running", "blocked", "stopped", "failed"]);

export function runPtyRecordPath(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "pty-takeover.json");
}

export interface RunPtyRecord {
  pid: number;
  started_at: string;
}

export function readRunPtyRecord(projectDir: string, runId: string): RunPtyRecord | null {
  const path = runPtyRecordPath(projectDir, runId);
  if (!existsSync(path)) return null;
  try {
    const record = JSON.parse(readFileSync(path, "utf8")) as Partial<RunPtyRecord>;
    return record.pid ? (record as RunPtyRecord) : null;
  } catch {
    return null;
  }
}

function writeRunPtyRecord(projectDir: string, runId: string, record: RunPtyRecord): void {
  mkdirSync(runDir(projectDir, runId), { recursive: true });
  writeFileSync(runPtyRecordPath(projectDir, runId), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

function clearRunPtyRecord(projectDir: string, runId: string): void {
  rmSync(runPtyRecordPath(projectDir, runId), { force: true });
}

export interface RunPtyAttachment {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  /** Everything written so far — call BEFORE onData to avoid a gap. */
  snapshot(): string;
  onData(callback: (bytes: string) => void): void;
  onExit(callback: () => void): void;
  /** Stops listening. The session stays alive — only handBack kills it. */
  detach(): void;
}

export type TakeOverResult =
  | { ok: true; runId: string; pid: number; attachment: RunPtyAttachment }
  | { ok: false; reason: string };

export interface TakeOverDeps {
  isRunLive: (projectDir: string, runId: string) => Promise<boolean>;
  sendControl: typeof realSendControl;
  ptyFactory: PtyFactory;
  pollMs: number;
  maxWaitMs: number;
}

const DEFAULT_DEPS: TakeOverDeps = { isRunLive: realIsRunLive, sendControl: realSendControl, ptyFactory: defaultPtyFactory, pollMs: 50, maxWaitMs: 5000 };

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

/**
 * Take over a run's session in a real interactive terminal. Never fights a live
 * supervisor for it: if one holds it, this stops it cleanly first (the existing
 * `stop` control) and waits for the held child to actually exit before spawning its
 * own claude — two live processes resuming one session would fork its context.
 */
export async function takeOverRun(projectDir: string, runId: string, overrides: Partial<TakeOverDeps> = {}): Promise<TakeOverResult> {
  const deps: TakeOverDeps = { ...DEFAULT_DEPS, ...overrides };
  let task = readRun(projectDir, runId);

  if (!task.agent_session_id) {
    return { ok: false, reason: `${runId} has no agent session recorded — there is no session to take over.` };
  }
  // Captured before `task` may be reassigned below — the id itself never changes.
  const sessionId = task.agent_session_id;
  if (!SEIZABLE_STATES.has(task.state)) {
    return { ok: false, reason: `${runId} is ${task.state} — a terminal cannot take over a run that is done.` };
  }
  const worktree = worktreePath(projectDir, runId);
  if (!existsSync(worktree)) {
    return { ok: false, reason: `${runId}'s worktree is gone (${worktree}) — nothing to attach a terminal to.` };
  }

  if (await deps.isRunLive(projectDir, runId)) {
    await deps.sendControl(projectDir, runId, { op: "stop" });
    // Poll liveness, not task.state — a live supervisor can hold a run at `blocked`
    // too (blocked is a WAITING state, socket stays open). isRunLive going false is
    // the real signal the held child exited.
    const deadline = Date.now() + deps.maxWaitMs;
    let live = await deps.isRunLive(projectDir, runId);
    while (live && Date.now() < deadline) {
      await sleep(deps.pollMs);
      live = await deps.isRunLive(projectDir, runId);
    }
    if (live) return { ok: false, reason: `${runId}'s supervisor did not stop in time — try again.` };
    task = readRun(projectDir, runId);
  }

  const claudeBin = process.env.KAGE_CLAUDE_BIN || "claude";
  const term = await deps.ptyFactory(claudeBin, ["--resume", sessionId], { name: "xterm-256color", cols: 100, rows: 30, cwd: worktree, env: process.env as Record<string, string> });

  const SCROLLBACK_LIMIT = 256 * 1024;
  let scrollback = "";
  const dataListeners = new Set<(bytes: string) => void>();
  const exitListeners = new Set<() => void>();
  term.onData((data: string) => {
    scrollback += data;
    if (scrollback.length > SCROLLBACK_LIMIT) scrollback = scrollback.slice(-SCROLLBACK_LIMIT);
    // One bad listener must never take the terminal down.
    for (const listener of dataListeners) {
      try {
        listener(data);
      } catch {
        /* ignore */
      }
    }
  });
  term.onExit(() => {
    for (const listener of exitListeners) {
      try {
        listener();
      } catch {
        /* ignore */
      }
    }
  });

  writeRunPtyRecord(projectDir, runId, { pid: term.pid, started_at: new Date().toISOString() });
  // running → running is an illegal self-transition — only move the state if it changed.
  if (task.state !== "running") transitionRun(projectDir, runId, "running", "user", "taken over in a terminal");
  patchRun(projectDir, runId, { agent_pid: term.pid });

  const attachment: RunPtyAttachment = {
    write: (data) => term.write(data),
    resize: (cols, rows) => {
      // A resize during a bad terminal state must never take the session down.
      try {
        term.resize(Math.max(1, cols | 0), Math.max(1, rows | 0));
      } catch {
        /* ignore */
      }
    },
    snapshot: () => scrollback,
    onData: (callback) => dataListeners.add(callback),
    onExit: (callback) => exitListeners.add(callback),
    detach: () => {
      dataListeners.clear();
      exitListeners.clear();
    },
  };

  return { ok: true, runId, pid: term.pid, attachment };
}

export interface HandBackDeps {
  isProcessAlive: (pid: number | undefined) => boolean;
  reattach: (projectDir: string, task: TaskRecord) => { pid: number | undefined };
  pollMs: number;
  maxWaitMs: number;
}

// reattach defaults to dispatchDetached: same spawn shape a fresh dispatch uses
// (`kage supervise <runId>`, detached, unref) — steer.ts's own reattach fallback
// defaults to this exact function too.
const DEFAULT_HANDBACK_DEPS: HandBackDeps = { isProcessAlive: realIsProcessAlive, reattach: dispatchDetached, pollMs: 50, maxWaitMs: 5000 };

export type HandBackResult = { ok: true; task: TaskRecord } | { ok: false; reason: string };

/**
 * Hand a taken-over run back into supervision: kill the pty child, land the run at
 * `stopped`, and reattach a real detached supervisor to the same agent session — the
 * full circle, so a later `kage tell` or the agent's own next fence completes normally.
 */
export async function handBack(projectDir: string, runId: string, overrides: Partial<HandBackDeps> = {}): Promise<HandBackResult> {
  const deps: HandBackDeps = { ...DEFAULT_HANDBACK_DEPS, ...overrides };
  const record = readRunPtyRecord(projectDir, runId);
  if (!record) return { ok: false, reason: `${runId} has no active terminal take-over to hand back.` };

  try {
    process.kill(record.pid, "SIGTERM");
  } catch {
    // Already gone between the check and the signal.
  }
  const deadline = Date.now() + deps.maxWaitMs;
  while (deps.isProcessAlive(record.pid) && Date.now() < deadline) {
    await sleep(deps.pollMs);
  }

  let task = readRun(projectDir, runId);
  if (task.state === "running") task = transitionRun(projectDir, runId, "stopped", "user", "handed back from take-over");
  clearRunPtyRecord(projectDir, runId);
  deps.reattach(projectDir, task);

  return { ok: true, task: readRun(projectDir, runId) };
}

/** Honest liveness for a take-over: no in-memory guesswork, just the recorded pid. */
export function takeOverState(projectDir: string, runId: string, overrides: Partial<Pick<HandBackDeps, "isProcessAlive">> = {}): { active: boolean; pid?: number } {
  const isProcessAlive = overrides.isProcessAlive ?? realIsProcessAlive;
  const record = readRunPtyRecord(projectDir, runId);
  if (!record || !isProcessAlive(record.pid)) return { active: false };
  return { active: true, pid: record.pid };
}
