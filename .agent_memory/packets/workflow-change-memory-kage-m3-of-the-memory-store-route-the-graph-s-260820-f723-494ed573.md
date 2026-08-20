---
type: "Workflow"
title: "Change memory: kage/m3-of-the-memory-store-route-the-graph-s-260820-f723"
description: "Repo-local context for 12 changed repo paths on kage/m3-of-the-memory-store-route-the-graph-s-260820-f723."
resource: "docs/design/MEMORY_STORE.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-m3-of-the-memory-store-route-the-graph-s-260820-f723"]
timestamp: "2026-08-20T12:42:21.302Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["docs/design/MEMORY_STORE.md", "mcp/kernel.ts", "mcp/store-doc.test.ts", "mcp/store-graph.test.ts", "mcp/store/json.ts", "mcp/store/sqlite.ts", "mcp/store/types.ts"]
---

# Change memory: kage/m3-of-the-memory-store-route-the-graph-s-260820-f723

> Repo-local context for 12 changed repo paths on kage/m3-of-the-memory-store-route-the-graph-s-260820-f723.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/decision-codecalledge-mcp-kernel-ts-has-no-kind-field-i-mapped-its-resolution-field-ty-d2db9a5a.md
- .agent_memory/packets/decision-jsonstorebackends-structural-knowledge-graph-methods-files-json-symbols-json-imp-f462b7e1.md
- .agent_memory/packets/decision-mcp-kernel-test-tss-tempproject-creates-agent-memory-nodes-not-agent-memory-p-feb86114.md
- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md
- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md
- docs/design/MEMORY_STORE.md
- mcp/kernel.ts
- mcp/store-doc.test.ts
- mcp/store-graph.test.ts
- mcp/store/json.ts
- mcp/store/sqlite.ts
- mcp/store/types.ts

