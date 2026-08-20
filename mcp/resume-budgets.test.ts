// resume-run could not resume a run stopped on the MINUTES cap — the common case, since
// a minutes budget expires just by an agent taking a while, while a usd overrun needs an
// expensive turn. Four bugs, all reproduced live on 2026-08-19 against real stranded runs:
//
// 1. --budget-minutes was accepted by the CLI's arg parser and then never read anywhere:
//    resumeStoppedRun(project, runId, budgetUsd, adapterFor) had no minutes parameter at
//    all, so raising it did nothing and the run re-stopped on the very next usage tick.
// 2. A minutes-stopped run's refusal named the USD cap — "$2.78 against a $40.00 budget,
//    resume with --budget-usd 80" — for a run that never crossed its usd budget at all.
//    Raising usd cannot fix a minutes stop.
// 3. checkRunBudget's minutes-exceeded stop note told the operator to fix it by setting
//    `budgets.minutes` in .agent_memory/config.json — advice that cannot work, because a
//    run's budgets are stamped onto its own record at dispatch and resume never re-reads
//    config for an EXISTING run (config only sets the default for future ones).
// 4. recordSpend measured minutes as wall-clock since the run's first "running" entry,
//    including any time spent sitting `stopped` — so a run idle for an hour came back
//    reading an hour more expensive than when it halted, defeating the very recovery this
//    command exists for.
//
// Two more confirmed live after the fix above landed (operator re-briefed mid-run):
//
// 5. The SAME wall-clock bug (#4) was duplicated on the READ side: report.ts's
//    renderStatusBoard (`kage status`) and tui/app.ts's loadRunRows (`kage ui`) each
//    hand-rolled their own `now - Date.parse(first "running" entry)` independently of
//    recordSpend. Reproduced live: a run read 26.8m when the kernel stopped it, sat idle
//    with nothing running, and later read 128.0m with zero work done in between — fixed
//    by routing both through contract.ts's new displayElapsedMs (built on
//    runningMinutesElapsed, same as recordSpend now is).
// 6. .agent_memory/config.json is read fresh on every call (readDelegationConfig has no
//    in-memory cache) — but a long-lived `kage daemon` process for a project can still
//    hold a manager/session state assembled from an earlier read. Observed live: budgets
//    raised via `kage config` took no effect on runs dispatched through a daemon that had
//    been up for hours, until the daemon itself was restarted. `kage config` now checks
//    for a LIVE daemon (readDaemonStatus + an actual pid liveness check, never a blanket
//    warning) and says so plainly when one is running, rather than silently pretending
//    the change took effect everywhere.
//
// Deliberately its own file — mcp/delegation.test.ts is off-limits (a known merge-conflict
// hotspot other runs collide in), and run-recovery.test.ts already covers the usd-cap path
// this brief does not change.
//
// UPDATED 2026-08-20: minutes no longer stops a run AT ALL (contract.ts's checkRunBudget
// checks usd only) — five runs stopped on budget in one day, all legitimate work that
// later merged clean, zero runaways caught, and minutes was the worse offender (it
// stopped nothing bad even before the idle-time bug above was fixed). The "a minutes cap
// tripped" tests below are updated to their new shape: checkRunBudget never flags minutes
// as exceeded, and resumeStoppedRun no longer requires (or even accepts) a minutes-only
// refusal — the stall detector in supervisor.ts (mcp/stall-detector.test.ts) is what
// actually catches a looping agent now. The meter itself (runningMinutesElapsed,
// displayElapsedMs) is untouched below — it still measures and displays correctly, it
// simply no longer gates anything.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkRunBudget,
  createRun,
  displayElapsedMs,
  patchRun,
  readRun,
  runningMinutesElapsed,
  runSupervisorLogPath,
  transitionRun,
  type RunStateChange,
  type TaskRecord,
} from "./delegation/contract.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { adapterByName } from "./delegation/adapters/index.js";
import { superviseRun } from "./delegation/supervisor.js";
import { createWorktree } from "./delegation/worktree.js";
import { dispatchDetached } from "./delegation/dispatch.js";
import { resumeStoppedRun } from "./delegation/recovery.js";
import { renderStatusBoard } from "./delegation/report.js";

const CLI = join(__dirname, "cli.js");

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-resume-budgets-"));
}

function tempGitProject(options: { testCommand?: string } = {}): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  if (options.testCommand) writeDelegationConfig(project, { test: options.testCommand });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

