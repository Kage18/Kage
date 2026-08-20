---
type: "Workflow"
title: "Change memory: kage/every-dead-end-in-the-app-gets-a-next-st-260820-8681"
description: "Repo-local context for 26 changed repo paths on kage/every-dead-end-in-the-app-gets-a-next-st-260820-8681."
resource: "docs/BENCHMARKS.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681"]
timestamp: "2026-08-20T12:42:07.032Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["docs/BENCHMARKS.md", "docs/design/MEMORY_STORE.md", "mcp/bench/fixture.ts", "mcp/bench/harness.ts", "mcp/bench/run-one.ts", "mcp/bench/run.ts", "mcp/cli.ts", "mcp/dead-ends.test.ts", "mcp/delegation/api.ts", "mcp/delegation/app-client.ts", "mcp/delegation/app-html.ts", "mcp/delegation/app-styles.ts", "mcp/delegation/contract.ts", "mcp/delegation/recovery.ts", "mcp/kernel.ts", "mcp/scale-guard.test.ts", "mcp/store-doc.test.ts"]
---

# Change memory: kage/every-dead-end-in-the-app-gets-a-next-st-260820-8681

> Repo-local context for 26 changed repo paths on kage/every-dead-end-in-the-app-gets-a-next-st-260820-8681.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/decision-app-client-tss-very-first-executable-statement-after-var-state-is-if-navig-dbb83438.md
- .agent_memory/packets/decision-mcp-delegation-app-client-tss-whole-body-is-one-ts-template-literal-and-single-b-c92b1eb5.md
- .agent_memory/packets/decision-mcp-delegation-recovery-tss-resumestoppedrun-only-gates-on-the-usd-cap-checkrunb-23655251.md
- .agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md
- .agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md
- .agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md
- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md
- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- docs/BENCHMARKS.md
- docs/design/MEMORY_STORE.md
- mcp/bench/fixture.ts
- mcp/bench/harness.ts
- mcp/bench/run-one.ts
- mcp/bench/run.ts
- mcp/cli.ts
- mcp/dead-ends.test.ts
- mcp/delegation/api.ts
- mcp/delegation/app-client.ts
- mcp/delegation/app-html.ts
- mcp/delegation/app-styles.ts
- mcp/delegation/contract.ts
- mcp/delegation/recovery.ts
- mcp/kernel.ts
- mcp/scale-guard.test.ts
- mcp/store-doc.test.ts

