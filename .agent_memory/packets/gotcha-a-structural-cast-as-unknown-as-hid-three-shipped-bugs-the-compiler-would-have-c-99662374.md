---
type: "Gotcha"
title: "A structural cast (as unknown as) hid three shipped bugs the compiler would have caught"
description: "The attention loader read the lifecycle report through a hand written 'as unknown as { items?: Array<{ id, health, reasons? } }'. That assertion invented a shape the report does not have — the real fields are packet id a"
resource: "mcp/vnext/orchestrator/attention.ts"
tags: ["session-learning"]
timestamp: "2026-07-28T12:22:41.415Z"
x-kage-id: "repo:https-github-com-kage-core-kage:gotcha:a-structural-cast-as-unknown-as-hid-three-shipped-bugs-the-compiler-would-have-c"
x-kage-type: "gotcha"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "unverified"
x-kage-paths: ["mcp/vnext/orchestrator/attention.ts"]
---

# A structural cast (as unknown as) hid three shipped bugs the compiler would have caught

> The attention loader read the lifecycle report through a hand written 'as unknown as { items?: Array<{ id, health, re…

The attention loader read the lifecycle report through a hand-written 'as unknown as { items?: Array<{ id, health, reasons? }> }'. That assertion invented a shape the report does not have — the real fields are packet_id and stale_reasons — and it stopped TypeScript from ever checking. Three bugs shipped behind it: every stale row had NO ref (unactionable in the UI, and every row shared the same React key), the reason never populated so rows only restated 'stale', and nothing surfaced any of it because undefined renders as empty. The fix was to delete the cast and use the kernel's real exported type, which makes the compiler the guard. Rule for this repo: when reading another module's return value, import its type. A structural cast at a module boundary is not a convenience, it is a hole punched in the only checker you have.
Evidence: Live /v2/attention before the fix returned items with the ref key entirely absent from the JSON and every summary ending in bare '— stale'; after, refs are packet ids and reasons read 'linked path changed since memory was verified: mcp/proxy.ts'.
Verified by: observed on live /v2/attention output, 2026-07-28

## Verification

Live /v2/attention before the fix returned items with the ref key entirely absent from the JSON and every summary ending in bare '— stale'; after, refs are packet ids and reasons read 'linked path changed since memory was verified: mcp/proxy.ts'.

# Citations

[1] explicit_capture (2026-07-28T12:22:41.415Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:gotcha:a-structural-cast-as-unknown-as-hid-three-shipped-bugs-the-compiler-would-have-c","title":"A structural cast (as unknown as) hid three shipped bugs the compiler would have caught","summary":"The attention loader read the lifecycle report through a hand written 'as unknown as { items?: Array<{ id, health, reasons? } }'. That assertion invented a shape the report does not have — the real fields are packet id a","body":"The attention loader read the lifecycle report through a hand-written 'as unknown as { items?: Array<{ id, health, reasons? }> }'. That assertion invented a shape the report does not have — the real fields are packet_id and stale_reasons — and it stopped TypeScript from ever checking. Three bugs shipped behind it: every stale row had NO ref (unactionable in the UI, and every row shared the same React key), the reason never populated so rows only restated 'stale', and nothing surfaced any of it because undefined renders as empty. The fix was to delete the cast and use the kernel's real exported type, which makes the compiler the guard. Rule for this repo: when reading another module's return value, import its type. A structural cast at a module boundary is not a convenience, it is a hole punched in the only checker you have.\nEvidence: Live /v2/attention before the fix returned items with the ref key entirely absent from the JSON and every summary ending in bare '— stale'; after, refs are packet ids and reasons read 'linked path changed since memory was verified: mcp/proxy.ts'.\nVerified by: observed on live /v2/attention output, 2026-07-28","type":"gotcha","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning"],"paths":["mcp/vnext/orchestrator/attention.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-07-28T12:22:41.415Z"}],"context":{"fact":"The attention loader read the lifecycle report through a hand-written 'as unknown as { items?: Array<{ id, health, reasons? }> }'. That assertion invented a shape the report does not have — the real fields are packet_id and stale_reasons — and it stopped TypeScript from ever checking. Three bugs shipped behind it: every stale row had NO ref (unactionable in the UI, and every row shared the same React key), the reason never populated so rows only restated 'stale', and nothing surfaced any of it because undefined renders as empty. The fix was to delete the cast and use the kernel's real exported type, which makes the compiler the guard. Rule for this repo: when reading another module's return value, import its type. A structural cast at a module boundary is not a convenience, it is a hole punched in the only checker you have.\nEvidence: Live /v2/attention before the fix returned items with the ref key entirely absent from the JSON and every summary ending in bare '— stale'; after, refs are packet ids and reasons read 'linked path changed since memory was verified: mcp/proxy.ts'.\nVerified by: observed on live /v2/attention output, 2026-07-28","verification":"Live /v2/attention before the fix returned items with the ref key entirely absent from the JSON and every summary ending in bare '— stale'; after, refs are packet ids and reasons read 'linked path changed since memory was verified: mcp/proxy.ts'."},"freshness":{"ttl_days":365,"last_verified_at":"2026-07-28T12:22:41.415Z","path_fingerprints":[{"path":"mcp/vnext/orchestrator/attention.ts","sha256":"c36a3ea29362edbe83125d6c6827826dfdad230f9ffe81803aee70c653dea303","size":9402}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":289},"created_at":"2026-07-28T12:22:41.415Z","updated_at":"2026-07-28T12:22:41.415Z","author_branch":"reform/p0-truth","author_name":"Kushal Jain"}
```

