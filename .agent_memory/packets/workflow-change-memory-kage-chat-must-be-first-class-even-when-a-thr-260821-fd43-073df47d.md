---
type: "Workflow"
title: "Change memory: kage/chat-must-be-first-class-even-when-a-thr-260821-fd43"
description: "Repo-local context for 13 changed repo paths on kage/chat-must-be-first-class-even-when-a-thr-260821-fd43."
resource: ".agent_memory/packets/bug_fix-existing-test-mcp-room-unified-session-test-tss-resolveroomreply-routes-a-messag-7ba291b7.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-chat-must-be-first-class-even-when-a-thr-260821-fd43"]
timestamp: "2026-08-21T16:20:39.870Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-chat-must-be-first-class-even-when-a-thr-260821-fd43"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/bug_fix-existing-test-mcp-room-unified-session-test-tss-resolveroomreply-routes-a-messag-7ba291b7.md", ".agent_memory/packets/bug_fix-room-actions-tss-kageactionkind-requires-two-edits-to-add-a-new-kind-the-typescr-1cd09461.md", ".agent_memory/packets/bug_fix-superviseroompty-mcp-delegation-room-pty-ts-writes-session-identity-session-id-n-04f05f41.md", ".agent_memory/packets/workflow-change-memory-kage-board-zone-headers-regressed-visually-af-260821-2a19-a1bea755.md", ".agent_memory/packets/workflow-change-memory-kage-make-the-room-chat-interactable-the-owne-260821-b0e0-929cb245.md", ".agent_memory/packets/workflow-change-memory-kage-the-room-manager-can-end-a-turn-with-emp-260821-f383-f48cae94.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md", "mcp/chat-must-be-first.test.ts", "mcp/delegation/api.ts", "mcp/delegation/app-client.ts", "mcp/delegation/room-actions.ts", "mcp/delegation/room-transcript.ts", "mcp/room-unified-session.test.ts"]
---

# Change memory: kage/chat-must-be-first-class-even-when-a-thr-260821-fd43

> Repo-local context for 13 changed repo paths on kage/chat-must-be-first-class-even-when-a-thr-260821-fd43.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-existing-test-mcp-room-unified-session-test-tss-resolveroomreply-routes-a-messag-7ba291b7.md
- .agent_memory/packets/bug_fix-room-actions-tss-kageactionkind-requires-two-edits-to-add-a-new-kind-the-typescr-1cd09461.md
- .agent_memory/packets/bug_fix-superviseroompty-mcp-delegation-room-pty-ts-writes-session-identity-session-id-n-04f05f41.md
- .agent_memory/packets/workflow-change-memory-kage-board-zone-headers-regressed-visually-af-260821-2a19-a1bea755.md
- .agent_memory/packets/workflow-change-memory-kage-make-the-room-chat-interactable-the-owne-260821-b0e0-929cb245.md
- .agent_memory/packets/workflow-change-memory-kage-the-room-manager-can-end-a-turn-with-emp-260821-f383-f48cae94.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/chat-must-be-first.test.ts
- mcp/delegation/api.ts
- mcp/delegation/app-client.ts
- mcp/delegation/room-actions.ts
- mcp/delegation/room-transcript.ts
- mcp/room-unified-session.test.ts

