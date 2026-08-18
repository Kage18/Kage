---
type: "Bug Fix"
title: "renderTrustLine takes only `projectDir` (no injectable runs array) and calls listRuns i..."
description: "renderTrustLine takes only projectDir no injectable runs array and calls listRuns internally, so testing it does require actual run files on disk via createRun — but createRun itself needs no git init, matching the exist"
resource: "mcp/delegation/trackrecord.ts"
tags: ["delegated-run", "kage-run:finish-the-every-check-passed-is-not-ver-260818-fb9d"]
timestamp: "2026-08-18T15:58:11.686Z"
x-kage-id: "repo:finish-the-every-check-passed-is-not-ver-260818-fb9d:bug_fix:rendertrustline-takes-only-projectdir-no-injectable-runs-array-and-calls-listrun"
x-kage-type: "bug_fix"
x-kage-status: "pending"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation/trackrecord.ts", "mcp/verified-fold.test.ts"]
---

# renderTrustLine takes only `projectDir` (no injectable runs array) and calls listRuns i...

> renderTrustLine takes only projectDir no injectable runs array and calls listRuns internally, so testing it does requ…

renderTrustLine takes only `projectDir` (no injectable runs array) and calls listRuns internally, so testing it does require actual run files on disk via createRun — but createRun itself needs no git init, matching the existing repo memory note that contract.ts has no git dependency.

Learned while delivering: Finish the "every check passed is not verified" sweep. Two more call sites carry the identical bug, disclosed by the run that fixed the first one.

THE RULE, already established in this repo's memory and now in three call sites of claimVerdict: "every check passed" is NOT a synonym for "verified". The fold claim.checks.every(c => c.result === "pass") is TRUE when nothing was executed — in a repo with no configured test command the only checks that run are non-executing ones (diff-size kind "diff", citations kind "citation", reachability kind "analysis"), they all pass, and claimVerdict in mcp/delegation/verify.ts labels that exact claim "UNVERIFIED — nothing was executed". Any gate or metric deciding something consequential must call claimVerdict rather than re-folding the checks itself.

Already fixed under this rule: maybeAutoMerge (mcp/delegation/ratify.ts) and computeTrackRecord's verified_first (mcp/delegation/trackrecord.ts).

STILL BROKEN, both in mcp/delegation/trackrecord.ts, reported by the agent that fixed computeTrackRecord and deliberately scoped out of that run:
1. curationComparison (around lines 69-80).
2. renderTrustLine's claimsVerified tally (around line 99+).
Read both and CONFIRM each really does re-fold checks rather than call claimVerdict — do not take my line numbers on faith, they may have shifted. Fix each to also require claimVerdict(claim).executed. If either turns out NOT to have the bug, say so plainly in your claim and leave it alone; a no-op finding honestly reported is a good outcome here.

WHY IT MATTERS: these two feed the trust and curation lines a user reads to decide how much to delegate, and they now sit UNDER an autonomy gate that merges code unattended. An inflated "verified" rate there means the product recommends trusting an agent that has proven nothing — worst precisely in a fresh repo with no test command, where every run would score perfectly.

