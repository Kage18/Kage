# Graphify parity — capability matrix, simplification, and what goes on top

Built by reading both implementations, not READMEs. Graphify @ `Graphify-Labs/graphify`
(53,220 LOC Python, Apache-2.0). Kage @ `origin/master` `3a8373f` (v4.0.6).

Direction, per Kushal: **reach parity with what they have, simplify to their level
of discipline, then differentiate on top.** This doc is that plan.

---

## 1. Two findings that shape everything

### Finding 1 — we are not behind on capability, we are behind on *shape*

| | Graphify | Kage |
|---|---|---|
| Top-level commands | ~30 (≈20 of them are `<agent> install/uninstall` variants) | **127** |
| Source layout | ~70 modules, one function each | `kernel.ts` **23,742 lines** + `vnext/` 237 files |
| Pipeline | 7 named stages, plain dicts between them | implicit |
| Output | one directory, `graphify-out/` | `.agent_memory/` + 26 report files |

Their `ARCHITECTURE.md` fits on one page: *"Each stage is a single function in its
own module. They communicate through plain Python dicts — no shared state, no side
effects outside `graphify-out/`."* That constraint is why 53k LOC stays legible.

**Measured duplicate command families in Kage:**

```
lifecycle / memory-lifecycle        lineage / memory-lineage
timeline  / memory-timeline         handoff / memory-handoff
layers    / memory-layers           replay  / session-replay
reconcile / memory-reconcile / memory-reconciliation
xray      / repo-xray               review  / review-artifact / reviewers
graph     / code-graph / graph-insights / graph-registry
index     / code-index / structural-index
audit     / audit-log / audit-claude-mem / capability-audit / memory-audit
```

That is ~20 commands of pure aliasing before we discuss features.

### Finding 2 — the real parity gap is six items, not a rewrite

I previously said closing on them meant matching 8,200 lines of hand-written call
resolution. Reading their command surface against ours, that was wrong. Most of
what they have, we have. The genuine gaps are short and concrete — §3.

---

## 2. Capability matrix

Legend: ✅ have · 🟡 partial · ❌ missing · ⭐ Kage-only

### Build

| Capability | Graphify | Kage | |
|---|---|---|---|
| Extract code structure | `extract`, ~30 tree-sitter grammars | `index`/`refresh`, 5 grammars + TS compiler AST + SCIP ingest | 🟡 *more precise, less broad* |
| Compiler-exact symbols | `scip_ingest.py` (363 lines) | `parseScipJsonObject`, precedence ladder `scip>lsif>lsp>tree-sitter` | ⭐ *ladder is richer; only TS is auto-run* |
| Rebuild on file change | `watch` | — | ❌ |
| Community detection | `cluster-only`, Leiden + Louvain | — | ❌ |
| Community auto-labelling | `label` (LLM) | — | ❌ |
| Multi-repo merge | `merge-graphs`, `global add/list/remove` | `workspace`, `cloud` | 🟡 |
| Non-code ingestion | `add <url>`, PDF, docs, `--postgres`, cargo, transcribe | — | ❌ |

### Query

| Capability | Graphify | Kage | |
|---|---|---|---|
| Search the graph | `query` (BFS/DFS, IDF + trigram prefilter) | `code-graph`, `context` (field-weighted BM25) | ✅ |
| Node detail | `get_node` | `code-graph` | ✅ |
| Neighbors | `get_neighbors` | `code-graph` | 🟡 |
| Community members | `get_community` | — | ❌ |
| Most-connected nodes | `god_nodes` | `graph-insights` | ✅ |
| Graph stats | `graph_stats` | `metrics`, `graph-insights` | ✅ |
| Shortest path | `shortest_path` / `path` | `dependency-path` | ✅ |
| Explain a concept | `explain` | — | ❌ |
| Change blast radius | `affected`, `get_pr_impact` | `risk`, `minimal-change` | ✅ |

### Share

| Capability | Graphify | Kage | |
|---|---|---|---|
| **Self-contained `graph.html`** | ✅ 5k-node cap, search, neighbors, legend | — | ❌ **the important one** |
| Human report | `GRAPH_REPORT.md` | `report team`, portal | 🟡 |
| Tree view | `GRAPH_TREE.html` | — | ❌ |
| Call-flow diagram | `callflow-html` (Mermaid) | — | ❌ |
| SVG / GraphML / Cypher / Obsidian / FalkorDB | ✅ all | — | ❌ |
| OKF concept bundle | — | `export`, `okf` | ⭐ |

### Integrate

| Capability | Graphify | Kage | |
|---|---|---|---|
| Agent installers | ~20 targets | ~13 targets | ✅ |
| Hooks | `hook install/status/uninstall` | `hook`, `setup` | ✅ |
| MCP server | `serve` | ✅ | ✅ |
| Shared HTTP server | `serve` HTTP | `daemon` | ✅ |
| **Proxy — zero wiring, all providers** | — | `up`, multi-provider gateway | ⭐ |

