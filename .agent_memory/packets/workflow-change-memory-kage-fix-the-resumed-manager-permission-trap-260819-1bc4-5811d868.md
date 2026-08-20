---
type: "Workflow"
title: "Change memory: kage/fix-the-resumed-manager-permission-trap-260819-1bc4"
description: "Repo-local context for 37 changed repo paths on kage/fix-the-resumed-manager-permission-trap-260819-1bc4."
resource: ".agent_memory/packets/bug_fix-a-pipe-write-followed-immediately-by-process-exit-in-node-is-not-guaranteed-to-f-60e32e9c.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-fix-the-resumed-manager-permission-trap-260819-1bc4"]
timestamp: "2026-08-19T19:18:45.195Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-fix-the-resumed-manager-permission-trap-260819-1bc4"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/bug_fix-a-pipe-write-followed-immediately-by-process-exit-in-node-is-not-guaranteed-to-f-60e32e9c.md", ".agent_memory/packets/bug_fix-adapterliveinputs-sessionid-start-fresh-under-a-chosen-id-and-resumesessionid-r-f5454e15.md", ".agent_memory/packets/bug_fix-cli-dispatched-runs-now-detach-and-survive-the-launching-shell-41d79cdc.md", ".agent_memory/packets/bug_fix-npm-test-prefix-mcp-and-node-e-npx-are-denied-by-this-sandboxs-command-approv-7d0edd52.md", ".agent_memory/packets/decision-a-result-stream-events-in-memory-signals-this-lines-own-fence-state-waiting-are-32d4a3e6.md", ".agent_memory/packets/gotcha-a-cli-dispatched-run-dies-with-the-shell-that-launched-it-no-supervisor-pid-no-d-900a4cc5.md", ".agent_memory/packets/gotcha-a-runs-build-can-escape-its-worktree-into-the-main-checkouts-dist-and-a-supervis-f601e41c.md", ".agent_memory/packets/gotcha-hired-agents-can-run-npm-node-npx-the-earlier-sandbox-denies-commands-reading-wa-adfd2eb2.md", ".agent_memory/packets/gotcha-kage-reverify-re-checks-a-claim-not-a-worktree-its-help-text-promises-the-worktr-d5e7c0e6.md", ".agent_memory/packets/workflow-change-memory-kage-a-run-that-is-stopped-or-orphaned-has-no-260819-4e38-815f0b8d.md", ".agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md", ".agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md", ".agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md", ".agent_memory/packets/workflow-change-memory-kage-make-the-receipt-the-thing-people-notice-260819-419c-a183d6bc.md", ".agent_memory/packets/workflow-change-memory-kage-the-predicted-touch-set-is-uncorrelated-260819-ecbd-62eaf1c2.md", ".agent_memory/packets/workflow-change-memory-kage-the-storefront-still-sells-the-old-produ-260819-54fc-08303802.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md", "README.md", "mcp/cli.ts", "mcp/delegation/api.ts", "mcp/delegation/brief.ts", "mcp/delegation/checks.ts", "mcp/delegation/contract.ts", "mcp/delegation/dispatch.ts", "mcp/delegation/preflight.ts", "mcp/delegation/recovery.ts", "mcp/delegation/room-pty.ts", "mcp/delegation/room-supervisor.ts", "mcp/delegation/supervisor.ts", "mcp/delegation/verify.ts", "mcp/delegation/worktree-guard.ts", "mcp/readme-claims.test.ts", "mcp/resume-budgets.test.ts", "mcp/room-permission-trap.test.ts", "mcp/run-recovery.test.ts", "mcp/touch-set.test.ts", "mcp/worktree-guard.test.ts"]
---

# Change memory: kage/fix-the-resumed-manager-permission-trap-260819-1bc4

