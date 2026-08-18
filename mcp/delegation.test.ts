import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter } from "./delegation/adapters/types.js";
import {
  sweepDeadRuns,
  recordSpend,
  buildClaim,
  createRun,
  listRuns,
  liveState,
  makeRunId,
  parseReportFence,
  patchRun,
  readClaim,
  readRun,
  renderRunCard,
  runDir,
  runWorkDir,
  transitionRun,
} from "./delegation/contract.js";
import { steerRun } from "./delegation/steer.js";
import { ConcurrencyLimitError, activeRunCount, appendRunLedger, reapRun } from "./delegation/contract.js";
import { interruptFrame, superviseRun, userMessageFrame } from "./delegation/supervisor.js";
import { isRunLive, sendControl } from "./delegation/control.js";
import { eventsSincePage, renderStatusBoard } from "./delegation/report.js";
import { sessionIdFrom, waitingSignal } from "./delegation/adapters/cli-agent.js";
import { claudeLiveArgs } from "./delegation/adapters/index.js";
import { loadRunRows } from "./delegation/tui/app.js";
import { dispatchRun } from "./delegation/dispatch.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { citedPaths, claimVerdict, renderClaimCard } from "./delegation/verify.js";
import { resolveTestCommand, writeDelegationConfig } from "./delegation/config.js";
import { appendSteerRecord, deliverQueuedSteer, dirtyTreeWarning, readSteerRecords, readSteers } from "./delegation/dispatch.js";
import { deleteQueuedSteer, editQueuedSteer, reorderQueuedSteers } from "./delegation/steer.js";
import { formatElapsed, progressFromStreamEvent } from "./delegation/progress.js";
import { compileBrief, renderBrief, renderBriefCard } from "./delegation/brief.js";
import { mergeRun, rejectRun } from "./delegation/ratify.js";
import { packetFlywheel, packetsTaughtByRun } from "./delegation/memory-view.js";
import { buildReport, renderReport, roomState } from "./delegation/report.js";
import { computeTrackRecord, confidenceFor, curationComparison, renderCurationLine } from "./delegation/trackrecord.js";
import { buildJudgment, readJudgment, renderJudgment } from "./delegation/manager.js";
import { buildRoomLaunch } from "./delegation/manager-prompt.js";
import { git, retryTransient, looksLikeGitRepo, type GitResult } from "./delegation/git.js";
import { stageAndMeasure } from "./delegation/git.js";
import { createWorktree, resolveWorkspaceKind } from "./delegation/worktree.js";
import { packetsDir } from "./kernel.js";
import {
  abandonGoal,
  appendGoalEvent,
  attachRunToGoal,
  createGoal,
  goalForRun,
  listGoals,
  markGoalEventsDelivered,
  patchGoal,
  readGoal,
  readPendingGoalEvents,
  transitionGoal,
} from "./delegation/goal.js";
import { drainPendingGoalEvents, notifyManagerOfRunEvent } from "./delegation/room-supervisor.js";
import { DEFAULT_SESSION, readActiveGoal, setActiveGoal } from "./delegation/room-sessions.js";
import { callTool } from "./index.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-delegation-"));
}

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

// A real git repo with a real test command — the substrate every delegation guarantee
// is measured against.
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

test("run ids are slugged, dated, and hash-suffixed", () => {
  const id = makeRunId("Fix the Flaky Auth test!!", new Date("2026-08-12T10:00:00Z"));
  assert.match(id, /^fix-the-flaky-auth-test-260812-[0-9a-f]{4}$/);
  const fallback = makeRunId("???", new Date("2026-08-12T10:00:00Z"));
  assert.match(fallback, /^run-260812-[0-9a-f]{4}$/);
});

test("state machine allows the designed lifecycle and rejects illegal jumps", () => {
  const project = tempProject();
  const task = createRun(project, { intent: "lifecycle check", type: "chore", agent: "stub" });
  assert.equal(task.state, "draft");

  for (const state of ["briefed", "dispatched", "running", "verifying", "ready", "merged"] as const) {
    transitionRun(project, task.id, state, "kernel");
  }
  const finished = readRun(project, task.id);
  assert.equal(finished.state, "merged");
  // draft + 6 transitions, each stamped with an actor.
  assert.equal(finished.state_history.length, 7);
  assert.equal(finished.state_history.every((change) => Boolean(change.at && change.by)), true);

  // Terminal states have no exits.
  assert.throws(() => transitionRun(project, task.id, "running", "kernel"), /Illegal transition/);

  // A fresh draft cannot skip straight to running.
  const fresh = createRun(project, { intent: "illegal jump", type: "chore", agent: "stub" });
  assert.throws(() => transitionRun(project, fresh.id, "running", "kernel"), /Illegal transition/);
});

