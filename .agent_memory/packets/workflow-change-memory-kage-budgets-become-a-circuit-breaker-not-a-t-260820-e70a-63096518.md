---
type: "Workflow"
title: "Change memory: kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a"
description: "Repo-local context for 28 changed repo paths on kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a."
resource: "docs/design/CONTEXT_ENGINE.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-budgets-become-a-circuit-breaker-not-a-t-260820-e70a"]
timestamp: "2026-08-20T12:42:11.333Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-budgets-become-a-circuit-breaker-not-a-t-260820-e70a"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["docs/design/CONTEXT_ENGINE.md", "docs/design/MEMORY_STORE.md", "docs/design/SESSIONS_SURFACE.md", "mcp/budget-config.test.ts", "mcp/cli.ts", "mcp/concurrency-queue.test.ts", "mcp/context-doc.test.ts", "mcp/daemon.ts", "mcp/delegation/app-client.ts", "mcp/delegation/config.ts", "mcp/delegation/contract.ts", "mcp/delegation/dispatch.ts", "mcp/delegation/recovery.ts", "mcp/delegation/supervisor.ts", "mcp/delegation/tui/app.ts", "mcp/resume-budgets.test.ts", "mcp/run-budget.test.ts", "mcp/sessions-doc.test.ts", "mcp/stall-detector.test.ts", "mcp/store-doc.test.ts"]
---

# Change memory: kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a

> Repo-local context for 28 changed repo paths on kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md
- .agent_memory/packets/decision-claude-codes-live-stream-json-protocol-emits-exactly-one-result-event-per-full-a-6260e051.md
- .agent_memory/packets/decision-the-concurrency-cap-had-two-independent-compounding-bugs-a-checked-after-the-age-5efeeb6b.md
- .agent_memory/packets/reference-aos-actual-architecture-read-from-its-live-daemon-and-sqlite-one-sessions-table--0552ae74.md
- .agent_memory/packets/workflow-change-memory-kage-one-manager-session-the-way-ao-does-it-t-260820-eb37-59ec7760.md
- .agent_memory/packets/workflow-change-memory-kage-write-docs-design-context-engine-md-the-260820-7f89-4d56952d.md
- .agent_memory/packets/workflow-change-memory-kage-write-docs-design-memory-store-md-the-ar-260820-65a4-d3652b73.md
- .agent_memory/packets/workflow-change-memory-kage-write-docs-design-sessions-surface-md-th-260820-8f4e-49e45f08.md
- docs/design/CONTEXT_ENGINE.md
- docs/design/MEMORY_STORE.md
- docs/design/SESSIONS_SURFACE.md
- mcp/budget-config.test.ts
- mcp/cli.ts
- mcp/concurrency-queue.test.ts
- mcp/context-doc.test.ts
- mcp/daemon.ts
- mcp/delegation/app-client.ts
- mcp/delegation/config.ts
- mcp/delegation/contract.ts
- mcp/delegation/dispatch.ts
- mcp/delegation/recovery.ts
- mcp/delegation/supervisor.ts
- mcp/delegation/tui/app.ts
- mcp/resume-budgets.test.ts
- mcp/run-budget.test.ts
- mcp/sessions-doc.test.ts
- mcp/stall-detector.test.ts
- mcp/store-doc.test.ts

