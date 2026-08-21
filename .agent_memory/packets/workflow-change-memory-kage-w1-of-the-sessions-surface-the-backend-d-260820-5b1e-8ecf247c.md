---
type: "Workflow"
title: "Change memory: kage/w1-of-the-sessions-surface-the-backend-d-260820-5b1e"
description: "Repo-local context for 25 changed repo paths on kage/w1-of-the-sessions-surface-the-backend-d-260820-5b1e."
resource: "docs/design/MEMORY_STORE.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e"]
timestamp: "2026-08-20T12:42:05.778Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["docs/design/MEMORY_STORE.md", "docs/design/SESSIONS_SURFACE.md", "mcp/cli.ts", "mcp/delegation/api.ts", "mcp/delegation/contract.ts", "mcp/delegation/dispatch.ts", "mcp/delegation/git.ts", "mcp/delegation/suggest.ts", "mcp/index.ts", "mcp/kernel.ts", "mcp/sessions-backend.test.ts", "mcp/sessions-doc.test.ts", "mcp/store-doc.test.ts", "mcp/store-port.test.ts", "mcp/store/json.ts", "mcp/store/manifest.ts", "mcp/store/rebuild.ts", "mcp/store/sqlite.ts", "mcp/store/types.ts"]
---

# Change memory: kage/w1-of-the-sessions-surface-the-backend-d-260820-5b1e

> Repo-local context for 25 changed repo paths on kage/w1-of-the-sessions-surface-the-backend-d-260820-5b1e.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md
- .agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md
- .agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md
- .agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md
- .agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- docs/design/MEMORY_STORE.md
- docs/design/SESSIONS_SURFACE.md
- mcp/cli.ts
- mcp/delegation/api.ts
- mcp/delegation/contract.ts
- mcp/delegation/dispatch.ts
- mcp/delegation/git.ts
- mcp/delegation/suggest.ts
- mcp/index.ts
- mcp/kernel.ts
- mcp/sessions-backend.test.ts
- mcp/sessions-doc.test.ts
- mcp/store-doc.test.ts
- mcp/store-port.test.ts
- mcp/store/json.ts
- mcp/store/manifest.ts
- mcp/store/rebuild.ts
- mcp/store/sqlite.ts
- mcp/store/types.ts

