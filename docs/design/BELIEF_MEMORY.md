# Belief Memory — consolidation over collection

**Status: DESIGN DRAFT (2026-08-21) — nothing here is built. Direction raised by the
owner ("random memory packets per session don't create understanding; the harness
should learn like a person"), shaped with the operator. Supersedes nothing yet;
complements docs/design/MEMORY_STORE.md (the store stays the index substrate).**

## The defect this fixes

Kage's memory today is an episodic diary: per-session packets, verified at capture,
append-only, indexed. It never consolidates. The measurable result on this repo
(2026-08-21): 695 packets, 292 flagged stale, 304 unresolved contradiction pairs,
near-duplicates at 0.98 similarity. Retrieval speaks from the diary, so briefs quote
fragments instead of understanding. Adding retrieval sophistication (RAG) over this
would recall the sediment more fluently; it cannot produce a world-model.

Humans work differently: episodes are raw material; sleep consolidates them into a
small semantic model (schemas, causal structure); recall speaks from the model and
cites episodes only as evidence; unused detail decays. Kage never sleeps.

## The architecture: three layers + a process

### Layer 1 — Episodes (exists today, unchanged)
The current packets: append-only, capture-verified, git-committed. They become the
**evidence log**. Nothing about their write path changes except the admission gate
(shipping separately: near-dupe rejection, quality floor, citation caps).

### Layer 2 — Beliefs (new)
A small set of living documents — target **40–60 for this repo** — one per domain
of understanding: "how verification works and why", "the app renderer's constraints",
"the release machinery", "what breaks worktree runs". Properties:

- **Rewritten in place** as understanding changes. Git history IS the belief's
  evolution — `git log` on a belief file shows how the repo's understanding of that
  domain changed, and why, commit by commit.
- Each belief carries: a confidence line, the episodes that support it, the episodes
  that contradict it (an honest open question is a first-class state), and
  **OKF v0.2 trust fields** (`provenance`, `trust`, `freshness`, `lifecycle`,
  `attestation` — the spec grew these on 2026-07-25; Kage fills them with
  re-executed evidence instead of self-report, which is the product thesis applied
  to the standard).
- Stored as OKF-conformant markdown under `.agent_memory/beliefs/`, committed.

### Layer 3 — Relations (new)
Typed, causal edges between beliefs and code, beyond "cites":
`decision X → forced constraint Y → produced gotcha Z`; `data flows A → B via C`;
`surface S renders state owned by module M`. Rendered as mermaid diagrams INSIDE the
belief documents (reviewable in any markdown viewer, no bespoke tooling), and fed to
the app's System Map so the map shows *why*, not just imports.

### The process — the sleep cycle (new)
A scheduled Kage goal the orchestrator runs on its own repo (idle-time or nightly):

1. **Merge** — near-duplicate episodes superseded into one, lineage kept.
2. **Reconcile** — each contradiction pair becomes either a belief revision (one
   side wins, with evidence) or an explicit open question in the relevant belief.
3. **Promote** — recurring episodic patterns become new beliefs or belief edits.
4. **Decay** — episodes never recalled and not cited by any belief are demoted out
   of recall surfaces (never deleted; git is the archive).
5. **Redraw** — relation diagrams regenerate from the updated beliefs.
6. **Self-model** — one document (`beliefs/self.md`): what this harness manages,
   where the repo is heading, current confidence map, active open questions.

Every sleep is a normal Kage run: briefed, executed in a worktree, kernel-verified
(beliefs must keep citing real paths; the citation checker already exists), merged
with a receipt. The repo dreams under the same laws as every other change.

### The retrieval flip
Briefs and Room replies read **beliefs first** (small, coherent, current), episodes
only as drill-down receipts. This is the mechanical reason the harness starts to
feel like a person who knows the repo: it answers from its model, not its diary.

## What stays true

- **Git + markdown substrate stays.** OKF's momentum (v0.1 June 12 → v0.2 July 25,
  vendor-neutral, markdown-directory-as-graph) validates repo-committed files; the
  team-share and no-lock-in promises survive intact.
- **The store (node:sqlite) stays the index** — beliefs get indexed like packets.
- **Verification stays the law** — a belief that cites moved code goes stale like
  any packet; the sleep cycle is itself a verified run.
- **RAG is explicitly rejected** as the primary memory: retrieval is not memory,
  and embeddings over sediment amplify noise. (Embedding recall may still assist
  *inside* layers as an index detail.)

## Bootstrap plan (when approved)

1. `kage gc` pass (shipping) to pre-clean the episode pile.
2. **The first sleep**: one big consolidation goal — read all remaining packets,
   draft the initial belief set (~40–60 docs + self.md + diagrams), each belief
   citing its episodes; kernel-verified; merged wave by wave with owner review of
   the belief list itself.
3. Flip brief compilation to beliefs-first with episode fallback.
4. Schedule the recurring sleep as a standing goal.

## Open questions (for the owner)

- Belief granularity: per-domain (~50 docs) vs per-subsystem (~15 bigger docs)?
- Does the sleep run nightly, on merge-count thresholds, or manually at first?
- Do beliefs ship to the public OKF bundle (they are the most shareable artifact —
  but also the most opinionated)?
