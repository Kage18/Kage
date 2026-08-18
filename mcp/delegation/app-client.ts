// The delegation app's client script, as one exported template literal.
//
// ESCAPES ARE DOUBLED HERE. This is still a TS template literal, so a newline the
// BROWSER should see as \n must be written \\n in this source; a mis-escaped
// character class compiles silently into a different regex (the parse gate caught
// exactly that twice). Prefer split()/indexOf over regex for new code. The
// syntactically-valid-JS gate in delegation-api.test.ts parses the composed script
// on every test run.
//
// No backticks and no ${ anywhere in the client code — both would terminate or
// interpolate this literal.
export const APP_CLIENT = `"use strict";
var TOKEN = "__KAGE_TOKEN__";
var state = {
  runs: [], goals: [], view: "room", roomMode: "chat", selected: null, detail: null, tab: "follow", connected: false,
  room: { turns: [], busy: false }, roomStreaming: [], projects: [], projectDir: "",
  session: "main", sessions: [{ key: "main", title: "Room" }], threadBusy: {},
  memory: null, memType: null,
  workLayout: "list", dover: false, showAllDone: false, workOrder: [],
  diffView: "unified", collapsedDiff: {}, expandedGroups: {},
  steerQueueMode: false, runTerminalActive: false, runTermRunId: null,
};
try { if (localStorage.getItem("kageLayout") === "board") state.workLayout = "board"; } catch (e) {}
try { if (localStorage.getItem("kageDiff") === "split") state.diffView = "split"; } catch (e) {}

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
function costLabel(run) {
  if (!run.spend || !run.spend.usd_est) return null;
  var usd = run.spend.usd_est;
  var out = usd >= 0.995 ? "$" + usd.toFixed(2) : "$" + usd.toFixed(usd < 0.01 ? 3 : 2).replace(/^\$0/, "$0");
  if (run.tokens_used) out += " · " + compact(run.tokens_used) + " tok";
  return out;
}

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
function isPlanApproval(run) {
  return Boolean(run.waiting_on && run.waiting_on.needs === "plan approval");
}
// Deliver a message to a blocked/live run's own tell route — the ONE path every
// answer field, the Approve button, and the detail composer's "send now" all use, so
// the delivery vocabulary the kernel reports is never re-worded per caller.
function tellRun(runId, message) {
  return api("/runs/" + runId + "/tell", { method: "POST", body: { message: message } }).then(function (out) {
    if (!out.ok) showError(out.error || "the message was not delivered");
    else flash("delivery: " + out.delivery);
    refresh();
    return out;
  });
}
function decisionText(run) {
  var s = run.display_state;
  if (s === "ready") return "Merge: " + run.intent;
  if (s === "blocked" && isPlanApproval(run)) return "Plan review: " + run.intent;
  if (s === "blocked" && run.waiting_on) return "“" + (run.waiting_on.question || run.waiting_on.detail || run.waiting_on.needs || "waiting on you") + "”";
  if (s === "blocked") return "Waiting on you: " + run.intent;
  if (s === "stopped") return "Stopped — resume or reject: " + run.intent;
  return "Lost, resumable: " + run.intent;
}

// --- the work surface: one view, two arrangements, one power set.
// Inbox/Runs/Board used to be three doors into the same ~25 runs, each with
// different powers (merge from two of them, steer from one, look-only from the
// third). The user had to memorize which door could do what. Now there is ONE
// triaged list beside the run's detail, a Board layout of the same runs, and
// every power — answer, merge, reject, steer — attaches to the run itself.
function renderChrome() {
  // The window-level indicators live outside any view and update on every refresh:
  // title count, bell badge, status-bar counts, the open notification center.
  var needs = state.runs.filter(function (r) { return r.ownership === "needs_you"; }).length;
  var working = state.runs.filter(function (r) { return r.ownership === "working"; }).length;
  document.title = needs ? "Kage · " + needs : "Kage";
  if (document.getElementById("notif").classList.contains("on")) renderNotifications();
  var badge = document.getElementById("bell-badge");
  badge.textContent = String(needs);
  badge.style.display = needs ? "flex" : "none";
  var counts = document.getElementById("st-counts");
  counts.textContent = state.runs.length ? working + " working · " + needs + " for you" : "";
}

function renderWork() {
  var view = document.getElementById("v-work");
  var board = state.workLayout === "board";
  view.classList.toggle("layout-board", board);
  view.classList.toggle("dover", board && state.dover && Boolean(state.selected));
  document.getElementById("wl-list").classList.toggle("on", !board);
  document.getElementById("wl-board").classList.toggle("on", board);
  var needs = state.runs.filter(function (r) { return r.ownership === "needs_you"; }).length;
  var working = state.runs.filter(function (r) { return r.ownership === "working"; }).length;
  var done = state.runs.filter(function (r) { return r.ownership === "done"; }).length;
  document.getElementById("work-sum").textContent = state.runs.length
    ? needs + " need you · " + working + " working · " + done + " done" : "";
  // The traversal order (j/k, ⌥L) is exactly the order rows are painted in — the
  // active layout's renderer rebuilds it so the keyboard always matches the eye.
  state.workOrder = [];
  if (board) renderBoard();
  else renderWorkList();
  renderDetail();
}

function workRow(run) {
  var needsYou = run.ownership === "needs_you";
  var row = h("div", "wrow" + (needsYou ? " attn" : "") + (state.selected === run.id ? " sel" : ""));
  row.setAttribute("data-run", run.id);
  row.tabIndex = 0;
  var g = glyphFor(run);
  row.appendChild(h("span", "glyph " + g[1], g[0]));
  var mid = h("div");
  mid.appendChild(h("div", "qt", needsYou ? decisionText(run) : run.intent));
  var atoms = h("div", "qatoms");
  atoms.appendChild(h("span", "atom", run.agent));
  if (run.display_state === "ready") atoms.appendChild(h("span", "atom jade", "awaiting merge"));
  if (run.stale) atoms.appendChild(h("span", "atom hot", "process gone"));
  if (run.display_state === "failed" && !run.stale) atoms.appendChild(h("span", "atom hot", "checks failed"));
  if (run.ownership === "working" && run.activity) {
    atoms.appendChild(h("span", "atom", readableLabel(run.activity.last_label) + " · " + run.activity.actions + " actions"));
  }
  // What actually changed, so the decision can be made HERE. A row that only
  // repeats the intent asks you to go and find out somewhere else.
  if (run.claim_summary) atoms.appendChild(h("span", "atom", run.claim_summary));
  if (run.blast && run.blast.dependents > 0) {
    atoms.appendChild(h("span", "atom" + (run.blast.dependents >= 5 ? " hot" : ""),
      run.blast.dependents + " dependent" + (run.blast.dependents === 1 ? "" : "s")));
  }
  var cost = costLabel(run);
  if (cost && run.ownership !== "working") atoms.appendChild(h("span", "atom", cost));
  mid.appendChild(atoms);
  // The question answers where it is asked. Delivery is reported with the kernel's
  // own vocabulary, never assumed.
  if (run.display_state === "blocked") {
    var answer = h("div", "qanswer");
    if (isPlanApproval(run)) {
      var approveRow = h("button", "btn primary sm", "Approve");
      approveRow.onclick = function (ev) { ev.stopPropagation(); tellRun(run.id, "approved — proceed as planned"); };
      answer.appendChild(approveRow);
    }
    var field = document.createElement("input");
    field.type = "text";
    field.placeholder = isPlanApproval(run) ? "Or answer with a revision…" : "Answer the agent…";
    field.onclick = function (ev) { ev.stopPropagation(); };
    field.onkeydown = function (ev) {
      ev.stopPropagation();
      if (ev.key !== "Enter" || !field.value.trim()) return;
      var msg = field.value.trim();
      field.disabled = true;
      tellRun(run.id, msg);
    };
    answer.appendChild(field);
    mid.appendChild(answer);
  }
  row.appendChild(mid);
  var right = h("div", "qact");
  right.appendChild(h("span", "qtime", ago(run.updated_at)));
  if (run.display_state === "ready") {
    var acts = h("div", "qbtns");
    var pending = pendingActions[run.id];
    var merge = h("button", "btn primary sm", pending || "Merge");
    merge.title = "Land the code and ratify what it learned";
    if (pending) merge.disabled = true;
    merge.onclick = function (ev) {
      ev.stopPropagation();
      actOnRun(run.id, "merge", null, "Merging…", "merged");
    };
    acts.appendChild(merge);
    right.appendChild(acts);
  }
  row.appendChild(right);
  row.onclick = function () { selectRun(run.id); };
  row.onkeydown = function (ev) {
    if (ev.target !== row) return;
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      ev.stopPropagation();
      selectRun(run.id);
      focusPrimary();
    }
  };
  return row;
}

function renderWorkList() {
  var listWrap = document.getElementById("run-list");
  // Rebuilding the rows collapses the scroll container for a frame; restoring the
  // offset afterwards is what keeps a refresh from yanking the list back to the top.
  var scroller = listWrap.parentNode;
  var keepScroll = scroller.scrollTop;
  listWrap.textContent = "";
  renderHandover();
  renderGoalCards();
  // Sections ordered by what it COSTS to ignore, not by when it happened: a blocked
  // run holds a worktree hostage, a lost one may need re-dispatching, a ready one is
  // only waiting for a click — and everything else is either working or history.
  var sections = [
    ["Asks you", function (r) { return r.display_state === "blocked"; }],
    ["Needs a decision", function (r) { return r.ownership === "needs_you" && r.display_state !== "blocked" && r.display_state !== "ready"; }],
    ["Ready to merge", function (r) { return r.display_state === "ready"; }],
    ["Working", function (r) { return r.ownership === "working"; }],
    ["Done", function (r) { return r.ownership === "done"; }],
  ];
  sections.forEach(function (spec) {
    var members = state.runs.filter(spec[1]);
    // Finished goals collapse into this same section as one quiet row each — they are
    // not runs, so they never enter the ownership/display_state filters above.
    var doneGoals = spec[0] === "Done"
      ? (state.goals || []).filter(function (g) { return g.state === "done" || g.state === "abandoned"; })
      : [];
    if (!members.length && !doneGoals.length) return;
    members.sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); });
    var capped = spec[0] === "Done" && !state.showAllDone && members.length > 8;
    var shown = capped ? members.slice(0, 8) : members;
    var head = h("div", "lgroup", spec[0]);
    head.appendChild(h("em", "", String(members.length + doneGoals.length)));
    listWrap.appendChild(head);
    shown.forEach(function (run) {
      listWrap.appendChild(workRow(run));
      state.workOrder.push(run.id);
    });
    doneGoals.forEach(function (goal) { listWrap.appendChild(goalDoneRow(goal)); });
    if (capped) {
      var more = h("button", "showmore", "show all " + members.length + " done");
      more.onclick = function () { state.showAllDone = true; renderWork(); };
      listWrap.appendChild(more);
    }
  });
  if (!state.runs.length) {
    listWrap.appendChild(emptyBlock(
      "No runs yet",
      "A run is one delegated job: Kage briefs an agent from repo memory, it works in its own worktree, and the kernel re-runs your checks before you see a result.",
      "n"));
  }
  scroller.scrollTop = keepScroll;
}

// Selection is a real model: one selected run, whichever arrangement painted it.
// Selecting never navigates — the detail is already beside you (list) or slides
// over (board). openRun is the external jump (rail, palette, notifications).
function selectRun(id) {
  var changed = state.selected !== id;
  // A take-over pins the detail pane to ITS run's terminal until you Hand Back —
  // selecting a different run leaves that pane behind, so close it first rather than
  // showing the wrong run's terminal under a newly-selected row.
  if (changed && state.runTerminalActive && state.runTermRunId !== id) closeRunTerminal();
  state.selected = id;
  if (changed) { state.tab = "follow"; state.detail = null; state.collapsedDiff = {}; state.expandedGroups = {}; }
  if (state.workLayout === "board") state.dover = true;
  renderWork();
  api("/runs/" + id).then(function (detail) {
    if (state.selected !== id) return;
    state.detail = detail.ok ? detail : null;
    renderWork();
    loadTabText(id);
  });
}

function moveSelection(step) {
  if (!state.workOrder.length) return;
  var at = state.workOrder.indexOf(state.selected);
  var to = at < 0 ? (step > 0 ? 0 : state.workOrder.length - 1) : at + step;
  if (to < 0 || to >= state.workOrder.length) return;
  selectRun(state.workOrder[to]);
  var row = document.querySelector('[data-run="' + state.workOrder[to] + '"]');
  if (row && row.scrollIntoView) row.scrollIntoView({ block: "nearest" });
}

// Enter lands where the selected run actually needs you: a blocked run's answer
// field, else the steer composer in the detail.
function focusPrimary() {
  var run = state.runs.filter(function (r) { return r.id === state.selected; })[0];
  if (!run) return;
  if (run.display_state === "blocked") {
    var field = document.querySelector('.wrow[data-run="' + run.id + '"] .qanswer input');
    if (field) { field.focus(); return; }
  }
  var steer = document.getElementById("steer-input");
  if (steer) steer.focus();
}

function setWorkLayout(layout) {
  state.workLayout = layout;
  state.dover = false;
  try { localStorage.setItem("kageLayout", layout); } catch (e) {}
  renderWork();
}
document.getElementById("wl-list").onclick = function () { setWorkLayout("list"); };
document.getElementById("wl-board").onclick = function () { setWorkLayout("board"); };

function renderHandover() {
  var el = document.getElementById("handover");
  var last = null;
  try { last = localStorage.getItem("kageLastSeen"); } catch (e) {}
  if (!last) { el.style.display = "none"; try { localStorage.setItem("kageLastSeen", new Date().toISOString()); } catch (e) {} return; }
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
  dismiss.onclick = function () { try { localStorage.setItem("kageLastSeen", new Date().toISOString()); } catch (e) {} render(); };
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
  if (merged) line("✓", "jade", merged + " merged, verified", "receipts below");
  if (!merged && !lost) line("·", "dim", held + " arrived while you were away", "below");
}

// --- goal cards: the manager's own bookkeeping for a multi-run intent, rendered
// above the triaged list. A goal never executes anything itself — every power
// (merge, steer, reject) still attaches to the runs it owns, same as any other row.
function goalWaveTone(runId) {
  var run = state.runs.filter(function (r) { return r.id === runId; })[0];
  return run ? glyphFor(run) : ["·", "dim"];
}
function goalSpendLabel(goal) {
  var total = 0;
  var any = false;
  (goal.plan.waves || []).forEach(function (wave) {
    wave.run_ids.forEach(function (runId) {
      var run = state.runs.filter(function (r) { return r.id === runId; })[0];
      if (run && run.spend && run.spend.usd_est) { total += run.spend.usd_est; any = true; }
    });
  });
  if (!any) return null;
  return total >= 0.995 ? "$" + total.toFixed(2) : "$" + total.toFixed(total < 0.01 ? 3 : 2).replace(/^\$0/, "$0");
}
function abandonGoalClick(goal) {
  if (!window.confirm("Abandon “" + goal.intent + "”? Its runs are not touched — only the goal stops tracking them.")) return;
  api("/goals/" + goal.id + "/abandon", { method: "POST" }).then(function (out) {
    if (!out.ok) { showError(out.error || "could not abandon the goal"); return; }
    flash("goal abandoned");
    refresh();
  });
}
function goalCard(goal) {
  var card = h("div", "card goal-card");
  card.id = "goal-" + goal.id;
  var head = h("div", "ghead");
  head.appendChild(h("div", "gt", goal.intent));
  head.appendChild(h("span", "chip state-" + goal.state, goal.state));
  card.appendChild(head);

  var waves = goal.plan.waves || [];
  var started = waves.filter(function (w) { return w.run_ids.length > 0; }).length;
  card.appendChild(h("div", "gwaveline",
    waves.length ? "wave " + Math.min(started || 1, waves.length) + " of " + waves.length : "no plan yet"));
  waves.forEach(function (wave) {
    var row = h("div", "gwave");
    if (!wave.run_ids.length) row.appendChild(h("span", "gwchip dim", "·"));
    wave.run_ids.forEach(function (runId) {
      var tone = goalWaveTone(runId);
      var found = state.runs.filter(function (r) { return r.id === runId; })[0];
      var chip = h("span", "gwchip " + tone[1], tone[0]);
      chip.title = found ? found.intent : runId;
      if (found) chip.onclick = function () { selectRun(runId); };
      row.appendChild(chip);
    });
    card.appendChild(row);
  });

  var foot = h("div", "gfoot");
  var spend = goalSpendLabel(goal);
  if (spend) foot.appendChild(h("span", "atom", spend));
  var abandon = h("button", "btn danger sm", "Abandon");
  abandon.onclick = function () { abandonGoalClick(goal); };
  foot.appendChild(abandon);
  card.appendChild(foot);
  return card;
}
function goalDoneRow(goal) {
  var row = h("div", "wrow goal-done");
  row.appendChild(h("span", "glyph dim", goal.state === "abandoned" ? "✕" : "✓"));
  var mid = h("div");
  mid.appendChild(h("div", "qt", goal.intent));
  var atoms = h("div", "qatoms");
  atoms.appendChild(h("span", "atom", goal.state));
  var waveCount = (goal.plan.waves || []).length;
  atoms.appendChild(h("span", "atom", waveCount + " wave" + (waveCount === 1 ? "" : "s")));
  mid.appendChild(atoms);
  row.appendChild(mid);
  return row;
}
function renderGoalCards() {
  var wrap = document.getElementById("goal-cards");
  if (!wrap) return;
  wrap.textContent = "";
  var active = (state.goals || []).filter(function (g) { return g.state === "planning" || g.state === "executing"; });
  active.forEach(function (goal) { wrap.appendChild(goalCard(goal)); });
}
// The run detail's goal chip lands here: switch out of Board (goal cards only live
// in the List layout, same footprint as the handover banner) and flash the card so
// the click actually reads as "landed", not just a silent scroll.
function jumpToGoalCard(goalId) {
  if (state.workLayout === "board") setWorkLayout("list");
  var el = document.getElementById("goal-" + goalId);
  if (!el) return;
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  el.classList.add("flash-hi");
  setTimeout(function () { el.classList.remove("flash-hi"); }, 900);
}

// --- room: the conversation. askManager's tool names arrive as "mcp__kage__kage_dispatch";
// the trailer strips the MCP prefix so a non-technical reader sees "dispatch", not plumbing.
// Activity labels arrive with ABSOLUTE paths, because that is what the agent actually
// ran. Rendered raw and ellipsised they became "reading /private/tmp/claude-501/-Users-
// kushaljain-c…" on every line — the live feed was technically working and completely
// unreadable. Worktrees live under a temp dir, so the interesting part is always the
// tail: show the path relative to the repo, and shorten a long command to its verb and
// target rather than its first 40 characters.
// Deliberately no regex: this whole file is one TS template literal, so every
// backslash would need doubling and a mis-escaped character class silently compiles
// to something else (the parse gate caught exactly that here). Splitting on
// whitespace is clearer and cannot be mangled by the template.
function readableLabel(text) {
  return String(text || "")
    .split(" ")
    .map(function (word) {
      if (word.indexOf("/") < 0) return word;
      var parts = word.split("/").filter(Boolean);
      if (!parts.length) return word;
      // Prefer the last segment that looks like a FILE. Worktree paths end in a long
      // generated directory name, so "last segment" alone still produced
      // "claude-501/-Users-kushaljain-code-Kage…" — a path with no information in it.
      var fileAt = -1;
      for (var i = parts.length - 1; i >= 0; i -= 1) {
        if (parts[i].indexOf(".") > 0) { fileAt = i; break; }
      }
      if (fileAt < 0) {
        // No filename at all: this is a directory. Its own name is the useful part.
        var dir = parts[parts.length - 1];
        return dir.length > 28 ? dir.slice(0, 27) + "…" : dir;
      }
      var file = parts[fileAt];
      var parent = fileAt > 0 ? parts[fileAt - 1] : "";
      return parent && parent.length <= 14 ? parent + "/" + file : file;
    })
    .join(" ");
}

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
// How many turns have ever been painted, and a cheap fingerprint of what was last
// painted — see renderRoom for why both exist (defect: continuous shimmer).
var roomPaintedCount = 0;
var roomSignature = "";
// A literal backtick would terminate this outer template literal, so inline code
// spans are found by splitting on the character value instead of writing one.
var BACKTICK = String.fromCharCode(96);

// What is running right now, shown in the Room. It answers the question the Room
// could not: you asked Kage to do something, an agent is doing it — where is it?
// Clicking a row takes you to that run's live feed.
function renderLiveRail() {
  var rail = document.getElementById("liverail");
  if (!rail) return;
  rail.textContent = "";
  var live = state.runs.filter(function (r) {
    return ["running", "dispatched", "verifying"].indexOf(r.display_state) >= 0;
  });
  var waiting = state.runs.filter(function (r) { return r.display_state === "blocked" || r.display_state === "ready"; });
  var all = live.concat(waiting);
  all.slice(0, 4).forEach(function (run) {
    var row = h("div", "liverow");
    var working = ["running", "dispatched", "verifying"].indexOf(run.display_state) >= 0;
    if (working) row.appendChild(h("span", "dot"));
    row.appendChild(h("span", "la", working ? (run.display_state === "verifying" ? "verifying" : "working") :
      (run.display_state === "ready" ? "ready" : "asks you")));
    row.appendChild(h("span", "li", run.intent));
    // The live activity line is the whole point — say what it is doing, not just that
    // it is doing something.
    if (run.activity && run.activity.last_label) row.appendChild(h("span", "lg", readableLabel(run.activity.last_label)));
    row.onclick = function () { openRun(run.id); };
    rail.appendChild(row);
  });
  // Never imply four is all of it. Twenty runs needing a human, showing four, with no
  // hint of the rest is the app quietly hiding work from you.
  if (all.length > 4) {
    var more = h("button", "railmore", "+" + (all.length - 4) + " more waiting — open Work");
    more.onclick = function () { setView("work"); };
    rail.appendChild(more);
  }
}

// The typing indicator is the one thing an in-flight SSE delta is allowed to touch
// directly — split out so the delta handler never has to call renderRoom (that was
// the whole-column rebuild that shimmered on every streamed token).
function updateRoomTyping() {
  var typingEl = document.getElementById("room-typing");
  var lastDelta = state.roomStreaming.length ? state.roomStreaming[state.roomStreaming.length - 1] : null;
  typingEl.style.display = state.room.busy ? "flex" : "none";
  document.getElementById("room-typing-text").textContent =
    lastDelta ? (lastDelta.kind === "tool" ? toolLabel(lastDelta.text) + "…" : lastDelta.text.slice(0, 60)) : "thinking";
}

// Kage speaks markdown; the room rendered it as literal asterisks and backticks.
// This is a tiny SAFE renderer for kage turns only — bold segments and inline code —
// built from real DOM nodes, never from HTML strings, by splitting the string and
// appending each piece as its own node.
function appendMarkdownInline(container, text) {
  text.split(BACKTICK).forEach(function (codePart, i) {
    if (i % 2 === 1) {
      if (codePart.length) container.appendChild(h("code", "turn-code", codePart));
      return;
    }
    codePart.split("**").forEach(function (part, j) {
      if (!part.length) return;
      if (j % 2 === 1) container.appendChild(h("strong", null, part));
      else container.appendChild(document.createTextNode(part));
    });
  });
}
function renderTurnBubble(text) {
  var bubble = h("div", "bubble2");
  var paras = String(text || "").split("\\n\\n").filter(function (p) { return p.length > 0; });
  (paras.length ? paras : [""]).forEach(function (para) {
    var p = h("div", "turn-para");
    appendMarkdownInline(p, para);
    bubble.appendChild(p);
  });
  return bubble;
}

// The kernel's redaction guard tells you to read the card, not the summary — this
// finds which run(s) a kage turn is talking about so that card can exist. Run ids
// are slugs (hyphens are part of the id, not a delimiter), so tokenizing splits on
// whitespace and punctuation only, never on a regex.
function tokenizeText(text) {
  var delims = [" ", "\\n", "\\t", ",", ".", ";", ":", "!", "?", "(", ")", "\\"", "'", "[", "]", "{", "}", "<", ">", "*"];
  // Backtick can't appear as a literal in this TS template literal; append it via charCode.
  delims.push(String.fromCharCode(96));
  var tokens = [String(text || "")];
  delims.forEach(function (d) {
    var next = [];
    tokens.forEach(function (t) { next = next.concat(t.split(d)); });
    tokens = next;
  });
  return tokens.filter(function (t) { return t.length > 0; });
}
function runsMentionedIn(text) {
  var byId = {};
  state.runs.forEach(function (r) { byId[r.id] = r; });
  var seen = {};
  var found = [];
  tokenizeText(text).forEach(function (t) {
    if (byId[t] && !seen[t]) { seen[t] = true; found.push(byId[t]); }
  });
  return found;
}
// Compact inline run card: kernel facts only — state, intent, claim summary, cost.
// Never re-decided here, only rendered, same as every other run surface.
function turnRunCard(run) {
  var card = h("div", "turn-runcard");
  var g = glyphFor(run);
  card.appendChild(h("span", "glyph " + g[1], g[0]));
  var mid = h("div", "turn-runcard-mid");
  var chips = h("div", "chips");
  chips.appendChild(h("span", "chip state-" + run.display_state, run.display_state));
  var cost = costLabel(run);
  if (cost) chips.appendChild(h("span", "chip", cost));
  mid.appendChild(chips);
  mid.appendChild(h("div", "turn-runcard-intent", run.intent));
  if (run.claim_summary) mid.appendChild(h("div", "atom", run.claim_summary));
  card.appendChild(mid);
  card.onclick = function () { openRun(run.id); };
  return card;
}

function renderRoom() {
  var turns = state.room.turns || [];
  var last = turns.length ? turns[turns.length - 1] : null;
  var linkedCount = Object.keys(roomLinkedRuns).length;
  // A cheap fingerprint of what would be painted. refreshRoom polls every 15s and
  // refresh() every 30s, and neither implies the transcript actually changed — every
  // rebuild replayed the .turn entry animation on every existing turn, so the whole
  // thread shimmered continuously. Skip the rebuild entirely when nothing moved.
  var signature = turns.length + "|" + (last ? last.text.length : 0) + "|" +
    (state.room.busy ? "1" : "0") + "|" + linkedCount;

  updateRoomTyping();
  document.getElementById("room-send").disabled = state.room.busy;
  if (signature === roomSignature) return;
  roomSignature = signature;

  var scroll = document.querySelector("#v-room .room-scroll");
  var wasAtBottom = scroll && scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
  var turnsEl = document.getElementById("room-turns");
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
    // The entry animation is for turns arriving right now — replaying it on turns
    // that were already on screen is exactly what made the thread shimmer.
    var wrap = h("div", "turn " + turn.role + (index >= roomPaintedCount ? " turn-new" : ""));
    // Say who is speaking. Alignment alone carried it before, which meant a transcript
    // you had to decode rather than read.
    wrap.appendChild(h("div", "who", turn.role === "you" ? "You" : "Kage"));
    wrap.appendChild(turn.role === "kage" ? renderTurnBubble(turn.text) : h("div", "bubble2", turn.text));
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
    // The redaction guard above dangled without this: it says "read the card", and
    // until now the room rendered no card at all.
    if (turn.role === "kage") {
      runsMentionedIn(turn.text).forEach(function (run) { wrap.appendChild(turnRunCard(run)); });
    }
    turnsEl.appendChild(wrap);
  });
  roomPaintedCount = turns.length;

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
  // Green on what Kage saved you — the site reserves it for gains and primary action.
  figs.appendChild(fig(num(v.packets), "memories written", "verified against the repo", "jade"));
  figs.appendChild(fig(num(v.recalls), "recalls served", v.recalls ? "answered from memory" : "none yet", v.recalls ? "jade" : null));
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
function sendPacketFeedback(id, kind, button) {
  var msg = document.getElementById("packet-msg");
  msg.textContent = "";
  api("/memory/feedback", { method: "POST", body: { id: id, kind: kind } }).then(function (out) {
    // Report what the kernel actually recorded — the surface never claims a write it
    // did not get confirmation for.
    if (!out.ok) { msg.textContent = out.error || "could not record that"; return; }
    msg.textContent = kind === "helpful" ? "Recorded — thanks." : "Recorded. Kage will weigh this down in recall.";
    if (button) button.classList.add("primary");
    loadMemory();
  }).catch(function () { msg.textContent = "could not record that"; });
}
// The flywheel section of a packet: the run that taught it, and the runs its
// knowledge was briefed into. This is the compounding loop as NAVIGATION — click
// through to the run, read its receipt, come back. Old runs recorded no edges,
// so the section simply is not there for them.
function renderPacketFlywheel(el, out) {
  el.textContent = "";
  var born = out.born_from_run;
  var used = out.used_by_runs || [];
  if (!born && !used.length) { el.style.display = "none"; return; }
  el.style.display = "block";
  function runRow(label, run) {
    var row = h("div", "flyrow");
    row.appendChild(h("span", "fk", label));
    row.appendChild(h("span", "fv", run.intent));
    var g = glyphFor(run);
    row.appendChild(h("span", "fs " + g[1], run.display_state));
    row.onclick = function () {
      document.getElementById("packet-overlay").classList.remove("on");
      openRun(run.id);
    };
    el.appendChild(row);
  }
  if (born) runRow("taught by", born);
  used.forEach(function (run) { runRow("briefed into", run); });
}

function openPacket(id) {
  var overlay = document.getElementById("packet-overlay");
  document.getElementById("packet-title").textContent = "Loading…";
  document.getElementById("packet-body").textContent = "";
  document.getElementById("packet-flywheel").style.display = "none";
  overlay.classList.add("on");
  Array.prototype.forEach.call(overlay.querySelectorAll("[data-fb]"), function (button) {
    button.classList.remove("primary");
    button.onclick = function () { sendPacketFeedback(id, button.getAttribute("data-fb"), button); };
  });
  document.getElementById("packet-msg").textContent = "";
  api("/memory/" + encodeURIComponent(id)).then(function (out) {
    document.getElementById("packet-title").textContent = out.ok ? out.title : "Not found";
    document.getElementById("packet-body").textContent = out.ok ? out.body : (out.error || "");
    renderPacketFlywheel(document.getElementById("packet-flywheel"), out.ok ? out : {});
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
        // Deleting a transcript is irreversible — a hover title is not a warning.
        if (!window.confirm("Close “" + session.title + "”? Its transcript is deleted — there is no undo.")) return;
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
  // The painted-count and signature belong to whichever thread's turns were last
  // rendered — carrying them over would either skip a real rebuild (stale signature
  // coincidentally matching) or paint the new thread's turns as "already seen".
  roomPaintedCount = 0;
  roomSignature = "";
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

// ⌘⏎: skip the manager and dispatch this text as a run right now, configured by the
// pickers below the box — which is what finally makes those pickers REAL controls.
// Until this existed they were read by nothing on the Room's path: pick "Codex",
// send, and the manager did whatever it liked. A decorative control teaches the user
// that the UI's promises are unreliable, which is fatal in a product about trust.
function dispatchFromComposer() {
  var input = document.getElementById("room-input");
  var intent = input.value.trim();
  if (!intent) return;
  input.value = "";
  autoGrow(input);
  schedulePreflight("", "room-preflight");
  api("/runs", { method: "POST", body: { intent: intent, agent: composerPrefs.agent, type: composerPrefs.type } })
    .then(function (out) {
      if (!out.ok) { showError(out.error || "dispatch failed"); input.value = intent; return; }
      flash("dispatched — watch the rail above");
      refresh();
    });
}

// ⌥⏎: a third composer path, for intent too large for one run. Creates the goal
// record first, then sends the SAME text to the manager (the room's own path,
// sendRoomMessage) prefixed with the new goal's id — the manager's constitution
// reads that prefix and proposes a wave decomposition back in chat.
function createGoalFromComposer() {
  var input = document.getElementById("room-input");
  var intent = input.value.trim();
  if (!intent || state.room.busy) return;
  api("/goals", { method: "POST", body: { intent: intent } }).then(function (out) {
    if (!out.ok) { showError(out.error || "could not create the goal"); return; }
    flash("goal created — the manager is decomposing it");
    input.value = "[goal " + out.goal.id + "] " + intent;
    sendRoomMessage();
    refresh();
  });
}

// --- pre-flight forecast: risk before the work exists.
// While you type an intent, the composer asks the kernel what the BRIEF would
// carry (memory + predicted touch set) and what imports that predicted area —
// the receipt's blast radius, asked before any diff exists. Rendered as one
// quiet line and always labeled a forecast; when memory and the graph have
// nothing to say, the line stays hidden rather than predicting from nothing.
var preflightTimers = {};
var preflightSeqs = {};
function shortPath(path) {
  var parts = String(path).split("/").filter(Boolean);
  return parts.length <= 2 ? parts.join("/") : parts.slice(-2).join("/");
}
function renderPreflight(el, forecast) {
  el.textContent = "";
  if (!forecast) { el.style.display = "none"; return; }
  var touches = forecast.touches || [];
  if (touches.length) {
    var where = touches.slice(0, 2).map(shortPath).join(", ");
    el.appendChild(h("span", "", "lands near " + where + (touches.length > 2 ? " +" + (touches.length - 2) : "")));
  }
  if (forecast.blast && forecast.blast.dependents > 0) {
    el.appendChild(h("span", forecast.blast.dependents >= 5 ? "pf-hot" : "",
      forecast.blast.dependents + " file" + (forecast.blast.dependents === 1 ? "" : "s") + " depend on that area"));
  }
  if (forecast.memories) {
    el.appendChild(h("span", "pf-mem",
      forecast.memories + " " + (forecast.memories === 1 ? "memory" : "memories") + " will ride in the brief"));
  }
  if (!el.children.length) { el.style.display = "none"; return; }
  el.appendChild(h("span", "pf-tag", "forecast"));
  el.style.display = "flex";
}
function schedulePreflight(text, targetId, type) {
  var el = document.getElementById(targetId);
  if (!el) return;
  if (preflightTimers[targetId]) clearTimeout(preflightTimers[targetId]);
  var trimmed = String(text || "").trim();
  // A few characters is a keystroke, not an intent.
  if (trimmed.length < 12) { renderPreflight(el, null); return; }
  preflightTimers[targetId] = setTimeout(function () {
    preflightSeqs[targetId] = (preflightSeqs[targetId] || 0) + 1;
    var seq = preflightSeqs[targetId];
    fetch("/preflight?intent=" + encodeURIComponent(trimmed) + "&type=" + encodeURIComponent(type || "chore"))
      .then(function (res) { return res.json(); })
      .then(function (out) {
        // A stale response must never paint over a newer intent's forecast.
        if (seq !== preflightSeqs[targetId]) return;
        renderPreflight(el, out && out.ok ? out.forecast : null);
      })
      .catch(function () {});
  }, 450);
}

function sendRoomMessage() {
  var input = document.getElementById("room-input");
  var message = input.value.trim();
  if (!message || state.room.busy) return;
  input.value = "";
  autoGrow(input);
  schedulePreflight("", "room-preflight");
  state.room.busy = true;
  state.roomStreaming = [];
  renderRoom();
  api("/room/message?session=" + encodeURIComponent(state.session), { method: "POST", body: { message: message } }).then(function (out) {
    if (!out.ok) { state.room.busy = false; renderRoom(); showError(out.error || "the room did not accept that message"); return; }
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
var composerPrefs = { agent: "claude", type: "chore" };
try {
  var savedPrefs = JSON.parse(localStorage.getItem("kageComposer") || "{}");
  if (savedPrefs && typeof savedPrefs === "object") {
    composerPrefs.agent = savedPrefs.agent || composerPrefs.agent;
    composerPrefs.type = savedPrefs.type || composerPrefs.type;
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
        // A different run type can change the forecast's confidence basis.
        schedulePreflight(document.getElementById("room-input").value, "room-preflight", composerPrefs.type);
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
    // xterm needs literals, not CSS variables — these are --code-bg/--code-text.
    theme: { background: "#0e1110", foreground: "#cfe0d4", cursor: "#43c98a" },
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
  if (state.runTerminalActive && runFitAddon) {
    runFitAddon.fit();
    sendRunResize();
  }
});

// --- take over: a SEPARATE real pty from the room's, one per taken-over run, so a
// run terminal and the room terminal never share a screen or a session key. Mirrors
// the room's own terminal machinery (same repaint ladder, same reasons) — see above.
var runTerm = null;
var runFitAddon = null;

function sendRunResize() {
  if (!runTerm || !state.runTermRunId) return;
  api("/runs/" + state.runTermRunId + "/pty/resize", { method: "POST", body: { cols: runTerm.cols, rows: runTerm.rows } });
}
function repaintRunTerminal() {
  if (!runTerm) return;
  [60, 250, 600].forEach(function (delay) {
    setTimeout(function () {
      if (!runTerm) return;
      if (runFitAddon) runFitAddon.fit();
      sendRunResize();
      runTerm.refresh(0, runTerm.rows - 1);
    }, delay);
  });
}
function ensureRunTerminal() {
  if (runTerm) return;
  if (!window.Terminal || !window.FitAddon) {
    document.getElementById("run-term").textContent = "Terminal assets failed to load — check /vendor/xterm.js.";
    return;
  }
  runTerm = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    theme: { background: "#0e1110", foreground: "#cfe0d4", cursor: "#43c98a" },
    convertEol: true,
  });
  runFitAddon = new FitAddon.FitAddon();
  runTerm.loadAddon(runFitAddon);
  runTerm.open(document.getElementById("run-term"));
  runFitAddon.fit();
  runTerm.onData(function (data) {
    if (!state.runTermRunId) return;
    api("/runs/" + state.runTermRunId + "/pty/write", { method: "POST", body: { data: data } });
  });
  // Priming (fetching the snapshot) is the caller's job, not creation's — openRunTerminal
  // always primes explicitly, whether this is the terminal's first creation or a reuse
  // for a different run.
}
function primeRunTerminal() {
  var asked = state.runTermRunId;
  if (!asked) return;
  api("/runs/" + asked + "/pty/snapshot").then(function (out) {
    if (asked !== state.runTermRunId) return;
    if (out && out.scrollback && runTerm) runTerm.write(out.scrollback);
    repaintRunTerminal();
  });
}
function openRunTerminal(runId) {
  // A second take-over reuses the SAME xterm instance for a different run — reset its
  // screen first, or the new session's bytes would paint on top of the old run's.
  if (runTerm && state.runTermRunId !== runId) runTerm.reset();
  state.runTerminalActive = true;
  state.runTermRunId = runId;
  document.getElementById("run-term-run").textContent = runId;
  document.getElementById("run-detail").style.display = "none";
  document.getElementById("run-term-pane").style.display = "flex";
  // Same reason as the room's terminal: build/prime only after the pane is laid out,
  // via a macrotask (not rAF, which never fires for a hidden/background tab).
  setTimeout(function () {
    ensureRunTerminal();
    primeRunTerminal();
    repaintRunTerminal();
    if (runTerm) runTerm.focus();
  }, 0);
}
function closeRunTerminal() {
  state.runTerminalActive = false;
  state.runTermRunId = null;
  document.getElementById("run-term-pane").style.display = "none";
  document.getElementById("run-detail").style.display = "flex";
  renderDetail();
}
function takeOverRun(runId) {
  api("/runs/" + runId + "/takeover", { method: "POST" }).then(function (out) {
    if (!out.ok) { showError(out.error || "take over failed"); return; }
    openRunTerminal(runId);
    refresh();
  });
}
function handBackRun(runId) {
  api("/runs/" + runId + "/handback", { method: "POST" }).then(function (out) {
    if (!out.ok) showError(out.error || "hand back failed");
    closeRunTerminal();
    refresh();
  });
}
document.getElementById("run-term-handback").onclick = function () { handBackRun(state.runTermRunId); };

// The receipt, composed from the claim's STRUCTURED fields.
//
// This previously re-rendered renderClaimCard()'s output — a string formatted for a
// TERMINAL — inside the GUI, which is exactly why it read as a log dump: box-drawing
// glyphs, and absolute evidence paths wrapping mid-path across three lines. The same
// facts are already available as data (checks[], diff, unsure, learnings), so the GUI
// composes its own presentation and the CLI keeps its own. One source of truth, two
// honest renderings — instead of one rendering pretending to work in both places.
function renderReceipt(bodyOuter, claim, run, verdict, taught) {
  // The receipt is the one artifact neither competitor has — the kernel's proof of
  // work — and it used to render as grey monospace rows, indistinguishable from a
  // debug dump. It is now a designed object: the site's own tokens say terminals
  // stay dark in both schemes "like a printed receipt", so the receipt IS one.
  var body = h("div", "paper-receipt");
  bodyOuter.appendChild(body);
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

  // An unverifiable claim should say HOW to become verifiable, in the receipt itself.
  // "Nothing was executed" with no next step strands the user; the fix is one setting.
  var hasCommandCheck = checks.some(function (c) { return c.kind === "command" || c.id === "tests"; });
  if (!hasCommandCheck) {
    var fixit = h("div", "rc-fixit");
    fixit.appendChild(document.createTextNode("No test command is configured, so nothing can be executed to verify claims. Set one in "));
    var link = h("button", "rc-fixlink", "Settings");
    link.onclick = function () { showSettings(true); };
    fixit.appendChild(link);
    fixit.appendChild(document.createTextNode("."));
    body.appendChild(fixit);
  }
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

  // The bill: what it touched, what depends on it, what it cost, how long it took.
  var totals = h("div", "rc-totals");
  function totalRow(label, value, tone) {
    if (value === null || value === undefined || value === "") return;
    var row = h("div", "rc-row" + (tone ? " " + tone : ""));
    row.appendChild(h("span", "rc-k", label));
    row.appendChild(h("span", "rc-dots"));
    row.appendChild(h("span", "rc-v", value));
    totals.appendChild(row);
  }
  if (claim.diff) {
    totalRow("change", claim.diff.files + " file" + (claim.diff.files === 1 ? "" : "s") + " · " +
      claim.diff.lines + " line" + (claim.diff.lines === 1 ? "" : "s"));
  }
  if (run && run.blast) {
    totalRow("dependents", run.blast.dependents === 0 ? "none" :
      run.blast.dependents + " file" + (run.blast.dependents === 1 ? "" : "s"),
      run.blast.dependents >= 5 ? "hot" : "");
  }
  var rcost = run ? costLabel(run) : null;
  if (rcost) totalRow("cost", rcost);
  if (run && run.spend && run.spend.minutes) totalRow("time", run.spend.minutes + " min");
  if (totals.children.length) body.appendChild(totals);

  if ((claim.unsure || []).length) {
    body.appendChild(h("div", "seclabel-sm", "The agent flagged"));
    claim.unsure.forEach(function (u) {
      var row = h("div", "note-row unsure");
      row.appendChild(h("span", "ic", "⚠"));
      row.appendChild(h("span", "", u));
      body.appendChild(row);
    });
  }

  // Once ratified, the learnings ARE packets — show them as the memory they became,
  // each row a door into the Memory view. Before merge, show what WILL be learned.
  if ((taught || []).length) {
    body.appendChild(h("div", "seclabel-sm", "Ratified into memory"));
    taught.forEach(function (packet) {
      var row = h("div", "note-row learn taught");
      row.appendChild(h("span", "ic", "+"));
      row.appendChild(h("span", "t", packet.title));
      row.onclick = function () { openPacket(packet.id); };
      body.appendChild(row);
    });
  } else if ((claim.learnings || []).length) {
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
  // In Board layout the detail is a slide-over — give it a way out that isn't
  // knowing the esc key.
  if (state.workLayout === "board") {
    var close = h("button", "dclose", "✕");
    close.title = "close (esc)";
    close.onclick = function () { state.dover = false; renderWork(); };
    head.appendChild(close);
  }
  head.appendChild(h("h2", "", run.intent));
  var chips = h("div", "chips");
  chips.appendChild(h("span", "chip state-" + run.display_state, run.display_state));
  chips.appendChild(h("span", "chip", shortBranch(run.branch)));
  chips.appendChild(h("span", "chip", run.agent));
  if (run.confidence) chips.appendChild(h("span", "chip", "confidence " + run.confidence.band));
  // What this run actually cost, as the agent CLI itself reported — both competitors
  // show cost; ours only appears when the agent reported real numbers.
  var cost = costLabel(run);
  if (cost) {
    var costChip = h("span", "chip", cost);
    costChip.title = "cost and tokens reported by the agent CLI";
    chips.appendChild(costChip);
  }
  // The code graph's contribution to the merge decision: is the changed code a leaf
  // or load-bearing? Absent entirely when the graph cannot say — never a fake zero.
  if (run.blast) {
    var chip = h("span", "chip" + (run.blast.dependents >= 5 ? " blast-hot" : ""),
      run.blast.dependents === 0 ? "no dependents"
        : run.blast.dependents + " file" + (run.blast.dependents === 1 ? "" : "s") + " depend on this");
    if (run.blast.sample && run.blast.sample.length) chip.title = "imported by " + run.blast.sample.join(", ");
    chips.appendChild(chip);
  }
  var ownerGoal = run.goal_id ? (state.goals || []).filter(function (g) { return g.id === run.goal_id; })[0] : null;
  if (ownerGoal) {
    var goalChip = h("span", "chip goal-chip", "goal: " + ownerGoal.intent);
    goalChip.title = "jump to the goal card";
    goalChip.onclick = function () { jumpToGoalCard(ownerGoal.id); };
    chips.appendChild(goalChip);
  }
  head.appendChild(chips);
  var tabs = h("div", "tabs");
  [["follow", "Follow"], ["queue", "Queue"], ["receipt", "Receipt"], ["diff", "Diff"], ["brief", "Brief"], ["raw", "Raw"]].forEach(function (t) {
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
    if (d.claim) renderReceipt(body, d.claim, run, d.verdict, d.taught);
    else if (d.receipt) body.appendChild(h("div", "rawpane", d.receipt));
    else body.appendChild(h("div", "empty", "No claim yet — the receipt appears when the run finishes."));
  } else if (state.tab === "brief") {
    var briefPane = h("div", "rawpane", d.brief || "no brief recorded");
    body.appendChild(briefPane);
  } else if (state.tab === "diff") {
    if (d.diffText === undefined) body.appendChild(h("div", "empty", "loading diff…"));
    else if (!d.diffText || d.diffText === "no changes yet") body.appendChild(h("div", "empty", "No changes yet."));
    else renderDiff(body, d.diffText);
  } else if (state.tab === "raw") {
    if (d.rawText === undefined) body.appendChild(h("div", "empty", "loading transcript…"));
    else body.appendChild(h("div", "rawpane", d.rawText));
  } else if (state.tab === "queue") {
    renderQueue(body, run.id, d.steers);
  } else {
    if (run.activity) {
      var act = h("div", "activityline");
      act.appendChild(h("span", "pulse", "●"));
      act.appendChild(h("span", "", run.activity.last_label + " · " + run.activity.actions + " actions"));
      body.appendChild(act);
    }
    if (run.waiting_on && isPlanApproval(run)) {
      var plancard = h("div", "plancard");
      plancard.appendChild(h("div", "seclabel-sm", "Plan review — approve, or answer below with a revision"));
      plancard.appendChild(h("div", "rawpane", run.waiting_on.detail || ""));
      var approve = h("button", "btn primary", "Approve");
      approve.onclick = function () { tellRun(run.id, "approved — proceed as planned"); };
      plancard.appendChild(approve);
      body.appendChild(plancard);
    } else if (run.waiting_on) {
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
  input.id = "steer-input";
  input.placeholder = "Message the agent…";
  // Immediate stays the default (Conductor shipped queue-by-default, then reverted):
  // plain ⏎ delivers now unless the toggle is on; ⌘⏎ always queues, regardless.
  input.onkeydown = function (ev) {
    if (ev.key !== "Enter" || !input.value.trim()) return;
    var message = input.value.trim();
    var queueOnly = ev.metaKey || ev.ctrlKey || state.steerQueueMode;
    input.value = "";
    if (queueOnly) {
      api("/runs/" + run.id + "/steers", { method: "POST", body: { op: "add", message: message } }).then(function (out) {
        if (!out.ok) showError(out.error || "the message was not queued");
        else { flash("queued"); if (state.detail) state.detail.steers = out.steers; }
        refresh();
      });
    } else {
      tellRun(run.id, message);
    }
  };
  cwrap.appendChild(input);
  var queueToggle = h("button", "btn sm" + (state.steerQueueMode ? " on" : ""), state.steerQueueMode ? "Queuing" : "Deliver now");
  queueToggle.title = "Toggle whether ⏎ delivers immediately or queues for later — ⌘⏎ always queues";
  queueToggle.onclick = function () { state.steerQueueMode = !state.steerQueueMode; renderDetail(); };
  cwrap.appendChild(queueToggle);
  cwrap.appendChild(h("span", "hint", "⏎ send · ⌘⏎ queue for later · delivery reported honestly"));
  composer.appendChild(cwrap);
  el.appendChild(composer);

  var bar = h("div", "actionbar");
  var pendingLabel = pendingActions[run.id];
  if (run.display_state === "ready") {
    var merge = h("button", "btn primary", pendingLabel || "Merge & ratify");
    if (pendingLabel) merge.disabled = true;
    merge.onclick = function () { actOnRun(run.id, "merge", null, "Merging…", "merged"); };
    bar.appendChild(merge);
  }
  if (["running", "dispatched", "verifying"].indexOf(run.display_state) >= 0) {
    var stop = h("button", "btn", pendingLabel === "Stopping…" ? pendingLabel : "Stop");
    if (pendingLabel) stop.disabled = true;
    stop.onclick = function () { actOnRun(run.id, "stop", null, "Stopping…", "stopped"); };
    bar.appendChild(stop);
    var interrupt = h("button", "btn", pendingLabel === "Interrupting…" ? pendingLabel : "Interrupt — session stays alive");
    interrupt.title = "Unlike Stop, the agent's process and session keep running — it can still be answered.";
    if (pendingLabel) interrupt.disabled = true;
    interrupt.onclick = function () { actOnRun(run.id, "interrupt", null, "Interrupting…", "interrupted"); };
    bar.appendChild(interrupt);
  }
  if (["running", "blocked", "stopped", "failed"].indexOf(run.display_state) >= 0 && !state.runTerminalActive) {
    var takeOverBtn = h("button", "btn", "Take Over");
    takeOverBtn.title = "Open a real terminal on this run's own agent session";
    takeOverBtn.onclick = function () { takeOverRun(run.id); };
    bar.appendChild(takeOverBtn);
  }
  if (["merged", "rejected"].indexOf(run.display_state) < 0) {
    var reject = h("button", "btn danger", "Reject…");
    if (pendingLabel) reject.disabled = true;
    reject.onclick = function () {
      var reason = window.prompt("Why? The reason is kept as memory — the next brief carries it.");
      if (!reason) return;
      actOnRun(run.id, "reject", { reason: reason }, "Rejecting…", "rejected");
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

// Errors persist until dismissed. flash() is a status blip for successes; an error
// that vanishes after a glance is an error the user never saw.
function showError(text) {
  document.getElementById("errbar-text").textContent = String(text || "something failed");
  document.getElementById("errbar").classList.add("on");
}
document.getElementById("errbar-x").onclick = function () {
  document.getElementById("errbar").classList.remove("on");
};

// Optimistic action state that SURVIVES re-renders. Mutating a button in place
// ("Merging…") lasted only until the next SSE re-read rebuilt the row; the state
// now lives outside the DOM and every renderer consults it.
var pendingActions = {};
function actOnRun(runId, action, body, workingLabel, doneLabel) {
  pendingActions[runId] = workingLabel;
  render();
  api("/runs/" + runId + "/" + action, { method: "POST", body: body || {} }).then(function (out) {
    delete pendingActions[runId];
    if (!out.ok) showError(out.detail || out.error || (action + " failed"));
    else flash(out.detail || doneLabel);
    refresh();
  }).catch(function () {
    delete pendingActions[runId];
    showError(action + " failed — is the daemon running?");
    refresh();
  });
}

// --- board: the second ARRANGEMENT of the work surface, not a third door.
// Cards select the same run the list would; the same detail slides over.
function renderBoard() {
  var el = document.getElementById("board-cols");
  var scroller = document.getElementById("work-board");
  var keepScroll = scroller ? scroller.scrollTop : 0;
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
      var card = h("div", "acard" + (state.selected === run.id ? " sel" : ""));
      card.setAttribute("data-run", run.id);
      card.tabIndex = 0;
      card.appendChild(h("span", "av " + run.agent, run.agent.slice(0, 2)));
      var mid = h("div");
      mid.appendChild(h("div", "at", run.intent));
      mid.appendChild(h("div", "abr", shortBranch(run.branch)));
      var arow = h("div", "arow");
      if (run.display_state === "ready") arow.appendChild(h("span", "atom jade", "awaiting merge"));
      else if (run.display_state === "blocked") arow.appendChild(h("span", "atom amber", "? waiting"));
      else if (run.stale || run.display_state === "failed") arow.appendChild(h("span", "atom hot", "resumable"));
      else if (run.activity) arow.appendChild(h("span", "atom", run.activity.last_label));
      var cardCost = costLabel(run);
      if (cardCost) arow.appendChild(h("span", "atom", cardCost.split(" · ")[0]));
      arow.appendChild(h("span", "tm", ago(run.updated_at)));
      mid.appendChild(arow);
      card.appendChild(mid);
      card.onclick = function () { selectRun(run.id); };
      card.onkeydown = function (ev) {
        if (ev.target !== card) return;
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ev.stopPropagation();
          selectRun(run.id);
        }
      };
      col.appendChild(card);
      state.workOrder.push(run.id);
    });
    el.appendChild(col);
  });
  if (scroller) scroller.scrollTop = keepScroll;
}

// --- navigation + data
function setView(name) {
  state.view = name;
  // Memory is index-backed and loads once at boot, which meant a packet ratified by a
  // merge mid-session did not exist in the view until a full page reload. Entering the
  // view is the moment freshness matters, and the fetch is ~7ms even at 3,000 packets.
  if (name === "memory") loadMemory();
  ["room", "work", "memory"].forEach(function (v) {
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
    showError(out.error || "could not open that project");
  }).catch(function () { renderProjects(); showError("could not open that project"); });
}
function addProject() {
  var dir = window.prompt("Path to a git repo:", state.projectDir || "");
  if (dir) openProject(dir.trim(), null);
}

function render() {
  renderRoom();
  renderLiveRail();
  renderChrome();
  renderWork();
  renderProjects();
}
function refresh() {
  return Promise.all([api("/runs"), api("/goals")]).then(function (results) {
    var out = results[0];
    var goalsOut = results[1];
    state.runs = out.runs || [];
    state.goals = (goalsOut && goalsOut.goals) || [];
    maybeNotify();
    // Open on something. The Runs view used to render a full-width empty pane until
    // the user guessed to click the list, which on a 1280px window is most of the
    // screen doing nothing. Pick what most wants a human — the first run needing you,
    // else the newest — and only when nothing is selected, so this never steals a
    // selection the user made.
    if (!state.selected && state.runs.length) {
      var wants = state.runs.filter(function (r) { return r.ownership === "needs_you"; })[0];
      state.selected = (wants || state.runs[0]).id;
      api("/runs/" + state.selected).then(function (detail) {
        state.detail = detail.ok ? detail : null;
        render();
        loadTabText(state.selected);
      });
    }
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
// The external jump — rail, palette, notifications, room links all land here.
function openRun(id) {
  if (state.view !== "work") setView("work");
  selectRun(id);
}

// --- the diff viewer: a changed-files tree, per-file collapse, unified or
// side-by-side. Deliberately NO token-level syntax highlighting: a diff pane's
// color channel already carries the change semantics (add/del), and syntax tints
// on top of it fight the one signal the reviewer is here for.
function parseDiff(text) {
  var files = [];
  var current = null;
  text.split("\\n").forEach(function (line) {
    if (line.indexOf("diff --git ") === 0) {
      var at = line.lastIndexOf(" b/");
      current = { name: at >= 0 ? line.slice(at + 3) : line.slice(11), adds: 0, dels: 0, lines: [line] };
      files.push(current);
      return;
    }
    if (!current) {
      // A preamble section (e.g. "# uncommitted in the worktree") before any header.
      current = { name: line.indexOf("# ") === 0 ? line.slice(2) : "changes", adds: 0, dels: 0, lines: [] };
      files.push(current);
    }
    current.lines.push(line);
    if (line.indexOf("+") === 0 && line.indexOf("+++") !== 0) current.adds += 1;
    else if (line.indexOf("-") === 0 && line.indexOf("---") !== 0) current.dels += 1;
  });
  return files;
}
function diffLineClass(line) {
  if (line.indexOf("+++") === 0 || line.indexOf("---") === 0 || line.indexOf("diff --git") === 0 || line.indexOf("#") === 0) return "dline file";
  if (line.indexOf("@@") === 0) return "dline hunk";
  if (line.indexOf("+") === 0) return "dline add";
  if (line.indexOf("-") === 0) return "dline del";
  return "dline";
}
// Pair deletion runs with the additions that replaced them, hunk by hunk.
function splitRows(lines) {
  var rows = [];
  var dels = [];
  var adds = [];
  function flush() {
    var n = Math.max(dels.length, adds.length);
    for (var i = 0; i < n; i += 1) {
      rows.push({
        left: dels[i] === undefined ? "" : dels[i],
        right: adds[i] === undefined ? "" : adds[i],
        lcls: dels[i] === undefined ? "blank" : "del",
        rcls: adds[i] === undefined ? "blank" : "add",
      });
    }
    dels = [];
    adds = [];
  }
  lines.forEach(function (line) {
    if (line.indexOf("@@") === 0) { flush(); rows.push({ hunk: line }); return; }
    if (line.indexOf("+++") === 0 || line.indexOf("---") === 0 || line.indexOf("diff --git") === 0 ||
        line.indexOf("index ") === 0 || line.indexOf("new file") === 0 || line.indexOf("deleted file") === 0 ||
        line.indexOf("# ") === 0 || line.indexOf("Binary files") === 0) { flush(); return; }
    if (line.indexOf("-") === 0) { dels.push(line.slice(1)); return; }
    if (line.indexOf("+") === 0) { adds.push(line.slice(1)); return; }
    flush();
    rows.push({ left: line.slice(1), right: line.slice(1), lcls: "ctx", rcls: "ctx" });
  });
  flush();
  return rows;
}
function renderDiff(body, diffText) {
  var files = parseDiff(diffText);
  var split = state.diffView === "split";

  var bar = h("div", "difftree");
  files.forEach(function (file, index) {
    var chip = h("button", "dfchip");
    chip.appendChild(h("span", "n", file.name));
    if (file.adds) chip.appendChild(h("span", "a", "+" + file.adds));
    if (file.dels) chip.appendChild(h("span", "d", "−" + file.dels));
    chip.onclick = function () {
      var card = document.querySelector('[data-df="' + index + '"]');
      if (card) card.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    bar.appendChild(chip);
  });
  var toggle = h("button", "dfview", split ? "Unified view" : "Side by side");
  toggle.onclick = function () {
    state.diffView = split ? "unified" : "split";
    try { localStorage.setItem("kageDiff", state.diffView); } catch (e) {}
    renderDetail();
  };
  bar.appendChild(toggle);
  body.appendChild(bar);

  files.forEach(function (file, index) {
    var card = h("div", "diffcard");
    card.setAttribute("data-df", index);
    var collapsed = Boolean(state.collapsedDiff[file.name]);
    var head = h("button", "dfh");
    head.appendChild(h("span", "tw", collapsed ? "▸" : "▾"));
    head.appendChild(h("span", "n", file.name));
    var counts = h("span", "c");
    if (file.adds) counts.appendChild(h("span", "a", "+" + file.adds));
    if (file.dels) counts.appendChild(h("span", "d", "−" + file.dels));
    head.appendChild(counts);
    head.onclick = function () {
      state.collapsedDiff[file.name] = !collapsed;
      renderDetail();
    };
    card.appendChild(head);
    if (!collapsed) {
      var pane = h("div", "codepane indiff");
      if (split) {
        var grid = h("div", "sgrid");
        splitRows(file.lines).forEach(function (row) {
          if (row.hunk !== undefined) {
            grid.appendChild(h("div", "shunk", row.hunk));
            return;
          }
          grid.appendChild(h("div", "scell " + row.lcls, row.left || " "));
          grid.appendChild(h("div", "scell " + row.rcls, row.right || " "));
        });
        pane.appendChild(grid);
      } else {
        file.lines.forEach(function (line) {
          pane.appendChild(h("div", diffLineClass(line), line || " "));
        });
      }
      card.appendChild(pane);
    }
    body.appendChild(card);
  });
}

// Diff and raw are plain-text routes, fetched lazily per tab and cached on the detail.
function loadTabText(runId) {
  if (!state.detail) return;
  var tab = state.tab;
  if (tab === "queue") { loadQueue(runId); return; }
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

// --- the steer queue: delivered records are immutable history, queued ones can be
// edited/deleted/reordered in place — Conductor parity, via the kernel's own mutations.
function loadQueue(runId) {
  if (!state.detail || state.detail.steers !== undefined) return;
  api("/runs/" + runId + "/steers").then(function (out) {
    if (state.detail && state.selected === runId) {
      state.detail.steers = out.ok ? out.steers : [];
      renderDetail();
    }
  });
}
function queueOp(runId, body) {
  api("/runs/" + runId + "/steers", { method: "POST", body: body }).then(function (out) {
    if (!out.ok) { showError(out.error || "the queue change failed"); return; }
    if (state.detail && state.selected === runId) { state.detail.steers = out.steers; renderDetail(); }
  });
}
function renderQueue(body, runId, steers) {
  if (steers === undefined) { body.appendChild(h("div", "empty", "loading queue…")); return; }
  if (!steers.length) { body.appendChild(h("div", "empty", "No steers yet — anything sent or queued from the composer appears here.")); return; }
  var queuedIds = steers.filter(function (s) { return s.status === "queued"; }).map(function (s) { return s.id; });
  steers.forEach(function (record) {
    var delivered = record.status === "delivered";
    var row = h("div", "qrow" + (delivered ? " delivered" : ""));
    var head = h("div", "qrow-head");
    head.appendChild(h("span", "atom" + (delivered ? "" : " amber"), record.status));
    head.appendChild(h("span", "", ago(delivered ? record.delivered_at : record.at)));
    row.appendChild(head);
    if (delivered) {
      row.appendChild(h("div", "qrow-text", record.message));
    } else {
      var field = document.createElement("input");
      field.value = record.message;
      field.onkeydown = function (ev) {
        if (ev.key !== "Enter" || !field.value.trim()) return;
        queueOp(runId, { op: "edit", id: record.id, message: field.value.trim() });
      };
      row.appendChild(field);
      var ctrls = h("div", "qrow-ctrls");
      var at = queuedIds.indexOf(record.id);
      var up = h("button", "btn sm", "↑ earlier");
      up.disabled = at <= 0;
      up.onclick = function () {
        var order = queuedIds.slice();
        var swap = order[at - 1]; order[at - 1] = order[at]; order[at] = swap;
        queueOp(runId, { op: "reorder", order: order });
      };
      ctrls.appendChild(up);
      var down = h("button", "btn sm", "↓ later");
      down.disabled = at < 0 || at >= queuedIds.length - 1;
      down.onclick = function () {
        var order = queuedIds.slice();
        var swap = order[at + 1]; order[at + 1] = order[at]; order[at] = swap;
        queueOp(runId, { op: "reorder", order: order });
      };
      ctrls.appendChild(down);
      var del = h("button", "btn sm danger", "Delete");
      del.onclick = function () { queueOp(runId, { op: "delete", id: record.id }); };
      ctrls.appendChild(del);
      row.appendChild(ctrls);
    }
    body.appendChild(row);
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
  // Filter to entries that actually RENDER before windowing or grouping. The
  // transcript journals stdout and bookkeeping kinds this pane never shows; they
  // were silently eating the 160-entry window (130 of 160 on a real run, starving
  // the visible history to 30 rows) and breaking every tool burst so nothing
  // ever folded.
  var renderable = entries.filter(function (e) {
    if (e.kind === "tool" || e.kind === "_ledger" || e.kind === "start") return true;
    if (e.kind === "say") return Boolean(String(e.label || "").trim());
    if (e.kind === "final") return Boolean(String(e.message || "").trim());
    return false;
  });
  var shown = renderable.slice(-160);
  function renderEntry(e) {
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
      trow.appendChild(h("span", "lbl", readableLabel(e.label) || "working"));
      trow.appendChild(h("span", "ts", (e.at || "").slice(11, 19)));
      body.appendChild(trow);
      return;
    }
    if (e.kind === "say" || e.kind === "final") {
      var text = e.kind === "final" ? String(e.message || "") : (e.label || "");
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
  }
  // The run self-summarizes: a burst of 8+ consecutive tool actions folds into one
  // line ("14 actions — 9 reads · 4 edits · 1 command") that expands on demand. The
  // LIVE tail never folds — a streaming action hidden inside a summary is live
  // output that is live to nobody.
  var blocks = [];
  shown.forEach(function (e) {
    var last = blocks[blocks.length - 1];
    if (e.kind === "tool") {
      if (last && last.tools) last.tools.push(e);
      else blocks.push({ tools: [e] });
    } else blocks.push({ one: e });
  });
  blocks.forEach(function (block, index) {
    if (block.one) { renderEntry(block.one); return; }
    var liveTail = isLive && index === blocks.length - 1;
    var expanded = Boolean(state.expandedGroups[index]);
    if (block.tools.length < 8 || liveTail || expanded) {
      if (expanded && block.tools.length >= 8) {
        var closer = h("button", "foldrow open");
        closer.appendChild(h("span", "tw", "▾"));
        closer.appendChild(h("span", "", block.tools.length + " actions"));
        closer.onclick = function () { state.expandedGroups[index] = false; renderDetail(); };
        body.appendChild(closer);
      }
      block.tools.forEach(renderEntry);
      return;
    }
    var reads = 0, edits = 0, commands = 0;
    block.tools.forEach(function (t) {
      var l = String(t.label || "");
      if (l.indexOf("editing") === 0 || l.indexOf("writing") === 0) edits += 1;
      else if (l.indexOf("running") === 0) commands += 1;
      else reads += 1;
    });
    var parts = [];
    if (reads) parts.push(reads + " read" + (reads === 1 ? "" : "s"));
    if (edits) parts.push(edits + " edit" + (edits === 1 ? "" : "s"));
    if (commands) parts.push(commands + " command" + (commands === 1 ? "" : "s"));
    var fold = h("button", "foldrow");
    fold.appendChild(h("span", "tw", "▸"));
    fold.appendChild(h("span", "", block.tools.length + " actions — " + parts.join(" · ")));
    fold.onclick = function () { state.expandedGroups[index] = true; renderDetail(); };
    body.appendChild(fold);
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
// A short two-note chime — WebAudio, so nothing ships as an asset. Same suppression
// rule as the toast: silent whenever the window is focused and visible, and off
// entirely via the palette ("Toggle completion sound") or when notifications are.
function chime() {
  try {
    if (localStorage.getItem("kageSound") === "off") return;
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[660, 0], [880, 0.12]].forEach(function (note) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.frequency.value = note[0];
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + note[1]);
      gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + note[1] + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + note[1] + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + note[1]);
      osc.stop(ctx.currentTime + note[1] + 0.25);
    });
    setTimeout(function () { ctx.close(); }, 600);
  } catch (e) {
    // No audio device, autoplay policy, whatever — sound is never worth an error.
  }
}
function cycleNeedsYou(step) {
  var waiting = state.runs.filter(function (r) { return r.ownership === "needs_you"; });
  if (!waiting.length) { flash("nothing needs you"); return; }
  var at = waiting.findIndex(function (r) { return r.id === state.selected; });
  var next = waiting[(at + step + waiting.length) % waiting.length];
  openRun(next.id);
}

function maybeNotify() {
  var granted = window.Notification && Notification.permission === "granted";
  var arrived = false;
  state.runs.forEach(function (run) {
    var was = prevOwnership[run.id];
    if (was && was !== "needs_you" && run.ownership === "needs_you" && granted) {
      if (!(document.hasFocus() && document.visibilityState === "visible")) {
        arrived = true;
        var note = new Notification("Kage — needs you", { body: run.intent, tag: run.id });
        note.onclick = function () { window.focus(); openRun(run.id); };
      }
    }
    prevOwnership[run.id] = run.ownership;
  });
  if (arrived) chime();
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
      schedulePreflight("", "modal-preflight");
      showOverlay(false);
      refresh().then(function () { if (out.run) openRun(out.run.id); });
    }
  });
}

var roomInput = document.getElementById("room-input");
roomInput.addEventListener("input", function () {
  autoGrow(roomInput);
  schedulePreflight(roomInput.value, "room-preflight", composerPrefs.type);
});
document.getElementById("intent").addEventListener("input", function () {
  schedulePreflight(this.value, "modal-preflight", document.getElementById("rtype").value);
});
document.getElementById("rtype").addEventListener("change", function () {
  schedulePreflight(document.getElementById("intent").value, "modal-preflight", this.value);
});
roomInput.addEventListener("keydown", function (ev) {
  // Two speeds, measured: a manager turn is ~17s to any response; direct dispatch is
  // 0.1s. ⏎ keeps the manager for ambiguity ("what should we do about the flaky
  // tests?"); ⌘⏎ dispatches clear work immediately — no middleman on the front door.
  if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); dispatchFromComposer(); return; }
  // ⌥⏎: too large for one run — orchestrate it as a goal instead.
  if (ev.key === "Enter" && ev.altKey) { ev.preventDefault(); createGoalFromComposer(); return; }
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
    { grp: "go", name: "Work", hint: "2", run: function () { setView("work"); } },
    { grp: "go", name: "Memory", hint: "3", run: function () { setView("memory"); } },
    { grp: "do", name: "New run…", hint: "n", run: function () { showOverlay(true); } },
    { grp: "do", name: "Orchestrate as a goal…", hint: "⌥⏎", run: function () {
      setView("room");
      flash("type the goal, then ⌥⏎ to send it");
      setTimeout(function () { document.getElementById("room-input").focus(); }, 0);
    } },
    { grp: "do", name: "Work: list layout", run: function () { setView("work"); setWorkLayout("list"); } },
    { grp: "do", name: "Work: board layout", run: function () { setView("work"); setWorkLayout("board"); } },
    { grp: "do", name: "Room: chat view", run: function () { setView("room"); setRoomMode("chat"); } },
    { grp: "do", name: "Room: terminal view", run: function () { setView("room"); setRoomMode("terminal"); } },
    { grp: "do", name: "Cycle theme", run: function () { document.getElementById("m-theme").onclick(); } },
    { grp: "do", name: "Project settings…", run: function () { showSettings(true); } },
    { grp: "do", name: "Notifications", run: function () { document.getElementById("m-bell").onclick({ stopPropagation: function () {} }); } },
    { grp: "do", name: "Open another project…", run: function () { addProject(); } },
    { grp: "do", name: "Toggle the projects rail", run: function () { toggleRail(); } },
    { grp: "do", name: "New conversation thread", run: function () { setView("room"); newThread(); } },
    { grp: "do", name: "Next needing you", hint: "⌥L", run: function () { cycleNeedsYou(1); } },
    { grp: "do", name: "Toggle completion sound", run: function () {
      var off = localStorage.getItem("kageSound") === "off";
      localStorage.setItem("kageSound", off ? "on" : "off");
      flash(off ? "sound on" : "sound off");
      if (off) chime();
    } },
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
  if ((ev.metaKey || ev.ctrlKey) && ev.key === "n") { ev.preventDefault(); showOverlay(true); return; }
  if (ev.key === "Escape") {
    var hadOverlay = Boolean(document.querySelector(".overlay.on")) || document.getElementById("notif").classList.contains("on");
    showPalette(false); showOverlay(false); showSettings(false); document.getElementById("notif").classList.remove("on");
    // Only once nothing modal was open does esc mean "close the board's slide-over".
    if (!hadOverlay && state.dover) { state.dover = false; renderWork(); }
    return;
  }
  // ⌥L / ⌥H: next / previous run needing you, from anywhere — including mid-sentence
  // (Alt+letter would otherwise insert a symbol into the composer on macOS).
  if (ev.altKey && (ev.code === "KeyL" || ev.code === "KeyH")) {
    ev.preventDefault();
    cycleNeedsYou(ev.code === "KeyL" ? 1 : -1);
    return;
  }
  if (typing) {
    if (ev.key === "Enter" && ev.target.id === "intent" && (ev.metaKey || ev.ctrlKey)) dispatchNow();
    return;
  }
  if (ev.key === "1") setView("room");
  else if (ev.key === "2") setView("work");
  else if (ev.key === "3") setView("memory");
  else if (ev.key === "n") { ev.preventDefault(); showOverlay(true); }
  // The selection model: j/k (or arrows) traverse the work surface in paint order,
  // Enter lands on the selected run's primary action.
  else if (state.view === "work" && (ev.key === "j" || ev.key === "ArrowDown")) { ev.preventDefault(); moveSelection(1); }
  else if (state.view === "work" && (ev.key === "k" || ev.key === "ArrowUp")) { ev.preventDefault(); moveSelection(-1); }
  else if (state.view === "work" && ev.key === "Enter") { ev.preventDefault(); focusPrimary(); }
});
Array.prototype.forEach.call(document.querySelectorAll(".seg button"), function (btn) {
  btn.onclick = function () { setView(btn.dataset.view); };
});

// --- SSE: notifications, never state. Any run event triggers a re-read.
function connect() {
  var source = new EventSource("/runs/events");
  source.onopen = function () {
    // Reconnect after an outage means the board may have MISSED events — re-read
    // everything rather than trusting what was on screen when the stream dropped.
    var wasOffline = document.body.classList.contains("offline");
    document.body.classList.remove("offline");
    if (wasOffline) { refresh(); refreshRoom(); }
  };
  source.addEventListener("hello", function () {
    state.connected = true;
    document.body.classList.remove("offline");
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
    // A delta is a notification about what is being typed, not a change to the
    // transcript — the transcript only changes once refreshRoom reads the real turns
    // back. Rebuilding the whole turn column per token is what caused the shimmer.
    state.room.busy = true;
    state.roomStreaming.push(payload);
    updateRoomTyping();
  });
  // The pty's raw bytes, written straight into xterm — this channel is the ONE place
  // in the whole app that is deliberately NOT structured. Everything claude code
  // renders (its banner, its own tool-call formatting, its own prompts) shows up
  // exactly as it would in a real terminal, because it IS one.
  source.addEventListener("pty", function (ev) {
    var payload;
    try { payload = JSON.parse(ev.data); } catch (err) { return; }
    var session = payload.session || "main";
    // Same rule everywhere: bytes belong to the screen they came from. The room's
    // terminal and a run's take-over terminal are two separate xterm instances, keyed
    // by two disjoint session prefixes ("main"/thread key vs. "run:<runId>"), so a
    // byte can only ever paint into the one screen it actually belongs to.
    if (term && session === state.session) {
      if (payload.kind === "data") term.write(payload.bytes);
      else if (payload.kind === "exit") term.write("\\r\\n\\x1b[33m[session ended]\\x1b[0m\\r\\n");
    }
    if (runTerm && state.runTermRunId && session === "run:" + state.runTermRunId) {
      if (payload.kind === "data") runTerm.write(payload.bytes);
      else if (payload.kind === "exit") runTerm.write("\\r\\n\\x1b[33m[session ended]\\x1b[0m\\r\\n");
    }
  });
  source.onerror = function () {
    state.connected = false;
    document.body.classList.add("offline");
    document.getElementById("conn").classList.add("off");
    document.getElementById("st-left").textContent = "disconnected — retrying";
    // EventSource reconnects on its own; the ribbon + dot are the explicit
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
setInterval(refreshRoom, 15000);`;
