# The Memory System — deep dive of the memory plane

**Status: DESIGN (2026-08-22).** Companion to `ARCHITECTURE_V2.md` (the planes) and
`BELIEF_MEMORY.md` (consolidation + storage laws). This answers the owner's sharpest
question directly: *how does memory actually work, and is git-based memory right?*

## 0. The direct answer

"Memory" is five workloads with different physics. Git is genuinely good at two of
them and structurally wrong for the rest:

| Workload | What it needs | Git's fit |
|---|---|---|
| Capture | async writes, dedupe, validation | poor (commit ceremony, no gate) |
| Recall | <100ms ranked query (FTS, vectors, affinity) | none — that's a database |
| Grounding | compare claims against the live tree | indifferent |
| Sync | eventual consistency across machines | **excellent** at small scale, zero infra |
| Audit & trust | immutable history, review, blame | **excellent** — this is git's soul |

So: **git-based memory is the right *repo-tier transport and audit trail*, and was
always the wrong *database*.** V2 already made the event ledger the truth and the
sqlite index the query engine. What was actually weak was none of the storage — it
was that we had a memory *pile* where we needed a memory *pipeline*. This document
designs the pipeline.

## 1. Requirements

- **Precision over volume.** Memory scales in signal, not bytes (755 packets is
  kilobytes; the failure mode was noise, measured: 292 stale-flagged, 304
  contradictions before gc). The enemy is never storage cost; it is recall junk.
- **Trust must be earned mechanically**, not asserted: a memory's weight should come
  from verification and from what happened when it was used.
- **Tiers of blast radius**: a half-confident hunch on my machine must not become a
  teammate's brief context without passing gates.
- **Redaction is a first-class path** (git history is forever; secrets happen).
- **No lock-in**: everything exports as OKF markdown at every tier.
- Latency: recall <100ms warm from the local index; capture may be async.

## 2. The pipeline — memory as lifecycle, not pile

```
CAPTURE → ADMIT → GROUND → RECALL → REINFORCE/DECAY → CONSOLIDATE → PROMOTE
   ↑                                     │
   └────────── outcome feedback ─────────┘
```

**Capture.** Anything may propose: an agent claim's `learned[]`, operator
`kage_learn`, sleep-cycle promotions. A proposal is an event; the packet markdown is
its capture artifact (immutable after write — enforced since P2a).

**Admit.** The gate (shipped): reject ≥0.92 near-duplicates naming the packet they
duplicate, reject below the quality floor, cap citation spam. Rejections are events
too — the negative space is knowledge ("we keep re-learning X" is itself a signal).

**Ground.** Every episode carries citations → content fingerprints. Grounding is
re-checked eagerly at refresh and lazily at recall; a memory whose cited code moved
is *withheld, never deleted* (a status event, reversible by reverify).

**Recall — the redesigned read path.** Layered: **beliefs first** (the 40–60
consolidated documents — small enough to always fit a brief), episodes only as
drill-down evidence. Ranked by a product of:
`path affinity (blast-radius match) × verification weight × reinforcement × recency`.
Served entirely from the local index. And critically: **every recall emits a
`memory.recalled` event naming the run it briefed.**

**Reinforce / decay — the loop nobody else can close.** Because Kage runs the
checks, every run ends in a verified outcome. Join `memory.recalled` events with
run outcomes and memory becomes **outcome-weighted**: a memory that rides verified,
merged runs gains weight; one that repeatedly briefs failing runs gets flagged for
review; one that is never recalled and never cited decays out of recall surfaces
(a `memory.decayed` event — reversible, auditable). This is the efficacy
measurement that was always the missing moat, and it is only possible in a system
that independently verifies outcomes. Human feedback (`helpful/wrong/stale`) folds
into the same weight.

**Consolidate.** The sleep cycle (BELIEF_MEMORY.md): episodes → belief revisions,
contradictions resolved or explicitly surfaced, single-writer by design.

**Promote.** Movement between tiers is explicit and evented — never automatic.

## 3. The tiers — where git is right, and where it is not

```
MACHINE tier   ~/.kage/<project>/  sqlite+events only. Private working memory:
               everything, including low-confidence and rejected. Never shared.
REPO tier      the memory branch (git). Admitted + grounded episodes, beliefs,
               and the status journal. PR-reviewable, blameable, zero-infra sync.
               Honest ceiling ~10 writers. ← git is EXACTLY right here.
ORG tier       the sync service (paid). Cross-repo beliefs ("how we do auth
               anywhere"), org conventions. Git cannot span repos sanely; this
               tier is why the service exists, not a nicer git.
PUBLIC tier    OKF export bundles. Deliberate, reviewed, rare.
```

The original sin was collapsing MACHINE and REPO into one place (everything an
agent half-learned went into the shared pile). The tiers make blast radius a
property of the *tier*, not of reader discipline.

## 4. Data model

- **Episode** = immutable packet markdown (capture artifact, OKF-conformant) +
  its event history (admission, grounding, status, recalls, outcomes).
- **Belief** = markdown document + revision events; owned by the consolidator.
- **Weights** (reinforcement, decay, outcome joins) live only in the index —
  derived, recomputable from events, never stored authoritatively.
- Addressing: packet id (stable slug) + content hash; events by ulid.

## 5. Scale, reliability, failure

Load is comically small by data-engineering standards (a 50-engineer org's memory
is megabytes/year; 200k events/day ≈ 2/sec). Every hard problem is a *quality*
problem: gate precision, ranking, consolidation judgment. Failure model is the
ledger's: append-then-ack, refold on start; a corrupted index is deleted and
rebuilt; a lost machine tier loses only unshared hunches — the repo tier is the
durable floor. Redaction: blobs were never in git; packets are secret-scanned at
capture; the worst case has a runbook (`memory.redacted` event + memory-branch
rewrite) — contained to the memory branch, never code history.

## 6. Trade-offs

| Choice | Cost | Why it wins |
|---|---|---|
| Git as repo-tier only | two storage systems to explain | each does what it's good at; the wedge stays zero-infra |
| Outcome-weighted recall | needs recall→outcome joins, new events | the moat: only a verifier can weight memory by truth |
| Machine tier privacy | teammates see less by default | half-learned hunches stop polluting shared briefs |
| Decay | a rarely-used gem could fade | decay is reversible + evented; the gem returns on first recall |
| Org tier = service-only | cross-repo memory is paid | git genuinely cannot do it; honesty beats a hack |

## 7. What would falsify the git tier

More than ~10 active writers per repo; frequent redactions; cross-repo recall
becoming a daily need; non-git consumers. Each is the service tier's doorbell —
the design's job is to make that migration a transport swap, not a rewrite.

## 8. Phasing (rides the existing ladders)

- Now (shipped): admission gate, gc, append-only journal, immutable packets.
- With P2b: the repo tier becomes the memory branch.
- First sleep (running): beliefs exist; recall flips beliefs-first in its wave 2.
- **M-next**: `memory.recalled` events + outcome joins + reinforcement/decay
  weights in the index — the loop closes.
- With P5: the org tier.
