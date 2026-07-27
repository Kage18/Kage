# Kage — product and technical design

Companion to [PRODUCT_PLAN_2026-07.md](PRODUCT_PLAN_2026-07.md), which holds the
competitive strategy. This document is the design: what the product is, and how
it is built.

All measurements taken from `origin/master` @ `3a8373f` (v4.0.6), 2026-07-27.

---

# Part I — Product design

## 1. What Kage is

**The memory layer for coding agents, anchored to compiler-precise code
structure.**

A codebase has two kinds of truth. One is *in* the code — call graphs, imports,
types, routes. Any tool can recompute it, and recomputing it is the correct
design. The other kind never made it into the code: why this retry limit is 3,
which approach was tried and failed, what breaks if you touch this module, the
gotcha that cost someone a day.

Tools that visualize the first kind are compilers with a UI. Delete their output,
re-run, get it back. **Kage exists for the second kind.** Delete
`.agent_memory/packets/` and the knowledge is gone permanently, because it was
never in the code to begin with.

Kage's job is to make sure that knowledge reaches an agent at the moment it
matters, and stops reaching it the moment it stops being true.

## 2. Who it is for

| Persona | What they need | Primary surface |
|---|---|---|
| **IC with an agent** | Their agent already knows the team's context; no re-explaining | Invisible — proxy/MCP injection |
| **Tech lead** | See what knowledge exists, what is decaying, what needs review | Portal Inbox |
| **Reviewer** | Know the blast radius of a diff and what memory it invalidates | `kage pr check`, PR comment |
| **New joiner** | Understand the codebase and its lore without a week of asking | The shareable artifact |

The IC is the one who must never have to do anything. Every other persona
tolerates a UI; the IC will not.

## 3. The core loop

```
        ┌──────────────────────────────────────────────────┐
        │                                                  │
   observe ──► candidate ──► admit ──► review ──► recall ──┘
   (events)   (extracted)   (gate)   (human)   (injected)
        │                                          │
        └──────────── staleness ◄──────────────────┘
                    (symbol anchors)
```

Five guarantees, in order of importance:

1. **Recall happens without being asked.** If the agent has to call a tool, most
   of the value is already lost.
2. **Capture happens without being asked.** If a human has to write the memory,
   it will not be written.
3. **Only non-derivable knowledge is admitted.** A memory restating the code is
   worse than no memory: it costs tokens and decays.
4. **Nothing untrusted is injected.** Pending and disputed memory never reaches
   an agent silently.
5. **Staleness is symbol-accurate.** Editing an unrelated function in the same
   file must not retire a good memory.

## 4. Surfaces

| Surface | Role | Status |
|---|---|---|
| **Proxy** (`kage up`) | Primary delivery. Zero per-agent wiring, all providers | Built (`vnext/gateway/`) |
| **MCP server** | For agents that speak MCP; `kage_context` is the entry point | Built |
| **Hooks** | Claude Code ambient capture where the proxy can't attach | Built |
| **CLI** | Human/scriptable access to everything | Built, sprawling |
| **Portal** | Lead/reviewer surface — Inbox first | Built, hollow in places |
| **Artifact** (`kage.html`) | One file: code graph + memory, no install | **Not built** |

Design rule: **the proxy is the product for the IC; everything else is for
everyone who is not mid-task.**

## 5. Journeys

### Install → first value

```bash
npx -y @kage-core/kage-graph-mcp install
```

Creates `.agent_memory/`, builds indexes, wires detected agents, writes policy
files. Captures one starter memory so the first recall is not empty. Prints the
exact command to prove it worked.

**Target: first useful recall inside 60 seconds, on a repo with zero history.**

### Daily (IC, invisible)

Agent starts a task → proxy injects a context capsule (relevant memory, scoped,
token-budgeted) → agent works → proxy observes events → candidates extracted →
admission gate routes to approved or pending. The IC does nothing and sees
nothing except a better-informed agent.

### PR

`kage pr check` reports: memory the diff invalidates, memory the diff should have
produced, blast radius from the code graph. Posts as a PR comment.

### Onboarding

Send one `kage.html`. It opens with no install, shows the module structure, and
shows the team's accumulated knowledge anchored to it.

## 6. What we promise, and what we refuse

**Promise:** local-first; no account or API key for the core loop; packets are
git-visible and reviewable; every injected claim is verified or approved.