test("blocked and stopped are resumable, not terminal", () => {
  const project = tempProject();
  const task = createRun(project, { intent: "resumable check", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  transitionRun(project, task.id, "blocked", "kernel", "which plan?");
  transitionRun(project, task.id, "running", "user");
  transitionRun(project, task.id, "stopped", "user");
  const resumed = transitionRun(project, task.id, "running", "user");
  assert.equal(resumed.state, "running");
});

test("claim and blocked fences parse deterministically; last fence wins; malformed degrades to null", () => {
  const claim = parseReportFence(
    'Work done.\n\n```kage-claim\n{"statement": "tests are deterministic", "unsure": ["timeout value"], "learned": ["use fake timers"]}\n```',
  );
  assert.equal(claim?.kind, "claim");
  assert.equal(claim?.statement, "tests are deterministic");
  assert.deepEqual(claim?.unsure, ["timeout value"]);
  assert.deepEqual(claim?.learned, ["use fake timers"]);

  const blocked = parseReportFence('```kage-blocked\n{"need": "a decision", "question": "A or B?"}\n```');
  assert.equal(blocked?.kind, "blocked");
  assert.equal(blocked?.question, "A or B?");

  const plan = parseReportFence(
    'Before I touch anything:\n\n```kage-plan\n{"plan": "rewrite the retry helper to be idempotent", "question": "ok to proceed?"}\n```',
  );
  assert.equal(plan?.kind, "plan");
  assert.equal(plan?.plan, "rewrite the retry helper to be idempotent");
  assert.equal(plan?.question, "ok to proceed?");
  // question is optional — a bare plan still parses.
  assert.equal(parseReportFence('```kage-plan\n{"plan": "just this"}\n```')?.plan, "just this");
  // A missing/empty plan degrades to null like the other fences.
  assert.equal(parseReportFence('```kage-plan\n{"question": "no plan given"}\n```'), null);
  assert.equal(parseReportFence('```kage-plan\n{"plan": "   "}\n```'), null);

  // Agents sometimes quote the protocol before following it — the LAST fence wins.
  const quotedThenReal = parseReportFence(
    'The protocol says to end with:\n```kage-claim\n{"statement": "example"}\n```\nNow my real report:\n```kage-claim\n{"statement": "the real claim"}\n```',
  );
  assert.equal(quotedThenReal?.statement, "the real claim");

  assert.equal(parseReportFence("no fence here at all"), null);
  assert.equal(parseReportFence('```kage-claim\n{not valid json}\n```'), null);
  assert.equal(parseReportFence('```kage-claim\n{"unsure": []}\n```'), null);
  assert.equal(parseReportFence('```kage-blocked\n{}\n```'), null);
});

test("stub dispatch round-trips to ready with a protocol-ok claim and a full paper trail", async () => {
  const project = tempProject();
  const { task, claim } = await dispatchRun(
    project,
    { intent: "prove the round trip", type: "chore" },
    stubAdapter({ statement: "round trip proven", learned: ["stub learns things"] }),
  );

  assert.equal(task.state, "ready");
  assert.ok(claim);
  assert.equal(claim.protocol_ok, true);
  assert.equal(claim.statement, "round trip proven");
  assert.deepEqual(claim.learnings, ["stub learns things"]);

  // Paper trail: brief, work edit, transcript, claim on disk, ledger events.
  const dir = join(project, ".agent_memory", "runs", task.id);
  assert.equal(existsSync(join(dir, "brief.md")), true);
  assert.equal(readFileSync(join(dir, "brief.md"), "utf8").includes("kage-claim-v1"), true);
  assert.equal(existsSync(join(runWorkDir(project, task.id), "STUB_NOTE.md")), true);
  assert.equal(existsSync(join(dir, "transcript.jsonl")), true);
  assert.equal(readClaim(project, task.id)?.statement, "round trip proven");

  const ledger = readFileSync(join(project, ".agent_memory", "reports", "runs-ledger.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { kind: string; to?: string });
  assert.equal(ledger.some((event) => event.kind === "run_created"), true);
  assert.deepEqual(
    ledger.filter((event) => event.kind === "state").map((event) => event.to),
    ["briefed", "dispatched", "running", "verifying", "ready"],
  );

  assert.equal(listRuns(project).length, 1);
  const card = renderRunCard(task, claim);
  assert.match(card, /\[ready\]/);
  assert.match(card, /round trip proven/);
});

test("a blocked stub lands in blocked with the question recorded", async () => {
  const project = tempProject();
  const { task, claim } = await dispatchRun(project, { intent: "hit a blocker", type: "chore" }, stubAdapter({ behavior: "blocked" }));
  assert.equal(task.state, "blocked");
  assert.equal(claim, undefined);
  const note = readRun(project, task.id).state_history.at(-1)?.note;
  assert.match(note ?? "", /plan A or B/);
  assert.match(renderRunCard(task), /blocked\s+stub question/);
});

test("a fence-less final message degrades to a flagged skeleton claim, never a crash", async () => {
  const project = tempProject();
  const { task, claim } = await dispatchRun(project, { intent: "forget the protocol", type: "chore" }, stubAdapter({ behavior: "no-fence" }));
  assert.equal(task.state, "ready");
  assert.ok(claim);
  assert.equal(claim.protocol_ok, false);
  assert.match(claim.statement, /skipped the kage-claim-v1 fence/);
  assert.match(renderRunCard(task, claim), /protocol MISSED/);
});

// --- step 2: worktrees --------------------------------------------------------

test("a dispatched run gets its own worktree and branch, leaving the main tree untouched", async () => {
  const project = tempGitProject();
  const { task, workspace, workspace_kind } = await dispatchRun(
    project,
    { intent: "isolate my work", type: "chore" },
    stubAdapter({ editFile: { path: "src/added.ts", content: "export const added = 1;\n" } }),
  );

  assert.equal(workspace_kind, "worktree");
  assert.equal(workspace, join(project, ".agent_memory", "worktrees", task.id));
  assert.equal(existsSync(join(workspace, "src", "added.ts")), true);
  // The user's checkout never saw the agent.
  assert.equal(existsSync(join(project, "src", "added.ts")), false);
  const branches = execFileSync("git", ["branch", "--list", task.branch], { cwd: project, encoding: "utf8" });
  assert.match(branches, new RegExp(task.branch));
});

test("a repo without commits degrades to a sandbox instead of failing", async () => {
  const project = tempProject();
  const { workspace_kind, task } = await dispatchRun(project, { intent: "no git here", type: "chore" }, stubAdapter());
  assert.equal(workspace_kind, "sandbox");
  assert.match(readRun(project, task.id).state_history.map((change) => change.note ?? "").join(" "), /sandbox/);
});

// --- step 3: the brief compiler ------------------------------------------------

test("the brief carries repo memory with author and date, and derives checks", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { capture } = await import("./kernel.js");
  const learned = capture({
    projectDir: project,
    title: "Retry helper must stay idempotent",
    body: "src/retry.ts is called from the payment path; retries must be idempotent or charges double.",
    type: "decision",
    paths: ["src/retry.ts"],
  });
  assert.equal(learned.ok, true);
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "memory"], { cwd: project, stdio: "ignore", env: GIT_ENV });

  const plan = compileBrief(project, "make the retry helper idempotent", "bugfix");
  assert.equal(plan.memories.length >= 1, true);
  const memory = plan.memories.find((entry) => entry.title.includes("idempotent"));
  assert.ok(memory, "the relevant memory should be recalled into the brief");
  assert.equal(memory.author, "Test Author");
  assert.match(memory.noted_at, /^\d{4}-\d{2}-\d{2}$/);

  // Checks: the configured test command plus the always-on diff and citation checks.
  assert.deepEqual(plan.checks.map((check) => check.id).sort(), ["citations", "diff-size", "tests"]);
  assert.equal(plan.checks.find((check) => check.id === "tests")?.cmd, "true");

  const task = createRun(project, { intent: "x", type: "bugfix", agent: "stub" });
  const rendered = renderBrief(task, plan);
  assert.match(rendered, /## What this repo already knows/);
  assert.match(rendered, /Test Author/);
  assert.match(rendered, /Kage re-runs these itself/);
  assert.match(rendered, /kage-claim-v1/);
  assert.match(renderBriefCard(task, plan), /Confidence low/);
});

test("a repo with no test command says so instead of inventing a check", () => {
  const project = tempProject();
  const plan = compileBrief(project, "do something", "chore");
  assert.equal(plan.checks.some((check) => check.kind === "command"), false);
  assert.equal(plan.notes.some((note) => note.includes("No test command found")), true);
});

// --- step 4: the verifier (the moat) -------------------------------------------

test("THE PLANTED LIE: an agent claiming green tests over a red suite is caught", async () => {
  // The suite fails, hard. The agent will claim it passes.
  const project = tempGitProject({ testCommand: "exit 1" });
  const { task, claim } = await dispatchRun(
    project,
    { intent: "fix the failing test", type: "bugfix" },
    stubAdapter({ statement: "all tests pass now", editFile: { path: "src/retry.ts", content: "export function retry() { return false; }\n" } }),
  );

  assert.ok(claim);
  // The agent's words are recorded...
  assert.equal(claim.statement, "all tests pass now");
  // ...and independently contradicted by execution.
  const tests = claim.checks.find((check) => check.id === "tests");
  assert.equal(tests?.result, "fail");
  assert.equal(tests?.exit_code, 1);
  // strict_verify keeps a lying claim out of `ready`.
  assert.equal(task.state, "failed");

  // Evidence is on disk, not asserted.
  assert.equal(existsSync(join(project, tests!.evidence!)), true);
  const card = renderClaimCard(claim, { budget: 400 });
  assert.match(card, /NOT VERIFIED/);
  assert.match(card, /checks run by Kage, not the agent/);
  assert.match(card, /✗ tests/);
});

test("a truthful claim verifies, and the card leads with the receipt", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { task, claim } = await dispatchRun(
    project,
    { intent: "make a safe change", type: "chore" },
    stubAdapter({ statement: "the change is in src/retry.ts and tests pass", editFile: { path: "src/retry.ts", content: "export function retry() { return true; }\n// safe\n" } }),
  );
  assert.equal(task.state, "ready");
  assert.ok(claim);
  assert.equal(claim.checks.every((check) => check.result === "pass"), true);
  assert.match(renderClaimCard(claim, { budget: 400 }), /VERIFIED 3\/3/);
});

test("a check the environment cannot run is unverified, never a pass", async () => {
  const project = tempGitProject({ testCommand: "kage-no-such-binary-xyz" });
  const { task, claim } = await dispatchRun(project, { intent: "run in a bare env", type: "chore" }, stubAdapter());
  const tests = claim?.checks.find((check) => check.id === "tests");
  assert.equal(tests?.result, "unverified_no_env");
  assert.equal(task.state, "failed");
  assert.match(renderClaimCard(claim!, { budget: 400 }), /could not run here — NOT counted as passing/);
});

test("an oversized diff fails its budget and the card offers to split it", async () => {
  const project = tempGitProject({ testCommand: "true" });
  writeDelegationConfig(project, { diff_budget: 5 });
  const { claim } = await dispatchRun(
    project,
    { intent: "write a lot", type: "chore" },
    stubAdapter({ editFile: { path: "src/big.ts", content: `${"export const line = 1;\n".repeat(50)}` } }),
  );
  assert.equal(claim?.checks.find((check) => check.id === "diff-size")?.result, "fail");
  assert.match(renderClaimCard(claim!, { budget: 5 }), /too large to review well/);
});

test("citation checking rejects a claim naming files that do not exist", () => {
  assert.deepEqual(citedPaths("touched src/auth/retry.ts and tests/auth.spec.ts").sort(), [
    "src/auth/retry.ts",
    "tests/auth.spec.ts",
  ]);
  assert.deepEqual(citedPaths("no paths here"), []);
});

// --- dogfood fixes (found on Kage's own first delegated run) --------------------

test("a claim backed only by static checks reads UNVERIFIED, never VERIFIED", async () => {
  // No test command anywhere: only diff-size and citations can run.
  const project = tempGitProject();
  const { task, claim } = await dispatchRun(project, { intent: "no executable checks here", type: "chore" }, stubAdapter());
  assert.ok(claim);
  assert.equal(claim.checks.every((check) => check.result === "pass"), true);

  const verdict = claimVerdict(claim);
  assert.equal(verdict.executed, false);
  assert.match(verdict.label, /UNVERIFIED — nothing was executed/);
  const card = renderClaimCard(claim, { budget: 400 });
  assert.match(card, /UNVERIFIED/);
  assert.doesNotMatch(card, /VERIFIED \d\/\d/);
  assert.match(card, /no command ran here/);
  // It is still reviewable — the diff exists — it just is not called verified.
  assert.equal(task.state, "ready");
});

test("the test command is found when package.json lives one level down", () => {
  const project = tempProject();
  mkdirSync(join(project, "mcp"), { recursive: true });
  writeFileSync(join(project, "mcp", "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
  assert.equal(resolveTestCommand(project), "npm test --prefix mcp");

  const plan = compileBrief(project, "anything", "chore");
  assert.equal(plan.checks.find((check) => check.id === "tests")?.cmd, "npm test --prefix mcp");
});

test("dispatching with a dirty tree warns that the run branches from HEAD", () => {
  const project = tempGitProject();
  assert.equal(dirtyTreeWarning(project), null);
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return 'changed'; }\n", "utf8");
  const warning = dirtyTreeWarning(project);
  assert.match(warning ?? "", /uncommitted file\(s\)/);
  assert.match(warning ?? "", /src\/retry\.ts/);
});

test("the work is committed at claim time, so a reviewable branch exists before merge", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { task } = await dispatchRun(
    project,
    { intent: "commit at claim time", type: "chore" },
    stubAdapter({ editFile: { path: "src/new.ts", content: "export const a = 1;\n" } }),
  );
  // Before any merge: the branch has a real commit ahead of main.
  const ahead = execFileSync("git", ["rev-list", "--count", `main..${task.branch}`], { cwd: project, encoding: "utf8" }).trim();
  assert.equal(ahead, "1");
  const files = execFileSync("git", ["diff", "--name-only", `main...${task.branch}`], { cwd: project, encoding: "utf8" });
  assert.match(files, /src\/new\.ts/);
});

test("merge refuses when it would overwrite the reviewer's uncommitted work", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { task } = await dispatchRun(
    project,
    { intent: "touch the shared file", type: "chore" },
    stubAdapter({ editFile: { path: "src/retry.ts", content: "export function retry() { return 'agent'; }\n" } }),
  );
  // The reviewer has their own uncommitted edit to the same file.
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return 'mine'; }\n", "utf8");
  const merged = mergeRun(project, task.id);
  assert.equal(merged.ok, false);
  assert.match(merged.message, /uncommitted changes to 1 file\(s\) this run also touched/);
  assert.match(merged.message, /src\/retry\.ts/);
  // The reviewer's work is untouched.
  assert.match(readFileSync(join(project, "src", "retry.ts"), "utf8"), /'mine'/);
});

test("progress events are extracted from a hired agent's stream", () => {
  const edit = progressFromStreamEvent(
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "mcp/cli.ts" } }] } }),
  );
  assert.deepEqual(edit, { kind: "tool", label: "editing mcp/cli.ts" });

  const bash = progressFromStreamEvent(
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "npm test" } }] } }),
  );
  assert.equal(bash?.label, "running npm test");

  assert.equal(progressFromStreamEvent("not json"), null);
  assert.equal(formatElapsed(75_000), "1m15s");
});

test("the status board shows what a running run is doing right now", async () => {
  const project = tempGitProject({ testCommand: "true" });
  await dispatchRun(project, { intent: "board test", type: "chore" }, stubAdapter());
  const board = renderStatusBoard(project);
  assert.match(board, /1 open run/);
  assert.match(board, /✓ board-test/);
  assert.match(board, /unverified|verified/i);
});

// --- step 5: merge ratifies, reject remembers ----------------------------------

test("merging a claim lands the branch and ratifies its learnings into team memory", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { task, claim } = await dispatchRun(
    project,
    { intent: "teach the repo something", type: "bugfix" },
    stubAdapter({
      statement: "fixed the retry path in src/retry.ts",
      learned: ["retry must use fake timers in tests, real sleeps make it flaky"],
      editFile: { path: "src/retry.ts", content: "export function retry() { return true; }\n// fixed\n" },
    }),
  );
  assert.equal(task.state, "ready");
  assert.equal(claim?.learnings.length, 1);

  // Before the merge the learning rides the branch as pending — recall must not serve it.
  const { loadApprovedPackets } = await import("./kernel.js");
  assert.equal(loadApprovedPackets(project).some((packet) => packet.title.includes("fake timers")), false);

  const merged = mergeRun(project, task.id);
  assert.equal(merged.ok, true);
  assert.equal(merged.ratified, 1);
  assert.equal(readRun(project, task.id).state, "merged");

  // The code landed...
  assert.match(readFileSync(join(project, "src", "retry.ts"), "utf8"), /\/\/ fixed/);
  // ...and merging is what made the memory real.
  const approved = loadApprovedPackets(project);
  assert.equal(approved.some((packet) => packet.title.includes("fake timers")), true);
  // The worktree is cleaned up; the branch remains for history.
  assert.equal(existsSync(join(project, ".agent_memory", "worktrees", task.id)), false);
});

test("a claim that is not ready cannot be merged", async () => {
  const project = tempGitProject({ testCommand: "exit 1" });
  const { task } = await dispatchRun(project, { intent: "will fail", type: "chore" }, stubAdapter());
  const merged = mergeRun(project, task.id);
  assert.equal(merged.ok, false);
  assert.match(merged.message, /is failed, not ready/);
});

test("rejecting a run captures why as negative_result memory", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { task } = await dispatchRun(project, { intent: "wrong approach", type: "refactor" }, stubAdapter());
  const rejected = rejectRun(project, task.id, "we cannot drop that index — it backs the reporting query");
  assert.equal(rejected.ok, true);
  assert.equal(rejected.captured, true);
  assert.equal(readRun(project, task.id).state, "rejected");

  const packets = readdirSync(packetsDir(project)).map((name) => readFileSync(join(packetsDir(project), name), "utf8"));
  const negative = packets.find((content) => content.includes("Rejected approach"));
  assert.ok(negative, "the rejection reason should become a packet");
  assert.match(negative, /reporting query/);
  assert.match(negative, /x-kage-type: "negative_result"/);
});

test("a stopped run can be rejected — it has no live agent process either", () => {
  const project = tempGitProject({ testCommand: "true" });
  const run = createRun(project, { intent: "abandoned approach", type: "chore", agent: "stub" });
  transitionRun(project, run.id, "briefed", "kernel");
  transitionRun(project, run.id, "dispatched", "kernel");
  transitionRun(project, run.id, "running", "kernel");
  patchRun(project, run.id, { agent_pid: process.pid });
  transitionRun(project, run.id, "stopped", "user");

  const rejected = rejectRun(project, run.id, "stopped it partway through; the approach was wrong anyway");
  assert.equal(rejected.ok, true);
  assert.equal(rejected.captured, true);
  assert.equal(readRun(project, run.id).state, "rejected");

  const packets = readdirSync(packetsDir(project)).map((name) => readFileSync(join(packetsDir(project), name), "utf8"));
  const negative = packets.find((content) => content.includes("Rejected approach") && content.includes(run.id));
  assert.ok(negative, "the rejection reason for the stopped run should become a packet");
});

