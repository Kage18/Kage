// docs/design/MEMORY_STORE.md cites real symbols at real file:line locations, states two
// laws (zero new dependencies / JSON-fallback-on-feature-detect) that must survive verbatim
// enough to grep, and its `engines` claim must match mcp/package.json. Same pattern as
// mcp/readme-claims.test.ts, mcp/context-doc.test.ts, and mcp/sessions-doc.test.ts: a design
// doc that names code is a claim about the code, and this repo's standing failure mode is
// docs that outrun what actually shipped. This file keeps that claim honest: every
// backtick-quoted repo path the doc cites must exist; every symbol an "exists"-style
// citation names must actually appear in the file it's cited against; the doc's own
// non-negotiable laws (no new deps, node:sqlite feature-detected with a JSON fallback, no
// database server/account/cloud) must still read as stated; and the `>=18` engines figure
// the doc quotes from mcp/package.json must still be the real value there.
//
// REGRESSION: delete docs/design/MEMORY_STORE.md, or rename/remove any symbol in
// SYMBOL_CITATIONS below from the file it's cited against (e.g. rename writeJson in
// mcp/kernel.ts), or edit mcp/package.json's engines.node away from ">=18" without updating
// the doc, or reword the doc so it no longer states the JSON-fallback law or the
// zero-new-dependencies law in a greppable form — any of those fails a test in this file.
//
// M1 landed 2026-08-20 (mcp/store/{types,sqlite,json,manifest,rebuild}.ts,
// mcp/store-layer.test.ts): the guard below is now bidirectional, not a
// single "doesn't exist yet" check. It fails if mcp/store/ or any of its
// five files goes missing, or if the doc stops saying M1 landed, or if
// mcp/kernel.ts starts importing from mcp/store/ or referencing
// StoreBackend before M2/M3 actually wire the seam in.
//
// __dirname is mcp/dist/ at runtime (compiled test) — one ".." reaches sibling mcp/
// sources, two reaches the repo root. Same convention as readme-claims.test.ts,
// context-doc.test.ts, and sessions-doc.test.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoPath = (...parts: string[]) => join(__dirname, "..", "..", ...parts);
const DOC_PATH = repoPath("docs", "design", "MEMORY_STORE.md");

function readDoc(): string {
  return readFileSync(DOC_PATH, "utf8");
}

// Every backtick-quoted token that looks like a repo-relative file path (a known
// top-level segment, a slash, and a file extension), with an optional trailing
// :LINE or :LINE-LINE stripped before existence is checked. Same shape as
// context-doc.test.ts's / sessions-doc.test.ts's PATH_TOKEN. This doc cites no
// illustrative globs (it deliberately avoids backtick-wrapping the one proposed-but-
// not-yet-real path it names, .agent_memory/store/manifest.json, for exactly this
// reason), so there is no separate GLOB_TOKEN here.
const PATH_TOKEN = /`((?:mcp|docs|\.agent_memory)\/[\w.\-/]+\.\w+)(?::\d+(?:-\d+)?)?`/g;

function citedPaths(doc: string): string[] {
  const found = new Set<string>();
  for (const match of doc.matchAll(PATH_TOKEN)) found.add(match[1]);
  return [...found];
}

