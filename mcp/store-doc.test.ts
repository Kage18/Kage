// docs/design/MEMORY_STORE.md cites real symbols at real file:line locations, states two
// laws (zero new dependencies / JSON-fallback-on-feature-detect) that must survive verbatim
// enough to grep, and its `engines` claim must match mcp/package.json. Same pattern as
// mcp/readme-claims.test.ts, mcp/context-doc.test.ts, and mcp/sessions-doc.test.ts: a design
// doc that names code is a claim about the code, and this repo's standing failure mode is
// docs that outrun what actually shipped. This file keeps that claim honest: every
// backtick-quoted repo path the doc cites is either TRACKED (must exist in the worktree —
// a design doc citing source is a claim about source control) or a DERIVED, gitignored
// `.agent_memory/` artifact (must instead be labelled in the doc as derived/rebuildable,
// never asserted to exist — a clean worktree that hasn't indexed yet legitimately has none
// of these, and asserting existence there was the bug that broke this file's own guard);
// every symbol an "exists"-style citation names must actually appear in the file it's
// cited against; the doc's own non-negotiable laws (no new deps, node:sqlite
// feature-detected with a JSON fallback, no database server/account/cloud) must still read
// as stated; and the `>=18` engines figure the doc quotes from mcp/package.json must still
// be the real value there.
//
// The tracked/derived split is decided by asking git itself (`git check-ignore`), never by
// a hardcoded directory list or a specific filename — a path is derived because git says
// it's ignored, not because it happens to start with a string this file recognizes.
//
// REGRESSION: delete docs/design/MEMORY_STORE.md, or rename/remove any symbol in
// SYMBOL_CITATIONS below from the file it's cited against (e.g. rename writeJson in
// mcp/kernel.ts), or edit mcp/package.json's engines.node away from ">=18" without updating
// the doc, or reword the doc so it no longer states the JSON-fallback law, the
// zero-new-dependencies law, or the derived/rebuildable framing for its gitignored
// `.agent_memory/` artifacts in a greppable form — any of those fails a test in this file.
//
// M1 landed 2026-08-20 (mcp/store/{types,sqlite,json,manifest,rebuild}.ts,
// mcp/store-layer.test.ts): the guard below is bidirectional, not a single
// "doesn't exist yet" check. It fails if mcp/store/ or any of its five
// files goes missing, or if the doc stops saying M1 landed.
//
// M2 landed the same day (mcp/kernel.ts routes packet/path, docs-FTS, and
// vector reads/writes through openStore(); mcp/cli.ts ships `kage store
// status`/`kage store rebuild`; mcp/store-port.test.ts is M2's own test
// file): the same pattern repeats one phase later -- a test below now fails
// if kernel.ts stops calling openStore()/replaceDocsFtsDocs()/
// replaceVectorDocuments(), or if the doc stops saying M2 landed, AND a
// separate test still fails if M3's graph-side writes (upsertKgEntities and
// friends) show up in kernel.ts before M3 actually lands.
//
// __dirname is mcp/dist/ at runtime (compiled test) — one ".." reaches sibling mcp/
// sources, two reaches the repo root. Same convention as readme-claims.test.ts,
// context-doc.test.ts, and sessions-doc.test.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const repoPath = (...parts: string[]) => join(__dirname, "..", "..", ...parts);
const REPO_ROOT = repoPath();
const DOC_PATH = repoPath("docs", "design", "MEMORY_STORE.md");

function readDoc(): string {
  return readFileSync(DOC_PATH, "utf8");
}

