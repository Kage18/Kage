---
type: "Workflow"
title: "Change memory: release/v2.0.0"
description: "Repo-local context for 2 changed repo paths on release/v2.0.0."
resource: "mcp/kernel.test.ts"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:release-v2-0-0"]
timestamp: "2026-08-14T19:07:57.106Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-release-v2-0-0"
x-kage-type: "workflow"
x-kage-status: "superseded"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "superseded"
x-kage-paths: ["mcp/kernel.test.ts", "mcp/kernel.ts"]
---

# Change memory: release/v2.0.0

> Repo-local context for 2 changed repo paths on release/v2.0.0.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- mcp/kernel.test.ts
- mcp/kernel.ts

Diff summary:
```text
...unchanged-after-skip-list-cleanup-60335e2b.json |  5 +-
 ...stale-exclusion-is-fingerprint-ba-c575beee.json |  5 +-
 ...external-tool-specific-skip-names-06a3d2bf.json |  5 +-
 ...eat-prd-memory-quality-mechanisms-a5328ec7.json |  5 +-
 ...ory-feat-v2-value-ledger-receipts-bd6d7486.json |  5 +-
 mcp/kernel.test.ts                                 | 37 +++++++++++++
 mcp/kernel.ts                                      | 61 ++++++++++++++++------
 7 files changed, 93 insertions(+), 30 deletions(-)
```

How to verify:
- Add the exact test, build, or manual verification command when you refine this memory.

Improve this packet when more context is known:
- The actual feature, fix, or refactor rationale.
- The package, API, command, or architectural pattern future agents should reuse.
- Any gotchas, follow-up risks, or branch-specific assumptions.

Promote beyond this repo only after explicit org/global review.

# Citations

[1] git_diff

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-release-v2-0-0","title":"Change memory: release/v2.0.0","summary":"Repo-local context for 2 changed repo paths on release/v2.0.0.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- mcp/kernel.test.ts\n- mcp/kernel.ts\n\nDiff summary:\n```text\n...unchanged-after-skip-list-cleanup-60335e2b.json |  5 +-\n ...stale-exclusion-is-fingerprint-ba-c575beee.json |  5 +-\n ...external-tool-specific-skip-names-06a3d2bf.json |  5 +-\n ...eat-prd-memory-quality-mechanisms-a5328ec7.json |  5 +-\n ...ory-feat-v2-value-ledger-receipts-bd6d7486.json |  5 +-\n mcp/kernel.test.ts                                 | 37 +++++++++++++\n mcp/kernel.ts                                      | 61 ++++++++++++++++------\n 7 files changed, 93 insertions(+), 30 deletions(-)\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- The package, API, command, or architectural pattern future agents should reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"superseded","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:release-v2-0-0"],"paths":["mcp/kernel.test.ts","mcp/kernel.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"release/v2.0.0","head":"761752c39ac7d15c2a516122a30cea4dcf6ee51c","merge_base":"3f579ce2ac4713958aa7ca579b6fa0ec14b6089b","changed_files":["mcp/kernel.test.ts","mcp/kernel.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-release-v2-0-0.json"}],"freshness":{"last_verified_at":"2026-08-14T19:07:57.106Z","ttl_days":180,"verification":"git_diff","path_fingerprints":[{"path":"mcp/kernel.test.ts","sha256":"39cfc5769f7abc664c408d6318c0464bd4f77a5f181baefb20f26d4b7dc8cb9a","size":306283,"symbols":[{"name":"changed","kind":"constant","sha256":"8acd4ea8821c48290e59ddcd8f60fc34f9c721f4cc2c515fcff04820d8b159cd"},{"name":"manual","kind":"constant","sha256":"f8502a2f13344d0dc48912357b32bd77516b46c56e970206fce7993703ff91bf"},{"name":"quality","kind":"constant","sha256":"06eb60954e6f50dd593cacf74246243dccea1b5754f915a9f1a036ce481e3be7"},{"name":"generated","kind":"constant","sha256":"e2b33e3e2afde3ce1606839eb1dd68ff6150d2939598d7aeeb9eee9c9e9f8a00"},{"name":"list","kind":"constant","sha256":"32590cf557c09f091328dd5f6d4a6a7b1d3b281d7c9591e10766ee3c94574dd6"}]},{"path":"mcp/kernel.ts","sha256":"7ebce3b5046d5862a8feb56af4dcf5f2671e0717dfd165b87989398ee9800196","size":878058,"symbols":[{"name":"explicit","kind":"constant","sha256":"3c7dc76a866b9617850dd05c43ef877cc5208ade5be761331cf32181ace414ff"},{"name":"verification","kind":"constant","sha256":"faeb54eb75a6e60ebcab087f39fdd9f971c8a3a16e25846647ab2dd5802748f3"},{"name":"json","kind":"constant","sha256":"f7bcd9f5ef8a5696c0f0ecbd148a4db30b52b674922455ec67a7561c86be4da4"},{"name":"cleanup","kind":"constant","sha256":"44c2ebe266676bac0e9fb42c4a64dcbb729fc44d0bfa44910463b965b8123570"},{"name":"after","kind":"constant","sha256":"220a1c1969c37d53268e215419dcea650ffa901162d0a25e451bd90831fb0a1b"},{"name":"verify","kind":"constant","sha256":"a52f5b45a4f358248075422f84ac83e7d291e8e7acb866eeabdb692896bc9c0d"},{"name":"durable","kind":"constant","sha256":"3fa48acfe2e95fa0fcf831049f2d1aa3ddf26ddc5a1d10724db5da185389e634"},{"name":"memory","kind":"constant","sha256":"952449fe9c2c8827ca2a6a85c0d0a86b82826696ff4f88ee167500678734db36"},{"name":"skip","kind":"constant","sha256":"84ce913f797ae6f1160ffe3c80d4f9852f31f1ce9c118d5e1a8be145e564b569"}]}],"superseded_at":"2026-08-17T18:22:38.892Z","superseded_by":"repo:https-github-com-kage-core-kage:workflow:change-memory-master","superseded_reason":"Newer repo memory supersedes this packet."},"edges":[{"relation":"changes_path","to":"path:mcp/kernel.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/kernel.ts","evidence":"git_diff"},{"relation":"superseded_by","to":"repo:https-github-com-kage-core-kage:workflow:change-memory-master","evidence":"Newer repo memory supersedes this packet.","created_at":"2026-08-17T18:22:38.892Z"}],"quality":{"score":86,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["possible duplicate memory"],"duplicate_candidates":[{"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-feat-tree-sitter-extraction","title":"Change memory: feat/tree-sitter-extraction","score":0.73,"status":"approved"},{"id":"repo:memory:workflow:change-memory-v2-stale-catch","title":"Change memory: v2/stale-catch","score":0.72,"status":"approved"},{"id":"repo:agent-a8e00068f536471a0:workflow:change-memory-v2-theme","title":"Change memory: v2/theme","score":0.7,"status":"approved"},{"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-master","title":"Change memory: master","score":0.61,"status":"approved"}],"estimated_tokens_saved":289,"admission":{"admit":true,"class":"candidate","score":46,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has future trigger or rationale","substantive enough to reuse"],"risks":["duplicates existing memory"]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-14T19:07:57.106Z","superseded_by":"repo:https-github-com-kage-core-kage:workflow:change-memory-master","superseded_reason":"Newer repo memory supersedes this packet.","stale":true,"stale_reasons":["packet status is superseded"],"suggested_action":"mark_stale"},"created_at":"2026-06-11T15:32:26.756Z","updated_at":"2026-08-20T20:13:09.825Z"}
```

