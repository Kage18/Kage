---
type: "Decision"
title: "compactProject already loaded packets via loadPacketEntriesFromDir (the overlay-aware l..."
description: "compactProject already loaded packets via loadPacketEntriesFromDir the overlay aware loader , not the Raw variant gc/refresh use for their own mutation paths — so no loader swap was needed, only replacing the two inline "
resource: "mcp/kernel.ts"
tags: ["delegated-run", "kage-run:p2a-retire-the-last-in-place-packet-muta-260822-d87f"]
timestamp: "2026-08-22T06:51:03.472Z"
x-kage-id: "repo:p2a-retire-the-last-in-place-packet-muta-260822-d87f:decision:compactproject-already-loaded-packets-via-loadpacketentriesfromdir-the-overlay-a"
x-kage-type: "decision"
x-kage-status: "pending"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/kernel.ts", "mcp/p2a-retire-the-last.test.ts", "mcp/store/journal.ts"]
---

# compactProject already loaded packets via loadPacketEntriesFromDir (the overlay-aware l...

> compactProject already loaded packets via loadPacketEntriesFromDir the overlay aware loader , not the Raw variant gc/…

compactProject already loaded packets via loadPacketEntriesFromDir (the overlay-aware loader), not the *Raw variant gc/refresh use for their own mutation paths — so no loader swap was needed, only replacing the two inline writePacketToDisk/writeJson calls with appendJournalEvent calls.

