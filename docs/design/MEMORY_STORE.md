# Kage's Memory Store

*Design proposed 2026-08-20, written against the delegation layer locked in
`KAGE_DELEGATION_DESIGN.md` (2026-08-12) and the honesty register `CONTEXT_ENGINE.md`
and `SESSIONS_SURFACE.md` (both landed the same day). Specifies what replaces the flat
JSON files under `.agent_memory/` — the derived cache every recall, code-graph query,
and staleness check reads and rewrites today — without moving the source of truth,
without adding a dependency, and without adding a server. Every "exists" below was
grepped and measured against this repo's own numbers, not assumed; every number is
timestamped to when it was measured, because this repo's own derived layer changes
under an agent mid-session.*

## One line

**Kage's memory is markdown in git; its performance is JSON on disk. That JSON is a
derived cache that is fully rewritten on every refresh and fully `JSON.parse`d into
one Node heap on every read — a design that costs nothing at 136 files and fails
outright at file counts an ordinary monorepo already has. `node:sqlite`, feature-detected
and used only as a cache, buys back the years this budget has left, without moving the
source of truth or adding a single dependency.**

## The problem, measured on this repo, 2026-08-20

Every non-`.md` artifact under `.agent_memory/` is written by one function,
`writeJson` (`mcp/kernel.ts:2619`):

```ts
function writeJson(path: string, value: unknown): void {
  ensureDir(dirname(path));
  if (path.endsWith(".md")) {
    writeFileSync(path, packetToOkfConcept(value as MemoryPacket), "utf8");
    return;
  }
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
```

and read back by its mirror, `readJson` (`mcp/kernel.ts:2607`): `JSON.parse(readFileSync(path,
"utf8"))`. There is no partial write and no partial read anywhere in this pair — every
call is the whole file, every time. Measured on this worktree right now:

| Artifact | Bytes | What's in it |
|---|---|---|
| `.agent_memory/graph/edges.json` | 8,067,376 | knowledge-graph edges |
| `.agent_memory/indexes/vector-local.json` | 5,578,813 | sparse-vector recall index |
| `.agent_memory/structural/symbols.json` | 2,991,966 | 7,413 code symbols |
| `.agent_memory/structural/file-cache.json` | 2,707,706 | packed per-file parse cache |
| `.agent_memory/structural/edges.json` | 2,315,104 | 8,310 structural edges |
| `.agent_memory/code_graph/graph.json` | 2,276,440 | compact code-graph artifact |
| `.agent_memory/graph/entities.json` | 1,852,274 | knowledge-graph entities |
| `.agent_memory/indexes/docs-index.json` | 886,247 | BM25 doc-search chunks |
| `.agent_memory/indexes/catalog.json` | 859,539 | packet catalog |
| `.agent_memory/graph/episodes.json` | 545,331 | knowledge-graph episodes |

That's ~26MB of derived JSON over 136 indexable source files (`structural/files.json`)
— roughly 190KB of index per file, today, on a repo this doc's own worktree lives in.
*(The plan this doc was drafted from cited 135 files / 7,379 symbols / 8,272 edges and a
tighter ~60–140KB/file estimate; the numbers above are this session's own measurement,
minutes old, on a repo several other agents are concurrently indexing — corrected here
rather than repeated, and neither figure is "wrong," they're two snapshots of a
live number.)*

None of these files support a partial read or a partial write. Every one of the
functions below loads its entire artifact before it can answer anything:

- **Recall** (`recall`, `mcp/kernel.ts:10913`, delegating to `recallWithVectorScores`,
  `mcp/kernel.ts:10687`) calls `loadApprovedPackets` (line 10706) — every approved
  packet's markdown, every call — then `readSparseVectorIndex` (`mcp/kernel.ts:10088`),
  which `readJson`s the whole of `vector-local.json` and validates it packet-by-packet
  before scoring a single term.
- **Doc search** (`searchDocs`, `mcp/kernel.ts:9084`) calls `readDocsIndex`
  (`mcp/kernel.ts:9026`), which `readJson`s the whole of `docs-index.json`, then runs a
  real BM25 formula (`BM25_K1`/`BM25_B`, the constants at `mcp/kernel.ts:9060-9072`) over
  every chunk in memory. This is a correct BM25 implementation already — it is simply
  implemented as a linear scan over a fully materialized array, the exact shape SQLite's
  FTS5 virtual table exists to replace without changing the ranking math.
