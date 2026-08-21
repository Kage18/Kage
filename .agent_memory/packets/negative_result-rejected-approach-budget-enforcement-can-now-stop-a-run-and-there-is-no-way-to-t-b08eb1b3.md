---
type: "Negative Result"
title: "Rejected approach: Budget enforcement can now stop a run, and there is no way to tell it w"
description: "A delegated attempt at \"Budget enforcement can now stop a run, and there is no way to tell it what a run is worth. Make the budget configurable. WHAT HAPPENED, live, eight minutes after budget enforcement merged: a run d"
tags: ["delegated-run", "rejected", "kage-run:budget-enforcement-can-now-stop-a-run-an-260819-9743"]
timestamp: "2026-08-19T08:26:28.832Z"
x-kage-id: "repo:https-github-com-kage-core-kage:negative_result:rejected-approach-budget-enforcement-can-now-stop-a-run-and-there-is-no-way-to-t"
x-kage-type: "negative_result"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
---

# Rejected approach: Budget enforcement can now stop a run, and there is no way to tell it w

> A delegated attempt at "Budget enforcement can now stop a run, and there is no way to tell it what a run is worth. Ma…

A delegated attempt at "Budget enforcement can now stop a run, and there is no way to tell it what a run is worth. Make the budget configurable.

WHAT HAPPENED, live, eight minutes after budget enforcement merged: a run doing a large synthesis task (reading 159 commits to write release notes) was halted by the kernel with "estimated spend $2.32 exceeded the $2.00 budget". The halt itself was correct and the feature worked exactly as designed — worktree intact, both figures named, state "stopped". The problem is what the operator can do about it: nothing.

THE GAP: DEFAULT_RUN_BUDGETS in mcp/delegation/contract.ts is `{ usd: 2, minutes: 30, diff_lines: 400 }`, hardcoded. The DelegationConfig interface in mcp/delegation/config.ts exposes test, diff_budget, strict_verify, max_concurrent and static_checks — and NOTHING for usd or minutes. `kage dispatch` has no budget flag either. So a cap that can now halt work is unconfigurable, and the only way to raise it is to edit and rebuild the source. Enforcement without configuration is a trap: the feature is strictly worse for the user than not enforcing at all, because now their work stops and they have no lever.

Note also that $2 is not a task-aware number. A chore that bumps a version and a chore that reads 159 commits carry the same cap. Whatever you build should let a caller say "this one is worth more" without changing the default for everything.

WHAT TO BUILD:
1. Extend DelegationConfig in mcp/delegation/config.ts with a budgets block that can set usd, minutes and diff_lines, partially — a config that sets only usd must leave the other two at their defaults. Follow the file's existing pattern for reading and defaulting; diff_budget already exists as a separate top-level key, so decide and state whether budgets.diff_lines supersedes it or the two must agree, and do not silently create two sources of truth for the same number.
2. Add a per-dispatch override so one expensive task can be raised without changing the repo default: a `--budget-usd` flag on `kage dispatch` in mcp/cli.ts, and the equivalent optional field on the kage_dispatch MCP tool so the manager can raise it too when a user asks. An explicit override always wins over config, which wins over the default.
3. When a run is halted on budget, the message must tell the operator how to raise it — name the flag or config key. A halt that leaves the user guessing is the same defect one layer up.
4. Surface the effective budget where a run is dispatched, so it is not a surprise only at the halt. One short line is enough.

DO NOT change the default values themselves. $2 stays the default; this task is about making it settable, not about picking a new number.

TESTS — new file mcp/budget-config.test.ts (repo rule: new behaviour gets its own test file; mcp/delegation.test.ts is off-limits). Cover: config budgets override the defaults; a partial config leaves unset fields at their defaults; an explicit per-dispatch override beats config; config beats the hardcoded default; the halt message names the way to raise the limit; and whatever you decided about diff_budget versus budgets.diff_lines is asserted so the two cannot drift into disagreement. Name in your claim which test fails if the change is reverted.

CONSTRAINTS: CommonJS — no import.meta (TS1470), no top-level await. Do not touch CHANGELOG.md — the release notes are being written separately right now.
VERIFY: npm run test --prefix mcp (743 green before your change — use the "npm run test" form) and npm run build --prefix mcp with no "error TS". Run them for real and fill in the claim fence." was rejected.

Reason: Halted on budget at 4.92 USD against the 2.00 default — the unconfigurable budget stopped the run that makes budgets configurable. Its work was complete and correct; the operator verified it by hand (742+12 green, precedence chain checked directly) and merged it outside the claim gate, since the halt came before any claim could be written. Not an agent failure.

Claimed: (no claim)
Branch kept for inspection: kage/budget-enforcement-can-now-stop-a-run-an-260819-9743

# Citations

