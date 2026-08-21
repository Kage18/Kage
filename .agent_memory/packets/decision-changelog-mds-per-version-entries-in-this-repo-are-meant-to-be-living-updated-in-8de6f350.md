---
type: "Decision"
title: "CHANGELOG.md's per-version entries in this repo are meant to be living/updated in place..."
description: "CHANGELOG.md's per version entries in this repo are meant to be living/updated in place while a version is still unpublished npm registry lags at 3.1.0 while package.json/CHANGELOG say 3.2.0 — appending new arc sections "
resource: "CHANGELOG.md"
tags: ["delegated-run", "kage-run:prep-release-prep-for-merge-to-master-ve-260821-f142"]
timestamp: "2026-08-21T19:09:03.030Z"
x-kage-id: "repo:prep-release-prep-for-merge-to-master-ve-260821-f142:decision:changelog-mds-per-version-entries-in-this-repo-are-meant-to-be-living-updated-in"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["CHANGELOG.md"]
---

# CHANGELOG.md's per-version entries in this repo are meant to be living/updated in place...

> CHANGELOG.md's per version entries in this repo are meant to be living/updated in place while a version is still unpu…

CHANGELOG.md's per-version entries in this repo are meant to be living/updated in place while a version is still unpublished (npm registry lags at 3.1.0 while package.json/CHANGELOG say 3.2.0) — appending new arc sections to the existing v3.2.0 heading, rather than adding a new version heading, is the correct pattern here since nothing has shipped under that version number yet.

Learned while delivering: Prep release-prep for merge to master: verify CHANGELOG completeness, version lockstep across mcp/shell, and confirm the diff is clean and mergeable — stop short of notarize/publish
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-21T19:09:03.030Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:prep-release-prep-for-merge-to-master-ve-260821-f142:decision:changelog-mds-per-version-entries-in-this-repo-are-meant-to-be-living-updated-in","title":"CHANGELOG.md's per-version entries in this repo are meant to be living/updated in place...","summary":"CHANGELOG.md's per version entries in this repo are meant to be living/updated in place while a version is still unpublished npm registry lags at 3.1.0 while package.json/CHANGELOG say 3.2.0 — appending new arc sections ","body":"CHANGELOG.md's per-version entries in this repo are meant to be living/updated in place while a version is still unpublished (npm registry lags at 3.1.0 while package.json/CHANGELOG say 3.2.0) — appending new arc sections to the existing v3.2.0 heading, rather than adding a new version heading, is the correct pattern here since nothing has shipped under that version number yet.\n\nLearned while delivering: Prep release-prep for merge to master: verify CHANGELOG completeness, version lockstep across mcp/shell, and confirm the diff is clean and mergeable — stop short of notarize/publish\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:prep-release-prep-for-merge-to-master-ve-260821-f142"],"paths":["CHANGELOG.md"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T19:09:03.030Z"}],"context":{"fact":"CHANGELOG.md's per-version entries in this repo are meant to be living/updated in place while a version is still unpublished (npm registry lags at 3.1.0 while package.json/CHANGELOG say 3.2.0) — appending new arc sections to the existing v3.2.0 heading, rather than adding a new version heading, is the correct pattern here since nothing has shipped under that version number yet.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T19:09:03.030Z","path_fingerprints":[{"path":"CHANGELOG.md","sha256":"4ec69525d1d8a0d52d872e387d2e8916670133b2a381dd4e7342683f5e853c48","size":70154}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":175},"created_at":"2026-08-21T19:09:03.030Z","updated_at":"2026-08-21T19:46:22.755Z","author_branch":"kage/prep-release-prep-for-merge-to-master-ve-260821-f142"}
```

