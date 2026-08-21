---
type: "Workflow"
title: "Change memory: kage/kill-the-flicker-the-app-repaints-wholes-260820-d142"
description: "Repo-local context for 15 changed repo paths on kage/kill-the-flicker-the-app-repaints-wholes-260820-d142."
resource: "mcp/delegation/api.ts"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-kill-the-flicker-the-app-repaints-wholes-260820-d142"]
timestamp: "2026-08-20T12:42:26.571Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation/api.ts", "mcp/delegation/app-client.ts", "mcp/render-calm.test.ts"]
---

# Change memory: kage/kill-the-flicker-the-app-repaints-wholes-260820-d142

> Repo-local context for 15 changed repo paths on kage/kill-the-flicker-the-app-repaints-wholes-260820-d142.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/decision-api-tss-isbranchlanded-contract-ts-is-git-merge-base-is-ancestor-branch-head-alo-d5e9689c.md
- .agent_memory/packets/decision-comparing-gits-own-commit-date-output-ci-ct-second-precision-against-nodes-new-44e5fa5d.md
- .agent_memory/packets/decision-mcp-delegation-app-client-tss-whole-body-is-one-ts-template-literal-a-bare-backt-6a1aa588.md
- .agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md
- .agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md
- .agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md
- .agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md
- .agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md
- .agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md
- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md
- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/delegation/api.ts
- mcp/delegation/app-client.ts
- mcp/render-calm.test.ts

Diff summary:
```text
...ge-base-is-ancestor-branch-head-alo-d5e9689c.md |  57 --
 ...-second-precision-against-nodes-new-44e5fa5d.md |  57 --
 ...ne-ts-template-literal-a-bare-backt-6a1aa588.md |  57 --
 ...workflow-change-memory-release-prep-a72d4251.md |  32 +-
 mcp/delegation/api.ts                              |  80 +--
 mcp/delegation/app-client.ts                       | 647 ++++-----------------
 mcp/render-calm.test.ts                            | 540 -----------------
 7 files changed, 159 insertions(+), 1311 deletions(-)
.agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md | untracked
.agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md | untracked
.agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md | untracked
.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md | untracked
.agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked
```

How to verify:
- Add the exact test, build, or manual verification command when you refine this memory.

Improve this packet when more context is known:
- The actual feature, fix, or refactor rationale.
- Why the change was made, including relevant bugs, issues, decisions, and code explanations.
- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.
- Any gotchas, follow-up risks, or branch-specific assumptions.

Promote beyond this repo only after explicit org/global review.

## Why

Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.

## Trigger

Recall when asking what changed on this branch, preparing a PR review, or resuming this work.

## Action

Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.

## Verification

Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.

## Risk if forgotten

Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.

## Stale when

The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it.

# Citations