### Review

| Capability | Graphify | Kage | |
|---|---|---|---|
| PR triage / conflicts / worktrees | `prs --triage --conflicts --worktrees` | `pr`, `conflicts`, `review` | ✅ |

### Memory — no counterpart exists

Packets, admission gate, verification, staleness, review queue, session provenance,
privacy tiers, feedback loop. ⭐ entirely ours. This is the product.

---

## 3. The parity gap, complete

Six items. Nothing here is a rewrite.

| # | Gap | Why it matters | Rough size |
|---|---|---|---|
| **P1** | Self-contained `kage.html` | The distribution primitive. A file you attach to a PR or send a new hire beats a dashboard they must install. | M |
| **P2** | Communities (Leiden/Louvain) + `get_community` | Not decoration — community id is the natural **scope key for memory**. "What does this subsystem know?" | M |
| **P3** | `watch` | Graph goes stale between refreshes; agents read stale structure. | S |
| **P4** | `explain <thing>` | The single most natural question a newcomer asks. | S |
| **P5** | Export breadth — SVG, GraphML, Cypher, Obsidian | Cheap once the graph is in memory; unlocks their integrations. | S |
| **P6** | Language breadth | 5 grammars today. Close via the **indexer registry** (`scip-python`, `scip-java`, `scip-ruby`, `scip-dotnet`, `scip-clang`, `rust-analyzer`, `scip-go`) — compiler-exact, no extractors written. | M |

Deliberately **excluded from parity**: non-code ingestion (PDF/URL/SQL) and LLM
community labelling. Both require an API key or pull us into document management.
Revisit only on user demand.

---

## 4. Simplification: 127 → 15

Modelled on their discipline. Everything else becomes a flag or subcommand.

```
kage install                 wire this repo + detected agents
kage up | down               proxy on/off
kage status                  attached? indexed? which indexers? what's missing
kage context <query>         THE recall entry point — absorbs recall, code-graph,
                             graph, risk, dependency-path, file-context, xray
kage explain <symbol|file>   parity: what is this, who calls it, what do we know
kage learn                   capture a memory
kage review                  the inbox — approve, reject, supersede, feedback
kage refresh                 rebuild everything derivable
kage watch                   refresh on change
kage export <fmt>            html | svg | graphml | cypher | obsidian | okf | json
kage pr                      check + summarize a branch
kage report                  absorbs lifecycle, timeline, lineage, handoff,
                             quality, metrics, capabilities, audit, activity
kage viewer                  the one UI
kage upgrade
kage help
```

**Migration:** old names become hidden aliases that print a one-line pointer for
one release, then are deleted. `mcp/cli-discoverability.test.ts` already asserts
every command is reachable from help — extend it to assert **no non-aliased
command exists outside this list**, so the surface cannot regrow.

Same discipline applied to the pipeline. Name our stages, as they did:

```
detect → index → graph → cluster → recall → capture → report → export
```

Each becomes a module under `vnext/`, one responsibility, plain data between
stages, no side effects outside `.agent_memory/`.

---

## 5. What goes on top — only after parity

Parity makes us a peer. These make us a different category, and each one is
impossible for them without becoming a memory product.

**T1 — Memory anchored to the graph.** Their nodes carry `source_file` and
`source_location`. Ours carry that *plus* the team's accumulated knowledge, bound
to symbol ids with span hashes. `kage.html` shows structure **with lore on it**.
That single view is the whole pitch.

**T2 — Knowledge that expires correctly.** Nobody has this. Symbol-anchored
three-way grading: anchors intact → unaffected; span hash changed → stale;
anchor gone → orphaned. A regenerated graph cannot go stale, so they never needed
it — and can never claim it.

**T3 — Capture without asking.** Their graph is built by a command. Our memory
accrues from observed sessions through the proxy, gated by admission so only
non-derivable knowledge is admitted.

**T4 — Community-scoped memory.** Once P2 lands, communities become memory scopes:
"this subsystem's decisions", "what the auth cluster knows". Their clustering
labels code; ours would route knowledge.

**T5 — Proxy delivery.** One `kage up`, every agent, every provider, zero wiring.
They install per-agent config into ~20 tools; we don't have to.

---

## 6. Order

1. **Simplify first** — 127 → 15, name the pipeline stages. Cheapest, largest
   legibility gain, and every later change lands in a smaller surface.
2. **P6 indexer registry** — the only parity item that also makes us *better*
   than them on their own ground.
3. **P2 communities**, because T4 depends on it.
4. **P1 `kage.html`** carrying T1 — parity artifact and differentiator in one.
5. **P3, P4, P5** — small, ship together.
6. **T2, T3** — the moat, on a simplified base.

Rule carried from the plan doc: each step ends in a measurement, not a merge.
For parity items the measurement is a direct comparison against their output on
the same repository — published even where we lose.
