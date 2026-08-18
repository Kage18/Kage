---
type: "Convention"
title: "docs/assets/site.css is Kage's design source of truth — not the viewer"
description: "The app's visual identity must come from docs/assets/site.css the kage core.com site , which declares itself \"V2 receipts theme — dark first product look with editorial serif display type; verified green is reserved for"
resource: "docs/assets/site.css"
tags: ["session-learning", "design", "branding", "tokens", "site", "convention"]
timestamp: "2026-08-18T06:12:14.329Z"
x-kage-id: "repo:https-github-com-kage-core-kage:convention:docs-assets-site-css-is-kages-design-source-of-truth-not-the-viewer-178687920736"
x-kage-type: "convention"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["docs/assets/site.css", "mcp/delegation/app-html.ts", "shell/main.js", "docs/assets/kage-eye.svg"]
---

# docs/assets/site.css is Kage's design source of truth — not the viewer

> The app's visual identity must come from docs/assets/site.css the kage core.com site , which declares itself "V2 rece…

The app's visual identity must come from docs/assets/site.css (the kage-core.com site), which declares itself "V2 receipts theme — dark-first product look with editorial serif display type; verified-green is reserved for gains/primary action. One look everywhere, like the product."

The app was unified against mcp/viewer/index.html instead, which is a LEGACY surface being retired, and the result matched almost nothing:

  ground   #121619 blue-black    should be #121413 green-black
  accent   #e86a42 orange seal   should be #43c98a verified green — orange appears nowhere on the site
  mark     影 kanji               should be the glowing green eye (docs/assets/kage-eye.svg) — 影 appears nowhere on the site
  radii    4/6/8px tight          should be 10/14/16/22px, the site's deliberately soft "premium" scale
  figures  mono                   should be serif, matching .stat-chip strong (600 22px var(--serif))
  fonts    system-ui/SFMono       should be Inter / Fraunces / JetBrains Mono
  theme    warm light default     should be dark-first (site retired its light tokens 2026-06-12)

The tokens are now copied into the app verbatim, with --seal and --jade kept as aliases pointing at --green so existing rules keep working. Green is applied only where the site reserves it: gains figures and primary action.

Two constraints the app has that the site does not: it must work offline behind the loopback guard (a test forbids external hosts), so it takes the site's font STACKS rather than its Google Fonts link and degrades exactly as the site's own comment says it will; and it keeps a light theme despite the site retiring one, because a desktop app is used in rooms a marketing site is not — rebuilt as a faithful light rendering of the same green-black language rather than the unrelated warm palette it had.

General lesson: when told to match a design language, find the surface the product is actually SOLD on. Two internal surfaces can both look plausible and only one is canonical.
Evidence: site.css read directly for tokens; grep confirmed zero occurrences of the seal oranges (e86a42/d4552f) and zero occurrences of 影 anywhere in docs/. kage-eye.svg and kage-avatar.svg both use #39ff9a/#0bbf67 green. Verified in the running app: green eye mark, green gains figures in serif, green-black ground, soft corners, in both themes; app icon regenerated from the eye's bezier path and SHA-matched inside the packaged .dmg.
Verified by: npm test — 551 pass, 0 fail, real exit code 0; Electron capture and browser screenshots in both themes

## Verification

site.css read directly for tokens; grep confirmed zero occurrences of the seal oranges (e86a42/d4552f) and zero occurrences of 影 anywhere in docs/. kage-eye.svg and kage-avatar.svg both use #39ff9a/#0bbf67 green. Verified in the running app: green eye mark, green gains figures in serif, green-black ground, soft corners, in both themes; app icon regenerated from the eye's bezier path and SHA-matched inside the packaged .dmg.

# Citations

