---
type: "Negative Result"
title: "Rejected approach: Two small Room polish fixes, both reproduced today: (1) CHAT OPENS AT T"
description: "A delegated attempt at \"Two small Room polish fixes, both reproduced today: 1 CHAT OPENS AT THE TOP — reloading the app shows the oldest turns; the thread must open pinned to the NEWEST turn scroll the thread pane to bot"
tags: ["delegated-run", "rejected", "kage-run:two-small-room-polish-fixes-both-reprodu-260821-a974"]
timestamp: "2026-08-21T19:12:15.666Z"
x-kage-id: "repo:https-github-com-kage-core-kage:negative_result:rejected-approach-two-small-room-polish-fixes-both-reproduced-today-1-chat-opens"
x-kage-type: "negative_result"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
---

# Rejected approach: Two small Room polish fixes, both reproduced today: (1) CHAT OPENS AT T

> A delegated attempt at "Two small Room polish fixes, both reproduced today: 1 CHAT OPENS AT THE TOP — reloading the a…

A delegated attempt at "Two small Room polish fixes, both reproduced today: (1) CHAT OPENS AT THE TOP — reloading the app shows the oldest turns; the thread must open pinned to the NEWEST turn (scroll the thread pane to bottom on initial render and after switching back to the Chat tab; keep the user's scroll position during a session — only pin on entry, and stay pinned when already at bottom while new turns stream in, standard chat behavior); (2) COLD-PTY IDENTITY WINDOW — resolvePtyReply's PTY_IDENTITY_POLL_TIMEOUT_MS is 5000ms, but a cold claude pty takes 10-20s to boot and write its native jsonl, so first messages on a fresh pty always deflect; raise the poll window to 20000ms (poll interval stays 300ms) and make sure the overall ask deadline still exceeds it. Presentation/behavior only in mcp/delegation/app-client.ts and the one constant in mcp/delegation/api.ts; keep every test green (adjust only tests that assert the old constant); template-literal constraints; cite files individually." was rejected.

Reason: The 5s-to-20s identity poll raise hangs the pty test suite in real time (three 1200s timeouts, zero contention on the last two). Redo routed through the injectable wait seam so tests stay fast.

Claimed: work delivered — see diff (agent skipped the kage-claim-v1 fence)
Branch kept for inspection: kage/two-small-room-polish-fixes-both-reprodu-260821-a974

# Citations

[1] explicit_capture (2026-08-21T19:12:15.666Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:negative_result:rejected-approach-two-small-room-polish-fixes-both-reproduced-today-1-chat-opens","title":"Rejected approach: Two small Room polish fixes, both reproduced today: (1) CHAT OPENS AT T","summary":"A delegated attempt at \"Two small Room polish fixes, both reproduced today: 1 CHAT OPENS AT THE TOP — reloading the app shows the oldest turns; the thread must open pinned to the NEWEST turn scroll the thread pane to bot","body":"A delegated attempt at \"Two small Room polish fixes, both reproduced today: (1) CHAT OPENS AT THE TOP — reloading the app shows the oldest turns; the thread must open pinned to the NEWEST turn (scroll the thread pane to bottom on initial render and after switching back to the Chat tab; keep the user's scroll position during a session — only pin on entry, and stay pinned when already at bottom while new turns stream in, standard chat behavior); (2) COLD-PTY IDENTITY WINDOW — resolvePtyReply's PTY_IDENTITY_POLL_TIMEOUT_MS is 5000ms, but a cold claude pty takes 10-20s to boot and write its native jsonl, so first messages on a fresh pty always deflect; raise the poll window to 20000ms (poll interval stays 300ms) and make sure the overall ask deadline still exceeds it. Presentation/behavior only in mcp/delegation/app-client.ts and the one constant in mcp/delegation/api.ts; keep every test green (adjust only tests that assert the old constant); template-literal constraints; cite files individually.\" was rejected.\n\nReason: The 5s-to-20s identity poll raise hangs the pty test suite in real time (three 1200s timeouts, zero contention on the last two). Redo routed through the injectable wait seam so tests stay fast.\n\nClaimed: work delivered — see diff (agent skipped the kage-claim-v1 fence)\nBranch kept for inspection: kage/two-small-room-polish-fixes-both-reprodu-260821-a974","type":"negative_result","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","rejected","kage-run:two-small-room-polish-fixes-both-reprodu-260821-a974"],"paths":[],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T19:12:15.666Z"}],"context":{"fact":"A delegated attempt at \"Two small Room polish fixes, both reproduced today: (1) CHAT OPENS AT THE TOP — reloading the app shows the oldest turns; the thread must open pinned to the NEWEST turn (scroll the thread pane to bottom on initial render and after switching back to the Chat tab; keep the user's scroll position during a session — only pin on entry, and stay pinned when already at bottom while new turns stream in, standard chat behavior); (2) COLD-PTY IDENTITY WINDOW — resolvePtyReply's PTY_IDENTITY_POLL_TIMEOUT_MS is 5000ms, but a cold claude pty takes 10-20s to boot and write its native jsonl, so first messages on a fresh pty always deflect; raise the poll window to 20000ms (poll interval stays 300ms) and make sure the overall ask deadline still exceeds it. Presentation/behavior only in mcp/delegation/app-client.ts and the one constant in mcp/delegation/api.ts; keep every test green (adjust only tests that assert the old constant); template-literal constraints; cite files individually.\" was rejected."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T19:12:15.666Z","path_fingerprints":[],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":2000,"discovery_tokens_estimated":true,"score":76,"reasons":["high-value memory type","has source evidence","tagged","concise but substantive"],"risks":["not grounded to paths"],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":347},"created_at":"2026-08-21T19:12:15.666Z","updated_at":"2026-08-21T19:12:15.666Z","author_branch":"release-prep"}
```

