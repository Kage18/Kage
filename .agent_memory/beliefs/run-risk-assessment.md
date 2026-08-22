---
type: "belief"
title: "Risk Assessment Stays Memory-First"
tags: ["risk", "code-graph", "git-history", "viewer", "ux"]
---

# Risk Assessment Stays Memory-First

**Confidence:** provisional — only two packets touch this domain, both from an early phase of the product (the legacy viewer, pre-delegation architecture), so this belief describes a founding decision more than current, actively-tested behavior.

Kage's risk assessment was deliberately scoped to stay local-first and memory-adjacent rather than becoming a generic static-analysis product: it combines the existing code graph with local git history — dependents, impact surface, churn, ownership, co-change partners, and test gaps — instead of replacing Kage's core with an external static-map tool. The one concrete lesson from building the risk-facing UI is that raw signal is not the same as a comprehensible answer: an early Risks page exposed internal labels like "blast radius," "risk signals," and generated memory-packet paths, and a real user reported not understanding what the risks meant or what to do about them. The fix was a "Before You Edit" reframing — filter generated memory paths out of user-facing rows, show real code paths, state plainly *why* an area is risky, and pair every row with a concrete "do first" safety step — plus a real, unrelated git-status parsing bug caught in the same pass: `gitChangedFiles` was trimming modified paths from `mcp/...` to `cp/...` because an upstream helper had already stripped leading status whitespace before path parsing ran, since fixed by routing through a dedicated `parsePorcelainPath`.

## Supporting evidence

- `.agent_memory/packets/decision-risk-assessment-stays-memory-first-bf561a88.md` — the founding scope decision: combine the code graph with local git history (dependents, impact surface, churn, ownership, co-change partners, test gaps); stay local-first and memory-adjacent rather than becoming a generic static-analysis replacement for Kage's core.
- `.agent_memory/packets/decision-before-you-edit-risk-page-must-explain-why-and-what-to-do-first-41b900df.md` — the UX lesson: raw risk labels and generated-memory-path noise are not comprehensible to a real user; the fix pairs each risk row with a plain-language "why" and a concrete "do first" step, filtering generated packet paths from the user-facing view. Also fixed a git-status path-parsing bug (`gitLines` had already stripped leading whitespace, corrupting `gitChangedFiles`'s path extraction) found while doing the UX work.

## Contradictions / open questions

- Both packets predate the delegation/run/goal architecture this cluster otherwise documents (May–June, versus the August work in the other belief docs here) and both are grounded in `mcp/kernel.ts` and the legacy viewer rather than the current app surface — it is an open question whether this scope decision and UX shape still hold unmodified in the current product, or whether risk assessment has since been rebuilt on top of the delegation-era `mcp/delegation/` surface. No packet in this set confirms either way.
- None found as outright disagreements between the two packets — the UX packet is a direct, consistent follow-on to the scope decision.
