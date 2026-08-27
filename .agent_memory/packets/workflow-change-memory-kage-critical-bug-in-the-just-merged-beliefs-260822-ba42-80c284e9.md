---
type: "Workflow"
title: "Change memory: kage/critical-bug-in-the-just-merged-beliefs-260822-ba42"
description: "Repo-local context for 14 changed repo paths on kage/critical-bug-in-the-just-merged-beliefs-260822-ba42."
resource: ".agent_memory/packets/bug_fix-beliefstalereason-conflated-packet-lineage-status-deprecated-superseded-with-gro-e312afc1.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-critical-bug-in-the-just-merged-beliefs-260822-ba42"]
timestamp: "2026-08-22T12:05:06.484Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-critical-bug-in-the-just-merged-beliefs-260822-ba42"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/bug_fix-beliefstalereason-conflated-packet-lineage-status-deprecated-superseded-with-gro-e312afc1.md", ".agent_memory/packets/bug_fix-mcp-kernel-tss-beliefstalereason-reads-each-cited-packet-via-tryreadpacket-absol-d0cfe65e.md", ".agent_memory/packets/bug_fix-recallstalereasons-only-two-possible-non-null-reasons-are-recallhardstalereasons-0d0f3cf3.md", ".agent_memory/packets/workflow-change-memory-kage-custodian-run-carry-the-drafted-belief-s-260822-147c-fdcf7646.md", ".agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md", ".agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md", ".agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md", ".agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md", ".agent_memory/packets/workflow-change-memory-kage-recall-reads-beliefs-first-briefs-and-ka-260822-4878-3366d066.md", ".agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md", ".agent_memory/packets/workflow-change-memory-kage-two-run-control-defects-from-a-live-inci-260822-736a-0eb7fedb.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md", "mcp/belief-status-lineage-not-stale.test.ts", "mcp/kernel.ts"]
---

# Change memory: kage/critical-bug-in-the-just-merged-beliefs-260822-ba42

> Repo-local context for 14 changed repo paths on kage/critical-bug-in-the-just-merged-beliefs-260822-ba42.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-beliefstalereason-conflated-packet-lineage-status-deprecated-superseded-with-gro-e312afc1.md
- .agent_memory/packets/bug_fix-mcp-kernel-tss-beliefstalereason-reads-each-cited-packet-via-tryreadpacket-absol-d0cfe65e.md
- .agent_memory/packets/bug_fix-recallstalereasons-only-two-possible-non-null-reasons-are-recallhardstalereasons-0d0f3cf3.md
- .agent_memory/packets/workflow-change-memory-kage-custodian-run-carry-the-drafted-belief-s-260822-147c-fdcf7646.md
- .agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md
- .agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md
- .agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md
- .agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md
- .agent_memory/packets/workflow-change-memory-kage-recall-reads-beliefs-first-briefs-and-ka-260822-4878-3366d066.md
- .agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md
- .agent_memory/packets/workflow-change-memory-kage-two-run-control-defects-from-a-live-inci-260822-736a-0eb7fedb.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/belief-status-lineage-not-stale.test.ts
- mcp/kernel.ts

