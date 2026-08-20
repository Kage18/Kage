// Tests for M3 of the memory store (docs/design/MEMORY_STORE.md): kernel.ts's
// structural code graph (files/symbols/import edges/call edges) and knowledge
// graph (entities/edges/episodes) now go through the StoreBackend seam M1
// built and M2 wired the memory side of. This file is new behaviour (repo
// rule: mcp/delegation.test.ts is off-limits, new behaviour gets its own
// file) and does not touch mcp/store-layer.test.ts or mcp/store-port.test.ts.
//
// REVERT CHECK: every test below fails if M3's kernel.ts wiring is reverted
// (buildStructuralIndex/buildCodeGraph/buildKnowledgeGraph stop calling
// replaceFileGraphRows/replaceCallEdgesForRepo/replaceKnowledgeGraph) --
// counts.files/symbols/import_edges/call_edges/kg_entities/kg_edges/
// kg_episodes would all read back 0 after a plain indexProject() call
// (nothing pushes them there before M3), and queryStructuralGraphFromStore/
// kgNeighbourhood would have nothing to answer from.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildCodeGraph, buildKnowledgeGraph, buildStructuralIndex, indexProject, kgNeighbourhood, queryStructuralGraphFromStore, structuralRowsForFiles } from "./kernel.js";
import type { KgNeighbourhoodResult } from "./kernel.js";
import { openStore, readManifest, writeManifest } from "./store/manifest.js";
import { rebuildStore } from "./store/rebuild.js";
import { detect as detectSqlite, SqliteStoreBackend } from "./store/sqlite.js";
import { JsonStoreBackend } from "./store/json.js";
import type { BackendKind } from "./store/types.js";

// Hermetic personal store, same guard mcp/kernel.test.ts and
// mcp/store-port.test.ts use -- recall/indexProject read $KAGE_HOME/memory,
// so tests must never touch the developer's real ~/.kage.
if (!process.env.KAGE_HOME) process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-store-graph-test-home-"));

const SQLITE_AVAILABLE = detectSqlite().available;

function tempProject(prefix = "kage-store-graph"): string {
  const dir = mkdtempSync(join(tmpdir(), `${prefix}-`));
  mkdirSync(join(dir, ".agent_memory", "packets"), { recursive: true });
  return dir;
}

function writePacket(dir: string, slug: string, opts: { title: string; paths: string[]; body: string }): void {
  const frontmatter = [
    "---",
    `id: repo:fixture:decision:${slug}`,
    "type: decision",
    "status: approved",
    `title: ${JSON.stringify(opts.title)}`,
    `paths: ${JSON.stringify(opts.paths)}`,
    `tags: []`,
    `updated_at: "2026-08-20T00:00:00.000Z"`,
    "---",
  ].join("\n");
  writeFileSync(join(dir, ".agent_memory", "packets", `${slug}.md`), `${frontmatter}\n${opts.body}\n`, "utf8");
}

function forceBackend(dir: string, kind: BackendKind): void {
  const manifest = readManifest(dir);
  writeManifest(dir, { ...(manifest ?? { schema_version: 1, active_backend: kind, forced_backend: null, counts: {}, last_rebuild_at: null }), forced_backend: kind });
}

// A fixture with a real cross-file call (foo in a.ts calls bar in b.ts) so
// structural files/symbols/import edges AND code-graph call edges are all
// non-empty -- every table M3 routes through the store gets real rows.
function seedFixture(dir: string): void {
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "b.ts"), "export function bar(): number {\n  return 41;\n}\n", "utf8");
  writeFileSync(join(dir, "src", "a.ts"), "import { bar } from \"./b\";\n\nexport function foo(): number {\n  return bar() + 1;\n}\n", "utf8");
  writePacket(dir, "foo-calls-bar", {
    title: "foo() calls bar() to compute its result",
    paths: ["src/a.ts", "src/b.ts"],
    body: "foo() in src/a.ts calls bar() in src/b.ts and adds 1 to its result.",
  });
}

// --- write-through: buildStructuralIndex/buildCodeGraph/buildKnowledgeGraph populate the store ---

