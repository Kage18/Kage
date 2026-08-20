# Kage's Session Surface

*Design proposed 2026-08-20, grounded in a hands-on session driving Agent Orchestrator
(AO) v0.12.5's real UI the same day, and written against the delegation layer locked in
`KAGE_DELEGATION_DESIGN.md` (2026-08-12). Specifies how Kage's browser app should render
the orchestrator and its hired workers — adopting AO's session frame where it is simply
better UI, refusing it where it would cost Kage's verification its place at the center.
Every "exists" below cites the real symbol carrying it today; every "gap" was confirmed
by grep, not assumed.*

## One line

**AO proved that an orchestrator and a worker are the same kind of object — a session —
and that a sparse card plus a real terminal beats a dashboard of custom widgets. Kage
keeps that frame and throws out AO's one weak spot: it trusts the worker's word. Every
surface this doc adds still answers to the receipt.**

## What was observed, driving AO today

AO v0.12.5's actual UI, used first-hand, not read about:

1. The orchestrator view is Claude Code's own TUI, unmodified, in a thin frame — a tab
   with an activity dot, `+ Task`, `Open Kanban`, a bell. Nothing else.
2. Orchestrator and worker are **one object**: a session with `kind: orchestrator|worker`.
   Workers appear instantly in the project sidebar with activity dots; each opens as its
   real session and accepts typed input, same as the orchestrator's own tab does.
3. Around a worker's session: a PULL REQUEST slot, SESSION CONTROLS (auto-send CI
   failures, terminate on merge), an ACTIVITY timeline, and Summary/Review/Browser/Files
   panels — Files shows `A notes.md +3` as a tree, not a text blob.
4. Cards are sparse: name + harness icon, branch chip, state word with a dot, token
   count, age. Nothing else.
5. The orchestrator **names** its workers — it spawned one called `haiku-notes`.
6. The composer pre-fills a ghost suggestion derived from session state. After a failed
   push, a worker's composer read *"set up a remote and push it"* — unprompted, derived
   from what had just happened in that session.
7. When no orchestrator is running, the project shows a plain warning banner and a
   one-click start button. Absence is a stated fact, not a blank screen.
8. AO has zero verification, zero memory, zero briefs. It renders whatever the worker's
   session says happened. That gap — not the UI — is what Kage exists to close, and this
   doc is careful not to close it by accident while adopting AO's frame.

## 1. Vocabulary: adopting the session frame, not inventing a new one

Kage already has two separate object families where AO has one:

- **The orchestrator's own session** lives in `RoomSupervisorRecord`
  (`mcp/delegation/room-supervisor.ts:70`) and `RoomSessionMeta`
  (`mcp/delegation/room-supervisor.ts:88`) — its own storage, its own resume-id
  machinery (`roomPermissionDigest`, `mcp/delegation/room-supervisor.ts:134`;
  `resolveRoomResumeId`, `mcp/delegation/room-supervisor.ts:158`), rendered by
  `renderRoom()` (`mcp/delegation/app-client.ts:656`).
- **A worker's session** is a `TaskRecord` (`mcp/delegation/contract.ts:76`) — `state`,
  `display_state` (`mcp/delegation/contract.ts:715`, computed by `displayState()`,
  `contract.ts:679`), `state_history` (`contract.ts:114`), `ownership()`
  (`contract.ts:688`) — rendered by an entirely different tree,
  `renderWorkList()` (`app-client.ts:245`).

They are not one object today, and the app's own top bar says so directly: Room, Work,
and Memory are three sibling top-level views (`.seg` buttons `#m-room`/`#m-work`/
`#m-memory`, `mcp/delegation/app-html.ts:68-72`), not one fleet with the orchestrator
sitting above its runs. This doc does not propose merging `TaskRecord` and
`RoomSupervisorRecord` into one schema — that is a larger change than a UI doc should
carry, and Kage's split (a rented manager on a deterministic kernel, `TaskRecord` as the
kernel's own ledger of hired work) is a real architectural decision, not an accident to
undo. What it proposes is the **view**: one sidebar fleet, under the active project, with
the Orchestrator first (backed by `RoomSupervisorRecord`/`RoomSessionMeta`, carrying a
live activity dot) and then every non-terminal run (`display_state` not in
`{"merged","rejected"}`) below it by **display name**, each with its own dot from the
same `display_state` vocabulary already computed for it.

