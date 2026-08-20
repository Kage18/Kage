---
type: "Workflow"
title: "Change memory: kage/fix-project-switching-ensureappdaemon-in-260817-52dc"
description: "Repo-local context for 24 changed repo paths on kage/fix-project-switching-ensureappdaemon-in-260817-52dc."
resource: "mcp/app-daemon.test.ts"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-fix-project-switching-ensureappdaemon-in-260817-52dc"]
timestamp: "2026-08-20T02:55:09.387Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-fix-project-switching-ensureappdaemon-in-260817-52dc"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["mcp/app-daemon.test.ts", "mcp/daemon.ts", "mcp/delegation.test.ts", "mcp/delegation/app-daemon.ts", "mcp/delegation/contract.ts", "mcp/delegation/ratify.ts"]
---

# Change memory: kage/fix-project-switching-ensureappdaemon-in-260817-52dc

> Repo-local context for 24 changed repo paths on kage/fix-project-switching-ensureappdaemon-in-260817-52dc.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-ensureappdaemons-old-default-parameter-portoroptions-default-app-port-meant-ever-6e921d94.md
- .agent_memory/packets/bug_fix-rejectruns-dropped-state-handling-relies-on-reaprun-projectdir-runid-contract-ts-b7987668.md
- .agent_memory/packets/bug_fix-startdaemon-in-mcp-daemon-ts-computed-loopbackorigins-restport-and-wrote-status--4fa836c9.md
- .agent_memory/packets/bug_fix-the-base-state-of-mcp-delegation-ratify-ts-and-mcp-delegation-contract-ts-in-thi-864eb8f8.md
- .agent_memory/packets/convention-this-repo-is-built-through-its-own-delegation-loop-dispatch-verify-merge-the-ope-e20411f6.md
- .agent_memory/packets/gotcha-first-real-dogfood-day-found-three-systemic-gaps-no-setup-command-cli-dispatch-s-9446ccc6.md
- .agent_memory/packets/negative_result-rejected-approach-add-a-one-line-comment-to-readme-md-tiny-chore-test-dispatch-cae69976.md
- .agent_memory/packets/negative_result-rejected-approach-clean-up-mcp-kernel-ts-mcp-cli-ts-and-mcp-index-ts-remove-dead-ebb73e37.md
- .agent_memory/packets/negative_result-rejected-approach-commit-mcp-delegation-to-the-repo-then-in-that-same-worktree-r-5fd07de5.md
- .agent_memory/packets/negative_result-rejected-approach-fix-project-switching-in-the-app-it-fails-with-the-daemon-did--d53b6300.md
- .agent_memory/packets/negative_result-rejected-approach-fix-rejectruns-state-gate-in-mcp-delegation-ratify-ts-bug-a-st-d18c4294.md
- .agent_memory/packets/workflow-change-memory-adopt-sse-live-feed-e7f1116c.md
- .agent_memory/packets/workflow-change-memory-kage-fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b-059a4539.md
- .agent_memory/packets/workflow-change-memory-kage-fix-rejectrun-state-gate-in-mcp-delegati-260817-6821-2887bf8a.md
- .agent_memory/packets/workflow-change-memory-master-23634276.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- .agent_memory/packets/workflow-change-memory-release-v2-0-0-cf93c737.md
- .agent_memory/packets/workflow-change-memory-v2-theme-07e98859.md
- mcp/app-daemon.test.ts
- mcp/daemon.ts
- mcp/delegation.test.ts
- mcp/delegation/app-daemon.ts
- mcp/delegation/contract.ts
- mcp/delegation/ratify.ts

