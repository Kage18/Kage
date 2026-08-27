---
type: "belief"
title: "OKF is Kage's standard on-disk and interchange memory format"
tags: ["okf", "memory-format", "standard", "interchange", "markdown", "migration"]
snapshot_at: "2026-08-27T16:13:28.413Z"
citation_fingerprints: [{"path":".agent_memory/packets/code_explanation-okf-adoption-mcp-okf-ts-adapter-makes-okf-the-standard-memory-format-f5b1160c.md","sha256":"6ee50ebef734eb4ab543273c6a2d3fd03347c80e4447735833a584397dd5dff9","size":14778}]
---

# OKF is Kage's standard on-disk and interchange memory format

**Confidence:** provisional — the adapter and its round-trip verification (360/360 tests, 200/200 exact round-trip) are solid, but this rests on a single source packet, and whether OKF has since become the primary read/write path (versus an export/import layer) is not confirmed by this cluster's evidence.

Kage adopted Google's Open Knowledge Format (OKF) as its standard for representing memory packets, implemented as a pure, self-contained, zero-new-dependency adapter in `mcp/okf.ts`. A `MemoryPacket` renders as an OKF "concept" markdown file: YAML frontmatter carrying OKF's required/recommended keys (`type`, title, description, resource, tags, timestamp) plus Kage's own trust metadata riding in OKF-legal custom `x-kage-*` keys (id, type, status, scope, visibility, confidence, verified, paths, stack), followed by a readable body (heading, prose, `## context` sections, a `# Citations` list). Round-tripping is lossless because the body also embeds a fenced ```json kage-state``` block containing the exact packet — `packetToOkfConcept` and `okfConceptToPacket` are inverses when that block is present, and concepts without it (foreign or hand-authored OKF) are imported best-effort from frontmatter and body, which is what lets Kage consume any third-party OKF bundle rather than only its own. The `kage okf migrate|lint|import` CLI subcommands are wired into `mcp/cli.ts`, and at the time of adoption a migration of 200 approved packets on the Kage repo itself produced a bundle that linted clean and round-tripped byte-exact (200/200, zero mismatches). This is exactly the packet format this belief-consolidation project is reading: every file under `.agent_memory/packets/` in this repo is an OKF concept document in the shape described here.

## Supporting evidence

- `.agent_memory/packets/code_explanation-okf-adoption-mcp-okf-ts-adapter-makes-okf-the-standard-memory-format-f5b1160c.md` — the full adoption record: adapter location and design (`mcp/okf.ts`), the frontmatter/body/`x-kage-*`/`kage-state` shape, key functions (`packetToOkfConcept`, `okfConceptToPacket`, `migratePacketsToOkf`, `loadOkfConcepts`, `lintOkfConcept`/`lintOkfBundle`), CLI wiring, and verification (360/360 unit tests, 200/200 exact round-trip on this repo's own packets).

## Contradictions / open questions

- This is a single-packet belief; there is no corroborating or conflicting packet in this cluster to cross-check it against, though its own evidence (test counts, a repo-wide migration run) is unusually concrete for a one-source claim.
- The packet explicitly states two things were NOT yet done at the time of capture (June 2026): making the generated `AGENTS.md`/`CLAUDE.md` policy reference OKF, and switching the primary read/write path (`writePacket`/`loadPacketsFromDir`) to `.md` — at adoption time OKF was a verified export/import layer alongside the JSON packet store, not necessarily the sole source of truth. This cluster's evidence does not confirm whether that transition happened later; the current `CLAUDE.md` for this repo (as of this consolidation project) does reference OKF migrate/lint/import directly, suggesting at least the documentation gap was closed, but that inference is drawn from the live repo state, not from a packet in this cluster.