test("indexProject routes structural files/symbols/import-edges/call-edges and the knowledge graph through the StoreBackend seam", () => {
  const project = tempProject();
  seedFixture(project);
  indexProject(project);

  const { backend } = openStore(project);
  const counts = backend.counts();
  backend.close();

  // REGRESSION (see file header): if buildStructuralIndex/buildCodeGraph/
  // buildKnowledgeGraph go back to writeJson-only (the pre-M3 shape), every
  // count below reads back 0 even though indexProject() succeeds.
  assert.ok(counts.files >= 2, "structural files should be routed through replaceFileGraphRows");
  assert.ok(counts.symbols >= 2, "structural symbols should be routed through replaceFileGraphRows");
  assert.ok(counts.import_edges >= 1, "import edges should be routed through replaceFileGraphRows");
  assert.ok(counts.call_edges >= 1, "call edges (foo -> bar) should be routed through replaceCallEdgesForRepo");
  assert.ok(counts.kg_entities >= 1, "knowledge-graph entities should be routed through replaceKnowledgeGraph");
  assert.ok(counts.kg_edges >= 1, "knowledge-graph edges should be routed through replaceKnowledgeGraph");
});

// --- kage store status shows the graph counts and they match a rebuild ---

test("kage store status's counts include the graph tables and match a fresh rebuild", () => {
  const project = tempProject();
  seedFixture(project);
  indexProject(project);

  const { backend: live } = openStore(project);
  const liveCounts = live.counts();
  live.close();

  const rebuilt = rebuildStore(project, { forceBackend: "json" });
  for (const table of ["files", "symbols", "import_edges", "call_edges", "kg_entities", "kg_edges", "kg_episodes"]) {
    assert.ok(table in liveCounts, `expected "${table}" to appear in store status counts`);
    assert.equal(liveCounts[table], rebuilt.counts[table], `"${table}" from a plain refresh should match what a full rebuild produces from the same on-disk artifacts`);
  }
});

// --- json backend byte-compatibility: the row-level push still produces files today's raw readers accept ---

test("JSON backend byte-compatibility: the row-level push still produces structural/graph JSON today's raw readers accept", () => {
  const project = tempProject();
  seedFixture(project);
  forceBackend(project, "json");
  indexProject(project);

  const filesPath = join(project, ".agent_memory", "structural", "files.json");
  const symbolsPath = join(project, ".agent_memory", "structural", "symbols.json");
  const entitiesPath = join(project, ".agent_memory", "graph", "entities.json");
  const edgesPath = join(project, ".agent_memory", "graph", "edges.json");

  // Round-trip through the OLD read path: a plain JSON.parse over the file,
  // exactly what mcp/kernel.ts's readCurrentStructuralIndex/
  // hydrateKnowledgeGraphArtifact did before M3 and what any other consumer
  // (the portal, a script) still does today.
  const files = JSON.parse(readFileSync(filesPath, "utf8")) as Array<{ path: string; hash: string; size_bytes: number; top_symbols: string[] }>;
  assert.ok(files.some((file) => file.path === "src/a.ts"));
  for (const file of files) {
    // Fields the reduced StoreBackend FileRow does NOT carry -- proof the
    // direct writeJson path (not a reduced-row reconstruction) still wrote
    // this file, full fidelity intact.
    assert.equal(typeof file.size_bytes, "number");
    assert.ok(Array.isArray(file.top_symbols));
  }

  // REGRESSION (real bug this run found and fixed, mcp/store/json.ts):
  // replaceFileGraphRows on the JSON backend once reconstructed symbols from
  // the reduced SymbolRow shape (no `export` field), silently flipping every
  // symbol's `export` to false on disk -- caught by kageCleanupCandidates no
  // longer detecting ANY unused export in mcp/kernel.test.ts. A weaker check
  // (typeof symbol.signature === "string") would NOT have caught this, since
  // the corrupted field still typechecked -- assert the actual VALUE.
  const symbols = JSON.parse(readFileSync(symbolsPath, "utf8")) as Array<{ name: string; signature: string; export: boolean }>;
  const foo = symbols.find((symbol) => symbol.name === "foo");
  assert.ok(foo, "expected foo() to survive the row-level push");
  assert.equal(foo?.export, true, "foo() is `export function foo()` -- export must still read true after the store push, not silently reset to false");
  assert.ok(symbols.every((symbol) => typeof symbol.signature === "string" && symbol.signature.length > 0));

  // REGRESSION, same class: replaceKnowledgeGraph once reconstructed
  // entities/edges from the reduced KgEntityRow/KgEdgeRow shape, blowing
  // away aliases/fact/evidence content (not just their types).
  const entities = JSON.parse(readFileSync(entitiesPath, "utf8")) as Array<{ id: string; aliases: string[]; name?: string; label?: string }>;
  assert.ok(entities.length > 0);
  // indexProject() also auto-captures a repo-overview memory entity -- find
  // the one for THIS test's own hand-authored packet specifically, by its title.
  const memoryEntity = entities.find((entity) => (entity.name ?? entity.label) === "foo() calls bar() to compute its result");
  assert.ok(memoryEntity, "expected the hand-authored packet's own memory entity to survive the row-level push");
  assert.ok(memoryEntity!.aliases.length > 0, "the memory entity's alias must survive -- KgEntityRow does not carry aliases at all, so a lossy reconstruction would leave this empty");

  const edges = JSON.parse(readFileSync(edgesPath, "utf8")) as Array<{ fact: string; evidence: string[] }>;
  assert.ok(edges.length > 0);
  assert.ok(edges.some((edge) => edge.fact.length > 0), "at least one edge must carry its real `fact` text, not the empty-string default a reduced-row reconstruction would leave");
  assert.ok(edges.some((edge) => edge.evidence.length > 0), "at least one edge must carry real evidence, not the empty-array default a reduced-row reconstruction would leave");

  // The real reader (unchanged by M3) still works against what's on disk.
  const rebuilt = buildStructuralIndex(project);
  assert.ok(rebuilt.files.some((file) => file.path === "src/a.ts"));
});