Diff summary:
```text
...ss-resolveroomreply-routes-a-messag-7ba291b7.md |  42 ----
 ...edits-to-add-a-new-kind-the-typescr-1cd09461.md |  42 ----
 ...rites-session-identity-session-id-n-04f05f41.md |  42 ----
 ...workflow-change-memory-release-prep-a72d4251.md |  24 +--
 mcp/chat-must-be-first.test.ts                     | 214 ---------------------
 mcp/delegation/api.ts                              |  60 ++----
 mcp/delegation/app-client.ts                       |   4 -
 mcp/delegation/room-actions.ts                     |  15 +-
 mcp/delegation/room-transcript.ts                  |  32 ---
 mcp/room-unified-session.test.ts                   |   5 -
 10 files changed, 30 insertions(+), 450 deletions(-)
.agent_memory/packets/workflow-change-memory-kage-board-zone-headers-regressed-visually-af-260821-2a19-a1bea755.md | untracked
.agent_memory/packets/workflow-change-memory-kage-make-the-room-chat-interactable-the-owne-260821-b0e0-929cb245.md | untracked
.agent_memory/packets/workflow-change-memory-kage-the-room-manager-can-end-a-turn-with-emp-260821-f383-f48cae94.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-chat-must-be-first-class-even-when-a-thr-260821-fd43","title":"Change memory: kage/chat-must-be-first-class-even-when-a-thr-260821-fd43","summary":"Repo-local context for 13 changed repo paths on kage/chat-must-be-first-class-even-when-a-thr-260821-fd43.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-existing-test-mcp-room-unified-session-test-tss-resolveroomreply-routes-a-messag-7ba291b7.md\n- .agent_memory/packets/bug_fix-room-actions-tss-kageactionkind-requires-two-edits-to-add-a-new-kind-the-typescr-1cd09461.md\n- .agent_memory/packets/bug_fix-superviseroompty-mcp-delegation-room-pty-ts-writes-session-identity-session-id-n-04f05f41.md\n- .agent_memory/packets/workflow-change-memory-kage-board-zone-headers-regressed-visually-af-260821-2a19-a1bea755.md\n- .agent_memory/packets/workflow-change-memory-kage-make-the-room-chat-interactable-the-owne-260821-b0e0-929cb245.md\n- .agent_memory/packets/workflow-change-memory-kage-the-room-manager-can-end-a-turn-with-emp-260821-f383-f48cae94.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/chat-must-be-first.test.ts\n- mcp/delegation/api.ts\n- mcp/delegation/app-client.ts\n- mcp/delegation/room-actions.ts\n- mcp/delegation/room-transcript.ts\n- mcp/room-unified-session.test.ts\n\nDiff summary:\n```text\n...ss-resolveroomreply-routes-a-messag-7ba291b7.md |  42 ----\n ...edits-to-add-a-new-kind-the-typescr-1cd09461.md |  42 ----\n ...rites-session-identity-session-id-n-04f05f41.md |  42 ----\n ...workflow-change-memory-release-prep-a72d4251.md |  24 +--\n mcp/chat-must-be-first.test.ts                     | 214 ---------------------\n mcp/delegation/api.ts                              |  60 ++----\n mcp/delegation/app-client.ts                       |   4 -\n mcp/delegation/room-actions.ts                     |  15 +-\n mcp/delegation/room-transcript.ts                  |  32 ---\n mcp/room-unified-session.test.ts                   |   5 -\n 10 files changed, 30 insertions(+), 450 deletions(-)\n.agent_memory/packets/workflow-change-memory-kage-board-zone-headers-regressed-visually-af-260821-2a19-a1bea755.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-make-the-room-chat-interactable-the-owne-260821-b0e0-929cb245.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-the-room-manager-can-end-a-turn-with-emp-260821-f383-f48cae94.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-chat-must-be-first-class-even-when-a-thr-260821-fd43"],"paths":[".agent_memory/packets/bug_fix-existing-test-mcp-room-unified-session-test-tss-resolveroomreply-routes-a-messag-7ba291b7.md",".agent_memory/packets/bug_fix-room-actions-tss-kageactionkind-requires-two-edits-to-add-a-new-kind-the-typescr-1cd09461.md",".agent_memory/packets/bug_fix-superviseroompty-mcp-delegation-room-pty-ts-writes-session-identity-session-id-n-04f05f41.md",".agent_memory/packets/workflow-change-memory-kage-board-zone-headers-regressed-visually-af-260821-2a19-a1bea755.md",".agent_memory/packets/workflow-change-memory-kage-make-the-room-chat-interactable-the-owne-260821-b0e0-929cb245.md",".agent_memory/packets/workflow-change-memory-kage-the-room-manager-can-end-a-turn-with-emp-260821-f383-f48cae94.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/chat-must-be-first.test.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/room-actions.ts","mcp/delegation/room-transcript.ts","mcp/room-unified-session.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/chat-must-be-first-class-even-when-a-thr-260821-fd43","head":"79f5255dc4e5ab117fb6d5e5c0643649fe47ecd3","merge_base":"a7d95d97499c28919013a3e13b7216ae89b7f51d","changed_files":[".agent_memory/packets/bug_fix-existing-test-mcp-room-unified-session-test-tss-resolveroomreply-routes-a-messag-7ba291b7.md",".agent_memory/packets/bug_fix-room-actions-tss-kageactionkind-requires-two-edits-to-add-a-new-kind-the-typescr-1cd09461.md",".agent_memory/packets/bug_fix-superviseroompty-mcp-delegation-room-pty-ts-writes-session-identity-session-id-n-04f05f41.md",".agent_memory/packets/workflow-change-memory-kage-board-zone-headers-regressed-visually-af-260821-2a19-a1bea755.md",".agent_memory/packets/workflow-change-memory-kage-make-the-room-chat-interactable-the-owne-260821-b0e0-929cb245.md",".agent_memory/packets/workflow-change-memory-kage-the-room-manager-can-end-a-turn-with-emp-260821-f383-f48cae94.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/chat-must-be-first.test.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/room-actions.ts","mcp/delegation/room-transcript.ts","mcp/room-unified-session.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-chat-must-be-first-class-even-when-a-thr-260821-fd43.json"}],"context":{"fact":"Current branch kage/chat-must-be-first-class-even-when-a-thr-260821-fd43 changes 13 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-21T16:20:39.870Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/delegation/api.ts","sha256":"3602a09963caac0df4835c377e9346a00b4bb8d39a6d899e4d5342c41c0635a8","size":91732},{"path":"mcp/delegation/app-client.ts","sha256":"3db880c8af62c1c78761cbcb185e82dbd36891c9bdc91a38593b97afb357b45f","size":238329},{"path":"mcp/delegation/room-actions.ts","sha256":"09927e0232957238ca9edd21370e497f4dd353fdf1694d5efb78a283a4cb7129","size":4832},{"path":"mcp/delegation/room-transcript.ts","sha256":"a08988f64e8811e61c826816d26e4a4b88e53f5a2af4ae5f06f9329fdaed149c","size":9128},{"path":"mcp/room-unified-session.test.ts","sha256":"cb02e7292e12fb30319e75bef6722ea5e8b9148f6b18ef8d7749d9d72d326540","size":18394}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-existing-test-mcp-room-unified-session-test-tss-resolveroomreply-routes-a-messag-7ba291b7.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-room-actions-tss-kageactionkind-requires-two-edits-to-add-a-new-kind-the-typescr-1cd09461.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-superviseroompty-mcp-delegation-room-pty-ts-writes-session-identity-session-id-n-04f05f41.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-board-zone-headers-regressed-visually-af-260821-2a19-a1bea755.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-make-the-room-chat-interactable-the-owne-260821-b0e0-929cb245.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-the-room-manager-can-end-a-turn-with-emp-260821-f383-f48cae94.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/chat-must-be-first.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/room-actions.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/room-transcript.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/room-unified-session.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/bug_fix-existing-test-mcp-room-unified-session-test-tss-resolveroomreply-routes-a-messag-7ba291b7.md, .agent_memory/packets/bug_fix-room-actions-tss-kageactionkind-requires-two-edits-to-add-a-new-kind-the-typescr-1cd09461.md, .agent_memory/packets/bug_fix-superviseroompty-mcp-delegation-room-pty-ts-writes-session-identity-session-id-n-04f05f41.md, mcp/chat-must-be-first.test.ts"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: .agent_memory/packets/bug_fix-existing-test-mcp-room-unified-session-test-tss-resolveroomreply-routes-a-messag-7ba291b7.md, .agent_memory/packets/bug_fix-room-actions-tss-kageactionkind-requires-two-edits-to-add-a-new-kind-the-typescr-1cd09461.md, .agent_memory/packets/bug_fix-superviseroompty-mcp-delegation-room-pty-ts-writes-session-identity-session-id-n-04f05f41.md, mcp/chat-must-be-first.test.ts"],"estimated_tokens_saved":700,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-21T16:20:39.870Z","updated_at":"2026-08-21T16:20:39.870Z"}
```

