---
type: "belief"
title: "Viewer graph canvas: rendering approach and default density"
tags: ["viewer", "portal", "canvas", "force-graph", "3d", "graph-rendering"]
snapshot_at: "2026-08-27T16:13:28.422Z"
citation_fingerprints: [{"path":".agent_memory/packets/decision-decision-kage-viewer-uses-canvas-force-graph-for-interactive-exploration-16a751bc.md","sha256":"cba0de7335fce63f96b48b7f520c46b3277e744660b40a4289831e89e49d1286","size":4105},{"path":".agent_memory/packets/reference-reference-memory-tool-viewer-uses-canvas-force-graph-e5e7391a.md","sha256":"23119750f262a10aaabe95c7af342d6bdd2b76853ab982dd4c5f5a384d37c83e","size":4394},{"path":".agent_memory/packets/gotcha-viewer-performance-fix-must-preserve-graph-visuals-b422fc2a.md","sha256":"f6362218dac8931874356e0f2317993be2bf5c59ec24fc8e51f7925c6de5d0e0","size":3791},{"path":".agent_memory/packets/code_explanation-viewer-3d-graph-mode-architecture-7402734e.md","sha256":"e3ebbbc3cc6357a525173e1d2ef7b049695d5f100d188516a917a7166c0b3c84","size":4666},{"path":".agent_memory/packets/code_explanation-3d-viewer-orb-keeps-2d-style-interactions-246bf75c.md","sha256":"81013ee7dd19ac24103cf1d125a8fb0237c909bf90e44984fad6c580de147294","size":4688},{"path":".agent_memory/packets/code_explanation-3d-viewer-physics-and-edge-visibility-f9173468.md","sha256":"bd6498eb193c36660cc0ee5ba7c948839d56af041b2184a637a5abbd9aa4e92b","size":5174},{"path":".agent_memory/packets/decision-decision-viewer-search-accepts-natural-language-graph-queries-12214ae2.md","sha256":"65fd8f16c4da04a55619e8870c2a8ca2dedb4f3d0bb7634253382c9b2a35bac8","size":3795},{"path":".agent_memory/packets/decision-decision-viewer-hides-raw-full-graph-scopes-cafadd16.md","sha256":"153dcfeacf3f571753fe07cee048ceb8bb05213066c17544ef6adea2934cf6ac","size":3703},{"path":".agent_memory/packets/decision-decision-viewer-must-default-to-high-signal-graph-24bfa4ff.md","sha256":"8590095dbd82778d31a9dfcee417cb18f1348c035217a47d143306674b17b4c1","size":4977},{"path":".agent_memory/packets/decision-viewer-opens-structural-code-graph-mode-by-default-242b6e41.md","sha256":"b6bf3f3c611281a3bc7f738b9cd597b73b56b9bee0c36561824b22cf04e9ccb2","size":4798}]
---

# Viewer graph canvas: rendering approach and default density

**Confidence:** firm — the core rendering decisions read as settled (canvas over SVG/D3, bounded 3D orb, high-signal-by-default), but none of these packets confirm whether the rendering engine survived the later "viewer is now legacy" pivot recorded in the product-design-evolution belief.

