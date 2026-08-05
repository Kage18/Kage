---
type: "Gotcha"
title: "The Kage desktop app's own daemons break the mcp test suite while it is running"
description: "Running platform/desktop Electron starts a kage viewer daemon per watched repository. Two adapter tests assert behaviour when the evidence runtime is DOWN — 'a hanging measurement probe never delays the client response'"
resource: "mcp/vnext/adapters/adapter.test.ts"
tags: ["session-learning", "desktop", "testing", "daemon"]
timestamp: "2026-07-29T07:32:55.829Z"
x-kage-id: "repo:https-github-com-kage-core-kage:gotcha:the-kage-desktop-apps-own-daemons-break-the-mcp-test-suite-while-it-is-running-1"
x-kage-type: "gotcha"
x-kage-status: "superseded"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "superseded"
x-kage-paths: ["mcp/vnext/adapters/adapter.test.ts", "platform/desktop/src/main.ts"]
---

# The Kage desktop app's own daemons break the mcp test suite while it is running

> Running platform/desktop Electron starts a kage viewer daemon per watched repository. Two adapter tests assert behavi…

Running platform/desktop (Electron) starts a kage viewer daemon per watched repository. Two adapter tests assert behaviour when the evidence runtime is DOWN — 'a hanging measurement probe never delays the client response' and 'the proxy serves traffic normally and never blocks when the evidence runtime is down (fail open)' — so a live daemon makes them fail with actual 'failed_open' vs expected 'accepted'. Proven, not guessed: with the app running the full suite showed those two failures; after pkill of electron and 'cli.js viewer', dist/vnext/adapters/adapter.test.js passed 47/47 and the full suite exited 0. Kill the desktop app (and any stray viewer daemons) before running npm test --prefix mcp.
Evidence: npm test showed 2 failures with the app running; adapter.test.js 47/47 pass and full suite exit 0 after pkill -f 'electron dist/main.js' and pkill -f 'cli.js viewer'
Verified by: Claude Opus 5, 2026-07-29

## Verification

npm test showed 2 failures with the app running; adapter.test.js 47/47 pass and full suite exit 0 after pkill -f 'electron dist/main.js' and pkill -f 'cli.js viewer'

# Citations

[1] explicit_capture (2026-07-29T07:32:55.829Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:gotcha:the-kage-desktop-apps-own-daemons-break-the-mcp-test-suite-while-it-is-running-1","title":"The Kage desktop app's own daemons break the mcp test suite while it is running","summary":"Running platform/desktop Electron starts a kage viewer daemon per watched repository. Two adapter tests assert behaviour when the evidence runtime is DOWN — 'a hanging measurement probe never delays the client response'","body":"Running platform/desktop (Electron) starts a kage viewer daemon per watched repository. Two adapter tests assert behaviour when the evidence runtime is DOWN — 'a hanging measurement probe never delays the client response' and 'the proxy serves traffic normally and never blocks when the evidence runtime is down (fail open)' — so a live daemon makes them fail with actual 'failed_open' vs expected 'accepted'. Proven, not guessed: with the app running the full suite showed those two failures; after pkill of electron and 'cli.js viewer', dist/vnext/adapters/adapter.test.js passed 47/47 and the full suite exited 0. Kill the desktop app (and any stray viewer daemons) before running npm test --prefix mcp.\nEvidence: npm test showed 2 failures with the app running; adapter.test.js 47/47 pass and full suite exit 0 after pkill -f 'electron dist/main.js' and pkill -f 'cli.js viewer'\nVerified by: Claude Opus 5, 2026-07-29","type":"gotcha","scope":"repo","visibility":"team","sensitivity":"internal","status":"superseded","confidence":0.7,"tags":["session-learning","desktop","testing","daemon"],"paths":["mcp/vnext/adapters/adapter.test.ts","platform/desktop/src/main.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-07-29T07:32:55.829Z"}],"context":{"fact":"Running platform/desktop (Electron) starts a kage viewer daemon per watched repository. Two adapter tests assert behaviour when the evidence runtime is DOWN — 'a hanging measurement probe never delays the client response' and 'the proxy serves traffic normally and never blocks when the evidence runtime is down (fail open)' — so a live daemon makes them fail with actual 'failed_open' vs expected 'accepted'. Proven, not guessed: with the app running the full suite showed those two failures; after pkill of electron and 'cli.js viewer', dist/vnext/adapters/adapter.test.js passed 47/47 and the full suite exited 0. Kill the desktop app (and any stray viewer daemons) before running npm test --prefix mcp.\nEvidence: npm test showed 2 failures with the app running; adapter.test.js 47/47 pass and full suite exit 0 after pkill -f 'electron dist/main.js' and pkill -f 'cli.js viewer'\nVerified by: Claude Opus 5, 2026-07-29","verification":"npm test showed 2 failures with the app running; adapter.test.js 47/47 pass and full suite exit 0 after pkill -f 'electron dist/main.js' and pkill -f 'cli.js viewer'"},"freshness":{"ttl_days":365,"last_verified_at":"2026-07-29T07:32:55.829Z","path_fingerprints":[{"path":"mcp/vnext/adapters/adapter.test.ts","sha256":"f84c1055a299134ac78ccd7e81529a408e09fe3263e92809935ee604b98865c5","size":61285},{"path":"platform/desktop/src/main.ts","sha256":"8b0fd301199199a1aa98ba18393d8cb2703f0c4ee98548c4294c7dc2f1f1640d","size":24196}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture","superseded_at":"2026-08-05T05:43:28.122Z","superseded_by":"repo:https-github-com-kage-core-kage:gotcha:a-competing-test-runner-breaks-this-suite-a-busy-background-daemon-does-not-1785","superseded_reason":"Contradicted by measurement. The suite passed 1980/1980 while a runaway Kage daemon held 462% CPU (4.6 cores) on the same machine, so a busy background daemon does not break it. The actual cause was a competing 'node --test' respawn loop. The replacement records the corrected diagnosis and the numbers behind it."},"edges":[{"relation":"superseded_by","to":"repo:https-github-com-kage-core-kage:gotcha:a-competing-test-runner-breaks-this-suite-a-busy-background-daemon-does-not-1785","evidence":"Contradicted by measurement. The suite passed 1980/1980 while a runaway Kage daemon held 462% CPU (4.6 cores) on the same machine, so a busy background daemon does not break it. The actual cause was a competing 'node --test' respawn loop. The replacement records the corrected diagnosis and the numbers behind it.","created_at":"2026-08-05T05:43:28.122Z"}],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":231,"superseded_by":"repo:https-github-com-kage-core-kage:gotcha:a-competing-test-runner-breaks-this-suite-a-busy-background-daemon-does-not-1785","superseded_reason":"Contradicted by measurement. The suite passed 1980/1980 while a runaway Kage daemon held 462% CPU (4.6 cores) on the same machine, so a busy background daemon does not break it. The actual cause was a competing 'node --test' respawn loop. The replacement records the corrected diagnosis and the numbers behind it."},"created_at":"2026-07-29T07:32:55.829Z","updated_at":"2026-08-05T05:43:28.122Z","author_branch":"fix/foreign-proxy-build","author_name":"Kushal Jain"}
```

