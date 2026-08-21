// The delegation web app, emitted as a single self-contained HTML string.
//
// Why a TS module and not a static file: v4.0.1 shipped a viewer whose assets passed
// every source-checkout test and 404'd from the npm package because they weren't in
// `files`. A string compiled into dist/ cannot be dropped by packaging.
//
// GOTCHA (shipped once): this file is one TS template literal, so any CLIENT-side
// string escape must be doubled — \\n in this source is \n in the browser. A bare \n
// becomes a real newline inside a client string literal and kills the entire script
// at parse time. The "emitted client script is syntactically valid" test guards this.
//
// Design contract (v8 — one work surface):
//   - IDE shape: title bar · content · status bar. Three views: Room (1, default),
//     Work (2), Memory (3). "n" still opens the fast-path dispatch modal —
//     AO's board offers both "Orchestrator" and "+ New task" side by side, and that
//     split earns its keep: talking is how trust gets built, a modal is for when you
//     already know exactly what you want.
//   - The room is a conversation, not a queue. You land in it on open. It talks to
//     the SAME manager `kage room` launches interactively (askManager, one MCP
//     surface, one constitution) — dispatch, judgment and reporting all happen by
//     talking, not by filling a form.
//   - Work is ONE surface, not three doors. Inbox/Runs/Board used to show the same
//     ~25 runs in three arrangements with different powers each (merge here, steer
//     there, look-only over there) — incoherent IA the user had to memorize. Now:
//     a triaged list (Asks you → Needs a decision → Ready → Working → Done) beside
//     the run's detail, with a List⇄Board layout toggle. Powers (answer, merge,
//     reject, steer) attach to the RUN and are reachable from every arrangement;
//     the board opens the same detail as a slide-over. Selection is a real model:
//     j/k/arrows traverse, Enter focuses the row's primary action, focus is visible.
//   - Quiet grammar everywhere else: a row is a name plus atoms; state is
//     color+glyph, never a sentence; one loud element per screen; dim the prefix,
//     brighten the payload.
//   - Events are notifications: run SSE only triggers a re-read of /runs. Room SSE
//     deltas DO carry live text (so replies can stream), but the persisted /room
//     history is still the only truth — a missed delta just skips a typing frame,
//     never corrupts state.
//   - The client renders kernel facts verbatim (display_state, ownership, delivery).
//
// The daemon injects the mutation token by replacing __KAGE_TOKEN__ at serve time.
// Safe under the guard: the page is only served to a loopback Host with a
// same-origin (or absent) Origin — exactly the boundary the token defends.

import { APP_CLIENT } from "./app-client.js";
import { APP_STYLES } from "./app-styles.js";

export const APP_ROUTE = "/app";

export function delegationAppHtml(token: string): string {
  return APP_HTML.replace("__KAGE_TOKEN__", token);
}

const APP_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kage</title>
<link rel="stylesheet" href="/vendor/xterm.css">
<style>
${APP_STYLES}
</style>
</head>
<body>
<div class="top">
  <svg class="seal" viewBox="0 0 96 96" aria-hidden="true"><defs><radialGradient id="kiris" cx="50%" cy="50%" r="58%"><stop offset="0" stop-color="#eafff4"/><stop offset=".32" stop-color="#39ff9a"/><stop offset=".72" stop-color="#0bbf67"/><stop offset="1" stop-color="#06351f"/></radialGradient></defs><path d="M9 49c9-15 22-23 39-23s30 8 39 23c-9 14-22 21-39 21S18 63 9 49Z" fill="#06130d" stroke="#39ff9a" stroke-width="3"/><circle cx="48" cy="48" r="16" fill="url(#kiris)"/><circle cx="48" cy="48" r="6" fill="#020405"/><path d="M24 47c7-7 15-10 24-10s17 3 24 10" stroke="#eafff4" stroke-width="2" stroke-linecap="round" opacity=".72"/></svg>
  <span class="appname">Kage</span>
  <span class="proj" id="proj"></span>
  <div class="seg">
    <button class="on" data-view="room" id="m-room">Room<span class="k">1</span></button>
    <button data-view="work" id="m-work">Work<span class="k">2</span></button>
    <button data-view="memory" id="m-memory">Memory<span class="k">3</span></button>
  </div>
  <button class="iconbtn" id="m-new" title="New run"><span class="mnew-ic" aria-hidden="true">＋</span><span class="mnew-lbl">New run</span></button>
  <button class="iconbtn narrow-only" id="m-palette" title="Switch project, or run a command">⌘</button>
  <button class="iconbtn" id="m-theme" title="light / dark / follow the system">◐</button>
  <button class="iconbtn" id="m-settings" title="project settings">⚙</button>
  <span class="bellwrap"><button class="iconbtn" id="m-bell" title="notify when a run needs you">🔔</button><span class="badge" id="bell-badge" style="display:none">0</span></span>
