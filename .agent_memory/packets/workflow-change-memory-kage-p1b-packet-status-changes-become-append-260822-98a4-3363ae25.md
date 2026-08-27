---
type: "Workflow"
title: "Change memory: kage/p1b-packet-status-changes-become-append-260822-98a4"
description: "Repo-local context for 12 changed repo paths on kage/p1b-packet-status-changes-become-append-260822-98a4."
resource: ".agent_memory/packets/decision-gits-default-line-based-merge-conflicts-not-auto-combines-when-two-branches-each-f0121b14.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-p1b-packet-status-changes-become-append-260822-98a4"]
timestamp: "2026-08-22T06:36:12.574Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/decision-gits-default-line-based-merge-conflicts-not-auto-combines-when-two-branches-each-f0121b14.md", ".agent_memory/packets/decision-packets-are-stored-as-okf-md-concept-docs-already-mcp-kernel-tss-readjson-writej-f739aed9.md", ".agent_memory/packets/decision-staleness-in-mcp-kernel-tss-refreshpacketstaleness-must-be-computed-against-the--56a05ef1.md", ".agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md", ".gitattributes", "mcp/kernel.test.ts", "mcp/kernel.ts", "mcp/mcp.test.ts", "mcp/p1b-packet-status-changes.test.ts", "mcp/store/journal.ts", "mcp/trajectory.test.ts"]
---

# Change memory: kage/p1b-packet-status-changes-become-append-260822-98a4

> Repo-local context for 12 changed repo paths on kage/p1b-packet-status-changes-become-append-260822-98a4.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/decision-gits-default-line-based-merge-conflicts-not-auto-combines-when-two-branches-each-f0121b14.md
- .agent_memory/packets/decision-packets-are-stored-as-okf-md-concept-docs-already-mcp-kernel-tss-readjson-writej-f739aed9.md
- .agent_memory/packets/decision-staleness-in-mcp-kernel-tss-refreshpacketstaleness-must-be-computed-against-the--56a05ef1.md
- .agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- .gitattributes
- mcp/kernel.test.ts
- mcp/kernel.ts
- mcp/mcp.test.ts
- mcp/p1b-packet-status-changes.test.ts
- mcp/store/journal.ts
- mcp/trajectory.test.ts

