---
type: "Bug Fix"
title: "GOAL_LEGAL_TRANSITIONS has no direct planning->done edge, so a read-time reconcile for ..."
description: "GOAL LEGAL TRANSITIONS has no direct planning done edge, so a read time reconcile for a goal stuck in 'planning' with all terminal runs must call transitionGoal twice in sequence planning executing, then executing done t"
resource: "mcp/delegation/goal.ts"
tags: ["delegated-run", "kage-run:goal-state-only-ever-advances-on-a-live-260818-26ab"]
timestamp: "2026-08-18T13:16:19.852Z"
x-kage-id: "repo:goal-state-only-ever-advances-on-a-live-260818-26ab:bug_fix:goal-legal-transitions-has-no-direct-planning-done-edge-so-a-read-time-reconcile"
x-kage-type: "bug_fix"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation/goal.ts", "mcp/goal-reconcile.test.ts"]
---

# GOAL_LEGAL_TRANSITIONS has no direct planning->done edge, so a read-time reconcile for ...

> GOAL LEGAL TRANSITIONS has no direct planning done edge, so a read time reconcile for a goal stuck in 'planning' with…

GOAL_LEGAL_TRANSITIONS has no direct planning->done edge, so a read-time reconcile for a goal stuck in 'planning' with all-terminal runs must call transitionGoal twice in sequence (planning->executing, then executing->done) to stay inside the same legality table runs already use, rather than writing the state field directly.

Learned while delivering: Goal state only ever advances on a LIVE transition, so any goal whose runs finished before the hook existed is stuck forever. Make goal state reconcile on read.

MEASURED on this repo right now: two real goals sit in state 'planning' while EVERY run they own is terminal.
- harden-the-delegation-loop-... : runs are rejected, merged — all terminal — state 'planning'.
- harden-the-verification-loop-... : runs are rejected, rejected, rejected — all terminal — state 'planning'.
The app renders both as 'planning' with a wave line reading 'wave 1 of 1', which is simply false to the user.

CAUSE: syncGoalCompletion (mcp/delegation/goal.ts:250) has exactly ONE caller — the onRunTransition hook at goal.ts:268. That hook fires only when a run transitions from now on. Goals whose runs reached a terminal state before the hook existed are never revisited, and nothing derives state on read. Anyone upgrading to this version keeps permanently stuck goals.

This is the repo's own law being broken. contract.ts already establishes 'derive display; persist death' for RUNS — liveState/displayState derive a run's truth at read time rather than trusting whatever was last written. Goals must follow the same law.

WHAT TO BUILD in mcp/delegation/goal.ts:
1. Reconcile a goal's state when it is READ, not only when a run transitions. readGoal and listGoals should, for a goal in 'planning' or 'executing', derive the state its runs actually imply and persist it if it differs: any attached run at all means at least 'executing'; every attached run terminal (merged/rejected/failed) with no unstarted run specs left means 'done'. Reuse syncGoalCompletion's existing logic rather than writing a second copy of the rule — a second copy is how these two ended up disagreeing in the first place.
2. Keep it cheap and safe: reading a goal must not become expensive, must be idempotent, and must never move a goal OUT of a terminal state (done/abandoned are final — never resurrect an abandoned goal because a late run changed).
3. Leave the onRunTransition hook in place. Read-time reconcile is the safety net for history and for any path that mutates a run without going through transitionRun; the hook remains the fast path.

HOW YOU'LL KNOW IT WORKED — new tests, and note the repo convention: put them in a NEW file mcp/goal-reconcile.test.ts, NOT mcp/delegation.test.ts (that file is an append-collision hotspot; three merges collided in it in one day). Cover:
(a) a goal written directly to disk in 'planning' with all-terminal runs reads back as 'done' — this is the exact production bug, and it must FAIL without your change (say in your claim which test that is);
(b) a goal with one still-running run reads back 'executing', not 'done';
(c) an 'abandoned' goal with all-terminal runs stays 'abandoned';
(d) reconcile is idempotent — reading twice does not thrash the record or rewrite it a second time;
(e) a goal with no attached runs stays 'planning'.

