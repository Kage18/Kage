// Synthetic repo fixture generator for the M4 memory-store benchmark harness
// (docs/design/MEMORY_STORE.md, "M4 -- benchmarks and the scale guard").
//
// Generates N TypeScript files under src/ with a realistic import/call graph
// (each file imports and calls a small, deterministic set of earlier files,
// so structural analysis produces real files/symbols/import edges/call
// edges, not an empty or degenerate graph) plus M memory packets citing
// those files, entirely inside the caller-provided directory -- this module
// touches no path outside `dir`, makes no network call, and depends on
// nothing beyond node:fs/node:path. Content is deterministic for a given
// seed: two calls with the same (seed, fileCount, packetCount) produce
// byte-identical files, which is what makes fixtureFingerprint() below a
// meaningful "same seed, same file hashes" check (mcp/scale-guard.test.ts).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// mulberry32: a tiny deterministic PRNG. Not cryptographic -- this only
// needs to be reproducible across runs and platforms, which Math.random()
// is not.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n: number, width = 6): string {
  return String(n).padStart(width, "0");
}

export interface FixtureOptions {
  seed: number;
  fileCount: number;
  packetCount: number;
  /** How many earlier files each file imports from (capped by its own index). Default 2. */
  importsPerFile?: number;
}

export interface FixtureResult {
  projectDir: string;
  /** Repo-relative paths of every generated source file, in generation order. */
  files: string[];
  /** Repo-relative paths of every generated packet file, in generation order. */
  packets: string[];
  /** A term guaranteed to appear in exactly one packet's body and title -- a
   *  stable, deterministic recall-query target (see queryTermFor()). */
  recallTerm: string;
  /** A symbol name guaranteed to exist in the generated code graph -- a
   *  stable, deterministic graph-query target. */
  graphTerm: string;
}

function moduleFile(index: number): string {
  return `src/mod_${pad(index)}.ts`;
}

function fnName(index: number): string {
  return `fn_${pad(index)}`;
}

/** The deterministic recall-query term for a fixture generated with `seed`. */
export function queryTermFor(seed: number): string {
  return `benchmarkterm${seed}`;
}

/** The deterministic graph-query term (a real generated symbol name) for a fixture with `fileCount` files. */
export function graphTermFor(fileCount: number): string {
  return fnName(Math.max(0, fileCount - 1));
}

/**
 * Writes a fixture into `dir` (must already exist). Idempotent for a given
 * seed/fileCount/packetCount: calling it twice into two empty directories
 * produces byte-identical trees (see fixtureFingerprint()).
 */
