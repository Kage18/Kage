---
type: "Workflow"
title: "Change memory: kage/m4-of-the-memory-store-the-last-phase-ho-260820-8ee3"
description: "Repo-local context for 15 changed repo paths on kage/m4-of-the-memory-store-the-last-phase-ho-260820-8ee3."
resource: "docs/BENCHMARKS.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3"]
timestamp: "2026-08-20T12:42:15.052Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["docs/BENCHMARKS.md", "docs/design/MEMORY_STORE.md", "mcp/bench/fixture.ts", "mcp/bench/harness.ts", "mcp/bench/run-one.ts", "mcp/bench/run.ts", "mcp/cli.ts", "mcp/kernel.ts", "mcp/scale-guard.test.ts", "mcp/store-doc.test.ts"]
---

# Change memory: kage/m4-of-the-memory-store-the-last-phase-ho-260820-8ee3

> Repo-local context for 15 changed repo paths on kage/m4-of-the-memory-store-the-last-phase-ho-260820-8ee3.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md
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
- mcp/kernel.ts
- mcp/scale-guard.test.ts
- mcp/store-doc.test.ts

Diff summary:
```text
...workflow-change-memory-release-prep-a72d4251.md |  28 +--
 docs/BENCHMARKS.md                                 |  79 --------
 docs/design/MEMORY_STORE.md                        |  31 ++-
 mcp/bench/fixture.ts                               | 207 ---------------------
 mcp/bench/harness.ts                               | 162 ----------------
 mcp/bench/run-one.ts                               |  54 ------
 mcp/bench/run.ts                                   |  84 ---------
 mcp/cli.ts                                         |   6 -
 mcp/kernel.ts                                      |  37 ----
 mcp/scale-guard.test.ts                            | 170 -----------------
 mcp/store-doc.test.ts                              |  34 +---
 11 files changed, 32 insertions(+), 860 deletions(-)
.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3","title":"Change memory: kage/m4-of-the-memory-store-the-last-phase-ho-260820-8ee3","summary":"Repo-local context for 15 changed repo paths on kage/m4-of-the-memory-store-the-last-phase-ho-260820-8ee3.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md\n- .agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md\n- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md\n- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- docs/BENCHMARKS.md\n- docs/design/MEMORY_STORE.md\n- mcp/bench/fixture.ts\n- mcp/bench/harness.ts\n- mcp/bench/run-one.ts\n- mcp/bench/run.ts\n- mcp/cli.ts\n- mcp/kernel.ts\n- mcp/scale-guard.test.ts\n- mcp/store-doc.test.ts\n\nDiff summary:\n```text\n...workflow-change-memory-release-prep-a72d4251.md |  28 +--\n docs/BENCHMARKS.md                                 |  79 --------\n docs/design/MEMORY_STORE.md                        |  31 ++-\n mcp/bench/fixture.ts                               | 207 ---------------------\n mcp/bench/harness.ts                               | 162 ----------------\n mcp/bench/run-one.ts                               |  54 ------\n mcp/bench/run.ts                                   |  84 ---------\n mcp/cli.ts                                         |   6 -\n mcp/kernel.ts                                      |  37 ----\n mcp/scale-guard.test.ts                            | 170 -----------------\n mcp/store-doc.test.ts                              |  34 +---\n 11 files changed, 32 insertions(+), 860 deletions(-)\n.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3"],"paths":["docs/BENCHMARKS.md","docs/design/MEMORY_STORE.md","mcp/bench/fixture.ts","mcp/bench/harness.ts","mcp/bench/run-one.ts","mcp/bench/run.ts","mcp/cli.ts","mcp/kernel.ts","mcp/scale-guard.test.ts","mcp/store-doc.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/m4-of-the-memory-store-the-last-phase-ho-260820-8ee3","head":"bd603e7ec0b5516aa3af02537f6d5f062c60c517","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md",".agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md",".agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md",".agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","docs/BENCHMARKS.md","docs/design/MEMORY_STORE.md","mcp/bench/fixture.ts","mcp/bench/harness.ts","mcp/bench/run-one.ts","mcp/bench/run.ts","mcp/cli.ts","mcp/kernel.ts","mcp/scale-guard.test.ts","mcp/store-doc.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-m4-of-the-memory-store-the-last-phase-ho-260820-8ee3.json"}],"context":{"fact":"Current branch kage/m4-of-the-memory-store-the-last-phase-ho-260820-8ee3 changes 15 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:15.052Z","ttl_days":180,"path_fingerprints":[{"path":"docs/BENCHMARKS.md","sha256":"703ef609f6170812c6db7bd1e971acf6a182ebbd079abb6eb5bff7d60e3867ad","size":8335},{"path":"docs/design/MEMORY_STORE.md","sha256":"81337fcfa918d0cf4123ee1dc9caeda75ea2f61b07b007522f5b2bec0b40343d","size":31430},{"path":"mcp/bench/fixture.ts","sha256":"6f9de2587ca3db0a7fbd0976ce71edd3f0f25362631bacfc262cfed5133c8bb6","size":8770,"symbols":[{"name":"files","kind":"constant","sha256":"9097d05bc008bb898f0241936453315fdfe25a312832915a8f070cc75ed68083"},{"name":"packets","kind":"constant","sha256":"7bedc248ef048b7680d4eddf4f223f2dace04daefc829169daa8598afb3d16e6"},{"name":"current","kind":"constant","sha256":"ca326b14a72215cd86525cbeee4d9721a169461d3050a50fd44b84d6b2ea8d77"}]},{"path":"mcp/bench/harness.ts","sha256":"9e273417b08e87b403a345add7734caefd61ac5862e8ea4e66bf18f18d6c5852","size":6654,"symbols":[{"name":"files","kind":"constant","sha256":"8984fb1011c0e9e4a2f8140ee1b80011ee39c80fba2fb0d6012223d8cc01fbfb"},{"name":"current","kind":"constant","sha256":"b665b02ef71f60cf281f97fc8fb878cbd70ca5027a199b1dac345546da0207a3"},{"name":"graph","kind":"constant","sha256":"5bf948db68572ca5c9c5e45e7dfe53481f459a39655b6f68c8a31f4134116073"},{"name":"fixture","kind":"constant","sha256":"7873e2e4ba6f8b15a84c7216081c2452e2da438f9bb9cc6c2521d8f32f03e8e8"},{"name":"store","kind":"constant","sha256":"00c3021e41de7fa147a9ab332d08b8f4074d8b5196a644fbc19fa485020be095"}]},{"path":"mcp/bench/run-one.ts","sha256":"55cf3f7ff0c6fa14f5bac6f0c9f9b9b8bb8513b539cfe337017f389d81d5c3cb","size":2074,"symbols":[{"name":"files","kind":"constant","sha256":"9270def56bf553559454e31bd2b27334dbe89260bc1b33aa7fc9f529b4e04c09"},{"name":"packets","kind":"constant","sha256":"e3295f2dac5f4e06c86be5747ae054034e5d081a4299ae257dc62bb38d1f77c7"},{"name":"backend","kind":"constant","sha256":"f22fb0132c99a8345c44d49b1a85e08595fefe0cbb8878b9077f087ee26d8df2"}]},{"path":"mcp/bench/run.ts","sha256":"5a2b1d7a5a18ff0b9a325f1691d5bf19cd5ff13e1ca3a74bf13ca6343b428ed6","size":4250,"symbols":[{"name":"command","kind":"constant","sha256":"301f8ea5ef9cadb928147cd71ff2098fd96aeab89077a99cf0ddf37c7b019450"},{"name":"packets","kind":"constant","sha256":"f7e059b4a23f4f9c9366a8b67ac7b4c6eeedf3d38a0b28279bf98b44fdd38642"}]},{"path":"mcp/cli.ts","sha256":"f49dea5e35b66b1309c62c71f90a8b0a6986061d7956f3417bcb330139cd14e3","size":150054,"symbols":[{"name":"files","kind":"constant","sha256":"8984fb1011c0e9e4a2f8140ee1b80011ee39c80fba2fb0d6012223d8cc01fbfb"},{"name":"review","kind":"function","sha256":"cd5b65cd476d7eaecccc181de3bcad5b3d7c99237dcbfce313709f8eb35f9a13"},{"name":"command","kind":"constant","sha256":"9e594169e1f8559f50d7e73b407f1aa3a9a0f14bf43a676fedefa72734badb98"},{"name":"packets","kind":"constant","sha256":"08565eddc844fbb13d207b1a5875e07b52807950760d7784cce666504b0eda13"},{"name":"current","kind":"constant","sha256":"471f3cfbffa04d6ecddb2f3d4013027b71237de766afb69ec418f1f1b8308937"},{"name":"agent","kind":"constant","sha256":"5b9caa614311fe691d6af171b9a8985b0d49464b9df178ad28ff5b9883eb4cf2"},{"name":"known","kind":"constant","sha256":"437d0eb26101b2e1555d61ea245e3062bfdddc1f818e825cfd3beb6a375f05a8"},{"name":"from","kind":"constant","sha256":"b386d829bcacbd9e216c726f6dff71fc7d8a53aade383fa45b850387414b780c"},{"name":"summary","kind":"constant","sha256":"0938b0afc17695033381e2248401bba9b7c6abb6f9f0eaae0d2a8ff2c660d662"},{"name":"durable","kind":"constant","sha256":"59e1af86ee722f58562da0478f6f3fe6621ae96f9473de8c0037e63fe779215e"},{"name":"test","kind":"constant","sha256":"c67f3770bf3c3e9b9aff73d99406c7664a900a970c68cfe75a1efefbd4447185"}]},{"path":"mcp/kernel.ts","sha256":"11d210257d690b2275a927d1b9bc0f9173735001f51f8a8cff5b45134262b6f3","size":913831,"symbols":[{"name":"untracked","kind":"constant","sha256":"8d31cffa2e43e8e8498c30a2e6eeb043120941acd973d64ecda430b13f52d855"},{"name":"explicit","kind":"constant","sha256":"3c7dc76a866b9617850dd05c43ef877cc5208ade5be761331cf32181ace414ff"},{"name":"verification","kind":"constant","sha256":"faeb54eb75a6e60ebcab087f39fdd9f971c8a3a16e25846647ab2dd5802748f3"},{"name":"code","kind":"constant","sha256":"64b81d42a4c6de11c6ff891787a63a33c198717dba5a924932817e97a8d1f7cf"},{"name":"after","kind":"constant","sha256":"220a1c1969c37d53268e215419dcea650ffa901162d0a25e451bd90831fb0a1b"},{"name":"verify","kind":"constant","sha256":"a52f5b45a4f358248075422f84ac83e7d291e8e7acb866eeabdb692896bc9c0d"},{"name":"relevant","kind":"constant","sha256":"ecda229c929f06ede369f9d72be3d3211fef450b1056b73a121c5d925fac2c2b"},{"name":"durable","kind":"constant","sha256":"3fa48acfe2e95fa0fcf831049f2d1aa3ddf26ddc5a1d10724db5da185389e634"},{"name":"memory","kind":"constant","sha256":"952449fe9c2c8827ca2a6a85c0d0a86b82826696ff4f88ee167500678734db36"}]},{"path":"mcp/scale-guard.test.ts","sha256":"866c2bfbeac77d82b3b66f4055dbcdcee7c311427edb81af85b8b1bad8f25ad0","size":9523,"symbols":[{"name":"paths","kind":"constant","sha256":"9c168b7f3581f99c023dc567e97d61f54658404dffe8e6b6d6fe5803150ac221"}]},{"path":"mcp/store-doc.test.ts","sha256":"ce6a29e5b8126cda86e69ee0862a1f4b228a99db411c5d6c728ac3a3027b5234","size":24402}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w1-1-close-the-three-api-gaps-the-w2-ren-260820-22ba-3c29b996.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/BENCHMARKS.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/MEMORY_STORE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/bench/fixture.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/bench/harness.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/bench/run-one.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/bench/run.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/kernel.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/scale-guard.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/store-doc.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: mcp/bench/fixture.ts, mcp/bench/harness.ts, mcp/bench/run-one.ts, mcp/bench/run.ts"],"duplicate_candidates":[],"estimated_tokens_saved":698,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:15.052Z"},"created_at":"2026-08-20T10:07:52.224Z","updated_at":"2026-08-20T12:42:15.052Z"}
```

