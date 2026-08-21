---
type: "Gotcha"
title: "Empty-diff feature merges are now refused — verification proves green, the merge-honesty guard proves content"
description: "A run can still reach VERIFIED with an empty diff verification re runs checks against the tree, which proves the tree is green — not that promised content exists . But since the merge honesty guard landed, mergeRun refus"
resource: "mcp/delegation/ratify.ts"
tags: ["session-learning", "merge-honesty", "empty-diff", "ratify", "verification"]
timestamp: "2026-08-21T06:28:39.664Z"
x-kage-id: "repo:https-github-com-kage-core-kage:gotcha:empty-diff-feature-merges-are-now-refused-verification-proves-green-the-merge-ho"
x-kage-type: "gotcha"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation/ratify.ts", "mcp/delegation/verify.ts"]
---

# Empty-diff feature merges are now refused — verification proves green, the merge-honesty guard proves content

> A run can still reach VERIFIED with an empty diff verification re runs checks against the tree, which proves the tree…

A run can still reach VERIFIED with an empty diff (verification re-runs checks against the tree, which proves the tree is green — not that promised content exists). But since the merge-honesty guard landed, mergeRun() refuses to merge a FEATURE run whose branch has zero commits beyond the merge-base: the refusal states the branch is empty, and the worktree is never deleted on refusal so the evidence survives. Chore-class runs may still merge with an empty diff, but the merge record must lead with "EMPTY DIFF". This replaces the older gotcha that said an empty VERIFIED merge was possible with no backstop — that hole is what lost Wave 1 of the reviewer goal (branch tip at merge-base db368cd, work deleted with the worktree at merge cleanup).
Evidence: merge-honesty guard run merged on release-prep; suite green with its refusal tests; the original empty-merge incident is recorded in the reviewer-goal run history
Verified by: mcp test suite (ratify refusal tests) run by the kernel at that run's merge

## Verification

merge-honesty guard run merged on release-prep; suite green with its refusal tests; the original empty-merge incident is recorded in the reviewer-goal run history

# Citations

[1] explicit_capture (2026-08-21T06:28:39.664Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:gotcha:empty-diff-feature-merges-are-now-refused-verification-proves-green-the-merge-ho","title":"Empty-diff feature merges are now refused — verification proves green, the merge-honesty guard proves content","summary":"A run can still reach VERIFIED with an empty diff verification re runs checks against the tree, which proves the tree is green — not that promised content exists . But since the merge honesty guard landed, mergeRun refus","body":"A run can still reach VERIFIED with an empty diff (verification re-runs checks against the tree, which proves the tree is green — not that promised content exists). But since the merge-honesty guard landed, mergeRun() refuses to merge a FEATURE run whose branch has zero commits beyond the merge-base: the refusal states the branch is empty, and the worktree is never deleted on refusal so the evidence survives. Chore-class runs may still merge with an empty diff, but the merge record must lead with \"EMPTY DIFF\". This replaces the older gotcha that said an empty VERIFIED merge was possible with no backstop — that hole is what lost Wave 1 of the reviewer goal (branch tip at merge-base db368cd, work deleted with the worktree at merge cleanup).\nEvidence: merge-honesty guard run merged on release-prep; suite green with its refusal tests; the original empty-merge incident is recorded in the reviewer-goal run history\nVerified by: mcp test suite (ratify refusal tests) run by the kernel at that run's merge","type":"gotcha","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","merge-honesty","empty-diff","ratify","verification"],"paths":["mcp/delegation/ratify.ts","mcp/delegation/verify.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T06:28:39.664Z"}],"context":{"fact":"A run can still reach VERIFIED with an empty diff (verification re-runs checks against the tree, which proves the tree is green — not that promised content exists). But since the merge-honesty guard landed, mergeRun() refuses to merge a FEATURE run whose branch has zero commits beyond the merge-base: the refusal states the branch is empty, and the worktree is never deleted on refusal so the evidence survives. Chore-class runs may still merge with an empty diff, but the merge record must lead with \"EMPTY DIFF\". This replaces the older gotcha that said an empty VERIFIED merge was possible with no backstop — that hole is what lost Wave 1 of the reviewer goal (branch tip at merge-base db368cd, work deleted with the worktree at merge cleanup).\nEvidence: merge-honesty guard run merged on release-prep; suite green with its refusal tests; the original empty-merge incident is recorded in the reviewer-goal run history\nVerified by: mcp test suite (ratify refusal tests) run by the kernel at that run's merge","verification":"merge-honesty guard run merged on release-prep; suite green with its refusal tests; the original empty-merge incident is recorded in the reviewer-goal run history"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T06:28:39.664Z","path_fingerprints":[{"path":"mcp/delegation/ratify.ts","sha256":"c60f8a79506cab1fc1b86652e6021fbdc9cd5108114687d9507d4ae5ce5d49c3","size":21643,"symbols":[{"name":"mergerun","kind":"function","sha256":"c056831f78aa4581ac190a4a9bc6fb90e700975720b18cb9aca28912c84094b7"},{"name":"base","kind":"constant","sha256":"9e9ae19b97ecc0a8e39a611a2fdf05b50eea3ca8b3d62da6d877aac115bc502f"},{"name":"merge","kind":"constant","sha256":"802cdd78fd6d6e80edcbbe403b9674dcc77fec25e0519d22ddd0e086850262f5"},{"name":"goal","kind":"constant","sha256":"36c405ce0cc807fe8080f28820adda01c58f04065acd22f2504918bbf8f8c9d5"}]},{"path":"mcp/delegation/verify.ts","sha256":"56267fb6eb6da9e32dfeaeecb861d9c2119c20f76c9750a91326d7f77276baea","size":26954,"symbols":[{"name":"base","kind":"constant","sha256":"9e9ae19b97ecc0a8e39a611a2fdf05b50eea3ca8b3d62da6d877aac115bc502f"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[{"relation":"supersedes","to":"repo:https-github-com-kage-core-kage:gotcha:a-run-can-merge-verified-with-an-empty-diff-verification-proves-the-tree-is-gree","evidence":"The merge-honesty guard closed the hole this gotcha described: feature runs with zero commits beyond merge-base are refused at merge, so the old \"can merge VERIFIED with an empty diff\" claim no longer holds unqualified.","created_at":"2026-08-21T06:28:47.722Z"}],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":253},"created_at":"2026-08-21T06:28:39.664Z","updated_at":"2026-08-21T06:28:47.722Z","author_branch":"release-prep"}
```