Kage's existing `display_state`/`ownership()` values are the truth here — this doc does
not invent AO's state words (`"running"`, `"waiting"`, `"error"`) to replace them.
Where AO says a worker is "waiting," Kage already has a sharper word for exactly that —
`display_state === "blocked"` with `waiting_on` populated (`contract.ts:113`) — and that
word is what a Kage card shows, not AO's.

**The orchestrator as a real session — in flight, not fully landed.** `room-pty.ts`
already spawns the same interactive `claude` binary a person would type, with Kage's own
tools reachable (`buildRoomPtyLaunch`, `mcp/orchestrator-session.test.ts:14` importing it
from `mcp/delegation/room-pty.ts`) and session identity shared across Chat and Terminal —
"ONE session, two views — not two agents," both modes resuming the same id in
`room/session.json` (`mcp/delegation/room-pty.ts:234-241`). What is **not** true yet:
Chat and Terminal are not literally the same live process. Taking the terminal view
*retires* the structured supervisor first (`retireStructuredRoom`,
`mcp/delegation/room-pty.ts:231`) rather than the two sharing one pty — a message typed
into the browser's Chat composer today reaches the structured supervisor's control
socket, never a live terminal's stdin directly. "The chat composer writes into the
orchestrator's own pty" (this doc's W3, below) is the piece still ahead, not the pty
mechanism itself, which is real.

## 2. Named workers

**Gap, confirmed.** `TaskRecord` has no name field at all (`contract.ts:76-117`) — the
closest thing to a name is the run **id** itself, built by `makeRunId()`
(`contract.ts:313-321`) from a lowercased, hyphenated slice of the intent plus a date and
a hash (`enforce-the-per-run-budget-it-is-display-260818-1166`), which is legible but was
never designed to be read as a name — it is the machine key. The MCP surface a manager
uses to hire a worker, `kage_dispatch` (`mcp/index.ts:1222-1261`), has no `name` or
`display_name` parameter in its `inputSchema` today; a manager cannot name what it
spawns.

**Design.** Add `display_name?: string` to `TaskRecord`. Set it from `kage_dispatch`'s
manager-facing tool surface at hire time — the manager, having just written the intent,
is in the best position to pick a short name the way AO's orchestrator named
`haiku-notes`. When the manager doesn't set one, fall back to the first few meaningful
words of `intent` (the same slugging `makeRunId` already does, without the date/hash
suffix a human never needs to read). The run **id** stays the identifier everywhere
machine-facing — steer, merge, reject, every CLI verb and API path keys off `id`, never
the display name. Cards and the sidebar fleet show `display_name`; nothing that resolves
a run programmatically changes.

## 3. The worker view: the session is the interface

### (a) Follow graduates to a transcript, in AO's register

**Exists today**, not yet in that register. The Follow tab is the trailing `else` branch
of the detail view's tab switch (tab list at `app-client.ts:1667`, Follow's branch at
`app-client.ts:1696-1723`), rendering the brief's activity through `renderConversation()`
(`app-client.ts:2390-2498`) and its inner `renderEntry()` (`app-client.ts:2412-2444`).
Tool calls already render as human-labelled `.toolcard` rows, not raw JSON
(`readableLabel(e.label)`, `app-client.ts:2424`; glyph via `toolGlyph`,
`app-client.ts:2382-2388`), each with a timestamp, and a run of eight or more consecutive
tool entries already auto-folds into one summary line —
`"N actions — X reads · Y edits · Z commands"` (`app-client.ts:2472-2487`) — unless it's
the live tail or the reader expanded it. The agent's own words render as `.said`/`.bubble`
rows (`app-client.ts:2429-2436`). What's missing against AO's register: Write/Edit tool
cards show only the collapsed label today, never the diff inline — a diff only appears on
the separate Diff tab (below) — and there is no per-entry duration line, only the
timestamp. This section asks for both: an inline diff on a Write/Edit's own toolcard, and
a duration computed from consecutive timestamps, folded into the same row.

