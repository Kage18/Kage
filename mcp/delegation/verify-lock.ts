// A per-MACHINE mutex around executed check commands (tests, typecheck, the composed-page
// parse) — verify.ts's spawnWithTreeKill is the one choke point every executed check passes
// through (declared "command" checks via runCommandCheck, and static-checks.ts's typecheck
// / app-parse via its own runCommand), so acquiring the lock there covers all of them from
// one place. Reproduced live: three different runs failed three different timing-sensitive
// tests (delegation-api's room-queue race, its room round-trip, resume-budgets's
// dispatchDetached) on the same day, every one passing solo on the identical tree — the
// common factor was another kernel verification (or a worker's own inner test suite)
// running concurrently on the same CPU. Two projects' verifications interleave that CPU
// just as much as two runs of the same project do, so the lock is keyed to the machine (the
// OS temp dir) rather than to any one project directory.
import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// KAGE_VERIFY_LOCK_PATH is not part of the documented contract — it exists purely as a test
// seam, so a suite exercising real concurrency doesn't queue behind (or get queued behind
// by) every OTHER test file's own real command checks sharing the one machine-wide path.
const DEFAULT_LOCK_PATH = join(tmpdir(), "kage-verify.lock");

const POLL_MS = 200;

export interface VerifyLockHandle {
  release(): void;
}

export interface VerifyLockAcquisition {
  handle: VerifyLockHandle;
  /** Milliseconds this acquisition spent waiting for another holder before it started. */
  waitedMs: number;
  /** Set only when a dead holder's stale lock was removed to let this acquisition through. */
  stolenFromPid?: number;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Parked via the VM's own wait, not a busy-spin poll — same technique as verify.ts's own
// sleepSync, duplicated rather than imported: this module has to stay standalone (verify.ts
// imports FROM here), and it is small enough that a shared helper would cost more in
// indirection than the few lines it would save.
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function tryCreateLock(lockPath: string): boolean {
  try {
    // "wx": O_CREAT | O_EXCL — fails with EEXIST if the file already exists, which is what
    // makes the create itself the atomic test-and-set (no separate exists-check to race).
    const fd = openSync(lockPath, "wx");
    writeSync(fd, String(process.pid));
    closeSync(fd);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

function readHolderPid(lockPath: string): number | undefined {
  try {
    const pid = Number(readFileSync(lockPath, "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    // Vanished between our failed create and this read — the holder (or another waiter
    // that already stole it) released it concurrently. Nothing stale to steal; the caller's
    // loop just retries from the top.
    return undefined;
  }
}

function removeLock(lockPath: string): void {
  try {
    unlinkSync(lockPath);
  } catch {
    // Already gone — someone else's steal, or our own prior release. Either way, fine.
  }
}

/**
 * Blocks (synchronously — every caller here is already inside a synchronous spawnSync path)
 * until this process holds the machine-wide verification lock, then returns a handle to
 * release it. Set KAGE_NO_VERIFY_LOCK=1 to skip the lock entirely, for CI machines that
 * intentionally run isolated executors in parallel and never actually share a CPU.
 *
 * Crash-safety: if the pid recorded in an existing lock file is no longer alive, it is
 * stolen (removed, then re-created) rather than waited on forever — a holder that crashed
 * mid-check would otherwise wedge every later verification on the machine.
 */
export function acquireVerifyLock(options: { lockPath?: string } = {}): VerifyLockAcquisition {
  if (process.env.KAGE_NO_VERIFY_LOCK === "1") {
    return { handle: { release: () => {} }, waitedMs: 0 };
  }
  const lockPath = options.lockPath ?? process.env.KAGE_VERIFY_LOCK_PATH ?? DEFAULT_LOCK_PATH;
  const start = Date.now();
  let stolenFromPid: number | undefined;
  while (!tryCreateLock(lockPath)) {
    const holderPid = readHolderPid(lockPath);
    if (holderPid !== undefined && !isAlive(holderPid)) {
      removeLock(lockPath);
      stolenFromPid = holderPid;
      continue; // Re-check from the top: another waiter may win the re-create race instead.
    }
    sleepSync(POLL_MS);
  }
  return {
    handle: { release: () => removeLock(lockPath) },
    waitedMs: Date.now() - start,
    stolenFromPid,
  };
}

/** Formats acquireVerifyLock's outcome as an evidence-log note; "" when there is nothing to say. */
export function formatLockNote(waitedMs: number, stolenFromPid?: number): string {
  if (waitedMs <= 0 && stolenFromPid === undefined) return "";
  const parts: string[] = [];
  if (waitedMs > 0) parts.push(`waited ${waitedMs}ms for another verification on this machine to finish`);
  if (stolenFromPid !== undefined) parts.push(`stole a stale verification lock left by dead pid ${stolenFromPid}`);
  return ` (${parts.join("; ")})`;
}
