---
type: "Decision"
title: "Under that kind of contention, real subprocess/timing-based tests (dispatch-durability'..."
description: "Under that kind of contention, real subprocess/timing based tests dispatch durability's SIGTERM survival test, mcp dispatch detached's detached return test can fail on waitFor timeouts purely from resource starvation — a"
resource: "CHANGELOG.md"
tags: ["delegated-run", "kage-run:prep-release-prep-for-merge-to-master-ve-260821-f142"]
timestamp: "2026-08-21T19:09:02.823Z"
x-kage-id: "repo:prep-release-prep-for-merge-to-master-ve-260821-f142:decision:under-that-kind-of-contention-real-subprocess-timing-based-tests-dispatch-durabi"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["CHANGELOG.md"]
---

# Under that kind of contention, real subprocess/timing-based tests (dispatch-durability'...

> Under that kind of contention, real subprocess/timing based tests dispatch durability's SIGTERM survival test, mcp di…

Under that kind of contention, real subprocess/timing-based tests (dispatch-durability's SIGTERM-survival test, mcp-dispatch-detached's detached-return test) can fail on `waitFor` timeouts purely from resource starvation — a red result on those two specific tests during heavy concurrent load should be re-verified once load clears before treating it as a real regression, consistent with the repo's own 'verify test results before believing them' lesson.

Learned while delivering: Prep release-prep for merge to master: verify CHANGELOG completeness, version lockstep across mcp/shell, and confirm the diff is clean and mergeable — stop short of notarize/publish
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-21T19:09:02.823Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:prep-release-prep-for-merge-to-master-ve-260821-f142:decision:under-that-kind-of-contention-real-subprocess-timing-based-tests-dispatch-durabi","title":"Under that kind of contention, real subprocess/timing-based tests (dispatch-durability'...","summary":"Under that kind of contention, real subprocess/timing based tests dispatch durability's SIGTERM survival test, mcp dispatch detached's detached return test can fail on waitFor timeouts purely from resource starvation — a","body":"Under that kind of contention, real subprocess/timing-based tests (dispatch-durability's SIGTERM-survival test, mcp-dispatch-detached's detached-return test) can fail on `waitFor` timeouts purely from resource starvation — a red result on those two specific tests during heavy concurrent load should be re-verified once load clears before treating it as a real regression, consistent with the repo's own 'verify test results before believing them' lesson.\n\nLearned while delivering: Prep release-prep for merge to master: verify CHANGELOG completeness, version lockstep across mcp/shell, and confirm the diff is clean and mergeable — stop short of notarize/publish\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:prep-release-prep-for-merge-to-master-ve-260821-f142"],"paths":["CHANGELOG.md"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T19:09:02.823Z"}],"context":{"fact":"Under that kind of contention, real subprocess/timing-based tests (dispatch-durability's SIGTERM-survival test, mcp-dispatch-detached's detached-return test) can fail on `waitFor` timeouts purely from resource starvation — a red result on those two specific tests during heavy concurrent load should be re-verified once load clears before treating it as a real regression, consistent with the repo's own 'verify test results before believing them' lesson.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T19:09:02.823Z","path_fingerprints":[{"path":"CHANGELOG.md","sha256":"4ec69525d1d8a0d52d872e387d2e8916670133b2a381dd4e7342683f5e853c48","size":70154}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":194},"created_at":"2026-08-21T19:09:02.823Z","updated_at":"2026-08-21T19:46:22.893Z","author_branch":"kage/prep-release-prep-for-merge-to-master-ve-260821-f142"}
```

