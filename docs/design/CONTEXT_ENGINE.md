# Kage's Context Engine

*Design proposed 2026-08-20, written against the delegation layer locked in
`KAGE_DELEGATION_DESIGN.md` (2026-08-12). Specifies the engine that decides what
every session — orchestrator, worker, reviewer — knows, measures what that context
cost and earned, and tunes itself from outcomes. Does not replace any shipped
mechanism; every "Exists" below cites the real symbol carrying it today.*

## One line

**An agent's output quality is bounded by its context, not its model. Kage already
owns the three inputs a context engine needs — repo memory with verification
metadata, a code graph, and receipts of what every past run did — so deciding what
each session knows, at every moment of its life, is the product's second moat
after verification.**

AO and Conductor wrap the agent's session. Neither decides what the agent *knows*.
Kage does — today, unevenly, in four places already built (`compileBrief`,
`preflightForecast`, the claim's `brief_memory_ids`, `mergeRun`'s ratification) and
nowhere yet as one accountable system. This doc is that system's design.

## Definition

The context engine is the part of Kage that, for every session it puts a model
behind, decides what that session knows at each moment, measures what the
context it was given cost and earned, and tunes future decisions from the
outcome. It has one job repeated at five surfaces: **hire, work, verdict, ratify,
and the orchestrator's own session** — the last because the manager is a session
too, and its context is not exempt from the same discipline.

## Why this matters — evidence from this repo's own operation, 2026-08-19/20

**(a) The touch-set defect.** `compileBrief` (`mcp/delegation/brief.ts:177`) filled
its 8-slot predicted touch set with up to 3 paths from each of 5 recalled
memories *before* the code graph's own answer for the intent was ever
consulted — so a loosely-matched memory citation could crowd out the file the
intent actually named. Commit `5b164059` measured this against the live daemon:
a one-file rename intent for `mcp/delegation/verify.ts` forecast 26 unrelated
dependents with `verify.ts` itself absent from the list; a real dispatched
brief whose whole job was `app-styles.ts` predicted eight files, zero of them
`app-styles.ts` or `app-client.ts`, and three of the eight were
`.agent_memory/packets/*.md` — Kage's own memory storage, offered as source
files a code change would land near. The brief's own text told the agent not
to touch `room-pty.ts` and `room-supervisor.ts`, then the touch set pointed
straight at them. The fix (now in `namedTouches`, `mcp/delegation/brief.ts:127`,
consumed unconditionally before memory or graph candidates at
`mcp/delegation/brief.ts:217-220`) and its regression coverage
(`mcp/touch-set.test.ts`) landed the same day.

**(b) MCP responses were the harness's own worst tax.** Repo memory (packet
`kagememorylifecycles-memorylifecycleitem...`) recorded `kage_memory_lifecycle`
returning 1,859,953 characters on this repo (433 packets, full `body` +
`summary` per item, no truncation) and `kage_pr_check` returning 321,873
characters — roughly 80,000 tokens, a third of a context window, from one
call. *(The plan this doc was drafted from cited "342K" for `kage_pr_check`;
the number on record is 321,873 chars — corrected here rather than repeated.)*
`capCollection` (`mcp/response-cap.ts:20`), `responseCapLimit`
(`mcp/response-cap.ts:38`), and `capFields` (`mcp/response-cap.ts:51`) are the
fix that shipped in response: every capped MCP
list now returns a stated total and a truncation note instead of the raw
collection. The harness that exists to save an agent's context was, before
this, its largest consumer.

**(c) Hand-scoped concurrency, not engine-scoped.** Every brief this session
issued carries a `CONSTRAINTS` section naming the exact files other concurrent
runs own — e.g. "Do NOT touch `mcp/delegation/brief.ts`, `preflight.ts`,
`verify.ts`... four other runs own diffs in those files" — written by the
operator into each brief by hand, run by run. Nothing in `compileBrief` or
`preflightForecast` reads the set of currently `running` runs (`RunState`
includes `"running"`, `mcp/delegation/contract.ts:21`) or their live worktree
diffs to derive this automatically. The disjoint-file-set discipline that has
kept this session's parallel merges conflict-free is a fact about the
operator's attention, not a guarantee the engine provides.