### (b) A Terminal tab, and an honest handover

**Take Over exists today**, wired end to end — a button in the detail pane's action bar
(`"Take Over"`, `app-client.ts:1779-1782`, shown when `display_state` is one of
`running|blocked|stopped|failed` and no terminal is already active), calling
`POST /runs/:id/takeover` (`app-client.ts:1442-1444`) into `takeOverRun()`
(`mcp/delegation/run-pty.ts:119-205`), which refuses a run with no
`agent_session_id` recorded (`run-pty.ts:123-124`) and only seizes from
`SEIZABLE_STATES` (`run-pty.ts:53`). `handBack()` (`run-pty.ts:226-247`) kills the pty
child, lands the run at `stopped`, and reattaches a real detached supervisor
(`dispatchDetached`, the same default `HandBackDeps.reattach` steer.ts's own fallback
uses) — full circle, not exile.

**Landed: `agent_session_id` is now written to disk the moment the stream first reports
it, not only at turn end.** The detached supervisor path (`kage supervise`,
`mcp/delegation/supervisor.ts`) — the path every real dispatch actually takes — parses
the true session id out of the agent's own streamed JSONL (`sessionIdFrom(line)`) and, the
first time it resolves, immediately patches it to the `TaskRecord`
(`patchRun(projectDir, runId, { agent_session_id: id })`, `supervisor.ts:585`), not only
in the exit-cleanup `patchRun` that still runs at turn end as belt-and-braces
(`supervisor.ts:759`). The in-process dispatch path already did this at spawn time
(`executeRun()`'s `randomUUID()` then `patchRun`, `mcp/delegation/dispatch.ts:304-305`);
both paths now agree. `takeOverRun`'s own check (`run-pty.ts:123-124`) no longer refuses
a run that's actively working — this closed the exact defect the code's own comment
names: "Take Over" used to refuse a run mid-stream with "no agent session recorded." The
fix reused the same turn-boundary streaming loop that already patches spend
(`supervisor.ts:594-601`) to patch the session id too, no new mechanism added.

**Deliberate, and worth stating in the doc itself:** taking over must be a visible state
change, never a silent one. AO's sessions are unsupervised by default, so nothing changes
when a person types into one. Kage's are supervised by default — a detached process is
watching, ready to verify — so seizing the terminal has to *visibly pause* that
supervision, with an honest label, and `Hand Back` has to visibly resume it. Today the
handover exists mechanically (`state.runTerminalActive`, `app-client.ts:21`; the
`#run-term-handback` button, `app-client.ts:1456`) but carries no such label — grepping
for `"paused"` or `"supervision"` in the client finds nothing. That label is new work,
not a cosmetic afterthought: it is the one sentence that keeps a supervised headless
worker from *looking* like a free terminal when it briefly isn't one.

### (c) The right panel, reordered around the receipt

AO's slot order is PR → Session Controls → Activity → Files. Kage's own strongest object
takes the PR's place:

1. **THE RECEIPT.** Already exists, browser-side, as `renderReceipt()`
   (`app-client.ts:1466-1601`), reading the same kernel-computed verdict every other
   surface reads — `claimVerdict()` (`mcp/delegation/verify.ts:236-244`), attached to the
   API response as `detail.verdict` (`mcp/delegation/api.ts:564`, with the comment "the
   verdict is now a fact the surface renders, never one it decides" directly above it).
   `renderClaimCard()` (`verify.ts:274-314`) is the server-rendered text fallback,
   consumed only when the structured claim can't be parsed (`api.ts:557`,
   `app-client.ts:1682`). No change needed here beyond promoting it to the panel's first
   slot — it already renders today exactly as this doc wants it to lead.
2. **SESSION CONTROLS.** Exists in one real form today: the deliver-now-vs-queue default
   on the steer composer — `queueToggle`, labelled `"Deliver now"` when off and
   `"Queuing"` when on (`app-client.ts:1751-1754`), with `state.steerQueueMode` defaulting
   `false` (`app-client.ts:21`) so a plain Enter delivers immediately unless the toggle or
   ⌘/Ctrl+Enter overrides it (`app-client.ts:1738`). List only what exists, or what a
   *named, already-in-flight* run adds — not a wishlist. Nothing else in the codebase
   today qualifies (no auto-send-on-CI-failure, no terminate-on-merge toggle exist to
   list).
3. **ACTIVITY.** `state_history` (`contract.ts:114`, pushed on every
   `transitionRun()` call, `contract.ts:832-844`) is real, durable, and rendered by the
   TUI (`mcp/delegation/tui/app.ts`) and the CLI report (`mcp/delegation/report.ts:62`) —
   but **never in the browser**: grepping `state_history` and `timeline` across
   `app-client.ts`/`app-styles.ts`/`app-html.ts` returns nothing. The closest thing today
   is Follow's own lifecycle log lines (`"{from} → {to}"`, `app-client.ts:2398`,
   `.lifecycle` rows at `app-client.ts:2413-2418`) — a scroll, not a timeline. This panel
   is new browser surface over data the kernel has already been recording the whole time.
