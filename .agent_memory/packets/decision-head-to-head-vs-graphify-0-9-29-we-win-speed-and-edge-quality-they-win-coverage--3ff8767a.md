---
type: "Decision"
title: "Head-to-head vs Graphify 0.9.29: we win speed and edge quality, they win coverage and relation richness"
description: "First real measured comparison, both tools cold on an identical 400 file copy of this repo graphify update no cluster, its deterministic AST path, no LLM . Kage: 1.3s build, 14,176 symbols, 14,706 edges at 97.2% resoluti"
resource: "benchmarks/code-graph-headtohead.mjs"
tags: ["session-learning"]
timestamp: "2026-07-28T20:33:10.183Z"
x-kage-id: "repo:https-github-com-kage-core-kage:decision:head-to-head-vs-graphify-0-9-29-we-win-speed-and-edge-quality-they-win-coverage-"
x-kage-type: "decision"
x-kage-status: "approved"
x-kage-scope: "repo"
x-kage-visibility: "team"
x-kage-verified: "unverified"
x-kage-paths: ["benchmarks/code-graph-headtohead.mjs", "benchmarks/README.md"]
---

# Head-to-head vs Graphify 0.9.29: we win speed and edge quality, they win coverage and relation richness

> First real measured comparison, both tools cold on an identical 400 file copy of this repo graphify update no cluster…

First real measured comparison, both tools cold on an identical 400-file copy of this repo (graphify update --no-cluster, its deterministic AST path, no LLM). Kage: 1.3s build, 14,176 symbols, 14,706 edges at 97.2% resolution, 96.5% file coverage, 2 relation kinds. Graphify: 9.0s, 6,079 nodes, 16,012 edges at 93.9% resolution, 100% file coverage, 14 relation kinds. So Kage is 7x faster with 2.3x the symbols and more traversable edges, but Graphify covers every file where we miss 14, and its relation vocabulary (contains, imports_from, method, indirect_call, re_exports...) answers questions our calls+imports cannot. A caveat that cuts against us: Graphify's resolution is 97.7% over a narrow calls/imports/references subset, ABOVE our 97.2% — the all-edges number is the honest headline because it cannot be tuned by choosing a flattering subset. Two measurement bugs, both flattering Kage, were found before reporting: timing Kage warm against Graphify cold, and guessing Graphify's schema as edges/from/to when it is links/source/target, which reported ZERO for a tool that had just logged 6,079 nodes.
Evidence: benchmarks/code-graph-headtohead.mjs run 2026-07-28 against graphifyy 0.9.29 in an isolated venv; results table recorded in benchmarks/README.md
Verified by: both tools executed on the same tree, 2026-07-28

## Verification

benchmarks/code-graph-headtohead.mjs run 2026-07-28 against graphifyy 0.9.29 in an isolated venv; results table recorded in benchmarks/README.md

# Citations

[1] explicit_capture (2026-07-28T20:33:10.183Z)

## Kage state

Machine state for lossless round-trip; OKF consumers can ignore it.

