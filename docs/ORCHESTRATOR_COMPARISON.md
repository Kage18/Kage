# Kage vs AO and Conductor — architecture and feature comparison

What the two leading agent orchestrators do, what Kage does, and where Kage deliberately
differs. Sources: AO source at HEAD `e7b4949` (9.4k★, Apache-2.0), Conductor's public
docs and 189-entry changelog, Sculptor's history doc, and Claude Code's own agent surface.
Status marks reflect Kage as of the release-prep branch (desktop app, memory view, blast radius, cost meter, notification ladder).

---

## 1. The one-line difference

| | What it orchestrates |
|---|---|
| **AO** | *Sessions.* A grid of agents you supervise, with a feedback-loop engine that routes CI failures and review comments back to the owning session. |
| **Conductor** | *Workspaces.* One Mac app, one worktree per task, a beautifully summarized transcript and the best notification story in the category. |
| **Kage** | *Work.* Intents in, **verified claims** out. Every brief is compiled from what the repo learned; every claim is re-executed by the kernel before you see it; merging ratifies code and memory together. |

AO and Conductor both make agents easier to *watch*. Kage makes their output **checkable**,
and makes each run start from what the last one learned.

---

## 2. Architecture

```
AO           Go daemon (:3001) ──┬── Electron shell
                                 ├── ao CLI
                                 └── React Native app
             agents live in tmux/ConPTY panes, stdin open for the session's life

Conductor    single Mac app, Claude Agent SDK in-process, worktree per workspace
             no daemon, no CLI, no second renderer

Kage         kernel (files)  ← authority: task.json, state machine, verification
               ↑ single writer per run
             supervisor-per-run (detached, holds the agent's stdin, unix socket)
               ↑
             daemon (registry · scheduler · reaper · REST + SSE, guarded)
               ↑
             renderers: desktop app · TUI · CLI · MCP
```

Three deliberate choices:

- **Supervisor per run, not agents inside the daemon.** A daemon restart — crash, upgrade,
  `daemon stop` — must never kill a 45-minute agent mid-edit. AO gets this property from
  tmux; we get it from detached processes.
- **The filesystem is the authority, not the daemon.** Every surface reads the same
  `task.json`. SSE carries `{run_id, seq}` and nothing else, so a client that misses an
  event re-reads a fact instead of corrupting its model — the mechanism behind AO's
  documented phantom-state bug.
- **Guarded local API.** "It only binds 127.0.0.1" is not a security model: a browser will
  send a cross-site POST to localhost, and DNS rebinding makes an attacker's hostname
  resolve there. Loopback `Host` + same-origin + a 0600 token gate every mutating route.

---

## 3. Feature comparison

✅ have · ◐ partial · ○ planned · — not applicable

### Visibility

| Capability | AO | Conductor | Kage |
|---|---|---|---|
| Board grouped by who must act | ✅ 4 zones | ✅ 4 groups | ✅ compound columns with split counts; empty columns explain themselves |
| What the agent is doing *right now* | ◐ (users: "just a pulsing dot") | ✅ | ✅ `editing src/x.ts · 12 actions`, from the live stream |
| Self-summarizing runs, expand on demand | ✅ | ✅ importance-ranked | ◐ readable live feed with the agent's own summary; no collapse/expand yet |
| Genuine raw escape hatch | ✅ terminal | ✅ ⌃O | ✅ `raw` tab — unfiltered transcript |
| Token / context / cost meter | ✅ tokens + context | ✅ live ring + cents | ✅ `$0.19 · 209k tok` per run, agent-reported (never estimated); absent when the agent reported nothing |
| Raw PTY attach | ✅ | — | — **deliberately cut** (timeline only) |

### Control

| Capability | AO | Conductor | Kage |
|---|---|---|---|
| Agent stays alive across a block | ✅ tmux pane | ✅ SDK, parked | ✅ supervisor holds stdin |
| Answer in place, no re-dispatch | ✅ | ✅ | ✅ delivered to live stdin |
| Steer a running agent | ◐ tmux keystrokes | ✅ steer/queue setting | ✅ lands at the next tool boundary |
| True interrupt without killing | ◐ | ✅ | ✅ `control_request` |
| Resume after process death | ✅ `--resume` | ✅ | ✅ `--resume`, session id pre-assigned |
| Delivery honestly reported | ◐ (4 bugs on this) | ◐ | ✅ `delivered / resumed / stored / refused` |
| Queue as a first-class object | ○ | ✅ edit/reorder | ◐ undeliverable messages are `stored` and reported honestly; no queue-editing UI |
| Concurrency limit | ✅ | ✅ | ✅ enforced at the kernel, so every surface obeys |

### Notifications & review

| Capability | AO | Conductor | Kage |
|---|---|---|---|
| OS toast / dock badge / sounds | ✅ toast+badge, no sound | ✅ all three | ✅ all three — toast suppressed while focused, chime togglable from the palette |
| Next-needing-attention hotkey | ○ | ✅ ⌥L/⌥H | ✅ ⌥L/⌥H, works even mid-sentence in the composer |
| Built-in diff review | ◐ punts to GitHub | ✅ | ✅ Diff tab, tinted rows that survive horizontal scroll |
| PR / CI state on the card | ✅ | ✅ | ○ deferred |
| CI failure routed back to the agent | ✅ its best idea | ◐ | ○ deferred |

