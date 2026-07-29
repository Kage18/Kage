---
type: "Decision"
title: "Each agent session gets its own proxy, because the proxy session id is per-process"
description: "The desktop app starts a DEDICATED kage proxy per agent session rather than sharing one. Reason: mcp/proxy.ts:284 generates 'const sessionId = proxy ${randomUUID }' once per proxy PROCESS its own comment calls it 'a stab"
resource: "mcp/proxy.ts"
tags: ["session-learning", "desktop", "proxy", "correlation"]
timestamp: "2026-07-29T07:33:15.767Z"
x-kage-id: "repo:https-github-com-kage-core-kage:decision:each-agent-session-gets-its-own-proxy-because-the-proxy-session-id-is-per-proces"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "unverified"
x-kage-paths: ["mcp/proxy.ts", "platform/desktop/src/main.ts", "mcp/vnext/desktop/session.ts"]
---

# Each agent session gets its own proxy, because the proxy session id is per-process

> The desktop app starts a DEDICATED kage proxy per agent session rather than sharing one. Reason: mcp/proxy.ts:284 gen…

The desktop app starts a DEDICATED kage proxy per agent session rather than sharing one. Reason: mcp/proxy.ts:284 generates 'const sessionId = proxy-${randomUUID()}' once per proxy PROCESS (its own comment calls it 'a stable per-process id'), not per HTTP request. So one proxy process == one session, and every receipt or observation it records belongs to that session BY CONSTRUCTION. Sharing a proxy across sessions would leave only timestamp proximity to attribute recalls by, and the correlation ladder already refuses to move a stage on timing alone — smuggling a timing-based link into the run strip would break the same rule from a different direction. Cost is one short-lived proxy process per running agent, which the app supervises and reaps on session exit and on quit.
Evidence: mcp/proxy.ts:284 sessionId is created before createServer, outside the per-request handler; platform/desktop/src/main.ts startSession allocates a port from SESSION_PORT_BASE and spawns 'cli.js proxy --port <p> --mode assist' per session
Verified by: Claude Opus 5, 2026-07-29

## Verification

mcp/proxy.ts:284 sessionId is created before createServer, outside the per-request handler; platform/desktop/src/main.ts startSession allocates a port from SESSION_PORT_BASE and spawns 'cli.js proxy --port <p> --mode assist' per session

# Citations

[1] explicit_capture (2026-07-29T07:33:15.767Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:decision:each-agent-session-gets-its-own-proxy-because-the-proxy-session-id-is-per-proces","title":"Each agent session gets its own proxy, because the proxy session id is per-process","summary":"The desktop app starts a DEDICATED kage proxy per agent session rather than sharing one. Reason: mcp/proxy.ts:284 generates 'const sessionId = proxy ${randomUUID }' once per proxy PROCESS its own comment calls it 'a stab","body":"The desktop app starts a DEDICATED kage proxy per agent session rather than sharing one. Reason: mcp/proxy.ts:284 generates 'const sessionId = proxy-${randomUUID()}' once per proxy PROCESS (its own comment calls it 'a stable per-process id'), not per HTTP request. So one proxy process == one session, and every receipt or observation it records belongs to that session BY CONSTRUCTION. Sharing a proxy across sessions would leave only timestamp proximity to attribute recalls by, and the correlation ladder already refuses to move a stage on timing alone — smuggling a timing-based link into the run strip would break the same rule from a different direction. Cost is one short-lived proxy process per running agent, which the app supervises and reaps on session exit and on quit.\nEvidence: mcp/proxy.ts:284 sessionId is created before createServer, outside the per-request handler; platform/desktop/src/main.ts startSession allocates a port from SESSION_PORT_BASE and spawns 'cli.js proxy --port <p> --mode assist' per session\nVerified by: Claude Opus 5, 2026-07-29","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","desktop","proxy","correlation"],"paths":["mcp/proxy.ts","platform/desktop/src/main.ts","mcp/vnext/desktop/session.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-07-29T07:33:15.767Z"}],"context":{"fact":"The desktop app starts a DEDICATED kage proxy per agent session rather than sharing one. Reason: mcp/proxy.ts:284 generates 'const sessionId = proxy-${randomUUID()}' once per proxy PROCESS (its own comment calls it 'a stable per-process id'), not per HTTP request. So one proxy process == one session, and every receipt or observation it records belongs to that session BY CONSTRUCTION. Sharing a proxy across sessions would leave only timestamp proximity to attribute recalls by, and the correlation ladder already refuses to move a stage on timing alone — smuggling a timing-based link into the run strip would break the same rule from a different direction. Cost is one short-lived proxy process per running agent, which the app supervises and reaps on session exit and on quit.\nEvidence: mcp/proxy.ts:284 sessionId is created before createServer, outside the per-request handler; platform/desktop/src/main.ts startSession allocates a port from SESSION_PORT_BASE and spawns 'cli.js proxy --port <p> --mode assist' per session\nVerified by: Claude Opus 5, 2026-07-29","verification":"mcp/proxy.ts:284 sessionId is created before createServer, outside the per-request handler; platform/desktop/src/main.ts startSession allocates a port from SESSION_PORT_BASE and spawns 'cli.js proxy --port <p> --mode assist' per session"},"freshness":{"ttl_days":365,"last_verified_at":"2026-07-29T07:33:15.767Z","path_fingerprints":[{"path":"mcp/proxy.ts","sha256":"8441a5584427fc48bc1c442c49a33702e725622fa1b8b3c7c4f766874057a47c","size":36517,"symbols":[{"name":"sessionid","kind":"constant","sha256":"5c0c97961be1e0e027d37364cba61c72d9c297d87120c1cecf3e738b7506b4db"}]},{"path":"platform/desktop/src/main.ts","sha256":"8b0fd301199199a1aa98ba18393d8cb2703f0c4ee98548c4294c7dc2f1f1640d","size":24196,"symbols":[{"name":"session_port_base","kind":"constant","sha256":"d4cf99221f07ffcc7e26070f67c55ff8c652dfe499fdd639f4b34f2a10be6411"},{"name":"startsession","kind":"function","sha256":"f7142b3fb7b5d0c83040f0ccf4483834cc66308e86ce99c07cb8cfa9c0183f28"},{"name":"sessionid","kind":"constant","sha256":"74dd5c44af89ea5d7f8a08b5295020da831894387958c4b0a3b630f74f0fdfec"}]},{"path":"mcp/vnext/desktop/session.ts","sha256":"f7764943090f6ad4ac0a25906b1a23773408aa0eadd07f23f63f1882fcd50d62","size":7588}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":267},"created_at":"2026-07-29T07:33:15.767Z","updated_at":"2026-07-29T07:33:15.767Z","author_branch":"fix/foreign-proxy-build","author_name":"Kushal Jain"}
```