**Refuse:** storing secrets, credentials, customer data, raw tokens, or private
URLs. Auto-installing or auto-publishing anything shared. Injecting unverified
claims. Reporting an estimate as a measurement.

---

# Part II — Technical design

## 7. Architecture

Two layers, and the distinction between them is the product thesis.

```
┌─────────────────────────────────────────────────────────────┐
│  DERIVABLE — rebuildable, zero durable value                 │
│  structural index → code graph → repo index                  │
│  Strategy: CONSUME compiler output, never hand-parse         │
├─────────────────────────────────────────────────────────────┤
│  NON-DERIVABLE — durable, irreplaceable                      │
│  packets: decisions, gotchas, constraints, rationale         │
│  Strategy: capture, gate, anchor, verify, decay              │
└─────────────────────────────────────────────────────────────┘
                    anchored by symbol id
```

Everything derivable lives under `.agent_memory/` and is disposable. Everything
non-derivable lives in `.agent_memory/packets/` and is version-controlled.

## 8. The two-codebase reality, and how it resolves

Measured on `origin/master`:

| | |
|---|---|
| `mcp/kernel.ts` | **23,742 lines** — CLI, MCP, recall, capture, code graph, reporting |
| `mcp/vnext/` | **237 files** — `compiler/`, `context/`, `gateway/`, `policy/`, `protocol/`, `api/`, `measurement/`, `migration/`, `repo-index/` |

vnext is already the architecture this design calls for. It has a real capture
pipeline (`compiler/candidates.ts → admission.ts → verifier.ts → consolidator.ts
→ staleness.ts`), a real delivery layer (`gateway/` with per-provider adapters,
compressors, budget engine), a frozen wire protocol (`protocol/validate.ts`), and
policy rules as separate modules.

Crucially, vnext reaches kernel only through **named bridges** —
`context/legacy-source.ts`, `repo-index/legacy-code-graph.ts`,
`migration/packet-importer.ts`. That is a seam, not entanglement.

**Decision: vnext is the target. `kernel.ts` is drained through those bridges,
never rewritten in place.** Each migration step moves one capability behind its
bridge, deletes the kernel copy, and keeps the suite green. No big-bang rewrite,
no second source of truth.

## 9. Layer 1 — Ground truth

### The indexer registry (the competitive win)

Today `writeCodeIndex` runs exactly one indexer:

```ts
export function writeCodeIndex(projectDir: string): CodeIndexArtifactResult {
  const scip = writeScipTypescriptIndex(projectDir);   // TypeScript only
  if (scip?.ok) return scip;
  const lsp = writeLspSymbolIndex(projectDir);
  ...
}
```

`parseScipJsonObject` is already language-agnostic, and the precedence ladder
already exists:

```ts
scip(6) > lsif(5) > lsp(4) > tree-sitter(3) > typescript-ast(2) > generic-static(1) > metadata(0)
```

Replace the hardcoded call with a registry:

```ts
interface CodeIndexer {
  id: string;                                  // "scip-python"
  languages: string[];                         // ["python"]
  parser: CodeParser;                          // "scip"
  detect(projectDir: string): boolean;         // does the repo contain this language?
  available(projectDir: string): string | null;// resolved executable, or null
  run(projectDir: string, outDir: string): IndexerRun;
  installHint: string;                         // shown in `kage status`, never auto-run
}

export function writeCodeIndex(projectDir: string): CodeIndexArtifactResult[] {
  return INDEXERS
    .filter(i => i.detect(projectDir))
    .map(i => i.available(projectDir) ? runIndexer(i, projectDir) : skipped(i));
}
```

Registry targets: `scip-typescript`, `scip-python`, `scip-java` (Java/Kotlin/
Scala), `scip-ruby`, `scip-dotnet`, `scip-clang`, `rust-analyzer`, `scip-go`.

Why this beats writing extractors: SCIP is emitted by the actual type-checker.
A competitor's hand-written member-call resolver *approximates* what the compiler
already knows exactly. We inherit precision instead of re-deriving it.

**Non-negotiable properties:**
- Never blocks. A missing indexer falls down the ladder exactly as today.
- Never auto-installs. `kage status` reports `installed | available | unsupported`
  with the install command; the user runs it.
- Merge is precedence-ordered via `strongerParser`, so a SCIP symbol always wins
  over a regex one for the same id.

