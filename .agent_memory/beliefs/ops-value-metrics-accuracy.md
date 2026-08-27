---
type: "belief"
title: "Honest value and cost accounting in Kage's self-reported metrics"
tags: ["metrics", "cost", "value-ledger", "pricing", "gains", "honesty", "KAGE_USD_PER_MTOK"]
snapshot_at: "2026-08-27T16:13:28.417Z"
citation_fingerprints: [{"path":".agent_memory/packets/bug_fix-savings-estimate-3-1m-sonnet-default-was-15-opus-5x-overstated-kage-usd-per-mtok-85a1d77f.md","sha256":"c950f13d7bb5558406671474d6a149f64aefb39dc895806026c4edffe8e676b1","size":8480},{"path":".agent_memory/packets/bug_fix-metrics-json-the-file-the-memory-tabs-health-strip-reads-was-previously-written--86a4c8eb.md","sha256":"e986c82a095ea609d8cb33c5848a73644c5453404be9082a1f888b297c5c33b7","size":18442}]
---

# Honest value and cost accounting in Kage's self-reported metrics

**Confidence:** provisional — the savings-estimate fix is verified with concrete before/after numbers, but the metrics.json fix reads as an identified gap and work brief rather than a confirmed-landed change in this evidence set.

Kage sells itself partly on the honesty of the numbers it shows users, and two separate bugs found the product overstating or freezing those numbers. The dollar-savings estimate (`VALUE_DOLLARS_PER_MILLION_TOKENS` in `mcp/kernel.ts`) was hardcoded to $15/1M input tokens with a comment mislabeling it "Sonnet-class" — that is actually Claude Opus input pricing, so every "$ saved" receipt (`kage gains`, the CLI gains footer, the site receipt) overstated savings roughly 5x for a typical Sonnet-class user. This was fixed by defaulting the constant to a conservative $3/1M and reading an optional override from `process.env.KAGE_USD_PER_MTOK`, with the CLI now printing which rate it used ("Sonnet-class default" vs "via KAGE_USD_PER_MTOK") so the assumption is never hidden. Separately, the Memory tab's health strip reads `.agent_memory/metrics.json`, but that file was (as of the report) written only inside the rarely-run `gc` and `compact` maintenance commands, never by `kage refresh` — even though refresh's own help text claims to rebuild "indexes, graphs and metrics." Because normal users never run gc/compact, the health strip's numbers could freeze indefinitely while other surfaces (the raw packet store, `kage stale`) kept moving, producing three different "stale" counts that disagreed with each other by an order of magnitude. Both bugs share the same underlying lesson: a number a user reads as a trust signal must be actively kept current and must not default to a flattering assumption.

## Supporting evidence

- `.agent_memory/packets/bug_fix-savings-estimate-3-1m-sonnet-default-was-15-opus-5x-overstated-kage-usd-per-mtok-85a1d77f.md` — verified fix (v2.5.7): default rate corrected $15→$3 per million tokens, `KAGE_USD_PER_MTOK` override added, CLI now discloses which rate was used; site receipt corrected from $6.18 to $1.24 for the same 412K tokens.
- `.agent_memory/packets/bug_fix-metrics-json-the-file-the-memory-tabs-health-strip-reads-was-previously-written--86a4c8eb.md` — root-caused `metrics.json` as written only by `gcProject`/`compactProject`, never `refreshProject`, despite refresh's help text promising otherwise; also flags that the health strip's "stale" count and `kage stale`'s count read as different numbers under the same label.

## Contradictions / open questions

- The savings-estimate packet is a completed, verified fix with concrete before/after numbers and a shipped version (v2.5.7). The metrics.json packet, by contrast, reads as an unresolved bug report and work brief ("WHAT TO BUILD", "note for whoever fixes this") rather than confirmation that `refreshProject` was actually changed to write metrics.json — its "Verified by" line lists generic test commands, not a before/after `generated_at` timestamp or corrected stale count. This cluster's evidence does not confirm the metrics.json fix landed; treat it as an identified gap rather than a resolved one until corroborated elsewhere.
- The metrics.json packet also warns explicitly against attributing the freeze to "quiet refresh" (the intentional non-default-branch behavior that skips rewriting packet metadata) — that diagnosis was investigated and ruled out; metrics.json's absence is unrelated to packet-metadata quiet-refresh behavior and was reportedly wrong in an earlier draft of the same investigation.
