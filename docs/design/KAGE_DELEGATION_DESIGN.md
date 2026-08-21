# Kage V0 — The Delegation Layer

*Design locked 2026-08-12, after a field study of 10 orchestration products, 8 memory
products, and the 2026 trust research. Supersedes the harness-only Phase 1 plan; evolves —
does not replace — the okf-era engine on master.*

## One line

**Kage is the delegation layer for coding agents: you speak an intent, it compiles a brief
from what the repo knows, hires an agent, executes the verification itself, and remembers —
so every delegation is smarter than the last.**

Positioning: *Claude Code is the best way to run one agent. Kage is the best way to
delegate work.* Product feeling: **delegation without dread.**

## Why this wins (the three empty seats)

Field research (2026-08-12) found every competitor dispatches with `raw prompt + static
AGENTS.md`, delivers evidence without checking it, and accumulates nothing between runs:

1. **Nobody compiles a brief.** No product recalls "last time we touched this module, X
   broke" into the task. The dispatch moment is unoccupied. (AGENTS.md/CLAUDE.md static
   files are the only briefing mechanism in the entire field.)
2. **Nobody checks claims.** Cursor attaches screenshots, Symphony attaches CI status,
   Codex cites logs — evidence is *delivered* everywhere, *executed by the system*
   nowhere. Sculptor's roadmap literally lists "'tests passed' without legitimate test
   validation" as future work. arXiv calls it the category's "responsibility vacuum."
3. **Nothing compounds.** AO's own docs: "No learning between sessions." vibe-kanban and
   Terragon died as panes with zero accumulated state. Memory is not Kage's feature — it
   is why an orchestrator survives platforms shipping native parallel dispatch.

Verification depth is the moat (Copilot's citation-verified memory has the only published
efficacy number in the space: +7% merge rate, p<0.00001 — and it's server-side and
invisible; ours is repo-committed and shown).

## Decisions locked

| Fork | Decision |
|---|---|
| Front door | **Conversational room** — `kage` opens a persistent session; verbs underneath for scripts |
| Kage's own mind | **Rented manager on a deterministic kernel** (locked 2026-08-12): the room is inhabited by a manager agent — an instance of the present coding agent running Kage's tools under Kage's constitution. Judgment (conversation, brief judgment, triage, sequencing, steering translation, report narration) is the manager's; guarantees (verification, ledger, budgets, memory gates, record) are the kernel's, and the manager physically cannot fake them. |
| Verifier | **Hybrid** — Kage re-runs cheap checks locally in the worktree; expensive ones delegated to CI, receipts read back. *Nothing is ever labeled verified unless Kage or CI executed it.* |
| Labor | **Headless CLIs** (`claude -p`, `codex exec`) in worktrees — rides the user's existing subscription — plus `kage open <task>` takeover (isolation without exile) |
| Memory ratification | **Merge ratifies** — learnings ride the claim's branch; merging the PR approves the memory in the same act. Git stays the review boundary. |
| Prior session (still binding) | OSS-adoption-first · no hosted platform · no own coding-agent loop · strangler modules from kernel.ts · honest receipts only |

## The interface

### The room

```
$ kage
kage · repo: acme/api · 2 running · 1 ready for review · memory: 47 verified

> fix the flaky auth retry test
  ┌ BRIEF — compiled from repo memory + code graph ─────────────────┐
  │ Intent    make test_auth_retry deterministic                    │
  │ Touches   src/auth/retry.ts, tests/auth.spec.ts (predicted)     │
  │ Knows     • Jul 12 incident: flakiness = clock mock (PR #84)    │
  │           • runbook: confirm flake fixes with --repeat 20       │
  │ Checks    npm test ×1 green · --repeat 20 clean · no new deps   │
  │           · diff ≤ 200 lines                                    │
  │ Agent     claude-code · worktree kage/fix-flaky-auth            │
  │ Confidence high → starting in 15s  (e: edit · h: hold)          │
  └─────────────────────────────────────────────────────────────────┘
```

One-shot verbs exist under the room for scripts and muscle memory:

```
kage "<intent>"            dispatch without entering the room
kage status                every task, one screen
kage tell <task> "…"       steer — applied at the next tool boundary
kage stop <task>           halt now; state preserved; always resumable
kage open <task>           print/cd the worktree — your own terminal/IDE takeover
kage review [<task>]       the receipt-first review moment
kage merge <task>          accept claim → merge branch → ratify learnings
kage reject <task> "why"   refuse — the reason is captured as memory
kage report                the while-you-were-away digest
kage memory                the notebook: what the repo knows, per-claim freshness
```

