---
type: "Workflow"
title: "Change memory: fix/foreign-proxy-build"
description: "Repo-local context for 15 changed repo paths on fix/foreign-proxy-build."
resource: ".agents/skills/auto-distill-fallback-and-kage-resume-continuity-verified-v2/SKILL.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:fix-foreign-proxy-build"]
timestamp: "2026-08-04T21:32:57.862Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-fix-foreign-proxy-build"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "verified"
x-kage-paths: [".agents/skills/auto-distill-fallback-and-kage-resume-continuity-verified-v2/SKILL.md", ".agents/skills/claude-code-mcp-setup-claude-json-alwaysload-sessionstart-ho/SKILL.md", ".agents/skills/doc-truth-audit-method-re-verified-after-dark-first-site-fli/SKILL.md", ".agents/skills/github-actions-kage-pr-yml-and-kage-sync-yml-automation/SKILL.md", ".agents/skills/kage-context-is-the-single-session-start-tool-replacing-4-se/SKILL.md", ".agents/skills/longmemeval-harness-can-measure-dense-local-embeddings/SKILL.md", ".agents/skills/releasing-kage-release-js-flow-current-as-of-v2-2-0/SKILL.md", ".agents/skills/run-kage-mcp-tests/SKILL.md", ".agents/skills/viewer-live-feed-sse-kage-events-from-fs-watch-on-agent-memo/SKILL.md", ".superpowers/brainstorm/12017-1783924098/state/server.pid", ".superpowers/brainstorm/12409-1783924124/content/product-strategies.html", ".superpowers/brainstorm/12409-1783924124/content/product-thesis-approval-v3.html", ".superpowers/brainstorm/12409-1783924124/content/product-thesis-v2.html", ".superpowers/brainstorm/12409-1783924124/content/waiting-product-thesis.html", ".superpowers/brainstorm/12409-1783924124/state/server-stopped"]
---

# Change memory: fix/foreign-proxy-build

> Repo-local context for 15 changed repo paths on fix/foreign-proxy-build.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agents/skills/auto-distill-fallback-and-kage-resume-continuity-verified-v2/SKILL.md
- .agents/skills/claude-code-mcp-setup-claude-json-alwaysload-sessionstart-ho/SKILL.md
- .agents/skills/doc-truth-audit-method-re-verified-after-dark-first-site-fli/SKILL.md
- .agents/skills/github-actions-kage-pr-yml-and-kage-sync-yml-automation/SKILL.md
- .agents/skills/kage-context-is-the-single-session-start-tool-replacing-4-se/SKILL.md
- .agents/skills/longmemeval-harness-can-measure-dense-local-embeddings/SKILL.md
- .agents/skills/releasing-kage-release-js-flow-current-as-of-v2-2-0/SKILL.md
- .agents/skills/run-kage-mcp-tests/SKILL.md
- .agents/skills/viewer-live-feed-sse-kage-events-from-fs-watch-on-agent-memo/SKILL.md
- .superpowers/brainstorm/12017-1783924098/state/server.pid
- .superpowers/brainstorm/12409-1783924124/content/product-strategies.html
- .superpowers/brainstorm/12409-1783924124/content/product-thesis-approval-v3.html
- .superpowers/brainstorm/12409-1783924124/content/product-thesis-v2.html
- .superpowers/brainstorm/12409-1783924124/content/waiting-product-thesis.html
- .superpowers/brainstorm/12409-1783924124/state/server-stopped

