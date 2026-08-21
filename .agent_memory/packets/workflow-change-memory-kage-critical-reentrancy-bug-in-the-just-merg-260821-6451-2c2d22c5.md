---
type: "Workflow"
title: "Change memory: kage/critical-reentrancy-bug-in-the-just-merg-260821-6451"
description: "Repo-local context for 13 changed repo paths on kage/critical-reentrancy-bug-in-the-just-merg-260821-6451."
resource: ".agent_memory/packets/bug_fix-an-ambient-env-var-that-must-be-sanitized-in-a-lock-test-has-to-be-deleted-in-th-2171a381.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-critical-reentrancy-bug-in-the-just-merg-260821-6451"]
timestamp: "2026-08-21T12:13:13.092Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-critical-reentrancy-bug-in-the-just-merg-260821-6451"
x-kage-type: "workflow"
x-kage-status: "deprecated"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "deprecated"
x-kage-paths: [".agent_memory/packets/bug_fix-an-ambient-env-var-that-must-be-sanitized-in-a-lock-test-has-to-be-deleted-in-th-2171a381.md", ".agent_memory/packets/bug_fix-running-npm-test-prefix-mcp-locally-via-bash-with-kage-no-verify-lock-1-set-on-t-0d01f86c.md", ".agent_memory/packets/bug_fix-spawnwithtreekills-spawnoptions-object-previously-had-no-explicit-env-key-at-all-7e1b9fd5.md", ".agent_memory/packets/bug_fix-tests-that-spawn-child-node-processes-to-exercise-verify-lock-ts-must-explicitly-535fc5b3.md", ".agent_memory/packets/bug_fix-when-verifying-this-repos-own-verify-lock-fix-the-operator-must-run-its-own-oute-a3432cf8.md", ".agent_memory/packets/workflow-change-memory-kage-critical-reentrancy-bug-in-the-just-merg-260821-6451-2c2d22c5.md", ".agent_memory/packets/workflow-change-memory-kage-visual-foundation-pass-on-the-app-s-room-260821-be77-2a8c2ff8.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md", "docs/design/BELIEF_MEMORY.md", "mcp/delegation/verify-lock.ts", "mcp/delegation/verify.ts", "mcp/serialize-kernel-verifications-per.test.ts", "mcp/verify-lock-reentrancy.test.ts"]
---

# Change memory: kage/critical-reentrancy-bug-in-the-just-merg-260821-6451

> Repo-local context for 13 changed repo paths on kage/critical-reentrancy-bug-in-the-just-merg-260821-6451.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-an-ambient-env-var-that-must-be-sanitized-in-a-lock-test-has-to-be-deleted-in-th-2171a381.md
- .agent_memory/packets/bug_fix-running-npm-test-prefix-mcp-locally-via-bash-with-kage-no-verify-lock-1-set-on-t-0d01f86c.md
- .agent_memory/packets/bug_fix-spawnwithtreekills-spawnoptions-object-previously-had-no-explicit-env-key-at-all-7e1b9fd5.md
- .agent_memory/packets/bug_fix-tests-that-spawn-child-node-processes-to-exercise-verify-lock-ts-must-explicitly-535fc5b3.md
- .agent_memory/packets/bug_fix-when-verifying-this-repos-own-verify-lock-fix-the-operator-must-run-its-own-oute-a3432cf8.md
- .agent_memory/packets/workflow-change-memory-kage-critical-reentrancy-bug-in-the-just-merg-260821-6451-2c2d22c5.md
- .agent_memory/packets/workflow-change-memory-kage-visual-foundation-pass-on-the-app-s-room-260821-be77-2a8c2ff8.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- docs/design/BELIEF_MEMORY.md
- mcp/delegation/verify-lock.ts
- mcp/delegation/verify.ts
- mcp/serialize-kernel-verifications-per.test.ts
- mcp/verify-lock-reentrancy.test.ts