Diff summary:
```text
...-option-at-all-independent-of-daemo-e8f3b4de.md |  67 -----
 ...exactly-one-result-event-per-full-a-6260e051.md |  67 -----
 ...unding-bugs-a-checked-after-the-age-5efeeb6b.md |  67 -----
 mcp/budget-config.test.ts                          |  52 +---
 mcp/cli.ts                                         |  56 ++--
 mcp/concurrency-queue.test.ts                      | 238 ---------------
 mcp/daemon.ts                                      |   9 -
 mcp/delegation/app-client.ts                       |   5 +-
 mcp/delegation/config.ts                           |   8 +-
 mcp/delegation/contract.ts                         | 124 +++-----
 mcp/delegation/dispatch.ts                         |  34 ---
 mcp/delegation/recovery.ts                         |  61 ++--
 mcp/delegation/supervisor.ts                       | 297 +------------------
 mcp/delegation/tui/app.ts                          |   5 +-
 mcp/resume-budgets.test.ts                         | 174 +++++------
 mcp/run-budget.test.ts                             |  10 +-
 mcp/stall-detector.test.ts                         | 328 ---------------------
 17 files changed, 191 insertions(+), 1411 deletions(-)
.agent_memory/packets/reference-aos-actual-architecture-read-from-its-live-daemon-and-sqlite-one-sessions-table--0552ae74.md | untracked
.agent_memory/packets/workflow-change-memory-kage-one-manager-session-the-way-ao-does-it-t-260820-eb37-59ec7760.md | untracked
.agent_memory/packets/workflow-change-memory-kage-write-docs-design-context-engine-md-the-260820-7f89-4d56952d.md | untracked
.agent_memory/packets/workflow-change-memory-kage-write-docs-design-memory-store-md-the-ar-260820-65a4-d3652b73.md | untracked
.agent_memory/packets/workflow-change-memory-kage-write-docs-design-sessions-surface-md-th-260820-8f4e-49e45f08.md | untracked
docs/design/CONTEXT_ENGINE.md | untracked
docs/design/MEMORY_STORE.md | untracked
docs/design/SESSIONS_SURFACE.md | untracked
mcp/context-doc.test.ts | untracked
mcp/sessions-doc.test.ts | untracked
mcp/store-doc.test.ts | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-budgets-become-a-circuit-breaker-not-a-t-260820-e70a","title":"Change memory: kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a","summary":"Repo-local context for 28 changed repo paths on kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md\n- .agent_memory/packets/decision-claude-codes-live-stream-json-protocol-emits-exactly-one-result-event-per-full-a-6260e051.md\n- .agent_memory/packets/decision-the-concurrency-cap-had-two-independent-compounding-bugs-a-checked-after-the-age-5efeeb6b.md\n- .agent_memory/packets/reference-aos-actual-architecture-read-from-its-live-daemon-and-sqlite-one-sessions-table--0552ae74.md\n- .agent_memory/packets/workflow-change-memory-kage-one-manager-session-the-way-ao-does-it-t-260820-eb37-59ec7760.md\n- .agent_memory/packets/workflow-change-memory-kage-write-docs-design-context-engine-md-the-260820-7f89-4d56952d.md\n- .agent_memory/packets/workflow-change-memory-kage-write-docs-design-memory-store-md-the-ar-260820-65a4-d3652b73.md\n- .agent_memory/packets/workflow-change-memory-kage-write-docs-design-sessions-surface-md-th-260820-8f4e-49e45f08.md\n- docs/design/CONTEXT_ENGINE.md\n- docs/design/MEMORY_STORE.md\n- docs/design/SESSIONS_SURFACE.md\n- mcp/budget-config.test.ts\n- mcp/cli.ts\n- mcp/concurrency-queue.test.ts\n- mcp/context-doc.test.ts\n- mcp/daemon.ts\n- mcp/delegation/app-client.ts\n- mcp/delegation/config.ts\n- mcp/delegation/contract.ts\n- mcp/delegation/dispatch.ts\n- mcp/delegation/recovery.ts\n- mcp/delegation/supervisor.ts\n- mcp/delegation/tui/app.ts\n- mcp/resume-budgets.test.ts\n- mcp/run-budget.test.ts\n- mcp/sessions-doc.test.ts\n- mcp/stall-detector.test.ts\n- mcp/store-doc.test.ts\n\nDiff summary:\n```text\n...-option-at-all-independent-of-daemo-e8f3b4de.md |  67 -----\n ...exactly-one-result-event-per-full-a-6260e051.md |  67 -----\n ...unding-bugs-a-checked-after-the-age-5efeeb6b.md |  67 -----\n mcp/budget-config.test.ts                          |  52 +---\n mcp/cli.ts                                         |  56 ++--\n mcp/concurrency-queue.test.ts                      | 238 ---------------\n mcp/daemon.ts                                      |   9 -\n mcp/delegation/app-client.ts                       |   5 +-\n mcp/delegation/config.ts                           |   8 +-\n mcp/delegation/contract.ts                         | 124 +++-----\n mcp/delegation/dispatch.ts                         |  34 ---\n mcp/delegation/recovery.ts                         |  61 ++--\n mcp/delegation/supervisor.ts                       | 297 +------------------\n mcp/delegation/tui/app.ts                          |   5 +-\n mcp/resume-budgets.test.ts                         | 174 +++++------\n mcp/run-budget.test.ts                             |  10 +-\n mcp/stall-detector.test.ts                         | 328 ---------------------\n 17 files changed, 191 insertions(+), 1411 deletions(-)\n.agent_memory/packets/reference-aos-actual-architecture-read-from-its-live-daemon-and-sqlite-one-sessions-table--0552ae74.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-one-manager-session-the-way-ao-does-it-t-260820-eb37-59ec7760.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-write-docs-design-context-engine-md-the-260820-7f89-4d56952d.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-write-docs-design-memory-store-md-the-ar-260820-65a4-d3652b73.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-write-docs-design-sessions-surface-md-th-260820-8f4e-49e45f08.md | untracked\ndocs/design/CONTEXT_ENGINE.md | untracked\ndocs/design/MEMORY_STORE.md | untracked\ndocs/design/SESSIONS_SURFACE.md | untracked\nmcp/context-doc.test.ts | untracked\nmcp/sessions-doc.test.ts | untracked\nmcp/store-doc.test.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-budgets-become-a-circuit-breaker-not-a-t-260820-e70a"],"paths":["docs/design/CONTEXT_ENGINE.md","docs/design/MEMORY_STORE.md","docs/design/SESSIONS_SURFACE.md","mcp/budget-config.test.ts","mcp/cli.ts","mcp/concurrency-queue.test.ts","mcp/context-doc.test.ts","mcp/daemon.ts","mcp/delegation/app-client.ts","mcp/delegation/config.ts","mcp/delegation/contract.ts","mcp/delegation/dispatch.ts","mcp/delegation/recovery.ts","mcp/delegation/supervisor.ts","mcp/delegation/tui/app.ts","mcp/resume-budgets.test.ts","mcp/run-budget.test.ts","mcp/sessions-doc.test.ts","mcp/stall-detector.test.ts","mcp/store-doc.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a","head":"f8d0da7fd5a59f537275744d338b7a5358250fa6","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md",".agent_memory/packets/decision-claude-codes-live-stream-json-protocol-emits-exactly-one-result-event-per-full-a-6260e051.md",".agent_memory/packets/decision-the-concurrency-cap-had-two-independent-compounding-bugs-a-checked-after-the-age-5efeeb6b.md",".agent_memory/packets/reference-aos-actual-architecture-read-from-its-live-daemon-and-sqlite-one-sessions-table--0552ae74.md",".agent_memory/packets/workflow-change-memory-kage-one-manager-session-the-way-ao-does-it-t-260820-eb37-59ec7760.md",".agent_memory/packets/workflow-change-memory-kage-write-docs-design-context-engine-md-the-260820-7f89-4d56952d.md",".agent_memory/packets/workflow-change-memory-kage-write-docs-design-memory-store-md-the-ar-260820-65a4-d3652b73.md",".agent_memory/packets/workflow-change-memory-kage-write-docs-design-sessions-surface-md-th-260820-8f4e-49e45f08.md","docs/design/CONTEXT_ENGINE.md","docs/design/MEMORY_STORE.md","docs/design/SESSIONS_SURFACE.md","mcp/budget-config.test.ts","mcp/cli.ts","mcp/concurrency-queue.test.ts","mcp/context-doc.test.ts","mcp/daemon.ts","mcp/delegation/app-client.ts","mcp/delegation/config.ts","mcp/delegation/contract.ts","mcp/delegation/dispatch.ts","mcp/delegation/recovery.ts","mcp/delegation/supervisor.ts","mcp/delegation/tui/app.ts","mcp/resume-budgets.test.ts","mcp/run-budget.test.ts","mcp/sessions-doc.test.ts","mcp/stall-detector.test.ts","mcp/store-doc.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-budgets-become-a-circuit-breaker-not-a-t-260820-e70a.json"}],"context":{"fact":"Current branch kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a changes 28 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:11.333Z","ttl_days":180,"path_fingerprints":[{"path":"docs/design/CONTEXT_ENGINE.md","sha256":"4dd0743cd7c6707aca4b0d0f6ef3e11845b0d743514694f66d7a9e495afce713","size":18628},{"path":"docs/design/MEMORY_STORE.md","sha256":"81337fcfa918d0cf4123ee1dc9caeda75ea2f61b07b007522f5b2bec0b40343d","size":31430},{"path":"docs/design/SESSIONS_SURFACE.md","sha256":"600dec1ad87ee24385087148a282b5c1d66b460c496e72574571936e32ab6528","size":25310},{"path":"mcp/budget-config.test.ts","sha256":"67ef9b7b2dd2101c83a427b9e532470af6090792d5f8e9a09309d47550f58529","size":8859,"symbols":[{"name":"budgets","kind":"constant","sha256":"dcb852b1c97fea255577cad609c6a219e78d298dfc959953f4948b3772d014b6"}]},{"path":"mcp/cli.ts","sha256":"f49dea5e35b66b1309c62c71f90a8b0a6986061d7956f3417bcb330139cd14e3","size":150054,"symbols":[{"name":"files","kind":"constant","sha256":"8984fb1011c0e9e4a2f8140ee1b80011ee39c80fba2fb0d6012223d8cc01fbfb"},{"name":"review","kind":"function","sha256":"cd5b65cd476d7eaecccc181de3bcad5b3d7c99237dcbfce313709f8eb35f9a13"},{"name":"command","kind":"constant","sha256":"9e594169e1f8559f50d7e73b407f1aa3a9a0f14bf43a676fedefa72734badb98"},{"name":"packets","kind":"constant","sha256":"08565eddc844fbb13d207b1a5875e07b52807950760d7784cce666504b0eda13"},{"name":"json","kind":"constant","sha256":"9115381310c6d4c5ecb25a7e67e4fd0bb4b20a9b328adb25b606065454f79370"},{"name":"current","kind":"constant","sha256":"471f3cfbffa04d6ecddb2f3d4013027b71237de766afb69ec418f1f1b8308937"},{"name":"agent","kind":"constant","sha256":"5b9caa614311fe691d6af171b9a8985b0d49464b9df178ad28ff5b9883eb4cf2"},{"name":"known","kind":"constant","sha256":"437d0eb26101b2e1555d61ea245e3062bfdddc1f818e825cfd3beb6a375f05a8"},{"name":"from","kind":"constant","sha256":"b386d829bcacbd9e216c726f6dff71fc7d8a53aade383fa45b850387414b780c"},{"name":"summary","kind":"constant","sha256":"0938b0afc17695033381e2248401bba9b7c6abb6f9f0eaae0d2a8ff2c660d662"},{"name":"event","kind":"constant","sha256":"e4401a825d6163bc16311a92ed99670dc7ea3ac3cf1cece53779972e77fa1527"},{"name":"durable","kind":"constant","sha256":"59e1af86ee722f58562da0478f6f3fe6621ae96f9473de8c0037e63fe779215e"},{"name":"test","kind":"constant","sha256":"c67f3770bf3c3e9b9aff73d99406c7664a900a970c68cfe75a1efefbd4447185"},{"name":"budget","kind":"constant","sha256":"8196d796363d7bb23e6e0eba0310fe3a88e3dde195e0508da66190e990618966"}]},{"path":"mcp/concurrency-queue.test.ts","sha256":"50efdd90f4c695f5b36dd90405d0f49992f0322fd074a1c3dd1bdd824f9bed60","size":13557},{"path":"mcp/context-doc.test.ts","sha256":"3c9a21f3b0e018a36c34f3100578db27bcec0923a656ab43d7b86fcd161af28f","size":9816},{"path":"mcp/daemon.ts","sha256":"5fbd1abcbbbafeffebfcf4208d562b846f0f309d2d64861531459b485c14e93e","size":53327,"symbols":[{"name":"json","kind":"function","sha256":"c6cfd13a6f9203c85fedf4efd643fcb209309a376a34ce77909c444a05e9b0e5"},{"name":"text","kind":"constant","sha256":"70f68baaeedf940b18569f940046a8a0a978afd00077c6b27618336a05fa1cc1"},{"name":"files","kind":"constant","sha256":"69140299050f3544f2a8f5cdcfa3672dd7f2a78cf8960d3197b23624253b5b9e"}]},{"path":"mcp/delegation/app-client.ts","sha256":"ded26e7b2ea02db2b4eade9056358d995b0517b8f9cf1181245a867beb33bafb","size":206711},{"path":"mcp/delegation/config.ts","sha256":"bcf16139575549cce06a09bba484cfe9f6efb2354a35a9c4704119af48d228f3","size":7960},{"path":"mcp/delegation/contract.ts","sha256":"b00fed2868c1a4c64be39b8d82e4b49a7414c7f2eb1c9e6b5cd561c954f03891","size":50356,"symbols":[{"name":"budget","kind":"constant","sha256":"384d19c5e4dcc60e64c4cba1aba25131d3930a3de3c394f0ee612f3d3a68873e"},{"name":"createrun","kind":"function","sha256":"cc31a789a8814c0c8f24a806bf4f8f37a899d0646d5ef930c94807515eb95c4f"},{"name":"result","kind":"constant","sha256":"ac5f4ab8c16ed3f29fa6e4e8187f7361b4432100282521bf1bc62dfb2b4f79da"},{"name":"change","kind":"constant","sha256":"e499aa50ffbb9c260caec4bb421746f795f0062475fe49fbee7f283705f385e8"},{"name":"from","kind":"constant","sha256":"bd2200c07292af9f1ac297cdf2d079dea9c17bd2c3ee4d9522b7a3bb5c07a013"}]},{"path":"mcp/delegation/dispatch.ts","sha256":"8ffa9bcf9d6458a52aaf472946ca73b1a6408ecbda47ddd09124bceffa861e05","size":23982,"symbols":[{"name":"result","kind":"constant","sha256":"0581aeea4384d52610a5a3a6b2250467bbbb34a444c13d6351948929b699fc47"}]},{"path":"mcp/delegation/recovery.ts","sha256":"53e2ce4554dba768bbad9bbc3c0b107dad9d51bf6dedf6bfa8e59353c6133b0b","size":14080},{"path":"mcp/delegation/supervisor.ts","sha256":"d8ed31b23d0078e3e8e44e233ec819b4b203ed5e0b1a47f1a4858c834f5bfd4f","size":43021,"symbols":[{"name":"result","kind":"constant","sha256":"7ddfa5fb8fbc03e08b55b77c544e31123755ea081ec606bb93fa1204b146911c"}]},{"path":"mcp/delegation/tui/app.ts","sha256":"9cfd718cfa050f41e316077360e30237ce744f380409ca58ebdbffe0ac027e83","size":22761,"symbols":[{"name":"text","kind":"constant","sha256":"6d9157544527c6f83a96f7aa2e1470ef6f16602dd3ad2ce69326e587b1bad909"},{"name":"diff","kind":"constant","sha256":"b6de11fe792100d939c304e211e21823ad8fa0fea9ccb90635283762aca5598f"},{"name":"agent","kind":"constant","sha256":"64f153b983ebc84ba97ba4accd6c0175bbd5df655dd6359b1b2414a49e0a31af"}]},{"path":"mcp/resume-budgets.test.ts","sha256":"b188509c71c73400c5e7be4ef6c45fa12891e9e8cfb4356d782a6d393799fe89","size":19956},{"path":"mcp/run-budget.test.ts","sha256":"08932eb17f286ea81c464893f077eb86605d6f7ffff3c4777005cb54b9a72230","size":8330},{"path":"mcp/sessions-doc.test.ts","sha256":"1cbb45370908b9d755de74f4123f118903430fedd9d7f1d335aeb5789e678fa8","size":16022,"symbols":[{"name":"paths","kind":"constant","sha256":"5ad5a4ae64675831f8e3795d77adf6c853a454fae00a452f8f6116c31ea34084"}]},{"path":"mcp/stall-detector.test.ts","sha256":"ad3a6b5fad3fcec271945ec792f7b3a9a1df92b7600f6644d5a1b6f9e93b17d8","size":17604,"symbols":[{"name":"result","kind":"constant","sha256":"79c895a18b29d025e66e52e452f8b2833447afe53765fa28395ac77f516c266f"}]},{"path":"mcp/store-doc.test.ts","sha256":"ce6a29e5b8126cda86e69ee0862a1f4b228a99db411c5d6c728ac3a3027b5234","size":24402}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-claude-codes-live-stream-json-protocol-emits-exactly-one-result-event-per-full-a-6260e051.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-concurrency-cap-had-two-independent-compounding-bugs-a-checked-after-the-age-5efeeb6b.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/reference-aos-actual-architecture-read-from-its-live-daemon-and-sqlite-one-sessions-table--0552ae74.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-one-manager-session-the-way-ao-does-it-t-260820-eb37-59ec7760.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-write-docs-design-context-engine-md-the-260820-7f89-4d56952d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-write-docs-design-memory-store-md-the-ar-260820-65a4-d3652b73.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-write-docs-design-sessions-surface-md-th-260820-8f4e-49e45f08.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/CONTEXT_ENGINE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/MEMORY_STORE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/SESSIONS_SURFACE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/budget-config.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/concurrency-queue.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/context-doc.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/daemon.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/config.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/contract.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/dispatch.ts","evidence":"git_diff"}],"quality":{"score":72,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md, .agent_memory/packets/decision-claude-codes-live-stream-json-protocol-emits-exactly-one-result-event-per-full-a-6260e051.md, .agent_memory/packets/decision-the-concurrency-cap-had-two-independent-compounding-bugs-a-checked-after-the-age-5efeeb6b.md, mcp/concurrency-queue.test.ts"],"duplicate_candidates":[],"estimated_tokens_saved":1076,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:11.333Z"},"created_at":"2026-08-20T06:05:01.053Z","updated_at":"2026-08-20T12:42:11.333Z"}
```

