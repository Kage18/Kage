# How Kage works — product and technical

*The visual companion to [DIRECTION.md](./DIRECTION.md) (why) and [BUILD.md](./BUILD.md) (what
exists). Diagrams render on GitHub. Solid lines are wired and running; **dashed lines are built but
not yet connected**, and are called out every time.*

---

# Part 1 — The product

## 1.1 The problem, drawn

Every agent session pays to learn the same things, then throws the result away.

```mermaid
flowchart LR
  subgraph without["Without Kage — every session starts blind"]
    direction TB
    A1["Session 1<br/>learns why the limit is exclusive"] --> X1["session ends<br/>knowledge discarded"]
    A2["Session 2<br/>relearns it, slowly"] --> X2["session ends<br/>knowledge discarded"]
    A3["Session 3<br/>flips it, gets reverted"] --> X3["session ends<br/>knowledge discarded"]
  end
```

The knowledge does exist — in reverted PRs, in someone's head, in a Slack thread from March. It is
just not anywhere an agent can reach at the moment it matters.

```mermaid
flowchart LR
  subgraph with["With Kage — the third session is told"]
    direction TB
    B1["Session 1<br/>learns it"] --> C1["card proposed"]
    C1 --> C2["human approves"]
    C2 --> ST[("shadow store")]
    ST --> B3["Session 3<br/>told before it acts"]
    B3 --> B4["does not repeat it"]
  end
```

## 1.2 Day one — the first thirty minutes

The cold-start problem is fatal for a memory product: an empty store is a dead demo. Kage solves it
by reading history the team already wrote.

```mermaid
flowchart TD
  I["Install, point at a repo"] --> C["Consent screen<br/>what is read · where memory lives · the off switch"]
  C --> M["Press Mine history"]
  M --> L["Librarian reads ~200 commits<br/>on YOUR subscription"]
  L --> P["20-40 cited proposals"]
  P --> R["Review in the Inbox<br/>j k a r"]
  R --> B["BRIEF block written<br/>into your AGENTS.md"]
  B --> S["Start coding normally"]
```

**Measured on this repository:** 150 commits → 10 cited cards, **74 seconds**, **$0.40** of your own
subscription. Reviewing them doubles as the fastest architecture tour of your own codebase, because
every card cites the commit it came from.

## 1.3 The daily loop — the habit

```mermaid
flowchart LR
  W["You work<br/>agent runs normally"] --> R["Card arrives mid-session<br/>at the moment it matters"]
  R --> E["Session ends"]
  E --> T["Librarian triages<br/>rejects ~90 percent"]
  T --> PR["At most 3 proposals"]
  PR --> IN["Tray badge: 2"]
  IN --> M["Morning: 90 seconds<br/>coffee, j k a r"]
  M --> W
```

Two properties make this a habit rather than a chore:

- **You never open Kage to get value.** Cards reach you inside the agent session you already live in.
- **The only thing you open Kage for is a verdict**, and it takes ninety seconds with a keyboard.

The `~90%` rejection is the design working. Cursor shipped memories without a triage filter and
killed the feature over junk.

## 1.4 The team loop

```mermaid
flowchart TD
  subgraph you["Your machine"]
    YS["Your session"] --> YL["Your Librarian"] --> YP["proposal"]
  end
  YP --> SR[("Shadow repo<br/>private remote on YOUR git host")]
  subgraph mate["Teammate's machine"]
    SR --> TI["Their Inbox"]
    TI --> TA["They approve"]
    TA --> TAG["Their agent is told<br/>Wednesday, different machine"]
  end
  TAG --> XP["cross-pollination receipt"]
```

**The scoreboard is cross-pollination** — cards authored in one person's session, delivered into
another person's agent. Measurable per receipt. Deliberately *not* "repeat failures prevented,"
which needs a counterfactual nobody can run.

## 1.5 Where Kage sits