test("a running run still refuses rejection, naming its actual state", () => {
  const project = tempGitProject({ testCommand: "true" });
  const run = createRun(project, { intent: "still in flight", type: "chore", agent: "stub" });
  transitionRun(project, run.id, "briefed", "kernel");
  transitionRun(project, run.id, "dispatched", "kernel");
  transitionRun(project, run.id, "running", "kernel");
  patchRun(project, run.id, { agent_pid: process.pid });

  const rejected = rejectRun(project, run.id, "changed my mind");
  assert.equal(rejected.ok, false);
  assert.equal(rejected.captured, false);
  assert.match(rejected.message, /running/);
  assert.equal(readRun(project, run.id).state, "running");
});

// --- the spine: concurrency, reaping, live control ------------------------------

test("the concurrency gate lives at the kernel so every surface obeys one limit", () => {
  const project = tempGitProject({ testCommand: "true" });
  writeDelegationConfig(project, { max_concurrent: 2 });
  const start = (intent: string) => {
    const run = createRun(project, { intent, type: "chore", agent: "stub" });
    transitionRun(project, run.id, "briefed", "kernel");
    transitionRun(project, run.id, "dispatched", "kernel");
    transitionRun(project, run.id, "running", "kernel");
    patchRun(project, run.id, { agent_pid: process.pid });
    return run;
  };
  start("one");
  start("two");
  assert.equal(activeRunCount(project), 2);

  const third = createRun(project, { intent: "three", type: "chore", agent: "stub" });
  transitionRun(project, third.id, "briefed", "kernel");
  transitionRun(project, third.id, "dispatched", "kernel");
  assert.throws(() => transitionRun(project, third.id, "running", "kernel"), ConcurrencyLimitError);

  // A dead run must not hold a slot hostage — this is why the count is derived.
  const stuck = createRun(project, { intent: "ghost", type: "chore", agent: "stub" });
  transitionRun(project, stuck.id, "briefed", "kernel");
  transitionRun(project, stuck.id, "dispatched", "kernel");
  patchRun(project, stuck.id, { agent_pid: 999_999 });
  assert.equal(activeRunCount(project), 2, "a dispatched run with a dead pid is not in flight");
});

test("answering a blocked run is never refused by the concurrency gate", () => {
  const project = tempGitProject({ testCommand: "true" });
  writeDelegationConfig(project, { max_concurrent: 1 });
  const busy = createRun(project, { intent: "busy", type: "chore", agent: "stub" });
  transitionRun(project, busy.id, "briefed", "kernel");
  transitionRun(project, busy.id, "dispatched", "kernel");
  transitionRun(project, busy.id, "running", "kernel");
  patchRun(project, busy.id, { agent_pid: process.pid });

  const blocked = createRun(project, { intent: "waiting on you", type: "chore", agent: "stub" });
  transitionRun(project, blocked.id, "briefed", "kernel");
  transitionRun(project, blocked.id, "dispatched", "kernel");
  patchRun(project, blocked.id, { agent_pid: 999_999 });
  transitionRun(project, blocked.id, "failed", "kernel", "lost");
  // Resuming existing work is not new work: stranding the runs that need a human most
  // would be the worst possible reading of a concurrency limit.
  assert.doesNotThrow(() => transitionRun(project, blocked.id, "running", "user", "answered"));
});

test("reaping persists death instead of leaving it derived forever", () => {
  const project = tempGitProject({ testCommand: "true" });
  const run = createRun(project, { intent: "lost agent", type: "chore", agent: "stub" });
  transitionRun(project, run.id, "briefed", "kernel");
  transitionRun(project, run.id, "dispatched", "kernel");
  transitionRun(project, run.id, "running", "kernel");
  patchRun(project, run.id, { agent_pid: 999_999 });

  assert.equal(readRun(project, run.id).display_state, "dropped");
  const reaped = reapRun(project, run.id);
  assert.equal(reaped?.state, "failed", "the record itself now says so");
  assert.equal(readRun(project, run.id).display_state, "failed");
  // Still answerable and rejectable — a lost run is not a verdict.
  assert.doesNotThrow(() => transitionRun(project, run.id, "running", "user", "retry"));
  // Reaping a run with a LIVE process is a no-op. (Retried above with the pid still
  // dead, it is legitimately droppable again — so give it a real process first.)
  patchRun(project, run.id, { agent_pid: process.pid });
  assert.equal(reapRun(project, run.id), null);
});

test("control frames match the verified stream-json protocol", () => {
  const tell = JSON.parse(userMessageFrame("use plan B")) as { type: string; message: { role: string; content: string } };
  assert.equal(tell.type, "user");
  assert.equal(tell.message.role, "user");
  assert.equal(tell.message.content, "use plan B");
  assert.equal(userMessageFrame("x").endsWith("\n"), true, "the agent reads line-delimited frames");

  const interrupt = JSON.parse(interruptFrame()) as { type: string; request: { subtype: string } };
  assert.equal(interrupt.type, "control_request");
  assert.equal(interrupt.request.subtype, "interrupt");
});

test("control calls to a run with no supervisor return null, never a false delivery", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const run = createRun(project, { intent: "no supervisor", type: "chore", agent: "stub" });
  assert.equal(await sendControl(project, run.id, { op: "status" }), null);
  assert.equal(await isRunLive(project, run.id), false);
});

test("the detached supervisor runs a non-claude adapter for real — not a placeholder that fakes success", async () => {
  // Every run dispatched through the web app or POST /runs goes through THIS path
  // (dispatchDetached → `kage supervise` → superviseRun), never the in-process one
  // tests for other agents exercise via dispatchRun/executeRun. Before this fix,
  // superviseRun spawned `node -e process.exit(0)` for any non-claude agent instead of
  // running the adapter — the worktree never changed, the checks passed trivially
  // against a zero-line diff, and the claim still read VERIFIED. This is that bug,
  // caught while checking the app's live Follow view actually had something to render.
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "leave a real note", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");

  await superviseRun(project, task.id);

  const finished = readRun(project, task.id);
  assert.equal(finished.state, "ready", "a real stub run with passing checks must reach ready");
  const claim = JSON.parse(readFileSync(join(runDir(project, task.id), "claim.json"), "utf8")) as {
    statement: string;
    protocol_ok: boolean;
    diff: { files: number; lines: number };
  };
  assert.equal(claim.statement, "stub work delivered", "the adapter's real claim, not the generic fallback");
  assert.equal(claim.protocol_ok, true, "a real kage-claim fence was parsed, proving the adapter actually ran");
  assert.ok(claim.diff.files >= 1, "the stub's real file edit must land in the diff — a placeholder child never touches the worktree");
});

async function waitFor(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out waiting for condition");
    await new Promise((r) => setTimeout(r, 20));
  }
}

test("REGRESSION: a blocked supervised run stays live, and a tell completes it in the same session", async () => {
  // The bug, observed three times live: on a blocked fence superviseRun transitioned to
  // `blocked` and RETURNED, tearing down its socket and the held child with it. A later
  // answer had no supervisor to reach, so steer.ts fell back to resuming the agent's
  // session in a brand-new, unsupervised process — whose eventual claim nobody was left
  // to collect. Blocked must be a WAITING state: the same supervisor stays up, the same
  // child stays alive, and a tell through ITS socket is what finishes the run.
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "needs a decision", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");

  const liveStub = stubAdapter({ live: { question: "proceed with plan A or B?" } });
  const supervised = superviseRun(project, task.id, liveStub);

  await waitFor(() => readRun(project, task.id).state === "blocked");
  assert.equal(await isRunLive(project, task.id), true, "the socket must still answer — blocked is not an exit");

  const reply = await sendControl(project, task.id, { op: "tell", message: "go with plan A" });
  assert.equal(reply?.delivered, true, "the tell must reach the SAME live agent, not a queued file");

  await supervised;

  const finished = readRun(project, task.id);
  assert.equal(finished.state, "ready", "the answered turn's claim must be collected by the same supervisor");
  const claim = JSON.parse(readFileSync(join(runDir(project, task.id), "claim.json"), "utf8")) as { protocol_ok: boolean };
  assert.equal(claim.protocol_ok, true, "a real kage-claim fence from the resumed turn, not a fallback");
});

test("a stop on a blocked supervised run lands stopped and the supervisor exits", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "needs a decision", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");

  const liveStub = stubAdapter({ live: { question: "proceed with plan A or B?" } });
  const supervised = superviseRun(project, task.id, liveStub);

  await waitFor(() => readRun(project, task.id).state === "blocked");
  assert.equal(await isRunLive(project, task.id), true);

  const reply = await sendControl(project, task.id, { op: "stop" });
  assert.equal(reply?.ok, true);

  await supervised;

  assert.equal(readRun(project, task.id).state, "stopped");
  assert.equal(await isRunLive(project, task.id), false, "the supervisor must actually exit once stopped");
});

// --- one truth about state, on every surface -----------------------------------

test("ALL surfaces report the same state for a run whose process died", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const orphan = createRun(project, { intent: "orphaned run", type: "chore", agent: "claude" });
  transitionRun(project, orphan.id, "briefed", "kernel");
  transitionRun(project, orphan.id, "dispatched", "kernel");
  transitionRun(project, orphan.id, "running", "kernel");
  patchRun(project, orphan.id, { agent_pid: 999_999 });

  // 1. the record itself
  const view = readRun(project, orphan.id);
  assert.equal(view.display_state, "dropped");
  assert.equal(view.ownership, "needs_you");
  assert.equal(view.state, "running", "the raw state is preserved; only the DISPLAY is derived");

  // 2. the TUI board
  assert.equal(loadRunRows(project).find((row) => row.id === orphan.id)?.state, "dropped");

  // 3. the status board
  assert.match(renderStatusBoard(project), /dropped/);

  // 4. the manager's room state — this one used to say "running"
  const room = roomState(project) as { runs: Array<{ id: string; state: string }>; needs_you: Array<{ id: string }> };
  assert.equal(room.runs.find((run) => run.id === orphan.id)?.state, "dropped");
  assert.equal(room.needs_you.some((run) => run.id === orphan.id), true, "a dropped run needs a human");

  // 5. the while-you-were-away digest — this one used to omit it entirely
  const report = buildReport(project, { all: true });
  assert.equal(report.halted.some((task) => task.id === orphan.id), true);
  assert.match(renderReport(project, report), /agent process gone/);

  // And nothing calls it running anywhere.
  const everySurface = [
    renderStatusBoard(project),
    renderReport(project, buildReport(project, { all: true })),
    JSON.stringify(roomState(project)),
    JSON.stringify(loadRunRows(project)),
  ].join("\n");
  assert.doesNotMatch(everySurface, /running/, "no surface may call a dead process running");
});

test("a live process is not reported as dropped", () => {
  const project = tempGitProject({ testCommand: "true" });
  const run = createRun(project, { intent: "alive", type: "chore", agent: "claude" });
  transitionRun(project, run.id, "briefed", "kernel");
  transitionRun(project, run.id, "dispatched", "kernel");
  transitionRun(project, run.id, "running", "kernel");
  patchRun(project, run.id, { agent_pid: process.pid });
  const view = readRun(project, run.id);
  assert.equal(view.display_state, "running");
  assert.equal(view.ownership, "working");
});

