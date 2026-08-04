# Kage — Direction

*Decided 2026-08-04, after a 10-agent research pass (5 sourced industry sweeps, 1 adversarial
audit of this codebase, 3 competing ground-up designs, 1 judge). This document supersedes
ROADMAP.md and OKF_PIVOT.md as the statement of what Kage is.*

## What Kage is

**Kage turns every agent session into citation-verified team knowledge, and runs the next
piece of work on top of it.** A desktop app plus a local core that employs its own staff
intelligence — the **Librarian**, a background agent running headless on the user's existing
coding-agent subscription — to distill sessions, mine history, and keep the knowledge honest.

The one-line position: **cross-agent + team-shared + agent-written + verified-against-git +
honestly measured.** As of 2026 nobody holds all five: first-party memory (Claude Code, Codex,
Cursor, Windsurf) is per-user and machine-local; Devin Knowledge and Copilot Memory are
team-shared but vendor-locked; mem0/Zep/Letta are infrastructure, not a product for teams.

The single bet: **capture quality is owned by the product, not delegated to whichever agent
happened to be working.** Cursor documented why the working model fails at this (it saves
task logs) and killed its Memories feature over junk. The industry converged on a dedicated
background model pass — Cursor's sidecar, Codex's two-model idle-time summarizer, Cloudflare's
extract-then-verify pipeline. Kage's Librarian is that pass, plus the two things nobody ships:
a deterministic citation gate in front of the human, and receipts behind every number.

Division of labor, stated once:
**intelligence where judgment is needed, determinism where trust is needed, a human where team
knowledge is born.**

## The Card

The unit of memory. At most ~120 words of claim, exactly three kinds:

| kind | what it holds |
|---|---|
| `decision` | what we chose, why, what was rejected |
| `runbook` | a verified procedure with exact commands |
| `caution` | a failure, its cause, its fix |

Anything finer is a tag, never a type — the old 15-type taxonomy became a gameable admission
exemption (54% of the legacy store is typed "decision" because that label skipped the
derivability check).

Every card carries: **citations** (repo path + optional symbol pinned to a blob sha, or
`commit:`/`pr:` refs — a card with zero resolvable citations cannot exist), a **trigger**
(when to recall it), **provenance** (which session/mining run/human produced it), and a
**state machine**: `proposed → approved → (verified | unverified | stale) → superseded/retired`.
Supersede, never delete. Verification is honest by construction: *verified* means re-checked
since the cited code last changed; a symbol that disappeared makes the card *stale* and it is
withheld from recall — counted, never silent.

Never stored: raw transcripts, prompts, diffs, secrets (a deterministic scan blocks the
write), tokens, private URLs.

## Where memory lives — the repo-clutter answer

**Team memory never lives in the product repo.** The store is a **shadow repo** — a separate
git repository per product repo, cloned at `~/.kage/store/<repo-id>/`, one file per card,
one commit per mutation, so history/blame/revert/diff are native git. Solo: no remote, fully
offline. Team: add a remote on the git host the team already trusts.

The product repo carries exactly one generated artifact: a **≤200-line fenced BRIEF block**
(`<!-- kage:begin --> … <!-- kage:end -->`) in the AGENTS.md/CLAUDE.md the team already has —
the compiled index of top approved cards, reviewed in PRs like any doc change. This aligns
with the industry convention (no vendor commits generated memory; the repo carries small
curated instruction files) instead of fighting it. The old model — 405 packets, 40% of this
repo's tracked files, memory noise in 200 of the last 200 commits — is retired.

## Capture — the Librarian

Headless invocation of the user's **own** agent (`claude -p`, `codex exec`) dispatched by the
local core, riding the subscription they already pay for. Kage pays for zero inference, ever.

- **Session end / idle:** two passes off the hot path. Triage (cheapest tier): "is there
  anything durable here?" — expected to reject ~90% of sessions; that is correct behavior.
  Extract (working tier): propose **at most 3 cards**, cited and timestamped, then a
  write-time reconcile against similar existing cards deciding ADD / UPDATE / SUPERSEDE / NOOP.
- **Day one:** the miner runs over the last ~200 merged PRs + git history (reverts are
  gold: something was tried and undone) and proposes 20–40 cited cards with a live token
  meter. Memory exists *before* the first session ends; reviewing the batch doubles as an
  architecture tour.
- **Gate:** deterministic first (citations resolve, secret scan, dedupe), human last —
  nothing becomes team knowledge without approval in the Inbox.

The proxy survives as **delivery and measurement only** — byte-preserving transport,
receipts. It never judges content again. (The audit found the old capture path had zero LLM
judgment anywhere: substring-scoring heuristics fed a store where 43% of packets are dead and
stale suppressions outnumber recalls 52:1. The designed LLM pass existed as dead code —
`createProxyLoopbackProvider`, never wired into a Pipeline.)

## Retrieval — three tiers

1. **BRIEF** — the ≤200-line block reaches every agent through its native mechanism
   (CLAUDE.md import, AGENTS.md fenced block, .cursor/rules).
2. **Trigger-scoped recall** — an MCP tool + hooks match touched files and task text against
   card triggers and citation paths; each injection is stamped with live verification state
   ("verified against a1b2c3, 2h ago") and writes a counted receipt.
