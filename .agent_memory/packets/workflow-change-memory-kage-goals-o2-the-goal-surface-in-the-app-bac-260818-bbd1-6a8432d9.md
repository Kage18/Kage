---
type: "Workflow"
title: "Change memory: kage/goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1"
description: "Repo-local context for 22 changed repo paths on kage/goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1."
resource: ".gitignore"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1"]
timestamp: "2026-08-21T08:42:27.260Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".gitignore", "mcp/delegation-api.test.ts", "mcp/delegation/api.ts", "mcp/delegation/app-client.ts", "mcp/delegation/app-html.ts", "mcp/delegation/app-styles.ts"]
---

# Change memory: kage/goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1

> Repo-local context for 22 changed repo paths on kage/goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-ensureappdaemons-old-default-parameter-portoroptions-default-app-port-meant-ever-6e921d94.md
- .agent_memory/packets/bug_fix-startdaemon-in-mcp-daemon-ts-computed-loopbackorigins-restport-and-wrote-status--4fa836c9.md
- .agent_memory/packets/bug_fix-the-base-state-of-mcp-delegation-ratify-ts-and-mcp-delegation-contract-ts-in-thi-864eb8f8.md
- .agent_memory/packets/decision-controlops-tell-variant-needed-an-optional-steerid-field-so-the-supervisor-proce-1af86b49.md
- .agent_memory/packets/decision-goal-cards-can-only-ever-appear-in-list-work-layout-v-work-layout-board-hides-wo-7c20ccdb.md
- .agent_memory/packets/decision-kage-ui-dependency-free-tui-with-a-pure-render-reducer-core-5d16b8f2.md
- .agent_memory/packets/decision-manager-judgment-is-recorded-kernel-validated-and-measured-against-outcomes-67a0e55c.md
- .agent_memory/packets/decision-runview-withactivity-never-carried-goal-id-api-ts-had-to-compute-it-explicitly-a-118b2ca1.md
- .agent_memory/packets/decision-the-room-composers-plain-enter-keydown-branch-guards-only-on-ev-shiftkey-not-alt-d54eb44f.md
- .agent_memory/packets/decision-the-room-is-the-apps-front-door-runs-are-its-bookkeeping-not-its-purpose-f997ed57.md
- .agent_memory/packets/workflow-change-memory-kage-commit-mcp-delegation-to-the-repo-then-i-260812-db9b-6fa998a4.md
- .agent_memory/packets/workflow-change-memory-kage-fix-project-switching-ensureappdaemon-in-260817-52dc-721528b8.md
- .agent_memory/packets/workflow-change-memory-kage-goals-o1-the-orchestration-substrate-bac-260818-c6b6-01bdcad3.md
- .agent_memory/packets/workflow-change-memory-kage-the-interaction-substrate-run-1-of-3-bac-260818-4077-7a29f13b.md
- .agent_memory/packets/workflow-change-memory-kage-wave-3-the-interaction-surface-wire-the-260818-9bfd-7e0065a3.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- .gitignore
- mcp/delegation-api.test.ts
- mcp/delegation/api.ts
- mcp/delegation/app-client.ts
- mcp/delegation/app-html.ts
- mcp/delegation/app-styles.ts