</div>
<div class="notif" id="notif"><div class="nh">Notifications</div><div class="nlist" id="notif-list"></div><div class="nhint">Notifications resolve themselves when the state changes — nothing to dismiss.</div></div>
<div class="errbar" id="errbar"><span class="et" id="errbar-text"></span><button class="ex" id="errbar-x">✕</button></div>
<div class="offline-ribbon" id="offline-ribbon">connection lost — showing the last known state · reconnecting…</div>
<div class="split">
<aside class="side">
  <div class="sidehead">Projects<button id="p-add" title="open another repo">+</button></div>
  <div class="plist" id="plist"></div>
  <div class="sidefoot" id="sidefoot"></div>
</aside>
<main>
  <div class="view on" id="v-room">
    <div class="room-toggle">
      <button class="on" id="rm-chat">Chat</button>
      <button id="rm-terminal">Terminal</button>
      <div class="threads" id="threads"></div>
      <button class="tadd" id="t-add" title="a separate conversation with the manager">+</button>
    </div>
    <div id="room-chat-pane">
      <div class="room-banner" id="room-banner" style="display:none"></div>
      <div class="room-scroll"><div class="room-col" id="room-col">
        <div class="primer" id="room-primer">
          <div id="primer-default">
            <div class="pseal"><svg class="pseal-eye" viewBox="0 0 96 96" aria-hidden="true"><defs><radialGradient id="kiris2" cx="50%" cy="50%" r="58%"><stop offset="0" stop-color="#eafff4"/><stop offset=".32" stop-color="#39ff9a"/><stop offset=".72" stop-color="#0bbf67"/><stop offset="1" stop-color="#06351f"/></radialGradient></defs><path d="M9 49c9-15 22-23 39-23s30 8 39 23c-9 14-22 21-39 21S18 63 9 49Z" fill="#06130d" stroke="#39ff9a" stroke-width="3"/><circle cx="48" cy="48" r="16" fill="url(#kiris2)"/><circle cx="48" cy="48" r="6" fill="#020405"/><path d="M24 47c7-7 15-10 24-10s17 3 24 10" stroke="#eafff4" stroke-width="2" stroke-linecap="round" opacity=".72"/></svg></div>
            <p>Tell Kage what should happen. It reads the room, compiles a brief from what this repo has learned, hires an agent in a worktree, and reports back once the kernel — not the agent — has checked the work.</p>
            <div class="loopstrip">
              <span class="ls-step">you ask</span><span class="ls-arrow">→</span>
              <span class="ls-step">brief from repo memory</span><span class="ls-arrow">→</span>
              <span class="ls-step">agent works in a worktree</span><span class="ls-arrow">→</span>
              <span class="ls-step">Kage re-runs the checks</span><span class="ls-arrow">→</span>
              <span class="ls-step">merge lands code + learnings</span>
            </div>
            <div class="loophint">⌘⏎ skips the conversation and dispatches a run immediately</div>
          </div>
          <div id="primer-firstopen">
            <div class="fo-card">
              <h1>No orchestrator is running for this project.</h1>
              <p>The orchestrator is a real agent session with Kage's tools — it plans, hires workers into isolated worktrees, and reports with receipts. Start it, then just say what you want done.</p>
              <button class="fo-start" id="fo-start">Start the orchestrator</button>
              <div class="fo-teach">
                <div class="fo-t"><span class="k">⏎</span>ask Kage anything about this repo</div>
                <div class="fo-t"><span class="k">⌘⏎</span>dispatch a single run directly — no orchestrator needed</div>
                <div class="fo-t"><span class="k">⌥⏎</span>orchestrate a multi-run goal with approval gates</div>
              </div>
              <div class="fo-note">First time here? The board fills as runs are hired — nothing is faked meanwhile.</div>
            </div>
          </div>
        </div>
        <div id="room-turns"></div>
        <div class="typing" id="room-typing" style="display:none"><span id="room-typing-text">thinking</span><span class="dots"><i></i><i></i><i></i></span></div>
      </div></div>
      <div class="liverail" id="liverail"></div>
      <div class="room-composer">
        <div class="room-cwrap">
          <textarea id="room-input" rows="1" placeholder="Message Kage…"></textarea>
          <button class="room-send" id="room-send">Send ⏎</button>
        </div>
        <div class="cbar" id="room-cbar"></div>
        <div class="preflight" id="room-preflight"></div>
        <div class="room-hint">⏎ ask Kage · ⌘⏎ dispatch a run now · ⌥⏎ orchestrate as a goal · ⇧⏎ newline</div>
      </div>
    </div>
    <div id="room-term-pane"><div id="room-term"></div></div>
  </div>
  <div class="view" id="v-work">
    <div class="workbar">
      <span class="wsum" id="work-sum"></span>
      <div class="wlayout">
        <button class="on" id="wl-list" title="a triaged list beside the run's detail">List</button>
        <button id="wl-board" title="the same runs, the same powers, as columns">Board</button>
      </div>
    </div>
    <div class="workmain">
      <div class="runs" id="work-split">
        <div class="list"><div class="card hand" id="handover" style="display:none"></div><div id="goal-cards"></div><div id="run-list"></div></div>
        <div class="detail">
          <div id="run-detail"></div>
          <div id="run-term-pane"><div class="term-banner">Supervision is paused while you drive. Kage is not recording checks until you hand back.</div><div class="term-head"><span id="run-term-run"></span><span class="chip warn">taken over</span><span class="chip">same session — your keyboard now</span><button class="btn sm" id="run-term-handback">Hand Back</button></div><div id="run-term"></div><div class="term-foot">hand back to resume supervision — the kernel re-runs every check before this can merge, no matter what happens here</div></div>
        </div>
      </div>
      <div class="board-scroll" id="work-board"><div class="board" id="board-cols"></div></div>
    </div>
  </div>
  <div class="view" id="v-memory">
    <div class="mem-scroll"><div class="mem-col">
      <div id="mem-hero"></div>
      <div class="mem-health" id="mem-health"></div>
      <div class="mem-browse">
        <div class="mem-filters">
          <input id="mem-search" type="search" placeholder="Search what this repo has learned…" />
          <div class="mem-types" id="mem-types"></div>
        </div>
        <div id="mem-list"></div>
      </div>
    </div></div>
  </div>
  <div class="overlay" id="packet-overlay">
    <div class="packet">
      <div class="ph"><h3 id="packet-title"></h3><button class="btn" id="packet-close">Close</button></div>
      <div class="pchips" id="packet-chips"></div>
      <div class="pbody" id="packet-body"></div>
      <div class="pfly" id="packet-flywheel"></div>
      <div class="pfoot">
        <button class="fb" data-fb="helpful">helpful</button>
        <button class="fb" data-fb="wrong">wrong</button>
        <button class="fb" data-fb="stale">stale</button>
        <span class="msg" id="packet-msg">feedback tunes what future briefs carry</span>
      </div>
    </div>
  </div>
  <div class="overlay" id="goal-overlay">
    <div class="packet">
      <div class="ph"><h3 id="goal-title"></h3><button class="btn" id="goal-close">Close</button></div>
      <div class="pbody" id="goal-body"></div>
    </div>
  </div>