**(d) Workers are told what they may not ask.** `renderBrief`
(`mcp/delegation/brief.ts:294`) writes, verbatim, into every brief: *"You never
run `kage_refresh`, `kage_learn`, or `kage_pr_check`... Never block on, or ask
permission to run, those tools."* And it's not a soft rule — hired workers are
spawned with `--allowedTools` set to `AGENT_ALLOWED_TOOLS`
(`mcp/delegation/adapters/index.ts:24`) — `["Read", "Write", "Edit", "Glob",
"Grep", "Bash"]`, no more — and no `--mcp-config` flag at all, so there is no Kage MCP
tool on a worker's process to call even if the brief allowed it. A worker that
hits a repo fact its brief didn't happen to cite has exactly one option:
rediscover it by reading source, the same work `kage_context` already did once
at hire time.

## The four moments

Context is decided at four moments in a run's life. The engine's job is to own
all four with the same discipline currently applied to only the first.

### 1. HIRE — the brief compile

**Exists.** `compileBrief` (`mcp/delegation/brief.ts:177`) is the whole
mechanism: memory citations from `recall()` (`mcp/kernel.ts:10913`), a
predicted touch set that — since the touch-set fix — ranks intent-named paths
first (`namedTouches`, `mcp/delegation/brief.ts:127`, filled into `touches`
before any memory or graph candidate, lines 217-246), derived checks
(`resolveTestCommand`/`diffBudget`), and the `MANAGER_CONSTITUTION`
(`mcp/delegation/manager-prompt.ts:7`) framing the whole exchange for the
manager's own session.

**Gaps:**
- **No token budget on the brief itself.** `compileBrief` caps the touch set at
  8 paths (`TOUCH_CAP`, `mcp/delegation/brief.ts:213`) and memory at `limit = 5`
  entries, but nothing sums what those entries actually cost in tokens once
  `renderBrief` (line 294) serializes titles, summaries, and citation lists
  into prose. A brief can grow unboundedly verbose within its slot counts.
- **Memory slots are filled by several signals, none of them run outcome.**
  Recall's final score (`mcp/kernel.ts:10506`) sums lexical/BM25 match
  (`provider: "bm25"`, line 277), graph-edge score, intent boost, vector
  score, freshness, and two more: `recallQualityScore`
  (`mcp/kernel.ts:3881` — capture-time heuristics: packet type, source refs,
  paths, tags, body length) and `packetFeedbackScore` (`mcp/kernel.ts:3876` —
  `votes_up*2 - votes_down*3 - reports_stale*4`, driven by explicit
  `kage_feedback` calls), plus a usage boost, `memoryAccessScore`
  (`mcp/kernel.ts:2823`), from how often and how well-ranked a packet's past
  recalls were (`uses_30d`, log-scaled). Five-plus signals, and not one of
  them asks whether the *runs* a packet was briefed into actually merged. A
  packet cited into three failed runs in a row scores exactly as well as one
  cited into three merged ones, provided the other signals are equal. This is
  Phase 4's gap, not a hire-time one, but it originates here.
- **No awareness of other RUNNING runs.** `compileBrief` never calls
  `listRuns` (`mcp/delegation/contract.ts:480`) or reads another worktree's
  diff. The scoping described in evidence (c) above is entirely manual.

### 2. WORK — mid-run

**Gaps, both open:**

**(i) No read-only recall on the worker surface.** As evidence (d) shows, a
hired worker's process has zero MCP tools — not a restricted subset, none.
The fix is not "give workers the harness" (that would hand a worker
`kage_refresh`/`kage_learn`/`kage_pr_check`, exactly what
`CLAUDE.md`'s "Scope: Operator Only" section forbids for hired agents). It is
a narrower surface: a **scoped, response-capped `kage_context` subset** —
recall plus code-graph query, zero harness mutation, capped the same way
`mcp/response-cap.ts` already caps everything else on the MCP boundary — wired
into the worker's own `--mcp-config` (the mechanism already exists for the
manager: `--mcp-config` / `--append-system-prompt`,
`mcp/delegation/manager-prompt.ts:134`; a worker today gets neither flag).
A worker that hits a repo question its brief didn't anticipate should be able
to ask, not rediscover.

**(ii) No cross-run collision warning.** `preflightForecast`
(`mcp/delegation/preflight.ts:33`) already computes a predicted touch set
before dispatch by calling `compileBrief` — the same function, so the modal
and the brief can never disagree (documented explicitly in the file's own
header comment, lines 1-13). It has no notion of *other* runs. The fix rides
existing parts: `listRuns` filtered to `state === "running"`, each run's
worktree resolved via `worktreePath` (`mcp/delegation/worktree.ts:43`), its
live diff read the same way `mergeRun` already reads a branch's changed files
(`git(projectDir, ["diff", "--name-only", ...])`,
`mcp/delegation/ratify.ts:133`, and `dirtyPaths`, `mcp/delegation/git.ts:96`,
for uncommitted work) — intersected against the new run's predicted touch
set. Automating exactly the scoping the operator is doing by hand today
(evidence (c)).

