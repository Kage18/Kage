---
type: "Gotcha"
title: "kage_refresh returns ~150KB per call: 177 stale packets and 78 warnings dumped in full"
description: "A single kage refresh call on this repo returns 149,739 characters ~37K tokens , which is large enough that the MCP client refuses the result outright and spills it to a file. Measured 2026 08 18 on a repo with 448 packe"
resource: "mcp/index.ts"
tags: ["session-learning", "mcp", "context-bloat", "kage_refresh", "token-cost"]
timestamp: "2026-08-18T11:07:54.950Z"
x-kage-id: "repo:https-github-com-kage-core-kage:gotcha:kage-refresh-returns-150kb-per-call-177-stale-packets-and-78-warnings-dumped-in-"
x-kage-type: "gotcha"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/index.ts", "CLAUDE.md"]
---

# kage_refresh returns ~150KB per call: 177 stale packets and 78 warnings dumped in full

> A single kage refresh call on this repo returns 149,739 characters ~37K tokens , which is large enough that the MCP c…

A single kage_refresh call on this repo returns 149,739 characters (~37K tokens), which is large enough that the MCP client refuses the result outright and spills it to a file. Measured 2026-08-18 on a repo with 448 packets.

Breakdown of the payload:
- stale_packets: 105,516 chars — an array of 177 entries. Each entry is individually reasonable (~580 chars: id, title, type, status, paths, reasons, suggested_action). The bloat is the COUNT, not the per-entry shape; the tool returns every stale packet with no cap.
- validation: 17,745 chars — 78 warnings, mostly "low memory quality score NN" lines.
- The remaining ~26K is index, metrics, code_graph, memory_graph and next_actions.

Why this matters more than a normal perf nit: CLAUDE.md instructs every agent to call kage_refresh after meaningful file or content changes, so this cost is paid once or more per session, by the very tool whose product promise is that it SAVES context and tokens. A memory harness that spends 37K tokens reporting on itself is arguing against its own value, and the gains receipt it prints elsewhere is measured in the same units it is quietly burning here.

The fix shape is a cap plus a pointer, not a smaller schema: return a count and the top N most actionable stale packets (ranked by whatever the suggested_action already implies), plus a way to fetch the rest on demand. Same treatment for validation warnings. The per-entry fields are already lean and should not be trimmed further — trimming them would hide detail without fixing the actual cause.

Note this is the same disease as the existing context-bloat-dump packet in this repo's memory, resurfacing in a different tool, so a fix should consider whether one shared response-capping helper belongs at the MCP boundary rather than per-tool.
Evidence: Called mcp__kage__kage_refresh on /Users/kushaljain/code/Kage; the client rejected the result as "149,739 characters across 3,053 lines" and spilled it to a tool-results file. Parsing that JSON gave top-level keys ok, project_dir, generated_at, quiet_refresh, index, validation, metrics, stale_packets, updated_packets, indexes, code_graph, memory_graph, next_actions; stale_packets was an array of 177 entries totalling 105,516 chars and validation totalled 17,745 chars with 78 warnings. index.packets was 448 and validation.ok was true with 0 errors.
Verified by: Direct measurement of the spilled tool-result payload

## Verification

Called mcp__kage__kage_refresh on /Users/kushaljain/code/Kage; the client rejected the result as "149,739 characters across 3,053 lines" and spilled it to a tool-results file. Parsing that JSON gave top-level keys ok, project_dir, generated_at, quiet_refresh, index, validation, metrics, stale_packets, updated_packets, indexes, code_graph, memory_graph, next_actions; stale_packets was an array of 177 entries totalling 105,516 chars and validation totalled 17,745 chars with 78 warnings. index.packets was 448 and validation.ok was true with 0 errors.

# Citations

