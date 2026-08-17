---
type: "Bug Fix"
title: "rejectRun's dropped-state handling relies on reapRun(projectDir, runId) (contract.ts) t..."
description: "rejectRun's dropped state handling relies on reapRun projectDir, runId contract.ts to persist a stale in flight run dead agent pid as 'failed' before the REJECTABLE STATES check, since 'dropped' is a derived DisplayState"
resource: "mcp/delegation.test.ts"
tags: ["delegated-run", "kage-run:fix-rejectrun-state-gate-in-mcp-delegati-260817-6821"]
timestamp: "2026-08-17T18:51:15.733Z"
x-kage-id: "repo:fix-rejectrun-state-gate-in-mcp-delegati-260817-6821:bug_fix:rejectruns-dropped-state-handling-relies-on-reaprun-projectdir-runid-contract-ts"
x-kage-type: "bug_fix"
x-kage-status: "pending"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation.test.ts", "mcp/delegation/contract.ts", "mcp/delegation/ratify.ts"]
---

# rejectRun's dropped-state handling relies on reapRun(projectDir, runId) (contract.ts) t...

> rejectRun's dropped state handling relies on reapRun projectDir, runId contract.ts to persist a stale in flight run d…

rejectRun's dropped-state handling relies on reapRun(projectDir, runId) (contract.ts) to persist a stale in-flight run (dead agent_pid) as 'failed' before the REJECTABLE_STATES check, since 'dropped' is a derived DisplayState, not a real RunState, and can't appear in LEGAL_TRANSITIONS.

Learned while delivering: Fix rejectRun state gate in mcp/delegation/ratify.ts: a stopped run cannot be rejected. The gate allows only ready and failed; every surface promises rejection for stopped runs (contract.ts decisionText says Stopped - resume or reject; the app shows a Reject button). A VERIFIED working implementation from a previous attempt exists on branch kage/fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b - read it with git show and replicate it faithfully (adapt if the base moved): it allows reject from ready/failed/stopped/dropped (reaping a dropped run to failed first via reapRun), keeps refusing draft/briefed/dispatched/running/verifying/blocked, names the actual state in refusal messages, adds stopped-to-rejected in LEGAL_TRANSITIONS, and adds two regression tests to mcp/delegation.test.ts (stopped run rejects successfully with a captured negative_result packet; running run still refuses with a state-naming message). Success = npm test fully green.
Verified by: npm test --prefix mcp, diff-size, citations

## Verification

npm test --prefix mcp, diff-size, citations

# Citations

