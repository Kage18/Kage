---
type: "Convention"
title: "This repo is built through its own delegation loop: dispatch, verify, merge — the operator does not hand-edit"
description: "Standing convention from the owner 2026 08 17 : work on the Kage repo is done USING Kage. Code changes are dispatched as runs kage dispatch / the Room / POST /runs , the agent works in a worktree, the kernel re executes"
resource: "CLAUDE.md"
tags: ["session-learning", "dogfood", "workflow", "delegation", "operator"]
timestamp: "2026-08-17T18:19:35.250Z"
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:convention:this-repo-is-built-through-its-own-delegation-loop-dispatch-verify-merge-the-ope","title":"This repo is built through its own delegation loop: dispatch, verify, merge — the operator does not hand-edit","summary":"Standing convention from the owner 2026 08 17 : work on the Kage repo is done USING Kage. Code changes are dispatched as runs kage dispatch / the Room / POST /runs , the agent works in a worktree, the kernel re executes","body":"Standing convention from the owner (2026-08-17): work on the Kage repo is done USING Kage. Code changes are dispatched as runs (kage dispatch / the Room / POST /runs), the agent works in a worktree, the kernel re-executes the checks, and the operator reviews the receipt, diff, and blast radius before kage merge lands code and ratifies learnings. Rejections carry reasons because reasons become memory. Two honesty rules for operating the loop: a receipt's checks ran against the RUN'S branch tree, so when the base has moved since dispatch, re-run the test command after merging before trusting the merged tree; and a run whose base is many commits stale on files that changed underneath it is usually better rejected-with-reason and re-dispatched on current HEAD than merged. Memory curation (kage conflicts, supersede, reverify, feedback) and daemon operations remain direct operator acts — they are Kage. Bootstrap exception: when a Kage bug blocks dispatching the fix for that very bug, fix the minimum directly and record why.\nEvidence: Owner directive in session, 2026-08-17: \"from here on all the work that you do, should be done using the kage.\"\nVerified by: Owner instruction; loop mechanics verified across this session (562→567 tests, receipts, ratification).","type":"convention","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","dogfood","workflow","delegation","operator"],"paths":["CLAUDE.md","mcp/delegation/dispatch.ts","mcp/delegation/ratify.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-17T18:19:35.250Z"}],"context":{"fact":"Standing convention from the owner (2026-08-17): work on the Kage repo is done USING Kage. Code changes are dispatched as runs (kage dispatch / the Room / POST /runs), the agent works in a worktree, the kernel re-executes the checks, and the operator reviews the receipt, diff, and blast radius before kage merge lands code and ratifies learnings. Rejections carry reasons because reasons become memory. Two honesty rules for operating the loop: a receipt's checks ran against the RUN'S branch tree, so when the base has moved since dispatch, re-run the test command after merging before trusting the merged tree; and a run whose base is many commits stale on files that changed underneath it is usually better rejected-with-reason and re-dispatched on current HEAD than merged. Memory curation (kage conflicts, supersede, reverify, feedback) and daemon operations remain direct operator acts — they are Kage. Bootstrap exception: when a Kage bug blocks dispatching the fix for that very bug, fix the minimum directly and record why.\nEvidence: Owner directive in session, 2026-08-17: \"from here on all the work that you do, should be done using the kage.\"\nVerified by: Owner instruction; loop mechanics verified across this session (562→567 tests, receipts, ratification).","verification":"Owner directive in session, 2026-08-17: \"from here on all the work that you do, should be done using the kage.\""},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-17T18:19:35.250Z","path_fingerprints":[{"path":"CLAUDE.md","sha256":"5f01e2bd75f79da22153e806c95aa4bc69dc2d8f1f5df0a3e242b15dab4f737d","size":4862},{"path":"mcp/delegation/dispatch.ts","sha256":"586f9f02f1ca07b6a7db9a30559631f0f9faacf4cfbd276f5919fd318a4ac542","size":11608,"symbols":[{"name":"worktree","kind":"constant","sha256":"0d337a9939de05272f55ff66c5ee11f4ef58ab4589d71335c0518092a3f9dabf"}]},{"path":"mcp/delegation/ratify.ts","sha256":"4474d69c9e566083fea1a618644e49a7a3576eb7936e294a766ddd60e78a84e8","size":8431,"symbols":[{"name":"worktree","kind":"constant","sha256":"0d337a9939de05272f55ff66c5ee11f4ef58ab4589d71335c0518092a3f9dabf"},{"name":"base","kind":"constant","sha256":"9e9ae19b97ecc0a8e39a611a2fdf05b50eea3ca8b3d62da6d877aac115bc502f"},{"name":"merge","kind":"constant","sha256":"802cdd78fd6d6e80edcbbe403b9674dcc77fec25e0519d22ddd0e086850262f5"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":2000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":318},"created_at":"2026-08-17T18:19:35.250Z","updated_at":"2026-08-17T18:19:35.250Z","author_branch":"release-prep"}
```