async function waitFor(check: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting for condition");
    await new Promise((r) => setTimeout(r, 50));
  }
}

// --- runningMinutesElapsed: the meter itself — pure, no live clock needed ----------

test("runningMinutesElapsed: a run's stopped/idle time never counts as elapsed", () => {
  const t0 = new Date("2026-08-19T00:00:00.000Z").getTime();
  const minute = 60_000;
  // running 0-20m, stopped 20m-80m (60 idle minutes — the exact shape reproduced live:
  // "sat idle for an hour and came back reading 91.2m"), resumed running 80m-90m, still
  // running now.
  const history: RunStateChange[] = [
    { state: "dispatched", at: new Date(t0).toISOString(), by: "kernel" },
    { state: "running", at: new Date(t0).toISOString(), by: "kernel" },
    { state: "stopped", at: new Date(t0 + 20 * minute).toISOString(), by: "kernel" },
    { state: "running", at: new Date(t0 + 80 * minute).toISOString(), by: "user" },
  ];
  // REVERT CHECK: measuring wall-clock since the FIRST "running" entry instead of summing
  // only running intervals would read 90 minutes here (t0+90m minus t0), not 30.
  const minutes = runningMinutesElapsed(history, t0 + 90 * minute);
  assert.equal(minutes, 30, "only the two running intervals (20 + 10) must count, never the 60 idle minutes in between");
});

test("runningMinutesElapsed: a run that never stopped is unaffected — still plain elapsed time", () => {
  const t0 = new Date("2026-08-19T00:00:00.000Z").getTime();
  const history: RunStateChange[] = [{ state: "running", at: new Date(t0).toISOString(), by: "kernel" }];
  assert.equal(runningMinutesElapsed(history, t0 + 15 * 60_000), 15);
});

// --- checkRunBudget: minutes never stops a run any more ---------------------------

test("checkRunBudget never exceeds on minutes, no matter how far over the cap it runs", () => {
  // REVERT CHECK: before this fix, spend.minutes 999 against a 30-minute cap reported
  // exceeded: true (and named `kage resume-run <run-id> --budget-minutes <n>`) — the
  // exact behavior this change deliberately removes.
  const result = checkRunBudget({ usd_est: 0, minutes: 999 }, { usd: 2, minutes: 30, diff_lines: 400 });
  assert.equal(result.exceeded, false, "minutes must never be a stopping condition");
  assert.equal(result.reason, undefined);
});

test("checkRunBudget still stops on usd even when minutes is also over its cap", () => {
  const result = checkRunBudget({ usd_est: 3, minutes: 999 }, { usd: 2, minutes: 30, diff_lines: 400 });
  assert.equal(result.exceeded, true);
  assert.match(result.reason ?? "", /--budget-usd/, "usd is still the one cap that halts a run");
  assert.doesNotMatch(result.reason ?? "", /--budget-minutes/, "minutes must never appear in a stop reason any more");
});

// --- resumeStoppedRun: --budget-minutes is a harmless raise, never required ------

test("--budget-minutes resumes a stopped run as a harmless raise when nothing actually tripped", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, {
    intent: "user-requested stop, well under every cap",
    type: "bugfix",
    agent: "stub",
    budgets: { usd: 50, minutes: 30, diff_lines: 400 },
  });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  const worktree = createWorktree(project, task.id, task.branch);
  patchRun(project, task.id, {
    worktree: worktree.path,
    agent_session_id: "orig-session",
    spend: { usd_est: 0.42, minutes: 5 },
  });
  transitionRun(project, task.id, "stopped", "user", "stopped by request");

  const liveStub = stubAdapter({ live: { question: "n/a", firstResult: "claim" }, statement: "continued and finished" });
  let supervised: Promise<void> | null = null;
  const reattach = (_projectDir: string, reentrantTask: { id: string }): { pid: number | undefined } => {
    supervised = superviseRun(project, reentrantTask.id, liveStub);
    return { pid: 424_242 };
  };

  // REVERT CHECK: if resumeStoppedRun stopped threading budgetMinutes through at all,
  // finished.budgets.minutes would still read 30 here, not 240.
  const result = await resumeStoppedRun(project, task.id, undefined, 240, () => liveStub, reattach);
  assert.equal(result.ok, true, result.message);
  assert.ok(supervised, "resuming must reattach a supervisor");
  await supervised!;

  const finished = readRun(project, task.id);
  assert.equal(finished.budgets.minutes, 240, "an explicit --budget-minutes must still raise the minutes budget, harmlessly");
  assert.equal(finished.budgets.usd, 50, "an untouched cap must stay exactly as configured");
  assert.equal(finished.state, "ready");
});

