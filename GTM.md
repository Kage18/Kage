# How Kage makes money — the model, and the measurement that changed it

*Written 2026-08-05. Section 3 is a measured result that contradicts the plan in section 2. It is
kept in that order deliberately: the plan was good reasoning from the facts available, and the
measurement is why you run the cheap experiment before building.*

---

## 1. The constraint that rules out most models

**The shadow store is a git repo.** A team can point it at their own GitHub remote and pay nothing,
forever. So hosted sync is not sellable — concede it loudly and permanently.

**The client is MIT.** Any paid feature implemented as `if (licensed)` in the client is one deleted
line away from free. Gating an MIT client is a comment, not a business.

Together these kill: hosted sync, per-seat pricing, attestation-gated recall, client-side
enforcement of any kind, and every identity/PKI/SSO line item. What survives has to be **a service
Kage runs**, not a flag Kage flips.

## 2. The model that survived: Kage Watch

**Free — Kage.** MIT, forever, no account, no API key, no phone-home. Everything a machine can do
to a repo it has: Librarian extraction on the user's own subscription, git-history mining, the full
card lifecycle, trust verification, BRIEF, recall, MCP tools, receipts, CLI, desktop app, unlimited
cards and repos and people. **Uncapped git-remote sync, conceded permanently.** Plus SSH-key
approval signing — which closes the memory-poisoning hole named in DIRECTION.md, and is given away
because it is client-side and therefore ungateable anyway.

**Paid — Kage Watch.** A hosted GitHub App that, on every merge to the default branch, re-audits
every card in the team's store against the new tree, files supersede proposals naming the breaking
commit, and routes each affected card to the CODEOWNER of the cited path.

**Unit: the watched repository, not the seat.** `license.ts` documents in its own comments that
seats are unenforceable without a directory, and a directory means the server the free tier
forbids. Per-repo is structurally enforceable because Kage holds the webhook and does the work.

**The honest answer to "why not just use our own git remote?"** — for sync, you should, and we
won't charge you for moving markdown around. What you would be paying for is that the re-check runs
on *every merge* rather than on the days someone remembers, and that a queue decides who fixes what
and closes it out. Git logs writes; it does not run anything. **This loses to any team with a
platform engineer, permanently.** That is accepted, not papered over.

## 3. The kill criterion, run before building — and what it actually found

The plan named its own hard kill: *if cited code survives untouched, Watch has no work to do.*
`mcp/benchmarks/citation-half-life.mjs` measures it retrospectively — if a Librarian had mined this
repo 12 months ago, how many of its citations still hold at HEAD? Four mature repositories:

| repo | citations | **stale** (card withheld) | **drifted** (still resolves, code moved) |
|---|---:|---:|---:|
| execa | 337 | 1.6% | **53.8%** |
| got | 39 | 11.8% | **86.1%** |
| axios | 62 | 29.4% | **100%** |
| express | 40 | 0.0% | 20.0% |

**On its own terms the criterion FAILED.** Hard staleness — the file gone or the symbol gone, the
case where Kage withholds a card — is rare. The largest and cleanest sample says 1.6% a year. A
team with fifty cards would see less than one break annually. **Nobody pays $49/month for that, and
"we catch broken citations" is not a product.**

**But the measurement found the real number next to it.** Split out the auditor's middle verdict —
`unverified`, where the symbol still resolves but the code beneath it changed — and it is **54% to
100% a year.** That is the dangerous case, and it is the common one: `withinLimit` still exists,
someone just changed `<` to `<=`, and the card still reads as true while being false. A citation
check cannot see that. Only re-reading the claim against the new code can.

### What that does to the model

1. **Watch's pitch is wrong as written.** Not "we catch broken citations" (rare) but *"we catch the
   claim whose code moved underneath it"* (most claims, most years).
2. **Undifferentiated drift alerts would be worthless.** If ~70% of cards are flagged annually, the
   inbox becomes noise — the exact failure that made Cursor delete Memories. The product need is to
   separate drift-that-invalidates from drift-that-does-not.
3. **That separation requires judgment, not a hash comparison** — an LLM re-reading the claim
   against the new code. Which is the first thing in this product that genuinely costs money to
   run, and the first thing a customer cannot get from a git remote.
4. **So the paid tier is: Kage spends its own inference to re-read claims on every merge.** The
   free tier runs on your subscription when your machine is open. The paid tier runs on ours when
   it isn't. That is a real cost, a real service, and unforgeable by an `if (licensed)`.

This breaks the zero-marginal-cost property for the paid tier only, which is the correct place for
it: free stays sustainable, and the paid price now has an actual COGS underneath it instead of
being rent on a flag.

## 4. What to build, in order

