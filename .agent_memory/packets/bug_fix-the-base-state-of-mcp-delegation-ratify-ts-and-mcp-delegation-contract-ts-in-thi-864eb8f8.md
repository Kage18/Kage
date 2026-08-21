---
type: "Bug Fix"
title: "The base state of mcp/delegation/ratify.ts and mcp/delegation/contract.ts in this workt..."
description: "The base state of mcp/delegation/ratify.ts and mcp/delegation/contract.ts in this worktree was unchanged from before the reference fix landed on kage/fix rejectrun s state gate in mcp delega 260817 fb8b, so the verified "
resource: "mcp/delegation.test.ts"
tags: ["delegated-run", "kage-run:fix-rejectrun-state-gate-in-mcp-delegati-260817-6821"]
timestamp: "2026-08-20T12:42:20.892Z"
x-kage-id: "repo:fix-rejectrun-state-gate-in-mcp-delegati-260817-6821:bug_fix:the-base-state-of-mcp-delegation-ratify-ts-and-mcp-delegation-contract-ts-in-thi"
x-kage-type: "bug_fix"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation.test.ts", "mcp/delegation/contract.ts", "mcp/delegation/ratify.ts"]
---

# The base state of mcp/delegation/ratify.ts and mcp/delegation/contract.ts in this workt...

> The base state of mcp/delegation/ratify.ts and mcp/delegation/contract.ts in this worktree was unchanged from before …

The base state of mcp/delegation/ratify.ts and mcp/delegation/contract.ts in this worktree was unchanged from before the reference fix landed on kage/fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b, so the verified diff applied cleanly with no adaptation needed.

Learned while delivering: Fix rejectRun state gate in mcp/delegation/ratify.ts: a stopped run cannot be rejected. The gate allows only ready and failed; every surface promises rejection for stopped runs (contract.ts decisionText says Stopped - resume or reject; the app shows a Reject button). A VERIFIED working implementation from a previous attempt exists on branch kage/fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b - read it with git show and replicate it faithfully (adapt if the base moved): it allows reject from ready/failed/stopped/dropped (reaping a dropped run to failed first via reapRun), keeps refusing draft/briefed/dispatched/running/verifying/blocked, names the actual state in refusal messages, adds stopped-to-rejected in LEGAL_TRANSITIONS, and adds two regression tests to mcp/delegation.test.ts (stopped run rejects successfully with a captured negative_result packet; running run still refuses with a state-naming message). Success = npm test fully green.
Verified by: npm test --prefix mcp, diff-size, citations

## Verification

npm test --prefix mcp, diff-size, citations

# Citations

