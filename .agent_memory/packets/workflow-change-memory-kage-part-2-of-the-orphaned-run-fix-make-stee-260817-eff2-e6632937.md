---
type: "Workflow"
title: "Change memory: kage/part-2-of-the-orphaned-run-fix-make-stee-260817-eff2"
description: "Repo-local context for 25 changed repo paths on kage/part-2-of-the-orphaned-run-fix-make-stee-260817-eff2."
resource: "mcp/delegation.test.ts"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-part-2-of-the-orphaned-run-fix-make-stee-260817-eff2"]
timestamp: "2026-08-18T05:36:36.974Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-part-2-of-the-orphaned-run-fix-make-stee-260817-eff2"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation.test.ts", "mcp/delegation/adapters/index.ts", "mcp/delegation/adapters/stub.ts", "mcp/delegation/adapters/types.ts", "mcp/delegation/steer.ts", "mcp/delegation/supervisor.ts"]
---

# Change memory: kage/part-2-of-the-orphaned-run-fix-make-stee-260817-eff2

> Repo-local context for 25 changed repo paths on kage/part-2-of-the-orphaned-run-fix-make-stee-260817-eff2.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-adapterliveinputs-sessionid-start-fresh-under-a-chosen-id-and-resumesessionid-r-f5454e15.md
- .agent_memory/packets/bug_fix-detached-supervisor-faked-verified-for-any-non-claude-agent-now-runs-the-real-ad-8879528c.md
- .agent_memory/packets/bug_fix-root-cause-of-every-orphaned-run-all-supervisors-exit-at-blocked-spec-said-hold--570ae7c2.md
- .agent_memory/packets/bug_fix-steer-jsonl-never-distinguishes-a-steer-that-was-delivered-live-from-one-that-wa-03cfe634.md
- .agent_memory/packets/bug_fix-steering-must-resume-the-same-agent-session-not-restart-a-new-one-184320ba.md
- .agent_memory/packets/bug_fix-the-transcript-pane-must-filter-to-renderable-entries-before-windowing-invisible-244787e4.md
- .agent_memory/packets/decision-the-flywheel-is-recorded-at-write-time-and-rendered-as-navigation-brief-memory-i-9920b969.md
- .agent_memory/packets/decision-the-manager-tax-17s-vs-0-1s-and-the-two-speed-composer-lying-controls-removed-0d51b076.md
- .agent_memory/packets/decision-work-is-the-one-run-surface-powers-attach-to-the-run-and-collapsing-the-doors-ex-b680d43c.md
- .agent_memory/packets/gotcha-sandboxed-agents-cannot-self-check-the-renderers-parse-gate-the-supervisor-shoul-8742918e.md
- .agent_memory/packets/gotcha-the-agent-stream-has-three-consumers-usage-capture-must-live-in-every-one-d4242a77.md
- .agent_memory/packets/negative_result-rejected-approach-fix-three-room-chat-rendering-defects-in-mcp-delegation-app-cl-b49169f0.md
- .agent_memory/packets/negative_result-rejected-approach-land-the-room-chat-rendering-fix-a-verified-content-implementa-7a94ee23.md
- .agent_memory/packets/workflow-change-memory-kage-fix-the-packaged-desktop-app-failing-to-260817-e11e-df61d340.md
- .agent_memory/packets/workflow-change-memory-kage-fix-the-root-cause-of-orphaned-runs-the-260817-7cae-dd0b0286.md
- .agent_memory/packets/workflow-change-memory-kage-fix-three-room-chat-rendering-defects-in-260817-7831-ba722fd4.md
- .agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-a-verif-260817-13cb-3dca34bc.md
- .agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-third-a-260817-2791-9584e3cf.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/delegation.test.ts
- mcp/delegation/adapters/index.ts
- mcp/delegation/adapters/stub.ts
- mcp/delegation/adapters/types.ts
- mcp/delegation/steer.ts
- mcp/delegation/supervisor.ts