Diff summary:
```text
...ited-packet-via-tryreadpacket-absol-d0cfe65e.md |  42 --------
 ...-reasons-are-recallhardstalereasons-0d0f3cf3.md |  42 --------
 ...workflow-change-memory-release-prep-a72d4251.md |  34 ++++---
 mcp/belief-status-lineage-not-stale.test.ts        | 113 ---------------------
 mcp/kernel.ts                                      |  14 +--
 5 files changed, 23 insertions(+), 222 deletions(-)
.agent_memory/packets/bug_fix-beliefstalereason-conflated-packet-lineage-status-deprecated-superseded-with-gro-e312afc1.md | untracked
.agent_memory/packets/workflow-change-memory-kage-custodian-run-carry-the-drafted-belief-s-260822-147c-fdcf7646.md | untracked
.agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md | untracked
.agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md | untracked
.agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md | untracked
.agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md | untracked
.agent_memory/packets/workflow-change-memory-kage-recall-reads-beliefs-first-briefs-and-ka-260822-4878-3366d066.md | untracked
.agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md | untracked
.agent_memory/packets/workflow-change-memory-kage-two-run-control-defects-from-a-live-inci-260822-736a-0eb7fedb.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-critical-bug-in-the-just-merged-beliefs-260822-ba42","title":"Change memory: kage/critical-bug-in-the-just-merged-beliefs-260822-ba42","summary":"Repo-local context for 14 changed repo paths on kage/critical-bug-in-the-just-merged-beliefs-260822-ba42.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-beliefstalereason-conflated-packet-lineage-status-deprecated-superseded-with-gro-e312afc1.md\n- .agent_memory/packets/bug_fix-mcp-kernel-tss-beliefstalereason-reads-each-cited-packet-via-tryreadpacket-absol-d0cfe65e.md\n- .agent_memory/packets/bug_fix-recallstalereasons-only-two-possible-non-null-reasons-are-recallhardstalereasons-0d0f3cf3.md\n- .agent_memory/packets/workflow-change-memory-kage-custodian-run-carry-the-drafted-belief-s-260822-147c-fdcf7646.md\n- .agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md\n- .agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md\n- .agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md\n- .agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md\n- .agent_memory/packets/workflow-change-memory-kage-recall-reads-beliefs-first-briefs-and-ka-260822-4878-3366d066.md\n- .agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md\n- .agent_memory/packets/workflow-change-memory-kage-two-run-control-defects-from-a-live-inci-260822-736a-0eb7fedb.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/belief-status-lineage-not-stale.test.ts\n- mcp/kernel.ts\n\nDiff summary:\n```text\n...ited-packet-via-tryreadpacket-absol-d0cfe65e.md |  42 --------\n ...-reasons-are-recallhardstalereasons-0d0f3cf3.md |  42 --------\n ...workflow-change-memory-release-prep-a72d4251.md |  34 ++++---\n mcp/belief-status-lineage-not-stale.test.ts        | 113 ---------------------\n mcp/kernel.ts                                      |  14 +--\n 5 files changed, 23 insertions(+), 222 deletions(-)\n.agent_memory/packets/bug_fix-beliefstalereason-conflated-packet-lineage-status-deprecated-superseded-with-gro-e312afc1.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-custodian-run-carry-the-drafted-belief-s-260822-147c-fdcf7646.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-recall-reads-beliefs-first-briefs-and-ka-260822-4878-3366d066.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-two-run-control-defects-from-a-live-inci-260822-736a-0eb7fedb.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-critical-bug-in-the-just-merged-beliefs-260822-ba42"],"paths":[".agent_memory/packets/bug_fix-beliefstalereason-conflated-packet-lineage-status-deprecated-superseded-with-gro-e312afc1.md",".agent_memory/packets/bug_fix-mcp-kernel-tss-beliefstalereason-reads-each-cited-packet-via-tryreadpacket-absol-d0cfe65e.md",".agent_memory/packets/bug_fix-recallstalereasons-only-two-possible-non-null-reasons-are-recallhardstalereasons-0d0f3cf3.md",".agent_memory/packets/workflow-change-memory-kage-custodian-run-carry-the-drafted-belief-s-260822-147c-fdcf7646.md",".agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md",".agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md",".agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md",".agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md",".agent_memory/packets/workflow-change-memory-kage-recall-reads-beliefs-first-briefs-and-ka-260822-4878-3366d066.md",".agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md",".agent_memory/packets/workflow-change-memory-kage-two-run-control-defects-from-a-live-inci-260822-736a-0eb7fedb.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/belief-status-lineage-not-stale.test.ts","mcp/kernel.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/critical-bug-in-the-just-merged-beliefs-260822-ba42","head":"10384204f84307a5bd8f0368479c091df5d43862","merge_base":"2eb8ffe149fd9c7a5c80576e731777642a256c8b","changed_files":[".agent_memory/packets/bug_fix-beliefstalereason-conflated-packet-lineage-status-deprecated-superseded-with-gro-e312afc1.md",".agent_memory/packets/bug_fix-mcp-kernel-tss-beliefstalereason-reads-each-cited-packet-via-tryreadpacket-absol-d0cfe65e.md",".agent_memory/packets/bug_fix-recallstalereasons-only-two-possible-non-null-reasons-are-recallhardstalereasons-0d0f3cf3.md",".agent_memory/packets/workflow-change-memory-kage-custodian-run-carry-the-drafted-belief-s-260822-147c-fdcf7646.md",".agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md",".agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md",".agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md",".agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md",".agent_memory/packets/workflow-change-memory-kage-recall-reads-beliefs-first-briefs-and-ka-260822-4878-3366d066.md",".agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md",".agent_memory/packets/workflow-change-memory-kage-two-run-control-defects-from-a-live-inci-260822-736a-0eb7fedb.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/belief-status-lineage-not-stale.test.ts","mcp/kernel.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-critical-bug-in-the-just-merged-beliefs-260822-ba42.json"}],"context":{"fact":"Current branch kage/critical-bug-in-the-just-merged-beliefs-260822-ba42 changes 14 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-22T12:05:06.484Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/kernel.ts","sha256":"c1cc0f698d4a05b1d8a8043f4a45d88e04ab2a3307aeebb71ac43d61132a9f85","size":943164}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-beliefstalereason-conflated-packet-lineage-status-deprecated-superseded-with-gro-e312afc1.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-mcp-kernel-tss-beliefstalereason-reads-each-cited-packet-via-tryreadpacket-absol-d0cfe65e.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-recallstalereasons-only-two-possible-non-null-reasons-are-recallhardstalereasons-0d0f3cf3.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-custodian-run-carry-the-drafted-belief-s-260822-147c-fdcf7646.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4-3363ae25.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-p2a-retire-the-last-in-place-packet-muta-260822-d87f-7ab5ab3c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-p2b-memory-leaves-the-code-working-tree-260822-d911-01c33135.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-recall-reads-beliefs-first-briefs-and-ka-260822-4878-3366d066.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-the-first-sleep-wave-1-draft-the-initial-260822-b4fa-3d9b11bc.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-two-run-control-defects-from-a-live-inci-260822-736a-0eb7fedb.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/belief-status-lineage-not-stale.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/kernel.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/bug_fix-mcp-kernel-tss-beliefstalereason-reads-each-cited-packet-via-tryreadpacket-absol-d0cfe65e.md, .agent_memory/packets/bug_fix-recallstalereasons-only-two-possible-non-null-reasons-are-recallhardstalereasons-0d0f3cf3.md, mcp/belief-status-lineage-not-stale.test.ts"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: .agent_memory/packets/bug_fix-mcp-kernel-tss-beliefstalereason-reads-each-cited-packet-via-tryreadpacket-absol-d0cfe65e.md, .agent_memory/packets/bug_fix-recallstalereasons-only-two-possible-non-null-reasons-are-recallhardstalereasons-0d0f3cf3.md, mcp/belief-status-lineage-not-stale.test.ts"],"estimated_tokens_saved":930,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-22T12:05:06.484Z","updated_at":"2026-08-22T12:05:06.484Z"}
```