test("THE FLYWHEEL: dispatch records the brief's memories, merge tags what it taught, both directions resolve", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { capture } = await import("./kernel.js");
  capture({
    projectDir: project,
    title: "Retry helper must stay idempotent",
    body: "src/retry.ts is called from the payment path; retries must be idempotent.",
    type: "decision",
    paths: ["src/retry.ts"],
  });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "memory"], { cwd: project, stdio: "ignore", env: GIT_ENV });

  // Run 1: its brief carries the seeded memory; its agent reports a learning.
  const first = await dispatchRun(
    project,
    { intent: "make the retry helper idempotent", type: "bugfix" },
    stubAdapter({
      editFile: { path: "src/retry.ts", content: "export function retry() { return 1; }\n" },
      learned: ["The retry helper is now guarded by an idempotency token"],
    }),
  );
  const carriedIn = readRun(project, first.task.id).brief_memory_ids ?? [];
  assert.ok(carriedIn.length >= 1, "dispatch records which packets the brief carried");
  assert.equal(readRun(project, first.task.id).display_state, "ready");

  const merge = mergeRun(project, first.task.id);
  assert.equal(merge.ok, true, merge.message);
  assert.equal(merge.ratified, 1);

  // Backward edge: the run knows what it taught, and the merge approved it.
  const taught = packetsTaughtByRun(project, first.task.id);
  assert.equal(taught.length, 1);
  assert.match(taught[0].title, /idempotency token/);
  assert.equal(taught[0].status, "approved");

  // Forward edge: the packet names the run that taught it.
  const flywheel = packetFlywheel(project, taught[0].id);
  assert.equal(flywheel.born_from_run?.id, first.task.id);

  // And the loop closes: the NEXT brief carries the ratified learning, and the
  // packet can name that run too.
  const second = await dispatchRun(
    project,
    { intent: "extend the idempotency token guard on the retry helper", type: "chore" },
    stubAdapter({}),
  );
  const carriedOn = readRun(project, second.task.id).brief_memory_ids ?? [];
  assert.ok(carriedOn.includes(taught[0].id), "the next brief carries what the merge ratified");
  const closed = packetFlywheel(project, taught[0].id);
  assert.ok(closed.used_by_runs.some((run) => run.id === second.task.id), "the packet lists the run it was briefed into");
});

test("a stopped run needs a human — it cannot make progress by itself", () => {
  // Mapped to "working" for months. The three-door UI hid it: the inbox never
  // listed a stopped run (not needs_you), the run list filed it under Working, and
  // the board filed it under Lost — three surfaces, three stories. The unified
  // work surface put all three side by side and exposed the contradiction.
  const project = tempGitProject({ testCommand: "true" });
  const run = createRun(project, { intent: "halted mid-flight", type: "chore", agent: "claude" });
  transitionRun(project, run.id, "briefed", "kernel");
  transitionRun(project, run.id, "dispatched", "kernel");
  transitionRun(project, run.id, "running", "kernel");
  transitionRun(project, run.id, "stopped", "user");
  assert.equal(readRun(project, run.id).ownership, "needs_you");
});

// --- the ledger cursor must not lose events -------------------------------------

test("same-millisecond events survive the cursor, and truncation is reported", () => {
  const project = tempProject();
  // Timestamps collide constantly in practice: transitionRun and appendRunLedger fire
  // back to back. A time-based cursor loses the second event of every such pair.
  for (let index = 0; index < 150; index += 1) {
    appendRunLedger(project, { kind: "state", run_id: `run-${index}`, to: "running" });
  }

  const first = eventsSincePage(project, 0);
  assert.equal(first.events.length, 100, "a page is bounded");
  assert.equal(first.dropped, 50, "and says how many it could not fit, instead of hiding them");
  assert.ok(first.cursor >= 150);

  // Nothing new since the cursor.
  const caughtUp = eventsSincePage(project, first.cursor);
  assert.deepEqual(caughtUp.events, []);
  assert.equal(caughtUp.dropped, 0);

  // Two events written within the same millisecond are BOTH delivered.
  appendRunLedger(project, { kind: "state", run_id: "twin-a" });
  appendRunLedger(project, { kind: "state", run_id: "twin-b" });
  const next = eventsSincePage(project, first.cursor);
  assert.deepEqual(next.events.map((event) => event.run_id), ["twin-a", "twin-b"]);
  assert.equal(next.cursor, first.cursor + 2);

  // Sequence numbers are monotonic and unique.
  const seqs = eventsSincePage(project, 0).events.map((event) => Number(event.seq));
  assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b));
  assert.equal(new Set(seqs).size, seqs.length);
});

test("a ledger written before sequencing still advances its cursor", () => {
  const project = tempProject();
  // Exactly what exists in a repo that used Kage before seq numbers: no seq field.
  const path = join(project, ".agent_memory", "reports", "runs-ledger.jsonl");
  mkdirSync(join(project, ".agent_memory", "reports"), { recursive: true });
  writeFileSync(
    path,
    [
      JSON.stringify({ at: "2026-08-12T10:00:00.000Z", kind: "state", run_id: "old-1" }),
      JSON.stringify({ at: "2026-08-12T10:00:00.000Z", kind: "state", run_id: "old-2" }),
    ].join("\n") + "\n",
    "utf8",
  );

  const first = eventsSincePage(project, 0);
  assert.equal(first.events.length, 2);
  assert.equal(first.cursor, 2, "legacy lines are numbered by position so the cursor can move");
  assert.deepEqual(eventsSincePage(project, first.cursor).events, [], "and a caught-up caller gets nothing");

  // New events continue ABOVE the implicit numbering rather than colliding with it.
  appendRunLedger(project, { kind: "state", run_id: "new-1" });
  const next = eventsSincePage(project, first.cursor);
  assert.deepEqual(next.events.map((event) => event.run_id), ["new-1"]);
  assert.ok(next.cursor > first.cursor);
});

// --- steering that actually reaches the agent ----------------------------------

test("REGRESSION: steering a run with a dead supervisor reattaches one instead of orphaning the claim", async () => {
  // The bug, observed three times live: no supervisor was listening, so steerRun fell
  // back to a fire-and-forget `claude --resume` — the message was delivered, the agent
  // finished a turn, and its claim landed in a transcript nobody was left to collect.
  // The fix reattaches a real supervisor (the `reattach` seam here stands in for the
  // real detached `dispatchDetached` spawn) so the SAME process that took the steer is
  // the one that collects the eventual claim.
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "needs a decision", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  transitionRun(project, task.id, "failed", "kernel", "its supervisor died mid-turn");
  patchRun(project, task.id, { agent_session_id: "dead-session", agent_pid: 999_999 });

  const liveStub = stubAdapter({ live: { question: "n/a", firstResult: "claim" }, statement: "resumed and finished" });
  const spawnCalls: Array<{ sessionId?: string; resumeSessionId?: string }> = [];
  const realSpawnLive = liveStub.spawnLive!;
  liveStub.spawnLive = (input) => {
    spawnCalls.push({ sessionId: input.sessionId, resumeSessionId: input.resumeSessionId });
    return realSpawnLive(input);
  };

  let supervised: Promise<void> | null = null;
  const reattach = (_projectDir: string, reentrantTask: { id: string }) => {
    supervised = superviseRun(project, reentrantTask.id, liveStub);
    return { pid: 424_242 };
  };

  const result = await steerRun(project, task.id, "continue with plan A", () => liveStub, reattach);
  assert.equal(result.delivery, "resumed");
  assert.match(result.message, /reattaching/);
  assert.ok(supervised, "steering a dead-supervisor run must reattach one");
  assert.deepEqual(readSteers(project, task.id), ["continue with plan A"]);

  await supervised!;

  assert.equal(spawnCalls[0]?.resumeSessionId, "dead-session", "reattaching must RESUME the same session, not start a new one");
  assert.equal(spawnCalls[0]?.sessionId, undefined);

  const finished = readRun(project, task.id);
  assert.equal(finished.state, "ready", "the reattached supervisor's claim must actually be collected");
  const claim = JSON.parse(readFileSync(join(runDir(project, task.id), "claim.json"), "utf8")) as {
    protocol_ok: boolean;
    statement: string;
  };
  assert.equal(claim.protocol_ok, true, "a real kage-claim fence from the resumed turn, not a fallback");
  assert.equal(claim.statement, "resumed and finished");
});

test("steering a HEALTHY supervised run still goes through the live socket — no reattach spawned", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "needs a decision", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");

  const liveStub = stubAdapter({ live: { question: "proceed with plan A or B?" } });
  const supervised = superviseRun(project, task.id, liveStub);

  await waitFor(() => readRun(project, task.id).state === "blocked");
  assert.equal(await isRunLive(project, task.id), true);

  let reattachCalls = 0;
  const reattach = (): { pid: number | undefined } => {
    reattachCalls += 1;
    return { pid: undefined };
  };

  const result = await steerRun(project, task.id, "go with plan A", () => liveStub, reattach);
  assert.equal(result.delivery, "delivered");
  assert.equal(reattachCalls, 0, "a live socket must never spawn a reattach supervisor");

  await supervised;
  assert.equal(readRun(project, task.id).state, "ready");
});

test("claudeLiveArgs resumes an existing session over starting a fresh one, and never both", () => {
  assert.deepEqual(claudeLiveArgs({}).slice(0, 1), ["-p"], "no id at all: fresh session, agent assigns its own");
  assert.deepEqual(claudeLiveArgs({ sessionId: "new-id" }).slice(0, 2), ["--session-id", "new-id"]);
  assert.deepEqual(claudeLiveArgs({ resumeSessionId: "old-id" }).slice(0, 2), ["--resume", "old-id"]);
  assert.deepEqual(
    claudeLiveArgs({ sessionId: "new-id", resumeSessionId: "old-id" }).slice(0, 2),
    ["--resume", "old-id"],
    "resume wins when both are somehow set",
  );
});

test("a message to a LIVE agent is reported as stored, never as delivered", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const run = createRun(project, { intent: "still working", type: "chore", agent: "stub" });
  transitionRun(project, run.id, "briefed", "kernel");
  transitionRun(project, run.id, "dispatched", "kernel");
  transitionRun(project, run.id, "running", "kernel");
  // This process is alive by definition, so the run counts as genuinely in flight.
  patchRun(project, run.id, { agent_pid: process.pid });

  const result = await steerRun(project, run.id, "change course", () => stubAdapter());
  // Nothing holds a live agent's stdin yet, so the honest word is "stored".
  assert.equal(result.delivery, "stored");
  assert.match(result.message, /STORED, not delivered/);
  assert.match(result.message, /kage stop/, "and it names the way to actually redirect it");
  assert.doesNotMatch(result.message, /next boundary/, "the old wording implied a delivery that never happened");
  // It IS persisted, so a retry picks it up.
  assert.deepEqual(readSteers(project, run.id), ["change course"]);
});

test("steering a run with no recorded session says so instead of pretending", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { task } = await dispatchRun(project, { intent: "legacy run", type: "chore" }, stubAdapter({ behavior: "blocked" }));
  patchRun(project, task.id, { agent_session_id: undefined });
  const result = await steerRun(project, task.id, "answer", () => stubAdapter());
  assert.equal(result.delivery, "refused");
  assert.match(result.message, /no agent session recorded/);
  assert.match(result.message, /kage retry/);
});

// --- steer queue: per-message truth ---------------------------------------------

test("a queued steer flips to delivered exactly when the live socket takes it", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "needs a decision", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");

  const liveStub = stubAdapter({ live: { question: "proceed with plan A or B?" } });
  const supervised = superviseRun(project, task.id, liveStub);

  await waitFor(() => readRun(project, task.id).state === "blocked");

  const result = await steerRun(project, task.id, "go with plan A", () => liveStub, () => ({ pid: undefined }));
  assert.equal(result.delivery, "delivered");

  const records = readSteerRecords(project, task.id);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, "delivered", "the record the supervisor actually wrote must flip, not stay queued");
  assert.ok(records[0].delivered_at, "a delivered record carries when it landed");

  await supervised;
  assert.equal(readRun(project, task.id).state, "ready");
});

test("a stored steer (no live socket) stays queued — nothing marks it delivered on a lie", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const run = createRun(project, { intent: "still working", type: "chore", agent: "stub" });
  transitionRun(project, run.id, "briefed", "kernel");
  transitionRun(project, run.id, "dispatched", "kernel");
  transitionRun(project, run.id, "running", "kernel");
  patchRun(project, run.id, { agent_pid: process.pid });

  const result = await steerRun(project, run.id, "change course", () => stubAdapter());
  assert.equal(result.delivery, "stored");
  const records = readSteerRecords(project, run.id);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, "queued", "a stored (not delivered) steer must remain queued, not be marked delivered");
});