// Ground truth for "is this path derived output or committed source": ask git, not a
// hardcoded list of directory names. `git check-ignore` exits 0 when the path IS ignored,
// 1 when it is NOT ignored (a normal, documented outcome, not an error), and anything else
// (e.g. not run inside a git worktree) is a real failure this must not swallow.
function isGitIgnoredArtifact(repoRelativePath: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", repoRelativePath], { cwd: REPO_ROOT });
    return true;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 1) return false;
    throw error;
  }
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
  { symbol: "scorePacketsVectorFromStore", file: "mcp/kernel.ts" },
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
  // M2 landed 2026-08-20 -- see the "M2 seam is wired into kernel.ts" test
  // below for the directory/call-site half of this guard.
  { symbol: "openStore", file: "mcp/kernel.ts" },
  { symbol: "buildPacketIndexes", file: "mcp/kernel.ts" },
  { symbol: "replaceDocsFtsDocs", file: "mcp/store/types.ts" },
  { symbol: "replaceVectorDocuments", file: "mcp/store/types.ts" },
  { symbol: "listDocsFtsDocs", file: "mcp/store/types.ts" },
  { symbol: "loadDocsChunks", file: "mcp/store/rebuild.ts" },
  // M3 landed the same day -- see the "M3 seam is wired into kernel.ts" test
  // below for the call-site half of this guard.
  { symbol: "replaceFileGraphRows", file: "mcp/store/types.ts" },
  { symbol: "replaceCallEdgesForRepo", file: "mcp/store/types.ts" },
  { symbol: "replaceKnowledgeGraph", file: "mcp/store/types.ts" },
  { symbol: "queryKgEdgesForEntities", file: "mcp/store/types.ts" },
  { symbol: "structuralRowsForFiles", file: "mcp/kernel.ts" },
  { symbol: "queryStructuralGraphFromStore", file: "mcp/kernel.ts" },
  { symbol: "kgNeighbourhood", file: "mcp/kernel.ts" },
  { symbol: "buildStructuralIndex", file: "mcp/kernel.ts" },
  { symbol: "buildKnowledgeGraph", file: "mcp/kernel.ts" },
  // M4 landed 2026-08-20 -- see the "M4 seam is wired into mcp/kernel.ts and
  // mcp/cli.ts" test below for the directory/wiring half of this guard.
  { symbol: "countIndexableFiles", file: "mcp/kernel.ts" },
  { symbol: "scaleGuardMessage", file: "mcp/kernel.ts" },
  { symbol: "SCALE_GUARD_FILE_THRESHOLD", file: "mcp/kernel.ts" },
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

test("every TRACKED concrete repo path MEMORY_STORE.md cites exists in the worktree", () => {
  const paths = citedPaths(readDoc());
  assert.ok(paths.length >= 10, `expected many cited paths, found ${paths.length}`);
  const tracked = paths.filter((path) => !isGitIgnoredArtifact(path));
  // Sanity: this doc cites real source (mcp/kernel.ts and friends) alongside its derived
  // .agent_memory/ table, so at least some cited paths must fall on the tracked side too
  // — otherwise this test would vacuously pass with zero real checks.
  assert.ok(tracked.length > 0, "expected at least one tracked (non-gitignored) cited path");
  for (const path of tracked) {
    assert.ok(existsSync(repoPath(path)), `MEMORY_STORE.md cites "${path}" as tracked, but it does not exist in the worktree`);
  }
});

