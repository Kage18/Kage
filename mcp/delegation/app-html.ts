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
// Design contract (v7 — the room is the front door):
//   - IDE shape: title bar · content · status bar. Four views: Room (1, default),
//     Inbox (2), Runs (3), Board (4). "n" still opens the fast-path dispatch modal —
//     AO's board offers both "Orchestrator" and "+ New task" side by side, and that
//     split earns its keep: talking is how trust gets built, a modal is for when you
//     already know exactly what you want.
//   - The room is a conversation, not a queue. You land in it on open. It talks to
//     the SAME manager `kage room` launches interactively (askManager, one MCP
//     surface, one constitution) — dispatch, judgment and reporting all happen by
//     talking, not by filling a form. Inbox/Runs/Board are the manager's own
//     bookkeeping: what it dispatched, verified, and is waiting on you for.
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
  :root {
    --bg:#f6f5f2; --surface:#ffffff; --surface2:#efede8; --inset:#e9e7e1;
    --line:#dcd9d1; --line2:#e8e5de; --line-strong:#bfbab0; --text:#1b1f22; --text2:#5c6166; --text3:#8f918f;
    --chrome:#eceae4; --seal:#d4552f; --jade:#2f9268; --amber:#b3811c; --crimson:#9e3b3b;
    --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
    --sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    /* Kage's display face, carried over from the viewer, where it sets the brand mark
       and every heading. The app had no typographic identity at all — system sans for
       everything — which is the main reason the two surfaces read as different
       products despite sharing a palette. */
    --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
    /* One radius scale instead of eleven ad-hoc values (3,4,5,6,7,8,9,10,11,12,13px).
       The viewer's tighter scale reads as a precise tool; soft 12-13px corners read as
       a generic web app. */
    --r-control:4px; --r-panel:6px; --r-card:8px;
    --shadow-sm:0 1px 2px rgba(20,24,26,.05), 0 2px 8px rgba(20,24,26,.05);
    --shadow-md:0 1px 2px rgba(20,24,26,.06), 0 10px 28px rgba(20,24,26,.10);
  }
  /* Dark tokens live in a named block so BOTH the OS preference and an explicit
     in-app choice can apply them. The explicit choice must win in both directions,
     so it is a data-theme attribute on :root that overrides the media query. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg:#121619; --surface:#1a1f23; --surface2:#20262b; --inset:#15191d;
      --line:#2c333a; --line2:#242b31; --line-strong:#414a52; --text:#e8e8e5; --text2:#a6acb0; --text3:#70777c;
      --chrome:#171c20; --seal:#e86a42; --jade:#46b184; --amber:#d9a53c; --crimson:#cc6b6b;
      --shadow-sm:0 1px 2px rgba(0,0,0,.35), 0 2px 10px rgba(0,0,0,.25);
      --shadow-md:0 1px 2px rgba(0,0,0,.4), 0 14px 36px rgba(0,0,0,.45); }
  }
  :root[data-theme="dark"] {
    --bg:#121619; --surface:#1a1f23; --surface2:#20262b; --inset:#15191d;
    --line:#2c333a; --line2:#242b31; --line-strong:#414a52; --text:#e8e8e5; --text2:#a6acb0; --text3:#70777c;
    --chrome:#171c20; --seal:#e86a42; --jade:#46b184; --amber:#d9a53c; --crimson:#cc6b6b;
    --shadow-sm:0 1px 2px rgba(0,0,0,.35), 0 2px 10px rgba(0,0,0,.25);
    --shadow-md:0 1px 2px rgba(0,0,0,.4), 0 14px 36px rgba(0,0,0,.45); }

  /* notification badge on the bell */
  .bellwrap { position:relative; display:inline-flex; }
  .bellwrap .badge { position:absolute; top:-5px; right:-5px; min-width:16px; height:16px;
    border-radius:var(--r-card); background:var(--crimson); color:#fff; font-family:var(--mono);
    font-size:9.5px; display:flex; align-items:center; justify-content:center; padding:0 4px; }
  * { box-sizing:border-box; }
  html,body { height:100%; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:var(--sans);
    font-size:14px; line-height:1.5; -webkit-font-smoothing:antialiased; overflow:hidden; }
  button { font:inherit; cursor:pointer; border:none; background:none; color:inherit; padding:0; }
  ::-webkit-scrollbar { width:10px; height:10px; }
  ::-webkit-scrollbar-thumb { background:var(--line); border-radius:var(--r-panel); border:2px solid transparent; background-clip:content-box; }
  ::-webkit-scrollbar-track { background:transparent; }

  /* ---- chrome: title bar + status bar (the IDE frame) ---- */
  .top { display:flex; align-items:center; gap:12px; height:46px; padding:0 14px;
    background:var(--chrome); border-bottom:1px solid var(--line); user-select:none;
    -webkit-app-region:drag; flex:none; }
  .top button, .top .seg { -webkit-app-region:no-drag; }
  body.electron .top { padding-left:84px; }
  .seal { width:26px; height:26px; border:1.5px solid var(--seal); border-radius:var(--r-panel); color:var(--seal);
    font-family:var(--mono); font-weight:700; font-size:13px; display:flex; align-items:center;
    justify-content:center; flex:none; }
  .appname { font-family:var(--serif); font-weight:700; font-size:16px; letter-spacing:.01em; }
  .proj { font-family:var(--mono); font-size:11px; color:var(--text3); overflow:hidden;
    text-overflow:ellipsis; white-space:nowrap; max-width:30vw; }
  /* The rail names the current project already; showing it twice is just noise. */
  body:not(.rail-off) .proj { display:none; }
  .seg { margin-left:auto; display:flex; background:var(--inset); border:1px solid var(--line);
    border-radius:var(--r-card); padding:2px; gap:2px; }
  .seg button { font-size:12px; padding:4px 12px; border-radius:var(--r-panel); color:var(--text2); }
  .seg button.on { background:var(--surface); color:var(--text); box-shadow:var(--shadow-sm); }
  /* Rendered as an actual key cap, not a bare digit. "Runs 3" on a repo with zero
     runs read as "3 runs" — the shortcut hint was indistinguishable from a count. */
  .seg button .k { font-family:var(--mono); font-size:9px; color:var(--text3); margin-left:6px;
    border:1px solid var(--line); border-radius:var(--r-control); padding:1px 4px; line-height:1.3;
    display:inline-block; vertical-align:1px; background:var(--bg); }
  .seg button.on .k { border-color:var(--line-strong, var(--line)); }
  .iconbtn { font-size:12px; padding:5px 11px; border-radius:var(--r-panel); border:1px solid var(--line);
    background:var(--surface); color:var(--text2); box-shadow:var(--shadow-sm); }
  .iconbtn.primary { background:var(--seal); border-color:var(--seal); color:#fff; }

  /* The frame below the title bar is a horizontal split: projects rail, then the view.
     main used to own the height itself; it now fills whatever the split gives it. */
  .split { display:flex; height:calc(100% - 46px - 28px); min-height:0; }
  main { flex:1; min-width:0; overflow:hidden; display:flex; flex-direction:column; }
  .view { display:none; flex:1; min-height:0; }

  /* ---- projects rail ----
     Only the CURRENT project can show live counts: its daemon is the one we are talking
     to. Other rows are deliberately just a name and a path — inventing a badge for a
     repo whose kernel we have not asked would be the app asserting something it does
     not know. Clicking one starts (or finds) that project's own daemon and goes there. */
  .side { width:214px; flex:none; background:var(--chrome); border-right:1px solid var(--line);
    display:flex; flex-direction:column; overflow:hidden; }
  body.rail-off .side { display:none; }
  .side .sidehead { display:flex; align-items:center; gap:6px; padding:13px 12px 7px 14px;
    font-size:10.5px; font-weight:650; letter-spacing:.09em; text-transform:uppercase; color:var(--text3); }
  .side .sidehead button { margin-left:auto; font-size:14px; line-height:1; color:var(--text3);
    padding:2px 6px; border-radius:var(--r-panel); }
  .side .sidehead button:hover { background:var(--inset); color:var(--text); }
  .plist { flex:1; overflow-y:auto; padding:0 8px 10px; }
  .prow { display:grid; grid-template-columns:1fr auto; align-items:center; gap:6px;
    padding:7px 9px; border-radius:var(--r-panel); cursor:pointer; margin-bottom:1px; }
  .prow:hover { background:var(--inset); }
  .prow.on { background:var(--surface); box-shadow:var(--shadow-sm); }
  .prow .pn { font-size:12.5px; font-weight:550; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .prow.on .pn { color:var(--text); }
  .prow .pp { grid-column:1/2; font-family:var(--mono); font-size:10px; color:var(--text3);
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .prow .pcount { font-family:var(--mono); font-size:10px; color:#fff; background:var(--amber);
    border-radius:var(--r-card); padding:1px 6px; }
  .prow .pforget { font-size:13px; color:var(--text3); padding:0 4px; border-radius:var(--r-control); display:none; }
  .prow:hover .pforget { display:block; }
  .prow .pforget:hover { color:var(--crimson); }
  .side .sidefoot { border-top:1px solid var(--line); padding:9px 12px; font-size:11px; color:var(--text3); }
  .side .sidefoot b { font-weight:600; color:var(--text2); }
  @media (max-width: 900px) { .side { display:none; } }

  /* ---- memory ----
     The one view that answers "what has Kage actually done for me". It leads with
     OBSERVED numbers (recalls served, stale memories withheld, packets written) and
     labels the token figure as the estimate it is — a dashboard that presents a model
     and a measurement in the same voice is how a product starts lying to its user. */
  .mem-scroll { flex:1; overflow-y:auto; }
  .mem-col { max-width:940px; margin:0 auto; padding:26px 24px 60px; }
  .mem-hero { border:1px solid var(--line); border-radius:var(--r-card); background:var(--surface);
    padding:22px 24px; box-shadow:var(--shadow-sm); margin-bottom:14px; }
  .mem-hero .eyebrow { font-size:10.5px; font-weight:650; letter-spacing:.1em; text-transform:uppercase;
    color:var(--text3); margin-bottom:14px; }
  .mem-figs { display:flex; flex-wrap:wrap; gap:30px; }
  .mem-fig .n { font-family:var(--mono); font-size:26px; font-weight:600; letter-spacing:-.02em;
    font-variant-numeric:tabular-nums; }
  .mem-fig .l { font-size:12px; color:var(--text2); margin-top:3px; }
  .mem-fig .sub { font-size:11px; color:var(--text3); margin-top:1px; }
  .mem-fig.jade .n { color:var(--jade); }
  .mem-fig.amber .n { color:var(--amber); }
  .mem-est { margin-top:16px; padding-top:14px; border-top:1px solid var(--line);
    display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  .mem-est .n { font-family:var(--mono); font-size:16px; font-variant-numeric:tabular-nums; color:var(--text2); }
  .mem-est .l { font-size:11.5px; color:var(--text3); }

  .mem-health { display:grid; grid-template-columns:repeat(auto-fit, minmax(128px, 1fr)); gap:10px; margin-bottom:22px; }
  .mem-stat { border:1px solid var(--line); border-radius:var(--r-card); background:var(--surface); padding:12px 14px; }
  .mem-stat .n { font-family:var(--mono); font-size:17px; font-variant-numeric:tabular-nums; }
  .mem-stat .l { font-size:11px; color:var(--text3); margin-top:2px; }
  .mem-stat.warn { border-color:var(--amber); }
  .mem-stat.warn .n { color:var(--amber); }

  .mem-filters { display:flex; flex-direction:column; gap:11px; margin-bottom:14px; }
  #mem-search { width:100%; box-sizing:border-box; font:inherit; font-size:13.5px; padding:10px 13px;
    border-radius:var(--r-card); border:1px solid var(--line); background:var(--inset); color:var(--text); }
  #mem-search:focus { outline:none; border-color:var(--seal); }
  .mem-types { display:flex; flex-wrap:wrap; gap:6px; }
  .mem-chip { font-family:var(--mono); font-size:11px; padding:4px 10px; border-radius:999px;
    border:1px solid var(--line); color:var(--text3); background:var(--surface); }
  .mem-chip.on { border-color:var(--seal); color:var(--seal); }
  .mem-chip .c { opacity:.6; margin-left:5px; }

  .mem-row { border:1px solid var(--line); border-top:none; background:var(--surface); padding:13px 16px; cursor:pointer; }
  .mem-row:first-child { border-top:1px solid var(--line); border-radius:var(--r-card) var(--r-card) 0 0; }
  .mem-row:last-child { border-radius:0 0 var(--r-card) var(--r-card); }
  .mem-row:only-child { border-radius:var(--r-card); }
  .mem-row:hover { background:var(--inset); }
  .mem-row .t { font-size:13.5px; font-weight:550; margin-bottom:3px; }
  .mem-row .s { font-size:12.5px; color:var(--text2); line-height:1.5;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .mem-row .meta { display:flex; gap:9px; align-items:center; margin-top:7px;
    font-family:var(--mono); font-size:10.5px; color:var(--text3); }
  .mem-row .ty { color:var(--seal); }
  .mem-row .stale { color:var(--amber); }
  .mem-empty { text-align:center; color:var(--text3); font-size:13px; padding:40px 20px; line-height:1.7; }

  .packet { width:min(760px, 92vw); max-height:82vh; display:flex; flex-direction:column;
    background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card); box-shadow:var(--shadow-md); }
  .packet .ph { display:flex; align-items:center; gap:14px; padding:17px 20px; border-bottom:1px solid var(--line); }
  .packet .ph h3 { margin:0; font-family:var(--serif); font-size:17px; font-weight:600; flex:1; letter-spacing:.005em; }
  .packet .pbody { overflow-y:auto; padding:18px 22px 24px; font-size:13.5px; line-height:1.65;
    white-space:pre-wrap; word-break:break-word; color:var(--text2); font-family:var(--mono); }
  .view.on { display:flex; flex-direction:column; }

  .status { height:28px; display:flex; align-items:center; gap:14px; padding:0 14px;
    background:var(--chrome); border-top:1px solid var(--line); font-family:var(--mono);
    font-size:10.5px; color:var(--text3); flex:none; user-select:none; }
  .conn { width:7px; height:7px; border-radius:50%; background:var(--jade); flex:none; }
  .conn.off { background:var(--crimson); }
  .status .right { margin-left:auto; display:flex; gap:14px; }

  .jade { color:var(--jade); } .amber { color:var(--amber); } .crimson { color:var(--crimson); }
  .dim { color:var(--text3); }

  .empty { padding:56px 24px; text-align:center; color:var(--text3); font-size:13px; line-height:1.7; }
  .empty b { display:block; color:var(--text2); font-weight:550; margin-bottom:5px; }
  .empty kbd { font-family:var(--mono); font-size:10.5px; border:1px solid var(--line);
    border-radius:var(--r-control); padding:1px 5px; color:var(--text2); background:var(--bg); }
  .empty .kbd { margin:0 3px; }
  .kbd { font-family:var(--mono); font-size:10px; border:1px solid var(--line); border-bottom-width:2px;
    border-radius:var(--r-control); padding:1px 6px; color:var(--text2); background:var(--surface); }

  /* ---- room: the conversation ---- */
  .room-scroll { overflow-y:auto; flex:1; }
  .room-col { max-width:720px; margin:0 auto; padding:28px 24px 32px; display:flex; flex-direction:column; gap:18px; }
  .primer { text-align:center; padding:70px 20px 20px; color:var(--text3); }
  .primer .pseal { width:44px; height:44px; border:1.5px solid var(--seal); border-radius:var(--r-card); color:var(--seal);
    font-family:var(--mono); font-weight:700; font-size:22px; display:flex; align-items:center; justify-content:center;
    margin:0 auto 18px; }
  .primer p { max-width:420px; margin:0 auto; font-size:13.5px; line-height:1.6; }
  /* Assistant prose gets NO bubble.
     Wrapping every message in a container is the single reason this read as heavy
     next to AO: a bubble is a frame, and framing continuous prose fights the reading.
     Only the user's own lines are bubbled — they are short, they are interjections,
     and the contrast is what makes the thread scannable. */
  .turn { display:flex; flex-direction:column; gap:5px; max-width:100%; }
  .turn.you { align-self:flex-end; align-items:flex-end; max-width:80%; }
  .turn.kage { align-self:stretch; align-items:flex-start; }
  .turn .bubble2 { font-size:14.5px; line-height:1.65; white-space:pre-wrap; }
  .turn.you .bubble2 { background:var(--surface2); border:1px solid var(--line);
    color:var(--text); border-radius:var(--r-card); border-bottom-right-radius:4px; padding:9px 14px; font-size:14px; }
  .turn.kage .bubble2 { color:var(--text); max-width:68ch; }
  /* A turn boundary with elapsed time, the way AO closes a stretch of work. */
  .turnbreak { display:flex; align-items:center; gap:12px; padding:6px 0 2px; }
  .turnbreak .rule { flex:1; height:1px; background:var(--line2); }
  .turnbreak .label { font-family:var(--mono); font-size:10px; letter-spacing:.14em;
    text-transform:uppercase; color:var(--text3); }
  /* Tool use reads as an action line in the flow ("Ran dispatch ·"), not as a grey
     footnote appended to the prose. */
  .turn .toolline { display:flex; align-items:baseline; gap:8px; font-family:var(--mono);
    font-size:11.5px; color:var(--text3); padding:2px 0; }
  .turn .toolline .verb { color:var(--jade); }
  .turn .meta2 { font-family:var(--mono); font-size:10px; color:var(--text3); padding:0 3px; }
  .turn .meta2 .redact { color:var(--amber); }
  .turn .opened { display:inline-flex; align-items:center; gap:6px; margin-top:2px; padding:6px 11px;
    border:1px solid var(--line); border-radius:var(--r-card); background:var(--surface2); color:var(--text);
    font-size:12px; cursor:pointer; }
  .turn .opened:hover { border-color:var(--seal); }
  .turn .opened .arrow { color:var(--seal); font-family:var(--mono); }
  .typing { display:flex; align-items:center; gap:7px; align-self:flex-start; padding:0 3px;
    font-family:var(--mono); font-size:11px; color:var(--text3); }
  .typing .dots { display:inline-flex; gap:3px; }
  .typing .dots i { width:4px; height:4px; border-radius:50%; background:var(--text3); display:block;
    animation:pulse2 1.1s ease-in-out infinite; }
  .typing .dots i:nth-child(2) { animation-delay:.15s; } .typing .dots i:nth-child(3) { animation-delay:.3s; }
  @keyframes pulse2 { 0%,60%,100% { opacity:.25; } 30% { opacity:1; } }
  .room-composer { padding:14px 24px 18px; background:var(--surface); border-top:1px solid var(--line); flex:none; }
  .room-cwrap { display:flex; gap:10px; align-items:flex-end; background:var(--inset); border:1px solid var(--line);
    border-radius:var(--r-card); padding:10px 14px; max-width:720px; margin:0 auto; }
  .room-cwrap:focus-within { border-color:var(--text3); }
  .room-cwrap textarea { flex:1; border:none; background:none; color:var(--text); font-size:14px; font-family:var(--sans);
    outline:none; resize:none; max-height:140px; line-height:1.5; padding:2px 0; }
  .room-send { background:var(--seal); color:#fff; border-radius:var(--r-card); padding:7px 14px; font-size:12.5px; font-weight:600; }
  .room-send:disabled { opacity:.45; cursor:default; }
  .room-hint { text-align:center; font-family:var(--mono); font-size:10px; color:var(--text3); margin-top:8px; }
  /* composer controls: a row of pickers under the input, each opening a menu whose
     options carry their own one-line explanation. */
  .cbar { display:flex; gap:8px; align-items:center; max-width:720px; margin:8px auto 0; }
  .picker { position:relative; }
  .picker > button { font-family:var(--mono); font-size:11px; padding:4px 10px; border-radius:var(--r-panel);
    border:1px solid var(--line); background:var(--surface); color:var(--text2); }
  .picker > button:hover { color:var(--text); border-color:var(--text3); }
  .picker .menu { display:none; position:absolute; bottom:calc(100% + 6px); left:0; z-index:20;
    width:290px; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card);
    box-shadow:var(--shadow-md); padding:6px; }
  .picker.open .menu { display:block; }
  .picker .menu .head { font-family:var(--mono); font-size:9.5px; letter-spacing:.13em;
    text-transform:uppercase; color:var(--text3); padding:7px 10px 4px; }
  .picker .opt { padding:8px 10px; border-radius:var(--r-panel); cursor:pointer; }
  .picker .opt:hover { background:var(--surface2); }
  .picker .opt.on { background:var(--surface2); }
  .picker .opt .n { font-size:13px; }
  .picker .opt .d { font-size:11px; color:var(--text3); margin-top:2px; line-height:1.4; }

  /* ---- inbox: a centered column of decision cards ---- */
  .inbox-scroll { overflow-y:auto; flex:1; }
  .inbox-col { max-width:820px; margin:0 auto; padding:26px 24px 48px; }
  .seclabel { font-family:var(--mono); font-size:10px; letter-spacing:.14em; text-transform:uppercase;
    color:var(--text3); margin:0 2px 10px; display:flex; align-items:baseline; }
  .seclabel .n { margin-left:auto; }
  .card { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card);
    box-shadow:var(--shadow-sm); overflow:hidden; }
  .qrow { display:grid; grid-template-columns:34px 1fr auto; gap:12px; padding:15px 18px 15px 14px;
    cursor:pointer; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card);
    box-shadow:var(--shadow-sm); margin-bottom:10px; transition:border-color .12s, box-shadow .12s; }
  .qrow:hover { border-color:var(--text3); box-shadow:var(--shadow-md); }
  .glyph { font-family:var(--mono); font-size:15px; text-align:center; padding-top:1px; }
  .qt { font-size:14.5px; font-weight:550; line-height:1.45; letter-spacing:-.006em;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .qatoms { display:flex; gap:12px; margin-top:6px; flex-wrap:wrap; align-items:baseline; }
  .atom { font-family:var(--mono); font-size:10.5px; color:var(--text3); }
  .atom.branch { max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .atom.jade { color:var(--jade); } .atom.amber { color:var(--amber); } .atom.hot { color:var(--crimson); }
  .qtime { font-family:var(--mono); font-size:10.5px; color:var(--text3); padding-top:3px; }
  .quiet { text-align:center; font-family:var(--mono); font-size:11px; color:var(--text3); padding:18px 0 4px; }

  /* handover card */
  .hand { margin-bottom:22px; }
  .hand .hhead { display:flex; align-items:baseline; padding:11px 18px; border-bottom:1px solid var(--line2);
    font-family:var(--mono); font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--text3); }
  .hand .hhead button { margin-left:auto; font-family:var(--mono); font-size:10px; color:var(--text3); letter-spacing:.05em; }
  .hand .hhead button:hover { color:var(--text); }
  .hrow { display:grid; grid-template-columns:24px 1fr auto; gap:11px; padding:9px 18px;
    border-bottom:1px solid var(--line2); align-items:baseline; font-size:13.5px; }
  .hrow:last-child { border-bottom:none; }
  .hic { font-family:var(--mono); text-align:center; }
  .hatom { font-family:var(--mono); font-size:10.5px; color:var(--text3); }

  /* ---- runs: sidebar + detail ---- */
  .runs { display:grid; grid-template-columns:300px 1fr; flex:1; min-height:0; }
  .list { border-right:1px solid var(--line); overflow-y:auto; background:var(--inset); padding:8px 0 20px; }
  .lgroup { padding:14px 16px 6px; font-family:var(--mono); font-size:10px; letter-spacing:.14em;
    text-transform:uppercase; color:var(--text3); display:flex; }
  .lgroup em { font-style:normal; margin-left:auto; }
  .ws { margin:1px 8px; padding:9px 10px; border-radius:var(--r-card); cursor:pointer;
    display:grid; grid-template-columns:1fr auto; gap:8px; align-items:start; border:1px solid transparent; }
  .ws:hover { background:var(--surface2); }
  .ws.sel { background:var(--surface); border-color:var(--line); box-shadow:var(--shadow-sm); }
  .ws .t { font-size:12.5px; font-weight:500; line-height:1.4;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .ws.attn .t { font-weight:650; }
  .ws .meta { font-family:var(--mono); font-size:10px; color:var(--text3); margin-top:3px;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:230px; }
  .dot { width:7px; height:7px; border-radius:50%; margin-top:5px; }
  .dot.amber { background:var(--amber); } .dot.jade { background:var(--jade); } .dot.grey { background:var(--text3); }

  .detail { overflow:hidden; display:flex; flex-direction:column; background:var(--bg); min-width:0; }
  .dhead { padding:18px 26px 0; background:var(--surface); border-bottom:1px solid var(--line); flex:none; }
  .dhead h2 { margin:0 0 9px; font-size:16.5px; font-weight:650; letter-spacing:-.014em; line-height:1.35; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; }
  .chip { font-family:var(--mono); font-size:10.5px; padding:3px 9px; border-radius:var(--r-panel);
    border:1px solid var(--line); color:var(--text2); background:var(--surface2);
    max-width:340px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .chip.state-ready { color:var(--jade); border-color:color-mix(in srgb, var(--jade) 40%, var(--line)); }
  .chip.state-blocked { color:var(--amber); border-color:color-mix(in srgb, var(--amber) 40%, var(--line)); }
  .chip.state-merged { color:var(--text3); }
  .tabs { display:flex; gap:4px; margin-top:12px; }
  .tab { font-size:12px; padding:8px 13px; color:var(--text3); border-bottom:2px solid transparent; }
  .tab:hover { color:var(--text2); }
  .tab.on { color:var(--text); border-bottom-color:var(--seal); }

  .dbody { padding:20px 26px 28px; flex:1; overflow-y:auto; min-height:0; }
  .dcol { max-width:900px; }
  .activityline { display:flex; gap:9px; align-items:baseline; font-family:var(--mono); font-size:12px;
    color:var(--text); background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card);
    padding:10px 14px; margin-bottom:14px; box-shadow:var(--shadow-sm); }
  .activityline .pulse { color:var(--jade); }
  .qbanner { display:grid; grid-template-columns:22px 1fr; gap:10px; font-size:14px;
    background:color-mix(in srgb, var(--amber) 7%, var(--surface)); border:1px solid color-mix(in srgb, var(--amber) 40%, var(--line));
    border-radius:var(--r-card); padding:12px 14px; margin-bottom:14px; }
  /* Follow — a session, not a log. Timestamps are the least important thing on the
     line, so they stop being the first column; state changes are quiet rules; the
     agent's own words get real prose type. */
  .ev { display:flex; align-items:baseline; gap:10px; padding:5px 0; font-size:12.5px; color:var(--text3); }
  .ev .ts { font-family:var(--mono); font-size:10px; color:var(--text3); opacity:.6;
    font-variant-numeric:tabular-nums; margin-left:auto; flex:none; }
  .ev .lifecycle { font-family:var(--mono); font-size:11px; letter-spacing:.02em; }
  .said { padding:10px 0 12px; }
  .said .bubble { font-size:14px; line-height:1.6; color:var(--text); max-width:64ch; white-space:pre-wrap; }
  .said .who { font-family:var(--mono); font-size:10px; letter-spacing:.12em; text-transform:uppercase;
    color:var(--text3); margin-bottom:5px; }
  .toolcard { display:flex; align-items:baseline; gap:10px; padding:5px 0; }
  .toolcard .ic { width:16px; text-align:center; font-size:12px; flex:none; }
  .toolcard .ic.read { color:var(--text3); } .toolcard .ic.edit { color:var(--jade); }
  .toolcard .ic.run { color:var(--seal); } .toolcard .ic.plan { color:var(--amber); }
  .toolcard .lbl { font-family:var(--mono); font-size:12px; color:var(--text2); }
  .toolcard .ts { font-family:var(--mono); font-size:10px; color:var(--text3); opacity:.6;
    margin-left:auto; font-variant-numeric:tabular-nums; flex:none; }
  .livepulse { width:6px; height:6px; border-radius:50%; background:var(--jade); display:inline-block;
    animation:pulse2 1.1s ease-in-out infinite; margin-right:7px; vertical-align:1px; }

  /* receipt — rendered from the claim's STRUCTURED data, never from the CLI's
     terminal-formatted card. Box-drawing characters and evidence paths belong in a
     terminal; a GUI has rows, weights and colour to say the same things better. */
  .verdict-head { display:flex; align-items:center; gap:12px; margin-bottom:6px; }
  .stamp { display:inline-flex; align-items:baseline; gap:8px; padding:8px 15px; border:2px solid var(--jade);
    border-radius:var(--r-panel); color:var(--jade); font-weight:700; font-size:14px; letter-spacing:.02em;
    background:color-mix(in srgb, var(--jade) 8%, transparent); }
  .stamp .count { font-family:var(--mono); font-size:13px; }
  .stamp.warn { border-color:var(--amber); color:var(--amber); background:color-mix(in srgb, var(--amber) 8%, transparent); }
  .stamp.bad { border-color:var(--crimson); color:var(--crimson); background:color-mix(in srgb, var(--crimson) 8%, transparent); }
  .verdict-sub { font-size:12.5px; color:var(--text3); }
  .claim-statement { font-size:15px; line-height:1.55; color:var(--text); border-left:2px solid var(--line);
    padding-left:14px; margin:16px 0 20px; max-width:62ch; }
  .checks { display:flex; flex-direction:column; gap:1px; background:var(--line2); border:1px solid var(--line);
    border-radius:var(--r-card); overflow:hidden; margin-bottom:18px; }
  .check { display:grid; grid-template-columns:22px 130px 1fr auto; gap:12px; align-items:baseline;
    padding:11px 14px; background:var(--surface); font-size:13px; }
  .check .mark { font-family:var(--mono); font-weight:700; text-align:center; }
  .check.pass .mark { color:var(--jade); }
  .check.fail .mark { color:var(--crimson); }
  .check.skip .mark { color:var(--amber); }
  .check .name { font-weight:600; }
  .check .detail { color:var(--text3); font-family:var(--mono); font-size:11.5px;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .check .ev { font-family:var(--mono); font-size:10.5px; color:var(--text3); opacity:.75; }
  .note-row { display:grid; grid-template-columns:20px 1fr; gap:10px; font-size:13.5px; line-height:1.5;
    padding:7px 0; color:var(--text2); max-width:64ch; }
  .note-row .ic { text-align:center; }
  .note-row.unsure .ic { color:var(--amber); }
  .note-row.learn .ic { color:var(--seal); }
  .seclabel-sm { font-family:var(--mono); font-size:10px; letter-spacing:.14em; text-transform:uppercase;
    color:var(--text3); margin:18px 0 8px; }

  /* diff + raw */
  .codepane { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card);
    padding:10px 0; overflow-x:auto; box-shadow:var(--shadow-sm); }
  .dline { font-family:var(--mono); font-size:11.5px; padding:1px 16px; white-space:pre; }
  .dline.add { color:var(--jade); background:color-mix(in srgb, var(--jade) 7%, transparent); }
  .dline.del { color:var(--crimson); background:color-mix(in srgb, var(--crimson) 7%, transparent); }
  .dline.hunk { color:var(--text3); padding-top:6px; }
  .dline.file { color:var(--text); font-weight:600; background:var(--surface2); padding:5px 16px; margin-top:8px; }
  .rawpane { font-family:var(--mono); font-size:11px; color:var(--text2); white-space:pre-wrap;
    background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card); padding:14px 16px; }

  /* composer + actions */
  .composer { padding:12px 26px; background:var(--surface); border-top:1px solid var(--line); flex:none; }
  .cwrap { display:flex; gap:10px; align-items:center; background:var(--inset); border:1px solid var(--line);
    border-radius:var(--r-card); padding:9px 13px; max-width:900px; }
  .cwrap:focus-within { border-color:var(--text3); }
  .cwrap .caret { color:var(--seal); font-family:var(--mono); }
  .cwrap input { flex:1; border:none; background:none; color:var(--text); font-size:13px; outline:none; }
  .cwrap .hint { font-family:var(--mono); font-size:10px; color:var(--text3); white-space:nowrap; }
  .actionbar { padding:11px 26px 14px; background:var(--surface); display:flex; gap:9px; align-items:center; flex:none; }
  .btn { font-size:12.5px; font-weight:550; padding:7px 15px; border-radius:var(--r-card);
    border:1px solid var(--line); background:var(--surface); color:var(--text); box-shadow:var(--shadow-sm); }
  .btn:hover { border-color:var(--text3); }
  .btn.primary { background:var(--jade); border-color:var(--jade); color:#fff; }
  .btn.danger { color:var(--crimson); }
  .flash { font-family:var(--mono); font-size:11px; color:var(--text2); margin-left:auto;
    max-width:46%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

  /* ---- board ---- */
  .board-scroll { overflow:auto; flex:1; }
  /* Equal columns that actually stay equal: minmax(0,1fr) — with minmax(240px,1fr)
     a long unbroken card title forces its column wider than its siblings, which is
     what made the board look lopsided. */
  .board { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:14px;
    padding:18px 18px 30px; min-height:100%; align-items:stretch; }
  /* stretch, not start: four 160px stubs floating above empty space made the board
     look broken on a repo with no runs. Columns are the board. */
  .bcol { background:var(--inset); border:1px solid var(--line2); border-radius:var(--r-card); padding:10px;
    min-height:220px; min-width:0; display:flex; flex-direction:column; }
  .bcol .bempty { margin:auto; text-align:center; color:var(--text3); font-size:11.5px;
    line-height:1.6; padding:14px 10px; max-width:190px; }
  .bh { display:flex; align-items:center; gap:7px; font-family:var(--mono); font-size:10px;
    letter-spacing:.13em; text-transform:uppercase; color:var(--text3); margin:4px 6px 10px; }
  .bh i { width:7px; height:7px; border-radius:50%; display:block; }
  .bh .sep { opacity:.4; margin:0 2px; }
  .bh .n { margin-left:auto; font-variant-numeric:tabular-nums; }
  .acard { border:1px solid var(--line); border-radius:var(--r-card); background:var(--surface);
    padding:11px 12px; margin-bottom:8px; display:grid; grid-template-columns:26px 1fr; gap:10px;
    cursor:pointer; box-shadow:var(--shadow-sm); transition:border-color .12s, box-shadow .12s; }
  .acard:hover { border-color:var(--text3); box-shadow:var(--shadow-md); }
  .av { width:24px; height:24px; border-radius:var(--r-panel); display:flex; align-items:center; justify-content:center;
    font-family:var(--mono); font-size:9.5px; font-weight:700; background:var(--surface2);
    border:1px solid var(--line); color:var(--text2); }
  .av.claude { color:var(--seal); border-color:color-mix(in srgb, var(--seal) 40%, var(--line));
    background:color-mix(in srgb, var(--seal) 10%, var(--surface2)); }
  .av.codex { color:var(--jade); border-color:color-mix(in srgb, var(--jade) 40%, var(--line));
    background:color-mix(in srgb, var(--jade) 10%, var(--surface2)); }
  .acard .at { font-size:12.5px; font-weight:550; line-height:1.4;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .acard .abr { font-family:var(--mono); font-size:10px; color:var(--text3); margin-top:3px;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .acard .arow { display:flex; gap:10px; margin-top:7px; align-items:baseline; }
  .acard .tm { margin-left:auto; font-family:var(--mono); font-size:10px; color:var(--text3); }

  /* ---- notification center ---- */
  .notif { display:none; position:absolute; top:42px; right:14px; z-index:30; width:min(420px,88vw);
    background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card); box-shadow:var(--shadow-md);
    overflow:hidden; }
  .notif.on { display:block; }
  .notif .nh { padding:13px 16px; border-bottom:1px solid var(--line2); font-size:14px; font-weight:600; }
  .notif .nlist { max-height:340px; overflow-y:auto; }
  .notif .nrow { display:grid; grid-template-columns:20px 1fr auto; gap:11px; padding:12px 16px;
    border-bottom:1px solid var(--line2); cursor:pointer; align-items:baseline; }
  .notif .nrow:last-child { border-bottom:none; }
  .notif .nrow:hover { background:var(--surface2); }
  .notif .nrow .ic { text-align:center; }
  .notif .nrow .t { font-size:13.5px; line-height:1.4; }
  .notif .nrow .s { font-size:11.5px; color:var(--text3); margin-top:3px; }
  .notif .nrow .when { font-family:var(--mono); font-size:10px; color:var(--text3); }
  .notif .none { padding:26px; text-align:center; color:var(--text3); font-size:13px; }

  /* ---- command palette ---- */
  .palette { width:min(560px,92vw); background:var(--surface); border:1px solid var(--line);
    border-radius:var(--r-card); box-shadow:var(--shadow-md); overflow:hidden; }
  .palette input { width:100%; border:none; background:none; color:var(--text); font-size:15px;
    padding:15px 18px; outline:none; border-bottom:1px solid var(--line2); font-family:var(--sans); }
  .palette .results { max-height:340px; overflow-y:auto; padding:6px; }
  .palette .row { display:flex; align-items:baseline; gap:11px; padding:9px 12px; border-radius:var(--r-card); cursor:pointer; }
  .palette .row.sel { background:var(--surface2); }
  .palette .row .name { font-size:13.5px; }
  .palette .row .grp { font-family:var(--mono); font-size:10px; color:var(--text3); }
  .palette .row .hint { margin-left:auto; font-family:var(--mono); font-size:10px; color:var(--text3); }
  .palette .none { padding:22px; text-align:center; color:var(--text3); font-size:13px; }

  /* ---- settings ---- */
  .settings { width:min(620px,94vw); background:var(--surface); border:1px solid var(--line);
    border-radius:var(--r-card); box-shadow:var(--shadow-md); overflow:hidden; }
  .settings .sh { display:flex; align-items:baseline; padding:16px 20px; border-bottom:1px solid var(--line2); }
  .settings .sh h3 { font-family:var(--serif); font-size:17px; margin:0; font-size:16px; font-weight:650; }
  .settings .sh .path { margin-left:auto; font-family:var(--mono); font-size:10.5px; color:var(--text3);
    max-width:52%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .settings .sbody { padding:6px 20px 12px; max-height:60vh; overflow-y:auto; }
  .srow { display:grid; grid-template-columns:1fr 230px; gap:16px; align-items:center;
    padding:13px 0; border-bottom:1px solid var(--line2); }
  .srow:last-child { border-bottom:none; }
  .srow .label { font-size:13.5px; }
  .srow .desc { font-size:11.5px; color:var(--text3); margin-top:3px; line-height:1.45; }
  .srow input[type=text], .srow input[type=number] { width:100%; background:var(--inset); color:var(--text);
    border:1px solid var(--line); border-radius:var(--r-panel); padding:7px 10px; font-family:var(--mono);
    font-size:12px; outline:none; }
  .srow input:focus { border-color:var(--text3); }
  .srow .toggle { justify-self:start; width:42px; height:23px; border-radius:var(--r-card); background:var(--line);
    position:relative; cursor:pointer; border:none; }
  .srow .toggle.on { background:var(--jade); }
  .srow .toggle i { position:absolute; top:3px; left:3px; width:17px; height:17px; border-radius:50%;
    background:#fff; display:block; transition:left .12s; }
  .srow .toggle.on i { left:22px; }
  .settings .sfoot { padding:13px 20px; border-top:1px solid var(--line2); display:flex; gap:10px; align-items:center; }
  .settings .sfoot .msg { font-family:var(--mono); font-size:11px; color:var(--text3); margin-left:auto; }

  /* ---- dispatch modal ---- */
  .overlay { position:fixed; inset:0; background:rgba(10,12,14,.42); display:none; align-items:flex-start;
    justify-content:center; padding-top:14vh; z-index:10; backdrop-filter:blur(2px); }
  .overlay.on { display:flex; }
  .modal { width:min(640px,92vw); background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card);
    box-shadow:var(--shadow-md); overflow:hidden; }
  .modal .mh { padding:13px 18px; font-family:var(--mono); font-size:10.5px; letter-spacing:.08em;
    text-transform:uppercase; color:var(--text3); border-bottom:1px solid var(--line2); }
  .modal textarea { width:100%; border:none; background:none; color:var(--text); font-size:14px;
    font-family:var(--sans); padding:16px 18px; min-height:84px; outline:none; resize:vertical; }
  .modal .mrow { padding:12px 18px; border-top:1px solid var(--line2); display:flex; gap:10px; align-items:center; }
  .modal select { font-family:var(--mono); font-size:11.5px; background:var(--surface2); color:var(--text);
    border:1px solid var(--line); border-radius:var(--r-panel); padding:5px 9px; }

  @media (max-width:900px) {
    .runs { grid-template-columns:1fr; } .list { max-height:38%; border-right:none; border-bottom:1px solid var(--line); }
    .board { grid-template-columns:repeat(2, minmax(220px,1fr)); }
  }

  /* Terminal mode — a REAL claude session, not our own chat rendering of one */
  .room-toggle { display:flex; gap:2px; padding:9px 24px 0; flex:none; }
  .room-toggle button { font-family:var(--mono); font-size:11px; padding:6px 13px; border-radius:var(--r-panel) var(--r-panel) 0 0;
    color:var(--text3); border:1px solid transparent; }
  .room-toggle button.on { color:var(--text); background:var(--surface); border-color:var(--line); border-bottom-color:var(--surface); }
  /* Conversation threads, pushed to the right so Chat/Terminal (which view of THIS
     thread) never reads as a sibling of which thread. */
  .threads { display:flex; gap:2px; margin-left:auto; align-items:center; min-width:0; overflow:hidden; }
  .thread { display:flex; align-items:center; gap:6px; font-family:var(--mono); font-size:11px;
    padding:6px 10px; border-radius:var(--r-panel) var(--r-panel) 0 0; color:var(--text3); border:1px solid transparent;
    cursor:pointer; max-width:170px; }
  .thread:hover { color:var(--text2); }
  .thread.on { color:var(--text); background:var(--surface); border-color:var(--line); border-bottom-color:var(--surface); }
  .thread .tname { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .thread .tdot { width:5px; height:5px; border-radius:50%; background:var(--amber); flex:none; }
  .thread .tx { color:var(--text3); font-size:12px; display:none; }
  .thread.on .tx, .thread:hover .tx { display:block; }
  .thread .tx:hover { color:var(--crimson); }
  .room-toggle .tadd { color:var(--text3); padding:6px 9px; flex:none; }
  #room-chat-pane { display:flex; flex-direction:column; flex:1; min-height:0; }
  #room-term-pane { display:none; flex:1; min-height:0; min-width:0; background:#0d1117; padding:10px 14px; }
  /* flex:1 + min-width:0 matter: as a flex item this would otherwise size to its
     content, and xterm's fit addon would measure a near-zero box and pick cols=2 —
     which renders the session one character per line. */
  #room-term { flex:1; min-width:0; width:100%; height:100%; }
  .xterm .xterm-viewport::-webkit-scrollbar { width:10px; }
</style>
</head>
<body>
<div class="top">
  <span class="seal">影</span>
  <span class="appname">Kage</span>
  <span class="proj" id="proj"></span>
  <div class="seg">
    <button class="on" data-view="room" id="m-room">Room<span class="k">1</span></button>
    <button data-view="inbox" id="m-inbox">Inbox<span class="k">2</span></button>
    <button data-view="runs" id="m-runs">Runs<span class="k">3</span></button>
    <button data-view="board" id="m-board">Board<span class="k">4</span></button>
    <button data-view="memory" id="m-memory">Memory<span class="k">5</span></button>
  </div>
  <button class="iconbtn" id="m-new">New run</button>
  <button class="iconbtn" id="m-theme" title="light / dark / follow the system">◐</button>
  <button class="iconbtn" id="m-settings" title="project settings">⚙</button>
  <span class="bellwrap"><button class="iconbtn" id="m-bell" title="notify when a run needs you">🔔</button><span class="badge" id="bell-badge" style="display:none">0</span></span>
</div>
<div class="notif" id="notif"><div class="nh">Notifications</div><div class="nlist" id="notif-list"></div></div>
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
      <div class="room-scroll"><div class="room-col" id="room-col">
        <div class="primer" id="room-primer">
          <div class="pseal">影</div>
          <p>Tell Kage what should happen. It reads the room, compiles a brief from what this repo has learned, hires an agent in a worktree, and reports back once the kernel — not the agent — has checked the work.</p>
        </div>
        <div id="room-turns"></div>
        <div class="typing" id="room-typing" style="display:none"><span id="room-typing-text">thinking</span><span class="dots"><i></i><i></i><i></i></span></div>
      </div></div>
      <div class="room-composer">
        <div class="room-cwrap">
          <textarea id="room-input" rows="1" placeholder="Message Kage…"></textarea>
          <button class="room-send" id="room-send">Send ⏎</button>
        </div>
        <div class="cbar" id="room-cbar"></div>
        <div class="room-hint">⏎ send · ⇧⏎ newline · dispatch, merges and answers all happen by talking</div>
      </div>
    </div>
    <div id="room-term-pane"><div id="room-term"></div></div>
  </div>
  <div class="view" id="v-inbox">
    <div class="inbox-scroll"><div class="inbox-col">
      <div class="card hand" id="handover" style="display:none"></div>
      <div class="seclabel">Decisions<span class="n" id="dcount"></span></div>
      <div id="inbox-rows"></div>
      <div class="quiet" id="inbox-quiet"></div>
    </div></div>
  </div>
  <div class="view" id="v-runs">
    <div class="runs">
      <div class="list" id="run-list"></div>
      <div class="detail" id="run-detail"></div>
    </div>
  </div>
  <div class="view" id="v-board">
    <div class="board-scroll"><div class="board" id="board-cols"></div></div>
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
      <div class="pbody" id="packet-body"></div>
    </div>
  </div>
</main>
</div>
<div class="status">
  <span class="conn" id="conn" title="live"></span>
  <span id="st-left">connecting…</span>
  <span class="right"><span id="st-counts"></span><span>press ⌘K for commands · N for a new run</span></span>
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
"use strict";
var TOKEN = "__KAGE_TOKEN__";
var state = {
  runs: [], view: "room", roomMode: "chat", selected: null, detail: null, tab: "follow", connected: false,
  room: { turns: [], busy: false }, roomStreaming: [], projects: [], projectDir: "",
  session: "main", sessions: [{ key: "main", title: "Room" }], threadBusy: {},
  memory: null, memType: null,
};

if (navigator.userAgent.indexOf("Electron") >= 0) document.body.classList.add("electron");

function h(tag, cls, text) {
  var el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function ago(iso) {
  var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return Math.floor(s) + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}
function shortBranch(branch) { return branch.replace(/^kage\\//, "⎇ "); }
function api(path, opts) {
  opts = opts || {};
  var headers = { "content-type": "application/json" };
  if (opts.method && opts.method !== "GET") headers.authorization = "Bearer " + TOKEN;
  return fetch(path, {
    method: opts.method || "GET",
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(function (res) { return res.json(); });
}

// --- derived truth (rendered, never re-decided: display_state/ownership come from the kernel)
function glyphFor(run) {
  var s = run.display_state;
  if (s === "ready") return ["✓", "jade"];
  if (s === "blocked") return ["?", "amber"];
  if (s === "failed" || s === "dropped") return ["■", "crimson"];
  if (s === "merged") return ["✓", "dim"];
  if (s === "rejected") return ["✕", "dim"];
  if (s === "running" || s === "verifying" || s === "dispatched") return ["▶", "dim"];
  if (s === "stopped") return ["⏸", "amber"];
  return ["▸", "dim"];
}
function decisionText(run) {
  var s = run.display_state;
  if (s === "ready") return "Merge: " + run.intent;
  if (s === "blocked" && run.waiting_on) return "“" + (run.waiting_on.question || run.waiting_on.detail || run.waiting_on.needs || "waiting on you") + "”";
  if (s === "blocked") return "Waiting on you: " + run.intent;
  if (s === "stopped") return "Stopped — resume or reject: " + run.intent;
  return "Lost, resumable: " + run.intent;
}

// --- inbox
function renderInbox() {
  var rows = document.getElementById("inbox-rows");
  rows.textContent = "";
  var decisions = state.runs.filter(function (r) { return r.ownership === "needs_you"; });
  var quiet = state.runs.filter(function (r) { return r.ownership === "working"; }).length;
  decisions.forEach(function (run) {
    var row = h("div", "qrow");
    var g = glyphFor(run);
    row.appendChild(h("span", "glyph " + g[1], g[0]));
    var mid = h("div");
    mid.appendChild(h("div", "qt", decisionText(run)));
    var atoms = h("div", "qatoms");
    atoms.appendChild(h("span", "atom", run.agent));
    // No branch chip here: a run's branch is its own slugified title, so showing it
    // beside the title repeats the same words in uglier form. It stays in Runs, where
    // you actually need it to find the work in git.
    if (run.display_state === "ready") atoms.appendChild(h("span", "atom jade", "awaiting merge"));
    if (run.stale) atoms.appendChild(h("span", "atom hot", "process gone"));
    if (run.display_state === "failed" && !run.stale) atoms.appendChild(h("span", "atom hot", "checks failed"));
    mid.appendChild(atoms);
    row.appendChild(mid);
    row.appendChild(h("span", "qtime", ago(run.updated_at)));
    row.onclick = function () { openRun(run.id); };
    rows.appendChild(row);
  });
  document.getElementById("dcount").textContent = decisions.length ? String(decisions.length) : "";
  if (!decisions.length) {
    var empty = h("div", "empty");
    if (state.runs.length) empty.textContent = "Nothing needs you.";
    else {
      empty.appendChild(document.createTextNode("Describe what should change — Kage compiles a brief from repo memory, hires an agent in a worktree, and re-runs the checks itself. Press "));
      empty.appendChild(h("span", "kbd", "n"));
      empty.appendChild(document.createTextNode(" to start."));
    }
    rows.appendChild(empty);
  }
  document.getElementById("inbox-quiet").textContent =
    quiet + " working quietly · " + decisions.length + " decision" + (decisions.length === 1 ? "" : "s");
  document.title = decisions.length ? "Kage · " + decisions.length : "Kage";
  if (document.getElementById("notif").classList.contains("on")) renderNotifications();
  var badge = document.getElementById("bell-badge");
  badge.textContent = String(decisions.length);
  badge.style.display = decisions.length ? "flex" : "none";
  var counts = document.getElementById("st-counts");
  counts.textContent = state.runs.length ? quiet + " working · " + decisions.length + " for you" : "";
  renderHandover();
}

function renderHandover() {
  var el = document.getElementById("handover");
  var last = localStorage.getItem("kageLastSeen");
  if (!last) { el.style.display = "none"; localStorage.setItem("kageLastSeen", new Date().toISOString()); return; }
  var since = state.runs.filter(function (r) { return r.updated_at > last; });
  var merged = since.filter(function (r) { return r.display_state === "merged"; }).length;
  var held = since.filter(function (r) { return r.ownership === "needs_you"; }).length;
  var lost = since.filter(function (r) { return r.stale || r.display_state === "failed"; }).length;
  // Nothing to add beyond the cards themselves? Then say nothing.
  if (!merged && !held && !lost) { el.style.display = "none"; return; }
  if (!merged && !held) { el.style.display = "none"; return; }
  el.style.display = "block";
  el.textContent = "";
  var head = h("div", "hhead", "Since you left");
  var dismiss = h("button", "", "mark seen");
  dismiss.onclick = function () { localStorage.setItem("kageLastSeen", new Date().toISOString()); renderInbox(); };
  head.appendChild(dismiss);
  el.appendChild(head);
  function line(ic, cls, tx, atom) {
    var row = h("div", "hrow");
    row.appendChild(h("span", "hic " + cls, ic));
    row.appendChild(h("span", "", tx));
    row.appendChild(h("span", "hatom", atom));
    el.appendChild(row);
  }
  // Only report what is NOT already visible as a decision card below. Repeating
  // "1 lost / 1 held for you" directly above the very rows that say the same thing
  // is noise pretending to be a summary.
  if (merged) line("✓", "jade", merged + " merged, verified", "receipts in Runs");
  if (!merged && !lost) line("·", "dim", held + " arrived while you were away", "below");
}

// --- room: the conversation. askManager's tool names arrive as "mcp__kage__kage_dispatch";
// the trailer strips the MCP prefix so a non-technical reader sees "dispatch", not plumbing.
function toolLabel(name) { return String(name).replace("mcp__kage__kage_", "").replace("mcp__kage__", ""); }
function turnDispatched(turn) {
  return (turn.tools || []).some(function (t) { return t.indexOf("kage_dispatch") >= 0; });
}
// AO spawns a worker tab the moment its orchestrator dispatches one; this is that
// moment for Kage — except we don't force you out of the conversation, we hand you a
// door. Keyed by turn index (not run id) since only the LATEST turn in a fresh
// arrival is trustworthy — after a reload there's no way to know which old turn
// caused which old run.
var roomLinkedRuns = {};

function renderRoom() {
  var scroll = document.querySelector("#v-room .room-scroll");
  var wasAtBottom = scroll && scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
  var turnsEl = document.getElementById("room-turns");
  var turns = state.room.turns || [];
  document.getElementById("room-primer").style.display = turns.length ? "none" : "block";
  turnsEl.textContent = "";
  turns.forEach(function (turn, index) {
    // Close the previous exchange with a rule + elapsed time, so a long thread reads
    // as a sequence of completed turns rather than one undifferentiated column.
    if (turn.role === "you" && index > 0) {
      var prev = turns[index - 1];
      var brk = h("div", "turnbreak");
      brk.appendChild(h("span", "rule"));
      brk.appendChild(h("span", "label", prev.at ? "done · " + ago(prev.at) : "done"));
      turnsEl.appendChild(brk);
    }
    var wrap = h("div", "turn " + turn.role);
    wrap.appendChild(h("div", "bubble2", turn.text));
    if (turn.role === "kage" && turn.tools && turn.tools.length) {
      var used = turn.tools.map(toolLabel);
      var uniq = used.filter(function (t, i) { return used.indexOf(t) === i; });
      var tl = h("div", "toolline");
      tl.appendChild(h("span", "verb", "ran"));
      tl.appendChild(h("span", "", uniq.join(" · ")));
      wrap.appendChild(tl);
    }
    if (turn.role === "kage" && turn.redactions && turn.redactions.length) {
      var meta = h("div", "meta2");
      meta.appendChild(h("span", "redact", "kernel replaced " + turn.redactions.length + " restated number" +
        (turn.redactions.length === 1 ? "" : "s") + " — read the card, not the summary"));
      wrap.appendChild(meta);
    }
    var linked = roomLinkedRuns[index];
    if (linked) {
      var opener = h("div", "opened");
      opener.appendChild(h("span", "arrow", "→"));
      opener.appendChild(document.createTextNode("watch it work: " + linked.intent));
      opener.onclick = function () { openRun(linked.id); };
      wrap.appendChild(opener);
    }
    turnsEl.appendChild(wrap);
  });

  var typingEl = document.getElementById("room-typing");
  var lastDelta = state.roomStreaming.length ? state.roomStreaming[state.roomStreaming.length - 1] : null;
  typingEl.style.display = state.room.busy ? "flex" : "none";
  document.getElementById("room-typing-text").textContent =
    lastDelta ? (lastDelta.kind === "tool" ? toolLabel(lastDelta.text) + "…" : lastDelta.text.slice(0, 60)) : "thinking";

  var sendBtn = document.getElementById("room-send");
  sendBtn.disabled = state.room.busy;

  if (scroll && (wasAtBottom || turns.length <= 2)) scroll.scrollTop = scroll.scrollHeight;
}

function refreshRoom() {
  var prevLen = (state.room.turns || []).length;
  return api("/room?session=" + encodeURIComponent(state.session)).then(function (out) {
    if (!out.ok) return;
    // The server echoes which thread it answered for. A reply that arrives after the
    // user switched tabs belongs to the thread it was asked about, not the visible
    // one — dropping it here is what keeps two conversations from bleeding together.
    if (out.session && out.session !== state.session) return;
    state.sessions = out.sessions || state.sessions;
    renderThreads();
    state.room = { turns: out.turns || [], busy: Boolean(out.busy) };
    if (!out.busy) state.roomStreaming = [];
    var turns = state.room.turns;
    var last = turns[turns.length - 1];
    var justArrived = !out.busy && turns.length > prevLen && last && last.role === "kage";
    if (justArrived && turnDispatched(last)) {
      // The room doesn't know which run its own dispatch created — but it just
      // happened, so the newest run (listRuns sorts newest-first) is it.
      api("/runs").then(function (runsOut) {
        state.runs = runsOut.runs || [];
        if (state.runs.length) {
          roomLinkedRuns[turns.length - 1] = { id: state.runs[0].id, intent: state.runs[0].intent };
          renderRoom();
        }
      });
    }
    renderRoom();
  }).catch(function () {});
}

// An empty view is a teaching moment, not a dead end: name what belongs here, say
// what it is, and offer the key that creates one. "no runs yet" told a new user
// nothing about what a run even is.
function emptyBlock(title, explain, key) {
  var box = h("div", "empty");
  box.appendChild(h("b", null, title));
  box.appendChild(document.createTextNode(explain));
  if (key) {
    box.appendChild(document.createElement("br"));
    var line = h("span");
    line.appendChild(document.createTextNode("Press "));
    line.appendChild(h("kbd", null, key));
    line.appendChild(document.createTextNode(" to start one, or just ask in the Room."));
    box.appendChild(line);
  }
  return box;
}

// --- memory ------------------------------------------------------------------
// The rule this view is built on: OBSERVED numbers lead, the ESTIMATE follows and is
// labelled. Recalls served, stale memories withheld and packets written are counted
// events. Tokens saved is a model. Rendering them in one row of identical figures is
// how a dashboard starts overclaiming, so the estimate sits below a rule, in smaller
// type, with the word "estimated" attached to it.
function loadMemory() {
  api("/memory").then(function (out) {
    if (!out.ok) return;
    state.memory = out;
    renderMemory();
  }).catch(function () {});
}
function num(n) { return (n || 0).toLocaleString(); }
function compact(n) {
  n = n || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return String(n);
}
function renderMemory() {
  var mem = state.memory;
  var hero = document.getElementById("mem-hero");
  var health = document.getElementById("mem-health");
  var list = document.getElementById("mem-list");
  var types = document.getElementById("mem-types");
  if (!hero || !mem) return;

  hero.textContent = "";
  health.textContent = "";
  types.textContent = "";
  list.textContent = "";

  if (mem.empty) {
    // A repo with no memory yet is a NEW repo, not a broken one. Say what will fill it.
    var blank = h("div", "mem-empty");
    blank.appendChild(h("div", null, "Nothing learned yet."));
    blank.appendChild(h("div", null, "Kage writes memory as work happens — a bug's cause, a decision and why, a convention worth keeping. Dispatch a run or talk to Kage in the Room, and this fills itself."));
    hero.appendChild(blank);
    return;
  }

  var card = h("div", "mem-hero");
  card.appendChild(h("div", "eyebrow", mem.value.cold_start ? "This repo's memory" : "What Kage has done here"));
  var figs = h("div", "mem-figs");
  function fig(value, label, sub, tone) {
    var box = h("div", "mem-fig" + (tone ? " " + tone : ""));
    box.appendChild(h("div", "n", value));
    box.appendChild(h("div", "l", label));
    if (sub) box.appendChild(h("div", "sub", sub));
    return box;
  }
  var v = mem.value.observed;
  figs.appendChild(fig(num(v.packets), "memories written", "verified against the repo"));
  figs.appendChild(fig(num(v.recalls), "recalls served", v.recalls ? "answered from memory" : "none yet"));
  if (v.stale_caught) figs.appendChild(fig(num(v.stale_caught), "stale memories caught", "before they misled an agent", "amber"));
  card.appendChild(figs);

  // The estimate, visibly separated and named as an estimate — and only shown once
  // there is one. "~0 tokens saved" is not a modest claim, it is noise.
  if (mem.value.estimated.tokens_saved > 0) {
    var est = h("div", "mem-est");
    est.appendChild(h("span", "n", "~" + compact(mem.value.estimated.tokens_saved)));
    est.appendChild(h("span", "l", "tokens saved — an estimate, from replaying memory instead of re-reading source"));
    card.appendChild(est);
  }
  hero.appendChild(card);

  // An unmeasured metric shows "—", not "0%". Rendering a missing measurement as zero
  // tells the user their memory scored nothing, which is a different and false claim.
  var pct = function (value) { return mem.measured ? value + "%" : "—"; };
  var cnt = function (value) { return mem.measured ? num(value) : "—"; };
  var stats = [
    [num(mem.health.approved), "active", false],
    [mem.measured ? num(mem.health.stale) : "—", "stale", mem.health.stale > 0],
    [pct(mem.health.average_quality), "avg quality", false],
    [pct(mem.health.evidence_coverage_percent), "evidence-backed", false],
    [cnt(mem.health.hot), "used recently", false],
    [cnt(mem.health.never_used), "never recalled", false],
  ];
  stats.forEach(function (row) {
    var stat = h("div", "mem-stat" + (row[2] ? " warn" : ""));
    stat.appendChild(h("div", "n", row[0]));
    stat.appendChild(h("div", "l", row[1]));
    health.appendChild(stat);
  });

  var all = h("button", "mem-chip" + (state.memType ? "" : " on"), "all");
  all.onclick = function () { state.memType = null; renderMemory(); };
  types.appendChild(all);
  mem.by_type.forEach(function (entry) {
    var chip = h("button", "mem-chip" + (state.memType === entry.type ? " on" : ""), entry.type);
    chip.appendChild(h("span", "c", String(entry.count)));
    chip.onclick = function () { state.memType = state.memType === entry.type ? null : entry.type; renderMemory(); };
    types.appendChild(chip);
  });

  var query = (document.getElementById("mem-search").value || "").trim().toLowerCase();
  var shown = mem.packets.filter(function (packet) {
    if (state.memType && packet.type !== state.memType) return false;
    if (!query) return true;
    return (packet.title + " " + packet.summary + " " + packet.tags.join(" ") + " " + packet.paths.join(" "))
      .toLowerCase().indexOf(query) >= 0;
  });
  if (!shown.length) {
    list.appendChild(h("div", "mem-empty", query ? "Nothing matches “" + query + "”." : "No memories of this kind yet."));
    return;
  }
  shown.slice(0, 200).forEach(function (packet) {
    var row = h("div", "mem-row");
    row.appendChild(h("div", "t", packet.title));
    if (packet.summary) row.appendChild(h("div", "s", packet.summary));
    var meta = h("div", "meta");
    meta.appendChild(h("span", "ty", packet.type));
    if (packet.updated_at) meta.appendChild(h("span", null, ago(packet.updated_at) + " ago"));
    if (packet.paths.length) meta.appendChild(h("span", null, packet.paths.length + (packet.paths.length === 1 ? " file" : " files")));
    if (packet.status && packet.status !== "active") meta.appendChild(h("span", "stale", packet.status));
    row.appendChild(meta);
    row.onclick = function () { openPacket(packet.id); };
    list.appendChild(row);
  });
  if (shown.length > 200) {
    list.appendChild(h("div", "mem-empty", "Showing 200 of " + num(shown.length) + " — narrow it with search or a type."));
  }
}
function openPacket(id) {
  var overlay = document.getElementById("packet-overlay");
  document.getElementById("packet-title").textContent = "Loading…";
  document.getElementById("packet-body").textContent = "";
  overlay.classList.add("on");
  api("/memory/" + encodeURIComponent(id)).then(function (out) {
    document.getElementById("packet-title").textContent = out.ok ? out.title : "Not found";
    document.getElementById("packet-body").textContent = out.ok ? out.body : (out.error || "");
  });
}

// --- conversation threads ----------------------------------------------------
// Deliberately "threads", not "workspaces". Kage's parallelism is runs in worktrees;
// these exist only so unrelated conversations don't share one context. Dispatching
// from any thread produces an ordinary run on the same board.
function renderThreads() {
  var wrap = document.getElementById("threads");
  if (!wrap) return;
  wrap.textContent = "";
  var sessions = state.sessions || [];
  // One thread is just "the room" — a lone tab is chrome with nothing to choose.
  if (sessions.length < 2) return;
  sessions.forEach(function (session) {
    var active = session.key === state.session;
    var tab = h("div", "thread" + (active ? " on" : ""));
    tab.title = session.title;
    if (state.threadBusy[session.key] && !active) tab.appendChild(h("span", "tdot"));
    tab.appendChild(h("div", "tname", session.title));
    if (session.key !== "main") {
      var close = h("button", "tx", "×");
      close.title = "close this thread and delete its transcript";
      close.onclick = function (event) {
        event.stopPropagation();
        closeThread(session.key);
      };
      tab.appendChild(close);
    }
    tab.onclick = function () { switchThread(session.key); };
    wrap.appendChild(tab);
  });
}
function switchThread(key) {
  if (key === state.session) return;
  state.session = key;
  // Each thread has its own transcript and its own terminal screen; carrying either
  // across the switch would show one conversation's words under another's name.
  state.room = { turns: [], busy: false };
  state.roomStreaming = [];
  state.threadBusy[key] = false;
  if (term) term.reset();
  renderThreads();
  renderRoom();
  refreshRoom();
  if (state.roomMode === "terminal") primeTerminal();
}
function newThread() {
  api("/room/sessions", { method: "POST", body: {} }).then(function (out) {
    if (!out.ok) return;
    state.sessions = out.sessions || state.sessions;
    switchThread(out.session.key);
    renderThreads();
  });
}
function closeThread(key) {
  api("/room/sessions/close", { method: "POST", body: { session: key } }).then(function (out) {
    if (!out.ok) { flash(out.error || "could not close that thread"); return; }
    state.sessions = out.sessions || [];
    if (state.session === key) switchThread("main");
    else renderThreads();
  });
}

function sendRoomMessage() {
  var input = document.getElementById("room-input");
  var message = input.value.trim();
  if (!message || state.room.busy) return;
  input.value = "";
  autoGrow(input);
  state.room.busy = true;
  state.roomStreaming = [];
  renderRoom();
  api("/room/message?session=" + encodeURIComponent(state.session), { method: "POST", body: { message: message } }).then(function (out) {
    if (!out.ok) { state.room.busy = false; renderRoom(); return; }
    refreshRoom();
  });
}

function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(140, el.scrollHeight) + "px";
}

// --- composer pickers. Every option states what it DOES, not just what it's called:
// "Accept edits — file edits apply without asking; commands still prompt" beats a bare
// label you have to already know. Choices persist per project.
var composerPrefs = { agent: "claude", type: "chore", mode: "acceptEdits" };
try {
  var savedPrefs = JSON.parse(localStorage.getItem("kageComposer") || "{}");
  if (savedPrefs && typeof savedPrefs === "object") {
    composerPrefs.agent = savedPrefs.agent || composerPrefs.agent;
    composerPrefs.type = savedPrefs.type || composerPrefs.type;
    composerPrefs.mode = savedPrefs.mode || composerPrefs.mode;
  }
} catch (e) {}
function savePrefs() { try { localStorage.setItem("kageComposer", JSON.stringify(composerPrefs)); } catch (e) {} }

var PICKERS = [
  { key: "agent", head: "Agent — who does the work",
    opts: [
      { v: "claude", n: "Claude Code", d: "Held live: steerable mid-run, and answers land in the same session." },
      { v: "codex", n: "Codex", d: "Runs per turn with native session resume; no live steering." },
      { v: "stub", n: "Stub", d: "A scripted fake agent. Exercises the whole loop without spending tokens." },
    ] },
  { key: "type", head: "Type — shapes the brief and its checks",
    opts: [
      { v: "chore", n: "Chore", d: "Small, low-risk change." },
      { v: "bugfix", n: "Bug fix", d: "Brief leads with reproduction and the failing check." },
      { v: "feature", n: "Feature", d: "New behaviour; expects tests alongside." },
      { v: "refactor", n: "Refactor", d: "Behaviour must not change — the diff is the risk." },
      { v: "migration", n: "Migration", d: "Data or schema movement; reversibility is called out." },
      { v: "investigation", n: "Investigation", d: "Find and report, no merge expected." },
    ] },
  { key: "mode", head: "Permission — how much it may do unattended",
    opts: [
      { v: "acceptEdits", n: "Accept edits", d: "File edits apply without asking. It works in an isolated worktree, never your tree." },
      { v: "manual", n: "Manual", d: "Prompts before anything it judges dangerous." },
      { v: "plan", n: "Plan only", d: "Reads and plans, executes nothing. Use to scope work before committing to it." },
    ] },
];

function renderComposerBar() {
  var bar = document.getElementById("room-cbar");
  if (!bar) return;
  bar.textContent = "";
  PICKERS.forEach(function (p) {
    var wrap = h("div", "picker");
    var current = p.opts.filter(function (o) { return o.v === composerPrefs[p.key]; })[0] || p.opts[0];
    var btn = h("button", "", current.n + " ⌄");
    btn.onclick = function (ev) {
      ev.stopPropagation();
      var wasOpen = wrap.classList.contains("open");
      Array.prototype.forEach.call(document.querySelectorAll(".picker"), function (el) { el.classList.remove("open"); });
      wrap.classList.toggle("open", !wasOpen);
    };
    wrap.appendChild(btn);
    var menu = h("div", "menu");
    menu.appendChild(h("div", "head", p.head));
    p.opts.forEach(function (o) {
      var opt = h("div", "opt" + (o.v === composerPrefs[p.key] ? " on" : ""));
      opt.appendChild(h("div", "n", o.n));
      opt.appendChild(h("div", "d", o.d));
      opt.onclick = function (ev) {
        ev.stopPropagation();
        composerPrefs[p.key] = o.v;
        savePrefs();
        wrap.classList.remove("open");
        renderComposerBar();
      };
      menu.appendChild(opt);
    });
    wrap.appendChild(menu);
    bar.appendChild(wrap);
  });
}
document.addEventListener("click", function () {
  Array.prototype.forEach.call(document.querySelectorAll(".picker"), function (el) { el.classList.remove("open"); });
});

// --- terminal: a REAL pty running interactive claude, unmodified — Kage's own
// wrapper (Chat) is a deliberate choice for structured runs/receipts, not a limit.
// AO ships both modes side by side; so do we.
var term = null;
var fitAddon = null;

function sendResize() {
  if (!term) return;
  api("/room/pty/resize?session=" + encodeURIComponent(state.session), { method: "POST", body: { cols: term.cols, rows: term.rows } });
}

/**
 * Fit, tell the pty its new size, then force a repaint — on a LATER task, not inline.
 *
 * xterm can leave a correct buffer unpainted when the terminal is opened, written to,
 * and resized in the same burst as its container becoming visible. Refreshing inside
 * that burst does not stick (verified: buffer held the banner, screen stayed blank);
 * refreshing once things settle does. A blank pane over a healthy session is the
 * single most misleading state this feature can be in, so this is worth the timeout.
 */
function repaintTerminal() {
  if (!term) return;
  // A ladder, not a single shot. A repaint issued while xterm is still initializing
  // its renderer (right after open() + the first write + a resize, all in one burst)
  // is silently a no-op — verified: the buffer held the full banner, the screen stayed
  // blank, and the identical call from a later task painted it immediately. Repainting
  // again as things settle costs nothing and removes the single most misleading state
  // this feature can show: an empty pane attached to a perfectly healthy session.
  [60, 250, 600].forEach(function (delay) {
    setTimeout(function () {
      if (!term) return;
      if (fitAddon) fitAddon.fit();
      sendResize();
      term.refresh(0, term.rows - 1);
    }, delay);
  });
}

function ensureTerminal() {
  if (term) return;
  if (!window.Terminal || !window.FitAddon) {
    document.getElementById("room-term").textContent = "Terminal assets failed to load — check /vendor/xterm.js.";
    return;
  }
  term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    theme: { background: "#0d1117", foreground: "#e6e6e3", cursor: "#e6e6e3" },
    convertEol: true,
  });
  fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(document.getElementById("room-term"));
  fitAddon.fit();
  term.onData(function (data) {
    api("/room/pty/write?session=" + encodeURIComponent(state.session), { method: "POST", body: { data: data } });
  });
  primeTerminal();
}

// Snapshot: this starts the pty if needed AND returns whatever is already on the
// terminal's screen. Without painting that, a tab opened after the session began shows
// an empty pane connected to a perfectly healthy claude — the exact symptom that made
// this feature look broken for a long time. Switching threads needs the same thing,
// against a different session, which is why it lives in its own function.
function primeTerminal() {
  var asked = state.session;
  api("/room/pty/snapshot?session=" + encodeURIComponent(asked)).then(function (out) {
    // A snapshot that lands after another switch belongs to the thread it was asked
    // for — painting it now would show the wrong terminal's screen.
    if (asked !== state.session) return;
    if (out && out.scrollback && term) term.write(out.scrollback);
    repaintTerminal();
  });
}

function setRoomMode(mode) {
  state.roomMode = mode;
  document.getElementById("rm-chat").classList.toggle("on", mode === "chat");
  document.getElementById("rm-terminal").classList.toggle("on", mode === "terminal");
  document.getElementById("room-chat-pane").style.display = mode === "chat" ? "flex" : "none";
  document.getElementById("room-term-pane").style.display = mode === "terminal" ? "flex" : "none";
  if (mode === "terminal") {
    // Create AFTER the pane is displayed and laid out: xterm measures its container
    // at open()/fit() time, so building it while the pane is still display:none gives
    // a ~zero-width box and cols=2, rendering the session one character per line.
    //
    // setTimeout, NOT requestAnimationFrame, even though rAF is the usual tool for
    // "after layout": browsers do not fire rAF for a page that isn't being painted
    // (a background tab, a hidden window, some embedded webviews), so an rAF-gated
    // creation means the terminal silently never exists for those users. A macrotask
    // still lands after the style/layout flush from the display change above, and it
    // always runs. (Measured in a non-compositing preview browser: rAF fired 0 times
    // in 3s while setTimeout fired 13.)
    setTimeout(function () {
      ensureTerminal();
      // Repaint on every switch back into Terminal, not just on creation: the pane was
      // display:none while hidden, so xterm may have skipped paints for whatever
      // streamed in meanwhile.
      repaintTerminal();
      if (term) term.focus();
    }, 0);
  }
}
document.getElementById("rm-chat").onclick = function () { setRoomMode("chat"); };
document.getElementById("rm-terminal").onclick = function () { setRoomMode("terminal"); };
window.addEventListener("resize", function () {
  if (state.view === "room" && state.roomMode === "terminal" && fitAddon) {
    fitAddon.fit();
    sendResize();
  }
});

// --- runs
function renderRunList() {
  var list = document.getElementById("run-list");
  list.textContent = "";
  var groups = [
    ["Needs you", function (r) { return r.ownership === "needs_you"; }, "amber"],
    ["Working", function (r) { return r.ownership === "working"; }, "grey"],
    ["Done", function (r) { return r.ownership === "done"; }, "jade"],
  ];
  groups.forEach(function (spec) {
    var members = state.runs.filter(spec[1]);
    if (!members.length) return;
    var head = h("div", "lgroup", spec[0]);
    head.appendChild(h("em", "", String(members.length)));
    list.appendChild(head);
    members.forEach(function (run) {
      var row = h("div", "ws" + (run.ownership === "needs_you" ? " attn" : "") + (state.selected === run.id ? " sel" : ""));
      var mid = h("div");
      mid.appendChild(h("div", "t", run.intent));
      var metaText = run.activity
        ? run.activity.last_label + " · " + run.activity.actions + " actions"
        : run.display_state + " · " + ago(run.updated_at);
      mid.appendChild(h("div", "meta", metaText));
      row.appendChild(mid);
      row.appendChild(h("span", "dot " + spec[2]));
      row.onclick = function () { openRun(run.id); };
      list.appendChild(row);
    });
  });
  if (!state.runs.length) list.appendChild(emptyBlock(
    "No runs yet",
    "A run is one delegated job: Kage briefs an agent from repo memory, it works in its own worktree, and the kernel re-runs your checks before you see a result.",
    "n"));
}

// The receipt, composed from the claim's STRUCTURED fields.
//
// This previously re-rendered renderClaimCard()'s output — a string formatted for a
// TERMINAL — inside the GUI, which is exactly why it read as a log dump: box-drawing
// glyphs, and absolute evidence paths wrapping mid-path across three lines. The same
// facts are already available as data (checks[], diff, unsure, learnings), so the GUI
// composes its own presentation and the CLI keeps its own. One source of truth, two
// honest renderings — instead of one rendering pretending to work in both places.
function renderReceipt(body, claim, run, verdict) {
  var checks = claim.checks || [];
  var passed = checks.filter(function (c) { return c.result === "pass"; });
  // The verdict comes from the KERNEL (claimVerdict, computed where the checks ran).
  // Re-deriving it here once produced a green "VERIFIED" for a run the kernel had
  // already failed — a surface inventing a fact, which is the precise failure this
  // product exists to prevent. Only fall back to a local guess if the API is older
  // than this field, and be pessimistic when doing so.
  var label = verdict && verdict.label ? verdict.label : (passed.length === checks.length && checks.length ? "VERIFIED" : "NOT VERIFIED");
  var cls = label.indexOf("UNVERIFIED") >= 0 ? "warn" : label.indexOf("NOT") >= 0 ? "bad" : "";

  var head = h("div", "verdict-head");
  var stamp = h("div", "stamp " + cls);
  stamp.appendChild(h("span", "", label));
  // The kernel's label may already carry its own count ("NOT VERIFIED 2/3"); appending
  // ours as well printed "2/3 2/3". Only add the count when the label lacks one.
  if (checks.length && !/\\d+\\s*\\/\\s*\\d+/.test(label)) {
    stamp.appendChild(h("span", "count", passed.length + "/" + checks.length));
  }
  head.appendChild(stamp);
  head.appendChild(h("span", "verdict-sub", "re-run by Kage, not reported by the agent"));
  body.appendChild(head);

  if (claim.statement) body.appendChild(h("div", "claim-statement", claim.statement));

  if (checks.length) {
    var list = h("div", "checks");
    checks.forEach(function (c) {
      var state = c.result === "pass" ? "pass" : c.result === "fail" ? "fail" : "skip";
      var row = h("div", "check " + state);
      row.appendChild(h("span", "mark", state === "pass" ? "✓" : state === "fail" ? "✕" : "?"));
      row.appendChild(h("span", "name", c.id));
      row.appendChild(h("span", "detail", state === "skip" ? "could not run here — not counted as passing" : (c.cmd || c.expect || "")));
      row.appendChild(h("span", "ev", c.exit_code === undefined || c.exit_code === null ? "" : "exit " + c.exit_code));
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  if (claim.diff) {
    var budget = run && run.budgets ? "  ·  budget " + run.budgets.diff_lines : "";
    body.appendChild(h("div", "seclabel-sm", "Change"));
    var d = h("div", "note-row");
    d.appendChild(h("span", "ic", "±"));
    d.appendChild(h("span", "", claim.diff.files + " file" + (claim.diff.files === 1 ? "" : "s") + "  ·  " +
      claim.diff.lines + " line" + (claim.diff.lines === 1 ? "" : "s") + budget));
    body.appendChild(d);
  }

  if ((claim.unsure || []).length) {
    body.appendChild(h("div", "seclabel-sm", "The agent flagged"));
    claim.unsure.forEach(function (u) {
      var row = h("div", "note-row unsure");
      row.appendChild(h("span", "ic", "⚠"));
      row.appendChild(h("span", "", u));
      body.appendChild(row);
    });
  }

  if ((claim.learnings || []).length) {
    body.appendChild(h("div", "seclabel-sm", "Learns on merge"));
    claim.learnings.forEach(function (l) {
      var row = h("div", "note-row learn");
      row.appendChild(h("span", "ic", "+"));
      row.appendChild(h("span", "", l));
      body.appendChild(row);
    });
  }
}

function renderDetail() {
  var el = document.getElementById("run-detail");
  el.textContent = "";
  if (!state.detail) {
    el.appendChild(state.runs.length
      ? emptyBlock("Nothing selected", "Pick a run on the left to follow its progress, read its receipt, or review the diff.", null)
      : emptyBlock("Nothing to review yet", "Dispatch a run and its progress, receipt and diff all land here.", "n"));
    return;
  }
  var d = state.detail;
  var run = d.run;

  var head = h("div", "dhead");
  head.appendChild(h("h2", "", run.intent));
  var chips = h("div", "chips");
  chips.appendChild(h("span", "chip state-" + run.display_state, run.display_state));
  chips.appendChild(h("span", "chip", shortBranch(run.branch)));
  chips.appendChild(h("span", "chip", run.agent));
  if (run.confidence) chips.appendChild(h("span", "chip", "confidence " + run.confidence.band));
  head.appendChild(chips);
  var tabs = h("div", "tabs");
  [["follow", "Follow"], ["receipt", "Receipt"], ["diff", "Diff"], ["brief", "Brief"], ["raw", "Raw"]].forEach(function (t) {
    var b = h("button", "tab" + (state.tab === t[0] ? " on" : ""), t[1]);
    b.onclick = function () { state.tab = t[0]; loadTabText(run.id); renderDetail(); };
    tabs.appendChild(b);
  });
  head.appendChild(tabs);
  el.appendChild(head);

  var scroll = h("div", "dbody");
  var body = h("div", "dcol");
  scroll.appendChild(body);
  if (state.tab === "receipt") {
    // Prefer the structured claim; d.receipt (the CLI's text card) is only a fallback
    // for a run whose claim.json could not be parsed.
    if (d.claim) renderReceipt(body, d.claim, run, d.verdict);
    else if (d.receipt) body.appendChild(h("div", "rawpane", d.receipt));
    else body.appendChild(h("div", "empty", "No claim yet — the receipt appears when the run finishes."));
  } else if (state.tab === "brief") {
    var briefPane = h("div", "rawpane", d.brief || "no brief recorded");
    body.appendChild(briefPane);
  } else if (state.tab === "diff") {
    if (d.diffText === undefined) body.appendChild(h("div", "empty", "loading diff…"));
    else if (!d.diffText || d.diffText === "no changes yet") body.appendChild(h("div", "empty", "No changes yet."));
    else {
      var pane = h("div", "codepane");
      d.diffText.split("\\n").forEach(function (line) {
        var cls = "dline";
        if (line.indexOf("+++") === 0 || line.indexOf("---") === 0 || line.indexOf("diff --git") === 0 || line.indexOf("#") === 0) cls += " file";
        else if (line.indexOf("@@") === 0) cls += " hunk";
        else if (line.indexOf("+") === 0) cls += " add";
        else if (line.indexOf("-") === 0) cls += " del";
        pane.appendChild(h("div", cls, line || " "));
      });
      body.appendChild(pane);
    }
  } else if (state.tab === "raw") {
    if (d.rawText === undefined) body.appendChild(h("div", "empty", "loading transcript…"));
    else body.appendChild(h("div", "rawpane", d.rawText));
  } else {
    if (run.activity) {
      var act = h("div", "activityline");
      act.appendChild(h("span", "pulse", "●"));
      act.appendChild(h("span", "", run.activity.last_label + " · " + run.activity.actions + " actions"));
      body.appendChild(act);
    }
    if (run.waiting_on) {
      var q = h("div", "qbanner");
      q.appendChild(h("span", "amber", "?"));
      q.appendChild(h("span", "", run.waiting_on.question || run.waiting_on.detail || "waiting on you"));
      body.appendChild(q);
    }
    var events = (d.events && d.events.events ? d.events.events : []).filter(function (e) { return e.run_id === run.id; });
    if (d.rawText === undefined) body.appendChild(h("div", "empty", "loading…"));
    else if (!events.length && !d.rawText.trim()) body.appendChild(h("div", "empty", "Nothing yet — the conversation appears as the agent works."));
    else {
      var isLive = ["running", "dispatched", "verifying"].indexOf(run.display_state) >= 0;
      renderConversation(body, d.rawText === "no transcript yet" ? "" : d.rawText, events, isLive);
    }
  }
  el.appendChild(scroll);

  var composer = h("div", "composer");
  var cwrap = h("div", "cwrap");
  cwrap.appendChild(h("span", "caret", "›"));
  var input = h("input");
  input.placeholder = "Message the agent…";
  input.onkeydown = function (ev) {
    if (ev.key !== "Enter" || !input.value.trim()) return;
    var message = input.value.trim();
    input.value = "";
    api("/runs/" + run.id + "/tell", { method: "POST", body: { message: message } }).then(function (out) {
      flash(out.ok ? "delivery: " + out.delivery : (out.error || "failed"));
      refresh();
    });
  };
  cwrap.appendChild(input);
  cwrap.appendChild(h("span", "hint", "⏎ send · delivery reported honestly"));
  composer.appendChild(cwrap);
  el.appendChild(composer);

  var bar = h("div", "actionbar");
  if (run.display_state === "ready") {
    var merge = h("button", "btn primary", "Merge & ratify");
    merge.onclick = function () {
      api("/runs/" + run.id + "/merge", { method: "POST" }).then(function (out) { flash(out.detail || ""); refresh(); });
    };
    bar.appendChild(merge);
  }
  if (["running", "dispatched", "verifying"].indexOf(run.display_state) >= 0) {
    var stop = h("button", "btn", "Stop");
    stop.onclick = function () {
      api("/runs/" + run.id + "/stop", { method: "POST" }).then(function (out) { flash(out.detail || ""); refresh(); });
    };
    bar.appendChild(stop);
  }
  if (["merged", "rejected"].indexOf(run.display_state) < 0) {
    var reject = h("button", "btn danger", "Reject…");
    reject.onclick = function () {
      var reason = window.prompt("Why? The reason is kept as memory — the next brief carries it.");
      if (!reason) return;
      api("/runs/" + run.id + "/reject", { method: "POST", body: { reason: reason } }).then(function (out) { flash(out.detail || ""); refresh(); });
    };
    bar.appendChild(reject);
  }
  var fl = h("span", "flash");
  fl.id = "flash";
  bar.appendChild(fl);
  el.appendChild(bar);
}

function flash(text) {
  var el = document.getElementById("flash");
  if (el) { el.textContent = text; el.title = text; }
}

// --- board
function renderBoard() {
  var el = document.getElementById("board-cols");
  el.textContent = "";
  // Compound columns with split counts, AO's pattern: pairing related states keeps a
  // terminal state visible without spending a whole column on it. It also fixes a real
  // hole — merged runs used to vanish from the board entirely, so the one outcome you
  // most want confirmed had nowhere to appear.
  var cols = [
    { hint: "Briefed and waiting, or working right now.", parts: [["Idle", "var(--text3)", function (r) { return r.display_state === "briefed" || r.display_state === "draft"; }],
              ["Working", "var(--jade)", function (r) { return r.display_state === "running" || r.display_state === "dispatched" || r.display_state === "verifying"; }]] },
    { hint: "An agent stopped to ask you something.", parts: [["Needs you", "var(--amber)", function (r) { return r.display_state === "blocked"; }]] },
    { hint: "Runs that failed, were stopped, or lost their process.", parts: [["Lost", "var(--crimson)", function (r) { return r.display_state === "failed" || r.display_state === "dropped" || r.display_state === "stopped"; }]] },
    { hint: "Work the kernel checked and you have not merged yet.", parts: [["Ready", "var(--jade)", function (r) { return r.display_state === "ready"; }],
              ["Merged", "var(--text3)", function (r) { return r.display_state === "merged"; }]] },
  ];
  cols.forEach(function (spec) {
    var col = h("div", "bcol");
    var head = h("div", "bh");
    var members = [];
    spec.parts.forEach(function (part, i) {
      if (i) head.appendChild(h("span", "sep", "/"));
      var dot = h("i");
      dot.style.background = part[1];
      head.appendChild(dot);
      head.appendChild(document.createTextNode(part[0]));
      members = members.concat(state.runs.filter(part[2]));
    });
    var counts = spec.parts.map(function (part) { return state.runs.filter(part[2]).length; });
    head.appendChild(h("span", "n", counts.join(" / ")));
    col.appendChild(head);
    // An empty column should say what lands here, so the board teaches its own
    // vocabulary instead of showing four zeroes.
    if (!members.length) col.appendChild(h("div", "bempty", spec.hint));
    members.forEach(function (run) {
      var card = h("div", "acard");
      card.appendChild(h("span", "av " + run.agent, run.agent.slice(0, 2)));
      var mid = h("div");
      mid.appendChild(h("div", "at", run.intent));
      mid.appendChild(h("div", "abr", shortBranch(run.branch)));
      var arow = h("div", "arow");
      if (run.display_state === "ready") arow.appendChild(h("span", "atom jade", "awaiting merge"));
      else if (run.display_state === "blocked") arow.appendChild(h("span", "atom amber", "? waiting"));
      else if (run.stale || run.display_state === "failed") arow.appendChild(h("span", "atom hot", "resumable"));
      else if (run.activity) arow.appendChild(h("span", "atom", run.activity.last_label));
      arow.appendChild(h("span", "tm", ago(run.updated_at)));
      mid.appendChild(arow);
      card.appendChild(mid);
      card.onclick = function () { openRun(run.id); };
      col.appendChild(card);
    });
    el.appendChild(col);
  });
}

// --- navigation + data
function setView(name) {
  state.view = name;
  ["room", "inbox", "runs", "board", "memory"].forEach(function (v) {
    document.getElementById("v-" + v).classList.toggle("on", v === name);
    document.getElementById("m-" + v).classList.toggle("on", v === name);
  });
  render();
  if (name === "room") {
    setTimeout(function () {
      if (state.roomMode === "terminal") {
        if (fitAddon) fitAddon.fit();
        sendResize();
        if (term) term.focus();
      } else {
        document.getElementById("room-input").focus();
      }
    }, 0);
  }
}
// --- the projects rail -------------------------------------------------------
// The registry is a list of directories, nothing more. Live counts appear on the
// CURRENT project only, because its daemon is the one answering us; a badge on any
// other row would be the app asserting state it never asked a kernel for.
function loadProjects() {
  api("/projects").then(function (out) {
    if (!out.ok) return;
    state.projects = out.projects || [];
    state.projectDir = out.current || state.projectDir;
    renderProjects();
  }).catch(function () {});
}
function renderProjects() {
  var list = document.getElementById("plist");
  if (!list) return;
  list.textContent = "";
  // "needs_you" is the kernel's own word (Ownership = working | needs_you | done).
  var needs = state.runs.filter(function (r) { return r.ownership === "needs_you"; }).length;
  (state.projects || []).forEach(function (project) {
    var current = project.dir === state.projectDir;
    var row = h("div", "prow" + (current ? " on" : ""));
    row.title = project.dir;
    row.appendChild(h("div", "pn", project.name));
    if (current && needs) row.appendChild(h("span", "pcount", String(needs)));
    else if (!current) {
      var forget = h("button", "pforget", "×");
      forget.title = "remove from this list (the repo is untouched)";
      forget.onclick = function (event) {
        event.stopPropagation();
        api("/projects/forget", { method: "POST", body: { dir: project.dir } }).then(function (out) {
          if (out.ok) { state.projects = out.projects || []; renderProjects(); }
        });
      };
      row.appendChild(forget);
    }
    row.appendChild(h("div", "pp", project.dir.replace(/^\\/Users\\/[^/]+/, "~")));
    if (!current) row.onclick = function () { openProject(project.dir, row); };
    list.appendChild(row);
  });
  var foot = document.getElementById("sidefoot");
  if (foot) {
    foot.textContent = "";
    var open = state.runs.filter(function (r) {
      return ["merged", "rejected", "dropped"].indexOf(r.display_state) < 0;
    }).length;
    var label = h("span", null, open === 1 ? "1 open run" : open + " open runs");
    foot.appendChild(label);
    if (needs) { foot.appendChild(document.createTextNode(" · ")); foot.appendChild(h("b", null, needs + " need you")); }
  }
}
function openProject(dir, row) {
  // Kage stays one-daemon-per-project: switching means starting (or finding) that
  // project's own daemon and going there, never retargeting this one out from under
  // its live runs. A cold start takes seconds, so the row says what it is doing.
  if (row) { row.classList.add("on"); var name = row.querySelector(".pn"); if (name) name.textContent = "starting…"; }
  api("/projects/open", { method: "POST", body: { dir: dir } }).then(function (out) {
    if (out.ok && out.url) { window.location.href = out.url; return; }
    renderProjects();
    flash(out.error || "could not open that project");
  }).catch(function () { renderProjects(); flash("could not open that project"); });
}
function addProject() {
  var dir = window.prompt("Path to a git repo:", state.projectDir || "");
  if (dir) openProject(dir.trim(), null);
}

function render() {
  renderRoom();
  renderInbox();
  renderRunList();
  renderDetail();
  renderBoard();
  renderProjects();
}
function refresh() {
  return api("/runs").then(function (out) {
    state.runs = out.runs || [];
    maybeNotify();
    if (state.selected) {
      return api("/runs/" + state.selected).then(function (detail) {
        state.detail = detail.ok ? detail : null;
        var inFlight = state.detail && ["running", "dispatched", "verifying"].indexOf(state.detail.run.display_state) >= 0;
        if (inFlight) {
          // A live run's Follow/Diff/Raw panes must stay live: drop the cache so
          // loadTabText re-fetches instead of showing what the agent did a while ago.
          delete state.detail.rawText;
          delete state.detail.diffText;
        }
        render();
        loadTabText(state.selected);
      });
    }
    render();
  }).catch(function () {});
}
function openRun(id) {
  state.selected = id;
  state.tab = "follow";
  setView("runs");
  api("/runs/" + id).then(function (detail) {
    state.detail = detail.ok ? detail : null;
    render();
    loadTabText(id);
  });
}

// Diff and raw are plain-text routes, fetched lazily per tab and cached on the detail.
function loadTabText(runId) {
  if (!state.detail) return;
  var tab = state.tab;
  if (tab !== "diff" && tab !== "raw" && tab !== "follow") return;
  var route = tab === "diff" ? "diff" : "raw";
  var key = tab === "diff" ? "diffText" : "rawText";
  if (state.detail[key] !== undefined) return;
  fetch("/runs/" + runId + "/" + route).then(function (res) { return res.text(); }).then(function (text) {
    if (state.detail && state.selected === runId) {
      state.detail[key] = text;
      renderDetail();
    }
  });
}

// The transcript as a conversation. The adapters journal every stream event to
// transcript.jsonl and the runs watcher fires an SSE event on each write, so this
// pane is live while an agent works — the agent-IDE feel without embedding a PTY:
// prose reads as prose, tool use reads as activity, and the raw tab stays raw.
// Tool labels arrive pre-formatted as "<verb> <target>" (progress.ts's toolVerb table:
// reading/editing/writing/running/searching/listing/delegating/fetching/planning). Map
// the verb to a small glyph so a run reads like a session, not a log — this is the
// worker's equivalent of the room's chat bubbles, the actual "what is it doing" view.
function toolGlyph(label) {
  var l = String(label || "");
  if (l.indexOf("editing") === 0 || l.indexOf("writing") === 0) return ["✎", "edit"];
  if (l.indexOf("running") === 0) return ["▶", "run"];
  if (l.indexOf("planning") === 0) return ["☰", "plan"];
  return ["⌕", "read"];
}

function renderConversation(body, rawText, ledgerEvents, isLive) {
  var entries = [];
  rawText.split("\\n").forEach(function (line) {
    if (!line.trim()) return;
    var e;
    try { e = JSON.parse(line); } catch (err) { return; }
    entries.push(e);
  });
  ledgerEvents.forEach(function (e) { entries.push({ kind: "_ledger", at: e.at, label: e.kind === "state" && e.to ? e.from + " → " + e.to : e.kind, note: e.note || e.message }); });
  entries.sort(function (a, b) { return String(a.at || "").localeCompare(String(b.at || "")); });
  var shown = entries.slice(-160);
  shown.forEach(function (e, i) {
    if (e.kind === "_ledger") {
      var lrow = h("div", "ev");
      lrow.appendChild(h("span", "lifecycle", e.label + (e.note ? "  ·  " + e.note : "")));
      lrow.appendChild(h("span", "ts", (e.at || "").slice(11, 19)));
      body.appendChild(lrow);
      return;
    }
    if (e.kind === "tool") {
      var g = toolGlyph(e.label);
      var trow = h("div", "toolcard");
      trow.appendChild(h("span", "ic " + g[1], g[0]));
      trow.appendChild(h("span", "lbl", e.label || "working"));
      trow.appendChild(h("span", "ts", (e.at || "").slice(11, 19)));
      body.appendChild(trow);
      return;
    }
    if (e.kind === "say" || e.kind === "final") {
      var text = e.kind === "final" ? String(e.message || "").split("\\n\\n")[0] : (e.label || "");
      if (!text.trim()) return;
      var srow = h("div", "said");
      srow.appendChild(h("div", "who", "agent"));
      srow.appendChild(h("div", "bubble", text));
      body.appendChild(srow);
      return;
    }
    if (e.kind === "start") {
      var brow = h("div", "ev");
      brow.appendChild(h("span", "lifecycle", "▶ " + (e.adapter || "agent") + " started"));
      brow.appendChild(h("span", "ts", (e.at || "").slice(11, 19)));
      body.appendChild(brow);
    }
  });
  if (isLive) {
    var live = h("div", "ev");
    live.appendChild(h("span", "ts", ""));
    var liveLine = h("span");
    liveLine.appendChild(h("span", "livepulse"));
    liveLine.appendChild(document.createTextNode("watching live — updates as the agent works"));
    live.appendChild(liveLine);
    body.appendChild(live);
  }
}

// --- notifications: only a run that newly needs you earns one, and never while
// the app is both visible and focused (the design's suppression law).
var prevOwnership = {};
function maybeNotify() {
  var granted = window.Notification && Notification.permission === "granted";
  state.runs.forEach(function (run) {
    var was = prevOwnership[run.id];
    if (was && was !== "needs_you" && run.ownership === "needs_you" && granted) {
      if (!(document.hasFocus() && document.visibilityState === "visible")) {
        var note = new Notification("Kage — needs you", { body: run.intent, tag: run.id });
        note.onclick = function () { window.focus(); openRun(run.id); };
      }
    }
    prevOwnership[run.id] = run.ownership;
  });
}
function bellLabel() {
  var el = document.getElementById("m-bell");
  if (!window.Notification) { el.style.display = "none"; return; }
  el.textContent = Notification.permission === "granted" ? "🔔" : "🔕";
  el.title = Notification.permission === "granted" ? "notifications on" : "click to enable notifications";
}

// --- theme: three states, because "follow the system" is a real choice and not the
// absence of one. Explicit picks are stamped on :root so they beat the media query
// in BOTH directions; "system" removes the attribute and lets the OS decide again.
function applyTheme(mode) {
  if (mode === "light" || mode === "dark") document.documentElement.setAttribute("data-theme", mode);
  else document.documentElement.removeAttribute("data-theme");
  var btn = document.getElementById("m-theme");
  btn.textContent = mode === "light" ? "☀" : mode === "dark" ? "☾" : "◐";
  btn.title = "theme: " + mode + " (click to cycle)";
  try { localStorage.setItem("kageTheme", mode); } catch (e) {}
}
document.getElementById("m-theme").onclick = function () {
  var order = ["system", "light", "dark"];
  var current = "system";
  try { current = localStorage.getItem("kageTheme") || "system"; } catch (e) {}
  applyTheme(order[(order.indexOf(current) + 1) % order.length]);
};
document.getElementById("m-bell").onclick = function (ev) {
  ev.stopPropagation();
  // First click also asks for OS permission — after that the bell is purely the
  // in-app center, so the two never fight over the same gesture.
  if (window.Notification && Notification.permission === "default") Notification.requestPermission().then(bellLabel);
  var el = document.getElementById("notif");
  var opening = !el.classList.contains("on");
  el.classList.toggle("on", opening);
  if (opening) renderNotifications();
};
document.addEventListener("click", function () { document.getElementById("notif").classList.remove("on"); });

// The in-app notification center. Kage already knows everything needed for this —
// which runs need a human, the question they are blocked on, how long they have
// waited — and used to surface none of it anywhere except a dock badge.
function renderNotifications() {
  var list = document.getElementById("notif-list");
  list.textContent = "";
  var items = state.runs.filter(function (r) { return r.ownership === "needs_you"; });
  if (!items.length) { list.appendChild(h("div", "none", "Nothing needs you.")); return; }
  items.forEach(function (run) {
    var g = glyphFor(run);
    var row = h("div", "nrow");
    row.appendChild(h("span", "ic " + g[1], g[0]));
    var mid = h("div");
    var headline = run.display_state === "blocked" ? "Waiting on your answer"
      : run.display_state === "ready" ? "Ready to merge"
      : run.stale ? "Lost — resumable" : "Needs you";
    mid.appendChild(h("div", "t", headline));
    var detail = run.waiting_on && (run.waiting_on.question || run.waiting_on.detail)
      ? (run.waiting_on.question || run.waiting_on.detail) : run.intent;
    mid.appendChild(h("div", "s", detail));
    row.appendChild(mid);
    row.appendChild(h("span", "when", ago(run.updated_at)));
    row.onclick = function () {
      document.getElementById("notif").classList.remove("on");
      openRun(run.id);
    };
    list.appendChild(row);
  });
}

// --- dispatch modal
function showOverlay(on) {
  document.getElementById("overlay").classList.toggle("on", on);
  if (on) document.getElementById("intent").focus();
}
document.getElementById("m-new").onclick = function () { showOverlay(true); };
document.getElementById("dispatch-cancel").onclick = function () { showOverlay(false); };
document.getElementById("dispatch-go").onclick = dispatchNow;
function dispatchNow() {
  var intent = document.getElementById("intent").value.trim();
  if (!intent) return;
  var body = {
    intent: intent,
    agent: document.getElementById("agent").value || composerPrefs.agent,
    type: document.getElementById("rtype").value || composerPrefs.type,
  };
  document.getElementById("dispatch-flash").textContent = "compiling brief…";
  api("/runs", { method: "POST", body: body }).then(function (out) {
    document.getElementById("dispatch-flash").textContent = out.ok ? "dispatched" : (out.error || "failed");
    if (out.ok) {
      document.getElementById("intent").value = "";
      showOverlay(false);
      refresh().then(function () { if (out.run) openRun(out.run.id); });
    }
  });
}

var roomInput = document.getElementById("room-input");
roomInput.addEventListener("input", function () { autoGrow(roomInput); });
roomInput.addEventListener("keydown", function (ev) {
  if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); sendRoomMessage(); }
});
document.getElementById("room-send").onclick = sendRoomMessage;

// --- settings. Every field here edits the SAME .agent_memory/config.json the CLI and
// kernel already read, so the app and the command line can never disagree about what
// a repo is configured to do. Each row carries a one-line description — AO's mode
// picker does this and it turns a cryptic knob into something self-teaching.
var settingsState = null;
function renderSettings() {
  var body = document.getElementById("settings-body");
  body.textContent = "";
  if (!settingsState) { body.appendChild(h("div", "empty", "loading…")); return; }
  var s = settingsState.settings;
  var d = settingsState.defaults;

  function row(label, desc, control) {
    var r = h("div", "srow");
    var left = h("div");
    left.appendChild(h("div", "label", label));
    left.appendChild(h("div", "desc", desc));
    r.appendChild(left);
    r.appendChild(control);
    body.appendChild(r);
  }
  function text(value, placeholder, onInput) {
    var i = document.createElement("input");
    i.type = "text";
    i.value = value == null ? "" : String(value);
    i.placeholder = placeholder || "";
    i.oninput = function () { onInput(i.value); };
    return i;
  }
  function num(value, onInput) {
    var i = document.createElement("input");
    i.type = "number";
    i.value = String(value);
    i.min = "1";
    i.oninput = function () { onInput(i.value); };
    return i;
  }
  function toggle(on, onChange) {
    var b = h("button", "toggle" + (on ? " on" : ""));
    b.appendChild(h("i"));
    b.onclick = function () { onChange(!b.classList.contains("on")); renderSettings(); };
    return b;
  }

  row("Test command", "The backbone check of every brief. Kage runs this itself — the agent's word is never the verdict.",
    text(s.test, "npm test", function (v) { s.test = v; }));
  row("Setup command", "Run once in each fresh worktree before the agent starts (e.g. npm install).",
    text(s.setup, "npm install", function (v) { s.setup = v; }));
  row("Diff budget", "A claim changing more lines than this is refused as too large to review well. Default " + d.diff_budget + ".",
    num(s.diff_budget, function (v) { s.diff_budget = v; }));
  row("Max concurrent runs", "How many runs may be in flight at once. Enforced in the kernel, so every surface obeys. Default " + d.max_concurrent + ".",
    num(s.max_concurrent, function (v) { s.max_concurrent = v; }));
  row("Strict verification", "Any non-passing check blocks a run from reaching ready. Turning this off lets unverified work look finished — honesty over convenience.",
    toggle(s.strict_verify, function (on) { s.strict_verify = on; }));
}
function showSettings(on) {
  document.getElementById("settings-overlay").classList.toggle("on", on);
  if (!on) return;
  document.getElementById("settings-msg").textContent = "";
  api("/settings").then(function (out) {
    if (!out.ok) return;
    settingsState = out;
    document.getElementById("settings-path").textContent = out.project_dir || "";
    renderSettings();
  });
}
document.getElementById("m-settings").onclick = function () { showSettings(true); };
document.getElementById("p-add").onclick = function () { addProject(); };
document.getElementById("t-add").onclick = function () { newThread(); };
document.getElementById("mem-search").oninput = function () { renderMemory(); };
document.getElementById("packet-close").onclick = function () { document.getElementById("packet-overlay").classList.remove("on"); };
document.getElementById("packet-overlay").onclick = function (ev) {
  if (ev.target === document.getElementById("packet-overlay")) document.getElementById("packet-overlay").classList.remove("on");
};
// The rail is persistent by default but not compulsory — a narrow window or a single
// project makes it dead weight, and the preference outlives the session.
function toggleRail() {
  var off = document.body.classList.toggle("rail-off");
  try { localStorage.setItem("kageRail", off ? "off" : "on"); } catch (e) {}
  // The terminal sizes itself to its container, so a width change must re-fit it or
  // claude keeps drawing to the old column count.
  if (fitAddon) setTimeout(function () { try { fitAddon.fit(); } catch (e) {} }, 0);
}
try { if (localStorage.getItem("kageRail") === "off") document.body.classList.add("rail-off"); } catch (e) {}
document.getElementById("settings-close").onclick = function () { showSettings(false); };
document.getElementById("settings-save").onclick = function () {
  if (!settingsState) return;
  var s = settingsState.settings;
  document.getElementById("settings-msg").textContent = "saving…";
  api("/settings", { method: "POST", body: {
    test: s.test || "", setup: s.setup || "",
    diff_budget: Number(s.diff_budget), max_concurrent: Number(s.max_concurrent),
    strict_verify: Boolean(s.strict_verify),
  } }).then(function (out) {
    document.getElementById("settings-msg").textContent = out.ok ? "saved to .agent_memory/config.json" : (out.error || "failed");
  });
};

// --- command palette (⌘K). Everything reachable by mouse should be reachable by
// typing its name — including the runs themselves, which are the things you actually
// hunt for once there are more than a handful.
var paletteSel = 0;
function paletteCommands(query) {
  var cmds = [
    { grp: "go", name: "Room", hint: "1", run: function () { setView("room"); } },
    { grp: "go", name: "Inbox", hint: "2", run: function () { setView("inbox"); } },
    { grp: "go", name: "Runs", hint: "3", run: function () { setView("runs"); } },
    { grp: "go", name: "Board", hint: "4", run: function () { setView("board"); } },
    { grp: "go", name: "Memory", hint: "5", run: function () { setView("memory"); } },
    { grp: "do", name: "New run…", hint: "n", run: function () { showOverlay(true); } },
    { grp: "do", name: "Room: chat view", run: function () { setView("room"); setRoomMode("chat"); } },
    { grp: "do", name: "Room: terminal view", run: function () { setView("room"); setRoomMode("terminal"); } },
    { grp: "do", name: "Cycle theme", run: function () { document.getElementById("m-theme").onclick(); } },
    { grp: "do", name: "Project settings…", run: function () { showSettings(true); } },
    { grp: "do", name: "Notifications", run: function () { document.getElementById("m-bell").onclick({ stopPropagation: function () {} }); } },
    { grp: "do", name: "Open another project…", run: function () { addProject(); } },
    { grp: "do", name: "Toggle the projects rail", run: function () { toggleRail(); } },
    { grp: "do", name: "New conversation thread", run: function () { setView("room"); newThread(); } },
  ];
  (state.sessions || []).forEach(function (session) {
    if (session.key === state.session) return;
    cmds.push({
      grp: "thread", name: session.title, hint: "switch",
      run: function () { setView("room"); switchThread(session.key); },
    });
  });
  // Every known project is reachable by typing its name — the rail is the browsable
  // view of the same registry, the palette is the fast one.
  (state.projects || []).forEach(function (project) {
    if (project.dir === state.projectDir) return;
    cmds.push({ grp: "project", name: project.name, hint: "switch", run: function () { openProject(project.dir, null); } });
  });
  state.runs.forEach(function (r) {
    cmds.push({
      grp: r.display_state, name: r.intent,
      hint: r.ownership === "needs_you" ? "needs you" : "",
      run: function () { openRun(r.id); },
    });
  });
  var q = query.trim().toLowerCase();
  if (!q) return cmds.slice(0, 12);
  return cmds.filter(function (c) { return (c.name + " " + c.grp).toLowerCase().indexOf(q) >= 0; }).slice(0, 12);
}
function renderPalette() {
  var input = document.getElementById("palette-input");
  var box = document.getElementById("palette-results");
  var cmds = paletteCommands(input.value);
  if (paletteSel >= cmds.length) paletteSel = Math.max(0, cmds.length - 1);
  box.textContent = "";
  if (!cmds.length) { box.appendChild(h("div", "none", "Nothing matches.")); return; }
  cmds.forEach(function (c, i) {
    var row = h("div", "row" + (i === paletteSel ? " sel" : ""));
    row.appendChild(h("span", "grp", c.grp));
    row.appendChild(h("span", "name", c.name));
    if (c.hint) row.appendChild(h("span", "hint", c.hint));
    row.onclick = function () { showPalette(false); c.run(); };
    box.appendChild(row);
  });
}
function showPalette(on) {
  document.getElementById("palette-overlay").classList.toggle("on", on);
  if (on) {
    paletteSel = 0;
    var input = document.getElementById("palette-input");
    input.value = "";
    renderPalette();
    setTimeout(function () { input.focus(); }, 0);
  }
}
document.getElementById("palette-input").addEventListener("input", function () { paletteSel = 0; renderPalette(); });
document.getElementById("palette-input").addEventListener("keydown", function (ev) {
  var cmds = paletteCommands(this.value);
  if (ev.key === "ArrowDown") { ev.preventDefault(); paletteSel = Math.min(cmds.length - 1, paletteSel + 1); renderPalette(); }
  else if (ev.key === "ArrowUp") { ev.preventDefault(); paletteSel = Math.max(0, paletteSel - 1); renderPalette(); }
  else if (ev.key === "Enter") { ev.preventDefault(); if (cmds[paletteSel]) { showPalette(false); cmds[paletteSel].run(); } }
  else if (ev.key === "Escape") { showPalette(false); }
});

document.addEventListener("keydown", function (ev) {
  var typing = ev.target && (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA" || ev.target.tagName === "SELECT");
  // ⌘K works from anywhere, including mid-sentence in the composer.
  if ((ev.metaKey || ev.ctrlKey) && ev.key === "k") { ev.preventDefault(); showPalette(true); return; }
  if (ev.key === "Escape") { showPalette(false); showOverlay(false); showSettings(false); document.getElementById("notif").classList.remove("on"); return; }
  if (typing) {
    if (ev.key === "Enter" && ev.target.id === "intent" && (ev.metaKey || ev.ctrlKey)) dispatchNow();
    return;
  }
  if (ev.key === "1") setView("room");
  else if (ev.key === "2") setView("inbox");
  else if (ev.key === "3") setView("runs");
  else if (ev.key === "4") setView("board");
  else if (ev.key === "5") setView("memory");
  else if (ev.key === "n") showOverlay(true);
});
Array.prototype.forEach.call(document.querySelectorAll(".seg button"), function (btn) {
  btn.onclick = function () { setView(btn.dataset.view); };
});

// --- SSE: notifications, never state. Any run event triggers a re-read.
function connect() {
  var source = new EventSource("/runs/events");
  source.addEventListener("hello", function () {
    state.connected = true;
    document.getElementById("conn").classList.remove("off");
    document.getElementById("st-left").textContent = "live";
  });
  source.addEventListener("run", function () { refresh(); });
  // Room deltas stream live text so replies feel like a reply, not a page reload —
  // but the "you" and "final" kinds always trigger a re-read, so a missed delta
  // never leaves the transcript out of sync with what the server actually persisted.
  source.addEventListener("room", function (ev) {
    var payload;
    try { payload = JSON.parse(ev.data); } catch (err) { return; }
    // The SSE stream is shared by every thread; the screens are not. A delta from a
    // background thread marks its tab and is otherwise dropped — appending it here
    // would type one conversation's words into another's transcript.
    var from = payload.session || "main";
    if (from !== state.session) {
      if (payload.kind === "final") state.threadBusy[from] = false;
      else state.threadBusy[from] = true;
      renderThreads();
      return;
    }
    if (payload.kind === "you" || payload.kind === "final") { refreshRoom(); return; }
    state.room.busy = true;
    state.roomStreaming.push(payload);
    renderRoom();
  });
  // The pty's raw bytes, written straight into xterm — this channel is the ONE place
  // in the whole app that is deliberately NOT structured. Everything claude code
  // renders (its banner, its own tool-call formatting, its own prompts) shows up
  // exactly as it would in a real terminal, because it IS one.
  source.addEventListener("pty", function (ev) {
    var payload;
    try { payload = JSON.parse(ev.data); } catch (err) { return; }
    if (!term) return;
    // Same rule as the room stream: bytes belong to the thread they came from.
    if ((payload.session || "main") !== state.session) return;
    if (payload.kind === "data") term.write(payload.bytes);
    else if (payload.kind === "exit") term.write("\\r\\n\\x1b[33m[session ended]\\x1b[0m\\r\\n");
  });
  source.onerror = function () {
    state.connected = false;
    document.getElementById("conn").classList.add("off");
    document.getElementById("st-left").textContent = "disconnected — retrying";
    // EventSource reconnects on its own; the dot + label are the explicit
    // disconnected state (a frozen board that looks live is worse than an error).
  };
}

fetch("/health").then(function (r) { return r.json(); }).then(function (out) {
  var dir = String(out.project_dir || "");
  state.projectDir = dir;
  document.getElementById("proj").textContent = dir.split("/").slice(-1)[0] || "";
  document.getElementById("proj").title = dir;
  renderProjects();
}).catch(function () {});

bellLabel();
loadProjects();
loadMemory();
renderComposerBar();
try { applyTheme(localStorage.getItem("kageTheme") || "system"); } catch (e) { applyTheme("system"); }
refresh();
refreshRoom();
connect();
setTimeout(function () { document.getElementById("room-input").focus(); }, 0);
setInterval(refresh, 30000);
setInterval(refreshRoom, 15000);
</script>
</body>
</html>
`;
