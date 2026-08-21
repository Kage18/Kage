// Regression tests for the per-machine verification lock (mcp/delegation/verify-lock.ts):
// three different runs failed verification on three different timing-sensitive tests
// (delegation-api.test.ts's room-queue race, its room round-trip test, resume-budgets
// .test.ts's dispatchDetached) on the same day, every one passing solo on the identical
// tree — the common factor was another kernel verification (or a worker's own inner test
// suite) running concurrently on the same CPU. The fix serializes executed check commands
// (verify.ts's spawnWithTreeKill, the one choke point every "command" check — declared or
// kernel-appended — passes through) behind a machine-wide lockfile, waiting when another
// verification already holds it and stealing a dead holder's stale lock rather than
// wedging forever.
//
// Its own file per this repo's rule — new behaviour gets a new test file, and
// mcp/delegation.test.ts is a known append-collision hotspot.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireVerifyLock } from "./delegation/verify-lock.js";
import { runCommandCheck } from "./delegation/verify.js";

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

// The compiled sibling modules a child process (its own require, its own working
// directory) can load by absolute path regardless of where `node --test` itself runs from.
const VERIFY_JS_PATH = join(__dirname, "delegation", "verify.js");
const LOCK_MODULE_PATH = join(__dirname, "delegation", "verify-lock.js");

// Every test below must behave identically regardless of the ambient environment it happens
// to run in. In particular, the operator verifying THIS very run sets KAGE_NO_VERIFY_LOCK=1
// as an escape hatch — necessary because, pre-fix, the kernel's own outer verification of
// its own `npm test` would otherwise deadlock on itself (the bug this whole file exists to
// catch). Left unsanitized, that ambient variable — like KAGE_VERIFY_LOCK_HELD and
// KAGE_VERIFY_LOCK_PATH — inherits into every direct acquireVerifyLock() call made by this
// process AND every child spawned without an explicit override, so every test below would
// take acquireVerifyLock's always-skip branch and prove nothing (observed: all four
// pre-existing lock tests fail under an ambient KAGE_NO_VERIFY_LOCK=1, since none of them
// ever ends up contending for a real lock).
const LOCK_ENV_VARS = ["KAGE_NO_VERIFY_LOCK", "KAGE_VERIFY_LOCK_HELD", "KAGE_VERIFY_LOCK_PATH"] as const;

// Deletes all three before `fn` runs and restores their prior values (ambient or not)
// afterward, so a test's own use of one of these vars as its actual subject —
// KAGE_VERIFY_LOCK_PATH, or KAGE_NO_VERIFY_LOCK in the dedicated escape-hatch test below —
// still starts from a clean, deterministic slate rather than whatever the invoking shell
// happened to set.
async function withSanitizedLockEnv<T>(fn: () => Promise<T> | T): Promise<T> {
  const previous: Record<string, string | undefined> = {};
  for (const key of LOCK_ENV_VARS) previous[key] = process.env[key];
  for (const key of LOCK_ENV_VARS) delete process.env[key];
  try {
    return await fn();
  } finally {
    for (const key of LOCK_ENV_VARS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

// The same three-variable sanitization, injected as the FIRST lines of a script run in a
// separate OS process — a spawned child inherits process.env (including any ambient
// KAGE_NO_VERIFY_LOCK=1) unless told otherwise, so it needs its own copy of this hygiene;
// withSanitizedLockEnv only ever touches the parent test process's own env.
const SANITIZE_CHILD_ENV_LINES = LOCK_ENV_VARS.map((key) => `delete process.env.${key};`);

interface ChildResult {
  /** Wall-clock the child spent inside runCommandCheck — includes any lock wait. */
  elapsedMs: number;
  /** Full text of the evidence log runCommandCheck itself wrote for this check. */
  evidenceText: string;
}

// Runs `runCommandCheck` for real, in a SEPARATE OS process, against the given per-machine
// lock path — this is what makes the serialization test genuine: two Node processes racing
// for one lockfile, not two synchronous calls in the same single-threaded process (which
// could never actually overlap in the first place, proving nothing). Reports the evidence
// log it wrote (not just timing) because a child's OWN start/end timestamps span the lock
// wait too, so comparing them across children can't tell "waited" apart from "ran
// immediately" — the evidence note verify.ts writes is the direct, unambiguous signal.
function verificationChildScript(lockPath: string, projectDir: string, runId: string, cmd: string): string {
  return [
    `const { runCommandCheck } = require(${JSON.stringify(VERIFY_JS_PATH)});`,
    `const fs = require("node:fs");`,
    `const path = require("node:path");`,
    ...SANITIZE_CHILD_ENV_LINES,
    `process.env.KAGE_VERIFY_LOCK_PATH = ${JSON.stringify(lockPath)};`,
    `const start = Date.now();`,
    `const outcome = runCommandCheck(${JSON.stringify(projectDir)}, ${JSON.stringify(runId)}, ${JSON.stringify(projectDir)}, { id: "tests", kind: "command", cmd: ${JSON.stringify(cmd)}, expect: "exit code 0" });`,
    `const elapsedMs = Date.now() - start;`,
    `const evidenceText = outcome.evidence ? fs.readFileSync(path.join(${JSON.stringify(projectDir)}, outcome.evidence), "utf8") : "";`,
    `process.stdout.write(JSON.stringify({ elapsedMs, evidenceText }));`,
  ].join("\n");
}

function runChild(script: string): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", script]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`verification child exited ${code}\n${stderr}`));
        return;
      }
      resolve(JSON.parse(stdout));
    });
  });
}

