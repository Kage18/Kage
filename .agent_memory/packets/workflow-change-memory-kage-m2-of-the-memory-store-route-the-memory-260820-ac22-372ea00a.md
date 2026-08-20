---
type: "Workflow"
title: "Change memory: kage/m2-of-the-memory-store-route-the-memory-260820-ac22"
description: "Repo-local context for 26 changed repo paths on kage/m2-of-the-memory-store-route-the-memory-260820-ac22."
resource: ".agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-m2-of-the-memory-store-route-the-memory-260820-ac22"]
timestamp: "2026-08-20T07:26:07.579Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md", ".agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md", ".agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md", ".agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md", ".agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md", ".agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md", ".agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md", ".agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md", ".agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md", "docs/design/MEMORY_STORE.md", "mcp/cli.ts", "mcp/delegation/contract.ts", "mcp/delegation/supervisor.ts", "mcp/delegation/verify.ts", "mcp/delegation/worktree-guard.ts", "mcp/kernel.ts", "mcp/meter-integrity.test.ts", "mcp/store-doc.test.ts", "mcp/store-port.test.ts", "mcp/store/json.ts", "mcp/store/manifest.ts", "mcp/store/rebuild.ts", "mcp/store/sqlite.ts", "mcp/store/types.ts", "mcp/worktree-guard.test.ts"]
---

# Change memory: kage/m2-of-the-memory-store-route-the-memory-260820-ac22

> Repo-local context for 26 changed repo paths on kage/m2-of-the-memory-store-route-the-memory-260820-ac22.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md
- .agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md
- .agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md
- .agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md
- .agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md
- .agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md
- .agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md
- .agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md
- .agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- docs/design/MEMORY_STORE.md
- mcp/cli.ts
- mcp/delegation/contract.ts
- mcp/delegation/supervisor.ts
- mcp/delegation/verify.ts
- mcp/delegation/worktree-guard.ts
- mcp/kernel.ts
- mcp/meter-integrity.test.ts
- mcp/store-doc.test.ts
- mcp/store-port.test.ts
- mcp/store/json.ts
- mcp/store/manifest.ts
- mcp/store/rebuild.ts
- mcp/store/sqlite.ts
- mcp/store/types.ts
- mcp/worktree-guard.test.ts