Diff summary:
```text
...orkflow-change-memory-fix-foreign-proxy-build-876fa99c.md | 12 +++++-------
 1 file changed, 5 insertions(+), 7 deletions(-)
.agents/skills/auto-distill-fallback-and-kage-resume-continuity-verified-v2/SKILL.md | untracked
.agents/skills/claude-code-mcp-setup-claude-json-alwaysload-sessionstart-ho/SKILL.md | untracked
.agents/skills/doc-truth-audit-method-re-verified-after-dark-first-site-fli/SKILL.md | untracked
.agents/skills/github-actions-kage-pr-yml-and-kage-sync-yml-automation/SKILL.md | untracked
.agents/skills/kage-context-is-the-single-session-start-tool-replacing-4-se/SKILL.md | untracked
.agents/skills/longmemeval-harness-can-measure-dense-local-embeddings/SKILL.md | untracked
.agents/skills/releasing-kage-release-js-flow-current-as-of-v2-2-0/SKILL.md | untracked
.agents/skills/run-kage-mcp-tests/SKILL.md | untracked
.agents/skills/viewer-live-feed-sse-kage-events-from-fs-watch-on-agent-memo/SKILL.md | untracked
.superpowers/brainstorm/12017-1783924098/state/server.pid | untracked
.superpowers/brainstorm/12409-1783924124/content/product-strategies.html | untracked
.superpowers/brainstorm/12409-1783924124/content/product-thesis-approval-v3.html | untracked
.superpowers/brainstorm/12409-1783924124/content/product-thesis-v2.html | untracked
.superpowers/brainstorm/12409-1783924124/content/waiting-product-thesis.html | untracked
.superpowers/brainstorm/12409-1783924124/state/server-stopped | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-fix-foreign-proxy-build","title":"Change memory: fix/foreign-proxy-build","summary":"Repo-local context for 15 changed repo paths on fix/foreign-proxy-build.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agents/skills/auto-distill-fallback-and-kage-resume-continuity-verified-v2/SKILL.md\n- .agents/skills/claude-code-mcp-setup-claude-json-alwaysload-sessionstart-ho/SKILL.md\n- .agents/skills/doc-truth-audit-method-re-verified-after-dark-first-site-fli/SKILL.md\n- .agents/skills/github-actions-kage-pr-yml-and-kage-sync-yml-automation/SKILL.md\n- .agents/skills/kage-context-is-the-single-session-start-tool-replacing-4-se/SKILL.md\n- .agents/skills/longmemeval-harness-can-measure-dense-local-embeddings/SKILL.md\n- .agents/skills/releasing-kage-release-js-flow-current-as-of-v2-2-0/SKILL.md\n- .agents/skills/run-kage-mcp-tests/SKILL.md\n- .agents/skills/viewer-live-feed-sse-kage-events-from-fs-watch-on-agent-memo/SKILL.md\n- .superpowers/brainstorm/12017-1783924098/state/server.pid\n- .superpowers/brainstorm/12409-1783924124/content/product-strategies.html\n- .superpowers/brainstorm/12409-1783924124/content/product-thesis-approval-v3.html\n- .superpowers/brainstorm/12409-1783924124/content/product-thesis-v2.html\n- .superpowers/brainstorm/12409-1783924124/content/waiting-product-thesis.html\n- .superpowers/brainstorm/12409-1783924124/state/server-stopped\n\nDiff summary:\n```text\n...orkflow-change-memory-fix-foreign-proxy-build-876fa99c.md | 12 +++++-------\n 1 file changed, 5 insertions(+), 7 deletions(-)\n.agents/skills/auto-distill-fallback-and-kage-resume-continuity-verified-v2/SKILL.md | untracked\n.agents/skills/claude-code-mcp-setup-claude-json-alwaysload-sessionstart-ho/SKILL.md | untracked\n.agents/skills/doc-truth-audit-method-re-verified-after-dark-first-site-fli/SKILL.md | untracked\n.agents/skills/github-actions-kage-pr-yml-and-kage-sync-yml-automation/SKILL.md | untracked\n.agents/skills/kage-context-is-the-single-session-start-tool-replacing-4-se/SKILL.md | untracked\n.agents/skills/longmemeval-harness-can-measure-dense-local-embeddings/SKILL.md | untracked\n.agents/skills/releasing-kage-release-js-flow-current-as-of-v2-2-0/SKILL.md | untracked\n.agents/skills/run-kage-mcp-tests/SKILL.md | untracked\n.agents/skills/viewer-live-feed-sse-kage-events-from-fs-watch-on-agent-memo/SKILL.md | untracked\n.superpowers/brainstorm/12017-1783924098/state/server.pid | untracked\n.superpowers/brainstorm/12409-1783924124/content/product-strategies.html | untracked\n.superpowers/brainstorm/12409-1783924124/content/product-thesis-approval-v3.html | untracked\n.superpowers/brainstorm/12409-1783924124/content/product-thesis-v2.html | untracked\n.superpowers/brainstorm/12409-1783924124/content/waiting-product-thesis.html | untracked\n.superpowers/brainstorm/12409-1783924124/state/server-stopped | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:fix-foreign-proxy-build"],"paths":[".agents/skills/auto-distill-fallback-and-kage-resume-continuity-verified-v2/SKILL.md",".agents/skills/claude-code-mcp-setup-claude-json-alwaysload-sessionstart-ho/SKILL.md",".agents/skills/doc-truth-audit-method-re-verified-after-dark-first-site-fli/SKILL.md",".agents/skills/github-actions-kage-pr-yml-and-kage-sync-yml-automation/SKILL.md",".agents/skills/kage-context-is-the-single-session-start-tool-replacing-4-se/SKILL.md",".agents/skills/longmemeval-harness-can-measure-dense-local-embeddings/SKILL.md",".agents/skills/releasing-kage-release-js-flow-current-as-of-v2-2-0/SKILL.md",".agents/skills/run-kage-mcp-tests/SKILL.md",".agents/skills/viewer-live-feed-sse-kage-events-from-fs-watch-on-agent-memo/SKILL.md",".superpowers/brainstorm/12017-1783924098/state/server.pid",".superpowers/brainstorm/12409-1783924124/content/product-strategies.html",".superpowers/brainstorm/12409-1783924124/content/product-thesis-approval-v3.html",".superpowers/brainstorm/12409-1783924124/content/product-thesis-v2.html",".superpowers/brainstorm/12409-1783924124/content/waiting-product-thesis.html",".superpowers/brainstorm/12409-1783924124/state/server-stopped"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"fix/foreign-proxy-build","head":"5fae4c3b808b37320f194121313c3d1c872019b4","merge_base":"ca27292e2a15b8f7a900ddb8dcab2cce6107590b","changed_files":[".agent_memory/packets/workflow-change-memory-fix-foreign-proxy-build-876fa99c.md",".agents/skills/auto-distill-fallback-and-kage-resume-continuity-verified-v2/SKILL.md",".agents/skills/claude-code-mcp-setup-claude-json-alwaysload-sessionstart-ho/SKILL.md",".agents/skills/doc-truth-audit-method-re-verified-after-dark-first-site-fli/SKILL.md",".agents/skills/github-actions-kage-pr-yml-and-kage-sync-yml-automation/SKILL.md",".agents/skills/kage-context-is-the-single-session-start-tool-replacing-4-se/SKILL.md",".agents/skills/longmemeval-harness-can-measure-dense-local-embeddings/SKILL.md",".agents/skills/releasing-kage-release-js-flow-current-as-of-v2-2-0/SKILL.md",".agents/skills/run-kage-mcp-tests/SKILL.md",".agents/skills/viewer-live-feed-sse-kage-events-from-fs-watch-on-agent-memo/SKILL.md",".superpowers/brainstorm/12017-1783924098/state/server.pid",".superpowers/brainstorm/12409-1783924124/content/product-strategies.html",".superpowers/brainstorm/12409-1783924124/content/product-thesis-approval-v3.html",".superpowers/brainstorm/12409-1783924124/content/product-thesis-v2.html",".superpowers/brainstorm/12409-1783924124/content/waiting-product-thesis.html",".superpowers/brainstorm/12409-1783924124/state/server-stopped"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-fix-foreign-proxy-build.json"}],"context":{"fact":"Current branch fix/foreign-proxy-build changes 15 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-04T21:32:57.862Z","ttl_days":180,"path_fingerprints":[{"path":".agents/skills/auto-distill-fallback-and-kage-resume-continuity-verified-v2/SKILL.md","sha256":"47824d00812605d0500d7aa8f787def83d5e33b2bbd5441ea02ac95b1475c35c","size":1700},{"path":".agents/skills/claude-code-mcp-setup-claude-json-alwaysload-sessionstart-ho/SKILL.md","sha256":"9a761e6df9ad94f49a5d2993b9dab9ffff1d1f2b1da6579d911e7cb1c0603d12","size":1560},{"path":".agents/skills/doc-truth-audit-method-re-verified-after-dark-first-site-fli/SKILL.md","sha256":"3c44811945a8414bae357e595c0b46831e23ff5c00841a34e87ec83279834fcd","size":2197},{"path":".agents/skills/github-actions-kage-pr-yml-and-kage-sync-yml-automation/SKILL.md","sha256":"dda77de0aaae042a6aac2467570b1885396868e798a262a2ca8c099e5212beb3","size":1626},{"path":".agents/skills/kage-context-is-the-single-session-start-tool-replacing-4-se/SKILL.md","sha256":"bce5ddfe23a064bf83066e79ae4409daaf74bcd1ef0bc5b03b79c31113d836d4","size":1553},{"path":".agents/skills/longmemeval-harness-can-measure-dense-local-embeddings/SKILL.md","sha256":"3399230fc6ff0c8f64cc0fd07c358cc7e0d3fc3e746456177c82e7574e2aea43","size":2517},{"path":".agents/skills/releasing-kage-release-js-flow-current-as-of-v2-2-0/SKILL.md","sha256":"debb3015d30467c149f1a112afb52847bad8ee3c4800af56d96514d8bfb45f89","size":2248},{"path":".agents/skills/run-kage-mcp-tests/SKILL.md","sha256":"bba50591d9a4617ed227b94aab3013a2f0b6da174f293938c91a9f861abaeba9","size":1716},{"path":".agents/skills/viewer-live-feed-sse-kage-events-from-fs-watch-on-agent-memo/SKILL.md","sha256":"709c4d2b14c1fe568027e164f72b38f0810a7124d7a3cf1526348c0a1d01e927","size":4344},{"path":".superpowers/brainstorm/12017-1783924098/state/server.pid","sha256":"2e5027c9cc1f9bb85e3dbf98244fb07f441005e9c57a330dc2868b872c93cf73","size":6},{"path":".superpowers/brainstorm/12409-1783924124/content/product-strategies.html","sha256":"736c89ecc9649271427b91f11b5406e024d4c95bc0316eeac1cb30e83035cc26","size":4379},{"path":".superpowers/brainstorm/12409-1783924124/content/product-thesis-approval-v3.html","sha256":"296643c2648e529491e203f2c3337f5767004a92e115f513cf8e1e4f35eded51","size":3315},{"path":".superpowers/brainstorm/12409-1783924124/content/product-thesis-v2.html","sha256":"1f01f81abafec31d7edc5c92c5fc67e8ba590aafe555d60623a74897ab5f0197","size":3467},{"path":".superpowers/brainstorm/12409-1783924124/content/waiting-product-thesis.html","sha256":"66cf0ae2f9ebf7558ffe22f974b32db98ac8b707a3b54771edd188a2b4181d18","size":391},{"path":".superpowers/brainstorm/12409-1783924124/state/server-stopped","sha256":"77a5e9e8675dbb980891d3b937513fadb0d813cca177a7bd2b1b474d0d7cda66","size":52}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-fix-foreign-proxy-build-876fa99c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agents/skills/auto-distill-fallback-and-kage-resume-continuity-verified-v2/SKILL.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agents/skills/claude-code-mcp-setup-claude-json-alwaysload-sessionstart-ho/SKILL.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agents/skills/doc-truth-audit-method-re-verified-after-dark-first-site-fli/SKILL.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agents/skills/github-actions-kage-pr-yml-and-kage-sync-yml-automation/SKILL.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agents/skills/kage-context-is-the-single-session-start-tool-replacing-4-se/SKILL.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agents/skills/longmemeval-harness-can-measure-dense-local-embeddings/SKILL.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agents/skills/releasing-kage-release-js-flow-current-as-of-v2-2-0/SKILL.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agents/skills/run-kage-mcp-tests/SKILL.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agents/skills/viewer-live-feed-sse-kage-events-from-fs-watch-on-agent-memo/SKILL.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.superpowers/brainstorm/12017-1783924098/state/server.pid","evidence":"git_diff"},{"relation":"changes_path","to":"path:.superpowers/brainstorm/12409-1783924124/content/product-strategies.html","evidence":"git_diff"},{"relation":"changes_path","to":"path:.superpowers/brainstorm/12409-1783924124/content/product-thesis-approval-v3.html","evidence":"git_diff"},{"relation":"changes_path","to":"path:.superpowers/brainstorm/12409-1783924124/content/product-thesis-v2.html","evidence":"git_diff"},{"relation":"changes_path","to":"path:.superpowers/brainstorm/12409-1783924124/content/waiting-product-thesis.html","evidence":"git_diff"},{"relation":"changes_path","to":"path:.superpowers/brainstorm/12409-1783924124/state/server-stopped","evidence":"git_diff"}],"quality":{"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":831,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-04T21:32:57.862Z","updated_at":"2026-08-04T21:32:57.862Z"}
```