// --- CLI: --budget-minutes still reaches resumeStoppedRun as an optional raise ---

test("kage resume-run --budget-minutes over the CLI still raises the minutes budget, without being required", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, {
    intent: "cli minutes wiring check",
    type: "bugfix",
    agent: "stub",
    budgets: { usd: 50, minutes: 30, diff_lines: 400 },
  });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  patchRun(project, task.id, { agent_session_id: "orig-session", spend: { usd_est: 0.1, minutes: 5 } });
  transitionRun(project, task.id, "stopped", "user", "stopped by request");

  const out = execFileSync(process.execPath, [CLI, "resume-run", task.id, "--budget-minutes", "240", "--project", project], {
    encoding: "utf8",
  });
  assert.doesNotMatch(out, /budget-usd <n>/, "a resume that needed no usd raise must not print a usd refusal");

  await waitFor(() => {
    const state = readRun(project, task.id).state;
    return state === "ready" || state === "failed";
  }, 15_000);

  const finished = readRun(project, task.id);
  assert.equal(finished.budgets.minutes, 240, "--budget-minutes must not be silently dropped by the CLI");
  assert.equal(finished.state, "ready");
});

// --- dispatchDetached: the supervisor gets a log to die into, not stdio: "ignore" -

test("dispatchDetached gives its supervisor child a log file to die into instead of discarding stdout/stderr", async () => {
  const project = tempProject();
  // Deliberately no task.json on disk — `kage supervise <id>` will crash synchronously on
  // its very first readRun, exactly the "dead within seconds of dispatch" shape reproduced
  // live twice on 2026-08-19. Only task.id is read by dispatchDetached itself.
  const fakeTask = { id: "no-such-run-260101-aaaa" } as TaskRecord;

  const spawned = dispatchDetached(project, fakeTask);
  assert.ok(spawned.pid, "a pid must still be returned even though the child will crash almost immediately");

  const logPath = runSupervisorLogPath(project, fakeTask.id);
  await waitFor(() => existsSync(logPath) && readFileSync(logPath, "utf8").length > 0, 10_000);
  const content = readFileSync(logPath, "utf8");
  // REVERT CHECK: with stdio: "ignore", the crashing child's console.error output (its
  // whole reason for dying — main()'s catch prints the thrown Error's message) went
  // nowhere, and this log would contain at most superviseRun's own "supervisor started"
  // slog line, never the actual crash reason.
  assert.match(content, /No run found/i, "the crash's own error output must land in the log, not be discarded");
});

// --- displayElapsedMs: the SAME idle-time fix, on the read side ------------------

test("displayElapsedMs: idle/stopped time never counts once a run has actually started running", () => {
  const t0 = new Date("2026-08-19T00:00:00.000Z").getTime();
  const minute = 60_000;
  const task = {
    state_history: [
      { state: "running", at: new Date(t0).toISOString(), by: "kernel" } as RunStateChange,
      { state: "stopped", at: new Date(t0 + 5 * minute).toISOString(), by: "kernel" } as RunStateChange,
    ],
    created_at: new Date(t0).toISOString(),
  };
  // REVERT CHECK: wall-clock since dispatch would read 205 minutes here (200 idle + 5 of
  // real work, the exact shape reproduced live: 26.8m at the halt, 128.0m after sitting
  // idle); only the 5 minutes actually running must count.
  assert.equal(displayElapsedMs(task, t0 + 205 * minute), 5 * minute);
});

test("displayElapsedMs: a run that has not started running yet shows real wait time, not zero", () => {
  const t0 = new Date("2026-08-19T00:00:00.000Z").getTime();
  const task = {
    state_history: [{ state: "briefed", at: new Date(t0).toISOString(), by: "kernel" } as RunStateChange],
    created_at: new Date(t0).toISOString(),
  };
  assert.equal(displayElapsedMs(task, t0 + 5 * 60_000), 5 * 60_000, "a run still waiting to start has genuinely been waiting — that time is real, unlike idle time after a stop");
});