// --- sqlite backend round-trips all five graph entity kinds and survives reopen ---

test("sqlite backend round-trips files, symbols, import edges, call edges, and all three kg tables, and survives close()+reopen", { skip: !SQLITE_AVAILABLE && "node:sqlite is not available on this Node" }, () => {
  const project = tempProject();
  seedFixture(project);
  indexProject(project);

  const jsonResult = rebuildStore(project, { forceBackend: "json" });
  const sqliteResult = rebuildStore(project, { forceBackend: "sqlite" });
  assert.equal(sqliteResult.backend, "sqlite");
  assert.deepEqual(sqliteResult.counts, jsonResult.counts, "sqlite should regenerate the same row counts as json from the same source artifacts");

  const first = new SqliteStoreBackend();
  first.open(project);
  const filesBefore = first.listFiles().map((file) => file.path).sort();
  const symbolsBefore = first.listSymbols().map((symbol) => symbol.id).sort();
  const importsBefore = first.listImportEdges();
  const callsBefore = first.listCallEdges();
  const entitiesBefore = first.listKgEntities().map((entity) => entity.id).sort();
  const edgesBefore = first.getKgEdges(entitiesBefore[0]);
  const episodesBefore = first.listKgEpisodes().map((episode) => episode.id).sort();
  first.close();

  assert.ok(filesBefore.includes("src/a.ts") && filesBefore.includes("src/b.ts"));
  assert.ok(symbolsBefore.length >= 2);
  assert.ok(importsBefore.length >= 1);
  assert.ok(callsBefore.length >= 1);
  assert.ok(entitiesBefore.length >= 1);
  assert.ok(episodesBefore.length >= 1);

  // Reopen a FRESH backend instance against the same on-disk file -- proves
  // the round trip survives close()+reopen, not just a live connection.
  const second = new SqliteStoreBackend();
  second.open(project);
  assert.deepEqual(second.listFiles().map((file) => file.path).sort(), filesBefore);
  assert.deepEqual(second.listSymbols().map((symbol) => symbol.id).sort(), symbolsBefore);
  assert.deepEqual(second.listImportEdges(), importsBefore);
  assert.deepEqual(second.listCallEdges(), callsBefore);
  assert.deepEqual(second.listKgEntities().map((entity) => entity.id).sort(), entitiesBefore);
  assert.deepEqual(second.getKgEdges(entitiesBefore[0]), edgesBefore);
  assert.deepEqual(second.listKgEpisodes().map((episode) => episode.id).sort(), episodesBefore);
  second.close();
});

// --- row-level refresh: a refresh with N cache-miss files upserts only those files' rows ---

