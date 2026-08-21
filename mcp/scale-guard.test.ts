// Tests for M4 of the memory store (docs/design/MEMORY_STORE.md): the
// benchmark harness (mcp/bench/{fixture,harness,run-one,run}.ts) and the
// scale guard it justifies (mcp/kernel.ts's countIndexableFiles /
// scaleGuardMessage, wired into `kage scan` / `kage install` in
// mcp/cli.ts). New behaviour gets its own file per this repo's rule --
// mcp/delegation.test.ts is off-limits, and this is not store-layer/-port/
// -graph coverage (that's M1-M3's own test files) but the M4 harness and
// guard specifically.
//
// REVERT CHECK: every test below fails if M4 is reverted.
// - "generateFixture is deterministic" fails if mcp/bench/fixture.ts is
//   removed (import error) or its generator stops being seed-deterministic.
// - "runBenchmark runs end-to-end at 200 files" fails if mcp/bench/
//   harness.ts is removed, or if it stops actually driving indexProject/
//   recall/queryStructuralGraphFromStore/refreshProject (every assertion
//   below reads a real measurement off a real run, not a stub).
// - "scaleGuardMessage fires above its threshold, not below" and "names the
//   doc" fail if mcp/kernel.ts's scaleGuardMessage is removed or stops
//   returning null under the threshold / a message naming docs/BENCHMARKS.md
//   above it.
// - "BENCHMARKS.md's cited paths exist" fails if docs/BENCHMARKS.md's M4
//   section is removed or cites a path this worktree doesn't actually have.
//
// The 10,000-file run that produced docs/BENCHMARKS.md's published numbers
// is NOT run here -- per the M4 brief, that happens once, by hand, via
// `node dist/bench/run.js`, and its numbers are cited in the doc, not
// reproduced by the test suite. This file only exercises the harness at 200
// files, which is fast enough to run on every `npm test`.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { countIndexableFiles, SCALE_GUARD_FILE_THRESHOLD, scaleGuardMessage } from "./kernel.js";
import { runBenchmark } from "./bench/harness.js";
import { fixtureFingerprint, generateFixture } from "./bench/fixture.js";

// Hermetic personal store -- same guard every other kernel-touching test
// file in this repo uses; recall/indexProject read $KAGE_HOME/memory, so
// tests must never touch the developer's real ~/.kage.
if (!process.env.KAGE_HOME) process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-scale-guard-test-home-"));

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `${prefix}-`));
}

const SMALL_FILE_COUNT = 200;
const SMALL_PACKET_COUNT = 20;

// --- fixture generation is deterministic -----------------------------------

test("generateFixture produces a deterministic fixture: same seed, same file hashes", () => {
  const dirA = tempDir("kage-bench-fixture-a");
  const dirB = tempDir("kage-bench-fixture-b");
  const optsA = { seed: 42, fileCount: 30, packetCount: 5 };
  const optsB = { seed: 42, fileCount: 30, packetCount: 5 };

  const resultA = generateFixture(dirA, optsA);
  const resultB = generateFixture(dirB, optsB);

  assert.equal(resultA.files.length, 30);
  assert.equal(resultA.packets.length, 5);
  assert.deepEqual(resultA.files, resultB.files, "same seed should generate the same file list");
  assert.equal(fixtureFingerprint(resultA), fixtureFingerprint(resultB), "same seed should produce byte-identical generated files");

  // Sanity: a different seed must not coincidentally collide.
  const dirC = tempDir("kage-bench-fixture-c");
  const resultC = generateFixture(dirC, { seed: 43, fileCount: 30, packetCount: 5 });
  assert.notEqual(fixtureFingerprint(resultA), fixtureFingerprint(resultC), "a different seed should produce a different fingerprint");
});

// --- the harness runs end-to-end at a small size ----------------------------

test("runBenchmark runs end-to-end at 200 files on the json backend", () => {
  const dir = tempDir("kage-bench-json-200");
  const result = runBenchmark(dir, { seed: 1, fileCount: SMALL_FILE_COUNT, packetCount: SMALL_PACKET_COUNT, backend: "json" });

  assert.equal(result.backend, "json");
  assert.equal(result.fileCount, SMALL_FILE_COUNT);
  assert.ok(result.coldIndexMs > 0, "cold index should take measurable time");
  assert.ok(result.warmRefreshMs >= 0, "warm refresh should complete and report a duration");
  assert.ok(result.touchedFileCount >= 1, "warm refresh should have touched at least one file");
  assert.ok(result.recallHitCount >= 1, "recall for the fixture's own recall term should hit the packet that carries it");
  assert.ok(result.graphQueryFileHits + result.graphQuerySymbolHits >= 1, "a graph query for a real generated symbol should hit at least one file or symbol");
  assert.ok(result.storeOnDiskBytes > 0, "the json backend should have written real bytes to .agent_memory/");
  assert.ok(result.storeOnDiskFiles > 0, "the json backend should have written at least one artifact file");
});

