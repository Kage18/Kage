// JsonStoreBackend: the StoreBackend implementation for a Node build with
// no node:sqlite (see mcp/store/sqlite.ts's detect()). It is a read
// adapter over today's derived JSON layout under .agent_memory/ --
// structural/, indexes/, and graph/, exactly as docs/design/MEMORY_STORE.md
// records -- and, on the write side, preserves today's whole-file-rewrite
// behaviour: every upsert reads the current file (if any), merges in the
// new rows keyed by their natural id, and rewrites the whole file, the
// same shape mcp/kernel.ts's own readJson/writeJson pair (kernel.ts:2607,
// 2619) already uses for every artifact this module reads.
//
// This module does not import mcp/kernel.ts: kernel.ts's readJson/writeJson
// and packet/structural types are not exported, and M1's brief is new
// files under mcp/store/ only. The JSON shapes below are reproduced from
// kernel.ts's own artifact writers (buildStructuralIndex at kernel.ts:6648,
// updateKnowledgeGraph around kernel.ts:8839, buildPacketIndexes at
// kernel.ts:9118, buildDocsIndex, writeSparseVectorIndex) so this backend
// reads exactly what kernel.ts writes today.
//
// It must not re-implement ranking: queryDocsFts and queryVectorCandidates
// return matching rows, unranked -- BM25 / cosine scoring over those rows
// is the caller's job (docs/design/MEMORY_STORE.md, "Query semantics,
// preserved exactly").

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  BackendKind,
  CallEdgeRow,
  DocsFtsDoc,
  DocsFtsHit,
  FileRow,
  ImportEdgeRow,
  KgEdgeRow,
  KgEntityRow,
  KgEpisodeRow,
  MigrationResult,
  PacketPathRow,
  PacketRow,
  PacketSymbolRow,
  StoreBackend,
  SymbolRow,
  VectorCandidate,
  VectorChunkRow,
} from "./types.js";

export const SCHEMA_VERSION = 1;

// -- generic whole-file JSON read/write, mirroring kernel.ts:2607/2619 -------

function readJsonFile<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

// -- today's on-disk artifact shapes (reproduced from kernel.ts) ------------

interface StructuralFileFactLike extends Record<string, unknown> {
  path: string;
  language: string;
  kind: string;
  hash: string;
  mtime_ms: number;
}

interface StructuralSymbolFactLike extends Record<string, unknown> {
  id: string;
  name: string;
  kind: string;
  path: string;
}

interface CodeImportEdgeLike extends Record<string, unknown> {
  from_path: string;
  to_path: string | null;
  kind: string;
}

interface GraphEntityLike extends Record<string, unknown> {
  id: string;
  type: string;
  name: string;
}

interface GraphEdgeLike extends Record<string, unknown> {
  id: string;
  from: string;
  to: string;
  relation: string;
  confidence: number;
}

interface GraphEpisodeLike extends Record<string, unknown> {
  id: string;
  observed_at: string;
  summary: string;
}

interface DocsChunkLike extends Record<string, unknown> {
  doc_path: string;
  heading: string;
  anchor: string;
  text: string;
}

interface DocsIndexArtifactLike {
  schema_version: number;
  generated_at: string;
  source: "repo-docs";
  doc_count: number;
  chunk_count: number;
  chunks: DocsChunkLike[];
}

interface SparseVectorDocumentLike {
  packet_id: string;
  terms: Array<[string, number]>;
  norm: number;
}

interface SparseVectorIndexLike {
  schema_version: 1;
  generated_from_updated_at: string | null;
  packet_count: number;
  documents: SparseVectorDocumentLike[];
}

interface CatalogPacketLike extends Record<string, unknown> {
  id: string;
  type: string;
  status: string;
  updated_at: string;
  paths: string[];
}

interface CatalogLike {
  schema_version: number;
  generated_from_updated_at: string | null;
  packet_count: number;
  packets: CatalogPacketLike[];
}

