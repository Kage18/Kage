// Tests for M2 of the memory store (docs/design/MEMORY_STORE.md): kernel.ts's
// catalog/packet-path, docs-FTS, and vector index reads/writes now go through
// the StoreBackend seam M1 built under mcp/store/. This file is new behaviour
// (repo rule: mcp/delegation.test.ts is off-limits, new behaviour gets its own
// file) and does not touch mcp/store-layer.test.ts, M1's own suite.
//
// A real usage-tracking side effect in recall() (score_breakdown.usage climbs
// on repeated calls to the SAME project) means two sequential recall() calls
// against one directory are NOT directly comparable, even on the same
// backend -- confirmed by hand before writing this file. The golden
// cross-backend test below therefore recalls against two INDEPENDENT copies
// of one fixture, one forced to each backend, never the same directory twice.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { indexProject, recall, searchDocs, docsRecallSection, buildDocsIndex } from "./kernel.js";
import { openStore, readManifest, writeManifest } from "./store/manifest.js";
import { rebuildStore } from "./store/rebuild.js";
import { detect as detectSqlite, SqliteStoreBackend } from "./store/sqlite.js";
import { JsonStoreBackend } from "./store/json.js";
import type { BackendKind } from "./store/types.js";

// Hermetic personal store, same guard mcp/kernel.test.ts uses -- recall reads
// $KAGE_HOME/memory, so tests must never touch the developer's real ~/.kage.
if (!process.env.KAGE_HOME) process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-store-port-test-home-"));

const SQLITE_AVAILABLE = detectSqlite().available;

function tempProject(prefix = "kage-store-port"): string {
  const dir = mkdtempSync(join(tmpdir(), `${prefix}-`));
  mkdirSync(join(dir, ".agent_memory", "packets"), { recursive: true });
  return dir;
}

function writePacket(dir: string, slug: string, opts: { title: string; type?: string; paths?: string[]; tags?: string[]; body: string }): void {
  const frontmatter = [
    "---",
    `id: repo:fixture:${opts.type ?? "decision"}:${slug}`,
    `type: ${opts.type ?? "decision"}`,
    "status: approved",
    `title: ${JSON.stringify(opts.title)}`,
    `paths: ${JSON.stringify(opts.paths ?? [])}`,
    `tags: ${JSON.stringify(opts.tags ?? [])}`,
    `updated_at: "2026-08-20T00:00:00.000Z"`,
    "---",
  ].join("\n");
  writeFileSync(join(dir, ".agent_memory", "packets", `${slug}.md`), `${frontmatter}\n${opts.body}\n`, "utf8");
}

function forceBackend(dir: string, kind: BackendKind): void {
  const manifest = readManifest(dir);
  writeManifest(dir, { ...(manifest ?? { schema_version: 1, active_backend: kind, forced_backend: null, counts: {}, last_rebuild_at: null }), forced_backend: kind });
}

function seedFixture(dir: string): void {
  writeFileSync(
    join(dir, "README.md"),
    [
      "# Fixture repo",
      "",
      "## Setup",
      "Run npm install to set up the deps, then configure the WEBHOOK_SECRET env var before booting the server.",
      "",
      "## Deployment",
      "Deploy with the rocket pipeline to production and watch the dashboard for errors.",
    ].join("\n"),
    "utf8",
  );
  writePacket(dir, "webhook-retry", {
    title: "Webhook handler retries on 5xx",
    paths: ["src/webhook.ts"],
    tags: ["webhook", "retry"],
    body: "The webhook handler retries on 5xx responses from the downstream payment provider, using exponential backoff capped at 5 attempts.",
  });
  writePacket(dir, "cache-invalidate", {
    title: "Cache invalidates on packet write",
    paths: ["src/cache.ts"],
    tags: ["cache"],
    body: "The read cache invalidates whenever a memory packet is written, avoiding stale recall results after a capture.",
  });
}

// --- write-through: buildPacketIndexes/buildDocsIndex actually populate the store ---

test("indexProject routes packet/path, vector, and docs writes through the StoreBackend seam", () => {
  const project = tempProject();
  seedFixture(project);
  indexProject(project);

  const { backend } = openStore(project);
  const counts = backend.counts();
  backend.close();

  // REGRESSION: if buildPacketIndexes/buildDocsIndex go back to writeJson-only
  // (the pre-M2 shape), the store stays empty (a fresh manifest, zero rows)
  // even though indexProject() succeeds -- these counts are the seam's own
  // receipt, not a proxy for indexProject's unrelated JSON-file output.
  // indexProject also auto-captures repo_map overview/structure packets
  // alongside the 2 hand-authored ones above -- >= keeps this test from
  // being coupled to that unrelated, separately-owned behavior.
  assert.ok(counts.packets >= 2, "packets should be routed through upsertPackets");
  assert.ok(counts.packet_paths >= 2, "packet paths should be routed through upsertPacketPaths");
  assert.ok(counts.vectors > 0, "vector terms should be routed through replaceVectorDocuments");
  assert.ok(counts.docs_fts >= 2, "docs chunks should be routed through replaceDocsFtsDocs");
});

