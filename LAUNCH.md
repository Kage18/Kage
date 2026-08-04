# Launch kit

*Everything needed to ship Kage, prepared and verified. The outward-facing steps — publishing to npm
and posting publicly — are deliberately left for Kushal: they are irreversible, they carry his name,
and they are not mine to take. Each one below is a single command or a paste.*

---

## Before anything: the check that matters

This repo has been burned twice by shipping something that passed every source-checkout test and was
broken from npm ([the 4.0.0 portal shipped 404 for every user](.agent_memory/packets)). So the gate
is not "tests pass" — it is **install the tarball into a clean directory and run it**:

```bash
npm run verify:package --prefix mcp
```

That packs, installs into a temp dir with no repo present, and exercises the real front door. It
must pass before publishing. Nothing else proves the thing a customer downloads works.

---

## Upgrade note that must ship with this release

A daemon started before this version re-indexed in a loop, because its file watcher did not
exclude two directories the re-index itself writes to. Measured on the dev machine: **118 hours of
CPU over 5 days elapsed — 91% of one core, continuously, on a repository nobody was touching.**

Installing the new package does **not** stop an already-running daemon. Anyone who has ever run
`kage up` needs one line:

```bash
kage down && kage up
```

Say this in the release notes rather than letting people discover a hot laptop. `shouldTriggerReindex`
in `mcp/daemon.ts` now excludes `.agent_memory` wholesale, with a 30 s floor between passes so a
future mistake of this shape is slow instead of infinite.

---

## Publishing

```bash
cd mcp && npm publish --access public
```

Prerequisites, all Kushal's:

- `npm whoami` returns your account and you have publish rights on `@kage-core/kage-graph-mcp`
- the version in `mcp/package.json` is bumped past the published one
- `npm run verify:package` is green

The desktop app is a separate, optional artifact and **should not gate the launch**. It is unsigned;
signing needs an Apple Developer certificate and your Apple ID, which only you can supply. Ship the
CLI first — it is the whole loop, it installs in one line, and it has no Gatekeeper problem.

---

## The positioning, in one sentence

> Kage is memory for coding agents that **stops serving a claim when the code moves underneath it.**

Everything else is support for that sentence. It is the only claim in this space nobody else makes:
rules files rot silently, vector memory answers confidently from six months ago, and built-in
auto-memory never leaves the machine it was written on.

---

## Show HN draft

**Title:** `Show HN: Kage – agent memory that withholds a claim when the cited code changes`

**Body:**

```
Every coding-agent session pays to learn the same things and throws the result away. The
knowledge exists — in reverted PRs, in someone's head — just nowhere an agent can reach when
it matters.

The existing answers all fail the same way: CLAUDE.md and rules files rot silently because
nothing checks them against the code, and vector memory retrieves by similarity and will hand
your agent a fact that stopped being true in March, confidently.

Kage's unit is a short claim — capped, and it MUST cite code or a commit. A card that cites
nothing cannot exist, because a claim nothing can falsify is trivia. Every card carries a
trust state recomputed from your tree. If the cited symbol is gone, the card is withheld from
every agent, counted, and shown to you. A bad memory is worse than no memory.

The cards are files, in a separate git repo you own. Each one is a conformant Open Knowledge
Format document, so it is readable markdown with or without Kage — the standard says what the
concept is, and Kage's namespaced fields say whether it is still true. There is no database to
export from and nothing to be locked into.

The extraction is a background pass on your OWN coding-agent subscription (`claude -p`), so
the tool pays for zero inference. It triages first and rejects ~90% of sessions — most
sessions contain nothing durable, and a memory tool that saves everything becomes noise.

Cards live in a separate git repo outside your project. Your repo gets one fenced block in
the AGENTS.md you already have. On Kage's own repo that took tracked memory files from 404 of
1,018 down to one block.

Day one reads your git history, so it is not an empty demo: 150 commits into 10 cited cards
in 74 seconds, for about $0.40 of your own tokens.

One thing it deliberately does not claim: "repeat failures prevented." That is the obvious
metric and it needs a counterfactual nobody can run, so every number it shows is a counted
event and unmeasured renders as a dash, never a zero.

npx -y @kage-core/kage-graph-mcp install
MIT, no account, no API key.
```

**Why this shape:** it leads with the problem, names the competitors' failure mode honestly rather
than sneering, states the mechanism, and closes with what the product refuses to claim. That last
paragraph is the most persuasive thing in the post on a forum that punishes overclaiming.

Post Tue–Thu, 8–10am ET. Be in the thread for the first two hours; the first ten comments decide it.

---

## The questions that will come, and honest answers

**"How is this different from mem0 / Zep?"**
Those are retrieval infrastructure for people building agents. Kage is a product for a software
team, and the difference that matters is refusal: they serve what they stored, Kage stops serving a
claim whose code moved.

**"Why not just use CLAUDE.md?"**
You should — Kage writes into it. The block is generated from cards that were verified against your
tree, so it stops carrying claims that quietly stopped being true.

**"What does it cost me in tokens?"**
Mining is roughly $0.40 for 150 commits, once. After that, triage runs on the cheap tier and rejects
most sessions. It is your subscription; the meter is shown.

**"Does it send my code anywhere?"**
It calls the agent CLI you already installed and already authenticated. There is no Kage server, no
account, and no API key.

**"Is the desktop app required?"**
No. The CLI and the MCP tools are the whole loop.

**"What happens to my knowledge if you disappear?"**
Nothing. Cards are markdown files in a git repo you own, in Google's Open Knowledge Format —
`type`, `title`, `description`, the claim as the body, and Kage's trust metadata namespaced in
`x-kage-*` fields that any other OKF consumer ignores. Delete Kage and you still have the
memory, in a format that was not invented here.

---

## What is honestly not ready

State these rather than let someone discover them:

- **Team sync is built and tested but has never run across two machines.** Do not sell it yet.
- **The desktop app is unsigned**, so it trips Gatekeeper on first open.
- **The legacy packet store still exists** in read-only form while `kage cards import` drains it.
- **Only `claude` and `codex` have verified headless contracts** for the Librarian.

---

## After launch: the one number to watch

Not stars, not installs. **Approval rate in the Inbox** — proposals approved ÷ proposals shown.

If that number is high, the Librarian's precision is good and people will keep the habit. If it
falls below roughly half, the triage pass is too loose and the inbox is becoming noise — which is
the exact failure that made Cursor delete its Memories feature. Tighten triage before adding
anything.
