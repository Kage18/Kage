---
type: "Workflow"
title: "Change memory: kage/goals-must-survive-their-manager-due-wav-260820-4b39"
description: "Repo-local context for 10 changed repo paths on kage/goals-must-survive-their-manager-due-wav-260820-4b39."
resource: ".agent_memory/packets/workflow-change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39-d0f847b5.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-goals-must-survive-their-manager-due-wav-260820-4b39"]
timestamp: "2026-08-20T15:23:08.143Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/workflow-change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39-d0f847b5.md", ".agent_memory/packets/workflow-change-memory-kage-redesign-the-goal-detail-overlay-the-own-260820-2ad8-6a20b148.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md", "mcp/delegation/api.ts", "mcp/delegation/goal.ts", "mcp/delegation/manager-prompt.ts", "mcp/delegation/room-pty.ts", "mcp/delegation/room-supervisor.ts", "mcp/delegation/verify.ts", "mcp/goal-continuity.test.ts"]
---

# Change memory: kage/goals-must-survive-their-manager-due-wav-260820-4b39

> Repo-local context for 10 changed repo paths on kage/goals-must-survive-their-manager-due-wav-260820-4b39.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/workflow-change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39-d0f847b5.md
- .agent_memory/packets/workflow-change-memory-kage-redesign-the-goal-detail-overlay-the-own-260820-2ad8-6a20b148.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/delegation/api.ts
- mcp/delegation/goal.ts
- mcp/delegation/manager-prompt.ts
- mcp/delegation/room-pty.ts
- mcp/delegation/room-supervisor.ts
- mcp/delegation/verify.ts
- mcp/goal-continuity.test.ts

Diff summary:
```text
...workflow-change-memory-release-prep-a72d4251.md |  43 +--
 mcp/delegation/api.ts                              |  78 +----
 mcp/delegation/goal.ts                             |  96 ------
 mcp/delegation/manager-prompt.ts                   |  17 -
 mcp/delegation/room-pty.ts                         |  10 +-
 mcp/delegation/room-supervisor.ts                  |  12 +-
 mcp/delegation/verify.ts                           |   6 +-
 mcp/goal-continuity.test.ts                        | 343 ---------------------
 8 files changed, 23 insertions(+), 582 deletions(-)
.agent_memory/packets/workflow-change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39-d0f847b5.md | untracked
.agent_memory/packets/workflow-change-memory-kage-redesign-the-goal-detail-overlay-the-own-260820-2ad8-6a20b148.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39","title":"Change memory: kage/goals-must-survive-their-manager-due-wav-260820-4b39","summary":"Repo-local context for 10 changed repo paths on kage/goals-must-survive-their-manager-due-wav-260820-4b39.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/workflow-change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39-d0f847b5.md\n- .agent_memory/packets/workflow-change-memory-kage-redesign-the-goal-detail-overlay-the-own-260820-2ad8-6a20b148.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/delegation/api.ts\n- mcp/delegation/goal.ts\n- mcp/delegation/manager-prompt.ts\n- mcp/delegation/room-pty.ts\n- mcp/delegation/room-supervisor.ts\n- mcp/delegation/verify.ts\n- mcp/goal-continuity.test.ts\n\nDiff summary:\n```text\n...workflow-change-memory-release-prep-a72d4251.md |  43 +--\n mcp/delegation/api.ts                              |  78 +----\n mcp/delegation/goal.ts                             |  96 ------\n mcp/delegation/manager-prompt.ts                   |  17 -\n mcp/delegation/room-pty.ts                         |  10 +-\n mcp/delegation/room-supervisor.ts                  |  12 +-\n mcp/delegation/verify.ts                           |   6 +-\n mcp/goal-continuity.test.ts                        | 343 ---------------------\n 8 files changed, 23 insertions(+), 582 deletions(-)\n.agent_memory/packets/workflow-change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39-d0f847b5.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-redesign-the-goal-detail-overlay-the-own-260820-2ad8-6a20b148.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-goals-must-survive-their-manager-due-wav-260820-4b39"],"paths":[".agent_memory/packets/workflow-change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39-d0f847b5.md",".agent_memory/packets/workflow-change-memory-kage-redesign-the-goal-detail-overlay-the-own-260820-2ad8-6a20b148.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/delegation/api.ts","mcp/delegation/goal.ts","mcp/delegation/manager-prompt.ts","mcp/delegation/room-pty.ts","mcp/delegation/room-supervisor.ts","mcp/delegation/verify.ts","mcp/goal-continuity.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/goals-must-survive-their-manager-due-wav-260820-4b39","head":"cfda3031a41184dff55b8c909537980fc4dde16e","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/workflow-change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39-d0f847b5.md",".agent_memory/packets/workflow-change-memory-kage-redesign-the-goal-detail-overlay-the-own-260820-2ad8-6a20b148.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/delegation/api.ts","mcp/delegation/goal.ts","mcp/delegation/manager-prompt.ts","mcp/delegation/room-pty.ts","mcp/delegation/room-supervisor.ts","mcp/delegation/verify.ts","mcp/goal-continuity.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-goals-must-survive-their-manager-due-wav-260820-4b39.json"}],"context":{"fact":"Current branch kage/goals-must-survive-their-manager-due-wav-260820-4b39 changes 10 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T15:23:08.143Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/delegation/api.ts","sha256":"30af4be6d286f7c204e38ee72a79599e7a65a2349516e9bac8245d3f420f97d5","size":78606},{"path":"mcp/delegation/goal.ts","sha256":"ee528c53134a0b82676c5d8ce54ead03aec28dd6405c1c310204620eecacdd7f","size":21754},{"path":"mcp/delegation/manager-prompt.ts","sha256":"8fc2751009b59173b5bfa03f715a894d549e517ef50c40350d5cb4442621772a","size":8048},{"path":"mcp/delegation/room-pty.ts","sha256":"7d65bb5da050fca50174486611d85126b4d829cbf44f887550c5ffa43b38125a","size":23499},{"path":"mcp/delegation/room-supervisor.ts","sha256":"78d92419a70d835de3a0df55acbd64adc15521ec16783f1005b4eb01d9b90fc2","size":37422},{"path":"mcp/delegation/verify.ts","sha256":"862abe6b14f036221a86c82b71d9e83234404c827e2eed3d7515a6f7e71d6482","size":19211}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39-d0f847b5.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-redesign-the-goal-detail-overlay-the-own-260820-2ad8-6a20b148.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/goal.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/manager-prompt.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/room-pty.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/room-supervisor.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/verify.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/goal-continuity.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/workflow-change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39-d0f847b5.md, mcp/goal-continuity.test.ts"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: .agent_memory/packets/workflow-change-memory-kage-goals-must-survive-their-manager-due-wav-260820-4b39-d0f847b5.md, mcp/goal-continuity.test.ts"],"estimated_tokens_saved":517,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-20T15:23:08.143Z","updated_at":"2026-08-20T15:23:08.143Z"}
```