4. **FILES.** Exists as the Diff tab (`app-client.ts:1687-1690`,
   `renderDiff()` at `app-client.ts:2227-2290`) — full diff text fetched as plain text
   (`loadTabText`, `app-client.ts:2293-2307`) and already parsed client-side
   (`parseDiff()`, `app-client.ts:2228`) into a file chip bar with per-file +/− counts
   (`app-client.ts:2231-2242`) and collapsible per-file cards. The data and the rendering
   both already look like AO's `A notes.md +3` tree — this is a restructuring of an
   existing tab into the panel's fourth slot, not new plumbing.

## 4. Ghost suggestions, Kage's way

**Does not exist today, at all.** Every composer in the app carries a fixed placeholder
string, never a dynamic one: the steer composer's `#steer-input` reads
`"Message the agent…"` (`app-client.ts:1732`), the Room composer's `#room-input` reads
`"Message Kage…"` (`app-html.ts:116`), the blocked-run inline answer field reads a static
`"Answer the agent…"` (`app-client.ts:203`). Grepping `ghost` and `suggest` across the
whole client turns up nothing.

AO derives its ghost text from the transcript tail — whatever the worker's session says
last is what gets echoed back into the composer, unverified. Kage has a better source
sitting right next to it: the **verdict**, computed the same way the receipt already is.
One function, server-side, feeding every surface (composer, notification digest,
anywhere a suggested next step appears) so there is exactly one place this logic lives:

- **A check failed** → name the failing command (`claimVerdict()` already carries
  `check.cmd` and `exit_code` per outcome, `verify.ts:236-244` reading `ClaimRecord.checks`,
  `contract.ts:143-163`) — e.g. *"npm test failed — see the log."*