CONSTRAINTS: CommonJS — no 'import.meta' (TS1470), no top-level await. Change mcp/delegation/goal.ts and your new test file only. Do NOT touch mcp/index.ts or mcp/delegation/brief.ts — other runs are editing those right now.
VERIFY: 'npm run test --prefix mcp' (667 green before your change — use the 'npm run test' form) and 'npm run build --prefix mcp' with no 'error TS'. You CAN run commands. Run them, and fill in the claim fence — a run without one lands with no account of what it did.
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-18T13:16:19.852Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:goal-state-only-ever-advances-on-a-live-260818-26ab:bug_fix:goal-legal-transitions-has-no-direct-planning-done-edge-so-a-read-time-reconcile","title":"GOAL_LEGAL_TRANSITIONS has no direct planning->done edge, so a read-time reconcile for ...","summary":"GOAL LEGAL TRANSITIONS has no direct planning done edge, so a read time reconcile for a goal stuck in 'planning' with all terminal runs must call transitionGoal twice in sequence planning executing, then executing done t","body":"GOAL_LEGAL_TRANSITIONS has no direct planning->done edge, so a read-time reconcile for a goal stuck in 'planning' with all-terminal runs must call transitionGoal twice in sequence (planning->executing, then executing->done) to stay inside the same legality table runs already use, rather than writing the state field directly.\n\nLearned while delivering: Goal state only ever advances on a LIVE transition, so any goal whose runs finished before the hook existed is stuck forever. Make goal state reconcile on read.\n\nMEASURED on this repo right now: two real goals sit in state 'planning' while EVERY run they own is terminal.\n- harden-the-delegation-loop-... : runs are rejected, merged — all terminal — state 'planning'.\n- harden-the-verification-loop-... : runs are rejected, rejected, rejected — all terminal — state 'planning'.\nThe app renders both as 'planning' with a wave line reading 'wave 1 of 1', which is simply false to the user.\n\nCAUSE: syncGoalCompletion (mcp/delegation/goal.ts:250) has exactly ONE caller — the onRunTransition hook at goal.ts:268. That hook fires only when a run transitions from now on. Goals whose runs reached a terminal state before the hook existed are never revisited, and nothing derives state on read. Anyone upgrading to this version keeps permanently stuck goals.\n\nThis is the repo's own law being broken. contract.ts already establishes 'derive display; persist death' for RUNS — liveState/displayState derive a run's truth at read time rather than trusting whatever was last written. Goals must follow the same law.\n\nWHAT TO BUILD in mcp/delegation/goal.ts:\n1. Reconcile a goal's state when it is READ, not only when a run transitions. readGoal and listGoals should, for a goal in 'planning' or 'executing', derive the state its runs actually imply and persist it if it differs: any attached run at all means at least 'executing'; every attached run terminal (merged/rejected/failed) with no unstarted run specs left means 'done'. Reuse syncGoalCompletion's existing logic rather than writing a second copy of the rule — a second copy is how these two ended up disagreeing in the first place.\n2. Keep it cheap and safe: reading a goal must not become expensive, must be idempotent, and must never move a goal OUT of a terminal state (done/abandoned are final — never resurrect an abandoned goal because a late run changed).\n3. Leave the onRunTransition hook in place. Read-time reconcile is the safety net for history and for any path that mutates a run without going through transitionRun; the hook remains the fast path.\n\nHOW YOU'LL KNOW IT WORKED — new tests, and note the repo convention: put them in a NEW file mcp/goal-reconcile.test.ts, NOT mcp/delegation.test.ts (that file is an append-collision hotspot; three merges collided in it in one day). Cover:\n(a) a goal written directly to disk in 'planning' with all-terminal runs reads back as 'done' — this is the exact production bug, and it must FAIL without your change (say in your claim which test that is);\n(b) a goal with one still-running run reads back 'executing', not 'done';\n(c) an 'abandoned' goal with all-terminal runs stays 'abandoned';\n(d) reconcile is idempotent — reading twice does not thrash the record or rewrite it a second time;\n(e) a goal with no attached runs stays 'planning'.\n\nCONSTRAINTS: CommonJS — no 'import.meta' (TS1470), no top-level await. Change mcp/delegation/goal.ts and your new test file only. Do NOT touch mcp/index.ts or mcp/delegation/brief.ts — other runs are editing those right now.\nVERIFY: 'npm run test --prefix mcp' (667 green before your change — use the 'npm run test' form) and 'npm run build --prefix mcp' with no 'error TS'. You CAN run commands. Run them, and fill in the claim fence — a run without one lands with no account of what it did.\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:goal-state-only-ever-advances-on-a-live-260818-26ab"],"paths":["mcp/delegation/goal.ts","mcp/goal-reconcile.test.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-18T13:16:19.852Z"}],"context":{"fact":"GOAL_LEGAL_TRANSITIONS has no direct planning->done edge, so a read-time reconcile for a goal stuck in 'planning' with all-terminal runs must call transitionGoal twice in sequence (planning->executing, then executing->done) to stay inside the same legality table runs already use, rather than writing the state field directly.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-18T13:16:19.852Z","path_fingerprints":[{"path":"mcp/delegation/goal.ts","sha256":"47dc9a862ddb5776206fe5f76da0626a0c3d2a05ae87911b875dbbadd957412e","size":21396,"symbols":[{"name":"goal_legal_transitions","kind":"constant","sha256":"634c5bc7217813257c802cec330e9f0aa06931c80d460bdbc43e98ab2218a7df"},{"name":"goals","kind":"constant","sha256":"438d387073074a728f78a584c51854213992e9cc5ac659471b11d1326221ba21"},{"name":"readgoal","kind":"function","sha256":"3031d608537d2551ca358d4896e481bbd41bfd30ed20fdca317fa6fa92e455b7"},{"name":"listgoals","kind":"function","sha256":"4a1cec3d143723d034df9f3da76a8a88146839d06b349835df6a76c556f10263"},{"name":"transitiongoal","kind":"function","sha256":"a67b4ca427620dcd52d533e37de7af8eb42d7b0f5c45cc17dd582dbdeda009ad"},{"name":"index","kind":"constant","sha256":"a00c8f2782fe63374e5bc56446b6a60a11a3b07cea1b563c52422be567743ee1"},{"name":"syncgoalcompletion","kind":"function","sha256":"84535eba3d0af98f8c093eb6168d41b333bcb1ba7559ad109221c04d3e58421b"},{"name":"runs","kind":"constant","sha256":"c445e52c47bf68f549b78168c45b08b474b504269ba4b250837eb48b1813bc7a"},{"name":"wave","kind":"constant","sha256":"97cb9553747c0b5c608b5b92c52a8e1735774beb632ab54daf8ddc1829360e6a"},{"name":"record","kind":"constant","sha256":"32f1fee1b5aa7f58cad9ebc075dd1965459cc31a61c88d2497c8d67ed42b8b4c"}]},{"path":"mcp/goal-reconcile.test.ts","sha256":"1f38e48aa46184163750be936752da645afec4356b17a8e126bb387b231440ea","size":6773,"symbols":[{"name":"first","kind":"constant","sha256":"264bf07b2bf175c74902a5f5f007726348239df3eff197d2c45925fe7967e738"},{"name":"second","kind":"constant","sha256":"8e032b7d974d5ba25bed6673a7d2e785b1a8f91f4a13b19ea95702ec554b6276"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":94,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":977,"unresolved_symbols":["noEmit"]},"created_at":"2026-08-18T13:16:19.852Z","updated_at":"2026-08-18T13:16:51.605Z","author_branch":"kage/goal-state-only-ever-advances-on-a-live-260818-26ab"}
```

