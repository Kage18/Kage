---
type: "Gotcha"
title: "App HTML lives in a TS template literal — client \\n must be \\\\n, and a parse test guards it"
description: "The delegation web app in mcp/delegation/app html.ts is authored inside one TS template literal. Any client side JavaScript string that needs a newline escape must be written as \\\\n in the TS source — a bare \\n becomes a"
resource: "mcp/delegation/app-html.ts"
tags: ["session-learning", "web-app", "template-literal", "escaping", "delegation"]
timestamp: "2026-08-15T08:19:59.813Z"
x-kage-id: "repo:https-github-com-kage-core-kage:gotcha:app-html-lives-in-a-ts-template-literal-client-n-must-be-n-and-a-parse-test-guar"
x-kage-type: "gotcha"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation/app-html.ts", "mcp/delegation-api.test.ts"]
---

# App HTML lives in a TS template literal — client \n must be \\n, and a parse test guards it

> The delegation web app in mcp/delegation/app html.ts is authored inside one TS template literal. Any client side Java…

The delegation web app in mcp/delegation/app-html.ts is authored inside one TS template literal. Any client-side JavaScript string that needs a newline escape must be written as \\n in the TS source — a bare \n becomes a REAL newline in the emitted script and kills the entire app at parse time with "Invalid or unexpected token" (the page chrome renders, but state/refresh/every handler is undefined). This shipped once via a d.diffText.split("\n") edit. The permanent guard is the test "the emitted client script is syntactically valid JavaScript" in mcp/delegation-api.test.ts, which extracts the script from delegationAppHtml() and runs it through new Function() — the same parser the browser uses. Keep that test whenever the app string is edited.
Evidence: Reproduced live: browser console showed SyntaxError and window.state was undefined; after escaping to \\n and adding the new Function() parse test, the app rendered and the suite passed 470+12.
Verified by: npm test --prefix mcp → 470 unit + 12 dogfood pass; live browser session confirmed the app recovered

## Verification

Reproduced live: browser console showed SyntaxError and window.state was undefined; after escaping to \\n and adding the new Function() parse test, the app rendered and the suite passed 470+12.

# Citations

[1] explicit_capture (2026-08-15T08:19:59.813Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:gotcha:app-html-lives-in-a-ts-template-literal-client-n-must-be-n-and-a-parse-test-guar","title":"App HTML lives in a TS template literal — client \\n must be \\\\n, and a parse test guards it","summary":"The delegation web app in mcp/delegation/app html.ts is authored inside one TS template literal. Any client side JavaScript string that needs a newline escape must be written as \\\\n in the TS source — a bare \\n becomes a","body":"The delegation web app in mcp/delegation/app-html.ts is authored inside one TS template literal. Any client-side JavaScript string that needs a newline escape must be written as \\\\n in the TS source — a bare \\n becomes a REAL newline in the emitted script and kills the entire app at parse time with \"Invalid or unexpected token\" (the page chrome renders, but state/refresh/every handler is undefined). This shipped once via a d.diffText.split(\"\\n\") edit. The permanent guard is the test \"the emitted client script is syntactically valid JavaScript\" in mcp/delegation-api.test.ts, which extracts the script from delegationAppHtml() and runs it through new Function() — the same parser the browser uses. Keep that test whenever the app string is edited.\nEvidence: Reproduced live: browser console showed SyntaxError and window.state was undefined; after escaping to \\\\n and adding the new Function() parse test, the app rendered and the suite passed 470+12.\nVerified by: npm test --prefix mcp → 470 unit + 12 dogfood pass; live browser session confirmed the app recovered","type":"gotcha","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","web-app","template-literal","escaping","delegation"],"paths":["mcp/delegation/app-html.ts","mcp/delegation-api.test.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-15T08:19:59.813Z"}],"context":{"fact":"The delegation web app in mcp/delegation/app-html.ts is authored inside one TS template literal. Any client-side JavaScript string that needs a newline escape must be written as \\\\n in the TS source — a bare \\n becomes a REAL newline in the emitted script and kills the entire app at parse time with \"Invalid or unexpected token\" (the page chrome renders, but state/refresh/every handler is undefined). This shipped once via a d.diffText.split(\"\\n\") edit. The permanent guard is the test \"the emitted client script is syntactically valid JavaScript\" in mcp/delegation-api.test.ts, which extracts the script from delegationAppHtml() and runs it through new Function() — the same parser the browser uses. Keep that test whenever the app string is edited.\nEvidence: Reproduced live: browser console showed SyntaxError and window.state was undefined; after escaping to \\\\n and adding the new Function() parse test, the app rendered and the suite passed 470+12.\nVerified by: npm test --prefix mcp → 470 unit + 12 dogfood pass; live browser session confirmed the app recovered","verification":"Reproduced live: browser console showed SyntaxError and window.state was undefined; after escaping to \\\\n and adding the new Function() parse test, the app rendered and the suite passed 470+12."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-15T08:19:59.813Z","path_fingerprints":[{"path":"mcp/delegation/app-html.ts","sha256":"070583264ea59343dbde34aaf3666a816a164e6d04ac954a0b4486d8c692a9b0","size":32335,"symbols":[{"name":"delegationapphtml","kind":"function","sha256":"358baebd61b9ca8a92947e87d0c1369e1028d34388ed30ba9b99cfd1ec7a7e17"}]},{"path":"mcp/delegation-api.test.ts","sha256":"a8786a60b62e1ffec89b620506b162aca8e1d07ce8cc79bd2673ccc6d982f400","size":14681,"symbols":[{"name":"token","kind":"constant","sha256":"9834ba45163697ce4cd9fd57ea9862eb97e3007759508c14c382a70025222c71"},{"name":"script","kind":"constant","sha256":"d2e6d40b3390161836029e58584d8c33ceea3f1ff93f6dc14b4d67307f8e7dd5"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":268,"unresolved_symbols":["SyntaxError"]},"created_at":"2026-08-15T08:19:59.813Z","updated_at":"2026-08-15T08:20:08.144Z","author_branch":"master"}
```

