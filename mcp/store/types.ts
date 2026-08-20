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
  id: string; // stable id for this chunk, e.g. `${doc_path}#${anchor}#${index}`
  docPath: string;
  heading: string;
  body: string;
  // Heading anchor and source line the chunk starts at. Optional so the M1
  // fixture literals that predate these fields keep compiling; a caller that
  // cares about byte-for-byte docs-index.json output or line-accurate search
  // results (M2's docs port) always sets both. Missing => "" / 0.
  anchor?: string;
  line?: number;
}

export interface DocsFtsHit {
  id: string;
  docPath: string;
  heading: string;
  body: string;
  anchor: string;
  line: number;
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
  // The L2 norm of packetId's FULL term vector (every term, not just this
  // candidate's), needed for cosine scoring -- a document's norm depends on
  // terms the query never asked about, so it cannot be derived from the
  // candidate rows alone. Same value repeated across every candidate row for
  // a given packetId.
  norm: number;
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
  /**
   * Returns every indexed chunk, unranked, optionally restricted to a
   * path-prefix scope on `docPath`. BM25 (mcp/kernel.ts's scoreDocsBm25)
   * needs the full corpus -- document frequency and average length are
   * corpus-wide stats, not just the chunks a single term happens to match
   * -- so this is a distinct read shape from queryDocsFts, the same way
   * listPackets/listFiles sit alongside their query*-by-something siblings.
   */
  listDocsFtsDocs(scope?: string): DocsFtsHit[];
  /**
   * Replaces the ENTIRE docs FTS corpus in one call: every existing chunk
   * is dropped and `docs` becomes the whole index. This is the bulk form
   * a full `kage refresh`-driven docs-index rebuild needs -- looping
   * upsertDocsFtsDoc once per chunk would cost the JSON backend one
   * whole-file rewrite per chunk (its upsert contract is read-modify-
   * write-the-whole-file, by design, see mcp/store/json.ts), which is
   * fine for a single upsert but quadratic across a full rebuild.
   */
  replaceDocsFtsDocs(docs: DocsFtsDoc[]): void;

  // -- vectors ---------------------------------------------------------------

  /** Replaces every vector chunk row for `packetId` with `terms`. */
  upsertVectorChunks(packetId: string, terms: VectorChunkRow[]): void;
  /**
   * Returns every (packetId, term, weight) row whose term is one of
   * `terms`, optionally restricted to a path-prefix scope resolved via
   * `packet_paths`. Callers combine these into a dot product / cosine
   * score themselves — this is retrieval, not ranking. Every row's `norm`
   * is packetId's full-document L2 norm (see VectorCandidate).
   */
  queryVectorCandidates(terms: string[], scope?: string): VectorCandidate[];
  /**
   * Returns every distinct packetId that has at least one vector row —
   * a cheap existence/freshness signal (no term hydration) a caller can
   * diff against the current approved-packet id set to decide whether
   * the persisted vector index still covers today's packets, the same
   * role the old vector-local.json's packet_count/generated_from_updated_at
   * fields played before the store existed.
   */
  listVectorPacketIds(): string[];
  /**
   * Replaces the ENTIRE vector index in one call, for the same bulk-
   * rewrite reason replaceDocsFtsDocs exists: a full packet re-index
   * upserting one packet's terms at a time would cost the JSON backend
   * one whole-file rewrite per packet. `generatedFromUpdatedAt` is
   * persisted by the JSON backend (it's part of vector-local.json's own
   * header, preserved for byte compatibility); the SQLite backend has no
   * single-file header to carry it in and ignores it, since its own
   * freshness signal is listVectorPacketIds(), not a stored timestamp.
   */
  replaceVectorDocuments(documents: Array<{ packetId: string; terms: VectorChunkRow[] }>, opts?: { generatedFromUpdatedAt?: string | null }): void;

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
