---
type: "belief"
title: "The viewer's proof surfaces must not overstate what they measure"
tags: ["viewer", "portal", "benchmark", "proof-ledger", "trust", "reviewers"]
---

# The viewer's proof surfaces must not overstate what they measure

**Confidence:** firm — a consistent, repeated design principle ("show real measurement, label it precisely, never let it look like more than it is") applied across several distinct viewer features, each with an explicit "why" tied to not overclaiming.

The viewer treats itself as Kage's flagship trust surface — the README was deliberately cut down from a long text-heavy launch document to a concise, viewer-first product README (install, viewer, agent setup, core commands, memory model, proof metrics, trust model, in that order) — and a recurring theme across its benchmark and reporting features is that measurement claims must be precisely scoped, never rounded up to sound more impressive. The local viewer's benchmark report combines two different kinds of evidence — project trust gates and a packaged coding-memory retrieval proof — into one `.agent_memory/reports/benchmark.json`, and is deliberately labeled "Retrieval proof" rather than "External retrieval" so a synthetic, in-repo coding-memory benchmark isn't misrepresented as an independent third-party benchmark. That report was then upgraded to a full proof ledger: every gate shows its measured metric, target threshold, pass/fail state, the exact command that reproduces it, and a concrete next action — built specifically so proof is reproducible and visible in the viewer UI, not left as bare numbers in JSON or scattered README prose. The Proof page's source-diversity card follows the same instinct at a more granular level, surfacing unique sources, the max results from any one observed session, and independent-session rank as a first-class metric card rather than folding it into a generic ledger row or raw JSON dump. When the viewer started showing LongMemEval-style external retrieval metrics (R@5, R@10, MRR, NDCG@10) detected from `summary.recall_at_10_percent`, a companion fix made sure those benchmark cards also disclose whether the underlying report used Kage's default recall or dense local embeddings (and which embedding model), specifically to stop an optional embedding-based benchmark from being mistaken for the generic default-recall result. The same non-overclaiming instinct shows up outside benchmarking too: reviewer suggestions on the Owners page are computed only from local git history and Kage's own graph signals (file authorship, recent edits, co-change partner ownership) — deliberately not calling GitHub or storing any external account state, keeping the whole feature repo-local rather than implying a live integration that doesn't exist. And setup/hook readiness got the same "first-class, not buried" treatment as the benchmark reports: `kage viewer` now writes a `setup.json` report that the dashboard renders as an "Agent setup" card (configured-agent count, Claude Code hook readiness, missing hook/script count, and the exact command to close the gap), closing what had been a Kage-native setup proof gap that previously only existed in CLI/MCP output, not the UI a less technical user would actually see.

## Supporting evidence

- `.agent_memory/packets/decision-readme-is-concise-and-viewer-first-5808c255.md` — README restructured to lead with the viewer and keep proof/trust content visible near the top.
- `.agent_memory/packets/decision-decision-the-local-viewer-benchmark-report-now-combines-project-trust-gates-with-77d5a504.md` — combining trust gates + retrieval proof into one report, labeled "Retrieval proof" to avoid overclaiming.
- `.agent_memory/packets/decision-kage-viewer-benchmark-reports-now-include-a-proof-ledger-with-the-measured-metri-84cc8a4f.md` — the proof-ledger format: measured metric, target, pass state, exact command, next action.
- `.agent_memory/packets/decision-viewer-proof-page-explains-source-diversity-34b4a299.md` — source-diversity as a first-class metric card rather than a generic ledger row.
- `.agent_memory/packets/decision-viewer-surfaces-external-retrieval-benchmark-summaries-47662070.md` — LongMemEval-style R@5/R@10/MRR/NDCG@10 cards detected from benchmark reports.
- `.agent_memory/packets/reference-viewer-labels-external-retrieval-benchmark-modes-31acf098.md` — disclosing default-recall vs. dense-embedding mode (and model) on those same cards.
- `.agent_memory/packets/decision-reviewer-suggestions-stay-local-git-intelligence-ffb3de0c.md` — reviewer suggestions computed from local git/graph signals only, no external GitHub calls or stored account state.
- `.agent_memory/packets/decision-viewer-dashboard-shows-setup-hook-readiness-3d18849c.md` — setup-doctor output promoted to a first-class dashboard card instead of CLI-only output.

## Contradictions / open questions

None found in the cited evidence — each packet adds a new surface to the same "measure precisely, label precisely, don't imply more than what's real" principle rather than conflicting with another.
