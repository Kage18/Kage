---
type: "Decision"
title: "'Close as landed' (mcp/delegation/app-client.ts closeLanded button, run.branch_landed f..."
description: "'Close as landed' mcp/delegation/app client.ts closeLanded button, run.branch landed field from mcp/delegation/contract.ts's isBranchLanded/mcp/delegation/api.ts is the feature name for marking a stopped/failed run's rec"
resource: "CHANGELOG.md"
tags: ["delegated-run", "kage-run:write-the-release-notes-for-v3-2-0-in-ch-260821-4fd7"]
timestamp: "2026-08-21T08:17:42.425Z"
x-kage-id: "repo:write-the-release-notes-for-v3-2-0-in-ch-260821-4fd7:decision:close-as-landed-mcp-delegation-app-client-ts-closelanded-button-run-branch-lande"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["CHANGELOG.md"]
---

# 'Close as landed' (mcp/delegation/app-client.ts closeLanded button, run.branch_landed f...

> 'Close as landed' mcp/delegation/app client.ts closeLanded button, run.branch landed field from mcp/delegation/contra…

'Close as landed' (mcp/delegation/app-client.ts closeLanded button, run.branch_landed field from mcp/delegation/contract.ts's isBranchLanded/mcp/delegation/api.ts) is the feature name for marking a stopped/failed run's record honest when its branch is already an ancestor of HEAD — it reuses the existing 'reject' transition rather than a new one.

Learned while delivering: Write the release notes for v3.2.0 in CHANGELOG.md. Follow the file's existing convention exactly: entries are '## vX.Y.Z — short human title' followed by bold-led bullets that say what a USER can now do, not what a file contains; match the voice of the existing entries; the last entry is v3.1.0, and mcp/package.json is at 3.2.0. Cover everything landed on release-prep since v3.1.0 (git log v3.1.0..HEAD or since 2026-08-17 if the tag is absent) — the big arcs are: the delegation orchestrator (intent → memory-compiled brief → worktree run → kernel re-executes checks → merge ratifies learnings), the sessions/board/room app surfaces with take-over and hand-back, goal continuity with waves and dispatch, recovery (resume-run with budget raise, adopt, close-as-landed, stall detector, tree-kill), the review gate (opt-in reviewing/approved/changes_requested), the memory store on node:sqlite with FTS5 (markdown packets stay source of truth) and published benchmarks including the missed warm-index target stated honestly, verification honesty guards (merge refuses empty feature diffs, citation splitting, budgets with usd circuit breaker), the redesigned website (docs/index.html case-file page), the app design pass (palette, light theme, first-open, dialog replacements), desktop shell auto-update via electron-updater with dmg+zip+latest-mac.yml and the ad-hoc notify-only degrade. Keep it honest: no metric that is not in the repo, label estimates, do not invent user counts. Keep the entry scannable — one entry, tight bullets grouped by arc, not one bullet per commit. Cite files individually in your claim.
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-21T08:17:42.425Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:write-the-release-notes-for-v3-2-0-in-ch-260821-4fd7:decision:close-as-landed-mcp-delegation-app-client-ts-closelanded-button-run-branch-lande","title":"'Close as landed' (mcp/delegation/app-client.ts closeLanded button, run.branch_landed f...","summary":"'Close as landed' mcp/delegation/app client.ts closeLanded button, run.branch landed field from mcp/delegation/contract.ts's isBranchLanded/mcp/delegation/api.ts is the feature name for marking a stopped/failed run's rec","body":"'Close as landed' (mcp/delegation/app-client.ts closeLanded button, run.branch_landed field from mcp/delegation/contract.ts's isBranchLanded/mcp/delegation/api.ts) is the feature name for marking a stopped/failed run's record honest when its branch is already an ancestor of HEAD — it reuses the existing 'reject' transition rather than a new one.\n\nLearned while delivering: Write the release notes for v3.2.0 in CHANGELOG.md. Follow the file's existing convention exactly: entries are '## vX.Y.Z — short human title' followed by bold-led bullets that say what a USER can now do, not what a file contains; match the voice of the existing entries; the last entry is v3.1.0, and mcp/package.json is at 3.2.0. Cover everything landed on release-prep since v3.1.0 (git log v3.1.0..HEAD or since 2026-08-17 if the tag is absent) — the big arcs are: the delegation orchestrator (intent → memory-compiled brief → worktree run → kernel re-executes checks → merge ratifies learnings), the sessions/board/room app surfaces with take-over and hand-back, goal continuity with waves and dispatch, recovery (resume-run with budget raise, adopt, close-as-landed, stall detector, tree-kill), the review gate (opt-in reviewing/approved/changes_requested), the memory store on node:sqlite with FTS5 (markdown packets stay source of truth) and published benchmarks including the missed warm-index target stated honestly, verification honesty guards (merge refuses empty feature diffs, citation splitting, budgets with usd circuit breaker), the redesigned website (docs/index.html case-file page), the app design pass (palette, light theme, first-open, dialog replacements), desktop shell auto-update via electron-updater with dmg+zip+latest-mac.yml and the ad-hoc notify-only degrade. Keep it honest: no metric that is not in the repo, label estimates, do not invent user counts. Keep the entry scannable — one entry, tight bullets grouped by arc, not one bullet per commit. Cite files individually in your claim.\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:write-the-release-notes-for-v3-2-0-in-ch-260821-4fd7"],"paths":["CHANGELOG.md"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T08:17:42.425Z"}],"context":{"fact":"'Close as landed' (mcp/delegation/app-client.ts closeLanded button, run.branch_landed field from mcp/delegation/contract.ts's isBranchLanded/mcp/delegation/api.ts) is the feature name for marking a stopped/failed run's record honest when its branch is already an ancestor of HEAD — it reuses the existing 'reject' transition rather than a new one.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T08:17:42.425Z","path_fingerprints":[{"path":"CHANGELOG.md","sha256":"8478ea867bd11c3fd6e80bbf9ab691e26e43b9beb876727489ad1ef847baa86f","size":66493}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":94,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":526},"created_at":"2026-08-21T08:17:42.425Z","updated_at":"2026-08-21T08:54:05.738Z","author_branch":"kage/write-the-release-notes-for-v3-2-0-in-ch-260821-4fd7"}
```

