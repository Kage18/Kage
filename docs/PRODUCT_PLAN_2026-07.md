# Kage product plan — 2026-07

Supersedes the prior vNext program docs as the strategic frame. Written after
reading Graphify's implementation (53,220 LOC Python, ~70 modules, Apache-2.0)
and re-measuring Kage's own state rather than trusting carried-forward numbers.

---

## 1. The competitive read

### What Graphify actually is

A very good **compiler for codebases**. Pipeline is
`detect → extract → build_graph → cluster → analyze → report → export`, one
function per module, NetworkX between stages.

Their real investment, measured:

| Area | Evidence |
|---|---|
| Language breadth | ~30 tree-sitter grammars, 28 dedicated extractor modules |
| Call resolution | `extract.py` 5,517 + `extractors/engine.py` 4,695 + `extractors/resolution.py` 2,702 lines; per-language member-call resolvers (`_resolve_swift_member_calls`, `_resolve_python_member_calls`, `_resolve_typescript_member_calls`) |
| Correctness guards | `_EDGE_LANG_FAMILY` cross-language phantom-edge guard; `to_json` refuses a large net node loss so a partial rebuild can't clobber a good graph; atomic writes; daily backups |
| Clustering | Leiden (graspologic, `random_seed=42`), Louvain fallback |
| Retrieval | `_score_query`: IDF-weighted, trigram-prefiltered, exact/prefix tiers, squared term-coverage scaling, 4-key deterministic tie-break |
| Semantic layer | `llm.py` 3,070 lines, multi-backend, prompt-injection neutralization, `_bind_node_evidence` binds LLM nodes back to source spans |
| Distribution | Self-contained `graph.html` (5k-node cap), graph.json, SVG, GraphML, Obsidian vault, Neo4j Cypher |

### The asymmetry that decides our strategy

**Graphify's entire output is derivable from the code.** Delete `graphify-out/`,
re-run, and you get it back. It accumulates nothing. It is a snapshot, and a
very good one.

**Kage's packets are non-derivable by construction** — that is precisely what
the admission gate in `evaluateMemoryAdmission` enforces. Delete
`.agent_memory/packets/` and the knowledge is gone permanently, because it was
never in the code to begin with.

So the strategy is not "build what they have, then add ours." It is:

> **Stop competing on the derivable half — consume it. Compete on the
> non-derivable half, which they cannot enter without becoming a different
> product.**

### The technical unlock we already own and never shipped

They *parse*. We can *consume compiler output*.

`parseScipJsonObject` in `kernel.ts` is already language-agnostic. The precedence
ladder already exists:

```
scip(6) > lsif(5) > lsp(4) > tree-sitter(3) > typescript-ast(2) > generic-static(1) > metadata(0)
```

But `writeCodeIndex` only ever *runs* one indexer: `scip-typescript`.

SCIP is emitted by the actual type-checker. Graphify's 8,200 lines of heuristic
member-call resolution is approximating what `scip-typescript` knows exactly.
Every language with a SCIP/LSIF indexer — TypeScript, Python, Java, Kotlin,
Scala, Ruby, C#, C/C++, Rust, Go — is a language where we can be *more precise
than they can be*, for the cost of a subprocess invocation, not an extractor.

That is the whole competitive play on the code-graph half.

### What we cannot beat, and should stop pretending about

- **Distribution.** 96k stars vs 6. Their advantage is not code.
- **Languages with no indexer** (Pascal, Verilog, DreamMaker, Blade, Apex…).
  They will always cover more. We should cover them at regex tier and say so.
- **Export breadth** (Obsidian, Neo4j, GraphML) is real work we have no reason
  to duplicate unless a user asks.

---

## 2. What the final product is

**Kage is the memory layer for coding agents, anchored to compiler-precise code
structure.**

One install. Three guarantees, permanently:

1. **Your agent knows what your team already learned** — recalled at the moment
   of relevance, not on request.
2. **Your agent's learnings become team knowledge** — captured automatically,
   admitted only when non-derivable, reviewed before they are trusted.
3. **Knowledge that stopped being true stops being served** — anchored to
   symbols, so unrelated edits never falsely retire it, and real edits always do.

And one thing you can hand to another human: **a single self-contained file**
showing the code graph *with the team's knowledge anchored onto it*. Attach it
to a PR. Email it to a new hire. That is the artifact Graphify has and we don't.

The one-line claim, which they structurally cannot make:

> *Your agents never re-learn what your team already knows, and never act on
> knowledge that has gone stale.*

---

## 3. Current state, measured (not carried forward)

