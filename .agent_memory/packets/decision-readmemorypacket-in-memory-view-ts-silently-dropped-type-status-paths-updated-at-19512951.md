---
type: "Decision"
title: "readMemoryPacket() in memory-view.ts silently dropped type/status/paths/updated_at even..."
description: "readMemoryPacket in memory view.ts silently dropped type/status/paths/updated at even though they already sat on the matched catalog entry match it was already reading from — extending the return object was a zero risk, "
resource: "mcp/audit-driven-parity-pass.test.ts"
tags: ["delegated-run", "kage-run:audit-driven-parity-pass-compare-every-r-260821-380b"]
timestamp: "2026-08-21T07:54:16.051Z"
x-kage-id: "repo:audit-driven-parity-pass-compare-every-r-260821-380b:decision:readmemorypacket-in-memory-view-ts-silently-dropped-type-status-paths-updated-at"
x-kage-type: "decision"
x-kage-status: "pending"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/audit-driven-parity-pass.test.ts", "mcp/delegation/app-client.ts", "mcp/delegation/app-html.ts", "mcp/delegation/app-styles.ts", "mcp/delegation/memory-view.ts"]
---

# readMemoryPacket() in memory-view.ts silently dropped type/status/paths/updated_at even...

> readMemoryPacket in memory view.ts silently dropped type/status/paths/updated at even though they already sat on the …

readMemoryPacket() in memory-view.ts silently dropped type/status/paths/updated_at even though they already sat on the matched catalog entry (`match`) it was already reading from — extending the return object was a zero-risk, zero-new-data change.

Learned while delivering: Audit-driven parity pass: compare every remaining shipped app surface against its mockup in docs/design/mockups/ (Main=Room chat, Terminal, Board, WorkList, RunDetail+ReceiptFull, Diff, TakeOver, Goal, NewRun, Notifications, Settings, AddProject, Memory, MemoryPacket, PhoneRoom/PhoneBoard) and close the real gaps. First produce the audit as part of the run summary (surface -> matches / differs -> what changed), then implement the differences that are pure presentation or small behavior (typography, spacing, card anatomy, chip placement, empty states, header/summary rows, copy). Do not rebuild surfaces that already match, do not invent data the API does not serve, and do not fabricate numbers anywhere — unmeasured renders as an em dash, never zero. Same template-literal constraints as always (doubled escapes, no backticks/dollar-brace, h() only, parse test green).
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, node --check <composed inline script>, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, node --check <composed inline script>, reachability

# Citations

[1] explicit_capture (2026-08-21T07:54:16.051Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:audit-driven-parity-pass-compare-every-r-260821-380b:decision:readmemorypacket-in-memory-view-ts-silently-dropped-type-status-paths-updated-at","title":"readMemoryPacket() in memory-view.ts silently dropped type/status/paths/updated_at even...","summary":"readMemoryPacket in memory view.ts silently dropped type/status/paths/updated at even though they already sat on the matched catalog entry match it was already reading from — extending the return object was a zero risk, ","body":"readMemoryPacket() in memory-view.ts silently dropped type/status/paths/updated_at even though they already sat on the matched catalog entry (`match`) it was already reading from — extending the return object was a zero-risk, zero-new-data change.\n\nLearned while delivering: Audit-driven parity pass: compare every remaining shipped app surface against its mockup in docs/design/mockups/ (Main=Room chat, Terminal, Board, WorkList, RunDetail+ReceiptFull, Diff, TakeOver, Goal, NewRun, Notifications, Settings, AddProject, Memory, MemoryPacket, PhoneRoom/PhoneBoard) and close the real gaps. First produce the audit as part of the run summary (surface -> matches / differs -> what changed), then implement the differences that are pure presentation or small behavior (typography, spacing, card anatomy, chip placement, empty states, header/summary rows, copy). Do not rebuild surfaces that already match, do not invent data the API does not serve, and do not fabricate numbers anywhere — unmeasured renders as an em dash, never zero. Same template-literal constraints as always (doubled escapes, no backticks/dollar-brace, h() only, parse test green).\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, node --check <composed inline script>, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"pending","confidence":0.7,"tags":["delegated-run","kage-run:audit-driven-parity-pass-compare-every-r-260821-380b"],"paths":["mcp/audit-driven-parity-pass.test.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/delegation/memory-view.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T07:54:16.051Z"}],"context":{"fact":"readMemoryPacket() in memory-view.ts silently dropped type/status/paths/updated_at even though they already sat on the matched catalog entry (`match`) it was already reading from — extending the return object was a zero-risk, zero-new-data change.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, node --check <composed inline script>, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T07:54:16.051Z","path_fingerprints":[{"path":"mcp/audit-driven-parity-pass.test.ts","sha256":"daa9f260513871a36a47f37dfcdf7dfc7c5c467760eec32e0ebf710b8c55e2a3","size":13778,"symbols":[{"name":"match","kind":"constant","sha256":"1e6d8cbbec9cec96837b2132b17c7b947ef5368686eb7cdeeafa42ee034b1795"}]},{"path":"mcp/delegation/app-client.ts","sha256":"1954ed8f5d484224e0e6cb667393989464ee51ebeef78b889de43a6aaac8c98b","size":222245},{"path":"mcp/delegation/app-html.ts","sha256":"baf9366fd8f75ccf35ca1c09005d106e88ebb76b58548d39ada9a4c74a97052a","size":15725},{"path":"mcp/delegation/app-styles.ts","sha256":"f8f8a3abf2123732b28846749b66e8074b4694e8a6a1311c9dfa7446251462d2","size":84897},{"path":"mcp/delegation/memory-view.ts","sha256":"ac5561f4f89c0d30407443f79ac652c3b61e82e2ff90d55fb8ae23f630df7950","size":12993,"symbols":[{"name":"readmemorypacket","kind":"function","sha256":"578e08a4291fbd6f04dd5d3325a2d96ab6891e73c1b388d451794c76a7a6409c"},{"name":"match","kind":"constant","sha256":"f5a40465934c11612083973740125458cacbd0eb0d085bfec5611b2567ab082e"},{"name":"entry","kind":"constant","sha256":"de8e5abce6d6e3c691b0bcd26181d4452e20abd2a692518b2f79876ef9ef7322"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":325,"unresolved_symbols":["PhoneRoom","PhoneBoard","noEmit"]},"created_at":"2026-08-21T07:54:16.051Z","updated_at":"2026-08-21T07:54:16.261Z","author_branch":"kage/audit-driven-parity-pass-compare-every-r-260821-380b"}
```