test("runBenchmark runs end-to-end at 200 files on the sqlite backend when node:sqlite is available", () => {
  // node:sqlite is feature-detected (docs/design/MEMORY_STORE.md Law 2) --
  // this environment's own node -e probe (recorded in this run's claim)
  // confirmed it is available, but a future CI image might not have it, so
  // this test skips rather than fails when it's absent, the same posture
  // mcp/store-graph.test.ts's SQLITE_AVAILABLE-gated tests take.
  let sqliteAvailable = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("node:sqlite");
  } catch {
    sqliteAvailable = false;
  }
  if (!sqliteAvailable) {
    return;
  }
  const dir = tempDir("kage-bench-sqlite-200");
  const result = runBenchmark(dir, { seed: 1, fileCount: SMALL_FILE_COUNT, packetCount: SMALL_PACKET_COUNT, backend: "sqlite" });

  assert.equal(result.backend, "sqlite");
  assert.ok(result.coldIndexMs > 0, "cold index should take measurable time");
  assert.ok(result.recallHitCount >= 1, "recall for the fixture's own recall term should hit the packet that carries it");
  assert.ok(result.storeOnDiskBytes > 0, "the sqlite backend should have written a real .sqlite file");
  assert.equal(result.storeOnDiskFiles, 1, "the sqlite backend's on-disk footprint is exactly one file");
});

// --- countIndexableFiles matches what the fixture actually generated -------

test("countIndexableFiles counts the fixture's own generated source files", () => {
  const dir = tempDir("kage-bench-count");
  generateFixture(dir, { seed: 1, fileCount: SMALL_FILE_COUNT, packetCount: SMALL_PACKET_COUNT });
  assert.equal(countIndexableFiles(dir), SMALL_FILE_COUNT, "countIndexableFiles should see exactly the generated src/*.ts files, and skip .agent_memory/packets/*.md");
});

// --- the scale guard fires above its threshold, never below ----------------

test("scaleGuardMessage fires above its threshold and not at or below it", () => {
  assert.equal(scaleGuardMessage(0), null);
  assert.equal(scaleGuardMessage(SCALE_GUARD_FILE_THRESHOLD), null, "exactly at the threshold should not warn");
  assert.notEqual(scaleGuardMessage(SCALE_GUARD_FILE_THRESHOLD + 1), null, "one file over the threshold should warn");
  assert.ok(SCALE_GUARD_FILE_THRESHOLD > 0, "the threshold itself should be a real positive number, not a placeholder");
});

test("scaleGuardMessage's warning names docs/BENCHMARKS.md", () => {
  const message = scaleGuardMessage(SCALE_GUARD_FILE_THRESHOLD + 1);
  assert.ok(message, "expected a warning above the threshold");
  assert.ok((message as string).includes("docs/BENCHMARKS.md"), `warning should name docs/BENCHMARKS.md so a reader knows where the numbers behind it live, got: ${message}`);
});

test("scaleGuardMessage respects an explicit threshold override", () => {
  assert.equal(scaleGuardMessage(50, 100), null);
  assert.notEqual(scaleGuardMessage(150, 100), null);
});

// --- docs/BENCHMARKS.md cites real paths ------------------------------------

const repoPath = (...parts: string[]) => join(__dirname, "..", "..", ...parts);
const BENCHMARKS_DOC_PATH = repoPath("docs", "BENCHMARKS.md");
// Matches the same backtick-quoted-path convention mcp/store-doc.test.ts's
// PATH_TOKEN uses: a known top-level segment, a slash, and a file
// extension, with an optional trailing :LINE stripped.
const PATH_TOKEN = /`((?:mcp|docs)\/[\w.\-/]+\.\w+)(?::\d+(?:-\d+)?)?`/g;

test("docs/BENCHMARKS.md exists and has an M4 memory-store scale section", () => {
  assert.ok(existsSync(BENCHMARKS_DOC_PATH), "docs/BENCHMARKS.md is missing");
  const doc = readFileSync(BENCHMARKS_DOC_PATH, "utf8");
  assert.ok(/memory store/i.test(doc), "docs/BENCHMARKS.md should have a memory-store scale section (M4)");
  assert.ok(doc.includes("measured-on-this-machine") || doc.includes("measured on this machine"), "docs/BENCHMARKS.md's M4 numbers should be labelled measured-on-this-machine, per the M4 brief");
});

test("every path docs/BENCHMARKS.md cites in backticks exists in the worktree", () => {
  const doc = readFileSync(BENCHMARKS_DOC_PATH, "utf8");
  const found = new Set<string>();
  for (const match of doc.matchAll(PATH_TOKEN)) found.add(match[1]);
  const paths = [...found];
  assert.ok(paths.length > 0, "expected docs/BENCHMARKS.md to cite at least one real repo path");
  for (const path of paths) {
    assert.ok(existsSync(repoPath(path)), `docs/BENCHMARKS.md cites "${path}", but it does not exist in the worktree`);
  }
});
