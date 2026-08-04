---
type: "Gotcha"
title: "electron-builder packs its own previous output when files includes dist/**/*"
description: "electron builder's default directories.output is 'dist'. platform/desktop also compiles its main process to 'dist', and the build config listed files: 'dist/ / ' . So each run packed the PREVIOUS run's dist/mac arm64/Kag"
resource: "platform/desktop/package.json"
tags: ["session-learning", "desktop", "packaging", "electron"]
timestamp: "2026-08-04T21:07:57.182Z"
x-kage-id: "repo:https-github-com-kage-core-kage:gotcha:electron-builder-packs-its-own-previous-output-when-files-includes-dist-17853197"
x-kage-type: "gotcha"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "verified"
x-kage-paths: ["platform/desktop/package.json"]
---

# electron-builder packs its own previous output when files includes dist/**/*

> electron builder's default directories.output is 'dist'. platform/desktop also compiles its main process to 'dist', a…

electron-builder's default directories.output is 'dist'. platform/desktop also compiles its main process to 'dist', and the build config listed files: ['dist/**/*']. So each run packed the PREVIOUS run's dist/mac-arm64/Kage.app into the new app.asar. Measured: app.asar 631 MB, Kage.app 874 MB, dmg 565 MB — for a shell whose own code is under 200 KB. Fix: directories.output = 'release', plus '!dist/mac*' and '!release' in files. After: app.asar 192 KB, dmg 96 MB. Note electron-builder's schema REJECTS a '//' comment key in the build block, so the reason cannot live in package.json.
Evidence: du -sh app.asar: 631M before, 192K after; dmg 565M before, 96M after
Verified by: Claude Opus 5, 2026-07-29

## Verification

du -sh app.asar: 631M before, 192K after; dmg 565M before, 96M after

# Citations

[1] explicit_capture (2026-07-29T10:09:59.445Z)
[2] reverification

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:gotcha:electron-builder-packs-its-own-previous-output-when-files-includes-dist-17853197","title":"electron-builder packs its own previous output when files includes dist/**/*","summary":"electron builder's default directories.output is 'dist'. platform/desktop also compiles its main process to 'dist', and the build config listed files: 'dist/ / ' . So each run packed the PREVIOUS run's dist/mac arm64/Kag","body":"electron-builder's default directories.output is 'dist'. platform/desktop also compiles its main process to 'dist', and the build config listed files: ['dist/**/*']. So each run packed the PREVIOUS run's dist/mac-arm64/Kage.app into the new app.asar. Measured: app.asar 631 MB, Kage.app 874 MB, dmg 565 MB — for a shell whose own code is under 200 KB. Fix: directories.output = 'release', plus '!dist/mac*' and '!release' in files. After: app.asar 192 KB, dmg 96 MB. Note electron-builder's schema REJECTS a '//' comment key in the build block, so the reason cannot live in package.json.\nEvidence: du -sh app.asar: 631M before, 192K after; dmg 565M before, 96M after\nVerified by: Claude Opus 5, 2026-07-29","type":"gotcha","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","desktop","packaging","electron"],"paths":["platform/desktop/package.json"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-07-29T10:09:59.445Z"},{"kind":"reverification","at":"2026-08-04T21:07:57.182Z","verified_by":"claude-opus-5","evidence":"Claim unchanged; platform/desktop/package.json has no edits this session. Worth noting a sibling of the same family was found and fixed elsewhere: tsc leaves compiled output for DELETED sources, so mcp/dist kept running cloud-server.test.js after its source was cut in f697a0b. That is now prevented by mcp/scripts/prune-stale-dist.mjs as a prebuild step. Same lesson, different tool — a build directory is not authoritative about what still exists.","changed_paths":[{"path":"platform/desktop/package.json","prior_sha256":"85686289bd7c439cc2a303bd2134d9d51f7dc1213715c45580d817c404401d29","sha256":"3423a3d7166aca332c9e854d73d5c999f4c9b155fea7e1c352ab4e40f141c57b"}]}],"context":{"fact":"electron-builder's default directories.output is 'dist'. platform/desktop also compiles its main process to 'dist', and the build config listed files: ['dist/**/*']. So each run packed the PREVIOUS run's dist/mac-arm64/Kage.app into the new app.asar. Measured: app.asar 631 MB, Kage.app 874 MB, dmg 565 MB — for a shell whose own code is under 200 KB. Fix: directories.output = 'release', plus '!dist/mac*' and '!release' in files. After: app.asar 192 KB, dmg 96 MB. Note electron-builder's schema REJECTS a '//' comment key in the build block, so the reason cannot live in package.json.\nEvidence: du -sh app.asar: 631M before, 192K after; dmg 565M before, 96M after\nVerified by: Claude Opus 5, 2026-07-29","verification":"du -sh app.asar: 631M before, 192K after; dmg 565M before, 96M after"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-04T21:07:57.182Z","path_fingerprints":[{"path":"platform/desktop/package.json","sha256":"3423a3d7166aca332c9e854d73d5c999f4c9b155fea7e1c352ab4e40f141c57b","size":1710}],"path_fingerprint_policy":"source_hash_staleness","verification":"evidence_reverification"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":177,"reverified_at":"2026-08-04T21:07:57.182Z"},"created_at":"2026-07-29T10:09:59.445Z","updated_at":"2026-08-04T21:07:57.182Z","author_branch":"fix/foreign-proxy-build","author_name":"Kushal Jain"}
```