- **Stalled** → quote the stall evidence. **Landed**: the stall detector
  (`evaluateStallTurn`, `mcp/delegation/supervisor.ts:159-207`) runs once per turn
  boundary and trips on either of two independent triggers — the same command failing
  with the same exit code `STALL_SAME_COMMAND_STREAK` (3) turns in a row, or
  `STALL_NO_DIFF_STREAK` (6) consecutive turns with no change to the worktree's `git diff
  --stat` (`supervisor.ts:116-117`). A trip sets `SupervisorState.stallHalted`
  (`supervisor.ts:284`) and lands as the `note` on the run's `stopped` transition
  (`transitionRun`, `contract.ts:876`) — the same `state_history` note field §3c's
  ACTIVITY panel already reads, and that `renderRunCard` already surfaces as
  `stopped  stalled: ...` (`contract.ts:978-983`). The data source this suggestion needed
  now exists; wiring the composer's ghost text to read it is ordinary W1/W2 work, no
  different from this section's other three sources.
- **Ready** → *"review the receipt."*
- **Blocked with a question** → the agent's own words, already captured verbatim in
  `waiting_on.detail` (`contract.ts:113`) the moment a run transitions to `blocked`.

## 5. Cards: trim to AO's five, plus exactly one

**Today, two separate renderers disagree with each other and with AO's list.** The
sidebar/list row, `workRow()` (`app-client.ts:165-243`), shows agent name, several
state atoms, `claim_summary`, blast-radius dependent count, cost — but never branch. The
board card, built inline in `renderBoard()` (`app-client.ts:1836-1904`, the card itself at
`1871-1899`), shows agent avatar, title, branch (`shortBranch()`, `app-client.ts:1878`),
one state atom, cost's first segment only (no token count), and age — closer to AO's
list but still inconsistent with the sidebar row, and neither shows a verdict chip.

**Design: one shape, five AO fields plus one Kage field.** Name (the new
`display_name`), branch chip, state word with a dot (from `display_state`, unchanged),
token count (`tokens_used`, `contract.ts:88` — already recorded, just not surfaced on a
card today), age (`ago(run.updated_at)`, `app-client.ts:34-40`, already used at
`app-client.ts:217`). Nothing else survives — `claim_summary`, the blast-radius atom, and
the live-activity label all move into Follow or the receipt, where they already have a
home. The one addition AO has no equivalent for: on a finished card, the **verdict
chip** — `VERIFIED n/n` / `NOT VERIFIED n/n` / `UNVERIFIED`, `claimVerdict()`'s own label
(`verify.ts:236-244`), already computed and already attached to every detail response
(`api.ts:564`) but never rendered on a card today. That's the one piece of card real
estate this doc spends on something AO doesn't have, because it's the one fact AO's own
cards can't show: whether anyone actually checked.

## 6. Orchestrator presence

**Gap, confirmed.** The top bar (`app-html.ts:64-78`) shows a project name (`#proj`,
line 67) and the Room/Work/Memory view switch, but nothing about whether an orchestrator
is currently running — grepping the client for any liveness indicator near the room view
switch returns nothing. A person opening a project with no manager session alive sees a
blank Room view and has to infer what's wrong from the composer simply not responding.

**Design.** Whichever surface carries the sidebar fleet (§1) also carries the
Orchestrator's own row, first, with a live dot sourced the same way the rest of this doc
sources liveness — from the orchestrator's own `RoomSupervisorRecord`/`RoomSessionMeta`.
When none is running: a plain one-line banner in the same slot, plus a one-click start —
not a blank pane, not a spinner, not a composer that quietly does nothing. Absence is a
state this surface states, the same discipline `MemoryOverview.measured`
(`mcp/delegation/memory-view.ts:82-90`) already applies to a repo with no metrics yet:
tell the truth about nothing being there, rather than rendering nothing at all.

## 7. What Kage refuses to copy

- **PR-centricity.** AO's slot 1 is a pull request. Kage's is the receipt (§3c) — a PR
  link, when one exists, is a fact on the receipt, never the panel's headline object.
- **Trusting the agent's self-report, anywhere.** Every "exists" cited in this doc that
  touches a verdict traces back to `claimVerdict()` executing checks Kage itself ran
  (`verify.ts:211-230`, `verifyRun()`) — never to text the agent typed. Ghost suggestions
  (§4) read the verdict, not the transcript tail, for exactly this reason.
- **Unsupervised sessions as the default.** §3b's honest-label requirement exists because
  Kage's default is supervised; AO's is not. A surface that makes seizing a run look free
  is lying about what's watching it.
- **Any card decoration beyond §5's six fields.** No harness-vanity icons, no
  progress bars, no "AI-generated" badges. AO's restraint on this point is worth copying
  as-is; the only field this doc adds is the verdict chip, and it earns its place because
  it is the one thing AO's cards structurally cannot show.