[1] explicit_capture (2026-08-17T18:51:15.733Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:fix-rejectrun-state-gate-in-mcp-delegati-260817-6821:bug_fix:rejectruns-dropped-state-handling-relies-on-reaprun-projectdir-runid-contract-ts","title":"rejectRun's dropped-state handling relies on reapRun(projectDir, runId) (contract.ts) t...","summary":"rejectRun's dropped state handling relies on reapRun projectDir, runId contract.ts to persist a stale in flight run dead agent pid as 'failed' before the REJECTABLE STATES check, since 'dropped' is a derived DisplayState","body":"rejectRun's dropped-state handling relies on reapRun(projectDir, runId) (contract.ts) to persist a stale in-flight run (dead agent_pid) as 'failed' before the REJECTABLE_STATES check, since 'dropped' is a derived DisplayState, not a real RunState, and can't appear in LEGAL_TRANSITIONS.\n\nLearned while delivering: Fix rejectRun state gate in mcp/delegation/ratify.ts: a stopped run cannot be rejected. The gate allows only ready and failed; every surface promises rejection for stopped runs (contract.ts decisionText says Stopped - resume or reject; the app shows a Reject button). A VERIFIED working implementation from a previous attempt exists on branch kage/fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b - read it with git show and replicate it faithfully (adapt if the base moved): it allows reject from ready/failed/stopped/dropped (reaping a dropped run to failed first via reapRun), keeps refusing draft/briefed/dispatched/running/verifying/blocked, names the actual state in refusal messages, adds stopped-to-rejected in LEGAL_TRANSITIONS, and adds two regression tests to mcp/delegation.test.ts (stopped run rejects successfully with a captured negative_result packet; running run still refuses with a state-naming message). Success = npm test fully green.\nVerified by: npm test --prefix mcp, diff-size, citations","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"pending","confidence":0.7,"tags":["delegated-run","kage-run:fix-rejectrun-state-gate-in-mcp-delegati-260817-6821"],"paths":["mcp/delegation.test.ts","mcp/delegation/contract.ts","mcp/delegation/ratify.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-17T18:51:15.733Z"}],"context":{"fact":"rejectRun's dropped-state handling relies on reapRun(projectDir, runId) (contract.ts) to persist a stale in-flight run (dead agent_pid) as 'failed' before the REJECTABLE_STATES check, since 'dropped' is a derived DisplayState, not a real RunState, and can't appear in LEGAL_TRANSITIONS.","verification":"npm test --prefix mcp, diff-size, citations"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-17T18:51:15.733Z","path_fingerprints":[{"path":"mcp/delegation.test.ts","sha256":"06d3f0ecc2bf4dbef673c69c290051f56aa63d8ccd0eadb3d0ca1af849769bc2","size":61622,"symbols":[{"name":"learned","kind":"constant","sha256":"86a9cef845cb3f653282806e5a05f474fd9c20f4ad4af48ec5d031f762c896d5"},{"name":"ready","kind":"constant","sha256":"7de0a7fcd74fe8631c4de1414d6f2f0f22c3c86f5165a71f67f9068602e49d08"},{"name":"state","kind":"constant","sha256":"9ab61b8844cbc59b085101b723c75f8cc5dffc975343d4900666650f818b6ca7"}]},{"path":"mcp/delegation/contract.ts","sha256":"bb253d21af7ec1046ddcf3c1ab86fefa1284546ea9422b73719280d677d7d95e","size":27947,"symbols":[{"name":"legal_transitions","kind":"constant","sha256":"8821bb1fbf65d1380765e1d43098d1e86b2e3e44e1d65e702f8f837b67bc3768"},{"name":"prefix","kind":"constant","sha256":"d0c83c86f4e94d7a484b3325b54d1c90e1c6fc37b342a4cf7d3c33dd33dfb85a"},{"name":"runs","kind":"constant","sha256":"aeed515a96dc123ddceac928842184b148f9bbd85f63bccbb0918926221c95e2"},{"name":"displaystate","kind":"function","sha256":"c9387cda6161da1353a9e7003a1fe03a6498cdde39b420916cc9874f14813d4d"},{"name":"reaprun","kind":"function","sha256":"c65240ad87675bf6a8fdfc13efd8acfe69b0fed53bdc3b8eba549ba7c7bdc94a"},{"name":"from","kind":"constant","sha256":"bd2200c07292af9f1ac297cdf2d079dea9c17bd2c3ee4d9522b7a3bb5c07a013"}]},{"path":"mcp/delegation/ratify.ts","sha256":"0e819b6d0e1205cb63ead54d133b2f6ba754aeff3b66e293a9b5352c2d853b46","size":9618,"symbols":[{"name":"packet","kind":"constant","sha256":"1334c6233d0f856bc34455a4656eadc87ed9bc526ea83335977aa958d235c764"},{"name":"base","kind":"constant","sha256":"9e9ae19b97ecc0a8e39a611a2fdf05b50eea3ca8b3d62da6d877aac115bc502f"},{"name":"rejectable_states","kind":"constant","sha256":"e2a957a110b26e3d727b19c96b36f0f99b34d34b4fdb988c154ca68a8e1e6113"},{"name":"rejectrun","kind":"function","sha256":"2172a858fe64b17636a4573a42a7735df5bb96c2c6eb283bcd62972a1b7287bd"},{"name":"captured","kind":"constant","sha256":"b1b5a34146d832ba17326157205fd49c6aed46b0550b618568fdb882817c8a2c"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":333,"unresolved_symbols":["decisionText"]},"created_at":"2026-08-17T18:51:15.733Z","updated_at":"2026-08-17T18:51:15.831Z","author_branch":"kage/fix-rejectrun-state-gate-in-mcp-delegati-260817-6821"}
```

