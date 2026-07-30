---
type: "Decision"
title: "Kage ships only as the Electron desktop app — no browser-hosted portal, ever; multi-repo switching wired end-to-end in the renderer UI"
description: "Kushal confirmed directly (not via a packet) that Kage will never have a browser-hosted portal or team dashboard: platform/desktop (Electron, loading platform/web over kage://) is the only product surface, single-user"
resource: "platform/web/src/components/RepositorySwitcher.tsx"
tags: ["session-learning", "design", "desktop", "electron", "ui", "ux", "multi-repo", "supersession"]
timestamp: "2026-07-29T00:00:00.000Z"
x-kage-id: "repo:https-github-com-kage-core-kage:decision:kage-ships-only-as-the-electron-desktop-app-no-browser-portal-multi-repo-switchi"
x-kage-type: "decision"
x-kage-status: "superseded"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "superseded"
x-kage-paths: ["platform/web/src/components/RepositorySwitcher.tsx", "platform/web/src/pages/SettingsPage.tsx", "platform/web/src/App.tsx", "platform/web/src/router.ts", "mcp/vnext/api/types.ts", "mcp/vnext/api/read-models.ts"]
---

# Kage ships only as the Electron desktop app — no browser-hosted portal, ever; multi-repo switching wired end-to-end in the renderer UI

> Kushal confirmed directly (not via a packet) that Kage will never have a browser-hosted portal or team dashboard: pla…

Kushal confirmed directly (in-session, not a repo-memory packet) that Kage will never ship a browser-hosted portal or team dashboard. platform/desktop (Electron, loading the platform/web React SPA over a custom kage:// scheme) is the only product surface, and it is single-user. Deleted BillingPage/IntegrationsPage and their dead backend DTOs (BillingPanelDto, IntegrationsDto, billingPanel()); kept IntegrationDto/OverviewDto.integrations (still real callers). Rewrote RepositorySwitcher into a working multi-repo menu (switch/remove/add), reusing the already-complete platform/desktop IPC/bridge layer; added a matching Repositories section to SettingsPage plus a Preferences sidebar-foot link. Dropped stray team wording in WorkPage/WorkItemPage/ProofPage. Supersedes two prior collaborative/hybrid-team-architecture packets for the viewer/portal surface specifically.

## Verification

platform/web vitest 136/136; platform/desktop build:all clean; built app boots without crash (no display to screenshot in this session)

# Citations

[1] explicit_capture (2026-07-29T00:00:00.000Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:decision:kage-ships-only-as-the-electron-desktop-app-no-browser-portal-multi-repo-switchi","title":"Kage ships only as the Electron desktop app — no browser-hosted portal, ever; multi-repo switching wired end-to-end in the renderer UI","summary":"Kushal confirmed directly (not via a packet) that Kage will never have a browser-hosted portal or team dashboard: platform/desktop (Electron, loading platform/web over kage://) is the only product surface, single-user","body":"Kushal confirmed directly (in-session, not a repo-memory packet) that Kage will never ship a browser-hosted portal or team dashboard. platform/desktop (Electron, loading the platform/web React SPA over a custom kage:// scheme) is the only product surface, and it is single-user. Deleted BillingPage/IntegrationsPage and their dead backend DTOs (BillingPanelDto, IntegrationsDto, billingPanel()); kept IntegrationDto/OverviewDto.integrations (still real callers). Rewrote RepositorySwitcher into a working multi-repo menu (switch/remove/add), reusing the already-complete platform/desktop IPC/bridge layer; added a matching Repositories section to SettingsPage plus a Preferences sidebar-foot link. Dropped stray team wording in WorkPage/WorkItemPage/ProofPage. Supersedes two prior collaborative/hybrid-team-architecture packets for the viewer/portal surface specifically.","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"superseded","confidence":0.9,"tags":["session-learning","design","desktop","electron","ui","ux","multi-repo","supersession"],"paths":["platform/web/src/components/RepositorySwitcher.tsx","platform/web/src/pages/SettingsPage.tsx","platform/web/src/App.tsx","platform/web/src/router.ts","mcp/vnext/api/types.ts","mcp/vnext/api/read-models.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-07-29T00:00:00.000Z"}],"context":{"fact":"Kage is Electron-desktop-only, single-user, no browser portal, ever; RepositorySwitcher and Settings now wire real multi-repo switch/remove/add end-to-end; Billing/Integrations pages and dead DTOs removed.","verification":"platform/web vitest 136/136; platform/desktop build:all clean; built app boots without crash (no display to screenshot in this session)"},"freshness":{"ttl_days":365,"last_verified_at":"2026-07-29T00:00:00.000Z","path_fingerprints":[],"path_fingerprint_policy":"source_hash_staleness","verification":"explicit_capture","superseded_at":"2026-07-30T20:19:48.397Z","superseded_by":"repo:https-github-com-kage-core-kage:decision:the-desktop-app-is-the-portal-for-single-users-and-teams-no-portal-meant-no-sepa","superseded_reason":"the single-user gloss was a misreading — Kushal: no portal meant no web page; teams are in scope and the app is each person's portal"},"edges":[{"kind":"supersedes","target":"repo:https-github-com-kage-core-kage:decision:design-kages-collaborative-memory-story-is-git-native-v0-not-a-fake-org-tier-aud"},{"kind":"supersedes","target":"repo:https-github-com-kage-core-kage:decision:kage-cloud-link-kage-viewer-team-sidebar-link-local-viewer-surfaces-the-hosted-d"},{"relation":"superseded_by","to":"repo:https-github-com-kage-core-kage:decision:the-desktop-app-is-the-portal-for-single-users-and-teams-no-portal-meant-no-sepa","evidence":"the single-user gloss was a misreading — Kushal: no portal meant no web page; teams are in scope and the app is each person's portal","created_at":"2026-07-30T20:19:48.397Z"}],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":0,"discovery_tokens_estimated":true,"score":0,"reasons":["explicit user decision","authored manually — kage_learn tool unavailable this session"],"risks":["not machine-verified against code hashes; authored by hand because kage_learn/kage_supersede were not available as callable tools this session"],"duplicate_candidates":[],"estimated_tokens_saved":0,"total_uses":0,"last_accessed_at":"2026-07-29T00:00:00.000Z","reverified_at":"2026-07-29T00:00:00.000Z","stale":false,"stale_reasons":[],"suggested_action":"none","superseded_by":"repo:https-github-com-kage-core-kage:decision:the-desktop-app-is-the-portal-for-single-users-and-teams-no-portal-meant-no-sepa","superseded_reason":"the single-user gloss was a misreading — Kushal: no portal meant no web page; teams are in scope and the app is each person's portal"},"created_at":"2026-07-29T00:00:00.000Z","updated_at":"2026-07-30T20:19:48.397Z","author_branch":"fix/foreign-proxy-build","author_name":"Kushal Jain"}
```

