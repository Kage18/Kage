---
type: "Decision"
title: "mcp/kernel.test.ts's existing compactProject test and mcp/trajectory.test.ts's 'create ..."
description: "mcp/kernel.test.ts's existing compactProject test and mcp/trajectory.test.ts's 'create delete cited withheld compact deprecated' trajectory test both already exercise compact's behavior purely through the public API reca"
resource: "mcp/kernel.ts"
tags: ["delegated-run", "kage-run:p2a-retire-the-last-in-place-packet-muta-260822-d87f"]
timestamp: "2026-08-22T06:51:04.727Z"
x-kage-id: "repo:p2a-retire-the-last-in-place-packet-muta-260822-d87f:decision:mcp-kernel-test-tss-existing-compactproject-test-and-mcp-trajectory-test-tss-cre"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/kernel.ts", "mcp/p2a-retire-the-last.test.ts", "mcp/store/journal.ts"]
---

# mcp/kernel.test.ts's existing compactProject test and mcp/trajectory.test.ts's 'create ...

> mcp/kernel.test.ts's existing compactProject test and mcp/trajectory.test.ts's 'create delete cited withheld compact …

mcp/kernel.test.ts's existing compactProject test and mcp/trajectory.test.ts's 'create -> delete cited -> withheld -> compact -> deprecated' trajectory test both already exercise compact's behavior purely through the public API (recall/report shape), not raw file bytes, so they kept passing unmodified once the mutation moved to the journal.

Learned while delivering: P2a — retire the last in-place packet mutator: kage compact (compactProject in mcp/kernel.ts) still rewrites packet frontmatter for hard-stale-deprecate and citation pruning (flagged in P1b's claim as out of its scope). Route both through the P1b journal (mcp/store/journal.ts append + load-time overlay) exactly like supersede/stale/reverify/gc: compact appends deprecate/prune events, packet files stay byte-identical, readers see the overlay. Delete or deprecate any now-dead frontmatter-rewrite helpers so no code path can rewrite a packet after capture — add a test asserting the packets directory is byte-identical before and after a compact on a fixture project. Suite green; cite files individually.
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-22T06:51:04.727Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:p2a-retire-the-last-in-place-packet-muta-260822-d87f:decision:mcp-kernel-test-tss-existing-compactproject-test-and-mcp-trajectory-test-tss-cre","title":"mcp/kernel.test.ts's existing compactProject test and mcp/trajectory.test.ts's 'create ...","summary":"mcp/kernel.test.ts's existing compactProject test and mcp/trajectory.test.ts's 'create delete cited withheld compact deprecated' trajectory test both already exercise compact's behavior purely through the public API reca","body":"mcp/kernel.test.ts's existing compactProject test and mcp/trajectory.test.ts's 'create -> delete cited -> withheld -> compact -> deprecated' trajectory test both already exercise compact's behavior purely through the public API (recall/report shape), not raw file bytes, so they kept passing unmodified once the mutation moved to the journal.\n\nLearned while delivering: P2a — retire the last in-place packet mutator: kage compact (compactProject in mcp/kernel.ts) still rewrites packet frontmatter for hard-stale-deprecate and citation pruning (flagged in P1b's claim as out of its scope). Route both through the P1b journal (mcp/store/journal.ts append + load-time overlay) exactly like supersede/stale/reverify/gc: compact appends deprecate/prune events, packet files stay byte-identical, readers see the overlay. Delete or deprecate any now-dead frontmatter-rewrite helpers so no code path can rewrite a packet after capture — add a test asserting the packets directory is byte-identical before and after a compact on a fixture project. Suite green; cite files individually.\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:p2a-retire-the-last-in-place-packet-muta-260822-d87f"],"paths":["mcp/kernel.ts","mcp/p2a-retire-the-last.test.ts","mcp/store/journal.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-22T06:51:04.727Z"}],"context":{"fact":"mcp/kernel.test.ts's existing compactProject test and mcp/trajectory.test.ts's 'create -> delete cited -> withheld -> compact -> deprecated' trajectory test both already exercise compact's behavior purely through the public API (recall/report shape), not raw file bytes, so they kept passing unmodified once the mutation moved to the journal.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-22T06:51:04.727Z","path_fingerprints":[{"path":"mcp/kernel.ts","sha256":"fe4abd8a69d53fa3b64bf1f86832883799944cff809b9eb798133db4ebf90dab","size":932839,"symbols":[{"name":"frontmatter","kind":"constant","sha256":"19c6ddb0f85e6cb0c5c663485bf925ab38c9c4b3f694f4bf13c67cf09ea784c0"},{"name":"time","kind":"constant","sha256":"36aa0a901e7fda47d7d7571d9c21879432386e4418ed56010d7e03c9a91f5482"},{"name":"verified","kind":"constant","sha256":"9e1998eeb03a854663c4ce2fa27bc0dde75922738f56430c157d33ea3ab8d3b8"},{"name":"size","kind":"constant","sha256":"9008cc27791958971fe1d1c0049dd1e46d083d1bcf756d40e903520337322226"},{"name":"compact","kind":"constant","sha256":"c9b1c12cc7a86cc1cd5e8fe0a5d8f5153a50e841cc6135962452153780c8557f"},{"name":"compactproject","kind":"function","sha256":"db1fffe9a36f2fb92f52e3f294f6af7845e76ec8047a97d33d591a101c828d4c"},{"name":"code","kind":"constant","sha256":"64b81d42a4c6de11c6ff891787a63a33c198717dba5a924932817e97a8d1f7cf"},{"name":"json","kind":"constant","sha256":"f7bcd9f5ef8a5696c0f0ecbd148a4db30b52b674922455ec67a7561c86be4da4"},{"name":"citations","kind":"constant","sha256":"78b7b49fddee7f5495108e631981c2962515ed3d581135bfa9b536e2b3f30e9d"},{"name":"withheld","kind":"constant","sha256":"eb7d70a0467b39f39545af788776ad26d8bce372b5fdcf2540f1c9433c48a517"},{"name":"capture","kind":"function","sha256":"51646b0767fe7db5d2b668804d20f8e8108536fc780474fe60eab87cc73f5157"}]},{"path":"mcp/p2a-retire-the-last.test.ts","sha256":"a2a38ead26ec8c4d86fc8e495ba3de5da0ba60bd5de804450978eb0a8cfd0b26","size":5880,"symbols":[{"name":"after","kind":"constant","sha256":"9e7fdb33b84a7bb8d453089285d88d2c64221016eea23e8b3275a94eef2054a1"},{"name":"events","kind":"constant","sha256":"677ceaf9f4effca6197c792cede24ba9d89e1a38a2cc4899de153f63668f40b2"}]},{"path":"mcp/store/journal.ts","sha256":"1c721f5140b4d17610c15f02282334fa021b172892dbe1b7ec49573beded553a","size":8772,"symbols":[{"name":"file","kind":"constant","sha256":"7574135cce410ca5525faed8a3bfe1a4ee0e782f8279e24611a60539c4c5fa57"},{"name":"files","kind":"constant","sha256":"ac1e457cc06634b2d6c5ea8e7662d8a8652aadee3a2810582b8f4f21729b271b"},{"name":"events","kind":"constant","sha256":"7598a13ea036264872d88ee19f9ba91b9d7c6f0d49b641b15fda408920dc7a72"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":297,"unresolved_symbols":["noEmit"]},"created_at":"2026-08-22T06:51:04.727Z","updated_at":"2026-08-22T06:56:12.914Z","author_branch":"kage/p2a-retire-the-last-in-place-packet-muta-260822-d87f"}
```

