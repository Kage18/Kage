---
type: "Decision"
title: "In these vm-sandbox DOM tests, h(tag, cls) sets a real multi-word className string (e.g..."
description: "In these vm sandbox DOM tests, h tag, cls sets a real multi word className string e.g. \"dline add\", \"scell del\" — a find by class test helper must split on whitespace and match by token membership, not treat the class st"
resource: "mcp/delegation/app-client.ts"
tags: ["delegated-run", "kage-run:two-deferred-design-parity-gaps-from-the-260821-8fc8"]
timestamp: "2026-08-21T09:24:37.919Z"
x-kage-id: "repo:two-deferred-design-parity-gaps-from-the-260821-8fc8:decision:in-these-vm-sandbox-dom-tests-h-tag-cls-sets-a-real-multi-word-classname-string-"
x-kage-type: "decision"
x-kage-status: "deprecated"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "deprecated"
x-kage-paths: ["mcp/delegation/app-client.ts", "mcp/delegation/app-styles.ts", "mcp/two-deferred-design-parity.test.ts"]
---

# In these vm-sandbox DOM tests, h(tag, cls) sets a real multi-word className string (e.g...

> In these vm sandbox DOM tests, h tag, cls sets a real multi word className string e.g. "dline add", "scell del" — a f…

In these vm-sandbox DOM tests, h(tag, cls) sets a real multi-word className string (e.g. "dline add", "scell del") — a find-by-class test helper must split on whitespace and match by token membership, not treat the class string as one opaque token, or lookups for two-word classes silently return nothing.

Learned while delivering: Two deferred design-parity gaps from the audit run, both with the mockups as spec (docs/design/mockups/): (1) DIFF GUTTER — the app's diff view lacks the line-number gutter the Diff.dc.html mockup shows: add per-hunk old/new line numbers in a mono gutter column (tabular-nums), keeping add/del/context row coloring, horizontal scroll inside the diff container only, and the existing split/unified toggle working; server already parses hunks — do not re-parse client-side. (2) WORKLIST INLINE ACTIONS — WorkList.dc.html shows row-level actions on triage rows (the what-now line plus its buttons: Adopt / Resume / Reject on a lost-or-failed row, Review/Merge on a ready row) without opening the detail overlay; wire the existing action functions (adopt/resume/reject/merge already exist in the client) into compact row buttons that appear on the rows needing a decision, reusing inlineAsk for the reject reason. Keep both surfaces revision-gated (no per-tick churn), respect the app's existing class vocabulary, and follow the template-literal constraints (doubled escapes, no backticks or dollar-brace, h() only, never innerHTML); composed-page parse test and full suite stay green; cite files individually.
Verified by: diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, node --check <composed inline script>, reachability

## Verification

diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, node --check <composed inline script>, reachability

# Citations

[1] explicit_capture (2026-08-21T09:24:37.919Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:two-deferred-design-parity-gaps-from-the-260821-8fc8:decision:in-these-vm-sandbox-dom-tests-h-tag-cls-sets-a-real-multi-word-classname-string-","title":"In these vm-sandbox DOM tests, h(tag, cls) sets a real multi-word className string (e.g...","summary":"In these vm sandbox DOM tests, h tag, cls sets a real multi word className string e.g. \"dline add\", \"scell del\" — a find by class test helper must split on whitespace and match by token membership, not treat the class st","body":"In these vm-sandbox DOM tests, h(tag, cls) sets a real multi-word className string (e.g. \"dline add\", \"scell del\") — a find-by-class test helper must split on whitespace and match by token membership, not treat the class string as one opaque token, or lookups for two-word classes silently return nothing.\n\nLearned while delivering: Two deferred design-parity gaps from the audit run, both with the mockups as spec (docs/design/mockups/): (1) DIFF GUTTER — the app's diff view lacks the line-number gutter the Diff.dc.html mockup shows: add per-hunk old/new line numbers in a mono gutter column (tabular-nums), keeping add/del/context row coloring, horizontal scroll inside the diff container only, and the existing split/unified toggle working; server already parses hunks — do not re-parse client-side. (2) WORKLIST INLINE ACTIONS — WorkList.dc.html shows row-level actions on triage rows (the what-now line plus its buttons: Adopt / Resume / Reject on a lost-or-failed row, Review/Merge on a ready row) without opening the detail overlay; wire the existing action functions (adopt/resume/reject/merge already exist in the client) into compact row buttons that appear on the rows needing a decision, reusing inlineAsk for the reject reason. Keep both surfaces revision-gated (no per-tick churn), respect the app's existing class vocabulary, and follow the template-literal constraints (doubled escapes, no backticks or dollar-brace, h() only, never innerHTML); composed-page parse test and full suite stay green; cite files individually.\nVerified by: diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, node --check <composed inline script>, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"deprecated","confidence":0.7,"tags":["delegated-run","kage-run:two-deferred-design-parity-gaps-from-the-260821-8fc8"],"paths":["mcp/delegation/app-client.ts","mcp/delegation/app-styles.ts","mcp/two-deferred-design-parity.test.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T09:24:37.919Z"}],"context":{"fact":"In these vm-sandbox DOM tests, h(tag, cls) sets a real multi-word className string (e.g. \"dline add\", \"scell del\") — a find-by-class test helper must split on whitespace and match by token membership, not treat the class string as one opaque token, or lookups for two-word classes silently return nothing.","verification":"diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, node --check <composed inline script>, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T09:24:37.919Z","path_fingerprints":[{"path":"mcp/delegation/app-client.ts","sha256":"0e35a1943c846ede76c81c2308d9cec5fefa3573ef1a02d03352b5a34d38b9e4","size":231424},{"path":"mcp/delegation/app-styles.ts","sha256":"44055c133052cfffa5d712250d5d0af4d2109c879d0a068e2876f796e77d25e0","size":85493},{"path":"mcp/two-deferred-design-parity.test.ts","sha256":"633d471e16e9fe5b488d2d1f4251620e0c5ee8c56d8d92fe915bbb884b1af05d","size":24718,"symbols":[{"name":"toggle","kind":"method","sha256":"f33f08588bf195c4fe38ea29d60d6c06046067707ee18c67e0efd3dde553aca5"},{"name":"nums","kind":"constant","sha256":"1f2e259453aee7b637c9466f76b7c74a927fc7f88f05e2dfa0357a7115c55c3a"},{"name":"rows","kind":"constant","sha256":"0cb98e955ae0e4320ebc543e0dd0c3d95037e6a407b050f150289e13c0247459"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":94,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":417,"unresolved_symbols":["innerHTML","noEmit"]},"created_at":"2026-08-21T09:24:37.919Z","updated_at":"2026-08-21T14:51:19.903Z","author_branch":"kage/two-deferred-design-parity-gaps-from-the-260821-8fc8"}
```