// Every `Symbol` this doc cites as existing code, paired with the file it names for
// that symbol — hand-curated against the doc's own "Exists"/prose citations (verified
// against the real source before landing, not derived mechanically from the markdown).
// The M1 store-layer symbols below (StoreBackend through rebuildStore) were
// proposed-but-not-yet-real when this file was first written; M1 landed
// 2026-08-20 and they are real exported symbols in mcp/store/ now, verified
// the same way as every kernel.ts citation above them.
const SYMBOL_CITATIONS: Array<{ symbol: string; file: string }> = [
  { symbol: "writeJson", file: "mcp/kernel.ts" },
  { symbol: "readJson", file: "mcp/kernel.ts" },
  { symbol: "recall", file: "mcp/kernel.ts" },
  { symbol: "recallWithVectorScores", file: "mcp/kernel.ts" },
  { symbol: "loadApprovedPackets", file: "mcp/kernel.ts" },
  { symbol: "readSparseVectorIndex", file: "mcp/kernel.ts" },
  { symbol: "searchDocs", file: "mcp/kernel.ts" },
  { symbol: "readDocsIndex", file: "mcp/kernel.ts" },
  { symbol: "queryCodeGraph", file: "mcp/kernel.ts" },
  { symbol: "readCurrentCodeGraph", file: "mcp/kernel.ts" },
  { symbol: "buildCodeGraph", file: "mcp/kernel.ts" },
  { symbol: "hydrateCodeGraphArtifact", file: "mcp/kernel.ts" },
  { symbol: "hydrateKnowledgeGraphArtifact", file: "mcp/kernel.ts" },
  { symbol: "refreshPacketStaleness", file: "mcp/kernel.ts" },
  { symbol: "loadPacketEntriesFromDir", file: "mcp/kernel.ts" },
  { symbol: "staleMemoryReasons", file: "mcp/kernel.ts" },
  { symbol: "detectContradictions", file: "mcp/kernel.ts" },
  { symbol: "scorePacketsBm25", file: "mcp/kernel.ts" },
  { symbol: "buildStructuralFile", file: "mcp/kernel.ts" },
  { symbol: "writeStructuralFileCachePack", file: "mcp/kernel.ts" },
  { symbol: "readPackedStructuralCache", file: "mcp/kernel.ts" },
  { symbol: "recallBreakdown", file: "mcp/kernel.ts" },
  { symbol: "RecallScoreBreakdown", file: "mcp/kernel.ts" },
  { symbol: "queryGraph", file: "mcp/kernel.ts" },
  { symbol: "truthReport", file: "mcp/kernel.ts" },
  { symbol: "initProject", file: "mcp/kernel.ts" },
  // M1 store layer, landed 2026-08-20 -- see the "M1 seam exists" test below
  // for the directory/file-level half of this guard.
  { symbol: "StoreBackend", file: "mcp/store/types.ts" },
  { symbol: "SqliteStoreBackend", file: "mcp/store/sqlite.ts" },
  { symbol: "detect", file: "mcp/store/sqlite.ts" },
  { symbol: "JsonStoreBackend", file: "mcp/store/json.ts" },
  { symbol: "openStore", file: "mcp/store/manifest.ts" },
  { symbol: "rebuildStore", file: "mcp/store/rebuild.ts" },
];

test("docs/design/MEMORY_STORE.md exists and is a substantial design doc", () => {
  assert.ok(existsSync(DOC_PATH), "docs/design/MEMORY_STORE.md is missing");
  const doc = readDoc();
  assert.ok(doc.length > 4000, `expected a substantial design doc, got ${doc.length} chars`);
  assert.ok(doc.includes("# Kage's Memory Store"), "doc should open with the Memory Store title");
  for (const heading of [
    "## The problem, measured on this repo, 2026-08-20",
    "## The three laws this design will not break",
    "## The design",
    "## Rollout phases",
  ]) {
    assert.ok(doc.includes(heading), `doc should have a "${heading}" section`);
  }
});

test("every concrete repo path MEMORY_STORE.md cites exists in the worktree", () => {
  const paths = citedPaths(readDoc());
  assert.ok(paths.length >= 10, `expected many cited paths, found ${paths.length}`);
  for (const path of paths) {
    assert.ok(existsSync(repoPath(path)), `MEMORY_STORE.md cites "${path}" but it does not exist in the worktree`);
  }
});

test("every symbol MEMORY_STORE.md cites as existing code is a real identifier in its cited file", () => {
  assert.ok(SYMBOL_CITATIONS.length >= 20, `expected many symbol citations, found ${SYMBOL_CITATIONS.length}`);
  for (const { symbol, file } of SYMBOL_CITATIONS) {
    const fullPath = repoPath(file);
    assert.ok(existsSync(fullPath), `"${symbol}" is cited against "${file}", but that file does not exist`);
    const source = readFileSync(fullPath, "utf8");
    const identifier = new RegExp(`\\b${symbol}\\b`);
    assert.ok(identifier.test(source), `"${symbol}" is cited as existing in "${file}", but no such identifier appears there`);
  }
});

