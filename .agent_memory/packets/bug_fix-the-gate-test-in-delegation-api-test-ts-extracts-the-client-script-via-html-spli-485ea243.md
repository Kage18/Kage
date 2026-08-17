---
type: "Bug Fix"
title: "The gate test in delegation-api.test.ts extracts the client script via `html.split(\"<sc..."
description: "The gate test in delegation api.test.ts extracts the client script via html.split \"<script \" 1 — this only matches the literal exact substring <script with no attributes, so the two <script src=\"/vendor/...\" tags in app "
resource: "mcp/delegation-api.test.ts"
tags: ["delegated-run", "kage-run:land-the-room-chat-rendering-fix-a-verif-260817-13cb"]
timestamp: "2026-08-17T19:34:28.721Z"
x-kage-id: "repo:land-the-room-chat-rendering-fix-a-verif-260817-13cb:bug_fix:the-gate-test-in-delegation-api-test-ts-extracts-the-client-script-via-html-spli"
x-kage-type: "bug_fix"
x-kage-status: "pending"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/delegation-api.test.ts", "mcp/delegation/app-client.ts", "mcp/delegation/app-styles.ts"]
---

# The gate test in delegation-api.test.ts extracts the client script via `html.split("<sc...

> The gate test in delegation api.test.ts extracts the client script via html.split "<script " 1 — this only matches th…

The gate test in delegation-api.test.ts extracts the client script via `html.split("<script>")[1]` — this only matches the literal exact substring `<script>` with no attributes, so the two `<script src="/vendor/...">` tags in app-html.ts don't interfere; only the inline APP_CLIENT script is checked.

Learned while delivering: Land the Room chat rendering fix. A VERIFIED-CONTENT implementation exists on branch kage/fix-three-room-chat-rendering-defects-in-260817-7831 — read it with git show and replicate it faithfully into this worktree: it fixes flicker (signature-gated renderRoom, SSE deltas update only the typing elements, entry animation only for never-painted turns), adds a safe split()-based markdown renderer for kage turns (bold, inline code, paragraphs — DOM nodes only), and renders compact inline run cards under kage turns for run ids mentioned in the turn text. That branch failed verification on exactly ONE self-inflicted defect you must fix while replicating: its new gate test in mcp/delegation-api.test.ts (the client script never assigns innerHTML) asserts the composed script does not CONTAIN the string innerHTML, but the implementation comment in app-client.ts around the markdown renderer says No innerHTML, no regex — the gate caught its own prose. Fix both sides: reword that comment to avoid the literal token (e.g. built from real DOM nodes, never from HTML strings), and keep the gate as a plain containment check so real usage can never hide. Change nothing else relative to the reference branch. Remember both renderer files are TS template literals: doubled escapes, no backticks, no ${, prefer split()/indexOf over regex. Success = npm test fully green.
Verified by: diff-size, citations

## Verification

diff-size, citations

# Citations

[1] explicit_capture (2026-08-17T19:34:28.721Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:land-the-room-chat-rendering-fix-a-verif-260817-13cb:bug_fix:the-gate-test-in-delegation-api-test-ts-extracts-the-client-script-via-html-spli","title":"The gate test in delegation-api.test.ts extracts the client script via `html.split(\"<sc...","summary":"The gate test in delegation api.test.ts extracts the client script via html.split \"<script \" 1 — this only matches the literal exact substring <script with no attributes, so the two <script src=\"/vendor/...\" tags in app ","body":"The gate test in delegation-api.test.ts extracts the client script via `html.split(\"<script>\")[1]` — this only matches the literal exact substring `<script>` with no attributes, so the two `<script src=\"/vendor/...\">` tags in app-html.ts don't interfere; only the inline APP_CLIENT script is checked.\n\nLearned while delivering: Land the Room chat rendering fix. A VERIFIED-CONTENT implementation exists on branch kage/fix-three-room-chat-rendering-defects-in-260817-7831 — read it with git show and replicate it faithfully into this worktree: it fixes flicker (signature-gated renderRoom, SSE deltas update only the typing elements, entry animation only for never-painted turns), adds a safe split()-based markdown renderer for kage turns (bold, inline code, paragraphs — DOM nodes only), and renders compact inline run cards under kage turns for run ids mentioned in the turn text. That branch failed verification on exactly ONE self-inflicted defect you must fix while replicating: its new gate test in mcp/delegation-api.test.ts (the client script never assigns innerHTML) asserts the composed script does not CONTAIN the string innerHTML, but the implementation comment in app-client.ts around the markdown renderer says No innerHTML, no regex — the gate caught its own prose. Fix both sides: reword that comment to avoid the literal token (e.g. built from real DOM nodes, never from HTML strings), and keep the gate as a plain containment check so real usage can never hide. Change nothing else relative to the reference branch. Remember both renderer files are TS template literals: doubled escapes, no backticks, no ${, prefer split()/indexOf over regex. Success = npm test fully green.\nVerified by: diff-size, citations","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"pending","confidence":0.7,"tags":["delegated-run","kage-run:land-the-room-chat-rendering-fix-a-verif-260817-13cb"],"paths":["mcp/delegation-api.test.ts","mcp/delegation/app-client.ts","mcp/delegation/app-styles.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-17T19:34:28.721Z"}],"context":{"fact":"The gate test in delegation-api.test.ts extracts the client script via `html.split(\"<script>\")[1]` — this only matches the literal exact substring `<script>` with no attributes, so the two `<script src=\"/vendor/...\">` tags in app-html.ts don't interfere; only the inline APP_CLIENT script is checked.","verification":"diff-size, citations"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-17T19:34:28.721Z","path_fingerprints":[{"path":"mcp/delegation-api.test.ts","sha256":"77536edccc284a423b0d667a0dc107402c7591c8c773a942cd58b0d0e33c7710","size":49144,"symbols":[{"name":"token","kind":"constant","sha256":"9834ba45163697ce4cd9fd57ea9862eb97e3007759508c14c382a70025222c71"},{"name":"room","kind":"constant","sha256":"daca1174495725bcfe924b660b84e822be76aea4fbb7dc3ebb244be8b8a9aa47"},{"name":"check","kind":"function","sha256":"7b30564574a597040e8dba4b655835572d5ee55cf88928c264f07931c49d79d5"},{"name":"learned","kind":"constant","sha256":"86a9cef845cb3f653282806e5a05f474fd9c20f4ad4af48ec5d031f762c896d5"},{"name":"diff","kind":"constant","sha256":"4755f26124dc87f6c211031d5c8f7b97491ca68a2f89a4a806acbacee62110a6"}]},{"path":"mcp/delegation/app-client.ts","sha256":"093938d6a696b18548110c17214056485b73a8b4bee147645b1cf83708f2d7b9","size":114231,"symbols":[{"name":"app_client","kind":"constant","sha256":"6fa72e84f3f6b2c31b8aade0acffc506500007dd8d933417a6d7e8c875516494"}]},{"path":"mcp/delegation/app-styles.ts","sha256":"af5526d8f25aab42941ced3974076ee4a2c12a32b4949e8a960cd0d7f147efd5","size":59005}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":94,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":432},"created_at":"2026-08-17T19:34:28.721Z","updated_at":"2026-08-17T19:34:28.898Z","author_branch":"kage/land-the-room-chat-rendering-fix-a-verif-260817-13cb"}
```