> Repo-local context for 37 changed repo paths on kage/fix-the-resumed-manager-permission-trap-260819-1bc4.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-a-pipe-write-followed-immediately-by-process-exit-in-node-is-not-guaranteed-to-f-60e32e9c.md
- .agent_memory/packets/bug_fix-adapterliveinputs-sessionid-start-fresh-under-a-chosen-id-and-resumesessionid-r-f5454e15.md
- .agent_memory/packets/bug_fix-cli-dispatched-runs-now-detach-and-survive-the-launching-shell-41d79cdc.md
- .agent_memory/packets/bug_fix-npm-test-prefix-mcp-and-node-e-npx-are-denied-by-this-sandboxs-command-approv-7d0edd52.md
- .agent_memory/packets/decision-a-result-stream-events-in-memory-signals-this-lines-own-fence-state-waiting-are-32d4a3e6.md
- .agent_memory/packets/gotcha-a-cli-dispatched-run-dies-with-the-shell-that-launched-it-no-supervisor-pid-no-d-900a4cc5.md
- .agent_memory/packets/gotcha-a-runs-build-can-escape-its-worktree-into-the-main-checkouts-dist-and-a-supervis-f601e41c.md
- .agent_memory/packets/gotcha-hired-agents-can-run-npm-node-npx-the-earlier-sandbox-denies-commands-reading-wa-adfd2eb2.md
- .agent_memory/packets/gotcha-kage-reverify-re-checks-a-claim-not-a-worktree-its-help-text-promises-the-worktr-d5e7c0e6.md
- .agent_memory/packets/workflow-change-memory-kage-a-run-that-is-stopped-or-orphaned-has-no-260819-4e38-815f0b8d.md
- .agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md
- .agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md
- .agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md
- .agent_memory/packets/workflow-change-memory-kage-make-the-receipt-the-thing-people-notice-260819-419c-a183d6bc.md
- .agent_memory/packets/workflow-change-memory-kage-the-predicted-touch-set-is-uncorrelated-260819-ecbd-62eaf1c2.md
- .agent_memory/packets/workflow-change-memory-kage-the-storefront-still-sells-the-old-produ-260819-54fc-08303802.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- README.md
- mcp/cli.ts
- mcp/delegation/api.ts
- mcp/delegation/brief.ts
- mcp/delegation/checks.ts
- mcp/delegation/contract.ts
- mcp/delegation/dispatch.ts
- mcp/delegation/preflight.ts
- mcp/delegation/recovery.ts
- mcp/delegation/room-pty.ts
- mcp/delegation/room-supervisor.ts
- mcp/delegation/supervisor.ts
- mcp/delegation/verify.ts
- mcp/delegation/worktree-guard.ts
- mcp/readme-claims.test.ts
- mcp/resume-budgets.test.ts
- mcp/room-permission-trap.test.ts
- mcp/run-recovery.test.ts
- mcp/touch-set.test.ts
- mcp/worktree-guard.test.ts