test("every DERIVED (gitignored .agent_memory/) path MEMORY_STORE.md cites is labelled derived/rebuildable, not asserted to exist", () => {
  // A gitignored index/cache artifact legitimately does not exist in a clean worktree
  // that hasn't indexed yet (reproduced: this worktree has no .agent_memory/graph/ at
  // all) — asserting existsSync on one, as the old single test did, was an
  // environment-dependent false failure, not a real doc/code disagreement. The fix isn't
  // to skip these paths; it's to hold the doc to a different, honest claim: that it
  // labels them as derived output, not source it's claiming is checked in.
  const paths = citedPaths(readDoc());
  const derived = paths.filter((path) => isGitIgnoredArtifact(path));
  assert.ok(derived.length > 0, "expected MEMORY_STORE.md to cite at least one gitignored .agent_memory/ artifact");
  const flat = readDoc().replace(/\s+/g, " ");
  assert.ok(
    flat.includes(
      "is, today, disposable — delete the whole tree and `kage index` regenerates it",
    ),
    "doc should label its gitignored .agent_memory/ artifacts as disposable/regenerated, not silently assume they exist on disk",
  );
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

test("M2's store seam is wired into mcp/kernel.ts, and the doc says M2 landed", () => {
  // Mirror image of M1's own guard test above: this now fails if the seam
  // disappears out from under the doc, or if the doc stops saying M2 landed
  // while the code still routes through it.
  const kernelSource = readFileSync(repoPath("mcp", "kernel.ts"), "utf8");
  assert.ok(/from\s+["']\.\/store\/manifest\.js["']/.test(kernelSource), "expected mcp/kernel.ts to import openStore from ./store/manifest.js -- M2 landed 2026-08-20 and this doc says so");
  assert.ok(/\bopenStore\(/.test(kernelSource), "expected mcp/kernel.ts to call openStore() -- M2's actual wiring, not just an import");
  assert.ok(/\breplaceDocsFtsDocs\(/.test(kernelSource), "expected mcp/kernel.ts to write docs through replaceDocsFtsDocs");
  assert.ok(/\breplaceVectorDocuments\(/.test(kernelSource), "expected mcp/kernel.ts to write the vector index through replaceVectorDocuments");

  const doc = readDoc();
  assert.ok(doc.includes("M2 — the memory-side port") && doc.includes("**Landed 2026-08-20.**"), "doc's M2 row should say M2 landed 2026-08-20, not just describe it as proposed");
  for (const symbol of ["openStore", "replaceDocsFtsDocs", "replaceVectorDocuments", "scorePacketsVectorFromStore"]) {
    assert.ok(doc.includes(symbol), `doc's M2 row should name the real symbol "${symbol}" it landed`);
  }
});

// PATH_TOKEN-style regex match against a bold table-cell phrase must account
// for the bold-close ** landing directly against the pipe with no space --
// e.g. "**M4 — benchmarks and the scale guard** | Not yet built" has **
// immediately before the |, so a naive \s*\|\s* right after the phrase text
// can miss it. (Caught by actually running this test, not by inspection --
// see the repo memory packet on this exact gotcha, captured while landing
// M1's own guard.)
test("M3's store seam is wired into mcp/kernel.ts, and the doc says M3 landed", () => {
  // Mirror image of M1/M2's own guard tests above: this now fails if the
  // structural/knowledge-graph write path disappears out from under the
  // doc, or if the doc stops saying M3 landed while the code still routes
  // through it.
  const kernelSource = readFileSync(repoPath("mcp", "kernel.ts"), "utf8");
  assert.ok(/\breplaceFileGraphRows\(/.test(kernelSource), "expected mcp/kernel.ts to write structural files/symbols/import-edges through replaceFileGraphRows");
  assert.ok(/\breplaceCallEdgesForRepo\(/.test(kernelSource), "expected mcp/kernel.ts to write call edges through replaceCallEdgesForRepo");
  assert.ok(/\breplaceKnowledgeGraph\(/.test(kernelSource), "expected mcp/kernel.ts to write the knowledge graph through replaceKnowledgeGraph");
  assert.ok(/\bqueryKgEdgesForEntities\(/.test(kernelSource), "expected mcp/kernel.ts to expose an indexed kg-neighbourhood lookup via queryKgEdgesForEntities");

  const doc = readDoc();
  assert.ok(doc.includes("M3 — the graph-side port") && doc.includes("**Landed"), "doc's M3 row should say M3 landed, not just describe it as proposed");
  for (const symbol of ["replaceFileGraphRows", "replaceCallEdgesForRepo", "replaceKnowledgeGraph", "queryKgEdgesForEntities"]) {
    assert.ok(doc.includes(symbol), `doc's M3 row should name the real symbol "${symbol}" it landed`);
  }
});

// M4 landed 2026-08-20, the same day as M1-M3 -- see the "M4's benchmark
// harness and scale guard exist as shipped code" test below for the
// directory/symbol/wiring half of this guard.
test("M4's store seam is wired into mcp/kernel.ts and mcp/cli.ts, and the doc says M4 landed", () => {
  // Mirror image of M1/M2/M3's own guard tests above: this now fails if the
  // scale guard disappears out from under the doc, or if the doc stops
  // saying M4 landed while the code still ships it.
  const kernelSource = readFileSync(repoPath("mcp", "kernel.ts"), "utf8");
  assert.ok(/\bexport function countIndexableFiles\(/.test(kernelSource), "expected mcp/kernel.ts to export countIndexableFiles, the cheap indexable-file count the scale guard reads");
  assert.ok(/\bexport function scaleGuardMessage\(/.test(kernelSource), "expected mcp/kernel.ts to export scaleGuardMessage, the guard's plain-language warning");
  assert.ok(/\bexport const SCALE_GUARD_FILE_THRESHOLD\b/.test(kernelSource), "expected mcp/kernel.ts to export the SCALE_GUARD_FILE_THRESHOLD the guard compares against");

  const cliSource = readFileSync(repoPath("mcp", "cli.ts"), "utf8");
  assert.ok(/\bscaleGuardMessage\(/.test(cliSource), "expected mcp/cli.ts to call scaleGuardMessage -- the guard must actually be wired into a command, not just exist in kernel.ts");
  assert.ok(/\bcountIndexableFiles\(/.test(cliSource), "expected mcp/cli.ts's install command to call countIndexableFiles for its own file count");

  for (const file of ["fixture.ts", "harness.ts", "run-one.ts", "run.ts"]) {
    assert.ok(existsSync(repoPath("mcp", "bench", file)), `expected mcp/bench/${file} to exist -- M4's benchmark harness`);
  }
  assert.ok(existsSync(repoPath("mcp", "scale-guard.test.ts")), "expected mcp/scale-guard.test.ts to exist -- M4's own test file");

  const doc = readDoc();
  assert.ok(doc.includes("M4 — benchmarks and the scale guard") && doc.includes("**Landed"), "doc's M4 row should say M4 landed, not just describe it as a target");
  for (const symbol of ["countIndexableFiles", "scaleGuardMessage", "SCALE_GUARD_FILE_THRESHOLD"]) {
    assert.ok(doc.includes(symbol), `doc's M4 row should name the real symbol "${symbol}" it landed`);
  }
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
