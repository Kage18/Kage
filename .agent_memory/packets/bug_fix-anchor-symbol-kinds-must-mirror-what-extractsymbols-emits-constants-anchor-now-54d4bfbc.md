---
type: "Bug Fix"
title: "ANCHOR_SYMBOL_KINDS must mirror what extractSymbols emits — constants anchor now"
description: "The anchor kind set listed interface/type/enum, which extractSymbols never emits, and omitted constant — the most common kind in the store 2089 anchors vs 427 functions . camelCase consts like defaultGateways could not a"
resource: "mcp/kernel.ts"
tags: ["session-learning"]
timestamp: "2026-07-27T18:49:48.277Z"
x-kage-id: "repo:https-github-com-kage-core-kage:bug_fix:anchor-symbol-kinds-must-mirror-what-extractsymbols-emits-constants-anchor-now-1"
x-kage-type: "bug_fix"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "unverified"
x-kage-paths: ["mcp/kernel.ts"]
---

# ANCHOR_SYMBOL_KINDS must mirror what extractSymbols emits — constants anchor now

> The anchor kind set listed interface/type/enum, which extractSymbols never emits, and omitted constant — the most com…

The anchor kind set listed interface/type/enum, which extractSymbols never emits, and omitted constant — the most common kind in the store (2089 anchors vs 427 functions). camelCase consts like defaultGateways could not anchor while SCREAMING_SNAKE ones slipped through the underscore escape, so whether memory anchored depended on spelling. Set is now function/class/method/constant; verified by the camelCase-const regression test in kernel.test.ts.

# Citations

[1] explicit_capture (2026-07-27T18:49:48.277Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:bug_fix:anchor-symbol-kinds-must-mirror-what-extractsymbols-emits-constants-anchor-now-1","title":"ANCHOR_SYMBOL_KINDS must mirror what extractSymbols emits — constants anchor now","summary":"The anchor kind set listed interface/type/enum, which extractSymbols never emits, and omitted constant — the most common kind in the store 2089 anchors vs 427 functions . camelCase consts like defaultGateways could not a","body":"The anchor kind set listed interface/type/enum, which extractSymbols never emits, and omitted constant — the most common kind in the store (2089 anchors vs 427 functions). camelCase consts like defaultGateways could not anchor while SCREAMING_SNAKE ones slipped through the underscore escape, so whether memory anchored depended on spelling. Set is now function/class/method/constant; verified by the camelCase-const regression test in kernel.test.ts.","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning"],"paths":["mcp/kernel.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-07-27T18:49:48.277Z"}],"context":{"fact":"The anchor kind set listed interface/type/enum, which extractSymbols never emits, and omitted constant — the most common kind in the store (2089 anchors vs 427 functions). camelCase consts like defaultGateways could not anchor while SCREAMING_SNAKE ones slipped through the underscore escape, so whether memory anchored depended on spelling. Set is now function/class/method/constant; verified by the camelCase-const regression test in kernel.test.ts."},"freshness":{"ttl_days":365,"last_verified_at":"2026-07-27T18:49:48.277Z","path_fingerprints":[{"path":"mcp/kernel.ts","sha256":"d88ad9d64cbb4de7b59abacb3ca92806f6286cc5ad2cfc6ead59acf4aa81ca96","size":1026578,"symbols":[{"name":"anchor_symbol_kinds","kind":"constant","sha256":"b4f34edaff1a5f860011ec0ee870f7496342ab8641f7cfb9d04c7e19dac7656b"},{"name":"extractsymbols","kind":"function","sha256":"349d283fdf92de4bcb1cac42fafaa71c3a10472fe70edefab1c451838556d73a"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":1,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":113,"total_uses":1,"last_accessed_at":"2026-07-28T11:49:54.848Z"},"created_at":"2026-07-27T18:49:48.277Z","updated_at":"2026-07-27T18:49:48.277Z","author_branch":"reform/p0-truth","author_name":"Kushal Jain"}
```