- **Code-graph queries** (`queryCodeGraph`, `mcp/kernel.ts:10962`) resolve through
  `readCurrentCodeGraph` / `buildCodeGraph`, which hydrate the compact
  `code_graph/graph.json` artifact by reading `structural/files.json`,
  `structural/symbols.json`, and `structural/edges.json` in full
  (`hydrateCodeGraphArtifact`, `mcp/kernel.ts:5873`).
- **Staleness validation** (`refreshPacketStaleness`, `mcp/kernel.ts:9387`) walks every
  packet on disk via `loadPacketEntriesFromDir(packetsDir(projectDir))` and calls
  `staleMemoryReasons` (`mcp/kernel.ts:4154`) per packet — an O(packets) scan with no
  index at all, run in full on every `kage refresh`.

**One correction worth stating plainly, because it changes what this design has to
port.** `by-path.json` (`mcp/kernel.ts:9155`, built by the same catalog-writing pass that
writes `catalog.json`/`by-tag.json`/`by-type.json`) is a write-only artifact. Grepping
`byPath`/`by-path` across `mcp/kernel.ts` finds it built, listed in `requiredIndexes` for
`kage doctor`-style checks (`mcp/kernel.ts:17592`, `19603`, `19904`), and never once read
back for a query. Today's actual path-scoped lookup — `detectContradictions`
(`mcp/kernel.ts:3771`), for instance, at `mcp/kernel.ts:3795` (`packet.paths.filter((path)
=> candidatePaths.has(path))`) — is an in-memory `.filter()` over every packet already
loaded by `loadApprovedPackets`, the same full scan recall already pays for, not a lookup
into the index file that claims to exist for exactly this. §Query semantics below designs
against what path-scoped recall *actually does*, not what `by-path.json`'s name implies
it does.

Extrapolated (labeled as an estimate, not measured — this repo has no 10k-file fixture
yet, which is exactly what Phase M4 below builds): if the derived layer keeps scaling
anywhere near today's ~190KB/file, ~10,000 files puts every one of the artifacts above
in the hundreds-of-megabytes-to-low-gigabytes range, a `kage refresh` rewriting all of it
every time, and `JSON.parse`ing files that size on every recall call measured in whole
seconds instead of the low milliseconds it costs today. At ~100,000 files the same
extrapolation lands in the tens-of-GB range per artifact — past where `JSON.parse` on a
single file succeeds at all in a default Node heap. The per-file content cache
(`structural/file-cache.json`, packed by `writeStructuralFileCachePack`,
`mcp/kernel.ts:6427`, read back by `readPackedStructuralCache`, `mcp/kernel.ts:6389`)
already makes *parsing* incremental — a file whose content hash is unchanged is never
re-parsed, confirmed by the cache-key match at `mcp/kernel.ts:6407` — but the cache pack
itself is written whole by `writeJson` every build (line 6432), and every artifact this
doc lists above has no such cache concept applied to *storage* at all. The waste this
design fixes is entirely in the store, never in the parsing this repo already solved.

## The three laws this design will not break

**Law 1 — packets are the only source of truth.** `.gitignore` states this as a fact
about what's actually committed, not an aspiration: `.agent_memory/*` is ignored, then
un-ignored file by file — `!.agent_memory/packets/`, `!.agent_memory/packets/*.md` — while
`.agent_memory/indexes/`, `.agent_memory/structural/`, `.agent_memory/graph/`, and
`.agent_memory/code_graph/` are each explicitly re-ignored. Every artifact this doc's
problem section names is, today, disposable — delete the whole tree and `kage index`
regenerates it from the markdown packets plus the repo's own source, exactly the
guarantee `recall` already relies on by reading packets fresh off disk
(`loadApprovedPackets`, never a cached packet list) on every single call. A SQLite file
this design adds lives in one of those same gitignored directories and inherits the same
disposability for free — no `.gitignore` edit needed, verified by `git check-ignore`
against every gitignored subtree above returning a match. The store is a cache. It has
always been a cache. This design keeps it one.

