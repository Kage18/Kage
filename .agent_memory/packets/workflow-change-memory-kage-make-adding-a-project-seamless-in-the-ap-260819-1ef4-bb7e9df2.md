---
type: "Workflow"
title: "Change memory: kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4"
description: "Repo-local context for 19 changed repo paths on kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4."
resource: ".agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4"]
timestamp: "2026-08-19T11:13:13.214Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md", ".agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md", ".agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md", ".agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md", ".agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md", ".agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md", ".agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md", "mcp/add-project.test.ts", "mcp/cli.ts", "mcp/delegation/add-project.ts", "mcp/delegation/api.ts", "mcp/delegation/app-client.ts", "mcp/delegation/app-html.ts", "mcp/delegation/app-styles.ts", "mcp/delegation/config.ts", "mcp/delegation/room-pty.ts", "mcp/delegation/room-supervisor.ts", "mcp/orchestrator-session.test.ts"]
---

# Change memory: kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4

> Repo-local context for 19 changed repo paths on kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md
- .agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md
- .agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md
- .agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md
- .agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md
- .agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md
- .agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/add-project.test.ts
- mcp/cli.ts
- mcp/delegation/add-project.ts
- mcp/delegation/api.ts
- mcp/delegation/app-client.ts
- mcp/delegation/app-html.ts
- mcp/delegation/app-styles.ts
- mcp/delegation/config.ts
- mcp/delegation/room-pty.ts
- mcp/delegation/room-supervisor.ts
- mcp/orchestrator-session.test.ts