test("queue mutations: edit/delete/reorder work on queued steers, and refuse outright on delivered ones", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "batching steers", type: "chore", agent: "stub" });

  const a = appendSteerRecord(project, task.id, "first");
  const b = appendSteerRecord(project, task.id, "second");
  const c = appendSteerRecord(project, task.id, "third");

  const edited = editQueuedSteer(project, task.id, b.id, "second, revised");
  assert.equal(edited.ok, true);
  assert.equal(edited.records.find((r) => r.id === b.id)?.message, "second, revised");

  const reordered = reorderQueuedSteers(project, task.id, [c.id, a.id, b.id]);
  assert.equal(reordered.ok, true);
  assert.deepEqual(reordered.records.map((r) => r.id), [c.id, a.id, b.id]);

  const deleted = deleteQueuedSteer(project, task.id, a.id);
  assert.equal(deleted.ok, true);
  assert.deepEqual(deleted.records.map((r) => r.id), [c.id, b.id]);

  // Bad input refuses with a reason instead of silently no-oping.
  assert.equal(editQueuedSteer(project, task.id, "no-such-id", "x").ok, false);
  assert.equal(editQueuedSteer(project, task.id, b.id, "   ").ok, false, "an empty message refuses too");

  // Once delivered, a record is immutable history — every mutation on it refuses.
  deliverQueuedSteer(project, task.id, c.id);
  const editRefused = editQueuedSteer(project, task.id, c.id, "too late");
  assert.equal(editRefused.ok, false);
  assert.match(editRefused.reason ?? "", /immutable/);
  const deleteRefused = deleteQueuedSteer(project, task.id, c.id);
  assert.equal(deleteRefused.ok, false);
  assert.match(deleteRefused.reason ?? "", /immutable/);
  const reorderRefused = reorderQueuedSteers(project, task.id, [c.id, b.id]);
  assert.equal(reorderRefused.ok, false);
  assert.match(reorderRefused.reason ?? "", /immutable/);
  // The still-queued sibling is untouched by the refused mutations.
  assert.equal(readSteerRecords(project, task.id).find((r) => r.id === b.id)?.status, "queued");
});

const ECHO_LIVE_SCRIPT = [
  'const readline = require("node:readline");',
  'readline.createInterface({ input: process.stdin }).on("line", (line) => {',
  '  const msg = JSON.parse(line);',
  '  const claim = JSON.stringify({ statement: msg.message.content, unsure: [], learned: [] });',
  '  const body = "```kage-claim\\n" + claim + "\\n```";',
  '  process.stdout.write(JSON.stringify({ type: "result", result: body }) + "\\n");',
  '});',
].join("\n");

test("REGRESSION: reattach delivers ALL queued steers oldest-first, not just the newest", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "needs a decision", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  transitionRun(project, task.id, "failed", "kernel", "its supervisor died mid-turn");
  patchRun(project, task.id, { agent_session_id: "dead-session", agent_pid: 999_999 });

  appendSteerRecord(project, task.id, "first steer");
  appendSteerRecord(project, task.id, "second steer");

  // A minimal live adapter that echoes exactly what it received on stdin back as its
  // claim statement — the most direct way to prove WHAT was injected, not just that
  // something was.
  const echoAdapter: Adapter = {
    name: "echo",
    async run() {
      return { exit_code: 0, final_message: "" };
    },
    spawnLive: () => spawn(process.execPath, ["-e", ECHO_LIVE_SCRIPT], { stdio: ["pipe", "pipe", "pipe"] }),
  };

  await superviseRun(project, task.id, echoAdapter);

  const claim = JSON.parse(readFileSync(join(runDir(project, task.id), "claim.json"), "utf8")) as { statement: string };
  assert.equal(claim.statement, "first steer\n\nsecond steer", "both queued steers ride the same reattach, oldest first");

  const records = readSteerRecords(project, task.id);
  assert.equal(records.every((r) => r.status === "delivered"), true, "every queued steer is marked delivered by the reattach");
  assert.ok(records.every((r) => r.delivered_at), "each delivered record carries when it landed");
  assert.equal(readRun(project, task.id).state, "ready");
});

// --- plan review: a typed fence, not a generic block ----------------------------

const PLAN_LIVE_SCRIPT = [
  'const readline = require("node:readline");',
  'let phase = 0;',
  'const planBody = "```kage-plan\\n" + JSON.stringify({ plan: "rewrite the auth module", question: "ok to proceed?" }) + "\\n```";',
  'const claimBody = "```kage-claim\\n" + JSON.stringify({ statement: "auth module rewritten", unsure: [], learned: [] }) + "\\n```";',
  'readline.createInterface({ input: process.stdin }).on("line", () => {',
  '  phase += 1;',
  '  const body = phase === 1 ? planBody : claimBody;',
  '  process.stdout.write(JSON.stringify({ type: "result", result: body }) + "\\n");',
  '});',
].join("\n");

test("REGRESSION: a kage-plan fence blocks for approval, and an explicit tell resumes it into a claim", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const task = createRun(project, { intent: "needs plan approval", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");

  const planAdapter: Adapter = {
    name: "plan-stub",
    async run() {
      return { exit_code: 0, final_message: "" };
    },
    spawnLive: () => spawn(process.execPath, ["-e", PLAN_LIVE_SCRIPT], { stdio: ["pipe", "pipe", "pipe"] }),
  };

  const supervised = superviseRun(project, task.id, planAdapter);

  await waitFor(() => readRun(project, task.id).state === "blocked");
  const blockedRun = readRun(project, task.id);
  assert.deepEqual(blockedRun.waiting_on, { needs: "plan approval", detail: "rewrite the auth module" });

  // Never auto-approved: only an explicit tell resumes it, through the same blocked
  // machinery a plain block uses.
  const reply = await sendControl(project, task.id, { op: "tell", message: "approved, go ahead" });
  assert.equal(reply?.delivered, true);

  await supervised;

  const finished = readRun(project, task.id);
  assert.equal(finished.state, "ready");
  assert.equal(finished.waiting_on, undefined, "the approved plan's waiting_on is cleared on resume");
  const claim = JSON.parse(readFileSync(join(runDir(project, task.id), "claim.json"), "utf8")) as { statement: string };
  assert.equal(claim.statement, "auth module rewritten");
});

test("a run whose process died is reported as dropped, never as running", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { task } = await dispatchRun(project, { intent: "orphan", type: "chore" }, stubAdapter());
  // Simulate the real failure: state says running, but the pid is long gone.
  transitionRun(project, task.id, "merged", "user");
  const orphan = createRun(project, { intent: "orphaned run", type: "chore", agent: "claude" });
  transitionRun(project, orphan.id, "briefed", "kernel");
  transitionRun(project, orphan.id, "dispatched", "kernel");
  transitionRun(project, orphan.id, "running", "kernel");
  patchRun(project, orphan.id, { agent_pid: 999_999 });

  const live = liveState(readRun(project, orphan.id));
  assert.equal(live.stale, true);
  const row = loadRunRows(project).find((entry) => entry.id === orphan.id);
  assert.equal(row?.state, "dropped");
  assert.match(row?.detail ?? "", /agent process gone/);
  assert.equal(row?.needsYou, true);

  // A live pid is not stale — this process is alive by definition.
  patchRun(project, orphan.id, { agent_pid: process.pid });
  assert.equal(liveState(readRun(project, orphan.id)).stale, false);
});

test("the board shows the agent's actual question, not the word 'blocked'", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { task } = await dispatchRun(project, { intent: "needs a decision", type: "chore" }, stubAdapter({ behavior: "blocked" }));
  patchRun(project, task.id, { waiting_on: { detail: "asking: users-first or orders-first?", needs: "reply users-first or orders-first" } });
  const row = loadRunRows(project).find((entry) => entry.id === task.id);
  assert.equal(row?.detail, "reply users-first or orders-first");
});

test("the stream's blocked summary is detected even without a protocol fence", () => {
  const blocked = waitingSignal(
    JSON.stringify({
      subtype: "post_turn_summary",
      status_category: "blocked",
      status_detail: "asking: TypeScript or Python for new feature?",
      needs_action: "reply with TypeScript or Python",
    }),
  );
  assert.deepEqual(blocked, {
    detail: "asking: TypeScript or Python for new feature?",
    needs: "reply with TypeScript or Python",
  });
  // A review-ready summary is not a block.
  assert.equal(waitingSignal(JSON.stringify({ subtype: "post_turn_summary", status_category: "review_ready" })), null);
  assert.equal(waitingSignal("not json"), null);
  assert.equal(sessionIdFrom(JSON.stringify({ session_id: "abc-123" })), "abc-123");
});

// --- manager judgment: recorded, validated, and measured -----------------------

test("manager judgment is applied, recorded, and distinguishable from kernel defaults", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { capture } = await import("./kernel.js");
  capture({
    projectDir: project,
    title: "Retry helper is on the payment path",
    body: "src/retry.ts is called from billing; retries must stay idempotent.",
    type: "decision",
    paths: ["src/retry.ts"],
  });

  const offered = compileBrief(project, "make the retry helper idempotent", "bugfix");
  assert.ok(offered.memories.length >= 1, "the fixture memory should be recalled");
  const dropId = offered.memories[0].id;

  const { task } = await dispatchRun(
    project,
    {
      intent: "make the retry helper idempotent",
      type: "bugfix",
      judgment: {
        dropMemoryIds: [{ id: dropId, reason: "this task is about the refund path, not billing" }],
        clarification: { question: "CI only or local too?", answer: "local too" },
      },
    },
    stubAdapter(),
  );

  assert.equal(task.curated_by, "manager");
  const judgment = readJudgment(project, task.id);
  assert.ok(judgment);
  assert.deepEqual(judgment.dropped, [{ id: dropId, reason: "this task is about the refund path, not billing" }]);
  assert.equal(judgment.kept_memory_ids.includes(dropId), false);
  assert.equal(judgment.clarification?.answer, "local too");
  assert.deepEqual(judgment.violations, []);

  // The dropped memory really is absent from what the agent was told.
  const brief = readFileSync(join(project, ".agent_memory", "runs", task.id, "brief.md"), "utf8");
  assert.doesNotMatch(brief, /payment path/);

  const rendered = renderJudgment(judgment).join("\n");
  assert.match(rendered, /kept 0 of 1 offered/);
  assert.match(rendered, /refund path, not billing/);

  // A run with no judgment is explicitly kernel-shaped, not silently assumed.
  const plain = await dispatchRun(project, { intent: "something else", type: "chore" }, stubAdapter());
  assert.equal(plain.task.curated_by, "kernel");
  assert.equal(readJudgment(project, plain.task.id), null);
  assert.match(renderJudgment(null).join("\n"), /kernel defaults/);
});

test("the kernel refuses judgment it cannot justify, and keeps the refusal on the record", () => {
  const judgment = buildJudgment("run-1", {
    offeredMemoryIds: ["mem-a", "mem-b"],
    dropMemoryIds: [
      { id: "mem-a", reason: "" },
      { id: "mem-never-offered", reason: "invented" },
      { id: "mem-b", reason: "superseded by the new runbook" },
    ],
    kernelConfidence: "low",
    managerConfidence: "high",
  });

  // A drop with no reason is not applied; an invented id is not applied.
  assert.deepEqual(judgment.dropped.map((drop) => drop.id), ["mem-b"]);
  assert.deepEqual(judgment.kept_memory_ids, ["mem-a"]);
  // Confidence may never be inflated.
  assert.equal(judgment.confidence.manager, "low");
  assert.equal(judgment.violations.length, 3);
  assert.ok(judgment.violations.some((entry) => entry.includes("without a reason")));
  assert.ok(judgment.violations.some((entry) => entry.includes("never offered")));
  assert.ok(judgment.violations.some((entry) => entry.includes("tried to raise confidence")));

  // Lowering is allowed and recorded with its reason.
  const lowered = buildJudgment("run-2", {
    offeredMemoryIds: [],
    kernelConfidence: "high",
    managerConfidence: "medium",
    confidenceReason: "the migration touches data I cannot roll back",
  });
  assert.equal(lowered.confidence.manager, "medium");
  assert.deepEqual(lowered.violations, []);
  assert.match(renderJudgment(lowered).join("\n"), /lowered high → medium — the migration touches data/);
});

