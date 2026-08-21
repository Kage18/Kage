---
type: "Workflow"
title: "Change memory: kage/fix-the-root-cause-of-orphaned-runs-the-260817-7cae"
description: "Repo-local context for 16 changed repo paths on kage/fix-the-root-cause-of-orphaned-runs-the-260817-7cae."
resource: "mcp/delegation.test.ts"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-fix-the-root-cause-of-orphaned-runs-the-260817-7cae"]
timestamp: "2026-08-21T08:42:25.608Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-fix-the-root-cause-of-orphaned-runs-the-260817-7cae"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation.test.ts", "mcp/delegation/adapters/index.ts", "mcp/delegation/adapters/stub.ts", "mcp/delegation/adapters/types.ts", "mcp/delegation/supervisor.ts"]
---

# Change memory: kage/fix-the-root-cause-of-orphaned-runs-the-260817-7cae

> Repo-local context for 16 changed repo paths on kage/fix-the-root-cause-of-orphaned-runs-the-260817-7cae.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-a-pipe-write-followed-immediately-by-process-exit-in-node-is-not-guaranteed-to-f-60e32e9c.md
- .agent_memory/packets/bug_fix-root-cause-of-every-orphaned-run-all-supervisors-exit-at-blocked-spec-said-hold--570ae7c2.md
- .agent_memory/packets/bug_fix-transitionruns-legal-transition-table-forbids-a-state-transitioning-to-itself-bl-ab6ba834.md
- .agent_memory/packets/gotcha-sandboxed-agents-cannot-self-check-the-renderers-parse-gate-the-supervisor-shoul-8742918e.md
- .agent_memory/packets/negative_result-rejected-approach-fix-three-room-chat-rendering-defects-in-mcp-delegation-app-cl-b49169f0.md
- .agent_memory/packets/negative_result-rejected-approach-land-the-room-chat-rendering-fix-a-verified-content-implementa-7a94ee23.md
- .agent_memory/packets/workflow-change-memory-kage-fix-the-packaged-desktop-app-failing-to-260817-e11e-df61d340.md
- .agent_memory/packets/workflow-change-memory-kage-fix-three-room-chat-rendering-defects-in-260817-7831-ba722fd4.md
- .agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-a-verif-260817-13cb-3dca34bc.md
- .agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-third-a-260817-2791-9584e3cf.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/delegation.test.ts
- mcp/delegation/adapters/index.ts
- mcp/delegation/adapters/stub.ts
- mcp/delegation/adapters/types.ts
- mcp/delegation/supervisor.ts