Diff summary:
```text
...options-default-app-port-meant-ever-6e921d94.md | 42 ----------------------
 ...korigins-restport-and-wrote-status--4fa836c9.md | 42 ----------------------
 ...w-change-memory-adopt-sse-live-feed-e7f1116c.md |  6 ++--
 .../workflow-change-memory-master-23634276.md      |  2 +-
 ...workflow-change-memory-release-prep-a72d4251.md | 41 ++++++++++++++++-----
 ...rkflow-change-memory-release-v2-0-0-cf93c737.md |  6 ++--
 .../workflow-change-memory-v2-theme-07e98859.md    |  6 ++--
 mcp/app-daemon.test.ts                             | 10 ------
 mcp/daemon.ts                                      | 28 ++-------------
 mcp/delegation.test.ts                             | 34 ++++++++++++++++++
 mcp/delegation/app-daemon.ts                       | 11 ++----
 mcp/delegation/contract.ts                         |  4 ++-
 mcp/delegation/ratify.ts                           | 29 +++++++++++++--
 13 files changed, 111 insertions(+), 150 deletions(-)
.agent_memory/packets/bug_fix-rejectruns-dropped-state-handling-relies-on-reaprun-projectdir-runid-contract-ts-b7987668.md | untracked
.agent_memory/packets/bug_fix-the-base-state-of-mcp-delegation-ratify-ts-and-mcp-delegation-contract-ts-in-thi-864eb8f8.md | untracked
.agent_memory/packets/convention-this-repo-is-built-through-its-own-delegation-loop-dispatch-verify-merge-the-ope-e20411f6.md | untracked
.agent_memory/packets/gotcha-first-real-dogfood-day-found-three-systemic-gaps-no-setup-command-cli-dispatch-s-9446ccc6.md | untracked
.agent_memory/packets/negative_result-rejected-approach-add-a-one-line-comment-to-readme-md-tiny-chore-test-dispatch-cae69976.md | untracked
.agent_memory/packets/negative_result-rejected-approach-clean-up-mcp-kernel-ts-mcp-cli-ts-and-mcp-index-ts-remove-dead-ebb73e37.md | untracked
.agent_memory/packets/negative_result-rejected-approach-commit-mcp-delegation-to-the-repo-then-in-that-same-worktree-r-5fd07de5.md | untracked
.agent_memory/packets/negative_result-rejected-approach-fix-project-switching-in-the-app-it-fails-with-the-daemon-did--d53b6300.md | untracked
.agent_memory/packets/negative_result-rejected-approach-fix-rejectruns-state-gate-in-mcp-delegation-ratify-ts-bug-a-st-d18c4294.md | untracked
.agent_memory/packets/workflow-change-memory-kage-fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b-059a4539.md | untracked
.agent_memory/packets/workflow-change-memory-kage-fix-rejectrun-state-gate-in-mcp-delegati-260817-6821-2887bf8a.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-fix-project-switching-ensureappdaemon-in-260817-52dc","title":"Change memory: kage/fix-project-switching-ensureappdaemon-in-260817-52dc","summary":"Repo-local context for 24 changed repo paths on kage/fix-project-switching-ensureappdaemon-in-260817-52dc.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-ensureappdaemons-old-default-parameter-portoroptions-default-app-port-meant-ever-6e921d94.md\n- .agent_memory/packets/bug_fix-rejectruns-dropped-state-handling-relies-on-reaprun-projectdir-runid-contract-ts-b7987668.md\n- .agent_memory/packets/bug_fix-startdaemon-in-mcp-daemon-ts-computed-loopbackorigins-restport-and-wrote-status--4fa836c9.md\n- .agent_memory/packets/bug_fix-the-base-state-of-mcp-delegation-ratify-ts-and-mcp-delegation-contract-ts-in-thi-864eb8f8.md\n- .agent_memory/packets/convention-this-repo-is-built-through-its-own-delegation-loop-dispatch-verify-merge-the-ope-e20411f6.md\n- .agent_memory/packets/gotcha-first-real-dogfood-day-found-three-systemic-gaps-no-setup-command-cli-dispatch-s-9446ccc6.md\n- .agent_memory/packets/negative_result-rejected-approach-add-a-one-line-comment-to-readme-md-tiny-chore-test-dispatch-cae69976.md\n- .agent_memory/packets/negative_result-rejected-approach-clean-up-mcp-kernel-ts-mcp-cli-ts-and-mcp-index-ts-remove-dead-ebb73e37.md\n- .agent_memory/packets/negative_result-rejected-approach-commit-mcp-delegation-to-the-repo-then-in-that-same-worktree-r-5fd07de5.md\n- .agent_memory/packets/negative_result-rejected-approach-fix-project-switching-in-the-app-it-fails-with-the-daemon-did--d53b6300.md\n- .agent_memory/packets/negative_result-rejected-approach-fix-rejectruns-state-gate-in-mcp-delegation-ratify-ts-bug-a-st-d18c4294.md\n- .agent_memory/packets/workflow-change-memory-adopt-sse-live-feed-e7f1116c.md\n- .agent_memory/packets/workflow-change-memory-kage-fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b-059a4539.md\n- .agent_memory/packets/workflow-change-memory-kage-fix-rejectrun-state-gate-in-mcp-delegati-260817-6821-2887bf8a.md\n- .agent_memory/packets/workflow-change-memory-master-23634276.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- .agent_memory/packets/workflow-change-memory-release-v2-0-0-cf93c737.md\n- .agent_memory/packets/workflow-change-memory-v2-theme-07e98859.md\n- mcp/app-daemon.test.ts\n- mcp/daemon.ts\n- mcp/delegation.test.ts\n- mcp/delegation/app-daemon.ts\n- mcp/delegation/contract.ts\n- mcp/delegation/ratify.ts\n\nDiff summary:\n```text\n...options-default-app-port-meant-ever-6e921d94.md | 42 ----------------------\n ...korigins-restport-and-wrote-status--4fa836c9.md | 42 ----------------------\n ...w-change-memory-adopt-sse-live-feed-e7f1116c.md |  6 ++--\n .../workflow-change-memory-master-23634276.md      |  2 +-\n ...workflow-change-memory-release-prep-a72d4251.md | 41 ++++++++++++++++-----\n ...rkflow-change-memory-release-v2-0-0-cf93c737.md |  6 ++--\n .../workflow-change-memory-v2-theme-07e98859.md    |  6 ++--\n mcp/app-daemon.test.ts                             | 10 ------\n mcp/daemon.ts                                      | 28 ++-------------\n mcp/delegation.test.ts                             | 34 ++++++++++++++++++\n mcp/delegation/app-daemon.ts                       | 11 ++----\n mcp/delegation/contract.ts                         |  4 ++-\n mcp/delegation/ratify.ts                           | 29 +++++++++++++--\n 13 files changed, 111 insertions(+), 150 deletions(-)\n.agent_memory/packets/bug_fix-rejectruns-dropped-state-handling-relies-on-reaprun-projectdir-runid-contract-ts-b7987668.md | untracked\n.agent_memory/packets/bug_fix-the-base-state-of-mcp-delegation-ratify-ts-and-mcp-delegation-contract-ts-in-thi-864eb8f8.md | untracked\n.agent_memory/packets/convention-this-repo-is-built-through-its-own-delegation-loop-dispatch-verify-merge-the-ope-e20411f6.md | untracked\n.agent_memory/packets/gotcha-first-real-dogfood-day-found-three-systemic-gaps-no-setup-command-cli-dispatch-s-9446ccc6.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-add-a-one-line-comment-to-readme-md-tiny-chore-test-dispatch-cae69976.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-clean-up-mcp-kernel-ts-mcp-cli-ts-and-mcp-index-ts-remove-dead-ebb73e37.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-commit-mcp-delegation-to-the-repo-then-in-that-same-worktree-r-5fd07de5.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-fix-project-switching-in-the-app-it-fails-with-the-daemon-did--d53b6300.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-fix-rejectruns-state-gate-in-mcp-delegation-ratify-ts-bug-a-st-d18c4294.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b-059a4539.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-fix-rejectrun-state-gate-in-mcp-delegati-260817-6821-2887bf8a.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-fix-project-switching-ensureappdaemon-in-260817-52dc"],"paths":["mcp/app-daemon.test.ts","mcp/daemon.ts","mcp/delegation.test.ts","mcp/delegation/app-daemon.ts","mcp/delegation/contract.ts","mcp/delegation/ratify.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/fix-project-switching-ensureappdaemon-in-260817-52dc","head":"e7772983dca6115b05050ca30a29c2c387bc2d64","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/bug_fix-ensureappdaemons-old-default-parameter-portoroptions-default-app-port-meant-ever-6e921d94.md",".agent_memory/packets/bug_fix-rejectruns-dropped-state-handling-relies-on-reaprun-projectdir-runid-contract-ts-b7987668.md",".agent_memory/packets/bug_fix-startdaemon-in-mcp-daemon-ts-computed-loopbackorigins-restport-and-wrote-status--4fa836c9.md",".agent_memory/packets/bug_fix-the-base-state-of-mcp-delegation-ratify-ts-and-mcp-delegation-contract-ts-in-thi-864eb8f8.md",".agent_memory/packets/convention-this-repo-is-built-through-its-own-delegation-loop-dispatch-verify-merge-the-ope-e20411f6.md",".agent_memory/packets/gotcha-first-real-dogfood-day-found-three-systemic-gaps-no-setup-command-cli-dispatch-s-9446ccc6.md",".agent_memory/packets/negative_result-rejected-approach-add-a-one-line-comment-to-readme-md-tiny-chore-test-dispatch-cae69976.md",".agent_memory/packets/negative_result-rejected-approach-clean-up-mcp-kernel-ts-mcp-cli-ts-and-mcp-index-ts-remove-dead-ebb73e37.md",".agent_memory/packets/negative_result-rejected-approach-commit-mcp-delegation-to-the-repo-then-in-that-same-worktree-r-5fd07de5.md",".agent_memory/packets/negative_result-rejected-approach-fix-project-switching-in-the-app-it-fails-with-the-daemon-did--d53b6300.md",".agent_memory/packets/negative_result-rejected-approach-fix-rejectruns-state-gate-in-mcp-delegation-ratify-ts-bug-a-st-d18c4294.md",".agent_memory/packets/workflow-change-memory-adopt-sse-live-feed-e7f1116c.md",".agent_memory/packets/workflow-change-memory-kage-fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b-059a4539.md",".agent_memory/packets/workflow-change-memory-kage-fix-rejectrun-state-gate-in-mcp-delegati-260817-6821-2887bf8a.md",".agent_memory/packets/workflow-change-memory-master-23634276.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md",".agent_memory/packets/workflow-change-memory-release-v2-0-0-cf93c737.md",".agent_memory/packets/workflow-change-memory-v2-theme-07e98859.md","mcp/app-daemon.test.ts","mcp/daemon.ts","mcp/delegation.test.ts","mcp/delegation/app-daemon.ts","mcp/delegation/contract.ts","mcp/delegation/ratify.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-fix-project-switching-ensureappdaemon-in-260817-52dc.json"}],"context":{"fact":"Current branch kage/fix-project-switching-ensureappdaemon-in-260817-52dc changes 24 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T02:55:09.387Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/app-daemon.test.ts","sha256":"8a4c86b80a5057803c8d1f0b5b8988c1855e02dc5feeeadf8dedaa3c9f7d1dce","size":6245,"symbols":[{"name":"project","kind":"function","sha256":"83f2198282bd77348ee047cb8bd293bea865dbf0841e2de02cffc803e8e67e9e"}]},{"path":"mcp/daemon.ts","sha256":"61ac60c73e72d8c0ddff2b12737b852d3cbc222d2c63222bf82bdfc44e21beb5","size":52757,"symbols":[{"name":"text","kind":"constant","sha256":"70f68baaeedf940b18569f940046a8a0a978afd00077c6b27618336a05fa1cc1"},{"name":"startdaemon","kind":"function","sha256":"4b3a3f3399f892f6a269f452d1ca04f312b0a44ba76789e1771c5240e22b9602"},{"name":"port","kind":"constant","sha256":"3e407810682ecd9330305bd698b80547be0e48f5d2cb361ac9533f60343d1d04"},{"name":"files","kind":"constant","sha256":"69140299050f3544f2a8f5cdcfa3672dd7f2a78cf8960d3197b23624253b5b9e"}]},{"path":"mcp/delegation.test.ts","sha256":"d2c723245ac8bdbea9a3578263af3586a8846d690955408435134074cabcfe20","size":117510,"symbols":[{"name":"memory","kind":"constant","sha256":"05501b9f634007680d5b281c889e4072fa20ef0bf3b873fe200c630f5335aec3"},{"name":"files","kind":"constant","sha256":"3874b8ffbbb4d8b4f514026d90751948bb0e5c1360d4feb8e25cf68e5968dd15"},{"name":"merge","kind":"constant","sha256":"ceb4a3db8416ae4be041c9291af38bb10c36b9a646865f9e689bfeefae6dfaee"},{"name":"state","kind":"constant","sha256":"9ab61b8844cbc59b085101b723c75f8cc5dffc975343d4900666650f818b6ca7"},{"name":"after","kind":"constant","sha256":"b9df6f62500610198114b24b3226ae9dce1d113c45d39d582a48f4f58ddb583d"},{"name":"found","kind":"constant","sha256":"ffb7a64cd8998d0bdab368b157c524cad13de3cb98cc51a645eb071d1c6c4f4f"},{"name":"paths","kind":"constant","sha256":"855545c936a5a5145647a2ac5e46a769b788a6ad5cd44605512002904a6fbbd4"}]},{"path":"mcp/delegation/app-daemon.ts","sha256":"a379f5d9c53c5164a5f3667494599d704cc0e4f269dde883ecc8b89bc2e0e865","size":4850,"symbols":[{"name":"ensureappdaemon","kind":"function","sha256":"ed2928b3da0fb711e018f9fc20c2b27abbd4f669506eba38183c82ecb9319500"},{"name":"options","kind":"constant","sha256":"599a20294e1dc628ed8d833dc12bf70f1781a2da85bcc8868f6eada9b7941e2f"},{"name":"status","kind":"constant","sha256":"40bb2ed7116ea7fe2e355455a131f777c1c44c10ee7d397606191e40b913a480"}]},{"path":"mcp/delegation/contract.ts","sha256":"14a38450edae2f6105c45c6823a47de4e4cd2a47c6be05d2f812411f6663233a","size":41611,"symbols":[{"name":"reaprun","kind":"function","sha256":"c65240ad87675bf6a8fdfc13efd8acfe69b0fed53bdc3b8eba549ba7c7bdc94a"},{"name":"change","kind":"constant","sha256":"e499aa50ffbb9c260caec4bb421746f795f0062475fe49fbee7f283705f385e8"},{"name":"from","kind":"constant","sha256":"bd2200c07292af9f1ac297cdf2d079dea9c17bd2c3ee4d9522b7a3bb5c07a013"}]},{"path":"mcp/delegation/ratify.ts","sha256":"b170f3c4876273f7d83f944f9af7723531e8d658afca0d41555895dba2457c6b","size":16910,"symbols":[{"name":"packet","kind":"constant","sha256":"1334c6233d0f856bc34455a4656eadc87ed9bc526ea83335977aa958d235c764"},{"name":"base","kind":"constant","sha256":"9e9ae19b97ecc0a8e39a611a2fdf05b50eea3ca8b3d62da6d877aac115bc502f"},{"name":"merge","kind":"constant","sha256":"802cdd78fd6d6e80edcbbe403b9674dcc77fec25e0519d22ddd0e086850262f5"},{"name":"goal","kind":"constant","sha256":"36c405ce0cc807fe8080f28820adda01c58f04065acd22f2504918bbf8f8c9d5"},{"name":"rejectrun","kind":"function","sha256":"2172a858fe64b17636a4573a42a7735df5bb96c2c6eb283bcd62972a1b7287bd"},{"name":"paths","kind":"constant","sha256":"ebafacbdb05e7addc7c16d4d0cff0a55f8c2d1201bea1e82771161ef209fc54e"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-ensureappdaemons-old-default-parameter-portoroptions-default-app-port-meant-ever-6e921d94.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-rejectruns-dropped-state-handling-relies-on-reaprun-projectdir-runid-contract-ts-b7987668.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-startdaemon-in-mcp-daemon-ts-computed-loopbackorigins-restport-and-wrote-status--4fa836c9.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-the-base-state-of-mcp-delegation-ratify-ts-and-mcp-delegation-contract-ts-in-thi-864eb8f8.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/convention-this-repo-is-built-through-its-own-delegation-loop-dispatch-verify-merge-the-ope-e20411f6.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-first-real-dogfood-day-found-three-systemic-gaps-no-setup-command-cli-dispatch-s-9446ccc6.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-add-a-one-line-comment-to-readme-md-tiny-chore-test-dispatch-cae69976.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-clean-up-mcp-kernel-ts-mcp-cli-ts-and-mcp-index-ts-remove-dead-ebb73e37.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-commit-mcp-delegation-to-the-repo-then-in-that-same-worktree-r-5fd07de5.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-fix-project-switching-in-the-app-it-fails-with-the-daemon-did--d53b6300.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-fix-rejectruns-state-gate-in-mcp-delegation-ratify-ts-bug-a-st-d18c4294.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-adopt-sse-live-feed-e7f1116c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b-059a4539.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-fix-rejectrun-state-gate-in-mcp-delegati-260817-6821-2887bf8a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-master-23634276.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-v2-0-0-cf93c737.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-v2-theme-07e98859.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/app-daemon.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/daemon.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/bug_fix-ensureappdaemons-old-default-parameter-portoroptions-default-app-port-meant-ever-6e921d94.md, .agent_memory/packets/bug_fix-startdaemon-in-mcp-daemon-ts-computed-loopbackorigins-restport-and-wrote-status--4fa836c9.md"],"duplicate_candidates":[],"estimated_tokens_saved":1339,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T02:55:09.387Z"},"created_at":"2026-08-17T18:55:48.099Z","updated_at":"2026-08-20T02:55:09.387Z"}
```

