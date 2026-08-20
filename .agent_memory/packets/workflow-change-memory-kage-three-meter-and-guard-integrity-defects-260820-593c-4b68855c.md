---
type: "Workflow"
title: "Change memory: kage/three-meter-and-guard-integrity-defects-260820-593c"
description: "Repo-local context for 11 changed repo paths on kage/three-meter-and-guard-integrity-defects-260820-593c."
resource: "mcp/delegation/contract.ts"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-three-meter-and-guard-integrity-defects-260820-593c"]
timestamp: "2026-08-20T12:42:03.805Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation/contract.ts", "mcp/delegation/supervisor.ts", "mcp/delegation/verify.ts", "mcp/delegation/worktree-guard.ts", "mcp/meter-integrity.test.ts", "mcp/worktree-guard.test.ts"]
---

# Change memory: kage/three-meter-and-guard-integrity-defects-260820-593c

> Repo-local context for 11 changed repo paths on kage/three-meter-and-guard-integrity-defects-260820-593c.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md
- .agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md
- .agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md
- .agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md
- .agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md
- mcp/delegation/contract.ts
- mcp/delegation/supervisor.ts
- mcp/delegation/verify.ts
- mcp/delegation/worktree-guard.ts
- mcp/meter-integrity.test.ts
- mcp/worktree-guard.test.ts

