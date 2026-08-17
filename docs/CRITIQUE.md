# The hard critique

The honest one, written as the harshest reviewer would. Every item is specific and
falsifiable; measurements are from this machine. The companion invention plan is at
the bottom — critique without invention is just complaint.

## Structural defects (mine, by design)

**1. The front door is 170× slower than the product.**
Measured: a Room message takes **17s** to produce any response (a full manager turn),
while direct dispatch takes **0.1s**. The Room is the default surface; the fast path
hides behind ⌘N. AO and Conductor put you zero seconds from an agent. We put a
17-second middleman in front of ours and called it the front door. The manager is
valuable for ambiguity ("what should we do about the flaky tests?") — it is a tax on
clarity ("add a healthcheck endpoint").

**2. Three lying controls under the primary input.**
The Room composer shows Agent / Type / Mode pickers with lovingly written descriptions.
The Room's send path never reads them. A user picks Codex and gets whatever the manager
feels like. A decorative control is worse than none: it teaches the user that the UI's
promises are unreliable.

**3. Five doors into the same room.**
Inbox, Runs, and Board are the same ~25 runs in three arrangements, each with different
powers (merge from Inbox and Runs but not Board; steer only from Runs). The user must
memorize which view can do what. Conductor has essentially one surface. This is
incoherent information architecture wearing a keyboard-shortcut costume.

**4. No selection model, no keyboard traversal.**
"Keyboard-first" claims aside: you cannot arrow or j/k through the run list, cannot tab
through inbox rows and press Enter, and nothing visibly indicates the current item
beyond a background tint. ⌥L cycles blindly. Every click target is a div with onclick —
no focus rings designed, no accessibility pass, no screen-reader story at all.

**5. The most differentiated moment renders as grey monospace.**
The receipt — the artifact neither competitor has, the entire pitch — is a text dump in
a pane. No verdict stamp, no visual ledger, nothing you would screenshot. We bring the
best evidence to the merge decision and present it like `cat claim.json`.

**6. Updates are jumpy and trust-eroding.**
Merge → button says "Merging…" → the whole list re-renders and rows jump. No optimistic
updates, no reconciliation, no transitions between states. Feedback is `flash()` — a
status-bar text blip that vanishes. Errors likewise: a failed action flashes and is
gone; the stale board keeps looking healthy when the daemon dies.

**7. It is a web page in a frame, not a Mac app.**
No native menus beyond Electron defaults, no context menus anywhere, no drag-and-drop,
no window-state restore, ⌘W kills the window. Conductor is a real Mac citizen; we are a
kiosk.

**8. Memory is a filing cabinet, not a flywheel.**
326 packets, a search box. No link from a memory to the runs that used it; no link from
a merged run to the packets it ratified; no recency view; no by-area grouping. The one
screen that could show the product compounding shows a list.

**9. No undo, thin confirms.**
Merge and reject are irreversible from the UI. Closing a thread deletes its transcript
behind a button whose only warning is a hover title.

**10. First run teaches labels, not the loop.**
A new user sees "Tell Kage what should happen", types something, and waits 17 seconds
watching dots. Nothing demonstrates dispatch → verify → receipt → merge — the loop that
is the entire reason to be here.

## Scores, re-corrected downward

| Experience | Kage (previous claim → honest) |
|---|---|
| Watching a live agent | 3.5 → **3** — readable, but same-size mono lines, no hierarchy |
| Controlling mid-run | 3.5 → **3** — works; bare input, no queue, lying pickers adjacent |
| Review & merge UX | 3.5 → **3** — best data, worst presentation of it |
| Visual polish | 3 → **2.5** — one type size too many places, mono overuse, jumpy updates |
| Usability | 2.5 → **2** — no traversal, no undo, five-door IA |
| Mac-app citizenship | (unrated before) → **1.5** |

## The invention plan — ours, not parity

Parity work copies Conductor half as well. These use what only we have:

**A. ⏎ asks, ⌘⏎ dispatches — kill the manager tax.** *(built)*
The composer becomes two-speed: ⏎ converses with the manager (ambiguity), ⌘⏎
dispatches a run immediately (clarity) using the pickers — which thereby become real
controls. Time-to-agent for clear work: 17s → 0.1s, on the front door itself.

**B. The question answers where it is asked.** *(built)*
An "asks you" inbox row carries the agent's actual question and a reply field. Answer
without navigating. The question is the content; the row is the surface.

**C. The receipt becomes the signature object.** *(built)*
A designed proof-of-work: verdict stamp, checks as a ledger with commands and exit
codes, diff/blast/cost lines, ratified learnings. The thing neither competitor has,
made screenshot-worthy. Trust as UI.

**D. One work surface.** *(built)*
Inbox/Runs/Board collapsed into Work: a triaged list (Asks you → Needs a decision →
Ready → Working → Done) beside the run's detail, with a List⇄Board toggle. Powers
attach to the run — answer, merge, reject, steer all work from both arrangements;
the board opens the same detail as a slide-over. Brought the selection model with it
(defect 4, partially): j/k/arrows traverse, Enter lands on the run's primary action,
rows are focusable with visible focus. Collapsing the doors immediately exposed two
latent bugs the split had been hiding: `stopped` runs were owned by nobody (the inbox
never listed them, Runs filed them under Working, Board under Lost — three stories,
one glance apart), and the daemon was re-indexing the entire repo every ~4 seconds
forever, because the index loop watched its own output. Both fixed the same day.

**E. Pre-flight blast radius.** *(built)*
As you type an intent — in the Room composer or the ⌘N modal — the kernel answers
with what the brief WILL carry: "lands near mcp/daemon.ts +6 · 32 files depend on
that area · 5 memories will ride in the brief", labeled FORECAST. The prediction is
the brief compiler's own touch set, so it can never disagree with the brief; the
dependents question is asked of the memory-cited paths (the graph's term-matched
expansion would otherwise swallow the dependents as "intra-change"). Nothing honest
to say → the line stays hidden. Warmed at daemon start; ~0.26s per keystroke-pause.
Risk before work, which nobody else can do.

**F. The flywheel made visible.** *(proposed)*
Memory ↔ runs cross-links: each packet shows the runs that recalled it and the run
that ratified it; each merged run shows what it taught. The compounding loop as
navigation.
