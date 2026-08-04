<div align="center">

<img src="docs/assets/kage-banner.svg" alt="Kage" width="150%">

**Your coding agents forget everything at the end of every session.**

Kage employs a background **Librarian** — running headless on the coding-agent subscription you
already pay for — that turns each session and your git history into short, **cited, verifiable
claims**, keeps them in a git store *outside* your repo, and puts them back in front of your agents
at the moment they matter. When the code moves underneath a claim, Kage stops serving it.

```bash
npx -y @kage-core/kage-graph-mcp install
kage cards mine        # read your own history — memory before your first session ends
```

<p>
  <a href="https://www.npmjs.com/package/@kage-core/kage-graph-mcp"><img src="https://img.shields.io/npm/v/@kage-core/kage-graph-mcp?color=41ff8f&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@kage-core/kage-graph-mcp"><img src="https://img.shields.io/npm/dm/@kage-core/kage-graph-mcp?color=41ff8f" alt="downloads"></a>
  <img src="https://img.shields.io/npm/l/@kage-core/kage-graph-mcp?color=41ff8f" alt="license">
  <img src="https://img.shields.io/badge/account-not%20required-41ff8f" alt="no account">
  <img src="https://img.shields.io/badge/inference-your%20own%20subscription-41ff8f" alt="runs on your subscription">
</p>

<p>
  <a href="./HOW_IT_WORKS.md">How it works</a> ·
  <a href="./DIRECTION.md">Why it is built this way</a> ·
  <a href="./BUILD.md">What is built</a>
</p>

**Works with** Claude Code · Codex · Cursor · and any MCP client

</div>

---

## The problem

Every agent session pays to learn the same things and then throws the result away. Why that constant
is a constant. Why that test flakes. Why the refactor everyone keeps suggesting was reverted twice.

The knowledge exists — in reverted PRs, in someone's head, in a thread from March. It is just not
anywhere an agent can reach at the moment it would matter.

The existing answers fail in the same direction. `CLAUDE.md` and rules files rot silently, because
nothing checks them against the code. Vector-memory products retrieve by similarity and will hand
your agent a fact that stopped being true six months ago, with total confidence. First-party
auto-memory is per-user and machine-local, so nothing your teammate learned ever reaches you.

**Nobody else declines to answer.** That is the gap Kage is built in.

## How it works

```
  git history ─┐
               ├─→  Librarian  ─→   gate    ─→  Inbox   ─→  shadow store  ─→  your agents
  sessions ────┘   (your own       (cited?     (you        (git, outside     (BRIEF +
                    subscription)   secret?     approve)    your repo)        recall)
                                    known?)
```

**Intelligence where judgment is needed. Determinism where trust is needed. A human where team
knowledge is born.**

- A **model** decides what was worth learning — that needs judgment, and it is the same model that
  just did the work, running on your subscription. Kage pays for no inference, ever.
- A **machine** decides what may be stored and what may be served — that needs to be auditable, so
  it is deterministic and its refusals cannot be argued with by a model having a bad day.
- A **person** decides what becomes the team's — that is what makes it theirs.

Most sessions contain nothing durable, and the triage pass is built to say so. Rejecting ~90% is the
design working, not failing.

## The card

The unit of memory: one claim, at most 120 words, in one of three kinds — `decision` (what we chose
and why), `runbook` (a verified procedure), `caution` (a failure, its cause, its fix).

```
[caution] tenantLimit comparison is exclusive on purpose

  withinLimit uses < rather than <=. Two PRs flipped it to <= and both were reverted.

  cites    src/limits.ts#withinLimit    verified against a1b2c3, 2h ago
  recalls  when editing src/limits.ts
```

Two rules are enforced in code, not by convention:

- **A card that cites nothing cannot exist.** A claim nothing can falsify is trivia.
- **A claim is capped.** Cards are claims, not documents; a 400-word card is a doc that dodged review.

Every card carries a live trust state recomputed from your code — `verified`, `unverified`, or
`stale`. **A stale card is withheld from every agent**, counted, and shown to you. A bad memory is
worse than no memory.

## Your repo stays clean

Nobody wants hundreds of generated files in their tree, and no first-party vendor puts them there.

The store is a **separate git repo** at `~/.kage/store/<id>` — one file per card, one commit per
change, so history, blame and revert are native git. Your project repo gets exactly one thing: a
≤200-line fenced block in the `AGENTS.md` or `CLAUDE.md` you already have.

|                               | before                 | after                       |
|-------------------------------|------------------------|-----------------------------|
| tracked memory files          | 404 of 1,018 — **40%** | **1 fenced block**          |
| commits carrying memory noise | 200 of the last 200    | only when the block changes |

## Day one

A memory product with no memories is a dead demo, so Kage reads history you already wrote.

```bash
kage cards mine
```

Measured on this repository: **150 commits → 10 cited cards in 74 seconds for $0.40** of your own
subscription. Reviewing them takes ten minutes and doubles as the fastest architecture tour of your
own codebase, because every card cites the commit it came from.

```bash
kage cards list                        # what is waiting on you
kage cards approve <id>                # becomes team knowledge; the BRIEF updates
kage cards recall "why is the board slow" --files src/board.ts
kage cards verify                      # re-check every claim against the tree as it stands
kage cards import --dry-run            # migrate a legacy packet store through the gate
```

Or open the desktop app and clear the Inbox with `j` `k` `a` `r`.

## Teams

Give the shadow store a remote on the git host you already trust. A teammate's proposals arrive as
branches, review stays per-card in the same Inbox, and identity is git identity.

The scoreboard is **cross-pollination** — cards authored in one person's session, delivered into
another person's agent. Measurable per receipt, unlike "repeat failures prevented," which needs a
counterfactual nobody can run.

## Honesty

Every number Kage shows is a counted event. An unmeasured value renders as a dash or an unlock
action — never a zero, because a zero reads as "we measured, and it was none."

That rule cost us a headline. The obvious metric for this product is *repeat failures prevented*, and
it cannot be measured without knowing what would have happened otherwise. So Kage does not claim it.

## Status

The Librarian core is built and running — 166 tests, and every number above came from real runs on
this repository. [BUILD.md](./BUILD.md) states precisely what is wired and what is not, in a table,
because a half-wired loop that looks whole is worse than a stated gap.

- [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) — 17 diagrams, product and technical
- [DIRECTION.md](./DIRECTION.md) — the design, the evidence behind it, and the kill list
- [BUILD.md](./BUILD.md) — module by module, plus what comes next

## Licence

MIT.