Diff summary:
```text
...ld-i-mapped-its-resolution-field-ty-d2db9a5a.md |  55 ---
 ...methods-files-json-symbols-json-imp-f462b7e1.md |  55 ---
 ...ent-memory-nodes-not-agent-memory-p-feb86114.md |  55 ---
 docs/design/MEMORY_STORE.md                        |   2 +-
 mcp/kernel.ts                                      | 181 +---------
 mcp/store-doc.test.ts                              |  43 +--
 mcp/store-graph.test.ts                            | 387 ---------------------
 mcp/store/json.ts                                  |  52 ---
 mcp/store/sqlite.ts                                |  72 ----
 mcp/store/types.ts                                 |  44 ---
 10 files changed, 16 insertions(+), 930 deletions(-)
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723","title":"Change memory: kage/m3-of-the-memory-store-route-the-graph-s-260820-f723","summary":"Repo-local context for 12 changed repo paths on kage/m3-of-the-memory-store-route-the-graph-s-260820-f723.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-codecalledge-mcp-kernel-ts-has-no-kind-field-i-mapped-its-resolution-field-ty-d2db9a5a.md\n- .agent_memory/packets/decision-jsonstorebackends-structural-knowledge-graph-methods-files-json-symbols-json-imp-f462b7e1.md\n- .agent_memory/packets/decision-mcp-kernel-test-tss-tempproject-creates-agent-memory-nodes-not-agent-memory-p-feb86114.md\n- .agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md\n- .agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md\n- docs/design/MEMORY_STORE.md\n- mcp/kernel.ts\n- mcp/store-doc.test.ts\n- mcp/store-graph.test.ts\n- mcp/store/json.ts\n- mcp/store/sqlite.ts\n- mcp/store/types.ts\n\nDiff summary:\n```text\n...ld-i-mapped-its-resolution-field-ty-d2db9a5a.md |  55 ---\n ...methods-files-json-symbols-json-imp-f462b7e1.md |  55 ---\n ...ent-memory-nodes-not-agent-memory-p-feb86114.md |  55 ---\n docs/design/MEMORY_STORE.md                        |   2 +-\n mcp/kernel.ts                                      | 181 +---------\n mcp/store-doc.test.ts                              |  43 +--\n mcp/store-graph.test.ts                            | 387 ---------------------\n mcp/store/json.ts                                  |  52 ---\n mcp/store/sqlite.ts                                |  72 ----\n mcp/store/types.ts                                 |  44 ---\n 10 files changed, 16 insertions(+), 930 deletions(-)\n.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-m3-of-the-memory-store-route-the-graph-s-260820-f723"],"paths":["docs/design/MEMORY_STORE.md","mcp/kernel.ts","mcp/store-doc.test.ts","mcp/store-graph.test.ts","mcp/store/json.ts","mcp/store/sqlite.ts","mcp/store/types.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/m3-of-the-memory-store-route-the-graph-s-260820-f723","head":"0a9f9f9edba0b03aa7634720c2a898bcafbf72ef","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/decision-codecalledge-mcp-kernel-ts-has-no-kind-field-i-mapped-its-resolution-field-ty-d2db9a5a.md",".agent_memory/packets/decision-jsonstorebackends-structural-knowledge-graph-methods-files-json-symbols-json-imp-f462b7e1.md",".agent_memory/packets/decision-mcp-kernel-test-tss-tempproject-creates-agent-memory-nodes-not-agent-memory-p-feb86114.md",".agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md",".agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md","docs/design/MEMORY_STORE.md","mcp/kernel.ts","mcp/store-doc.test.ts","mcp/store-graph.test.ts","mcp/store/json.ts","mcp/store/sqlite.ts","mcp/store/types.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-m3-of-the-memory-store-route-the-graph-s-260820-f723.json"}],"context":{"fact":"Current branch kage/m3-of-the-memory-store-route-the-graph-s-260820-f723 changes 12 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:21.302Z","ttl_days":180,"path_fingerprints":[{"path":"docs/design/MEMORY_STORE.md","sha256":"81337fcfa918d0cf4123ee1dc9caeda75ea2f61b07b007522f5b2bec0b40343d","size":31430},{"path":"mcp/kernel.ts","sha256":"11d210257d690b2275a927d1b9bc0f9173735001f51f8a8cff5b45134262b6f3","size":913831,"symbols":[{"name":"untracked","kind":"constant","sha256":"8d31cffa2e43e8e8498c30a2e6eeb043120941acd973d64ecda430b13f52d855"},{"name":"types","kind":"constant","sha256":"2a70be891268716e97a20553eb9121d2863872823e1f64dd3c05dc442e605f0b"},{"name":"explicit","kind":"constant","sha256":"3c7dc76a866b9617850dd05c43ef877cc5208ade5be761331cf32181ace414ff"},{"name":"verification","kind":"constant","sha256":"faeb54eb75a6e60ebcab087f39fdd9f971c8a3a16e25846647ab2dd5802748f3"},{"name":"code","kind":"constant","sha256":"64b81d42a4c6de11c6ff891787a63a33c198717dba5a924932817e97a8d1f7cf"},{"name":"json","kind":"constant","sha256":"f7bcd9f5ef8a5696c0f0ecbd148a4db30b52b674922455ec67a7561c86be4da4"},{"name":"after","kind":"constant","sha256":"220a1c1969c37d53268e215419dcea650ffa901162d0a25e451bd90831fb0a1b"},{"name":"verify","kind":"constant","sha256":"a52f5b45a4f358248075422f84ac83e7d291e8e7acb866eeabdb692896bc9c0d"},{"name":"relevant","kind":"constant","sha256":"ecda229c929f06ede369f9d72be3d3211fef450b1056b73a121c5d925fac2c2b"},{"name":"durable","kind":"constant","sha256":"3fa48acfe2e95fa0fcf831049f2d1aa3ddf26ddc5a1d10724db5da185389e634"},{"name":"memory","kind":"constant","sha256":"952449fe9c2c8827ca2a6a85c0d0a86b82826696ff4f88ee167500678734db36"}]},{"path":"mcp/store-doc.test.ts","sha256":"ce6a29e5b8126cda86e69ee0862a1f4b228a99db411c5d6c728ac3a3027b5234","size":24402},{"path":"mcp/store-graph.test.ts","sha256":"f94d5ff40dfeb2b61adf3787b8b68f262b80649f47371b788bb624b137c19a79","size":22536,"symbols":[{"name":"tempproject","kind":"function","sha256":"7b4d8756e40dfe57266a7ebbadff9c995dacd5cf53706cb1159b26232f38efe5"},{"name":"files","kind":"constant","sha256":"e15f05c8e2cdb09656bc506d5c033ca42d29c7b97a80381427889cec54144625"},{"name":"symbols","kind":"constant","sha256":"300ccfa24104bcdec904bb6ddd1b06aac2af4e5983c237464667b98838489a33"},{"name":"backend","kind":"constant","sha256":"b401dc2086d9946918905295fefe7a6a23f2b9f85427be57bfde7b84d16bfabf"}]},{"path":"mcp/store/json.ts","sha256":"55b4a35864579c96be5b4ce492857ddc63e2aed947114d08203353bdc607b108","size":28608,"symbols":[{"name":"current","kind":"constant","sha256":"9b6c7d1262192ef1da99b39c2d6c473a93539f4dae7d01a8dea81ac52bf126ce"},{"name":"docs","kind":"constant","sha256":"7b91f24f1b7f50bbd41baba5ceeb956d1f20c93438c382f4d376d888cc83f3ef"}]},{"path":"mcp/store/sqlite.ts","sha256":"d5b0f1b851b7a63a56107241c91634154ad710db2aeb2661c5ce1f4c15aa8c00","size":26717},{"path":"mcp/store/types.ts","sha256":"3b849a94f217e1baf1e99db399b1372df0b50a49a49e58acdb57768d101bb11b","size":15061}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-codecalledge-mcp-kernel-ts-has-no-kind-field-i-mapped-its-resolution-field-ty-d2db9a5a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-jsonstorebackends-structural-knowledge-graph-methods-files-json-symbols-json-imp-f462b7e1.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-kernel-test-tss-tempproject-creates-agent-memory-nodes-not-agent-memory-p-feb86114.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w1-of-the-sessions-surface-the-backend-d-260820-5b1e-8ecf247c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-w2-of-the-sessions-surface-the-renderer-260820-3482-5d77a58c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/MEMORY_STORE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/kernel.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/store-doc.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/store-graph.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/store/json.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/store/sqlite.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/store/types.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-codecalledge-mcp-kernel-ts-has-no-kind-field-i-mapped-its-resolution-field-ty-d2db9a5a.md, .agent_memory/packets/decision-jsonstorebackends-structural-knowledge-graph-methods-files-json-symbols-json-imp-f462b7e1.md, .agent_memory/packets/decision-mcp-kernel-test-tss-tempproject-creates-agent-memory-nodes-not-agent-memory-p-feb86114.md, mcp/store-graph.test.ts"],"duplicate_candidates":[],"estimated_tokens_saved":613,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:21.302Z"},"created_at":"2026-08-20T09:06:12.851Z","updated_at":"2026-08-20T12:42:21.302Z"}
```

