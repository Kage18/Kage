# Kage vs AO and Conductor — architecture and feature comparison

What the two leading agent orchestrators do, what Kage does, and where Kage deliberately
differs. Sources: AO source at HEAD `e7b4949` (9.4k★, Apache-2.0), Conductor's public
docs and 189-entry changelog, Sculptor's history doc, and Claude Code's own agent surface.
Status marks reflect Kage as of the delegation spine landing.

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
| Board grouped by who must act | ✅ 4 zones | ✅ 4 groups | ◐ list + `ownership` computed; zones are Phase 2 |
| What the agent is doing *right now* | ◐ (users: "just a pulsing dot") | ✅ | ✅ `editing src/x.ts · 12 actions`, from the live stream |
| Self-summarizing runs, expand on demand | ✅ | ✅ importance-ranked | ○ Phase 2 |
| Genuine raw escape hatch | ✅ terminal | ✅ ⌃O | ✅ `raw` tab — unfiltered transcript |
| Token / context / cost meter | ✅ tokens + context | ✅ live ring + cents | ○ Phase 2 |
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
| Queue as a first-class object | ○ | ✅ edit/reorder | ○ Phase 2 |
| Concurrency limit | ✅ | ✅ | ✅ enforced at the kernel, so every surface obeys |

### Notifications & review

| Capability | AO | Conductor | Kage |
|---|---|---|---|
| OS toast / dock badge / sounds | ✅ toast+badge, no sound | ✅ all three | ○ Phase 3 (Electron) |
| Next-needing-attention hotkey | ○ | ✅ ⌥L/⌥H | ○ Phase 3 |
| Built-in diff review | ◐ punts to GitHub | ✅ | ◐ TUI has it; web viewer is Phase 2 |
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

## 5. Honest gaps

- **No board zones, timeline, or context meter yet** — Phase 2.
- **No OS notifications or hotkey** — Phase 3; the desktop shell is the only thing that
  genuinely requires a shell.
- **No PR/CI integration or tracker intake.** AO's feedback-loop engine is its strongest
  idea and we have not built it.
- **Two agents supported** (claude, codex) against AO's 26.
- **Single machine, single repo.**

The bet: verification and memory compound, and polish is catchable. A board is a week's
work; a verified claim is an architecture.
