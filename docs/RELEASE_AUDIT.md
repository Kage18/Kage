# Release audit

A piece-by-piece pass over the repo, done by walking every directory and every
user-facing surface rather than by reading the README and trusting it. Each finding
is marked **fixed** (done in this pass), **open** (known, decided, not done), or
**verified** (checked and healthy — recorded so the next audit doesn't redo it).

Everything measured here was measured on this repo, not estimated.

---

## 1. The app

The surface a user actually spends time in.

| | Finding | State |
|---|---|---|
| 1.1 | **Memory was invisible.** The app showed Room/Inbox/Runs/Board; 320 packets, the gains ledger and every health signal existed only in the legacy viewer. The product's entire pitch was missing from the product. | **fixed** — `Memory` is a fifth view reading pre-built indexes (0.42s for 320 packets) |
| 1.2 | **Unmeasured metrics rendered as `0%`.** A fresh repo showed "0% avg quality", which reads as *your memory scored nothing* when the truth is *nothing has been measured*. | **fixed** — `measured` flag; unmeasured renders `—` |
| 1.3 | **`~0 tokens saved`** displayed on repos with no recalls. Not modesty, noise. | **fixed** — the estimate line only renders when non-zero |
| 1.4 | **Shortcut digits were indistinguishable from counts.** A fresh repo with zero runs read `Runs 3`. On Kage's own repo it coincidentally *was* 3, which hid it. | **fixed** — rendered as key caps |
| 1.5 | **Dead-end empty states.** Runs said "no runs yet"/"select a run" and taught nothing; Board was four bare `0/0` columns floating above empty space. Inbox's was already good — they were simply inconsistent. | **fixed** — every empty view names what belongs there and offers the key |
| 1.6 | **Memory was read-only.** A reader who spots stale memory had to leave for a terminal to say so, which is how bad memory survives. | **fixed** — helpful / out-of-date / wrong on the packet, forwarded to `recordFeedback` |
| 1.7 | Room, Terminal, threads, projects rail, palette, notifications, settings, themes, diff/raw/receipt panes | **verified** working |
| 1.8 | Full loop: dispatch → worktree → kernel verification → merge → code lands | **verified** — ran it end to end on a fresh repo; two real commits |

## 2. Performance

| | Finding | State |
|---|---|---|
| 2.1 | **`kage viewer` took 227s to serve its first byte.** 26 reports generated synchronously *before* `listen()`. Measured per call: `kageRepoXray` 80s, `kageContributors` 58s, `kageRisk` 39s, `kageModuleHealth` 30s, `kageDecisionIntelligence` 10s. | **fixed** — 0.5s cold |
| 2.2 | Moving generation *after* `listen()` was **not sufficient** — Node is single-threaded, so a request landing inside `kageContributors` still measured 58s. | **fixed** — detached child process; server holds ~0.9ms throughout |
| 2.3 | Reports regenerated even when nothing had changed. | **fixed** — skipped when newer than the newest packet/index |
| 2.4 | The memory view must never call these kernel functions from a request path. | **verified** — reads indexes only; enforced by comment + design |

**Method note.** One measurement of 2.1 read *4.2s* because it landed in a gap between
reports. Forcing full regeneration showed the real 154.8s. Sampling a fast path does
not prove the slow path is gone; the worst case has to be constructed deliberately.

## 3. Discoverability

| | Finding | State |
|---|---|---|
| 3.1 | **`kage app` appeared nowhere in `kage help`.** The desktop app — the surface the product is sold on — was undiscoverable from its own CLI, while `kage viewer` (the legacy dashboard) was advertised in its place. The whole orchestrator (`room`, `dispatch`, `runs`, `review`, `merge`) was equally absent. | **fixed** — help rewritten around what a person does |
| 3.2 | 115 commands are implemented; 32 were documented. Most of the remainder are internal (`supervise-room`, `viewer-reports`) or specialist, and remain under `help --all`. | **verified** — intentional |
| 3.3 | Help could drift from reality again. | **fixed** — a test asserts every advertised command exists and that `app`/`room`/`dispatch`/`recall`/`install` stay discoverable |

## 4. Silent-failure classes in the renderer

`app-html.ts` is one TypeScript template literal holding hand-written JS and CSS, so
the compiler checks none of it. Three shapes fail with **no error at all** — each was
found by looking at a screenshot while the suite was green.

| | Shape | Example caught | Gate |
|---|---|---|---|
| 4.1 | Comparison against vocabulary the kernel never emits | `ownership === "human"` (real union: `working\|needs_you\|done`) — the badge could never appear | scans comparisons, checks against `RUN_STATES` imported from `contract.ts` |
| 4.2 | Undefined CSS custom property | `--warn`, `--bad`, `--shadow` — declaration silently dropped, badge rendered as plain text | every `var(--x)` must be defined |
| 4.3 | Styled class no element carries | `.mem-health` styled as a grid while markup had only the id — six tiles stacked full-width | every class selector must reach an element |

All three are **mutation-tested**: reintroduce the bug and the gate fails with the right
message. Each also asserts it *found* something to check — which caught one gate whose
own slice was broken and was silently checking nothing.

## 5. Repo hygiene

| | Finding | State |
|---|---|---|
| 5.1 | 18 markdown files at root, mostly historical design docs | **fixed** — 8 moved to `docs/design/`, 10 conventional ones kept |
| 5.2 | `benchmark/` (Python pilot) sat beside `benchmarks/` (live, README-linked) with zero references, last touched 2 months ago | **fixed** — removed; git retains history |
| 5.3 | **The entire app was uncommitted** — `mcp/delegation/`, `shell/`, every new test | **fixed** — committed on `release-prep` |
| 5.4 | Three memory packets cited docs that moved | **fixed** — citations repointed, not marked stale |
| 5.5 | 11 packets cited code edited this pass | **fixed** — 10 reverified in place (claims unchanged), 1 superseded (it said "two gates"; there are three) |
| 5.6 | `launch/`, `marketing/` — historical GTM, 37 tracked files, not product | **open** — kept deliberately; deleting history isn't a UX gain |
| 5.7 | `kernel.ts` is 21,103 lines | **investigated and resolved — see §9.** Splitting it is the wrong fix; navigation was the real problem and is now fixed and gated |
| 5.8 | Runtime deps: 7 (`@modelcontextprotocol/sdk`, xterm ×2, `node-pty`, tree-sitter ×2, `typescript`) | **verified** — no bloat |

## 6. Packaging

| | Finding | State |
|---|---|---|
| 6.1 | **Generic Electron icon** on every launch and dock slot | **fixed** — 影 seal rendered at 10 sizes → `.icns`; packaged app's icon verified by SHA match |
| 6.2 | Dev runs (`npx electron .`) also showed the default icon | **fixed** — `app.dock.setIcon` at ready |
| 6.3 | **The bundle carried Electron's own signature**, invalidated by packaging — `Identifier=Electron`, and `codesign --verify` failed outright. macOS shows that as **"Kage is damaged and can't be opened"**, which reads as a corrupt download rather than an unsigned app. | **fixed** — ad-hoc signed in an `afterPack` hook; now `Identifier=dev.kage.desktop` and `codesign --verify --deep --strict` passes |
| 6.4 | `.dmg` builds, mounts, and contains a sane bundle (`dev.kage.desktop`, 98MB) | **verified** |
| 6.5 | Gatekeeper still rejects (no Developer ID) | **open — needs a paid Apple Developer membership**, which cannot be obtained from here. The build auto-detects a Developer ID and notarizes when `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID` are set; nothing needs editing. Steps in [shell/README.md](../shell/README.md). |

## 7. Tests

| | Finding | State |
|---|---|---|
| 7.1 | 551 tests pass, 0 fail, **real exit code 0** | **verified** — checked unmasked; `npm test \| tail` reports the pipe's status, not the suite's |
| 7.2 | `app-daemon.ts` had no direct test | **fixed** — 6 tests via an injectable spawn seam; covers reuse, the live-pid-but-dead-app restart, and the startup-failure message |
| 7.3 | `provenance.ts` had no test references | **fixed** — 6 tests including last-author-wins and cache invalidation |
| 7.4 | No stray background test runners inflating latency | **verified** — `pgrep` clean |

## 8. Known-open list

Carried deliberately, with reasons:

1. **Gatekeeper / notarization** (6.5) — blocked on a paid Apple membership only the
   owner can buy. Everything on this side of that is done: the build detects a
   Developer ID, notarizes when credentials are present, and ad-hoc signs otherwise.
2. **`launch/` and `marketing/`** kept (5.6) — deleting history is not a UX gain.
3. Everything in [KAGE_NOT_COPYING.md](design/KAGE_NOT_COPYING.md) — the seven AO/Conductor
   features deliberately not built, each with its reason.

## 9. Why `kernel.ts` stays one file

"21k lines" reads as an obvious defect, so it was measured rather than assumed:

- **174 functions call nothing else in the file** — but they total **1,679 lines, 8%**.
  Extracting every leaf leaves a 19,400-line file.
- The generic helpers (`ensureDir`, `nowIso`, `readJson`, `writeJson`, `unique`,
  `repoKey`) are **3–9 lines each**. Pulling them into a base module moves ~50 lines.
- Lifting out a topically cohesive region — agent setup, 708 lines, the best candidate
  in the file — required making **seven private internals public** to satisfy its
  imports, and created an import cycle back to the kernel. Every region extraction has
  this shape: it *widens* the public API rather than narrowing it.

So the size is a symptom of **semantic coupling within one domain**, not of poor file
organization, and moving code between files cannot fix it — it trades one large file
for many files plus a wider API surface plus import cycles. A real decomposition means
redesigning the memory core's internal boundaries: a design program with genuine
regression risk against 551 tests and no user-visible benefit.

What *was* broken is navigation: 21,000 lines with **8 section banners and no header**.
That is now fixed — a header explaining the above, an index of eleven sections, and
`§ MARKER` anchors through the body, with a test asserting the index matches the markers
in order so it cannot drift. Searching `§ RECALL` jumps straight to recall.

**The recommendation is to leave it as one file** until a change actually requires
different boundaries, and to reach for the index instead of the scrollbar.

---

## How this audit was done

Directory-by-directory inventory (size, tracked files, last commit); then every
user-facing surface exercised for real — the app run against **a brand-new empty repo**,
which is where most UX findings came from, since a repo with data hides empty states and
coincidentally-correct numbers. Timings measured by calling the functions directly, and
the worst case constructed on purpose rather than sampled.
