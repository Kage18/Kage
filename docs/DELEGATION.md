# Delegating work with Kage

Kage is a delegation layer for coding agents. You state an intent; Kage compiles a brief
from what your repo already learned, hires a coding agent to do the work in an isolated
worktree, **re-runs the checks itself** to see whether the claim is true, and remembers
what was learned so the next task starts smarter.

The promise it is built around: *you should be able to hand off work and trust the result
without watching it happen.*

---

## The mental model

Two halves, and the split is the whole design:

- **The manager** is a rented mind — an instance of the coding agent you already have
  (Claude Code, Codex), running with Kage's tools. It does the judging: what to recall,
  how to phrase the brief, what to ask you, what to report. It can be wrong, restarted,
  or swapped for a different model at any time.
- **The kernel** is deterministic code. It owns the run ledger, executes the checks, and
  gates memory. **The manager cannot forge a receipt.** When a card says a check passed,
  it passed because Kage ran the command and read the exit code — never because an agent
  said so.

Everything else follows from that: briefs are compiled, claims are verified, and merging
the work is what ratifies the memory.

---

## Setup

You need Node 18+, a git repo with at least one commit, and a coding agent CLI on your
PATH (`claude` or `codex`).

```bash
npx -y @kage-core/kage-graph-mcp install
```

Then tell Kage how your repo is tested — this is the backbone of every verification:

```bash
kage config --test "npm test" --project .
```

If your repo has a `test` script in `package.json`, Kage infers it and you can skip this.
A repo with no discoverable test command still works, but Kage will say so in every brief
rather than pretend it verified something.

Optional, for repos that need setup in a fresh checkout:

```bash
kage config --setup "npm install" --project .
```

---

## The 60-second version

```bash
kage dispatch "make the retry helper idempotent" --type bugfix --project .
```

Kage prints two cards. First the brief — what it knows and what it will hold the agent to:

```
┌ BRIEF ─────────────────────────────────────────────────────────
│ Intent     make the retry helper idempotent
│ Touches    src/retry.ts
│ Knows
│           • Retry path must be idempotent (Dana Dev, 2026-08-12)
│ Checks     npm test · diff-size · citations
│ Agent      claude · worktree kage/make-the-retry-helper-idempotent-260812-44d3
│ Confidence low (new task type for me (0 prior bugfix run(s)), 1 relevant memory)
└────────────────────────────────────────────────────────────────
```

Then, when the agent is done, the claim — verdicts first, diff second:

```
┌ CLAIM · make-the-retry-helper-idempotent-260812-b296 — VERIFIED 3/3 (checks run by Kage, not the agent)
│ "retry() in src/retry.ts is now idempotent per operation key"
│ ✓ tests       npm test → exit 0     .agent_memory/runs/<id>/evidence/tests.log
│ ✓ diff-size   at most 400 changed lines
│ ✓ citations   every cited path exists in the worktree
│ · diff        1 file(s), 9 line(s)
│ ⚠ unsure      the in-memory Set does not survive a restart - may need Redis
│ + learned     retry idempotency is keyed per operation id
└────────────────────────────────────────────────────────────────
```

Read the receipt, glance at the diff, then:

```bash
kage merge <run-id> --project .
```

That merges the branch **and** ratifies the learning into team memory in the same act.
Your next dispatch will carry it.

---

## The console

```bash
kage ui --project .
```

A full-screen terminal console with four screens — `1`/`2`/`3`/`4` or `tab` to switch,
`?` for help, `q` to quit. No install, no browser, no dependencies.

- **Board** — every open run, live: state, elapsed, and what each one is doing right now
  (`editing src/auth/retry.ts · 12 actions`). `↑↓` to select, `enter` to review,
  `d` to dispatch.
- **Review** — three views, cycled with `v` or `←→`:
  - *receipt* — the full account: run metadata and how long it took, the intent, the
    verdict and why, the agent's claim verbatim, then **every check** with its command,
    what was expected, the exit code, the evidence path, and an excerpt of the log
    itself (more of it when a check failed); then the diff summary, every `unsure` note,
    every proposed learning, and the agent's closing report.
  - *diff* — colour-coded, scrollable, with a position indicator.
  - *brief* — exactly what the agent was told, including which memories were injected.
    Reviewing output without seeing the instruction is guesswork.

  `m` merges, `x` rejects (it asks for a reason, because the reason becomes memory), `o`
  prints the worktree path for a takeover, `g`/`G` jump to top/end.
- **Dispatch** — type an intent, `tab` cycles the type, `enter` compiles the brief so you
  can read exactly what the agent will be told, `enter` again sends it. The run executes
  in the background; the Board shows it working.
- **Memory** — everything the repo has verified, newest first, with who learned it and
  when. `/` searches; the selected item shows its summary and citations.

The console never marks anything verified — only executed checks do that. It renders the
same kernel cards the CLI does.

## Two ways to drive

**The room** — conversational, for working sessions:

```bash
kage room --project .
```

