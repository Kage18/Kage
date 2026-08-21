---
type: "Decision"
title: "`npm run dist --prefix shell` (electron-builder --mac --dir) and `npm run dmg --prefix ..."
description: "npm run dist prefix shell electron builder mac dir and npm run dmg prefix shell dmg+zip, no publish both succeed locally without Apple credentials — ad hoc signing kicks in automatically and codesign dv confirms a valid "
resource: "README.md"
tags: ["delegated-run", "kage-run:release-wiring-for-the-dmg-auto-update-d-260821-ab5c"]
timestamp: "2026-08-21T08:30:09.822Z"
x-kage-id: "repo:release-wiring-for-the-dmg-auto-update-d-260821-ab5c:decision:npm-run-dist-prefix-shell-electron-builder-mac-dir-and-npm-run-dmg-prefix-178730"
x-kage-type: "decision"
x-kage-status: "pending"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["README.md", "docs/index.html", "docs/releases.html", "mcp/release-wiring-for-the.test.ts"]
---

# `npm run dist --prefix shell` (electron-builder --mac --dir) and `npm run dmg --prefix ...

> npm run dist prefix shell electron builder mac dir and npm run dmg prefix shell dmg+zip, no publish both succeed loca…

`npm run dist --prefix shell` (electron-builder --mac --dir) and `npm run dmg --prefix shell` (dmg+zip, no --publish) both succeed locally without Apple credentials — ad-hoc signing kicks in automatically and codesign -dv confirms a valid dev.kage.desktop identity; only `npm run release` (--publish) needs GH_TOKEN/network and was correctly left unrun.

Learned while delivering: Release wiring for the .dmg + auto-update distribution: (1) docs/releases.html gets a real download section — latest .dmg from GitHub releases, what auto-update does once installed (checks on launch and every 4 hours, installs on restart; ad-hoc builds notify instead), and the right-click-Open note for unsigned builds; (2) README gets a Desktop app section with the dmg download link and the one-line install alternative; (3) the website's install/total section links the dmg alongside npx; (4) verify the shell packaging story end-to-end as far as this machine allows without Apple credentials: npm install in shell if needed, then the electron-builder --dir build must succeed (do NOT attempt notarization; if the full dmg build cannot run in this environment, say exactly which step was verified and which was not — never claim a build you did not run). Keep every claim honest: if the GitHub release with latest-mac.yml does not exist yet, write the copy so it points at the releases page rather than a dead direct link.
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-21T08:30:09.822Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:release-wiring-for-the-dmg-auto-update-d-260821-ab5c:decision:npm-run-dist-prefix-shell-electron-builder-mac-dir-and-npm-run-dmg-prefix-178730","title":"`npm run dist --prefix shell` (electron-builder --mac --dir) and `npm run dmg --prefix ...","summary":"npm run dist prefix shell electron builder mac dir and npm run dmg prefix shell dmg+zip, no publish both succeed locally without Apple credentials — ad hoc signing kicks in automatically and codesign dv confirms a valid ","body":"`npm run dist --prefix shell` (electron-builder --mac --dir) and `npm run dmg --prefix shell` (dmg+zip, no --publish) both succeed locally without Apple credentials — ad-hoc signing kicks in automatically and codesign -dv confirms a valid dev.kage.desktop identity; only `npm run release` (--publish) needs GH_TOKEN/network and was correctly left unrun.\n\nLearned while delivering: Release wiring for the .dmg + auto-update distribution: (1) docs/releases.html gets a real download section — latest .dmg from GitHub releases, what auto-update does once installed (checks on launch and every 4 hours, installs on restart; ad-hoc builds notify instead), and the right-click-Open note for unsigned builds; (2) README gets a Desktop app section with the dmg download link and the one-line install alternative; (3) the website's install/total section links the dmg alongside npx; (4) verify the shell packaging story end-to-end as far as this machine allows without Apple credentials: npm install in shell if needed, then the electron-builder --dir build must succeed (do NOT attempt notarization; if the full dmg build cannot run in this environment, say exactly which step was verified and which was not — never claim a build you did not run). Keep every claim honest: if the GitHub release with latest-mac.yml does not exist yet, write the copy so it points at the releases page rather than a dead direct link.\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"pending","confidence":0.7,"tags":["delegated-run","kage-run:release-wiring-for-the-dmg-auto-update-d-260821-ab5c"],"paths":["README.md","docs/index.html","docs/releases.html","mcp/release-wiring-for-the.test.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T08:30:09.822Z"}],"context":{"fact":"`npm run dist --prefix shell` (electron-builder --mac --dir) and `npm run dmg --prefix shell` (dmg+zip, no --publish) both succeed locally without Apple credentials — ad-hoc signing kicks in automatically and codesign -dv confirms a valid dev.kage.desktop identity; only `npm run release` (--publish) needs GH_TOKEN/network and was correctly left unrun.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T08:30:09.822Z","path_fingerprints":[{"path":"README.md","sha256":"e0fb5b362d484d11360e91d3e40280e1d835f52a31802aeed5b69457782c3c69","size":16980},{"path":"docs/index.html","sha256":"b67157e95b39b362d4bab72fa26b69a259a66835a7c03839357b1f8b57d07f04","size":43769},{"path":"docs/releases.html","sha256":"63c26cf2ba1afd588dba503087d54b76f2996792924f09fde67a4749f58dc3ff","size":12746},{"path":"mcp/release-wiring-for-the.test.ts","sha256":"7e0b9d7c4a274b50bf84fcc09d25f2e824c4fc39a9a4460a79009c98615fd237","size":5036,"symbols":[{"name":"readme","kind":"constant","sha256":"02ae92e8c52903993930bc386a53dbd0b0368be3c318cebfd0a1ff3ddcdf0d89"},{"name":"section","kind":"constant","sha256":"be39fa2e361ea7c6c91418b88ce1a27ed6d5e439912da913430b3008a1f0af31"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":94,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":380,"unresolved_symbols":["GH_TOKEN","noEmit"]},"created_at":"2026-08-21T08:30:09.822Z","updated_at":"2026-08-21T08:30:10.031Z","author_branch":"kage/release-wiring-for-the-dmg-auto-update-d-260821-ab5c"}
```