Learned while delivering: P2a — retire the last in-place packet mutator: kage compact (compactProject in mcp/kernel.ts) still rewrites packet frontmatter for hard-stale-deprecate and citation pruning (flagged in P1b's claim as out of its scope). Route both through the P1b journal (mcp/store/journal.ts append + load-time overlay) exactly like supersede/stale/reverify/gc: compact appends deprecate/prune events, packet files stay byte-identical, readers see the overlay. Delete or deprecate any now-dead frontmatter-rewrite helpers so no code path can rewrite a packet after capture — add a test asserting the packets directory is byte-identical before and after a compact on a fixture project. Suite green; cite files individually.
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-22T06:51:03.472Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:p2a-retire-the-last-in-place-packet-muta-260822-d87f:decision:compactproject-already-loaded-packets-via-loadpacketentriesfromdir-the-overlay-a","title":"compactProject already loaded packets via loadPacketEntriesFromDir (the overlay-aware l...","summary":"compactProject already loaded packets via loadPacketEntriesFromDir the overlay aware loader , not the Raw variant gc/refresh use for their own mutation paths — so no loader swap was needed, only replacing the two inline ","body":"compactProject already loaded packets via loadPacketEntriesFromDir (the overlay-aware loader), not the *Raw variant gc/refresh use for their own mutation paths — so no loader swap was needed, only replacing the two inline writePacketToDisk/writeJson calls with appendJournalEvent calls.\n\nLearned while delivering: P2a — retire the last in-place packet mutator: kage compact (compactProject in mcp/kernel.ts) still rewrites packet frontmatter for hard-stale-deprecate and citation pruning (flagged in P1b's claim as out of its scope). Route both through the P1b journal (mcp/store/journal.ts append + load-time overlay) exactly like supersede/stale/reverify/gc: compact appends deprecate/prune events, packet files stay byte-identical, readers see the overlay. Delete or deprecate any now-dead frontmatter-rewrite helpers so no code path can rewrite a packet after capture — add a test asserting the packets directory is byte-identical before and after a compact on a fixture project. Suite green; cite files individually.\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"pending","confidence":0.7,"tags":["delegated-run","kage-run:p2a-retire-the-last-in-place-packet-muta-260822-d87f"],"paths":["mcp/kernel.ts","mcp/p2a-retire-the-last.test.ts","mcp/store/journal.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-22T06:51:03.472Z"}],"context":{"fact":"compactProject already loaded packets via loadPacketEntriesFromDir (the overlay-aware loader), not the *Raw variant gc/refresh use for their own mutation paths — so no loader swap was needed, only replacing the two inline writePacketToDisk/writeJson calls with appendJournalEvent calls.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-22T06:51:03.472Z","path_fingerprints":[{"path":"mcp/kernel.ts","sha256":"fe4abd8a69d53fa3b64bf1f86832883799944cff809b9eb798133db4ebf90dab","size":932839,"symbols":[{"name":"writejson","kind":"function","sha256":"d27a80deafd04b4e7bbefe5632874bdcffb6773ac63f0d506037178108f5b076"},{"name":"frontmatter","kind":"constant","sha256":"19c6ddb0f85e6cb0c5c663485bf925ab38c9c4b3f694f4bf13c67cf09ea784c0"},{"name":"time","kind":"constant","sha256":"36aa0a901e7fda47d7d7571d9c21879432386e4418ed56010d7e03c9a91f5482"},{"name":"verified","kind":"constant","sha256":"9e1998eeb03a854663c4ce2fa27bc0dde75922738f56430c157d33ea3ab8d3b8"},{"name":"size","kind":"constant","sha256":"9008cc27791958971fe1d1c0049dd1e46d083d1bcf756d40e903520337322226"},{"name":"writepackettodisk","kind":"function","sha256":"a477725a66eff69b694f6c5c607d82dd46e87f05936901f6d58a442a083b10e7"},{"name":"loadpacketentriesfromdir","kind":"function","sha256":"248a8dfe44929a695ce7e32ef5eed3a47e471051ec5631003051b8d682c523f6"},{"name":"compact","kind":"constant","sha256":"c9b1c12cc7a86cc1cd5e8fe0a5d8f5153a50e841cc6135962452153780c8557f"},{"name":"compactproject","kind":"function","sha256":"db1fffe9a36f2fb92f52e3f294f6af7845e76ec8047a97d33d591a101c828d4c"},{"name":"code","kind":"constant","sha256":"64b81d42a4c6de11c6ff891787a63a33c198717dba5a924932817e97a8d1f7cf"},{"name":"json","kind":"constant","sha256":"f7bcd9f5ef8a5696c0f0ecbd148a4db30b52b674922455ec67a7561c86be4da4"},{"name":"citations","kind":"constant","sha256":"78b7b49fddee7f5495108e631981c2962515ed3d581135bfa9b536e2b3f30e9d"},{"name":"capture","kind":"function","sha256":"51646b0767fe7db5d2b668804d20f8e8108536fc780474fe60eab87cc73f5157"}]},{"path":"mcp/p2a-retire-the-last.test.ts","sha256":"a2a38ead26ec8c4d86fc8e495ba3de5da0ba60bd5de804450978eb0a8cfd0b26","size":5880,"symbols":[{"name":"after","kind":"constant","sha256":"9e7fdb33b84a7bb8d453089285d88d2c64221016eea23e8b3275a94eef2054a1"},{"name":"events","kind":"constant","sha256":"677ceaf9f4effca6197c792cede24ba9d89e1a38a2cc4899de153f63668f40b2"}]},{"path":"mcp/store/journal.ts","sha256":"1c721f5140b4d17610c15f02282334fa021b172892dbe1b7ec49573beded553a","size":8772,"symbols":[{"name":"appendjournalevent","kind":"function","sha256":"3e90752395fc04bc8f6fdb5f680e65fe7a710c9b0b5f0d142ad2be4e3fb8fbd4"},{"name":"files","kind":"constant","sha256":"ac1e457cc06634b2d6c5ea8e7662d8a8652aadee3a2810582b8f4f21729b271b"},{"name":"events","kind":"constant","sha256":"7598a13ea036264872d88ee19f9ba91b9d7c6f0d49b641b15fda408920dc7a72"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":283,"unresolved_symbols":["noEmit"]},"created_at":"2026-08-22T06:51:03.472Z","updated_at":"2026-08-22T06:51:04.480Z","author_branch":"kage/p2a-retire-the-last-in-place-packet-muta-260822-d87f"}
```