Diff summary:
```text
...options-default-app-port-meant-ever-6e921d94.md |   4 +-
 ...korigins-restport-and-wrote-status--4fa836c9.md |   4 +-
 ...d-mcp-delegation-contract-ts-in-thi-864eb8f8.md |   4 +-
 ...eerid-field-so-the-supervisor-proce-1af86b49.md |   4 +-
 ...layout-v-work-layout-board-hides-wo-7c20ccdb.md |  42 ------
 ...tui-with-a-pure-render-reducer-core-5d16b8f2.md |   4 +-
 ...dated-and-measured-against-outcomes-67a0e55c.md |   4 +-
 ...i-ts-had-to-compute-it-explicitly-a-118b2ca1.md |  42 ------
 ...-guards-only-on-ev-shiftkey-not-alt-d54eb44f.md |  42 ------
 ...are-its-bookkeeping-not-its-purpose-f997ed57.md |   4 +-
 ...tion-to-the-repo-then-i-260812-db9b-6fa998a4.md |   4 +-
 ...hing-ensureappdaemon-in-260817-52dc-721528b8.md |   4 +-
 ...ubstrate-run-1-of-3-bac-260818-4077-7a29f13b.md |   4 +-
 ...action-surface-wire-the-260818-9bfd-7e0065a3.md |   4 +-
 ...workflow-change-memory-release-prep-a72d4251.md |  13 +-
 .gitignore                                         |   1 +
 mcp/delegation-api.test.ts                         |  34 -----
 mcp/delegation/api.ts                              |  25 +---
 mcp/delegation/app-client.ts                       | 143 +--------------------
 mcp/delegation/app-html.ts                         |   4 +-
 mcp/delegation/app-styles.ts                       |  23 ----
 21 files changed, 39 insertions(+), 374 deletions(-)
.agent_memory/packets/workflow-change-memory-kage-goals-o1-the-orchestration-substrate-bac-260818-c6b6-01bdcad3.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1","title":"Change memory: kage/goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1","summary":"Repo-local context for 22 changed repo paths on kage/goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-ensureappdaemons-old-default-parameter-portoroptions-default-app-port-meant-ever-6e921d94.md\n- .agent_memory/packets/bug_fix-startdaemon-in-mcp-daemon-ts-computed-loopbackorigins-restport-and-wrote-status--4fa836c9.md\n- .agent_memory/packets/bug_fix-the-base-state-of-mcp-delegation-ratify-ts-and-mcp-delegation-contract-ts-in-thi-864eb8f8.md\n- .agent_memory/packets/decision-controlops-tell-variant-needed-an-optional-steerid-field-so-the-supervisor-proce-1af86b49.md\n- .agent_memory/packets/decision-goal-cards-can-only-ever-appear-in-list-work-layout-v-work-layout-board-hides-wo-7c20ccdb.md\n- .agent_memory/packets/decision-kage-ui-dependency-free-tui-with-a-pure-render-reducer-core-5d16b8f2.md\n- .agent_memory/packets/decision-manager-judgment-is-recorded-kernel-validated-and-measured-against-outcomes-67a0e55c.md\n- .agent_memory/packets/decision-runview-withactivity-never-carried-goal-id-api-ts-had-to-compute-it-explicitly-a-118b2ca1.md\n- .agent_memory/packets/decision-the-room-composers-plain-enter-keydown-branch-guards-only-on-ev-shiftkey-not-alt-d54eb44f.md\n- .agent_memory/packets/decision-the-room-is-the-apps-front-door-runs-are-its-bookkeeping-not-its-purpose-f997ed57.md\n- .agent_memory/packets/workflow-change-memory-kage-commit-mcp-delegation-to-the-repo-then-i-260812-db9b-6fa998a4.md\n- .agent_memory/packets/workflow-change-memory-kage-fix-project-switching-ensureappdaemon-in-260817-52dc-721528b8.md\n- .agent_memory/packets/workflow-change-memory-kage-goals-o1-the-orchestration-substrate-bac-260818-c6b6-01bdcad3.md\n- .agent_memory/packets/workflow-change-memory-kage-the-interaction-substrate-run-1-of-3-bac-260818-4077-7a29f13b.md\n- .agent_memory/packets/workflow-change-memory-kage-wave-3-the-interaction-surface-wire-the-260818-9bfd-7e0065a3.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- .gitignore\n- mcp/delegation-api.test.ts\n- mcp/delegation/api.ts\n- mcp/delegation/app-client.ts\n- mcp/delegation/app-html.ts\n- mcp/delegation/app-styles.ts\n\nDiff summary:\n```text\n...options-default-app-port-meant-ever-6e921d94.md |   4 +-\n ...korigins-restport-and-wrote-status--4fa836c9.md |   4 +-\n ...d-mcp-delegation-contract-ts-in-thi-864eb8f8.md |   4 +-\n ...eerid-field-so-the-supervisor-proce-1af86b49.md |   4 +-\n ...layout-v-work-layout-board-hides-wo-7c20ccdb.md |  42 ------\n ...tui-with-a-pure-render-reducer-core-5d16b8f2.md |   4 +-\n ...dated-and-measured-against-outcomes-67a0e55c.md |   4 +-\n ...i-ts-had-to-compute-it-explicitly-a-118b2ca1.md |  42 ------\n ...-guards-only-on-ev-shiftkey-not-alt-d54eb44f.md |  42 ------\n ...are-its-bookkeeping-not-its-purpose-f997ed57.md |   4 +-\n ...tion-to-the-repo-then-i-260812-db9b-6fa998a4.md |   4 +-\n ...hing-ensureappdaemon-in-260817-52dc-721528b8.md |   4 +-\n ...ubstrate-run-1-of-3-bac-260818-4077-7a29f13b.md |   4 +-\n ...action-surface-wire-the-260818-9bfd-7e0065a3.md |   4 +-\n ...workflow-change-memory-release-prep-a72d4251.md |  13 +-\n .gitignore                                         |   1 +\n mcp/delegation-api.test.ts                         |  34 -----\n mcp/delegation/api.ts                              |  25 +---\n mcp/delegation/app-client.ts                       | 143 +--------------------\n mcp/delegation/app-html.ts                         |   4 +-\n mcp/delegation/app-styles.ts                       |  23 ----\n 21 files changed, 39 insertions(+), 374 deletions(-)\n.agent_memory/packets/workflow-change-memory-kage-goals-o1-the-orchestration-substrate-bac-260818-c6b6-01bdcad3.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1"],"paths":[".gitignore","mcp/delegation-api.test.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1","head":"4ab71e0444dbb7f17a4d0b0fe2ff826a56d245cd","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/bug_fix-ensureappdaemons-old-default-parameter-portoroptions-default-app-port-meant-ever-6e921d94.md",".agent_memory/packets/bug_fix-startdaemon-in-mcp-daemon-ts-computed-loopbackorigins-restport-and-wrote-status--4fa836c9.md",".agent_memory/packets/bug_fix-the-base-state-of-mcp-delegation-ratify-ts-and-mcp-delegation-contract-ts-in-thi-864eb8f8.md",".agent_memory/packets/decision-controlops-tell-variant-needed-an-optional-steerid-field-so-the-supervisor-proce-1af86b49.md",".agent_memory/packets/decision-goal-cards-can-only-ever-appear-in-list-work-layout-v-work-layout-board-hides-wo-7c20ccdb.md",".agent_memory/packets/decision-kage-ui-dependency-free-tui-with-a-pure-render-reducer-core-5d16b8f2.md",".agent_memory/packets/decision-manager-judgment-is-recorded-kernel-validated-and-measured-against-outcomes-67a0e55c.md",".agent_memory/packets/decision-runview-withactivity-never-carried-goal-id-api-ts-had-to-compute-it-explicitly-a-118b2ca1.md",".agent_memory/packets/decision-the-room-composers-plain-enter-keydown-branch-guards-only-on-ev-shiftkey-not-alt-d54eb44f.md",".agent_memory/packets/decision-the-room-is-the-apps-front-door-runs-are-its-bookkeeping-not-its-purpose-f997ed57.md",".agent_memory/packets/workflow-change-memory-kage-commit-mcp-delegation-to-the-repo-then-i-260812-db9b-6fa998a4.md",".agent_memory/packets/workflow-change-memory-kage-fix-project-switching-ensureappdaemon-in-260817-52dc-721528b8.md",".agent_memory/packets/workflow-change-memory-kage-goals-o1-the-orchestration-substrate-bac-260818-c6b6-01bdcad3.md",".agent_memory/packets/workflow-change-memory-kage-the-interaction-substrate-run-1-of-3-bac-260818-4077-7a29f13b.md",".agent_memory/packets/workflow-change-memory-kage-wave-3-the-interaction-surface-wire-the-260818-9bfd-7e0065a3.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md",".gitignore","mcp/delegation-api.test.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1.json"}],"context":{"fact":"Current branch kage/goals-o2-the-goal-surface-in-the-app-bac-260818-bbd1 changes 22 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-21T08:42:27.260Z","ttl_days":180,"path_fingerprints":[{"path":".gitignore","sha256":"dae4a0c152b8068f09c3cec18cb44e237fcaff928ff61826d335b8dc17bc52e9","size":1369},{"path":"mcp/delegation-api.test.ts","sha256":"5664b212d3adef17954a296672ff7ce2be4feb285f82989abbcdae276b854adb","size":75803,"symbols":[{"name":"room","kind":"constant","sha256":"daca1174495725bcfe924b660b84e822be76aea4fbb7dc3ebb244be8b8a9aa47"},{"name":"port","kind":"constant","sha256":"7c964228adbf65b8998acc676247c7704778c78028c763802a949b8802672344"},{"name":"wrote","kind":"constant","sha256":"dc4dff0abd3968e2f674c46f7a66fc535c9c6745229d9c89c1ca88fccd02f6cb"},{"name":"pattern","kind":"constant","sha256":"b8010ef590f32fea724c737b63d306c7f092408770e9641a4bc0f23aac820d54"},{"name":"packet","kind":"constant","sha256":"6d114c969d92605b6ab68542472d505ce3b8ab25aa8ff2c3d89cac9af2eb0b95"},{"name":"diff","kind":"constant","sha256":"4755f26124dc87f6c211031d5c8f7b97491ca68a2f89a4a806acbacee62110a6"},{"name":"after","kind":"constant","sha256":"d051c692f49a215432f0e8b7ba363f12fcdcfb0f1c763962e308b5b556d01b54"},{"name":"known","kind":"constant","sha256":"e7c7aa8bbc7ba7d4083fd56c850944dfe396f85703a8cdf0f3d4b12fa2f78563"},{"name":"list","kind":"constant","sha256":"385ad89762910c2d07a3657a28d80425db452ebb7c9db280f45ac7b213534128"}]},{"path":"mcp/delegation/api.ts","sha256":"d1077c15541b482bc643e6d580bbd75e1a9be99042f5151f19c3ce306866d2ef","size":84279,"symbols":[{"name":"text","kind":"constant","sha256":"c821f21e865b5862788006905c0f4fd09dd7ef6d223fcf2c505033203d6555aa"},{"name":"room","kind":"constant","sha256":"a9a23abe365a041f26787a2ec73b24fda2145c66a24433d13a5a8f56c3aae380"},{"name":"withactivity","kind":"function","sha256":"ed362ec1b6abc26cfdb9f678d3c0679e1146c3a4d01750ddedbda24e578b70d9"},{"name":"files","kind":"constant","sha256":"10f5a322e356009fe3570a8b1fc93b0e50f550074efda18f91eb7ba5b0cd7445"},{"name":"change","kind":"constant","sha256":"b3e774e47224ceab04308a4b2408fdc25f84082e73ac544f4f45949d63ca929f"},{"name":"runs","kind":"constant","sha256":"aeed515a96dc123ddceac928842184b148f9bbd85f63bccbb0918926221c95e2"},{"name":"packet","kind":"constant","sha256":"e71a4806ab105f9413aed2fb80d62995b29b2c809b72ebecbfeb144a235fbfa9"},{"name":"status","kind":"constant","sha256":"8b91b7e75be53e1b6fe5c90576bda8e433a4df31f1db40784c006ac69a9a5033"},{"name":"wave","kind":"constant","sha256":"8a2d01548d8ef0d9606168bcb7af14e428362c5de9500a337a1edc9be6634aaa"},{"name":"agent","kind":"constant","sha256":"73eaaefa603f1faada136a1ce30a9c4bb4443c8e5a7f71bfcd673cf695bda208"},{"name":"review","kind":"constant","sha256":"7c0b0c31ee0caf0c4d20062be955753ae103929f46875ee14d0f8598afa98013"},{"name":"current","kind":"constant","sha256":"9c4cd387881f26f6987d035a16dca7885b8f9aaedb8ca13696be65c344bf840a"}]},{"path":"mcp/delegation/app-client.ts","sha256":"d0a0da1c3d3ca06e406bdc09b2cf71dee565c1e5b3ebb74c052298fea6362c25","size":225599},{"path":"mcp/delegation/app-html.ts","sha256":"baf9366fd8f75ccf35ca1c09005d106e88ebb76b58548d39ada9a4c74a97052a","size":15725},{"path":"mcp/delegation/app-styles.ts","sha256":"f8f8a3abf2123732b28846749b66e8074b4694e8a6a1311c9dfa7446251462d2","size":84897}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-ensureappdaemons-old-default-parameter-portoroptions-default-app-port-meant-ever-6e921d94.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-startdaemon-in-mcp-daemon-ts-computed-loopbackorigins-restport-and-wrote-status--4fa836c9.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-the-base-state-of-mcp-delegation-ratify-ts-and-mcp-delegation-contract-ts-in-thi-864eb8f8.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-controlops-tell-variant-needed-an-optional-steerid-field-so-the-supervisor-proce-1af86b49.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-goal-cards-can-only-ever-appear-in-list-work-layout-v-work-layout-board-hides-wo-7c20ccdb.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-kage-ui-dependency-free-tui-with-a-pure-render-reducer-core-5d16b8f2.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-manager-judgment-is-recorded-kernel-validated-and-measured-against-outcomes-67a0e55c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-runview-withactivity-never-carried-goal-id-api-ts-had-to-compute-it-explicitly-a-118b2ca1.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-room-composers-plain-enter-keydown-branch-guards-only-on-ev-shiftkey-not-alt-d54eb44f.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-room-is-the-apps-front-door-runs-are-its-bookkeeping-not-its-purpose-f997ed57.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-commit-mcp-delegation-to-the-repo-then-i-260812-db9b-6fa998a4.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-fix-project-switching-ensureappdaemon-in-260817-52dc-721528b8.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-goals-o1-the-orchestration-substrate-bac-260818-c6b6-01bdcad3.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-the-interaction-substrate-run-1-of-3-bac-260818-4077-7a29f13b.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-wave-3-the-interaction-surface-wire-the-260818-9bfd-7e0065a3.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.gitignore","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation-api.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-goal-cards-can-only-ever-appear-in-list-work-layout-v-work-layout-board-hides-wo-7c20ccdb.md, .agent_memory/packets/decision-runview-withactivity-never-carried-goal-id-api-ts-had-to-compute-it-explicitly-a-118b2ca1.md, .agent_memory/packets/decision-the-room-composers-plain-enter-keydown-branch-guards-only-on-ev-shiftkey-not-alt-d54eb44f.md"],"duplicate_candidates":[],"estimated_tokens_saved":1067,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-21T08:42:27.260Z"},"created_at":"2026-08-18T06:52:42.653Z","updated_at":"2026-08-21T08:42:27.260Z"}
```