### Fallback tiers (unchanged)

TypeScript compiler AST → tree-sitter (5 grammars) → `generic-static` regex →
`metadata`. We do not chase grammar count; we report the tier honestly per file.

## 10. Layer 2 — Knowledge

### Packet schema (v2, as shipped)

```ts
interface MemoryPacket {
  schema_version: 2;
  id: string; title: string; summary: string; body: string;
  type: MemoryType;            // decision | gotcha | bug_fix | runbook | constraint | ...
  scope; visibility; sensitivity; status;
  confidence: number;
  tags: string[];
  paths: string[];             // file grounding — 99% populated
  graph_nodes?: string[];      // symbol grounding — 0% populated  ← the gap
  stack: string[];
  source_refs: Array<Record<string, unknown>>;   // provenance — 100% populated
  freshness; edges; quality;
  created_at; updated_at; author_name; author_branch;
  stage?: WorkStage; claimed_by?; claimed_at?;
}
```

Stored as OKF-legal markdown with `x-kage-*` frontmatter — readable by any OKF
consumer, no Kage required.

### Symbol anchoring (the correctness fix)

`graph_nodes` is `0/228` because nothing populates it at capture time. The anchor
machinery already exists (`codeAnchorTokens`, `symbolSpanHashesFromText`,
`fileSymbolSpanHashes`) and is wired into the stale check — but it resolves
against text, not against the code graph.

**At capture:** resolve `codeAnchorTokens(body)` against the code graph's symbol
table for the packet's `paths`; write matched symbol ids to `graph_nodes` with
their span hashes.

**At staleness check:** grade three ways rather than two.

```ts
type AnchorVerdict = "intact" | "changed" | "missing";

// file changed, all anchors intact   → UNAFFECTED   (do not retire)
// any anchor's span hash changed     → STALE        (needs re-verification)
// any anchor no longer exists        → ORPHANED     (needs human review)
// no anchors resolvable (prose-only) → fall back to path fingerprint
```

This is the difference between "someone edited a file you mention" and "the thing
you are talking about changed."

### Admission gate

`evaluateMemoryAdmission` scores 0–100 and routes: admit, or pending-review with
a message naming what is missing. Positive signals: durable type, provenance,
path grounding, rationale language, verification signal, substance. Negative:
duplicates existing memory, session bookkeeping, routine command result, file
activity without a learning, ungrounded conversational utterance (hard block).

**Known defect:** the install path writes starter packets directly as approved,
bypassing admission. Route them through the gate like everything else.

**Known skew:** `decision` is 144/228 (63%). Measure whether that reflects what
agents actually learn before touching the gate — the last three changes made on a
hunch were wrong.

## 11. Layer 3 — Retrieval

Ranking is field-weighted BM25 (`BM25_K1 = 1.2`, `BM25_B = 0.75`) over packet
fields, combined with `recallQualityScore` and graph proximity, then assembled
into a token-budgeted capsule by `vnext/context/capsule-builder.ts`.

Three retrieval modes, by cost:

| Mode | Trigger | Contents |
|---|---|---|
| **Always-on** | Every turn | Pinned slots only — tiny, always-true repo guidance |
| **Scope-triggered** | Query or targets mention paths/symbols | Memory anchored to those symbols + blast radius |
| **On-demand** | Explicit `kage_context` | Full recall + code graph + knowledge graph |

Injection rules: only `approved` or `verified` packets; pending and disputed are
never injected silently; every injected claim carries its packet id so
`kage_feedback` can correct it.

## 12. Layer 4 — Capture

```
proxy/hook events ──► EventStore (SQLite, protocol v1)
        │
        ▼
compiler/candidates.ts   extract candidate learnings
        │                 (extractors: change, command, failure, repository)
        ▼
compiler/admission.ts    score, route admit | pending
        ▼
compiler/verifier.ts     check claims against code
        ▼
compiler/consolidator.ts merge duplicates, supersede
        ▼
packets/ (git)
```

The wire protocol (`vnext/protocol/validate.ts`) is **frozen at v1**:
`EVIDENCE_EVENT_TYPES` is a hard-validated enum. New signals ride as additive
payload fields older consumers ignore — that is how assistant prose was added as
`payload.intent` (600-char cap, `local_raw` tier) rather than as a new event type.

