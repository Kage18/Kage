// SqliteStoreBackend: the node:sqlite implementation of StoreBackend
// (see mcp/store/types.ts and docs/design/MEMORY_STORE.md, Law 2).
//
// node:sqlite did not exist before Node 22.5.0 and mcp/package.json's
// `engines` field promises >=18, so its absence is a normal, expected
// runtime state, not an error condition -- detect() below reports that
// state instead of throwing, and nothing in this module (or its import)
// requires node:sqlite to exist. Callers pick JsonStoreBackend
// (mcp/store/json.ts) when detect().available is false.
//
// TypeScript is not asked to resolve `node:sqlite`'s own .d.ts here --
// the interfaces below are a narrow local declaration of exactly the
// surface this file uses, so this module compiles the same whether or
// not @types/node happens to ship sqlite typings.

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  BackendKind,
  CallEdgeRow,
  DetectResult,
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

// --- narrow local declaration of the node:sqlite surface this file uses ----

interface NodeSqliteStatement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  all(...params: unknown[]): Array<Record<string, unknown>>;
  get(...params: unknown[]): Record<string, unknown> | undefined;
}

interface NodeSqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): NodeSqliteStatement;
  close(): void;
}

interface NodeSqliteModule {
  DatabaseSync: new (path: string, options?: { open?: boolean; readOnly?: boolean }) => NodeSqliteDatabase;
}

export type RequireFn = (id: string) => unknown;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeRequire: RequireFn = require;

/**
 * Feature-detects node:sqlite (with a working FTS5 virtual table -- some
 * builds ship the module without FTS5 compiled in) on the running Node.
 * Never throws; reports {available:false, reason} instead. Pure and
 * uncached by design -- callers that want the "probed once at daemon
 * start" behaviour docs/design/MEMORY_STORE.md describes own that
 * caching themselves (M2). `requireFn` is an injectable seam so tests can
 * force the "absent" path without needing an actual pre-22.5 Node.
 */
