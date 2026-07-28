---
type: "Workflow"
title: "Change memory: master"
description: "Repo-local context for 13 changed repo paths on master."
resource: ".agent_memory/packets/bug_fix-ingestion-was-blind-because-the-proxy-discarded-the-assistants-prose-1c02e834.md"
tags: ["change-memory", "diff-proposal", "repo-local", "branch:master"]
timestamp: "2026-07-25T05:45:36.001Z"
x-kage-id: "repo:https-github-com-kage-core-kage:workflow:change-memory-master"
x-kage-type: "workflow"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "verified"
x-kage-paths: [".agent_memory/packets/bug_fix-ingestion-was-blind-because-the-proxy-discarded-the-assistants-prose-1c02e834.md", ".agent_memory/packets/code_explanation-adding-a-provider-gateway-register-in-defaultgateways-buildgatewayreceipt-is-the-8c7b154f.md", ".agent_memory/packets/code_explanation-kage-proxy-is-a-provider-neutral-gateway-one-seam-for-anthropic-openai-gemini-d26072dc.md", ".agent_memory/packets/code_explanation-phase-d-task-5-transform-pipeline-wired-into-proxy-protect-is-a-third-proxymode-c6ccee39.md", ".agent_memory/packets/decision-gemini-gateway-model-in-path-drove-a-minimal-parserequest-body-path-seam-change-5da92ec0.md", ".agent_memory/packets/decision-injection-decision-is-dual-scale-query-coverage-store-value-is-empirically-deriv-c82730c0.md", ".agent_memory/packets/decision-openai-gateway-normalizes-usage-into-the-neutral-providerusage-by-decomposing-th-4546811f.md", ".agent_memory/packets/gotcha-assist-mode-live-verified-on-subscription-oauth-mutated-bodies-are-accepted-firs-f472e5a3.md", ".agent_memory/packets/gotcha-provider-usage-input-tokens-is-the-uncached-remainder-never-compare-it-to-count--cd88e9c6.md", ".agent_memory/packets/gotcha-proxy-on-subscription-oauth-works-in-audit-mode-live-verified-429s-were-rate-lim-e7f6f119.md", ".agent_memory/packets/gotcha-the-session-start-ensure-up-block-must-resolve-the-repo-local-kage-first-unlike--3f877219.md", ".agent_memory/packets/runbook-verify-user-docs-by-running-the-documented-quickstart-in-a-throwaway-repo-9e9f9a51.md", ".agent_memory/packets/workflow-change-memory-master-23634276.md"]
---

# Change memory: master

> Repo-local context for 13 changed repo paths on master.

Repo-local change memory generated from the current git diff.

Goal: preserve the durable context another agent should receive when it works in this repo later.

What changed:
- .agent_memory/packets/bug_fix-ingestion-was-blind-because-the-proxy-discarded-the-assistants-prose-1c02e834.md
- .agent_memory/packets/code_explanation-adding-a-provider-gateway-register-in-defaultgateways-buildgatewayreceipt-is-the-8c7b154f.md
- .agent_memory/packets/code_explanation-kage-proxy-is-a-provider-neutral-gateway-one-seam-for-anthropic-openai-gemini-d26072dc.md
- .agent_memory/packets/code_explanation-phase-d-task-5-transform-pipeline-wired-into-proxy-protect-is-a-third-proxymode-c6ccee39.md
- .agent_memory/packets/decision-gemini-gateway-model-in-path-drove-a-minimal-parserequest-body-path-seam-change-5da92ec0.md
- .agent_memory/packets/decision-injection-decision-is-dual-scale-query-coverage-store-value-is-empirically-deriv-c82730c0.md
- .agent_memory/packets/decision-openai-gateway-normalizes-usage-into-the-neutral-providerusage-by-decomposing-th-4546811f.md
- .agent_memory/packets/gotcha-assist-mode-live-verified-on-subscription-oauth-mutated-bodies-are-accepted-firs-f472e5a3.md
- .agent_memory/packets/gotcha-provider-usage-input-tokens-is-the-uncached-remainder-never-compare-it-to-count--cd88e9c6.md
- .agent_memory/packets/gotcha-proxy-on-subscription-oauth-works-in-audit-mode-live-verified-429s-were-rate-lim-e7f6f119.md
- .agent_memory/packets/gotcha-the-session-start-ensure-up-block-must-resolve-the-repo-local-kage-first-unlike--3f877219.md
- .agent_memory/packets/runbook-verify-user-docs-by-running-the-documented-quickstart-in-a-throwaway-repo-9e9f9a51.md
- .agent_memory/packets/workflow-change-memory-master-23634276.md