```mermaid
quadrantChart
    title Agent memory in 2026
    x-axis "Per-user" --> "Team-shared"
    y-axis "Human-written" --> "Agent-written"
    quadrant-1 "Kage: agent-written AND shared"
    quadrant-2 "Rules files"
    quadrant-3 "CLAUDE.md, AGENTS.md"
    quadrant-4 "Auto-memory, machine-local"
    "Claude Code auto-memory": [0.15, 0.85]
    "Codex memories": [0.18, 0.80]
    "Cursor Memories": [0.20, 0.75]
    "claude-mem": [0.12, 0.90]
    "CLAUDE.md": [0.30, 0.15]
    "AGENTS.md": [0.35, 0.12]
    "Cursor team rules": [0.70, 0.20]
    "Devin Knowledge": [0.80, 0.55]
    "Copilot Memory": [0.78, 0.70]
    "Kage": [0.88, 0.88]
```

First-party memory is per-user and machine-local; vendors explicitly punt team knowledge to
hand-written repo files. Devin and Copilot are team-shared but locked to one vendor's cloud. The
unoccupied corner is **cross-agent + team-shared + agent-written + verified-against-git**.

## 1.6 The business, in one diagram

```mermaid
flowchart LR
  F["Solo — free forever<br/>full Librarian, local store"] -->|"funnel"| T["Team — $20/seat<br/>hosted remote, roles, receipts"]
  T -->|"expansion"| B["Business — $40/seat<br/>SSO, audit, org views"]
  F -.->|"marginal cost ~0"| Z["Inference rides the user's<br/>OWN subscription"]
```

> *Your agents' subscription pays for the intelligence. You pay Kage for trust, sync, and governance
> — the layer nobody bundles.*

---

# Part 2 — The technical system

## 2.1 Components

```mermaid
flowchart TB
  subgraph agents["Your agents"]
    CC["Claude Code"]
    CX["Codex"]
  end

  subgraph core["Kage core — mcp/vnext/librarian, node builtins only"]
    OPS["operations.ts<br/>the only verbs any surface calls"]
    LIB["librarian.ts<br/>triage then extract"]
    MIN["miner.ts<br/>history"]
    WAT["watcher.ts<br/>idle sessions"]
    GATE["card.ts + secretscan.ts<br/>the deterministic gate"]
    STORE["store.ts<br/>shadow git repo"]
    VER["verify.ts<br/>citations vs the tree"]
    REC["recall.ts + brief.ts<br/>delivery"]
  end

  subgraph surfaces["Surfaces"]
    CLI["kage cards"]
    APP["Desktop Inbox"]
  end

  PROV["provider.ts<br/>claude -p on YOUR subscription"]

  CC -.->|"transcripts"| WAT
  WAT -.->|"NOT SCHEDULED"| LIB
  MIN --> LIB
  LIB --> PROV
  LIB --> GATE
  GATE --> OPS
  OPS --> STORE
  OPS --> VER
  OPS --> REC
  CLI --> OPS
  APP --> OPS
  REC -->|"BRIEF block"| CC
  REC -.->|"NO MCP TOOL YET"| CX
```

Two dashed edges are the whole of what is missing from the loop: **nothing schedules the watcher**,
and **no MCP tool serves cards to an agent mid-session**.

## 2.2 Capture — the sequence

```mermaid
sequenceDiagram
    autonumber
    participant S as Agent session
    participant W as watcher.ts
    participant L as librarian.ts
    participant P as claude -p
    participant G as Gate
    participant ST as Shadow store
    participant H as Human

    S->>W: transcript goes idle 10 min
    W->>L: digest, keeping start and end
    L->>P: Pass 1 — triage, cheap tier
    P-->>L: "NO: routine edits"
    Note over L: ~90% stop here.<br/>This is correct behavior.
    L->>P: Pass 2 — extract, working tier
    P-->>L: at most 3 cards, JSON
    L->>L: reconcile — ADD / UPDATE / NOOP
    L->>G: proposals
    G->>G: citations resolve? secret scan? duplicate?
    G-->>L: refused, with reasons
    G->>ST: admitted, one git commit each
    ST->>H: tray badge
    H->>ST: approve
    ST->>ST: re-pin citations, audit trust, refresh BRIEF
```

Step 9 is the load-bearing one: **the model proposes, the machine disposes.** The gate is
deterministic so its refusals are auditable and cannot be argued with by a model having a bad day.

