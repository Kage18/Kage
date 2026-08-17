// The delegation app's stylesheet, as one exported template literal.
//
// Split out of app-html.ts, which held HTML + CSS + JS in a single 2,581-line
// template literal — three escaping bugs shipped from that file in one session
// because every edit was surgery into an undifferentiated string. The composition
// (and the guarantee) live in app-html.ts: the composed page hashes identically to
// the pre-split file. CSS has no template-literal escapes, so this file is safe to
// edit like a stylesheet — but it IS still a template literal: no backticks, no ${.
//
// The gates in delegation-api.test.ts run against the COMPOSED page: every var(--x)
// defined, every styled class applied, kernel vocabulary only.
export const APP_STYLES = `  /* ── Kage tokens, taken from the site (docs/assets/site.css) ────────────────
     The app previously invented its own look: a warm neutral ground with an orange
     seal, tight 4-8px corners, system fonts. None of that is Kage. The product's
     palette is a GREEN-BLACK ground with verified-green reserved for gains and
     primary action, editorial serif display type, and a deliberately soft radius
     scale. Matching the site is the point — a user should not be able to tell the
     app and the site were built by different hands.

     Fonts are declared with the site's exact stacks. The site loads Fraunces/Inter/
     JetBrains Mono from Google Fonts; the app cannot (it must work offline behind
     the guard, and a test forbids external hosts), so it takes the same stacks and
     degrades exactly as the site does when they are absent. */
  :root {
    color-scheme: dark;
    --bg:#121413; --surface:#1a1d1b; --surface2:#212522; --inset:#0e1110;
    --line:#2c302c; --line2:#242a25; --line-strong:#41463f;
    --text:#edefe9; --text2:#a4aba1; --text3:#767d74;
    --chrome:#171a18;

    /* Verified green — gains and primary action only, per the site's own rule. */
    --green:#43c98a; --green-strong:#5fdca0; --green-soft:rgba(67,201,138,.12);
    /* Kept under their old names so every existing rule keeps working, but now
       pointing at the site's palette rather than an invented one. */
    --seal:#43c98a; --jade:#43c98a;
    --code:#6fb4e8; --memory:#b095e8; --amber:#d9a93f; --crimson:#e07a8c;

    --sans:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    --serif:"Fraunces","Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
    --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace;

    /* Soft, premium — the site's scale. The app had 4/6/8px, which read as a
       utilitarian tool rather than as Kage. */
    --r-control:10px; --r-panel:14px; --r-card:16px; --r-hero:22px;

    --code-bg:#0e1110; --code-text:#cfe0d4;
    --shadow-sm:0 1px 2px rgba(0,0,0,.2), 0 6px 18px rgba(0,0,0,.22);
    --shadow-md:0 1px 2px rgba(0,0,0,.2), 0 14px 36px rgba(0,0,0,.3);
    --glow-green:0 10px 28px rgba(67,201,138,.22);
  }

  /* The site retired its light tokens ("one look, like the product"). A desktop app
     is used in rooms the site is not, so the choice survives — but as a faithful
     light rendering of the SAME green-black language, not the unrelated warm
     palette that was here before. Dark stays the default and the identity. */
  :root[data-theme="light"] {
    color-scheme: light;
    --bg:#f2f4f1; --surface:#ffffff; --surface2:#e9ece7; --inset:#e3e7e1;
    --line:#d5dad2; --line2:#e2e6df; --line-strong:#b3bbb0;
    --text:#141714; --text2:#4d544c; --text3:#79806f;
    --chrome:#e8ebe6;
    --green:#1f9d63; --green-strong:#178552; --green-soft:rgba(31,157,99,.12);
    --seal:#1f9d63; --jade:#1f9d63;
    --code:#2f6fa8; --memory:#6f52a8; --amber:#9a6f14; --crimson:#a8465c;
    --code-bg:#0e1110; --code-text:#cfe0d4;
    --shadow-sm:0 1px 2px rgba(20,24,20,.05), 0 2px 8px rgba(20,24,20,.05);
    --shadow-md:0 1px 2px rgba(20,24,20,.06), 0 10px 28px rgba(20,24,20,.10);
    --glow-green:0 10px 28px rgba(31,157,99,.18);
  }

  /* notification badge on the bell */
  .bellwrap { position:relative; display:inline-flex; }
  .bellwrap .badge { position:absolute; top:-5px; right:-5px; min-width:16px; height:16px;
    border-radius:var(--r-card); background:var(--crimson); color:#fff; font-family:var(--mono);
    font-size:9.5px; display:flex; align-items:center; justify-content:center; padding:0 4px; }
  * { box-sizing:border-box; }
  html,body { height:100%; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:var(--sans);
    font-size:14px; line-height:1.5; -webkit-font-smoothing:antialiased; overflow:hidden; }
  button { font:inherit; cursor:pointer; border:none; background:none; color:inherit; padding:0;
    transition:background .12s ease, border-color .12s ease, color .12s ease, opacity .12s ease; }
  .view.on { animation:viewin .16s ease both; }
  @keyframes viewin { from { opacity:0; transform:translateY(3px) } to { opacity:1; transform:none } }
  .turn { animation:turnin .18s ease both; }
  @keyframes turnin { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:none } }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration:.001ms !important; transition-duration:.001ms !important; }
  }
  ::-webkit-scrollbar { width:10px; height:10px; }
  ::-webkit-scrollbar-thumb { background:var(--line); border-radius:var(--r-panel); border:2px solid transparent; background-clip:content-box; }
  ::-webkit-scrollbar-track { background:transparent; }

  /* ---- chrome: title bar + status bar (the IDE frame) ---- */
  .top { display:flex; align-items:center; gap:12px; height:46px; padding:0 14px;
    background:var(--chrome); border-bottom:1px solid var(--line); user-select:none;
    -webkit-app-region:drag; flex:none; }
  .top button, .top .seg { -webkit-app-region:no-drag; }
  body.electron .top { padding-left:84px; }
  /* Kage's mark is the glowing eye from the site, not the 影 kanji the app invented
     — the site does not use 影 anywhere. Inlined rather than linked so the page stays
     self-contained behind the guard. */
  .seal { width:24px; height:24px; flex:none; display:block; }
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
  .iconbtn.primary { background:var(--green); border-color:var(--green); color:#06130d; font-weight:600; }
  .iconbtn.primary:hover { background:var(--green-strong); border-color:var(--green-strong); }
  /* The one thing on the bar that CREATES something should not look like the two
     icon buttons next to it. */
  #m-new { background:var(--green-soft); border-color:color-mix(in srgb, var(--green) 45%, var(--line));
    color:var(--green); font-weight:550; }
  #m-new:hover { background:var(--green); color:#06130d; border-color:var(--green); }

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

  /* Live runs, surfaced in the Room. Work dispatched from here used to vanish: the
     only sign an agent was running was a count in the status bar, and you had to know
     to navigate to Runs to find it. */
  .liverail { flex:none; display:flex; flex-direction:column; gap:6px; padding:10px 24px 0; }
  .liverow { display:flex; align-items:center; gap:10px; padding:9px 13px; cursor:pointer;
    border:1px solid color-mix(in srgb, var(--green) 26%, var(--line));
    background:var(--green-soft); border-radius:var(--r-panel); }
  .liverow:hover { border-color:var(--green); }
  .liverow .dot { width:6px; height:6px; border-radius:50%; background:var(--green); flex:none;
    animation:pulse2 1.2s ease-in-out infinite; }
  .liverow .li { font-size:12.5px; color:var(--text); overflow:hidden; text-overflow:ellipsis;
    white-space:nowrap; flex:1; min-width:0; }
  .liverow .la { font-family:var(--mono); font-size:11px; color:var(--green); flex:none; }
  .liverow .lg { font-family:var(--mono); font-size:10.5px; color:var(--text3); flex:none; }
  .railmore { align-self:center; font-size:11.5px; color:var(--text3); padding:3px 8px;
    border-radius:var(--r-control); }
  .railmore:hover { color:var(--green); background:var(--green-soft); }
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
  /* The site sets stat figures in the SERIF face (.stat-chip strong: 600 22px
     var(--serif)); the app had them in mono, which reads as telemetry rather than
     as Kage. */
  .mem-fig .n { font-family:var(--serif); font-size:30px; font-weight:600; letter-spacing:-.01em;
    font-variant-numeric:tabular-nums; line-height:1; }
  .mem-fig .l { font-size:12px; color:var(--text2); margin-top:3px; }
  .mem-fig .sub { font-size:11px; color:var(--text3); margin-top:1px; }
  .mem-fig.jade .n { color:var(--green); }
  .mem-fig.amber .n { color:var(--amber); }
  .mem-est { margin-top:16px; padding-top:14px; border-top:1px solid var(--line);
    display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  .mem-est .n { font-family:var(--serif); font-size:17px; font-weight:600; font-variant-numeric:tabular-nums; color:var(--text2); }
  .mem-est .l { font-size:11.5px; color:var(--text3); }

  .mem-health { display:grid; grid-template-columns:repeat(auto-fit, minmax(128px, 1fr)); gap:10px; margin-bottom:22px; }
  .mem-stat { border:1px solid var(--line); border-radius:var(--r-card); background:var(--surface); padding:12px 14px; }
  .mem-stat .n { font-family:var(--serif); font-size:20px; font-weight:600; font-variant-numeric:tabular-nums; }
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
  .packet .pfoot { display:flex; align-items:center; gap:8px; flex-wrap:wrap;
    padding:13px 20px; border-top:1px solid var(--line); }
  .packet .pf-label { font-size:12px; color:var(--text3); margin-right:2px; }
  .packet .pfoot .msg { font-size:11.5px; color:var(--text3); margin-left:auto; }
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
  /* Bottom-anchored, like every chat surface people already know. The column used to
     sit at the TOP of a tall pane, so a short conversation left ~400px of dead space
     between the last message and the composer — the eye and the hands ended up at
     opposite ends of the window. justify-content:flex-end pins the turns to the
     composer and lets the empty space fall above, where it reads as headroom. */
  .room-scroll { overflow-y:auto; flex:1; display:flex; flex-direction:column; }
  .room-col { max-width:760px; width:100%; margin:0 auto; padding:32px 24px 8px;
    display:flex; flex-direction:column; justify-content:flex-end; gap:22px; flex:1; box-sizing:border-box; }
  .primer { text-align:center; padding:20px; color:var(--text3); margin:auto 0; }
  .primer .pseal-eye { width:46px; height:46px; display:block; }
  .primer .pseal { width:46px; height:46px; color:var(--green);
    font-family:var(--mono); font-weight:700; font-size:22px; display:flex; align-items:center; justify-content:center;
    margin:0 auto 18px; }
  .primer p { max-width:420px; margin:0 auto; font-size:13.5px; line-height:1.6; }
  /* Assistant prose gets NO bubble.
     Wrapping every message in a container is the single reason this read as heavy
     next to AO: a bubble is a frame, and framing continuous prose fights the reading.
     Only the user's own lines are bubbled — they are short, they are interjections,
     and the contrast is what makes the thread scannable. */
  /* One column, one rhythm. Right-aligned bubbles of wildly different widths (830px
     next to 65px for "hi") read as accidental; a labelled left-aligned turn with a
     rule down the side reads as a transcript, which is what this is. */
  .turn { display:flex; flex-direction:column; gap:7px; max-width:100%; align-self:stretch; }
  .turn.you { margin-top:6px; }
  .turn .who { font-family:var(--mono); font-size:10px; letter-spacing:.14em;
    text-transform:uppercase; color:var(--text3); }
  .turn.you .who { color:var(--green); }
  .turn .bubble2 { font-size:14.5px; line-height:1.7; white-space:pre-wrap; }
  .turn.you .bubble2 { color:var(--text2); max-width:68ch;
    border-left:2px solid var(--green); padding-left:14px; }
  .turn.kage .bubble2 { color:var(--text); max-width:68ch; }
  /* A turn boundary with elapsed time, the way AO closes a stretch of work. */
  .turnbreak { display:flex; align-items:center; gap:12px; padding:2px 0 0; opacity:.55; }
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

  /* ---- work: one surface, two arrangements ----
     Inbox/Runs/Board were the same runs behind three doors with different powers
     each. This is the collapse: a triaged list beside the detail, or the same runs
     as board columns — and every power works from both, because powers attach to
     the run, not to the view that happened to render it. */
  .workbar { display:flex; align-items:center; gap:12px; height:40px; padding:0 16px;
    background:var(--chrome); border-bottom:1px solid var(--line); flex:none; }
  .wsum { font-family:var(--mono); font-size:11px; color:var(--text3); }
  .wlayout { margin-left:auto; display:flex; background:var(--inset); border:1px solid var(--line);
    border-radius:var(--r-panel); padding:2px; gap:2px; }
  .wlayout button { font-size:11px; padding:3px 12px; border-radius:var(--r-control); color:var(--text2); }
  .wlayout button.on { background:var(--surface); color:var(--text); box-shadow:var(--shadow-sm); }
  .workmain { flex:1; min-height:0; position:relative; display:flex; flex-direction:column; }
  #work-board { display:none; }
  #v-work.layout-board #work-split { display:none; }
  #v-work.layout-board #work-board { display:block; flex:1; }
  /* Board layout opens the SAME detail as a slide-over — one detail element, one
     power set, whichever arrangement you were in when you clicked. */
  #v-work.layout-board.dover #work-split { display:grid; grid-template-columns:1fr; position:absolute;
    inset:0 0 0 auto; width:min(820px, 84%); z-index:5; background:var(--bg);
    border-left:1px solid var(--line); box-shadow:var(--shadow-md); }
  #v-work.layout-board.dover #work-split .list { display:none; }

  /* A work row: glyph · title+atoms(+answer) · time+actions. tabindex'd, focusable,
     and the selection is visible — the start of an actual keyboard story. */
  .wrow { display:grid; grid-template-columns:30px 1fr auto; gap:10px; margin:2px 8px;
    padding:11px 12px 11px 8px; border-radius:var(--r-card); cursor:pointer;
    border:1px solid transparent; outline:none; }
  .wrow:hover { background:var(--surface2); }
  .wrow.sel { background:var(--surface); border-color:var(--line); box-shadow:var(--shadow-sm); }
  .wrow:focus-visible { border-color:var(--green); }
  .wrow .qt { font-size:13px; font-weight:500; }
  .wrow.attn .qt { font-weight:600; }
  .showmore { display:block; margin:6px auto 2px; font-family:var(--mono); font-size:10.5px;
    color:var(--text3); padding:4px 10px; border-radius:var(--r-control); }
  .showmore:hover { color:var(--text); background:var(--surface2); }

  .card { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card);
    box-shadow:var(--shadow-sm); overflow:hidden; }
  .qact { display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
  .qanswer { margin-top:9px; }
  .qanswer input { width:100%; box-sizing:border-box; font:inherit; font-size:13px;
    padding:8px 12px; border-radius:var(--r-control); border:1px solid color-mix(in srgb, var(--amber) 40%, var(--line));
    background:var(--inset); color:var(--text); }
  .qanswer input:focus { outline:none; border-color:var(--amber); }
  .qanswer input:disabled { opacity:.5; }
  .qbtns { display:flex; gap:6px; }
  .btn.sm { font-size:11.5px; padding:4px 11px; }
  .glyph { font-family:var(--mono); font-size:15px; text-align:center; padding-top:1px; }
  .qt { font-size:14.5px; font-weight:550; line-height:1.45; letter-spacing:-.006em;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .qatoms { display:flex; gap:12px; margin-top:6px; flex-wrap:wrap; align-items:baseline; }
  .atom { font-family:var(--mono); font-size:10.5px; color:var(--text3); }
  .atom.jade { color:var(--jade); } .atom.amber { color:var(--amber); } .atom.hot { color:var(--crimson); }
  .qtime { font-family:var(--mono); font-size:10.5px; color:var(--text3); padding-top:3px; }

  /* handover card */
  .hand { margin-bottom:22px; }
  .list .hand { margin:8px 10px 14px; }
  .hand .hhead { display:flex; align-items:baseline; padding:11px 18px; border-bottom:1px solid var(--line2);
    font-family:var(--mono); font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--text3); }
  .hand .hhead button { margin-left:auto; font-family:var(--mono); font-size:10px; color:var(--text3); letter-spacing:.05em; }
  .hand .hhead button:hover { color:var(--text); }
  .hrow { display:grid; grid-template-columns:24px 1fr auto; gap:11px; padding:9px 18px;
    border-bottom:1px solid var(--line2); align-items:baseline; font-size:13.5px; }
  .hrow:last-child { border-bottom:none; }
  .hic { font-family:var(--mono); text-align:center; }
  .hatom { font-family:var(--mono); font-size:10.5px; color:var(--text3); }

  /* ---- the triaged list + detail split ---- */
  .runs { display:grid; grid-template-columns:340px 1fr; flex:1; min-height:0; }
  .list { border-right:1px solid var(--line); overflow-y:auto; background:var(--inset); padding:8px 0 20px; }
  .lgroup { padding:14px 16px 6px; font-family:var(--mono); font-size:10px; letter-spacing:.14em;
    text-transform:uppercase; color:var(--text3); display:flex; }
  .lgroup em { font-style:normal; margin-left:auto; }
  .dot { width:7px; height:7px; border-radius:50%; margin-top:5px; }

  .detail { overflow:hidden; display:flex; flex-direction:column; background:var(--bg); min-width:0; }
  .dhead { position:relative; padding:18px 26px 0; background:var(--surface); border-bottom:1px solid var(--line); flex:none; }
  .dclose { position:absolute; top:14px; right:16px; font-size:13px; color:var(--text3);
    padding:4px 9px; border-radius:var(--r-control); }
  .dclose:hover { color:var(--text); background:var(--surface2); }
  .dhead h2 { margin:0 0 9px; padding-right:36px; font-size:16.5px; font-weight:650; letter-spacing:-.014em; line-height:1.35; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; }
  .chip { font-family:var(--mono); font-size:10.5px; padding:3px 9px; border-radius:var(--r-panel);
    border:1px solid var(--line); color:var(--text2); background:var(--surface2);
    max-width:340px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .chip.state-ready { color:var(--jade); border-color:color-mix(in srgb, var(--jade) 40%, var(--line)); }
  .chip.blast-hot { color:var(--amber); border-color:color-mix(in srgb, var(--amber) 45%, var(--line)); }
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
  .toolcard .lbl { font-family:var(--mono); font-size:12px; color:var(--text2);
    min-width:0; flex:1; overflow-wrap:anywhere; }
  .toolcard .ts { font-family:var(--mono); font-size:10px; color:var(--text3); opacity:.6;
    margin-left:auto; font-variant-numeric:tabular-nums; flex:none; }
  .livepulse { width:6px; height:6px; border-radius:50%; background:var(--jade); display:inline-block;
    animation:pulse2 1.1s ease-in-out infinite; margin-right:7px; vertical-align:1px; }

  /* ── the receipt ──────────────────────────────────────────────────────────
     The kernel's proof of work, and the one artifact AO and Conductor do not have.
     It is designed as what it is named: a printed receipt. The site's tokens declare
     terminals "stay dark in both schemes, like a printed receipt" — so this object
     keeps the dark code ground in BOTH themes, with perforated edges and a rubber
     stamp. Every number on it is the kernel's, never the agent's. */
  .paper-receipt { background:var(--code-bg); color:var(--code-text); border-radius:2px;
    max-width:560px; margin:4px auto 20px; padding:26px 30px 22px; position:relative;
    box-shadow:var(--shadow-md);
    /* Perforated top and bottom, cut from the card itself. */
    -webkit-mask:
      radial-gradient(circle 5px at 8px 0, transparent 98%, black) top left / 16px 51% repeat-x,
      radial-gradient(circle 5px at 8px 16px, transparent 98%, black) bottom left / 16px 50% repeat-x;
    mask:
      radial-gradient(circle 5px at 8px 0, transparent 98%, black) top left / 16px 51% repeat-x,
      radial-gradient(circle 5px at 8px 16px, transparent 98%, black) bottom left / 16px 50% repeat-x; }
  .verdict-head { display:flex; flex-direction:column; align-items:center; gap:7px;
    margin:6px 0 18px; text-align:center; }
  .stamp { display:inline-flex; align-items:baseline; gap:10px; padding:9px 20px;
    border:2.5px double var(--green); border-radius:3px; color:var(--green);
    font-family:var(--serif); font-weight:700; font-size:19px; letter-spacing:.12em;
    transform:rotate(-1.5deg); text-transform:uppercase; }
  .stamp .count { font-family:var(--mono); font-size:13px; letter-spacing:0; align-self:center; }
  .stamp.warn { border-color:var(--amber); color:var(--amber); }
  .stamp.bad { border-color:var(--crimson); color:var(--crimson); }
  .verdict-sub { font-size:11px; color:color-mix(in srgb, var(--code-text) 55%, transparent);
    font-family:var(--mono); letter-spacing:.04em; }
  .claim-statement { font-size:14px; line-height:1.6; color:var(--code-text);
    text-align:center; margin:0 auto 18px; max-width:46ch;
    border-top:1px dashed color-mix(in srgb, var(--code-text) 25%, transparent);
    padding-top:16px; }
  .checks { display:flex; flex-direction:column; margin-bottom:6px;
    border-top:1px dashed color-mix(in srgb, var(--code-text) 25%, transparent);
    padding-top:12px; }
  .check { display:grid; grid-template-columns:20px 120px 1fr auto; gap:10px; align-items:baseline;
    padding:6px 0; font-size:12.5px; font-family:var(--mono); }
  .check .mark { font-weight:700; text-align:center; }
  .check.pass .mark { color:var(--green); }
  .check.fail .mark { color:var(--crimson); }
  .check.skip .mark { color:var(--amber); }
  .check .name { font-weight:600; color:var(--code-text); }
  .check .detail { color:color-mix(in srgb, var(--code-text) 55%, transparent); font-size:11px;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .check .ev { font-size:10.5px; color:color-mix(in srgb, var(--code-text) 55%, transparent); }
  /* The bill: dotted leaders between the item and its amount, like a till roll. */
  .rc-fixit { font-family:var(--mono); font-size:11.5px; line-height:1.6; color:var(--amber);
    border:1px dashed color-mix(in srgb, var(--amber) 45%, transparent); border-radius:3px;
    padding:9px 12px; margin-bottom:12px; }
  .rc-fixlink { color:var(--amber); text-decoration:underline; font:inherit; }
  .rc-totals { border-top:1px dashed color-mix(in srgb, var(--code-text) 25%, transparent);
    margin-top:10px; padding-top:12px; display:flex; flex-direction:column; gap:6px; }
  .rc-row { display:flex; align-items:baseline; gap:8px; font-family:var(--mono); font-size:12.5px; }
  .rc-row .rc-k { color:color-mix(in srgb, var(--code-text) 65%, transparent);
    text-transform:uppercase; letter-spacing:.08em; font-size:10.5px; }
  .rc-row .rc-dots { flex:1; border-bottom:1px dotted color-mix(in srgb, var(--code-text) 30%, transparent);
    transform:translateY(-3px); }
  .rc-row .rc-v { color:var(--code-text); font-variant-numeric:tabular-nums; }
  .rc-row.hot .rc-v { color:var(--amber); }
  .note-row { display:grid; grid-template-columns:20px 1fr; gap:10px; font-size:12.5px; line-height:1.55;
    padding:5px 0; color:color-mix(in srgb, var(--code-text) 80%, transparent); font-family:var(--mono); }
  .note-row .ic { text-align:center; }
  .note-row.unsure .ic { color:var(--amber); }
  .note-row.learn .ic { color:var(--green); }
  .paper-receipt .seclabel-sm, .seclabel-sm { font-family:var(--mono); font-size:10px; letter-spacing:.14em;
    text-transform:uppercase; color:var(--text3); margin:16px 0 6px; }
  .paper-receipt .seclabel-sm { color:color-mix(in srgb, var(--code-text) 55%, transparent);
    border-top:1px dashed color-mix(in srgb, var(--code-text) 25%, transparent); padding-top:12px; margin-top:12px; }

  /* diff + raw */
  .codepane { background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card);
    padding:10px 0; overflow-x:auto; box-shadow:var(--shadow-sm); }
  .dline { font-family:var(--mono); font-size:11.5px; padding:1px 16px; white-space:pre;
    width:max-content; min-width:100%; box-sizing:border-box; }
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
  .acard.sel { border-color:var(--green); }
  .acard:focus-visible { outline:none; border-color:var(--green); }
  /* A grid item defaults to min-width:auto, so the nowrap branch slug inside forced
     the card to its full text width — which widened the column, which pushed the
     fourth column off the right edge of the board entirely. */
  .acard > div { min-width:0; }
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
  #room-term-pane { display:none; flex:1; min-height:0; min-width:0; background:var(--code-bg); padding:10px 14px; }
  /* flex:1 + min-width:0 matter: as a flex item this would otherwise size to its
     content, and xterm's fit addon would measure a near-zero box and pick cols=2 —
     which renders the session one character per line. */
  #room-term { flex:1; min-width:0; width:100%; height:100%; }
  .xterm .xterm-viewport::-webkit-scrollbar { width:10px; }`;
