// Tests for M1 of the memory store (docs/design/MEMORY_STORE.md): the
// StoreBackend seam under mcp/store/. Nothing here touches mcp/kernel.ts
// or any existing call site -- these tests exercise mcp/store/*.ts only,
// against throwaway project directories under the OS tmpdir.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { MemoryPacket } from "./kernel.js";
import { packetToOkfConcept } from "./okf.js";
import { manifestPath, openStore, readManifest, writeManifest } from "./store/manifest.js";
import { rebuildStore } from "./store/rebuild.js";
import { detect, SqliteStoreBackend, sqliteStorePath } from "./store/sqlite.js";
import { JsonStoreBackend } from "./store/json.js";
import type { RequireFn } from "./store/sqlite.js";
import type { StoreBackend } from "./store/types.js";

function tmpProject(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `kage-store-${prefix}-`));
}

// A require() stand-in that always reports node:sqlite as absent, the
// same shape a pre-22.5 Node's real `require("node:sqlite")` throw takes.
const requireWithoutSqlite: RequireFn = (id: string) => {
  if (id === "node:sqlite") throw new Error("Cannot find module 'node:sqlite' (simulated absence)");
  return require(id);
};

// --- detect() ----------------------------------------------------------------

test("detect() reports node:sqlite available on this machine", () => {
  const result = detect();
  assert.equal(result.available, true, result.reason);
});

test("detect() reports unavailable when the require seam is forced to throw -- the fallback path is exercised, not assumed", () => {
  const result = detect(requireWithoutSqlite);
  assert.equal(result.available, false);
  assert.match(result.reason, /not available/i);
});

test("REVERT CHECK: openStore() picks JsonStoreBackend when detect() reports unavailable, and the manifest records it", () => {
  const dir = tmpProject("detect-fallback");
  const { backend, manifest } = openStore(dir, { requireFn: requireWithoutSqlite });
  assert.equal(backend.kind, "json");
  assert.equal(manifest.active_backend, "json");
  backend.close();
});

// --- sqlite backend round-trip ------------------------------------------------

test("sqlite backend round-trips every entity type and survives close/reopen", () => {
  const dir = tmpProject("sqlite-roundtrip");
  const first = new SqliteStoreBackend();
  first.open(dir);

  first.upsertFiles([{ path: "src/a.ts", sha: "sha-a", mtime: 1000, kind: "source", language: "typescript" }]);
  first.upsertSymbols([{ id: "sym:a", file: "src/a.ts", name: "doThing", kind: "function", sha: "sha-sym" }]);
  first.upsertImportEdges([{ fromFile: "src/a.ts", toFile: "src/b.ts", kind: "import" }]);
  first.upsertCallEdges([{ fromSymbol: "sym:a", toSymbol: "sym:b", kind: "call" }]);
  first.upsertPackets([{ id: "packet:1", type: "decision", status: "approved", score: 0.8, updatedAt: "2026-08-20T00:00:00.000Z" }]);
  first.upsertPacketPaths([{ packetId: "packet:1", path: "src/a.ts", sha256: "sha-path" }]);
  first.upsertPacketSymbols([{ packetId: "packet:1", symbol: "doThing", sha256: "sha-symbol" }]);
  first.upsertDocsFtsDoc({ id: "README.md#intro", docPath: "README.md", heading: "Intro", body: "Kage manages your memory and agents." });
  first.upsertVectorChunks("packet:1", [{ packetId: "packet:1", term: "memory", weight: 0.5 }]);
  first.upsertKgEntities([{ id: "entity:kage", kind: "project", label: "Kage" }]);
  first.upsertKgEdges([{ fromId: "entity:kage", toId: "entity:kage-store", kind: "has_component", weight: 0.9 }]);
  first.upsertKgEpisodes([{ id: "episode:1", ts: "2026-08-20T00:00:00.000Z", summary: "Store layer built." }]);
  first.close();

  const reopened = new SqliteStoreBackend();
  reopened.open(dir);

  assert.deepEqual(reopened.getFile("src/a.ts"), { path: "src/a.ts", sha: "sha-a", mtime: 1000, kind: "source", language: "typescript" });
  assert.equal(reopened.listSymbolsForFile("src/a.ts").length, 1);
  assert.equal(reopened.listSymbolsForFile("src/a.ts")[0].name, "doThing");
  assert.equal(reopened.listImportEdges().length, 1);
  assert.equal(reopened.listCallEdges().length, 1);
  assert.deepEqual(reopened.getPacket("packet:1"), { id: "packet:1", type: "decision", status: "approved", score: 0.8, updatedAt: "2026-08-20T00:00:00.000Z" });
  assert.deepEqual(reopened.queryPacketsByPath("src/a.ts"), ["packet:1"]);
  const docsHit = reopened.queryDocsFts("memory");
  assert.equal(docsHit.length, 1);
  assert.equal(docsHit[0].docPath, "README.md");
  const vectorHit = reopened.queryVectorCandidates(["memory"]);
  assert.equal(vectorHit.length, 1);
  assert.equal(vectorHit[0].packetId, "packet:1");
  assert.deepEqual(reopened.getKgEntity("entity:kage"), { id: "entity:kage", kind: "project", label: "Kage" });
  assert.equal(reopened.getKgEdges("entity:kage").length, 1);
  assert.equal(reopened.listKgEpisodes().length, 1);

  reopened.close();
});