Diff summary:
```text
...r-a-chosen-id-and-resumesessionid-r-f5454e15.md |  42 ---------
 ...n-claude-agent-now-runs-the-real-ad-8879528c.md |   4 +-
 ...was-delivered-live-from-one-that-wa-03cfe634.md |  42 ---------
 ...agent-session-not-restart-a-new-one-184320ba.md |   4 +-
 ...-entries-before-windowing-invisible-244787e4.md |   4 +-
 ...ndered-as-navigation-brief-memory-i-9920b969.md |   4 +-
 ...eed-composer-lying-controls-removed-0d51b076.md |   4 +-
 ...the-run-and-collapsing-the-doors-ex-b680d43c.md |   4 +-
 ...sage-capture-must-live-in-every-one-d4242a77.md |   4 +-
 ...workflow-change-memory-release-prep-a72d4251.md |  35 +++++--
 mcp/delegation.test.ts                             | 101 ++++-----------------
 mcp/delegation/adapters/index.ts                   |  38 ++++----
 mcp/delegation/adapters/stub.ts                    |  22 +----
 mcp/delegation/adapters/types.ts                   |   6 --
 mcp/delegation/steer.ts                            |  62 +++++++------
 mcp/delegation/supervisor.ts                       |  35 +------
 16 files changed, 117 insertions(+), 294 deletions(-)
.agent_memory/packets/bug_fix-root-cause-of-every-orphaned-run-all-supervisors-exit-at-blocked-spec-said-hold--570ae7c2.md | untracked
.agent_memory/packets/gotcha-sandboxed-agents-cannot-self-check-the-renderers-parse-gate-the-supervisor-shoul-8742918e.md | untracked
.agent_memory/packets/negative_result-rejected-approach-fix-three-room-chat-rendering-defects-in-mcp-delegation-app-cl-b49169f0.md | untracked
.agent_memory/packets/negative_result-rejected-approach-land-the-room-chat-rendering-fix-a-verified-content-implementa-7a94ee23.md | untracked
.agent_memory/packets/workflow-change-memory-kage-fix-the-packaged-desktop-app-failing-to-260817-e11e-df61d340.md | untracked
.agent_memory/packets/workflow-change-memory-kage-fix-the-root-cause-of-orphaned-runs-the-260817-7cae-dd0b0286.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-part-2-of-the-orphaned-run-fix-make-stee-260817-eff2","title":"Change memory: kage/part-2-of-the-orphaned-run-fix-make-stee-260817-eff2","summary":"Repo-local context for 25 changed repo paths on kage/part-2-of-the-orphaned-run-fix-make-stee-260817-eff2.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-adapterliveinputs-sessionid-start-fresh-under-a-chosen-id-and-resumesessionid-r-f5454e15.md\n- .agent_memory/packets/bug_fix-detached-supervisor-faked-verified-for-any-non-claude-agent-now-runs-the-real-ad-8879528c.md\n- .agent_memory/packets/bug_fix-root-cause-of-every-orphaned-run-all-supervisors-exit-at-blocked-spec-said-hold--570ae7c2.md\n- .agent_memory/packets/bug_fix-steer-jsonl-never-distinguishes-a-steer-that-was-delivered-live-from-one-that-wa-03cfe634.md\n- .agent_memory/packets/bug_fix-steering-must-resume-the-same-agent-session-not-restart-a-new-one-184320ba.md\n- .agent_memory/packets/bug_fix-the-transcript-pane-must-filter-to-renderable-entries-before-windowing-invisible-244787e4.md\n- .agent_memory/packets/decision-the-flywheel-is-recorded-at-write-time-and-rendered-as-navigation-brief-memory-i-9920b969.md\n- .agent_memory/packets/decision-the-manager-tax-17s-vs-0-1s-and-the-two-speed-composer-lying-controls-removed-0d51b076.md\n- .agent_memory/packets/decision-work-is-the-one-run-surface-powers-attach-to-the-run-and-collapsing-the-doors-ex-b680d43c.md\n- .agent_memory/packets/gotcha-sandboxed-agents-cannot-self-check-the-renderers-parse-gate-the-supervisor-shoul-8742918e.md\n- .agent_memory/packets/gotcha-the-agent-stream-has-three-consumers-usage-capture-must-live-in-every-one-d4242a77.md\n- .agent_memory/packets/negative_result-rejected-approach-fix-three-room-chat-rendering-defects-in-mcp-delegation-app-cl-b49169f0.md\n- .agent_memory/packets/negative_result-rejected-approach-land-the-room-chat-rendering-fix-a-verified-content-implementa-7a94ee23.md\n- .agent_memory/packets/workflow-change-memory-kage-fix-the-packaged-desktop-app-failing-to-260817-e11e-df61d340.md\n- .agent_memory/packets/workflow-change-memory-kage-fix-the-root-cause-of-orphaned-runs-the-260817-7cae-dd0b0286.md\n- .agent_memory/packets/workflow-change-memory-kage-fix-three-room-chat-rendering-defects-in-260817-7831-ba722fd4.md\n- .agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-a-verif-260817-13cb-3dca34bc.md\n- .agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-third-a-260817-2791-9584e3cf.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/delegation.test.ts\n- mcp/delegation/adapters/index.ts\n- mcp/delegation/adapters/stub.ts\n- mcp/delegation/adapters/types.ts\n- mcp/delegation/steer.ts\n- mcp/delegation/supervisor.ts\n\nDiff summary:\n```text\n...r-a-chosen-id-and-resumesessionid-r-f5454e15.md |  42 ---------\n ...n-claude-agent-now-runs-the-real-ad-8879528c.md |   4 +-\n ...was-delivered-live-from-one-that-wa-03cfe634.md |  42 ---------\n ...agent-session-not-restart-a-new-one-184320ba.md |   4 +-\n ...-entries-before-windowing-invisible-244787e4.md |   4 +-\n ...ndered-as-navigation-brief-memory-i-9920b969.md |   4 +-\n ...eed-composer-lying-controls-removed-0d51b076.md |   4 +-\n ...the-run-and-collapsing-the-doors-ex-b680d43c.md |   4 +-\n ...sage-capture-must-live-in-every-one-d4242a77.md |   4 +-\n ...workflow-change-memory-release-prep-a72d4251.md |  35 +++++--\n mcp/delegation.test.ts                             | 101 ++++-----------------\n mcp/delegation/adapters/index.ts                   |  38 ++++----\n mcp/delegation/adapters/stub.ts                    |  22 +----\n mcp/delegation/adapters/types.ts                   |   6 --\n mcp/delegation/steer.ts                            |  62 +++++++------\n mcp/delegation/supervisor.ts                       |  35 +------\n 16 files changed, 117 insertions(+), 294 deletions(-)\n.agent_memory/packets/bug_fix-root-cause-of-every-orphaned-run-all-supervisors-exit-at-blocked-spec-said-hold--570ae7c2.md | untracked\n.agent_memory/packets/gotcha-sandboxed-agents-cannot-self-check-the-renderers-parse-gate-the-supervisor-shoul-8742918e.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-fix-three-room-chat-rendering-defects-in-mcp-delegation-app-cl-b49169f0.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-land-the-room-chat-rendering-fix-a-verified-content-implementa-7a94ee23.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-fix-the-packaged-desktop-app-failing-to-260817-e11e-df61d340.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-fix-the-root-cause-of-orphaned-runs-the-260817-7cae-dd0b0286.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-fix-three-room-chat-rendering-defects-in-260817-7831-ba722fd4.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-a-verif-260817-13cb-3dca34bc.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-third-a-260817-2791-9584e3cf.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-part-2-of-the-orphaned-run-fix-make-stee-260817-eff2"],"paths":["mcp/delegation.test.ts","mcp/delegation/adapters/index.ts","mcp/delegation/adapters/stub.ts","mcp/delegation/adapters/types.ts","mcp/delegation/steer.ts","mcp/delegation/supervisor.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/part-2-of-the-orphaned-run-fix-make-stee-260817-eff2","head":"09a6ee325f309f9c704dd2115064040172bf98af","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/bug_fix-adapterliveinputs-sessionid-start-fresh-under-a-chosen-id-and-resumesessionid-r-f5454e15.md",".agent_memory/packets/bug_fix-detached-supervisor-faked-verified-for-any-non-claude-agent-now-runs-the-real-ad-8879528c.md",".agent_memory/packets/bug_fix-root-cause-of-every-orphaned-run-all-supervisors-exit-at-blocked-spec-said-hold--570ae7c2.md",".agent_memory/packets/bug_fix-steer-jsonl-never-distinguishes-a-steer-that-was-delivered-live-from-one-that-wa-03cfe634.md",".agent_memory/packets/bug_fix-steering-must-resume-the-same-agent-session-not-restart-a-new-one-184320ba.md",".agent_memory/packets/bug_fix-the-transcript-pane-must-filter-to-renderable-entries-before-windowing-invisible-244787e4.md",".agent_memory/packets/decision-the-flywheel-is-recorded-at-write-time-and-rendered-as-navigation-brief-memory-i-9920b969.md",".agent_memory/packets/decision-the-manager-tax-17s-vs-0-1s-and-the-two-speed-composer-lying-controls-removed-0d51b076.md",".agent_memory/packets/decision-work-is-the-one-run-surface-powers-attach-to-the-run-and-collapsing-the-doors-ex-b680d43c.md",".agent_memory/packets/gotcha-sandboxed-agents-cannot-self-check-the-renderers-parse-gate-the-supervisor-shoul-8742918e.md",".agent_memory/packets/gotcha-the-agent-stream-has-three-consumers-usage-capture-must-live-in-every-one-d4242a77.md",".agent_memory/packets/negative_result-rejected-approach-fix-three-room-chat-rendering-defects-in-mcp-delegation-app-cl-b49169f0.md",".agent_memory/packets/negative_result-rejected-approach-land-the-room-chat-rendering-fix-a-verified-content-implementa-7a94ee23.md",".agent_memory/packets/workflow-change-memory-kage-fix-the-packaged-desktop-app-failing-to-260817-e11e-df61d340.md",".agent_memory/packets/workflow-change-memory-kage-fix-the-root-cause-of-orphaned-runs-the-260817-7cae-dd0b0286.md",".agent_memory/packets/workflow-change-memory-kage-fix-three-room-chat-rendering-defects-in-260817-7831-ba722fd4.md",".agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-a-verif-260817-13cb-3dca34bc.md",".agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-third-a-260817-2791-9584e3cf.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/delegation.test.ts","mcp/delegation/adapters/index.ts","mcp/delegation/adapters/stub.ts","mcp/delegation/adapters/types.ts","mcp/delegation/steer.ts","mcp/delegation/supervisor.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-part-2-of-the-orphaned-run-fix-make-stee-260817-eff2.json"}],"context":{"fact":"Current branch kage/part-2-of-the-orphaned-run-fix-make-stee-260817-eff2 changes 25 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-18T05:36:36.974Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/delegation.test.ts","sha256":"84b322cd72908f47aabc3d4c8315ef7b12bc9cf466e3c6f79e12831688924340","size":77161,"symbols":[{"name":"fresh","kind":"constant","sha256":"e856ce528e47e6a7d433e4c325543b76d0ecabaf6e659d4a4b7b675262ad3715"},{"name":"memory","kind":"constant","sha256":"05501b9f634007680d5b281c889e4072fa20ef0bf3b873fe200c630f5335aec3"},{"name":"files","kind":"constant","sha256":"3874b8ffbbb4d8b4f514026d90751948bb0e5c1360d4feb8e25cf68e5968dd15"},{"name":"third","kind":"constant","sha256":"edd67d262c2bb98515cf36ffd817d72375c0d6f969d3aa00183c406d0deda428"},{"name":"room","kind":"constant","sha256":"c96a3f56d0153a4fae870a9a880b69e94c83d84117702e4748b7389be1ef9f06"},{"name":"flywheel","kind":"constant","sha256":"84b8192200199e6084d9d9c49681b9b462f8631d5ff19550410a2ca712bf0bb8"},{"name":"live","kind":"constant","sha256":"56c49d283f0e0cf7ddaebce9f105a2b5fa139b365cba224945c331cf8cb2a9ad"},{"name":"brief","kind":"constant","sha256":"a5337421433b8075f4b8604cc22d6d31025bc0f87f24a1f61ff941e5f8eb406b"},{"name":"claude","kind":"constant","sha256":"fce4e1afc8cb259603893e5262f0b94e5bdcf99a7bad1508a174e00754f6e678"},{"name":"after","kind":"constant","sha256":"b9df6f62500610198114b24b3226ae9dce1d113c45d39d582a48f4f58ddb583d"}]},{"path":"mcp/delegation/adapters/index.ts","sha256":"971ab17789d3a8b23d9d176a1995cc3239dfb38bcf6c9a1a93cb20aabe0fc82a","size":3775},{"path":"mcp/delegation/adapters/stub.ts","sha256":"8f649892a11ec7ed7b52363363dd3966592e709bc886e1a0254524c26db20cad","size":5658,"symbols":[{"name":"blocked","kind":"constant","sha256":"88f7c3ba6965be00a9e167193802691936110466c3ff65a4a906ba94769c2b8f"}]},{"path":"mcp/delegation/adapters/types.ts","sha256":"9105de42086b9a844a92cd23b5cbbbd3dc3d52316495227b59ab16d21e6fff9c","size":2660},{"path":"mcp/delegation/steer.ts","sha256":"cd068fb14fbcfabbf2b09a8fdea435921baa1355875c921f5b29e964d275d55a","size":9223,"symbols":[{"name":"live","kind":"constant","sha256":"79a3728bf6d71802ce499f6b1534dc2e830839b0283079d0367a6d21e12e264a"},{"name":"index","kind":"constant","sha256":"4f9ac98937fd4bda11e3c960113c786f03852f8e8edc53cf53ebea1852e4254d"},{"name":"delivered","kind":"constant","sha256":"d7b2f9bb15616f280091b9d38b0e7b04e921c3fca515f5cd8b2885a26c96ad38"}]},{"path":"mcp/delegation/supervisor.ts","sha256":"51bef89702295eb08664ba0ea6f80f9a59c2245d009c02c0fa0ce80326ce9f95","size":24056,"symbols":[{"name":"brief","kind":"constant","sha256":"d6f0c21082d08ce5ca0501e184cb30dff7dc321ae8ae3f48a93ed013d30ef12f"},{"name":"verification","kind":"constant","sha256":"0e8ef41a682662a3f4b76b32d9df952232c5f1493a9fb8e53946e94cbe8489d1"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-adapterliveinputs-sessionid-start-fresh-under-a-chosen-id-and-resumesessionid-r-f5454e15.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-detached-supervisor-faked-verified-for-any-non-claude-agent-now-runs-the-real-ad-8879528c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-root-cause-of-every-orphaned-run-all-supervisors-exit-at-blocked-spec-said-hold--570ae7c2.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-steer-jsonl-never-distinguishes-a-steer-that-was-delivered-live-from-one-that-wa-03cfe634.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-steering-must-resume-the-same-agent-session-not-restart-a-new-one-184320ba.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-the-transcript-pane-must-filter-to-renderable-entries-before-windowing-invisible-244787e4.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-flywheel-is-recorded-at-write-time-and-rendered-as-navigation-brief-memory-i-9920b969.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-manager-tax-17s-vs-0-1s-and-the-two-speed-composer-lying-controls-removed-0d51b076.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-work-is-the-one-run-surface-powers-attach-to-the-run-and-collapsing-the-doors-ex-b680d43c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-sandboxed-agents-cannot-self-check-the-renderers-parse-gate-the-supervisor-shoul-8742918e.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-the-agent-stream-has-three-consumers-usage-capture-must-live-in-every-one-d4242a77.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-fix-three-room-chat-rendering-defects-in-mcp-delegation-app-cl-b49169f0.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-land-the-room-chat-rendering-fix-a-verified-content-implementa-7a94ee23.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-fix-the-packaged-desktop-app-failing-to-260817-e11e-df61d340.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-fix-the-root-cause-of-orphaned-runs-the-260817-7cae-dd0b0286.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-fix-three-room-chat-rendering-defects-in-260817-7831-ba722fd4.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-a-verif-260817-13cb-3dca34bc.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-land-the-room-chat-rendering-fix-third-a-260817-2791-9584e3cf.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/bug_fix-adapterliveinputs-sessionid-start-fresh-under-a-chosen-id-and-resumesessionid-r-f5454e15.md, .agent_memory/packets/bug_fix-steer-jsonl-never-distinguishes-a-steer-that-was-delivered-live-from-one-that-wa-03cfe634.md"],"duplicate_candidates":[],"estimated_tokens_saved":1368,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-18T05:36:36.974Z"},"created_at":"2026-08-17T20:45:49.513Z","updated_at":"2026-08-18T05:36:36.974Z"}
```

