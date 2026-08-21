// A CLI-dispatched run must survive the shell that launched it.
//
// Reproduced live on 2026-08-18: SIGTERM to `kage dispatch` killed the run it had just
// started. The record was left at state "running" with agent_pid pointing at a dead
// process, supervisor_pid never set, and liveState().stale true — a run that had done
// no work displayed as "dropped". dispatchRun/executeRun (dispatch.ts) executed the
// hired agent INLINE, as a plain child of the CLI process, so closing the terminal,
// Ctrl-C, or any command timeout took the run down with it.
//
// The fix: `kage dispatch` now hands the run to the same DETACHED supervisor the daemon
// and app already use (dispatchDetached → `kage supervise` → superviseRun, which
// records supervisor_pid) and only follows its progress from the foreground — losing
// the foreground process changes nothing about whether the run finishes. `kage retry`
// still runs inline (out of scope for this fix) and now says so plainly.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRun, isProcessAlive, listRuns, patchRun, readRun, transitionRun, writeBrief } from "./delegation/contract.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { compileBrief, renderBrief } from "./delegation/brief.js";

const CLI = join(__dirname, "cli.js");

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

// A real git repo with a trivial, always-passing test command — the checks exist and
// pass deterministically without needing a real build/test tool inside the fixture.
function tempGitProject(): string {
  const project = mkdtempSync(join(tmpdir(), "kage-dispatch-durability-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  writeDelegationConfig(project, { test: "true" });
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

test("REGRESSION: a run whose owning process is dead is reported stale, never left claiming running", () => {
  // The exact symptom reproduced live: the record itself still says "running", but
  // nobody alive owns it — agent_pid dead, supervisor_pid never recorded. This is the
  // failure `kage dispatch`'s new detached path exists to prevent; FAILS if liveState's
  // inFlight cross-check (contract.ts) is ever weakened to trust the recorded state alone.
  const project = tempGitProject();
  const task = createRun(project, { intent: "dead owner check", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  patchRun(project, task.id, { agent_pid: 999_999, supervisor_pid: undefined });

  const view = readRun(project, task.id);
  assert.equal(view.state, "running", "the record itself still says running");
  assert.equal(view.stale, true, "liveState must catch that nobody alive owns this run");
  assert.equal(view.display_state, "dropped");
});

test("a CLI-dispatched run survives SIGTERM to the shell that launched it", async () => {
  const project = tempGitProject();
  // KAGE_STUB_RUN_DELAY_MS holds the hired agent open long enough to kill the shell
  // while the run is genuinely in flight, not after it has already finished.
  const shell = spawn(
    process.execPath,
    [CLI, "dispatch", "leave a durable note", "--agent", "stub", "--project", project, "--quiet"],
    { cwd: project, stdio: "ignore", env: { ...process.env, KAGE_STUB_RUN_DELAY_MS: "3000" } },
  );

  let runId = "";
  await waitFor(() => {
    const runs = listRuns(project);
    if (!runs.length) return false;
    runId = runs[0].id;
    return runs[0].state === "dispatched" || runs[0].state === "running";
  });

  const shellPid = shell.pid;
  assert.ok(shellPid, "the shell process must have a pid to kill");
  shell.kill("SIGTERM");
  await waitFor(() => !isProcessAlive(shellPid), 5_000);

  // REVERT CHECK: before this fix, `kage dispatch` executed the agent inline, so killing
  // the shell above killed the run too — this wait would time out with the run stuck at
  // "running" against a dead pid. That is the one line that catches a revert.
  await waitFor(() => {
    const state = readRun(project, runId).state;
    return state === "ready" || state === "failed";
  }, 15_000);

  const finished = readRun(project, runId);
  assert.equal(finished.state, "ready", "a stub run with passing checks must reach ready even after its shell died");
  assert.equal(finished.stale, false, "a finished run must never read as stale");
  assert.ok(finished.supervisor_pid, "an owning process must be recorded once agent_pid alone is dead by design");
  assert.notEqual(finished.supervisor_pid, shellPid, "ownership must belong to a process distinct from the killed shell");
});

test("kage retry — the one remaining inline path — warns plainly that the run is tied to this shell", () => {
  const project = tempGitProject();
  const task = createRun(project, { intent: "inline warning check", type: "chore", agent: "stub" });
  const plan = compileBrief(project, task.intent, task.type);
  writeBrief(project, task.id, renderBrief(task, plan));
  transitionRun(project, task.id, "briefed", "kernel");

  const out = execFileSync(process.execPath, [CLI, "retry", task.id, "--project", project, "--quiet"], {
    encoding: "utf8",
  });

  assert.match(out, /tied to this shell/i);
  assert.equal(readRun(project, task.id).state, "ready");
});