test("REVERT CHECK: sqlite migrate() is forward-only, and re-running it once current is a no-op", () => {
  const dir = tmpProject("sqlite-migrate");
  const backend = new SqliteStoreBackend();
  backend.open(dir); // open() already calls migrate() once
  const first = backend.migrate();
  assert.equal(first.applied, false, "migrate() must be a no-op once the schema is already current");
  assert.equal(first.fromVersion, first.toVersion);
  backend.close();
});

test("sqlite FTS query returns the doc a term appears in and not one it does not", () => {
  const dir = tmpProject("sqlite-fts");
  const backend = new SqliteStoreBackend();
  backend.open(dir);
  backend.upsertDocsFtsDoc({ id: "a.md#1", docPath: "a.md", heading: "Alpha", body: "This document is about widgets." });
  backend.upsertDocsFtsDoc({ id: "b.md#1", docPath: "b.md", heading: "Beta", body: "This document is about gadgets." });

  const widgetHits = backend.queryDocsFts("widgets");
  assert.equal(widgetHits.length, 1);
  assert.equal(widgetHits[0].docPath, "a.md");

  const gadgetHits = backend.queryDocsFts("gadgets");
  assert.equal(gadgetHits.length, 1);
  assert.equal(gadgetHits[0].docPath, "b.md");

  backend.close();
});

test("sqlite scoped variants restrict to the subtree path prefix", () => {
  const dir = tmpProject("sqlite-scope");
  const backend = new SqliteStoreBackend();
  backend.open(dir);
  backend.upsertFiles([
    { path: "packages/api/a.ts", sha: "1", mtime: 0, kind: "source", language: "typescript" },
    { path: "packages/web/b.ts", sha: "2", mtime: 0, kind: "source", language: "typescript" },
  ]);
  backend.upsertPackets([
    { id: "packet:api", type: "decision", status: "approved", score: 0.5, updatedAt: "2026-08-20T00:00:00.000Z" },
    { id: "packet:web", type: "decision", status: "approved", score: 0.5, updatedAt: "2026-08-20T00:00:00.000Z" },
  ]);
  backend.upsertPacketPaths([
    { packetId: "packet:api", path: "packages/api/a.ts", sha256: null },
    { packetId: "packet:web", path: "packages/web/b.ts", sha256: null },
  ]);

  const scopedFiles = backend.listFiles("packages/api");
  assert.equal(scopedFiles.length, 1);
  assert.equal(scopedFiles[0].path, "packages/api/a.ts");

  const scopedPackets = backend.listPackets("packages/api");
  assert.equal(scopedPackets.length, 1);
  assert.equal(scopedPackets[0].id, "packet:api");

  backend.close();
});