Diff summary:
```text
...uto-combines-when-two-branches-each-f0121b14.md |  42 ----
 ...eady-mcp-kernel-tss-readjson-writej-f739aed9.md |  42 ----
 ...eness-must-be-computed-against-the--56a05ef1.md |  42 ----
 ...workflow-change-memory-release-prep-a72d4251.md |  21 +-
 .gitattributes                                     |   1 -
 mcp/kernel.test.ts                                 |  42 ++--
 mcp/kernel.ts                                      | 265 +++++++-------------
 mcp/mcp.test.ts                                    |  12 +-
 mcp/p1b-packet-status-changes.test.ts              | 274 ---------------------
 mcp/store/journal.ts                               | 190 --------------
 mcp/trajectory.test.ts                             |   8 +-
 11 files changed, 114 insertions(+), 825 deletions(-)
.agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-p1b-packet-status-changes-become-append-260822-98a4","title":"Change memory: kage/p1b-packet-status-changes-become-append-260822-98a4","summary":"Repo-local context for 12 changed repo paths on kage/p1b-packet-status-changes-become-append-260822-98a4.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-gits-default-line-based-merge-conflicts-not-auto-combines-when-two-branches-each-f0121b14.md\n- .agent_memory/packets/decision-packets-are-stored-as-okf-md-concept-docs-already-mcp-kernel-tss-readjson-writej-f739aed9.md\n- .agent_memory/packets/decision-staleness-in-mcp-kernel-tss-refreshpacketstaleness-must-be-computed-against-the--56a05ef1.md\n- .agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- .gitattributes\n- mcp/kernel.test.ts\n- mcp/kernel.ts\n- mcp/mcp.test.ts\n- mcp/p1b-packet-status-changes.test.ts\n- mcp/store/journal.ts\n- mcp/trajectory.test.ts\n\nDiff summary:\n```text\n...uto-combines-when-two-branches-each-f0121b14.md |  42 ----\n ...eady-mcp-kernel-tss-readjson-writej-f739aed9.md |  42 ----\n ...eness-must-be-computed-against-the--56a05ef1.md |  42 ----\n ...workflow-change-memory-release-prep-a72d4251.md |  21 +-\n .gitattributes                                     |   1 -\n mcp/kernel.test.ts                                 |  42 ++--\n mcp/kernel.ts                                      | 265 +++++++-------------\n mcp/mcp.test.ts                                    |  12 +-\n mcp/p1b-packet-status-changes.test.ts              | 274 ---------------------\n mcp/store/journal.ts                               | 190 --------------\n mcp/trajectory.test.ts                             |   8 +-\n 11 files changed, 114 insertions(+), 825 deletions(-)\n.agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-p1b-packet-status-changes-become-append-260822-98a4"],"paths":[".agent_memory/packets/decision-gits-default-line-based-merge-conflicts-not-auto-combines-when-two-branches-each-f0121b14.md",".agent_memory/packets/decision-packets-are-stored-as-okf-md-concept-docs-already-mcp-kernel-tss-readjson-writej-f739aed9.md",".agent_memory/packets/decision-staleness-in-mcp-kernel-tss-refreshpacketstaleness-must-be-computed-against-the--56a05ef1.md",".agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md",".gitattributes","mcp/kernel.test.ts","mcp/kernel.ts","mcp/mcp.test.ts","mcp/p1b-packet-status-changes.test.ts","mcp/store/journal.ts","mcp/trajectory.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/p1b-packet-status-changes-become-append-260822-98a4","head":"fdda7c18ddde8ace1969d9531b96c735104b1120","merge_base":"2eb8ffe149fd9c7a5c80576e731777642a256c8b","changed_files":[".agent_memory/packets/decision-gits-default-line-based-merge-conflicts-not-auto-combines-when-two-branches-each-f0121b14.md",".agent_memory/packets/decision-packets-are-stored-as-okf-md-concept-docs-already-mcp-kernel-tss-readjson-writej-f739aed9.md",".agent_memory/packets/decision-staleness-in-mcp-kernel-tss-refreshpacketstaleness-must-be-computed-against-the--56a05ef1.md",".agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md",".gitattributes","mcp/kernel.test.ts","mcp/kernel.ts","mcp/mcp.test.ts","mcp/p1b-packet-status-changes.test.ts","mcp/store/journal.ts","mcp/trajectory.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-p1b-packet-status-changes-become-append-260822-98a4.json"}],"context":{"fact":"Current branch kage/p1b-packet-status-changes-become-append-260822-98a4 changes 12 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-22T06:36:12.574Z","ttl_days":180,"path_fingerprints":[{"path":".gitattributes","sha256":"d3c24cd530fbce1a57c679e011ab18f651a7e43e2d7088013bfbc7f4707d15c7","size":92},{"path":"mcp/kernel.test.ts","sha256":"539e5d4d5bf09085014b004dcc1cff678a5a0522ea400e9fe656fade68081c18","size":309447},{"path":"mcp/kernel.ts","sha256":"0e291b992fbcc899c54ac2a854ff30d502ac647572aa7bc75222cf2079f87a6d","size":926947},{"path":"mcp/mcp.test.ts","sha256":"edeb58a89de75500d460221f11e8f47d992553c77830ebcbc0a0c2ead3750364","size":38951},{"path":"mcp/trajectory.test.ts","sha256":"ae16b0487deaeb51dc0c894dcc4830ee55812f7d95c6bfa7a0cb78652f85b5fb","size":11941}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-gits-default-line-based-merge-conflicts-not-auto-combines-when-two-branches-each-f0121b14.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-packets-are-stored-as-okf-md-concept-docs-already-mcp-kernel-tss-readjson-writej-f739aed9.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-staleness-in-mcp-kernel-tss-refreshpacketstaleness-must-be-computed-against-the--56a05ef1.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-p1a-derived-state-is-never-committed-aga-260822-5755-e823ed96.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.gitattributes","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/kernel.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/kernel.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/mcp.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/p1b-packet-status-changes.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/store/journal.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/trajectory.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-gits-default-line-based-merge-conflicts-not-auto-combines-when-two-branches-each-f0121b14.md, .agent_memory/packets/decision-packets-are-stored-as-okf-md-concept-docs-already-mcp-kernel-tss-readjson-writej-f739aed9.md, .agent_memory/packets/decision-staleness-in-mcp-kernel-tss-refreshpacketstaleness-must-be-computed-against-the--56a05ef1.md, mcp/p1b-packet-status-changes.test.ts"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: .agent_memory/packets/decision-gits-default-line-based-merge-conflicts-not-auto-combines-when-two-branches-each-f0121b14.md, .agent_memory/packets/decision-packets-are-stored-as-okf-md-concept-docs-already-mcp-kernel-tss-readjson-writej-f739aed9.md, .agent_memory/packets/decision-staleness-in-mcp-kernel-tss-refreshpacketstaleness-must-be-computed-against-the--56a05ef1.md, mcp/p1b-packet-status-changes.test.ts"],"estimated_tokens_saved":593,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-22T06:36:12.574Z","updated_at":"2026-08-22T06:36:12.574Z"}
```