// --- json backend byte-compatibility: the seam's write still produces files today's readers accept ---

test("JSON backend byte-compatibility: writing through the seam produces docs-index.json and vector-local.json today's raw readers still accept", () => {
  const project = tempProject();
  seedFixture(project);
  forceBackend(project, "json");
  indexProject(project);

  // Round-trip through the OLD read path: a plain JSON.parse over the file,
  // the exact thing mcp/kernel.ts's readJson did before M2 and what any
  // other consumer (the portal, a script) still does today.
  const docsPath = join(project, ".agent_memory", "indexes", "docs-index.json");
  const vectorPath = join(project, ".agent_memory", "indexes", "vector-local.json");
  const catalogPath = join(project, ".agent_memory", "indexes", "catalog.json");
  assert.ok(existsSync(docsPath) && existsSync(vectorPath) && existsSync(catalogPath));

  const docsArtifact = JSON.parse(readFileSync(docsPath, "utf8"));
  assert.equal(docsArtifact.schema_version, 1);
  assert.equal(docsArtifact.source, "repo-docs");
  assert.equal(docsArtifact.chunk_count, docsArtifact.chunks.length);
  assert.ok(docsArtifact.chunks.some((chunk: { heading: string }) => chunk.heading.includes("Deployment")));
  for (const chunk of docsArtifact.chunks) {
    assert.equal(typeof chunk.doc_path, "string");
    assert.equal(typeof chunk.heading, "string");
    assert.equal(typeof chunk.anchor, "string");
    assert.equal(typeof chunk.text, "string");
    assert.equal(typeof chunk.line, "number");
  }

  const vectorArtifact = JSON.parse(readFileSync(vectorPath, "utf8"));
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  assert.equal(vectorArtifact.schema_version, 1);
  assert.equal(vectorArtifact.packet_count, catalog.packet_count);
  assert.equal(Array.isArray(vectorArtifact.documents), true);
  for (const document of vectorArtifact.documents) {
    assert.equal(typeof document.packet_id, "string");
    assert.equal(Array.isArray(document.terms), true);
    assert.equal(typeof document.norm, "number");
  }

  // searchDocs (the real reader) still works against what the seam wrote.
  const hits = searchDocs(project, "rocket pipeline deployment", 5);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].doc_path, "README.md");
  assert.ok(hits[0].line >= 1);
});

// REGRESSION for a real bug this run found and fixed: a long doc section that
// splits into multiple DOCS_CHUNK_MAX_CHARS chunks shares one doc_path+anchor
// pair. Routing those chunks through the store keyed by a bare doc_path#anchor
// id collapses them into one on upsert (found while dogfooding rebuild.ts
// against this repo's own docs: 941 real chunks measured, only 77 -- one per
// doc -- survived a store rebuild before the id got an index suffix).
test("REGRESSION: doc chunks sharing one heading anchor all survive the store, not just the last one", () => {
  const project = tempProject();
  const longBody = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} repeats itself to pad the section past the 1600-char chunk boundary again and again.`).join(" ");
  writeFileSync(join(project, "README.md"), `# Fixture\n\n## One Long Section\n\n${longBody}\n`, "utf8");
  mkdirSync(join(project, ".agent_memory", "packets"), { recursive: true });

  const artifact = buildDocsIndex(project);
  assert.ok(artifact.chunk_count >= 2, `expected the long section to split into multiple chunks, got ${artifact.chunk_count}`);

  const { backend } = openStore(project);
  const stored = backend.listDocsFtsDocs();
  backend.close();
  assert.equal(stored.length, artifact.chunk_count, "every chunk under the shared heading anchor should survive the store round-trip, not collapse to one");
});

// --- sqlite backend round-trips the same fixture ---

test("sqlite backend round-trips the same fixture rebuildStore() populates for json", { skip: !SQLITE_AVAILABLE && "node:sqlite is not available on this Node" }, () => {
  const project = tempProject();
  seedFixture(project);
  indexProject(project);

  const jsonResult = rebuildStore(project, { forceBackend: "json" });
  const jsonBackend = new JsonStoreBackend();
  jsonBackend.open(project);
  const jsonPacketIds = jsonBackend.listPackets().map((packet) => packet.id).sort();
  jsonBackend.close();

  const sqliteResult = rebuildStore(project, { forceBackend: "sqlite" });
  assert.equal(sqliteResult.backend, "sqlite");
  assert.deepEqual(sqliteResult.counts, jsonResult.counts, "sqlite should regenerate the same row counts as json from the same source artifacts");

  const sqliteBackend = new SqliteStoreBackend();
  sqliteBackend.open(project);
  const sqlitePacketIds = sqliteBackend.listPackets().map((packet) => packet.id).sort();
  sqliteBackend.close();

  assert.deepEqual(sqlitePacketIds, jsonPacketIds, "sqlite should round-trip the exact same packet id set json produced from the same packets on disk");
  assert.ok(sqlitePacketIds.length >= 2, "expected at least the 2 hand-authored fixture packets");
});

// --- the golden test: recall and searchDocs are identical across backends ---

