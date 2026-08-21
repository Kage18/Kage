---
type: "Workflow"
title: "Change memory: kage/three-topbar-app-shell-defects-all-confi-260820-61a3"
description: "Repo-local context for 23 changed repo paths on kage/three-topbar-app-shell-defects-all-confi-260820-61a3."
resource: "mcp/delegation/app-client.ts"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-three-topbar-app-shell-defects-all-confi-260820-61a3"]
timestamp: "2026-08-20T12:42:21.903Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-three-topbar-app-shell-defects-all-confi-260820-61a3"
x-kage-type: "workflow"
x-kage-status: "deprecated"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "deprecated"
x-kage-paths: ["mcp/delegation/app-client.ts", "mcp/delegation/app-styles.ts", "mcp/delegation/room-pty.ts", "mcp/delegation/room-supervisor.ts", "mcp/narrow-layout.test.ts", "mcp/sessions-ui.test.ts", "mcp/spawn-env.test.ts"]
---

# Change memory: kage/three-topbar-app-shell-defects-all-confi-260820-61a3

> Repo-local context for 23 changed repo paths on kage/three-topbar-app-shell-defects-all-confi-260820-61a3.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-mcp-delegation-app-client-tss-api-function-had-no-status-check-at-all-before-thi-06687425.md
- .agent_memory/packets/bug_fix-mcp-delegation-app-styles-ts-already-had-one-documented-instance-of-the-missing--4d5ba4f3.md
- .agent_memory/packets/bug_fix-roomsessionmeta-native-transcript-path-is-set-only-by-room-pty-ts-the-interactiv-9fd7791d.md
- .agent_memory/packets/bug_fix-the-installed-claude-cli-2-1-235-sets-claude-code-child-session-1-on-every-child-0d8f4788.md
- .agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md
- .agent_memory/packets/workflow-change-memory-kage-board-cards-crush-the-run-s-name-into-co-260820-3d0f-bdf96f8a.md
- .agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md
- .agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md
- .agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md
- .agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md
- .agent_memory/packets/workflow-change-memory-kage-the-orchestrator-session-silently-loses-260820-5d86-1430ace7.md
- .agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md
- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md
- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md
- .agent_memory/packets/workflow-change-memory-kage-write-if-changed-finish-the-render-calm-260820-3502-246031a1.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/delegation/app-client.ts
- mcp/delegation/app-styles.ts
- mcp/delegation/room-pty.ts
- mcp/delegation/room-supervisor.ts
- mcp/narrow-layout.test.ts
- mcp/sessions-ui.test.ts
- mcp/spawn-env.test.ts

