---
type: "Bug Fix"
title: "APP_CLIENT is embedded verbatim (no minification/transform) into app-html.ts's composed..."
description: "APP CLIENT is embedded verbatim no minification/transform into app html.ts's composed HTML between <script and </script , so string containment assertions against the raw TS source text of app client.ts are valid checks "
resource: "mcp/delegation-api.test.ts"
tags: ["delegated-run", "kage-run:one-array-bugfix-in-mcp-delegation-app-c-260817-d1a3"]
timestamp: "2026-08-17T20:49:44.585Z"
x-kage-id: "repo:one-array-bugfix-in-mcp-delegation-app-c-260817-d1a3:bug_fix:app-client-is-embedded-verbatim-no-minification-transform-into-app-html-tss-comp"
x-kage-type: "bug_fix"
x-kage-status: "pending"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation-api.test.ts", "mcp/delegation/app-client.ts"]
---

# APP_CLIENT is embedded verbatim (no minification/transform) into app-html.ts's composed...

> APP CLIENT is embedded verbatim no minification/transform into app html.ts's composed HTML between <script and </scri…

APP_CLIENT is embedded verbatim (no minification/transform) into app-html.ts's composed HTML between <script> and </script>, so string-containment assertions against the raw TS source text of app-client.ts are valid checks against the served client script.

Learned while delivering: One-array bugfix in mcp/delegation/app-client.ts: the Room inline run cards never appear because tokenizeText (around line 461) splits turn text on whitespace and punctuation but NOT on asterisks or backticks — and the manager writes run ids wrapped in markdown emphasis (**run-id**) or inline code, so the token arrives as **run-id** and never matches state.runs ids in runsMentionedIn. Fix: in the delims array inside tokenizeText, add an asterisk entry ("*") — and also add the backtick as a delimiter, BUT this file is a TS template literal and cannot contain a literal backtick character, so append it programmatically instead: after the array literal, push String.fromCharCode(96) onto delims (a one-line statement; keep a short comment saying why). Change nothing else. This file has strict conventions (doubled escapes, no backticks, no ${, gates in delegation-api.test.ts run on the composed page). Also add one regression test to mcp/delegation-api.test.ts asserting the composed client script contains the asterisk in the tokenizer delimiter list — keep it a simple containment check on a distinctive slice of the delims array. Success = npm test fully green.
Verified by: npm test --prefix mcp, diff-size, citations

## Verification

npm test --prefix mcp, diff-size, citations

# Citations

[1] explicit_capture (2026-08-17T20:49:44.585Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:one-array-bugfix-in-mcp-delegation-app-c-260817-d1a3:bug_fix:app-client-is-embedded-verbatim-no-minification-transform-into-app-html-tss-comp","title":"APP_CLIENT is embedded verbatim (no minification/transform) into app-html.ts's composed...","summary":"APP CLIENT is embedded verbatim no minification/transform into app html.ts's composed HTML between <script and </script , so string containment assertions against the raw TS source text of app client.ts are valid checks ","body":"APP_CLIENT is embedded verbatim (no minification/transform) into app-html.ts's composed HTML between <script> and </script>, so string-containment assertions against the raw TS source text of app-client.ts are valid checks against the served client script.\n\nLearned while delivering: One-array bugfix in mcp/delegation/app-client.ts: the Room inline run cards never appear because tokenizeText (around line 461) splits turn text on whitespace and punctuation but NOT on asterisks or backticks — and the manager writes run ids wrapped in markdown emphasis (**run-id**) or inline code, so the token arrives as **run-id** and never matches state.runs ids in runsMentionedIn. Fix: in the delims array inside tokenizeText, add an asterisk entry (\"*\") — and also add the backtick as a delimiter, BUT this file is a TS template literal and cannot contain a literal backtick character, so append it programmatically instead: after the array literal, push String.fromCharCode(96) onto delims (a one-line statement; keep a short comment saying why). Change nothing else. This file has strict conventions (doubled escapes, no backticks, no ${, gates in delegation-api.test.ts run on the composed page). Also add one regression test to mcp/delegation-api.test.ts asserting the composed client script contains the asterisk in the tokenizer delimiter list — keep it a simple containment check on a distinctive slice of the delims array. Success = npm test fully green.\nVerified by: npm test --prefix mcp, diff-size, citations","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"pending","confidence":0.7,"tags":["delegated-run","kage-run:one-array-bugfix-in-mcp-delegation-app-c-260817-d1a3"],"paths":["mcp/delegation-api.test.ts","mcp/delegation/app-client.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-17T20:49:44.585Z"}],"context":{"fact":"APP_CLIENT is embedded verbatim (no minification/transform) into app-html.ts's composed HTML between <script> and </script>, so string-containment assertions against the raw TS source text of app-client.ts are valid checks against the served client script.","verification":"npm test --prefix mcp, diff-size, citations"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-17T20:49:44.585Z","path_fingerprints":[{"path":"mcp/delegation-api.test.ts","sha256":"8e82d5d85af655870d13afee445a5c44e4b305bdd0f5c0ae7e3bf99936f05303","size":49722,"symbols":[{"name":"token","kind":"constant","sha256":"9834ba45163697ce4cd9fd57ea9862eb97e3007759508c14c382a70025222c71"},{"name":"room","kind":"constant","sha256":"daca1174495725bcfe924b660b84e822be76aea4fbb7dc3ebb244be8b8a9aa47"},{"name":"check","kind":"function","sha256":"7b30564574a597040e8dba4b655835572d5ee55cf88928c264f07931c49d79d5"},{"name":"learned","kind":"constant","sha256":"86a9cef845cb3f653282806e5a05f474fd9c20f4ad4af48ec5d031f762c896d5"},{"name":"diff","kind":"constant","sha256":"4755f26124dc87f6c211031d5c8f7b97491ca68a2f89a4a806acbacee62110a6"},{"name":"after","kind":"constant","sha256":"d051c692f49a215432f0e8b7ba363f12fcdcfb0f1c763962e308b5b556d01b54"}]},{"path":"mcp/delegation/app-client.ts","sha256":"fc32a40985a41fd801263e1fd471a4cf59e555de4317bee67a7060d98c384bff","size":114374,"symbols":[{"name":"app_client","kind":"constant","sha256":"b832904397bfb6d185c15f71f6a5ff2af624c8ea284caf6253a091414cbce3ba"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":378},"created_at":"2026-08-17T20:49:44.585Z","updated_at":"2026-08-17T20:49:44.683Z","author_branch":"kage/one-array-bugfix-in-mcp-delegation-app-c-260817-d1a3"}
```