This opens your own coding agent as Kage's manager, wired to the delegation tools and
carrying Kage's constitution. It greets you with the report, then you talk in plain
sentences: *"fix the flaky auth test"*, *"what's blocked?"*, *"hold the migration until
the auth fix lands"*. The manager compiles briefs, dispatches, and narrates — but every
number it shows you comes from a kernel card.

**The verbs** — one-shot, for scripts, CI, and muscle memory. Everything the room can do
is a verb, and the verbs never need the manager. Use whichever fits the moment.

---

## The verbs

| Command | What it does |
|---|---|
| `kage ui` | The full-screen console: board · review · dispatch · memory |
| `kage dispatch "<intent>"` | Compile a brief, hire an agent, verify the claim. `--type`, `--agent`, `--brief-only` |
| `kage runs` | Every run, one line each, newest first |
| `kage status [--watch]` | The live board: what each open run is doing right now |
| `kage task <run-id>` | One run's card: state, claim, checks, unsure notes |
| `kage review <run-id>` | The receipt-first review moment, with the commands to see the diff |
| `kage merge <run-id>` | Accept: merge the branch, ratify the learnings |
| `kage reject <run-id> "<reason>"` | Refuse: the reason becomes memory |
| `kage open <run-id>` | Print the run's directory — take over in your own terminal or IDE |
| `kage tell <run-id> "<message>"` | Steer: joins the brief at the next boundary |
| `kage stop <run-id>` | Halt now; state preserved, resumable |
| `kage retry <run-id>` | Re-run with a fresh brief (picks up steering) |
| `kage report [--all]` | The while-you-were-away digest |
| `kage config` | Set the test command, setup command, diff budget |

Add `--project <dir>` to any of them (or run from the repo root).

Note: bare `kage review` with no run id keeps its original meaning — the pending-memory
inbox. `kage review <run-id>` is the claim review.

---

## The four moments

### 1. Dispatch — where memory becomes visible

The brief is the point. `Knows:` lines are real packets from your repo, each with the
person who learned it and when; `Touches:` comes from the code graph; `Checks:` are
derived from your config. If recall found nothing relevant, the brief says so rather than
padding.

Confidence is computed from your track record for that task type — never from optimism —
and always shows its basis. The manager may lower it; nothing can raise it.

Use `--brief-only` to compile and hold without spending tokens:

```bash
kage dispatch "risky migration" --type migration --brief-only --project .
# ...read it, then release:
kage retry <run-id> --project .
```

### 2. Run — visible, isolated, steerable

A dispatch is never silent. While the agent works you get a live line — elapsed time,
what it is touching right now, how many actions it has taken:

```
⠹ 2m14s  editing src/auth/retry.ts · 12 actions
```

In a second pane, or for runs someone else started, the live board shows everything open:

```bash
kage status --watch --project .
```

```
3 open run(s)  ·  14:22:07
▶ fix-flaky-auth-260812-44d3      running    2m14s  editing src/auth/retry.ts · 12 actions
✓ update-error-codes-260812-4b1a  ready      6m02s  verified 3/3
⏸ payments-migration-260812-77c2  blocked   11m41s  backfill users-first or orders-first?
```

(In CI or when piped, progress prints as milestone lines instead of a repainting one —
nothing depends on terminal control codes.)

Each run gets its own git worktree (`.agent_memory/worktrees/<run-id>`) on branch
`kage/<run-id>`, committed as soon as the claim is made — so there is a real branch to
push or open a PR against *before* you decide anything. Your working tree is never
touched.

**Dispatching with uncommitted work?** Kage says so up front: a run branches from `HEAD`,
so your uncommitted changes are invisible to the agent and will collide at merge time.
Commit or stash first when the task depends on them.

Two steering verbs, deliberately:

```bash
kage tell <run-id> "skip the analytics tables entirely"   # queued for the next boundary
kage stop <run-id>                                        # halt now, resumable
```

`kage open <run-id>` prints the worktree path so you can `cd` in, run things, or open it
in your editor. Isolation without exile — take over whenever you want.

### 3. Review — receipt first, diff second

```bash
kage review <run-id> --project .
```

You get the claim card, then the exact commands to see the diff and to accept or refuse.
Reviewing means reading three things: the verdicts, the `⚠ unsure` lines (the agent is
required to say what it is unsure about), and the diff itself.

**Accept:**

```bash
kage merge <run-id> --project .
# → Merged kage/<run-id> into main. Ratified 1 learning(s) — the next brief will carry them.
```

**Refuse:**

```bash
kage reject <run-id> "we can't drop that index — it backs the reporting query" --project .
```

Rejection is not a delete. The reason becomes a `negative_result` packet, so the next
brief carries *why not*. The branch stays for inspection.

### 4. Report — one screen, when you come back

```bash
kage report --project .
```

```
While you were away (since 2026-08-12 09:41):
  ✓ update-error-codes-260812-4b1a   verified 4/4 — ready (~2 min review)
  ⏸ payments-migration-260812-77c2   blocked: backfill users-first or orders-first?
  ✗ bump-vite-260812-0d9e            failed: tests
  Trust: 7/8 claims fully verified · bugfix 5/6 · refactor 2/2
```

