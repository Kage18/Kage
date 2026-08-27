---
type: "Bug Fix"
title: "beliefStaleReason conflated packet lineage status (deprecated/superseded) with grounding failure, withholding 54 of 60 beliefs from recall"
description: "Immediately after merging beliefs first recall recallBeliefs in mcp/kernel.ts , live testing found 54 of 60 merged beliefs invisible to recall — 46 purely because beliefStaleReason withholds a belief when ANY cited packe"
resource: "mcp/kernel.ts"
tags: ["session-learning", "beliefs", "recall", "staleness", "regression"]
timestamp: "2026-08-22T10:26:31.099Z"
x-kage-id: "repo:https-github-com-kage-core-kage:bug_fix:beliefstalereason-conflated-packet-lineage-status-deprecated-superseded-with-gro"
x-kage-type: "bug_fix"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/kernel.ts"]
---

# beliefStaleReason conflated packet lineage status (deprecated/superseded) with grounding failure, withholding 54 of 60 beliefs from recall

> Immediately after merging beliefs first recall recallBeliefs in mcp/kernel.ts , live testing found 54 of 60 merged be…

Immediately after merging beliefs-first recall (recallBeliefs in mcp/kernel.ts), live testing found 54 of 60 merged beliefs invisible to recall — 46 purely because beliefStaleReason withholds a belief when ANY cited packet has been superseded/deprecated, treating that identically to real staleness (moved/missing cited code). This is backwards: a belief is a synthesis that deliberately cites historical episodes including ones later superseded by newer learnings — citing superseded evidence is the normal, correct shape of consolidation, not a grounding failure. Verified directly: `node -e "const k=require('./dist/kernel.js'); k.recall(dir, beliefTitle, 5, false)"` run against every belief's own title as query, comparing r.beliefs vs r.beliefs_withheld, is the fast diagnostic for this class of bug (bypasses the MCP tool layer entirely). Fix dispatched same-day.
Evidence: direct kernel.recall() calls against all 60 belief titles: served=6, withheld=54, withheld-due-to-deprecated-citation=46
Verified by: reproduced live via node -e against dist/kernel.js on 2026-08-22

## Verification

direct kernel.recall() calls against all 60 belief titles: served=6, withheld=54, withheld-due-to-deprecated-citation=46

# Citations

[1] explicit_capture (2026-08-22T10:26:31.099Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:bug_fix:beliefstalereason-conflated-packet-lineage-status-deprecated-superseded-with-gro","title":"beliefStaleReason conflated packet lineage status (deprecated/superseded) with grounding failure, withholding 54 of 60 beliefs from recall","summary":"Immediately after merging beliefs first recall recallBeliefs in mcp/kernel.ts , live testing found 54 of 60 merged beliefs invisible to recall — 46 purely because beliefStaleReason withholds a belief when ANY cited packe","body":"Immediately after merging beliefs-first recall (recallBeliefs in mcp/kernel.ts), live testing found 54 of 60 merged beliefs invisible to recall — 46 purely because beliefStaleReason withholds a belief when ANY cited packet has been superseded/deprecated, treating that identically to real staleness (moved/missing cited code). This is backwards: a belief is a synthesis that deliberately cites historical episodes including ones later superseded by newer learnings — citing superseded evidence is the normal, correct shape of consolidation, not a grounding failure. Verified directly: `node -e \"const k=require('./dist/kernel.js'); k.recall(dir, beliefTitle, 5, false)\"` run against every belief's own title as query, comparing r.beliefs vs r.beliefs_withheld, is the fast diagnostic for this class of bug (bypasses the MCP tool layer entirely). Fix dispatched same-day.\nEvidence: direct kernel.recall() calls against all 60 belief titles: served=6, withheld=54, withheld-due-to-deprecated-citation=46\nVerified by: reproduced live via node -e against dist/kernel.js on 2026-08-22","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","beliefs","recall","staleness","regression"],"paths":["mcp/kernel.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-22T10:26:31.099Z"}],"context":{"fact":"Immediately after merging beliefs-first recall (recallBeliefs in mcp/kernel.ts), live testing found 54 of 60 merged beliefs invisible to recall — 46 purely because beliefStaleReason withholds a belief when ANY cited packet has been superseded/deprecated, treating that identically to real staleness (moved/missing cited code). This is backwards: a belief is a synthesis that deliberately cites historical episodes including ones later superseded by newer learnings — citing superseded evidence is the normal, correct shape of consolidation, not a grounding failure. Verified directly: `node -e \"const k=require('./dist/kernel.js'); k.recall(dir, beliefTitle, 5, false)\"` run against every belief's own title as query, comparing r.beliefs vs r.beliefs_withheld, is the fast diagnostic for this class of bug (bypasses the MCP tool layer entirely). Fix dispatched same-day.\nEvidence: direct kernel.recall() calls against all 60 belief titles: served=6, withheld=54, withheld-due-to-deprecated-citation=46\nVerified by: reproduced live via node -e against dist/kernel.js on 2026-08-22","verification":"direct kernel.recall() calls against all 60 belief titles: served=6, withheld=54, withheld-due-to-deprecated-citation=46"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-22T10:26:31.099Z","path_fingerprints":[{"path":"mcp/kernel.ts","sha256":"c1cc0f698d4a05b1d8a8043f4a45d88e04ab2a3307aeebb71ac43d61132a9f85","size":943164,"symbols":[{"name":"verified","kind":"constant","sha256":"9e1998eeb03a854663c4ce2fa27bc0dde75922738f56430c157d33ea3ab8d3b8"},{"name":"belief","kind":"constant","sha256":"6244be922237f1e317d471832e787a4f1d242fe0075ed7eccddaa9d4bb82d8ba"},{"name":"beliefstalereason","kind":"function","sha256":"d669ec4452d73cf11b05d65c1db467f02bd6b4c4a083faca242cd91d16298351"},{"name":"recallbeliefs","kind":"function","sha256":"43949b0841d8f413bca5a765ee072b39a93b688561466852b747c5c9df85f34c"},{"name":"lineage","kind":"constant","sha256":"d95fb2fcf60b740e0ead538d68698eb4a371f46b66a22e0d241a07ef5c085b6b"},{"name":"same","kind":"constant","sha256":"b150fada949a5c6d4babe0a0bc108765c6e7e1819d0ddbee55112b9c9a708447"},{"name":"episodes","kind":"constant","sha256":"e4e4f016997ad36aa13e61878848f2f3e7e1492acbf89548843e2c94dd76f1c0"},{"name":"code","kind":"constant","sha256":"64b81d42a4c6de11c6ff891787a63a33c198717dba5a924932817e97a8d1f7cf"},{"name":"direct","kind":"constant","sha256":"853c29ac28fd41bb1a34289263ae3eabfaf28b886b3f7c125769cd1b80cf6b94"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":270,"unresolved_symbols":["beliefTitle"]},"created_at":"2026-08-22T10:26:31.099Z","updated_at":"2026-08-22T10:26:31.099Z","author_branch":"release-prep"}
```

