---
type: "belief"
title: "Self: What This Harness Manages, Where It's Heading, and What It Doesn't Yet Know"
tags: ["kage", "self-model", "wave-1", "the-first-sleep"]
snapshot_at: "2026-08-27T16:13:28.458Z"
citation_fingerprints: []
---

# Self: What This Harness Manages, Where It's Heading, and What It Doesn't Yet Know

**Confidence:** firm — grounded in the CHANGELOG, package.json version fields, and the current git log (verified directly, not just cited from packets), but the "consolidation next" framing is this run's own read of the trajectory, not yet an owner-ratified plan.

## What this harness manages

Kage is a memory harness and delegation orchestrator built on top of a single kernel
(`mcp/kernel.ts`). It manages three coupled things: (1) **repo memory** — packets under
`.agent_memory/packets/` that record verified learnings (bug fixes, decisions, gotchas,
conventions, runbooks), admitted through quality-floor guards, aged out through
staleness triage, and served back through BM25-led recall (see `memory-admission-quality-floor.md`,
`memory-staleness-triage.md`, `memory-recall-retrieval-tuning.md`); (2) **a code and
knowledge graph** built from structural indexing plus generic/AST-based call and route
extraction across ten-plus languages, kept fresh through content-hash fingerprinting and
linked back to the memory packets that cite it (see `graph-code-graph-construction-and-scale.md`,
`graph-memory-code-linkage-and-freshness.md`); and (3) **a delegation layer** — you speak
an intent, Kage compiles a brief from repo memory, hires an agent into an isolated git
worktree, and — the architectural core of the whole system — **re-executes the hired
agent's own checks itself** rather than trusting the agent's claim, before `kage merge`
lands the code and ratifies what was learned back into memory in one act (see
`verify-execution-architecture.md`, `delegation-merge-ratification-flywheel.md`). Around
that kernel sits a live web app (the delegation app / Room) for steering runs, a Goals/Waves
layer for orchestrating multi-run work, and a knowledge portal/viewer for browsing the
compiled memory model — all hand-rolled (no framework, no compiler-checked templates),
which is its own recurring source of gotchas (see `renderer-template-literal-constraints.md`,
`ui-terminal-mode-and-pty-lessons.md`).

## Where the repo is heading