Diff summary:
```text
...atement-after-var-state-is-if-navig-dbb83438.md |  57 ---
 ...ne-ts-template-literal-and-single-b-c92b1eb5.md |  57 ---
 ...only-gates-on-the-usd-cap-checkrunb-23655251.md |  57 ---
 ...workflow-change-memory-release-prep-a72d4251.md |  28 +-
 docs/BENCHMARKS.md                                 |  79 +++
 docs/design/MEMORY_STORE.md                        |  31 +-
 mcp/cli.ts                                         |   6 +
 mcp/dead-ends.test.ts                              | 551 ---------------------
 mcp/delegation/api.ts                              |  32 +-
 mcp/delegation/app-client.ts                       | 272 +---------
 mcp/delegation/app-html.ts                         |   6 -
 mcp/delegation/app-styles.ts                       |  26 +-
 mcp/delegation/contract.ts                         |  27 -
 mcp/delegation/recovery.ts                         |  24 -
 mcp/kernel.ts                                      |  37 ++
 mcp/store-doc.test.ts                              |  34 +-
 16 files changed, 212 insertions(+), 1112 deletions(-)
.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md | untracked
.agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked
mcp/bench/fixture.ts | untracked
mcp/bench/harness.ts | untracked
mcp/bench/run-one.ts | untracked
mcp/bench/run.ts | untracked
mcp/scale-guard.test.ts | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681","title":"Change memory: kage/every-dead-end-in-the-app-gets-a-next-st-260820-8681","summary":"Repo-local context for 26 changed repo paths on kage/every-dead-end-in-the-app-gets-a-next-st-260820-8681.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-app-client-tss-very-first-executable-statement-after-var-state-is-if-navig-dbb83438.md\n- .agent_memory/packets/decision-mcp-delegation-app-client-tss-whole-body-is-one-ts-template-literal-and-single-b-c92b1eb5.md\n- .agent_memory/packets/decision-mcp-delegation-recovery-tss-resumestoppedrun-only-gates-on-the-usd-cap-checkrunb-23655251.md\n- .agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md\n- .agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md\n- .agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md\n- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md\n- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- docs/BENCHMARKS.md\n- docs/design/MEMORY_STORE.md\n- mcp/bench/fixture.ts\n- mcp/bench/harness.ts\n- mcp/bench/run-one.ts\n- mcp/bench/run.ts\n- mcp/cli.ts\n- mcp/dead-ends.test.ts\n- mcp/delegation/api.ts\n- mcp/delegation/app-client.ts\n- mcp/delegation/app-html.ts\n- mcp/delegation/app-styles.ts\n- mcp/delegation/contract.ts\n- mcp/delegation/recovery.ts\n- mcp/kernel.ts\n- mcp/scale-guard.test.ts\n- mcp/store-doc.test.ts\n\nDiff summary:\n```text\n...atement-after-var-state-is-if-navig-dbb83438.md |  57 ---\n ...ne-ts-template-literal-and-single-b-c92b1eb5.md |  57 ---\n ...only-gates-on-the-usd-cap-checkrunb-23655251.md |  57 ---\n ...workflow-change-memory-release-prep-a72d4251.md |  28 +-\n docs/BENCHMARKS.md                                 |  79 +++\n docs/design/MEMORY_STORE.md                        |  31 +-\n mcp/cli.ts                                         |   6 +\n mcp/dead-ends.test.ts                              | 551 ---------------------\n mcp/delegation/api.ts                              |  32 +-\n mcp/delegation/app-client.ts                       | 272 +---------\n mcp/delegation/app-html.ts                         |   6 -\n mcp/delegation/app-styles.ts                       |  26 +-\n mcp/delegation/contract.ts                         |  27 -\n mcp/delegation/recovery.ts                         |  24 -\n mcp/kernel.ts                                      |  37 ++\n mcp/store-doc.test.ts                              |  34 +-\n 16 files changed, 212 insertions(+), 1112 deletions(-)\n.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked\nmcp/bench/fixture.ts | untracked\nmcp/bench/harness.ts | untracked\nmcp/bench/run-one.ts | untracked\nmcp/bench/run.ts | untracked\nmcp/scale-guard.test.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681"],"paths":["docs/BENCHMARKS.md","docs/design/MEMORY_STORE.md","mcp/bench/fixture.ts","mcp/bench/harness.ts","mcp/bench/run-one.ts","mcp/bench/run.ts","mcp/cli.ts","mcp/dead-ends.test.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/delegation/contract.ts","mcp/delegation/recovery.ts","mcp/kernel.ts","mcp/scale-guard.test.ts","mcp/store-doc.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/every-dead-end-in-the-app-gets-a-next-st-260820-8681","head":"3ed40c4b32de8e008273fc86c4656317c373d19f","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/decision-app-client-tss-very-first-executable-statement-after-var-state-is-if-navig-dbb83438.md",".agent_memory/packets/decision-mcp-delegation-app-client-tss-whole-body-is-one-ts-template-literal-and-single-b-c92b1eb5.md",".agent_memory/packets/decision-mcp-delegation-recovery-tss-resumestoppedrun-only-gates-on-the-usd-cap-checkrunb-23655251.md",".agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md",".agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md",".agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md",".agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md",".agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","docs/BENCHMARKS.md","docs/design/MEMORY_STORE.md","mcp/bench/fixture.ts","mcp/bench/harness.ts","mcp/bench/run-one.ts","mcp/bench/run.ts","mcp/cli.ts","mcp/dead-ends.test.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/delegation/contract.ts","mcp/delegation/recovery.ts","mcp/kernel.ts","mcp/scale-guard.test.ts","mcp/store-doc.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-every-dead-end-in-the-app-gets-a-next-st-260820-8681.json"}],"context":{"fact":"Current branch kage/every-dead-end-in-the-app-gets-a-next-st-260820-8681 changes 26 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:07.032Z","ttl_days":180,"path_fingerprints":[{"path":"docs/BENCHMARKS.md","sha256":"703ef609f6170812c6db7bd1e971acf6a182ebbd079abb6eb5bff7d60e3867ad","size":8335},{"path":"docs/design/MEMORY_STORE.md","sha256":"81337fcfa918d0cf4123ee1dc9caeda75ea2f61b07b007522f5b2bec0b40343d","size":31430},{"path":"mcp/bench/fixture.ts","sha256":"6f9de2587ca3db0a7fbd0976ce71edd3f0f25362631bacfc262cfed5133c8bb6","size":8770,"symbols":[{"name":"files","kind":"constant","sha256":"9097d05bc008bb898f0241936453315fdfe25a312832915a8f070cc75ed68083"},{"name":"packets","kind":"constant","sha256":"7bedc248ef048b7680d4eddf4f223f2dace04daefc829169daa8598afb3d16e6"},{"name":"current","kind":"constant","sha256":"ca326b14a72215cd86525cbeee4d9721a169461d3050a50fd44b84d6b2ea8d77"}]},{"path":"mcp/bench/harness.ts","sha256":"9e273417b08e87b403a345add7734caefd61ac5862e8ea4e66bf18f18d6c5852","size":6654,"symbols":[{"name":"files","kind":"constant","sha256":"8984fb1011c0e9e4a2f8140ee1b80011ee39c80fba2fb0d6012223d8cc01fbfb"},{"name":"current","kind":"constant","sha256":"b665b02ef71f60cf281f97fc8fb878cbd70ca5027a199b1dac345546da0207a3"},{"name":"graph","kind":"constant","sha256":"5bf948db68572ca5c9c5e45e7dfe53481f459a39655b6f68c8a31f4134116073"},{"name":"fixture","kind":"constant","sha256":"7873e2e4ba6f8b15a84c7216081c2452e2da438f9bb9cc6c2521d8f32f03e8e8"},{"name":"store","kind":"constant","sha256":"00c3021e41de7fa147a9ab332d08b8f4074d8b5196a644fbc19fa485020be095"}]},{"path":"mcp/bench/run-one.ts","sha256":"55cf3f7ff0c6fa14f5bac6f0c9f9b9b8bb8513b539cfe337017f389d81d5c3cb","size":2074,"symbols":[{"name":"files","kind":"constant","sha256":"9270def56bf553559454e31bd2b27334dbe89260bc1b33aa7fc9f529b4e04c09"},{"name":"packets","kind":"constant","sha256":"e3295f2dac5f4e06c86be5747ae054034e5d081a4299ae257dc62bb38d1f77c7"},{"name":"backend","kind":"constant","sha256":"f22fb0132c99a8345c44d49b1a85e08595fefe0cbb8878b9077f087ee26d8df2"}]},{"path":"mcp/bench/run.ts","sha256":"5a2b1d7a5a18ff0b9a325f1691d5bf19cd5ff13e1ca3a74bf13ca6343b428ed6","size":4250,"symbols":[{"name":"command","kind":"constant","sha256":"301f8ea5ef9cadb928147cd71ff2098fd96aeab89077a99cf0ddf37c7b019450"},{"name":"packets","kind":"constant","sha256":"f7e059b4a23f4f9c9366a8b67ac7b4c6eeedf3d38a0b28279bf98b44fdd38642"}]},{"path":"mcp/cli.ts","sha256":"f49dea5e35b66b1309c62c71f90a8b0a6986061d7956f3417bcb330139cd14e3","size":150054,"symbols":[{"name":"files","kind":"constant","sha256":"8984fb1011c0e9e4a2f8140ee1b80011ee39c80fba2fb0d6012223d8cc01fbfb"},{"name":"review","kind":"function","sha256":"cd5b65cd476d7eaecccc181de3bcad5b3d7c99237dcbfce313709f8eb35f9a13"},{"name":"command","kind":"constant","sha256":"9e594169e1f8559f50d7e73b407f1aa3a9a0f14bf43a676fedefa72734badb98"},{"name":"packets","kind":"constant","sha256":"08565eddc844fbb13d207b1a5875e07b52807950760d7784cce666504b0eda13"},{"name":"current","kind":"constant","sha256":"471f3cfbffa04d6ecddb2f3d4013027b71237de766afb69ec418f1f1b8308937"},{"name":"agent","kind":"constant","sha256":"5b9caa614311fe691d6af171b9a8985b0d49464b9df178ad28ff5b9883eb4cf2"},{"name":"known","kind":"constant","sha256":"437d0eb26101b2e1555d61ea245e3062bfdddc1f818e825cfd3beb6a375f05a8"},{"name":"from","kind":"constant","sha256":"b386d829bcacbd9e216c726f6dff71fc7d8a53aade383fa45b850387414b780c"},{"name":"summary","kind":"constant","sha256":"0938b0afc17695033381e2248401bba9b7c6abb6f9f0eaae0d2a8ff2c660d662"},{"name":"durable","kind":"constant","sha256":"59e1af86ee722f58562da0478f6f3fe6621ae96f9473de8c0037e63fe779215e"},{"name":"body","kind":"constant","sha256":"0f16c8a6c72ea8a0a27e0ffff5f6392ae9b152aa0b2db4815d99cf5bf7b0328a"},{"name":"test","kind":"constant","sha256":"c67f3770bf3c3e9b9aff73d99406c7664a900a970c68cfe75a1efefbd4447185"}]},{"path":"mcp/dead-ends.test.ts","sha256":"49cc08f4262d731d60278a05eba883c5a2ca754de84135a5d0326ca111527572","size":28293,"symbols":[{"name":"state","kind":"constant","sha256":"ab618be7415755b0461e1a820d4efade923e635763e7f18f009ce2248db739b9"},{"name":"text","kind":"constant","sha256":"1ffd1a9e1f81b0a588841e14dca256107291962ab6b7111f61b2b679b9c26c9f"}]},{"path":"mcp/delegation/api.ts","sha256":"30af4be6d286f7c204e38ee72a79599e7a65a2349516e9bac8245d3f420f97d5","size":78606,"symbols":[{"name":"close","kind":"method","sha256":"70140f1062e6e026deac4140ca1d95da072486787ca1c8feee4282139aef0656"},{"name":"text","kind":"constant","sha256":"c821f21e865b5862788006905c0f4fd09dd7ef6d223fcf2c505033203d6555aa"},{"name":"files","kind":"constant","sha256":"10f5a322e356009fe3570a8b1fc93b0e50f550074efda18f91eb7ba5b0cd7445"},{"name":"change","kind":"constant","sha256":"b3e774e47224ceab04308a4b2408fdc25f84082e73ac544f4f45949d63ca929f"},{"name":"packet","kind":"constant","sha256":"e71a4806ab105f9413aed2fb80d62995b29b2c809b72ebecbfeb144a235fbfa9"},{"name":"sessions","kind":"constant","sha256":"3d4a2d3fc1f138336c68efb9fbe54682c1988896a4bf62fe2b334060e952f309"},{"name":"agent","kind":"constant","sha256":"73eaaefa603f1faada136a1ce30a9c4bb4443c8e5a7f71bfcd673cf695bda208"},{"name":"current","kind":"constant","sha256":"9c4cd387881f26f6987d035a16dca7885b8f9aaedb8ca13696be65c344bf840a"}]},{"path":"mcp/delegation/app-client.ts","sha256":"ded26e7b2ea02db2b4eade9056358d995b0517b8f9cf1181245a867beb33bafb","size":206711},{"path":"mcp/delegation/app-html.ts","sha256":"ce8d9a5a3bc47b68e8aef4dd6277c2b22a08bdbb6a50e0e583d0024a2e9728e7","size":14159},{"path":"mcp/delegation/app-styles.ts","sha256":"c8d1bb16e765a5659d5a425df9d3e21f50cc10456d0095463a03618f21efbb77","size":76146},{"path":"mcp/delegation/contract.ts","sha256":"b00fed2868c1a4c64be39b8d82e4b49a7414c7f2eb1c9e6b5cd561c954f03891","size":50356,"symbols":[{"name":"body","kind":"constant","sha256":"bd6cf9d451da4fd8137e297355c231dd5cfc3c0927960cca71617a7e70351061"},{"name":"next","kind":"constant","sha256":"2714b791ab1cca4841a0c39ee5a1ca4fe5afced1e4735914dc3575b7817fc732"},{"name":"change","kind":"constant","sha256":"e499aa50ffbb9c260caec4bb421746f795f0062475fe49fbee7f283705f385e8"},{"name":"from","kind":"constant","sha256":"bd2200c07292af9f1ac297cdf2d079dea9c17bd2c3ee4d9522b7a3bb5c07a013"}]},{"path":"mcp/delegation/recovery.ts","sha256":"53e2ce4554dba768bbad9bbc3c0b107dad9d51bf6dedf6bfa8e59353c6133b0b","size":14080,"symbols":[{"name":"resumestoppedrun","kind":"function","sha256":"4f0acda60d18e3efbe391951f41dc50e62ea24a757d812f81020b051556eb221"},{"name":"statement","kind":"constant","sha256":"28e287847f8b2277bdac5876763b727e837995f8b441498d84fd7c380d415465"}]},{"path":"mcp/kernel.ts","sha256":"11d210257d690b2275a927d1b9bc0f9173735001f51f8a8cff5b45134262b6f3","size":913831,"symbols":[{"name":"untracked","kind":"constant","sha256":"8d31cffa2e43e8e8498c30a2e6eeb043120941acd973d64ecda430b13f52d855"},{"name":"explicit","kind":"constant","sha256":"3c7dc76a866b9617850dd05c43ef877cc5208ade5be761331cf32181ace414ff"},{"name":"verification","kind":"constant","sha256":"faeb54eb75a6e60ebcab087f39fdd9f971c8a3a16e25846647ab2dd5802748f3"},{"name":"code","kind":"constant","sha256":"64b81d42a4c6de11c6ff891787a63a33c198717dba5a924932817e97a8d1f7cf"},{"name":"statement","kind":"constant","sha256":"68052d2cbbc16fd308e9ffb9cc92f2e2ca33512c92c18b402018d14c98fc6307"},{"name":"after","kind":"constant","sha256":"220a1c1969c37d53268e215419dcea650ffa901162d0a25e451bd90831fb0a1b"},{"name":"verify","kind":"constant","sha256":"a52f5b45a4f358248075422f84ac83e7d291e8e7acb866eeabdb692896bc9c0d"},{"name":"relevant","kind":"constant","sha256":"ecda229c929f06ede369f9d72be3d3211fef450b1056b73a121c5d925fac2c2b"},{"name":"durable","kind":"constant","sha256":"3fa48acfe2e95fa0fcf831049f2d1aa3ddf26ddc5a1d10724db5da185389e634"},{"name":"memory","kind":"constant","sha256":"952449fe9c2c8827ca2a6a85c0d0a86b82826696ff4f88ee167500678734db36"},{"name":"state","kind":"constant","sha256":"065fd1c87ce12edcfec7baca76dc9d91e35f5ea16490d33c8f85f3bdc3fee185"}]},{"path":"mcp/scale-guard.test.ts","sha256":"866c2bfbeac77d82b3b66f4055dbcdcee7c311427edb81af85b8b1bad8f25ad0","size":9523,"symbols":[{"name":"paths","kind":"constant","sha256":"9c168b7f3581f99c023dc567e97d61f54658404dffe8e6b6d6fe5803150ac221"}]},{"path":"mcp/store-doc.test.ts","sha256":"ce6a29e5b8126cda86e69ee0862a1f4b228a99db411c5d6c728ac3a3027b5234","size":24402}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-app-client-tss-very-first-executable-statement-after-var-state-is-if-navig-dbb83438.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-delegation-app-client-tss-whole-body-is-one-ts-template-literal-and-single-b-c92b1eb5.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-delegation-recovery-tss-resumestoppedrun-only-gates-on-the-usd-cap-checkrunb-23655251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3-96e79228.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/BENCHMARKS.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/MEMORY_STORE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/bench/fixture.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/bench/harness.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/bench/run-one.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/bench/run.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/dead-ends.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-html.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-app-client-tss-very-first-executable-statement-after-var-state-is-if-navig-dbb83438.md, .agent_memory/packets/decision-mcp-delegation-app-client-tss-whole-body-is-one-ts-template-literal-and-single-b-c92b1eb5.md, .agent_memory/packets/decision-mcp-delegation-recovery-tss-resumestoppedrun-only-gates-on-the-usd-cap-checkrunb-23655251.md, mcp/dead-ends.test.ts"],"duplicate_candidates":[],"estimated_tokens_saved":1009,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:07.032Z"},"created_at":"2026-08-20T10:13:29.093Z","updated_at":"2026-08-20T12:42:07.032Z"}
```

