---
type: "Negative Result"
title: "Rejected approach: Finish the \"every check passed is not verified\" sweep. Two more call si"
description: "A delegated attempt at \"Finish the \"every check passed is not verified\" sweep. Two more call sites carry the identical bug, disclosed by the run that fixed the first one. THE RULE, already established in this repo's memo"
tags: ["delegated-run", "rejected", "kage-run:finish-the-every-check-passed-is-not-ver-260818-3645"]
timestamp: "2026-08-18T15:51:50.460Z"
x-kage-id: "repo:https-github-com-kage-core-kage:negative_result:rejected-approach-finish-the-every-check-passed-is-not-verified-sweep-two-more-c"
x-kage-type: "negative_result"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
---

# Rejected approach: Finish the "every check passed is not verified" sweep. Two more call si

> A delegated attempt at "Finish the "every check passed is not verified" sweep. Two more call sites carry the identica…

A delegated attempt at "Finish the "every check passed is not verified" sweep. Two more call sites carry the identical bug, disclosed by the run that fixed the first one.

THE RULE, already established in this repo's memory and now in three call sites of claimVerdict: "every check passed" is NOT a synonym for "verified". The fold claim.checks.every(c => c.result === "pass") is TRUE when nothing was executed — in a repo with no configured test command the only checks that run are non-executing ones (diff-size kind "diff", citations kind "citation", reachability kind "analysis"), they all pass, and claimVerdict in mcp/delegation/verify.ts labels that exact claim "UNVERIFIED — nothing was executed". Any gate or metric deciding something consequential must call claimVerdict rather than re-folding the checks itself.

Already fixed under this rule: maybeAutoMerge (mcp/delegation/ratify.ts) and computeTrackRecord's verified_first (mcp/delegation/trackrecord.ts).

STILL BROKEN, both in mcp/delegation/trackrecord.ts, reported by the agent that fixed computeTrackRecord and deliberately scoped out of that run:
1. curationComparison (around lines 69-80).
2. renderTrustLine's claimsVerified tally (around line 99+).
Read both and CONFIRM each really does re-fold checks rather than call claimVerdict — do not take my line numbers on faith, they may have shifted. Fix each to also require claimVerdict(claim).executed. If either turns out NOT to have the bug, say so plainly in your claim and leave it alone; a no-op finding honestly reported is a good outcome here.

WHY IT MATTERS: these two feed the trust and curation lines a user reads to decide how much to delegate, and they now sit UNDER an autonomy gate that merges code unattended. An inflated "verified" rate there means the product recommends trusting an agent that has proven nothing — worst precisely in a fresh repo with no test command, where every run would score perfectly.

