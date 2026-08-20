// rebuildStore(): regenerates the ENTIRE derived store from packets (the
// only source of truth, per docs/design/MEMORY_STORE.md Law 1) plus
// today's already-computed structural/knowledge-graph/docs/vector JSON
// caches under .agent_memory/. Idempotent and safe to run anytime -- it
// always reset()s the backend first, so a rebuild after a packet/file was
// deleted does not leave a stale row behind.
//
// This does not recompute structural analysis from source (parsing code,
// walking imports) -- that is mcp/kernel.ts's buildStructuralIndex, deep
// logic this milestone does not touch or duplicate. It reads whatever
// kernel.ts has already written to structural/, graph/, and indexes/ and
// loads it into the store. If those caches don't exist yet (a fresh repo
// that has never run `kage index`), rebuildStore() still succeeds -- it
// just populates packets and leaves the code/graph tables empty, which is
// the honest state.
//
// Nothing in mcp/cli.ts is wired to call this yet -- that is M2's job
// (`kage store rebuild`). M1 only builds and proves the function.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadOkfConcepts } from "../okf.js";
import { openStore, readManifest, writeManifest, type OpenStoreOptions } from "./manifest.js";
import type {
  CallEdgeRow,
  FileRow,
  ImportEdgeRow,
  KgEdgeRow,
  KgEntityRow,
  KgEpisodeRow,
  PacketPathRow,
  PacketRow,
  PacketSymbolRow,
  StoreBackend,
  SymbolRow,
  VectorChunkRow,
} from "./types.js";

export interface RebuildResult {
  backend: "sqlite" | "json";
  counts: Record<string, number>;
  rebuiltAt: string;
}

function readJsonSafe<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

// -- shapes of today's already-built caches (see mcp/store/json.ts for the
// same reproduction, kept independent here so rebuild has no dependency on
// JsonStoreBackend's internals -- it talks to any StoreBackend uniformly). ---

interface StructuralFileFactLike {
  path: string;
  language: string;
  kind: string;
  hash: string;
  mtime_ms: number;
}
interface StructuralSymbolFactLike {
  id: string;
  name: string;
  kind: string;
  path: string;
}
interface CodeImportEdgeLike {
  from_path: string;
  to_path: string | null;
  kind: string;
}
interface GraphEntityLike {
  id: string;
  type: string;
  name: string;
}
interface GraphEdgeLike {
  from: string;
  to: string;
  relation: string;
  confidence: number;
}
interface GraphEpisodeLike {
  id: string;
  observed_at: string;
  summary: string;
}
interface DocsChunkLike {
  doc_path: string;
  heading: string;
  anchor: string;
  text: string;
  line: number;
}
interface DocsIndexArtifactLike {
  chunks: DocsChunkLike[];
}
interface SparseVectorDocumentLike {
  packet_id: string;
  terms: Array<[string, number]>;
}
interface SparseVectorIndexLike {
  documents: SparseVectorDocumentLike[];
}
interface MemoryPathFingerprintLike {
  path: string;
  sha256: string;
  symbols?: Array<{ name: string; sha256: string }>;
}
interface MemoryPacketLike {
  id: string;
  type: string;
  status: string;
  confidence: number;
  updated_at: string;
  paths: string[];
  freshness?: { path_fingerprints?: MemoryPathFingerprintLike[] };
}

function memoryDir(projectDir: string): string {
  return join(projectDir, ".agent_memory");
}

function loadPackets(projectDir: string): MemoryPacketLike[] {
  return loadOkfConcepts(join(memoryDir(projectDir), "packets"), { projectDir }) as unknown as MemoryPacketLike[];
}

function loadStructuralFiles(projectDir: string): FileRow[] {
  const facts = readJsonSafe<StructuralFileFactLike[]>(join(memoryDir(projectDir), "structural", "files.json"), []);
  return facts.map((fact) => ({ path: fact.path, sha: fact.hash, mtime: fact.mtime_ms, kind: fact.kind, language: fact.language }));
}

function loadStructuralSymbols(projectDir: string): SymbolRow[] {
  const facts = readJsonSafe<StructuralSymbolFactLike[]>(join(memoryDir(projectDir), "structural", "symbols.json"), []);
  return facts.map((fact) => ({ id: fact.id, file: fact.path, name: fact.name, kind: fact.kind, sha: "" }));
}

function loadImportEdges(projectDir: string): ImportEdgeRow[] {
  const edges = readJsonSafe<CodeImportEdgeLike[]>(join(memoryDir(projectDir), "structural", "imports.json"), []);
  return edges.map((edge) => ({ fromFile: edge.from_path, toFile: edge.to_path, kind: edge.kind }));
}

function loadCallEdges(projectDir: string): CallEdgeRow[] {
  // No dedicated flat "today's file" exists for call edges (they live
  // compacted inside code_graph/graph.json, hydrated only by kernel.ts's
  // internal logic) -- if the JSON backend has already written its own
  // call-edges.json (see mcp/store/json.ts), reuse it; otherwise empty.
  return readJsonSafe<CallEdgeRow[]>(join(memoryDir(projectDir), "structural", "call-edges.json"), []);
}

function loadKgEntities(projectDir: string): KgEntityRow[] {
  const entities = readJsonSafe<GraphEntityLike[]>(join(memoryDir(projectDir), "graph", "entities.json"), []);
  return entities.map((entity) => ({ id: entity.id, kind: entity.type, label: entity.name }));
}

function loadKgEdges(projectDir: string): KgEdgeRow[] {
  const edges = readJsonSafe<GraphEdgeLike[]>(join(memoryDir(projectDir), "graph", "edges.json"), []);
  return edges.map((edge) => ({ fromId: edge.from, toId: edge.to, kind: edge.relation, weight: edge.confidence }));
}