**Law 2 — zero new dependencies, feature-detected, no native module, ever.**
`mcp/package.json`'s `engines` field reads `"node": ">=18"` (`mcp/package.json:54`). Node's
own `node:sqlite` module did not exist until 22.5.0, shipped experimental behind
`--experimental-sqlite`, and became reachable **without that flag** starting in Node
23.4.0 — it remains "Active development" stability, not yet "Stable," through the
versions after. That means roughly half of the `>=18` range Kage currently promises
(18.x through 22.4.x) has no `node:sqlite` at all, and a further slice (22.5.x–23.3.x)
has it only behind a flag this design will never pass. Verified live on this machine,
Node v25.9.0, with zero flags:

```
$ node -e "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(':memory:'); db.exec('CREATE VIRTUAL TABLE docs USING fts5(body)'); console.log('FTS5 works')"
FTS5 works
```

— confirming both `DatabaseSync` and an FTS5 virtual table load with no build step, no
`npm install`, and no flag on a current Node. This is why the fix is **feature
detection**, not an `engines` bump: bumping `engines` to `>=23.4` would break every
installed Node 18–23.3 today for a store optimization those installs don't strictly
need yet. `better-sqlite3` (a native module requiring a compiled binding per platform,
the exact thing Kage's zero-native-deps posture has avoided since the delegation layer's
own laws) and any other third-party SQLite binding are ruled out categorically, not
merely deprioritized — the JSON backend is not a fallback for "sqlite isn't installed,"
it is the fallback for "this Node build predates a module we will never ship a
workaround for."

**Law 3 — no account, no server, no external database.** The README's own words are
"no account, no database" (`README.md:31`) and "No hosted service, external database, or
API key is required" (`mcp/README.md:80`). An embedded SQLite file is, honestly, a
database — the README's literal wording does not currently carry the qualifier "server"
or "external," and this design should not paper over that gap with the word "cache."
What survives, stated precisely rather than rounded up to the README's current phrasing:
no network hop, no daemon this store depends on beyond the one Kage already runs, no
credential, no schema migration a human has to run by hand, and — per Law 1 — a file
that lives entirely inside a gitignored directory this repo already treats as disposable.
If this design ships, `README.md:31` and `mcp/README.md:80` need a wording pass to say
"no external database" or "no hosted database" — flagged here as required follow-up
work this doc's own scope does not cover (this doc's scope is
`docs/design/MEMORY_STORE.md` and its test only; `README.md` is out of bounds for this
change), not as a promise this design gets to quietly keep unbroken by omission.

## The design

### (a) A `StoreBackend` seam

One interface, two implementations, under new files in `mcp/store/` — nothing existing
moves. `mcp/kernel.ts`'s `readJson`/`writeJson` pair (lines 2607/2619) is the seam's
only caller-facing contract today: every artifact named in the Problem section above —
recall's vector index, the structural graph, the knowledge graph, the docs index, the
catalog — already goes through these two functions and no other path (99 call sites
across `mcp/kernel.ts`, by count), which is what makes a backend swap here a port, not
a rewrite.

- **`interface StoreBackend`** — `getFile(path, sha)`, `putFile(path, fact)`,
  `queryPacketsByPath(path)`, `queryDocsFts(terms)`, `queryVectors(terms)`,
  `getKnowledgeGraphEdges(entityId)`, and the rest of today's `readJson`/`writeJson`
  call shapes, one method per artifact kind rather than one generic
  get/put — the whole point is that a caller asking "packets touching this path" gets an
  indexed answer, not a blob it filters itself.
