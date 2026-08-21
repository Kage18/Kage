---
type: "Decision"
title: "contract.ts documents a real historical bug (now fixed, DEFAULT_RUN_BUDGET_USD raised t..."
description: "contract.ts documents a real historical bug now fixed, DEFAULT RUN BUDGET USD raised to 50 : api.ts's direct createRun call skipped dispatch.ts's effectiveBudgets /configuredBudgets and stamped runs with a bare $2 circui"
tags: ["delegated-run", "kage-run:investigate-why-chore-type-runs-verify-l-260821-c3b9"]
timestamp: "2026-08-21T17:59:33.356Z"
x-kage-id: "repo:investigate-why-chore-type-runs-verify-l-260821-c3b9:decision:contract-ts-documents-a-real-historical-bug-now-fixed-default-run-budget-usd-rai"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
---

# contract.ts documents a real historical bug (now fixed, DEFAULT_RUN_BUDGET_USD raised t...

> contract.ts documents a real historical bug now fixed, DEFAULT RUN BUDGET USD raised to 50 : api.ts's direct createRu…

contract.ts documents a real historical bug (now fixed, DEFAULT_RUN_BUDGET_USD raised to 50): api.ts's direct createRun call skipped dispatch.ts's effectiveBudgets()/configuredBudgets() and stamped runs with a bare $2 circuit-breaker budget regardless of .agent_memory/config.json's real budget — several 08-12→08-19 runs across all types (not chore-specific) carry budgets.usd===2, and at least one chore run (a 159-commit release-notes task) was killed by this stale $2 cap before a retry with the correct $40 budget succeeded.

Learned while delivering: Investigate why chore-type runs verify less reliably than feature/bugfix runs (8/15 vs 43/45 and 44/57) — find the pattern across failed chore claims and report root causes
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-21T17:59:33.356Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:investigate-why-chore-type-runs-verify-l-260821-c3b9:decision:contract-ts-documents-a-real-historical-bug-now-fixed-default-run-budget-usd-rai","title":"contract.ts documents a real historical bug (now fixed, DEFAULT_RUN_BUDGET_USD raised t...","summary":"contract.ts documents a real historical bug now fixed, DEFAULT RUN BUDGET USD raised to 50 : api.ts's direct createRun call skipped dispatch.ts's effectiveBudgets /configuredBudgets and stamped runs with a bare $2 circui","body":"contract.ts documents a real historical bug (now fixed, DEFAULT_RUN_BUDGET_USD raised to 50): api.ts's direct createRun call skipped dispatch.ts's effectiveBudgets()/configuredBudgets() and stamped runs with a bare $2 circuit-breaker budget regardless of .agent_memory/config.json's real budget — several 08-12→08-19 runs across all types (not chore-specific) carry budgets.usd===2, and at least one chore run (a 159-commit release-notes task) was killed by this stale $2 cap before a retry with the correct $40 budget succeeded.\n\nLearned while delivering: Investigate why chore-type runs verify less reliably than feature/bugfix runs (8/15 vs 43/45 and 44/57) — find the pattern across failed chore claims and report root causes\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:investigate-why-chore-type-runs-verify-l-260821-c3b9"],"paths":[],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T17:59:33.356Z"}],"context":{"fact":"contract.ts documents a real historical bug (now fixed, DEFAULT_RUN_BUDGET_USD raised to 50): api.ts's direct createRun call skipped dispatch.ts's effectiveBudgets()/configuredBudgets() and stamped runs with a bare $2 circuit-breaker budget regardless of .agent_memory/config.json's real budget — several 08-12→08-19 runs across all types (not chore-specific) carry budgets.usd===2, and at least one chore run (a 159-commit release-notes task) was killed by this stale $2 cap before a retry with the correct $40 budget succeeded.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T17:59:33.356Z","path_fingerprints":[],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":84,"reasons":["high-value memory type","has source evidence","tagged","concise but substantive","actionable rationale or verification"],"risks":["not grounded to paths"],"duplicate_candidates":[],"estimated_tokens_saved":210},"created_at":"2026-08-21T17:59:33.356Z","updated_at":"2026-08-21T19:46:22.757Z","author_branch":"kage/investigate-why-chore-type-runs-verify-l-260821-c3b9"}
```

