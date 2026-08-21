---
type: "Convention"
title: "This repo is built through its own delegation loop: dispatch, verify, merge — the operator does not hand-edit"
description: "Standing convention from the owner 2026 08 17 : work on the Kage repo is done USING Kage. Code changes are dispatched as runs kage dispatch / the Room / POST /runs , the agent works in a worktree, the kernel re executes"
resource: "CLAUDE.md"
tags: ["session-learning", "dogfood", "workflow", "delegation", "operator"]
timestamp: "2026-08-20T12:41:29.273Z"
x-kage-id: "repo:https-github-com-kage-core-kage:convention:this-repo-is-built-through-its-own-delegation-loop-dispatch-verify-merge-the-ope"
x-kage-type: "convention"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["CLAUDE.md", "mcp/delegation/dispatch.ts", "mcp/delegation/ratify.ts"]
---

# This repo is built through its own delegation loop: dispatch, verify, merge — the operator does not hand-edit

> Standing convention from the owner 2026 08 17 : work on the Kage repo is done USING Kage. Code changes are dispatched…

Standing convention from the owner (2026-08-17): work on the Kage repo is done USING Kage. Code changes are dispatched as runs (kage dispatch / the Room / POST /runs), the agent works in a worktree, the kernel re-executes the checks, and the operator reviews the receipt, diff, and blast radius before kage merge lands code and ratifies learnings. Rejections carry reasons because reasons become memory. Two honesty rules for operating the loop: a receipt's checks ran against the RUN'S branch tree, so when the base has moved since dispatch, re-run the test command after merging before trusting the merged tree; and a run whose base is many commits stale on files that changed underneath it is usually better rejected-with-reason and re-dispatched on current HEAD than merged. Memory curation (kage conflicts, supersede, reverify, feedback) and daemon operations remain direct operator acts — they are Kage. Bootstrap exception: when a Kage bug blocks dispatching the fix for that very bug, fix the minimum directly and record why.
Evidence: Owner directive in session, 2026-08-17: "from here on all the work that you do, should be done using the kage."
Verified by: Owner instruction; loop mechanics verified across this session (562→567 tests, receipts, ratification).

## Verification

Owner directive in session, 2026-08-17: "from here on all the work that you do, should be done using the kage."

# Citations

[1] explicit_capture (2026-08-17T18:19:35.250Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:convention:this-repo-is-built-through-its-own-delegation-loop-dispatch-verify-merge-the-ope","title":"This repo is built through its own delegation loop: dispatch, verify, merge — the operator does not hand-edit","summary":"Standing convention from the owner 2026 08 17 : work on the Kage repo is done USING Kage. Code changes are dispatched as runs kage dispatch / the Room / POST /runs , the agent works in a worktree, the kernel re executes","body":"Standing convention from the owner (2026-08-17): work on the Kage repo is done USING Kage. Code changes are dispatched as runs (kage dispatch / the Room / POST /runs), the agent works in a worktree, the kernel re-executes the checks, and the operator reviews the receipt, diff, and blast radius before kage merge lands code and ratifies learnings. Rejections carry reasons because reasons become memory. Two honesty rules for operating the loop: a receipt's checks ran against the RUN'S branch tree, so when the base has moved since dispatch, re-run the test command after merging before trusting the merged tree; and a run whose base is many commits stale on files that changed underneath it is usually better rejected-with-reason and re-dispatched on current HEAD than merged. Memory curation (kage conflicts, supersede, reverify, feedback) and daemon operations remain direct operator acts — they are Kage. Bootstrap exception: when a Kage bug blocks dispatching the fix for that very bug, fix the minimum directly and record why.\nEvidence: Owner directive in session, 2026-08-17: \"from here on all the work that you do, should be done using the kage.\"\nVerified by: Owner instruction; loop mechanics verified across this session (562→567 tests, receipts, ratification).","type":"convention","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","dogfood","workflow","delegation","operator"],"paths":["CLAUDE.md","mcp/delegation/dispatch.ts","mcp/delegation/ratify.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-17T18:19:35.250Z"}],"context":{"fact":"Standing convention from the owner (2026-08-17): work on the Kage repo is done USING Kage. Code changes are dispatched as runs (kage dispatch / the Room / POST /runs), the agent works in a worktree, the kernel re-executes the checks, and the operator reviews the receipt, diff, and blast radius before kage merge lands code and ratifies learnings. Rejections carry reasons because reasons become memory. Two honesty rules for operating the loop: a receipt's checks ran against the RUN'S branch tree, so when the base has moved since dispatch, re-run the test command after merging before trusting the merged tree; and a run whose base is many commits stale on files that changed underneath it is usually better rejected-with-reason and re-dispatched on current HEAD than merged. Memory curation (kage conflicts, supersede, reverify, feedback) and daemon operations remain direct operator acts — they are Kage. Bootstrap exception: when a Kage bug blocks dispatching the fix for that very bug, fix the minimum directly and record why.\nEvidence: Owner directive in session, 2026-08-17: \"from here on all the work that you do, should be done using the kage.\"\nVerified by: Owner instruction; loop mechanics verified across this session (562→567 tests, receipts, ratification).","verification":"Owner directive in session, 2026-08-17: \"from here on all the work that you do, should be done using the kage.\""},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-20T12:41:29.273Z","path_fingerprints":[{"path":"CLAUDE.md","sha256":"b4b4885a56c047a7e4d96dc8cef0bcb974a701b04bfdd11a917e0fd2053a8ffb","size":5659},{"path":"mcp/delegation/dispatch.ts","sha256":"8ffa9bcf9d6458a52aaf472946ca73b1a6408ecbda47ddd09124bceffa861e05","size":23982,"symbols":[{"name":"record","kind":"constant","sha256":"358ba0c5b6d9bfd51109f2ed82f8365cc54e53c2d6cbd1bbd312888223b513e3"},{"name":"worktree","kind":"constant","sha256":"0d337a9939de05272f55ff66c5ee11f4ef58ab4589d71335c0518092a3f9dabf"}]},{"path":"mcp/delegation/ratify.ts","sha256":"b170f3c4876273f7d83f944f9af7723531e8d658afca0d41555895dba2457c6b","size":16910,"symbols":[{"name":"base","kind":"constant","sha256":"9e9ae19b97ecc0a8e39a611a2fdf05b50eea3ca8b3d62da6d877aac115bc502f"},{"name":"merge","kind":"constant","sha256":"802cdd78fd6d6e80edcbbe403b9674dcc77fec25e0519d22ddd0e086850262f5"},{"name":"reason","kind":"constant","sha256":"6fa9c0baf8909b70701416a4329cee2fc55f33a52f10a67401fbb22c16c7cc43"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":2000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":318,"reverified_at":"2026-08-20T12:41:29.273Z"},"created_at":"2026-08-17T18:19:35.250Z","updated_at":"2026-08-20T12:41:29.273Z","author_branch":"release-prep"}
```