- **`SqliteStoreBackend`** — `node:sqlite`'s `DatabaseSync`, one `.sqlite` file per
  project under `.agent_memory/store/`, used only when `node:sqlite` is importable on
  the running Node (Law 2's feature detection, checked once at daemon start and cached
  for the process's lifetime, never re-probed per call).
- **`JsonStoreBackend`** — every artifact and function this design's Problem section
  names, unchanged. Not a fallback implementation written against the same interface
  after the fact — the existing `readJson`/`writeJson` pair *becomes* this
  implementation, wrapped, not rewritten.
- **A manifest** (a `manifest.json` under `.agent_memory/store/`, itself a small
  `JsonStoreBackend` artifact — no chicken-and-egg problem, this file is tiny by
  construction) records which
  backend is active and a schema version. First daemon start on a capable Node migrates
  lazily: build the SQLite tables from the existing JSON once, flip the manifest, leave
  the JSON files in place as a rollback path until the manifest confirms the migration's
  read-back matches. `kage store rebuild` forces the same migration from packets + source
  on demand — the same "delete the derived layer and regenerate" guarantee Law 1 already
  requires, now backend-aware. `kage store status` reports active backend, schema
  version, per-table row counts, and on-disk size — the CLI-facing form of the table this
  doc's Problem section built by hand with `du`.

### (b) Schema sketch

```sql
-- structural / code graph
CREATE TABLE files(path TEXT PRIMARY KEY, sha TEXT, mtime INTEGER, kind TEXT, language TEXT);
CREATE TABLE symbols(id INTEGER PRIMARY KEY, file TEXT REFERENCES files(path), name TEXT, kind TEXT, sha TEXT);
CREATE INDEX symbols_file ON symbols(file);
CREATE TABLE import_edges(from_file TEXT, to_file TEXT, kind TEXT);
CREATE TABLE call_edges(from_symbol INTEGER, to_symbol INTEGER, kind TEXT);
CREATE INDEX import_edges_from ON import_edges(from_file);
CREATE INDEX call_edges_from ON call_edges(from_symbol);

-- memory packets
CREATE TABLE packets(id TEXT PRIMARY KEY, type TEXT, status TEXT, score REAL, updated_at TEXT);
CREATE TABLE packet_paths(packet_id TEXT REFERENCES packets(id), path TEXT, sha256 TEXT);
CREATE TABLE packet_symbols(packet_id TEXT REFERENCES packets(id), symbol TEXT, sha256 TEXT);
CREATE INDEX packet_paths_path ON packet_paths(path);      -- the join by-path.json promised and never delivered
CREATE INDEX packet_paths_packet ON packet_paths(packet_id);

-- docs search, replacing the linear BM25 scan over docs-index.json
CREATE VIRTUAL TABLE docs_fts USING fts5(doc_path, heading, body);

-- vectors, replacing one 5.6MB JSON array with per-chunk rows
CREATE TABLE vectors(packet_id TEXT REFERENCES packets(id), term TEXT, weight REAL);
CREATE INDEX vectors_packet ON vectors(packet_id);

-- knowledge graph
CREATE TABLE kg_entities(id TEXT PRIMARY KEY, kind TEXT, label TEXT);
CREATE TABLE kg_edges(from_id TEXT, to_id TEXT, kind TEXT, weight REAL);
CREATE TABLE kg_episodes(id TEXT PRIMARY KEY, ts TEXT, summary TEXT);
CREATE INDEX kg_edges_from ON kg_edges(from_id);
CREATE INDEX kg_edges_to ON kg_edges(to_id);
```

Every table here has a named JSON artifact it replaces from the Problem section's table:
`files`/`symbols`/`import_edges`/`call_edges` replace `structural/files.json`,
`structural/symbols.json`, `structural/imports.json`, `structural/edges.json`;
`packets`/`packet_paths`/`packet_symbols` replace `indexes/catalog.json` and the
never-actually-read `indexes/by-path.json`; `docs_fts` replaces `indexes/docs-index.json`'s
linear scan with FTS5's own inverted index; `vectors` replaces
`indexes/vector-local.json`'s one-giant-array shape with a row per term per packet;
`kg_entities`/`kg_edges`/`kg_episodes` replace `graph/entities.json`, `graph/edges.json`,
`graph/episodes.json`.

### (c) Query semantics, preserved exactly

Nothing about *what* a query answers changes — only how the answer gets assembled.

- **Recall** stays BM25 + vector + graph-walk with the same ranking inputs
  `recallBreakdown`'s `RecallScoreBreakdown` already names (`mcp/kernel.ts:255-272`: text,
  temporal, semantic, graph, path_type_tag, intent, vector, usage, freshness, quality,
  feedback). `scorePacketsBm25` (`mcp/kernel.ts:9982`) becomes a query against `docs_fts`
  (or a parallel `packets_fts` table, same virtual-table mechanism) instead of a
  hand-rolled scan; the vector term stays a join against `vectors` instead of loading
  `vector-local.json` whole. The `score_breakdown` a caller sees is unchanged in shape —
  this is an implementation swap under `recallWithVectorScores`
  (`mcp/kernel.ts:10687`), not a new ranking function.