test("two concurrent verifications on stub runs serialize — the second waits for the first's lock to release", async () => {
  await withSanitizedLockEnv(async () => {
    const lockPath = join(tempDir("kage-verify-lock-"), "verify.lock");
    const projectA = tempDir("kage-verify-lock-a-");
    const projectB = tempDir("kage-verify-lock-b-");

    const [a, b] = await Promise.all([
      runChild(verificationChildScript(lockPath, projectA, "run-a", "sleep 0.4")),
      runChild(verificationChildScript(lockPath, projectB, "run-b", "sleep 0.4")),
    ]);

    // Serialized means one of the two had to queue behind the other's lock for close to the
    // other's full ~400ms hold — its evidence says so directly. (Both sides can show a small
    // nonzero wait from ordinary scheduling jitter around the two spawns; only a wait near the
    // full hold duration is real contention.) Without the lock, both run their sleep at the
    // same time and neither evidence log ever approaches that duration — exactly what this
    // assertion catches on a revert.
    const waitPattern = /waited (\d+)ms for another verification on this machine to finish/;
    const waitedMsOf = (child: ChildResult): number => Number(waitPattern.exec(child.evidenceText)?.[1] ?? 0);
    const maxWaitMs = Math.max(waitedMsOf(a), waitedMsOf(b));
    assert.ok(
      maxWaitMs >= 250,
      `expected at least one verification to queue behind the other for close to the full ~400ms hold, max recorded wait was ${maxWaitMs}ms\nA="${a.evidenceText}"\nB="${b.evidenceText}"`,
    );
    // The combined wall-clock across both children should read like two 400ms holds run back
    // to back (~800ms), not two run in parallel (~400ms) — a second, independent signal for
    // the same fact the evidence note already states.
    const combinedMs = a.elapsedMs + b.elapsedMs;
    assert.ok(combinedMs >= 700, `expected the two ~400ms holds to serialize to ~800ms combined, got ${combinedMs}ms`);
  });
});

test("a dead holder's stale verification lock is stolen rather than waited on forever", async () => {
  await withSanitizedLockEnv(() => {
    const lockPath = join(tempDir("kage-verify-lock-dead-"), "verify.lock");

    // A process that acquires the lock and then exits WITHOUT releasing — the crash scenario
    // the steal path exists for. spawnSync returning at all means this process has already
    // exited by the time we read its reported pid.
    const crashScript = [
      `const { acquireVerifyLock } = require(${JSON.stringify(LOCK_MODULE_PATH)});`,
      ...SANITIZE_CHILD_ENV_LINES,
      `acquireVerifyLock({ lockPath: ${JSON.stringify(lockPath)} });`,
      `process.stdout.write(String(process.pid));`,
    ].join("\n");
    const crashed = spawnSync(process.execPath, ["-e", crashScript], { encoding: "utf8" });
    const deadPid = Number(crashed.stdout.trim());
    assert.ok(Number.isInteger(deadPid) && deadPid > 0, `crashed holder must report a real pid, got: ${crashed.stdout}`);

    const start = Date.now();
    const acquisition = acquireVerifyLock({ lockPath });
    const elapsedMs = Date.now() - start;

    assert.equal(acquisition.stolenFromPid, deadPid, "acquiring after a dead holder must report the steal");
    // Revert check: without stale-holder detection, this call has nothing left alive to ever
    // release the lock and hangs until the test's own timeout kills it.
    assert.ok(elapsedMs < 2_000, `stealing a dead holder's lock must not block — took ${elapsedMs}ms`);
    acquisition.handle.release();
  });
});

