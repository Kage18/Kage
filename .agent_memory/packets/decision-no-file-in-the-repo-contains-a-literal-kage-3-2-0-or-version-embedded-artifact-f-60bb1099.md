---
type: "Decision"
title: "No file in the repo contains a literal 'Kage-3.2.0' or version-embedded artifact filena..."
description: "No file in the repo contains a literal 'Kage 3.2.0' or version embedded artifact filename string — release artifact names come from electron builder's default '${productName} ${version} ${arch}' template driven off shell"
resource: "CHANGELOG.md"
tags: ["delegated-run", "kage-run:rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43"]
timestamp: "2026-08-21T19:40:58.410Z"
x-kage-id: "repo:rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43:decision:no-file-in-the-repo-contains-a-literal-kage-3-2-0-or-version-embedded-artifact-f"
x-kage-type: "decision"
x-kage-status: "pending"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["CHANGELOG.md", "mcp/package.json", "plugin/.claude-plugin/plugin.json", "plugin/.codex-plugin/plugin.json", "server.json", "shell/package-lock.json"]
---

# No file in the repo contains a literal 'Kage-3.2.0' or version-embedded artifact filena...

> No file in the repo contains a literal 'Kage 3.2.0' or version embedded artifact filename string — release artifact n…

No file in the repo contains a literal 'Kage-3.2.0' or version-embedded artifact filename string — release artifact names come from electron-builder's default '${productName}-${version}-${arch}' template driven off shell/package.json's version field, so renaming the shell version alone produces correct future artifact names with no separate docs/build-config edit needed.

Learned while delivering: Rename the release from v3.2.0 to v5.0.0 - npm burned 3.2.0 (published and deprecated in the discontinued pre-rollback lineage; highest published is 4.0.6, latest tag 3.1.0), so the new lineage ships as 5.0.0. Change every current-release 3.2.0 reference in lockstep: mcp/package.json version, shell/package.json version, the version-lockstep test expectations wherever they live (find them), server.json if versioned, CHANGELOG.md heading (## v3.2.0 becomes ## v5.0.0, entry content unchanged), and docs that name the version or artifact filenames (docs/releases.html, README.md desktop section, docs/index.html if it names it) - artifact names become Kage-5.0.0-arm64. Grep the repo for the literal string 3.2.0 and account for every hit in your claim: change it or state why it stays (historical mentions in .agent_memory packets and older changelog entries stay). Do not bump to 4.x and do not touch the npm registry. Full suite green; cite files individually.
Verified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

## Verification

npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability

# Citations

[1] explicit_capture (2026-08-21T19:40:58.410Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43:decision:no-file-in-the-repo-contains-a-literal-kage-3-2-0-or-version-embedded-artifact-f","title":"No file in the repo contains a literal 'Kage-3.2.0' or version-embedded artifact filena...","summary":"No file in the repo contains a literal 'Kage 3.2.0' or version embedded artifact filename string — release artifact names come from electron builder's default '${productName} ${version} ${arch}' template driven off shell","body":"No file in the repo contains a literal 'Kage-3.2.0' or version-embedded artifact filename string — release artifact names come from electron-builder's default '${productName}-${version}-${arch}' template driven off shell/package.json's version field, so renaming the shell version alone produces correct future artifact names with no separate docs/build-config edit needed.\n\nLearned while delivering: Rename the release from v3.2.0 to v5.0.0 - npm burned 3.2.0 (published and deprecated in the discontinued pre-rollback lineage; highest published is 4.0.6, latest tag 3.1.0), so the new lineage ships as 5.0.0. Change every current-release 3.2.0 reference in lockstep: mcp/package.json version, shell/package.json version, the version-lockstep test expectations wherever they live (find them), server.json if versioned, CHANGELOG.md heading (## v3.2.0 becomes ## v5.0.0, entry content unchanged), and docs that name the version or artifact filenames (docs/releases.html, README.md desktop section, docs/index.html if it names it) - artifact names become Kage-5.0.0-arm64. Grep the repo for the literal string 3.2.0 and account for every hit in your claim: change it or state why it stays (historical mentions in .agent_memory packets and older changelog entries stay). Do not bump to 4.x and do not touch the npm registry. Full suite green; cite files individually.\nVerified by: npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"pending","confidence":0.7,"tags":["delegated-run","kage-run:rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43"],"paths":["CHANGELOG.md","mcp/package.json","plugin/.claude-plugin/plugin.json","plugin/.codex-plugin/plugin.json","server.json","shell/package-lock.json"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T19:40:58.410Z"}],"context":{"fact":"No file in the repo contains a literal 'Kage-3.2.0' or version-embedded artifact filename string — release artifact names come from electron-builder's default '${productName}-${version}-${arch}' template driven off shell/package.json's version field, so renaming the shell version alone produces correct future artifact names with no separate docs/build-config edit needed.","verification":"npm test --prefix mcp, diff-size, citations, npx tsc --noEmit -p mcp/tsconfig.json, reachability"},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T19:40:58.410Z","path_fingerprints":[{"path":"CHANGELOG.md","sha256":"e73e55dff0ac70d598875fe43060f2413a7ca2193b18da809af03848758b931f","size":70154},{"path":"mcp/package.json","sha256":"da8306c1ad3063789568ed6f2dd633de1d753e61f5fa9a210e0f44015af6b377","size":1551},{"path":"plugin/.claude-plugin/plugin.json","sha256":"f56fdd7fe9040de113fe92b9d777c5677c1e577ed106bc668f242c64acf61941","size":698},{"path":"plugin/.codex-plugin/plugin.json","sha256":"e4883d01d02ae9cbabb6c09822d3814cb40acc9bc3881032cca6cf4bfa0dd73e","size":357},{"path":"server.json","sha256":"b2c60654e484497d857024ddf2481e86fcc0d04648f871984f18ada4e848fb26","size":813},{"path":"shell/package-lock.json","sha256":"531b658de768ee0ec4be42c891b3c9a973cf9d21c2172b482c438a7c21fca230","size":192528}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":369},"created_at":"2026-08-21T19:40:58.410Z","updated_at":"2026-08-21T19:40:58.704Z","author_branch":"kage/rename-the-release-from-v3-2-0-to-v5-0-0-260821-1a43"}
```