Diff summary:
```text
...workflow-change-memory-release-prep-a72d4251.md |  38 +--
 docs/design/MEMORY_STORE.md                        |   2 +-
 docs/design/SESSIONS_SURFACE.md                    |  77 +++---
 mcp/cli.ts                                         | 104 +++++++-
 mcp/delegation/api.ts                              |  82 +------
 mcp/delegation/contract.ts                         |  34 ---
 mcp/delegation/dispatch.ts                         |   3 -
 mcp/delegation/git.ts                              |  46 ----
 mcp/delegation/suggest.ts                          |  28 ---
 mcp/index.ts                                       |   7 -
 mcp/kernel.ts                                      | 196 +++++++++------
 mcp/sessions-backend.test.ts                       | 262 ---------------------
 mcp/sessions-doc.test.ts                           |  42 +---
 mcp/store-doc.test.ts                              |  68 ++++--
 mcp/store/json.ts                                  |  53 ++++-
 mcp/store/manifest.ts                              |  21 +-
 mcp/store/rebuild.ts                               |  32 ++-
 mcp/store/sqlite.ts                                |  95 +++++++-
 mcp/store/types.ts                                 |  58 ++++-
 19 files changed, 566 insertions(+), 682 deletions(-)
.agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md | untracked
.agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md | untracked
.agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md | untracked
.agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md | untracked
.agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md | untracked
mcp/store-port.test.ts | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e","title":"Change memory: kage/w1-of-the-sessions-surface-the-backend-d-260820-5b1e","summary":"Repo-local context for 25 changed repo paths on kage/w1-of-the-sessions-surface-the-backend-d-260820-5b1e.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md\n- .agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md\n- .agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md\n- .agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md\n- .agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- docs/design/MEMORY_STORE.md\n- docs/design/SESSIONS_SURFACE.md\n- mcp/cli.ts\n- mcp/delegation/api.ts\n- mcp/delegation/contract.ts\n- mcp/delegation/dispatch.ts\n- mcp/delegation/git.ts\n- mcp/delegation/suggest.ts\n- mcp/index.ts\n- mcp/kernel.ts\n- mcp/sessions-backend.test.ts\n- mcp/sessions-doc.test.ts\n- mcp/store-doc.test.ts\n- mcp/store-port.test.ts\n- mcp/store/json.ts\n- mcp/store/manifest.ts\n- mcp/store/rebuild.ts\n- mcp/store/sqlite.ts\n- mcp/store/types.ts\n\nDiff summary:\n```text\n...workflow-change-memory-release-prep-a72d4251.md |  38 +--\n docs/design/MEMORY_STORE.md                        |   2 +-\n docs/design/SESSIONS_SURFACE.md                    |  77 +++---\n mcp/cli.ts                                         | 104 +++++++-\n mcp/delegation/api.ts                              |  82 +------\n mcp/delegation/contract.ts                         |  34 ---\n mcp/delegation/dispatch.ts                         |   3 -\n mcp/delegation/git.ts                              |  46 ----\n mcp/delegation/suggest.ts                          |  28 ---\n mcp/index.ts                                       |   7 -\n mcp/kernel.ts                                      | 196 +++++++++------\n mcp/sessions-backend.test.ts                       | 262 ---------------------\n mcp/sessions-doc.test.ts                           |  42 +---\n mcp/store-doc.test.ts                              |  68 ++++--\n mcp/store/json.ts                                  |  53 ++++-\n mcp/store/manifest.ts                              |  21 +-\n mcp/store/rebuild.ts                               |  32 ++-\n mcp/store/sqlite.ts                                |  95 +++++++-\n mcp/store/types.ts                                 |  58 ++++-\n 19 files changed, 566 insertions(+), 682 deletions(-)\n.agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md | untracked\n.agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md | untracked\n.agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md | untracked\nmcp/store-port.test.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e"],"paths":["docs/design/MEMORY_STORE.md","docs/design/SESSIONS_SURFACE.md","mcp/cli.ts","mcp/delegation/api.ts","mcp/delegation/contract.ts","mcp/delegation/dispatch.ts","mcp/delegation/git.ts","mcp/delegation/suggest.ts","mcp/index.ts","mcp/kernel.ts","mcp/sessions-backend.test.ts","mcp/sessions-doc.test.ts","mcp/store-doc.test.ts","mcp/store-port.test.ts","mcp/store/json.ts","mcp/store/manifest.ts","mcp/store/rebuild.ts","mcp/store/sqlite.ts","mcp/store/types.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/w1-of-the-sessions-surface-the-backend-d-260820-5b1e","head":"3ca6beee9b81f0cea425f3c731a5fef59ab749ee","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md",".agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md",".agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md",".agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md",".agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","docs/design/MEMORY_STORE.md","docs/design/SESSIONS_SURFACE.md","mcp/cli.ts","mcp/delegation/api.ts","mcp/delegation/contract.ts","mcp/delegation/dispatch.ts","mcp/delegation/git.ts","mcp/delegation/suggest.ts","mcp/index.ts","mcp/kernel.ts","mcp/sessions-backend.test.ts","mcp/sessions-doc.test.ts","mcp/store-doc.test.ts","mcp/store-port.test.ts","mcp/store/json.ts","mcp/store/manifest.ts","mcp/store/rebuild.ts","mcp/store/sqlite.ts","mcp/store/types.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e.json"}],"context":{"fact":"Current branch kage/w1-of-the-sessions-surface-the-backend-d-260820-5b1e changes 25 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:05.778Z","ttl_days":180,"path_fingerprints":[{"path":"docs/design/MEMORY_STORE.md","sha256":"81337fcfa918d0cf4123ee1dc9caeda75ea2f61b07b007522f5b2bec0b40343d","size":31430},{"path":"docs/design/SESSIONS_SURFACE.md","sha256":"600dec1ad87ee24385087148a282b5c1d66b460c496e72574571936e32ab6528","size":25310},{"path":"mcp/cli.ts","sha256":"f49dea5e35b66b1309c62c71f90a8b0a6986061d7956f3417bcb330139cd14e3","size":150054,"symbols":[{"name":"usage","kind":"function","sha256":"ae18811d792090179a1dd739f22ccb73797ac3242802c6d28bc8cf3802bf0952"},{"name":"index","kind":"constant","sha256":"c201ee64cf24065dd2ba0bbdc7ff8399e5c1dd89783820e501d28f82019f08a8"},{"name":"files","kind":"constant","sha256":"8984fb1011c0e9e4a2f8140ee1b80011ee39c80fba2fb0d6012223d8cc01fbfb"},{"name":"review","kind":"function","sha256":"cd5b65cd476d7eaecccc181de3bcad5b3d7c99237dcbfce313709f8eb35f9a13"},{"name":"command","kind":"constant","sha256":"9e594169e1f8559f50d7e73b407f1aa3a9a0f14bf43a676fedefa72734badb98"},{"name":"packets","kind":"constant","sha256":"08565eddc844fbb13d207b1a5875e07b52807950760d7784cce666504b0eda13"},{"name":"json","kind":"constant","sha256":"9115381310c6d4c5ecb25a7e67e4fd0bb4b20a9b328adb25b606065454f79370"},{"name":"current","kind":"constant","sha256":"471f3cfbffa04d6ecddb2f3d4013027b71237de766afb69ec418f1f1b8308937"},{"name":"agent","kind":"constant","sha256":"5b9caa614311fe691d6af171b9a8985b0d49464b9df178ad28ff5b9883eb4cf2"},{"name":"port","kind":"constant","sha256":"8b77cd4c10fb8588073ac24cdafa62c359f8fae041074537073f4e70b4ea72a9"},{"name":"known","kind":"constant","sha256":"437d0eb26101b2e1555d61ea245e3062bfdddc1f818e825cfd3beb6a375f05a8"},{"name":"from","kind":"constant","sha256":"b386d829bcacbd9e216c726f6dff71fc7d8a53aade383fa45b850387414b780c"},{"name":"summary","kind":"constant","sha256":"0938b0afc17695033381e2248401bba9b7c6abb6f9f0eaae0d2a8ff2c660d662"},{"name":"durable","kind":"constant","sha256":"59e1af86ee722f58562da0478f6f3fe6621ae96f9473de8c0037e63fe779215e"},{"name":"test","kind":"constant","sha256":"c67f3770bf3c3e9b9aff73d99406c7664a900a970c68cfe75a1efefbd4447185"}]},{"path":"mcp/delegation/api.ts","sha256":"30af4be6d286f7c204e38ee72a79599e7a65a2349516e9bac8245d3f420f97d5","size":78606,"symbols":[{"name":"json","kind":"function","sha256":"9534facbff0d20476918887174c4edf739d502278aa0750b5fa1da683358d3e7"},{"name":"text","kind":"constant","sha256":"c821f21e865b5862788006905c0f4fd09dd7ef6d223fcf2c505033203d6555aa"},{"name":"files","kind":"constant","sha256":"10f5a322e356009fe3570a8b1fc93b0e50f550074efda18f91eb7ba5b0cd7445"},{"name":"change","kind":"constant","sha256":"b3e774e47224ceab04308a4b2408fdc25f84082e73ac544f4f45949d63ca929f"},{"name":"packet","kind":"constant","sha256":"e71a4806ab105f9413aed2fb80d62995b29b2c809b72ebecbfeb144a235fbfa9"},{"name":"sessions","kind":"constant","sha256":"3d4a2d3fc1f138336c68efb9fbe54682c1988896a4bf62fe2b334060e952f309"},{"name":"agent","kind":"constant","sha256":"73eaaefa603f1faada136a1ce30a9c4bb4443c8e5a7f71bfcd673cf695bda208"},{"name":"current","kind":"constant","sha256":"9c4cd387881f26f6987d035a16dca7885b8f9aaedb8ca13696be65c344bf840a"}]},{"path":"mcp/delegation/contract.ts","sha256":"b00fed2868c1a4c64be39b8d82e4b49a7414c7f2eb1c9e6b5cd561c954f03891","size":50356,"symbols":[{"name":"change","kind":"constant","sha256":"e499aa50ffbb9c260caec4bb421746f795f0062475fe49fbee7f283705f385e8"},{"name":"from","kind":"constant","sha256":"bd2200c07292af9f1ac297cdf2d079dea9c17bd2c3ee4d9522b7a3bb5c07a013"}]},{"path":"mcp/delegation/dispatch.ts","sha256":"8ffa9bcf9d6458a52aaf472946ca73b1a6408ecbda47ddd09124bceffa861e05","size":23982,"symbols":[{"name":"index","kind":"constant","sha256":"4f9ac98937fd4bda11e3c960113c786f03852f8e8edc53cf53ebea1852e4254d"}]},{"path":"mcp/delegation/git.ts","sha256":"f307679ca9bb83ff44d2f3fa1396d06958a2f4c0012b46cde07492b7e0d94ab0","size":7919,"symbols":[{"name":"code","kind":"constant","sha256":"d9c1294d24cbfa168d6b330e9af34dee4d8929465570f7792488381b08dcf801"},{"name":"paths","kind":"constant","sha256":"d86b2c7d4535701b6385f96806820dbac0bc45d30eea01177b87dde616f1f98b"}]},{"path":"mcp/delegation/suggest.ts","sha256":"561598d138ff6aed32f07c6401e501e1430e1639b0e656520d28b052aef29ade","size":2982},{"path":"mcp/index.ts","sha256":"f80f9daf9344e2af38406cf87511e98e607aad415d08f61b30304e7440f283f4","size":109859,"symbols":[{"name":"score","kind":"constant","sha256":"70eda26cd548161422088eab86708387757c1c6de54f8eedf58911a554a9674b"},{"name":"summary","kind":"constant","sha256":"16f7c65f25e8bfb3d6fca589dbf7ddcc3930490fe5a6dcdb90e6a7e5dd344398"},{"name":"agent","kind":"constant","sha256":"f43965840101ba03f34df722db6ad9cd1ca443fc381b27433cff4ad00194473f"},{"name":"guard","kind":"constant","sha256":"d0a182bcbf5250cb9d1b755dca31411badc4e2a2957616130f912fba08bdbb3b"}]},{"path":"mcp/kernel.ts","sha256":"11d210257d690b2275a927d1b9bc0f9173735001f51f8a8cff5b45134262b6f3","size":913831,"symbols":[{"name":"untracked","kind":"constant","sha256":"8d31cffa2e43e8e8498c30a2e6eeb043120941acd973d64ecda430b13f52d855"},{"name":"types","kind":"constant","sha256":"2a70be891268716e97a20553eb9121d2863872823e1f64dd3c05dc442e605f0b"},{"name":"explicit","kind":"constant","sha256":"3c7dc76a866b9617850dd05c43ef877cc5208ade5be761331cf32181ace414ff"},{"name":"usage","kind":"constant","sha256":"52472b18f8c657c18e2dd6ed0ee31a90cd58734c517a6bd2168ba2b787eae0ad"},{"name":"verification","kind":"constant","sha256":"faeb54eb75a6e60ebcab087f39fdd9f971c8a3a16e25846647ab2dd5802748f3"},{"name":"code","kind":"constant","sha256":"64b81d42a4c6de11c6ff891787a63a33c198717dba5a924932817e97a8d1f7cf"},{"name":"json","kind":"constant","sha256":"f7bcd9f5ef8a5696c0f0ecbd148a4db30b52b674922455ec67a7561c86be4da4"},{"name":"after","kind":"constant","sha256":"220a1c1969c37d53268e215419dcea650ffa901162d0a25e451bd90831fb0a1b"},{"name":"verify","kind":"constant","sha256":"a52f5b45a4f358248075422f84ac83e7d291e8e7acb866eeabdb692896bc9c0d"},{"name":"relevant","kind":"constant","sha256":"ecda229c929f06ede369f9d72be3d3211fef450b1056b73a121c5d925fac2c2b"},{"name":"durable","kind":"constant","sha256":"3fa48acfe2e95fa0fcf831049f2d1aa3ddf26ddc5a1d10724db5da185389e634"},{"name":"memory","kind":"constant","sha256":"952449fe9c2c8827ca2a6a85c0d0a86b82826696ff4f88ee167500678734db36"}]},{"path":"mcp/sessions-backend.test.ts","sha256":"8e117c36f7be6cdbb14e5cdf58b7fe4fc49472e5f8879584171d5e94569a5e3c","size":12542},{"path":"mcp/sessions-doc.test.ts","sha256":"1cbb45370908b9d755de74f4123f118903430fedd9d7f1d335aeb5789e678fa8","size":16022,"symbols":[{"name":"paths","kind":"constant","sha256":"5ad5a4ae64675831f8e3795d77adf6c853a454fae00a452f8f6116c31ea34084"}]},{"path":"mcp/store-doc.test.ts","sha256":"ce6a29e5b8126cda86e69ee0862a1f4b228a99db411c5d6c728ac3a3027b5234","size":24402},{"path":"mcp/store-port.test.ts","sha256":"bfa1f395b02d504c94c71a0ac2463a77ee191a5f08159d4a8faff21f75ac5682","size":15700},{"path":"mcp/store/json.ts","sha256":"55b4a35864579c96be5b4ce492857ddc63e2aed947114d08203353bdc607b108","size":28608,"symbols":[{"name":"current","kind":"constant","sha256":"9b6c7d1262192ef1da99b39c2d6c473a93539f4dae7d01a8dea81ac52bf126ce"},{"name":"index","kind":"constant","sha256":"fffcaff16e56a317aa3b3d9689635e1ff8c30bfce1799f6eb256ed48344a1d3e"},{"name":"docs","kind":"constant","sha256":"7b91f24f1b7f50bbd41baba5ceeb956d1f20c93438c382f4d376d888cc83f3ef"}]},{"path":"mcp/store/manifest.ts","sha256":"b888e77ffddc8940a219c86016e8e7ef2f32ce4cef0dfeb62929da103e49cb06","size":3889,"symbols":[{"name":"backend","kind":"constant","sha256":"574c694adfa78229643170b04a40e7d2952dacf241292719ff53a00e6bffebde"},{"name":"manifest","kind":"constant","sha256":"e354066b660d1cc7f339b5cff2933efc42407639e1b6a35435eecaa0a0c8f146"}]},{"path":"mcp/store/rebuild.ts","sha256":"b458b2bd96690f8e8b4665af0bcda05e7ac6eb9bcc890cdf18560288de165d7e","size":10693,"symbols":[{"name":"loaddocschunks","kind":"function","sha256":"5f04407a808f2279eb08a89a3f972747abe3ef339d648b835b3e49a14d7e585d"},{"name":"files","kind":"constant","sha256":"5130b71ec78570aa21e51a7e0ae8609c8b3f5af0d4a5e1a509db80e23d56fc07"},{"name":"packets","kind":"constant","sha256":"314b51dff9d2bd537f3dfa796693f740cef6f6daffca7d27210644c2170c5a64"}]},{"path":"mcp/store/sqlite.ts","sha256":"d5b0f1b851b7a63a56107241c91634154ad710db2aeb2661c5ce1f4c15aa8c00","size":26717},{"path":"mcp/store/types.ts","sha256":"3b849a94f217e1baf1e99db399b1372df0b50a49a49e58acdb57768d101bb11b","size":15061}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-store-rebuild-tss-loaddocschunks-m1-code-keyed-docs-fts-upsert-ids-as-bare-d-d849aff3.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-nodes-assert-deepequal-deepstrictequal-against-an-object-literal-fails-on-any-ex-4b0798f9.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-recall-in-mcp-kernel-ts-has-a-usage-tracking-side-effect-score-breakdown-usage-t-0781bbb4.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/MEMORY_STORE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/SESSIONS_SURFACE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/contract.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/dispatch.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/git.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/suggest.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/index.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/kernel.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/sessions-backend.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/sessions-doc.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/store-doc.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/store-port.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: mcp/delegation/suggest.ts, mcp/sessions-backend.test.ts"],"duplicate_candidates":[],"estimated_tokens_saved":963,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:05.778Z"},"created_at":"2026-08-20T08:19:18.740Z","updated_at":"2026-08-20T12:42:05.778Z"}
```