test("M1's store seam exists as shipped code, and the doc says M1 landed", () => {
  // M1 landed 2026-08-20: mcp/store/ is real work now, not a proposal. This
  // guard is the mirror image of what it used to check -- it now fails if
  // the seam disappears out from under the doc, or if the doc stops saying
  // M1 landed while the code still exists (the doc would then be stale in
  // the other direction: undercounting what has actually shipped).
  assert.ok(existsSync(repoPath("mcp", "store")), "expected mcp/store/ to exist -- M1 landed 2026-08-20 and this doc says so");
  for (const file of ["types.ts", "sqlite.ts", "json.ts", "manifest.ts", "rebuild.ts"]) {
    assert.ok(existsSync(repoPath("mcp", "store", file)), `expected mcp/store/${file} to exist -- it's one of the five files M1's row in the rollout table names`);
  }
  assert.ok(existsSync(repoPath("mcp", "store-layer.test.ts")), "expected mcp/store-layer.test.ts to exist -- M1's own test file");

  const doc = readDoc();
  assert.ok(doc.includes("M1 — the store layer") && doc.includes("Landed 2026-08-20"), "doc's M1 row should say M1 landed 2026-08-20, not just describe it as proposed");
  for (const symbol of ["StoreBackend", "SqliteStoreBackend", "JsonStoreBackend", "openStore", "rebuildStore"]) {
    assert.ok(doc.includes(symbol), `doc's M1 row should name the real exported symbol "${symbol}" it landed`);
  }
});

