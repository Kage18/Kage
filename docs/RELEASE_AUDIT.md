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
| 5.7 | `kernel.ts` is 21,103 lines | **open** — a real cost, but splitting it is a refactor with its own risk budget, not release work |
| 5.8 | Runtime deps: 7 (`@modelcontextprotocol/sdk`, xterm ×2, `node-pty`, tree-sitter ×2, `typescript`) | **verified** — no bloat |

## 6. Packaging

| | Finding | State |
|---|---|---|
| 6.1 | **Generic Electron icon** on every launch and dock slot | **fixed** — 影 seal rendered at 10 sizes → `.icns`; packaged app's icon verified by SHA match |
| 6.2 | Dev runs (`npx electron .`) also showed the default icon | **fixed** — `app.dock.setIcon` at ready |
| 6.3 | **The `.dmg` is unsigned and un-notarized.** macOS will show "unidentified developer" and the user must right-click → Open. | **open — requires a paid Apple Developer ID certificate**, which cannot be created from here. This is a purchase-and-enrol step for the project owner, not a code change. Once a cert exists: set `mac.identity`, add `notarize`, and supply `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`. |
| 6.4 | `.dmg` builds, mounts, and contains a sane bundle (`dev.kage.desktop`, 98MB) | **verified** |

## 7. Tests

| | Finding | State |
|---|---|---|
| 7.1 | 538 tests pass, 0 fail, **real exit code 0** | **verified** — checked unmasked; `npm test \| tail` reports the pipe's status, not the suite's |
| 7.2 | `app-daemon.ts` has no direct test | **open** — exercised end to end by every `kage app` invocation, but not unit-tested |
| 7.3 | `provenance.ts` has no test references | **open** |
| 7.4 | No stray background test runners inflating latency | **verified** — `pgrep` clean |

## 8. Known-open list

Carried deliberately, with reasons:

1. **Code signing / notarization** (6.3) — blocked on a certificate only the owner can buy.
2. **`kernel.ts` at 21k lines** (5.7) — refactor, not release work.
3. **`app-daemon.ts` and `provenance.ts` untested** (7.2, 7.3).
4. **`launch/` and `marketing/`** kept (5.6).
5. Everything in [KAGE_NOT_COPYING.md](design/KAGE_NOT_COPYING.md) — the seven AO/Conductor
   features deliberately not built, each with its reason.

---

## How this audit was done

Directory-by-directory inventory (size, tracked files, last commit); then every
user-facing surface exercised for real — the app run against **a brand-new empty repo**,
which is where most UX findings came from, since a repo with data hides empty states and
coincidentally-correct numbers. Timings measured by calling the functions directly, and
the worst case constructed on purpose rather than sampled.