```json kage-state
{"schema_version":2,"id":"repo:https-github-com-kage-core-kage:decision:head-to-head-vs-graphify-0-9-29-we-win-speed-and-edge-quality-they-win-coverage-","title":"Head-to-head vs Graphify 0.9.29: we win speed and edge quality, they win coverage and relation richness","summary":"First real measured comparison, both tools cold on an identical 400 file copy of this repo graphify update no cluster, its deterministic AST path, no LLM . Kage: 1.3s build, 14,176 symbols, 14,706 edges at 97.2% resoluti","body":"First real measured comparison, both tools cold on an identical 400-file copy of this repo (graphify update --no-cluster, its deterministic AST path, no LLM). Kage: 1.3s build, 14,176 symbols, 14,706 edges at 97.2% resolution, 96.5% file coverage, 2 relation kinds. Graphify: 9.0s, 6,079 nodes, 16,012 edges at 93.9% resolution, 100% file coverage, 14 relation kinds. So Kage is 7x faster with 2.3x the symbols and more traversable edges, but Graphify covers every file where we miss 14, and its relation vocabulary (contains, imports_from, method, indirect_call, re_exports...) answers questions our calls+imports cannot. A caveat that cuts against us: Graphify's resolution is 97.7% over a narrow calls/imports/references subset, ABOVE our 97.2% — the all-edges number is the honest headline because it cannot be tuned by choosing a flattering subset. Two measurement bugs, both flattering Kage, were found before reporting: timing Kage warm against Graphify cold, and guessing Graphify's schema as edges/from/to when it is links/source/target, which reported ZERO for a tool that had just logged 6,079 nodes.\nEvidence: benchmarks/code-graph-headtohead.mjs run 2026-07-28 against graphifyy 0.9.29 in an isolated venv; results table recorded in benchmarks/README.md\nVerified by: both tools executed on the same tree, 2026-07-28","type":"decision","scope":"repo","visibility":"team","sensitivity":"internal","status":"approved","confidence":0.7,"tags":["session-learning"],"paths":["benchmarks/code-graph-headtohead.mjs","benchmarks/README.md"],"stack":[],"source_refs":[{"kind":"explicit_capture","captured_at":"2026-07-28T20:33:10.183Z"}],"context":{"fact":"First real measured comparison, both tools cold on an identical 400-file copy of this repo (graphify update --no-cluster, its deterministic AST path, no LLM). Kage: 1.3s build, 14,176 symbols, 14,706 edges at 97.2% resolution, 96.5% file coverage, 2 relation kinds. Graphify: 9.0s, 6,079 nodes, 16,012 edges at 93.9% resolution, 100% file coverage, 14 relation kinds. So Kage is 7x faster with 2.3x the symbols and more traversable edges, but Graphify covers every file where we miss 14, and its relation vocabulary (contains, imports_from, method, indirect_call, re_exports...) answers questions our calls+imports cannot. A caveat that cuts against us: Graphify's resolution is 97.7% over a narrow calls/imports/references subset, ABOVE our 97.2% — the all-edges number is the honest headline because it cannot be tuned by choosing a flattering subset. Two measurement bugs, both flattering Kage, were found before reporting: timing Kage warm against Graphify cold, and guessing Graphify's schema as edges/from/to when it is links/source/target, which reported ZERO for a tool that had just logged 6,079 nodes.\nEvidence: benchmarks/code-graph-headtohead.mjs run 2026-07-28 against graphifyy 0.9.29 in an isolated venv; results table recorded in benchmarks/README.md\nVerified by: both tools executed on the same tree, 2026-07-28","verification":"benchmarks/code-graph-headtohead.mjs run 2026-07-28 against graphifyy 0.9.29 in an isolated venv; results table recorded in benchmarks/README.md"},"freshness":{"ttl_days":365,"last_verified_at":"2026-07-28T20:33:10.183Z","path_fingerprints":[{"path":"benchmarks/code-graph-headtohead.mjs","sha256":"35546253528ce32865ed044f3ad2c5153590a2df57e6a6008cc792b972998152","size":8097},{"path":"benchmarks/README.md","sha256":"42a3d5a30ba23c457c0420a69cf625bd3d5d1a5a14c732bc7a5d52745275f295","size":29773}],"path_fingerprint_policy":"source_hash_staleness","verification":"repo_local_agent_capture"},"edges":[],"quality":{"reviewer":"repo-local-agent","votes_up":0,"votes_down":0,"uses_30d":0,"reports_stale":0,"review_boundary":"git_or_pr","promotion_requires_review":true,"discovery_tokens":4000,"discovery_tokens_estimated":true,"score":100,"reasons":["high-value memory type","has source evidence","grounded to repo paths","tagged","concise but substantive","actionable rationale or verification"],"risks":[],"duplicate_candidates":[],"estimated_tokens_saved":332},"created_at":"2026-07-28T20:33:10.183Z","updated_at":"2026-07-28T20:33:10.183Z","author_branch":"fix/foreign-proxy-build","author_name":"Kushal Jain"}
```