Diff summary:
```text
...exit-in-node-is-not-guaranteed-to-f-60e32e9c.md |  42 ---------
 ...-a-state-transitioning-to-itself-bl-ab6ba834.md |  42 ---------
 ...workflow-change-memory-release-prep-a72d4251.md |  31 +++++--
 mcp/delegation.test.ts                             |  56 ------------
 mcp/delegation/adapters/index.ts                   |  29 +-----
 mcp/delegation/adapters/stub.ts                    |  65 +------------
 mcp/delegation/adapters/types.ts                   |  15 ---
 mcp/delegation/supervisor.ts                       | 101 +++++++++------------
 8 files changed, 71 insertions(+), 310 deletions(-)
.agent_memory/packets/bug_fix-root-cause-of-every-orphaned-run-all-supervisors-exit-at-blocked-spec-said-hold--570ae7c2.md | untracked
.agent_memory/packets/gotcha-sandboxed-agents-cannot-self-check-the-renderers-parse-gate-the-supervisor-shoul-8742918e.md | untracked
.agent_memory/packets/negative_result-rejected-approach-fix-three-room-chat-rendering-defects-in-mcp-delegation-app-cl-b49169f0.md | untracked
.agent_memory/packets/negative_result-rejected-approach-land-the-room-chat-rendering-fix-a-verified-content-implementa-7a94ee23.md | untracked
.agent_memory/packets/workflow-change-memory-kage-fix-the-packaged-desktop-app-failing-to-260817-e11e-df61d340.md | untracked
.agent_memory/packets/workflow-change-memory-kage-fix-three-room-chat-rendering-defects-in-260817-7831-ba722fd4.md | untracked
.agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-a-verif-260817-13cb-3dca34bc.md | untracked
.agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-third-a-260817-2791-9584e3cf.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-fix-the-root-cause-of-orphaned-runs-the-260817-7cae","title":"Change memory: kage/fix-the-root-cause-of-orphaned-runs-the-260817-7cae","summary":"Repo-local context for 16 changed repo paths on kage/fix-the-root-cause-of-orphaned-runs-the-260817-7cae.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-a-pipe-write-followed-immediately-by-process-exit-in-node-is-not-guaranteed-to-f-60e32e9c.md\n- .agent_memory/packets/bug_fix-root-cause-of-every-orphaned-run-all-supervisors-exit-at-blocked-spec-said-hold--570ae7c2.md\n- .agent_memory/packets/bug_fix-transitionruns-legal-transition-table-forbids-a-state-transitioning-to-itself-bl-ab6ba834.md\n- .agent_memory/packets/gotcha-sandboxed-agents-cannot-self-check-the-renderers-parse-gate-the-supervisor-shoul-8742918e.md\n- .agent_memory/packets/negative_result-rejected-approach-fix-three-room-chat-rendering-defects-in-mcp-delegation-app-cl-b49169f0.md\n- .agent_memory/packets/negative_result-rejected-approach-land-the-room-chat-rendering-fix-a-verified-content-implementa-7a94ee23.md\n- .agent_memory/packets/workflow-change-memory-kage-fix-the-packaged-desktop-app-failing-to-260817-e11e-df61d340.md\n- .agent_memory/packets/workflow-change-memory-kage-fix-three-room-chat-rendering-defects-in-260817-7831-ba722fd4.md\n- .agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-a-verif-260817-13cb-3dca34bc.md\n- .agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-third-a-260817-2791-9584e3cf.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/delegation.test.ts\n- mcp/delegation/adapters/index.ts\n- mcp/delegation/adapters/stub.ts\n- mcp/delegation/adapters/types.ts\n- mcp/delegation/supervisor.ts\n\nDiff summary:\n```text\n...exit-in-node-is-not-guaranteed-to-f-60e32e9c.md |  42 ---------\n ...-a-state-transitioning-to-itself-bl-ab6ba834.md |  42 ---------\n ...workflow-change-memory-release-prep-a72d4251.md |  31 +++++--\n mcp/delegation.test.ts                             |  56 ------------\n mcp/delegation/adapters/index.ts                   |  29 +-----\n mcp/delegation/adapters/stub.ts                    |  65 +------------\n mcp/delegation/adapters/types.ts                   |  15 ---\n mcp/delegation/supervisor.ts                       | 101 +++++++++------------\n 8 files changed, 71 insertions(+), 310 deletions(-)\n.agent_memory/packets/bug_fix-root-cause-of-every-orphaned-run-all-supervisors-exit-at-blocked-spec-said-hold--570ae7c2.md | untracked\n.agent_memory/packets/gotcha-sandboxed-agents-cannot-self-check-the-renderers-parse-gate-the-supervisor-shoul-8742918e.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-fix-three-room-chat-rendering-defects-in-mcp-delegation-app-cl-b49169f0.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-land-the-room-chat-rendering-fix-a-verified-content-implementa-7a94ee23.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-fix-the-packaged-desktop-app-failing-to-260817-e11e-df61d340.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-fix-three-room-chat-rendering-defects-in-260817-7831-ba722fd4.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-a-verif-260817-13cb-3dca34bc.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-third-a-260817-2791-9584e3cf.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-fix-the-root-cause-of-orphaned-runs-the-260817-7cae"],"paths":["mcp/delegation.test.ts","mcp/delegation/adapters/index.ts","mcp/delegation/adapters/stub.ts","mcp/delegation/adapters/types.ts","mcp/delegation/supervisor.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/fix-the-root-cause-of-orphaned-runs-the-260817-7cae","head":"9df50a71a0593c68f3f414c95382506cdc9c4d7b","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/bug_fix-a-pipe-write-followed-immediately-by-process-exit-in-node-is-not-guaranteed-to-f-60e32e9c.md",".agent_memory/packets/bug_fix-root-cause-of-every-orphaned-run-all-supervisors-exit-at-blocked-spec-said-hold--570ae7c2.md",".agent_memory/packets/bug_fix-transitionruns-legal-transition-table-forbids-a-state-transitioning-to-itself-bl-ab6ba834.md",".agent_memory/packets/gotcha-sandboxed-agents-cannot-self-check-the-renderers-parse-gate-the-supervisor-shoul-8742918e.md",".agent_memory/packets/negative_result-rejected-approach-fix-three-room-chat-rendering-defects-in-mcp-delegation-app-cl-b49169f0.md",".agent_memory/packets/negative_result-rejected-approach-land-the-room-chat-rendering-fix-a-verified-content-implementa-7a94ee23.md",".agent_memory/packets/workflow-change-memory-kage-fix-the-packaged-desktop-app-failing-to-260817-e11e-df61d340.md",".agent_memory/packets/workflow-change-memory-kage-fix-three-room-chat-rendering-defects-in-260817-7831-ba722fd4.md",".agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-a-verif-260817-13cb-3dca34bc.md",".agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-third-a-260817-2791-9584e3cf.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/delegation.test.ts","mcp/delegation/adapters/index.ts","mcp/delegation/adapters/stub.ts","mcp/delegation/adapters/types.ts","mcp/delegation/supervisor.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-fix-the-root-cause-of-orphaned-runs-the-260817-7cae.json"}],"context":{"fact":"Current branch kage/fix-the-root-cause-of-orphaned-runs-the-260817-7cae changes 16 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-21T08:42:25.608Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/delegation.test.ts","sha256":"d2c723245ac8bdbea9a3578263af3586a8846d690955408435134074cabcfe20","size":117510,"symbols":[{"name":"memory","kind":"constant","sha256":"05501b9f634007680d5b281c889e4072fa20ef0bf3b873fe200c630f5335aec3"},{"name":"files","kind":"constant","sha256":"3874b8ffbbb4d8b4f514026d90751948bb0e5c1360d4feb8e25cf68e5968dd15"},{"name":"third","kind":"constant","sha256":"edd67d262c2bb98515cf36ffd817d72375c0d6f969d3aa00183c406d0deda428"},{"name":"room","kind":"constant","sha256":"c96a3f56d0153a4fae870a9a880b69e94c83d84117702e4748b7389be1ef9f06"},{"name":"state","kind":"constant","sha256":"9ab61b8844cbc59b085101b723c75f8cc5dffc975343d4900666650f818b6ca7"},{"name":"after","kind":"constant","sha256":"b9df6f62500610198114b24b3226ae9dce1d113c45d39d582a48f4f58ddb583d"},{"name":"paths","kind":"constant","sha256":"855545c936a5a5145647a2ac5e46a769b788a6ad5cd44605512002904a6fbbd4"}]},{"path":"mcp/delegation/adapters/index.ts","sha256":"bff6da4337f1942db905b8524e68833aa9f3c67b9585ea6959e8ea8439b99c8f","size":8884},{"path":"mcp/delegation/adapters/stub.ts","sha256":"d94b48c4f218b6e3ec33b5e681f255b55a5e0622b13c606874a2462fe0c564a6","size":8093,"symbols":[{"name":"blocked","kind":"constant","sha256":"dd97e96c2c64ea99520240eac1daecec8bcda8368356062178d8dbe2f1d39e83"}]},{"path":"mcp/delegation/adapters/types.ts","sha256":"9105de42086b9a844a92cd23b5cbbbd3dc3d52316495227b59ab16d21e6fff9c","size":2660},{"path":"mcp/delegation/supervisor.ts","sha256":"d8ed31b23d0078e3e8e44e233ec819b4b203ed5e0b1a47f1a4858c834f5bfd4f","size":43021,"symbols":[{"name":"failing","kind":"constant","sha256":"47e45de2255ae0d7aaff53ad8e3895e48393fb493fbd259bd0a29ed4bb85ff77"},{"name":"state","kind":"constant","sha256":"74ff1664f384b9305eedf989c0d85f9eb9f5142fd6d024b00630476f177a9c6e"},{"name":"check","kind":"constant","sha256":"c66ffea80735db586a3cb711454818ae97c9c05b55b9a22863f1be5bdcd90ff2"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-a-pipe-write-followed-immediately-by-process-exit-in-node-is-not-guaranteed-to-f-60e32e9c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-root-cause-of-every-orphaned-run-all-supervisors-exit-at-blocked-spec-said-hold--570ae7c2.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-transitionruns-legal-transition-table-forbids-a-state-transitioning-to-itself-bl-ab6ba834.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-sandboxed-agents-cannot-self-check-the-renderers-parse-gate-the-supervisor-shoul-8742918e.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-fix-three-room-chat-rendering-defects-in-mcp-delegation-app-cl-b49169f0.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-land-the-room-chat-rendering-fix-a-verified-content-implementa-7a94ee23.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-fix-the-packaged-desktop-app-failing-to-260817-e11e-df61d340.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-fix-three-room-chat-rendering-defects-in-260817-7831-ba722fd4.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-a-verif-260817-13cb-3dca34bc.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-third-a-260817-2791-9584e3cf.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/adapters/index.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/adapters/stub.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/adapters/types.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/supervisor.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/bug_fix-a-pipe-write-followed-immediately-by-process-exit-in-node-is-not-guaranteed-to-f-60e32e9c.md, .agent_memory/packets/bug_fix-transitionruns-legal-transition-table-forbids-a-state-transitioning-to-itself-bl-ab6ba834.md"],"duplicate_candidates":[],"estimated_tokens_saved":966,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-21T08:42:25.608Z"},"created_at":"2026-08-17T20:28:05.677Z","updated_at":"2026-08-21T08:42:25.608Z"}
```

