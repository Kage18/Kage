---
type: "Gotcha"
title: "Receipts finally land: a stale-worktree proxy silently discarded every measurement for six days"
description: "This repo reported 'receipts: 0' while the proxy log showed 15 receipts and 1.3M input tokens. Cause: the running proxy was executing /Users/kushaljain/code/Kage/.worktrees/kage vnext implementation/mcp/dist/cli.js — a b"
resource: "mcp/vnext/runtime/proxy-daemon.ts"
tags: ["session-learning"]
timestamp: "2026-07-28T20:33:10.816Z"
x-kage-id: "repo:https-github-com-kage-core-kage:gotcha:receipts-finally-land-a-stale-worktree-proxy-silently-discarded-every-measuremen"
x-kage-type: "gotcha"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "unverified"
x-kage-paths: ["mcp/vnext/runtime/proxy-daemon.ts", "mcp/vnext/runtime/commands.ts"]
---

# Receipts finally land: a stale-worktree proxy silently discarded every measurement for six days

> This repo reported 'receipts: 0' while the proxy log showed 15 receipts and 1.3M input tokens. Cause: the running pro…

This repo reported 'receipts: 0' while the proxy log showed 15 receipts and 1.3M input tokens. Cause: the running proxy was executing /Users/kushaljain/code/Kage/.worktrees/kage-vnext-implementation/mcp/dist/cli.js — a build from six days earlier — bound to the right project but running that checkout's code, so its measurement never reached the current database. kage status reported it as simply 'running in the background'. Fix: kage down then kage up from the current build, plus foreign_build detection in proxyDaemonState so status names a proxy serving from another install. Verified after the fix: kage run -- claude -p '...' produced 2 rows in transformation_receipts and 'attachment: 2 delivered' — the first receipts and first measured injection this repo has ever recorded. Check the executable path of a running daemon before believing any zero it reports.
Evidence: transformation_receipts went 0 -> 2 rows and kage status went 'receipts: 0' -> 'receipts: 2 across 1 task' after restarting the proxy from the current build
Verified by: measured on this repo, 2026-07-28

## Verification

transformation_receipts went 0 -> 2 rows and kage status went 'receipts: 0' -> 'receipts: 2 across 1 task' after restarting the proxy from the current build

# Citations

[1] explicit_capture (2026-07-28T20:33:10.816Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:gotcha:receipts-finally-land-a-stale-worktree-proxy-silently-discarded-every-measuremen","title":"Receipts finally land: a stale-worktree proxy silently discarded every measurement for six days","summary":"This repo reported 'receipts: 0' while the proxy log showed 15 receipts and 1.3M input tokens. Cause: the running proxy was executing /Users/kushaljain/code/Kage/.worktrees/kage vnext implementation/mcp/dist/cli.js — a b","body":"This repo reported 'receipts: 0' while the proxy log showed 15 receipts and 1.3M input tokens. Cause: the running proxy was executing /Users/kushaljain/code/Kage/.worktrees/kage-vnext-implementation/mcp/dist/cli.js — a build from six days earlier — bound to the right project but running that checkout's code, so its measurement never reached the current database. kage status reported it as simply 'running in the background'. Fix: kage down then kage up from the current build, plus foreign_build detection in proxyDaemonState so status names a proxy serving from another install. Verified after the fix: kage run -- claude -p '...' produced 2 rows in transformation_receipts and 'attachment: 2 delivered' — the first receipts and first measured injection this repo has ever recorded. Check the executable path of a running daemon before believing any zero it reports.\nEvidence: transformation_receipts went 0 -> 2 rows and kage status went 'receipts: 0' -> 'receipts: 2 across 1 task' after restarting the proxy from the current build\nVerified by: measured on this repo, 2026-07-28","type":"gotcha","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning"],"paths":["mcp/vnext/runtime/proxy-daemon.ts","mcp/vnext/runtime/commands.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-07-28T20:33:10.816Z"}],"context":{"fact":"This repo reported 'receipts: 0' while the proxy log showed 15 receipts and 1.3M input tokens. Cause: the running proxy was executing /Users/kushaljain/code/Kage/.worktrees/kage-vnext-implementation/mcp/dist/cli.js — a build from six days earlier — bound to the right project but running that checkout's code, so its measurement never reached the current database. kage status reported it as simply 'running in the background'. Fix: kage down then kage up from the current build, plus foreign_build detection in proxyDaemonState so status names a proxy serving from another install. Verified after the fix: kage run -- claude -p '...' produced 2 rows in transformation_receipts and 'attachment: 2 delivered' — the first receipts and first measured injection this repo has ever recorded. Check the executable path of a running daemon before believing any zero it reports.\nEvidence: transformation_receipts went 0 -> 2 rows and kage status went 'receipts: 0' -> 'receipts: 2 across 1 task' after restarting the proxy from the current build\nVerified by: measured on this repo, 2026-07-28","verification":"transformation_receipts went 0 -> 2 rows and kage status went 'receipts: 0' -> 'receipts: 2 across 1 task' after restarting the proxy from the current build"},"freshness":{"ttl_days":365,"last_verified_at":"2026-07-28T20:33:10.816Z","path_fingerprints":[{"path":"mcp/vnext/runtime/proxy-daemon.ts","sha256":"77cb86b30f826b2b47fd2f053780ed0ccfd3305237df51b96b8d4abf5c9a79b2","size":17110,"symbols":[{"name":"proxydaemonstate","kind":"function","sha256":"848e15aedf066808003efe70108a7e4f578ce28feff0ca38a2c2442221631d98"}]},{"path":"mcp/vnext/runtime/commands.ts","sha256":"3ba1c4b515aa8424134db790ce01f85a2ccdc985402179ec7c536319374a5408","size":59365}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":271},"created_at":"2026-07-28T20:33:10.816Z","updated_at":"2026-07-28T20:33:10.816Z","author_branch":"fix/foreign-proxy-build","author_name":"Kushal Jain"}
```

