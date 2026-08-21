// Regression test for the verify-lock reentrancy deadlock: verify.ts's spawnWithTreeKill is
// the single choke point every EXECUTED check (declared "command" checks and
// static-checks.ts's typecheck/app-parse) passes through, so the kernel's OWN outer
// verification of a run's `npm test` acquires the per-machine lock for that whole command —
// including every child process the command spawns. Before this fix, any test inside that
// suite whose own code path reached spawnWithTreeKill again (without overriding
// KAGE_VERIFY_LOCK_PATH) would try to acquire its own ancestor's still-held lock and block
// until the holder released it — and since the holder pid stays alive the whole time, the
// dead-holder steal path never fires, so it would wait out the ancestor's entire remaining
// hold (in the field: the whole outer `npm test` run, until its 1200s tree-kill).
//
// The fix: spawnWithTreeKill exports KAGE_VERIFY_LOCK_HELD=1 into a child's env whenever it
// genuinely holds the lock, and acquireVerifyLock treats that marker as proof a nested call
// is part of the same already-serialized unit, returning immediately instead of contending
// for the file.
//
// Its own file per this repo's rule — new behaviour gets a new test file, and
// mcp/delegation.test.ts is a known append-collision hotspot.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireVerifyLock } from "./delegation/verify-lock.js";

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

test("a stub verification with KAGE_VERIFY_LOCK_HELD=1 completes immediately without waiting on a held default lock", async () => {
  const lockPath = join(tempDir("kage-verify-lock-reentrant-"), "verify.lock");
  const holdMs = 1500;
  const lockModulePath = join(__dirname, "delegation", "verify-lock.js");

  // A real, ALIVE holder in its own process — the steal path only ever fires for a DEAD
  // holder pid, so an alive holder is exactly what would otherwise wedge a naive nested
  // acquire for the full hold duration (in the field, far longer: the whole outer command).
  const holderScript = [
    `const { acquireVerifyLock } = require(${JSON.stringify(lockModulePath)});`,
    `const acq = acquireVerifyLock({ lockPath: ${JSON.stringify(lockPath)} });`,
    `process.stdout.write("ACQUIRED\\n");`,
    `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${holdMs});`,
    `acq.handle.release();`,
  ].join("\n");
  const holder = spawn(process.execPath, ["-e", holderScript]);
  await new Promise<void>((resolve, reject) => {
    holder.stdout.on("data", (chunk) => {
      if (String(chunk).includes("ACQUIRED")) resolve();
    });
    holder.on("error", reject);
  });

  const previousPath = process.env.KAGE_VERIFY_LOCK_PATH;
  const previousHeld = process.env.KAGE_VERIFY_LOCK_HELD;
  // No `lockPath` option passed to acquireVerifyLock below — resolution goes through the
  // same default/env path spawnWithTreeKill itself uses, so this exercises the real
  // reentrancy seam, not a special-cased test-only argument.
  process.env.KAGE_VERIFY_LOCK_PATH = lockPath;
  process.env.KAGE_VERIFY_LOCK_HELD = "1";
  try {
    const start = Date.now();
    const acquisition = acquireVerifyLock();
    const elapsedMs = Date.now() - start;
    assert.equal(acquisition.inherited, true, "a nested call under the marker must report itself as inherited");
    assert.equal(acquisition.waitedMs, 0);
    // Revert check: without the marker short-circuit, this call falls into the same wait
    // loop the holder-alive case above exercises, and would take close to holdMs — the
    // holder pid stays alive the whole time, so the steal path never triggers either.
    assert.ok(elapsedMs < 200, `expected an inherited acquisition to skip the wait entirely, took ${elapsedMs}ms`);
    acquisition.handle.release();
  } finally {
    if (previousPath === undefined) delete process.env.KAGE_VERIFY_LOCK_PATH;
    else process.env.KAGE_VERIFY_LOCK_PATH = previousPath;
    if (previousHeld === undefined) delete process.env.KAGE_VERIFY_LOCK_HELD;
    else process.env.KAGE_VERIFY_LOCK_HELD = previousHeld;
  }

  await new Promise((resolve) => holder.on("close", resolve));
});
