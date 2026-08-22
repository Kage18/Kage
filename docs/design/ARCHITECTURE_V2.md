# Kage Architecture v2 — the ground-up design

**Status: DESIGN (2026-08-22).** Direction from the owner: "our system is very poorly
designed for scale; think it through from the ground up." This document is the full
rethink. It absorbs the storage laws in `BELIEF_MEMORY.md` (P1 shipped, P2 in flight)
as its first two migration phases and defines the phases after them. Nothing beyond
P2 is built.

The kernel's product laws are inputs, not outputs, of this design: claims are
verified by re-execution; receipts are the interface; merges ratify learnings;
unmeasured renders as "—"; derive display, persist death.

---

## 1. Requirements

### Functional (what Kage is)
- **Delegation**: intent → brief compiled from memory → agent in isolation →
  independent verification → merge that also ratifies learnings.
- **Memory**: verified episodes → consolidated beliefs (the sleep cycle) → recall
  into briefs. Team-shared, auditable, exportable (OKF).
- **Orchestration**: goals/waves, budgets as circuit breakers, recovery
  (resume/adopt/take-over), an interactive manager that decomposes any request.
- **Surfaces**: app, CLI, TUI, terminal, manager chat — same truth on all of them.
- **Distribution**: local-first npm + desktop app with auto-update; no accounts in
  the free tier; team sync as the paid tier.

### Non-functional targets (stated, so misses are visible)
| Dimension | Today (measured) | v2 target |
|---|---|---|
| Repo size | 10k files: 8.3s cold, 76ms recall | 100k files interactive; 1M+ via partial index (§6) |
| Concurrent runs | ~3 per machine, one verify at a time | 10–50 across a team's machines, verifications parallel across executors |
| Memory writers | 1 machine safe; 2 writers produced 127 git conflicts | any number, zero-conflict by construction |
| State propagation | poll + SSE nudge, ~1s | same, but derived from one event stream |
| Availability | runs survive daemon death (proven) | plus: any state reconstructable by replay |
| Cost control | per-run + per-goal USD breakers | unchanged; plus per-executor budgets |

### Constraints
- Solo-maintainer velocity: phases must land as ordinary Kage runs, no big-bang.
- The no-lock-in promise is contractual: everything exportable as OKF markdown.
- The free tier must never require a server.

### Requirement evidence (scars, all from operating this system)
git-as-database: 127-conflict master merge (sync bot vs verified packets). Index in
the working tree: most of those conflicts were rebuilt artifacts. In-place rewrites:
reverify/supersede touched hundreds of files. sqlite treated as shared state:
"database is locked" against the daemon. Verification bound to one machine: three
runs failed on each other's timing before the per-machine lock; the lock then
deadlocked its own suite until reentrancy. Session state outside the ledger: a
day-wedged manager session answered nothing for 20 hours. All of these are the same
mistake wearing different clothes: **four different kinds of data forced through one
storage discipline.**

---

## 2. The core insight — four planes, four disciplines

```
┌────────────────────────────────────────────────────────────────┐
│  SURFACES      app · CLI · TUI · terminal · manager chat       │
│                (render folds, send commands, subscribe)        │
├────────────────────────────────────────────────────────────────┤
│  COMPUTE       agents in worktrees · verification executors    │
│                (schedulable, isolatable, horizontally scalable)│
├────────────────────────────────────────────────────────────────┤
│  STATE = fold(LEDGER)   runs, goals, board, wave status        │
│                (derived, cached, NEVER authoritative)          │
├────────────────────────────────────────────────────────────────┤
│  INDEX         sqlite: FTS, vectors, code graph, views         │
│                (per-machine cache, disposable, rebuildable)    │
├────────────────────────────────────────────────────────────────┤
│  LEDGER        append-only events + content-addressed blobs    │
│                (the only thing that is ever the truth)         │
└────────────────────────────────────────────────────────────────┘
```

Today's failures were all category errors across these planes. The v2 rule: **each
plane has exactly one storage discipline, and data never changes plane by accident.**

- **Ledger** — append-only, content-addressed, transport-agnostic. The only shared
  thing. Conflicts impossible by construction.
- **Index** — always local, always disposable, never committed, never shared.
- **State** — a fold over the ledger; any surface can rebuild it from scratch.
  (Generalizes the shipped law "derive display, persist death" to *persist events,
  derive everything*.)
- **Compute** — stateless workers against the ledger: an agent turn or a
  verification is a job that reads events and appends events.

## 3. High-level design

### 3.1 The event ledger (the one source of truth)

Every fact Kage learns or does becomes an event:

```
{ id: ulid,                       // total order per stream, unique globally
  stream: "run:<id>" | "goal:<id>" | "memory" | "room:<thread>",
  kind:  "run.dispatched" | "claim.received" | "check.passed" |
         "run.merged" | "learning.ratified" | "packet.captured" |
         "packet.superseded" | "belief.revised" | "goal.wave-merged" | …,
  at, actor: "kernel"|"agent:<run>"|"operator"|"manager",
  payload: {...},                 // small; big things go to blobs
  refs: ["blob:<sha256>", "packet:<id>", …] }
```

- **Blobs** (transcripts, evidence logs, diffs, receipts) live in a local
  content-addressed store, referenced by hash. Never in git, never in payloads.
- The P1b journal (`.agent_memory/journal/events-YYYYMM.jsonl`) is this ledger's
  first stream (memory status events). P3 moves run/goal lifecycle into it.
- Packet markdown files remain the **capture format and export format** — written
  once at capture, immutable after (enforced since P2a), reflected as
  `packet.captured` events. OKF stays the interchange; the ledger stays the truth.

### 3.2 Transports (how a team shares the ledger)

