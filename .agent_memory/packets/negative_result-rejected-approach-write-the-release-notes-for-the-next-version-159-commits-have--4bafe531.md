---
type: "Negative Result"
title: "Rejected approach: Write the release notes for the next version. 159 commits have landed o"
description: "A delegated attempt at \"Write the release notes for the next version. 159 commits have landed on release prep since 2026 08 17 and nothing is written down. THE SHAPE: CHANGELOG.md already has a convention — read it first"
tags: ["delegated-run", "rejected", "kage-run:write-the-release-notes-for-the-next-ver-260819-9b1f"]
timestamp: "2026-08-19T05:38:34.043Z"
x-kage-id: "repo:https-github-com-kage-core-kage:negative_result:rejected-approach-write-the-release-notes-for-the-next-version-159-commits-have-"
x-kage-type: "negative_result"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "verified"
---

# Rejected approach: Write the release notes for the next version. 159 commits have landed o

> A delegated attempt at "Write the release notes for the next version. 159 commits have landed on release prep since 2…

A delegated attempt at "Write the release notes for the next version. 159 commits have landed on release-prep since 2026-08-17 and nothing is written down.

THE SHAPE: CHANGELOG.md already has a convention — read it first. Entries are "## vX.Y.Z — short human title" followed by bold-led bullets that say what a USER can now do, not what a file now contains. Match it exactly. The last entry is v3.1.0; this is the next version. mcp/package.json is at 3.1.0 and mcp/release.test.ts enforces version lockstep across server.json and both plugin manifests — DO NOT bump any version in this run, only write the notes; the owner decides the number. Head the entry "## Unreleased" so nothing goes out of lockstep.

HOW TO GATHER IT HONESTLY: read `git log --oneline release-prep --since="2026-08-17"`. Nearly every commit is a merged delegated run whose subject is the intent it was given, so the log is unusually descriptive — but it is written from the BUILDER's side ("fix the citations check"), and release notes must be written from the USER's side ("a run no longer fails because it mentioned a filename in passing"). Translate every entry. Where several commits are one user-visible change, merge them into one bullet.

THE HEADLINE, which the notes should lead with: this release turns Kage from a memory tool with a dispatch command into an orchestrator that manages your memory and your agents. That is the owner's positioning and the copy has already been changed across the CLI, README, npm and the plugin manifests to match.

MAJOR THINGS THAT LANDED — verify each against the log rather than trusting this list, and add what I have missed:
- Goals: a goal now actually executes. State advances planning -> executing -> done from real run outcomes, autonomy governs whether verified runs auto-merge, file scopes are checked for disjointness before a wave dispatches, budgets are enforced at attach, and waves fill in order.
- The manager can run a plan: kage_goal_create / kage_goal_status / kage_goal_finish, and wave-completion events that name what is next.
- Verification got real teeth: pre-claim type-check and composed-page parse, a reachability check, and `kage reverify` to re-check a run whose work is good but whose verdict is not.
- Honesty fixes: auto-merge and the track record no longer treat "every check passed" as "verified" when nothing was executed.
- `kage stale`: triage withheld memory — what moved under each packet, what is worth rescuing, one command to act.
- Runs survive the shell that launched them; `kage_refresh` no longer returns ~150KB per call.
- Packaging: the desktop app shipped as 0.1.0 for a 3.1.0 product; node-pty could abort an entire `npm i -g` and is now optional.

RULES FOR THE COPY:
- Every bullet must be true of the shipped code. If you cannot confirm something from the log or the source, leave it out and say in your claim what you dropped.
- No "revolutionary", "seamless", "powerful", "AI-powered". No competitor names.
- Breaking changes and behaviour changes a user could be surprised by get their own clearly-labelled section — for example, runs now dispatch detached rather than inline, and a goal set to auto-merge will refuse to merge a run where nothing executed.
- Do not invent a "Known issues" section listing everything imperfect; do name anything a user would hit in normal use.

TESTS — new file mcp/changelog.test.ts (repo rule: new behaviour gets its own file). Assert: CHANGELOG.md has an "## Unreleased" section; it is non-empty; it does not contain the banned marketing words; and no version field anywhere changed (guard against a future run bumping versions while editing notes). Name in your claim which test fails if the change is reverted.

CONSTRAINTS: CommonJS — no import.meta (TS1470), no top-level await. Change CHANGELOG.md and your new test file only. Do NOT touch mcp/delegation/reachability.ts, mcp/delegation/dispatch.ts or mcp/delegation/supervisor.ts — other runs are editing those.
VERIFY: npm run test --prefix mcp (731 green before your change — use the "npm run test" form) and npm run build --prefix mcp with no "error TS". Run them for real and fill in the claim fence." was rejected.

Reason: Halted on budget at $2.32 against a $2.00 cap — the enforcement working correctly on a task that genuinely costs more than the default. Not an agent failure. The budget is currently unconfigurable, so the operator is writing the notes directly and the config gap is being fixed in a separate run.

Claimed: (no claim)
Branch kept for inspection: kage/write-the-release-notes-for-the-next-ver-260819-9b1f

# Citations

