---
type: "Decision"
title: "Code graph calls carry confidence"
description: "Kage code graph call edges now carry confidence and resolution metadata. TypeScript AST name matches are higher confidence than generic static name matches; external index calls are marked as external index. Keep older g"
resource: "mcp/kernel.ts"
tags: ["session-learning", "code-graph", "calls", "confidence", "viewer"]
timestamp: "2026-08-14T19:07:40.319Z"
x-kage-id: "repo:https-github-com-kage-core-kage:decision:code-graph-calls-carry-confidence-1778822286924"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["mcp/kernel.ts", "mcp/kernel.test.ts", "README.md", "mcp/README.md", "docs/guide.html", "docs/releases.html", "CHANGELOG.md"]
---

# Code graph calls carry confidence

> Kage code graph call edges now carry confidence and resolution metadata. TypeScript AST name matches are higher confi…

Kage code graph call edges now carry confidence and resolution metadata. TypeScript AST name matches are higher confidence than generic static name matches; external index calls are marked as external_index. Keep older graph artifacts compatible by hydrating missing confidence with conservative defaults, and show call confidence in code-graph context and the viewer so weak generic call edges do not look as certain as parser-backed edges.
Verified by: npm test --prefix mcp; npm pack --dry-run; node --check mcp/viewer/app.js; node --check docs/viewer/app.js

## Verification

npm test --prefix mcp; npm pack --dry-run; node --check mcp/viewer/app.js; node --check docs/viewer/app.js

# Citations

[1] explicit_capture (2026-05-15T05:18:06.923Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:decision:code-graph-calls-carry-confidence-1778822286924","title":"Code graph calls carry confidence","summary":"Kage code graph call edges now carry confidence and resolution metadata. TypeScript AST name matches are higher confidence than generic static name matches; external index calls are marked as external index. Keep older g","body":"Kage code graph call edges now carry confidence and resolution metadata. TypeScript AST name matches are higher confidence than generic static name matches; external index calls are marked as external_index. Keep older graph artifacts compatible by hydrating missing confidence with conservative defaults, and show call confidence in code-graph context and the viewer so weak generic call edges do not look as certain as parser-backed edges.\nVerified by: npm test --prefix mcp; npm pack --dry-run; node --check mcp/viewer/app.js; node --check docs/viewer/app.js","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","code-graph","calls","confidence","viewer"],"paths":["mcp/kernel.ts","mcp/kernel.test.ts","README.md","mcp/README.md","docs/guide.html","docs/releases.html","CHANGELOG.md"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-05-15T05:18:06.923Z"}],"context":{"fact":"Kage code graph call edges now carry confidence and resolution metadata. TypeScript AST name matches are higher confidence than generic static name matches; external index calls are marked as external_index. Keep older graph artifacts compatible by hydrating missing confidence with conservative defaults, and show call confidence in code-graph context and the viewer so weak generic call edges do not look as certain as parser-backed edges.\nVerified by: npm test --prefix mcp; npm pack --dry-run; node --check mcp/viewer/app.js; node --check docs/viewer/app.js","verification":"npm test --prefix mcp; npm pack --dry-run; node --check mcp/viewer/app.js; node --check docs/viewer/app.js"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-14T19:07:40.319Z","verification":"repo_local_agent_capture","path_fingerprints":[{"path":"mcp/kernel.ts","sha256":"7ebce3b5046d5862a8feb56af4dcf5f2671e0717dfd165b87989398ee9800196","size":878058,"symbols":[{"name":"verified","kind":"constant","sha256":"9e1998eeb03a854663c4ce2fa27bc0dde75922738f56430c157d33ea3ab8d3b8"},{"name":"call","kind":"constant","sha256":"0e1296678bffa8037b9dc66bffb9dbec82218bdd1cd66c11e341879266eb9454"},{"name":"code","kind":"constant","sha256":"64b81d42a4c6de11c6ff891787a63a33c198717dba5a924932817e97a8d1f7cf"},{"name":"show","kind":"constant","sha256":"a1286db8e7ca4067e360ba4fb6da776faab1a9b50a1ce06dd8efb185376816f6"},{"name":"keep","kind":"constant","sha256":"3e5df93c6de57dbae093461e4198d2bc24bb055a50d3f6a8bd6449397fd00f3b"}]},{"path":"mcp/kernel.test.ts","sha256":"39cfc5769f7abc664c408d6318c0464bd4f77a5f181baefb20f26d4b7dc8cb9a","size":306283,"symbols":[{"name":"calls","kind":"constant","sha256":"4b435c2c9448e76bfa4e3a1f26d4c8c42059b4125bd76c0254a3af23bacd66a4"},{"name":"edges","kind":"constant","sha256":"8c37bcd95245ff6d66b6f8b413ce98901f9c5e8bad1c2b4dc47e75e3b2815f73"},{"name":"missing","kind":"constant","sha256":"8c9fa6e4673545533b5cdc9a6ac45e775f0fb7ec7d969a7602c2d97d1411b01e"},{"name":"name","kind":"constant","sha256":"a7f814455c60117729623029221d4ef4a13b21b286fd56f6d26c7ef3079374a5"}]},{"path":"README.md","sha256":"ec9699b62478585f9b7f1ec82de198b84a1b2b6dc1c0a08c006d52dccf02a96f","size":13468},{"path":"mcp/README.md","sha256":"5c852f608754e299c2cff74495862f1ce4775d0bda5776d7ce4f070f4e4a6494","size":10129},{"path":"docs/guide.html","sha256":"618068bc85df8126f2fdd6d07aa3272c4a35fb5894fc38b4e73cadcb36a9d3ff","size":51837},{"path":"docs/releases.html","sha256":"842dcc5e67b82300f533415b4bbd86c6b8df6e03a7a9f173ec7c81d91a98d254","size":11134},{"path":"CHANGELOG.md","sha256":"f4bd5287aa5f31bb1f800673370da3b2178e5b77e7036f38499365a9ae70ffcb","size":56187}]},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":141,"reverified_at":"2026-08-14T19:07:40.319Z"},"created_at":"2026-05-15T05:18:06.923Z","updated_at":"2026-08-14T19:07:40.319Z"}
```