Diff summary:
```text
...blind-because-the-proxy-discarded-the-assistants-prose-1c02e834.md | 2 +-
 ...register-in-defaultgateways-buildgatewayreceipt-is-the-8c7b154f.md | 4 ++--
 ...r-neutral-gateway-one-seam-for-anthropic-openai-gemini-d26072dc.md | 2 +-
 ...pipeline-wired-into-proxy-protect-is-a-third-proxymode-c6ccee39.md | 2 +-
 ...ath-drove-a-minimal-parserequest-body-path-seam-change-5da92ec0.md | 2 +-
 ...-scale-query-coverage-store-value-is-empirically-deriv-c82730c0.md | 4 ++--
 ...usage-into-the-neutral-providerusage-by-decomposing-th-4546811f.md | 4 ++--
 ...on-subscription-oauth-mutated-bodies-are-accepted-firs-f472e5a3.md | 4 ++--
 ...s-is-the-uncached-remainder-never-compare-it-to-count--cd88e9c6.md | 2 +-
 ...h-works-in-audit-mode-live-verified-429s-were-rate-lim-e7f6f119.md | 2 +-
 ...p-block-must-resolve-the-repo-local-kage-first-unlike--3f877219.md | 4 ++--
 ...-running-the-documented-quickstart-in-a-throwaway-repo-9e9f9a51.md | 4 ++--
 .agent_memory/packets/workflow-change-memory-master-23634276.md       | 2 +-
 13 files changed, 19 insertions(+), 19 deletions(-)
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
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:workflow:change-memory-master","title":"Change memory: master","summary":"Repo-local context for 13 changed repo paths on master.","body":"Repo-local change memory generated from the current git diff.\n\nGoal: preserve the durable context another agent should receive when it works in this repo later.\n\nWhat changed:\n- .agent_memory/packets/bug_fix-ingestion-was-blind-because-the-proxy-discarded-the-assistants-prose-1c02e834.md\n- .agent_memory/packets/code_explanation-adding-a-provider-gateway-register-in-defaultgateways-buildgatewayreceipt-is-the-8c7b154f.md\n- .agent_memory/packets/code_explanation-kage-proxy-is-a-provider-neutral-gateway-one-seam-for-anthropic-openai-gemini-d26072dc.md\n- .agent_memory/packets/code_explanation-phase-d-task-5-transform-pipeline-wired-into-proxy-protect-is-a-third-proxymode-c6ccee39.md\n- .agent_memory/packets/decision-gemini-gateway-model-in-path-drove-a-minimal-parserequest-body-path-seam-change-5da92ec0.md\n- .agent_memory/packets/decision-injection-decision-is-dual-scale-query-coverage-store-value-is-empirically-deriv-c82730c0.md\n- .agent_memory/packets/decision-openai-gateway-normalizes-usage-into-the-neutral-providerusage-by-decomposing-th-4546811f.md\n- .agent_memory/packets/gotcha-assist-mode-live-verified-on-subscription-oauth-mutated-bodies-are-accepted-firs-f472e5a3.md\n- .agent_memory/packets/gotcha-provider-usage-input-tokens-is-the-uncached-remainder-never-compare-it-to-count--cd88e9c6.md\n- .agent_memory/packets/gotcha-proxy-on-subscription-oauth-works-in-audit-mode-live-verified-429s-were-rate-lim-e7f6f119.md\n- .agent_memory/packets/gotcha-the-session-start-ensure-up-block-must-resolve-the-repo-local-kage-first-unlike--3f877219.md\n- .agent_memory/packets/runbook-verify-user-docs-by-running-the-documented-quickstart-in-a-throwaway-repo-9e9f9a51.md\n- .agent_memory/packets/workflow-change-memory-master-23634276.md\n\nDiff summary:\n```text\n...blind-because-the-proxy-discarded-the-assistants-prose-1c02e834.md | 2 +-\n ...register-in-defaultgateways-buildgatewayreceipt-is-the-8c7b154f.md | 4 ++--\n ...r-neutral-gateway-one-seam-for-anthropic-openai-gemini-d26072dc.md | 2 +-\n ...pipeline-wired-into-proxy-protect-is-a-third-proxymode-c6ccee39.md | 2 +-\n ...ath-drove-a-minimal-parserequest-body-path-seam-change-5da92ec0.md | 2 +-\n ...-scale-query-coverage-store-value-is-empirically-deriv-c82730c0.md | 4 ++--\n ...usage-into-the-neutral-providerusage-by-decomposing-th-4546811f.md | 4 ++--\n ...on-subscription-oauth-mutated-bodies-are-accepted-firs-f472e5a3.md | 4 ++--\n ...s-is-the-uncached-remainder-never-compare-it-to-count--cd88e9c6.md | 2 +-\n ...h-works-in-audit-mode-live-verified-429s-were-rate-lim-e7f6f119.md | 2 +-\n ...p-block-must-resolve-the-repo-local-kage-first-unlike--3f877219.md | 4 ++--\n ...-running-the-documented-quickstart-in-a-throwaway-repo-9e9f9a51.md | 4 ++--\n .agent_memory/packets/workflow-change-memory-master-23634276.md       | 2 +-\n 13 files changed, 19 insertions(+), 19 deletions(-)\n```\n\nHow to verify:\n- Add the exact test, build, or manual verification command when you refine this memory.\n\nImprove this packet when more context is known:\n- The actual feature, fix, or refactor rationale.\n- Why the change was made, including relevant bugs, issues, decisions, and code explanations.\n- The package, API, command, or architectural pattern future agents should understand, verify, or reuse.\n- Any gotchas, follow-up risks, or branch-specific assumptions.\n\nPromote beyond this repo only after explicit org/global review.","type":"workflow","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.62,"tags":["change-memory","diff-proposal","repo-local","branch:master"],"paths":[".agent_memory/packets/bug_fix-ingestion-was-blind-because-the-proxy-discarded-the-assistants-prose-1c02e834.md",".agent_memory/packets/code_explanation-adding-a-provider-gateway-register-in-defaultgateways-buildgatewayreceipt-is-the-8c7b154f.md",".agent_memory/packets/code_explanation-kage-proxy-is-a-provider-neutral-gateway-one-seam-for-anthropic-openai-gemini-d26072dc.md",".agent_memory/packets/code_explanation-phase-d-task-5-transform-pipeline-wired-into-proxy-protect-is-a-third-proxymode-c6ccee39.md",".agent_memory/packets/decision-gemini-gateway-model-in-path-drove-a-minimal-parserequest-body-path-seam-change-5da92ec0.md",".agent_memory/packets/decision-injection-decision-is-dual-scale-query-coverage-store-value-is-empirically-deriv-c82730c0.md",".agent_memory/packets/decision-openai-gateway-normalizes-usage-into-the-neutral-providerusage-by-decomposing-th-4546811f.md",".agent_memory/packets/gotcha-assist-mode-live-verified-on-subscription-oauth-mutated-bodies-are-accepted-firs-f472e5a3.md",".agent_memory/packets/gotcha-provider-usage-input-tokens-is-the-uncached-remainder-never-compare-it-to-count--cd88e9c6.md",".agent_memory/packets/gotcha-proxy-on-subscription-oauth-works-in-audit-mode-live-verified-429s-were-rate-lim-e7f6f119.md",".agent_memory/packets/gotcha-the-session-start-ensure-up-block-must-resolve-the-repo-local-kage-first-unlike--3f877219.md",".agent_memory/packets/runbook-verify-user-docs-by-running-the-documented-quickstart-in-a-throwaway-repo-9e9f9a51.md",".agent_memory/packets/workflow-change-memory-master-23634276.md"],"stack":[],"source_refs":[{"kind":"git_diff","branch":"master","head":"28da603acfa89a795a7ec49380cca268f25b1526","merge_base":"28da603acfa89a795a7ec49380cca268f25b1526","changed_files":[".agent_memory/packets/bug_fix-ingestion-was-blind-because-the-proxy-discarded-the-assistants-prose-1c02e834.md",".agent_memory/packets/code_explanation-adding-a-provider-gateway-register-in-defaultgateways-buildgatewayreceipt-is-the-8c7b154f.md",".agent_memory/packets/code_explanation-kage-proxy-is-a-provider-neutral-gateway-one-seam-for-anthropic-openai-gemini-d26072dc.md",".agent_memory/packets/code_explanation-phase-d-task-5-transform-pipeline-wired-into-proxy-protect-is-a-third-proxymode-c6ccee39.md",".agent_memory/packets/decision-gemini-gateway-model-in-path-drove-a-minimal-parserequest-body-path-seam-change-5da92ec0.md",".agent_memory/packets/decision-injection-decision-is-dual-scale-query-coverage-store-value-is-empirically-deriv-c82730c0.md",".agent_memory/packets/decision-openai-gateway-normalizes-usage-into-the-neutral-providerusage-by-decomposing-th-4546811f.md",".agent_memory/packets/gotcha-assist-mode-live-verified-on-subscription-oauth-mutated-bodies-are-accepted-firs-f472e5a3.md",".agent_memory/packets/gotcha-provider-usage-input-tokens-is-the-uncached-remainder-never-compare-it-to-count--cd88e9c6.md",".agent_memory/packets/gotcha-proxy-on-subscription-oauth-works-in-audit-mode-live-verified-429s-were-rate-lim-e7f6f119.md",".agent_memory/packets/gotcha-the-session-start-ensure-up-block-must-resolve-the-repo-local-kage-first-unlike--3f877219.md",".agent_memory/packets/runbook-verify-user-docs-by-running-the-documented-quickstart-in-a-throwaway-repo-9e9f9a51.md",".agent_memory/packets/workflow-change-memory-master-23634276.md"],"summary_path":".agent_memory/review/branch-summary-master.json"}],"context":{"fact":"Current branch master changes 13 repo paths.","why":"Branch change memory gives future agents durable context from the git diff when they continue, review, or verify this work.","trigger":"Recall when asking what changed on this branch, preparing a PR review, or resuming this work.","action":"Use the changed file list and diff summary as orientation, then inspect the actual diff and source files before making further edits.","verification":"Generated from git diff and refreshed by kage pr summarize or kage propose --from-diff.","risk_if_forgotten":"Future agents may repeat orientation work, miss branch-specific assumptions, or ignore files touched by this change.","stale_when":"The branch diff changes substantially, the branch is merged, or a newer change-memory packet supersedes it."},"freshness":{"last_verified_at":"2026-07-25T05:45:36.001Z","ttl_days":180,"path_fingerprints":[],"path_fingerprint_policy":"source_hash_staleness","verification":"git_diff"},"edges":[{"relation":"changes_path","to":"path:.agent_memory/packets/bug_fix-ingestion-was-blind-because-the-proxy-discarded-the-assistants-prose-1c02e834.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/code_explanation-adding-a-provider-gateway-register-in-defaultgateways-buildgatewayreceipt-is-the-8c7b154f.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/code_explanation-kage-proxy-is-a-provider-neutral-gateway-one-seam-for-anthropic-openai-gemini-d26072dc.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/code_explanation-phase-d-task-5-transform-pipeline-wired-into-proxy-protect-is-a-third-proxymode-c6ccee39.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-gemini-gateway-model-in-path-drove-a-minimal-parserequest-body-path-seam-change-5da92ec0.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-injection-decision-is-dual-scale-query-coverage-store-value-is-empirically-deriv-c82730c0.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/decision-openai-gateway-normalizes-usage-into-the-neutral-providerusage-by-decomposing-th-4546811f.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-assist-mode-live-verified-on-subscription-oauth-mutated-bodies-are-accepted-firs-f472e5a3.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-provider-usage-input-tokens-is-the-uncached-remainder-never-compare-it-to-count--cd88e9c6.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-proxy-on-subscription-oauth-works-in-audit-mode-live-verified-429s-were-rate-lim-e7f6f119.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/gotcha-the-session-start-ensure-up-block-must-resolve-the-repo-local-kage-first-unlike--3f877219.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/runbook-verify-user-docs-by-running-the-documented-quickstart-in-a-throwaway-repo-9e9f9a51.md","evidence":"git_diff"},{"relation":"changes_path","to":"path:.agent_memory/packets/workflow-change-memory-master-23634276.md","evidence":"git_diff"}],"quality":{"score":82,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":["some referenced paths are missing: .agent_memory/packets/workflow-change-memory-master-23634276.md"],"duplicate_candidates":[],"estimated_tokens_saved":845,"admission":{"admit":true,"class":"candidate","score":70,"reasons":["durable memory type","has provenance","repo scoped or path grounded","has durable trigger, rationale, issue context, or explanation","substantive enough to reuse"],"risks":[]},"candidate_kind":"change_memory","review_boundary":"git_or_pr","promotion_requires_review":true,"uses_30d":20,"total_uses":49,"last_accessed_at":"2026-07-28T04:10:52.027Z"},"created_at":"2026-07-25T05:45:36.001Z","updated_at":"2026-07-25T05:45:36.001Z"}
```