[1] explicit_capture (2026-08-19T05:38:34.043Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:negative_result:rejected-approach-write-the-release-notes-for-the-next-version-159-commits-have-","title":"Rejected approach: Write the release notes for the next version. 159 commits have landed o","summary":"A delegated attempt at \"Write the release notes for the next version. 159 commits have landed on release prep since 2026 08 17 and nothing is written down. THE SHAPE: CHANGELOG.md already has a convention — read it first","body":"A delegated attempt at \"Write the release notes for the next version. 159 commits have landed on release-prep since 2026-08-17 and nothing is written down.\n\nTHE SHAPE: CHANGELOG.md already has a convention — read it first. Entries are \"## vX.Y.Z — short human title\" followed by bold-led bullets that say what a USER can now do, not what a file now contains. Match it exactly. The last entry is v3.1.0; this is the next version. mcp/package.json is at 3.1.0 and mcp/release.test.ts enforces version lockstep across server.json and both plugin manifests — DO NOT bump any version in this run, only write the notes; the owner decides the number. Head the entry \"## Unreleased\" so nothing goes out of lockstep.\n\nHOW TO GATHER IT HONESTLY: read `git log --oneline release-prep --since=\"2026-08-17\"`. Nearly every commit is a merged delegated run whose subject is the intent it was given, so the log is unusually descriptive — but it is written from the BUILDER's side (\"fix the citations check\"), and release notes must be written from the USER's side (\"a run no longer fails because it mentioned a filename in passing\"). Translate every entry. Where several commits are one user-visible change, merge them into one bullet.\n\nTHE HEADLINE, which the notes should lead with: this release turns Kage from a memory tool with a dispatch command into an orchestrator that manages your memory and your agents. That is the owner's positioning and the copy has already been changed across the CLI, README, npm and the plugin manifests to match.\n\nMAJOR THINGS THAT LANDED — verify each against the log rather than trusting this list, and add what I have missed:\n- Goals: a goal now actually executes. State advances planning -> executing -> done from real run outcomes, autonomy governs whether verified runs auto-merge, file scopes are checked for disjointness before a wave dispatches, budgets are enforced at attach, and waves fill in order.\n- The manager can run a plan: kage_goal_create / kage_goal_status / kage_goal_finish, and wave-completion events that name what is next.\n- Verification got real teeth: pre-claim type-check and composed-page parse, a reachability check, and `kage reverify` to re-check a run whose work is good but whose verdict is not.\n- Honesty fixes: auto-merge and the track record no longer treat \"every check passed\" as \"verified\" when nothing was executed.\n- `kage stale`: triage withheld memory — what moved under each packet, what is worth rescuing, one command to act.\n- Runs survive the shell that launched them; `kage_refresh` no longer returns ~150KB per call.\n- Packaging: the desktop app shipped as 0.1.0 for a 3.1.0 product; node-pty could abort an entire `npm i -g` and is now optional.\n\nRULES FOR THE COPY:\n- Every bullet must be true of the shipped code. If you cannot confirm something from the log or the source, leave it out and say in your claim what you dropped.\n- No \"revolutionary\", \"seamless\", \"powerful\", \"AI-powered\". No competitor names.\n- Breaking changes and behaviour changes a user could be surprised by get their own clearly-labelled section — for example, runs now dispatch detached rather than inline, and a goal set to auto-merge will refuse to merge a run where nothing executed.\n- Do not invent a \"Known issues\" section listing everything imperfect; do name anything a user would hit in normal use.\n\nTESTS — new file mcp/changelog.test.ts (repo rule: new behaviour gets its own file). Assert: CHANGELOG.md has an \"## Unreleased\" section; it is non-empty; it does not contain the banned marketing words; and no version field anywhere changed (guard against a future run bumping versions while editing notes). Name in your claim which test fails if the change is reverted.\n\nCONSTRAINTS: CommonJS — no import.meta (TS1470), no top-level await. Change CHANGELOG.md and your new test file only. Do NOT touch mcp/delegation/reachability.ts, mcp/delegation/dispatch.ts or mcp/delegation/supervisor.ts — other runs are editing those.\nVERIFY: npm run test --prefix mcp (731 green before your change — use the \"npm run test\" form) and npm run build --prefix mcp with no \"error TS\". Run them for real and fill in the claim fence.\" was rejected.\n\nReason: Halted on budget at $2.32 against a $2.00 cap — the enforcement working correctly on a task that genuinely costs more than the default. Not an agent failure. The budget is currently unconfigurable, so the operator is writing the notes directly and the config gap is being fixed in a separate run.\n\nClaimed: (no claim)\nBranch kept for inspection: kage/write-the-release-notes-for-the-next-ver-260819-9b1f","type":"negative_result","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["delegated-run","rejected","kage-run:write-the-release-notes-for-the-next-ver-260819-9b1f"],"paths":[],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-19T05:38:34.043Z"}],"context":{"fact":"A delegated attempt at \"Write the release notes for the next version. 159 commits have landed on release-prep since 2026-08-17 and nothing is written down."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-19T05:38:34.043Z","path_fingerprints":[],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":2000,"discovery_tokens_estimated":true,"score":74,"reasons":["high-value memory type","has source evidence","tagged","actionable rationale or verification"],"risks":["not grounded to paths"],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":1150},"created_at":"2026-08-19T05:38:34.043Z","updated_at":"2026-08-19T05:38:34.043Z","author_branch":"release-prep"}
```