export function generateFixture(dir: string, opts: FixtureOptions): FixtureResult {
  const importsPerFile = opts.importsPerFile ?? 2;
  const rand = mulberry32(opts.seed);
  const srcDir = join(dir, "src");
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(join(dir, ".agent_memory", "packets"), { recursive: true });

  const files: string[] = [];
  for (let i = 0; i < opts.fileCount; i++) {
    const relPath = moduleFile(i);
    const importCount = Math.min(importsPerFile, i);
    const importIndices: number[] = [];
    for (let k = 0; k < importCount; k++) {
      // Deterministic pseudo-random pick among earlier files, dedup by
      // linear probe -- keeps the import graph realistic (not just "import
      // the immediately preceding file") without ever forming a cycle.
      let candidate = Math.floor(rand() * i);
      while (importIndices.includes(candidate)) candidate = (candidate + 1) % i;
      importIndices.push(candidate);
    }
    importIndices.sort((a, b) => a - b);
    const importLines = importIndices.map((idx) => `import { ${fnName(idx)} } from "./${`mod_${pad(idx)}`}";`);
    const callSum = importIndices.length ? importIndices.map((idx) => `${fnName(idx)}()`).join(" + ") : "0";
    const body = [
      ...importLines,
      "",
      `/** Generated fixture module ${i}, seed ${opts.seed}. */`,
      `export function ${fnName(i)}(): number {`,
      `  return ${callSum} + ${i};`,
      `}`,
      "",
      `export interface Mod${pad(i)}Shape {`,
      `  value: number;`,
      `  label: string;`,
      `}`,
      "",
    ].join("\n");
    writeFileSync(join(dir, relPath), body, "utf8");
    files.push(relPath);
  }

  const recallTerm = queryTermFor(opts.seed);
  const packets: string[] = [];
  for (let j = 0; j < opts.packetCount; j++) {
    const slug = `bench-packet-${pad(j)}`;
    const relPath = `.agent_memory/packets/${slug}.md`;
    // Deterministically cite 1-3 files, spread across the whole file range
    // rather than clustered at the start, so packet_paths/vector rows exercise
    // the full corpus.
    const citeCount = 1 + Math.floor(rand() * 3);
    const cited = new Set<string>();
    for (let c = 0; c < citeCount && cited.size < opts.fileCount; c++) {
      cited.add(moduleFile(Math.floor(rand() * opts.fileCount)));
    }
    const citedPaths = [...cited];
    // Every packet's body/title carries the recall term exactly once on
    // packet 0 only, so recall(project, recallTerm) has exactly one strong
    // hit -- a deterministic, non-degenerate query target. Every packet
    // also carries generic filler terms so BM25/vector scoring has a real
    // corpus to rank against, not one document.
    const isRecallTarget = j === 0;
    const title = isRecallTarget
      ? `How the ${recallTerm} subsystem is wired together`
      : `Generated fixture note ${j} about ${citedPaths[0]}`;
    const body = isRecallTarget
      ? `This packet exists to document the ${recallTerm} subsystem, a synthetic benchmark fixture citing ${citedPaths.join(", ")}. It is the deterministic recall target for docs/design/MEMORY_STORE.md's M4 benchmark harness.`
      : `Fixture packet ${j} citing ${citedPaths.join(", ")}. Generic filler text about repo structure, imports, and generated modules for benchmark corpus realism.`;
    const frontmatter = [
      "---",
      `id: repo:fixture:decision:${slug}`,
      "type: decision",
      "status: approved",
      `title: ${JSON.stringify(title)}`,
      `paths: ${JSON.stringify(citedPaths)}`,
      "tags: [\"bench\", \"fixture\"]",
      `updated_at: "2026-08-20T00:00:00.000Z"`,
      "---",
    ].join("\n");
    writeFileSync(join(dir, relPath), `${frontmatter}\n${body}\n`, "utf8");
    packets.push(relPath);
  }

  return { projectDir: dir, files, packets, recallTerm, graphTerm: graphTermFor(opts.fileCount) };
}

/**
 * A single sha256 over every generated file's own sha256, in a stable
 * (sorted-path) order -- used by mcp/scale-guard.test.ts to assert that two
 * independent generateFixture() calls with the same seed produce
 * byte-identical trees. Reads back from disk (not from in-memory content)
 * so it is a real end-to-end check, not just "the generator function is
 * pure."
 */
export function fixtureFingerprint(result: FixtureResult): string {
  const hash = createHash("sha256");
  for (const relPath of [...result.files, ...result.packets].sort()) {
    const fullPath = join(result.projectDir, relPath);
    if (!existsSync(fullPath)) continue;
    const fileHash = createHash("sha256").update(readFileSync(fullPath)).digest("hex");
    hash.update(`${relPath}:${fileHash}\n`);
  }
  return hash.digest("hex");
}

/**
 * Deterministically "touches" `count` of the fixture's files (content
 * change, same symbol shape) to simulate a small edit before a warm
 * refresh -- picks files spread across the corpus via the same PRNG family
 * generateFixture() uses, so the touched set is reproducible for a given
 * seed/count.
 */
export function touchFiles(result: FixtureResult, seed: number, count: number): string[] {
  const rand = mulberry32(seed + 1);
  const touched = new Set<string>();
  const n = Math.min(count, result.files.length);
  while (touched.size < n) {
    touched.add(result.files[Math.floor(rand() * result.files.length)]);
  }
  const touchedList = [...touched];
  for (const relPath of touchedList) {
    const fullPath = join(result.projectDir, relPath);
    const current = readFileSync(fullPath, "utf8");
    writeFileSync(fullPath, `${current}\n// touched at bench warm-refresh step\n`, "utf8");
  }
  return touchedList;
}
