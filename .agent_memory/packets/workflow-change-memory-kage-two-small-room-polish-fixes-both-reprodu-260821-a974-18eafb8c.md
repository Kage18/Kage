---
type: "Workflow"
title: "Change memory: kage/two-small-room-polish-fixes-both-reprodu-260821-a974"
description: "Repo-local context for 9 changed repo paths on kage/two-small-room-polish-fixes-both-reprodu-260821-a974."
resource: ".agent_memory/packets/convention-hired-agents-must-never-kill-processes-they-did-not-spawn-a-run-killed-another-r-685ab5ff.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-two-small-room-polish-fixes-both-reprodu-260821-a974"]
timestamp: "2026-08-21T18:46:17.605Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-two-small-room-polish-fixes-both-reprodu-260821-a974"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/convention-hired-agents-must-never-kill-processes-they-did-not-spawn-a-run-killed-another-r-685ab5ff.md", ".agent_memory/packets/workflow-change-memory-kage-investigate-why-chore-type-runs-verify-l-260821-c3b9-a31166c6.md", ".agent_memory/packets/workflow-change-memory-kage-two-small-room-polish-fixes-both-reprodu-260821-a974-18eafb8c.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md", "mcp/chat-must-be-first.test.ts", "mcp/delegation/api.ts", "mcp/delegation/app-client.ts", "mcp/room-unified-session.test.ts", "mcp/two-small-room-polish.test.ts"]
---

# Change memory: kage/two-small-room-polish-fixes-both-reprodu-260821-a974

> Repo-local context for 9 changed repo paths on kage/two-small-room-polish-fixes-both-reprodu-260821-a974.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/convention-hired-agents-must-never-kill-processes-they-did-not-spawn-a-run-killed-another-r-685ab5ff.md
- .agent_memory/packets/workflow-change-memory-kage-investigate-why-chore-type-runs-verify-l-260821-c3b9-a31166c6.md
- .agent_memory/packets/workflow-change-memory-kage-two-small-room-polish-fixes-both-reprodu-260821-a974-18eafb8c.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/chat-must-be-first.test.ts
- mcp/delegation/api.ts
- mcp/delegation/app-client.ts
- mcp/room-unified-session.test.ts
- mcp/two-small-room-polish.test.ts

