---
type: "Workflow"
title: "Change memory: kage/three-release-blocking-packaging-defects-260818-2d1f"
description: "Repo-local context for 23 changed repo paths on kage/three-release-blocking-packaging-defects-260818-2d1f."
resource: "mcp/delegation/room-pty.ts"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-three-release-blocking-packaging-defects-260818-2d1f"]
timestamp: "2026-08-20T12:42:31.380Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-three-release-blocking-packaging-defects-260818-2d1f"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation/room-pty.ts", "mcp/delegation/run-pty.ts", "mcp/package.json", "mcp/release.test.ts", "shell/package.json"]
---

# Change memory: kage/three-release-blocking-packaging-defects-260818-2d1f

> Repo-local context for 23 changed repo paths on kage/three-release-blocking-packaging-defects-260818-2d1f.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-every-verifying-run-falsely-displays-as-dropped-livestate-checks-the-agent-pid-b-94df3da3.md
- .agent_memory/packets/bug_fix-in-this-delegated-agent-sandbox-bash-is-restricted-to-a-narrow-allowlist-npm-run-b7338847.md
- .agent_memory/packets/bug_fix-mcp-release-test-tss-version-lockstep-test-reads-every-manifest-path-relative-to-caff67dd.md
- .agent_memory/packets/bug_fix-the-orchestrator-wake-loop-stayed-dead-because-goal-attachment-happened-after-th-461c7bd0.md
- .agent_memory/packets/code_explanation-the-goal-wake-loop-is-proven-end-to-end-the-drain-is-scoped-to-the-threads-activ-b5664974.md
- .agent_memory/packets/gotcha-the-citation-extractor-is-so-eager-it-fails-the-run-that-describes-it-and-briefs-e1a8bbe2.md
- .agent_memory/packets/gotcha-the-goals-orchestrator-plans-and-displays-but-never-executes-no-state-advance-no-7ea8c2a4.md
- .agent_memory/packets/negative_result-rejected-approach-attach-runs-to-their-goal-at-creation-not-after-they-finish-th-e2ee2d06.md
- .agent_memory/packets/negative_result-rejected-approach-in-mcp-delegation-verify-ts-the-citedpaths-function-reads-any--9de952a7.md
- .agent_memory/packets/negative_result-rejected-approach-mcp-delegation-brief-ts-renderbrief-must-tell-hired-agents-pla-61d0738d.md
- .agent_memory/packets/workflow-change-memory-kage-add-pre-claim-static-checks-to-the-super-260818-fb31-c38c2ece.md
- .agent_memory/packets/workflow-change-memory-kage-in-mcp-delegation-brief-ts-renderbrief-m-260818-4793-3fcc489a.md
- .agent_memory/packets/workflow-change-memory-kage-mcp-delegation-brief-ts-renderbrief-must-260818-6762-4b7d0b3d.md
- .agent_memory/packets/workflow-change-memory-kage-mcp-delegation-verify-ts-citedpaths-trea-260818-2d31-7a86b538.md
- .agent_memory/packets/workflow-change-memory-kage-the-app-uses-a-run-s-raw-intent-as-its-d-260818-8f7f-8a751a37.md
- .agent_memory/packets/workflow-change-memory-kage-three-release-blocking-packaging-defects-260818-2d1f-cfdee542.md
- .agent_memory/packets/workflow-change-memory-kage-two-ordering-liveness-bugs-in-the-delega-260818-d669-0c0fe31b.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/delegation/room-pty.ts
- mcp/delegation/run-pty.ts
- mcp/package.json
- mcp/release.test.ts
- shell/package.json