- **Path-scoped recall becomes an indexed join.** `SELECT packet_id FROM packet_paths
  WHERE path = ?` replaces both `by-path.json` (the index that was never read, per the
  Problem section's correction) and the in-memory `.filter()` pattern
  `detectContradictions` and the rest of the path-scoped call sites use today. This is
  the one query shape in this whole design that goes from *worse than the JSON it
  replaces* (a full packet scan, since the JSON index was dead code) to *actually
  indexed* — not a performance nuance, a real fix riding along with the store swap.
- **Staleness validation becomes a join, not a scan.** `refreshPacketStaleness`
  (`mcp/kernel.ts:9387`) walking every packet via `loadPacketEntriesFromDir` becomes `SELECT
  packet_id, path FROM packet_paths pp LEFT JOIN files f ON pp.path = f.path AND pp.sha256
  = f.sha WHERE f.path IS NULL OR f.sha IS NULL` — packets whose cited path or content
  hash no longer matches the current `files` table, computed once per `kage refresh`
  instead of once per packet per refresh.

### (d) Incrementality

`writeJson`'s whole-file rewrite dies for every table above except the manifest itself.
`kage refresh` upserts rows only for files the structural cache reports as a miss —
`buildStructuralFile` (`mcp/kernel.ts:6450`) already knows, per file, whether its content
hash changed; that same signal becomes the upsert filter instead of feeding a
whole-array `writeJson` at the end of the run. A refresh that touches three files writes
three files' worth of rows, not the codebase's worth of JSON.

### (e) Scope: subtree recall and indexing (designed here, built later)

The realistic answer for a monorepo too large to index whole is not "index everything,
slower" — it's "index and recall the directories you actually work in." `recall` and
`queryCodeGraph` gain an optional `scope: string[]` (path prefixes) that becomes a `WHERE
path LIKE ? || '%'` clause ahead of every join above, and `kage refresh --scope
packages/api` writes rows only for that subtree. This phase is **designed, not
implemented** — no code in this repo does subtree scoping today, and nothing in Phases
M1–M4 below depends on it landing first. It is here because the schema in (b) needs a
`path` column on every row it would filter by, and retrofitting that column after M1–M3
ship would mean a second migration instead of one.

### (f) A scale guard, now

Until M4's benchmarks (below) prove otherwise, Kage is tuned for repos under roughly
10,000 indexable files — the point where this doc's own extrapolation stops being "a bit
slower" and starts being "the artifact might not parse." `kage scan` (`mcp/cli.ts:504`)
and `kage install` (`mcp/cli.ts:726`) are the two places a person first learns what Kage
thinks of their repo; both already compute a file count on the way to what they print
today (`truthReport`, called at `mcp/cli.ts:520`, and `initProject`'s own structural pass
at `mcp/cli.ts:748` respectively) — this guard adds one plain-language line to each
when that count is measured above the threshold, e.g. *"This repo has 14,200 indexable
files — Kage is tuned and tested below ~10,000 today; expect slower `kage refresh` and
larger `.agent_memory/` until the store benchmarks in `docs/BENCHMARKS.md` are updated
past this size."* Not a block, not a silent degradation — a stated envelope, the same
discipline `MemoryOverview.measured`-style absence-is-a-fact reporting already applies
elsewhere in this codebase (`CONTEXT_ENGINE.md`'s own citation of that pattern applies
here too).

## Rollout phases

| Phase | What ships | Acceptance |
|---|---|---|
| **M1 — the store layer** | **Landed 2026-08-20.** `mcp/store/`: the `StoreBackend` interface (`mcp/store/types.ts`), `SqliteStoreBackend` and its `detect()` feature-probe (`mcp/store/sqlite.ts`), `JsonStoreBackend` wrapping today's whole-file read/write behavior (`mcp/store/json.ts`), `openStore()` and the manifest (`mcp/store/manifest.ts`), and `rebuildStore()` (`mcp/store/rebuild.ts`). No existing call site changed — `mcp/kernel.ts` does not import from `mcp/store/` yet, and nothing routes through it; that wiring is M2/M3, not built. | **Met.** `mcp/store-layer.test.ts` (17 tests, all green) covers a feature-detect fallback test that injects a `require` seam reporting `node:sqlite` absent and asserts `JsonStoreBackend` is selected, plus round-trip, migration, FTS, scope, and `rebuildStore()`-idempotency coverage beyond the acceptance bar this row originally set. |
| **M2 — the memory-side port** | **Landed 2026-08-20.** `mcp/kernel.ts` now opens the store (`openStore()`) and routes the packet/path rows, the sparse vector index, and the docs FTS index through it: `buildPacketIndexes` calls `upsertPackets`/`upsertPacketPaths`/`replaceVectorDocuments`; `buildDocsIndex`/`readDocsIndex` call `replaceDocsFtsDocs`/`listDocsFtsDocs`; `recall`'s vector term is `scorePacketsVectorFromStore`, a freshness-gated read over `queryVectorCandidates` (falls back to live in-memory scoring, `scorePacketsVector`, if the store's vector rows don't cover today's approved packet set). `catalog.json`/`by-path.json`/`by-tag.json`/`by-type.json` stay direct `writeJson` calls — `PacketRow` has no title/summary/tags/paths/source_refs to reconstruct `catalog.json` byte-for-byte without breaking `mcp/store-layer.test.ts`'s `getPacket()` deepEqual test, and by-path/by-tag/by-type are confirmed dead weight (never read back, see "One correction worth stating plainly" above) — only their packet-id/type/status/path facts flow into the store. `kage store status`/`kage store rebuild` ship in `mcp/cli.ts`. `openStore()`'s backend-selection deviates from this doc's original "sqlite whenever detected" sketch: the default now stays `JsonStoreBackend` even when `node:sqlite` is available, until `manifest.last_rebuild_at` is set by a prior `rebuildStore()`/`kage store rebuild` run — the "lazy migration, flip the manifest once trustworthy" language below, made concrete by reusing the existing `last_rebuild_at` field as the completion signal instead of adding a new one. | **Met.** `mcp/store-port.test.ts`'s golden test recalls two independent copies of one fixture, one forced to each backend, and asserts identical packet ids, final scores, and `score_breakdown` (component by component) — plus identical `searchDocs`/`docsRecallSection` output. (Two sequential `recall()` calls against the SAME project directory are not directly comparable — `score_breakdown.usage` climbs on repeat calls — so the golden test never reuses one directory across backends.) Also covered: json-backend byte-compatibility (the seam's write is read back through the OLD raw `JSON.parse` path), a sqlite round-trip of the same fixture, `kage store status` naming the active backend, `kage store rebuild` idempotency, and a regression test for a real bug this run found and fixed in `mcp/store/rebuild.ts`'s `loadDocsChunks` (a bare `doc_path#anchor` id collides when one long section splits into multiple chunks — measured on this repo's own docs: 941 real chunks collapsed to 77 before the id got an index suffix). |
| **M3 — the graph-side port** | **Landed 2026-08-20.** `mcp/kernel.ts` now writes the structural and knowledge graphs through the StoreBackend seam: `buildStructuralIndex` still writes `structural/files.json`/`symbols.json`/`imports.json`/`edges.json` directly (byte-compatible with today — `FileRow`/`SymbolRow`/`ImportEdgeRow` are reduced projections that cannot reconstruct those artifacts' full fidelity, size_bytes/signals/concepts/language/signature/specifier included, the same reason `catalog.json` stayed a direct write in M2) and additionally calls `replaceFileGraphRows` with rows scoped to exactly the cache-miss files `buildStructuralFile`'s own per-file content cache already identifies — a refresh that re-extracts N files upserts N files' rows, not the repo's; `buildCodeGraph` calls `replaceCallEdgesForRepo` with every call edge it just re-extracted, on the same non-cached path that already recomputes calls from source (there is no per-file call-edge cache upstream, so "all of them" is the correct scope, not a smaller one); `buildKnowledgeGraph` calls `replaceKnowledgeGraph` with the whole entities/edges/episodes set it just recomputed. `kage store status`'s table counts needed no code change — it already iterates every key `counts()` returns, so files/symbols/import_edges/call_edges/kg_entities/kg_edges/kg_episodes appear automatically once a `kage refresh` starts populating them. Lazy walks: two new store-native query functions, `queryStructuralGraphFromStore` and `kgNeighbourhood`, answer entirely from indexed StoreBackend rows (`backend.listFiles()`/`listSymbols()`, and the new `queryKgEdgesForEntities` — a single indexed `WHERE from_id IN (...) OR to_id IN (...)` scan over `kg_edges_from`/`kg_edges_to` on sqlite) rather than a `readJson` of the whole `structural/files.json`/`symbols.json` or `graph/edges.json`. These are new, narrower functions alongside `queryCodeGraph`/`queryGraph`, not a rewrite of them: those two remain full-corpus fuzzy-ranked scans by design (§(c)'s "nothing about what a query answers changes" law), the same reason M2's own BM25 docs search stayed a full-corpus scan over `listDocsFtsDocs` rather than becoming per-term-indexed. | **Met.** `mcp/store-graph.test.ts` covers: cross-backend golden equality for `queryStructuralGraphFromStore` and `kgNeighbourhood` against one fixture repo built on both backends; JSON-backend byte-compatibility (the row-level push is read back through the OLD raw structural/graph JSON readers unchanged); a sqlite round-trip of all five graph entity kinds (files, symbols, import edges, call edges, kg entities/edges/episodes) that survives `close()`+reopen; `replaceFileGraphRows` touching only cache-miss files' rows, proven by counting rows via `structuralRowsForFiles` (a pure, store-free projection) rather than timing; and rebuild idempotence extended to the graph tables. |
| **M4 — benchmarks and the scale guard** | Not yet built. A generated 10,000-file synthetic fixture; before/after numbers published in `docs/BENCHMARKS.md`; §(f)'s guard wired into `kage scan`/`kage install`. Targets, **labeled as targets, not measured results**: cold index in minutes not hours; warm refresh in seconds; recall under 100ms; peak heap under 500MB during a cold index. | `docs/BENCHMARKS.md` exists, states real before/after numbers from the fixture (not projections), and each target above is marked met or not-yet-met — never silently omitted. |

M1's actual schema deviates from the sketch in §(b) in a few places, each for a
concrete reason discovered while building it, not a rewrite of the design:
`packet_paths`/`packet_symbols` are keyed upserts (`UNIQUE(packet_id, path)` /
`UNIQUE(packet_id, symbol)`, last write wins) rather than plain appends, so a
re-upserted citation doesn't duplicate; `import_edges`/`call_edges`/`kg_edges`
have no natural unique key in either today's artifacts or this sketch, so both
backends treat them as append-only rather than half-deduplicating; `symbols.id`
is `TEXT PRIMARY KEY`, not `INTEGER`, because structural symbol ids in this repo
are already strings; and the `vectors` table carries no `norm` column — cosine
scoring stays entirely with the caller, per §(c)'s ranking-stays-with-callers rule.

The JSON backend is not retired at M4 — it is retired **no earlier than two releases
after M4 proves parity**, giving any installation still on a pre-23.4 Node, or any
repo that hit an undiscovered SQLite edge case, a real fallback window rather than a
cliff.

## What this design does not do

It does not touch `mcp/delegation/` (a hired worker's brief, receipt, or claim format is
unaffected — this is entirely underneath `recall`/`queryCodeGraph`/`searchDocs`, not a
change to what those functions promise their callers). It does not change the packet
markdown format, OKF's concept-document shape, or anything git-tracked. It does not add
a dependency, a server, an account, or a native module. It does not move the source of
truth. What it changes is the one thing this doc's Problem section measured directly:
how much of a Node heap the derived cache demands before it can answer a single query.
