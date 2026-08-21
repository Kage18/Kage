---
type: "Workflow"
title: "Change memory: kage/w2-of-the-sessions-surface-the-renderer-260820-3482"
description: "Repo-local context for 25 changed repo paths on kage/w2-of-the-sessions-surface-the-renderer-260820-3482."
resource: "docs/design/MEMORY_STORE.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-w2-of-the-sessions-surface-the-renderer-260820-3482"]
timestamp: "2026-08-20T12:42:10.703Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482"
x-kage-type: "workflow"
x-kage-status: "deprecated"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "deprecated"
x-kage-paths: ["docs/design/MEMORY_STORE.md", "mcp/delegation-api.test.ts", "mcp/delegation/app-client.ts", "mcp/delegation/app-html.ts", "mcp/delegation/app-styles.ts", "mcp/kernel.ts", "mcp/sessions-ui.test.ts", "mcp/store-doc.test.ts", "mcp/store-graph.test.ts", "mcp/store/json.ts", "mcp/store/sqlite.ts", "mcp/store/types.ts"]
---

# Change memory: kage/w2-of-the-sessions-surface-the-renderer-260820-3482

> Repo-local context for 25 changed repo paths on kage/w2-of-the-sessions-surface-the-renderer-260820-3482.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/decision-codecalledge-mcp-kernel-ts-has-no-kind-field-i-mapped-its-resolution-field-ty-d2db9a5a.md
- .agent_memory/packets/decision-jsonstorebackends-structural-knowledge-graph-methods-files-json-symbols-json-imp-f462b7e1.md
- .agent_memory/packets/decision-mcp-kernel-test-tss-tempproject-creates-agent-memory-nodes-not-agent-memory-p-feb86114.md
- .agent_memory/packets/decision-roomhistoryturn-manager-pty-headless-defined-in-mcp-delegation-room-history-ts-i-3ceefae3.md
- .agent_memory/packets/decision-roomhistoryturn-manager-pty-headless-room-history-ts-is-exactly-the-api-already-0a7247e9.md
- .agent_memory/packets/decision-roomsessionmeta-native-transcript-path-in-mcp-delegation-room-supervisor-ts-is-s-a3e546db.md
- .agent_memory/packets/decision-roomsessionmeta-native-transcript-path-room-supervisor-ts-is-set-only-by-the-pty-3df45162.md
- .agent_memory/packets/decision-withactivity-in-api-ts-computes-claim-summary-a-formatted-p-t-checks-string-for--0205ac42.md
- .agent_memory/packets/decision-withactivity-in-mcp-delegation-api-ts-computes-claim-summary-a-formatted-p-t-che-acebf68c.md
- .agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md
- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md
- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- docs/design/MEMORY_STORE.md
- mcp/delegation-api.test.ts
- mcp/delegation/app-client.ts
- mcp/delegation/app-html.ts
- mcp/delegation/app-styles.ts
- mcp/kernel.ts
- mcp/sessions-ui.test.ts
- mcp/store-doc.test.ts
- mcp/store-graph.test.ts
- mcp/store/json.ts
- mcp/store/sqlite.ts
- mcp/store/types.ts

