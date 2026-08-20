---
type: "Bug Fix"
title: "CLI-dispatched runs now detach and survive the launching shell"
description: "A run dispatched from the CLI no longer dies when its launching shell exits. dispatch.ts spawns the supervisor with detached: true and calls child.unref , and the run record carries supervisor pid, so the agent outlives"
resource: "mcp/delegation/dispatch.ts"
tags: ["session-learning", "dispatch", "detach", "supervisor", "orphaned-runs"]
timestamp: "2026-08-19T14:31:51.477Z"
x-kage-id: "repo:https-github-com-kage-core-kage:bug_fix:cli-dispatched-runs-now-detach-and-survive-the-launching-shell-1787149911477"
x-kage-type: "bug_fix"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation/dispatch.ts", "mcp/delegation/supervisor.ts"]
---

# CLI-dispatched runs now detach and survive the launching shell

> A run dispatched from the CLI no longer dies when its launching shell exits. dispatch.ts spawns the supervisor with d…

A run dispatched from the CLI no longer dies when its launching shell exits. dispatch.ts spawns the supervisor with detached: true and calls child.unref(), and the run record carries supervisor_pid, so the agent outlives the terminal that started it. An earlier packet recorded the opposite (no detach, no supervisor_pid) and that gap is closed — it should not be used to justify wrapping dispatch in nohup or a long-lived shell. The state-note vocabulary in the same file now says "handing off to a detached supervisor" for the briefed and dispatched states, which is the user-visible half of the same fix.
Evidence: mcp/delegation/dispatch.ts line 383 sets detached: true and line 386 calls child.unref(). Live runs dispatched from the app this session carry a populated supervisor_pid in task.json (for example supervisor_pid 56835 on fix-the-resumed-manager-permission-trap-260819-1bc4 while running).
Verified by: Read of mcp/delegation/dispatch.ts:383-386 plus supervisor_pid present on three concurrently running runs' task.json

## Verification

mcp/delegation/dispatch.ts line 383 sets detached: true and line 386 calls child.unref(). Live runs dispatched from the app this session carry a populated supervisor_pid in task.json (for example supervisor_pid 56835 on fix-the-resumed-manager-permission-trap-260819-1bc4 while running).

# Citations

[1] explicit_capture (2026-08-19T14:31:51.477Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:bug_fix:cli-dispatched-runs-now-detach-and-survive-the-launching-shell-1787149911477","title":"CLI-dispatched runs now detach and survive the launching shell","summary":"A run dispatched from the CLI no longer dies when its launching shell exits. dispatch.ts spawns the supervisor with detached: true and calls child.unref , and the run record carries supervisor pid, so the agent outlives","body":"A run dispatched from the CLI no longer dies when its launching shell exits. dispatch.ts spawns the supervisor with detached: true and calls child.unref(), and the run record carries supervisor_pid, so the agent outlives the terminal that started it. An earlier packet recorded the opposite (no detach, no supervisor_pid) and that gap is closed — it should not be used to justify wrapping dispatch in nohup or a long-lived shell. The state-note vocabulary in the same file now says \"handing off to a detached supervisor\" for the briefed and dispatched states, which is the user-visible half of the same fix.\nEvidence: mcp/delegation/dispatch.ts line 383 sets detached: true and line 386 calls child.unref(). Live runs dispatched from the app this session carry a populated supervisor_pid in task.json (for example supervisor_pid 56835 on fix-the-resumed-manager-permission-trap-260819-1bc4 while running).\nVerified by: Read of mcp/delegation/dispatch.ts:383-386 plus supervisor_pid present on three concurrently running runs' task.json","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","dispatch","detach","supervisor","orphaned-runs"],"paths":["mcp/delegation/dispatch.ts","mcp/delegation/supervisor.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-19T14:31:51.477Z"}],"context":{"fact":"A run dispatched from the CLI no longer dies when its launching shell exits. dispatch.ts spawns the supervisor with detached: true and calls child.unref(), and the run record carries supervisor_pid, so the agent outlives the terminal that started it. An earlier packet recorded the opposite (no detach, no supervisor_pid) and that gap is closed — it should not be used to justify wrapping dispatch in nohup or a long-lived shell. The state-note vocabulary in the same file now says \"handing off to a detached supervisor\" for the briefed and dispatched states, which is the user-visible half of the same fix.\nEvidence: mcp/delegation/dispatch.ts line 383 sets detached: true and line 386 calls child.unref(). Live runs dispatched from the app this session carry a populated supervisor_pid in task.json (for example supervisor_pid 56835 on fix-the-resumed-manager-permission-trap-260819-1bc4 while running).\nVerified by: Read of mcp/delegation/dispatch.ts:383-386 plus supervisor_pid present on three concurrently running runs' task.json","verification":"mcp/delegation/dispatch.ts line 383 sets detached: true and line 386 calls child.unref(). Live runs dispatched from the app this session carry a populated supervisor_pid in task.json (for example supervisor_pid 56835 on fix-the-resumed-manager-permission-trap-260819-1bc4 while running)."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-19T14:31:51.477Z","path_fingerprints":[{"path":"mcp/delegation/dispatch.ts","sha256":"72dd2dade685c5420b689738d29eb6716583849beeefdc14d7f4f8eb860ddb06","size":20556,"symbols":[{"name":"record","kind":"constant","sha256":"358ba0c5b6d9bfd51109f2ed82f8365cc54e53c2d6cbd1bbd312888223b513e3"},{"name":"briefed","kind":"constant","sha256":"796cbb4705985cc764df3e974c56acf4109b9caa4556792f4fd1c78da08e8b31"},{"name":"note","kind":"constant","sha256":"4eaf5ff8f2f09996a0f6ee220fd087f6ffbe730ba3d55fc5bf1341faf1f5bff6"},{"name":"child","kind":"constant","sha256":"68c1caa400576314325234ddd7f8110340ad992e5669bda240186645b36c456e"}]},{"path":"mcp/delegation/supervisor.ts","sha256":"a4c2083d423aae958a91b1b2437271d5fa14258a50e435e48a7458d4ed1ea79d","size":26132,"symbols":[{"name":"task","kind":"constant","sha256":"85f8a3124cd54be2d855713df25f16201af7f8bd479bd55ac37f1f399bd11753"},{"name":"state","kind":"constant","sha256":"74ff1664f384b9305eedf989c0d85f9eb9f5142fd6d024b00630476f177a9c6e"},{"name":"child","kind":"constant","sha256":"5721bb1c9d8a1466f95c83d918930a72466e963d14d7efa461c7d82cf4c57a4d"},{"name":"record","kind":"constant","sha256":"42b464544b1bbb3bece105cafedc2bb1d102343181ac99a5f20ce3461a94ce34"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[{"relation":"supersedes","to":"repo:https-github-com-kage-core-kage:gotcha:a-cli-dispatched-run-dies-with-the-shell-that-launched-it-no-supervisor-pid-no-d","evidence":"Fixed: dispatch.ts:383-386 spawns detached and calls child.unref(); live runs carry supervisor_pid.","created_at":"2026-08-19T14:32:23.898Z"}],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":259},"created_at":"2026-08-19T14:31:51.477Z","updated_at":"2026-08-19T14:32:23.898Z","author_branch":"release-prep"}
```