WHILE YOU ARE THERE: add a guard so this cannot recur a fourth time. A test asserting that mcp/delegation/trackrecord.ts contains no bare .checks.every( fold deciding verification — use the source-reading test convention this repo already has (see mcp/release.test.ts reading cli.ts and kernel.ts via join(__dirname, "..", ...); note __dirname is mcp/dist at runtime, so the ".." is required). Phrase the failure message so a future agent understands WHY, not merely that a regex matched.

TESTS — new file mcp/verified-fold.test.ts (repo rule: new behaviour gets its own test file; mcp/delegation.test.ts is off-limits). Cover: a claim where nothing executed does not count toward curationComparison; the same for renderTrustLine's tally; a normally-verified claim still counts in both; and the source guard above. Name in your claim which test fails if the change is reverted.

CONSTRAINTS: CommonJS — no import.meta (TS1470), no top-level await. Change mcp/delegation/trackrecord.ts and your new test file only. Do NOT touch mcp/kernel.ts or mcp/cli.ts — another run is editing those.
VERIFY: npm run test --prefix mcp (687 green before your change — use the "npm run test" form) and npm run build --prefix mcp with no "error TS". Run them for real and fill in the claim fence." was rejected.

Reason: Orphaned before doing any work: the operator's shell timeout killed the kage dispatch CLI, and a CLI-dispatched run is a child of that process with no supervisor_pid, so the agent died with it. Not an agent failure — re-dispatched detached.

Claimed: (no claim)
Branch kept for inspection: kage/finish-the-every-check-passed-is-not-ver-260818-3645

# Citations

[1] explicit_capture (2026-08-18T15:51:50.460Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:negative_result:rejected-approach-finish-the-every-check-passed-is-not-verified-sweep-two-more-c","title":"Rejected approach: Finish the \"every check passed is not verified\" sweep. Two more call si","summary":"A delegated attempt at \"Finish the \"every check passed is not verified\" sweep. Two more call sites carry the identical bug, disclosed by the run that fixed the first one. THE RULE, already established in this repo's memo","body":"A delegated attempt at \"Finish the \"every check passed is not verified\" sweep. Two more call sites carry the identical bug, disclosed by the run that fixed the first one.\n\nTHE RULE, already established in this repo's memory and now in three call sites of claimVerdict: \"every check passed\" is NOT a synonym for \"verified\". The fold claim.checks.every(c => c.result === \"pass\") is TRUE when nothing was executed — in a repo with no configured test command the only checks that run are non-executing ones (diff-size kind \"diff\", citations kind \"citation\", reachability kind \"analysis\"), they all pass, and claimVerdict in mcp/delegation/verify.ts labels that exact claim \"UNVERIFIED — nothing was executed\". Any gate or metric deciding something consequential must call claimVerdict rather than re-folding the checks itself.\n\nAlready fixed under this rule: maybeAutoMerge (mcp/delegation/ratify.ts) and computeTrackRecord's verified_first (mcp/delegation/trackrecord.ts).\n\nSTILL BROKEN, both in mcp/delegation/trackrecord.ts, reported by the agent that fixed computeTrackRecord and deliberately scoped out of that run:\n1. curationComparison (around lines 69-80).\n2. renderTrustLine's claimsVerified tally (around line 99+).\nRead both and CONFIRM each really does re-fold checks rather than call claimVerdict — do not take my line numbers on faith, they may have shifted. Fix each to also require claimVerdict(claim).executed. If either turns out NOT to have the bug, say so plainly in your claim and leave it alone; a no-op finding honestly reported is a good outcome here.\n\nWHY IT MATTERS: these two feed the trust and curation lines a user reads to decide how much to delegate, and they now sit UNDER an autonomy gate that merges code unattended. An inflated \"verified\" rate there means the product recommends trusting an agent that has proven nothing — worst precisely in a fresh repo with no test command, where every run would score perfectly.\n\nWHILE YOU ARE THERE: add a guard so this cannot recur a fourth time. A test asserting that mcp/delegation/trackrecord.ts contains no bare .checks.every( fold deciding verification — use the source-reading test convention this repo already has (see mcp/release.test.ts reading cli.ts and kernel.ts via join(__dirname, \"..\", ...); note __dirname is mcp/dist at runtime, so the \"..\" is required). Phrase the failure message so a future agent understands WHY, not merely that a regex matched.\n\nTESTS — new file mcp/verified-fold.test.ts (repo rule: new behaviour gets its own test file; mcp/delegation.test.ts is off-limits). Cover: a claim where nothing executed does not count toward curationComparison; the same for renderTrustLine's tally; a normally-verified claim still counts in both; and the source guard above. Name in your claim which test fails if the change is reverted.\n\nCONSTRAINTS: CommonJS — no import.meta (TS1470), no top-level await. Change mcp/delegation/trackrecord.ts and your new test file only. Do NOT touch mcp/kernel.ts or mcp/cli.ts — another run is editing those.\nVERIFY: npm run test --prefix mcp (687 green before your change — use the \"npm run test\" form) and npm run build --prefix mcp with no \"error TS\". Run them for real and fill in the claim fence.\" was rejected.\n\nReason: Orphaned before doing any work: the operator's shell timeout killed the kage dispatch CLI, and a CLI-dispatched run is a child of that process with no supervisor_pid, so the agent died with it. Not an agent failure — re-dispatched detached.\n\nClaimed: (no claim)\nBranch kept for inspection: kage/finish-the-every-check-passed-is-not-ver-260818-3645","type":"negative_result","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","rejected","kage-run:finish-the-every-check-passed-is-not-ver-260818-3645"],"paths":[],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-18T15:51:50.460Z"}],"context":{"fact":"A delegated attempt at \"Finish the \"every check passed is not verified\" sweep. Two more call sites carry the identical bug, disclosed by the run that fixed the first one."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-18T15:51:50.460Z","path_fingerprints":[],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":2000,"discovery_tokens_estimated":true,"score":74,"reasons":["high-value memory type","has source evidence","tagged","actionable rationale or verification"],"risks":["not grounded to paths"],"duplicate_candidates":[],"estimated_tokens_saved":900},"created_at":"2026-08-18T15:51:50.460Z","updated_at":"2026-08-20T20:13:09.748Z","author_branch":"release-prep"}
```