WHILE YOU ARE THERE: add a guard so this cannot recur a fourth time. A test asserting that mcp/delegation/trackrecord.ts contains no bare .checks.every( fold deciding verification — use the source-reading test convention this repo already has (see mcp/release.test.ts reading cli.ts and kernel.ts via join(__dirname, "..", ...); note __dirname is mcp/dist at runtime, so the ".." is required). Phrase the failure message so a future agent understands WHY, not merely that a regex matched.

TESTS — new file mcp/verified-fold.test.ts (repo rule: new behaviour gets its own test file; mcp/delegation.test.ts is off-limits). Cover: a claim where nothing executed does not count toward curationComparison; the same for renderTrustLine's tally; a normally-verified claim still counts in both; and the source guard above. Name in your claim which test fails if the change is reverted.

CONSTRAINTS: CommonJS — no import.meta (TS1470), no top-level await. Change mcp/delegation/trackrecord.ts and your new test file only. Do NOT touch mcp/kernel.ts or mcp/cli.ts.
VERIFY: npm run test --prefix mcp (687 green before your change) and npm run build --prefix mcp with no "error TS". Run them for real and fill in the claim fence.
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-18T15:58:11.686Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:finish-the-every-check-passed-is-not-ver-260818-fb9d:bug_fix:rendertrustline-takes-only-projectdir-no-injectable-runs-array-and-calls-listrun","title":"renderTrustLine takes only `projectDir` (no injectable runs array) and calls listRuns i...","summary":"renderTrustLine takes only projectDir no injectable runs array and calls listRuns internally, so testing it does require actual run files on disk via createRun — but createRun itself needs no git init, matching the exist","body":"renderTrustLine takes only `projectDir` (no injectable runs array) and calls listRuns internally, so testing it does require actual run files on disk via createRun — but createRun itself needs no git init, matching the existing repo memory note that contract.ts has no git dependency.\n\nLearned while delivering: Finish the \"every check passed is not verified\" sweep. Two more call sites carry the identical bug, disclosed by the run that fixed the first one.\n\nTHE RULE, already established in this repo's memory and now in three call sites of claimVerdict: \"every check passed\" is NOT a synonym for \"verified\". The fold claim.checks.every(c => c.result === \"pass\") is TRUE when nothing was executed — in a repo with no configured test command the only checks that run are non-executing ones (diff-size kind \"diff\", citations kind \"citation\", reachability kind \"analysis\"), they all pass, and claimVerdict in mcp/delegation/verify.ts labels that exact claim \"UNVERIFIED — nothing was executed\". Any gate or metric deciding something consequential must call claimVerdict rather than re-folding the checks itself.\n\nAlready fixed under this rule: maybeAutoMerge (mcp/delegation/ratify.ts) and computeTrackRecord's verified_first (mcp/delegation/trackrecord.ts).\n\nSTILL BROKEN, both in mcp/delegation/trackrecord.ts, reported by the agent that fixed computeTrackRecord and deliberately scoped out of that run:\n1. curationComparison (around lines 69-80).\n2. renderTrustLine's claimsVerified tally (around line 99+).\nRead both and CONFIRM each really does re-fold checks rather than call claimVerdict — do not take my line numbers on faith, they may have shifted. Fix each to also require claimVerdict(claim).executed. If either turns out NOT to have the bug, say so plainly in your claim and leave it alone; a no-op finding honestly reported is a good outcome here.\n\nWHY IT MATTERS: these two feed the trust and curation lines a user reads to decide how much to delegate, and they now sit UNDER an autonomy gate that merges code unattended. An inflated \"verified\" rate there means the product recommends trusting an agent that has proven nothing — worst precisely in a fresh repo with no test command, where every run would score perfectly.\n\nWHILE YOU ARE THERE: add a guard so this cannot recur a fourth time. A test asserting that mcp/delegation/trackrecord.ts contains no bare .checks.every( fold deciding verification — use the source-reading test convention this repo already has (see mcp/release.test.ts reading cli.ts and kernel.ts via join(__dirname, \"..\", ...); note __dirname is mcp/dist at runtime, so the \"..\" is required). Phrase the failure message so a future agent understands WHY, not merely that a regex matched.\n\nTESTS — new file mcp/verified-fold.test.ts (repo rule: new behaviour gets its own test file; mcp/delegation.test.ts is off-limits). Cover: a claim where nothing executed does not count toward curationComparison; the same for renderTrustLine's tally; a normally-verified claim still counts in both; and the source guard above. Name in your claim which test fails if the change is reverted.\n\nCONSTRAINTS: CommonJS — no import.meta (TS1470), no top-level await. Change mcp/delegation/trackrecord.ts and your new test file only. Do NOT touch mcp/kernel.ts or mcp/cli.ts.\nVERIFY: npm run test --prefix mcp (687 green before your change) and npm run build --prefix mcp with no \"error TS\". Run them for real and fill in the claim fence.\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"pending","confidence":0.7,"tags":["delegated-run","kage-run:finish-the-every-check-passed-is-not-ver-260818-fb9d"],"paths":["mcp/delegation/trackrecord.ts","mcp/verified-fold.test.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-18T15:58:11.686Z"}],"context":{"fact":"renderTrustLine takes only `projectDir` (no injectable runs array) and calls listRuns internally, so testing it does require actual run files on disk via createRun — but createRun itself needs no git init, matching the existing repo memory note that contract.ts has no git dependency.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-18T15:58:11.686Z","path_fingerprints":[{"path":"mcp/delegation/trackrecord.ts","sha256":"f052bc915081739c3b8384d2b5ccba1a6c08fcec23914722cb00ef584fc98916","size":7620,"symbols":[{"name":"computetrackrecord","kind":"function","sha256":"0485ce67aa870f954680409f46a6dfe0db20236c464f6b07d72020e3e1e89b12"},{"name":"curationcomparison","kind":"function","sha256":"bf5327fbbd24a27bda4598d5d20e04637a28be2644bef5d2f06e2868cbf1f155"},{"name":"line","kind":"constant","sha256":"d0318f9fb38e2032a1d500ae8bfe2a4f9ab8dad8375dc1e1d793d9618abb163b"},{"name":"rendertrustline","kind":"function","sha256":"2539fb8b3eb8a16ca07d3623d081544e939e80d2f812e07739d18909d670ceaf"},{"name":"runs","kind":"constant","sha256":"9ddb6966cb731f1230818f7c963928aa1ab21b908763c64e73777cffaf819204"},{"name":"claimsverified","kind":"constant","sha256":"a6af97e76908e91b3b45afbeed2662094be5636ac0171fdf2e0cbf31e49a9bf6"}]},{"path":"mcp/verified-fold.test.ts","sha256":"84cd1ce2f253e3dbadf0f442fbb06108d3cc9cc6bebfd5578a5a9fe14d83a72b","size":6688,"symbols":[{"name":"source","kind":"constant","sha256":"f6b74fdbddbc9274affde0ec95405246ccc0e9cd1d90475d988e8ec1992fce22"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":94,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":892,"unresolved_symbols":["maybeAutoMerge","noEmit"]},"created_at":"2026-08-18T15:58:11.686Z","updated_at":"2026-08-18T15:58:11.812Z","author_branch":"kage/finish-the-every-check-passed-is-not-ver-260818-fb9d"}
```

