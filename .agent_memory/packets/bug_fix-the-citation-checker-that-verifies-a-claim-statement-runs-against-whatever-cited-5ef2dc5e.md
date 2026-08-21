---
type: "Bug Fix"
title: "The citation checker that verifies a claim statement runs against whatever citedPaths i..."
description: "The citation checker that verifies a claim statement runs against whatever citedPaths implementation is currently installed, not the worktree's edited version — so a claim describing a citedPaths false positive fix must "
resource: "mcp/delegation.test.ts"
tags: ["delegated-run", "kage-run:mcp-delegation-verify-ts-citedpaths-trea-260818-2d31"]
timestamp: "2026-08-18T10:02:04.172Z"
x-kage-id: "repo:mcp-delegation-verify-ts-citedpaths-trea-260818-2d31:bug_fix:the-citation-checker-that-verifies-a-claim-statement-runs-against-whatever-cited"
x-kage-type: "bug_fix"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation.test.ts"]
---

# The citation checker that verifies a claim statement runs against whatever citedPaths i...

> The citation checker that verifies a claim statement runs against whatever citedPaths implementation is currently ins…

The citation checker that verifies a claim statement runs against whatever citedPaths implementation is currently installed, not the worktree's edited version — so a claim describing a citedPaths false-positive fix must not literally reproduce the offending example string in its own prose, or the pre-fix checker (or a stale one) will flag that string as a missing cited path and fail the claim on the very bug it's fixing.

Learned while delivering: mcp/delegation/verify.ts citedPaths treats ANY slash-joined token in claim prose as a cited file path, so ordinary prose fails the citation check — it has killed three otherwise-green runs on tokens like state.room/state.pty (an identifier pair) and .agent_memory/runs/room-mcp.json (a runtime artifact never present in a worktree). Tighten citedPaths so it only claims a token is a cited path when it has a real file extension on its final segment or starts with a known repo top-level prefix (mcp/, docs/, shell/, evals/, alias/), and explicitly ignore anything under .agent_memory/ since those are Kage's own runtime artifacts, not agent-cited sources. Keep it strict for genuine source citations: a claim naming a real repo path that does not exist in the worktree must still fail. Add regression tests for the false-positive cases plus the still-fails-on-real-missing-path case. Scope your edits to mcp/delegation/verify.ts; add tests to mcp/delegation.test.ts in a clearly separated block near the END of the file (a companion run is adding unrelated tests to the same file in parallel — minimize hunk overlap so both can merge cleanly). Note: two prior attempts at this exact fix failed for infrastructure reasons (git lock contention under 5-way parallel load, and an unrelated flaky room/pty timing test) — the approach itself is sound and wanted.
Verified by: npm test --prefix mcp, diff-size, citations

## Verification

npm test --prefix mcp, diff-size, citations

# Citations

[1] explicit_capture (2026-08-18T10:02:04.172Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:mcp-delegation-verify-ts-citedpaths-trea-260818-2d31:bug_fix:the-citation-checker-that-verifies-a-claim-statement-runs-against-whatever-cited","title":"The citation checker that verifies a claim statement runs against whatever citedPaths i...","summary":"The citation checker that verifies a claim statement runs against whatever citedPaths implementation is currently installed, not the worktree's edited version — so a claim describing a citedPaths false positive fix must ","body":"The citation checker that verifies a claim statement runs against whatever citedPaths implementation is currently installed, not the worktree's edited version — so a claim describing a citedPaths false-positive fix must not literally reproduce the offending example string in its own prose, or the pre-fix checker (or a stale one) will flag that string as a missing cited path and fail the claim on the very bug it's fixing.\n\nLearned while delivering: mcp/delegation/verify.ts citedPaths treats ANY slash-joined token in claim prose as a cited file path, so ordinary prose fails the citation check — it has killed three otherwise-green runs on tokens like state.room/state.pty (an identifier pair) and .agent_memory/runs/room-mcp.json (a runtime artifact never present in a worktree). Tighten citedPaths so it only claims a token is a cited path when it has a real file extension on its final segment or starts with a known repo top-level prefix (mcp/, docs/, shell/, evals/, alias/), and explicitly ignore anything under .agent_memory/ since those are Kage's own runtime artifacts, not agent-cited sources. Keep it strict for genuine source citations: a claim naming a real repo path that does not exist in the worktree must still fail. Add regression tests for the false-positive cases plus the still-fails-on-real-missing-path case. Scope your edits to mcp/delegation/verify.ts; add tests to mcp/delegation.test.ts in a clearly separated block near the END of the file (a companion run is adding unrelated tests to the same file in parallel — minimize hunk overlap so both can merge cleanly). Note: two prior attempts at this exact fix failed for infrastructure reasons (git lock contention under 5-way parallel load, and an unrelated flaky room/pty timing test) — the approach itself is sound and wanted.\nVerified by: npm test --prefix mcp, diff-size, citations","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:mcp-delegation-verify-ts-citedpaths-trea-260818-2d31"],"paths":["mcp/delegation.test.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-18T10:02:04.172Z"}],"context":{"fact":"The citation checker that verifies a claim statement runs against whatever citedPaths implementation is currently installed, not the worktree's edited version — so a claim describing a citedPaths false-positive fix must not literally reproduce the offending example string in its own prose, or the pre-fix checker (or a stale one) will flag that string as a missing cited path and fail the claim on the very bug it's fixing.","verification":"npm test --prefix mcp, diff-size, citations"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-18T10:02:04.172Z","path_fingerprints":[{"path":"mcp/delegation.test.ts","sha256":"152e873e7a7dcd310e8fdf29a0ff37fe6e6edaf46df5c384bca0193191d5aaf2","size":103501,"symbols":[{"name":"note","kind":"constant","sha256":"6c26a18dfd08c24363108821a1c3fed84269cfc7173ae8a0133d75404a406491"},{"name":"learned","kind":"constant","sha256":"86a9cef845cb3f653282806e5a05f474fd9c20f4ad4af48ec5d031f762c896d5"},{"name":"room","kind":"constant","sha256":"c96a3f56d0153a4fae870a9a880b69e94c83d84117702e4748b7389be1ef9f06"},{"name":"merge","kind":"constant","sha256":"ceb4a3db8416ae4be041c9291af38bb10c36b9a646865f9e689bfeefae6dfaee"},{"name":"path","kind":"constant","sha256":"888820b6044bfabb5df017b0dd223fe59b284dc6c451e601660d3e63655f794b"},{"name":"edited","kind":"constant","sha256":"78b8d192b752a9351799986abcf6d1a0fa3cc5716f776bf3929072b9f6ba5437"},{"name":"state","kind":"constant","sha256":"9ab61b8844cbc59b085101b723c75f8cc5dffc975343d4900666650f818b6ca7"},{"name":"ignore","kind":"constant","sha256":"98d38226c68d15573b0cb5ee1152708b089cf37c74e9247f9de2c7b353587421"},{"name":"flaky","kind":"constant","sha256":"29ac3c073a7aea9b76eb3f883c2c2a941e57f235ac60ae79fdc9dedf5dbbb8c9"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":94,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":467},"created_at":"2026-08-18T10:02:04.172Z","updated_at":"2026-08-20T20:13:09.632Z","author_branch":"kage/mcp-delegation-verify-ts-citedpaths-trea-260818-2d31"}
```