Diff summary:
```text
...d-no-status-check-at-all-before-thi-06687425.md |  51 -----
 ...documented-instance-of-the-missing--4d5ba4f3.md |  51 -----
 ...workflow-change-memory-release-prep-a72d4251.md |  42 ++--
 mcp/delegation/app-client.ts                       | 101 ++--------
 mcp/delegation/app-styles.ts                       |  28 +--
 mcp/delegation/room-pty.ts                         |   6 +-
 mcp/delegation/room-supervisor.ts                  |  33 ++-
 mcp/narrow-layout.test.ts                          |  69 +------
 mcp/sessions-ui.test.ts                            | 221 +--------------------
 9 files changed, 93 insertions(+), 509 deletions(-)
.agent_memory/packets/bug_fix-roomsessionmeta-native-transcript-path-is-set-only-by-room-pty-ts-the-interactiv-9fd7791d.md | untracked
.agent_memory/packets/bug_fix-the-installed-claude-cli-2-1-235-sets-claude-code-child-session-1-on-every-child-0d8f4788.md | untracked
.agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md | untracked
.agent_memory/packets/workflow-change-memory-kage-board-cards-crush-the-run-s-name-into-co-260820-3d0f-bdf96f8a.md | untracked
.agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md | untracked
.agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md | untracked
.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md | untracked
.agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md | untracked
.agent_memory/packets/workflow-change-memory-kage-the-orchestrator-session-silently-loses-260820-5d86-1430ace7.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked
.agent_memory/packets/workflow-change-memory-kage-write-if-changed-finish-the-render-calm-260820-3502-246031a1.md | untracked
mcp/spawn-env.test.ts | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-three-topbar-app-shell-defects-all-confi-260820-61a3","title":"Change memory: kage/three-topbar-app-shell-defects-all-confi-260820-61a3","summary":"Repo-local context for 23 changed repo paths on kage/three-topbar-app-shell-defects-all-confi-260820-61a3.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-mcp-delegation-app-client-tss-api-function-had-no-status-check-at-all-before-thi-06687425.md\n- .agent_memory/packets/bug_fix-mcp-delegation-app-styles-ts-already-had-one-documented-instance-of-the-missing--4d5ba4f3.md\n- .agent_memory/packets/bug_fix-roomsessionmeta-native-transcript-path-is-set-only-by-room-pty-ts-the-interactiv-9fd7791d.md\n- .agent_memory/packets/bug_fix-the-installed-claude-cli-2-1-235-sets-claude-code-child-session-1-on-every-child-0d8f4788.md\n- .agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md\n- .agent_memory/packets/workflow-change-memory-kage-board-cards-crush-the-run-s-name-into-co-260820-3d0f-bdf96f8a.md\n- .agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md\n- .agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md\n- .agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md\n- .agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md\n- .agent_memory/packets/workflow-change-memory-kage-the-orchestrator-session-silently-loses-260820-5d86-1430ace7.md\n- .agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md\n- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md\n- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md\n- .agent_memory/packets/workflow-change-memory-kage-write-if-changed-finish-the-render-calm-260820-3502-246031a1.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/delegation/app-client.ts\n- mcp/delegation/app-styles.ts\n- mcp/delegation/room-pty.ts\n- mcp/delegation/room-supervisor.ts\n- mcp/narrow-layout.test.ts\n- mcp/sessions-ui.test.ts\n- mcp/spawn-env.test.ts\n\nDiff summary:\n```text\n...d-no-status-check-at-all-before-thi-06687425.md |  51 -----\n ...documented-instance-of-the-missing--4d5ba4f3.md |  51 -----\n ...workflow-change-memory-release-prep-a72d4251.md |  42 ++--\n mcp/delegation/app-client.ts                       | 101 ++--------\n mcp/delegation/app-styles.ts                       |  28 +--\n mcp/delegation/room-pty.ts                         |   6 +-\n mcp/delegation/room-supervisor.ts                  |  33 ++-\n mcp/narrow-layout.test.ts                          |  69 +------\n mcp/sessions-ui.test.ts                            | 221 +--------------------\n 9 files changed, 93 insertions(+), 509 deletions(-)\n.agent_memory/packets/bug_fix-roomsessionmeta-native-transcript-path-is-set-only-by-room-pty-ts-the-interactiv-9fd7791d.md | untracked\n.agent_memory/packets/bug_fix-the-installed-claude-cli-2-1-235-sets-claude-code-child-session-1-on-every-child-0d8f4788.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-board-cards-crush-the-run-s-name-into-co-260820-3d0f-bdf96f8a.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-the-orchestrator-session-silently-loses-260820-5d86-1430ace7.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-write-if-changed-finish-the-render-calm-260820-3502-246031a1.md | untracked\nmcp/spawn-env.test.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"deprecated","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-three-topbar-app-shell-defects-all-confi-260820-61a3"],"paths":["mcp/delegation/app-client.ts","mcp/delegation/app-styles.ts","mcp/delegation/room-pty.ts","mcp/delegation/room-supervisor.ts","mcp/narrow-layout.test.ts","mcp/sessions-ui.test.ts","mcp/spawn-env.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/three-topbar-app-shell-defects-all-confi-260820-61a3","head":"0c233682beff466907e8a95ae83c3c01b68460bd","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/bug_fix-mcp-delegation-app-client-tss-api-function-had-no-status-check-at-all-before-thi-06687425.md",".agent_memory/packets/bug_fix-mcp-delegation-app-styles-ts-already-had-one-documented-instance-of-the-missing--4d5ba4f3.md",".agent_memory/packets/bug_fix-roomsessionmeta-native-transcript-path-is-set-only-by-room-pty-ts-the-interactiv-9fd7791d.md",".agent_memory/packets/bug_fix-the-installed-claude-cli-2-1-235-sets-claude-code-child-session-1-on-every-child-0d8f4788.md",".agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md",".agent_memory/packets/workflow-change-memory-kage-board-cards-crush-the-run-s-name-into-co-260820-3d0f-bdf96f8a.md",".agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md",".agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md",".agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md",".agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md",".agent_memory/packets/workflow-change-memory-kage-the-orchestrator-session-silently-loses-260820-5d86-1430ace7.md",".agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md",".agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md",".agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md",".agent_memory/packets/workflow-change-memory-kage-write-if-changed-finish-the-render-calm-260820-3502-246031a1.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/delegation/app-client.ts","mcp/delegation/app-styles.ts","mcp/delegation/room-pty.ts","mcp/delegation/room-supervisor.ts","mcp/narrow-layout.test.ts","mcp/sessions-ui.test.ts","mcp/spawn-env.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-three-topbar-app-shell-defects-all-confi-260820-61a3.json"}],"context":{"fact":"Current branch kage/three-topbar-app-shell-defects-all-confi-260820-61a3 changes 23 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:21.903Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/delegation/app-client.ts","sha256":"ded26e7b2ea02db2b4eade9056358d995b0517b8f9cf1181245a867beb33bafb","size":206711},{"path":"mcp/delegation/app-styles.ts","sha256":"c8d1bb16e765a5659d5a425df9d3e21f50cc10456d0095463a03618f21efbb77","size":76146},{"path":"mcp/delegation/room-pty.ts","sha256":"7d65bb5da050fca50174486611d85126b4d829cbf44f887550c5ffa43b38125a","size":23499,"symbols":[{"name":"child","kind":"constant","sha256":"3ab5fb302c37be191b9a3abdee54b1e037865b97e28146f74b8367e774a2868d"}]},{"path":"mcp/delegation/room-supervisor.ts","sha256":"78d92419a70d835de3a0df55acbd64adc15521ec16783f1005b4eb01d9b90fc2","size":37422,"symbols":[{"name":"next","kind":"constant","sha256":"bef68a356033cf375840d2ffe854a864ed5587cd294d8c00ed3dfbb02266d8a2"},{"name":"text","kind":"constant","sha256":"e7af38875702f0a852c1863de4847b605fb01a9a18fe5d29eb15d055eef1abfd"},{"name":"finish","kind":"function","sha256":"018175e3d971cd8dcc00e8201905207b3ea3b5083540aaeadf756cdaee540418"},{"name":"last","kind":"constant","sha256":"5144b96cc698cd41b5cf7977498656e0ba1069d57ff6858a2486e900c6f79a23"},{"name":"runs","kind":"constant","sha256":"b3d76c26b0084e0f4d3ccb5e51c8cca0860499dcbbbc5a38796cad53753a4401"}]},{"path":"mcp/narrow-layout.test.ts","sha256":"24f9ced018d59eb9425f7f7fac3730c88a49748b81ecd4a40dc19ec96a35be23","size":13200},{"path":"mcp/sessions-ui.test.ts","sha256":"cbd5be8e6e773a665a9c99ade3cc72decd0293f7ddab507d606041db83021a4a","size":32037},{"path":"mcp/spawn-env.test.ts","sha256":"a8a4248a3d088df41ac7fc380bb3f73ffc7f4f250b41204400a6e15b340ab8c5","size":2497}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-mcp-delegation-app-client-tss-api-function-had-no-status-check-at-all-before-thi-06687425.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-mcp-delegation-app-styles-ts-already-had-one-documented-instance-of-the-missing--4d5ba4f3.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-roomsessionmeta-native-transcript-path-is-set-only-by-room-pty-ts-the-interactiv-9fd7791d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-the-installed-claude-cli-2-1-235-sets-claude-code-child-session-1-on-every-child-0d8f4788.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-a-run-that-is-stopped-or-orphaned-has-no-way-back-two-runs-are-16c8fcc1.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-board-cards-crush-the-run-s-name-into-co-260820-3d0f-bdf96f8a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681-4814b132.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-kill-the-flicker-the-app-repaints-wholes-260820-d142-682ce9d4.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-the-orchestrator-session-silently-loses-260820-5d86-1430ace7.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-write-if-changed-finish-the-render-calm-260820-3502-246031a1.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-styles.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/room-pty.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/room-supervisor.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/bug_fix-mcp-delegation-app-client-tss-api-function-had-no-status-check-at-all-before-thi-06687425.md, .agent_memory/packets/bug_fix-mcp-delegation-app-styles-ts-already-had-one-documented-instance-of-the-missing--4d5ba4f3.md"],"duplicate_candidates":[],"estimated_tokens_saved":1292,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:21.903Z","stale":true,"stale_reasons":["linked path changed since memory was verified: mcp/delegation/app-client.ts, mcp/delegation/app-styles.ts, mcp/sessions-ui.test.ts"],"suggested_action":"update"},"created_at":"2026-08-20T12:36:21.208Z","updated_at":"2026-08-21T14:51:20.007Z"}
```