function loadKgEpisodes(projectDir: string): KgEpisodeRow[] {
  const episodes = readJsonSafe<GraphEpisodeLike[]>(join(memoryDir(projectDir), "graph", "episodes.json"), []);
  return episodes.map((episode) => ({ id: episode.id, ts: episode.observed_at, summary: episode.summary }));
}

function loadDocsChunks(projectDir: string): Array<{ id: string; docPath: string; heading: string; body: string; anchor: string; line: number }> {
  const artifact = readJsonSafe<DocsIndexArtifactLike>(join(memoryDir(projectDir), "indexes", "docs-index.json"), { chunks: [] });
  // `${doc_path}#${anchor}` alone collides: a long section under one heading
  // splits into several DOCS_CHUNK_MAX_CHARS-sized chunks that all share the
  // same doc_path + anchor, so a bare doc_path#anchor id silently drops every
  // chunk but the last one on upsert -- the running index disambiguates.
  return artifact.chunks.map((chunk, index) => ({
    id: `${chunk.doc_path}#${chunk.anchor}#${index}`,
    docPath: chunk.doc_path,
    heading: chunk.heading,
    body: chunk.text,
    anchor: chunk.anchor,
    line: chunk.line,
  }));
}

function loadVectorDocuments(projectDir: string): SparseVectorDocumentLike[] {
  return readJsonSafe<SparseVectorIndexLike>(join(memoryDir(projectDir), "indexes", "vector-local.json"), { documents: [] }).documents;
}

function populate(backend: StoreBackend, projectDir: string): Record<string, number> {
  // Read every source artifact BEFORE reset(): JsonStoreBackend's on-disk
  // store *is* today's structural/graph/indexes files (see mcp/store/json.ts),
  // so reset()ing first and reading these same paths second would read back
  // the empty state reset() just wrote. Snapshotting the source in memory
  // first makes rebuildStore() correct for either backend.
  const files = loadStructuralFiles(projectDir);
  const symbols = loadStructuralSymbols(projectDir);
  const importEdges = loadImportEdges(projectDir);
  const callEdges = loadCallEdges(projectDir);
  const packets = loadPackets(projectDir);
  const docsChunks = loadDocsChunks(projectDir);
  const vectorDocuments = loadVectorDocuments(projectDir);
  const kgEntities = loadKgEntities(projectDir);
  const kgEdges = loadKgEdges(projectDir);
  const kgEpisodes = loadKgEpisodes(projectDir);

  const packetRows: PacketRow[] = packets.map((packet) => ({ id: packet.id, type: packet.type, status: packet.status, score: packet.confidence, updatedAt: packet.updated_at }));
  const pathRows: PacketPathRow[] = [];
  const symbolRows: PacketSymbolRow[] = [];
  for (const packet of packets) {
    const fingerprints = packet.freshness?.path_fingerprints ?? [];
    const fingerprintByPath = new Map(fingerprints.map((fingerprint) => [fingerprint.path, fingerprint]));
    for (const path of packet.paths) {
      const fingerprint = fingerprintByPath.get(path);
      pathRows.push({ packetId: packet.id, path, sha256: fingerprint?.sha256 ?? null });
      for (const symbol of fingerprint?.symbols ?? []) {
        symbolRows.push({ packetId: packet.id, symbol: symbol.name, sha256: symbol.sha256 ?? null });
      }
    }
  }

  backend.reset();

  backend.upsertFiles(files);
  backend.upsertSymbols(symbols);
  backend.upsertImportEdges(importEdges);
  backend.upsertCallEdges(callEdges);
  backend.upsertPackets(packetRows);
  backend.upsertPacketPaths(pathRows);
  backend.upsertPacketSymbols(symbolRows);
  // Bulk, not one upsert per doc/packet -- the JSON backend's upsert
  // contract is a whole-file rewrite per call (mcp/store/json.ts), so a
  // per-item loop over hundreds of chunks/packets would cost O(n) whole-
  // file rewrites on every rebuild instead of one.
  backend.replaceDocsFtsDocs(docsChunks.map((chunk) => ({ id: chunk.id, docPath: chunk.docPath, heading: chunk.heading, body: chunk.body, anchor: chunk.anchor, line: chunk.line })));
  backend.replaceVectorDocuments(
    vectorDocuments.map((document) => ({
      packetId: document.packet_id,
      terms: document.terms.map(([term, weight]): VectorChunkRow => ({ packetId: document.packet_id, term, weight })),
    })),
  );
  backend.upsertKgEntities(kgEntities);
  backend.upsertKgEdges(kgEdges);
  backend.upsertKgEpisodes(kgEpisodes);

  return backend.counts();
}

/**
 * Regenerates the entire derived store for `projectDir` from packets plus
 * today's structural/graph/docs/vector caches. Opens (or creates) the
 * store via openStore(), wipes it, repopulates every table, updates the
 * manifest's counts and last_rebuild_at, and closes the backend before
 * returning. Safe to call on a project that has never been indexed --
 * counts simply come back at 0 for whatever caches don't exist yet.
 */
export function rebuildStore(projectDir: string, opts: OpenStoreOptions = {}): RebuildResult {
  const { backend, manifest } = openStore(projectDir, opts);
  try {
    const counts = populate(backend, projectDir);
    const rebuiltAt = new Date().toISOString();
    writeManifest(projectDir, { ...(readManifest(projectDir) ?? manifest), counts, last_rebuild_at: rebuiltAt });
    return { backend: backend.kind, counts, rebuiltAt };
  } finally {
    backend.close();
  }
}