| | Measured 2026-07-27 |
|---|---|
| Structural index | 418 files, **17,435 symbols**, 2,120 imports |
| Code graph | 16,876 calls, 64 routes, 1,903 tests, 7.9 MB compact artifact |
| tree-sitter languages | **5** (python, go, rust, java, ruby) + TypeScript compiler AST |
| SCIP auto-run | **TypeScript only** |
| Packets | 228 approved, 1 pending |
| Evidence coverage | **100%** |
| Path grounding | **99%** |
| Useful memory ratio | **90%** |
| Suppressed at recall | **3** — all user-reported, i.e. correct |
| Lifecycle stale / disputed | 2 / 3 |
| Duplicate burden | 17 |
| Type skew | **`decision` 144/228 (63%)**, bug_fix 34, gotcha 20 |
| `graph_nodes` populated | **0/228** |
| Viewer graph | 60 packets × 3 paths, memory↔file only — **no code symbols** |
| `kernel.ts` | **22,223 lines = 71% of non-test TS** |

Two conclusions from this table:

- The memory layer is **healthier than assumed**. False-stale is not the
  outstanding problem; it was fixed. The outstanding problems are **type skew**
  (we capture decisions and little else) and **symbol-level grounding**
  (`graph_nodes` empty).
- The code graph is **substantial and invisible**. 17,435 symbols exist and
  nothing renders them.

---

## 4. Plan

Each phase ends in a measurement, not a merge.

### Phase 1 — Multi-language precision (the win over them)

Ship an **indexer registry**: detect which SCIP/LSIF indexers are available or
installable, run each for the languages present, ingest through the existing
`parseScipJsonObject` path, let the precedence ladder resolve conflicts.

- `writeCodeIndex` becomes a loop over a registry, not a single TS call.
- Indexer availability is reported honestly in `kage status` — installed,
  available-but-missing, or unsupported-language.
- Never block: a missing indexer silently falls back down the ladder, exactly as
  today.

**Proof:** on a fixed multi-language repo, measure call-edge precision and recall
for Kage-with-SCIP vs Graphify's `graph.json`. Publish the number even if we
lose a language.

### Phase 2 — Anchor memory to symbols, not files

`graph_nodes` is 0/228 because nothing populates it at capture time.

- At capture, resolve the packet's code anchors against the code graph and write
  `graph_nodes`.
- Staleness grades three ways: symbol changed → stale; file changed, anchored
  symbols intact → **unaffected**; anchors gone → needs review.
- Backfill existing 228 packets.

**Proof:** `graph_nodes` coverage on the existing store, and a synthetic edit
test — touch an unrelated function in a file a packet cites, assert the packet
is not retired.

### Phase 3 — Fix capture skew

63% of memory is `decision`. Either that is what agents actually learn, or the
admission gate is shaped wrong for the other kinds. Measure first, then act —
the last three times we changed capture on a hunch it was wrong.

**Proof:** classify a sample of real sessions by what was *learned* vs what was
*stored*; report the delta per type.

### Phase 4 — The shareable artifact

Emit `kage.html`: self-contained, no daemon, code graph **plus** anchored memory
in one picture. Node cap and search, same shape as their viz, but the thing our
version shows that theirs cannot is *the knowledge on top of the structure*.

**Proof:** open it from a `file://` URL on a machine with no Kage installed.

### Phase 5 — One surface

Kill the portal/viewer split. One app. The Inbox is the landing surface —
blast-radius sorted, actionable, wired to real endpoints. Costs and Billing
either get finished or deleted; hollow tabs are worse than absent ones.

**Proof:** every nav item renders live data or does not exist.

### Phase 6 — The number

One headline metric on the Overview, measured not estimated: **knowledge reused
× staleness caught**. If we cannot measure it on a real repo, we do not ship the
claim.

---

## 5. Scrap list

Removals justified by measurement, not taste:

| Item | Evidence | Action |
|---|---|---|
| `pg` dependency | zero imports repo-wide | remove |
| `jose` dependency | zero imports repo-wide | remove |
| `three` vendor serving | served from `daemon.ts:921`; 0 references in viewer JS/HTML | remove if the 3D view is not reachable |
| Portal / legacy viewer split | two UIs, one product | collapse to one |
| Costs tab | re-renders Agent Tasks | finish or delete |
| Billing tab | always "no workspace" locally | finish or delete |
| `kernel.ts` monolith | 22,223 lines, 71% of the codebase | decompose along existing seams (code graph / memory / recall / reporting), incrementally, tests green at every step |

**Not on this list:** the OKF positioning. It has been objected to before and is
a product-narrative decision, not an engineering one. Raise it separately.

---

## 6. What we are explicitly not doing

- Writing tree-sitter extractors to chase 30 languages. Consume indexers instead.
- Obsidian / Neo4j / GraphML export until a user asks.
- Leiden clustering, unless module-community detection earns its place as a
  *memory scoping* signal rather than a visualization feature.
- Competing on stars.