Diff summary:
```text
...exit-in-node-is-not-guaranteed-to-f-60e32e9c.md |   4 +-
 ...r-a-chosen-id-and-resumesessionid-r-f5454e15.md |   4 +-
 ...ied-by-this-sandboxs-command-approv-7d0edd52.md |   6 +-
 ...s-lines-own-fence-state-waiting-are-32d4a3e6.md |   4 +-
 ...-launched-it-no-supervisor-pid-no-d-900a4cc5.md |   6 +-
 ...workflow-change-memory-release-prep-a72d4251.md |  52 ++++--
 README.md                                          |  70 ++++++--
 mcp/cli.ts                                         |  54 +++++-
 mcp/delegation/api.ts                              |  42 ++++-
 mcp/delegation/brief.ts                            | 187 ++++++++++++++++++++-
 mcp/delegation/checks.ts                           |  19 ++-
 mcp/delegation/contract.ts                         | 126 ++++++++++++--
 mcp/delegation/dispatch.ts                         |   6 +
 mcp/delegation/preflight.ts                        |  17 +-
 mcp/delegation/room-pty.ts                         |  27 +--
 mcp/delegation/room-supervisor.ts                  | 155 ++---------------
 mcp/delegation/supervisor.ts                       |  53 +++++-
 mcp/delegation/verify.ts                           |  11 +-
 mcp/room-permission-trap.test.ts                   | 156 -----------------
 19 files changed, 599 insertions(+), 400 deletions(-)
.agent_memory/packets/bug_fix-cli-dispatched-runs-now-detach-and-survive-the-launching-shell-41d79cdc.md | untracked
.agent_memory/packets/gotcha-a-runs-build-can-escape-its-worktree-into-the-main-checkouts-dist-and-a-supervis-f601e41c.md | untracked
.agent_memory/packets/gotcha-hired-agents-can-run-npm-node-npx-the-earlier-sandbox-denies-commands-reading-wa-adfd2eb2.md | untracked
.agent_memory/packets/gotcha-kage-reverify-re-checks-a-claim-not-a-worktree-its-help-text-promises-the-worktr-d5e7c0e6.md | untracked
.agent_memory/packets/workflow-change-memory-kage-a-run-that-is-stopped-or-orphaned-has-no-260819-4e38-815f0b8d.md | untracked
.agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md | untracked
.agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md | untracked
.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md | untracked
.agent_memory/packets/workflow-change-memory-kage-make-the-receipt-the-thing-people-notice-260819-419c-a183d6bc.md | untracked
.agent_memory/packets/workflow-change-memory-kage-the-predicted-touch-set-is-uncorrelated-260819-ecbd-62eaf1c2.md | untracked
.agent_memory/packets/workflow-change-memory-kage-the-storefront-still-sells-the-old-produ-260819-54fc-08303802.md | untracked
mcp/delegation/recovery.ts | untracked
mcp/delegation/worktree-guard.ts | untracked
mcp/readme-claims.test.ts | untracked
mcp/resume-budgets.test.ts | untracked
mcp/run-recovery.test.ts | untracked
mcp/touch-set.test.ts | untracked
mcp/worktree-guard.test.ts | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-fix-the-resumed-manager-permission-trap-260819-1bc4","title":"Change memory: kage/fix-the-resumed-manager-permission-trap-260819-1bc4","summary":"Repo-local context for 37 changed repo paths on kage/fix-the-resumed-manager-permission-trap-260819-1bc4.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-a-pipe-write-followed-immediately-by-process-exit-in-node-is-not-guaranteed-to-f-60e32e9c.md\n- .agent_memory/packets/bug_fix-adapterliveinputs-sessionid-start-fresh-under-a-chosen-id-and-resumesessionid-r-f5454e15.md\n- .agent_memory/packets/bug_fix-cli-dispatched-runs-now-detach-and-survive-the-launching-shell-41d79cdc.md\n- .agent_memory/packets/bug_fix-npm-test-prefix-mcp-and-node-e-npx-are-denied-by-this-sandboxs-command-approv-7d0edd52.md\n- .agent_memory/packets/decision-a-result-stream-events-in-memory-signals-this-lines-own-fence-state-waiting-are-32d4a3e6.md\n- .agent_memory/packets/gotcha-a-cli-dispatched-run-dies-with-the-shell-that-launched-it-no-supervisor-pid-no-d-900a4cc5.md\n- .agent_memory/packets/gotcha-a-runs-build-can-escape-its-worktree-into-the-main-checkouts-dist-and-a-supervis-f601e41c.md\n- .agent_memory/packets/gotcha-hired-agents-can-run-npm-node-npx-the-earlier-sandbox-denies-commands-reading-wa-adfd2eb2.md\n- .agent_memory/packets/gotcha-kage-reverify-re-checks-a-claim-not-a-worktree-its-help-text-promises-the-worktr-d5e7c0e6.md\n- .agent_memory/packets/workflow-change-memory-kage-a-run-that-is-stopped-or-orphaned-has-no-260819-4e38-815f0b8d.md\n- .agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md\n- .agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md\n- .agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md\n- .agent_memory/packets/workflow-change-memory-kage-make-the-receipt-the-thing-people-notice-260819-419c-a183d6bc.md\n- .agent_memory/packets/workflow-change-memory-kage-the-predicted-touch-set-is-uncorrelated-260819-ecbd-62eaf1c2.md\n- .agent_memory/packets/workflow-change-memory-kage-the-storefront-still-sells-the-old-produ-260819-54fc-08303802.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- README.md\n- mcp/cli.ts\n- mcp/delegation/api.ts\n- mcp/delegation/brief.ts\n- mcp/delegation/checks.ts\n- mcp/delegation/contract.ts\n- mcp/delegation/dispatch.ts\n- mcp/delegation/preflight.ts\n- mcp/delegation/recovery.ts\n- mcp/delegation/room-pty.ts\n- mcp/delegation/room-supervisor.ts\n- mcp/delegation/supervisor.ts\n- mcp/delegation/verify.ts\n- mcp/delegation/worktree-guard.ts\n- mcp/readme-claims.test.ts\n- mcp/resume-budgets.test.ts\n- mcp/room-permission-trap.test.ts\n- mcp/run-recovery.test.ts\n- mcp/touch-set.test.ts\n- mcp/worktree-guard.test.ts\n\nDiff summary:\n```text\n...exit-in-node-is-not-guaranteed-to-f-60e32e9c.md |   4 +-\n ...r-a-chosen-id-and-resumesessionid-r-f5454e15.md |   4 +-\n ...ied-by-this-sandboxs-command-approv-7d0edd52.md |   6 +-\n ...s-lines-own-fence-state-waiting-are-32d4a3e6.md |   4 +-\n ...-launched-it-no-supervisor-pid-no-d-900a4cc5.md |   6 +-\n ...workflow-change-memory-release-prep-a72d4251.md |  52 ++++--\n README.md                                          |  70 ++++++--\n mcp/cli.ts                                         |  54 +++++-\n mcp/delegation/api.ts                              |  42 ++++-\n mcp/delegation/brief.ts                            | 187 ++++++++++++++++++++-\n mcp/delegation/checks.ts                           |  19 ++-\n mcp/delegation/contract.ts                         | 126 ++++++++++++--\n mcp/delegation/dispatch.ts                         |   6 +\n mcp/delegation/preflight.ts                        |  17 +-\n mcp/delegation/room-pty.ts                         |  27 +--\n mcp/delegation/room-supervisor.ts                  | 155 ++---------------\n mcp/delegation/supervisor.ts                       |  53 +++++-\n mcp/delegation/verify.ts                           |  11 +-\n mcp/room-permission-trap.test.ts                   | 156 -----------------\n 19 files changed, 599 insertions(+), 400 deletions(-)\n.agent_memory/packets/bug_fix-cli-dispatched-runs-now-detach-and-survive-the-launching-shell-41d79cdc.md | untracked\n.agent_memory/packets/gotcha-a-runs-build-can-escape-its-worktree-into-the-main-checkouts-dist-and-a-supervis-f601e41c.md | untracked\n.agent_memory/packets/gotcha-hired-agents-can-run-npm-node-npx-the-earlier-sandbox-denies-commands-reading-wa-adfd2eb2.md | untracked\n.agent_memory/packets/gotcha-kage-reverify-re-checks-a-claim-not-a-worktree-its-help-text-promises-the-worktr-d5e7c0e6.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-a-run-that-is-stopped-or-orphaned-has-no-260819-4e38-815f0b8d.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-make-the-receipt-the-thing-people-notice-260819-419c-a183d6bc.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-the-predicted-touch-set-is-uncorrelated-260819-ecbd-62eaf1c2.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-the-storefront-still-sells-the-old-produ-260819-54fc-08303802.md | untracked\nmcp/delegation/recovery.ts | untracked\nmcp/delegation/worktree-guard.ts | untracked\nmcp/readme-claims.test.ts | untracked\nmcp/resume-budgets.test.ts | untracked\nmcp/run-recovery.test.ts | untracked\nmcp/touch-set.test.ts | untracked\nmcp/worktree-guard.test.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-fix-the-resumed-manager-permission-trap-260819-1bc4"],"paths":[".agent_memory/packets/bug_fix-a-pipe-write-followed-immediately-by-process-exit-in-node-is-not-guaranteed-to-f-60e32e9c.md",".agent_memory/packets/bug_fix-adapterliveinputs-sessionid-start-fresh-under-a-chosen-id-and-resumesessionid-r-f5454e15.md",".agent_memory/packets/bug_fix-cli-dispatched-runs-now-detach-and-survive-the-launching-shell-41d79cdc.md",".agent_memory/packets/bug_fix-npm-test-prefix-mcp-and-node-e-npx-are-denied-by-this-sandboxs-command-approv-7d0edd52.md",".agent_memory/packets/decision-a-result-stream-events-in-memory-signals-this-lines-own-fence-state-waiting-are-32d4a3e6.md",".agent_memory/packets/gotcha-a-cli-dispatched-run-dies-with-the-shell-that-launched-it-no-supervisor-pid-no-d-900a4cc5.md",".agent_memory/packets/gotcha-a-runs-build-can-escape-its-worktree-into-the-main-checkouts-dist-and-a-supervis-f601e41c.md",".agent_memory/packets/gotcha-hired-agents-can-run-npm-node-npx-the-earlier-sandbox-denies-commands-reading-wa-adfd2eb2.md",".agent_memory/packets/gotcha-kage-reverify-re-checks-a-claim-not-a-worktree-its-help-text-promises-the-worktr-d5e7c0e6.md",".agent_memory/packets/workflow-change-memory-kage-a-run-that-is-stopped-or-orphaned-has-no-260819-4e38-815f0b8d.md",".agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md",".agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md",".agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md",".agent_memory/packets/workflow-change-memory-kage-make-the-receipt-the-thing-people-notice-260819-419c-a183d6bc.md",".agent_memory/packets/workflow-change-memory-kage-the-predicted-touch-set-is-uncorrelated-260819-ecbd-62eaf1c2.md",".agent_memory/packets/workflow-change-memory-kage-the-storefront-still-sells-the-old-produ-260819-54fc-08303802.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","README.md","mcp/cli.ts","mcp/delegation/api.ts","mcp/delegation/brief.ts","mcp/delegation/checks.ts","mcp/delegation/contract.ts","mcp/delegation/dispatch.ts","mcp/delegation/preflight.ts","mcp/delegation/recovery.ts","mcp/delegation/room-pty.ts","mcp/delegation/room-supervisor.ts","mcp/delegation/supervisor.ts","mcp/delegation/verify.ts","mcp/delegation/worktree-guard.ts","mcp/readme-claims.test.ts","mcp/resume-budgets.test.ts","mcp/room-permission-trap.test.ts","mcp/run-recovery.test.ts","mcp/touch-set.test.ts","mcp/worktree-guard.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/fix-the-resumed-manager-permission-trap-260819-1bc4","head":"a861b699fde922889b88efdf10e0696f7f971c55","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/bug_fix-a-pipe-write-followed-immediately-by-process-exit-in-node-is-not-guaranteed-to-f-60e32e9c.md",".agent_memory/packets/bug_fix-adapterliveinputs-sessionid-start-fresh-under-a-chosen-id-and-resumesessionid-r-f5454e15.md",".agent_memory/packets/bug_fix-cli-dispatched-runs-now-detach-and-survive-the-launching-shell-41d79cdc.md",".agent_memory/packets/bug_fix-npm-test-prefix-mcp-and-node-e-npx-are-denied-by-this-sandboxs-command-approv-7d0edd52.md",".agent_memory/packets/decision-a-result-stream-events-in-memory-signals-this-lines-own-fence-state-waiting-are-32d4a3e6.md",".agent_memory/packets/gotcha-a-cli-dispatched-run-dies-with-the-shell-that-launched-it-no-supervisor-pid-no-d-900a4cc5.md",".agent_memory/packets/gotcha-a-runs-build-can-escape-its-worktree-into-the-main-checkouts-dist-and-a-supervis-f601e41c.md",".agent_memory/packets/gotcha-hired-agents-can-run-npm-node-npx-the-earlier-sandbox-denies-commands-reading-wa-adfd2eb2.md",".agent_memory/packets/gotcha-kage-reverify-re-checks-a-claim-not-a-worktree-its-help-text-promises-the-worktr-d5e7c0e6.md",".agent_memory/packets/workflow-change-memory-kage-a-run-that-is-stopped-or-orphaned-has-no-260819-4e38-815f0b8d.md",".agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md",".agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md",".agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md",".agent_memory/packets/workflow-change-memory-kage-make-the-receipt-the-thing-people-notice-260819-419c-a183d6bc.md",".agent_memory/packets/workflow-change-memory-kage-the-predicted-touch-set-is-uncorrelated-260819-ecbd-62eaf1c2.md",".agent_memory/packets/workflow-change-memory-kage-the-storefront-still-sells-the-old-produ-260819-54fc-08303802.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","README.md","mcp/cli.ts","mcp/delegation/api.ts","mcp/delegation/brief.ts","mcp/delegation/checks.ts","mcp/delegation/contract.ts","mcp/delegation/dispatch.ts","mcp/delegation/preflight.ts","mcp/delegation/recovery.ts","mcp/delegation/room-pty.ts","mcp/delegation/room-supervisor.ts","mcp/delegation/supervisor.ts","mcp/delegation/verify.ts","mcp/delegation/worktree-guard.ts","mcp/readme-claims.test.ts","mcp/resume-budgets.test.ts","mcp/room-permission-trap.test.ts","mcp/run-recovery.test.ts","mcp/touch-set.test.ts","mcp/worktree-guard.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-fix-the-resumed-manager-permission-trap-260819-1bc4.json"}],"context":{"fact":"Current branch kage/fix-the-resumed-manager-permission-trap-260819-1bc4 changes 37 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-19T19:18:45.195Z","ttl_days":180,"path_fingerprints":[{"path":"README.md","sha256":"578d70c03862796d17d631b9ab3093626b1846d2e379ad6a21ab64ee18a3177f","size":16230},{"path":"mcp/cli.ts","sha256":"f9f6e11fe8c9120a3fa8d96ea6a759ca1db49cfc59a174988fa85fb8b76729b5","size":142983},{"path":"mcp/delegation/api.ts","sha256":"bbb4ae03088d789aa73efa1efc5d698c501de13b5413fc795a170ad462810bd8","size":61869},{"path":"mcp/delegation/brief.ts","sha256":"21fd055334aa2500129ba999d28be13307bd3085e4e47b39f962bc4d641e0d09","size":19355},{"path":"mcp/delegation/checks.ts","sha256":"9b21dd6e4e8fe33a896c3526c7ccd3ddfc4ce210f90b08ca8e57f43b910d1124","size":4023},{"path":"mcp/delegation/contract.ts","sha256":"de47acb26dbfd5080d3a89d2ca8d68fee6a5706c2b321ffc3152af83a1c9d617","size":41001},{"path":"mcp/delegation/dispatch.ts","sha256":"b9a935985b4c83a998b607615cbebdd9e2fd3b7b3e333507ee750d1e2b0f93ab","size":21052},{"path":"mcp/delegation/preflight.ts","sha256":"0bb858b7c3a746caf50eb2df5a4b39f5fdc0641d3616947a760c565b95888e12","size":3079},{"path":"mcp/delegation/recovery.ts","sha256":"13e165032428c3a804fd61a4cc6aa8b3c19e0afb061ee7e245d37c647b2525f7","size":12490},{"path":"mcp/delegation/room-pty.ts","sha256":"e5eb378a195021c1c5b3b94ce050a4461c88605f2ac530aed6d6c675ee6c7b92","size":19764},{"path":"mcp/delegation/room-supervisor.ts","sha256":"7b4ede9bf9f84d77074d7a81f7383e581949fc8a2226cabef464640ecc97a487","size":26912},{"path":"mcp/delegation/supervisor.ts","sha256":"f938cfde6039821dd60f67d1e403f0362b9b8338f1a561bcdc03effadc6fe304","size":29178},{"path":"mcp/delegation/verify.ts","sha256":"67667c192f8ed1fedb7fb8c7bb95042599b03623864bdcbd3c5f1269ad90c484","size":16581},{"path":"mcp/delegation/worktree-guard.ts","sha256":"f1598aa7f0dedfacf76a52ed8267f37ef44d7b963c2a06fa01d2dd5d96d9680e","size":5378},{"path":"mcp/readme-claims.test.ts","sha256":"f18f814cae34b62e09c76f3f1c7f618020005a56dfc2efc208df7179db3f58c5","size":8193},{"path":"mcp/resume-budgets.test.ts","sha256":"6c68e94d0600a41ef259e984d3ac3abb7761983c5cc47ee035248eb8611cc0de","size":3841},{"path":"mcp/run-recovery.test.ts","sha256":"4a305f5dab84b48e1b7e44c676ee4e05553838e17006c0ea2142bd4360ec59d8","size":15312},{"path":"mcp/touch-set.test.ts","sha256":"8f79e10e22c078988aced8d2ac8eb91870d15051abd0bb1eb1d6744ccaf068b1","size":9534},{"path":"mcp/worktree-guard.test.ts","sha256":"a4556a468d15120a2abfa8d429719d9723fc52547dccc93bc00d5e21dfa1fb8d","size":5865}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-a-pipe-write-followed-immediately-by-process-exit-in-node-is-not-guaranteed-to-f-60e32e9c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-adapterliveinputs-sessionid-start-fresh-under-a-chosen-id-and-resumesessionid-r-f5454e15.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-cli-dispatched-runs-now-detach-and-survive-the-launching-shell-41d79cdc.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-npm-test-prefix-mcp-and-node-e-npx-are-denied-by-this-sandboxs-command-approv-7d0edd52.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-a-result-stream-events-in-memory-signals-this-lines-own-fence-state-waiting-are-32d4a3e6.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-a-cli-dispatched-run-dies-with-the-shell-that-launched-it-no-supervisor-pid-no-d-900a4cc5.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-a-runs-build-can-escape-its-worktree-into-the-main-checkouts-dist-and-a-supervis-f601e41c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-hired-agents-can-run-npm-node-npx-the-earlier-sandbox-denies-commands-reading-wa-adfd2eb2.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-kage-reverify-re-checks-a-claim-not-a-worktree-its-help-text-promises-the-worktr-d5e7c0e6.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-a-run-that-is-stopped-or-orphaned-has-no-260819-4e38-815f0b8d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-make-the-receipt-the-thing-people-notice-260819-419c-a183d6bc.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-the-predicted-touch-set-is-uncorrelated-260819-ecbd-62eaf1c2.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-the-storefront-still-sells-the-old-produ-260819-54fc-08303802.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:README.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"}],"quality":{"score":72,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":["some referenced paths are missing: mcp/room-permission-trap.test.ts"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: mcp/room-permission-trap.test.ts"],"estimated_tokens_saved":1561,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-19T19:18:45.195Z","updated_at":"2026-08-19T19:18:45.195Z"}
```