test("runCommandCheck's evidence records how long a queued check waited for the per-machine lock", async () => {
  await withSanitizedLockEnv(async () => {
    const lockPath = join(tempDir("kage-verify-lock-wait-"), "verify.lock");
    const holdMs = 400;

    // A background holder in its own process — real concurrency, not a same-process
    // simulation (which would deadlock: the single JS thread doing the waiting is the same
    // thread that would need to run the code that releases the lock).
    const holderScript = [
      `const { acquireVerifyLock } = require(${JSON.stringify(LOCK_MODULE_PATH)});`,
      ...SANITIZE_CHILD_ENV_LINES,
      `const acq = acquireVerifyLock({ lockPath: ${JSON.stringify(lockPath)} });`,
      `process.stdout.write("ACQUIRED\\n");`,
      `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${holdMs});`,
      `acq.handle.release();`,
    ].join("\n");
    const holder = spawn(process.execPath, ["-e", holderScript]);
    await new Promise<void>((resolve, reject) => {
      holder.stdout.on("data", (chunk) => { if (String(chunk).includes("ACQUIRED")) resolve(); });
      holder.on("error", reject);
    });

    const projectDir = tempDir("kage-verify-lock-wait-evidence-");
    process.env.KAGE_VERIFY_LOCK_PATH = lockPath;
    const start = Date.now();
    const outcome = runCommandCheck(projectDir, "run-wait-evidence", projectDir, {
      id: "tests",
      kind: "command",
      cmd: "true",
      expect: "exit code 0",
    });
    const elapsedMs = Date.now() - start;
    assert.ok(
      elapsedMs >= holdMs - 100,
      `expected to wait roughly ${holdMs}ms for the background holder, only waited ${elapsedMs}ms`,
    );
    assert.ok(outcome.evidence, "a command check must always write evidence");
    const evidenceText = readFileSync(join(projectDir, outcome.evidence as string), "utf8");
    assert.match(
      evidenceText,
      /waited \d+ms for another verification on this machine to finish/,
      `evidence should record the lock wait, got:\n${evidenceText}`,
    );

    await new Promise((resolve) => holder.on("close", resolve));
  });
});

test("KAGE_NO_VERIFY_LOCK=1 skips the lock entirely", async () => {
  await withSanitizedLockEnv(() => {
    process.env.KAGE_NO_VERIFY_LOCK = "1";
    const acquisition = acquireVerifyLock({ lockPath: join(tempDir("kage-verify-lock-escape-"), "verify.lock") });
    assert.equal(acquisition.waitedMs, 0);
    assert.equal(acquisition.stolenFromPid, undefined);
    acquisition.handle.release();
  });
});

test("a spawned child sanitizes an ambient KAGE_NO_VERIFY_LOCK=1 escape hatch and still contends for a real lock", async () => {
  await withSanitizedLockEnv(async () => {
    const lockPath = join(tempDir("kage-verify-lock-sanitize-"), "verify.lock");

    // Simulates the operator's own escape hatch — set to verify THIS run without the
    // pre-fix kernel deadlocking on itself — leaking into a spawned child's ambient env,
    // explicitly passed here rather than relying on whatever the real ambient happens to be
    // so this test is deterministic either way. The child must delete it before acquiring,
    // exactly like verificationChildScript/crashScript/holderScript above, or it silently
    // takes the always-skip branch and this test, like those, would prove nothing.
    const script = [
      `const { acquireVerifyLock } = require(${JSON.stringify(LOCK_MODULE_PATH)});`,
      ...SANITIZE_CHILD_ENV_LINES,
      `const acq = acquireVerifyLock({ lockPath: ${JSON.stringify(lockPath)} });`,
      `process.stdout.write(JSON.stringify({ held: acq.held }));`,
      `acq.handle.release();`,
    ].join("\n");

    const result = await new Promise<{ held: boolean }>((resolve, reject) => {
      const child = spawn(process.execPath, ["-e", script], {
        env: { ...process.env, KAGE_NO_VERIFY_LOCK: "1" },
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`sanitize-escape-hatch child exited ${code}\n${stderr}`));
          return;
        }
        resolve(JSON.parse(stdout));
      });
    });

    // held:true means the child actually created the real lockfile — the tell that it
    // sanitized the ambient escape hatch rather than silently taking the always-skip branch,
    // which reports held:false and never touches the file at all.
    assert.equal(
      result.held,
      true,
      "a child that sanitizes an ambient KAGE_NO_VERIFY_LOCK=1 must still acquire the real lock",
    );
  });
});
