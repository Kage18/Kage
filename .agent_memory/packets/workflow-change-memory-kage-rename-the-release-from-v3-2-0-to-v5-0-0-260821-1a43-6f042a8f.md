---
type: "Workflow"
title: "Change memory: kage/rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43"
description: "Repo-local context for 18 changed repo paths on kage/rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43."
resource: ".agent_memory/packets/bug_fix-a-module-level-entering-view-flag-consumed-by-renderroom-must-not-be-cleared-on--854e4a89.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43"]
timestamp: "2026-08-21T19:41:17.967Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/bug_fix-a-module-level-entering-view-flag-consumed-by-renderroom-must-not-be-cleared-on--854e4a89.md", ".agent_memory/packets/bug_fix-app-client-tss-renderroom-is-unit-testable-with-real-behavior-not-just-source-te-23af767f.md", ".agent_memory/packets/bug_fix-mcp-delegation-api-tss-pty-identity-poll-timeout-ms-was-still-5000ms-at-the-star-0c260155.md", ".agent_memory/packets/decision-mcp-release-test-tss-distribution-manifests-stay-in-version-lockstep-test-reads--9e1465ad.md", ".agent_memory/packets/decision-no-file-in-the-repo-contains-a-literal-kage-3-2-0-or-version-embedded-artifact-f-60bb1099.md", ".agent_memory/packets/decision-the-mcp-test-suite-has-at-least-three-distinct-process-timing-sensitive-tests-di-0f9c76cc.md", ".agent_memory/packets/workflow-change-memory-kage-redo-of-a-rejected-run-with-its-failure-260821-a82b-b86ba4d9.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md", "CHANGELOG.md", "mcp/delegation/api.ts", "mcp/delegation/app-client.ts", "mcp/package.json", "mcp/redo-of-a-rejected.test.ts", "plugin/.claude-plugin/plugin.json", "plugin/.codex-plugin/plugin.json", "server.json", "shell/package-lock.json", "shell/package.json"]
---

# Change memory: kage/rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43

> Repo-local context for 18 changed repo paths on kage/rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-a-module-level-entering-view-flag-consumed-by-renderroom-must-not-be-cleared-on--854e4a89.md
- .agent_memory/packets/bug_fix-app-client-tss-renderroom-is-unit-testable-with-real-behavior-not-just-source-te-23af767f.md
- .agent_memory/packets/bug_fix-mcp-delegation-api-tss-pty-identity-poll-timeout-ms-was-still-5000ms-at-the-star-0c260155.md
- .agent_memory/packets/decision-mcp-release-test-tss-distribution-manifests-stay-in-version-lockstep-test-reads--9e1465ad.md
- .agent_memory/packets/decision-no-file-in-the-repo-contains-a-literal-kage-3-2-0-or-version-embedded-artifact-f-60bb1099.md
- .agent_memory/packets/decision-the-mcp-test-suite-has-at-least-three-distinct-process-timing-sensitive-tests-di-0f9c76cc.md
- .agent_memory/packets/workflow-change-memory-kage-redo-of-a-rejected-run-with-its-failure-260821-a82b-b86ba4d9.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- CHANGELOG.md
- mcp/delegation/api.ts
- mcp/delegation/app-client.ts
- mcp/package.json
- mcp/redo-of-a-rejected.test.ts
- plugin/.claude-plugin/plugin.json
- plugin/.codex-plugin/plugin.json
- server.json
- shell/package-lock.json
- shell/package.json