**v5.0.0 shipped** (confirmed directly: `mcp/package.json` and `shell/package.json` both
read `5.0.0`, and `CHANGELOG.md`'s top entry is "v5.0.0 — Kage runs your agents, watches
them work, and remembers what they learned"). That release is the pivot from "memory tool
with a dispatch command" to "orchestrator with a live app around it": Goals that actually
run as waves, a Room that's a live steerable session instead of a form, and the
re-execution/ratification loop as the system's core guarantee.

**Storage-scale P1 is in flight.** The current git log's most recent commits (`P1a —
derived state is never committed again`, ratified 2026-08-22) are landing exactly what
they say: `.agent_memory/indexes`, `code_graph`, `graph`, `structural`, and `metrics.json`
were committed and churning on every refresh (the bulk of a 127-conflict master merge);
P1a moved them to `.gitignore` and taught every reader (`kage_context`, recall, `pr check`,
viewer/portal, sync) to rebuild locally when the artifact is absent rather than fail. This
belief-drafting run continued that same gitignore pattern additively — `.agent_memory/beliefs/`
was not yet allowlisted in `.gitignore` (only `.agent_memory/packets/` was, alongside the
new P1a exclusions), so without adding `!.agent_memory/beliefs/` this entire wave's output
would have been silently untracked. That one-line addition is the only change this run made
outside the `beliefs/` directory itself.

**Consolidation is what's next**, and this document is the first concrete step of it: "the
first sleep" is the project of turning ~631 individually-true episodic packets (bug fixes,
decisions, gotchas — one per incident) into a much smaller set of durable beliefs (one per
domain of understanding), so that a future reader — human or agent — can load "how
verification works" once instead of re-deriving it from a dozen scattered packets. Wave 1
(this run) drafted the belief set additively; **nothing reads from `.agent_memory/beliefs/`
yet** — no kernel path, no `kage_context`, no recall, no portal. Wave 2 is expected to wire
a reader in, after an owner reviews this draft.

## Current confidence map

Of 60 belief documents: **4 settled**, **44 firm**, **12 provisional**.

- **Settled** (foundational, repeatedly re-confirmed, no live open question): the
  re-execution verification architecture itself, the verification lock's fix (with
  before/after timing evidence), the value/gains receipts ledger's mechanism, and the
  standing rule that repo intelligence stays local/git-native/dependency-free.
- **Firm but not settled** (verified, yet a real standing-risk pattern remains): most of
  delegation, run/goal lifecycle, the room subsystem, the app renderer, and the code graph.
  The recurring shape here is "found and fixed once, but the underlying pattern that
  produced the bug is easy to reintroduce" — most explicitly, "every check passed ≠
  verified" was independently reintroduced and re-fixed in two different subsystems
  (auto-merge, then track-record scoring), with no evidence of a guardrail against a third
  occurrence.
- **Provisional** (thinner evidence, unconfirmed follow-up, or packets marked
  `deprecated`/stale against later commits): CI/PR-check gate reliability, the OKF format's
  full adoption (still an export/import layer alongside the JSON packet store, not the
  primary read/write path), memory governance (audit/lineage/privacy), process liveness
  and kill semantics, run-lifecycle budget/stall mechanics, dogfood-testing gotchas,
  benchmarks, CSS/DOM rendering conventions, risk assessment, and two of the five room
  beliefs (chat unification, delegation-API seams).

## Active open questions this wave surfaced rather than resolved

- **The in-repo memory design's own adoption resistance.** One packet records an owner
  report that "people are not willing to commit the memory to the same code repo" —
  directly questioning the `.agent_memory`-in-repo foundation every other belief in this
  set assumes (`memory-governance-audit-lineage-privacy.md`). The git log's most recent
  non-P1a commit (`1ab8e8e`, "BELIEF_MEMORY — storage scale layer... memory out of the
  working tree") suggests this is already the direction of travel, but no belief in this
  set documents that decision landing.
- **`kage reverify`'s diff measurement has the same vacuous-diff shape as a bug already
  fixed at merge time**, documented as found with a fix direction but not confirmed shipped
  (`verify-claim-shape-and-empty-diff.md`).
- **`docs/viewer`'s git-tracking policy flip-flopped and was never reconciled** — one
  packet says it must not be committed (CI-generated), a later one says it must be, because
  the gitignore caused staleness (`portal-daemon-routing-and-hosting.md`).
- **The Goals/Waves engine's budget-raise gap and implicit-attachment ordering are still
  young**; the wake-loop failure mode was reproduced live at least three times before the
  fix stuck, and a same-day audit found the engine could not advance a goal's state at all
  even as an "orchestrator-first" positioning call was being made
  (`run-goal-attachment-and-wake-loop.md`, `desktop-shell-packaging-and-delegation-app-ux.md`).
- **Two independent "GitHub Pages viewer must publish split X refs" bugs** (memory-graph,
  then structural-code-graph) are the same defect class recurring twice — flagged as a
  pattern worth watching for a third recurrence, not a closed class
  (`release-website-viewer-and-public-positioning.md`).
- **Track record shows chore-runs verify less reliably than other run types, with no
  packet in this evidence set explaining why** (`verify-checks-not-verified-gate.md`).
- **This wave's own coverage gap:** 127 `workflow-change-memory` packets (of 758 total)
  were excluded from every drafting agent's source material entirely, per the wave-1 brief
  ("skip ... except as evidence trails") — none of the 60 beliefs below actually cite one.
  They are branch-level diff summaries (repo-local context for N changed paths on a named
  run branch) rather than individual learnings, so the loss is likely small, but it means
  this belief set has not been checked against that layer at all.
