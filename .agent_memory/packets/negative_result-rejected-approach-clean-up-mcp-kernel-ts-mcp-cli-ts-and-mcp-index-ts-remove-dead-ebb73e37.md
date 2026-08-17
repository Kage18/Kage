---
type: "Negative Result"
title: "Rejected approach: Clean up mcp/kernel.ts, mcp/cli.ts, and mcp/index.ts: remove dead code,"
description: "A delegated attempt at \"Clean up mcp/kernel.ts, mcp/cli.ts, and mcp/index.ts: remove dead code, reduce duplication, improve structure. No behavior changes — keep public function signatures and CLI/MCP tool contracts iden"
tags: ["delegated-run", "rejected", "kage-run:clean-up-mcp-kernel-ts-mcp-cli-ts-and-mc-260812-3e61"]
timestamp: "2026-08-17T18:21:11.839Z"
x-kage-id: "repo:https-github-com-kage-core-kage:negative_result:rejected-approach-clean-up-mcp-kernel-ts-mcp-cli-ts-and-mcp-index-ts-remove-dead"
x-kage-type: "negative_result"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
---

# Rejected approach: Clean up mcp/kernel.ts, mcp/cli.ts, and mcp/index.ts: remove dead code,

> A delegated attempt at "Clean up mcp/kernel.ts, mcp/cli.ts, and mcp/index.ts: remove dead code, reduce duplication, i…

A delegated attempt at "Clean up mcp/kernel.ts, mcp/cli.ts, and mcp/index.ts: remove dead code, reduce duplication, improve structure. No behavior changes — keep public function signatures and CLI/MCP-tool contracts identical." was rejected.

Reason: Base is 32 commits stale and kernel.ts/cli.ts/index.ts were restructured underneath it (kernel facade split); its edits sit uncommitted on a 5-day-old tree. Redispatching the same cleanup intent on current HEAD instead of merging stale work.

Claimed: mcp/kernel.ts, mcp/cli.ts, and mcp/index.ts had their dead code (2 unused imports, 1 fully dead export) and duplicated logic (3x repeated sync-result handling, repeated warnings-formatting, a double-computed scorecard markdown, a redundant filePathHints call, redundant isError:false) removed with no change to any public function signature or CLI/MCP-tool contract.
Branch kept for inspection: kage/clean-up-mcp-kernel-ts-mcp-cli-ts-and-mc-260812-3e61

# Citations

[1] explicit_capture (2026-08-17T18:21:11.839Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:negative_result:rejected-approach-clean-up-mcp-kernel-ts-mcp-cli-ts-and-mcp-index-ts-remove-dead","title":"Rejected approach: Clean up mcp/kernel.ts, mcp/cli.ts, and mcp/index.ts: remove dead code,","summary":"A delegated attempt at \"Clean up mcp/kernel.ts, mcp/cli.ts, and mcp/index.ts: remove dead code, reduce duplication, improve structure. No behavior changes — keep public function signatures and CLI/MCP tool contracts iden","body":"A delegated attempt at \"Clean up mcp/kernel.ts, mcp/cli.ts, and mcp/index.ts: remove dead code, reduce duplication, improve structure. No behavior changes — keep public function signatures and CLI/MCP-tool contracts identical.\" was rejected.\n\nReason: Base is 32 commits stale and kernel.ts/cli.ts/index.ts were restructured underneath it (kernel facade split); its edits sit uncommitted on a 5-day-old tree. Redispatching the same cleanup intent on current HEAD instead of merging stale work.\n\nClaimed: mcp/kernel.ts, mcp/cli.ts, and mcp/index.ts had their dead code (2 unused imports, 1 fully dead export) and duplicated logic (3x repeated sync-result handling, repeated warnings-formatting, a double-computed scorecard markdown, a redundant filePathHints call, redundant isError:false) removed with no change to any public function signature or CLI/MCP-tool contract.\nBranch kept for inspection: kage/clean-up-mcp-kernel-ts-mcp-cli-ts-and-mc-260812-3e61","type":"negative_result","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","rejected","kage-run:clean-up-mcp-kernel-ts-mcp-cli-ts-and-mc-260812-3e61"],"paths":[],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-17T18:21:11.839Z"}],"context":{"fact":"A delegated attempt at \"Clean up mcp/kernel.ts, mcp/cli.ts, and mcp/index.ts: remove dead code, reduce duplication, improve structure. No behavior changes — keep public function signatures and CLI/MCP-tool contracts identical.\" was rejected."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-17T18:21:11.839Z","path_fingerprints":[],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":2000,"discovery_tokens_estimated":true,"score":76,"reasons":["high-value memory type","has source evidence","tagged","concise but substantive"],"risks":["not grounded to paths"],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":239},"created_at":"2026-08-17T18:21:11.839Z","updated_at":"2026-08-17T18:21:11.839Z","author_branch":"release-prep"}
```

