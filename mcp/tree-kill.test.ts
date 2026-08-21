// Regression tests for the timeout-orphan bug: a timed-out check killed only its direct
// child, leaving whatever THAT child had spawned (e.g. `npm run test` -> `node --test` ->
// per-file workers) alive and reparented. Three such zombie test suites were found still
// running the morning after, each hanging every later verification on the machine beside
// them (238 tests then stall) until killed by hand — the timeout was reporting real hangs
// caused by its own previous kills. The fix, in mcp/delegation/verify.ts's
// spawnWithTreeKill: spawn the check in its own process group (`detached: true`) and, on
// timeout, sweep the WHOLE group — SIGTERM, a 5s grace, then SIGKILL — instead of the one
// pid Node itself tracks. mcp/delegation/static-checks.ts's runCommand shares the exact
// same fix (it now calls spawnWithTreeKill too), so its own hazard is covered by the same
// primitive these tests exercise directly.
//
// Its own file per this repo's rule — new behaviour gets a new test file, and
// mcp/delegation.test.ts is a known append-collision hotspot.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommandCheck, spawnWithTreeKill } from "./delegation/verify.js";

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Polls process liveness by pid rather than sleeping a fixed amount — returns as soon as
// the process is gone, and gives up only after maxMs (well past the real 5s grace) so a
// broken fix fails fast instead of hanging the suite.
async function waitUntilDead(pid: number, maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await sleep(100);
  }
  return !isAlive(pid);
}

// A shell command shaped like the real bug: it backgrounds a grandchild that traps and
// ignores SIGTERM and never exits on its own, records that grandchild's pid to `pidFile`,
// then waits on it — so the command as a whole never finishes, and the immediate child
// (the shell) is the only thing that dies from a SIGTERM sent to it alone. Uses
// process.execPath rather than a bare `node` so it resolves the same interpreter this
// test itself is running under, regardless of the shell's PATH.
function grandchildIgnoringSigtermCmd(pidFile: string): string {
  return `'${process.execPath}' -e "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)" & echo $! > "${pidFile}"; wait`;
}

// --- the core mechanism: spawnWithTreeKill itself -------------------------------------

test("spawnWithTreeKill kills both the timed-out child and its SIGTERM-ignoring grandchild within the grace period", async () => {
  const dir = tempDir("kage-treekill-");
  const pidFile = join(dir, "grandchild.pid");
  const cmd = grandchildIgnoringSigtermCmd(pidFile);

  const result = spawnWithTreeKill(cmd, [], { cwd: dir, shell: true }, 500);

  assert.equal(result.treeKilled, true, "a hung command must be reported as tree-killed");
  assert.equal(result.error?.code, "ETIMEDOUT");

  const grandchildPid = Number(readFileSync(pidFile, "utf8").trim());
  assert.ok(Number.isInteger(grandchildPid) && grandchildPid > 0, "grandchild pid file must have a real pid");

  // Revert check: without the tree-kill fix, only the immediate child (already reaped by
  // spawnSync's own built-in timeout) dies — the grandchild, orphaned and never signaled
  // directly, keeps running forever. This assertion is what fails on that revert.
  const died = await waitUntilDead(grandchildPid, 8_000);
  assert.ok(died, `orphaned grandchild pid ${grandchildPid} was still alive well past the tree-kill grace`);
});

// --- the evidence file: runCommandCheck's real production path -------------------------

test("a timed-out check's evidence file names the tree kill", async () => {
  const dir = tempDir("kage-treekill-evidence-");
  const pidFile = join(dir, "grandchild.pid");
  const cmd = grandchildIgnoringSigtermCmd(pidFile);
  const runId = "run-tree-kill-evidence";

  const outcome = runCommandCheck(dir, runId, dir, { id: "tests", kind: "command", cmd, expect: "exit code 0" }, 500);

  assert.equal(outcome.result, "fail");
  assert.equal(outcome.exit_code, 124);
  assert.ok(outcome.evidence, "a command check must always write evidence");
  const evidenceText = readFileSync(join(dir, outcome.evidence as string), "utf8");
  assert.ok(
    evidenceText.includes("timeout after 0.5s - process tree killed"),
    `evidence should name the tree kill, got:\n${evidenceText}`,
  );

  const grandchildPid = Number(readFileSync(pidFile, "utf8").trim());
  const died = await waitUntilDead(grandchildPid, 8_000);
  assert.ok(died, `orphaned grandchild pid ${grandchildPid} was still alive after runCommandCheck returned`);
});

// --- the negative case: a well-behaved command must not be slowed or misreported -------

test("a fast-exiting command is unaffected by the tree-kill fix", () => {
  const dir = tempDir("kage-treekill-fast-");
  const runId = "run-tree-kill-fast";

  const start = Date.now();
  const outcome = runCommandCheck(dir, runId, dir, { id: "tests", kind: "command", cmd: "true", expect: "exit code 0" }, 5_000);
  const elapsedMs = Date.now() - start;

  assert.equal(outcome.result, "pass");
  assert.equal(outcome.exit_code, 0);
  assert.ok(elapsedMs < 2_000, `a command that exits immediately took ${elapsedMs}ms — the tree-kill machinery must not add latency to the normal path`);
  const evidenceText = readFileSync(join(dir, outcome.evidence as string), "utf8");
  assert.ok(!evidenceText.includes("process tree killed"), "a fast, successful command must never be reported as tree-killed");
});