test("curation outcomes are comparable, and thin data refuses to draw a conclusion", async () => {
  const project = tempGitProject({ testCommand: "true" });
  await dispatchRun(project, { intent: "kernel run", type: "chore" }, stubAdapter());
  await dispatchRun(
    project,
    { intent: "managed run", type: "chore", judgment: { notes: "nothing to drop; dispatched as compiled" } },
    stubAdapter(),
  );

  const comparison = curationComparison(project);
  assert.equal(comparison.manager.dispatched, 1);
  assert.equal(comparison.kernel.dispatched, 1);
  const line = renderCurationLine(project);
  assert.match(line, /Manager-curated briefs: 1\/1 verified first try/);
  assert.match(line, /too few runs to compare/);
});

// --- step 7: track record + report ---------------------------------------------

test("track record and confidence come from observed runs, never from optimism", async () => {
  const project = tempGitProject({ testCommand: "true" });
  assert.equal(confidenceFor(project, "refactor").band, "low");

  for (let index = 0; index < 3; index += 1) {
    await dispatchRun(project, { intent: `clean run ${index}`, type: "refactor" }, stubAdapter({ editFile: { path: `src/f${index}.ts`, content: "export const a = 1;\n" } }));
  }
  const record = computeTrackRecord(project);
  assert.equal(record.refactor?.dispatched, 3);
  assert.equal(record.refactor?.verified_first, 3);

  const confident = confidenceFor(project, "refactor");
  assert.equal(confident.band, "high");
  assert.match(confident.basis, /3\/3 refactor runs verified first try/);
});

test("the report is outcome-first and only reports what changed", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const ready = await dispatchRun(project, { intent: "ready work", type: "chore" }, stubAdapter());
  await dispatchRun(project, { intent: "blocked work", type: "chore" }, stubAdapter({ behavior: "blocked" }));

  const report = buildReport(project, { all: true });
  assert.equal(report.ready.length, 1);
  assert.equal(report.blocked.length, 1);
  const rendered = renderReport(project, report);
  assert.match(rendered, /✓ .*ready/);
  assert.match(rendered, /⏸ .*blocked: stub question/);
  assert.match(rendered, /Trust: /);

  // Room state is the manager's clock-in: what exists, what needs a human.
  const state = roomState(project) as { needs_you: Array<{ id: string }>; runs: unknown[] };
  assert.equal(state.runs.length, 2);
  assert.equal(state.needs_you.length, 2);
  assert.equal(state.needs_you.some((entry) => entry.id === ready.task.id), true);
});

// --- step 6: the room ----------------------------------------------------------

test("the room launch is wired for the installed agent and degrades honestly", () => {
  const claude = buildRoomLaunch({ agent: "claude", mcpConfigPath: "/tmp/mcp.json", projectDir: "/repo" });
  assert.equal(claude.ok, true);
  assert.equal(claude.command, "claude");
  assert.equal(claude.args.includes("--mcp-config"), true);
  assert.equal(claude.args.includes("--append-system-prompt"), true);
  // The constitution's load-bearing laws must reach the manager.
  const constitution = claude.args[claude.args.indexOf("--append-system-prompt") + 1];
  assert.match(constitution, /FIRST tool call in any session is kage_room_state/);
  assert.match(constitution, /NEVER restate a number from a card/);
  assert.match(constitution, /never call anything verified unless the kernel verified it/i);
  assert.equal(claude.env.KAGE_ROOM, "1");

  const codex = buildRoomLaunch({ agent: "codex", mcpConfigPath: "/tmp/mcp.json", projectDir: "/repo" });
  assert.equal(codex.ok, true);
  assert.equal(codex.command, "codex");

  const none = buildRoomLaunch({ agent: null, mcpConfigPath: "/tmp/mcp.json", projectDir: "/repo" });
  assert.equal(none.ok, false);
  assert.match(none.reason ?? "", /No coding agent found/);
});

// --- steering ------------------------------------------------------------------

test("steering joins the brief at the next boundary", async () => {
  const project = tempGitProject({ testCommand: "true" });
  const { task } = await dispatchRun(project, { intent: "steer me", type: "chore" }, stubAdapter());
  const { appendSteer, readSteers } = await import("./delegation/dispatch.js");
  appendSteer(project, task.id, "skip the analytics tables entirely");
  assert.deepEqual(readSteers(project, task.id), ["skip the analytics tables entirely"]);
  const plan = compileBrief(project, task.intent, task.type);
  assert.match(renderBrief(task, plan, readSteers(project, task.id)), /## Steering from the user[\s\S]*analytics tables/);
});

test("git staging measures untracked agent work", () => {
  const project = tempGitProject();
  writeFileSync(join(project, "new-file.ts"), "export const x = 1;\n", "utf8");
  const stats = stageAndMeasure(project);
  assert.equal(stats.files, 1);
  assert.equal(stats.lines, 1);
  assert.deepEqual(stats.paths, ["new-file.ts"]);
});

test("delegation gitignore entries are appended exactly once", async () => {
  const project = tempProject();
  await dispatchRun(project, { intent: "first", type: "chore" }, stubAdapter());
  await dispatchRun(project, { intent: "second", type: "chore" }, stubAdapter());
  const ignore = readFileSync(join(project, ".gitignore"), "utf8");
  assert.equal(ignore.split(".agent_memory/runs/").length - 1, 1);
  assert.equal(ignore.split(".agent_memory/worktrees/").length - 1, 1);
});

test("every claim is assembled by buildClaim — hand-rolled claims drift", () => {
  // The supervisor (detached runs, the path real users hit) and dispatch (foreground)
  // each assembled ClaimRecord by hand, and they drifted: diff paths landed in one and
  // not the other, so blast radius silently never worked for real runs while every
  // test of the foreground path passed. The builder is the fix; this keeps it the
  // only assembly point.
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  for (const file of ["dispatch.ts", "supervisor.ts"]) {
    const source = readFileSync(join(__dirname, "..", "delegation", file), "utf8");
    assert.ok(!/schema_version:\s*RUN_SCHEMA_VERSION,\s*\n\s*run_id/.test(source),
      `${file} assembles a ClaimRecord by hand — use buildClaim so schema changes reach every path`);
    assert.ok(source.includes("buildClaim("), `${file} must build claims through buildClaim`);
  }
  // And the builder itself must keep the paths — the field the drift dropped.
  const claim = buildClaim({
    runId: "r1", statement: "s", checks: [], fence: null,
    diff: { files: 1, lines: 2, paths: ["a.ts"] },
  });
  assert.deepEqual(claim.diff.paths, ["a.ts"]);
});

test("usageFrom reads cost and tokens only from a genuine result event", () => {
  const { usageFrom } = require("./delegation/adapters/cli-agent.js") as typeof import("./delegation/adapters/cli-agent.js");
  // The real shape claude emits.
  const line = JSON.stringify({
    type: "result", total_cost_usd: 0.0421,
    usage: { input_tokens: 800, output_tokens: 640, cache_read_input_tokens: 9000, cache_creation_input_tokens: 2000 },
  });
  // Cache tokens count: they dominate the price, and a total that excludes them makes
  // the cost label read as a contradiction.
  assert.deepEqual(usageFrom(line), { usd: 0.0421, tokens: 12440 });
  // Non-result events with usage-looking fields must not count (assistant deltas carry usage too).
  assert.equal(usageFrom(JSON.stringify({ type: "assistant", usage: { input_tokens: 5 } })), null);
  // A result that reported nothing is null, not zeros — spend stays untouched.
  assert.equal(usageFrom(JSON.stringify({ type: "result" })), null);
  assert.equal(usageFrom("not json"), null);
});

test("recordSpend writes agent-reported cost to the run, and never invents it", () => {
  const project = tempProject();
  const run = createRun(project, { intent: "spend check", type: "chore", agent: "stub" });
  transitionRun(project, run.id, "briefed", "kernel");
  transitionRun(project, run.id, "dispatched", "kernel");
  transitionRun(project, run.id, "running", "kernel");

  recordSpend(project, run.id, { usd: 0.0421, tokens: 12440 });
  const after = readRun(project, run.id);
  assert.equal(after.spend.usd_est, 0.0421);
  assert.equal(after.tokens_used, 12440);
  assert.ok(after.spend.minutes >= 0);

  // No usage reported → the write must not happen at all.
  const run2 = createRun(project, { intent: "no usage", type: "chore", agent: "stub" });
  recordSpend(project, run2.id, undefined);
  assert.equal(readRun(project, run2.id).spend.usd_est, 0, "the untouched default, not a recorded zero");
  assert.equal(readRun(project, run2.id).tokens_used, undefined);
});

test("every manager spawn site grants the kage tools — headless has no permission dialog", () => {
  // The held room session ran for the entire session unable to call a single kage
  // tool: manager-client.ts (the fallback) passed --allowedTools and
  // room-supervisor.ts (the live path) did not, so the manager looped asking the user
  // to approve in a dialog that does not exist in -p mode. Third drift of this shape
  // (claim writers, stream readers, now spawn args) — so, third gate.
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  for (const file of ["manager-client.ts", "room-supervisor.ts"]) {
    const source = readFileSync(join(__dirname, "..", "delegation", file), "utf8");
    assert.ok(source.includes("--allowedTools"), `${file} spawns a headless manager without granting its tools`);
    assert.ok(source.includes("MANAGER_ALLOWED_TOOLS"), `${file} must use the shared allow-list, not a copy`);
  }
});

test("sweepDeadRuns persists death for stuck runs, including verifying, after grace", () => {
  const project = tempProject();
  // A running run whose pid can never be alive, and a verifying one — the state the
  // stale detection used to miss entirely (rows showed "verifying · no activity yet"
  // for sixteen hours).
  for (const target of ["running", "verifying"] as const) {
    const run = createRun(project, { intent: `stuck ${target}`, type: "chore", agent: "stub" });
    transitionRun(project, run.id, "briefed", "kernel");
    transitionRun(project, run.id, "dispatched", "kernel");
    transitionRun(project, run.id, "running", "kernel");
    if (target === "verifying") transitionRun(project, run.id, "verifying", "kernel");
    patchRun(project, run.id, { agent_pid: 999999999 });
  }
  // Inside the grace window nothing is reaped — a supervisor may still be starting.
  assert.equal(sweepDeadRuns(project).length, 0, "grace must protect fresh transitions");
  // Past grace, both are persisted as failed with a ledger entry.
  const reaped = sweepDeadRuns(project, 0);
  assert.equal(reaped.length, 2);
  for (const run of listRuns(project)) {
    assert.equal(run.display_state, "failed", run.intent + " must be persisted, not derived forever");
  }
  // Idempotent: a second sweep finds nothing.
  assert.equal(sweepDeadRuns(project, 0).length, 0);
});

test("goal record: lifecycle and legality", () => {
  const project = tempProject();
  const goal = createGoal(project, {
    intent: "ship the orchestration substrate",
    plan: [[{ intent: "build goal.ts", type: "feature", files_scope: ["mcp/delegation/goal.ts"] }]],
  });
  assert.equal(goal.state, "planning");
  assert.equal(goal.autonomy, "recommend", "default autonomy is recommend, never merge");
  assert.equal(goal.plan.waves.length, 1);
  assert.deepEqual(goal.plan.waves[0].run_ids, []);
  assert.equal(readGoal(project, goal.id).id, goal.id);
  assert.equal(listGoals(project).length, 1);

  // planning -> done is illegal; must go through executing.
  assert.throws(() => transitionGoal(project, goal.id, "done"), /Illegal transition/);
  const executing = transitionGoal(project, goal.id, "executing");
  assert.equal(executing.state, "executing");
  assert.equal(executing.state_history.length, 2);
  const done = transitionGoal(project, goal.id, "done");
  assert.equal(done.state, "done");
  // done is terminal.
  assert.throws(() => transitionGoal(project, goal.id, "executing"), /Illegal transition/);

  const other = createGoal(project, { intent: "a second goal" });
  const abandoned = abandonGoal(project, other.id, "superseded");
  assert.equal(abandoned.state, "abandoned");
  assert.equal(abandoned.state_history.at(-1)?.note, "superseded");
  assert.throws(() => abandonGoal(project, other.id), /Illegal transition/, "abandoned is terminal too");

  assert.throws(() => createGoal(project, { intent: "  " }), /non-empty/);
  assert.throws(() => readGoal(project, "does-not-exist"), /No goal found/);
});

test("attachRunToGoal + goalForRun round-trip, and a goal-less run finds nothing", () => {
  const project = tempProject();
  const goal = createGoal(project, {
    intent: "parity wave",
    plan: [[{ intent: "part one", type: "feature", files_scope: [] }]],
  });
  const run = createRun(project, { intent: "part one", type: "feature", agent: "stub" });
  assert.equal(goalForRun(project, run.id), null, "not attached yet");

  const attached = attachRunToGoal(project, goal.id, run.id);
  assert.deepEqual(attached.plan.waves[0].run_ids, [run.id]);
  const found = goalForRun(project, run.id);
  assert.equal(found?.id, goal.id);

  // Attaching the same run twice must not duplicate it.
  attachRunToGoal(project, goal.id, run.id);
  assert.deepEqual(readGoal(project, goal.id).plan.waves[0].run_ids, [run.id]);

  // A run never attached to any goal has no owner.
  const orphan = createRun(project, { intent: "human only", type: "chore", agent: "stub" });
  assert.equal(goalForRun(project, orphan.id), null);

  // patchGoal is a plain merge — no state-machine involvement.
  const patched = patchGoal(project, goal.id, { autonomy: "merge" });
  assert.equal(patched.autonomy, "merge");
});

test("kage_dispatch with goal_id attaches the run to the goal; an unknown goal_id warns without failing the dispatch", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "orchestrated wave" });

  const attached = await callTool("kage_dispatch", {
    project_dir: project,
    intent: "wave one part one",
    type: "chore",
    agent: "stub",
    goal_id: goal.id,
  });
  const attachedText = attached.content[0].text as string;
  assert.doesNotMatch(attachedText, /Could not attach/);
  const runOne = listRuns(project).find((run) => run.intent === "wave one part one");
  assert.ok(runOne, "the run should exist regardless of goal attachment");
  assert.deepEqual(readGoal(project, goal.id).plan.waves[0].run_ids, [runOne!.id]);
  assert.equal(goalForRun(project, runOne!.id)?.id, goal.id);

  const unknown = await callTool("kage_dispatch", {
    project_dir: project,
    intent: "wave one part two",
    type: "chore",
    agent: "stub",
    goal_id: "does-not-exist",
  });
  const unknownText = unknown.content[0].text as string;
  assert.match(unknownText, /Could not attach this run to goal does-not-exist/);
  const runTwo = listRuns(project).find((run) => run.intent === "wave one part two");
  assert.ok(runTwo, "the dispatch itself still succeeded despite the unknown goal_id");
  assert.equal(goalForRun(project, runTwo!.id), null, "never attached to any goal");
});

