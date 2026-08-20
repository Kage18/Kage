// The stall detector (mcp/delegation/supervisor.ts) — the thing per-run budgets were
// actually standing in for. Five runs stopped on budget in one day; all five were
// legitimate work that later merged clean, and zero runaways were ever caught. The real
// hazard at max_concurrent 3, unattended, is an agent LOOPING: retrying the same failing
// command, or grinding with no forward progress. This file covers: the pure per-turn
// evaluator (evaluateStallTurn) against every condition the brief lists, one end-to-end
// run through the real supervisor wiring, a stall-stopped run resuming with no budget
// flags (recovery.ts), and — found live while dispatching THIS run — agent_session_id
// now landing mid-stream instead of only at exit.
//
// Deliberately its own file per the repo's test-placement rule: new behavior gets its
// own file, and mcp/delegation.test.ts is off-limits (a known merge-conflict hotspot).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRun, patchRun, readRun, transitionRun } from "./delegation/contract.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { sendControl } from "./delegation/control.js";
import { adapterByName } from "./delegation/adapters/index.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import type { Adapter } from "./delegation/adapters/types.js";
import {
  evaluateStallTurn,
  initialStallState,
  STALL_NO_DIFF_STREAK,
  STALL_SAME_COMMAND_STREAK,
  superviseRun,
  type StallState,
  type TurnCommandResult,
} from "./delegation/supervisor.js";
import { createWorktree } from "./delegation/worktree.js";
import { resumeStoppedRun } from "./delegation/recovery.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-stall-"));
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
    await new Promise((r) => setTimeout(r, 30));
  }
}

function failing(command: string, exitCode: number): TurnCommandResult {
  return { command, exitCode, failed: true };
}

function ok(command: string): TurnCommandResult {
  return { command, exitCode: 0, failed: false };
}

// --- evaluateStallTurn: the pure per-turn evaluator -------------------------------

test("the same command failing with the same exit code trips at exactly STALL_SAME_COMMAND_STREAK turns, naming the command", () => {
  let state = initialStallState();
  let trigger = null as ReturnType<typeof evaluateStallTurn>["trigger"];
  for (let turn = 1; turn <= STALL_SAME_COMMAND_STREAK; turn += 1) {
    const evaluated = evaluateStallTurn(state, { commands: [failing("npm test", 1)], diffHash: `unrelated-${turn}` });
    state = evaluated.state;
    trigger = evaluated.trigger;
    if (turn < STALL_SAME_COMMAND_STREAK) assert.equal(trigger, null, `must not trip before turn ${STALL_SAME_COMMAND_STREAK}`);
  }
  // REVERT CHECK: without the streak actually resetting/continuing correctly, this
  // either never trips or trips too early — both fail this assertion.
  assert.ok(trigger, `must trip at exactly turn ${STALL_SAME_COMMAND_STREAK}`);
  assert.match(trigger!.reason, /^stalled:/);
  assert.match(trigger!.reason, /`npm test`/, "must name the exact command");
  assert.match(trigger!.reason, /exit 1/);
});

test("three DIFFERENT failing commands in a row never trip the same-command streak", () => {
  let state = initialStallState();
  const commands = ["npm test", "npm run lint", "npm run build"];
  for (const [index, command] of commands.entries()) {
    const evaluated = evaluateStallTurn(state, { commands: [failing(command, 1)], diffHash: `unrelated-${index}` });
    state = evaluated.state;
    assert.equal(evaluated.trigger, null, `turn ${index + 1} (different command) must never trip it`);
  }
});

test("a turn with no failure breaks the same-command streak", () => {
  let state = initialStallState();
  state = evaluateStallTurn(state, { commands: [failing("npm test", 1)], diffHash: "a" }).state;
  state = evaluateStallTurn(state, { commands: [failing("npm test", 1)], diffHash: "b" }).state;
  assert.equal(state.sameCommandStreak, 2);
  // A clean turn in between — the agent moved on, this is not a loop.
  state = evaluateStallTurn(state, { commands: [ok("npm test")], diffHash: "c" }).state;
  assert.equal(state.sameCommandStreak, 0, "a non-failing turn must reset the streak, not just pause it");
  const third = evaluateStallTurn(state, { commands: [failing("npm test", 1)], diffHash: "d" });
  assert.equal(third.trigger, null, "the streak restarted from zero, so this is only turn 1 again");
});

test("a long single turn running the same failing command many times never trips it on its own", () => {
  // Evaluated once per TURN, never per tool call — this whole array is ONE turn's
  // worth of commands, however many times it retried internally.
  const manyAttempts = Array.from({ length: 10 }, () => failing("npm test", 1));
  const evaluated = evaluateStallTurn(initialStallState(), { commands: manyAttempts, diffHash: "x" });
  assert.equal(evaluated.trigger, null, "a single turn, however long, must never trip the detector by itself");
  assert.equal(evaluated.state.sameCommandStreak, 1, "it counts as exactly ONE turn toward the streak");
});

