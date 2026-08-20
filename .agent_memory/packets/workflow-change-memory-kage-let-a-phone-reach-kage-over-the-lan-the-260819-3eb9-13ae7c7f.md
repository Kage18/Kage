---
type: "Workflow"
title: "Change memory: kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9"
description: "Repo-local context for 20 changed repo paths on kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9."
resource: ".agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9"]
timestamp: "2026-08-19T11:26:30.890Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.62
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md", ".agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md", ".agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md", ".agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md", ".agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md", ".agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md", ".agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md", ".agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md", ".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md", "mcp/add-project.test.ts", "mcp/cli.ts", "mcp/daemon.ts", "mcp/delegation/add-project.ts", "mcp/delegation/api.ts", "mcp/delegation/app-client.ts", "mcp/delegation/app-html.ts", "mcp/delegation/app-styles.ts", "mcp/delegation/config.ts", "mcp/delegation/guard.ts", "mcp/lan-mode.test.ts"]
---

# Change memory: kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9

> Repo-local context for 20 changed repo paths on kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md
- .agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md
- .agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md
- .agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md
- .agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md
- .agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md
- .agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md
- .agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md
- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md
- mcp/add-project.test.ts
- mcp/cli.ts
- mcp/daemon.ts
- mcp/delegation/add-project.ts
- mcp/delegation/api.ts
- mcp/delegation/app-client.ts
- mcp/delegation/app-html.ts
- mcp/delegation/app-styles.ts
- mcp/delegation/config.ts
- mcp/delegation/guard.ts
- mcp/lan-mode.test.ts

