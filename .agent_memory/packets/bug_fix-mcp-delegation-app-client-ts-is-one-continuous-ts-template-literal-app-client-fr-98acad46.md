---
type: "Bug Fix"
title: "mcp/delegation/app-client.ts is one continuous TS template literal (APP_CLIENT) from li..."
description: "mcp/delegation/app client.ts is one continuous TS template literal APP CLIENT from line 12 to EOF — any literal backtick anywhere in that range would terminate the literal early, so backtick delimiters must always be app"
resource: "mcp/delegation-api.test.ts"
tags: ["delegated-run", "kage-run:one-array-bugfix-in-mcp-delegation-app-c-260817-d1a3"]
timestamp: "2026-08-20T12:42:33.695Z"
x-kage-id: "repo:one-array-bugfix-in-mcp-delegation-app-c-260817-d1a3:bug_fix:mcp-delegation-app-client-ts-is-one-continuous-ts-template-literal-app-client-fr"
x-kage-type: "bug_fix"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation-api.test.ts", "mcp/delegation/app-client.ts"]
---

# mcp/delegation/app-client.ts is one continuous TS template literal (APP_CLIENT) from li...

> mcp/delegation/app client.ts is one continuous TS template literal APP CLIENT from line 12 to EOF — any literal backt…

mcp/delegation/app-client.ts is one continuous TS template literal (APP_CLIENT) from line 12 to EOF — any literal backtick anywhere in that range would terminate the literal early, so backtick delimiters must always be appended programmatically via String.fromCharCode(96), never written as a string literal character.

Learned while delivering: One-array bugfix in mcp/delegation/app-client.ts: the Room inline run cards never appear because tokenizeText (around line 461) splits turn text on whitespace and punctuation but NOT on asterisks or backticks — and the manager writes run ids wrapped in markdown emphasis (**run-id**) or inline code, so the token arrives as **run-id** and never matches state.runs ids in runsMentionedIn. Fix: in the delims array inside tokenizeText, add an asterisk entry ("*") — and also add the backtick as a delimiter, BUT this file is a TS template literal and cannot contain a literal backtick character, so append it programmatically instead: after the array literal, push String.fromCharCode(96) onto delims (a one-line statement; keep a short comment saying why). Change nothing else. This file has strict conventions (doubled escapes, no backticks, no ${, gates in delegation-api.test.ts run on the composed page). Also add one regression test to mcp/delegation-api.test.ts asserting the composed client script contains the asterisk in the tokenizer delimiter list — keep it a simple containment check on a distinctive slice of the delims array. Success = npm test fully green.
Verified by: npm test --prefix mcp, diff-size, citations

## Verification

npm test --prefix mcp, diff-size, citations

# Citations

[1] explicit_capture (2026-08-17T20:49:44.416Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:one-array-bugfix-in-mcp-delegation-app-c-260817-d1a3:bug_fix:mcp-delegation-app-client-ts-is-one-continuous-ts-template-literal-app-client-fr","title":"mcp/delegation/app-client.ts is one continuous TS template literal (APP_CLIENT) from li...","summary":"mcp/delegation/app client.ts is one continuous TS template literal APP CLIENT from line 12 to EOF — any literal backtick anywhere in that range would terminate the literal early, so backtick delimiters must always be app","body":"mcp/delegation/app-client.ts is one continuous TS template literal (APP_CLIENT) from line 12 to EOF — any literal backtick anywhere in that range would terminate the literal early, so backtick delimiters must always be appended programmatically via String.fromCharCode(96), never written as a string literal character.\n\nLearned while delivering: One-array bugfix in mcp/delegation/app-client.ts: the Room inline run cards never appear because tokenizeText (around line 461) splits turn text on whitespace and punctuation but NOT on asterisks or backticks — and the manager writes run ids wrapped in markdown emphasis (**run-id**) or inline code, so the token arrives as **run-id** and never matches state.runs ids in runsMentionedIn. Fix: in the delims array inside tokenizeText, add an asterisk entry (\"*\") — and also add the backtick as a delimiter, BUT this file is a TS template literal and cannot contain a literal backtick character, so append it programmatically instead: after the array literal, push String.fromCharCode(96) onto delims (a one-line statement; keep a short comment saying why). Change nothing else. This file has strict conventions (doubled escapes, no backticks, no ${, gates in delegation-api.test.ts run on the composed page). Also add one regression test to mcp/delegation-api.test.ts asserting the composed client script contains the asterisk in the tokenizer delimiter list — keep it a simple containment check on a distinctive slice of the delims array. Success = npm test fully green.\nVerified by: npm test --prefix mcp, diff-size, citations","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","kage-run:one-array-bugfix-in-mcp-delegation-app-c-260817-d1a3"],"paths":["mcp/delegation-api.test.ts","mcp/delegation/app-client.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-17T20:49:44.416Z"}],"context":{"fact":"mcp/delegation/app-client.ts is one continuous TS template literal (APP_CLIENT) from line 12 to EOF — any literal backtick anywhere in that range would terminate the literal early, so backtick delimiters must always be appended programmatically via String.fromCharCode(96), never written as a string literal character.","verification":"npm test --prefix mcp, diff-size, citations"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-20T12:42:33.695Z","path_fingerprints":[{"path":"mcp/delegation-api.test.ts","sha256":"5664b212d3adef17954a296672ff7ce2be4feb285f82989abbcdae276b854adb","size":75803,"symbols":[{"name":"token","kind":"constant","sha256":"9834ba45163697ce4cd9fd57ea9862eb97e3007759508c14c382a70025222c71"},{"name":"room","kind":"constant","sha256":"daca1174495725bcfe924b660b84e822be76aea4fbb7dc3ebb244be8b8a9aa47"},{"name":"check","kind":"function","sha256":"7b30564574a597040e8dba4b655835572d5ee55cf88928c264f07931c49d79d5"},{"name":"learned","kind":"constant","sha256":"86a9cef845cb3f653282806e5a05f474fd9c20f4ad4af48ec5d031f762c896d5"},{"name":"diff","kind":"constant","sha256":"4755f26124dc87f6c211031d5c8f7b97491ca68a2f89a4a806acbacee62110a6"},{"name":"after","kind":"constant","sha256":"d051c692f49a215432f0e8b7ba363f12fcdcfb0f1c763962e308b5b556d01b54"},{"name":"list","kind":"constant","sha256":"385ad89762910c2d07a3657a28d80425db452ebb7c9db280f45ac7b213534128"}]},{"path":"mcp/delegation/app-client.ts","sha256":"ded26e7b2ea02db2b4eade9056358d995b0517b8f9cf1181245a867beb33bafb","size":206711,"symbols":[{"name":"app_client","kind":"constant","sha256":"9b449d71d9c59cfb03a4bc3ad2759a62d399813e04f1a039eebb60da502616a8"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":94,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":394,"reverified_at":"2026-08-20T12:42:33.695Z"},"created_at":"2026-08-17T20:49:44.416Z","updated_at":"2026-08-20T12:42:33.695Z","author_branch":"kage/one-array-bugfix-in-mcp-delegation-app-c-260817-d1a3"}
```