Diff summary:
```text
...workflow-change-memory-release-prep-a72d4251.md |  27 +--
 mcp/chat-must-be-first.test.ts                     |   2 +-
 mcp/delegation/api.ts                              |  13 +-
 mcp/delegation/app-client.ts                       |  25 +--
 mcp/room-unified-session.test.ts                   |   2 +-
 mcp/two-small-room-polish.test.ts                  | 226 ---------------------
 6 files changed, 18 insertions(+), 277 deletions(-)
.agent_memory/packets/convention-hired-agents-must-never-kill-processes-they-did-not-spawn-a-run-killed-another-r-685ab5ff.md | untracked
.agent_memory/packets/workflow-change-memory-kage-investigate-why-chore-type-runs-verify-l-260821-c3b9-a31166c6.md | untracked
.agent_memory/packets/workflow-change-memory-kage-two-small-room-polish-fixes-both-reprodu-260821-a974-18eafb8c.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-two-small-room-polish-fixes-both-reprodu-260821-a974","title":"Change memory: kage/two-small-room-polish-fixes-both-reprodu-260821-a974","summary":"Repo-local context for 9 changed repo paths on kage/two-small-room-polish-fixes-both-reprodu-260821-a974.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/convention-hired-agents-must-never-kill-processes-they-did-not-spawn-a-run-killed-another-r-685ab5ff.md\n- .agent_memory/packets/workflow-change-memory-kage-investigate-why-chore-type-runs-verify-l-260821-c3b9-a31166c6.md\n- .agent_memory/packets/workflow-change-memory-kage-two-small-room-polish-fixes-both-reprodu-260821-a974-18eafb8c.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/chat-must-be-first.test.ts\n- mcp/delegation/api.ts\n- mcp/delegation/app-client.ts\n- mcp/room-unified-session.test.ts\n- mcp/two-small-room-polish.test.ts\n\nDiff summary:\n```text\n...workflow-change-memory-release-prep-a72d4251.md |  27 +--\n mcp/chat-must-be-first.test.ts                     |   2 +-\n mcp/delegation/api.ts                              |  13 +-\n mcp/delegation/app-client.ts                       |  25 +--\n mcp/room-unified-session.test.ts                   |   2 +-\n mcp/two-small-room-polish.test.ts                  | 226 ---------------------\n 6 files changed, 18 insertions(+), 277 deletions(-)\n.agent_memory/packets/convention-hired-agents-must-never-kill-processes-they-did-not-spawn-a-run-killed-another-r-685ab5ff.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-investigate-why-chore-type-runs-verify-l-260821-c3b9-a31166c6.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-two-small-room-polish-fixes-both-reprodu-260821-a974-18eafb8c.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-two-small-room-polish-fixes-both-reprodu-260821-a974"],"paths":[".agent_memory/packets/convention-hired-agents-must-never-kill-processes-they-did-not-spawn-a-run-killed-another-r-685ab5ff.md",".agent_memory/packets/workflow-change-memory-kage-investigate-why-chore-type-runs-verify-l-260821-c3b9-a31166c6.md",".agent_memory/packets/workflow-change-memory-kage-two-small-room-polish-fixes-both-reprodu-260821-a974-18eafb8c.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/chat-must-be-first.test.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/room-unified-session.test.ts","mcp/two-small-room-polish.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/two-small-room-polish-fixes-both-reprodu-260821-a974","head":"78403d4b3e52b645e1abfd587fc67126f457dd31","merge_base":"a7d95d97499c28919013a3e13b7216ae89b7f51d","changed_files":[".agent_memory/packets/convention-hired-agents-must-never-kill-processes-they-did-not-spawn-a-run-killed-another-r-685ab5ff.md",".agent_memory/packets/workflow-change-memory-kage-investigate-why-chore-type-runs-verify-l-260821-c3b9-a31166c6.md",".agent_memory/packets/workflow-change-memory-kage-two-small-room-polish-fixes-both-reprodu-260821-a974-18eafb8c.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/chat-must-be-first.test.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/room-unified-session.test.ts","mcp/two-small-room-polish.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-two-small-room-polish-fixes-both-reprodu-260821-a974.json"}],"context":{"fact":"Current branch kage/two-small-room-polish-fixes-both-reprodu-260821-a974 changes 9 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-21T18:46:17.605Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/chat-must-be-first.test.ts","sha256":"343c5929ef0afcf6f522bbe22c745b8b6677d2ecb3a233cbeacf67e45d461fda","size":11614},{"path":"mcp/delegation/api.ts","sha256":"b0da5629699f18d13345f8cb1e840e7edc9faf99b90a7b2d05f63e635cd6358d","size":93902},{"path":"mcp/delegation/app-client.ts","sha256":"ecbbed9732debf70235a929f1c8fbb549d0eff72e61bda990c482d2b2ab0b065","size":238434},{"path":"mcp/room-unified-session.test.ts","sha256":"5574986a60f5e90151d004b5fcd02fddb476a0da636e2e3f04c63ef105ba658a","size":18834}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/convention-hired-agents-must-never-kill-processes-they-did-not-spawn-a-run-killed-another-r-685ab5ff.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-investigate-why-chore-type-runs-verify-l-260821-c3b9-a31166c6.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-two-small-room-polish-fixes-both-reprodu-260821-a974-18eafb8c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/chat-must-be-first.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/room-unified-session.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/two-small-room-polish.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/workflow-change-memory-kage-two-small-room-polish-fixes-both-reprodu-260821-a974-18eafb8c.md, mcp/two-small-room-polish.test.ts"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: .agent_memory/packets/workflow-change-memory-kage-two-small-room-polish-fixes-both-reprodu-260821-a974-18eafb8c.md, mcp/two-small-room-polish.test.ts"],"estimated_tokens_saved":540,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-21T18:46:17.605Z","updated_at":"2026-08-21T18:46:17.605Z"}
```