test("notifyManagerOfRunEvent: exactly one rate-limited frame for a goal-owned run, none for a goal-less run", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "wave one" });
  const ownedRun = createRun(project, { intent: "owned", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal.id, ownedRun.id);
  const orphanRun = createRun(project, { intent: "orphan", type: "chore", agent: "stub" });

  const sent: string[] = [];
  const deps = {
    isLiveFn: async () => true,
    sendFrameFn: async (_project: string, message: string) => {
      sent.push(message);
      return true;
    },
  };

  // A human-only run must NEVER wake the manager, even though the session is live.
  const orphanResult = await notifyManagerOfRunEvent(project, orphanRun.id, { state: "ready" }, undefined, deps);
  assert.equal(orphanResult, false);
  assert.equal(sent.length, 0);

  // A goal-owned run wakes it — exactly one frame, naming the run and the goal's intent.
  const first = await notifyManagerOfRunEvent(project, ownedRun.id, { state: "blocked", detail: "needs a decision" }, undefined, deps);
  assert.equal(first, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0], `[kage event] run ${ownedRun.id} (wave one) is now blocked: needs a decision`);

  // Same state again, immediately after — dropped as a duplicate.
  const duplicate = await notifyManagerOfRunEvent(project, ownedRun.id, { state: "blocked" }, undefined, deps);
  assert.equal(duplicate, false);
  assert.equal(sent.length, 1, "a duplicate state must never be re-sent");

  // A DIFFERENT state, but still inside the 30s rate-limit window — also dropped.
  const tooSoon = await notifyManagerOfRunEvent(project, ownedRun.id, { state: "ready" }, undefined, deps);
  assert.equal(tooSoon, false);
  assert.equal(sent.length, 1, "the 30s-per-run limit governs regardless of which state changed");
});

test("notifyManagerOfRunEvent: nothing is sent when the held session isn't live, or when the goal is done/abandoned", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "finished goal" });
  const run = createRun(project, { intent: "attached", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal.id, run.id);
  transitionGoal(project, goal.id, "executing");
  transitionGoal(project, goal.id, "done");

  const sent: string[] = [];
  const liveDeps = {
    isLiveFn: async () => true,
    sendFrameFn: async (_project: string, message: string) => {
      sent.push(message);
      return true;
    },
  };
  assert.equal(await notifyManagerOfRunEvent(project, run.id, { state: "ready" }, undefined, liveDeps), false);
  assert.equal(sent.length, 0, "a done goal is no longer active — no frame");

  const deadSessionDeps = { isLiveFn: async () => false, sendFrameFn: liveDeps.sendFrameFn };
  const goal2 = createGoal(project, { intent: "not started yet" });
  const run2 = createRun(project, { intent: "attached2", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal2.id, run2.id);
  assert.equal(await notifyManagerOfRunEvent(project, run2.id, { state: "ready" }, undefined, deadSessionDeps), false);
  assert.equal(sent.length, 0, "no live session means never touch stdin");
});

test("setActiveGoal + readActiveGoal round-trip, per thread, defaulting to no active goal", () => {
  const project = tempProject();
  assert.equal(readActiveGoal(project, DEFAULT_SESSION), null, "nothing set yet");

  setActiveGoal(project, DEFAULT_SESSION, "goal-one");
  assert.equal(readActiveGoal(project, DEFAULT_SESSION), "goal-one");

  // A different thread is a different pointer entirely.
  assert.equal(readActiveGoal(project, "thread-2"), null);
  setActiveGoal(project, "thread-2", "goal-two");
  assert.equal(readActiveGoal(project, "thread-2"), "goal-two");
  assert.equal(readActiveGoal(project, DEFAULT_SESSION), "goal-one", "unrelated thread untouched");

  // Clearing is just setting null.
  setActiveGoal(project, DEFAULT_SESSION, null);
  assert.equal(readActiveGoal(project, DEFAULT_SESSION), null);
});

// Drives the real kage_dispatch tool handler (not dispatchRun directly) with the room's
// own env vars, since that handler is where implicit attachment actually happens.
async function dispatchInRoom(project: string, intent: string, sessionKey?: string, goalId?: string) {
  const prevRoom = process.env.KAGE_ROOM;
  const prevSession = process.env.KAGE_ROOM_SESSION;
  process.env.KAGE_ROOM = "1";
  if (sessionKey) process.env.KAGE_ROOM_SESSION = sessionKey;
  else delete process.env.KAGE_ROOM_SESSION;
  try {
    return await callTool("kage_dispatch", {
      project_dir: project,
      intent,
      type: "chore",
      agent: "stub",
      ...(goalId ? { goal_id: goalId } : {}),
    });
  } finally {
    if (prevRoom === undefined) delete process.env.KAGE_ROOM;
    else process.env.KAGE_ROOM = prevRoom;
    if (prevSession === undefined) delete process.env.KAGE_ROOM_SESSION;
    else process.env.KAGE_ROOM_SESSION = prevSession;
  }
}

test("kage_dispatch with no goal_id attaches implicitly to the room thread's active goal", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "implicit wave" });
  setActiveGoal(project, DEFAULT_SESSION, goal.id);

  const out = await dispatchInRoom(project, "implicit part one");
  const outText = out.content[0].text as string;
  assert.doesNotMatch(outText, /Could not attach/);
  const run = listRuns(project).find((r) => r.intent === "implicit part one");
  assert.ok(run, "the run should exist");
  assert.equal(goalForRun(project, run!.id)?.id, goal.id, "attached with no goal_id passed");
});

test("kage_dispatch: an explicit goal_id overrides the room thread's active goal", async () => {
  const project = tempProject();
  const activeGoal = createGoal(project, { intent: "active wave" });
  const otherGoal = createGoal(project, { intent: "a different wave" });
  setActiveGoal(project, DEFAULT_SESSION, activeGoal.id);

  const out = await dispatchInRoom(project, "override part one", undefined, otherGoal.id);
  const outText = out.content[0].text as string;
  assert.doesNotMatch(outText, /Could not attach/);
  const run = listRuns(project).find((r) => r.intent === "override part one");
  assert.equal(goalForRun(project, run!.id)?.id, otherGoal.id, "explicit goal_id wins over the active one");
});

test("kage_dispatch: no active goal and no goal_id leaves the run unattached", async () => {
  const project = tempProject();
  const out = await dispatchInRoom(project, "ad hoc, no goal");
  const outText = out.content[0].text as string;
  assert.doesNotMatch(outText, /Could not attach/);
  const run = listRuns(project).find((r) => r.intent === "ad hoc, no goal");
  assert.equal(goalForRun(project, run!.id), null);
});

test("abandoning a goal clears it as any thread's active goal", () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "will be abandoned" });
  setActiveGoal(project, DEFAULT_SESSION, goal.id);
  setActiveGoal(project, "thread-2", goal.id);
  assert.equal(readActiveGoal(project, DEFAULT_SESSION), goal.id);

  abandonGoal(project, goal.id, "changed course");

  assert.equal(readActiveGoal(project, DEFAULT_SESSION), null, "no longer anyone's active goal");
  assert.equal(readActiveGoal(project, "thread-2"), null);
});
// --- BUG 1: transient git failures must never silently empty-sandbox a real repo ----
// A concurrent `git worktree add`/`commit` in a parallel wave can hold .git's index or
// a ref lock for a moment. isGitRepo/hasCommits used to treat that exactly like "not a
// repo", so a healthy project could get classified as commit-less and its agent handed
// an empty directory. See git.ts's retryTransient and worktree.ts's resolveWorkspaceKind.

test("retryTransient retries only lock-contention failures, and gives up after the cap", () => {
  let calls = 0;
  const flaky: GitResult[] = [
    { ok: false, stdout: "", stderr: "fatal: Unable to create '.git/index.lock': File exists." },
    { ok: false, stdout: "", stderr: "fatal: cannot lock ref 'refs/heads/x': Unable to create" },
    { ok: true, stdout: "deadbeef", stderr: "" },
  ];
  const result = retryTransient(() => flaky[calls++]);
  assert.equal(result.ok, true, "the third attempt succeeds and its result is returned");
  assert.equal(calls, 3, "it retried through both transient failures");

  // A genuine "no" (not lock contention) must never be retried — it is a real answer.
  calls = 0;
  const genuineNo = () => {
    calls++;
    return { ok: false, stdout: "", stderr: "fatal: not a git repository (or any of the parent directories): .git" };
  };
  const noResult = retryTransient(genuineNo);
  assert.equal(noResult.ok, false);
  assert.equal(calls, 1, "a real 'no' is returned on the first try, never retried");

  // Retrying stops at the attempt cap even if every attempt looks transient.
  calls = 0;
  const alwaysLocked = () => {
    calls++;
    return { ok: false, stdout: "", stderr: "index.lock" };
  };
  const gaveUp = retryTransient(alwaysLocked, 3, 1);
  assert.equal(gaveUp.ok, false);
  assert.equal(calls, 3, "capped at the configured attempt count");
});

