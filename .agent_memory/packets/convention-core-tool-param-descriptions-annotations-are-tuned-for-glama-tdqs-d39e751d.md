---
type: "Convention"
title: "Core tool param descriptions + annotations are tuned for Glama TDQS"
description: "The 11 CORE TOOLS in mcp/index.ts deliberately carry a full 'description' on every inputSchema parameter and an MCP 'annotations' block title + readOnlyHint, plus destructiveHint/idempotentHint for writers like kage supe"
resource: "mcp/index.ts"
tags: ["session-learning"]
timestamp: "2026-08-20T12:41:50.657Z"
x-kage-id: "repo:https-github-com-kage-core-kage:convention:core-tool-param-descriptions-annotations-are-tuned-for-glama-tdqs-1781851892395"
x-kage-type: "convention"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/index.ts"]
---

# Core tool param descriptions + annotations are tuned for Glama TDQS

> The 11 CORE TOOLS in mcp/index.ts deliberately carry a full 'description' on every inputSchema parameter and an MCP '…

The 11 CORE_TOOLS in mcp/index.ts deliberately carry a full 'description' on every inputSchema parameter and an MCP 'annotations' block (title + readOnlyHint, plus destructiveHint/idempotentHint for writers like kage_supersede/kage_refresh/kage_skills/kage_learn/kage_feedback). This is not incidental: Glama's Tool Definition Quality score penalized the Parameters dimension (1/5 at 0% schema description coverage) and Behavior (no annotations). Do not strip param descriptions or annotations when editing these tool defs; they raise TDQS toward A. The score only reflects the PUBLISHED npm version, so changes need a republish to count.
Verified by: Glama Tool Definition Quality eval + listTools() runtime check (11 tools, 0 params missing descriptions)

## Verification

Glama Tool Definition Quality eval + listTools() runtime check (11 tools, 0 params missing descriptions)

# Citations

[1] explicit_capture (2026-06-19T06:51:32.395Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:convention:core-tool-param-descriptions-annotations-are-tuned-for-glama-tdqs-1781851892395","title":"Core tool param descriptions + annotations are tuned for Glama TDQS","summary":"The 11 CORE TOOLS in mcp/index.ts deliberately carry a full 'description' on every inputSchema parameter and an MCP 'annotations' block title + readOnlyHint, plus destructiveHint/idempotentHint for writers like kage supe","body":"The 11 CORE_TOOLS in mcp/index.ts deliberately carry a full 'description' on every inputSchema parameter and an MCP 'annotations' block (title + readOnlyHint, plus destructiveHint/idempotentHint for writers like kage_supersede/kage_refresh/kage_skills/kage_learn/kage_feedback). This is not incidental: Glama's Tool Definition Quality score penalized the Parameters dimension (1/5 at 0% schema description coverage) and Behavior (no annotations). Do not strip param descriptions or annotations when editing these tool defs; they raise TDQS toward A. The score only reflects the PUBLISHED npm version, so changes need a republish to count.\nVerified by: Glama Tool Definition Quality eval + listTools() runtime check (11 tools, 0 params missing descriptions)","type":"convention","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning"],"paths":["mcp/index.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-06-19T06:51:32.395Z"}],"context":{"fact":"The 11 CORE_TOOLS in mcp/index.ts deliberately carry a full 'description' on every inputSchema parameter and an MCP 'annotations' block (title + readOnlyHint, plus destructiveHint/idempotentHint for writers like kage_supersede/kage_refresh/kage_skills/kage_learn/kage_feedback). This is not incidental: Glama's Tool Definition Quality score penalized the Parameters dimension (1/5 at 0% schema description coverage) and Behavior (no annotations). Do not strip param descriptions or annotations when editing these tool defs; they raise TDQS toward A. The score only reflects the PUBLISHED npm version, so changes need a republish to count.\nVerified by: Glama Tool Definition Quality eval + listTools() runtime check (11 tools, 0 params missing descriptions)","verification":"Glama Tool Definition Quality eval + listTools() runtime check (11 tools, 0 params missing descriptions)"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-20T12:41:50.657Z","path_fingerprints":[{"path":"mcp/index.ts","sha256":"f80f9daf9344e2af38406cf87511e98e607aad415d08f61b30304e7440f283f4","size":109859,"symbols":[{"name":"score","kind":"constant","sha256":"70eda26cd548161422088eab86708387757c1c6de54f8eedf58911a554a9674b"},{"name":"title","kind":"constant","sha256":"2525473c56fbfa0baf52ddeea7b69da7a44ee01acccee74c36022c0b71cfeabe"},{"name":"core_tools","kind":"constant","sha256":"b43c87d958b8b11a31fffc9dd75340a10f6eefb84b3d6fd374d3abbab35724c1"},{"name":"listtools","kind":"function","sha256":"683f3a291467792dab962e56f2c4ee558bf5e794f8af0fa74c19bb337a406500"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":2000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":189,"reverified_at":"2026-08-20T12:41:50.657Z"},"created_at":"2026-06-19T06:51:32.395Z","updated_at":"2026-08-20T12:41:50.657Z","author_branch":"master"}
```

