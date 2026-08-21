---
type: "Convention"
title: "Rating rule: feature presence is a fact, experience quality needs user mileage — never self-score UX high"
description: "When rating Kage against AO and Conductor, the first pass scored Kage 4 4.5 on every experience axis watching, control, notifications, review UX, polish — within half a point of the category leader. Kushal correctly reje"
resource: "docs/ORCHESTRATOR_COMPARISON.md"
tags: ["session-learning", "ratings", "ux", "honesty", "builder-bias", "convention"]
timestamp: "2026-08-17T12:34:51.718Z"
x-kage-id: "repo:https-github-com-kage-core-kage:convention:rating-rule-feature-presence-is-a-fact-experience-quality-needs-user-mileage-nev"
x-kage-type: "convention"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
x-kage-paths: ["docs/ORCHESTRATOR_COMPARISON.md"]
---

# Rating rule: feature presence is a fact, experience quality needs user mileage — never self-score UX high

> When rating Kage against AO and Conductor, the first pass scored Kage 4 4.5 on every experience axis watching, contro…

When rating Kage against AO and Conductor, the first pass scored Kage 4-4.5 on every experience axis (watching, control, notifications, review UX, polish) — within half a point of the category leader. Kushal correctly rejected this: their UI/UX is far ahead. The corrected ranking, now recorded in docs/ORCHESTRATOR_COMPARISON.md §5, is Conductor > AO > Kage on experience, with Kage at 2.5-3.5 per axis.

The error had a mechanism, not just optimism: (1) builder bias — the rater built the thing rated, and every hands-on pass on this branch had ALREADY found bugs the previous pass called verified (badge that never appeared, unreadable feed, board overflow, wrong brand), which is direct evidence the remaining-bug tail is not empty; (2) checklist-vs-craft conflation — "we have a notification ladder → 4.5" treats feature presence as experience quality, but presence is a checkable fact while quality is only supported by user mileage, and Kage has zero real-user hours against Conductor's 189 releases and AO's 9.4k stars of filed paper cuts.

The durable rule: capability rows (verification exists, memory exists, blast radius exists, measured latency) may be self-scored because they are facts. Experience rows may not be self-scored above competitors with real users unless real users say so. Measured numbers (0.3s window, ~1ms routes) are the one experience claim that stands without users.

The concrete polish gap list (what "ahead" means in practice): diff syntax highlighting / side-by-side / file tree; transcript collapse+summaries; queue editing; per-run notification suppression; first-run tour; accessibility pass; the paper cuts only real users find.
Evidence: Session history: four separate hands-on passes each found UI bugs the prior pass had called verified, while the suite stayed green throughout — the direct evidence that self-assessed UX quality was repeatedly optimistic. Kushal's correction ("their interface and user experience and ui polishing and usability is far ahead") matched that evidence.
Verified by: docs/ORCHESTRATOR_COMPARISON.md §5 committed with the corrected scores (8c26cbd)

## Verification

Session history: four separate hands-on passes each found UI bugs the prior pass had called verified, while the suite stayed green throughout — the direct evidence that self-assessed UX quality was repeatedly optimistic. Kushal's correction ("their interface and user experience and ui polishing and usability is far ahead") matched that evidence.

# Citations

[1] explicit_capture (2026-08-17T12:34:51.718Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:convention:rating-rule-feature-presence-is-a-fact-experience-quality-needs-user-mileage-nev","title":"Rating rule: feature presence is a fact, experience quality needs user mileage — never self-score UX high","summary":"When rating Kage against AO and Conductor, the first pass scored Kage 4 4.5 on every experience axis watching, control, notifications, review UX, polish — within half a point of the category leader. Kushal correctly reje","body":"When rating Kage against AO and Conductor, the first pass scored Kage 4-4.5 on every experience axis (watching, control, notifications, review UX, polish) — within half a point of the category leader. Kushal correctly rejected this: their UI/UX is far ahead. The corrected ranking, now recorded in docs/ORCHESTRATOR_COMPARISON.md §5, is Conductor > AO > Kage on experience, with Kage at 2.5-3.5 per axis.\n\nThe error had a mechanism, not just optimism: (1) builder bias — the rater built the thing rated, and every hands-on pass on this branch had ALREADY found bugs the previous pass called verified (badge that never appeared, unreadable feed, board overflow, wrong brand), which is direct evidence the remaining-bug tail is not empty; (2) checklist-vs-craft conflation — \"we have a notification ladder → 4.5\" treats feature presence as experience quality, but presence is a checkable fact while quality is only supported by user mileage, and Kage has zero real-user hours against Conductor's 189 releases and AO's 9.4k stars of filed paper cuts.\n\nThe durable rule: capability rows (verification exists, memory exists, blast radius exists, measured latency) may be self-scored because they are facts. Experience rows may not be self-scored above competitors with real users unless real users say so. Measured numbers (0.3s window, ~1ms routes) are the one experience claim that stands without users.\n\nThe concrete polish gap list (what \"ahead\" means in practice): diff syntax highlighting / side-by-side / file tree; transcript collapse+summaries; queue editing; per-run notification suppression; first-run tour; accessibility pass; the paper cuts only real users find.\nEvidence: Session history: four separate hands-on passes each found UI bugs the prior pass had called verified, while the suite stayed green throughout — the direct evidence that self-assessed UX quality was repeatedly optimistic. Kushal's correction (\"their interface and user experience and ui polishing and usability is far ahead\") matched that evidence.\nVerified by: docs/ORCHESTRATOR_COMPARISON.md §5 committed with the corrected scores (8c26cbd)","type":"convention","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning","ratings","ux","honesty","builder-bias","convention"],"paths":["docs/ORCHESTRATOR_COMPARISON.md"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-17T12:34:51.718Z"}],"context":{"fact":"When rating Kage against AO and Conductor, the first pass scored Kage 4-4.5 on every experience axis (watching, control, notifications, review UX, polish) — within half a point of the category leader. Kushal correctly rejected this: their UI/UX is far ahead. The corrected ranking, now recorded in docs/ORCHESTRATOR_COMPARISON.md §5, is Conductor > AO > Kage on experience, with Kage at 2.5-3.5 per axis.","verification":"Session history: four separate hands-on passes each found UI bugs the prior pass had called verified, while the suite stayed green throughout — the direct evidence that self-assessed UX quality was repeatedly optimistic. Kushal's correction (\"their interface and user experience and ui polishing and usability is far ahead\") matched that evidence."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-17T12:34:51.718Z","path_fingerprints":[{"path":"docs/ORCHESTRATOR_COMPARISON.md","sha256":"409f101602109ed8e7a837729035d427a9315062cf619483b40d69866159cce0","size":10196}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":2000,"discovery_tokens_estimated":true,"score":94,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":531},"created_at":"2026-08-17T12:34:51.718Z","updated_at":"2026-08-20T20:13:09.642Z","author_branch":"release-prep"}
```

