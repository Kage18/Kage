# Kage benchmarks

We publish our own numbers and exactly how to reproduce them. We don't post
head-to-head tables against other tools — scores are only meaningful relative to
the harness that produced them, so cross-tool numbers measured on different
harnesses aren't a fair comparison. Run these yourself.

## 1. Trust Benchmark — the one that matters (and that we lead on)

The question retrieval benchmarks never ask: **can you trust what the memory
returns?** An agent acting on stale or hallucinated memory is worse than one with
none. This is Kage's differentiator.

```sh
kage benchmark --trust --project .
```

| Metric | This repo |
| --- | ---: |
| Hallucinated-citation rejection | 100% |
| Stale-memory exclusion | 100% |
| Live grounding rate | 99% |
| **Trust score** | **100 / 100** |

Methodology and what each gate means: [docs/TRUST.md](TRUST.md). Controlled gates
run in an isolated sandbox; grounding runs on your real repo.

## 2. Retrieval — competitive, dependency-free (a sanity check, not the headline)

We run the recognized long-term-memory retrieval benchmark, **LongMemEval-S**, as
an external sanity check. It is a *conversational* benchmark, not Kage's core use
case (durable repo memory), but it shows our retrieval is strong with **zero
dependencies — no vector database, no embedding model, no API key**.

| Metric | Kage strict recall |
| --- | ---: |
| R@5 | 96.17% |
| R@10 | 98.72% |
| R@20 | 99.79% |
| MRR | 0.909 |
| Median latency | ~210 ms |

```sh
node benchmarks/longmemeval-kage-retrieval.mjs \
  --data longmemeval_s_cleaned.json --limit 470 --top-k 20
```

**Read this honestly:** these are *session-level retrieval recall* scores (does
the gold evidence session appear in the top-K), not end-to-end QA accuracy. On
this dataset a plain BM25 baseline also reaches ~96.6% R@5 — i.e. the benchmark
is lexically tractable and most strong retrievers cluster at 95–97%. The takeaway
is *"Kage matches strong lexical retrieval with no dependencies,"* not *"Kage is
uniquely best at retrieval."* Details: [benchmarks/LONGMEMEVAL.md](../benchmarks/LONGMEMEVAL.md).

## 3. Coding-task memory — the category-correct benchmark

Retrieval recall doesn't tell you whether memory makes a coding agent *better*.
Kage ships a **SWE-bench Verified memory ablation** — a controlled, single-
variable experiment measuring whether repo memory improves real GitHub-issue
resolution. See [benchmark/README.md](../benchmark/README.md) for methodology and
how to run it.

## 4. Memory store scale — cold index, warm refresh, recall, graph query (M4)

`docs/design/MEMORY_STORE.md` replaced the flat-JSON derived cache (`.agent_memory/indexes/`,
`structural/`, `graph/`) with a `StoreBackend` seam — a JSON backend (today's behavior, kept
as the fallback) and a `node:sqlite`-backed one, feature-detected, zero new dependencies.
M4 is that design's own acceptance bar: real numbers from a real fixture, not projections.

**Fixture.** `mcp/bench/fixture.ts` deterministically generates (seeded, no network) N
TypeScript files under `src/`, each importing and calling up to 2 earlier files (a real,
acyclic import/call graph, not flat unconnected files), plus `N/10` memory packets, each
citing 1–3 of those files. `mcp/bench/harness.ts` then runs, against the SAME entry points
`kage index` / `kage refresh` / recall / a graph query use: a cold `indexProject()`, a warm
`refreshProject()` after touching 1% of files, one `recall()` call, and one
`queryStructuralGraphFromStore()` call (the store-native lazy walk M3 built). Reproduce with:

```sh
npm run build --prefix mcp
node mcp/dist/bench/run.js --files 1000,10000 --backends json,sqlite --timeout-ms 900000
```

Every number below is **measured-on-this-machine, 2026-08-20** (Node v25.9.0,
macOS/Darwin, `node:sqlite` available with no flag), against the fixture shape described
above (N files / N⁄10 packets, seed 1). Neither backend hit the 900-second timeout at
either size — no DNF to report at this scale.