**Exists, the enforcement arm:** response caps
(`mcp/response-cap.ts`, shipped 2026-08-19 per evidence (b)) are what keeps a
future scoped-recall tool from repeating the `kage_memory_lifecycle`/
`kage_pr_check` failure mode. Any mid-run tool this engine adds must be built
on `capFields`/`capCollection` from day one, not retrofitted after the fact.

### 3. VERDICT — the receipt

**Partially exists.** `brief_memory_ids` on `TaskRecord`
(`mcp/delegation/contract.ts:111`) records which memory packets rode a run's
brief — the input half of the loop. `packetsTaughtByRun`
(`mcp/delegation/memory-view.ts:258`) and `packetFlywheel`
(`mcp/delegation/memory-view.ts:237`, whose `used_by_runs` filters
`listRuns()` by `run.brief_memory_ids?.includes(id)`) are the read side: given
a packet, which runs cited it; given a run, which packets it taught.

**Gap: no context ROI on the receipt.** The claim card
(`renderClaimCard`, cited in `mcp/readme-claims.test.ts` as the
byte-for-byte-quoted example) shows checks, diff size, and citations. It does
not show, for a merged run, which of its `brief_memory_ids` the diff actually
touched versus which rode along unused, nor the brief's token cost against
what the run spent. Specification for the receipt line this engine adds:

```
CONTEXT  3 memories cited, 2 touched by the diff, 1 unused (auth-retry-flake, dead weight)
         brief ~1.1K tokens · run spent ~34K tokens (est., from adapter transcript)
```