Exactly two steering verbs (`tell` = queue at boundary, `stop` = interrupt, resumable) —
the Cursor queue-vs-interrupt distinction. Visibility without a steering verb is dread
(the Answer.AI/Devin lesson).

### Moment 1 — Dispatch (adaptive gate)

- Brief is always shown: restated intent, predicted touch set, injected memories **with
  author + date**, derived acceptance checks, agent, confidence.
- High confidence → timer start (15s), editable, never a mandatory click (approval spam
  destroys gates — research consensus).
- Low confidence → the agent asks its 1–3 clarifying questions **before** burning compute
  (Devin's validated mechanic: clarify-when-unsure doubles merge odds).
- DENY list always human-gated regardless: secrets, deletion, infra, force-push.

### Moment 2 — Run

- No live stream by default. Task cards show: current step, last check result, spend so
  far, and **deviation-from-brief events by name** (unasked-for steps are the known
  misunderstanding signal).
- Hard behavioral law in every adapter prompt: **on hitting a blocker, report and pause —
  never improvise around it.** Budget caps (time/$) auto-pause into a `blocked` state.
- Worktree per task (settled physics everywhere; not a differentiator, just table stakes).

### Moment 3 — Review (receipt first, diff second)

```
CLAIM  test_auth_retry is deterministic — VERIFIED 3/3 (re-run by Kage, not agent-reported)
  ✓ npm test → 375 pass, exit 0                       [evidence/check-1.log]
  ✓ npm test -- --repeat 20 → 20/20                   [evidence/check-2.log]
  ✓ diff 84 lines, 2 files (≤ 200 budget)
  ⚠ unsure: chose 250ms timeout constant — look at retry.ts:42
  learned (ratifies on merge): "auth retry tests need fake timers, not sleep"
```

- Verdicts come from exit codes Kage executed. The agent's summary is never the verdict.
- The claim's citations (files/symbols it names) are checked by the existing verification
  engine — the okf-era kernel pointed outward at work products.
- "Unsure about" is a required section (honest uncertainty builds trust; its absence —
  false success — is the fastest documented trust killer).
- **Size refusal:** above the diff budget the claim presents as *"too large to review
  well — split it?"* — never as ready (Intercom's most effective single gate).
- Rejection reasons become memory. Negative results are captured — nobody in the field
  keeps them.

### Moment 4 — Report + track record

```
$ kage report
While you were away (2h)
  ✓ fix-flaky-auth      verified 3/3 — ready to merge (~2 min review)
  ⏸ payments-migration  blocked: backfill order? (a) users-first (b) orders-first
  ✗ update-deps         stopped at $1.20 cap — vite 6 breaks the viewer build → remembered
  Trust: 5/5 claims verified this week · refactors 9/10 clean · migrations 2/5
```

- One digest per absence, never per event. Done / Blocked / Stopped — nothing else
  notifies.
- Every number observed, never model-estimated (Phase 0's receipt law carries over: a
  digest caught inflating once is a digest never read again).
- **Track record over self-confidence** (research-backed calibration): per task-type
  verified/merged/reverted rates, shown at dispatch and in reports. Unpredictability —
  the deepest anti-pattern — becomes a managed, visible quantity.

### Memory (the notebook + merge ratification)

- Unit stays the OKF packet (independently reconstructed as the ideal by the field study:
  fact + citations + reason + provenance + bitemporal state) **plus** a Devin-style
  trigger line ("use when…") and Copilot-style verify-to-refresh TTL.
- **Capture:** the extractor reads the run transcript (we own it — headless output) and
  proposes 0–2 learnings per run, attached to the claim. Corrections (`tell`/`reject`
  text) are first-class capture, not quarantined chatter.
- **Ratification:** proposed packets are committed *on the claim's branch*. Merging the
  PR ratifies code + memory in one act; Kage flips pending→approved on merge detection.
  Zero extra ceremony; the packet lands in the same PR as the code it describes. Nobody
  else does this.
- **Reading:** briefs consume memory (progressive disclosure — index first, bodies on
  demand); `kage memory` is the single pane of everything loaded + freshness (replaces
  "delete your CLAUDE.md every 6 months" with per-claim lifecycle).
- Compile-out: verified memory renders one-way into AGENTS.md so non-Kage agents benefit
  (interop with real gravity; no round-trip machinery).

## System components (→ existing assets)

| Component | Builds on |
|---|---|
| Manager (the room's mind) | rented: the present coding agent run as a session with Kage's MCP tools + the manager constitution as system prompt. Stateless over kernel state — clocks in by reading the room (tasks, claims, memory index), so it is killable/restartable/upgradable at zero cost and never drifts from ledger truth. Wakes on user messages and judgment-needing events; idle costs nothing. |
| Room / verbs | thin shell: launches/attaches the manager session, renders kernel cards; verbs bypass the manager and hit the kernel directly for scripts/CI |
| Brief compiler | recall + code graph + runbook conventions (kernel.ts, extracted module) |
| Adapters | new, tiny: `claude -p` first, `codex exec` second — the contract is brief-in / transcript+diff-out |
| Worktree manager | new, thin (git worktree add/remove + setup script per repo, Conductor's pattern) |
| Verifier | okf-era verification engine + a check-runner (command checks, diff constraints, citation truth) |
| Extractor / capture | Phase-0-hardened capture gates + agentic judgment (session transcript in) |
| Store | `.agent_memory/` as-is; add `runs/<id>/{brief.md, claim.json, evidence/}` |
| Track record | new: `reports/track-record.json`, observed events only |
| Fleet view | existing `kage viewer`, demoted to read-only mirror |

## Interface constitution (non-negotiable laws)

1. Verified means *executed by Kage or CI* — never agent-reported.
2. Blockers are reported, never improvised around.
3. Plan-level gates only; adaptive by confidence; no approval spam.
4. Two steering verbs; interruption is always resumable.
5. Oversized work is refused as "ready," offered as "split?"
6. One digest per absence; notifications are a scarce resource.
7. Every number observed and reproducible; estimates labeled or absent.
8. Track record shown, self-confidence not.
9. Memory used is memory cited (author + date, in the brief and the reply).
10. Own what compounds, rent what commoditizes, refuse what giants defend.
11. **Kernel facts render as cards; manager speech is prose.** The manager never restates
    numbers — cards carry numbers. A manager can be wrong in prose; it cannot forge a receipt.
12. **The manager is stateless over durable state.** All truth lives in the kernel; the
    manager reads the room at clock-in. Kill/restart/upgrade the mind freely.

## V0 status — built 2026-08-12

All eight steps are implemented under `mcp/delegation/` (398 unit + 12 dogfood tests
green). Verbs: `kage room · dispatch · runs · task · review <run> · merge · reject ·
open · tell · stop · retry · report · config`. MCP: 10 delegation tools, gated on
`KAGE_ROOM=1` so a normal coding session is not handed orchestration verbs.

Proven end to end on a scratch repo: memory captured by one person reaches the next
dispatch's brief with author and date · a stand-in agent's claim is contradicted by
Kage's own `npm test` execution (the planted lie) · a truthful claim verifies 3/3 with
evidence logs on disk · `kage merge` lands the branch and ratifies the learning in the
same act · the *next* brief carries that learning.

Deferred to V0.5, labeled not faked: CI-backed checks (`ci` check kind), event push into
the room (pull at turn boundary today), leases for path-overlap serialization.

## V0 build order (each step has a definition of done)

1. **Contract + store** — run record schema, task states. DoD: dispatch round-trips with a stub adapter.
2. **claude-code adapter** — headless in a worktree. DoD: a real task completes end-to-end.
3. **Brief compiler v1** — recall + graph + checks + confidence timer. DoD: dispatch on this repo shows ≥1 real memory in the brief.
4. **Verifier v1** — command checks + diff constraints + citation truth, re-run locally. DoD: a planted false "tests pass" claim is caught. *(This is the demo.)*
5. **Review + merge-ratify** — receipt render, diff handoff, learnings ride the branch. DoD: full loop closes on a real Kage bug.
6. **Room v1** — manager session (system prompt + MCP tool surface over the kernel) inside a thin shell that renders cards. DoD: two concurrent tasks steered conversationally from one room; killing and restarting the manager mid-flight loses nothing.
7. **Report + track record.** DoD: observed-only digest renders.
8. **codex adapter** — proves the adapter contract with a second brand.

Then: the demo GIF (dispatch → brief shows memory → claim verified → merge ratifies →
*second* dispatch visibly already knows) and a fresh-clone e2e CI test. Success bar:
fresh repo → first verified claim in under 15 minutes, no seeded data.

## Explicitly deferred

Team room / multiplayer queue · tracker importers (Linear/GitHub issues as intents) ·
web dashboard as anything but a mirror · Agent SDK native runner · best-of-n fan-out ·
platform APIs · discovery/spec/distribution altitudes. The ladder exists; V0 is the
single-user delegation loop that must feel magical alone.