The same event format, two transports — this is the wedge/paid split:

- **Git tier (free, default)**: the memory branch (P2b) carries JSONL event files
  and packet markdown. Append-only + per-month files + unique ids ⇒ merges are line
  unions; `git pull` is sync. Honest ceiling: comfortable to ~10 writers.
- **Service tier (paid)**: a small sync server replicating the identical event log
  (the existing Kage Cloud server is the seed). Same fold, same export; a team can
  drop back to the git tier at any time — that is the no-lock-in test.

### 3.3 State as folds

`task.json`, `goal.json`, board columns, wave status, session lists become
**materialized folds** maintained by the kernel and stored in the Index plane.
During migration they remain on disk as today (readers unchanged) but are declared
non-authoritative: replay(events) must reproduce them, and a `kage replay --verify`
check proves it in CI. Recovery becomes trivial by construction: a crashed anything
re-folds.

### 3.4 Compute: executors and the scheduler

- An **executor** is a place work runs: `local` (today's detached supervisors),
  later `pool` (N warm worktrees) and `remote` (another machine's daemon in LAN or
  service tier).
- The per-machine verification lock (shipped) generalizes into a **queue per
  executor**: serialization where resources are shared, parallelism across
  executors. Queue wait stays in the receipt (shipped honesty rule).
- Agents and verifications are **jobs**: read ledger → do work in isolation →
  append events (claim, checks, receipt). Kill-safety is already crash-only
  (detached, adopt/resume); events make it also replay-safe.

### 3.5 Memory: episodes → beliefs (unchanged from BELIEF_MEMORY.md)

Episodes are capture-verified packets (immutable) + status events. Beliefs are the
40–60 consolidated documents owned solely by the sleep-cycle consolidator — the one
deliberate single-writer in the system, so belief rewrites cannot contend. Recall
serves beliefs first, episodes as evidence (first sleep in flight).

## 4. Deep dive

### 4.1 Storage layout (end state)

```
repo (code branches)      → code only. Zero memory, zero state, zero index.
memory branch (or service)→ events-YYYYMM.jsonl · packets/*.md · beliefs/*.md
~/.kage/<project>/        → index.sqlite (FTS+vectors+folds) · blobs/<sha256>
                            runs live-state (folds) · daemon socket+token
```

### 4.2 API (kept, formalized)

The shipped REST+SSE surface survives with its guard model (loopback + 0600 token,
LAN pairing secret). Formalized as: **POST = command → events appended → SSE notifies
`{stream, seq}` → clients re-read folds.** Events are notifications, never state —
the law that already prevented phantom-board bugs stays the contract.

### 4.3 Verification (untouched on purpose)

Re-execution, receipts, ran/inspected registers, merge-honesty, budgets — the
product core moves planes without changing meaning: results become events, receipts
become blobs, the verdict logic does not change.

### 4.4 Indexing at monorepo scale

Cold-index-everything dies at 1M files. The Index plane goes **partial and lazy**:
index the blast radius (brief scopes, changed paths, their dependents) on demand;
background-fill the rest with a budget; recall states its coverage honestly
("recall over 34% of tree — indexed paths listed") rather than pretending totality.
Full-tree semantics remain a `kage index --full` choice.

### 4.5 Error handling

Crash-only everywhere: no graceful-shutdown dependencies. Any process may die at
any instant; correctness comes from (a) events append-then-ack, (b) folds replayed
on start, (c) jobs idempotent by run id. The recovery vocabulary users see
(resume/adopt/close-as-landed) is unchanged.

## 5. Scale & reliability estimates

50 engineers × 20 runs/day × ~200 events/run ≈ **200k events/day** — trivial for
JSONL+sqlite (that is ~2 events/sec sustained). Blobs ≈ 50MB/day/machine, GC'd by
age+refcount. Git-tier memory branch at 10 writers ≈ tens of appends/min — line-
union merges, no contention. Queue depth and event lag become the two new gauges on
the app's status bar; both derive from the ledger itself.

## 6. Trade-offs (explicit)

| Choice | Cost | Why it wins anyway |
|---|---|---|
| Event sourcing | more moving parts than files-as-state | every scar in §1 is a state/ledger confusion; replay kills the whole bug class |
| Events as truth, markdown as export | inverts today's story | no-lock-in is preserved by export fidelity, not by markdown being primary; guarded by an export round-trip test |
| Git as *a* transport | ~10-writer ceiling, clunky beyond | it is the zero-infrastructure wedge; the ceiling is the paid tier's doorbell |
| Single-writer consolidator | beliefs serialize on one job | contention on the semantic layer is a feature; sleep is periodic |
| Partial indexing | recall coverage < 100% on huge repos | honest coverage beats fake totality; matches the receipt culture |
| Phased migration via runs | slower than rewrite | every phase lands kernel-verified with the suite green; no big-bang risk |

## 7. Migration phases (each = a Kage goal)

- **P1 ✅ shipped** — derived state decommitted; status changes append-only.
- **P2 🔄 in flight** — no in-place packet mutation anywhere (P2a ✅); memory
  branch, opt-in (P2b).
- **P3** — run/goal lifecycle emits events; folds proven by `replay --verify`;
  task.json/goal.json declared views.
- **P4** — executor abstraction + scheduler subsumes the verification lock; blob
  store with GC.
- **P5** — sync service tier speaking the same ledger; LAN executors.
- **P∞** — beliefs + sleep cycle mature into the primary recall surface
  (first sleep already running).

## 8. What we revisit as it grows
Belief governance across multiple teams; blob GC policy under long-lived audits;
the remote executor security model (today's guard model is loopback-first);
index sharding once partial indexing meets true monorepos; whether the service
tier needs multi-region.