test("REVERT CHECK: sqlite scoped queryVectorCandidates does not fan out a vector row once per matching path on a multi-path packet", () => {
  const dir = tmpProject("sqlite-vector-fanout");
  const backend = new SqliteStoreBackend();
  backend.open(dir);
  backend.upsertPackets([{ id: "packet:multi", type: "decision", status: "approved", score: 0.5, updatedAt: "2026-08-20T00:00:00.000Z" }]);
  // Two paths for the same packet, both under the "packages/api" scope --
  // a naive JOIN against packet_paths fans a single vectors row out once
  // per matching path instead of once per (packetId, term).
  backend.upsertPacketPaths([
    { packetId: "packet:multi", path: "packages/api/a.ts", sha256: null },
    { packetId: "packet:multi", path: "packages/api/b.ts", sha256: null },
  ]);
  backend.upsertVectorChunks("packet:multi", [{ packetId: "packet:multi", term: "memory", weight: 0.5 }]);

  const candidates = backend.queryVectorCandidates(["memory"], "packages/api");
  assert.equal(candidates.length, 1, `expected exactly one candidate row, got ${candidates.length}`);

  backend.close();
});

test("REVERT CHECK: sqlite upsertPacketPaths/upsertPacketSymbols are keyed upserts, not append-only -- calling twice with the same key does not duplicate the row", () => {
  const dir = tmpProject("sqlite-packet-paths-upsert");
  const backend = new SqliteStoreBackend();
  backend.open(dir);
  backend.upsertPacketPaths([{ packetId: "packet:1", path: "a.ts", sha256: "old" }]);
  backend.upsertPacketPaths([{ packetId: "packet:1", path: "a.ts", sha256: "new" }]);
  assert.deepEqual(backend.queryPacketsByPath("a.ts"), ["packet:1"]);
  assert.equal(backend.counts().packet_paths, 1, "re-upserting the same (packetId, path) must update in place, not append a second row");

  backend.upsertPacketSymbols([{ packetId: "packet:1", symbol: "doThing", sha256: "old" }]);
  backend.upsertPacketSymbols([{ packetId: "packet:1", symbol: "doThing", sha256: "new" }]);
  assert.equal(backend.counts().packet_symbols, 1, "re-upserting the same (packetId, symbol) must update in place, not append a second row");

  backend.close();
});

// --- json backend --------------------------------------------------------------

