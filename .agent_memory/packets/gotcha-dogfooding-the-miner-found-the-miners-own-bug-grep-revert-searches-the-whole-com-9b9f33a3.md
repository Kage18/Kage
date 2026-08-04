---
type: "Gotcha"
title: "Dogfooding the miner found the miner's own bug: --grep=Revert searches the whole commit message"
description: "mcp/vnext/librarian/miner.ts built its REVERTS section with 'git log grep=Revert', which searches the ENTIRE commit message, not the subject. The commit that introduced the Librarian core has a body reading 'Reverts are "
resource: "mcp/vnext/librarian/miner.ts"
tags: ["librarian", "dogfood", "heuristics"]
timestamp: "2026-08-04T06:34:48.665Z"
x-kage-id: "repo:https-github-com-kage-core-kage:gotcha:dogfooding-the-miner-found-the-miners-own-bug-grep-revert-searches-the-whole-com"
x-kage-type: "gotcha"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "unverified"
x-kage-paths: ["mcp/vnext/librarian/miner.ts"]
---

# Dogfooding the miner found the miner's own bug: --grep=Revert searches the whole commit message

> mcp/vnext/librarian/miner.ts built its REVERTS section with 'git log grep=Revert', which searches the ENTIRE commit m…

mcp/vnext/librarian/miner.ts built its REVERTS section with 'git log --grep=Revert', which searches the ENTIRE commit message, not the subject. The commit that introduced the Librarian core has a body reading 'Reverts are gold — something was tried and undone', so git reported it as a revert; the Librarian then dutifully proposed a card warning that the Librarian had been rolled back and to check why before reimplementing it. A revert is a commit whose SUBJECT is 'Revert "..."' — the shape git revert writes. Fixed by filtering the already-fetched subject lines in JS (cheaper too: no second git call). The general lesson is about the class of bug, not the regex: a heuristic over free text will match text that DISCUSSES the thing as readily as text that IS the thing, and only running the tool against real data surfaces it — the unit tests all passed because their fixtures used real revert subjects.

# Citations

[1] explicit_capture (2026-08-04T06:34:48.665Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:gotcha:dogfooding-the-miner-found-the-miners-own-bug-grep-revert-searches-the-whole-com","title":"Dogfooding the miner found the miner's own bug: --grep=Revert searches the whole commit message","summary":"mcp/vnext/librarian/miner.ts built its REVERTS section with 'git log grep=Revert', which searches the ENTIRE commit message, not the subject. The commit that introduced the Librarian core has a body reading 'Reverts are ","body":"mcp/vnext/librarian/miner.ts built its REVERTS section with 'git log --grep=Revert', which searches the ENTIRE commit message, not the subject. The commit that introduced the Librarian core has a body reading 'Reverts are gold — something was tried and undone', so git reported it as a revert; the Librarian then dutifully proposed a card warning that the Librarian had been rolled back and to check why before reimplementing it. A revert is a commit whose SUBJECT is 'Revert \"...\"' — the shape git revert writes. Fixed by filtering the already-fetched subject lines in JS (cheaper too: no second git call). The general lesson is about the class of bug, not the regex: a heuristic over free text will match text that DISCUSSES the thing as readily as text that IS the thing, and only running the tool against real data surfaces it — the unit tests all passed because their fixtures used real revert subjects.","type":"gotcha","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["librarian","dogfood","heuristics"],"paths":["mcp/vnext/librarian/miner.ts"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-08-04T06:34:48.665Z"}],"context":{"fact":"mcp/vnext/librarian/miner.ts built its REVERTS section with 'git log --grep=Revert', which searches the ENTIRE commit message, not the subject. The commit that introduced the Librarian core has a body reading 'Reverts are gold — something was tried and undone', so git reported it as a revert; the Librarian then dutifully proposed a card warning that the Librarian had been rolled back and to check why before reimplementing it. A revert is a commit whose SUBJECT is 'Revert \"...\"' — the shape git revert writes. Fixed by filtering the already-fetched subject lines in JS (cheaper too: no second git call). The general lesson is about the class of bug, not the regex: a heuristic over free text will match text that DISCUSSES the thing as readily as text that IS the thing, and only running the tool against real data surfaces it — the unit tests all passed because their fixtures used real revert subjects."},"freshness":{"ttl_days":365,"last_verified_at":"2026-08-04T06:34:48.665Z","path_fingerprints":[{"path":"mcp/vnext/librarian/miner.ts","sha256":"24f488dbc0cee305c2b0f6ee0d2fb975a0f6b1710578873914b69642a5a0cbc0","size":9663}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":8000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"stale_reasons":[],"estimated_tokens_saved":227},"created_at":"2026-08-04T06:34:48.665Z","updated_at":"2026-08-04T06:34:48.665Z","author_branch":"fix/foreign-proxy-build","author_name":"Kushal Jain"}
```