Diff summary:
```text
...index-even-when-nested-inside-the-m-480d8309.md |  58 ------
 ...e-from-a-self-caused-one-a-runs-own-e798d79d.md |  56 ------
 ...res-that-ref-straight-against-the-w-c38319df.md |  58 ------
 ...hich-supervisor-ts-claim-time-dispa-cd7799cf.md |  58 ------
 mcp/delegation/contract.ts                         |  33 +---
 mcp/delegation/supervisor.ts                       |   9 +-
 mcp/delegation/verify.ts                           |  56 +-----
 mcp/delegation/worktree-guard.ts                   | 111 +----------
 mcp/meter-integrity.test.ts                        | 208 ---------------------
 mcp/worktree-guard.test.ts                         |  72 ++-----
 10 files changed, 25 insertions(+), 694 deletions(-)
.agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c","title":"Change memory: kage/three-meter-and-guard-integrity-defects-260820-593c","summary":"Repo-local context for 11 changed repo paths on kage/three-meter-and-guard-integrity-defects-260820-593c.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md\n- .agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md\n- .agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md\n- .agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md\n- .agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md\n- mcp/delegation/contract.ts\n- mcp/delegation/supervisor.ts\n- mcp/delegation/verify.ts\n- mcp/delegation/worktree-guard.ts\n- mcp/meter-integrity.test.ts\n- mcp/worktree-guard.test.ts\n\nDiff summary:\n```text\n...index-even-when-nested-inside-the-m-480d8309.md |  58 ------\n ...e-from-a-self-caused-one-a-runs-own-e798d79d.md |  56 ------\n ...res-that-ref-straight-against-the-w-c38319df.md |  58 ------\n ...hich-supervisor-ts-claim-time-dispa-cd7799cf.md |  58 ------\n mcp/delegation/contract.ts                         |  33 +---\n mcp/delegation/supervisor.ts                       |   9 +-\n mcp/delegation/verify.ts                           |  56 +-----\n mcp/delegation/worktree-guard.ts                   | 111 +----------\n mcp/meter-integrity.test.ts                        | 208 ---------------------\n mcp/worktree-guard.test.ts                         |  72 ++-----\n 10 files changed, 25 insertions(+), 694 deletions(-)\n.agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-three-meter-and-guard-integrity-defects-260820-593c"],"paths":["mcp/delegation/contract.ts","mcp/delegation/supervisor.ts","mcp/delegation/verify.ts","mcp/delegation/worktree-guard.ts","mcp/meter-integrity.test.ts","mcp/worktree-guard.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/three-meter-and-guard-integrity-defects-260820-593c","head":"73ab0c0c1f35d9cf17f48bdcb194605879d136fd","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md",".agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md",".agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md",".agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md",".agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md","mcp/delegation/contract.ts","mcp/delegation/supervisor.ts","mcp/delegation/verify.ts","mcp/delegation/worktree-guard.ts","mcp/meter-integrity.test.ts","mcp/worktree-guard.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-three-meter-and-guard-integrity-defects-260820-593c.json"}],"context":{"fact":"Current branch kage/three-meter-and-guard-integrity-defects-260820-593c changes 11 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T12:42:03.805Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/delegation/contract.ts","sha256":"b00fed2868c1a4c64be39b8d82e4b49a7414c7f2eb1c9e6b5cd561c954f03891","size":50356,"symbols":[{"name":"runs","kind":"constant","sha256":"aeed515a96dc123ddceac928842184b148f9bbd85f63bccbb0918926221c95e2"},{"name":"cached","kind":"constant","sha256":"a64892ec65eb891163c13bdd6fa87dd77ce617368685bef46ca90f9425ca6c76"},{"name":"change","kind":"constant","sha256":"e499aa50ffbb9c260caec4bb421746f795f0062475fe49fbee7f283705f385e8"},{"name":"from","kind":"constant","sha256":"bd2200c07292af9f1ac297cdf2d079dea9c17bd2c3ee4d9522b7a3bb5c07a013"}]},{"path":"mcp/delegation/supervisor.ts","sha256":"d8ed31b23d0078e3e8e44e233ec819b4b203ed5e0b1a47f1a4858c834f5bfd4f","size":43021,"symbols":[{"name":"claim","kind":"constant","sha256":"503d03bbad627f38bd9f2f7b2dd08561cca0c09fbdcba09345502c785d52a736"}]},{"path":"mcp/delegation/verify.ts","sha256":"862abe6b14f036221a86c82b71d9e83234404c827e2eed3d7515a6f7e71d6482","size":19211,"symbols":[{"name":"paths","kind":"constant","sha256":"d86b2c7d4535701b6385f96806820dbac0bc45d30eea01177b87dde616f1f98b"},{"name":"files","kind":"constant","sha256":"78f3e429f44325f7479571d6918ab610db233ba388e71a89dd5241b86a603f84"},{"name":"verifyrun","kind":"function","sha256":"e899191015a5fb75d5ecef13b7ed11b1392803f8b7ab726168acf54b8c0e72ea"}]},{"path":"mcp/delegation/worktree-guard.ts","sha256":"7e39a8a6bd3e27c8a0d039cb52c88a7ceea5334b1a2dc23cafe074ebbfdd9880","size":10510,"symbols":[{"name":"changed","kind":"constant","sha256":"af2d39747bfa5380f8e8c2c24195390d228aa7cbfc29f9ac41883602f772a1e8"}]},{"path":"mcp/meter-integrity.test.ts","sha256":"90915adeebd87303f50d0fa2bee5b05a4fb9453f084c89e6399699a2d69d8dae","size":11670,"symbols":[{"name":"claim","kind":"constant","sha256":"7d5490b04b8b0c9c22d9ae0c7afc2ba5013ba13431370a6306e5ec3ad3f7826a"}]},{"path":"mcp/worktree-guard.test.ts","sha256":"6cba62b102d2aecd0917b368aa45595637d3a95b26364538c0a57b2482eb5819","size":8130,"symbols":[{"name":"worktree","kind":"constant","sha256":"c055669587f852a2f02f67bffceab33530a0e7798dd7430342fccfa6928cc149"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/contract.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/supervisor.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/verify.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/worktree-guard.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/meter-integrity.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/worktree-guard.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/bug_fix-a-real-git-worktree-add-checkout-has-its-own-index-even-when-nested-inside-the-m-480d8309.md, .agent_memory/packets/bug_fix-a-rebased-away-red-is-a-distinct-failure-shape-from-a-self-caused-one-a-runs-own-e798d79d.md, .agent_memory/packets/bug_fix-git-diff-ref-a-single-ref-no-cached-compares-that-ref-straight-against-the-w-c38319df.md, .agent_memory/packets/bug_fix-verify-tss-verifyrun-called-by-runallchecks-which-supervisor-ts-claim-time-dispa-cd7799cf.md"],"duplicate_candidates":[],"estimated_tokens_saved":593,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"reverified_at":"2026-08-20T12:42:03.805Z"},"created_at":"2026-08-20T07:17:20.000Z","updated_at":"2026-08-20T12:42:03.805Z"}
```

