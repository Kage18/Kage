---
type: "belief"
title: "The Value/Gains Receipts Ledger"
tags: ["value-ledger", "receipts", "discovery-tokens", "gains", "viewer"]
---

# The Value/Gains Receipts Ledger

**Confidence:** settled — this is a distinct system from the check-verification receipts covered elsewhere in this memory set; it measures token/dollar savings from memory recall, not whether a run's checks actually ran. The underlying mechanism appears stable across at least three documented iterations.

Separately from verifying that a run's checks were genuinely executed, Kage keeps a per-repo "value ledger" (`.agent_memory/reports/value.json`) that records events proving its memory recall is actually saving tokens: `recall_served` (with the tokens saved by not re-discovering something), `stale_withheld` (one event per hard-stale packet suppressed rather than served), `caller_answered` (when a caller-intent query is answered straight from the code graph's call-edge index), and `stale_caught`. The ledger is capped at 5000 events with all-time totals that survive trimming, written via temp-file-plus-rename, and exposed through `valueSummary()`'s today/7-day/all-time windows at a stated ~$15-per-1M-token estimate. The mechanism evolved in place rather than being redesigned: the original version counted `tokens_saved` as cited source bytes/4 minus context length/4, floored at zero; a later revision added `replay_tokens` (the sum of served packets' own `discovery_tokens` — the cost that was originally spent producing each packet — minus context cost), with receipts reporting `max(read-vs-source, replay)` so savings figures never regress version to version. Each packet's own `discovery_tokens` is set at capture time from conservative per-type defaults (flagged `discovery_tokens_estimated` when not caller-reported), and this same infrastructure backs a `PreToolUse(Read)` hook (`kage-read-context.sh`) that injects up to 3 verified, non-stale packets relevant to a file the moment it's read, deduplicated once per file per session. The desktop/web viewer surfaces all of this on a "Gains" tab that is the default landing view, recomputing the same today/7-day math client-side from the raw ledger events — and the viewer code carries an explicit invariant that `value.json` must never be regenerated or overwritten by the viewer's own startup pre-generation pass, because doing so would destroy all-time savings history that isn't reconstructible from anything else.

## Supporting evidence

- `.agent_memory/packets/decision-value-ledger-records-recall-stale-withheld-and-caller-answered-receipts-e4e651f1.md` — the original ledger design: event types, the byte/4-based `tokens_saved` formula, and the `valueSummary()` windows (superseded by the packets below).
- `.agent_memory/packets/decision-value-ledger-recall-stale-withheld-caller-answered-replay-receipts-v2-2-0-b5e59596.md` — the v2.2.0 revision adding `replay_tokens` and the `max(read-vs-source, replay)` receipt rule (superseded by the packet below).
- `.agent_memory/packets/decision-value-ledger-events-replay-receipts-verified-v2-2-1-3a89a884.md` — confirms the v2.2.0 design held unchanged through the 2.2.1 sync/rebase/push fixes; the current state of record.
- `.agent_memory/packets/workflow-discovery-tokens-and-file-context-where-the-receipts-math-and-pretooluse-read-in-f1a4d4a3.md` — where `discovery_tokens` is set at capture time, the `DEFAULT_DISCOVERY_TOKENS` per-type defaults, and the `PreToolUse(Read)` injection hook (`kage-read-context.sh`) that reuses the same staleness filtering as recall.
- `.agent_memory/packets/decision-viewer-v2-receipts-theme-value-param-gains-tab-theme-aware-canvas-17b84cfa.md` — the viewer's Gains tab as default landing view, client-side recomputation matching `kage gains`, and the explicit rule that the ledger file must never be overwritten by viewer startup.

## Contradictions / open questions

None found in the cited evidence — the three value-ledger decision packets form a clean, non-contradictory evolution (each explicitly marked as superseding or unchanged from the last), and the discovery-tokens and viewer packets describe complementary parts of the same system rather than conflicting with it.
