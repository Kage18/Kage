---
type: "Gotcha"
title: "delegation-api.test.ts's room-queue race test can fail under full-suite load but passes solo — reverify before re-dispatching"
description: "The test \"two rapid room messages queue rather than race, and busy reflects the whole queue\" mcp/delegation api.test.ts failed with strictEqual false!=true during a run's full suite verification, but passed twice consecu"
resource: "mcp/delegation-api.test.ts"
tags: ["session-learning", "flaky-test", "verification", "reverify", "room"]
timestamp: "2026-08-21T07:18:24.964Z"
x-kage-id: "repo:https-github-com-kage-core-kage:gotcha:delegation-api-test-tss-room-queue-race-test-can-fail-under-full-suite-load-but-"
x-kage-type: "gotcha"
x-kage-status: "deprecated"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-confidence: 0.7
x-kage-verified: "deprecated"
x-kage-paths: ["mcp/delegation-api.test.ts", "mcp/delegation/verify.ts"]
---

# delegation-api.test.ts's room-queue race test can fail under full-suite load but passes solo — reverify before re-dispatching

> The test "two rapid room messages queue rather than race, and busy reflects the whole queue" mcp/delegation api.test.…

The test "two rapid room messages queue rather than race, and busy reflects the whole queue" (mcp/delegation-api.test.ts) failed with strictEqual false!=true during a run's full-suite verification, but passed twice consecutively when its file was run solo on the same tree — it is timing-sensitive under parallel suite load. When a run fails verification ONLY on this test (or a similar queue/race timing test) and the run's diff cannot plausibly touch room messaging, the cheap honest move is `kage reverify <run-id>` (kernel re-runs checks against the same worktree, no agent) rather than re-dispatching the agent or hand-waving "flaky" without evidence. That exact sequence flipped rebuild-the-website run from failed to ready on 2026-08-21.
Evidence: tests.log of run rebuild-the-website-landing-page-docs-in-260821-f9fe shows the single ✖; two solo runs of dist/delegation-api.test.js passed 59/59; kage reverify then reported "now passing — ready to merge"
Verified by: operator-run solo test executions + kernel reverify on 2026-08-21

## Verification

tests.log of run rebuild-the-website-landing-page-docs-in-260821-f9fe shows the single ✖; two solo runs of dist/delegation-api.test.js passed 59/59; kage reverify then reported "now passing — ready to merge"

# Citations

[1] explicit_capture (2026-08-21T07:18:24.964Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:gotcha:delegation-api-test-tss-room-queue-race-test-can-fail-under-full-suite-load-but-","title":"delegation-api.test.ts's room-queue race test can fail under full-suite load but passes solo — reverify before re-dispatching","summary":"The test \"two rapid room messages queue rather than race, and busy reflects the whole queue\" mcp/delegation api.test.ts failed with strictEqual false!=true during a run's full suite verification, but passed twice consecu","body":"The test \"two rapid room messages queue rather than race, and busy reflects the whole queue\" (mcp/delegation-api.test.ts) failed with strictEqual false!=true during a run's full-suite verification, but passed twice consecutively when its file was run solo on the same tree — it is timing-sensitive under parallel suite load. When a run fails verification ONLY on this test (or a similar queue/race timing test) and the run's diff cannot plausibly touch room messaging, the cheap honest move is `kage reverify <run-id>` (kernel re-runs checks against the same worktree, no agent) rather than re-dispatching the agent or hand-waving \"flaky\" without evidence. That exact sequence flipped rebuild-the-website run from failed to ready on 2026-08-21.\nEvidence: tests.log of run rebuild-the-website-landing-page-docs-in-260821-f9fe shows the single ✖; two solo runs of dist/delegation-api.test.js passed 59/59; kage reverify then reported \"now passing — ready to merge\"\nVerified by: operator-run solo test executions + kernel reverify on 2026-08-21","type":"gotcha","scope":"repo","visibility":"team","sensitivity":"internal","status":"deprecated","confidence":0.7,"tags":["session-learning","flaky-test","verification","reverify","room"],"paths":["mcp/delegation-api.test.ts","mcp/delegation/verify.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-21T07:18:24.964Z"}],"context":{"fact":"The test \"two rapid room messages queue rather than race, and busy reflects the whole queue\" (mcp/delegation-api.test.ts) failed with strictEqual false!=true during a run's full-suite verification, but passed twice consecutively when its file was run solo on the same tree — it is timing-sensitive under parallel suite load. When a run fails verification ONLY on this test (or a similar queue/race timing test) and the run's diff cannot plausibly touch room messaging, the cheap honest move is `kage reverify <run-id>` (kernel re-runs checks against the same worktree, no agent) rather than re-dispatching the agent or hand-waving \"flaky\" without evidence. That exact sequence flipped rebuild-the-website run from failed to ready on 2026-08-21.\nEvidence: tests.log of run rebuild-the-website-landing-page-docs-in-260821-f9fe shows the single ✖; two solo runs of dist/delegation-api.test.js passed 59/59; kage reverify then reported \"now passing — ready to merge\"\nVerified by: operator-run solo test executions + kernel reverify on 2026-08-21","verification":"tests.log of run rebuild-the-website-landing-page-docs-in-260821-f9fe shows the single ✖; two solo runs of dist/delegation-api.test.js passed 59/59; kage reverify then reported \"now passing — ready to merge\""},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-21T07:18:24.964Z","path_fingerprints":[{"path":"mcp/delegation-api.test.ts","sha256":"5664b212d3adef17954a296672ff7ce2be4feb285f82989abbcdae276b854adb","size":75803,"symbols":[{"name":"room","kind":"constant","sha256":"daca1174495725bcfe924b660b84e822be76aea4fbb7dc3ebb244be8b8a9aa47"},{"name":"merge","kind":"constant","sha256":"a6b8affd300d959b6fd5abfea9568261ae109471565da5a3061162444591d477"},{"name":"diff","kind":"constant","sha256":"4755f26124dc87f6c211031d5c8f7b97491ca68a2f89a4a806acbacee62110a6"}]},{"path":"mcp/delegation/verify.ts","sha256":"56267fb6eb6da9e32dfeaeecb861d9c2119c20f76c9750a91326d7f77276baea","size":26954}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":261,"unresolved_symbols":["strictEqual"]},"created_at":"2026-08-21T07:18:24.964Z","updated_at":"2026-08-21T14:51:19.953Z","author_branch":"release-prep"}
```

