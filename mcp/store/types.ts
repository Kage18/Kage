// Kage's memory store: the StoreBackend seam.
//
// See docs/design/MEMORY_STORE.md. Packets under .agent_memory/packets/*.md
// remain the only source of truth. Everything a StoreBackend holds is a
// derived, rebuildable cache — deleting it and calling rebuildStore() must
// always be safe. There are two implementations: SqliteStoreBackend
// (mcp/store/sqlite.ts, used when node:sqlite is available) and
// JsonStoreBackend (mcp/store/json.ts, an adapter over today's
// indexes/structural/graph JSON files). M1 builds this seam only; nothing
// in mcp/kernel.ts reads or writes through it yet — that is M2/M3.

// --- Structural / code graph rows -----------------------------------------

export interface FileRow {
  path: string;
  sha: string;
  mtime: number;
  kind: string;
  language: string;
}

export interface SymbolRow {
  id: string;
  file: string;
  name: string;
  kind: string;
  sha: string;
}

export interface ImportEdgeRow {
  fromFile: string;
  toFile: string | null;
  kind: string;
}

export interface CallEdgeRow {
  fromSymbol: string | null;
  toSymbol: string;
  kind: string;
}

// --- Memory packet rows -----------------------------------------------------

export interface PacketRow {
  id: string;
  type: string;
  status: string;
  score: number | null;
  updatedAt: string;
}

export interface PacketPathRow {
  packetId: string;
  path: string;
  sha256: string | null;
}

export interface PacketSymbolRow {
  packetId: string;
  symbol: string;
  sha256: string | null;
}

// --- Docs FTS ----------------------------------------------------------------

export interface DocsFtsDoc {
  id: string; // stable id for this chunk, e.g. `${doc_path}#${anchor}`
  docPath: string;
  heading: string;
  body: string;
}

export interface DocsFtsHit {
  id: string;
  docPath: string;
  heading: string;
  body: string;
}

// --- Vectors -------------------------------------------------------------

export interface VectorChunkRow {
  packetId: string;
  term: string;
  weight: number;
}

export interface VectorCandidate {
  packetId: string;
  term: string;
  weight: number;
}

// --- Knowledge graph -------------------------------------------------------

export interface KgEntityRow {
  id: string;
  kind: string;
  label: string;
}

export interface KgEdgeRow {
  fromId: string;
  toId: string;
  kind: string;
  weight: number;
}

export interface KgEpisodeRow {
  id: string;
  ts: string;
  summary: string;
}

// --- Feature detection / manifest -------------------------------------------

export type BackendKind = "sqlite" | "json";

export interface DetectResult {
  available: boolean;
  reason: string;
}

export interface MigrationResult {
  fromVersion: number;
  toVersion: number;
  applied: boolean;
}

/**
 * StoreBackend is the one seam every derived-cache artifact in
 * docs/design/MEMORY_STORE.md goes through. Both implementations
 * (SqliteStoreBackend, JsonStoreBackend) must satisfy every method's
 * contract below identically from a caller's point of view — a caller
 * (M2/M3) must get the same rows back regardless of which backend is
 * open. Every list/query method accepts an optional `scope` — a path
 * prefix string — that restricts results to rows whose `path` (or, for
 * packets, whose linked path) starts with that prefix. Passing no scope
 * (or "") returns everything.
 */
export interface StoreBackend {
  readonly kind: BackendKind;

  /**
   * Opens the backend against `projectDir`, creating whatever on-disk
   * state it needs (a `.sqlite` file, or the JSON directories) if absent.
   * Must be called before any other method. Calling open() twice on an
   * already-open backend is a no-op.
   */
  open(projectDir: string): void;

  /**
   * Releases any file handles/connections. Safe to call on a backend
   * that was never opened, or twice in a row. After close(), open() may
   * be called again (e.g. to reopen and verify persisted state).
   */
  close(): void;

  /**
   * Brings the backend's on-disk schema up to the current schema version.
   * Forward-only: never downgrades, never drops data outside what a
   * version bump requires. Idempotent — calling migrate() again once the
   * schema is current does no work and reports `applied: false`.
   */
  migrate(): MigrationResult;

  /**
   * Wipes every row this backend holds (files, symbols, edges, packets,
   * docs, vectors, kg) back to empty, without dropping the schema itself.
   * This is what makes rebuildStore() (mcp/store/rebuild.ts) a true
   * "regenerate the entire derived store" rather than an accumulate-only
   * upsert pass — a row for a file/packet that no longer exists on disk
   * must not survive a rebuild.
   */
  reset(): void;

  // -- files / symbols / edges ------------------------------------------

