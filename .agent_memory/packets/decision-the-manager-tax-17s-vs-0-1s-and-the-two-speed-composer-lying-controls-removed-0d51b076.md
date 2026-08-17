---
type: "Decision"
title: "The manager tax (17s vs 0.1s) and the two-speed composer; lying controls removed"
description: "Measured on this machine: sending a message through the Room the app's front door takes ~17 seconds to produce any response, because every message costs a full manager claude turn — while direct dispatch POST /runs takes"
resource: "docs/CRITIQUE.md"
tags: ["session-learning", "manager-tax", "composer", "lying-controls", "receipt", "critique"]
timestamp: "2026-08-17T20:52:25.137Z"
x-kage-id: "repo:https-github-com-kage-core-kage:decision:the-manager-tax-17s-vs-0-1s-and-the-two-speed-composer-lying-controls-removed-17"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["docs/CRITIQUE.md", "mcp/delegation/app-client.ts", "mcp/delegation/app-styles.ts"]
---

# The manager tax (17s vs 0.1s) and the two-speed composer; lying controls removed

> Measured on this machine: sending a message through the Room the app's front door takes ~17 seconds to produce any re…

Measured on this machine: sending a message through the Room (the app's front door) takes ~17 seconds to produce any response, because every message costs a full manager claude turn — while direct dispatch (POST /runs) takes 0.1s. The front door was 170× slower than the product's own fast path, which hid behind ⌘N. This is a structural cost of the manager-on-kernel design and must be acknowledged, not papered over: the manager is valuable for ambiguity, and a tax on clarity.

The fix is the two-speed composer in app-client.ts: ⏎ asks the manager; ⌘⏎ dispatches the composer text as a run immediately via dispatchFromComposer(), configured by the Agent/Type pickers. Hint line: "⏎ ask Kage · ⌘⏎ dispatch a run now · ⇧⏎ newline".

Second finding: the Room composer's three pickers (Agent/Type/Mode) were DECORATIVE — composerPrefs was read only by the ⌘N modal's fallback, never by the Room's send path. A user picked "Codex" and the manager did whatever it liked. ⌘⏎ made Agent and Type real (they are its dispatch parameters); the Mode picker, read by nothing anywhere, was REMOVED rather than left lying. Rule: a decorative control is worse than none — it teaches the user the UI's promises are unreliable, fatal in a product about trust. Before adding any picker/toggle, trace what reads it; before shipping one, prove the round trip.

Full critique with ten named defects and the invention plan lives in docs/CRITIQUE.md; the receipt redesign (printed-receipt object with verdict stamp and the bill: change/dependents/cost/time) and inline inbox answers landed in the same pass.
Evidence: Timed live: room message → manager reply 17s (polled /room busy); POST /runs → dispatched 0.1s. Picker tracing: grep showed composerPrefs read only at the ⌘N modal fallback (lines ~1517-18), never in sendRoomMessage's path. Receipt bill verified rendering from the DOM: change 1 file · 1 line / dependents none / cost $0.37 · 209k tok / time 0.3 min.
Verified by: npm test — 560 pass 0 fail exit 0; live browser DOM inspection of the receipt; commit 132ee39

## Verification

Timed live: room message → manager reply 17s (polled /room busy); POST /runs → dispatched 0.1s. Picker tracing: grep showed composerPrefs read only at the ⌘N modal fallback (lines ~1517-18), never in sendRoomMessage's path. Receipt bill verified rendering from the DOM: change 1 file · 1 line / dependents none / cost $0.37 · 209k tok / time 0.3 min.

# Citations

[1] explicit_capture (2026-08-17T12:52:16.070Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:decision:the-manager-tax-17s-vs-0-1s-and-the-two-speed-composer-lying-controls-removed-17","title":"The manager tax (17s vs 0.1s) and the two-speed composer; lying controls removed","summary":"Measured on this machine: sending a message through the Room the app's front door takes ~17 seconds to produce any response, because every message costs a full manager claude turn — while direct dispatch POST /runs takes","body":"Measured on this machine: sending a message through the Room (the app's front door) takes ~17 seconds to produce any response, because every message costs a full manager claude turn — while direct dispatch (POST /runs) takes 0.1s. The front door was 170× slower than the product's own fast path, which hid behind ⌘N. This is a structural cost of the manager-on-kernel design and must be acknowledged, not papered over: the manager is valuable for ambiguity, and a tax on clarity.\n\nThe fix is the two-speed composer in app-client.ts: ⏎ asks the manager; ⌘⏎ dispatches the composer text as a run immediately via dispatchFromComposer(), configured by the Agent/Type pickers. Hint line: \"⏎ ask Kage · ⌘⏎ dispatch a run now · ⇧⏎ newline\".\n\nSecond finding: the Room composer's three pickers (Agent/Type/Mode) were DECORATIVE — composerPrefs was read only by the ⌘N modal's fallback, never by the Room's send path. A user picked \"Codex\" and the manager did whatever it liked. ⌘⏎ made Agent and Type real (they are its dispatch parameters); the Mode picker, read by nothing anywhere, was REMOVED rather than left lying. Rule: a decorative control is worse than none — it teaches the user the UI's promises are unreliable, fatal in a product about trust. Before adding any picker/toggle, trace what reads it; before shipping one, prove the round trip.\n\nFull critique with ten named defects and the invention plan lives in docs/CRITIQUE.md; the receipt redesign (printed-receipt object with verdict stamp and the bill: change/dependents/cost/time) and inline inbox answers landed in the same pass.\nEvidence: Timed live: room message → manager reply 17s (polled /room busy); POST /runs → dispatched 0.1s. Picker tracing: grep showed composerPrefs read only at the ⌘N modal fallback (lines ~1517-18), never in sendRoomMessage's path. Receipt bill verified rendering from the DOM: change 1 file · 1 line / dependents none / cost $0.37 · 209k tok / time 0.3 min.\nVerified by: npm test — 560 pass 0 fail exit 0; live browser DOM inspection of the receipt; commit 132ee39","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","manager-tax","composer","lying-controls","receipt","critique"],"paths":["docs/CRITIQUE.md","mcp/delegation/app-client.ts","mcp/delegation/app-styles.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-17T12:52:16.070Z"}],"context":{"fact":"Measured on this machine: sending a message through the Room (the app's front door) takes ~17 seconds to produce any response, because every message costs a full manager claude turn — while direct dispatch (POST /runs) takes 0.1s. The front door was 170× slower than the product's own fast path, which hid behind ⌘N. This is a structural cost of the manager-on-kernel design and must be acknowledged, not papered over: the manager is valuable for ambiguity, and a tax on clarity.","verification":"Timed live: room message → manager reply 17s (polled /room busy); POST /runs → dispatched 0.1s. Picker tracing: grep showed composerPrefs read only at the ⌘N modal fallback (lines ~1517-18), never in sendRoomMessage's path. Receipt bill verified rendering from the DOM: change 1 file · 1 line / dependents none / cost $0.37 · 209k tok / time 0.3 min."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-17T20:52:25.137Z","path_fingerprints":[{"path":"docs/CRITIQUE.md","sha256":"9d91ce3424d7c9176e6949bc747dbde45c21af2e2a1c7310be501c8f9ba1600c","size":8810},{"path":"mcp/delegation/app-client.ts","sha256":"fc32a40985a41fd801263e1fd471a4cf59e555de4317bee67a7060d98c384bff","size":114374},{"path":"mcp/delegation/app-styles.ts","sha256":"af5526d8f25aab42941ced3974076ee4a2c12a32b4949e8a960cd0d7f147efd5","size":59005}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":94,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":514,"reverified_at":"2026-08-17T20:52:25.137Z"},"created_at":"2026-08-17T12:52:16.070Z","updated_at":"2026-08-17T20:52:25.137Z","author_branch":"release-prep"}
```

