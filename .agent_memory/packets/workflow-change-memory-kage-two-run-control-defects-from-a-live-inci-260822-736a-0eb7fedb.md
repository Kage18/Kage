---
type: "Workflow"
title: "Change memory: kage/two-run-control-defects-from-a-live-inci-260822-736a"
description: "Repo-local context for 17 changed repo paths on kage/two-run-control-defects-from-a-live-inci-260822-736a."
resource: ".agent_memory/packets/bug_fix-for-a-non-live-adapter-e-g-stub-without-options-live-the-supervisors-control-soc-853a4ca5.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-two-run-control-defects-from-a-live-inci-260822-736a"]
timestamp: "2026-08-22T07:35:43.894Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-two-run-control-defects-from-a-live-inci-260822-736a"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/bug_fix-for-a-non-live-adapter-e-g-stub-without-options-live-the-supervisors-control-soc-853a4ca5.md", ".agent_memory/packets/bug_fix-kage-stop-mcp-index-ts-previously-called-transitionrun-stopped-manager-d-0cdb3125.md", ".agent_memory/packets/bug_fix-the-runs-supervisor-is-spawned-with-detached-true-dispatch-tss-dispatchdetached-640b98e8.md", ".agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md", ".agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md", ".agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md", ".agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md", ".agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md", "mcp/cli.ts", "mcp/delegation-api.test.ts", "mcp/delegation/api.ts", "mcp/delegation/control.ts", "mcp/delegation/supervisor.ts", "mcp/delegation/verify.ts", "mcp/index.ts", "mcp/two-run-control-defects.test.ts"]
---

# Change memory: kage/two-run-control-defects-from-a-live-inci-260822-736a

> Repo-local context for 17 changed repo paths on kage/two-run-control-defects-from-a-live-inci-260822-736a.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-for-a-non-live-adapter-e-g-stub-without-options-live-the-supervisors-control-soc-853a4ca5.md
- .agent_memory/packets/bug_fix-kage-stop-mcp-index-ts-previously-called-transitionrun-stopped-manager-d-0cdb3125.md
- .agent_memory/packets/bug_fix-the-runs-supervisor-is-spawned-with-detached-true-dispatch-tss-dispatchdetached-640b98e8.md
- .agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md
- .agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md
- .agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md
- .agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md
- .agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/cli.ts
- mcp/delegation-api.test.ts
- mcp/delegation/api.ts
- mcp/delegation/control.ts
- mcp/delegation/supervisor.ts
- mcp/delegation/verify.ts
- mcp/index.ts
- mcp/two-run-control-defects.test.ts