</main>
</div>
<div class="status">
  <span class="conn" id="conn" title="live"></span>
  <span id="st-left">connecting…</span>
  <span class="right"><span id="st-counts"></span><span>⌘K commands · ⌘N new run · ⌥L next needing you</span></span>
</div>
<div class="overlay" id="settings-overlay">
  <div class="settings">
    <div class="sh"><h3>Project settings</h3><span class="path" id="settings-path"></span></div>
    <div class="sbody" id="settings-body"></div>
    <div class="sfoot">
      <button class="btn primary" id="settings-save">Save</button>
      <button class="btn" id="settings-close">Close</button>
      <span class="msg" id="settings-msg"></span>
    </div>
  </div>
</div>
<div class="overlay" id="addproject-overlay">
  <div class="settings">
    <div class="sh"><h3>Add a project</h3></div>
    <div class="sbody" id="addproject-body">
      <div class="srow">
        <div>
          <div class="label">Repo folder</div>
          <div class="desc">A path to a git repository on this machine.</div>
        </div>
        <input id="addproject-path" type="text" placeholder="/Users/you/code/my-repo" autocomplete="off" spellcheck="false">
      </div>
      <div class="addproject-candidates" id="addproject-candidates"></div>
      <div class="srow" id="addproject-agent-row" style="display:none">
        <div>
          <div class="label">Worker agent</div>
          <div class="desc">Runs the work Kage dispatches in this project.</div>
        </div>
        <select id="addproject-agent"></select>
      </div>
      <div class="srow" id="addproject-orchestrator-row" style="display:none">
        <div>
          <div class="label">Orchestrator agent</div>
          <div class="desc" id="addproject-orchestrator-desc"></div>
        </div>
        <span id="addproject-orchestrator-value"></span>
      </div>
    </div>
    <div class="sfoot">
      <button class="btn primary" id="addproject-go" disabled>Create and open its Room</button>
      <button class="btn" id="addproject-cancel">Cancel</button>
      <span class="msg" id="addproject-msg"></span>
    </div>
  </div>
</div>
<div class="overlay" id="palette-overlay">
  <div class="palette">
    <input id="palette-input" placeholder="Type a command or a run name…" autocomplete="off">
    <div class="results" id="palette-results"></div>
  </div>
</div>
<div class="overlay" id="overlay">
  <div class="modal">
    <div class="mh">New run — the brief is compiled from repo memory before anything starts</div>
    <textarea id="intent" placeholder="What should change, and how you'll know it worked"></textarea>
    <div class="preflight" id="modal-preflight"></div>
    <div class="mrow">
      <select id="agent"><option>claude</option><option>codex</option><option>stub</option></select>
      <select id="rtype"><option>chore</option><option>bugfix</option><option>feature</option><option>refactor</option><option>migration</option><option>investigation</option></select>
      <span class="flash" id="dispatch-flash"></span>
      <button class="btn primary" id="dispatch-go">Dispatch ⏎</button>
      <button class="btn" id="dispatch-cancel">esc</button>
    </div>
  </div>
</div>

<script src="/vendor/xterm.js"></script>
<script src="/vendor/xterm-addon-fit.js"></script>
<script>
${APP_CLIENT}
</script>
</body>
</html>
`;