// This backend's own artifacts: today's layout has no dedicated flat file
// for call edges (they live compacted inside code_graph/graph.json, whose
// hydration is internal to kernel.ts) or for per-(packet,path)/(packet,
// symbol) hash citations (indexes/by-path.json is Record<path, id[]> with
// no room for a sha256, and the design doc documents it as never actually
// read back -- MEMORY_STORE.md, "One correction worth stating plainly").
// Those two kinds get files this backend owns outright, still under the
// same gitignored directories, still disposable.
const CALL_EDGES_FILE = "structural/call-edges.json";
const PACKET_PATHS_FILE = "indexes/packet-paths.json";
const PACKET_SYMBOLS_FILE = "indexes/packet-symbols.json";

function memoryDir(projectDir: string): string {
  return join(projectDir, ".agent_memory");
}
function structuralPath(projectDir: string, name: string): string {
  return join(memoryDir(projectDir), "structural", name);
}
function indexesPath(projectDir: string, name: string): string {
  return join(memoryDir(projectDir), "indexes", name);
}
function graphPath(projectDir: string, name: string): string {
  return join(memoryDir(projectDir), "graph", name);
}

function defaultStructuralFile(row: FileRow): StructuralFileFactLike {
  return {
    schema_version: 1,
    path: row.path,
    language: row.language,
    kind: row.kind,
    size_bytes: 0,
    line_count: 0,
    hash: row.sha,
    mtime_ms: row.mtime,
    extraction: "structural",
    confidence: "EXTRACTED",
    top_symbols: [],
    imports_preview: [],
    signals: [],
    concepts: [],
  };
}

function defaultStructuralSymbol(row: SymbolRow): StructuralSymbolFactLike {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    path: row.file,
    language: "",
    parser: "metadata",
    export: false,
    line: 0,
    end_line: null,
    signature: "",
    confidence: "EXTRACTED",
  };
}

function defaultGraphEntity(row: KgEntityRow, now: string): GraphEntityLike {
  return { id: row.id, type: row.kind, name: row.label, aliases: [], summary: "", first_seen_at: now, last_seen_at: now, evidence: [] };
}

function defaultGraphEdge(row: KgEdgeRow, now: string): GraphEdgeLike {
  return {
    id: `${row.fromId}->${row.toId}:${row.kind}`,
    from: row.fromId,
    to: row.toId,
    relation: row.kind,
    fact: "",
    confidence: row.weight,
    valid_from: now,
    invalidated_at: null,
    branch: null,
    commit: null,
    evidence: [],
  };
}

function defaultGraphEpisode(row: KgEpisodeRow): GraphEpisodeLike {
  return { id: row.id, kind: "repo_manifest", source_refs: [], observed_at: row.ts, branch: null, commit: null, summary: row.summary };
}

export class JsonStoreBackend implements StoreBackend {
  readonly kind: BackendKind = "json";
  private projectDir: string | null = null;

  open(projectDir: string): void {
    if (this.projectDir) return;
    this.projectDir = projectDir;
    mkdirSync(memoryDir(projectDir), { recursive: true });
    this.migrate();
  }

  close(): void {
    this.projectDir = null;
  }

  private dir(): string {
    if (!this.projectDir) throw new Error("JsonStoreBackend: open(projectDir) must be called before use");
    return this.projectDir;
  }

  migrate(): MigrationResult {
    const path = indexesPath(this.dir(), "store-schema.json");
    const current = readJsonFile<{ schema_version: number } | null>(path, null);
    const fromVersion = current?.schema_version ?? 0;
    if (fromVersion >= SCHEMA_VERSION) return { fromVersion, toVersion: fromVersion, applied: false };
    writeJsonFile(path, { schema_version: SCHEMA_VERSION });
    return { fromVersion, toVersion: SCHEMA_VERSION, applied: true };
  }

  reset(): void {
    const dir = this.dir();
    writeJsonFile(structuralPath(dir, "files.json"), []);
    writeJsonFile(structuralPath(dir, "symbols.json"), []);
    writeJsonFile(structuralPath(dir, "imports.json"), []);
    writeJsonFile(structuralPath(dir, CALL_EDGES_FILE.replace("structural/", "")), []);
    writeJsonFile(indexesPath(dir, "catalog.json"), { schema_version: 2, generated_from_updated_at: null, packet_count: 0, packets: [] });
    writeJsonFile(indexesPath(dir, PACKET_PATHS_FILE.replace("indexes/", "")), []);
    writeJsonFile(indexesPath(dir, PACKET_SYMBOLS_FILE.replace("indexes/", "")), []);
    writeJsonFile(indexesPath(dir, "docs-index.json"), { schema_version: 1, generated_at: "", source: "repo-docs", doc_count: 0, chunk_count: 0, chunks: [] });
    writeJsonFile(indexesPath(dir, "vector-local.json"), { schema_version: 1, generated_from_updated_at: null, packet_count: 0, documents: [] });
    writeJsonFile(graphPath(dir, "entities.json"), []);
    writeJsonFile(graphPath(dir, "edges.json"), []);
    writeJsonFile(graphPath(dir, "episodes.json"), []);
  }