Diff summary:
```text
...keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md |  54 ----
 ...t-an-object-literal-fails-on-any-ex-4b0798f9.md |  54 ----
 ...side-effect-score-breakdown-usage-t-0781bbb4.md |  54 ----
 ...workflow-change-memory-release-prep-a72d4251.md |  35 +--
 docs/design/MEMORY_STORE.md                        |   2 +-
 mcp/cli.ts                                         | 104 +------
 mcp/delegation/contract.ts                         |  33 ++-
 mcp/delegation/supervisor.ts                       |   9 +-
 mcp/delegation/verify.ts                           |  56 +++-
 mcp/delegation/worktree-guard.ts                   | 111 ++++++-
 mcp/kernel.ts                                      | 196 +++++--------
 mcp/store-doc.test.ts                              |  68 +----
 mcp/store-port.test.ts                             | 321 ---------------------
 mcp/store/json.ts                                  |  53 +---
 mcp/store/manifest.ts                              |  21 +-
 mcp/store/rebuild.ts                               |  32 +-
 mcp/store/sqlite.ts                                |  95 +-----
 mcp/store/types.ts                                 |  58 +---
 mcp/worktree-guard.test.ts                         |  72 ++++-
 19 files changed, 384 insertions(+), 1044 deletions(-)
.agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md | untracked
.agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md | untracked
.agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md | untracked
.agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md | untracked
.agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md | untracked
.agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md | untracked
mcp/meter-integrity.test.ts | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22","title":"Change memory: kage/m2-of-the-memory-store-route-the-memory-260820-ac22","summary":"Repo-local context for 26 changed repo paths on kage/m2-of-the-memory-store-route-the-memory-260820-ac22.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md\n- .agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md\n- .agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md\n- .agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md\n- .agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md\n- .agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md\n- .agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md\n- .agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md\n- .agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- docs/design/MEMORY_STORE.md\n- mcp/cli.ts\n- mcp/delegation/contract.ts\n- mcp/delegation/supervisor.ts\n- mcp/delegation/verify.ts\n- mcp/delegation/worktree-guard.ts\n- mcp/kernel.ts\n- mcp/meter-integrity.test.ts\n- mcp/store-doc.test.ts\n- mcp/store-port.test.ts\n- mcp/store/json.ts\n- mcp/store/manifest.ts\n- mcp/store/rebuild.ts\n- mcp/store/sqlite.ts\n- mcp/store/types.ts\n- mcp/worktree-guard.test.ts\n\nDiff summary:\n```text\n...keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md |  54 ----\n ...t-an-object-literal-fails-on-any-ex-4b0798f9.md |  54 ----\n ...side-effect-score-breakdown-usage-t-0781bbb4.md |  54 ----\n ...workflow-change-memory-release-prep-a72d4251.md |  35 +--\n docs/design/MEMORY_STORE.md                        |   2 +-\n mcp/cli.ts                                         | 104 +------\n mcp/delegation/contract.ts                         |  33 ++-\n mcp/delegation/supervisor.ts                       |   9 +-\n mcp/delegation/verify.ts                           |  56 +++-\n mcp/delegation/worktree-guard.ts                   | 111 ++++++-\n mcp/kernel.ts                                      | 196 +++++--------\n mcp/store-doc.test.ts                              |  68 +----\n mcp/store-port.test.ts                             | 321 ---------------------\n mcp/store/json.ts                                  |  53 +---\n mcp/store/manifest.ts                              |  21 +-\n mcp/store/rebuild.ts                               |  32 +-\n mcp/store/sqlite.ts                                |  95 +-----\n mcp/store/types.ts                                 |  58 +---\n mcp/worktree-guard.test.ts                         |  72 ++++-\n 19 files changed, 384 insertions(+), 1044 deletions(-)\n.agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md | untracked\n.agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md | untracked\n.agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md | untracked\n.agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md | untracked\nmcp/meter-integrity.test.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-m2-of-the-memory-store-route-the-memory-260820-ac22"],"paths":[".agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md",".agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md",".agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md",".agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md",".agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md",".agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md",".agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md",".agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md",".agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","docs/design/MEMORY_STORE.md","mcp/cli.ts","mcp/delegation/contract.ts","mcp/delegation/supervisor.ts","mcp/delegation/verify.ts","mcp/delegation/worktree-guard.ts","mcp/kernel.ts","mcp/meter-integrity.test.ts","mcp/store-doc.test.ts","mcp/store-port.test.ts","mcp/store/json.ts","mcp/store/manifest.ts","mcp/store/rebuild.ts","mcp/store/sqlite.ts","mcp/store/types.ts","mcp/worktree-guard.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/m2-of-the-memory-store-route-the-memory-260820-ac22","head":"80c125f6ac0bf48ed00428b3822c25137cae10fe","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md",".agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md",".agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md",".agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md",".agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md",".agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md",".agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md",".agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md",".agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","docs/design/MEMORY_STORE.md","mcp/cli.ts","mcp/delegation/contract.ts","mcp/delegation/supervisor.ts","mcp/delegation/verify.ts","mcp/delegation/worktree-guard.ts","mcp/kernel.ts","mcp/meter-integrity.test.ts","mcp/store-doc.test.ts","mcp/store-port.test.ts","mcp/store/json.ts","mcp/store/manifest.ts","mcp/store/rebuild.ts","mcp/store/sqlite.ts","mcp/store/types.ts","mcp/worktree-guard.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-m2-of-the-memory-store-route-the-memory-260820-ac22.json"}],"context":{"fact":"Current branch kage/m2-of-the-memory-store-route-the-memory-260820-ac22 changes 26 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T07:26:07.579Z","ttl_days":180,"path_fingerprints":[{"path":"docs/design/MEMORY_STORE.md","sha256":"81cb8fdc437de23558863d3f065674e778ed252a3d1596c36926600cee7271ff","size":24666},{"path":"mcp/cli.ts","sha256":"ced428eb770008d5d2dcea3172f744d84030883aaddb4f0973d1a4ba6ae0f3aa","size":144857},{"path":"mcp/delegation/contract.ts","sha256":"6f0879ab432845cf0be37c4ee49be9e63888403d5b63a836c19fa0444007a8c1","size":47166},{"path":"mcp/delegation/supervisor.ts","sha256":"d8ed31b23d0078e3e8e44e233ec819b4b203ed5e0b1a47f1a4858c834f5bfd4f","size":43021},{"path":"mcp/delegation/verify.ts","sha256":"862abe6b14f036221a86c82b71d9e83234404c827e2eed3d7515a6f7e71d6482","size":19211},{"path":"mcp/delegation/worktree-guard.ts","sha256":"7e39a8a6bd3e27c8a0d039cb52c88a7ceea5334b1a2dc23cafe074ebbfdd9880","size":10510},{"path":"mcp/kernel.ts","sha256":"27cd758e51e441f03da730fdf5fe62191852dd8b5bb04bc8862411571bfcd9e9","size":899158},{"path":"mcp/meter-integrity.test.ts","sha256":"90915adeebd87303f50d0fa2bee5b05a4fb9453f084c89e6399699a2d69d8dae","size":11670},{"path":"mcp/store-doc.test.ts","sha256":"1dbd9aa0e0e90ac94051547b2f1a15237d03d7f6dd143e3907d70ec4888ed9e0","size":18171},{"path":"mcp/store/json.ts","sha256":"3159a9015eab0bd1dea3d5d576fbbd93384450c7be453a7ac8f90abd45102320","size":23532},{"path":"mcp/store/manifest.ts","sha256":"aad3e1ae2adb6cc64ff168681c6fdb5d89cc1493872e7ed41800d15a7c563661","size":3498},{"path":"mcp/store/rebuild.ts","sha256":"b0fa1804cba85c70cb4c83b112bb79ab758a76c751fb1c591fa9bba3725d15ae","size":9859},{"path":"mcp/store/sqlite.ts","sha256":"b598db33fc564b6b60ee6c7739e907de0a2f4d4e343ab82a452b9df546e62a5c","size":19727},{"path":"mcp/store/types.ts","sha256":"01a0fc3da6480ba9deefdf48e5e8520e0b2dc45db30c9498ed12d06d13e97f52","size":9610},{"path":"mcp/worktree-guard.test.ts","sha256":"6cba62b102d2aecd0917b368aa45595637d3a95b26364538c0a57b2482eb5819","size":8130}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/MEMORY_STORE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/contract.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/supervisor.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/verify.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/worktree-guard.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/kernel.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/meter-integrity.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/store-doc.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/store-port.test.ts","evidence":"git_diff"}],"quality":{"score":72,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md, .agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md, .agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md, .agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: .agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md, .agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md, .agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md, .agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md"],"estimated_tokens_saved":1105,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-20T07:26:07.579Z","updated_at":"2026-08-20T07:26:07.579Z"}
```

