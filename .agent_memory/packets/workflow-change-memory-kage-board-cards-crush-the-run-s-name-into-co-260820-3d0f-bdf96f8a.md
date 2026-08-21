---
type: "Workflow"
title: "Change memory: kage/board-cards-crush-the-run-s-name-into-co-260820-3d0f"
description: "Repo-local context for 16 changed repo paths on kage/board-cards-crush-the-run-s-name-into-co-260820-3d0f."
resource: "mcp/delegation/app-client.ts"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-board-cards-crush-the-run-s-name-into-co-260820-3d0f"]
timestamp: "2026-08-21T08:42:21.818Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-board-cards-crush-the-run-s-name-into-co-260820-3d0f"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation/app-client.ts", "mcp/delegation/app-styles.ts", "mcp/sessions-ui.test.ts"]
---

# Change memory: kage/board-cards-crush-the-run-s-name-into-co-260820-3d0f

> Repo-local context for 16 changed repo paths on kage/board-cards-crush-the-run-s-name-into-co-260820-3d0f.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-cardcoreatoms-run-returns-branchatom-stateatom-tokensatom-in-that-fixed-order-bo-cb0ea940.md
- .agent_memory/packets/bug_fix-the-actual-root-cause-of-the-crushed-board-card-title-was-not-font-size-or-line--aad0db2d.md
- .agent_memory/packets/bug_fix-the-vm-sandbox-test-technique-from-render-calm-test-ts-runinnewcontext-app-clien-5e64bd95.md
- .agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md
- .agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md
- .agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md
- .agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md
- .agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md
- .agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md
- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md
- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md
- .agent_memory/packets/workflow-change-memory-kage-write-if-changed-finish-the-render-calm-260820-3502-246031a1.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/delegation/app-client.ts
- mcp/delegation/app-styles.ts
- mcp/sessions-ui.test.ts