## 2.3 The gate

```mermaid
flowchart TD
  P["Proposal from the Librarian"] --> C1{"Cites anything?"}
  C1 -->|no| R1["REFUSED<br/>a claim nothing can falsify is trivia"]
  C1 -->|yes| C2{"Claim under 160 words?"}
  C2 -->|no| R2["REFUSED<br/>cards are claims, not documents"]
  C2 -->|yes| C3{"Paths repo-relative?"}
  C3 -->|no| R3["REFUSED<br/>cannot be verified against a tree"]
  C3 -->|yes| C4{"Secret scan clean?"}
  C4 -->|no| R4["REFUSED<br/>a synced secret cannot be unsynced"]
  C4 -->|yes| C5{"Content-address seen?"}
  C5 -->|yes| R5["DEDUPED<br/>counted apart from refusal"]
  C5 -->|no| A["ADMITTED as proposed"]
  A --> H{"Human verdict"}
  H -->|approve| AP["approved — becomes team knowledge"]
  H -->|reject| RT["retired, with the reason on record"]
```

Dedupe is counted **separately** from refusal on purpose: *"we already knew that"* is the system
working, while *"the gate refused this"* is a quality signal about the extractor. One number would
hide whichever is degrading.

## 2.4 Two state machines, deliberately separate

Lifecycle is what **humans** decide. Trust is what the **code** decides. Conflating them is how
memory systems end up serving confidently wrong facts.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> proposed: Librarian proposes
    proposed --> approved: human approves
    proposed --> retired: human rejects
    approved --> superseded: a newer card replaces it
    approved --> retired: withdrawn
    note right of superseded
      Supersede, never delete.
      The chain is the audit trail.
    end note
```

```mermaid
stateDiagram-v2
    direction LR
    [*] --> unverified: approved, not yet checked
    unverified --> verified: citations match the tree
    verified --> unverified: cited file drifted
    verified --> stale: cited symbol or file is GONE
    unverified --> stale: cited symbol or file is GONE
    stale --> verified: re-verified after a fix
    note right of stale
      WITHHELD from every agent.
      Visible to humans, counted
      as a receipt. A bad memory
      is worse than none.
    end note
```

## 2.5 Retrieval — three tiers

```mermaid
flowchart TD
  ST[("Approved cards")] --> F{"verify state"}
  F -->|stale| WH["WITHHELD<br/>counted, shown to humans, never to agents"]
  F -->|verified or unverified| T1["Tier 1 — BRIEF<br/>200 lines max, always on"]
  F -->|verified or unverified| T2["Tier 2 — trigger-scoped<br/>on touching a cited file"]
  F -->|verified or unverified| T3["Tier 3 — search<br/>on demand"]
  T1 -->|"fenced block in AGENTS.md"| AG["Agent"]
  T2 -.->|"NOT WIRED — needs an MCP tool"| AG
  T3 --> CLI["kage cards recall"]
  AG --> RCPT["delivery receipt"]
```

Scoring for Tier 2 is deterministic and explainable — every served card carries a *why*:

```
+3.0   a query file matches a cited path
+1.0   a query keyword appears in the trigger
+0.5   a query keyword appears in title or claim
```

A real run: `kage cards recall "why is the board slow" --files mcp/vnext/api/read-models.ts` served
three cards, each annotated `trigger matched 'board', 'slow'`.

## 2.6 Where the bytes live

```mermaid
flowchart LR
  subgraph repo["Your project repo — 1 file touched"]
    AG["AGENTS.md<br/>one fenced block, 200 lines max"]
  end
  subgraph home["~/.kage/store/&lt;repo-id&gt; — a git repo of its own"]
    CD["cards/*.md<br/>one file per card"]
    RC["receipts/YYYY-MM.jsonl"]
    WS["watcher.json"]
  end
  home -.->|"optional remote — the team tier"| GH[("private repo<br/>on your git host")]