test("row-level refresh: structuralRowsForFiles (the exact seam buildStructuralIndex pushes through) returns rows scoped to only the cache-miss files, not the whole repo", () => {
  const project = tempProject();
  seedFixture(project);

  // Cold build: every file is a cache miss (the per-file content cache starts
  // empty), so a refresh right now legitimately touches both files.
  const cold = buildStructuralIndex(project);
  assert.equal(cold.manifest.cache.misses, 2, "expected both fixture files to miss on the first, cold build");

  // Warm build with nothing changed: the per-file content cache (untouched
  // by M3 -- see the claim) makes every file a cache hit.
  const warm = buildStructuralIndex(project);
  assert.equal(warm.manifest.cache.misses, 0, "expected zero cache misses on an unchanged rebuild");

  // Touch exactly one file's content, then rebuild: exactly one cache miss.
  writeFileSync(join(project, "src", "b.ts"), "export function bar(): number {\n  return 42; // changed\n}\n", "utf8");
  const touched = buildStructuralIndex(project);
  assert.equal(touched.manifest.cache.misses, 1, "expected exactly one cache miss after touching exactly one file");
  assert.equal(touched.manifest.cache.hits, 1, "the other file should still be a cache hit");

  // This is the exact store-level seam buildStructuralIndex calls
  // (mcp/kernel.ts) to decide what to push through replaceFileGraphRows --
  // a pure, store-free projection, so it can be asserted on directly without
  // timing anything.
  const touchedPaths = new Set(["src/b.ts"]);
  const rows = structuralRowsForFiles(touched, touchedPaths);
  assert.equal(rows.length, 1, "expected rows for exactly the one cache-miss file, not the whole repo");
  assert.equal(rows[0].file.path, "src/b.ts");
  assert.ok(rows[0].symbols.every((symbol) => symbol.file === "src/b.ts"), "no other file's symbols should leak into the scoped push");
  assert.ok(rows[0].importEdges.every((edge) => edge.fromFile === "src/b.ts"));

  // The untouched file must NOT appear in the scoped rows at all.
  const untouchedRows = structuralRowsForFiles(touched, new Set(["src/a.ts"]));
  assert.equal(untouchedRows.length, 1);
  assert.equal(untouchedRows[0].file.path, "src/a.ts");
  assert.notEqual(
    JSON.stringify(structuralRowsForFiles(touched, touchedPaths)),
    JSON.stringify(untouchedRows),
    "scoping to a different file path must return different rows",
  );
});

// --- rebuild idempotence extends to the graph tables ---

test("REVERT CHECK: kage store rebuild is idempotent for the graph tables too -- a second run changes no counts", () => {
  const project = tempProject();
  seedFixture(project);
  indexProject(project);

  const first = rebuildStore(project, { forceBackend: "json" });
  const second = rebuildStore(project, { forceBackend: "json" });
  assert.deepEqual(second.counts, first.counts, "a rebuild with nothing changed on disk must reproduce the same graph-table counts, not drift or duplicate rows");

  for (const table of ["files", "symbols", "import_edges", "call_edges", "kg_entities", "kg_edges", "kg_episodes"]) {
    assert.ok(first.counts[table] >= 0 && Number.isFinite(first.counts[table]));
  }
});

// --- lazy walks: store-native code-graph and kg-neighbourhood queries ---