Diff summary:
```text
...ain-interface-not-touched-by-any-of-3867ab63.md |  92 --------
 ...erwrites-an-explicit-host-header-it-b5647f5c.md |  92 --------
 ...ates-every-daemon-start-by-design-a-6027a2b8.md |  92 --------
 ...workflow-change-memory-release-prep-a72d4251.md |  20 +-
 mcp/cli.ts                                         |  57 ++++-
 mcp/daemon.ts                                      |  86 +------
 mcp/delegation/api.ts                              |  58 ++++-
 mcp/delegation/app-client.ts                       | 129 ++++++++++-
 mcp/delegation/app-html.ts                         |  34 +++
 mcp/delegation/app-styles.ts                       |   5 +
 mcp/delegation/config.ts                           |  13 +-
 mcp/delegation/guard.ts                            |  61 +----
 mcp/lan-mode.test.ts                               | 247 ---------------------
 13 files changed, 301 insertions(+), 685 deletions(-)
.agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md | untracked
.agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md | untracked
.agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md | untracked
.agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md | untracked
.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md | untracked
mcp/add-project.test.ts | untracked
mcp/delegation/add-project.ts | untracked
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9","title":"Change memory: kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9","summary":"Repo-local context for 20 changed repo paths on kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md\n- .agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md\n- .agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md\n- .agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md\n- .agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md\n- .agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md\n- .agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md\n- .agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md\n- .agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md\n- mcp/add-project.test.ts\n- mcp/cli.ts\n- mcp/daemon.ts\n- mcp/delegation/add-project.ts\n- mcp/delegation/api.ts\n- mcp/delegation/app-client.ts\n- mcp/delegation/app-html.ts\n- mcp/delegation/app-styles.ts\n- mcp/delegation/config.ts\n- mcp/delegation/guard.ts\n- mcp/lan-mode.test.ts\n\nDiff summary:\n```text\n...ain-interface-not-touched-by-any-of-3867ab63.md |  92 --------\n ...erwrites-an-explicit-host-header-it-b5647f5c.md |  92 --------\n ...ates-every-daemon-start-by-design-a-6027a2b8.md |  92 --------\n ...workflow-change-memory-release-prep-a72d4251.md |  20 +-\n mcp/cli.ts                                         |  57 ++++-\n mcp/daemon.ts                                      |  86 +------\n mcp/delegation/api.ts                              |  58 ++++-\n mcp/delegation/app-client.ts                       | 129 ++++++++++-\n mcp/delegation/app-html.ts                         |  34 +++\n mcp/delegation/app-styles.ts                       |   5 +\n mcp/delegation/config.ts                           |  13 +-\n mcp/delegation/guard.ts                            |  61 +----\n mcp/lan-mode.test.ts                               | 247 ---------------------\n 13 files changed, 301 insertions(+), 685 deletions(-)\n.agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md | untracked\n.agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md | untracked\n.agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md | untracked\n.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md | untracked\nmcp/add-project.test.ts | untracked\nmcp/delegation/add-project.ts | untracked\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9"],"paths":[".agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md",".agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md",".agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md",".agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md",".agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md",".agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md",".agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md",".agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/add-project.test.ts","mcp/cli.ts","mcp/daemon.ts","mcp/delegation/add-project.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/delegation/config.ts","mcp/delegation/guard.ts","mcp/lan-mode.test.ts"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9","head":"933008dac7a35d364b53fa0c1e4cb5ebb3b0187f","merge_base":"edadf4f3bd62c5f2aaee47e4965283fd6412f3cb","changed_files":[".agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md",".agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md",".agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md",".agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md",".agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md",".agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md",".agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md",".agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md",".agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","mcp/add-project.test.ts","mcp/cli.ts","mcp/daemon.ts","mcp/delegation/add-project.ts","mcp/delegation/api.ts","mcp/delegation/app-client.ts","mcp/delegation/app-html.ts","mcp/delegation/app-styles.ts","mcp/delegation/config.ts","mcp/delegation/guard.ts","mcp/lan-mode.test.ts"],"summary_path":"/Users/kushaljain/code/Kage/.agent_memory/review/branch-summary-kage-let-a-phone-reach-kage-over-the-lan-the-260819-3eb9.json"}],"context":{"fact":"Current branch kage/let-a-phone-reach-kage-over-the-lan-the-260819-3eb9 changes 20 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-08-19T11:26:30.890Z","ttl_days":180,"path_fingerprints":[{"path":"mcp/add-project.test.ts","sha256":"57e4dda57cad815faf7ba511052f3478de853b5c4de75acbb03094d34cb398cf","size":6415},{"path":"mcp/cli.ts","sha256":"bd1b947d66d43d7f114d1b6cf4cd46bc5827d6342f9043bc414952b5c984f617","size":139858},{"path":"mcp/daemon.ts","sha256":"18e1405e923dfd44bb49feffde91ed2332aca72080cee67f096f54e07dea22e4","size":49468},{"path":"mcp/delegation/add-project.ts","sha256":"de6d85433e49ad40fd36b7dfc245e91a2f096938b06ad2a782fef85e79a739b4","size":5520},{"path":"mcp/delegation/api.ts","sha256":"de39b769a3dc2c5f153a820937fa21fd0bc15427d10d264d620e54dc3151d312","size":60313},{"path":"mcp/delegation/app-client.ts","sha256":"0cb9bf2d92c490b4ac4e33c0fb7a413ba9e0ae642541193a4cff7efd7f082296","size":140480},{"path":"mcp/delegation/app-html.ts","sha256":"2a40e37eb29d53bea2af6b868cae1bd470fa2a61121997f26e4ead05066db6d2","size":13641},{"path":"mcp/delegation/app-styles.ts","sha256":"12a78d9ca5067895c7ce30c5e8cdf2e63313762a73040843b9025374bcce5aa0","size":62864},{"path":"mcp/delegation/config.ts","sha256":"6b0e333161f8a20c623b9e58b7847cd48acf150aab4330b23ce079858abd7546","size":7148},{"path":"mcp/delegation/guard.ts","sha256":"3586166498d134aec39890a8a782092934237fec5b8b84433d34e651856a2dfc","size":4249}],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-delegation-api-tss-resolveroomreply-only-tries-a-live-held-open-session-with-a02bd27d.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-post-runs-previously-hardcoded-its-default-agent-to-claude-when-the-caller-omitt-68fec206.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-the-sidebars-rememberproject-readknownprojects-registry-kage-projects-json-previ-4f2577bf.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-make-adding-a-project-seamless-in-the-ap-260819-1ef4-bb7e9df2.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-kage-make-the-orchestrator-a-real-agent-sessi-260819-44b2-3ff1b77a.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-release-prep-a72d4251.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/add-project.test.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/cli.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/daemon.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/add-project.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/api.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-client.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-html.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/app-styles.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/config.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/delegation/guard.ts","evidence":"git_diff"},{"relation":"changes_path","to":"path:mcp/lan-mode.test.ts","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md, .agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md, .agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md, mcp/lan-mode.test.ts"],"duplicate_candidates":[],"stale_reasons":["some referenced paths are missing: .agent_memory/packets/decision-mcp-delegation-guard-tss-guardcontext-is-a-plain-interface-not-touched-by-any-of-3867ab63.md, .agent_memory/packets/decision-nodes-global-fetch-undici-silently-drops-overwrites-an-explicit-host-header-it-b5647f5c.md, .agent_memory/packets/decision-the-daemon-token-provisiondaemontoken-regenerates-every-daemon-start-by-design-a-6027a2b8.md, mcp/lan-mode.test.ts"],"estimated_tokens_saved":930,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true},"created_at":"2026-08-19T11:26:30.890Z","updated_at":"2026-08-19T11:26:30.890Z"}
```

