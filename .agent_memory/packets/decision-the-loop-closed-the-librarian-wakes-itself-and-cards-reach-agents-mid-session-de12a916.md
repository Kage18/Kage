---
type: "Decision"
title: "The loop closed: the Librarian wakes itself, and cards reach agents mid-session"
description: "Phase 1 of DIRECTION.md is done and measured from the packaged app: librarian run receipts 23 the desktop timer calling watcher.distillIdleSessions with no human command , 3 cards distilled from one real Claude Code sess"
resource: "mcp/vnext/librarian/watcher.ts"
tags: ["librarian", "phase1", "dogfood"]
timestamp: "2026-08-04T19:07:21.049Z"
x-kage-id: "repo:https-github-com-kage-core-kage:decision:the-loop-closed-the-librarian-wakes-itself-and-cards-reach-agents-mid-session-17"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "unverified"
x-kage-paths: ["mcp/vnext/librarian/watcher.ts", "mcp/vnext/librarian/schedule.ts", "mcp/vnext/librarian/mcp-tools.ts", "mcp/vnext/librarian/hook.ts"]
---

# The loop closed: the Librarian wakes itself, and cards reach agents mid-session

> Phase 1 of DIRECTION.md is done and measured from the packaged app: librarian run receipts 23 the desktop timer calli…

Phase 1 of DIRECTION.md is done and measured from the packaged app: librarian_run receipts 23 (the desktop timer calling watcher.distillIdleSessions with no human command), 3 cards distilled from one real Claude Code session transcript, ~87% of sessions correctly triaged to nothing. kage_cards_recall serves cards to an agent and RE-AUDITS trust at serve time rather than trusting the stored verify flag, because a card can go stale between sweeps. The pre-edit hook fires on Edit/Write/MultiEdit and is silent when nothing matches, which is the common case. Reconciliation is shared between session distillation and mining, so re-mining reports 'already known' instead of refilling the Inbox. Store composition on this repo: 10 mined + 19 imported + 3 session-distilled.

# Citations

[1] explicit_capture (2026-08-04T19:07:21.049Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:decision:the-loop-closed-the-librarian-wakes-itself-and-cards-reach-agents-mid-session-17","title":"The loop closed: the Librarian wakes itself, and cards reach agents mid-session","summary":"Phase 1 of DIRECTION.md is done and measured from the packaged app: librarian run receipts 23 the desktop timer calling watcher.distillIdleSessions with no human command , 3 cards distilled from one real Claude Code sess","body":"Phase 1 of DIRECTION.md is done and measured from the packaged app: librarian_run receipts 23 (the desktop timer calling watcher.distillIdleSessions with no human command), 3 cards distilled from one real Claude Code session transcript, ~87% of sessions correctly triaged to nothing. kage_cards_recall serves cards to an agent and RE-AUDITS trust at serve time rather than trusting the stored verify flag, because a card can go stale between sweeps. The pre-edit hook fires on Edit/Write/MultiEdit and is silent when nothing matches, which is the common case. Reconciliation is shared between session distillation and mining, so re-mining reports 'already known' instead of refilling the Inbox. Store composition on this repo: 10 mined + 19 imported + 3 session-distilled.","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["librarian","phase1","dogfood"],"paths":["mcp/vnext/librarian/watcher.ts","mcp/vnext/librarian/schedule.ts","mcp/vnext/librarian/mcp-tools.ts","mcp/vnext/librarian/hook.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-04T19:07:21.049Z"}],"context":{"fact":"Phase 1 of DIRECTION.md is done and measured from the packaged app: librarian_run receipts 23 (the desktop timer calling watcher.distillIdleSessions with no human command), 3 cards distilled from one real Claude Code session transcript, ~87% of sessions correctly triaged to nothing. kage_cards_recall serves cards to an agent and RE-AUDITS trust at serve time rather than trusting the stored verify flag, because a card can go stale between sweeps. The pre-edit hook fires on Edit/Write/MultiEdit and is silent when nothing matches, which is the common case. Reconciliation is shared between session distillation and mining, so re-mining reports 'already known' instead of refilling the Inbox. Store composition on this repo: 10 mined + 19 imported + 3 session-distilled."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-04T19:07:21.049Z","path_fingerprints":[{"path":"mcp/vnext/librarian/watcher.ts","sha256":"32c9b9c242c350e3f33873538c1e24435e43f962d222887e60113dc419d3790b","size":11078,"symbols":[{"name":"distillidlesessions","kind":"function","sha256":"704bc7cf15f66354e14e33995d327128985caed8e49eb8e200ea134e3edb37ce"}]},{"path":"mcp/vnext/librarian/schedule.ts","sha256":"9ad0b0b7b95acc2c4d83c2b1cf3cc8ab4d5f685d0521e0fec3863bbad753ce9f","size":7617},{"path":"mcp/vnext/librarian/mcp-tools.ts","sha256":"3d0509fcc64355efdb9fae5dbc385838ce8329ea0be9bfcea0e0d13318856b39","size":26669},{"path":"mcp/vnext/librarian/hook.ts","sha256":"2ea3e687ac736498f0bc7f28a910b1cfbc29436b202b81f845c5e203c97576e8","size":17174}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":193},"created_at":"2026-08-04T19:07:21.049Z","updated_at":"2026-08-04T19:07:21.049Z","author_branch":"fix/foreign-proxy-build","author_name":"Kushal Jain"}
```