Diff summary:
```text
...m-tokensatom-in-that-fixed-order-bo-cb0ea940.md | 52 -------------
 ...rd-title-was-not-font-size-or-line--aad0db2d.md | 52 -------------
 ...m-test-ts-runinnewcontext-app-clien-5e64bd95.md | 52 -------------
 ...workflow-change-memory-release-prep-a72d4251.md | 38 ++++++---
 mcp/delegation/app-client.ts                       | 28 ++-----
 mcp/delegation/app-styles.ts                       | 28 +++----
 mcp/sessions-ui.test.ts                            | 89 ----------------------
 7 files changed, 47 insertions(+), 292 deletions(-)
.agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md | untracked
.agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md | untracked
.agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md | untracked
.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md | untracked
.agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked
.agent_memory/packets/workflow-change-memory-kage-write-if-changed-finish-the-render-calm-260820-3502-246031a1.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-board-cards-crush-the-run-s-name-into-co-260820-3d0f","title":"Change memory: kage/board-cards-crush-the-run-s-name-into-co-260820-3d0f","summary":"Repo-local context for 16 changed repo paths on kage/board-cards-crush-the-run-s-name-into-co-260820-3d0f.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-cardcoreatoms-run-returns-branchatom-stateatom-tokensatom-in-that-fixed-order-bo-cb0ea940.md\n- .agent_memory/packets/bug_fix-the-actual-root-cause-of-the-crushed-board-card-title-was-not-font-size-or-line--aad0db2d.md\n- .agent_memory/packets/bug_fix-the-vm-sandbox-test-technique-from-render-calm-test-ts-runinnewcontext-app-clien-5e64bd95.md\n- .agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md\n- .agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md\n- .agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md\n- .agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md\n- .agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md\n- .agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md\n- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md\n- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md\n- .agent_memory/packets/workflow-change-memory-kage-write-if-changed-finish-the-render-calm-260820-3502-246031a1.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/delegation/app-client.ts\n- mcp/delegation/app-styles.ts\n- mcp/sessions-ui.test.ts\n\nDiff summary:\n```text\n...m-tokensatom-in-that-fixed-order-bo-cb0ea940.md | 52 -------------\n ...rd-title-was-not-font-size-or-line--aad0db2d.md | 52 -------------\n ...m-test-ts-runinnewcontext-app-clien-5e64bd95.md | 52 -------------\n ...workflow-change-memory-release-prep-a72d4251.md | 38 ++++++---\n mcp/delegation/app-client.ts                       | 28 ++-----\n mcp/delegation/app-styles.ts                       | 28 +++----\n mcp/sessions-ui.test.ts                            | 89 ----------------------\n 7 files changed, 47 insertions(+), 292 deletions(-)\n.agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-write-if-changed-finish-the-render-calm-260820-3502-246031a1.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-board-cards-crush-the-run-s-name-into-co-260820-3d0f"],"paths":["mcp/delegation/app-client.ts","mcp/delegation/app-styles.ts","mcp/sessions-ui.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/board-cards-crush-the-run-s-name-into-co-260820-3d0f","head":"4ea7fd18d39b82fc4d8f2633df1df1c4329ef5f1","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/bug_fix-cardcoreatoms-run-returns-branchatom-stateatom-tokensatom-in-that-fixed-order-bo-cb0ea940.md",".agent_memory/packets/bug_fix-the-actual-root-cause-of-the-crushed-board-card-title-was-not-font-size-or-line--aad0db2d.md",".agent_memory/packets/bug_fix-the-vm-sandbox-test-technique-from-render-calm-test-ts-runinnewcontext-app-clien-5e64bd95.md",".agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md",".agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md",".agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md",".agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md",".agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md",".agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md",".agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md",".agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md",".agent_memory/packets/workflow-change-memory-kage-write-if-changed-finish-the-render-calm-260820-3502-246031a1.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/delegation/app-client.ts","mcp/delegation/app-styles.ts","mcp/sessions-ui.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-board-cards-crush-the-run-s-name-into-co-260820-3d0f.json"}],"context":{"fact":"Current branch kage/board-cards-crush-the-run-s-name-into-co-260820-3d0f changes 16 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-21T08:42:21.818Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/delegation/app-client.ts","sha256":"d0a0da1c3d3ca06e406bdc09b2cf71dee565c1e5b3ebb74c052298fea6362c25","size":225599},{"path":"mcp/delegation/app-styles.ts","sha256":"f8f8a3abf2123732b28846749b66e8074b4694e8a6a1311c9dfa7446251462d2","size":84897},{"path":"mcp/sessions-ui.test.ts","sha256":"090f43a454c53072d86aee0dc8cb627fb29221310ada5710f256c340fc747b71","size":45649,"symbols":[{"name":"card","kind":"constant","sha256":"77df2dee61fb634f903ed9370e34442b488c6b467b372786d35f5e6341d4d35e"},{"name":"text","kind":"constant","sha256":"e8b272c2095b4f8425c7586633e61915e7047745dad938de92030c0fb6691d80"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-cardcoreatoms-run-returns-branchatom-stateatom-tokensatom-in-that-fixed-order-bo-cb0ea940.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-the-actual-root-cause-of-the-crushed-board-card-title-was-not-font-size-or-line--aad0db2d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-the-vm-sandbox-test-technique-from-render-calm-test-ts-runinnewcontext-app-clien-5e64bd95.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-write-if-changed-finish-the-render-calm-260820-3502-246031a1.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-styles.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/sessions-ui.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/bug_fix-cardcoreatoms-run-returns-branchatom-stateatom-tokensatom-in-that-fixed-order-bo-cb0ea940.md, .agent_memory/packets/bug_fix-the-actual-root-cause-of-the-crushed-board-card-title-was-not-font-size-or-line--aad0db2d.md, .agent_memory/packets/bug_fix-the-vm-sandbox-test-technique-from-render-calm-test-ts-runinnewcontext-app-clien-5e64bd95.md"],"duplicate_candidates":[],"estimated_tokens_saved":1009,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-21T08:42:21.818Z"},"created_at":"2026-08-20T12:02:30.373Z","updated_at":"2026-08-21T08:42:21.818Z"}
```