Diff summary:
```text
...tries-a-live-held-open-session-with-a02bd27d.md |  69 ----------
 ...ent-to-claude-when-the-caller-omitt-68fec206.md |  69 ----------
 ...s-registry-kage-projects-json-previ-4f2577bf.md |  69 ----------
 ...workflow-change-memory-release-prep-a72d4251.md |  21 ++-
 mcp/add-project.test.ts                            | 153 ---------------------
 mcp/cli.ts                                         |  57 +-------
 mcp/delegation/add-project.ts                      | 123 -----------------
 mcp/delegation/api.ts                              |  58 +-------
 mcp/delegation/app-client.ts                       | 129 +----------------
 mcp/delegation/app-html.ts                         |  34 -----
 mcp/delegation/app-styles.ts                       |   5 -
 mcp/delegation/config.ts                           |   7 -
 mcp/delegation/room-pty.ts                         |  83 ++++++++++-
 mcp/delegation/room-supervisor.ts                  |  27 ++--
 14 files changed, 118 insertions(+), 786 deletions(-)
.agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md | untracked
.agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md | untracked
.agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md | untracked
.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md | untracked
mcp/orchestrator-session.test.ts | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4","title":"Change memory: kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4","summary":"Repo-local context for 19 changed repo paths on kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md\n- .agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md\n- .agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md\n- .agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md\n- .agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md\n- .agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md\n- .agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/add-project.test.ts\n- mcp/cli.ts\n- mcp/delegation/add-project.ts\n- mcp/delegation/api.ts\n- mcp/delegation/app-client.ts\n- mcp/delegation/app-html.ts\n- mcp/delegation/app-styles.ts\n- mcp/delegation/config.ts\n- mcp/delegation/room-pty.ts\n- mcp/delegation/room-supervisor.ts\n- mcp/orchestrator-session.test.ts\n\nDiff summary:\n```text\n...tries-a-live-held-open-session-with-a02bd27d.md |  69 ----------\n ...ent-to-claude-when-the-caller-omitt-68fec206.md |  69 ----------\n ...s-registry-kage-projects-json-previ-4f2577bf.md |  69 ----------\n ...workflow-change-memory-release-prep-a72d4251.md |  21 ++-\n mcp/add-project.test.ts                            | 153 ---------------------\n mcp/cli.ts                                         |  57 +-------\n mcp/delegation/add-project.ts                      | 123 -----------------\n mcp/delegation/api.ts                              |  58 +-------\n mcp/delegation/app-client.ts                       | 129 +----------------\n mcp/delegation/app-html.ts                         |  34 -----\n mcp/delegation/app-styles.ts                       |   5 -\n mcp/delegation/config.ts                           |   7 -\n mcp/delegation/room-pty.ts                         |  83 ++++++++++-\n mcp/delegation/room-supervisor.ts                  |  27 ++--\n 14 files changed, 118 insertions(+), 786 deletions(-)\n.agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md | untracked\n.agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md | untracked\n.agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md | untracked\nmcp/orchestrator-session.test.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4"],"paths":[".agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md",".agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md",".agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md",".agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md",".agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md",".agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md",".agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/add-project.test.ts","mcp/cli.ts","mcp/delegation/add-project.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/delegation/config.ts","mcp/delegation/room-pty.ts","mcp/delegation/room-supervisor.ts","mcp/orchestrator-session.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4","head":"25090460cba8924803001fa35aa878e5c9716ceb","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md",".agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md",".agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md",".agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md",".agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md",".agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md",".agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/add-project.test.ts","mcp/cli.ts","mcp/delegation/add-project.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/delegation/config.ts","mcp/delegation/room-pty.ts","mcp/delegation/room-supervisor.ts","mcp/orchestrator-session.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4.json"}],"context":{"fact":"Current branch kage/make-adding-a-project-seamless-in-the-ap-260819-1ef4 changes 19 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-19T11:13:13.214Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/cli.ts","sha256":"e23a320df06b1a119769cf15b5e785e9ada05ddc73addc9d291878b25913d127","size":137372},{"path":"mcp/delegation/api.ts","sha256":"748cd60a5b746d1252182baabd7a076499ab375a9423b3c1113d0f4412639418","size":57569},{"path":"mcp/delegation/app-client.ts","sha256":"f49016fdc1cf247356d210d9c644046cbf69dcbc0fd14b3b9cd0a41e7d080347","size":134789},{"path":"mcp/delegation/app-html.ts","sha256":"0972c8e57193c095cd8304b2210434300c6169defd1d3eb7d90e8576517744f1","size":12225},{"path":"mcp/delegation/app-styles.ts","sha256":"d936bb211f3fe379fc641b56901befbb2532954f773e6b809c41e0ac0f65bd51","size":62395},{"path":"mcp/delegation/config.ts","sha256":"15a5b72a99ef4e66419e742d7af90153140eae79ad50fe6681bd96ed2d32fa29","size":6762},{"path":"mcp/delegation/room-pty.ts","sha256":"e5eb378a195021c1c5b3b94ce050a4461c88605f2ac530aed6d6c675ee6c7b92","size":19764},{"path":"mcp/delegation/room-supervisor.ts","sha256":"7b4ede9bf9f84d77074d7a81f7383e581949fc8a2226cabef464640ecc97a487","size":26912},{"path":"mcp/orchestrator-session.test.ts","sha256":"a74914ea8c9d291d6dc57daab01f287583b0681a1a47667cd63f0bce3a8f7d2e","size":6912}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-guardmanagerprose-only-runs-inside-room-supervisor-tss-stdout-parsing-of-the-hea-acaf57a2.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-manager-allowed-tools-manager-client-ts-already-covers-the-full-delegation-surfa-6887ca22.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-writeroommcpconfigs-kage-project-dir-must-stay-pointed-at-the-real-project-direc-9e9bb963.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/add-project.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/add-project.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-html.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-styles.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/config.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/room-pty.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/room-supervisor.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/orchestrator-session.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md, .agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md, .agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md, mcp/add-project.test.ts"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: .agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md, .agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md, .agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md, mcp/add-project.test.ts"],"estimated_tokens_saved":895,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-19T11:13:13.214Z","updated_at":"2026-08-19T11:13:13.214Z"}
```