Diff summary:
```text
...a-lock-test-has-to-be-deleted-in-th-2171a381.md |  42 ----
 ...with-kage-no-verify-lock-1-set-on-t-0d01f86c.md |  42 ----
 ...usly-had-no-explicit-env-key-at-all-7e1b9fd5.md |  42 ----
 ...cise-verify-lock-ts-must-explicitly-535fc5b3.md |  42 ----
 ...-the-operator-must-run-its-own-oute-a3432cf8.md |  42 ----
 ...workflow-change-memory-release-prep-a72d4251.md |  29 +--
 mcp/delegation/verify-lock.ts                      |  31 +--
 mcp/delegation/verify.ts                           |  16 +-
 mcp/serialize-kernel-verifications-per.test.ts     | 260 +++++++--------------
 mcp/verify-lock-reentrancy.test.ts                 |  97 --------
 10 files changed, 102 insertions(+), 541 deletions(-)
.agent_memory/packets/workflow-change-memory-kage-critical-reentrancy-bug-in-the-just-merg-260821-6451-2c2d22c5.md | untracked
.agent_memory/packets/workflow-change-memory-kage-visual-foundation-pass-on-the-app-s-room-260821-be77-2a8c2ff8.md | untracked
docs/design/BELIEF_MEMORY.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-critical-reentrancy-bug-in-the-just-merg-260821-6451","title":"Change memory: kage/critical-reentrancy-bug-in-the-just-merg-260821-6451","summary":"Repo-local context for 13 changed repo paths on kage/critical-reentrancy-bug-in-the-just-merg-260821-6451.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-an-ambient-env-var-that-must-be-sanitized-in-a-lock-test-has-to-be-deleted-in-th-2171a381.md\n- .agent_memory/packets/bug_fix-running-npm-test-prefix-mcp-locally-via-bash-with-kage-no-verify-lock-1-set-on-t-0d01f86c.md\n- .agent_memory/packets/bug_fix-spawnwithtreekills-spawnoptions-object-previously-had-no-explicit-env-key-at-all-7e1b9fd5.md\n- .agent_memory/packets/bug_fix-tests-that-spawn-child-node-processes-to-exercise-verify-lock-ts-must-explicitly-535fc5b3.md\n- .agent_memory/packets/bug_fix-when-verifying-this-repos-own-verify-lock-fix-the-operator-must-run-its-own-oute-a3432cf8.md\n- .agent_memory/packets/workflow-change-memory-kage-critical-reentrancy-bug-in-the-just-merg-260821-6451-2c2d22c5.md\n- .agent_memory/packets/workflow-change-memory-kage-visual-foundation-pass-on-the-app-s-room-260821-be77-2a8c2ff8.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- docs/design/BELIEF_MEMORY.md\n- mcp/delegation/verify-lock.ts\n- mcp/delegation/verify.ts\n- mcp/serialize-kernel-verifications-per.test.ts\n- mcp/verify-lock-reentrancy.test.ts\n\nDiff summary:\n```text\n...a-lock-test-has-to-be-deleted-in-th-2171a381.md |  42 ----\n ...with-kage-no-verify-lock-1-set-on-t-0d01f86c.md |  42 ----\n ...usly-had-no-explicit-env-key-at-all-7e1b9fd5.md |  42 ----\n ...cise-verify-lock-ts-must-explicitly-535fc5b3.md |  42 ----\n ...-the-operator-must-run-its-own-oute-a3432cf8.md |  42 ----\n ...workflow-change-memory-release-prep-a72d4251.md |  29 +--\n mcp/delegation/verify-lock.ts                      |  31 +--\n mcp/delegation/verify.ts                           |  16 +-\n mcp/serialize-kernel-verifications-per.test.ts     | 260 +++++++--------------\n mcp/verify-lock-reentrancy.test.ts                 |  97 --------\n 10 files changed, 102 insertions(+), 541 deletions(-)\n.agent_memory/packets/workflow-change-memory-kage-critical-reentrancy-bug-in-the-just-merg-260821-6451-2c2d22c5.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-visual-foundation-pass-on-the-app-s-room-260821-be77-2a8c2ff8.md | untracked\ndocs/design/BELIEF_MEMORY.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"deprecated","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-critical-reentrancy-bug-in-the-just-merg-260821-6451"],"paths":[".agent_memory/packets/bug_fix-an-ambient-env-var-that-must-be-sanitized-in-a-lock-test-has-to-be-deleted-in-th-2171a381.md",".agent_memory/packets/bug_fix-running-npm-test-prefix-mcp-locally-via-bash-with-kage-no-verify-lock-1-set-on-t-0d01f86c.md",".agent_memory/packets/bug_fix-spawnwithtreekills-spawnoptions-object-previously-had-no-explicit-env-key-at-all-7e1b9fd5.md",".agent_memory/packets/bug_fix-tests-that-spawn-child-node-processes-to-exercise-verify-lock-ts-must-explicitly-535fc5b3.md",".agent_memory/packets/bug_fix-when-verifying-this-repos-own-verify-lock-fix-the-operator-must-run-its-own-oute-a3432cf8.md",".agent_memory/packets/workflow-change-memory-kage-critical-reentrancy-bug-in-the-just-merg-260821-6451-2c2d22c5.md",".agent_memory/packets/workflow-change-memory-kage-visual-foundation-pass-on-the-app-s-room-260821-be77-2a8c2ff8.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","docs/design/BELIEF_MEMORY.md","mcp/delegation/verify-lock.ts","mcp/delegation/verify.ts","mcp/serialize-kernel-verifications-per.test.ts","mcp/verify-lock-reentrancy.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/critical-reentrancy-bug-in-the-just-merg-260821-6451","head":"f3778e43743b5b5a9921813deecc5a9f74adc679","merge_base":"a7d95d97499c28919013a3e13b7216ae89b7f51d","changed_files":[".agent_memory/packets/bug_fix-an-ambient-env-var-that-must-be-sanitized-in-a-lock-test-has-to-be-deleted-in-th-2171a381.md",".agent_memory/packets/bug_fix-running-npm-test-prefix-mcp-locally-via-bash-with-kage-no-verify-lock-1-set-on-t-0d01f86c.md",".agent_memory/packets/bug_fix-spawnwithtreekills-spawnoptions-object-previously-had-no-explicit-env-key-at-all-7e1b9fd5.md",".agent_memory/packets/bug_fix-tests-that-spawn-child-node-processes-to-exercise-verify-lock-ts-must-explicitly-535fc5b3.md",".agent_memory/packets/bug_fix-when-verifying-this-repos-own-verify-lock-fix-the-operator-must-run-its-own-oute-a3432cf8.md",".agent_memory/packets/workflow-change-memory-kage-critical-reentrancy-bug-in-the-just-merg-260821-6451-2c2d22c5.md",".agent_memory/packets/workflow-change-memory-kage-visual-foundation-pass-on-the-app-s-room-260821-be77-2a8c2ff8.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","docs/design/BELIEF_MEMORY.md","mcp/delegation/verify-lock.ts","mcp/delegation/verify.ts","mcp/serialize-kernel-verifications-per.test.ts","mcp/verify-lock-reentrancy.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-critical-reentrancy-bug-in-the-just-merg-260821-6451.json"}],"context":{"fact":"Current branch kage/critical-reentrancy-bug-in-the-just-merg-260821-6451 changes 13 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-21T12:13:13.092Z","ttl_days":180,"path_fingerprints":[{"path":"docs/design/BELIEF_MEMORY.md","sha256":"a1a337b34a51c686bf55fbcdf78a83f9afa9911c56090fbea9ed97ecc1f17c78","size":5681},{"path":"mcp/delegation/verify-lock.ts","sha256":"b0e4ed8f4f09d02d6d0e7c503dd4cc07ea1838303412e90073c83043f9fca9e3","size":5514},{"path":"mcp/delegation/verify.ts","sha256":"01374146c61d26b74563e75cf6640f288d0a6b777642582d6a3c06fba76e00d0","size":28034},{"path":"mcp/serialize-kernel-verifications-per.test.ts","sha256":"2312901b427ef98c75230a723a61efeb0e42607934739403c32ca004dff9474d","size":10273}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-an-ambient-env-var-that-must-be-sanitized-in-a-lock-test-has-to-be-deleted-in-th-2171a381.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-running-npm-test-prefix-mcp-locally-via-bash-with-kage-no-verify-lock-1-set-on-t-0d01f86c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-spawnwithtreekills-spawnoptions-object-previously-had-no-explicit-env-key-at-all-7e1b9fd5.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-tests-that-spawn-child-node-processes-to-exercise-verify-lock-ts-must-explicitly-535fc5b3.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-when-verifying-this-repos-own-verify-lock-fix-the-operator-must-run-its-own-oute-a3432cf8.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-critical-reentrancy-bug-in-the-just-merg-260821-6451-2c2d22c5.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-visual-foundation-pass-on-the-app-s-room-260821-be77-2a8c2ff8.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:docs/design/BELIEF_MEMORY.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/verify-lock.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/verify.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/serialize-kernel-verifications-per.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/verify-lock-reentrancy.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/bug_fix-an-ambient-env-var-that-must-be-sanitized-in-a-lock-test-has-to-be-deleted-in-th-2171a381.md, .agent_memory/packets/bug_fix-running-npm-test-prefix-mcp-locally-via-bash-with-kage-no-verify-lock-1-set-on-t-0d01f86c.md, .agent_memory/packets/bug_fix-spawnwithtreekills-spawnoptions-object-previously-had-no-explicit-env-key-at-all-7e1b9fd5.md, .agent_memory/packets/bug_fix-tests-that-spawn-child-node-processes-to-exercise-verify-lock-ts-must-explicitly-535fc5b3.md"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: .agent_memory/packets/bug_fix-an-ambient-env-var-that-must-be-sanitized-in-a-lock-test-has-to-be-deleted-in-th-2171a381.md, .agent_memory/packets/bug_fix-running-npm-test-prefix-mcp-locally-via-bash-with-kage-no-verify-lock-1-set-on-t-0d01f86c.md, .agent_memory/packets/bug_fix-spawnwithtreekills-spawnoptions-object-previously-had-no-explicit-env-key-at-all-7e1b9fd5.md, .agent_memory/packets/bug_fix-tests-that-spawn-child-node-processes-to-exercise-verify-lock-ts-must-explicitly-535fc5b3.md"],"estimated_tokens_saved":710,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-21T12:13:13.092Z","updated_at":"2026-08-21T14:51:19.973Z"}
```