[1] explicit_capture (2026-08-19T08:26:28.832Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:negative_result:rejected-approach-budget-enforcement-can-now-stop-a-run-and-there-is-no-way-to-t","title":"Rejected approach: Budget enforcement can now stop a run, and there is no way to tell it w","summary":"A delegated attempt at \"Budget enforcement can now stop a run, and there is no way to tell it what a run is worth. Make the budget configurable. WHAT HAPPENED, live, eight minutes after budget enforcement merged: a run d","body":"A delegated attempt at \"Budget enforcement can now stop a run, and there is no way to tell it what a run is worth. Make the budget configurable.\n\nWHAT HAPPENED, live, eight minutes after budget enforcement merged: a run doing a large synthesis task (reading 159 commits to write release notes) was halted by the kernel with \"estimated spend $2.32 exceeded the $2.00 budget\". The halt itself was correct and the feature worked exactly as designed — worktree intact, both figures named, state \"stopped\". The problem is what the operator can do about it: nothing.\n\nTHE GAP: DEFAULT_RUN_BUDGETS in mcp/delegation/contract.ts is `{ usd: 2, minutes: 30, diff_lines: 400 }`, hardcoded. The DelegationConfig interface in mcp/delegation/config.ts exposes test, diff_budget, strict_verify, max_concurrent and static_checks — and NOTHING for usd or minutes. `kage dispatch` has no budget flag either. So a cap that can now halt work is unconfigurable, and the only way to raise it is to edit and rebuild the source. Enforcement without configuration is a trap: the feature is strictly worse for the user than not enforcing at all, because now their work stops and they have no lever.\n\nNote also that $2 is not a task-aware number. A chore that bumps a version and a chore that reads 159 commits carry the same cap. Whatever you build should let a caller say \"this one is worth more\" without changing the default for everything.\n\nWHAT TO BUILD:\n1. Extend DelegationConfig in mcp/delegation/config.ts with a budgets block that can set usd, minutes and diff_lines, partially — a config that sets only usd must leave the other two at their defaults. Follow the file's existing pattern for reading and defaulting; diff_budget already exists as a separate top-level key, so decide and state whether budgets.diff_lines supersedes it or the two must agree, and do not silently create two sources of truth for the same number.\n2. Add a per-dispatch override so one expensive task can be raised without changing the repo default: a `--budget-usd` flag on `kage dispatch` in mcp/cli.ts, and the equivalent optional field on the kage_dispatch MCP tool so the manager can raise it too when a user asks. An explicit override always wins over config, which wins over the default.\n3. When a run is halted on budget, the message must tell the operator how to raise it — name the flag or config key. A halt that leaves the user guessing is the same defect one layer up.\n4. Surface the effective budget where a run is dispatched, so it is not a surprise only at the halt. One short line is enough.\n\nDO NOT change the default values themselves. $2 stays the default; this task is about making it settable, not about picking a new number.\n\nTESTS — new file mcp/budget-config.test.ts (repo rule: new behaviour gets its own test file; mcp/delegation.test.ts is off-limits). Cover: config budgets override the defaults; a partial config leaves unset fields at their defaults; an explicit per-dispatch override beats config; config beats the hardcoded default; the halt message names the way to raise the limit; and whatever you decided about diff_budget versus budgets.diff_lines is asserted so the two cannot drift into disagreement. Name in your claim which test fails if the change is reverted.\n\nCONSTRAINTS: CommonJS — no import.meta (TS1470), no top-level await. Do not touch CHANGELOG.md — the release notes are being written separately right now.\nVERIFY: npm run test --prefix mcp (743 green before your change — use the \"npm run test\" form) and npm run build --prefix mcp with no \"error TS\". Run them for real and fill in the claim fence.\" was rejected.\n\nReason: Halted on budget at 4.92 USD against the 2.00 default — the unconfigurable budget stopped the run that makes budgets configurable. Its work was complete and correct; the operator verified it by hand (742+12 green, precedence chain checked directly) and merged it outside the claim gate, since the halt came before any claim could be written. Not an agent failure.\n\nClaimed: (no claim)\nBranch kept for inspection: kage/budget-enforcement-can-now-stop-a-run-an-260819-9743","type":"negative_result","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","rejected","kage-run:budget-enforcement-can-now-stop-a-run-an-260819-9743"],"paths":[],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-19T08:26:28.832Z"}],"context":{"fact":"A delegated attempt at \"Budget enforcement can now stop a run, and there is no way to tell it what a run is worth. Make the budget configurable."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-19T08:26:28.832Z","path_fingerprints":[],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":2000,"discovery_tokens_estimated":true,"score":74,"reasons":["high-value memory type","has source evidence","tagged","actionable rationale or verification"],"risks":["not grounded to paths"],"duplicate_candidates":[],"estimated_tokens_saved":1027},"created_at":"2026-08-19T08:26:28.832Z","updated_at":"2026-08-20T20:13:09.747Z","author_branch":"release-prep"}
```