[1] explicit_capture (2026-08-16T11:20:07.369Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:convention:docs-assets-site-css-is-kages-design-source-of-truth-not-the-viewer-178687920736","title":"docs/assets/site.css is Kage's design source of truth — not the viewer","summary":"The app's visual identity must come from docs/assets/site.css the kage core.com site , which declares itself \"V2 receipts theme — dark first product look with editorial serif display type; verified green is reserved for","body":"The app's visual identity must come from docs/assets/site.css (the kage-core.com site), which declares itself \"V2 receipts theme — dark-first product look with editorial serif display type; verified-green is reserved for gains/primary action. One look everywhere, like the product.\"\n\nThe app was unified against mcp/viewer/index.html instead, which is a LEGACY surface being retired, and the result matched almost nothing:\n\n  ground   #121619 blue-black    should be #121413 green-black\n  accent   #e86a42 orange seal   should be #43c98a verified green — orange appears nowhere on the site\n  mark     影 kanji               should be the glowing green eye (docs/assets/kage-eye.svg) — 影 appears nowhere on the site\n  radii    4/6/8px tight          should be 10/14/16/22px, the site's deliberately soft \"premium\" scale\n  figures  mono                   should be serif, matching .stat-chip strong (600 22px var(--serif))\n  fonts    system-ui/SFMono       should be Inter / Fraunces / JetBrains Mono\n  theme    warm light default     should be dark-first (site retired its light tokens 2026-06-12)\n\nThe tokens are now copied into the app verbatim, with --seal and --jade kept as aliases pointing at --green so existing rules keep working. Green is applied only where the site reserves it: gains figures and primary action.\n\nTwo constraints the app has that the site does not: it must work offline behind the loopback guard (a test forbids external hosts), so it takes the site's font STACKS rather than its Google Fonts link and degrades exactly as the site's own comment says it will; and it keeps a light theme despite the site retiring one, because a desktop app is used in rooms a marketing site is not — rebuilt as a faithful light rendering of the same green-black language rather than the unrelated warm palette it had.\n\nGeneral lesson: when told to match a design language, find the surface the product is actually SOLD on. Two internal surfaces can both look plausible and only one is canonical.\nEvidence: site.css read directly for tokens; grep confirmed zero occurrences of the seal oranges (e86a42/d4552f) and zero occurrences of 影 anywhere in docs/. kage-eye.svg and kage-avatar.svg both use #39ff9a/#0bbf67 green. Verified in the running app: green eye mark, green gains figures in serif, green-black ground, soft corners, in both themes; app icon regenerated from the eye's bezier path and SHA-matched inside the packaged .dmg.\nVerified by: npm test — 551 pass, 0 fail, real exit code 0; Electron capture and browser screenshots in both themes","type":"convention","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","design","branding","tokens","site","convention"],"paths":["docs/assets/site.css","mcp/delegation/app-html.ts","shell/main.js","docs/assets/kage-eye.svg"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-16T11:20:07.369Z"}],"context":{"fact":"The app's visual identity must come from docs/assets/site.css (the kage-core.com site), which declares itself \"V2 receipts theme — dark-first product look with editorial serif display type; verified-green is reserved for gains/primary action. One look everywhere, like the product.\"","verification":"site.css read directly for tokens; grep confirmed zero occurrences of the seal oranges (e86a42/d4552f) and zero occurrences of 影 anywhere in docs/. kage-eye.svg and kage-avatar.svg both use #39ff9a/#0bbf67 green. Verified in the running app: green eye mark, green gains figures in serif, green-black ground, soft corners, in both themes; app icon regenerated from the eye's bezier path and SHA-matched inside the packaged .dmg."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-18T06:12:14.329Z","path_fingerprints":[{"path":"docs/assets/site.css","sha256":"b9079e6eba9f2301482252ac3744ca424f63e7fa52e6f67326a3fe6930b34bd0","size":15062},{"path":"mcp/delegation/app-html.ts","sha256":"8d92be8f15049b904b9d9de377db552ec74c430069d12fe5d05f9ace874db7d5","size":12166},{"path":"shell/main.js","sha256":"a57bc493b8d2f24aab93e1b3499a6a4143153071d636b10856988a5633c00441","size":17853,"symbols":[{"name":"icon","kind":"constant","sha256":"7ccc5035c7bcb2bf2e2e349facd9b9a5c55c20b467f0d69496ca9f834a91f7e9"},{"name":"index","kind":"constant","sha256":"42c7990486cbef9482c538e4f3451a6a8d9b7b1ef546d6fe6117062cc0ae654f"},{"name":"html","kind":"constant","sha256":"d2ffd36c531e69ad50e98d5b3ec03b86701f44bbc2414ccc47df606a4b4ed448"}]},{"path":"docs/assets/kage-eye.svg","sha256":"3c43749985d267d7bcce1cac68c225bd082ab1632dbc0220ff582caa1c5ef698","size":876}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":2000,"discovery_tokens_estimated":true,"score":94,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":639,"reverified_at":"2026-08-18T06:12:14.329Z"},"created_at":"2026-08-16T11:20:07.369Z","updated_at":"2026-08-18T06:12:14.329Z","author_branch":"release-prep"}
```