0. **Two-machine sync run.** Never demonstrated. Nothing may be sold until it passes.
1. **`kage verify --report`** — for each stale card, the commit that removed the symbol and the
   count of recalls served in the gap. The conversion engine, and an honest free feature.
2. **SSH-key approval signing**, free. Closes the poisoning hole; makes approver identity a key
   rather than `process.env.USER`.
3. ~~Drift triage, measured before it is sold.~~ **RUN — see §3b. Passed.**
4. Only then the GitHub App.

## 3b. The real kill criterion, run: can a judge triage drift?

`mcp/benchmarks/drift-triage.mjs`. Ground truth by construction rather than by my labels: real
comparison sites from execa/axios/got/express, two mutations each with known semantics —
**invalidating** (flip the operator the claim is about, so the claim becomes false) and **cosmetic**
(comments and blank lines elsewhere, so it still holds). The judge sees only the claim and the
resulting code, never which mutation it got.

| prompt framing | false alarms on cosmetic | recall on invalidating |
|---|---:|---:|
| precision-biased, verdict-first | 0% (0/9) | 33% (3/9) |
| neutral, verdict-first | 40% (4/10) | 90% (9/10) |
| **neutral, reasoning-before-verdict** | **0% (0/9)** | **80% (8/10)** |

**Verdict: SUPPORTED.** A judge can forward the changes that matter without burying anyone in the
ones that do not. That is the capability Watch sells, and it is now measured rather than assumed.

**Three harness bugs had to be fixed first, and every one would have produced a wrong business
decision.** They are recorded because the lesson generalises: *an eval that has not been debugged
is measuring the instrument.*

1. **Syntactic claims.** The first claim template said "compares with `>`, not `>=`" — a statement
   about tokens. It measured character-diffing, not comprehension, and reported 0% recall. Real
   cards state what code *does*, so the claim became "when these two are exactly equal the
   condition does not pass."
2. **Wrong attribution.** Claims named the nearest declaration above the line, which was often a
   function not containing the comparison. The judge correctly answered that the claim did not
   describe the code, and the harness scored that as a false alarm. Claims now identify the
   comparison by its operands and need no parser.
3. **Verdict before reasoning.** With `{"invalidated": …, "reason": …}` the boolean was committed
   before the thinking. Three of four "false alarms" in the neutral run were the model reasoning
   to the *right* answer and emitting the opposite flag — one literally read *"wait, that means
   it's NOT invalidated"* next to `invalidated: true`. Reordering to reason-then-verdict moved that
   run from 40% false alarms to 0% with recall still at 80%.

**What this does NOT establish.** N=19 usable trials; one mutation family (boundary flips);
synthetic mutations rather than real diffs; and the judge sees only the after-state, where real
Watch could show the diff and would likely do better. This is a green light to build the next
increment, not proof the product works. The honest reading: **the capability is not the blocker.**
Distribution and whether anyone wants this at all remain the real risks — see §6.

## 5. What not to build

Hosted sync, ever. Anything per-seat. Any identity layer, PKI, SSO, SCIM. Client-side fail-closed
enforcement. Telemetry collection, SIEM export, SOC 2 packs, retention policy. Do not un-delete
`mcp/vnext/workspace/` — 44 files of auth/billing/OIDC that converted nobody and is mid-deletion.

## 6. Risks, each with its cheapest signal

1. **Drift triage is not better than chance.** → Step 3, before the App exists. Hard kill.
2. **Nobody pays for agent memory at all.** Cursor deleted Memories; claude-mem is free; CLAUDE.md
   is free. → Publish the free GitHub Action and wait 60 days. If under ~25 repos adopt it and
   under 5 people ask who will run it for them, nobody will buy the hosted version.
3. **No shared stores exist to watch.** Every install today is single-player. → If under 10% of
   active installs configure a remote in 90 days, there is no team substrate; the honest conclusion
   is "free solo tool", with the agency/consultancy ICP (client A's card leaking into client B's
   repo is a contractual breach with an existing budget) as the back-pocket pivot.
4. **Ceiling.** One monorepo is $49/month for a 200-dev company. Realistically a $1–3M business. If
   the goal needs more, this is the wrong plan and it should be said now, not in year two.
5. **GitHub-only at launch.** GitLab, Bitbucket and self-hosted GHE unserved.

## 7. What I could not do

Publishing to npm, posting publicly, and anything involving payment credentials are not mine to
do — the first two are irreversible and carry Kushal's name, and I am not permitted to handle
payment details. **No revenue has been earned and none can be by me.** Everything up to that point
is built: `scripts/issue-license.mjs` mints a signed key offline, and `kage license activate`
verifies it with no server. The remaining step is a person deciding to charge someone.