export function detect(requireFn: RequireFn = nodeRequire): DetectResult {
  let mod: NodeSqliteModule;
  try {
    mod = requireFn("node:sqlite") as NodeSqliteModule;
  } catch (error) {
    return { available: false, reason: `node:sqlite is not available on this Node: ${errorMessage(error)}` };
  }
  if (!mod || typeof mod.DatabaseSync !== "function") {
    return { available: false, reason: "node:sqlite loaded but does not export DatabaseSync" };
  }
  try {
    const probe = new mod.DatabaseSync(":memory:");
    try {
      probe.exec("CREATE VIRTUAL TABLE __kage_store_probe USING fts5(body)");
    } finally {
      probe.close();
    }
  } catch (error) {
    return { available: false, reason: `node:sqlite is present but FTS5 failed to load: ${errorMessage(error)}` };
  }
  return { available: true, reason: "node:sqlite with FTS5 is available" };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// v2 (M2, docs/design/MEMORY_STORE.md): docs_fts grows anchor/line columns so
// the sqlite backend can return line-accurate search hits and reconstruct
// docs-index.json's chunk shape, the same fields the JSON backend always had.
export const SCHEMA_VERSION = 2;

export function sqliteStorePath(projectDir: string): string {
  return join(projectDir, ".agent_memory", "store", "kage.sqlite");
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS schema_meta(key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, sha TEXT, mtime INTEGER, kind TEXT, language TEXT)`,
  `CREATE TABLE IF NOT EXISTS symbols(id TEXT PRIMARY KEY, file TEXT, name TEXT, kind TEXT, sha TEXT)`,
  `CREATE INDEX IF NOT EXISTS symbols_file ON symbols(file)`,
  `CREATE TABLE IF NOT EXISTS import_edges(from_file TEXT, to_file TEXT, kind TEXT)`,
  `CREATE INDEX IF NOT EXISTS import_edges_from ON import_edges(from_file)`,
  `CREATE TABLE IF NOT EXISTS call_edges(from_symbol TEXT, to_symbol TEXT, kind TEXT)`,
  `CREATE INDEX IF NOT EXISTS call_edges_from ON call_edges(from_symbol)`,
  `CREATE TABLE IF NOT EXISTS packets(id TEXT PRIMARY KEY, type TEXT, status TEXT, score REAL, updated_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS packet_paths(packet_id TEXT, path TEXT, sha256 TEXT, UNIQUE(packet_id, path))`,
  `CREATE INDEX IF NOT EXISTS packet_paths_path ON packet_paths(path)`,
  `CREATE INDEX IF NOT EXISTS packet_paths_packet ON packet_paths(packet_id)`,
  `CREATE TABLE IF NOT EXISTS packet_symbols(packet_id TEXT, symbol TEXT, sha256 TEXT, UNIQUE(packet_id, symbol))`,
  `CREATE INDEX IF NOT EXISTS packet_symbols_packet ON packet_symbols(packet_id)`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(id UNINDEXED, doc_path UNINDEXED, anchor UNINDEXED, line UNINDEXED, heading, body)`,
  `CREATE TABLE IF NOT EXISTS vectors(packet_id TEXT, term TEXT, weight REAL)`,
  `CREATE INDEX IF NOT EXISTS vectors_packet ON vectors(packet_id)`,
  `CREATE INDEX IF NOT EXISTS vectors_term ON vectors(term)`,
  `CREATE TABLE IF NOT EXISTS kg_entities(id TEXT PRIMARY KEY, kind TEXT, label TEXT)`,
  `CREATE TABLE IF NOT EXISTS kg_edges(from_id TEXT, to_id TEXT, kind TEXT, weight REAL)`,
  `CREATE INDEX IF NOT EXISTS kg_edges_from ON kg_edges(from_id)`,
  `CREATE INDEX IF NOT EXISTS kg_edges_to ON kg_edges(to_id)`,
  `CREATE TABLE IF NOT EXISTS kg_episodes(id TEXT PRIMARY KEY, ts TEXT, summary TEXT)`,
];

const COUNTED_TABLES = [
  "files",
  "symbols",
  "import_edges",
  "call_edges",
  "packets",
  "packet_paths",
  "packet_symbols",
  "docs_fts",
  "vectors",
  "kg_entities",
  "kg_edges",
  "kg_episodes",
];

export class SqliteStoreBackend implements StoreBackend {
  readonly kind: BackendKind = "sqlite";
  private db: NodeSqliteDatabase | null = null;
  private requireFn: RequireFn;

  constructor(requireFn: RequireFn = nodeRequire) {
    this.requireFn = requireFn;
  }

  open(projectDir: string): void {
    if (this.db) return;
    const path = sqliteStorePath(projectDir);
    mkdirSync(dirname(path), { recursive: true });
    const mod = this.requireFn("node:sqlite") as NodeSqliteModule;
    this.db = new mod.DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.migrate();
  }

  close(): void {
    if (!this.db) return;
    this.db.close();
    this.db = null;
  }

  private conn(): NodeSqliteDatabase {
    if (!this.db) throw new Error("SqliteStoreBackend: open(projectDir) must be called before use");
    return this.db;
  }

  migrate(): MigrationResult {
    const db = this.conn();
    db.exec(SCHEMA_STATEMENTS[0]); // schema_meta must exist before we can read the version
    const row = db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get();
    const fromVersion = row ? Number(row.value) : 0;
    if (fromVersion >= SCHEMA_VERSION) {
      return { fromVersion, toVersion: fromVersion, applied: false };
    }
    // v1 -> v2 (M2): docs_fts's old shape has no anchor/line columns. FTS5
    // doesn't support ALTER TABLE ADD COLUMN, so widen it by dropping and
    // recreating -- always safe per Law 1, this whole store is a disposable
    // derived cache the next kage refresh / kage store rebuild repopulates.
    if (fromVersion >= 1 && fromVersion < 2) db.exec("DROP TABLE IF EXISTS docs_fts");
    for (const statement of SCHEMA_STATEMENTS) db.exec(statement);
    db.prepare("INSERT INTO schema_meta(key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
      String(SCHEMA_VERSION),
    );
    return { fromVersion, toVersion: SCHEMA_VERSION, applied: true };
  }

  reset(): void {
    const db = this.conn();
    for (const table of COUNTED_TABLES) db.exec(`DELETE FROM ${table}`);
  }

  // -- files / symbols / edges ----------------------------------------------

  upsertFiles(files: FileRow[]): void {
    const stmt = this.conn().prepare(
      "INSERT INTO files(path, sha, mtime, kind, language) VALUES (?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET sha=excluded.sha, mtime=excluded.mtime, kind=excluded.kind, language=excluded.language",
    );
    for (const file of files) stmt.run(file.path, file.sha, file.mtime, file.kind, file.language);
  }

  getFile(path: string): FileRow | null {
    const row = this.conn().prepare("SELECT path, sha, mtime, kind, language FROM files WHERE path = ?").get(path);
    return row ? rowToFile(row) : null;
  }

  listFiles(scope?: string): FileRow[] {
    const rows = scope
      ? this.conn().prepare("SELECT path, sha, mtime, kind, language FROM files WHERE path LIKE ? ORDER BY path").all(likePrefix(scope))
      : this.conn().prepare("SELECT path, sha, mtime, kind, language FROM files ORDER BY path").all();
    return rows.map(rowToFile);
  }

  upsertSymbols(symbols: SymbolRow[]): void {
    const stmt = this.conn().prepare(
      "INSERT INTO symbols(id, file, name, kind, sha) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET file=excluded.file, name=excluded.name, kind=excluded.kind, sha=excluded.sha",
    );
    for (const symbol of symbols) stmt.run(symbol.id, symbol.file, symbol.name, symbol.kind, symbol.sha);
  }

  listSymbolsForFile(path: string): SymbolRow[] {
    return this.conn().prepare("SELECT id, file, name, kind, sha FROM symbols WHERE file = ? ORDER BY id").all(path).map(rowToSymbol);
  }

  listSymbols(scope?: string): SymbolRow[] {
    const rows = scope
      ? this.conn().prepare("SELECT id, file, name, kind, sha FROM symbols WHERE file LIKE ? ORDER BY id").all(likePrefix(scope))
      : this.conn().prepare("SELECT id, file, name, kind, sha FROM symbols ORDER BY id").all();
    return rows.map(rowToSymbol);
  }

  upsertImportEdges(edges: ImportEdgeRow[]): void {
    const stmt = this.conn().prepare("INSERT INTO import_edges(from_file, to_file, kind) VALUES (?, ?, ?)");
    for (const edge of edges) stmt.run(edge.fromFile, edge.toFile, edge.kind);
  }

  listImportEdges(scope?: string): ImportEdgeRow[] {
    const rows = scope
      ? this.conn().prepare("SELECT from_file, to_file, kind FROM import_edges WHERE from_file LIKE ?").all(likePrefix(scope))
      : this.conn().prepare("SELECT from_file, to_file, kind FROM import_edges").all();
    return rows.map(rowToImportEdge);
  }

  upsertCallEdges(edges: CallEdgeRow[]): void {
    const stmt = this.conn().prepare("INSERT INTO call_edges(from_symbol, to_symbol, kind) VALUES (?, ?, ?)");
    for (const edge of edges) stmt.run(edge.fromSymbol, edge.toSymbol, edge.kind);
  }

  listCallEdges(scope?: string): CallEdgeRow[] {
    const rows = scope
      ? this.conn().prepare("SELECT from_symbol, to_symbol, kind FROM call_edges WHERE from_symbol LIKE ?").all(likePrefix(scope))
      : this.conn().prepare("SELECT from_symbol, to_symbol, kind FROM call_edges").all();
    return rows.map(rowToCallEdge);
  }

  replaceFileGraphRows(entries: Array<{ file: FileRow; symbols: SymbolRow[]; importEdges: ImportEdgeRow[] }>): void {
    const db = this.conn();
    db.exec("BEGIN");
    try {
      const fileStmt = db.prepare(
        "INSERT INTO files(path, sha, mtime, kind, language) VALUES (?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET sha=excluded.sha, mtime=excluded.mtime, kind=excluded.kind, language=excluded.language",
      );
      const deleteSymbolsStmt = db.prepare("DELETE FROM symbols WHERE file = ?");
      const deleteImportsStmt = db.prepare("DELETE FROM import_edges WHERE from_file = ?");
      const symbolStmt = db.prepare(
        "INSERT INTO symbols(id, file, name, kind, sha) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET file=excluded.file, name=excluded.name, kind=excluded.kind, sha=excluded.sha",
      );
      const importStmt = db.prepare("INSERT INTO import_edges(from_file, to_file, kind) VALUES (?, ?, ?)");
      for (const entry of entries) {
        fileStmt.run(entry.file.path, entry.file.sha, entry.file.mtime, entry.file.kind, entry.file.language);
        deleteSymbolsStmt.run(entry.file.path);
        deleteImportsStmt.run(entry.file.path);
        for (const symbol of entry.symbols) symbolStmt.run(symbol.id, symbol.file, symbol.name, symbol.kind, symbol.sha);
        for (const edge of entry.importEdges) importStmt.run(edge.fromFile, edge.toFile, edge.kind);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  replaceCallEdgesForRepo(edges: CallEdgeRow[]): void {
    const db = this.conn();
    db.exec("BEGIN");
    try {
      db.exec("DELETE FROM call_edges");
      const stmt = db.prepare("INSERT INTO call_edges(from_symbol, to_symbol, kind) VALUES (?, ?, ?)");
      for (const edge of edges) stmt.run(edge.fromSymbol, edge.toSymbol, edge.kind);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  // -- packets ---------------------------------------------------------------

  upsertPackets(packets: PacketRow[]): void {
    const stmt = this.conn().prepare(
      "INSERT INTO packets(id, type, status, score, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET type=excluded.type, status=excluded.status, score=excluded.score, updated_at=excluded.updated_at",
    );
    for (const packet of packets) stmt.run(packet.id, packet.type, packet.status, packet.score, packet.updatedAt);
  }

  getPacket(id: string): PacketRow | null {
    const row = this.conn().prepare("SELECT id, type, status, score, updated_at FROM packets WHERE id = ?").get(id);
    return row ? rowToPacket(row) : null;
  }

  listPackets(scope?: string): PacketRow[] {
    if (!scope) return this.conn().prepare("SELECT id, type, status, score, updated_at FROM packets ORDER BY id").all().map(rowToPacket);
    const rows = this.conn()
      .prepare(
        "SELECT DISTINCT p.id, p.type, p.status, p.score, p.updated_at FROM packets p JOIN packet_paths pp ON pp.packet_id = p.id WHERE pp.path LIKE ? ORDER BY p.id",
      )
      .all(likePrefix(scope));
    return rows.map(rowToPacket);
  }

  upsertPacketPaths(rows: PacketPathRow[]): void {
    const stmt = this.conn().prepare(
      "INSERT INTO packet_paths(packet_id, path, sha256) VALUES (?, ?, ?) ON CONFLICT(packet_id, path) DO UPDATE SET sha256=excluded.sha256",
    );
    for (const row of rows) stmt.run(row.packetId, row.path, row.sha256);
  }

  upsertPacketSymbols(rows: PacketSymbolRow[]): void {
    const stmt = this.conn().prepare(
      "INSERT INTO packet_symbols(packet_id, symbol, sha256) VALUES (?, ?, ?) ON CONFLICT(packet_id, symbol) DO UPDATE SET sha256=excluded.sha256",
    );
    for (const row of rows) stmt.run(row.packetId, row.symbol, row.sha256);
  }

  queryPacketsByPath(path: string): string[] {
    const rows = this.conn().prepare("SELECT DISTINCT packet_id FROM packet_paths WHERE path = ? ORDER BY packet_id").all(path);
    return rows.map((row) => String(row.packet_id));
  }

  // -- docs full-text search --------------------------------------------------

  upsertDocsFtsDoc(doc: DocsFtsDoc): void {
    const db = this.conn();
    db.prepare("DELETE FROM docs_fts WHERE id = ?").run(doc.id);
    db.prepare("INSERT INTO docs_fts(id, doc_path, anchor, line, heading, body) VALUES (?, ?, ?, ?, ?, ?)").run(
      doc.id,
      doc.docPath,
      doc.anchor ?? "",
      doc.line ?? 0,
      doc.heading,
      doc.body,
    );
  }

  queryDocsFts(term: string, scope?: string): DocsFtsHit[] {
    const escaped = ftsMatchTerm(term);
    if (!escaped) return [];
    const rows = scope
      ? this.conn()
          .prepare("SELECT id, doc_path, anchor, line, heading, body FROM docs_fts WHERE docs_fts MATCH ? AND doc_path LIKE ?")
          .all(escaped, likePrefix(scope))
      : this.conn().prepare("SELECT id, doc_path, anchor, line, heading, body FROM docs_fts WHERE docs_fts MATCH ?").all(escaped);
    return rows.map(rowToDocsHit);
  }

  listDocsFtsDocs(scope?: string): DocsFtsHit[] {
    const rows = scope
      ? this.conn().prepare("SELECT id, doc_path, anchor, line, heading, body FROM docs_fts WHERE doc_path LIKE ?").all(likePrefix(scope))
      : this.conn().prepare("SELECT id, doc_path, anchor, line, heading, body FROM docs_fts").all();
    return rows.map(rowToDocsHit);
  }

  replaceDocsFtsDocs(docs: DocsFtsDoc[]): void {
    const db = this.conn();
    db.exec("BEGIN");
    try {
      db.exec("DELETE FROM docs_fts");
      const stmt = db.prepare("INSERT INTO docs_fts(id, doc_path, anchor, line, heading, body) VALUES (?, ?, ?, ?, ?, ?)");
      for (const doc of docs) stmt.run(doc.id, doc.docPath, doc.anchor ?? "", doc.line ?? 0, doc.heading, doc.body);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  // -- vectors -----------------------------------------------------------------

  upsertVectorChunks(packetId: string, terms: VectorChunkRow[]): void {
    const db = this.conn();
    db.prepare("DELETE FROM vectors WHERE packet_id = ?").run(packetId);
    const stmt = db.prepare("INSERT INTO vectors(packet_id, term, weight) VALUES (?, ?, ?)");
    for (const term of terms) stmt.run(packetId, term.term, term.weight);
  }

  queryVectorCandidates(terms: string[], scope?: string): VectorCandidate[] {
    if (!terms.length) return [];
    const placeholders = terms.map(() => "?").join(", ");
    // A packet can cite several paths, so a JOIN against packet_paths would
    // fan a single vector row out once per matching path -- EXISTS is a
    // semi-join, it can only keep or drop a vectors row, never multiply it.
    const rows = scope
      ? this.conn()
          .prepare(
            `SELECT packet_id, term, weight FROM vectors v WHERE term IN (${placeholders}) AND EXISTS (SELECT 1 FROM packet_paths pp WHERE pp.packet_id = v.packet_id AND pp.path LIKE ?)`,
          )
          .all(...terms, likePrefix(scope))
      : this.conn().prepare(`SELECT packet_id, term, weight FROM vectors WHERE term IN (${placeholders})`).all(...terms);
    if (!rows.length) return [];
    // A document's L2 norm depends on EVERY term it has, not just the ones
    // that matched the query, so it is computed from the full vectors table
    // per packetId here rather than carried on upsertVectorChunks's rows.
    const packetIds = [...new Set(rows.map((row) => String(row.packet_id)))];
    const normPlaceholders = packetIds.map(() => "?").join(", ");
    const normRows = this.conn()
      .prepare(`SELECT packet_id, SUM(weight * weight) AS sumsq FROM vectors WHERE packet_id IN (${normPlaceholders}) GROUP BY packet_id`)
      .all(...packetIds);
    const normByPacket = new Map(normRows.map((row) => [String(row.packet_id), Math.sqrt(Number(row.sumsq ?? 0))]));
    return rows.map((row) => rowToVectorCandidate(row, normByPacket.get(String(row.packet_id)) ?? 0));
  }

  listVectorPacketIds(): string[] {
    const rows = this.conn().prepare("SELECT DISTINCT packet_id FROM vectors ORDER BY packet_id").all();
    return rows.map((row) => String(row.packet_id));
  }

  // opts.generatedFromUpdatedAt is unused here: sqlite has no single-file
  // header to carry it in, and this backend's own freshness signal is
  // listVectorPacketIds(), not a stored timestamp (see StoreBackend's doc).
  replaceVectorDocuments(documents: Array<{ packetId: string; terms: VectorChunkRow[] }>): void {
    const db = this.conn();
    db.exec("BEGIN");
    try {
      db.exec("DELETE FROM vectors");
      const stmt = db.prepare("INSERT INTO vectors(packet_id, term, weight) VALUES (?, ?, ?)");
      for (const document of documents) {
        for (const term of document.terms) stmt.run(document.packetId, term.term, term.weight);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  // -- knowledge graph -----------------------------------------------------------

  upsertKgEntities(entities: KgEntityRow[]): void {
    const stmt = this.conn().prepare(
      "INSERT INTO kg_entities(id, kind, label) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, label=excluded.label",
    );
    for (const entity of entities) stmt.run(entity.id, entity.kind, entity.label);
  }

  getKgEntity(id: string): KgEntityRow | null {
    const row = this.conn().prepare("SELECT id, kind, label FROM kg_entities WHERE id = ?").get(id);
    return row ? rowToKgEntity(row) : null;
  }

  listKgEntities(): KgEntityRow[] {
    return this.conn().prepare("SELECT id, kind, label FROM kg_entities ORDER BY id").all().map(rowToKgEntity);
  }

  upsertKgEdges(edges: KgEdgeRow[]): void {
    const stmt = this.conn().prepare("INSERT INTO kg_edges(from_id, to_id, kind, weight) VALUES (?, ?, ?, ?)");
    for (const edge of edges) stmt.run(edge.fromId, edge.toId, edge.kind, edge.weight);
  }

  getKgEdges(entityId: string): KgEdgeRow[] {
    const rows = this.conn().prepare("SELECT from_id, to_id, kind, weight FROM kg_edges WHERE from_id = ? OR to_id = ?").all(entityId, entityId);
    return rows.map(rowToKgEdge);
  }

  // Indexed `IN (...)` scan over kg_edges_from/kg_edges_to (SCHEMA_STATEMENTS
  // above) -- one query for the whole entity set, never a full-table load.
  queryKgEdgesForEntities(entityIds: string[]): KgEdgeRow[] {
    if (!entityIds.length) return [];
    const placeholders = entityIds.map(() => "?").join(", ");
    const rows = this.conn()
      .prepare(`SELECT from_id, to_id, kind, weight FROM kg_edges WHERE from_id IN (${placeholders}) OR to_id IN (${placeholders})`)
      .all(...entityIds, ...entityIds);
    return rows.map(rowToKgEdge);
  }

  upsertKgEpisodes(episodes: KgEpisodeRow[]): void {
    const stmt = this.conn().prepare(
      "INSERT INTO kg_episodes(id, ts, summary) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET ts=excluded.ts, summary=excluded.summary",
    );
    for (const episode of episodes) stmt.run(episode.id, episode.ts, episode.summary);
  }

  listKgEpisodes(): KgEpisodeRow[] {
    return this.conn().prepare("SELECT id, ts, summary FROM kg_episodes ORDER BY id").all().map(rowToKgEpisode);
  }

  replaceKnowledgeGraph(entities: KgEntityRow[], edges: KgEdgeRow[], episodes: KgEpisodeRow[]): void {
    const db = this.conn();
    db.exec("BEGIN");
    try {
      db.exec("DELETE FROM kg_entities");
      db.exec("DELETE FROM kg_edges");
      db.exec("DELETE FROM kg_episodes");
      const entityStmt = db.prepare("INSERT INTO kg_entities(id, kind, label) VALUES (?, ?, ?)");
      for (const entity of entities) entityStmt.run(entity.id, entity.kind, entity.label);
      const edgeStmt = db.prepare("INSERT INTO kg_edges(from_id, to_id, kind, weight) VALUES (?, ?, ?, ?)");
      for (const edge of edges) edgeStmt.run(edge.fromId, edge.toId, edge.kind, edge.weight);
      const episodeStmt = db.prepare("INSERT INTO kg_episodes(id, ts, summary) VALUES (?, ?, ?)");
      for (const episode of episodes) episodeStmt.run(episode.id, episode.ts, episode.summary);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  // -- counts ---------------------------------------------------------------------

  counts(): Record<string, number> {
    const db = this.conn();
    const result: Record<string, number> = {};
    for (const table of COUNTED_TABLES) {
      const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
      result[table] = row ? Number(row.n) : 0;
    }
    return result;
  }
}

function likePrefix(scope: string): string {
  return `${scope}%`;
}

// FTS5 MATCH treats its argument as a query expression, not a literal
// string -- wrap the term in double quotes so punctuation in a search
// term (e.g. "node:sqlite") doesn't get parsed as FTS5 query syntax.
function ftsMatchTerm(term: string): string | null {
  const trimmed = term.trim();
  if (!trimmed) return null;
  return `"${trimmed.replace(/"/g, '""')}"`;
}

function rowToFile(row: Record<string, unknown>): FileRow {
  return { path: String(row.path), sha: String(row.sha ?? ""), mtime: Number(row.mtime ?? 0), kind: String(row.kind ?? ""), language: String(row.language ?? "") };
}

function rowToSymbol(row: Record<string, unknown>): SymbolRow {
  return { id: String(row.id), file: String(row.file ?? ""), name: String(row.name ?? ""), kind: String(row.kind ?? ""), sha: String(row.sha ?? "") };
}

function rowToImportEdge(row: Record<string, unknown>): ImportEdgeRow {
  return { fromFile: String(row.from_file), toFile: row.to_file === null || row.to_file === undefined ? null : String(row.to_file), kind: String(row.kind ?? "") };
}

function rowToCallEdge(row: Record<string, unknown>): CallEdgeRow {
  return { fromSymbol: row.from_symbol === null || row.from_symbol === undefined ? null : String(row.from_symbol), toSymbol: String(row.to_symbol), kind: String(row.kind ?? "") };
}

function rowToPacket(row: Record<string, unknown>): PacketRow {
  return {
    id: String(row.id),
    type: String(row.type ?? ""),
    status: String(row.status ?? ""),
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function rowToDocsHit(row: Record<string, unknown>): DocsFtsHit {
  return {
    id: String(row.id),
    docPath: String(row.doc_path ?? ""),
    heading: String(row.heading ?? ""),
    body: String(row.body ?? ""),
    anchor: String(row.anchor ?? ""),
    line: Number(row.line ?? 0),
  };
}

function rowToVectorCandidate(row: Record<string, unknown>, norm: number): VectorCandidate {
  return { packetId: String(row.packet_id), term: String(row.term ?? ""), weight: Number(row.weight ?? 0), norm };
}

function rowToKgEntity(row: Record<string, unknown>): KgEntityRow {
  return { id: String(row.id), kind: String(row.kind ?? ""), label: String(row.label ?? "") };
}

function rowToKgEdge(row: Record<string, unknown>): KgEdgeRow {
  return { fromId: String(row.from_id), toId: String(row.to_id), kind: String(row.kind ?? ""), weight: Number(row.weight ?? 0) };
}

function rowToKgEpisode(row: Record<string, unknown>): KgEpisodeRow {
  return { id: String(row.id), ts: String(row.ts ?? ""), summary: String(row.summary ?? "") };
}

export function sqliteStoreExists(projectDir: string): boolean {
  return existsSync(sqliteStorePath(projectDir));
}
