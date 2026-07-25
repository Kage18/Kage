---
type: "Bug Fix"
title: "Ingestion was blind because the proxy discarded the assistant's prose"
description: "Capture could not decide what was worth saving because the deciding signal was never stored. The proxy kept only {tool, outcome} per tool call and no assistant prose at all, so nothing recorded what the agent expected be"
resource: "mcp/vnext/adapters/anthropic-proxy.ts"
tags: ["session-learning", "proxy", "ingestion", "capture", "frozen-protocol"]
timestamp: "2026-07-25T04:56:04.800Z"
x-kage-id: "repo:memory:bug_fix:ingestion-was-blind-because-the-proxy-discarded-the-assistants-prose-17849553648"
x-kage-type: "bug_fix"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "unverified"
x-kage-paths: ["mcp/vnext/adapters/anthropic-proxy.ts", "mcp/vnext/adapters/gateway.ts", "mcp/vnext/protocol/validate.ts"]
---

# Ingestion was blind because the proxy discarded the assistant's prose

> Capture could not decide what was worth saving because the deciding signal was never stored. The proxy kept only {too…

Capture could not decide what was worth saving because the deciding signal was never stored. The proxy kept only {tool, outcome} per tool call and no assistant prose at all, so nothing recorded what the agent expected before it acted — and a result is only worth remembering when it contradicts an expectation. The prose was already on the wire: the tool-use parser walks the response body and drops the sibling text blocks. parseResponseText now extracts it and captureEvents attaches it as an intent field on each tool_result of that turn, capped at 600 chars, local-only tier. A new event type was not available: the v1 evidence-event enum is a hard-validated frozen wire type, so the intent rides as an additive payload field older consumers ignore. That is also the right home, because the prose before a tool call carries both the reaction to the last result and the expectation for the next. Tool arguments stay excluded.
Evidence: Audited store held 498 tool_result events with no content and zero assistant-prose events. After the change the same path persists an intent string, verified by reading it back from SQLite. The test suite fails in 3 places when the attachment is removed.
Verified by: mcp/vnext/adapters/intent-capture.test.ts, 9 of 9 passing

## Verification

Audited store held 498 tool_result events with no content and zero assistant-prose events. After the change the same path persists an intent string, verified by reading it back from SQLite. The test suite fails in 3 places when the attachment is removed.

# Citations

[1] explicit_capture (2026-07-25T04:56:04.800Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:memory:bug_fix:ingestion-was-blind-because-the-proxy-discarded-the-assistants-prose-17849553648","title":"Ingestion was blind because the proxy discarded the assistant's prose","summary":"Capture could not decide what was worth saving because the deciding signal was never stored. The proxy kept only {tool, outcome} per tool call and no assistant prose at all, so nothing recorded what the agent expected be","body":"Capture could not decide what was worth saving because the deciding signal was never stored. The proxy kept only {tool, outcome} per tool call and no assistant prose at all, so nothing recorded what the agent expected before it acted — and a result is only worth remembering when it contradicts an expectation. The prose was already on the wire: the tool-use parser walks the response body and drops the sibling text blocks. parseResponseText now extracts it and captureEvents attaches it as an intent field on each tool_result of that turn, capped at 600 chars, local-only tier. A new event type was not available: the v1 evidence-event enum is a hard-validated frozen wire type, so the intent rides as an additive payload field older consumers ignore. That is also the right home, because the prose before a tool call carries both the reaction to the last result and the expectation for the next. Tool arguments stay excluded.\nEvidence: Audited store held 498 tool_result events with no content and zero assistant-prose events. After the change the same path persists an intent string, verified by reading it back from SQLite. The test suite fails in 3 places when the attachment is removed.\nVerified by: mcp/vnext/adapters/intent-capture.test.ts, 9 of 9 passing","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","proxy","ingestion","capture","frozen-protocol"],"paths":["mcp/vnext/adapters/anthropic-proxy.ts","mcp/vnext/adapters/gateway.ts","mcp/vnext/protocol/validate.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-07-25T04:56:04.800Z"}],"context":{"fact":"Capture could not decide what was worth saving because the deciding signal was never stored. The proxy kept only {tool, outcome} per tool call and no assistant prose at all, so nothing recorded what the agent expected before it acted — and a result is only worth remembering when it contradicts an expectation. The prose was already on the wire: the tool-use parser walks the response body and drops the sibling text blocks. parseResponseText now extracts it and captureEvents attaches it as an intent field on each tool_result of that turn, capped at 600 chars, local-only tier. A new event type was not available: the v1 evidence-event enum is a hard-validated frozen wire type, so the intent rides as an additive payload field older consumers ignore. That is also the right home, because the prose before a tool call carries both the reaction to the last result and the expectation for the next. Tool arguments stay excluded.\nEvidence: Audited store held 498 tool_result events with no content and zero assistant-prose events. After the change the same path persists an intent string, verified by reading it back from SQLite. The test suite fails in 3 places when the attachment is removed.\nVerified by: mcp/vnext/adapters/intent-capture.test.ts, 9 of 9 passing","verification":"Audited store held 498 tool_result events with no content and zero assistant-prose events. After the change the same path persists an intent string, verified by reading it back from SQLite. The test suite fails in 3 places when the attachment is removed."},"freshness":{"ttl_days":365,"last_verified_at":"2026-07-25T04:56:04.800Z","path_fingerprints":[{"path":"mcp/vnext/adapters/anthropic-proxy.ts","sha256":"30d6fb69adafdda136e8d515958c559ceb2ba03dcf929427c386e40ee1562804","size":22132,"symbols":[{"name":"parseresponsetext","kind":"function","sha256":"8c34c0e90762a03b8ec14e2986a6d249d63096aed1b132623de9bddba02485df"}]},{"path":"mcp/vnext/adapters/gateway.ts","sha256":"b4b97821c0fc3c65fe5bb90b29e7ddf65bbb0381fe24b6565bc5c5b42850263f","size":18258},{"path":"mcp/vnext/protocol/validate.ts","sha256":"8c6b72d088d0b578503ca3213c5dd2c02f480e95a08857fef1d0adf70e82c7f2","size":8903}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":316},"created_at":"2026-07-25T04:56:04.800Z","updated_at":"2026-07-25T04:56:04.800Z","author_branch":"codex/kage-vnext-implementation","author_name":"Kushal Jain"}
```