Done / Blocked / Halted, then one trust line. That is the *only* thing that reports —
there is no progress stream and no per-event notification, on purpose. `--all` ignores
the last-read marker and shows everything.

The trust line is your calibration: it tells you which kinds of work this setup handles
cleanly and which need more of your attention.

---

## What "verified" actually means

Three checks run on every claim, in the run's worktree:

- **`tests`** — your configured command. The verdict is its exit code. Nothing else.
- **`diff-size`** — changed lines against your budget (default 400). Over budget, the
  claim is presented as *"too large to review well"* rather than as ready.
- **`citations`** — every repo path the claim names must exist in the work produced.

Each writes an evidence log under `.agent_memory/runs/<run-id>/evidence/`. Open them; the
verdict is reproducible.

Three rules worth internalizing:

1. **A check Kage could not run is not a pass.** A missing binary or broken env yields
   `unverified_no_env`, and with strict verification (the default) that keeps the run out
   of `ready`.
2. **The agent's summary is never the verdict.** If an agent claims green tests over a red
   suite, the card shows `NOT VERIFIED` and the real exit code.
3. **Static checks alone are not verification.** If no command ran — because no test
   command is configured — the card reads `UNVERIFIED — nothing was executed`, never
   `VERIFIED`, and tells you to configure one or review the diff yourself. Diff size and
   citation existence are inspections; only execution is proof.

**A note on hired agents and permissions.** Headless agents often run without permission
to execute commands (`claude -p` allows edits but gates bash). That is expected and fine —
Kage does the verifying. Every brief tells the agent so, and instructs it to list what it
could not check in its `unsure` section rather than claim it ran something it didn't.

Turn strictness off only if you know why: `kage config --no-strict`.

---

## Run states

```
draft → briefed → dispatched → running → verifying → ready ──→ merged
                                   │                   └────→ rejected
                                   ├→ blocked  (resumable)
                                   ├→ stopped  (resumable)
                                   └→ failed   (retry or reject)
```

`merged` and `rejected` are terminal — the kernel refuses any transition out of them, so
history cannot be quietly rewritten. `blocked`, `stopped`, and `failed` are all
recoverable with `kage retry`.

---

## When things go wrong

**"blocked: <question>"** — the agent hit something it could not decide. Answer it and
resume:

```bash
kage tell <run-id> "orders-first" --project .
kage retry <run-id> --project .
```

Agents are instructed to report blockers rather than improvise around them. A blocked run
is the system working.

**"failed: tests"** — verification did not pass. Look at the evidence log, then either
steer and retry, or reject with a reason worth remembering.

**"protocol MISSED (skeleton from diff)"** — the agent finished without the required claim
block. Kage records what it can from the diff and flags it rather than crashing or
silently inventing a claim. Review the diff manually.

**Merge conflict** — Kage tells you and stops. Resolve it in the repo, then re-run
`kage merge`.

**"Illegal transition …"** — you asked for something the lifecycle forbids (stopping a
merged run, for instance). The message names the legal moves.

**"No coding agent found on PATH"** — install Claude Code or Codex. To exercise the loop
without either, use `--agent stub`, which runs a scripted stand-in agent (this is what CI
uses).

---

## Working with teammates

Runs, worktrees, and evidence are local working state — gitignored on purpose. What
travels is what should: the **branch**, and the **memory**.

When you merge a run, the learnings that rode its branch become approved packets under
`.agent_memory/packets/`, committed to your repo. A teammate pulls, and their very next
brief carries what your run discovered — with your name and the date on it. Onboarding is
`git pull`; there is no server and no account.

Because packets are plain Markdown in the repo, they are reviewed in the same PR as the
code that taught them.

---

## In CI and scripts

Every verb works without the manager, so this composes:

```bash
kage dispatch "$INTENT" --agent stub --project . || exit 1
kage report --all --project .
```

`kage merge` and `kage reject` exit non-zero when they refuse, so a pipeline can gate on
them.

---

## What is not built yet

Stated plainly, because a tool that overclaims is worse than one that does less:

- **CI-backed checks.** Verification runs locally today. A `ci` check kind that reads
  results back from your CI provider is designed but not shipped; nothing pretends to
  have consulted CI.
- **Push into the room.** The manager catches up on events at each turn boundary rather
  than being interrupted mid-thought. Run `kage runs` in a second pane if you want a live
  view.
- **Leases.** Concurrent runs that touch the same files are not yet serialized. Dispatch
  overlapping work deliberately, or one at a time.
- **Windows.** macOS and Linux for now.

---

## Where things live

```
.agent_memory/
  packets/            team memory — plain Markdown, committed, reviewed in PRs
  runs/<run-id>/      brief.md · task.json · claim.json · transcript.jsonl · evidence/
  worktrees/<run-id>/ the agent's isolated checkout
  config.json         test command, setup command, diff budget, strictness
  reports/            runs ledger, value ledger, track record
```

`runs/` and `worktrees/` are gitignored. `packets/` is the part that is meant to be
shared — and the part that makes tomorrow's delegation better than today's.