Privacy tiers are enforced at capture: `local_raw` never leaves the machine,
`team_metadata` is shape-only, `team_approved` requires explicit review.

## 13. Layer 5 — Delivery

**Proxy (primary).** `vnext/gateway/` — provider adapters for Anthropic, OpenAI,
Gemini behind a common seam, plus compressors (`diff`, `json`, `logs`,
`stack-trace`), a budget engine, and a content store. Audit mode forwards
byte-identical bytes. One `kage up` covers every agent on the machine with zero
per-agent wiring.

**MCP (secondary).** `kage_context` is the single entry point — validate, recall,
code graph, knowledge graph in one call.

**Hooks (fallback).** Where the proxy cannot attach. The Claude *desktop app*
overrides its own base URL and cannot be proxy-attached; hooks are the delivery
path there, and `attach-status.ts` reports this honestly rather than claiming
"wired".

## 14. Layer 6 — The artifact

New. `kage export --html` emits a single self-contained `kage.html`:

- Inlined graph JSON, no fetch, no daemon, opens from `file://`
- Code graph (module communities, key symbols) **with memory anchored onto it** —
  the view no competitor can produce, because they have no memory to anchor
- Node cap with search and neighbor navigation
- Respects privacy tiers: `local_raw` content never enters the export

This is the distribution primitive we lack. A file you can attach to a PR or send
a new hire is worth more than a dashboard they must install to see.

## 15. Storage

| Path | Durable? | Contents |
|---|---|---|
| `.agent_memory/packets/` | **yes, git** | OKF markdown memory |
| `.agent_memory/graph/` | rebuildable | memory graph |
| `.agent_memory/code_graph/` | rebuildable | compact code graph artifact (7.9 MB here) |
| `.agent_memory/structural/` | rebuildable | files, symbols, imports (17,435 symbols here) |
| `.agent_memory/code_index/` | rebuildable | SCIP/LSIF/LSP indexer output |
| `.agent_memory/indexes/` | rebuildable | recall indexes, optional embeddings |
| `.agent_memory/slots/` | yes, git | pinned always-on context |
| `.agent_memory/reports/` | rebuildable | 26 report artifacts |

Rule: exactly one durable directory. Everything else must survive `rm -rf` +
`kage refresh` with no loss.

## 16. Module decomposition

`kernel.ts` at 23,742 lines is the main structural risk. Drain order, each step
green:

1. **Code graph + structural** → `vnext/repo-index/` (bridge exists:
   `legacy-code-graph.ts`)
2. **Recall + ranking** → `vnext/context/` (bridge exists: `legacy-source.ts`)
3. **Capture + admission** → `vnext/compiler/` (bridge exists:
   `packet-importer.ts`)
4. **Reporting** → its own module; 26 report writers do not belong beside a parser
5. **CLI** stays a thin dispatcher over the above

No step is a rewrite. Each moves one capability behind an existing bridge and
deletes the kernel copy.

## 17. Measurement

One headline number, measured not estimated: **knowledge reused × staleness
caught**. Supporting evals already in the repo: `bench:injection`,
`bench:capture`, `bench:reuse`, `bench:compression`.

New evals this design requires:

- **Call-edge precision vs a hand-parsing baseline** on a fixed multi-language
  repo — publish it even where we lose.
- **False-retirement rate**: edit an unrelated symbol in a cited file; assert the
  packet is not retired.
- **`graph_nodes` coverage** across the store, tracked as a health metric.

Rule: if a number cannot be measured on a real repo, the claim does not ship.

## 18. Scrap list

| Item | Evidence | Action |
|---|---|---|
| `pg` dependency | zero imports repo-wide | remove |
| `jose` dependency | zero imports repo-wide | remove |
| `three` vendoring | served at `daemon.ts:921`; 0 refs in viewer JS/HTML | remove if unreachable |
| Portal / legacy viewer split | two UIs, one product | collapse to one |
| Costs tab | re-renders Agent Tasks | finish or delete |
| Billing tab | always "no workspace" locally | finish or delete |

Deliberately **not** on this list: the OKF positioning — a narrative decision,
raised separately.

## 19. Explicitly not building

- Tree-sitter extractors to chase language count. Consume indexers instead.
- Obsidian / Neo4j / GraphML export until a user asks.
- Community detection, unless it earns its place as *memory scoping* rather than
  decoration.
- Any metric we cannot measure on a real repository.