test("GOLDEN: recall and searchDocs return identical packet ids, scores, and score_breakdown across both backends", { skip: !SQLITE_AVAILABLE && "node:sqlite is not available on this Node" }, () => {
  const projectJson = tempProject("kage-store-port-golden-json");
  seedFixture(projectJson);
  indexProject(projectJson);
  forceBackend(projectJson, "json");

  const projectSqlite = tempProject("kage-store-port-golden-sqlite");
  seedFixture(projectSqlite);
  indexProject(projectSqlite);
  forceBackend(projectSqlite, "sqlite");

  const query = "webhook retry cache invalidate";
  const jsonResult = recall(projectJson, query, 2);
  const sqliteResult = recall(projectSqlite, query, 2);

  const jsonIds = jsonResult.results.map((entry) => entry.packet.id);
  const sqliteIds = sqliteResult.results.map((entry) => entry.packet.id);
  assert.deepEqual(sqliteIds, jsonIds, "same packet ids in the same order");
  assert.deepEqual(
    sqliteResult.results.map((entry) => entry.score),
    jsonResult.results.map((entry) => entry.score),
    "identical final scores",
  );
  assert.deepEqual(
    sqliteResult.results.map((entry) => entry.score_breakdown),
    jsonResult.results.map((entry) => entry.score_breakdown),
    "identical score_breakdown, component by component -- the store serves rows, ranking math is unmoved (docs/design/MEMORY_STORE.md)",
  );
  assert.ok(jsonIds.length >= 2, "expected both fixture packets to rank");

  const docsQuery = "rocket pipeline deployment";
  const jsonDocs = searchDocs(projectJson, docsQuery, 5);
  const sqliteDocs = searchDocs(projectSqlite, docsQuery, 5);
  assert.deepEqual(sqliteDocs, jsonDocs);
  assert.ok(jsonDocs.length >= 1);

  const jsonSection = docsRecallSection(projectJson, docsQuery, 3);
  const sqliteSection = docsRecallSection(projectSqlite, docsQuery, 3);
  assert.equal(sqliteSection, jsonSection);
});

// --- CLI surface: kage store status / kage store rebuild ---

function runCli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const cli = join(__dirname, "cli.js");
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("kage store status names the active backend and matches the manifest", () => {
  const project = tempProject();
  seedFixture(project);
  indexProject(project);

  const run = runCli(["store", "status", "--project", project, "--json"]);
  assert.equal(run.status, 0, run.stderr);
  const parsed = JSON.parse(run.stdout);
  assert.equal(parsed.active_backend, "json", "a fresh project with no prior rebuild stays on the json backend by default");
  const manifest = readManifest(project);
  assert.equal(parsed.active_backend, manifest?.active_backend);
  assert.ok(parsed.counts.packets >= 2);
  assert.ok(parsed.files >= 1);

  const human = runCli(["store", "status", "--project", project]);
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /Active backend: json/);
  assert.match(human.stdout, /Table counts:/);
});

// --- rebuild is idempotent ---

test("REVERT CHECK: kage store rebuild is idempotent -- a second run changes no counts", () => {
  const project = tempProject();
  seedFixture(project);
  indexProject(project);

  const first = runCli(["store", "rebuild", "--project", project, "--backend", "json", "--json"]);
  assert.equal(first.status, 0, first.stderr);
  const second = runCli(["store", "rebuild", "--project", project, "--backend", "json", "--json"]);
  assert.equal(second.status, 0, second.stderr);

  const firstCounts = JSON.parse(first.stdout).counts;
  const secondCounts = JSON.parse(second.stdout).counts;
  assert.deepEqual(secondCounts, firstCounts, "a rebuild with nothing changed on disk must reproduce the same counts, not drift or duplicate rows");

  // The docs-index.json chunk_count on disk must also be stable across
  // repeated rebuilds -- the anchor-collision bug this run fixed (see the
  // REGRESSION test above) would have shown up here as a shrinking count on
  // the second run.
  const docsPath = join(project, ".agent_memory", "indexes", "docs-index.json");
  const chunkCountAfterFirst = JSON.parse(readFileSync(docsPath, "utf8")).chunk_count;
  runCli(["store", "rebuild", "--project", project, "--backend", "json", "--json"]);
  const chunkCountAfterThird = JSON.parse(readFileSync(docsPath, "utf8")).chunk_count;
  assert.equal(chunkCountAfterThird, chunkCountAfterFirst);
});

// --- backend-selection policy (item 4): default stays json until a completed rebuild ---

test("openStore() defaults to json even when sqlite is available, until a prior rebuild sets last_rebuild_at", { skip: !SQLITE_AVAILABLE && "node:sqlite is not available on this Node" }, () => {
  const project = tempProject();
  seedFixture(project);
  indexProject(project);

  const beforeRebuild = openStore(project);
  assert.equal(beforeRebuild.backend.kind, "json", "a project that has never run kage store rebuild stays on json by default");
  beforeRebuild.backend.close();

  rebuildStore(project, { forceBackend: "sqlite" });

  const afterRebuild = openStore(project);
  assert.equal(afterRebuild.backend.kind, "sqlite", "once a rebuild has migrated the store, later opens pick sqlite automatically");
  afterRebuild.backend.close();
});