test("M2/M3 have not wired the store seam into mcp/kernel.ts yet, and the doc still marks them not built", () => {
  // The other half of the same guard: M1 landing must not be mistaken for
  // M2/M3 landing. mcp/kernel.ts must still own every artifact this design
  // is meant to eventually move behind the seam -- if StoreBackend (or an
  // import from mcp/store/) shows up in kernel.ts, M2/M3 have started and
  // this doc's "Not yet built" rows are now stale.
  const kernelSource = readFileSync(repoPath("mcp", "kernel.ts"), "utf8");
  assert.ok(!/\bStoreBackend\b/.test(kernelSource), "expected no StoreBackend identifier in mcp/kernel.ts yet -- that's M2/M3's job, not M1's");
  assert.ok(!/from\s+["']\.\/store\//.test(kernelSource) && !/require\(["']\.\/store\//.test(kernelSource), "expected mcp/kernel.ts to not import from mcp/store/ yet -- that's M2/M3's job, not M1's");

  const doc = readDoc();
  assert.ok(/M2 — the memory-side port\*\*\s*\|\s*Not yet built/.test(doc), "doc's M2 row should still say Not yet built");
  assert.ok(/M3 — the graph-side port\*\*\s*\|\s*Not yet built/.test(doc), "doc's M3 row should still say Not yet built");
  assert.ok(/M4 — benchmarks and the scale guard\*\*\s*\|\s*Not yet built/.test(doc), "doc's M4 row should still say Not yet built");
});

test("the doc states the JSON-fallback law in a greppable form", () => {
  const doc = readDoc();
  assert.ok(doc.includes("JsonStoreBackend"), "doc should name the JSON fallback backend");
  assert.ok(
    /JSON backend is not (a fallback for|retired)/.test(doc) || doc.includes("JSON files in place as a rollback path"),
    "doc should state that the JSON path remains the fallback when node:sqlite is unavailable, or stays as a rollback path",
  );
  assert.ok(doc.includes("no earlier than two releases"), "doc should state the JSON fallback retirement floor (no earlier than two releases after M4 proves parity)");
});

test("the doc states the zero-new-dependencies law verbatim enough to grep", () => {
  const doc = readDoc();
  assert.ok(doc.includes("zero new dependencies"), 'doc should state the law as "zero new dependencies"');
  assert.ok(doc.includes("node:sqlite"), "doc should name node:sqlite as the store backend");
  assert.ok(doc.includes("better-sqlite3"), "doc should explicitly rule out better-sqlite3 by name");
  assert.ok(
    doc.toLowerCase().includes("native module") && /ruled out categorically/.test(doc),
    "doc should rule out native modules categorically, not just deprioritize them",
  );
});

test("the doc's engines claim matches mcp/package.json", () => {
  const pkg = JSON.parse(readFileSync(repoPath("mcp", "package.json"), "utf8")) as { engines?: { node?: string } };
  const actualEngines = pkg.engines?.node;
  assert.equal(actualEngines, ">=18", `expected mcp/package.json engines.node to be ">=18" (what the doc quotes), found "${actualEngines}"`);
  const doc = readDoc();
  assert.ok(doc.includes('">=18"'), 'doc should quote the exact engines.node value, ">=18"');
});

test("the doc is honest that an embedded database is still a database, not weaselly about 'no database'", () => {
  const doc = readDoc();
  // Markdown wraps prose at arbitrary columns, so a multi-word quote spanning two source
  // lines must not be missed just because a newline landed inside it — collapse all
  // whitespace runs to a single space first, same approach sessions-doc.test.ts uses.
  const flat = doc.replace(/\s+/g, " ");
  assert.ok(
    doc.includes("is, honestly, a") || doc.includes("is honestly a database"),
    "doc should directly admit an embedded SQLite file is a database, not soften the claim",
  );
  assert.ok(flat.includes("No hosted service, external database, or API key is required"), "doc should quote mcp/README.md's exact 'no database' wording it is reconciling against");
  assert.ok(doc.includes("no database"), "doc should quote README.md's exact 'no account, no database' wording it is reconciling against");
  assert.ok(
    doc.toLowerCase().includes("required follow-up") || doc.toLowerCase().includes("out of bounds for this"),
    "doc should flag the README wording change as required follow-up work, not silently claim to have already kept the promise",
  );
});

test("the doc names all four rollout phases with acceptance criteria, in order", () => {
  const doc = readDoc();
  for (const name of ["M1 — the store layer", "M2 — the memory-side port", "M3 — the graph-side port", "M4 — benchmarks and the scale guard"]) {
    assert.ok(doc.includes(name), `expected a phase named "${name}"`);
  }
  const m1 = doc.indexOf("M1 — the store layer");
  const m2 = doc.indexOf("M2 — the memory-side port");
  const m3 = doc.indexOf("M3 — the graph-side port");
  const m4 = doc.indexOf("M4 — benchmarks and the scale guard");
  assert.ok(m1 >= 0 && m1 < m2 && m2 < m3 && m3 < m4, "expected phases M1-M4 to appear in order");
  assert.ok(doc.includes("feature-detect fallback test"), "doc should specify M1's feature-detect fallback unit test");
});

test("the doc corrects the plan's file/symbol/edge counts instead of repeating them silently", () => {
  const doc = readDoc();
  // The plan this doc was drafted from cited 135 files / 7,379 symbols / 8,272 edges;
  // this session's own measurement (taken during verification) found 136 / 7,413 / 8,310.
  // The doc must carry its own measured numbers and say so, the same corrective pattern
  // CONTEXT_ENGINE.md uses for its "342K" figure.
  assert.ok(doc.includes("7,413"), "doc should cite this session's measured symbol count (7,413), not just the plan's 7,379");
  assert.ok(doc.includes("8,310"), "doc should cite this session's measured structural edge count (8,310), not just the plan's 8,272");
  assert.ok(doc.includes("136 indexable source files"), "doc should cite this session's measured file count (136)");
  assert.ok(
    doc.includes("this session's own measurement") || doc.includes("corrected here rather than repeated"),
    "doc should explicitly flag its numbers as its own re-measurement, not a silent restatement of the plan's",
  );
});