test("json backend serves the same read answers as today's files for a small fixture", () => {
  const dir = tmpProject("json-parity");
  mkdirSync(join(dir, ".agent_memory", "structural"), { recursive: true });
  mkdirSync(join(dir, ".agent_memory", "indexes"), { recursive: true });
  mkdirSync(join(dir, ".agent_memory", "graph"), { recursive: true });

  // Written in exactly the shape mcp/kernel.ts's own artifact writers use
  // today (buildStructuralIndex at kernel.ts:6648, buildPacketIndexes at
  // kernel.ts:9118, updateKnowledgeGraph around kernel.ts:8839).
  writeFileSync(
    join(dir, ".agent_memory", "structural", "files.json"),
    `${JSON.stringify(
      [
        {
          schema_version: 1,
          path: "mcp/store/types.ts",
          language: "typescript",
          kind: "source",
          size_bytes: 1234,
          line_count: 40,
          hash: "deadbeef",
          mtime_ms: 1755600000000,
          extraction: "structural",
          confidence: "EXTRACTED",
          top_symbols: ["StoreBackend"],
          imports_preview: [],
          signals: [],
          concepts: [],
        },
      ],
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(
    join(dir, ".agent_memory", "indexes", "catalog.json"),
    `${JSON.stringify(
      {
        schema_version: 2,
        generated_from_updated_at: "2026-08-20T00:00:00.000Z",
        repo_state: { branch: "main", head: "abc123", merge_base: null },
        packet_count: 1,
        packets: [
          {
            id: "repo:kage:decision:build-the-store-1",
            title: "Build the store",
            summary: "M1 of the memory store.",
            type: "decision",
            status: "approved",
            tags: ["store"],
            paths: ["mcp/store/types.ts"],
            updated_at: "2026-08-20T00:00:00.000Z",
            source_refs: [],
          },
        ],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const backend = new JsonStoreBackend();
  backend.open(dir);

  const file = backend.getFile("mcp/store/types.ts");
  assert.ok(file);
  assert.equal(file?.sha, "deadbeef");
  assert.equal(file?.mtime, 1755600000000);
  assert.equal(file?.language, "typescript");

  const packet = backend.getPacket("repo:kage:decision:build-the-store-1");
  assert.ok(packet);
  assert.equal(packet?.type, "decision");
  assert.equal(packet?.status, "approved");

  backend.close();
});

test("REVERT CHECK: json backend's scoped listFiles restricts to the subtree path prefix, matching sqlite", () => {
  const dir = tmpProject("json-scope");
  const backend = new JsonStoreBackend();
  backend.open(dir);
  backend.upsertFiles([
    { path: "packages/api/a.ts", sha: "1", mtime: 0, kind: "source", language: "typescript" },
    { path: "packages/web/b.ts", sha: "2", mtime: 0, kind: "source", language: "typescript" },
  ]);
  assert.equal(backend.listFiles("packages/api").length, 1);
  assert.equal(backend.listFiles("packages/api")[0].path, "packages/api/a.ts");
  assert.equal(backend.listFiles().length, 2);
  backend.close();
});

test("json backend upserts preserve current whole-file rewrite behaviour: the file exists and round-trips through a fresh backend instance", () => {
  const dir = tmpProject("json-write");
  const backend = new JsonStoreBackend();
  backend.open(dir);
  backend.upsertFiles([{ path: "a.ts", sha: "1", mtime: 0, kind: "source", language: "typescript" }]);
  backend.close();

  assert.ok(existsSync(join(dir, ".agent_memory", "structural", "files.json")));

  const reopened = new JsonStoreBackend();
  reopened.open(dir);
  assert.equal(reopened.listFiles().length, 1);
  reopened.close();
});

// --- rebuildStore() --------------------------------------------------------------

function writeFixtureProject(dir: string): void {
  const memDir = join(dir, ".agent_memory");
  mkdirSync(join(memDir, "packets"), { recursive: true });
  mkdirSync(join(memDir, "structural"), { recursive: true });
  mkdirSync(join(memDir, "graph"), { recursive: true });
  mkdirSync(join(memDir, "indexes"), { recursive: true });

  const fixturePacket: MemoryPacket = {
    schema_version: 2,
    id: "repo:kage:decision:use-the-store-1",
    title: "Use the store",
    summary: "Kage's memory store regenerates from packets.",
    body: "Kage's memory store regenerates from packets plus today's structural cache.",
    type: "decision",
    scope: "repo",
    visibility: "team",
    sensitivity: "internal",
    status: "approved",
    confidence: 0.75,
    tags: ["store"],
    paths: ["mcp/store/rebuild.ts"],
    stack: ["typescript"],
    source_refs: [{ kind: "explicit_capture", captured_at: "2026-08-20T00:00:00.000Z" }],
    freshness: { ttl_days: 365, last_verified_at: "2026-08-20T00:00:00.000Z", path_fingerprints: [{ path: "mcp/store/rebuild.ts", sha256: "fixture-sha", size: 10 }] },
    edges: [],
    quality: { reviewer: null, votes_up: 0, votes_down: 0, uses_30d: 0, reports_stale: 0 },
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
  };
  writeFileSync(join(memDir, "packets", "decision-use-the-store-1.md"), packetToOkfConcept(fixturePacket), "utf8");

  writeFileSync(
    join(memDir, "structural", "files.json"),
    `${JSON.stringify(
      [{ schema_version: 1, path: "mcp/store/rebuild.ts", language: "typescript", kind: "source", size_bytes: 10, line_count: 1, hash: "h1", mtime_ms: 1, extraction: "structural", confidence: "EXTRACTED", top_symbols: [], imports_preview: [], signals: [], concepts: [] }],
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(join(memDir, "structural", "symbols.json"), `${JSON.stringify([], null, 2)}\n`, "utf8");
  writeFileSync(join(memDir, "structural", "imports.json"), `${JSON.stringify([], null, 2)}\n`, "utf8");

  writeFileSync(
    join(memDir, "graph", "entities.json"),
    `${JSON.stringify([{ id: "entity:kage", type: "project", name: "Kage", aliases: [], summary: "", first_seen_at: "2026-08-20T00:00:00.000Z", last_seen_at: "2026-08-20T00:00:00.000Z", evidence: [] }], null, 2)}\n`,
    "utf8",
  );
  writeFileSync(join(memDir, "graph", "edges.json"), `${JSON.stringify([], null, 2)}\n`, "utf8");
  writeFileSync(join(memDir, "graph", "episodes.json"), `${JSON.stringify([], null, 2)}\n`, "utf8");

  writeFileSync(
    join(memDir, "indexes", "docs-index.json"),
    `${JSON.stringify({ schema_version: 1, generated_at: "2026-08-20T00:00:00.000Z", source: "repo-docs", doc_count: 1, chunk_count: 1, chunks: [{ doc_path: "README.md", heading: "Intro", anchor: "intro", text: "Kage.", line: 1 }] }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(join(memDir, "indexes", "vector-local.json"), `${JSON.stringify({ schema_version: 1, generated_from_updated_at: null, packet_count: 0, documents: [] }, null, 2)}\n`, "utf8");
}

test("rebuildStore() on a fixture project produces a store whose counts match the fixture", () => {
  const dir = tmpProject("rebuild-fixture");
  writeFixtureProject(dir);

  const result = rebuildStore(dir, { requireFn: requireWithoutSqlite });
  assert.equal(result.backend, "json");
  assert.equal(result.counts.files, 1);
  assert.equal(result.counts.packets, 1);
  assert.equal(result.counts.kg_entities, 1);
  assert.equal(result.counts.docs_fts, 1);

  const manifest = readManifest(dir);
  assert.ok(manifest);
  assert.deepEqual(manifest?.counts, result.counts);
  assert.ok(manifest?.last_rebuild_at);
});

test("rebuildStore() also produces matching counts against the real sqlite backend on this machine", () => {
  const dir = tmpProject("rebuild-fixture-sqlite");
  writeFixtureProject(dir);

  const result = rebuildStore(dir, { forceBackend: "sqlite" });
  assert.equal(result.backend, "sqlite");
  assert.equal(result.counts.files, 1);
  assert.equal(result.counts.packets, 1);
  assert.equal(result.counts.kg_entities, 1);
  assert.equal(result.counts.docs_fts, 1);
});

test("REVERT CHECK: rebuildStore() is idempotent -- a deleted packet disappears from the store on the next rebuild instead of lingering", () => {
  const dir = tmpProject("rebuild-idempotent");
  writeFixtureProject(dir);

  const first = rebuildStore(dir, { requireFn: requireWithoutSqlite });
  assert.equal(first.counts.packets, 1);

  // Simulate the packet being deleted from disk, the way it would be if a
  // human or `kage supersede` removed it.
  rmSync(join(dir, ".agent_memory", "packets", "decision-use-the-store-1.md"));

  const second = rebuildStore(dir, { requireFn: requireWithoutSqlite });
  assert.equal(second.counts.packets, 0, "a rebuild after the packet was deleted must not still show it");
});

// --- manifest ------------------------------------------------------------------

test("manifest round-trips and openStore() honours a forced backend", () => {
  const dir = tmpProject("manifest-force");

  const auto = openStore(dir, { requireFn: requireWithoutSqlite });
  assert.equal(auto.backend.kind, "json");
  auto.backend.close();

  // Force sqlite even though this project's manifest currently says json,
  // and even with a require seam that reports sqlite unavailable -- an
  // explicit forceBackend must win over both.
  const forced = openStore(dir, { forceBackend: "sqlite" });
  assert.equal(forced.backend.kind, "sqlite");
  forced.backend.close();
  assert.ok(existsSync(sqliteStorePath(dir)));

  assert.ok(existsSync(manifestPath(dir)));
  const manifest = readManifest(dir);
  assert.ok(manifest);
  assert.equal(manifest?.active_backend, "sqlite");

  // A persisted forced_backend also wins, with no forceBackend option passed.
  writeManifest(dir, { ...(manifest as NonNullable<typeof manifest>), forced_backend: "json" });
  const respectsForced = openStore(dir, { requireFn: undefined });
  assert.equal(respectsForced.backend.kind, "json");
  respectsForced.backend.close();
});

// --- StoreBackend contract symmetry (sanity for M2/M3) ---------------------

test("both backends implement the same StoreBackend surface", () => {
  const dir1 = tmpProject("contract-sqlite");
  const dir2 = tmpProject("contract-json");
  const backends: StoreBackend[] = [new SqliteStoreBackend(), new JsonStoreBackend()];
  backends[0].open(dir1);
  backends[1].open(dir2);
  for (const backend of backends) {
    assert.equal(typeof backend.upsertFiles, "function");
    assert.equal(typeof backend.queryDocsFts, "function");
    assert.equal(typeof backend.queryVectorCandidates, "function");
    assert.equal(typeof backend.getKgEdges, "function");
    assert.equal(typeof backend.reset, "function");
    assert.deepEqual(backend.listFiles(), []);
  }
  backends[0].close();
  backends[1].close();
});