Diff summary:
```text
...in-mcp-delegation-room-history-ts-i-3ceefae3.md |  56 ---
 ...story-ts-is-exactly-the-api-already-0a7247e9.md |  56 ---
 ...-delegation-room-supervisor-ts-is-s-a3e546db.md |  56 ---
 ...upervisor-ts-is-set-only-by-the-pty-3df45162.md |  56 ---
 ...-a-formatted-p-t-checks-string-for--0205ac42.md |  56 ---
 ...s-claim-summary-a-formatted-p-t-che-acebf68c.md |  56 ---
 ...workflow-change-memory-release-prep-a72d4251.md |  21 +-
 docs/design/MEMORY_STORE.md                        |   2 +-
 mcp/delegation-api.test.ts                         |  13 +-
 mcp/delegation/app-client.ts                       | 532 +++------------------
 mcp/delegation/app-html.ts                         |   1 -
 mcp/delegation/app-styles.ts                       |  83 +---
 mcp/kernel.ts                                      | 181 ++++++-
 mcp/sessions-ui.test.ts                            | 171 -------
 mcp/store-doc.test.ts                              |  43 +-
 mcp/store/json.ts                                  |  52 ++
 mcp/store/sqlite.ts                                |  72 +++
 mcp/store/types.ts                                 |  44 ++
 18 files changed, 465 insertions(+), 1086 deletions(-)
.agent_memory/packets/decision-codecalledge-mcp-kernel-ts-has-no-kind-field-i-mapped-its-resolution-field-ty-d2db9a5a.md | untracked
.agent_memory/packets/decision-jsonstorebackends-structural-knowledge-graph-methods-files-json-symbols-json-imp-f462b7e1.md | untracked
.agent_memory/packets/decision-mcp-kernel-test-tss-tempproject-creates-agent-memory-nodes-not-agent-memory-p-feb86114.md | untracked
.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked
.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked
mcp/store-graph.test.ts | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482","title":"Change memory: kage/w2-of-the-sessions-surface-the-renderer-260820-3482","summary":"Repo-local context for 25 changed repo paths on kage/w2-of-the-sessions-surface-the-renderer-260820-3482.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-codecalledge-mcp-kernel-ts-has-no-kind-field-i-mapped-its-resolution-field-ty-d2db9a5a.md\n- .agent_memory/packets/decision-jsonstorebackends-structural-knowledge-graph-methods-files-json-symbols-json-imp-f462b7e1.md\n- .agent_memory/packets/decision-mcp-kernel-test-tss-tempproject-creates-agent-memory-nodes-not-agent-memory-p-feb86114.md\n- .agent_memory/packets/decision-roomhistoryturn-manager-pty-headless-defined-in-mcp-delegation-room-history-ts-i-3ceefae3.md\n- .agent_memory/packets/decision-roomhistoryturn-manager-pty-headless-room-history-ts-is-exactly-the-api-already-0a7247e9.md\n- .agent_memory/packets/decision-roomsessionmeta-native-transcript-path-in-mcp-delegation-room-supervisor-ts-is-s-a3e546db.md\n- .agent_memory/packets/decision-roomsessionmeta-native-transcript-path-room-supervisor-ts-is-set-only-by-the-pty-3df45162.md\n- .agent_memory/packets/decision-withactivity-in-api-ts-computes-claim-summary-a-formatted-p-t-checks-string-for--0205ac42.md\n- .agent_memory/packets/decision-withactivity-in-mcp-delegation-api-ts-computes-claim-summary-a-formatted-p-t-che-acebf68c.md\n- .agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md\n- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md\n- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- docs/design/MEMORY_STORE.md\n- mcp/delegation-api.test.ts\n- mcp/delegation/app-client.ts\n- mcp/delegation/app-html.ts\n- mcp/delegation/app-styles.ts\n- mcp/kernel.ts\n- mcp/sessions-ui.test.ts\n- mcp/store-doc.test.ts\n- mcp/store-graph.test.ts\n- mcp/store/json.ts\n- mcp/store/sqlite.ts\n- mcp/store/types.ts\n\nDiff summary:\n```text\n...in-mcp-delegation-room-history-ts-i-3ceefae3.md |  56 ---\n ...story-ts-is-exactly-the-api-already-0a7247e9.md |  56 ---\n ...-delegation-room-supervisor-ts-is-s-a3e546db.md |  56 ---\n ...upervisor-ts-is-set-only-by-the-pty-3df45162.md |  56 ---\n ...-a-formatted-p-t-checks-string-for--0205ac42.md |  56 ---\n ...s-claim-summary-a-formatted-p-t-che-acebf68c.md |  56 ---\n ...workflow-change-memory-release-prep-a72d4251.md |  21 +-\n docs/design/MEMORY_STORE.md                        |   2 +-\n mcp/delegation-api.test.ts                         |  13 +-\n mcp/delegation/app-client.ts                       | 532 +++------------------\n mcp/delegation/app-html.ts                         |   1 -\n mcp/delegation/app-styles.ts                       |  83 +---\n mcp/kernel.ts                                      | 181 ++++++-\n mcp/sessions-ui.test.ts                            | 171 -------\n mcp/store-doc.test.ts                              |  43 +-\n mcp/store/json.ts                                  |  52 ++\n mcp/store/sqlite.ts                                |  72 +++\n mcp/store/types.ts                                 |  44 ++\n 18 files changed, 465 insertions(+), 1086 deletions(-)\n.agent_memory/packets/decision-codecalledge-mcp-kernel-ts-has-no-kind-field-i-mapped-its-resolution-field-ty-d2db9a5a.md | untracked\n.agent_memory/packets/decision-jsonstorebackends-structural-knowledge-graph-methods-files-json-symbols-json-imp-f462b7e1.md | untracked\n.agent_memory/packets/decision-mcp-kernel-test-tss-tempproject-creates-agent-memory-nodes-not-agent-memory-p-feb86114.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked\nmcp/store-graph.test.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"deprecated","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-w2-of-the-sessions-surface-the-renderer-260820-3482"],"paths":["docs/design/MEMORY_STORE.md","mcp/delegation-api.test.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/kernel.ts","mcp/sessions-ui.test.ts","mcp/store-doc.test.ts","mcp/store-graph.test.ts","mcp/store/json.ts","mcp/store/sqlite.ts","mcp/store/types.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/w2-of-the-sessions-surface-the-renderer-260820-3482","head":"4d7f5aa30f35595544ca4abc0369e253dd1578af","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/decision-codecalledge-mcp-kernel-ts-has-no-kind-field-i-mapped-its-resolution-field-ty-d2db9a5a.md",".agent_memory/packets/decision-jsonstorebackends-structural-knowledge-graph-methods-files-json-symbols-json-imp-f462b7e1.md",".agent_memory/packets/decision-mcp-kernel-test-tss-tempproject-creates-agent-memory-nodes-not-agent-memory-p-feb86114.md",".agent_memory/packets/decision-roomhistoryturn-manager-pty-headless-defined-in-mcp-delegation-room-history-ts-i-3ceefae3.md",".agent_memory/packets/decision-roomhistoryturn-manager-pty-headless-room-history-ts-is-exactly-the-api-already-0a7247e9.md",".agent_memory/packets/decision-roomsessionmeta-native-transcript-path-in-mcp-delegation-room-supervisor-ts-is-s-a3e546db.md",".agent_memory/packets/decision-roomsessionmeta-native-transcript-path-room-supervisor-ts-is-set-only-by-the-pty-3df45162.md",".agent_memory/packets/decision-withactivity-in-api-ts-computes-claim-summary-a-formatted-p-t-checks-string-for--0205ac42.md",".agent_memory/packets/decision-withactivity-in-mcp-delegation-api-ts-computes-claim-summary-a-formatted-p-t-che-acebf68c.md",".agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md",".agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md",".agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","docs/design/MEMORY_STORE.md","mcp/delegation-api.test.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/kernel.ts","mcp/sessions-ui.test.ts","mcp/store-doc.test.ts","mcp/store-graph.test.ts","mcp/store/json.ts","mcp/store/sqlite.ts","mcp/store/types.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-w2-of-the-sessions-surface-the-renderer-260820-3482.json"}],"context":{"fact":"Current branch kage/w2-of-the-sessions-surface-the-renderer-260820-3482 changes 25 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:10.703Z","ttl_days":180,"path_fingerprints":[{"path":"docs/design/MEMORY_STORE.md","sha256":"81337fcfa918d0cf4123ee1dc9caeda75ea2f61b07b007522f5b2bec0b40343d","size":31430},{"path":"mcp/delegation-api.test.ts","sha256":"5664b212d3adef17954a296672ff7ce2be4feb285f82989abbcdae276b854adb","size":75803,"symbols":[{"name":"tempproject","kind":"function","sha256":"6fbe246369c1bf905bc03fe80a64608a75fec83146ce4b60b24d363d29ee760b"},{"name":"room","kind":"constant","sha256":"daca1174495725bcfe924b660b84e822be76aea4fbb7dc3ebb244be8b8a9aa47"},{"name":"pattern","kind":"constant","sha256":"b8010ef590f32fea724c737b63d306c7f092408770e9641a4bc0f23aac820d54"},{"name":"defined","kind":"constant","sha256":"f8ce665bfad3d26cfef491803fb4e83a37ece6eb581b042b231301b61ff94ccc"},{"name":"packet","kind":"constant","sha256":"6d114c969d92605b6ab68542472d505ce3b8ab25aa8ff2c3d89cac9af2eb0b95"},{"name":"diff","kind":"constant","sha256":"4755f26124dc87f6c211031d5c8f7b97491ca68a2f89a4a806acbacee62110a6"},{"name":"after","kind":"constant","sha256":"d051c692f49a215432f0e8b7ba363f12fcdcfb0f1c763962e308b5b556d01b54"},{"name":"known","kind":"constant","sha256":"e7c7aa8bbc7ba7d4083fd56c850944dfe396f85703a8cdf0f3d4b12fa2f78563"}]},{"path":"mcp/delegation/app-client.ts","sha256":"ded26e7b2ea02db2b4eade9056358d995b0517b8f9cf1181245a867beb33bafb","size":206711},{"path":"mcp/delegation/app-html.ts","sha256":"ce8d9a5a3bc47b68e8aef4dd6277c2b22a08bdbb6a50e0e583d0024a2e9728e7","size":14159},{"path":"mcp/delegation/app-styles.ts","sha256":"c8d1bb16e765a5659d5a425df9d3e21f50cc10456d0095463a03618f21efbb77","size":76146},{"path":"mcp/kernel.ts","sha256":"11d210257d690b2275a927d1b9bc0f9173735001f51f8a8cff5b45134262b6f3","size":913831,"symbols":[{"name":"untracked","kind":"constant","sha256":"8d31cffa2e43e8e8498c30a2e6eeb043120941acd973d64ecda430b13f52d855"},{"name":"types","kind":"constant","sha256":"2a70be891268716e97a20553eb9121d2863872823e1f64dd3c05dc442e605f0b"},{"name":"explicit","kind":"constant","sha256":"3c7dc76a866b9617850dd05c43ef877cc5208ade5be761331cf32181ace414ff"},{"name":"verification","kind":"constant","sha256":"faeb54eb75a6e60ebcab087f39fdd9f971c8a3a16e25846647ab2dd5802748f3"},{"name":"code","kind":"constant","sha256":"64b81d42a4c6de11c6ff891787a63a33c198717dba5a924932817e97a8d1f7cf"},{"name":"json","kind":"constant","sha256":"f7bcd9f5ef8a5696c0f0ecbd148a4db30b52b674922455ec67a7561c86be4da4"},{"name":"after","kind":"constant","sha256":"220a1c1969c37d53268e215419dcea650ffa901162d0a25e451bd90831fb0a1b"},{"name":"verify","kind":"constant","sha256":"a52f5b45a4f358248075422f84ac83e7d291e8e7acb866eeabdb692896bc9c0d"},{"name":"relevant","kind":"constant","sha256":"ecda229c929f06ede369f9d72be3d3211fef450b1056b73a121c5d925fac2c2b"},{"name":"durable","kind":"constant","sha256":"3fa48acfe2e95fa0fcf831049f2d1aa3ddf26ddc5a1d10724db5da185389e634"},{"name":"memory","kind":"constant","sha256":"952449fe9c2c8827ca2a6a85c0d0a86b82826696ff4f88ee167500678734db36"}]},{"path":"mcp/sessions-ui.test.ts","sha256":"cbd5be8e6e773a665a9c99ade3cc72decd0293f7ddab507d606041db83021a4a","size":32037},{"path":"mcp/store-doc.test.ts","sha256":"ce6a29e5b8126cda86e69ee0862a1f4b228a99db411c5d6c728ac3a3027b5234","size":24402},{"path":"mcp/store-graph.test.ts","sha256":"f94d5ff40dfeb2b61adf3787b8b68f262b80649f47371b788bb624b137c19a79","size":22536,"symbols":[{"name":"tempproject","kind":"function","sha256":"7b4d8756e40dfe57266a7ebbadff9c995dacd5cf53706cb1159b26232f38efe5"},{"name":"files","kind":"constant","sha256":"e15f05c8e2cdb09656bc506d5c033ca42d29c7b97a80381427889cec54144625"},{"name":"symbols","kind":"constant","sha256":"300ccfa24104bcdec904bb6ddd1b06aac2af4e5983c237464667b98838489a33"},{"name":"backend","kind":"constant","sha256":"b401dc2086d9946918905295fefe7a6a23f2b9f85427be57bfde7b84d16bfabf"}]},{"path":"mcp/store/json.ts","sha256":"55b4a35864579c96be5b4ce492857ddc63e2aed947114d08203353bdc607b108","size":28608,"symbols":[{"name":"current","kind":"constant","sha256":"9b6c7d1262192ef1da99b39c2d6c473a93539f4dae7d01a8dea81ac52bf126ce"},{"name":"docs","kind":"constant","sha256":"7b91f24f1b7f50bbd41baba5ceeb956d1f20c93438c382f4d376d888cc83f3ef"}]},{"path":"mcp/store/sqlite.ts","sha256":"d5b0f1b851b7a63a56107241c91634154ad710db2aeb2661c5ce1f4c15aa8c00","size":26717,"symbols":[{"name":"path","kind":"constant","sha256":"6ad78d396b60527578fb5856d5b44944038626bbeb38f943e6542fdb95c22a2d"}]},{"path":"mcp/store/types.ts","sha256":"3b849a94f217e1baf1e99db399b1372df0b50a49a49e58acdb57768d101bb11b","size":15061}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-codecalledge-mcp-kernel-ts-has-no-kind-field-i-mapped-its-resolution-field-ty-d2db9a5a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-jsonstorebackends-structural-knowledge-graph-methods-files-json-symbols-json-imp-f462b7e1.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-kernel-test-tss-tempproject-creates-agent-memory-nodes-not-agent-memory-p-feb86114.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-roomhistoryturn-manager-pty-headless-defined-in-mcp-delegation-room-history-ts-i-3ceefae3.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-roomhistoryturn-manager-pty-headless-room-history-ts-is-exactly-the-api-already-0a7247e9.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-roomsessionmeta-native-transcript-path-in-mcp-delegation-room-supervisor-ts-is-s-a3e546db.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-roomsessionmeta-native-transcript-path-room-supervisor-ts-is-set-only-by-the-pty-3df45162.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-withactivity-in-api-ts-computes-claim-summary-a-formatted-p-t-checks-string-for--0205ac42.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-withactivity-in-mcp-delegation-api-ts-computes-claim-summary-a-formatted-p-t-che-acebf68c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723-494ed573.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/MEMORY_STORE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation-api.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-html.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-styles.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/kernel.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/sessions-ui.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-roomhistoryturn-manager-pty-headless-defined-in-mcp-delegation-room-history-ts-i-3ceefae3.md, .agent_memory/packets/decision-roomhistoryturn-manager-pty-headless-room-history-ts-is-exactly-the-api-already-0a7247e9.md, .agent_memory/packets/decision-roomsessionmeta-native-transcript-path-in-mcp-delegation-room-supervisor-ts-is-s-a3e546db.md, .agent_memory/packets/decision-roomsessionmeta-native-transcript-path-room-supervisor-ts-is-set-only-by-the-pty-3df45162.md"],"duplicate_candidates":[],"estimated_tokens_saved":1149,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:10.703Z","stale":true,"stale_reasons":["linked path changed since memory was verified: mcp/delegation/app-client.ts, mcp/delegation/app-styles.ts, mcp/sessions-ui.test.ts"],"suggested_action":"update"},"created_at":"2026-08-20T09:07:47.273Z","updated_at":"2026-08-21T14:51:20.014Z"}
```

