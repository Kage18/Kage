---
type: "Workflow"
title: "Change memory: kage/make-the-receipt-the-thing-people-notice-260819-419c"
description: "Repo-local context for 18 changed repo paths on kage/make-the-receipt-the-thing-people-notice-260819-419c."
resource: "mcp/cli.ts"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-make-the-receipt-the-thing-people-notice-260819-419c"]
timestamp: "2026-08-20T12:42:13.631Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-make-the-receipt-the-thing-people-notice-260819-419c"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["mcp/cli.ts", "mcp/daemon.ts", "mcp/delegation/api.ts", "mcp/delegation/app-client.ts", "mcp/delegation/app-styles.ts", "mcp/delegation/config.ts", "mcp/delegation/guard.ts", "mcp/delegation/verify.ts", "mcp/index.ts", "mcp/lan-mode.test.ts", "mcp/receipt.test.ts"]
---

# Change memory: kage/make-the-receipt-the-thing-people-notice-260819-419c

> Repo-local context for 18 changed repo paths on kage/make-the-receipt-the-thing-people-notice-260819-419c.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md
- .agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md
- .agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md
- .agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md
- .agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md
- .agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/cli.ts
- mcp/daemon.ts
- mcp/delegation/api.ts
- mcp/delegation/app-client.ts
- mcp/delegation/app-styles.ts
- mcp/delegation/config.ts
- mcp/delegation/guard.ts
- mcp/delegation/verify.ts
- mcp/index.ts
- mcp/lan-mode.test.ts
- mcp/receipt.test.ts