3. **Search** — full-text from the app or the agent.

Stale cards are withheld from agents, visibly for humans, and queued for Librarian re-verify.

## The SDLC on top

`memory → spec → tasks → agents → verification → memory`. The two links nobody has built are
**memory→spec** (every spec assertion cites a card or is flagged "unsupported — confirm or
research") and **merge→memory** (post-mortem proposes cards from the diff + gate verdicts).
Dispatch runs the user's own agents in worktrees — kept deliberately thin, because standalone
orchestration boards died (Terragon, Vibe Kanban) while every vendor bundles queues free.
Humans sit at exactly three gates: **spec approval, PR review, card approval.**

## The app

An ambient approval console, not a destination: **Tray** (Librarian state, attach status told
honestly, approvals badge), **Inbox** (cards + specs as diffs; keyboard; deliberately boring,
like code review), **Work**, **Knowledge** (cards, supersede chains, a Misleading tab),
**Receipts** (counted numbers only; unmeasured = an unlock action, never a zero).

## Pricing — SUPERSEDED 2026-08-05, see [GTM.md](GTM.md)

> ~~Solo **free forever**. Team **$20/seat** (hosted shadow-repo remote, roles, team receipts).
> Business **$40/seat** (SSO, audit, retention, org views). "You pay Kage for trust, sync,
> governance."~~

Every priced item above was wrong, and the reasons are worth keeping rather than deleting:

- **Sync cannot be sold.** The shadow store is a git repo; a team points it at their own remote in
  five minutes and pays nothing, forever. Conceded permanently.
- **Seats cannot be enforced.** `vnext/license/license.ts` documents it in its own comments — with
  no server and no directory, headcount is a number Kage cannot verify, and acting on unverifiable
  numbers is the one thing this product refuses everywhere else.
- **SSO/audit/retention is an enterprise cost structure under a card-swipe price**, and it inverts
  the ~zero marginal cost that makes the free tier sustainable.
- **Anything gated by `if (licensed)` in an MIT client is one deleted line from free.** A flag is
  not a business.

What replaced it: **Kage free (everything local, plus uncapped sync), and Kage Watch at $49 per
watched repository per month** — a hosted service that re-reads every claim against the new code on
every merge. Sell the run, not the transport. The full model, the kill criteria, what not to build,
and the measurements that produced all of it are in [GTM.md](GTM.md).

## Kill list (deliberate contract change)

Removed with their tests — this is the documented exception to the never-delete-tests rule:

- **OKF round-trip tooling** (`okf.ts`'s export/reimport machinery) — the "lossless" `kage-state`
  JSON fence doubled every packet and leaked into a card's claim during the dogfood run. **The
  format itself is kept and cards are now conformant** (see below); what died is the second copy,
  not the standard.
- **Cloud server/client + billing** — wired at one CLI branch; superseded by the shadow-repo
  remote model.
- **CLI collapse** — 131 commands to a core set; the CLI is plumbing, the app is the product.
- **The 15-type taxonomy and the legacy heuristic capture pipeline** — superseded by
  Cards + the Librarian (legacy store remains readable during migration).
- **The estimated `tokens_saved` headline** (447.7M claimed vs 8.1M honest replay) — counted
  events only.
- **Dead packets** — the 176 deprecated/stale/superseded files archived out of the store.

## Kept — the substrate the rebuild stands on

Symbol-fingerprint anchors + staleness detection; the injection-decision plane and delivery
receipts; the proxy transport + provider gateway; work-item derivation from git; the vnext
review-queue trust floor; the code graph; the Electron shell and the design language
(illumination is certainty; a dash is never a zero).

**OKF as the card file format.** A card file is a conformant Open Knowledge Format concept
document: `type` plus the recommended keys, the claim as the body, and every Kage-specific
field namespaced under `x-kage-*`, which OKF reserves for producers and requires consumers to
ignore. This is kept for one reason, and it is not standards-compliance for its own sake — the
product's anti-lock-in promise is *"your memory is plain markdown you can read without our
binary, and it survives us going away."* A bespoke format makes that sentence false, and a
memory tool asking for a team's institutional knowledge cannot also be a trapdoor. Conformance
costs six frontmatter keys and no dependency (JSON is a subset of YAML 1.2, so the values the
hand-rolled parser writes are already legal YAML — verified against a real YAML parser, not
assumed).

It also states the division of labour exactly: OKF v0.1 standardizes the store and explicitly
scopes *out* freshness, verification and staleness — which is precisely what a card's trust
state is. **OKF says what the concept is; `x-kage-*` says whether it is still true.**

## Known risks, named

Subscription-riding fragility (ToS/format changes strand the Librarian); precision failure
kills trust permanently (one junk week = muted forever — the triage pass must stay ruthless);
first-party absorption (Anthropic/GitHub can bundle the category; the defensible remainder is
cross-agent + honest measurement); memory poisoning (approved cards are a trusted injection
channel — provenance signing is on the roadmap); non-code knowledge (product/PRD decisions
need an evidence class beyond code citations); counterfactual efficacy (ship a holdout mode —
prove memory helps, which no vendor dares).