[1] explicit_capture (2026-08-17T18:51:15.559Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:fix-rejectrun-state-gate-in-mcp-delegati-260817-6821:bug_fix:the-base-state-of-mcp-delegation-ratify-ts-and-mcp-delegation-contract-ts-in-thi","title":"The base state of mcp/delegation/ratify.ts and mcp/delegation/contract.ts in this workt...","summary":"The base state of mcp/delegation/ratify.ts and mcp/delegation/contract.ts in this worktree was unchanged from before the reference fix landed on kage/fix rejectrun s state gate in mcp delega 260817 fb8b, so the verified ","body":"The base state of mcp/delegation/ratify.ts and mcp/delegation/contract.ts in this worktree was unchanged from before the reference fix landed on kage/fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b, so the verified diff applied cleanly with no adaptation needed.\n\nLearned while delivering: Fix rejectRun state gate in mcp/delegation/ratify.ts: a stopped run cannot be rejected. The gate allows only ready and failed; every surface promises rejection for stopped runs (contract.ts decisionText says Stopped - resume or reject; the app shows a Reject button). A VERIFIED working implementation from a previous attempt exists on branch kage/fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b - read it with git show and replicate it faithfully (adapt if the base moved): it allows reject from ready/failed/stopped/dropped (reaping a dropped run to failed first via reapRun), keeps refusing draft/briefed/dispatched/running/verifying/blocked, names the actual state in refusal messages, adds stopped-to-rejected in LEGAL_TRANSITIONS, and adds two regression tests to mcp/delegation.test.ts (stopped run rejects successfully with a captured negative_result packet; running run still refuses with a state-naming message). Success = npm test fully green.\nVerified by: npm test --prefix mcp, diff-size, citations","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:fix-rejectrun-state-gate-in-mcp-delegati-260817-6821"],"paths":["mcp/delegation.test.ts","mcp/delegation/contract.ts","mcp/delegation/ratify.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-17T18:51:15.559Z"}],"context":{"fact":"The base state of mcp/delegation/ratify.ts and mcp/delegation/contract.ts in this worktree was unchanged from before the reference fix landed on kage/fix-rejectrun-s-state-gate-in-mcp-delega-260817-fb8b, so the verified diff applied cleanly with no adaptation needed.","verification":"npm test --prefix mcp, diff-size, citations"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-20T12:42:20.892Z","path_fingerprints":[{"path":"mcp/delegation.test.ts","sha256":"d2c723245ac8bdbea9a3578263af3586a8846d690955408435134074cabcfe20","size":117510,"symbols":[{"name":"learned","kind":"constant","sha256":"86a9cef845cb3f653282806e5a05f474fd9c20f4ad4af48ec5d031f762c896d5"},{"name":"ready","kind":"constant","sha256":"7de0a7fcd74fe8631c4de1414d6f2f0f22c3c86f5165a71f67f9068602e49d08"},{"name":"state","kind":"constant","sha256":"9ab61b8844cbc59b085101b723c75f8cc5dffc975343d4900666650f818b6ca7"}]},{"path":"mcp/delegation/contract.ts","sha256":"b00fed2868c1a4c64be39b8d82e4b49a7414c7f2eb1c9e6b5cd561c954f03891","size":50356,"symbols":[{"name":"legal_transitions","kind":"constant","sha256":"f64f1cbe99ca047f8a6d9c204e9190e8a5cedd7a3ca4d742e02deb060f79823c"},{"name":"needed","kind":"constant","sha256":"a3b91d52a820aa557b45d115cceaa93a3d3db344c5fbe63006f01df0cca0a3db"},{"name":"prefix","kind":"constant","sha256":"d0c83c86f4e94d7a484b3325b54d1c90e1c6fc37b342a4cf7d3c33dd33dfb85a"},{"name":"runs","kind":"constant","sha256":"aeed515a96dc123ddceac928842184b148f9bbd85f63bccbb0918926221c95e2"},{"name":"landed","kind":"constant","sha256":"3e19a870b6dec4f97f9d4e85f8243f8e83c1dcce8c300d2c36d0c3de599cc753"},{"name":"reaprun","kind":"function","sha256":"c65240ad87675bf6a8fdfc13efd8acfe69b0fed53bdc3b8eba549ba7c7bdc94a"},{"name":"from","kind":"constant","sha256":"bd2200c07292af9f1ac297cdf2d079dea9c17bd2c3ee4d9522b7a3bb5c07a013"}]},{"path":"mcp/delegation/ratify.ts","sha256":"b170f3c4876273f7d83f944f9af7723531e8d658afca0d41555895dba2457c6b","size":16910,"symbols":[{"name":"packet","kind":"constant","sha256":"1334c6233d0f856bc34455a4656eadc87ed9bc526ea83335977aa958d235c764"},{"name":"base","kind":"constant","sha256":"9e9ae19b97ecc0a8e39a611a2fdf05b50eea3ca8b3d62da6d877aac115bc502f"},{"name":"rejectrun","kind":"function","sha256":"2172a858fe64b17636a4573a42a7735df5bb96c2c6eb283bcd62972a1b7287bd"},{"name":"captured","kind":"constant","sha256":"b1b5a34146d832ba17326157205fd49c6aed46b0550b618568fdb882817c8a2c"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":328,"unresolved_symbols":["decisionText"],"reverified_at":"2026-08-20T12:42:20.892Z","stale":true,"stale_reasons":["linked path changed since memory was verified: mcp/delegation/contract.ts"],"suggested_action":"update"},"created_at":"2026-08-17T18:51:15.559Z","updated_at":"2026-08-21T08:54:05.690Z","author_branch":"kage/fix-rejectrun-state-gate-in-mcp-delegati-260817-6821"}
```