Diff summary:
```text
...tay-in-version-lockstep-test-reads--9e1465ad.md | 42 ----------------------
 ...-2-0-or-version-embedded-artifact-f-60bb1099.md | 42 ----------------------
 ...t-process-timing-sensitive-tests-di-0f9c76cc.md | 42 ----------------------
 ...workflow-change-memory-release-prep-a72d4251.md | 25 +++++--------
 CHANGELOG.md                                       |  2 +-
 mcp/delegation/api.ts                              | 14 +++++---
 mcp/delegation/app-client.ts                       | 34 ++++++++++++++++--
 mcp/package.json                                   |  2 +-
 plugin/.claude-plugin/plugin.json                  |  2 +-
 plugin/.codex-plugin/plugin.json                   |  2 +-
 server.json                                        |  4 +--
 shell/package-lock.json                            |  4 +--
 shell/package.json                                 |  2 +-
 13 files changed, 58 insertions(+), 159 deletions(-)
.agent_memory/packets/bug_fix-a-module-level-entering-view-flag-consumed-by-renderroom-must-not-be-cleared-on--854e4a89.md | untracked
.agent_memory/packets/bug_fix-app-client-tss-renderroom-is-unit-testable-with-real-behavior-not-just-source-te-23af767f.md | untracked
.agent_memory/packets/bug_fix-mcp-delegation-api-tss-pty-identity-poll-timeout-ms-was-still-5000ms-at-the-star-0c260155.md | untracked
.agent_memory/packets/workflow-change-memory-kage-redo-of-a-rejected-run-with-its-failure-260821-a82b-b86ba4d9.md | untracked
mcp/redo-of-a-rejected.test.ts | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43","title":"Change memory: kage/rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43","summary":"Repo-local context for 18 changed repo paths on kage/rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-a-module-level-entering-view-flag-consumed-by-renderroom-must-not-be-cleared-on--854e4a89.md\n- .agent_memory/packets/bug_fix-app-client-tss-renderroom-is-unit-testable-with-real-behavior-not-just-source-te-23af767f.md\n- .agent_memory/packets/bug_fix-mcp-delegation-api-tss-pty-identity-poll-timeout-ms-was-still-5000ms-at-the-star-0c260155.md\n- .agent_memory/packets/decision-mcp-release-test-tss-distribution-manifests-stay-in-version-lockstep-test-reads--9e1465ad.md\n- .agent_memory/packets/decision-no-file-in-the-repo-contains-a-literal-kage-3-2-0-or-version-embedded-artifact-f-60bb1099.md\n- .agent_memory/packets/decision-the-mcp-test-suite-has-at-least-three-distinct-process-timing-sensitive-tests-di-0f9c76cc.md\n- .agent_memory/packets/workflow-change-memory-kage-redo-of-a-rejected-run-with-its-failure-260821-a82b-b86ba4d9.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- CHANGELOG.md\n- mcp/delegation/api.ts\n- mcp/delegation/app-client.ts\n- mcp/package.json\n- mcp/redo-of-a-rejected.test.ts\n- plugin/.claude-plugin/plugin.json\n- plugin/.codex-plugin/plugin.json\n- server.json\n- shell/package-lock.json\n- shell/package.json\n\nDiff summary:\n```text\n...tay-in-version-lockstep-test-reads--9e1465ad.md | 42 ----------------------\n ...-2-0-or-version-embedded-artifact-f-60bb1099.md | 42 ----------------------\n ...t-process-timing-sensitive-tests-di-0f9c76cc.md | 42 ----------------------\n ...workflow-change-memory-release-prep-a72d4251.md | 25 +++++--------\n CHANGELOG.md                                       |  2 +-\n mcp/delegation/api.ts                              | 14 +++++---\n mcp/delegation/app-client.ts                       | 34 ++++++++++++++++--\n mcp/package.json                                   |  2 +-\n plugin/.claude-plugin/plugin.json                  |  2 +-\n plugin/.codex-plugin/plugin.json                   |  2 +-\n server.json                                        |  4 +--\n shell/package-lock.json                            |  4 +--\n shell/package.json                                 |  2 +-\n 13 files changed, 58 insertions(+), 159 deletions(-)\n.agent_memory/packets/bug_fix-a-module-level-entering-view-flag-consumed-by-renderroom-must-not-be-cleared-on--854e4a89.md | untracked\n.agent_memory/packets/bug_fix-app-client-tss-renderroom-is-unit-testable-with-real-behavior-not-just-source-te-23af767f.md | untracked\n.agent_memory/packets/bug_fix-mcp-delegation-api-tss-pty-identity-poll-timeout-ms-was-still-5000ms-at-the-star-0c260155.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-redo-of-a-rejected-run-with-its-failure-260821-a82b-b86ba4d9.md | untracked\nmcp/redo-of-a-rejected.test.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43"],"paths":[".agent_memory/packets/bug_fix-a-module-level-entering-view-flag-consumed-by-renderroom-must-not-be-cleared-on--854e4a89.md",".agent_memory/packets/bug_fix-app-client-tss-renderroom-is-unit-testable-with-real-behavior-not-just-source-te-23af767f.md",".agent_memory/packets/bug_fix-mcp-delegation-api-tss-pty-identity-poll-timeout-ms-was-still-5000ms-at-the-star-0c260155.md",".agent_memory/packets/decision-mcp-release-test-tss-distribution-manifests-stay-in-version-lockstep-test-reads--9e1465ad.md",".agent_memory/packets/decision-no-file-in-the-repo-contains-a-literal-kage-3-2-0-or-version-embedded-artifact-f-60bb1099.md",".agent_memory/packets/decision-the-mcp-test-suite-has-at-least-three-distinct-process-timing-sensitive-tests-di-0f9c76cc.md",".agent_memory/packets/workflow-change-memory-kage-redo-of-a-rejected-run-with-its-failure-260821-a82b-b86ba4d9.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","CHANGELOG.md","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/package.json","mcp/redo-of-a-rejected.test.ts","plugin/.claude-plugin/plugin.json","plugin/.codex-plugin/plugin.json","server.json","shell/package-lock.json","shell/package.json"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43","head":"0760da24a86c757ede78fb8ff1deb5fe896055b8","merge_base":"a7d95d97499c28919013a3e13b7216ae89b7f51d","changed_files":[".agent_memory/packets/bug_fix-a-module-level-entering-view-flag-consumed-by-renderroom-must-not-be-cleared-on--854e4a89.md",".agent_memory/packets/bug_fix-app-client-tss-renderroom-is-unit-testable-with-real-behavior-not-just-source-te-23af767f.md",".agent_memory/packets/bug_fix-mcp-delegation-api-tss-pty-identity-poll-timeout-ms-was-still-5000ms-at-the-star-0c260155.md",".agent_memory/packets/decision-mcp-release-test-tss-distribution-manifests-stay-in-version-lockstep-test-reads--9e1465ad.md",".agent_memory/packets/decision-no-file-in-the-repo-contains-a-literal-kage-3-2-0-or-version-embedded-artifact-f-60bb1099.md",".agent_memory/packets/decision-the-mcp-test-suite-has-at-least-three-distinct-process-timing-sensitive-tests-di-0f9c76cc.md",".agent_memory/packets/workflow-change-memory-kage-redo-of-a-rejected-run-with-its-failure-260821-a82b-b86ba4d9.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","CHANGELOG.md","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/package.json","mcp/redo-of-a-rejected.test.ts","plugin/.claude-plugin/plugin.json","plugin/.codex-plugin/plugin.json","server.json","shell/package-lock.json","shell/package.json"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43.json"}],"context":{"fact":"Current branch kage/rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43 changes 18 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-21T19:41:17.967Z","ttl_days":180,"path_fingerprints":[{"path":"CHANGELOG.md","sha256":"4ec69525d1d8a0d52d872e387d2e8916670133b2a381dd4e7342683f5e853c48","size":70154},{"path":"mcp/delegation/api.ts","sha256":"aea597272bd0b1a96abe7a95040bda6008c0d053b5478f6083fd20ae84d2e29b","size":94409},{"path":"mcp/delegation/app-client.ts","sha256":"1dc824d6220be0ba5af0914611297cb96dcb90ce1dd262cf197b4c0bd0c76d61","size":240211},{"path":"mcp/package.json","sha256":"1f7f8529aec287d4c40afaa6ada0fbb936b7648da507ea9c197428faaddad40a","size":1551},{"path":"mcp/redo-of-a-rejected.test.ts","sha256":"084694919367ce83873652187feb55db452441679782d3a172ea916b7b62fcc8","size":13387},{"path":"plugin/.claude-plugin/plugin.json","sha256":"34488149c7e42e63b6ecbe6bc4dac3b072c2b4e14ad7a565c2705818b589d467","size":698},{"path":"plugin/.codex-plugin/plugin.json","sha256":"054f10c0009c5855fc0336bc2225a8fa40ef3e72db37ad34e2b79c84bf43646a","size":357},{"path":"server.json","sha256":"2da6edbc912477969ee4768a0b5c7b8e8e0f36516d7dab70548ec6bbac9930d0","size":813},{"path":"shell/package-lock.json","sha256":"a50b52ecd0a21f209012749a400aa3cc8c62e43a56b9dfb18e6f027e3a8ba4b8","size":192528},{"path":"shell/package.json","sha256":"0782d3497148c10ec4e52b6a3436428a3c3b34bf599f2b7d71c84ad41567b9a6","size":658}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-a-module-level-entering-view-flag-consumed-by-renderroom-must-not-be-cleared-on--854e4a89.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-app-client-tss-renderroom-is-unit-testable-with-real-behavior-not-just-source-te-23af767f.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-mcp-delegation-api-tss-pty-identity-poll-timeout-ms-was-still-5000ms-at-the-star-0c260155.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-release-test-tss-distribution-manifests-stay-in-version-lockstep-test-reads--9e1465ad.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-no-file-in-the-repo-contains-a-literal-kage-3-2-0-or-version-embedded-artifact-f-60bb1099.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-mcp-test-suite-has-at-least-three-distinct-process-timing-sensitive-tests-di-0f9c76cc.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-redo-of-a-rejected-run-with-its-failure-260821-a82b-b86ba4d9.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:CHANGELOG.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/package.json","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/redo-of-a-rejected.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:plugin/.claude-plugin/plugin.json","evidence":"git_diff"},{"relation":"changes_path","to":"path:plugin/.codex-plugin/plugin.json","evidence":"git_diff"},{"relation":"changes_path","to":"path:server.json","evidence":"git_diff"},{"relation":"changes_path","to":"path:shell/package-lock.json","evidence":"git_diff"},{"relation":"changes_path","to":"path:shell/package.json","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-mcp-release-test-tss-distribution-manifests-stay-in-version-lockstep-test-reads--9e1465ad.md, .agent_memory/packets/decision-no-file-in-the-repo-contains-a-literal-kage-3-2-0-or-version-embedded-artifact-f-60bb1099.md, .agent_memory/packets/decision-the-mcp-test-suite-has-at-least-three-distinct-process-timing-sensitive-tests-di-0f9c76cc.md"],"duplicate_candidates":[],"stale_reasons":["linked path changed since memory was verified: mcp/package.json, plugin/.claude-plugin/plugin.json, plugin/.codex-plugin/plugin.json, server.json"],"estimated_tokens_saved":858,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"stale":true,"suggested_action":"update"},"created_at":"2026-08-21T19:41:17.967Z","updated_at":"2026-08-21T19:46:22.928Z"}
```