test("GOLDEN: queryStructuralGraphFromStore and kgNeighbourhood return identical results across both backends", { skip: !SQLITE_AVAILABLE && "node:sqlite is not available on this Node" }, () => {
  // buildCodeGraph()/buildKnowledgeGraph() directly, NOT indexProject(): the
  // latter also auto-captures a repo-overview/repo-structure packet whose id
  // and content embed the project directory's own (necessarily unique)
  // tempdir name (mcp/kernel.ts's createRepoOverviewPacket/
  // createRepoStructurePacket, called from indexProjectDetailed only) --
  // real content, but not comparable across two physically distinct temp
  // dirs seeded with the same fixture. Calling the graph builders directly
  // still exercises the exact M3 write path (both call openStore()
  // internally), just without that unrelated auto-capture noise.
  const projectJson = tempProject("kage-store-graph-golden-json");
  seedFixture(projectJson);
  forceBackend(projectJson, "json");
  buildKnowledgeGraph(projectJson, buildCodeGraph(projectJson));

  const projectSqlite = tempProject("kage-store-graph-golden-sqlite");
  seedFixture(projectSqlite);
  // Force BEFORE building (not after): buildStructuralIndex/buildCodeGraph/
  // buildKnowledgeGraph call openStore() at write time, so forcing first
  // simulates a project that already migrated to sqlite and is now running
  // a normal refresh -- the write path this test actually means to exercise,
  // not a separate rebuild-from-JSON pass.
  forceBackend(projectSqlite, "sqlite");
  buildKnowledgeGraph(projectSqlite, buildCodeGraph(projectSqlite));

  const jsonStructural = queryStructuralGraphFromStore(projectJson, "foo bar", 10);
  const sqliteStructural = queryStructuralGraphFromStore(projectSqlite, "foo bar", 10);
  assert.deepEqual(sqliteStructural, jsonStructural, "identical files/symbols for the same query against the same fixture, regardless of backend");
  assert.ok(jsonStructural.symbols.some((symbol) => symbol.name === "foo"));
  assert.ok(jsonStructural.symbols.some((symbol) => symbol.name === "bar"));

  // mtime is real filesystem metadata -- the two fixture copies are distinct
  // directories seeded moments apart, so their mtimes legitimately differ.
  // That is a fact about the two temp dirs, not a backend-routing signal, so
  // it is stripped before comparing (same reasoning as excluding a real
  // usage-tracking side effect in mcp/store-port.test.ts's own golden test).
  const withoutMtime = (result: ReturnType<typeof queryStructuralGraphFromStore>) => ({
    ...result,
    files: result.files.map(({ mtime: _mtime, ...rest }) => rest),
  });
  const jsonStructuralByPath = queryStructuralGraphFromStore(projectJson, "src a b", 10);
  const sqliteStructuralByPath = queryStructuralGraphFromStore(projectSqlite, "src a b", 10);
  assert.deepEqual(withoutMtime(sqliteStructuralByPath), withoutMtime(jsonStructuralByPath), "identical file matches for a path-shaped query too, regardless of backend");
  assert.ok(jsonStructuralByPath.files.length >= 2, "expected both fixture files to match a query over their own path terms");

  const { backend: jsonBackend } = openStore(projectJson);
  const jsonEntityIds = new Set(jsonBackend.listKgEntities().map((entity) => entity.id));
  jsonBackend.close();
  const { backend: sqliteBackend } = openStore(projectSqlite);
  const sqliteEntityIds = new Set(sqliteBackend.listKgEntities().map((entity) => entity.id));
  sqliteBackend.close();

  // Every "repo"-kind entity is `graphEntityId("repo", repoKey(projectDir))`
  // (mcp/kernel.ts) -- necessarily unique per tempdir, since repoKey falls
  // back to the directory's own basename with no git remote configured
  // here. EVERY memory-kind entity has a `contains_memory` edge FROM that
  // repo entity, so any entity's neighbourhood touches it -- not a backend-
  // routing signal, so repo-kind entities/edges are stripped before
  // comparing, the same way mtime was stripped above for structural files.
  const stripRepoEntity = (neighbourhood: KgNeighbourhoodResult): KgNeighbourhoodResult => ({
    entity: neighbourhood.entity,
    neighbours: neighbourhood.neighbours.filter((entity) => entity.kind !== "repo"),
    edges: neighbourhood.edges.filter((edge) => edge.kind !== "contains_memory"),
  });
  const candidateEntityIds = [...jsonEntityIds].filter((id) => sqliteEntityIds.has(id) && !id.startsWith("repo:")).sort();
  assert.ok(candidateEntityIds.length > 0, "expected at least one non-repo knowledge-graph entity id shared by both fixture copies");

  for (const entityId of candidateEntityIds) {
    const jsonNeighbourhood = stripRepoEntity(kgNeighbourhood(projectJson, entityId));
    const sqliteNeighbourhood = stripRepoEntity(kgNeighbourhood(projectSqlite, entityId));
    assert.deepEqual(sqliteNeighbourhood, jsonNeighbourhood, `kgNeighbourhood("${entityId}") should be identical across backends once repo-entity noise is stripped`);
  }
});

// --- lazy walks: the sqlite path answers from indexed rows, not a whole-table load ---

test("queryKgEdgesForEntities is a bulk indexed lookup, not a full-table scan wrapper -- it returns exactly the edges touching the requested entities", { skip: !SQLITE_AVAILABLE && "node:sqlite is not available on this Node" }, () => {
  const project = tempProject();
  seedFixture(project);
  indexProject(project);
  rebuildStore(project, { forceBackend: "sqlite" });

  const backend = new SqliteStoreBackend();
  backend.open(project);
  const allEntities = backend.listKgEntities().map((entity) => entity.id);
  assert.ok(allEntities.length > 0);

  // Bulk call over every entity id must equal the union of per-entity
  // getKgEdges calls -- proves the indexed IN(...) query and the per-entity
  // WHERE query agree, not just that both return SOMETHING.
  const bulk = backend.queryKgEdgesForEntities(allEntities);
  const unionOfPerEntity = new Map<string, { fromId: string; toId: string; kind: string; weight: number }>();
  for (const id of allEntities) {
    for (const edge of backend.getKgEdges(id)) unionOfPerEntity.set(`${edge.fromId}\0${edge.toId}\0${edge.kind}`, edge);
  }
  const bulkKeys = bulk.map((edge) => `${edge.fromId}\0${edge.toId}\0${edge.kind}`).sort();
  const unionKeys = [...unionOfPerEntity.keys()].sort();
  assert.deepEqual(bulkKeys, unionKeys, "bulk queryKgEdgesForEntities should return exactly the union of per-entity getKgEdges results");

  // An id nothing links to returns nothing -- not the whole table.
  const empty = backend.queryKgEdgesForEntities(["entity:does-not-exist"]);
  assert.deepEqual(empty, []);
  backend.close();
});