```

```
~/.kage/store/bb02419cfae5/     ← sha of the git remote, so two clones share one store
├── cards/
│   └── card_fa02a676.md        ← markdown, JSON frontmatter, readable with `cat`
├── receipts/2026-08.jsonl      ← append-only counted events
└── watcher.json                ← machine-local, never synced
```

`repoStoreId` hashes the **git remote** when there is one, falling back to the absolute path. Two
clones of one origin therefore share a store; two unrelated repos never collide.

**Repo footprint, before and after:**

| | packets in repo | tracked memory files | commits touching memory |
|---|---|---|---|
| before | 405 | 404 of 1,018 — **40%** | 200 of last 200 |
| after | 0 | **1 fenced block** | only when the BRIEF changes |

## 2.7 The card, as data

```mermaid
erDiagram
    CARD ||--|{ CITATION : "must have at least one"
    CARD ||--|| PROVENANCE : "records its origin"
    CARD ||--o{ RECEIPT : "accumulates counted events"
    CARD ||--o| CARD : "supersedes"

    CARD {
        string id "card_ + 8 hex, content-addressed"
        enum kind "decision | runbook | caution"
        enum state "proposed | approved | superseded | retired"
        enum verify "verified | unverified | stale"
        string title
        string claim "160 words hard cap"
        string trigger "when to recall it"
    }
    CITATION {
        string path "repo-relative"
        string symbol "optional"
        string blobSha "pins what the claim was written against"
        string ref "or commit:sha / pr:number"
    }
    PROVENANCE {
        enum source "session | mining | human"
        string ref "session id or history:N"
        string at "ISO timestamp"
    }
```

## 2.8 Why the extraction sits where it does

```mermaid
flowchart TD
  Q["Where does the intelligence that decides<br/>what to remember actually live?"] --> O1["Option A — heuristics<br/>substring scoring"]
  Q --> O2["Option B — the working agent<br/>remembers as it goes"]
  Q --> O3["Option C — a background pass<br/>on the user's own subscription"]
  O1 --> F1["FAILED. 405 packets, 43% dead,<br/>52 stale suppressions per recall"]
  O2 --> F2["Documented failure mode:<br/>the working model saves task logs"]
  O3 --> W["CHOSEN. Where Cursor, Codex and<br/>Cloudflare all converged"]
```

The old Kage was Option A, and worse: the LLM seam existed as **dead code** —
`createProxyLoopbackProvider` even harvested credentials on every proxied request, but the one
production pipeline was constructed without a model provider.

---

# Part 3 — Wired vs not

```mermaid
flowchart LR
  subgraph done["Running today"]
    D1["Mine history → cards"]
    D2["Deterministic gate"]
    D3["Shadow store, git-backed"]
    D4["Inbox: approve / reject"]
    D5["BRIEF block into AGENTS.md"]
    D6["Trust audit + stale withholding"]
    D7["Counted receipts"]
    D8["kage cards CLI, 9 verbs"]
  end
  subgraph next["Phase 1 — closes the loop"]
    N1["Schedule the watcher"]
    N2["kage_recall MCP tool + hook"]
    N3["Dedupe on mine"]
  end
  subgraph later["Phase 2 and 3"]
    L1["One store — retire legacy capture"]
    L2["Team remote + per-card review"]
    L3["Spec grounding, post-merge post-mortem"]
  end
  done --> next --> later
```

| | status |
|---|---|
| Librarian core, 16 modules, ~2,970 lines | **done**, 166 tests |
| Real mining run | **done** — 150 commits, 10 cards, 74s, $0.40 |
| Desktop Inbox with real cards | **done**, verified in the running app |
| `watcher.ts` | built, tested, **no timer calls it** |
| MCP recall tool / pre-edit hook | **not built** |
| Dedupe inside `mineHistory` | **not built** — a second run proposed 10 fresh cards, `0 already known` |
| Legacy capture pipeline | **still running in parallel** |
| Team sync | **not built** |

**Suites:** librarian 166 · core 1,824 · web 172.

---

## The sentence the whole system is built from

> **Intelligence where judgment is needed. Determinism where trust is needed. A human where team
> knowledge is born.**

A model decides what was worth learning, because that needs judgment. A machine decides what may be
stored and what may be served, because that needs to be auditable. A person decides what becomes the
team's, because that is what makes it theirs.