Honesty rule, same one this repo already enforces everywhere else
(`KAGE_DELEGATION_DESIGN.md`'s "Verdicts come from exit codes Kage executed"
and `mcp/response-cap.ts`'s never-drop-silently convention): every estimated
number is labeled `(est.)`, and an absent number — no adapter transcript to
count tokens from, no diff to compare paths against — is printed as absent,
never backfilled with a guess. "Touched by the diff" is derivable exactly:
intersect `brief_memory_ids`' packet `paths` against the merge diff's changed
files, the same `git diff --name-only` primitive Phase 3 above already reuses.
"Brief tokens" is a straightforward count of the rendered brief string. "Run
spent" has no existing metering hook on this path today — CONSTRAINTS in this
run's own brief forbid touching `mcp/delegation/` to add one — so it ships
labeled `(est.)` or omitted until a real spend signal exists, not
interpolated.

### 4. RATIFY — after merge

**Exists.** `mergeRun` (`mcp/delegation/ratify.ts:116`) is where a claim's
`learnings` (drafted pending by `draftLearnings`, `mcp/delegation/ratify.ts:74`,
into the worktree's own packet store) get promoted: `setPacketStatus`
(`mcp/delegation/ratify.ts:33`, called with `"approved"` at line 159),
committed as its own step so the promotion is visible in history. "Merge
ratifies" is not a metaphor here — it is the literal status flip.

**Gap: recall ranking never learns from outcomes.** `trackrecord.ts` computes
`computeTrackRecord` (`mcp/delegation/trackrecord.ts:21`), which buckets runs
by **run TYPE** (`bugfix`/`chore`/`feature`/...) into
`{dispatched, verified_first, merged, rejected}`, and `curationComparison`
(`mcp/delegation/trackrecord.ts:69`), which splits the same shape by
`curated_by: "manager" | "kernel"`.
*(Correction: the plan called this "per-agent" — it isn't. Nothing in
`trackrecord.ts` buckets by which coding agent, e.g. `claude` vs `codex`, did
the work; `task.agent` is recorded on `TaskRecord` but never grouped on here.
The real shape is per-run-*type*, and the two-way `curationComparison` split
is the closer existing analog for what a per-packet version needs.)* The
per-packet record this phase specifies reuses that exact shape — no new
storage, since quality signals already live on the packet
(`quality: { votes_up, votes_down, uses_30d, ... }`, the same block
`memoryAccessScore` already reads) — computed as: for each packet id, walk
`listRuns()` filtered to `brief_memory_ids.includes(id)` (the same filter
`packetFlywheel.used_by_runs` already performs), bucket by `task.state`. A
packet with a `merged`-heavy record should gain recall weight the way
`memoryAccessScore`'s `useBoost` already rewards recall frequency; one with a
`rejected`/`failed`-heavy record should surface for review, not silently keep
ranking as if it were still trusted. This is additive to
`memoryAccessScore` (`mcp/kernel.ts:2823`), not a replacement — recall-frequency
and outcome-quality are different signals and both matter.

## The fifth surface: the orchestrator's own context

The manager (the room's mind — `MANAGER_CONSTITUTION`
(`mcp/delegation/manager-prompt.ts:7`) as system prompt, `MANAGER_ALLOWED_TOOLS`
(`mcp/delegation/manager-client.ts:13`) as its tool surface) is a session
too, and its context grows without bound: the constitution, goal state, board
digest, and replayed history all live in one conversation that never
naturally ends.

**Specification: compaction as summarize-and-respawn, riding the guard that
already exists.** `roomPermissionDigest`
(`mcp/delegation/room-supervisor.ts:134`) and `resolveRoomResumeId`
(`mcp/delegation/room-supervisor.ts:158`) already establish that a respawn is
safe exactly when the permission digest is unchanged — `resolveRoomResumeId`
returns the prior `session_id` to resume when `digestChanged` is false, and
drops it (forcing a fresh session) only when the surface actually changed.
Compaction needs the identical guarantee from the opposite direction: a
respawn triggered by *size*, not by a permission change, is exactly as safe
provided the summary that seeds the fresh session preserves what the digest
mechanism already proves survives a respawn — goal state and board digest are
kernel-read at clock-in (`KAGE_DELEGATION_DESIGN.md`'s own law 12: "the
manager is stateless over durable state... kill/restart/upgrade the mind
freely"), so a respawn only ever risks losing the *conversational* thread, not
kernel truth. Compaction is: past a size threshold, summarize the
conversation, write the summary where a respawn's first turn already reads
from, and let the existing digest-matched resume path carry it forward — no
new mechanism, a new *trigger* on the one that shipped 2026-08-19.

**Does not contradict the unified-session work in flight.** Chat and Terminal
are, as of this writing, two additive modes over the same session identity —
`room-pty.ts`'s own header (`mcp/delegation/room-pty.ts:1-7`) states this
directly: "Chat and Terminal previously spawned independent claude processes...
AO does not do that; its chat process runs with `--resume=<session-id>`" —
and both already route through the same `resolveRoomResumeId` /
`roomPermissionDigest` pair this compaction design rides. Whichever surface
becomes the canonical "view" of the underlying pty session, resume-safety is
decided once, in `room-supervisor.ts`, not per-surface — so compaction riding
that shared mechanism stays correct regardless of how Chat-as-a-view-of-pty
resolves.

## Phases

Each phase is independently shippable and independently testable. None
requires the others to land first, though 4 reads data that only exists once
1 is recording it.

| Phase | What ships | Acceptance |
|---|---|---|
| 1 — Measure | A context ledger per run: brief tokens, memory count, predicted graph paths, post-merge touched-vs-cited (the receipt line specified under VERDICT above) | The receipt for a real merged run in this repo shows context ROI — cited-vs-touched, with any estimated field labeled |
| 2 — Mid-run pull | Scoped, response-capped read-only recall (`kage_context` subset: recall + graph query, zero mutation) wired into the worker's own `--mcp-config` | A worker resolves a repo question via the tool mid-run, visible in its own transcript, not rediscovered by re-reading source |
| 3 — Cross-run scoping | `preflightForecast` warns when a new run's predicted touch set intersects a `running` run's live diff (worktree `git diff --name-only` + `dirtyPaths`) | Dispatching a run that overlaps a live run's diff produces a named warning listing the overlapping files, before the run starts |
| 4 — Outcome tuning | Per-packet outcome record (merged/rejected/failed counts from `brief_memory_ids`-filtered `listRuns()`), feeding `memoryAccessScore`-style recall rank | A packet with 3+ merged-run citations ranks above an otherwise-equal packet with none — an ordering assertion, directly testable against `recall()`'s output |
| 5 — Orchestrator compaction | Summarize-and-respawn behind `roomPermissionDigest`/`resolveRoomResumeId`, triggered by session size instead of permission change | A Room session past a size threshold respawns with a digest and the conversational thread visibly continues across the respawn |

None of these five is speculative about mechanism — each reuses a primitive
already shipped (`recall`, `queryCodeGraph`, `git diff --name-only`,
`memoryAccessScore`, `resolveRoomResumeId`) rather than inventing a new one.
What's missing in every case is the *decision* to route that primitive
through the moment that needs it, on a budget, with the outcome fed back.
That routing — not any single primitive — is what "context engine" names.
