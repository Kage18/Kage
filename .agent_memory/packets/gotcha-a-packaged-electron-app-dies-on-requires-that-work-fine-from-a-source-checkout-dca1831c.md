---
type: "Gotcha"
title: "A packaged Electron app dies on requires that work fine from a source checkout"
description: "platform/desktop bundles mcp/dist via electron builder extraResources, but NOT mcp/node modules. So any module the shell requires must resolve with node builtins alone. The first packaged Kage.app launched and immediatel"
resource: "platform/desktop/src/kage-core.ts"
tags: ["session-learning", "desktop", "packaging", "electron"]
timestamp: "2026-07-29T10:09:42.359Z"
x-kage-id: "repo:https-github-com-kage-core-kage:gotcha:a-packaged-electron-app-dies-on-requires-that-work-fine-from-a-source-checkout-1"
x-kage-type: "gotcha"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "unverified"
x-kage-paths: ["platform/desktop/src/kage-core.ts", "mcp/vnext/desktop/portal-assets.ts", "mcp/daemon.ts"]
---

# A packaged Electron app dies on requires that work fine from a source checkout

> platform/desktop bundles mcp/dist via electron builder extraResources, but NOT mcp/node modules. So any module the sh…

platform/desktop bundles mcp/dist via electron-builder extraResources, but NOT mcp/node_modules. So any module the shell requires must resolve with node builtins alone. The first packaged Kage.app launched and immediately died with 'Cannot find module typescript': src/kage-core.ts required daemon.js for resolvePortalDir/resolveAppAsset and anthropic-proxy.js for proxyTaskId, and daemon.js requires kernel.js which requires typescript. Every test passed and the dev shell ran perfectly — only launching the real .app surfaced it. Fix: those three functions moved to mcp/vnext/desktop/portal-assets.ts (node:crypto, node:fs, node:path only) and are re-exported from daemon.ts and anthropic-proxy.ts so there is still ONE implementation. mcp/vnext/desktop/protocol.test.ts now walks the compiled dist/vnext/desktop/*.js and fails on any bare (non-relative, non-node:) require.
Evidence: Packaged app dialog: 'Kage cannot start — Cannot find module typescript. Require stack: .../Resources/kage/dist/kernel.js, .../kage/dist/daemon.js, .../app.asar/dist/kage-core.js'. After the move, the packaged app launches and renders live repo data.
Verified by: Claude Opus 5, 2026-07-29

## Verification

Packaged app dialog: 'Kage cannot start — Cannot find module typescript. Require stack: .../Resources/kage/dist/kernel.js, .../kage/dist/daemon.js, .../app.asar/dist/kage-core.js'. After the move, the packaged app launches and renders live repo data.

# Citations

[1] explicit_capture (2026-07-29T10:09:42.359Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:gotcha:a-packaged-electron-app-dies-on-requires-that-work-fine-from-a-source-checkout-1","title":"A packaged Electron app dies on requires that work fine from a source checkout","summary":"platform/desktop bundles mcp/dist via electron builder extraResources, but NOT mcp/node modules. So any module the shell requires must resolve with node builtins alone. The first packaged Kage.app launched and immediatel","body":"platform/desktop bundles mcp/dist via electron-builder extraResources, but NOT mcp/node_modules. So any module the shell requires must resolve with node builtins alone. The first packaged Kage.app launched and immediately died with 'Cannot find module typescript': src/kage-core.ts required daemon.js for resolvePortalDir/resolveAppAsset and anthropic-proxy.js for proxyTaskId, and daemon.js requires kernel.js which requires typescript. Every test passed and the dev shell ran perfectly — only launching the real .app surfaced it. Fix: those three functions moved to mcp/vnext/desktop/portal-assets.ts (node:crypto, node:fs, node:path only) and are re-exported from daemon.ts and anthropic-proxy.ts so there is still ONE implementation. mcp/vnext/desktop/protocol.test.ts now walks the compiled dist/vnext/desktop/*.js and fails on any bare (non-relative, non-node:) require.\nEvidence: Packaged app dialog: 'Kage cannot start — Cannot find module typescript. Require stack: .../Resources/kage/dist/kernel.js, .../kage/dist/daemon.js, .../app.asar/dist/kage-core.js'. After the move, the packaged app launches and renders live repo data.\nVerified by: Claude Opus 5, 2026-07-29","type":"gotcha","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","desktop","packaging","electron"],"paths":["platform/desktop/src/kage-core.ts","mcp/vnext/desktop/portal-assets.ts","mcp/daemon.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-07-29T10:09:42.359Z"}],"context":{"fact":"platform/desktop bundles mcp/dist via electron-builder extraResources, but NOT mcp/node_modules. So any module the shell requires must resolve with node builtins alone. The first packaged Kage.app launched and immediately died with 'Cannot find module typescript': src/kage-core.ts required daemon.js for resolvePortalDir/resolveAppAsset and anthropic-proxy.js for proxyTaskId, and daemon.js requires kernel.js which requires typescript. Every test passed and the dev shell ran perfectly — only launching the real .app surfaced it. Fix: those three functions moved to mcp/vnext/desktop/portal-assets.ts (node:crypto, node:fs, node:path only) and are re-exported from daemon.ts and anthropic-proxy.ts so there is still ONE implementation. mcp/vnext/desktop/protocol.test.ts now walks the compiled dist/vnext/desktop/*.js and fails on any bare (non-relative, non-node:) require.\nEvidence: Packaged app dialog: 'Kage cannot start — Cannot find module typescript. Require stack: .../Resources/kage/dist/kernel.js, .../kage/dist/daemon.js, .../app.asar/dist/kage-core.js'. After the move, the packaged app launches and renders live repo data.\nVerified by: Claude Opus 5, 2026-07-29","verification":"Packaged app dialog: 'Kage cannot start — Cannot find module typescript. Require stack: .../Resources/kage/dist/kernel.js, .../kage/dist/daemon.js, .../app.asar/dist/kage-core.js'. After the move, the packaged app launches and renders live repo data."},"freshness":{"ttl_days":365,"last_verified_at":"2026-07-29T10:09:42.359Z","path_fingerprints":[{"path":"platform/desktop/src/kage-core.ts","sha256":"142fa9ee4de4c06453c23b218a44fd7b7d35206993c7acaba2919239238f637c","size":7433},{"path":"mcp/vnext/desktop/portal-assets.ts","sha256":"99dab82833c68967c04bb0f3278178f1c7157f90b13c4c607fd38c5b234a16d8","size":3926,"symbols":[{"name":"resolveportaldir","kind":"function","sha256":"690d6e30ac077274eaec0c6400c207e209aefe15ae4dded022dd1393222a8028"},{"name":"resolveappasset","kind":"function","sha256":"7f19619cb7da81f8aca6a482223f240927517b016a9f66532f9e33c8fc81ff05"},{"name":"proxytaskid","kind":"function","sha256":"d356e96d2d3932d26996d7bb99a38a9a2734c8b853c16468f82fd04ff4571770"}]},{"path":"mcp/daemon.ts","sha256":"26c991cba5a69f160f887380e44abcc5bf4b157bf1153bc0b94048f0e25f6afe","size":63082}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":294},"created_at":"2026-07-29T10:09:42.359Z","updated_at":"2026-07-29T10:09:42.359Z","author_branch":"fix/foreign-proxy-build","author_name":"Kushal Jain"}
```

