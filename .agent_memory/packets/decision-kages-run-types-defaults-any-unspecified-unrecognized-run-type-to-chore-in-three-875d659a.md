---
type: "Decision"
title: "Kage's RUN_TYPES defaults any unspecified/unrecognized run type to \"chore\" in three pla..."
description: "Kage's RUN TYPES defaults any unspecified/unrecognized run type to \"chore\" in three places goal.ts:106, dispatch.ts:217, api.ts:1691 — chore is partly a catch all bucket, though in the actual .agent memory/runs/ data eve"
tags: ["delegated-run", "kage-run:investigate-why-chore-type-runs-verify-l-260821-c3b9"]
timestamp: "2026-08-21T17:59:32.426Z"
x-kage-id: "repo:investigate-why-chore-type-runs-verify-l-260821-c3b9:decision:kages-run-types-defaults-any-unspecified-unrecognized-run-type-to-chore-in-three"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
---

# Kage's RUN_TYPES defaults any unspecified/unrecognized run type to "chore" in three pla...

> Kage's RUN TYPES defaults any unspecified/unrecognized run type to "chore" in three places goal.ts:106, dispatch.ts:2…

Kage's RUN_TYPES defaults any unspecified/unrecognized run type to "chore" in three places (goal.ts:106, dispatch.ts:217, api.ts:1691) — chore is partly a catch-all bucket, though in the actual .agent_memory/runs/ data every chore run did have an explicit type:"chore", so this default wasn't the driver of the observed failures.

Learned while delivering: Investigate why chore-type runs verify less reliably than feature/bugfix runs (8/15 vs 43/45 and 44/57) — find the pattern across failed chore claims and report root causes
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-21T17:59:32.426Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:investigate-why-chore-type-runs-verify-l-260821-c3b9:decision:kages-run-types-defaults-any-unspecified-unrecognized-run-type-to-chore-in-three","title":"Kage's RUN_TYPES defaults any unspecified/unrecognized run type to \"chore\" in three pla...","summary":"Kage's RUN TYPES defaults any unspecified/unrecognized run type to \"chore\" in three places goal.ts:106, dispatch.ts:217, api.ts:1691 — chore is partly a catch all bucket, though in the actual .agent memory/runs/ data eve","body":"Kage's RUN_TYPES defaults any unspecified/unrecognized run type to \"chore\" in three places (goal.ts:106, dispatch.ts:217, api.ts:1691) — chore is partly a catch-all bucket, though in the actual .agent_memory/runs/ data every chore run did have an explicit type:\"chore\", so this default wasn't the driver of the observed failures.\n\nLearned while delivering: Investigate why chore-type runs verify less reliably than feature/bugfix runs (8/15 vs 43/45 and 44/57) — find the pattern across failed chore claims and report root causes\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:investigate-why-chore-type-runs-verify-l-260821-c3b9"],"paths":[],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T17:59:32.426Z"}],"context":{"fact":"Kage's RUN_TYPES defaults any unspecified/unrecognized run type to \"chore\" in three places (goal.ts:106, dispatch.ts:217, api.ts:1691) — chore is partly a catch-all bucket, though in the actual .agent_memory/runs/ data every chore run did have an explicit type:\"chore\", so this default wasn't the driver of the observed failures.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T17:59:32.426Z","path_fingerprints":[],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":84,"reasons":["high-value memory type","has source evidence","tagged","concise but substantive","actionable rationale or verification"],"risks":["not grounded to paths"],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":160},"created_at":"2026-08-21T17:59:32.426Z","updated_at":"2026-08-21T18:21:09.654Z","author_branch":"kage/investigate-why-chore-type-runs-verify-l-260821-c3b9"}
```

