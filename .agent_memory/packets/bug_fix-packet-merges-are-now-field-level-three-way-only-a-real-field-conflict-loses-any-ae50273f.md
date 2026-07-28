---
type: "Bug Fix"
title: "Packet merges are now field-level three-way; only a real field conflict loses anything"
description: "mergePacketFiles used to discard the base entirely void basePath and pick a whole file winner by self reported updated at, so two teammates editing DIFFERENT fields of one packet silently lost one side. It now merges per"
resource: "mcp/kernel.ts"
tags: ["session-learning"]
timestamp: "2026-07-28T05:08:44.255Z"
x-kage-id: "repo:https-github-com-kage-core-kage:bug_fix:packet-merges-are-now-field-level-three-way-only-a-real-field-conflict-loses-any"
x-kage-type: "bug_fix"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "unverified"
x-kage-paths: ["mcp/kernel.ts"]
---

# Packet merges are now field-level three-way; only a real field conflict loses anything

> mergePacketFiles used to discard the base entirely void basePath and pick a whole file winner by self reported update…

mergePacketFiles used to discard the base entirely (void basePath) and pick a whole-file winner by self-reported updated_at, so two teammates editing DIFFERENT fields of one packet silently lost one side. It now merges per field against the common ancestor: only one side moved wins outright; both moved to the same value is agreement, not conflict; both moved differently is a real conflict where newest wins THAT field and the field name is reported in conflicted_fields. The losing side is preserved only when something was genuinely lost, and .agent_memory/conflicts/ is git-tracked so the other person can see it. updated_at on the merged result is the newer of the two, because the merge itself is an update and recency drives everything downstream.
Evidence: Two tests: different-fields merge keeps both edits; same-field merge reports the conflict and keeps the loser. Suite 1541/0.

## Verification

Two tests: different-fields merge keeps both edits; same-field merge reports the conflict and keeps the loser. Suite 1541/0.

# Citations

[1] explicit_capture (2026-07-28T05:08:44.255Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:bug_fix:packet-merges-are-now-field-level-three-way-only-a-real-field-conflict-loses-any","title":"Packet merges are now field-level three-way; only a real field conflict loses anything","summary":"mergePacketFiles used to discard the base entirely void basePath and pick a whole file winner by self reported updated at, so two teammates editing DIFFERENT fields of one packet silently lost one side. It now merges per","body":"mergePacketFiles used to discard the base entirely (void basePath) and pick a whole-file winner by self-reported updated_at, so two teammates editing DIFFERENT fields of one packet silently lost one side. It now merges per field against the common ancestor: only one side moved wins outright; both moved to the same value is agreement, not conflict; both moved differently is a real conflict where newest wins THAT field and the field name is reported in conflicted_fields. The losing side is preserved only when something was genuinely lost, and .agent_memory/conflicts/ is git-tracked so the other person can see it. updated_at on the merged result is the newer of the two, because the merge itself is an update and recency drives everything downstream.\nEvidence: Two tests: different-fields merge keeps both edits; same-field merge reports the conflict and keeps the loser. Suite 1541/0.","type":"bug_fix","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning"],"paths":["mcp/kernel.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-07-28T05:08:44.255Z"}],"context":{"fact":"mergePacketFiles used to discard the base entirely (void basePath) and pick a whole-file winner by self-reported updated_at, so two teammates editing DIFFERENT fields of one packet silently lost one side. It now merges per field against the common ancestor: only one side moved wins outright; both moved to the same value is agreement, not conflict; both moved differently is a real conflict where newest wins THAT field and the field name is reported in conflicted_fields. The losing side is preserved only when something was genuinely lost, and .agent_memory/conflicts/ is git-tracked so the other person can see it. updated_at on the merged result is the newer of the two, because the merge itself is an update and recency drives everything downstream.\nEvidence: Two tests: different-fields merge keeps both edits; same-field merge reports the conflict and keeps the loser. Suite 1541/0.","verification":"Two tests: different-fields merge keeps both edits; same-field merge reports the conflict and keeps the loser. Suite 1541/0."},"freshness":{"ttl_days":365,"last_verified_at":"2026-07-28T05:08:44.255Z","path_fingerprints":[{"path":"mcp/kernel.ts","sha256":"f96b591cbad2348b8dbbbe757dc374ab9816449db52cd1e46382ba9ca82b49a3","size":1027770,"symbols":[{"name":"mergepacketfiles","kind":"function","sha256":"d9bfc7d67f6feb56ae62f9c04ac475a073a4a43c40e3058f7f2dd058d8bfc802"}]}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[{"relation":"supersedes","to":"repo:https-github-com-kage-core-kage:bug_fix:bug-fix-git-merge-driver-for-agent-memory-packets-silently-discarded-a-teammates","evidence":"The bug it describes is fixed: newest-wins whole-file replacement was replaced by a field-level three-way merge, so a teammate's non-conflicting edit is no longer discarded.","created_at":"2026-07-28T05:08:55.766Z"}],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":223},"created_at":"2026-07-28T05:08:44.255Z","updated_at":"2026-07-28T05:08:55.766Z","author_branch":"reform/p0-truth","author_name":"Kushal Jain"}
```