  // -- files / symbols / edges ------------------------------------------------

  upsertFiles(files: FileRow[]): void {
    const path = structuralPath(this.dir(), "files.json");
    const existing = readJsonFile<StructuralFileFactLike[]>(path, []);
    const byPath = new Map(existing.map((entry) => [entry.path, entry]));
    for (const row of files) {
      const prior = byPath.get(row.path);
      byPath.set(row.path, prior ? { ...prior, path: row.path, hash: row.sha, mtime_ms: row.mtime, kind: row.kind, language: row.language } : defaultStructuralFile(row));
    }
    const merged = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
    writeJsonFile(path, merged);
  }

  getFile(path: string): FileRow | null {
    const entry = this.readStructuralFiles().find((file) => file.path === path);
    return entry ? structuralFileToRow(entry) : null;
  }

  listFiles(scope?: string): FileRow[] {
    return this.readStructuralFiles()
      .filter((file) => !scope || file.path.startsWith(scope))
      .map(structuralFileToRow);
  }

  private readStructuralFiles(): StructuralFileFactLike[] {
    return readJsonFile<StructuralFileFactLike[]>(structuralPath(this.dir(), "files.json"), []);
  }

  upsertSymbols(symbols: SymbolRow[]): void {
    const path = structuralPath(this.dir(), "symbols.json");
    const existing = readJsonFile<StructuralSymbolFactLike[]>(path, []);
    const byId = new Map(existing.map((entry) => [entry.id, entry]));
    for (const row of symbols) {
      const prior = byId.get(row.id);
      byId.set(row.id, prior ? { ...prior, id: row.id, name: row.name, kind: row.kind, path: row.file } : defaultStructuralSymbol(row));
    }
    writeJsonFile(path, [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }

  listSymbolsForFile(path: string): SymbolRow[] {
    return this.readStructuralSymbols()
      .filter((symbol) => symbol.path === path)
      .map(structuralSymbolToRow);
  }

  listSymbols(scope?: string): SymbolRow[] {
    return this.readStructuralSymbols()
      .filter((symbol) => !scope || symbol.path.startsWith(scope))
      .map(structuralSymbolToRow);
  }

  private readStructuralSymbols(): StructuralSymbolFactLike[] {
    return readJsonFile<StructuralSymbolFactLike[]>(structuralPath(this.dir(), "symbols.json"), []);
  }

  // Edges (import/call/kg) have no natural unique key in today's artifacts
  // or in the design's own schema sketch -- both backends treat upsert*Edges
  // as append-only. A caller that upserts the same edge twice within one
  // pass will see it twice; rebuildStore() (mcp/store/rebuild.ts) avoids
  // that by reset()ing before every pass, so it never double-submits.
  upsertImportEdges(edges: ImportEdgeRow[]): void {
    const path = structuralPath(this.dir(), "imports.json");
    const existing = readJsonFile<CodeImportEdgeLike[]>(path, []);
    const additions = edges.map(
      (edge): CodeImportEdgeLike => ({ from_path: edge.fromFile, to_path: edge.toFile, specifier: "", imported: [], kind: edge.kind, parser: "metadata", line: 0 }),
    );
    writeJsonFile(path, [...existing, ...additions]);
  }

  listImportEdges(scope?: string): ImportEdgeRow[] {
    return readJsonFile<CodeImportEdgeLike[]>(structuralPath(this.dir(), "imports.json"), [])
      .filter((edge) => !scope || edge.from_path.startsWith(scope))
      .map((edge) => ({ fromFile: edge.from_path, toFile: edge.to_path, kind: edge.kind }));
  }

  upsertCallEdges(edges: CallEdgeRow[]): void {
    const path = structuralPath(this.dir(), CALL_EDGES_FILE.replace("structural/", ""));
    const existing = readJsonFile<CallEdgeRow[]>(path, []);
    writeJsonFile(path, [...existing, ...edges]);
  }

  listCallEdges(scope?: string): CallEdgeRow[] {
    return readJsonFile<CallEdgeRow[]>(structuralPath(this.dir(), CALL_EDGES_FILE.replace("structural/", "")), []).filter(
      (edge) => !scope || (edge.fromSymbol ?? "").startsWith(scope),
    );
  }

  // -- packets -------------------------------------------------------------

  upsertPackets(packets: PacketRow[]): void {
    const path = indexesPath(this.dir(), "catalog.json");
    const existing = readJsonFile<CatalogLike>(path, { schema_version: 2, generated_from_updated_at: null, packet_count: 0, packets: [] });
    const byId = new Map(existing.packets.map((entry) => [entry.id, entry]));
    for (const row of packets) {
      const prior = byId.get(row.id);
      byId.set(row.id, {
        ...(prior ?? { id: row.id, title: "", summary: "", tags: [], paths: [], source_refs: [] }),
        id: row.id,
        type: row.type,
        status: row.status,
        updated_at: row.updatedAt,
      });
    }
    const merged = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
    writeJsonFile(path, { ...existing, packet_count: merged.length, packets: merged });
  }

  getPacket(id: string): PacketRow | null {
    const entry = this.readCatalogPackets().find((packet) => packet.id === id);
    return entry ? catalogPacketToRow(entry) : null;
  }

  listPackets(scope?: string): PacketRow[] {
    return this.readCatalogPackets()
      .filter((packet) => !scope || packet.paths.some((path) => path.startsWith(scope)))
      .map(catalogPacketToRow);
  }

  private readCatalogPackets(): CatalogPacketLike[] {
    return readJsonFile<CatalogLike>(indexesPath(this.dir(), "catalog.json"), { schema_version: 2, generated_from_updated_at: null, packet_count: 0, packets: [] }).packets;
  }

  upsertPacketPaths(rows: PacketPathRow[]): void {
    const path = indexesPath(this.dir(), PACKET_PATHS_FILE.replace("indexes/", ""));
    const existing = readJsonFile<PacketPathRow[]>(path, []);
    const key = (row: PacketPathRow) => `${row.packetId} ${row.path}`;
    const byKey = new Map(existing.map((row) => [key(row), row]));
    for (const row of rows) byKey.set(key(row), row);
    writeJsonFile(path, [...byKey.values()]);
  }

  upsertPacketSymbols(rows: PacketSymbolRow[]): void {
    const path = indexesPath(this.dir(), PACKET_SYMBOLS_FILE.replace("indexes/", ""));
    const existing = readJsonFile<PacketSymbolRow[]>(path, []);
    const key = (row: PacketSymbolRow) => `${row.packetId} ${row.symbol}`;
    const byKey = new Map(existing.map((row) => [key(row), row]));
    for (const row of rows) byKey.set(key(row), row);
    writeJsonFile(path, [...byKey.values()]);
  }

  queryPacketsByPath(path: string): string[] {
    const rows = readJsonFile<PacketPathRow[]>(indexesPath(this.dir(), PACKET_PATHS_FILE.replace("indexes/", "")), []);
    return [...new Set(rows.filter((row) => row.path === path).map((row) => row.packetId))].sort();
  }

  // -- docs full-text search --------------------------------------------------

  upsertDocsFtsDoc(doc: DocsFtsDoc): void {
    const path = indexesPath(this.dir(), "docs-index.json");
    const existing = readJsonFile<DocsIndexArtifactLike>(path, { schema_version: 1, generated_at: "", source: "repo-docs", doc_count: 0, chunk_count: 0, chunks: [] });
    const byId = new Map(existing.chunks.map((chunk) => [docsChunkId(chunk), chunk]));
    byId.set(doc.id, { doc_path: doc.docPath, heading: doc.heading, anchor: doc.id, text: doc.body, line: 0 });
    const chunks = [...byId.values()];
    writeJsonFile(path, {
      ...existing,
      chunk_count: chunks.length,
      doc_count: new Set(chunks.map((chunk) => chunk.doc_path)).size,
      chunks,
    });
  }

  queryDocsFts(term: string, scope?: string): DocsFtsHit[] {
    const needle = term.trim().toLowerCase();
    if (!needle) return [];
    const artifact = readJsonFile<DocsIndexArtifactLike>(indexesPath(this.dir(), "docs-index.json"), {
      schema_version: 1,
      generated_at: "",
      source: "repo-docs",
      doc_count: 0,
      chunk_count: 0,
      chunks: [],
    });
    return artifact.chunks
      .filter((chunk) => !scope || chunk.doc_path.startsWith(scope))
      .filter((chunk) => chunk.heading.toLowerCase().includes(needle) || chunk.text.toLowerCase().includes(needle))
      .map((chunk) => ({ id: docsChunkId(chunk), docPath: chunk.doc_path, heading: chunk.heading, body: chunk.text }));
  }

  // -- vectors -----------------------------------------------------------------

  upsertVectorChunks(packetId: string, terms: VectorChunkRow[]): void {
    const path = indexesPath(this.dir(), "vector-local.json");
    const existing = readJsonFile<SparseVectorIndexLike>(path, { schema_version: 1, generated_from_updated_at: null, packet_count: 0, documents: [] });
    const norm = Math.sqrt(terms.reduce((sum, term) => sum + term.weight * term.weight, 0));
    const document: SparseVectorDocumentLike = { packet_id: packetId, terms: terms.map((term) => [term.term, term.weight]), norm };
    const documents = [...existing.documents.filter((doc) => doc.packet_id !== packetId), document].sort((a, b) => a.packet_id.localeCompare(b.packet_id));
    writeJsonFile(path, { ...existing, packet_count: documents.length, documents });
  }

  queryVectorCandidates(terms: string[], scope?: string): VectorCandidate[] {
    if (!terms.length) return [];
    const wanted = new Set(terms);
    const index = readJsonFile<SparseVectorIndexLike>(indexesPath(this.dir(), "vector-local.json"), {
      schema_version: 1,
      generated_from_updated_at: null,
      packet_count: 0,
      documents: [],
    });
    const scopedPacketIds = scope ? new Set(this.listPackets(scope).map((packet) => packet.id)) : null;
    const candidates: VectorCandidate[] = [];
    for (const document of index.documents) {
      if (scopedPacketIds && !scopedPacketIds.has(document.packet_id)) continue;
      for (const [term, weight] of document.terms) {
        if (wanted.has(term)) candidates.push({ packetId: document.packet_id, term, weight });
      }
    }
    return candidates;
  }

  // -- knowledge graph -----------------------------------------------------------

  upsertKgEntities(entities: KgEntityRow[]): void {
    const path = graphPath(this.dir(), "entities.json");
    const existing = readJsonFile<GraphEntityLike[]>(path, []);
    const byId = new Map(existing.map((entry) => [entry.id, entry]));
    const now = new Date(0).toISOString();
    for (const row of entities) {
      const prior = byId.get(row.id);
      byId.set(row.id, prior ? { ...prior, id: row.id, type: row.kind, name: row.label } : defaultGraphEntity(row, now));
    }
    writeJsonFile(path, [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }

  getKgEntity(id: string): KgEntityRow | null {
    const entry = this.readGraphEntities().find((entity) => entity.id === id);
    return entry ? graphEntityToRow(entry) : null;
  }

  listKgEntities(): KgEntityRow[] {
    return this.readGraphEntities().map(graphEntityToRow);
  }

  private readGraphEntities(): GraphEntityLike[] {
    return readJsonFile<GraphEntityLike[]>(graphPath(this.dir(), "entities.json"), []);
  }

  // Append-only, matching upsertImportEdges/upsertCallEdges above and
  // SqliteStoreBackend's plain INSERT -- kg_edges has no unique key either.
  upsertKgEdges(edges: KgEdgeRow[]): void {
    const path = graphPath(this.dir(), "edges.json");
    const existing = readJsonFile<GraphEdgeLike[]>(path, []);
    const now = new Date(0).toISOString();
    const additions = edges.map((row) => defaultGraphEdge(row, now));
    writeJsonFile(path, [...existing, ...additions]);
  }

  getKgEdges(entityId: string): KgEdgeRow[] {
    return readJsonFile<GraphEdgeLike[]>(graphPath(this.dir(), "edges.json"), [])
      .filter((edge) => edge.from === entityId || edge.to === entityId)
      .map(graphEdgeToRow);
  }

  upsertKgEpisodes(episodes: KgEpisodeRow[]): void {
    const path = graphPath(this.dir(), "episodes.json");
    const existing = readJsonFile<GraphEpisodeLike[]>(path, []);
    const byId = new Map(existing.map((entry) => [entry.id, entry]));
    for (const row of episodes) {
      const prior = byId.get(row.id);
      byId.set(row.id, prior ? { ...prior, id: row.id, observed_at: row.ts, summary: row.summary } : defaultGraphEpisode(row));
    }
    writeJsonFile(path, [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }

  listKgEpisodes(): KgEpisodeRow[] {
    return readJsonFile<GraphEpisodeLike[]>(graphPath(this.dir(), "episodes.json"), []).map(graphEpisodeToRow);
  }

  // -- counts ---------------------------------------------------------------------

  counts(): Record<string, number> {
    const docs = readJsonFile<DocsIndexArtifactLike>(indexesPath(this.dir(), "docs-index.json"), {
      schema_version: 1,
      generated_at: "",
      source: "repo-docs",
      doc_count: 0,
      chunk_count: 0,
      chunks: [],
    });
    const vectors = readJsonFile<SparseVectorIndexLike>(indexesPath(this.dir(), "vector-local.json"), {
      schema_version: 1,
      generated_from_updated_at: null,
      packet_count: 0,
      documents: [],
    });
    return {
      files: this.readStructuralFiles().length,
      symbols: this.readStructuralSymbols().length,
      import_edges: readJsonFile<CodeImportEdgeLike[]>(structuralPath(this.dir(), "imports.json"), []).length,
      call_edges: readJsonFile<CallEdgeRow[]>(structuralPath(this.dir(), CALL_EDGES_FILE.replace("structural/", "")), []).length,
      packets: this.readCatalogPackets().length,
      packet_paths: readJsonFile<PacketPathRow[]>(indexesPath(this.dir(), PACKET_PATHS_FILE.replace("indexes/", "")), []).length,
      packet_symbols: readJsonFile<PacketSymbolRow[]>(indexesPath(this.dir(), PACKET_SYMBOLS_FILE.replace("indexes/", "")), []).length,
      docs_fts: docs.chunks.length,
      vectors: vectors.documents.reduce((sum, document) => sum + document.terms.length, 0),
      kg_entities: this.readGraphEntities().length,
      kg_edges: readJsonFile<GraphEdgeLike[]>(graphPath(this.dir(), "edges.json"), []).length,
      kg_episodes: readJsonFile<GraphEpisodeLike[]>(graphPath(this.dir(), "episodes.json"), []).length,
    };
  }
}

function docsChunkId(chunk: DocsChunkLike): string {
  return `${chunk.doc_path}#${chunk.anchor}`;
}

function structuralFileToRow(entry: StructuralFileFactLike): FileRow {
  return { path: entry.path, sha: entry.hash, mtime: entry.mtime_ms, kind: entry.kind, language: entry.language };
}

function structuralSymbolToRow(entry: StructuralSymbolFactLike): SymbolRow {
  return { id: entry.id, file: entry.path, name: entry.name, kind: entry.kind, sha: "" };
}

function catalogPacketToRow(entry: CatalogPacketLike): PacketRow {
  return { id: entry.id, type: entry.type, status: entry.status, score: null, updatedAt: entry.updated_at };
}

function graphEntityToRow(entry: GraphEntityLike): KgEntityRow {
  return { id: entry.id, kind: entry.type, label: entry.name };
}

function graphEdgeToRow(entry: GraphEdgeLike): KgEdgeRow {
  return { fromId: entry.from, toId: entry.to, kind: entry.relation, weight: entry.confidence };
}

function graphEpisodeToRow(entry: GraphEpisodeLike): KgEpisodeRow {
  return { id: entry.id, ts: entry.observed_at, summary: entry.summary };
}