The honesty laws that already bind every other surface in this codebase — observed
numbers labelled apart from estimated ones, an absent measurement rendered as absent
rather than backfilled with a guess, delivery vocabulary that matches what the kernel
actually did (`display_state`, never a surface's own invented word) — bind every surface
this doc adds. Nothing here gets a pass because it's new.

## 8. Implementation split

| Wave | Scope | Depends on |
|---|---|---|
| **W1 — backend** | `display_name` on `TaskRecord` + `kage_dispatch`'s schema (§2); server-side suggested-next derivation from `claimVerdict` (§4); files-tree data already produced by `parseDiff()` exposed as structured JSON instead of client-parsed text (§3c/4). | The budget run landed, `agent_session_id` fix in §3b included — W1 no longer waits on it. The unified-session run, still in flight, also touches `mcp/delegation/dispatch.ts` and `mcp/delegation/supervisor.ts`; W1 starts once it lands too. |
| **W2 — renderer** | Sidebar fleet (§1); Follow's session-transcript register upgrade (§3a); right panel reorder + Activity timeline (§3c); Terminal tab with the honest pause/resume label (§3b); ghost text wired to §4's server output; orchestrator banner (§6); card trim to six fields (§5); **and, same surface, same pass, the three defects below** — a UI pass that touches these files and skips known-broken adjacent code in them is not finished. | None beyond W1's data being available. |
| **W3 — the chat composer writes into the orchestrator's own pty** | Only once the unified-session work (§1) makes Chat and Terminal the same live process instead of two that hand off — currently `retireStructuredRoom` (`room-pty.ts:231`) makes them mutually exclusive, not shared. | The unified-session work itself, in flight. |

**The three standing defects, folded into W2 rather than deferred:**

1. **The Dispatch button drops when the preflight forecast resolves.** `#modal-preflight`
   (class `.preflight`, `mcp/delegation/app-html.ts:234-239`) sits directly above the row
   holding `#dispatch-go`. `.preflight { display:none; ... }` by default
   (`mcp/delegation/app-styles.ts:376-378`); once the async forecast resolves,
   `renderPreflight()` (`app-client.ts:1110-1121`) flips its `display` on, and that box's
   full height inserts above the dispatch row, pushing the button down the instant a
   person is most likely to be reaching for it. No pixel constant is hard-coded anywhere
   in the source for this — the fix is reserving the box's space (or a fixed-height
   skeleton) before the forecast resolves, not chasing a specific number.
2. **The composer mode pill mixes grammars.** The same `queueToggle` cited in §3c's
   Session Controls (`app-client.ts:1751-1754`) reads `"Deliver now"` — an imperative,
   read as a command — when off, and `"Queuing"` — a gerund, read as a state — when on.
   One two-position toggle, two different grammatical registers. Pick one: either two
   states (`"Deliver now" / "Queue"`, both imperative) or two commands
   (`"Deliver now" / "Start queuing"`), not a mix.
3. **The Memory dashboard's active/stale arithmetic doesn't reconcile, and the code
   already says why.** `renderMemory()`'s stat tiles (`app-client.ts:849-856`) render
   `mem.health.approved` labelled "active" beside `mem.health.stale` labelled "stale (as
   of last refresh)" — two numbers a reader expects to partition one total, and they
   don't, because they're sourced independently: `approved` comes from
   `graph.approved_packets ?? packets.length` (`mcp/delegation/memory-view.ts:143`),
   `stale` from `qualityTotals.stale` (`memory-view.ts:144`), two different sections of
   `metrics.json` (`memory_graph` vs `quality.totals`), never checked against each other
   or against `packets.length`. The comment directly above the stat array already states
   the intent — "Labelled 'as of last refresh', never bare 'stale'... the two numbers are
   allowed to differ" — but the tile labels alone don't carry that caveat where a reader
   sees it; the fix is surfacing the reconciling sentence (or the live `kage stale` count
   the comment already points to) next to the tiles themselves, not just in source
   comments nobody reading the dashboard will ever see.