  /** Upserts file rows keyed by `path`. Last write wins per path. */
  upsertFiles(files: FileRow[]): void;
  /** Returns the row for `path`, or null if this backend has never seen it. */
  getFile(path: string): FileRow | null;
  /** Returns every known file, optionally restricted to a path-prefix scope. */
  listFiles(scope?: string): FileRow[];

  /** Upserts symbol rows keyed by `id`. Last write wins per id. */
  upsertSymbols(symbols: SymbolRow[]): void;
  /** Returns every symbol whose `file` equals `path` exactly. */
  listSymbolsForFile(path: string): SymbolRow[];
  /** Returns every known symbol, optionally restricted to a path-prefix scope on `file`. */
  listSymbols(scope?: string): SymbolRow[];

  /** Appends import edges. Not deduplicated -- calling with the same row twice inserts it twice; callers that reset() before a full pass (e.g. rebuildStore) never see this. */
  upsertImportEdges(edges: ImportEdgeRow[]): void;
  /** Returns import edges, optionally restricted to a path-prefix scope on `fromFile`. */
  listImportEdges(scope?: string): ImportEdgeRow[];

  /** Appends call edges. Not deduplicated, for the same reason as upsertImportEdges. */
  upsertCallEdges(edges: CallEdgeRow[]): void;
  /** Returns call edges, optionally restricted to a symbol-id-prefix scope on `fromSymbol`. */
  listCallEdges(scope?: string): CallEdgeRow[];

  // -- packets -------------------------------------------------------------

  /** Upserts packet rows keyed by `id`. Last write wins per id. */
  upsertPackets(packets: PacketRow[]): void;
  /** Returns the row for `id`, or null if this backend has never seen it. */
  getPacket(id: string): PacketRow | null;
  /** Returns every known packet, optionally restricted to packets with at least one path under `scope`. */
  listPackets(scope?: string): PacketRow[];

  /** Upserts (packetId, path) links, keyed by the (packetId, path) pair -- last write wins per pair. A packet may cite many paths; a path may be cited by many packets. */
  upsertPacketPaths(rows: PacketPathRow[]): void;
  /** Upserts (packetId, symbol) links, mirroring upsertPacketPaths (keyed by the (packetId, symbol) pair) for per-symbol citations. */
  upsertPacketSymbols(rows: PacketSymbolRow[]): void;

  /**
   * The indexed join that replaces both the never-read `indexes/by-path.json`
   * and the in-memory `.filter()` pattern kernel.ts's path-scoped call sites
   * use today: every packet id with a `packet_paths` row whose `path` equals
   * `path` exactly.
   */
  queryPacketsByPath(path: string): string[];

  // -- docs full-text search -------------------------------------------------

  /** Upserts a docs chunk keyed by `id`. Last write wins per id. */
  upsertDocsFtsDoc(doc: DocsFtsDoc): void;
  /**
   * Returns every indexed chunk whose body or heading contains `term`
   * (case-insensitive token match), optionally restricted to a
   * path-prefix scope on `docPath`. This is retrieval only — it does not
   * rank results; BM25 scoring over the returned rows is the caller's
   * job (docs/design/MEMORY_STORE.md, "Query semantics, preserved
   * exactly").
   */
  queryDocsFts(term: string, scope?: string): DocsFtsHit[];

  // -- vectors ---------------------------------------------------------------

  /** Replaces every vector chunk row for `packetId` with `terms`. */
  upsertVectorChunks(packetId: string, terms: VectorChunkRow[]): void;
  /**
   * Returns every (packetId, term, weight) row whose term is one of
   * `terms`, optionally restricted to a path-prefix scope resolved via
   * `packet_paths`. Callers combine these into a dot product / cosine
   * score themselves — this is retrieval, not ranking.
   */
  queryVectorCandidates(terms: string[], scope?: string): VectorCandidate[];

  // -- knowledge graph ---------------------------------------------------------

  /** Upserts knowledge-graph entity rows keyed by `id`. */
  upsertKgEntities(entities: KgEntityRow[]): void;
  /** Returns the entity row for `id`, or null. */
  getKgEntity(id: string): KgEntityRow | null;
  /** Returns every known entity. */
  listKgEntities(): KgEntityRow[];

  /** Appends knowledge-graph edge rows. Not deduplicated, for the same reason as upsertImportEdges. */
  upsertKgEdges(edges: KgEdgeRow[]): void;
  /** Returns every edge touching `entityId` as either endpoint. */
  getKgEdges(entityId: string): KgEdgeRow[];

  /** Upserts knowledge-graph episode rows keyed by `id`. */
  upsertKgEpisodes(episodes: KgEpisodeRow[]): void;
  /** Returns every known episode. */
  listKgEpisodes(): KgEpisodeRow[];

  // -- counts, for the manifest and `kage store status` (M2) ------------------

  /** Row counts per table, keyed by the table name as it appears in the schema. */
  counts(): Record<string, number>;
}