test("six consecutive turns with no worktree diff change trip it; five do not", () => {
  let state: StallState = initialStallState();
  // First turn establishes the baseline diff hash — it can never itself count as
  // "unchanged" (nothing came before it to compare against).
  state = evaluateStallTurn(state, { commands: [], diffHash: "same-stat" }).state;
  let trigger = null as ReturnType<typeof evaluateStallTurn>["trigger"];
  for (let turn = 1; turn <= STALL_NO_DIFF_STREAK - 1; turn += 1) {
    const evaluated = evaluateStallTurn(state, { commands: [], diffHash: "same-stat" });
    state = evaluated.state;
    trigger = evaluated.trigger;
  }
  assert.equal(trigger, null, `${STALL_NO_DIFF_STREAK - 1} unchanged turns after the baseline must not trip it`);
  const sixth = evaluateStallTurn(state, { commands: [], diffHash: "same-stat" });
  assert.ok(sixth.trigger, `the ${STALL_NO_DIFF_STREAK}th unchanged turn must trip it`);
  assert.match(sixth.trigger!.reason, /^stalled:/);
  assert.match(sixth.trigger!.reason, new RegExp(`${STALL_NO_DIFF_STREAK} consecutive turns`));
});

test("varied exploration (different diffs, no edits yet) never trips the no-diff streak", () => {
  let state: StallState = initialStallState();
  for (let turn = 1; turn <= STALL_NO_DIFF_STREAK + 4; turn += 1) {
    // A different diff-stat hash every turn — reading different files, running
    // different read-only commands, never landing on the same unchanged state twice.
    const evaluated = evaluateStallTurn(state, { commands: [], diffHash: `exploring-${turn}` });
    state = evaluated.state;
    assert.equal(evaluated.trigger, null, `turn ${turn} of pure exploration must never trip it`);
  }
});

// --- real wiring: the supervisor actually parses tool_use/tool_result and halts ---

const STALL_LIVE_SCRIPT = [
  'const readline = require("node:readline");',
  'let phase = 0;',
  'function emit(obj) { process.stdout.write(JSON.stringify(obj) + "\\n"); }',
  'readline.createInterface({ input: process.stdin }).on("line", () => {',
  '  phase += 1;',
  '  const id = "bash-" + phase;',
  '  emit({ type: "assistant", message: { content: [{ type: "tool_use", id: id, name: "Bash", input: { command: "npm test" } }] } });',
  '  emit({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, is_error: true, content: "tests failed: exit code 1" }] } });',
  '  const blocked = "```kage-blocked\\n" + JSON.stringify({ need: "a decision", question: "turn " + phase }) + "\\n```";',
  '  emit({ type: "result", result: blocked });',
  '});',
].join("\n");

test("REGRESSION: the same Bash command failing on 3 consecutive turns halts the run with a stalled: note naming it", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "loops on the same failing command", type: "bugfix", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");

  const stallAdapter: Adapter = {
    name: "stall-stub",
    async run() {
      return { exit_code: 0, final_message: "" };
    },
    spawnLive: () => spawn(process.execPath, ["-e", STALL_LIVE_SCRIPT], { stdio: ["pipe", "pipe", "pipe"] }),
  };

  const supervised = superviseRun(project, task.id, stallAdapter);

  // Turn 1 blocks (streak 1), tell to continue into turn 2 (streak 2, still blocked),
  // tell again into turn 3 — the SAME command failing a third consecutive time is what
  // must trip the detector before the run is allowed to go blocked again.
  //
  // Waited for via state_history GROWING, never via catching an intermediate "running"
  // state directly: the tell's own answer (blocked → running) and the next turn's own
  // conclusion (running → blocked/stopped) can land on disk within milliseconds of each
  // other — a 30ms poll can genuinely never observe "running" in between and would hang
  // forever waiting for a state that was never missed, just too brief to catch.
  await waitFor(() => readRun(project, task.id).state === "blocked");
  const afterTurn1 = readRun(project, task.id).state_history.length;
  let reply = await sendControl(project, task.id, { op: "tell", message: "continue" });
  assert.equal(reply?.delivered, true);
  await waitFor(() => {
    const run = readRun(project, task.id);
    return run.state_history.length > afterTurn1 && run.state !== "running";
  });
  reply = await sendControl(project, task.id, { op: "tell", message: "continue" });
  assert.equal(reply?.delivered, true);

  await supervised;

  const finished = readRun(project, task.id);
  assert.equal(finished.state, "stopped", "3 consecutive same-command failures must halt the run, not leave it blocked for a 4th tell");
  const lastNote = [...finished.state_history].reverse().find((c) => c.note)?.note ?? "";
  assert.match(lastNote, /^stalled:/, "the note must lead with the word 'stalled:'");
  assert.match(lastNote, /`npm test`/, "the note must name the exact command");
  assert.match(lastNote, /exit 1/);
  assert.equal(finished.state_history[finished.state_history.length - 1].by, "kernel", "a stall halt is the kernel's own decision");
});