Diff summary:
```text
...workflow-change-memory-release-prep-a72d4251.md |  26 ++-
 mcp/cli.ts                                         |   6 +-
 mcp/daemon.ts                                      |  86 ++++++-
 mcp/delegation/api.ts                              |   2 +-
 mcp/delegation/app-client.ts                       |  78 ++++---
 mcp/delegation/app-styles.ts                       |  16 +-
 mcp/delegation/config.ts                           |  10 +
 mcp/delegation/guard.ts                            |  61 ++++-
 mcp/delegation/verify.ts                           |  42 +---
 mcp/index.ts                                       |   4 +-
 mcp/receipt.test.ts                                | 249 ---------------------
 11 files changed, 217 insertions(+), 363 deletions(-)
.agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md | untracked
.agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md | untracked
.agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md | untracked
.agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md | untracked
.agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md | untracked
.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md | untracked
mcp/lan-mode.test.ts | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-make-the-receipt-the-thing-people-notice-260819-419c","title":"Change memory: kage/make-the-receipt-the-thing-people-notice-260819-419c","summary":"Repo-local context for 18 changed repo paths on kage/make-the-receipt-the-thing-people-notice-260819-419c.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md\n- .agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md\n- .agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md\n- .agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md\n- .agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md\n- .agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/cli.ts\n- mcp/daemon.ts\n- mcp/delegation/api.ts\n- mcp/delegation/app-client.ts\n- mcp/delegation/app-styles.ts\n- mcp/delegation/config.ts\n- mcp/delegation/guard.ts\n- mcp/delegation/verify.ts\n- mcp/index.ts\n- mcp/lan-mode.test.ts\n- mcp/receipt.test.ts\n\nDiff summary:\n```text\n...workflow-change-memory-release-prep-a72d4251.md |  26 ++-\n mcp/cli.ts                                         |   6 +-\n mcp/daemon.ts                                      |  86 ++++++-\n mcp/delegation/api.ts                              |   2 +-\n mcp/delegation/app-client.ts                       |  78 ++++---\n mcp/delegation/app-styles.ts                       |  16 +-\n mcp/delegation/config.ts                           |  10 +\n mcp/delegation/guard.ts                            |  61 ++++-\n mcp/delegation/verify.ts                           |  42 +---\n mcp/index.ts                                       |   4 +-\n mcp/receipt.test.ts                                | 249 ---------------------\n 11 files changed, 217 insertions(+), 363 deletions(-)\n.agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md | untracked\n.agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md | untracked\n.agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md | untracked\nmcp/lan-mode.test.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-make-the-receipt-the-thing-people-notice-260819-419c"],"paths":["mcp/cli.ts","mcp/daemon.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-styles.ts","mcp/delegation/config.ts","mcp/delegation/guard.ts","mcp/delegation/verify.ts","mcp/index.ts","mcp/lan-mode.test.ts","mcp/receipt.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/make-the-receipt-the-thing-people-notice-260819-419c","head":"8d704c7d65bc483e3abd829e586bc22128301939","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md",".agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md",".agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md",".agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md",".agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md",".agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/cli.ts","mcp/daemon.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-styles.ts","mcp/delegation/config.ts","mcp/delegation/guard.ts","mcp/delegation/verify.ts","mcp/index.ts","mcp/lan-mode.test.ts","mcp/receipt.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-make-the-receipt-the-thing-people-notice-260819-419c.json"}],"context":{"fact":"Current branch kage/make-the-receipt-the-thing-people-notice-260819-419c changes 18 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:13.631Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/cli.ts","sha256":"f49dea5e35b66b1309c62c71f90a8b0a6986061d7956f3417bcb330139cd14e3","size":150054,"symbols":[{"name":"index","kind":"constant","sha256":"c201ee64cf24065dd2ba0bbdc7ff8399e5c1dd89783820e501d28f82019f08a8"},{"name":"files","kind":"constant","sha256":"8984fb1011c0e9e4a2f8140ee1b80011ee39c80fba2fb0d6012223d8cc01fbfb"},{"name":"review","kind":"function","sha256":"cd5b65cd476d7eaecccc181de3bcad5b3d7c99237dcbfce313709f8eb35f9a13"},{"name":"command","kind":"constant","sha256":"9e594169e1f8559f50d7e73b407f1aa3a9a0f14bf43a676fedefa72734badb98"},{"name":"packets","kind":"constant","sha256":"08565eddc844fbb13d207b1a5875e07b52807950760d7784cce666504b0eda13"},{"name":"current","kind":"constant","sha256":"471f3cfbffa04d6ecddb2f3d4013027b71237de766afb69ec418f1f1b8308937"},{"name":"agent","kind":"constant","sha256":"5b9caa614311fe691d6af171b9a8985b0d49464b9df178ad28ff5b9883eb4cf2"},{"name":"known","kind":"constant","sha256":"437d0eb26101b2e1555d61ea245e3062bfdddc1f818e825cfd3beb6a375f05a8"},{"name":"from","kind":"constant","sha256":"b386d829bcacbd9e216c726f6dff71fc7d8a53aade383fa45b850387414b780c"},{"name":"summary","kind":"constant","sha256":"0938b0afc17695033381e2248401bba9b7c6abb6f9f0eaae0d2a8ff2c660d662"},{"name":"durable","kind":"constant","sha256":"59e1af86ee722f58562da0478f6f3fe6621ae96f9473de8c0037e63fe779215e"},{"name":"test","kind":"constant","sha256":"c67f3770bf3c3e9b9aff73d99406c7664a900a970c68cfe75a1efefbd4447185"}]},{"path":"mcp/daemon.ts","sha256":"5fbd1abcbbbafeffebfcf4208d562b846f0f309d2d64861531459b485c14e93e","size":53327,"symbols":[{"name":"provisiondaemontoken","kind":"function","sha256":"8ea28155f7565655bd2eab97eff3ee4f29c46df7b2eea08fc716a4c679a64f43"},{"name":"text","kind":"constant","sha256":"70f68baaeedf940b18569f940046a8a0a978afd00077c6b27618336a05fa1cc1"},{"name":"guardcontext","kind":"constant","sha256":"66a00c2f94cfa8ea1f7c41ab97575d70857303827da5ecb547b8b9206b76e1b8"},{"name":"files","kind":"constant","sha256":"69140299050f3544f2a8f5cdcfa3672dd7f2a78cf8960d3197b23624253b5b9e"}]},{"path":"mcp/delegation/api.ts","sha256":"30af4be6d286f7c204e38ee72a79599e7a65a2349516e9bac8245d3f420f97d5","size":78606,"symbols":[{"name":"text","kind":"constant","sha256":"c821f21e865b5862788006905c0f4fd09dd7ef6d223fcf2c505033203d6555aa"},{"name":"files","kind":"constant","sha256":"10f5a322e356009fe3570a8b1fc93b0e50f550074efda18f91eb7ba5b0cd7445"},{"name":"change","kind":"constant","sha256":"b3e774e47224ceab04308a4b2408fdc25f84082e73ac544f4f45949d63ca929f"},{"name":"packet","kind":"constant","sha256":"e71a4806ab105f9413aed2fb80d62995b29b2c809b72ebecbfeb144a235fbfa9"},{"name":"config","kind":"constant","sha256":"f8e54559c158b033c0d895af0970af92f19e06c8b8c38c81345f3f6c953bd08e"},{"name":"agent","kind":"constant","sha256":"73eaaefa603f1faada136a1ce30a9c4bb4443c8e5a7f71bfcd673cf695bda208"},{"name":"current","kind":"constant","sha256":"9c4cd387881f26f6987d035a16dca7885b8f9aaedb8ca13696be65c344bf840a"}]},{"path":"mcp/delegation/app-client.ts","sha256":"ded26e7b2ea02db2b4eade9056358d995b0517b8f9cf1181245a867beb33bafb","size":206711},{"path":"mcp/delegation/app-styles.ts","sha256":"c8d1bb16e765a5659d5a425df9d3e21f50cc10456d0095463a03618f21efbb77","size":76146},{"path":"mcp/delegation/config.ts","sha256":"bcf16139575549cce06a09bba484cfe9f6efb2354a35a9c4704119af48d228f3","size":7960},{"path":"mcp/delegation/guard.ts","sha256":"b17c3d5f01a7d18ab572330513ea4f8fd6e045b0bd8c56692ff4ea15ff3c77c9","size":6508,"symbols":[{"name":"header","kind":"function","sha256":"88ca5a0106498faa62ce704bcc748a38b533625927d0038b16fc9eba0fd56ad6"},{"name":"diff","kind":"constant","sha256":"34c277ef1037319a460efd15f3973919172d686205737ac749d57aa35534cc39"}]},{"path":"mcp/delegation/verify.ts","sha256":"862abe6b14f036221a86c82b71d9e83234404c827e2eed3d7515a6f7e71d6482","size":19211,"symbols":[{"name":"paths","kind":"constant","sha256":"d86b2c7d4535701b6385f96806820dbac0bc45d30eea01177b87dde616f1f98b"},{"name":"token","kind":"constant","sha256":"30f37849cd0e90e2322c756bf267ebd55c70f52a5ca4d35956df9c9ea3206502"},{"name":"files","kind":"constant","sha256":"78f3e429f44325f7479571d6918ab610db233ba388e71a89dd5241b86a603f84"},{"name":"decision","kind":"constant","sha256":"bf9287c92df9b7a36b6d9b5b99abff98a5cb386e2ceea44558d13da0cf6777c0"}]},{"path":"mcp/index.ts","sha256":"f80f9daf9344e2af38406cf87511e98e607aad415d08f61b30304e7440f283f4","size":109859,"symbols":[{"name":"summary","kind":"constant","sha256":"16f7c65f25e8bfb3d6fca589dbf7ddcc3930490fe5a6dcdb90e6a7e5dd344398"},{"name":"agent","kind":"constant","sha256":"f43965840101ba03f34df722db6ad9cd1ca443fc381b27433cff4ad00194473f"},{"name":"drops","kind":"constant","sha256":"b5444096a89178c9ff045ed8176ed53313761eb97409307f0274b3561a9e07d8"},{"name":"receipt","kind":"constant","sha256":"14d180864a23d0a4b567585d787f486a8228a091d06ae18ac123027f2b6f6494"},{"name":"guard","kind":"constant","sha256":"d0a182bcbf5250cb9d1b755dca31411badc4e2a2957616130f912fba08bdbb3b"},{"name":"mode","kind":"constant","sha256":"18b82a4b81ca7c830c569f40cf5c828b5455eeeb0a3bec4059c2890192dbdd94"}]},{"path":"mcp/lan-mode.test.ts","sha256":"31270c0f999a2371d01aaa07f20adf23e709321175c7f7ce4157c0b9d5adc6ac","size":10785,"symbols":[{"name":"token","kind":"constant","sha256":"a3060172aa71649318652d03b47cf1a9f87eda4a2472100487b385953afd501c"},{"name":"context","kind":"constant","sha256":"5cafc5d2eed26e4e144adc252d2da755933ee4f845cb57b6c783c1b489f8c838"},{"name":"project","kind":"constant","sha256":"34dcdcd36c1ff04b81cebaba9eb4f33040f66ffc7319661154468aa3c8b5fdfd"},{"name":"mode","kind":"constant","sha256":"5f6b2b7ab81dec7c7f6ad2f4511f0775c4e370403fcb056085412f8840b1eb6a"}]},{"path":"mcp/receipt.test.ts","sha256":"e914849d564b8474ecb69f8a34e134b1662ede3038475192bdce59ac57ca237b","size":12130}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9-13ae7c7f.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/daemon.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-styles.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/config.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/guard.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/verify.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/index.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/lan-mode.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/receipt.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: mcp/receipt.test.ts"],"duplicate_candidates":[],"estimated_tokens_saved":842,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:13.631Z"},"created_at":"2026-08-19T12:46:06.028Z","updated_at":"2026-08-20T12:42:13.631Z"}
```