test("kage status (renderStatusBoard) shows work time for a stopped run, not wall-clock since dispatch", () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "status board idle display check", type: "chore", agent: "stub" });
  const t0 = Date.now() - 200 * 60_000;
  patchRun(project, task.id, {
    state: "stopped",
    state_history: [
      { state: "draft", at: new Date(t0).toISOString(), by: "kernel" },
      { state: "briefed", at: new Date(t0).toISOString(), by: "kernel" },
      { state: "dispatched", at: new Date(t0).toISOString(), by: "kernel" },
      { state: "running", at: new Date(t0).toISOString(), by: "kernel" },
      { state: "stopped", at: new Date(t0 + 20 * 60_000).toISOString(), by: "kernel", note: "stopped by request" },
    ],
  });

  const board = renderStatusBoard(project);
  const line = board.split("\n").find((entry) => entry.includes(task.id));
  assert.ok(line, "the stopped run must still appear on the board");
  // REVERT CHECK: the old formula (now minus the FIRST "running" entry) reads ~200
  // minutes here; this run only ever ran for 20 minutes before it stopped 180 minutes ago.
  assert.match(line!, /\b20m/, "must show the 20 minutes of actual work, never ~200 minutes of wall clock since dispatch");
});

// --- kage config: warn about a LIVE daemon, never a project with no daemon at all -
//
// UPDATED: the original diagnosis behind this warning ("a live daemon holds a stale
// in-memory copy of config.json") was itself wrong for budgets specifically — verified
// live on 2026-08-20 by dispatching a real run through a daemon restarted seconds
// earlier: it still stamped $2/30m while config.json said usd 40/minutes 240. The real
// bug was that api.ts's createRun call never consulted configuredBudgets() at ALL,
// restart or not (contract.ts's createRun now defaults every run's budgets from
// configuredBudgets(projectDir), fixing this at the source — see budget-config.test.ts).
// So a budgets-only `kage config` change never needs a daemon restart and must never
// claim it does; a change to any OTHER setting (test/diff-budget/strict/static-checks)
// still gets the honest live-daemon warning, since those paths were not re-verified here.

function spawnLiveDaemonStatus(project: string): { pid: number | undefined; kill: () => void } {
  const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
  const daemonDir = join(project, ".agent_memory", "daemon");
  mkdirSync(daemonDir, { recursive: true });
  writeFileSync(
    join(daemonDir, "status.json"),
    JSON.stringify({
      ok: true,
      project_dir: project,
      pid: child.pid,
      host: "127.0.0.1",
      rest_port: 3111,
      viewer_port: 3113,
      started_at: new Date().toISOString(),
      status_path: join(daemonDir, "status.json"),
      index_watch: false,
      last_indexed_at: "",
    }),
    "utf8",
  );
  return { pid: child.pid, kill: () => child.kill() };
}

test("kage config --budget-minutes never warns about a live daemon — budgets apply fresh on every new run", async () => {
  const project = tempGitProject({ testCommand: "true" });

  const quiet = execFileSync(process.execPath, [CLI, "config", "--budget-minutes", "240", "--project", project], { encoding: "utf8" });
  assert.doesNotMatch(quiet, /daemon is running/i, "no daemon status file exists at all — must never warn about one");

  const daemon = spawnLiveDaemonStatus(project);
  try {
    // REVERT CHECK: before this fix, ANY `kage config` flag (including a bare
    // --budget-minutes) triggered the daemon-restart warning — false advice, since
    // budgets were never actually stale on a live daemon in the first place.
    const stillQuiet = execFileSync(process.execPath, [CLI, "config", "--budget-minutes", "300", "--project", project], { encoding: "utf8" });
    assert.doesNotMatch(stillQuiet, /daemon is running/i, "a budgets-only change must never claim a restart is needed");
  } finally {
    daemon.kill();
  }
});

test("kage config --test still warns about a LIVE daemon, and stays silent when no daemon is running", async () => {
  const project = tempGitProject({ testCommand: "true" });

  const quiet = execFileSync(process.execPath, [CLI, "config", "--test", "npm run check", "--project", project], { encoding: "utf8" });
  assert.doesNotMatch(quiet, /daemon is running/i, "no daemon status file exists at all — must never warn about one");

  const daemon = spawnLiveDaemonStatus(project);
  try {
    const warned = execFileSync(process.execPath, [CLI, "config", "--test", "npm run check2", "--project", project], { encoding: "utf8" });
    assert.match(warned, /daemon is running/i, "a real live daemon pid must trigger the restart warning for a non-budget setting");
    assert.match(warned, /kage daemon stop --project/, "must name the actual fix command, not just note the problem");
  } finally {
    daemon.kill();
  }
});