// --- recovery.ts: a stall-stopped run resumes with no budget flags ---------------

test("a stall-stopped run resumes with no flags, and the steer quotes the evidence", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, {
    intent: "was looping on npm test",
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
    // Well under budget — a stall halt is not a cost overrun.
    spend: { usd_est: 0.3, minutes: 4 },
  });
  transitionRun(project, task.id, "stopped", "kernel", "stalled: `npm test` failed with exit 1 on 3 consecutive turns");

  const liveStub = stubAdapter({ live: { question: "n/a", firstResult: "claim" }, statement: "fixed the actual bug and finished" });
  let supervised: Promise<void> | null = null;
  const reattach = (_projectDir: string, reentrantTask: { id: string }): { pid: number | undefined } => {
    supervised = superviseRun(project, reentrantTask.id, liveStub);
    return { pid: 424_242 };
  };

  // REVERT CHECK: before this fix, resumeStoppedRun refused this exact call (usd not
  // exceeded, no raise offered) with "no budget cap had tripped" — a stall halt is not a
  // budget event and must never require one to resume.
  const result = await resumeStoppedRun(project, task.id, undefined, undefined, () => liveStub, reattach);
  assert.equal(result.ok, true, result.message);
  assert.match(result.message, /stalled/i, "the resume result must say it was a stall, not a budget raise");
  assert.ok(supervised, "resuming a stalled run must reattach a supervisor");
  await supervised!;

  assert.equal(readRun(project, task.id).state, "ready", "the reattached supervisor's claim must actually be collected");
});

test("a usd-stopped run still demands --budget-usd — only a stall halt resumes flag-free", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, {
    intent: "genuinely over budget",
    type: "bugfix",
    agent: "stub",
    budgets: { usd: 2, minutes: 30, diff_lines: 400 },
  });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  patchRun(project, task.id, { agent_session_id: "orig-session", spend: { usd_est: 5.22, minutes: 4 } });
  transitionRun(project, task.id, "stopped", "kernel", "estimated spend $5.22 exceeded the $2.00 budget");

  const refused = await resumeStoppedRun(project, task.id, undefined, undefined, adapterByName);
  assert.equal(refused.ok, false, "a real usd overrun must still be refused without a raise");
  assert.match(refused.message, /--budget-usd/);
  assert.equal(readRun(project, task.id).state, "stopped");
});

// --- supervisor.ts: agent_session_id lands mid-stream, not only at exit ----------
//
// Found live while dispatching THIS run: "Take Over" refused a visibly-streaming run
// with "no agent session recorded" — the stream's very first init-style event carries
// session_id, but it was kept only in supervisor.ts's in-memory state.sessionId and
// written to task.json solely in the exit cleanup block, so the one field Take Over
// needs (run-pty.ts's takeOverRun) was null for the run's entire working life.

const SESSION_LIVE_SCRIPT = [
  'process.stdout.write(JSON.stringify({ type: "system", subtype: "init", session_id: "mid-stream-session" }) + "\\n");',
  'const readline = require("node:readline");',
  'readline.createInterface({ input: process.stdin }).on("line", () => {',
  '  setTimeout(() => {',
  '    const blocked = "```kage-blocked\\n" + JSON.stringify({ need: "a decision", question: "still going" }) + "\\n```";',
  '    process.stdout.write(JSON.stringify({ type: "result", result: blocked }) + "\\n");',
  '  }, 250);',
  '});',
].join("\n");

test("REGRESSION: agent_session_id is persisted the first time the stream reports it, not only at exit", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "mid-stream session id check", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");

  const sessionAdapter: Adapter = {
    name: "session-echo",
    async run() {
      return { exit_code: 0, final_message: "" };
    },
    spawnLive: () => spawn(process.execPath, ["-e", SESSION_LIVE_SCRIPT], { stdio: ["pipe", "pipe", "pipe"] }),
  };

  const supervised = superviseRun(project, task.id, sessionAdapter);

  // REVERT CHECK: before this fix, this poll would never observe the session id while
  // state is still "running" — it would only appear once the run left running entirely.
  await waitFor(() => readRun(project, task.id).agent_session_id === "mid-stream-session");
  assert.equal(readRun(project, task.id).state, "running", "the session id must land while the run is still visibly running");

  await waitFor(() => readRun(project, task.id).state === "blocked");
  // A blocked run holds its child open indefinitely, waiting for a tell that never
  // comes in this test — superviseRun's promise only resolves once the child process
  // actually closes, so an explicit stop (not a hang) is what lets `supervised` settle.
  const stopped = await sendControl(project, task.id, { op: "stop" });
  assert.equal(stopped?.ok, true);
  await supervised;

  assert.equal(readRun(project, task.id).state, "stopped");
  assert.equal(readRun(project, task.id).agent_session_id, "mid-stream-session", "the exit-time write stays as belt-and-braces and must agree");
});
