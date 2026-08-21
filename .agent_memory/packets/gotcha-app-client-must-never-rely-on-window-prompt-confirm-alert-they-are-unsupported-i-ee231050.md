---
type: "Gotcha"
title: "app-client must never rely on window.prompt/confirm/alert — they are unsupported in Electron and embedded browsers, and fail silently from the user's view"
description: "The run detail Reject button was dead in the desktop shell and embedded browsers: reject.onclick in mcp/delegation/app client.ts called window.prompt to collect a rejection reason, and prompt throws \"prompt is not suppor"
resource: "mcp/delegation/app-client.ts"
tags: ["session-learning", "electron", "app-client", "dialogs", "ux"]
timestamp: "2026-08-21T08:42:20.613Z"
x-kage-id: "repo:https-github-com-kage-core-kage:gotcha:app-client-must-never-rely-on-window-prompt-confirm-alert-they-are-unsupported-i"
x-kage-type: "gotcha"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation/app-client.ts", "shell/main.js"]
---

# app-client must never rely on window.prompt/confirm/alert — they are unsupported in Electron and embedded browsers, and fail silently from the user's view

> The run detail Reject button was dead in the desktop shell and embedded browsers: reject.onclick in mcp/delegation/ap…

The run-detail Reject button was dead in the desktop shell and embedded browsers: reject.onclick in mcp/delegation/app-client.ts called window.prompt() to collect a rejection reason, and prompt() throws "prompt() is not supported" in Electron (and Chrome-embedded panes), so clicking Reject did nothing visible — a silent dead control. Rule: the app renderer may not use prompt()/confirm()/alert(); every confirmation or reason-collection must be an in-DOM affordance (inline reason row, confirm/cancel buttons, Escape cancels). Found by operator dogfooding on 2026-08-21; fix assigned to the audit-driven parity run.
Evidence: Browser console: Uncaught "prompt() is not supported" at reject.onclick (composed page line ~4206) when clicking Reject on a failed run; button produced no UI change
Verified by: reproduced live in the app at 127.0.0.1:3111/app on 2026-08-21

## Verification

Browser console: Uncaught "prompt() is not supported" at reject.onclick (composed page line ~4206) when clicking Reject on a failed run; button produced no UI change

# Citations

[1] explicit_capture (2026-08-21T07:37:28.155Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:gotcha:app-client-must-never-rely-on-window-prompt-confirm-alert-they-are-unsupported-i","title":"app-client must never rely on window.prompt/confirm/alert — they are unsupported in Electron and embedded browsers, and fail silently from the user's view","summary":"The run detail Reject button was dead in the desktop shell and embedded browsers: reject.onclick in mcp/delegation/app client.ts called window.prompt to collect a rejection reason, and prompt throws \"prompt is not suppor","body":"The run-detail Reject button was dead in the desktop shell and embedded browsers: reject.onclick in mcp/delegation/app-client.ts called window.prompt() to collect a rejection reason, and prompt() throws \"prompt() is not supported\" in Electron (and Chrome-embedded panes), so clicking Reject did nothing visible — a silent dead control. Rule: the app renderer may not use prompt()/confirm()/alert(); every confirmation or reason-collection must be an in-DOM affordance (inline reason row, confirm/cancel buttons, Escape cancels). Found by operator dogfooding on 2026-08-21; fix assigned to the audit-driven parity run.\nEvidence: Browser console: Uncaught \"prompt() is not supported\" at reject.onclick (composed page line ~4206) when clicking Reject on a failed run; button produced no UI change\nVerified by: reproduced live in the app at 127.0.0.1:3111/app on 2026-08-21","type":"gotcha","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","electron","app-client","dialogs","ux"],"paths":["mcp/delegation/app-client.ts","shell/main.js"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T07:37:28.155Z"}],"context":{"fact":"The run-detail Reject button was dead in the desktop shell and embedded browsers: reject.onclick in mcp/delegation/app-client.ts called window.prompt() to collect a rejection reason, and prompt() throws \"prompt() is not supported\" in Electron (and Chrome-embedded panes), so clicking Reject did nothing visible — a silent dead control. Rule: the app renderer may not use prompt()/confirm()/alert(); every confirmation or reason-collection must be an in-DOM affordance (inline reason row, confirm/cancel buttons, Escape cancels). Found by operator dogfooding on 2026-08-21; fix assigned to the audit-driven parity run.\nEvidence: Browser console: Uncaught \"prompt() is not supported\" at reject.onclick (composed page line ~4206) when clicking Reject on a failed run; button produced no UI change\nVerified by: reproduced live in the app at 127.0.0.1:3111/app on 2026-08-21","verification":"Browser console: Uncaught \"prompt() is not supported\" at reject.onclick (composed page line ~4206) when clicking Reject on a failed run; button produced no UI change"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T08:42:20.613Z","path_fingerprints":[{"path":"mcp/delegation/app-client.ts","sha256":"d0a0da1c3d3ca06e406bdc09b2cf71dee565c1e5b3ebb74c052298fea6362c25","size":225599},{"path":"shell/main.js","sha256":"3e016ebd5e1ae80d8278f022d44e8572fea4bb869ad5fc8b41cc46ee6a51644d","size":18887,"symbols":[{"name":"shell","kind":"constant","sha256":"f263d75d34fcf1b386c10b5dceb8caa4ad7ef8da72d83078480234e9286a5471"},{"name":"found","kind":"constant","sha256":"b7dc14dba0893464f91ebf49bfcf622293680c47c76c03093134666e09b828e1"},{"name":"detail","kind":"constant","sha256":"2f5efb77ebd87108d73ca36ce606c034d9ed234262b136709d8547728a70de38"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":218,"reverified_at":"2026-08-21T08:42:20.613Z"},"created_at":"2026-08-21T07:37:28.155Z","updated_at":"2026-08-21T08:42:20.613Z","author_branch":"release-prep"}
```

