---
type: "Workflow"
title: "Change memory: kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a"
description: "Repo-local context for 28 changed repo paths on kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a."
resource: ".agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-budgets-become-a-circuit-breaker-not-a-t-260820-e70a"]
timestamp: "2026-08-20T06:05:01.053Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-budgets-become-a-circuit-breaker-not-a-t-260820-e70a"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md", ".agent_memory/packets/decision-claude-codes-live-stream-json-protocol-emits-exactly-one-result-event-per-full-a-6260e051.md", ".agent_memory/packets/decision-the-concurrency-cap-had-two-independent-compounding-bugs-a-checked-after-the-age-5efeeb6b.md", ".agent_memory/packets/reference-aos-actual-architecture-read-from-its-live-daemon-and-sqlite-one-sessions-table--0552ae74.md", ".agent_memory/packets/workflow-change-memory-kage-one-manager-session-the-way-ao-does-it-t-260820-eb37-59ec7760.md", ".agent_memory/packets/workflow-change-memory-kage-write-docs-design-context-engine-md-the-260820-7f89-4d56952d.md", ".agent_memory/packets/workflow-change-memory-kage-write-docs-design-memory-store-md-the-ar-260820-65a4-d3652b73.md", ".agent_memory/packets/workflow-change-memory-kage-write-docs-design-sessions-surface-md-th-260820-8f4e-49e45f08.md", "docs/design/CONTEXT_ENGINE.md", "docs/design/MEMORY_STORE.md", "docs/design/SESSIONS_SURFACE.md", "mcp/budget-config.test.ts", "mcp/cli.ts", "mcp/concurrency-queue.test.ts", "mcp/context-doc.test.ts", "mcp/daemon.ts", "mcp/delegation/app-client.ts", "mcp/delegation/config.ts", "mcp/delegation/contract.ts", "mcp/delegation/dispatch.ts", "mcp/delegation/recovery.ts", "mcp/delegation/supervisor.ts", "mcp/delegation/tui/app.ts", "mcp/resume-budgets.test.ts", "mcp/run-budget.test.ts", "mcp/sessions-doc.test.ts", "mcp/stall-detector.test.ts", "mcp/store-doc.test.ts"]
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-budgets-become-a-circuit-breaker-not-a-t-260820-e70a","title":"Change memory: kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a","summary":"Repo-local context for 28 changed repo paths on kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md\n- .agent_memory/packets/decision-claude-codes-live-stream-json-protocol-emits-exactly-one-result-event-per-full-a-6260e051.md\n- .agent_memory/packets/decision-the-concurrency-cap-had-two-independent-compounding-bugs-a-checked-after-the-age-5efeeb6b.md\n- .agent_memory/packets/reference-aos-actual-architecture-read-from-its-live-daemon-and-sqlite-one-sessions-table--0552ae74.md\n- .agent_memory/packets/workflow-change-memory-kage-one-manager-session-the-way-ao-does-it-t-260820-eb37-59ec7760.md\n- .agent_memory/packets/workflow-change-memory-kage-write-docs-design-context-engine-md-the-260820-7f89-4d56952d.md\n- .agent_memory/packets/workflow-change-memory-kage-write-docs-design-memory-store-md-the-ar-260820-65a4-d3652b73.md\n- .agent_memory/packets/workflow-change-memory-kage-write-docs-design-sessions-surface-md-th-260820-8f4e-49e45f08.md\n- docs/design/CONTEXT_ENGINE.md\n- docs/design/MEMORY_STORE.md\n- docs/design/SESSIONS_SURFACE.md\n- mcp/budget-config.test.ts\n- mcp/cli.ts\n- mcp/concurrency-queue.test.ts\n- mcp/context-doc.test.ts\n- mcp/daemon.ts\n- mcp/delegation/app-client.ts\n- mcp/delegation/config.ts\n- mcp/delegation/contract.ts\n- mcp/delegation/dispatch.ts\n- mcp/delegation/recovery.ts\n- mcp/delegation/supervisor.ts\n- mcp/delegation/tui/app.ts\n- mcp/resume-budgets.test.ts\n- mcp/run-budget.test.ts\n- mcp/sessions-doc.test.ts\n- mcp/stall-detector.test.ts\n- mcp/store-doc.test.ts\n\nDiff summary:\n```text\n...-option-at-all-independent-of-daemo-e8f3b4de.md |  67 -----\n ...exactly-one-result-event-per-full-a-6260e051.md |  67 -----\n ...unding-bugs-a-checked-after-the-age-5efeeb6b.md |  67 -----\n mcp/budget-config.test.ts                          |  52 +---\n mcp/cli.ts                                         |  56 ++--\n mcp/concurrency-queue.test.ts                      | 238 ---------------\n mcp/daemon.ts                                      |   9 -\n mcp/delegation/app-client.ts                       |   5 +-\n mcp/delegation/config.ts                           |   8 +-\n mcp/delegation/contract.ts                         | 124 +++-----\n mcp/delegation/dispatch.ts                         |  34 ---\n mcp/delegation/recovery.ts                         |  61 ++--\n mcp/delegation/supervisor.ts                       | 297 +------------------\n mcp/delegation/tui/app.ts                          |   5 +-\n mcp/resume-budgets.test.ts                         | 174 +++++------\n mcp/run-budget.test.ts                             |  10 +-\n mcp/stall-detector.test.ts                         | 328 ---------------------\n 17 files changed, 191 insertions(+), 1411 deletions(-)\n.agent_memory/packets/reference-aos-actual-architecture-read-from-its-live-daemon-and-sqlite-one-sessions-table--0552ae74.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-one-manager-session-the-way-ao-does-it-t-260820-eb37-59ec7760.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-write-docs-design-context-engine-md-the-260820-7f89-4d56952d.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-write-docs-design-memory-store-md-the-ar-260820-65a4-d3652b73.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-write-docs-design-sessions-surface-md-th-260820-8f4e-49e45f08.md | untracked\ndocs/design/CONTEXT_ENGINE.md | untracked\ndocs/design/MEMORY_STORE.md | untracked\ndocs/design/SESSIONS_SURFACE.md | untracked\nmcp/context-doc.test.ts | untracked\nmcp/sessions-doc.test.ts | untracked\nmcp/store-doc.test.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-budgets-become-a-circuit-breaker-not-a-t-260820-e70a"],"paths":[".agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md",".agent_memory/packets/decision-claude-codes-live-stream-json-protocol-emits-exactly-one-result-event-per-full-a-6260e051.md",".agent_memory/packets/decision-the-concurrency-cap-had-two-independent-compounding-bugs-a-checked-after-the-age-5efeeb6b.md",".agent_memory/packets/reference-aos-actual-architecture-read-from-its-live-daemon-and-sqlite-one-sessions-table--0552ae74.md",".agent_memory/packets/workflow-change-memory-kage-one-manager-session-the-way-ao-does-it-t-260820-eb37-59ec7760.md",".agent_memory/packets/workflow-change-memory-kage-write-docs-design-context-engine-md-the-260820-7f89-4d56952d.md",".agent_memory/packets/workflow-change-memory-kage-write-docs-design-memory-store-md-the-ar-260820-65a4-d3652b73.md",".agent_memory/packets/workflow-change-memory-kage-write-docs-design-sessions-surface-md-th-260820-8f4e-49e45f08.md","docs/design/CONTEXT_ENGINE.md","docs/design/MEMORY_STORE.md","docs/design/SESSIONS_SURFACE.md","mcp/budget-config.test.ts","mcp/cli.ts","mcp/concurrency-queue.test.ts","mcp/context-doc.test.ts","mcp/daemon.ts","mcp/delegation/app-client.ts","mcp/delegation/config.ts","mcp/delegation/contract.ts","mcp/delegation/dispatch.ts","mcp/delegation/recovery.ts","mcp/delegation/supervisor.ts","mcp/delegation/tui/app.ts","mcp/resume-budgets.test.ts","mcp/run-budget.test.ts","mcp/sessions-doc.test.ts","mcp/stall-detector.test.ts","mcp/store-doc.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a","head":"f8d0da7fd5a59f537275744d338b7a5358250fa6","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md",".agent_memory/packets/decision-claude-codes-live-stream-json-protocol-emits-exactly-one-result-event-per-full-a-6260e051.md",".agent_memory/packets/decision-the-concurrency-cap-had-two-independent-compounding-bugs-a-checked-after-the-age-5efeeb6b.md",".agent_memory/packets/reference-aos-actual-architecture-read-from-its-live-daemon-and-sqlite-one-sessions-table--0552ae74.md",".agent_memory/packets/workflow-change-memory-kage-one-manager-session-the-way-ao-does-it-t-260820-eb37-59ec7760.md",".agent_memory/packets/workflow-change-memory-kage-write-docs-design-context-engine-md-the-260820-7f89-4d56952d.md",".agent_memory/packets/workflow-change-memory-kage-write-docs-design-memory-store-md-the-ar-260820-65a4-d3652b73.md",".agent_memory/packets/workflow-change-memory-kage-write-docs-design-sessions-surface-md-th-260820-8f4e-49e45f08.md","docs/design/CONTEXT_ENGINE.md","docs/design/MEMORY_STORE.md","docs/design/SESSIONS_SURFACE.md","mcp/budget-config.test.ts","mcp/cli.ts","mcp/concurrency-queue.test.ts","mcp/context-doc.test.ts","mcp/daemon.ts","mcp/delegation/app-client.ts","mcp/delegation/config.ts","mcp/delegation/contract.ts","mcp/delegation/dispatch.ts","mcp/delegation/recovery.ts","mcp/delegation/supervisor.ts","mcp/delegation/tui/app.ts","mcp/resume-budgets.test.ts","mcp/run-budget.test.ts","mcp/sessions-doc.test.ts","mcp/stall-detector.test.ts","mcp/store-doc.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-budgets-become-a-circuit-breaker-not-a-t-260820-e70a.json"}],"context":{"fact":"Current branch kage/budgets-become-a-circuit-breaker-not-a-t-260820-e70a changes 28 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T06:05:01.053Z","ttl_days":180,"path_fingerprints":[{"path":"docs/design/CONTEXT_ENGINE.md","sha256":"4dd0743cd7c6707aca4b0d0f6ef3e11845b0d743514694f66d7a9e495afce713","size":18628},{"path":"docs/design/MEMORY_STORE.md","sha256":"bebce9a576e9f5c7fb732030461456a3e2bb5a6441550869975eff70d55222d2","size":23414},{"path":"docs/design/SESSIONS_SURFACE.md","sha256":"9efb0ca891cb541f760db2bd5bebbee5307175ce1dd5f4af646d6caa5e6d505b","size":24402},{"path":"mcp/budget-config.test.ts","sha256":"fe420e49cf853c51a7a04c602e110955edb16d4349a7996dc68eaf9a2ec9fe30","size":6014},{"path":"mcp/cli.ts","sha256":"9325269c4ce108e26467aa257b6b09ca543804fb5271f654dd402912c50f8e7d","size":144177},{"path":"mcp/context-doc.test.ts","sha256":"3c9a21f3b0e018a36c34f3100578db27bcec0923a656ab43d7b86fcd161af28f","size":9816},{"path":"mcp/daemon.ts","sha256":"61ac60c73e72d8c0ddff2b12737b852d3cbc222d2c63222bf82bdfc44e21beb5","size":52757},{"path":"mcp/delegation/app-client.ts","sha256":"342c0e22ddee8761ac321012e3e077dd5981f19bb430e03b3c994bc6bfb3e461","size":146213},{"path":"mcp/delegation/config.ts","sha256":"d24e1b49340ef4904d7294cd10979c851dae81a4599ee1d3ed1f51d85f10af58","size":7564},{"path":"mcp/delegation/contract.ts","sha256":"14a38450edae2f6105c45c6823a47de4e4cd2a47c6be05d2f812411f6663233a","size":41611},{"path":"mcp/delegation/dispatch.ts","sha256":"19d8a5af237bfd8068e82a11d323decff8e12ef370dbfeb36856fdc7a902fa09","size":22065},{"path":"mcp/delegation/recovery.ts","sha256":"c465e0f36bd6b31be295740f8a08d652b75dfa1eb4cb198069fb5b2e79c45446","size":12244},{"path":"mcp/delegation/supervisor.ts","sha256":"f938cfde6039821dd60f67d1e403f0362b9b8338f1a561bcdc03effadc6fe304","size":29178},{"path":"mcp/delegation/tui/app.ts","sha256":"4492d2d8591ef76c243b24de368d62e75278b998e3c2f73889aa3c21c5e1cf92","size":22733},{"path":"mcp/resume-budgets.test.ts","sha256":"4e42b44b01718e2bcb47d5fb70e6248c7b13810b071a4ad9d7f6383a739402f7","size":18417},{"path":"mcp/run-budget.test.ts","sha256":"9c3ff7f7b11e3728c9ef3057e6e6e186e5d7766266ef8e144cdd7476650e9e7b","size":8127},{"path":"mcp/sessions-doc.test.ts","sha256":"aaad6e3f30fbc65f3949b76af4a775c74c51f19f6c956d309f9b06a31f4799aa","size":12033},{"path":"mcp/store-doc.test.ts","sha256":"fa8b30419a401014225d74300687364917bd22322e67064f5664da7373b7e0db","size":12057}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-claude-codes-live-stream-json-protocol-emits-exactly-one-result-event-per-full-a-6260e051.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-concurrency-cap-had-two-independent-compounding-bugs-a-checked-after-the-age-5efeeb6b.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/reference-aos-actual-architecture-read-from-its-live-daemon-and-sqlite-one-sessions-table--0552ae74.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-one-manager-session-the-way-ao-does-it-t-260820-eb37-59ec7760.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-write-docs-design-context-engine-md-the-260820-7f89-4d56952d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-write-docs-design-memory-store-md-the-ar-260820-65a4-d3652b73.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-write-docs-design-sessions-surface-md-th-260820-8f4e-49e45f08.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/CONTEXT_ENGINE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/MEMORY_STORE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/SESSIONS_SURFACE.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/budget-config.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/concurrency-queue.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/context-doc.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/daemon.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/config.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/contract.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/dispatch.ts","evidence":"git_diff"}],"quality":{"score":72,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md, .agent_memory/packets/decision-claude-codes-live-stream-json-protocol-emits-exactly-one-result-event-per-full-a-6260e051.md, .agent_memory/packets/decision-the-concurrency-cap-had-two-independent-compounding-bugs-a-checked-after-the-age-5efeeb6b.md, mcp/concurrency-queue.test.ts"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: .agent_memory/packets/decision-api-tss-createrun-call-never-passed-a-budgets-option-at-all-independent-of-daemo-e8f3b4de.md, .agent_memory/packets/decision-claude-codes-live-stream-json-protocol-emits-exactly-one-result-event-per-full-a-6260e051.md, .agent_memory/packets/decision-the-concurrency-cap-had-two-independent-compounding-bugs-a-checked-after-the-age-5efeeb6b.md, mcp/concurrency-queue.test.ts"],"estimated_tokens_saved":1076,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-20T06:05:01.053Z","updated_at":"2026-08-20T06:05:01.053Z"}
```

