# What Kage deliberately does not copy from AO and Conductor

This session closed a real interaction gap against Agent Orchestrator and Conductor:
a projects rail, conversation threads, a command palette, a notification centre, a
settings surface, a theme system, compound board columns, a packaged `.dmg`, and a
Terminal mode that runs the coding agent's own interface in a real pty.

That list was worth copying because those are table stakes for an agent IDE. This
document is the other half of the work: the features that were on the table, that both
competitors have, and that Kage is **not** building — with the reason, so the decision
survives the next person who opens AO, sees something missing here, and assumes it was
an oversight.

A gap that is written down is a decision. A gap that is not is a bug.

---

## The principle these decisions come from

**In AO, a session is the unit of work. In Kage, a run is.**

AO's orchestrator hands you sessions: you open several, each one is a place where work
happens, and the UI's job is to help you hold many of them at once. Kage's shape is
different — you talk to a manager, the manager compiles a brief from repo memory, hires
an agent in a worktree, and the kernel re-executes the checks before anything is
believed. The parallelism lives in runs on the board, not in windows.

So the test for any AO feature is not "is it good?" — most of them are. It is: **does it
serve runs, or does it re-create sessions as a competing axis?** Features that make you
choose between "open another tab" and "dispatch another run" make the product worse even
when each one is individually nice.

---

## Not building, and why

### 1. Multi-agent panels (AO's ~26 agent integrations)
AO supports a long tail of coding agents. Kage supports claude and codex, plus a stub
for tests, and only claude gets a held live session — because only claude's
`--input-format stream-json` protocol was *verified* to keep native context across
turns with stdin held open. codex and gemini have real `--resume`, but no held-stdin
protocol, and shipping them as "live" would be a claim the code cannot back.

Breadth here is cheap to add and expensive to be honest about. The constraint is
deliberate: an adapter ships when its capabilities have been demonstrated, not when it
starts.

### 2. A mobile app
Both competitors ship or plan one. Kage's daemon is loopback-only, guarded by Host +
Origin + a 0600 token, and every surface reads the repo's own `.agent_memory`. A phone
client means a remote transport, an auth model, and a trust boundary that does not exist
today. That is a product, not a screen. Until Kage has a reason for remote access
stronger than "AO has it", the loopback constraint is a feature — it is why the security
story fits in one file.

### 3. Tracker intake (Linear/Jira → run)
Attractive and genuinely useful. Deferred because the interesting half is not the
integration, it is what a ticket compiles into. Kage's briefs are built from repo memory
with authorship and dates attached; a ticket body pasted into an intent field would look
like the same thing and be nothing like it. This lands when the brief compiler can treat
a ticket as a *source* with the same provenance rules as memory, not before.

### 4. Sign-in, accounts, and a hosted control plane
Kage is a CLI and a local daemon over a git repo. Nothing in the current product needs
an identity. Adding one to match a competitor's onboarding would add a server to
operate, secrets to hold, and a reason for the tool to be online — against a product
whose whole claim is that the repo is the source of truth.

### 5. Rebindable keyboard shortcuts and i18n
Both are real accessibility and reach features, and both are premature at this size. The
keymap is small enough to learn (`1-4`, `n`, `⌘K`) and the palette makes every command
reachable by typing its name, which is the escape hatch a rebinding system usually
exists to provide. Revisit when there are users whose muscle memory this fights.

### 6. Nine visual themes
Kage ships light, dark, and follow-the-system. Themes are cheap to add and permanently
expensive to maintain: every new surface has to be checked against all of them, and this
session already shipped two silent CSS failures (`--warn`, `--bad` — custom properties
that were never defined, so a badge rendered as plain text). Three well-tested themes
beat nine drifting ones. There is now a test asserting every `var()` the renderer uses
is actually defined.

### 7. Auto-restarting crashed runs
AO can relaunch. Kage lands a crash as `failed` and stops. Restarting a non-idempotent
agent mid-run is a correctness hazard: the worktree may hold partial edits, and a
"successful" retry can bury a real failure. A human deciding to re-dispatch is cheap; a
silently retried run that merges half-finished work is not.

---

## The one thing that was copied, but reframed

Conversation threads (this session's #46) look exactly like AO's session tabs and are
not the same object. They are **threads with the manager**, so that "plan the refactor"
and "debug this failure" do not share one context. Dispatching from any thread still
produces an ordinary run on the same board — there is no work that lives *in* a thread.

The tab strip is deliberately placed on the right, away from Chat/Terminal (which are
two views of one thread), and a lone thread renders no tabs at all. If a thread ever
starts to feel like a workspace — if runs, diffs, or state begin hanging off it — that
is the bug this note exists to name.

---

## How to use this document

When someone asks "why doesn't Kage have X?", the honest answers are:

- it's here, in which case the reason should still hold; or
- it isn't here and isn't in this file, which means nobody decided — go decide.

Anything in this list can be reversed. What should not happen is reversing it by
accident, because a competitor's screenshot looked more complete.