The viewer's primary graph surface is a hand-rolled canvas force-graph, not an SVG/D3/Cytoscape renderer — a choice made after directly inspecting a competing memory tool's single-file canvas implementation and adopting the same interaction vocabulary (drag, pan, wheel zoom, hover tooltips, double-click focus, zoom-aware labels) while keeping Kage's own repo/code/memory semantics and shape/color encoding by node type. An optional 3D "Graph Mode = 3D Space" path was added later, lazy-loading Three.js (with a CDN fallback for hosted pages) without replacing the 2D canvas as the default. The 3D mode was deliberately built to *feel* like an orb, not a tilted 2D layout: deterministic spherical start positions, node repulsion, edge springs weaker than a radial orb-gravity constraint (so the shape stays spherical rather than dissolving into a generic force cloud), and code-code edges rendered with visible cyan opacity and depthTest=false so structure is visible before any node is selected — all while preserving the exact same click/drag/hover/selection interaction model as 2D. A hard-learned performance lesson sits underneath both renderers: when a large graph felt slow, the fix must optimize the existing visual (cached edge/degree lookups, throttled redraws, adjacency caches, bounded simulation) rather than swap in a cheaper-looking static/striped fallback — a first attempt at "faster" that visually degraded the graph was reverted as worse than the original. On top of rendering, the graph defaults to a high-signal, filtered view: dependency paths, node_modules, generated artifacts, and lockfile noise are hidden unless explicitly opted into; raw "Focus selection"/"Everything" graph scopes are not exposed as normal controls (memory-code edges stay available internally for recall/ranking/evidence, but only as capped grouped evidence in the inspector); and the local viewer opens in Code mode with an explicit "structural code graph" label by default because Combined mode made the newer, leaner structural code graph look like the old memory-heavy graph. Search over this graph is natural-language rather than exact-substring: queries are tokenized, stop-worded, lightly stemmed, and matched as synonym/concept groups (e.g. run/running/npm, test/tests/vitest) so a plain-English question can find the right runbook or command memory.

## Supporting evidence

- `.agent_memory/packets/decision-decision-kage-viewer-uses-canvas-force-graph-for-interactive-exploration-16a751bc.md` — the founding decision to use a custom canvas force graph, informed by competitor inspection.
- `.agent_memory/packets/reference-reference-memory-tool-viewer-uses-canvas-force-graph-e5e7391a.md` — the competitor research (external tool's canvas implementation) that directly informed the above decision.
- `.agent_memory/packets/gotcha-viewer-performance-fix-must-preserve-graph-visuals-b422fc2a.md` — a reverted performance fix that degraded the graph's visual identity; establishes the constraint that perf work must not change the rendered shape.
- `.agent_memory/packets/code_explanation-viewer-3d-graph-mode-architecture-7402734e.md` — how 3D mode is bolted on: same filtering/selection state, lazy Three.js load, daemon-served vendor path.
- `.agent_memory/packets/code_explanation-3d-viewer-orb-keeps-2d-style-interactions-246bf75c.md` — the "orb, not tilted 2D" design goal and its interaction parity with 2D.
- `.agent_memory/packets/code_explanation-3d-viewer-physics-and-edge-visibility-f9173468.md` — the physics tuning (repulsion, springs weaker than orb gravity, code-edge visibility before selection).
- `.agent_memory/packets/decision-decision-viewer-search-accepts-natural-language-graph-queries-12214ae2.md` — natural-language tokenizing/stemming/synonym search over the graph.
- `.agent_memory/packets/decision-decision-viewer-hides-raw-full-graph-scopes-cafadd16.md` — hiding raw Focus/Everything scopes as product controls.
- `.agent_memory/packets/decision-decision-viewer-must-default-to-high-signal-graph-24bfa4ff.md` — hiding dependency/node_modules/generated noise by default.
- `.agent_memory/packets/decision-viewer-opens-structural-code-graph-mode-by-default-242b6e41.md` — default view=code so the structural code graph artifact is what users see first.

## Contradictions / open questions

None found in the cited evidence — these decisions build on each other chronologically (canvas choice → 3D extension → perf constraint → default-scope decisions) without reversing one another. What remains open: whether this rendering stack was still in place by the time the viewer itself was declared legacy (see `portal-product-design-evolution`); none of these 10 packets say.

## Causality

```mermaid
graph TD
  A["Decision: canvas force graph, not SVG/D3"] --> B["Constraint: any perf fix must preserve the rendered visual"]
  B --> C["Gotcha: first perf attempt used a static/striped fallback and was reverted"]
  A --> D["3D orb mode added as optional path, reusing 2D interaction model"]
  E["Decision: default to high-signal, hide raw scopes"] --> F["Decision: open in structural code mode by default"]
```
