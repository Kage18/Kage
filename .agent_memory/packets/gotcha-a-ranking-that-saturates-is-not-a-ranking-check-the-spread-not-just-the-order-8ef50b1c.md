---
type: "Gotcha"
title: "A ranking that saturates is not a ranking — check the spread, not just the order"
description: "The attention queue's severity was meant to be cost of delay but used a flat constant per kind, so the landing page showed ten identical '55's. The fix scales severity by how often a stale claim is STILL being recalled a"
resource: "mcp/vnext/orchestrator/attention.ts"
tags: ["session-learning"]
timestamp: "2026-07-28T12:22:41.860Z"
x-kage-id: "repo:https-github-com-kage-core-kage:gotcha:a-ranking-that-saturates-is-not-a-ranking-check-the-spread-not-just-the-order-17"
x-kage-type: "gotcha"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "unverified"
x-kage-paths: ["mcp/vnext/orchestrator/attention.ts", "mcp/vnext/orchestrator/attention.test.ts"]
---

# A ranking that saturates is not a ranking — check the spread, not just the order

> The attention queue's severity was meant to be cost of delay but used a flat constant per kind, so the landing page s…

The attention queue's severity was meant to be cost-of-delay but used a flat constant per kind, so the landing page showed ten identical '55's. The fix scales severity by how often a stale claim is STILL being recalled (a stale claim served 20x a month is actively causing rework; one nobody reads is merely untidy). The first attempt at the weighting multiplied uses by 3 and capped at 30, which saturated at 10 recalls — and on the real distribution (20 down to 0) that flattened the top EIGHT items and reproduced the exact tie it was written to fix. Scale against the top of a plausible range, and assert the SPREAD of distinct values in the test, not only the ordering: an ordering assertion passes happily on a saturated scale.
Evidence: Live /v2/attention went from ten items all at severity 55 to a range of 85 down to 67 ordered by uses_30d; the guard in attention.test.ts asserts distinct severity values across a realistic usage distribution.
Verified by: measured on the Kage repo store, 2026-07-28

## Verification

Live /v2/attention went from ten items all at severity 55 to a range of 85 down to 67 ordered by uses_30d; the guard in attention.test.ts asserts distinct severity values across a realistic usage distribution.

# Citations

[1] explicit_capture (2026-07-28T12:22:41.860Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:gotcha:a-ranking-that-saturates-is-not-a-ranking-check-the-spread-not-just-the-order-17","title":"A ranking that saturates is not a ranking — check the spread, not just the order","summary":"The attention queue's severity was meant to be cost of delay but used a flat constant per kind, so the landing page showed ten identical '55's. The fix scales severity by how often a stale claim is STILL being recalled a","body":"The attention queue's severity was meant to be cost-of-delay but used a flat constant per kind, so the landing page showed ten identical '55's. The fix scales severity by how often a stale claim is STILL being recalled (a stale claim served 20x a month is actively causing rework; one nobody reads is merely untidy). The first attempt at the weighting multiplied uses by 3 and capped at 30, which saturated at 10 recalls — and on the real distribution (20 down to 0) that flattened the top EIGHT items and reproduced the exact tie it was written to fix. Scale against the top of a plausible range, and assert the SPREAD of distinct values in the test, not only the ordering: an ordering assertion passes happily on a saturated scale.\nEvidence: Live /v2/attention went from ten items all at severity 55 to a range of 85 down to 67 ordered by uses_30d; the guard in attention.test.ts asserts distinct severity values across a realistic usage distribution.\nVerified by: measured on the Kage repo store, 2026-07-28","type":"gotcha","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning"],"paths":["mcp/vnext/orchestrator/attention.ts","mcp/vnext/orchestrator/attention.test.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-07-28T12:22:41.860Z"}],"context":{"fact":"The attention queue's severity was meant to be cost-of-delay but used a flat constant per kind, so the landing page showed ten identical '55's. The fix scales severity by how often a stale claim is STILL being recalled (a stale claim served 20x a month is actively causing rework; one nobody reads is merely untidy). The first attempt at the weighting multiplied uses by 3 and capped at 30, which saturated at 10 recalls — and on the real distribution (20 down to 0) that flattened the top EIGHT items and reproduced the exact tie it was written to fix. Scale against the top of a plausible range, and assert the SPREAD of distinct values in the test, not only the ordering: an ordering assertion passes happily on a saturated scale.\nEvidence: Live /v2/attention went from ten items all at severity 55 to a range of 85 down to 67 ordered by uses_30d; the guard in attention.test.ts asserts distinct severity values across a realistic usage distribution.\nVerified by: measured on the Kage repo store, 2026-07-28","verification":"Live /v2/attention went from ten items all at severity 55 to a range of 85 down to 67 ordered by uses_30d; the guard in attention.test.ts asserts distinct severity values across a realistic usage distribution."},"freshness":{"ttl_days":365,"last_verified_at":"2026-07-28T12:22:41.860Z","path_fingerprints":[{"path":"mcp/vnext/orchestrator/attention.ts","sha256":"c36a3ea29362edbe83125d6c6827826dfdad230f9ffe81803aee70c653dea303","size":9402},{"path":"mcp/vnext/orchestrator/attention.test.ts","sha256":"106eaf2cb9870a150f4593ea9d2651b262e92a7437f6ff6c6bd1f74e0bace2d5","size":8149}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":253,"total_uses":0},"created_at":"2026-07-28T12:22:41.860Z","updated_at":"2026-07-28T12:22:41.860Z","author_branch":"reform/p0-truth","author_name":"Kushal Jain"}
```

