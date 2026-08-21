---
type: "Decision"
title: "trackrecord.ts's computeTrackRecord/confidenceFor (the source of the 8/15, 43/45, 44/57..."
description: "trackrecord.ts's computeTrackRecord/confidenceFor the source of the 8/15, 43/45, 44/57 numbers counts a run as verified first only when claimVerdict claim .passed && .executed — a run with NO claim.json agent died/blocke"
tags: ["delegated-run", "kage-run:investigate-why-chore-type-runs-verify-l-260821-c3b9"]
timestamp: "2026-08-21T17:59:33.006Z"
x-kage-id: "repo:investigate-why-chore-type-runs-verify-l-260821-c3b9:decision:trackrecord-tss-computetrackrecord-confidencefor-the-source-of-the-8-15-43-45-44"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
---

# trackrecord.ts's computeTrackRecord/confidenceFor (the source of the 8/15, 43/45, 44/57...

> trackrecord.ts's computeTrackRecord/confidenceFor the source of the 8/15, 43/45, 44/57 numbers counts a run as verifi…

trackrecord.ts's computeTrackRecord/confidenceFor (the source of the 8/15, 43/45, 44/57 numbers) counts a run as verified_first only when claimVerdict(claim).passed && .executed — a run with NO claim.json (agent died/blocked/stopped before ever producing one) silently contributes 0 to verified_first while still counting in dispatched, so process-death and abandoned-blocked runs look identical in the track record to genuine verification failures.

Learned while delivering: Investigate why chore-type runs verify less reliably than feature/bugfix runs (8/15 vs 43/45 and 44/57) — find the pattern across failed chore claims and report root causes
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-21T17:59:33.006Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:investigate-why-chore-type-runs-verify-l-260821-c3b9:decision:trackrecord-tss-computetrackrecord-confidencefor-the-source-of-the-8-15-43-45-44","title":"trackrecord.ts's computeTrackRecord/confidenceFor (the source of the 8/15, 43/45, 44/57...","summary":"trackrecord.ts's computeTrackRecord/confidenceFor the source of the 8/15, 43/45, 44/57 numbers counts a run as verified first only when claimVerdict claim .passed && .executed — a run with NO claim.json agent died/blocke","body":"trackrecord.ts's computeTrackRecord/confidenceFor (the source of the 8/15, 43/45, 44/57 numbers) counts a run as verified_first only when claimVerdict(claim).passed && .executed — a run with NO claim.json (agent died/blocked/stopped before ever producing one) silently contributes 0 to verified_first while still counting in dispatched, so process-death and abandoned-blocked runs look identical in the track record to genuine verification failures.\n\nLearned while delivering: Investigate why chore-type runs verify less reliably than feature/bugfix runs (8/15 vs 43/45 and 44/57) — find the pattern across failed chore claims and report root causes\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:investigate-why-chore-type-runs-verify-l-260821-c3b9"],"paths":[],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T17:59:33.006Z"}],"context":{"fact":"trackrecord.ts's computeTrackRecord/confidenceFor (the source of the 8/15, 43/45, 44/57 numbers) counts a run as verified_first only when claimVerdict(claim).passed && .executed — a run with NO claim.json (agent died/blocked/stopped before ever producing one) silently contributes 0 to verified_first while still counting in dispatched, so process-death and abandoned-blocked runs look identical in the track record to genuine verification failures.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T17:59:33.006Z","path_fingerprints":[],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":84,"reasons":["high-value memory type","has source evidence","tagged","concise but substantive","actionable rationale or verification"],"risks":["not grounded to paths"],"duplicate_candidates":[],"estimated_tokens_saved":190},"created_at":"2026-08-21T17:59:33.006Z","updated_at":"2026-08-21T19:46:22.893Z","author_branch":"kage/investigate-why-chore-type-runs-verify-l-260821-c3b9"}
```

