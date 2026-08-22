---
type: "belief"
title: "Release: npm Publish and Electron Packaging Flow"
tags: ["release", "npm", "electron-builder", "packaging", "code-signing", "release.js"]
---

# Release: npm Publish and Electron Packaging Flow

**Confidence:** firm — the mechanics are documented across two verified runbooks and several confirmed local-build decisions, but Apple notarization specifically is never evidenced in this packet set (only ad-hoc dev signing).

Kage ships two distinct release artifacts through two distinct pipelines: the `@kage-core/kage-graph-mcp` npm package, and the Electron desktop shell. The npm side is published by running `node mcp/dist/release.js --publish --smoke` (or `--push`) from `mcp/`, a maintainer-only helper (its source and `dist/release.js` are deliberately excluded from the published npm tarball so end users only ever see the `kage`/`kage-graph-mcp` runtime commands, not release tooling). The script preflights a clean worktree, confirms `origin/<branch>` is an ancestor of HEAD (rebasing first if the `kage-sync` bot raced it with a `[skip ci]` commit), runs the package's tests and an `npm pack --dry-run`, then publishes with `--access public`, polls `npm view` until the new version is visible, and smoke-installs the tarball into a temp prefix. Critically, master is not required — a release can publish from any named branch, including the actual integration branch (`release-prep`) before its PR merges. After the npm publish, a second registry publish targets the MCP server registry via `mcp-publisher publish` (short-lived JWTs, both version fields in `server.json` must be bumped), and finally the vendored MCP copy at `~/.claude/kage-mcp/dist` — the one the Claude desktop launcher actually pins via `--mcp-config` — must be manually upgraded by copying `mcp/dist/*` and `package.json` over it, or the running server stays stale regardless of what npm now serves. Because this whole sequence runs non-interactively, any step that could open an editor (git rebase/commit continuation) must be forced through with `GIT_EDITOR=true`, and `git fetch` should run before publishing to avoid a slow surprise when `origin/master` moves mid-release.

The Electron shell side is simpler and lower-stakes than it looks: `npm run dist --prefix shell` (electron-builder `--mac --dir`) and `npm run dmg --prefix shell` both succeed fully offline, with ad-hoc code signing kicking in automatically (confirmed via `codesign -dv` showing a valid `dev.kage.desktop` identity) — no Apple Developer credentials are needed for a local build. `latest-mac.yml` is generated locally the moment a `publish` config exists in the builder config and a zip mac target builds, independent of `--publish` or network access; only actually uploading it requires credentials. Only `npm run release` (`--publish`) needs `GH_TOKEN` and network, and was correctly left unrun in the investigated session. Separately, no GitHub release on `kage-core/Kage` currently ships a `.dmg` or `latest-mac.yml` asset at all (confirmed via `gh release view` on v2.5.7 showing an empty asset list), so any desktop-download copy must link the releases index page, never a direct asset URL that doesn't exist yet.

## Supporting evidence

- `.agent_memory/packets/runbook-releasing-kage-release-js-flow-current-as-of-v2-2-0-e798d129.md` — full current release.js flow: publish, mcp-publisher registry step, vendored copy upgrade.
- `.agent_memory/packets/runbook-releasing-kage-release-js-publishes-from-any-named-branch-ae2e694c.md` — earlier (v2.0.0) version of the same runbook: preflights, npm publish, smoke install, version-bump locations.
- `.agent_memory/packets/decision-release-helper-stays-maintainer-only-e9d03ae8.md` — release.js/dist excluded from the public npm tarball by design.
- `.agent_memory/packets/decision-the-local-release-prep-branch-not-origin-release-prep-was-the-actual-integration-074c6283.md` — release-prep as the real integration branch, git worktree quirk when rebasing against a branch checked out elsewhere.
- `.agent_memory/packets/gotcha-release-workflow-should-be-non-interactive-and-preflight-remote-state-9e0606f6.md` — GIT_EDITOR=true, fetch-before-publish, batch memory writes before the final commit.
- `.agent_memory/packets/decision-npm-run-dist-prefix-shell-electron-builder-mac-dir-and-npm-run-dmg-prefix-232e8823.md` — local dist/dmg builds succeed with ad-hoc signing, no Apple credentials needed.
- `.agent_memory/packets/decision-electron-builder-generates-latest-mac-yml-locally-as-soon-as-a-publish-config-ex-1351cf10.md` — latest-mac.yml is a local build artifact, not a publish-only one.
- `.agent_memory/packets/decision-no-github-release-on-kage-core-kage-currently-ships-a-dmg-or-latest-mac-yml-asse-7a189c33.md` — no GitHub release currently carries a dmg/latest-mac.yml asset; link the index, not an asset URL.

## Contradictions / open questions

- None found in the cited evidence — the two runbooks (v2.0.0 and v2.2.0-current) are sequential updates of the same flow, not disagreements; the v2.2.0 one adds the mcp-publisher and vendored-copy steps that the earlier one doesn't mention.
- Apple notarization is never described in any cited packet — everything evidenced here is ad-hoc/dev-identity signing for local builds. Whether a notarized, distributable build path exists at all is an open question this packet set doesn't answer.

## Causality

```mermaid
graph TD
  A[electron-builder config declares a publish target] --> B[latest-mac.yml generated locally on every mac zip build, no network needed]
  A --> C[ad-hoc dev signing applies automatically, no Apple credentials needed]
  B --> D["npm run dist / npm run dmg" succeed fully offline]
  C --> D
  D --> E[Only "npm run release" --publish actually needs GH_TOKEN + network]
  E --> F[No GitHub release has ever uploaded a dmg/latest-mac.yml asset]
  F --> G[Download copy must link the releases index, not a direct asset URL]
```