| Files (packets) | Backend | Cold index | Warm refresh (1% touched) | Recall query | Graph query | Store on disk | Peak RSS |
|---|---|---:|---:|---:|---:|---:|---:|
| 1,000 (100) | json | 1.51 s | 1.85 s | 83 ms | 5.4 ms | 4.6 MB | 738 MB |
| 1,000 (100) | sqlite | 1.63 s | 1.90 s | 76 ms | 5.0 ms | 1.7 MB | 782 MB |
| 10,000 (1,000) | json | 8.26 s | 15.93 s | 1,062 ms | 44 ms | 46.2 MB | 1,320 MB |
| 10,000 (1,000) | sqlite | 8.24 s | 18.57 s | 814 ms | 33 ms | 16.0 MB | 1,245 MB |

Peak RSS is the OS's own measurement (`/usr/bin/time -l`'s "maximum resident set size" on
macOS, read by `mcp/bench/run.ts`), not an in-process heap sample — it is a real, if coarse
(whole-process, not store-attributable) ceiling.

**Reading these honestly, against `docs/design/MEMORY_STORE.md`'s own M4 targets:**

- *"Cold index in minutes not hours"* — **met**, with a lot of headroom: 8.3 s at 10,000
  files on both backends, nowhere near a minute. Cold index scales *sub*-linearly with file
  count here (10x the files cost ~5.4x the time, not 10x) — this fixture's per-file work is
  small and dominated by fixed per-process overhead (tree-sitter/wasm init), not by corpus
  size, so this number should not be read as "Kage cold-indexes 10,000 files in 8 seconds
  regardless of what's in them."
- *"Warm refresh in seconds"* — **met at 1,000 files** (~1.9 s), **not met at 10,000**
  (16–19 s). `refreshProject()` (what `kage refresh` actually calls) does more than the
  store's own incremental write path M3 built: it also runs `validateProject()` and
  `refreshPacketStaleness()`, an O(packets) walk with no index (`docs/design/MEMORY_STORE.md`'s
  own Problem section already named this as unconverted). At 1,000 packets that walk is the
  visible cost, not the store.
- *"Recall under 100 ms"* — **met at 1,000 files** (76–83 ms), **not met at 10,000**
  (814–1,062 ms, roughly 8–13x over). This is the first number in this table to show real
  degradation in the tested range, and it degrades on BOTH backends near-identically —
  `recall()`'s BM25/vector scoring is still a linear scan over the full approved-packet set
  regardless of which `StoreBackend` retrieves the rows (`docs/design/MEMORY_STORE.md`,
  "(c) Query semantics, preserved exactly": the store swap changes *how* rows are fetched,
  never the O(corpus) ranking pass over them). The store seam bought back cold index and
  on-disk size; it did not, and was never designed to, buy back recall's own algorithmic
  complexity.
- *"Peak heap under 500 MB during a cold index"* — **not met, and not meaningfully
  measurable as stated.** The target named heap; what's cheaply measurable is RSS (a
  superset — process memory, not V8 heap alone), and RSS is already 539 MB at 100 files (a
  separate sanity run below 1,000, not in the table above) before this fixture's own data
  contributes anything — this is tree-sitter/wasm's fixed process footprint, confirmed by
  the fact that RSS grows only ~1.8x from 1,000 to 10,000 files while file count grows 10x.
  The 500 MB target assumed the store dominates memory; measurement says the parser runtime
  does, at every scale tested. Corrected here rather than repeated.

**The scale guard** (`docs/design/MEMORY_STORE.md` §(f)): `kage scan` and `kage install`
warn once, in plain words, when a repo's indexable file count exceeds
`SCALE_GUARD_FILE_THRESHOLD` (`mcp/kernel.ts`) — currently **10,000**. That number is not
"the point cold index gets painful" (it measurably isn't, at this size); it is the largest
size this doc's own benchmarks actually ran, so the warning is backed by a real measurement,
not an extrapolation past it, chosen because recall latency — paid on every single
`kage_context` call, not once per refresh — is the first of the four numbers above to drift
meaningfully past a feels-instant budget at exactly this size. Neither `kage refresh` nor
recall/graph queries print this warning; only the two commands a person runs to first learn
what Kage thinks of their repo do, once per invocation, never in a loop.

## Principle

Lead with trust (ours, uncontested). Treat retrieval as a sanity check, stated
precisely. Never compare against a number measured on someone else's harness.
Every number here is reproducible with the commands above.