Diff summary:
```text
...icted-to-a-narrow-allowlist-npm-run-b7338847.md | 65 ----------------------
 ...ads-every-manifest-path-relative-to-caff67dd.md | 65 ----------------------
 ...workflow-change-memory-release-prep-a72d4251.md | 39 +++++++++----
 mcp/delegation/room-pty.ts                         |  9 +--
 mcp/delegation/run-pty.ts                          |  9 +--
 mcp/package.json                                   |  4 +-
 mcp/release.test.ts                                | 43 +-------------
 shell/package.json                                 |  2 +-
 8 files changed, 34 insertions(+), 202 deletions(-)
.agent_memory/packets/bug_fix-every-verifying-run-falsely-displays-as-dropped-livestate-checks-the-agent-pid-b-94df3da3.md | untracked
.agent_memory/packets/bug_fix-the-orchestrator-wake-loop-stayed-dead-because-goal-attachment-happened-after-th-461c7bd0.md | untracked
.agent_memory/packets/code_explanation-the-goal-wake-loop-is-proven-end-to-end-the-drain-is-scoped-to-the-threads-activ-b5664974.md | untracked
.agent_memory/packets/gotcha-the-citation-extractor-is-so-eager-it-fails-the-run-that-describes-it-and-briefs-e1a8bbe2.md | untracked
.agent_memory/packets/gotcha-the-goals-orchestrator-plans-and-displays-but-never-executes-no-state-advance-no-7ea8c2a4.md | untracked
.agent_memory/packets/negative_result-rejected-approach-attach-runs-to-their-goal-at-creation-not-after-they-finish-th-e2ee2d06.md | untracked
.agent_memory/packets/negative_result-rejected-approach-in-mcp-delegation-verify-ts-the-citedpaths-function-reads-any--9de952a7.md | untracked
.agent_memory/packets/negative_result-rejected-approach-mcp-delegation-brief-ts-renderbrief-must-tell-hired-agents-pla-61d0738d.md | untracked
.agent_memory/packets/workflow-change-memory-kage-add-pre-claim-static-checks-to-the-super-260818-fb31-c38c2ece.md | untracked
.agent_memory/packets/workflow-change-memory-kage-in-mcp-delegation-brief-ts-renderbrief-m-260818-4793-3fcc489a.md | untracked
.agent_memory/packets/workflow-change-memory-kage-mcp-delegation-brief-ts-renderbrief-must-260818-6762-4b7d0b3d.md | untracked
.agent_memory/packets/workflow-change-memory-kage-mcp-delegation-verify-ts-citedpaths-trea-260818-2d31-7a86b538.md | untracked
.agent_memory/packets/workflow-change-memory-kage-the-app-uses-a-run-s-raw-intent-as-its-d-260818-8f7f-8a751a37.md | untracked
.agent_memory/packets/workflow-change-memory-kage-three-release-blocking-packaging-defects-260818-2d1f-cfdee542.md | untracked
.agent_memory/packets/workflow-change-memory-kage-two-ordering-liveness-bugs-in-the-delega-260818-d669-0c0fe31b.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-three-release-blocking-packaging-defects-260818-2d1f","title":"Change memory: kage/three-release-blocking-packaging-defects-260818-2d1f","summary":"Repo-local context for 23 changed repo paths on kage/three-release-blocking-packaging-defects-260818-2d1f.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-every-verifying-run-falsely-displays-as-dropped-livestate-checks-the-agent-pid-b-94df3da3.md\n- .agent_memory/packets/bug_fix-in-this-delegated-agent-sandbox-bash-is-restricted-to-a-narrow-allowlist-npm-run-b7338847.md\n- .agent_memory/packets/bug_fix-mcp-release-test-tss-version-lockstep-test-reads-every-manifest-path-relative-to-caff67dd.md\n- .agent_memory/packets/bug_fix-the-orchestrator-wake-loop-stayed-dead-because-goal-attachment-happened-after-th-461c7bd0.md\n- .agent_memory/packets/code_explanation-the-goal-wake-loop-is-proven-end-to-end-the-drain-is-scoped-to-the-threads-activ-b5664974.md\n- .agent_memory/packets/gotcha-the-citation-extractor-is-so-eager-it-fails-the-run-that-describes-it-and-briefs-e1a8bbe2.md\n- .agent_memory/packets/gotcha-the-goals-orchestrator-plans-and-displays-but-never-executes-no-state-advance-no-7ea8c2a4.md\n- .agent_memory/packets/negative_result-rejected-approach-attach-runs-to-their-goal-at-creation-not-after-they-finish-th-e2ee2d06.md\n- .agent_memory/packets/negative_result-rejected-approach-in-mcp-delegation-verify-ts-the-citedpaths-function-reads-any--9de952a7.md\n- .agent_memory/packets/negative_result-rejected-approach-mcp-delegation-brief-ts-renderbrief-must-tell-hired-agents-pla-61d0738d.md\n- .agent_memory/packets/workflow-change-memory-kage-add-pre-claim-static-checks-to-the-super-260818-fb31-c38c2ece.md\n- .agent_memory/packets/workflow-change-memory-kage-in-mcp-delegation-brief-ts-renderbrief-m-260818-4793-3fcc489a.md\n- .agent_memory/packets/workflow-change-memory-kage-mcp-delegation-brief-ts-renderbrief-must-260818-6762-4b7d0b3d.md\n- .agent_memory/packets/workflow-change-memory-kage-mcp-delegation-verify-ts-citedpaths-trea-260818-2d31-7a86b538.md\n- .agent_memory/packets/workflow-change-memory-kage-the-app-uses-a-run-s-raw-intent-as-its-d-260818-8f7f-8a751a37.md\n- .agent_memory/packets/workflow-change-memory-kage-three-release-blocking-packaging-defects-260818-2d1f-cfdee542.md\n- .agent_memory/packets/workflow-change-memory-kage-two-ordering-liveness-bugs-in-the-delega-260818-d669-0c0fe31b.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/delegation/room-pty.ts\n- mcp/delegation/run-pty.ts\n- mcp/package.json\n- mcp/release.test.ts\n- shell/package.json\n\nDiff summary:\n```text\n...icted-to-a-narrow-allowlist-npm-run-b7338847.md | 65 ----------------------\n ...ads-every-manifest-path-relative-to-caff67dd.md | 65 ----------------------\n ...workflow-change-memory-release-prep-a72d4251.md | 39 +++++++++----\n mcp/delegation/room-pty.ts                         |  9 +--\n mcp/delegation/run-pty.ts                          |  9 +--\n mcp/package.json                                   |  4 +-\n mcp/release.test.ts                                | 43 +-------------\n shell/package.json                                 |  2 +-\n 8 files changed, 34 insertions(+), 202 deletions(-)\n.agent_memory/packets/bug_fix-every-verifying-run-falsely-displays-as-dropped-livestate-checks-the-agent-pid-b-94df3da3.md | untracked\n.agent_memory/packets/bug_fix-the-orchestrator-wake-loop-stayed-dead-because-goal-attachment-happened-after-th-461c7bd0.md | untracked\n.agent_memory/packets/code_explanation-the-goal-wake-loop-is-proven-end-to-end-the-drain-is-scoped-to-the-threads-activ-b5664974.md | untracked\n.agent_memory/packets/gotcha-the-citation-extractor-is-so-eager-it-fails-the-run-that-describes-it-and-briefs-e1a8bbe2.md | untracked\n.agent_memory/packets/gotcha-the-goals-orchestrator-plans-and-displays-but-never-executes-no-state-advance-no-7ea8c2a4.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-attach-runs-to-their-goal-at-creation-not-after-they-finish-th-e2ee2d06.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-in-mcp-delegation-verify-ts-the-citedpaths-function-reads-any--9de952a7.md | untracked\n.agent_memory/packets/negative_result-rejected-approach-mcp-delegation-brief-ts-renderbrief-must-tell-hired-agents-pla-61d0738d.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-add-pre-claim-static-checks-to-the-super-260818-fb31-c38c2ece.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-in-mcp-delegation-brief-ts-renderbrief-m-260818-4793-3fcc489a.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-mcp-delegation-brief-ts-renderbrief-must-260818-6762-4b7d0b3d.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-mcp-delegation-verify-ts-citedpaths-trea-260818-2d31-7a86b538.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-the-app-uses-a-run-s-raw-intent-as-its-d-260818-8f7f-8a751a37.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-three-release-blocking-packaging-defects-260818-2d1f-cfdee542.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-two-ordering-liveness-bugs-in-the-delega-260818-d669-0c0fe31b.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-three-release-blocking-packaging-defects-260818-2d1f"],"paths":["mcp/delegation/room-pty.ts","mcp/delegation/run-pty.ts","mcp/package.json","mcp/release.test.ts","shell/package.json"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/three-release-blocking-packaging-defects-260818-2d1f","head":"20c7a404f6f53692d5d214521ffea80351764c27","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/bug_fix-every-verifying-run-falsely-displays-as-dropped-livestate-checks-the-agent-pid-b-94df3da3.md",".agent_memory/packets/bug_fix-in-this-delegated-agent-sandbox-bash-is-restricted-to-a-narrow-allowlist-npm-run-b7338847.md",".agent_memory/packets/bug_fix-mcp-release-test-tss-version-lockstep-test-reads-every-manifest-path-relative-to-caff67dd.md",".agent_memory/packets/bug_fix-the-orchestrator-wake-loop-stayed-dead-because-goal-attachment-happened-after-th-461c7bd0.md",".agent_memory/packets/code_explanation-the-goal-wake-loop-is-proven-end-to-end-the-drain-is-scoped-to-the-threads-activ-b5664974.md",".agent_memory/packets/gotcha-the-citation-extractor-is-so-eager-it-fails-the-run-that-describes-it-and-briefs-e1a8bbe2.md",".agent_memory/packets/gotcha-the-goals-orchestrator-plans-and-displays-but-never-executes-no-state-advance-no-7ea8c2a4.md",".agent_memory/packets/negative_result-rejected-approach-attach-runs-to-their-goal-at-creation-not-after-they-finish-th-e2ee2d06.md",".agent_memory/packets/negative_result-rejected-approach-in-mcp-delegation-verify-ts-the-citedpaths-function-reads-any--9de952a7.md",".agent_memory/packets/negative_result-rejected-approach-mcp-delegation-brief-ts-renderbrief-must-tell-hired-agents-pla-61d0738d.md",".agent_memory/packets/workflow-change-memory-kage-add-pre-claim-static-checks-to-the-super-260818-fb31-c38c2ece.md",".agent_memory/packets/workflow-change-memory-kage-in-mcp-delegation-brief-ts-renderbrief-m-260818-4793-3fcc489a.md",".agent_memory/packets/workflow-change-memory-kage-mcp-delegation-brief-ts-renderbrief-must-260818-6762-4b7d0b3d.md",".agent_memory/packets/workflow-change-memory-kage-mcp-delegation-verify-ts-citedpaths-trea-260818-2d31-7a86b538.md",".agent_memory/packets/workflow-change-memory-kage-the-app-uses-a-run-s-raw-intent-as-its-d-260818-8f7f-8a751a37.md",".agent_memory/packets/workflow-change-memory-kage-three-release-blocking-packaging-defects-260818-2d1f-cfdee542.md",".agent_memory/packets/workflow-change-memory-kage-two-ordering-liveness-bugs-in-the-delega-260818-d669-0c0fe31b.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/delegation/room-pty.ts","mcp/delegation/run-pty.ts","mcp/package.json","mcp/release.test.ts","shell/package.json"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-three-release-blocking-packaging-defects-260818-2d1f.json"}],"context":{"fact":"Current branch kage/three-release-blocking-packaging-defects-260818-2d1f changes 23 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:31.380Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/delegation/room-pty.ts","sha256":"7d65bb5da050fca50174486611d85126b4d829cbf44f887550c5ffa43b38125a","size":23499},{"path":"mcp/delegation/run-pty.ts","sha256":"eed43bb95cad3ce132469f04275aca7241d767ba03586244bfd4a800119e76cd","size":10620,"symbols":[{"name":"path","kind":"constant","sha256":"92b5d68be48c82018b9bee9fd86167d82b117a12bafc1d3cf33b12a90f647b32"},{"name":"attachment","kind":"constant","sha256":"b5fea5361e980e1b12e62d60b33ee3d5d5a1714f4890bb209bd4e0d99dd91ffa"}]},{"path":"mcp/package.json","sha256":"1f7f8529aec287d4c40afaa6ada0fbb936b7648da507ea9c197428faaddad40a","size":1551},{"path":"mcp/release.test.ts","sha256":"ad9b4791b79aa1ea1c23ac59ba958ef21092e751612fec906b623f4fb0e305f5","size":7459,"symbols":[{"name":"version","kind":"constant","sha256":"a12bfbc04befe7e79381c7e3ebe39353404d6ed411cf094baa87718c77fc34ad"},{"name":"manifest","kind":"constant","sha256":"833a402e356282b8b3d69248bb6f0299507c8a6e4919e28a34127893214428e2"}]},{"path":"shell/package.json","sha256":"d3f394cfec3976e38f5b76a90453b281070a196a4e681da30d53a6064f21c793","size":494}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-every-verifying-run-falsely-displays-as-dropped-livestate-checks-the-agent-pid-b-94df3da3.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-in-this-delegated-agent-sandbox-bash-is-restricted-to-a-narrow-allowlist-npm-run-b7338847.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-mcp-release-test-tss-version-lockstep-test-reads-every-manifest-path-relative-to-caff67dd.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-the-orchestrator-wake-loop-stayed-dead-because-goal-attachment-happened-after-th-461c7bd0.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/code_explanation-the-goal-wake-loop-is-proven-end-to-end-the-drain-is-scoped-to-the-threads-activ-b5664974.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-the-citation-extractor-is-so-eager-it-fails-the-run-that-describes-it-and-briefs-e1a8bbe2.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-the-goals-orchestrator-plans-and-displays-but-never-executes-no-state-advance-no-7ea8c2a4.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-attach-runs-to-their-goal-at-creation-not-after-they-finish-th-e2ee2d06.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-in-mcp-delegation-verify-ts-the-citedpaths-function-reads-any--9de952a7.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/negative_result-rejected-approach-mcp-delegation-brief-ts-renderbrief-must-tell-hired-agents-pla-61d0738d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-add-pre-claim-static-checks-to-the-super-260818-fb31-c38c2ece.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-in-mcp-delegation-brief-ts-renderbrief-m-260818-4793-3fcc489a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-mcp-delegation-brief-ts-renderbrief-must-260818-6762-4b7d0b3d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-mcp-delegation-verify-ts-citedpaths-trea-260818-2d31-7a86b538.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-the-app-uses-a-run-s-raw-intent-as-its-d-260818-8f7f-8a751a37.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-three-release-blocking-packaging-defects-260818-2d1f-cfdee542.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-two-ordering-liveness-bugs-in-the-delega-260818-d669-0c0fe31b.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/room-pty.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/run-pty.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/bug_fix-in-this-delegated-agent-sandbox-bash-is-restricted-to-a-narrow-allowlist-npm-run-b7338847.md, .agent_memory/packets/bug_fix-mcp-release-test-tss-version-lockstep-test-reads-every-manifest-path-relative-to-caff67dd.md, .agent_memory/packets/workflow-change-memory-kage-three-release-blocking-packaging-defects-260818-2d1f-cfdee542.md"],"duplicate_candidates":[],"estimated_tokens_saved":1406,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:31.380Z","stale":true,"stale_reasons":["linked path changed since memory was verified: mcp/delegation/room-pty.ts, shell/package.json"],"suggested_action":"update"},"created_at":"2026-08-18T10:43:27.781Z","updated_at":"2026-08-21T08:54:05.873Z"}
```