test("resolveWorkspaceKind: worktree for a real repo, sandbox for no-repo or no-commits, throw for a broken .git", () => {
  // A real repo with commits — the normal case.
  const withCommits = tempGitProject();
  assert.equal(resolveWorkspaceKind(withCommits), "worktree");

  // No `.git` at all — a genuinely non-git project degrades to a sandbox, not a throw.
  const noGit = tempProject();
  assert.equal(resolveWorkspaceKind(noGit), "sandbox");

  // A real repo with zero commits — also a legitimate sandbox, not a throw.
  const noCommits = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: noCommits, stdio: "ignore" });
  assert.equal(resolveWorkspaceKind(noCommits), "sandbox");

  // A `.git` entry is present on disk, but it is broken (a gitdir pointer file aimed at
  // nowhere) — git commands fail even after retries, but this is NOT "no repo here".
  // Degrading to a sandbox here is exactly the silent-empty-sandbox bug; it must throw.
  const brokenGit = tempProject();
  writeFileSync(join(brokenGit, ".git"), "gitdir: /nonexistent/kage-test-path/.git\n", "utf8");
  assert.ok(looksLikeGitRepo(brokenGit), "the .git entry itself does exist on disk");
  assert.throws(() => resolveWorkspaceKind(brokenGit), /git/i);
});

test("createWorktree retries a locked `git worktree add` through an injected git seam and still succeeds", () => {
  const project = tempGitProject();
  let calls = 0;
  const flakyGit = (cwd: string, args: string[]): GitResult => {
    if (args[0] === "worktree" && args[1] === "add") {
      calls++;
      if (calls < 3) {
        return { ok: false, stdout: "", stderr: "fatal: Unable to create '.git/worktrees/x/locked': File exists." };
      }
    }
    // Delegate everything else (and the eventual successful add) to the real git binary.
    return git(cwd, args);
  };

  const handle = createWorktree(project, "retry-lock-run", "kage/retry-lock-run", { runGit: flakyGit });
  assert.equal(calls, 3, "the first two locked attempts were retried, the third succeeded");
  assert.equal(existsSync(handle.path), true, "the worktree exists despite the earlier lock failures");
});

// --- Durable goal events: notifyManagerOfRunEvent + drainPendingGoalEvents -----------
// The wake bridge above (notifyManagerOfRunEvent) used to require busy===false to send
// at all — a busy manager was an accepted, silent drop. A dispatched wave changes state
// immediately after the very turn that dispatched it, while the manager is still busy,
// so those were exactly the events that mattered most. Now every event is appended to
// the goal's durable pending log (goal.ts) BEFORE any delivery is attempted, and the
// room supervisor drains whatever is still pending the moment a turn completes and the
// session goes idle (room-supervisor.ts). These tests use only the exported functions
// and injected deps — no real `claude` process is ever spawned.

test("notifyManagerOfRunEvent: a busy manager leaves the event PENDING, never lost", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "wave one" });
  const run = createRun(project, { intent: "part one", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal.id, run.id);

  // The session IS live (isLiveFn true) but every "ask" is rejected because a turn is
  // already in flight — exactly what sendFrameToHeldSession sees when the socket
  // handler answers "a turn is already in flight" instead of a final reply.
  const deps = { isLiveFn: async () => true, sendFrameFn: async () => false };
  const result = await notifyManagerOfRunEvent(project, run.id, { state: "blocked", detail: "needs a decision" }, undefined, deps);
  assert.equal(result, false, "no immediate delivery while busy");

  const pending = readPendingGoalEvents(project, goal.id);
  assert.equal(pending.length, 1, "the event was appended durably despite the failed delivery attempt");
  assert.equal(pending[0].run_id, run.id);
  assert.equal(pending[0].state, "blocked");
  assert.equal(pending[0].detail, "needs a decision");
  assert.equal(pending[0].status, "pending");
});

test("notifyManagerOfRunEvent: a dead manager also leaves the event pending for the next live one", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "wave one" });
  const run = createRun(project, { intent: "part one", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal.id, run.id);

  const sent: string[] = [];
  const deadDeps = {
    isLiveFn: async () => false,
    sendFrameFn: async (_p: string, message: string) => {
      sent.push(message);
      return true;
    },
  };
  const result = await notifyManagerOfRunEvent(project, run.id, { state: "ready" }, undefined, deadDeps);
  assert.equal(result, false);
  assert.equal(sent.length, 0, "a dead manager is never dialed for delivery");
  assert.equal(readPendingGoalEvents(project, goal.id).length, 1, "still recorded, waiting for the manager to come back");

  // The manager comes back: a later drain (simulating idle after the next turn) picks
  // the same event up and delivers it — this is "the next live one", not a redispatch
  // of notifyManagerOfRunEvent itself.
  setActiveGoal(project, DEFAULT_SESSION, goal.id);
  const delivered: string[] = [];
  const liveDrainDeps = {
    isLiveFn: async () => true,
    sendFrameFn: async (_p: string, message: string) => {
      delivered.push(message);
      return true;
    },
  };
  const drained = await drainPendingGoalEvents(project, DEFAULT_SESSION, liveDrainDeps);
  assert.equal(drained, true);
  assert.equal(delivered.length, 1);
  assert.match(delivered[0], /run .* is now ready/);
  assert.equal(readPendingGoalEvents(project, goal.id).length, 0, "delivered, no longer pending");
});

test("a run with no goal produces no event and no frame", async () => {
  const project = tempProject();
  const run = createRun(project, { intent: "human only", type: "chore", agent: "stub" });

  const sent: string[] = [];
  const deps = { isLiveFn: async () => true, sendFrameFn: async (_p: string, message: string) => (sent.push(message), true) };
  const result = await notifyManagerOfRunEvent(project, run.id, { state: "ready" }, undefined, deps);
  assert.equal(result, false);
  assert.equal(sent.length, 0, "a human-only run never wakes the manager");
});

test("drainPendingGoalEvents: two state changes for the same run coalesce to the latest", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "wave one" });
  const run = createRun(project, { intent: "part one", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal.id, run.id);
  setActiveGoal(project, DEFAULT_SESSION, goal.id);

  // Two events for the SAME run, appended directly (bypassing notifyManagerOfRunEvent's
  // rate limit, which is a separate concern from coalescing itself).
  appendGoalEvent(project, goal.id, { run_id: run.id, state: "running" });
  appendGoalEvent(project, goal.id, { run_id: run.id, state: "blocked", detail: "needs a decision" });

  const sent: string[] = [];
  const deps = { isLiveFn: async () => true, sendFrameFn: async (_p: string, message: string) => (sent.push(message), true) };
  const drained = await drainPendingGoalEvents(project, DEFAULT_SESSION, deps);
  assert.equal(drained, true);
  assert.equal(sent.length, 1, "exactly one coalesced frame");
  assert.doesNotMatch(sent[0], /running/, "the superseded state must not appear");
  assert.match(sent[0], /run .* is now blocked: needs a decision/, "only the latest state per run survives");
  assert.match(sent[0], /1 superseded update/, "states how many were coalesced");
  assert.equal(readPendingGoalEvents(project, goal.id).length, 0, "both original events marked delivered, not just the latest");
});

test("drainPendingGoalEvents: multiple runs coalesce into exactly one frame; nothing to drain with no active goal or no pending events", async () => {
  const project = tempProject();
  const goal = createGoal(project, { intent: "parallel wave" });
  const runA = createRun(project, { intent: "part a", type: "chore", agent: "stub" });
  const runB = createRun(project, { intent: "part b", type: "chore", agent: "stub" });
  attachRunToGoal(project, goal.id, runA.id);
  attachRunToGoal(project, goal.id, runB.id);

  // No active goal for this thread yet — nothing to drain.
  const sentNone: string[] = [];
  const noneDeps = { isLiveFn: async () => true, sendFrameFn: async (_p: string, message: string) => (sentNone.push(message), true) };
  assert.equal(await drainPendingGoalEvents(project, DEFAULT_SESSION, noneDeps), false);
  assert.equal(sentNone.length, 0);

  setActiveGoal(project, DEFAULT_SESSION, goal.id);
  // An active goal with nothing pending yet is also a no-op.
  assert.equal(await drainPendingGoalEvents(project, DEFAULT_SESSION, noneDeps), false);

  const evtA = appendGoalEvent(project, goal.id, { run_id: runA.id, state: "verifying" });
  const evtB = appendGoalEvent(project, goal.id, { run_id: runB.id, state: "blocked", detail: "waiting on merge" });

  const sent: string[] = [];
  const deps = { isLiveFn: async () => true, sendFrameFn: async (_p: string, message: string) => (sent.push(message), true) };
  const drained = await drainPendingGoalEvents(project, DEFAULT_SESSION, deps);
  assert.equal(drained, true);
  assert.equal(sent.length, 1, "both runs land in ONE coalesced frame, not one each");
  assert.match(sent[0], new RegExp(`run ${runA.id} is now verifying`));
  assert.match(sent[0], new RegExp(`run ${runB.id} is now blocked: waiting on merge`));

  // Marked delivered as a pair, exercising markGoalEventsDelivered directly too.
  const stillPending = readPendingGoalEvents(project, goal.id);
  assert.equal(stillPending.length, 0);
  markGoalEventsDelivered(project, goal.id, [evtA.id, evtB.id]);
  assert.equal(readPendingGoalEvents(project, goal.id).length, 0, "re-marking already-delivered ids is a harmless no-op");

  // A goal that has since finished must not be woken, even with events still pending
  // from before it finished.
  appendGoalEvent(project, goal.id, { run_id: runA.id, state: "merged" });
  transitionGoal(project, goal.id, "executing");
  transitionGoal(project, goal.id, "done");
  const sentAfterDone: string[] = [];
  const afterDoneDeps = { isLiveFn: async () => true, sendFrameFn: async (_p: string, message: string) => (sentAfterDone.push(message), true) };
  assert.equal(await drainPendingGoalEvents(project, DEFAULT_SESSION, afterDoneDeps), false, "a finished goal is never woken");
  assert.equal(sentAfterDone.length, 0);
});

// --- citedPaths false-positive fixes (mcp/delegation/verify.ts) -----------------

test("citedPaths ignores identifier pairs and .agent_memory runtime artifacts, but still catches real paths", () => {
  // An identifier pair like "state.room/state.pty" is not a file citation — it has no
  // recognizable extension and no known repo top-level prefix.
  assert.deepEqual(citedPaths("watch state.room/state.pty for drift"), []);

  // .agent_memory/ holds Kage's own runtime artifacts, never something an agent cites as
  // a source it touched — excluded even though "room-mcp.json" looks like a real file.
  assert.deepEqual(citedPaths("wrote to .agent_memory/runs/room-mcp.json"), []);

  // A real repo path under a known top-level prefix is still recognized even without
  // relying on the extension alone.
  assert.deepEqual(citedPaths("see mcp/delegation/verify.ts for the fix"), ["mcp/delegation/verify.ts"]);

  // Mixed prose: the false positives are dropped, the genuine citation survives.
  assert.deepEqual(
    citedPaths("state.room/state.pty stayed in sync; fixed in mcp/delegation/room-supervisor.ts").sort(),
    ["mcp/delegation/room-supervisor.ts"],
  );
});

test("citedPaths still fails a claim naming a real repo path that does not exist in the worktree", () => {
  const paths = citedPaths("added mcp/delegation/does-not-exist.ts");
  assert.deepEqual(paths, ["mcp/delegation/does-not-exist.ts"]);
  assert.equal(existsSync(join(__dirname, "..", "delegation", "does-not-exist.ts")), false);
});