### What only Kage does

| Capability | AO | Conductor | Kage |
|---|---|---|---|
| **Brief compiled from repo memory** (with author + date) | — | — | ✅ |
| **Claims verified by re-executing the checks** | — | — | ✅ incl. the planted-lie test |
| "Unverified" when nothing executed | — | — | ✅ static checks never read as verified |
| **Merging ratifies code + memory together** | — | — | ✅ |
| Rejection reason captured as memory | — | — | ✅ `negative_result` |
| **Manager judgment recorded and measured** | — | — | ✅ curated vs kernel briefs compared |
| Manager prose stripped of restated verdicts | — | — | ✅ kernel-side guard |
| **Blast radius at the merge decision** ("5 files depend on this", from the code graph) | — | — | ✅ prebuilt-index read; chip absent rather than a fake zero when unindexed |
| Inbox triaged by cost-of-ignoring (asks you → decisions → merges) | ◐ arrival order | ◐ | ✅ |
| Memory browsable, searchable, correctable in-app | — | — | ✅ helpful / out-of-date / wrong feed recall |

Sculptor built an auto-review layer and **removed it**; AO's `auto_review` is advisory.
Nobody re-runs the checks. That is the wedge.

---

## 4. Lessons taken from their public failures

Each of these is a design rule in Kage because someone else paid for it:

1. **Don't conflate "what happened" with "who must act."** AO filed #3909 against itself for
   putting `ci_failed` and `exited` in the same "Needs you" column as a real question.
2. **Sticky state needs a second source of truth.** AO's phantom `waiting_input` stuck
   forever, 737 times. Kage cross-checks the pid and the control socket, and *persists*
   death rather than deriving it forever.
3. **Accepted ≠ delivered.** Four separate AO bugs. Kage reports which of four outcomes
   actually happened.
4. **A density control whose top setting still hides things is worse than none** (Cursor's
   "Detailed" folding MCP calls). Kage's `raw` tab is genuinely raw.
5. **Interruption must be non-destructive.** Cursor reverting work on Stop produced the
   angriest quote in the research corpus.
6. **Don't auto-notify a manager agent about worker events.** AO built it twice, deleted it
   twice — "idle does not mean done", and each nudge burns a turn on what the human can
   already see.

---

## 5. Experience ratings — honest ones

Capability marks above are checkable facts. Experience quality is a different axis,
and the honest ranking there is **Conductor > AO > Kage**, clearly, not narrowly:

| Experience | AO | Conductor | Kage |
|---|---|---|---|
| Watching a live agent | 3.5 | **5** | 3.5 — readable, not refined; no collapse/summary or syntax colour |
| Controlling mid-run | 3.5 | **4.5** | 3.5 — honest delivery, bare surface; no queue editing |
| Notifications | 3.5 | **5** | 3.5 — full ladder, untuned; suppression window-level not per-run |
| Review & merge UX | 3 | **4.5** | 3.5 — unique data (blast/cost/receipt), primitive viewer |
| Visual polish | 4 | **5** | 3 — correct brand for days, not releases |
| Usability | 4 | **4.5** | 2.5 — zero real-user hours; no onboarding |
| Speed | 4 est. | 4.5 est. | **4.5 measured** — 0.3s window, ~1ms routes |

Why Kage's scores are this low despite the feature list: a feature existing and a
feature being polished are different claims. Conductor has 189 releases of paper-cut
fixes and AO has 9.4k stars of users filing them; Kage has one builder driving it for
days — and every deep hands-on pass this branch found bugs the previous pass had
called verified, which is evidence the tail is not empty. The capability lead
(verification, memory, graph, honesty) is architectural; the experience gap is
mileage. Mileage is buyable with users; the architecture is not patchable in a
sprint. Both statements are true and neither excuses the other.

What "polish" concretely means that Kage lacks today: diff syntax highlighting,
side-by-side view and a file tree; transcript collapse/expand with summaries; queue
editing; per-run notification suppression; a first-run tour; an accessibility pass;
and the hundred paper cuts only real users find.

## 5b. Honest gaps

- **No PR/CI integration or tracker intake.** AO's feedback-loop engine is its strongest
  idea and we have not built it (deliberate — see KAGE_NOT_COPYING.md for the terms).
- **No queue-editing UI.** Undeliverable messages are stored and reported honestly, but
  cannot be edited or reordered the way Conductor's queue can.
- **No run self-summary/collapse.** The feed is readable, not compressible.
- **Two agents supported** (claude, codex) against AO's 26 — held live only where the
  protocol is verified to support it.
- **Single machine; multi-project via the rail, one daemon per repo.**

The bet: verification and memory compound, and polish is catchable. A board is a week's
work; a verified claim is an architecture.