[1] git_diff

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142","title":"Change memory: kage/kill-the-flicker-the-app-repaints-wholes-260820-d142","summary":"Repo-local context for 15 changed repo paths on kage/kill-the-flicker-the-app-repaints-wholes-260820-d142.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-api-tss-isbranchlanded-contract-ts-is-git-merge-base-is-ancestor-branch-head-alo-d5e9689c.md\n- .agent_memory/packets/decision-comparing-gits-own-commit-date-output-ci-ct-second-precision-against-nodes-new-44e5fa5d.md\n- .agent_memory/packets/decision-mcp-delegation-app-client-tss-whole-body-is-one-ts-template-literal-a-bare-backt-6a1aa588.md\n- .agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md\n- .agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md\n- .agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md\n- .agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md\n- .agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md\n- .agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md\n- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md\n- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/delegation/api.ts\n- mcp/delegation/app-client.ts\n- mcp/render-calm.test.ts\n\nDiff summary:\n```text\n...ge-base-is-ancestor-branch-head-alo-d5e9689c.md |  57 --\n ...-second-precision-against-nodes-new-44e5fa5d.md |  57 --\n ...ne-ts-template-literal-a-bare-backt-6a1aa588.md |  57 --\n ...workflow-change-memory-release-prep-a72d4251.md |  32 +-\n mcp/delegation/api.ts                              |  80 +--\n mcp/delegation/app-client.ts                       | 647 ++++-----------------\n mcp/render-calm.test.ts                            | 540 -----------------\n 7 files changed, 159 insertions(+), 1311 deletions(-)\n.agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-kill-the-flicker-the-app-repaints-wholes-260820-d142"],"paths":["mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/render-calm.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/kill-the-flicker-the-app-repaints-wholes-260820-d142","head":"64f451228623344243e1f42a435192d1f4bedfe4","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/decision-api-tss-isbranchlanded-contract-ts-is-git-merge-base-is-ancestor-branch-head-alo-d5e9689c.md",".agent_memory/packets/decision-comparing-gits-own-commit-date-output-ci-ct-second-precision-against-nodes-new-44e5fa5d.md",".agent_memory/packets/decision-mcp-delegation-app-client-tss-whole-body-is-one-ts-template-literal-a-bare-backt-6a1aa588.md",".agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md",".agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md",".agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md",".agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md",".agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md",".agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md",".agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md",".agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/render-calm.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142.json"}],"context":{"fact":"Current branch kage/kill-the-flicker-the-app-repaints-wholes-260820-d142 changes 15 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:26.571Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/delegation/api.ts","sha256":"30af4be6d286f7c204e38ee72a79599e7a65a2349516e9bac8245d3f420f97d5","size":78606,"symbols":[{"name":"close","kind":"method","sha256":"70140f1062e6e026deac4140ca1d95da072486787ca1c8feee4282139aef0656"},{"name":"text","kind":"constant","sha256":"c821f21e865b5862788006905c0f4fd09dd7ef6d223fcf2c505033203d6555aa"},{"name":"files","kind":"constant","sha256":"10f5a322e356009fe3570a8b1fc93b0e50f550074efda18f91eb7ba5b0cd7445"},{"name":"change","kind":"constant","sha256":"b3e774e47224ceab04308a4b2408fdc25f84082e73ac544f4f45949d63ca929f"},{"name":"runs","kind":"constant","sha256":"aeed515a96dc123ddceac928842184b148f9bbd85f63bccbb0918926221c95e2"},{"name":"packet","kind":"constant","sha256":"e71a4806ab105f9413aed2fb80d62995b29b2c809b72ebecbfeb144a235fbfa9"},{"name":"sessions","kind":"constant","sha256":"3d4a2d3fc1f138336c68efb9fbe54682c1988896a4bf62fe2b334060e952f309"},{"name":"agent","kind":"constant","sha256":"73eaaefa603f1faada136a1ce30a9c4bb4443c8e5a7f71bfcd673cf695bda208"},{"name":"current","kind":"constant","sha256":"9c4cd387881f26f6987d035a16dca7885b8f9aaedb8ca13696be65c344bf840a"}]},{"path":"mcp/delegation/app-client.ts","sha256":"ded26e7b2ea02db2b4eade9056358d995b0517b8f9cf1181245a867beb33bafb","size":206711},{"path":"mcp/render-calm.test.ts","sha256":"0f661419f597b68cc90898beb8c0962031a1b4385b6eb11b4845fb6b08d16361","size":33274,"symbols":[{"name":"from","kind":"constant","sha256":"065163bf37492fa85215c8e7227dd10049d7371eb08c5f1b1846e82a28c76ac8"},{"name":"body","kind":"constant","sha256":"6f960456940e1b98ef0d4f7e8390d6faf1a6a84a55d4ff30103c2e4486a573e5"},{"name":"second","kind":"constant","sha256":"f4d32e8185646657593f2a004a0e755187469b1f0319e3d197f120d137ef02f0"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-api-tss-isbranchlanded-contract-ts-is-git-merge-base-is-ancestor-branch-head-alo-d5e9689c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-comparing-gits-own-commit-date-output-ci-ct-second-precision-against-nodes-new-44e5fa5d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-delegation-app-client-tss-whole-body-is-one-ts-template-literal-a-bare-backt-6a1aa588.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/render-calm.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-api-tss-isbranchlanded-contract-ts-is-git-merge-base-is-ancestor-branch-head-alo-d5e9689c.md, .agent_memory/packets/decision-comparing-gits-own-commit-date-output-ci-ct-second-precision-against-nodes-new-44e5fa5d.md, .agent_memory/packets/decision-mcp-delegation-app-client-tss-whole-body-is-one-ts-template-literal-a-bare-backt-6a1aa588.md, .agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md"],"duplicate_candidates":[],"estimated_tokens_saved":941,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:26.571Z","stale":true,"stale_reasons":["linked path changed since memory was verified: mcp/delegation/app-client.ts"],"suggested_action":"update"},"created_at":"2026-08-20T11:00:04.803Z","updated_at":"2026-08-20T20:13:09.801Z"}
```