[1] explicit_capture (2026-08-18T11:07:54.950Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:gotcha:kage-refresh-returns-150kb-per-call-177-stale-packets-and-78-warnings-dumped-in-","title":"kage_refresh returns ~150KB per call: 177 stale packets and 78 warnings dumped in full","summary":"A single kage refresh call on this repo returns 149,739 characters ~37K tokens , which is large enough that the MCP client refuses the result outright and spills it to a file. Measured 2026 08 18 on a repo with 448 packe","body":"A single kage_refresh call on this repo returns 149,739 characters (~37K tokens), which is large enough that the MCP client refuses the result outright and spills it to a file. Measured 2026-08-18 on a repo with 448 packets.\n\nBreakdown of the payload:\n- stale_packets: 105,516 chars — an array of 177 entries. Each entry is individually reasonable (~580 chars: id, title, type, status, paths, reasons, suggested_action). The bloat is the COUNT, not the per-entry shape; the tool returns every stale packet with no cap.\n- validation: 17,745 chars — 78 warnings, mostly \"low memory quality score NN\" lines.\n- The remaining ~26K is index, metrics, code_graph, memory_graph and next_actions.\n\nWhy this matters more than a normal perf nit: CLAUDE.md instructs every agent to call kage_refresh after meaningful file or content changes, so this cost is paid once or more per session, by the very tool whose product promise is that it SAVES context and tokens. A memory harness that spends 37K tokens reporting on itself is arguing against its own value, and the gains receipt it prints elsewhere is measured in the same units it is quietly burning here.\n\nThe fix shape is a cap plus a pointer, not a smaller schema: return a count and the top N most actionable stale packets (ranked by whatever the suggested_action already implies), plus a way to fetch the rest on demand. Same treatment for validation warnings. The per-entry fields are already lean and should not be trimmed further — trimming them would hide detail without fixing the actual cause.\n\nNote this is the same disease as the existing context-bloat-dump packet in this repo's memory, resurfacing in a different tool, so a fix should consider whether one shared response-capping helper belongs at the MCP boundary rather than per-tool.\nEvidence: Called mcp__kage__kage_refresh on /Users/kushaljain/code/Kage; the client rejected the result as \"149,739 characters across 3,053 lines\" and spilled it to a tool-results file. Parsing that JSON gave top-level keys ok, project_dir, generated_at, quiet_refresh, index, validation, metrics, stale_packets, updated_packets, indexes, code_graph, memory_graph, next_actions; stale_packets was an array of 177 entries totalling 105,516 chars and validation totalled 17,745 chars with 78 warnings. index.packets was 448 and validation.ok was true with 0 errors.\nVerified by: Direct measurement of the spilled tool-result payload","type":"gotcha","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","mcp","context-bloat","kage_refresh","token-cost"],"paths":["mcp/index.ts","CLAUDE.md"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-18T11:07:54.950Z"}],"context":{"fact":"A single kage_refresh call on this repo returns 149,739 characters (~37K tokens), which is large enough that the MCP client refuses the result outright and spills it to a file. Measured 2026-08-18 on a repo with 448 packets.","verification":"Called mcp__kage__kage_refresh on /Users/kushaljain/code/Kage; the client rejected the result as \"149,739 characters across 3,053 lines\" and spilled it to a tool-results file. Parsing that JSON gave top-level keys ok, project_dir, generated_at, quiet_refresh, index, validation, metrics, stale_packets, updated_packets, indexes, code_graph, memory_graph, next_actions; stale_packets was an array of 177 entries totalling 105,516 chars and validation totalled 17,745 chars with 78 warnings. index.packets was 448 and validation.ok was true with 0 errors."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-18T11:07:54.950Z","path_fingerprints":[{"path":"mcp/index.ts","sha256":"b1111dc7c5d8405cf699593884089399428d30e62e47e7d69999bf7e550194b3","size":88756,"symbols":[{"name":"score","kind":"constant","sha256":"70eda26cd548161422088eab86708387757c1c6de54f8eedf58911a554a9674b"},{"name":"title","kind":"constant","sha256":"2525473c56fbfa0baf52ddeea7b69da7a44ee01acccee74c36022c0b71cfeabe"},{"name":"agent","kind":"constant","sha256":"f43965840101ba03f34df722db6ad9cd1ca443fc381b27433cff4ad00194473f"},{"name":"index","kind":"constant","sha256":"ad98a75521fc0edce4fed6c6cd0503a41df66728efc44c4c3904db6a6ac89d7f"},{"name":"content","kind":"constant","sha256":"2bb083417ce517642b247da979b546e7c29d08fc55f62438bf1d787aa32c952f"},{"name":"validation","kind":"constant","sha256":"98a7747d4e4a450a2444f7de45c545d9527be0675ece8ebe7ba615af1b017a39"},{"name":"gains","kind":"constant","sha256":"f1d801ddc8d3cecd2971dc54faf9a98ccc489baeca14cb0b1d9ea6763e239fdb"},{"name":"receipt","kind":"constant","sha256":"14d180864a23d0a4b567585d787f486a8228a091d06ae18ac123027f2b6f6494"}]},{"path":"CLAUDE.md","sha256":"b4b4885a56c047a7e4d96dc8cef0bcb974a701b04bfdd11a917e0fd2053a8ffb","size":5659}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":94,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":606,"unresolved_symbols":["stale_packets","suggested_action","memory_graph","next_actions","generated_at","quiet_refresh","updated_packets"]},"created_at":"2026-08-18T11:07:54.950Z","updated_at":"2026-08-20T20:13:09.742Z","author_branch":"release-prep"}
```