Diff summary:
```text
...ns-live-the-supervisors-control-soc-853a4ca5.md |  42 -----
 ...led-transitionrun-stopped-manager-d-0cdb3125.md |  42 -----
 ...-true-dispatch-tss-dispatchdetached-640b98e8.md |  42 -----
 ...workflow-change-memory-release-prep-a72d4251.md |  26 +--
 mcp/cli.ts                                         |   6 +-
 mcp/delegation-api.test.ts                         |   2 +-
 mcp/delegation/api.ts                              |  33 ++--
 mcp/delegation/control.ts                          | 115 +------------
 mcp/delegation/supervisor.ts                       |  19 +--
 mcp/delegation/verify.ts                           |   7 +-
 mcp/index.ts                                       |  17 +-
 mcp/two-run-control-defects.test.ts                | 177 ---------------------
 12 files changed, 48 insertions(+), 480 deletions(-)
.agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md | untracked
.agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md | untracked
.agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md | untracked
.agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md | untracked
.agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-two-run-control-defects-from-a-live-inci-260822-736a","title":"Change memory: kage/two-run-control-defects-from-a-live-inci-260822-736a","summary":"Repo-local context for 17 changed repo paths on kage/two-run-control-defects-from-a-live-inci-260822-736a.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-for-a-non-live-adapter-e-g-stub-without-options-live-the-supervisors-control-soc-853a4ca5.md\n- .agent_memory/packets/bug_fix-kage-stop-mcp-index-ts-previously-called-transitionrun-stopped-manager-d-0cdb3125.md\n- .agent_memory/packets/bug_fix-the-runs-supervisor-is-spawned-with-detached-true-dispatch-tss-dispatchdetached-640b98e8.md\n- .agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md\n- .agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md\n- .agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md\n- .agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md\n- .agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/cli.ts\n- mcp/delegation-api.test.ts\n- mcp/delegation/api.ts\n- mcp/delegation/control.ts\n- mcp/delegation/supervisor.ts\n- mcp/delegation/verify.ts\n- mcp/index.ts\n- mcp/two-run-control-defects.test.ts\n\nDiff summary:\n```text\n...ns-live-the-supervisors-control-soc-853a4ca5.md |  42 -----\n ...led-transitionrun-stopped-manager-d-0cdb3125.md |  42 -----\n ...-true-dispatch-tss-dispatchdetached-640b98e8.md |  42 -----\n ...workflow-change-memory-release-prep-a72d4251.md |  26 +--\n mcp/cli.ts                                         |   6 +-\n mcp/delegation-api.test.ts                         |   2 +-\n mcp/delegation/api.ts                              |  33 ++--\n mcp/delegation/control.ts                          | 115 +------------\n mcp/delegation/supervisor.ts                       |  19 +--\n mcp/delegation/verify.ts                           |   7 +-\n mcp/index.ts                                       |  17 +-\n mcp/two-run-control-defects.test.ts                | 177 ---------------------\n 12 files changed, 48 insertions(+), 480 deletions(-)\n.agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-two-run-control-defects-from-a-live-inci-260822-736a"],"paths":[".agent_memory/packets/bug_fix-for-a-non-live-adapter-e-g-stub-without-options-live-the-supervisors-control-soc-853a4ca5.md",".agent_memory/packets/bug_fix-kage-stop-mcp-index-ts-previously-called-transitionrun-stopped-manager-d-0cdb3125.md",".agent_memory/packets/bug_fix-the-runs-supervisor-is-spawned-with-detached-true-dispatch-tss-dispatchdetached-640b98e8.md",".agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md",".agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md",".agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md",".agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md",".agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/cli.ts","mcp/delegation-api.test.ts","mcp/delegation/api.ts","mcp/delegation/control.ts","mcp/delegation/supervisor.ts","mcp/delegation/verify.ts","mcp/index.ts","mcp/two-run-control-defects.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/two-run-control-defects-from-a-live-inci-260822-736a","head":"31765e60e222eaa562ad93dc67b3600febca4c08","merge_base":"2eb8ffe149fd9c7a5c80576e731777642a256c8b","changed_files":[".agent_memory/packets/bug_fix-for-a-non-live-adapter-e-g-stub-without-options-live-the-supervisors-control-soc-853a4ca5.md",".agent_memory/packets/bug_fix-kage-stop-mcp-index-ts-previously-called-transitionrun-stopped-manager-d-0cdb3125.md",".agent_memory/packets/bug_fix-the-runs-supervisor-is-spawned-with-detached-true-dispatch-tss-dispatchdetached-640b98e8.md",".agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md",".agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md",".agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md",".agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md",".agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/cli.ts","mcp/delegation-api.test.ts","mcp/delegation/api.ts","mcp/delegation/control.ts","mcp/delegation/supervisor.ts","mcp/delegation/verify.ts","mcp/index.ts","mcp/two-run-control-defects.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-two-run-control-defects-from-a-live-inci-260822-736a.json"}],"context":{"fact":"Current branch kage/two-run-control-defects-from-a-live-inci-260822-736a changes 17 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-22T07:35:43.894Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/cli.ts","sha256":"2df459dcae2cb0e1fa70df05f5082cd713f3c6462f047a706eb065149a4bf3ea","size":152379},{"path":"mcp/delegation-api.test.ts","sha256":"67def82ec67216b354909d2bb7f7273aef164b04984b5dee8119706a6c9939af","size":75952},{"path":"mcp/delegation/api.ts","sha256":"aea597272bd0b1a96abe7a95040bda6008c0d053b5478f6083fd20ae84d2e29b","size":94409},{"path":"mcp/delegation/control.ts","sha256":"56e8319039f96278fc599d4d064e2f110128915ce1892169c19ce8f6e31878a5","size":2604},{"path":"mcp/delegation/supervisor.ts","sha256":"d8ed31b23d0078e3e8e44e233ec819b4b203ed5e0b1a47f1a4858c834f5bfd4f","size":43021},{"path":"mcp/delegation/verify.ts","sha256":"e2b994d7b4bafa84ee67db23246dda325a6fa01ea42772a7776125ab61864efd","size":29052},{"path":"mcp/index.ts","sha256":"262ac5e51cc55e6966f6cf424babc01152f0b779c21984036d58ffdcc2b71311","size":114489}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-for-a-non-live-adapter-e-g-stub-without-options-live-the-supervisors-control-soc-853a4ca5.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-kage-stop-mcp-index-ts-previously-called-transitionrun-stopped-manager-d-0cdb3125.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-the-runs-supervisor-is-spawned-with-detached-true-dispatch-tss-dispatchdetached-640b98e8.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation-api.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/control.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/supervisor.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/verify.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/index.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/two-run-control-defects.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/bug_fix-for-a-non-live-adapter-e-g-stub-without-options-live-the-supervisors-control-soc-853a4ca5.md, .agent_memory/packets/bug_fix-kage-stop-mcp-index-ts-previously-called-transitionrun-stopped-manager-d-0cdb3125.md, .agent_memory/packets/bug_fix-the-runs-supervisor-is-spawned-with-detached-true-dispatch-tss-dispatchdetached-640b98e8.md, mcp/two-run-control-defects.test.ts"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: .agent_memory/packets/bug_fix-for-a-non-live-adapter-e-g-stub-without-options-live-the-supervisors-control-soc-853a4ca5.md, .agent_memory/packets/bug_fix-kage-stop-mcp-index-ts-previously-called-transitionrun-stopped-manager-d-0cdb3125.md, .agent_memory/packets/bug_fix-the-runs-supervisor-is-spawned-with-detached-true-dispatch-tss-dispatchdetached-640b98e8.md, mcp/two-run-control-defects.test.ts"],"estimated_tokens_saved":856,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-22T07:35:43.894Z","updated_at":"2026-08-22T07:35:43.894Z"}
```

