---
type: "Workflow"
title: "Change memory: release-prep"
description: "Repo-local context for 3 changed repo paths on release-prep."
resource: ".agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:release-prep"]
timestamp: "2026-08-20T07:31:31.347Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-release-prep"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md", ".agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md"]
---

# Change memory: release-prep

> Repo-local context for 3 changed repo paths on release-prep.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md
- .agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md

Diff summary:
```text
...workflow-change-memory-release-prep-a72d4251.md | 35 +++++-----------------
 1 file changed, 8 insertions(+), 27 deletions(-)
.agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-release-prep","title":"Change memory: release-prep","summary":"Repo-local context for 3 changed repo paths on release-prep.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md\n- .agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n\nDiff summary:\n```text\n...workflow-change-memory-release-prep-a72d4251.md | 35 +++++-----------------\n 1 file changed, 8 insertions(+), 27 deletions(-)\n.agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:release-prep"],"paths":[".agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md",".agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"release-prep","head":"45fb02cb5f6fab87a70784093e5a7d3feb91a3be","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md",".agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-release-prep.json"}],"context":{"fact":"Current branch release-prep changes 3 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-20T07:31:31.347Z","ttl_days":180,"path_fingerprints":[],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-m2-of-the-memory-store-route-the-memory-260820-ac22-372ea00a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-three-meter-and-guard-integrity-defects-260820-593c-4b68855c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md"],"estimated_tokens_saved":355,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-20T07:31:31.347Z","updated_at":"2026-08-20T07:31:31.347Z"}
```

