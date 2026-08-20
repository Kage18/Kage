// Tests for "every dead end in the app gets a next step" — six findings from the
// owner reviewing the live app: an unviewable goal card, a stopped run with no way
// back, a zombie record whose branch already landed, an orphan-shaped failed run with
// no cure, blank empty states, and terminal/stuck states with no what-now line.
//
// Its own file per this repo's rule — new behaviour gets a new test file, and
// mcp/delegation.test.ts is a known append-collision hotspot.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import type { AddressInfo } from "node:net";

import { createDelegationFeed, createPtyState, createRoomState, handleDelegationRoute, type DelegationFeed } from "./delegation/api.js";
import { guardRequest } from "./delegation/guard.js";
import {
  createRun,
  isBranchLanded,
  patchRun,
  readRun,
  transitionRun,
  writeClaim,
  RUN_SCHEMA_VERSION,
  type ClaimRecord,
} from "./delegation/contract.js";
import { isWorktreeAdoptable } from "./delegation/recovery.js";
import { createWorktree } from "./delegation/worktree.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { delegationAppHtml } from "./delegation/app-html.js";
import { APP_CLIENT } from "./delegation/app-client.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-dead-ends-"));
}

function tempGitProject(): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

function commitAll(cwd: string, message: string): void {
  execFileSync("git", ["add", "-A"], { cwd, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", message], { cwd, stdio: "ignore", env: GIT_ENV });
}

// The exact orphan-shaped failure note reapRun's default and killOrphanedAgent's
// funnel both leave behind (contract.ts).
function orphanedFailedRun(project: string): { runId: string; branch: string; worktree: string } {
  const task = createRun(project, { intent: "orphaned work to adopt", type: "bugfix", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  const worktree = createWorktree(project, task.id, task.branch);
  patchRun(project, task.id, { worktree: worktree.path });
  transitionRun(project, task.id, "failed", "kernel", "agent process gone");
  writeDelegationConfig(project, { test: "true" });
  return { runId: task.id, branch: task.branch, worktree: worktree.path };
}

// --- 1. isBranchLanded (contract.ts) -------------------------------------------------

// FAILS ON REVERT: isBranchLanded does not exist without this change; the zombie-record
// field (branch_landed) it backs would have nothing to compute from.
test("isBranchLanded is true once a run's own branch merges into the project's HEAD, false while it has not", () => {
  const project = tempGitProject();

  execFileSync("git", ["checkout", "-b", "kage/landed-fixture"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  writeFileSync(join(project, "landed.txt"), "landed by hand\n", "utf8");
  commitAll(project, "landed work");
  // isBranchLanded compares against the PROJECT's current HEAD, not whatever this
  // fixture happens to be checked out on — check it from main, same as the app always
  // does (a run's own worktree is a separate checkout of its branch, the project root
  // stays on its integration branch throughout).
  execFileSync("git", ["checkout", "main"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  assert.equal(isBranchLanded(project, "kage/landed-fixture"), false, "not yet merged into main");

  execFileSync("git", ["merge", "--no-ff", "-m", "merge landed work", "kage/landed-fixture"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  assert.equal(isBranchLanded(project, "kage/landed-fixture"), true, "now an ancestor of HEAD");

  execFileSync("git", ["checkout", "-b", "kage/never-landed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  writeFileSync(join(project, "unlanded.txt"), "still stranded\n", "utf8");
  commitAll(project, "unlanded work");
  execFileSync("git", ["checkout", "main"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  assert.equal(isBranchLanded(project, "kage/never-landed"), false, "committed, but never merged");
});

// --- 2. isWorktreeAdoptable (recovery.ts) --------------------------------------------

// FAILS ON REVERT: isWorktreeAdoptable does not exist without this change; the Adopt
// button's display field (worktree_adoptable) would have nothing to compute from.
test("isWorktreeAdoptable is true only for an orphan-shaped failed run with real, uncommitted changes", () => {
  const project = tempGitProject();
  const orphan = orphanedFailedRun(project);
  assert.equal(isWorktreeAdoptable(project, readRun(project, orphan.runId)), false, "no changes yet — nothing to adopt");
  writeFileSync(join(orphan.worktree, "PARTIAL_WORK.md"), "orphaned work\n", "utf8");
  assert.equal(isWorktreeAdoptable(project, readRun(project, orphan.runId)), true);
});

test("isWorktreeAdoptable is false when the run is not failed, its agent is still alive, it already has a claim, or its note is not orphan-shaped", () => {
  const notFailedProject = tempGitProject();
  const notFailed = orphanedFailedRun(notFailedProject);
  writeFileSync(join(notFailed.worktree, "PARTIAL_WORK.md"), "work\n", "utf8");
  transitionRun(notFailedProject, notFailed.runId, "verifying", "kernel");
  transitionRun(notFailedProject, notFailed.runId, "ready", "kernel");
  assert.equal(isWorktreeAdoptable(notFailedProject, readRun(notFailedProject, notFailed.runId)), false, "already ready, not failed");

  const aliveProject = tempGitProject();
  const alive = orphanedFailedRun(aliveProject);
  writeFileSync(join(alive.worktree, "PARTIAL_WORK.md"), "work\n", "utf8");
  patchRun(aliveProject, alive.runId, { agent_pid: process.pid });
  assert.equal(isWorktreeAdoptable(aliveProject, readRun(aliveProject, alive.runId)), false, "adopting a live agent's worktree would race its writes");

  const claimedProject = tempGitProject();
  const claimed = orphanedFailedRun(claimedProject);
  writeFileSync(join(claimed.worktree, "PARTIAL_WORK.md"), "work\n", "utf8");
  writeClaim(claimedProject, claimed.runId, {
    schema_version: RUN_SCHEMA_VERSION,
    run_id: claimed.runId,
    statement: "already reported",
    checks: [],
    unsure: [],
    learnings: [],
    protocol_ok: true,
    diff: { files: 0, lines: 0 },
    created_at: new Date(0).toISOString(),
  } as ClaimRecord);
  assert.equal(isWorktreeAdoptable(claimedProject, readRun(claimedProject, claimed.runId)), false, "a run with a claim goes through kage reverify, not adopt");

  const notOrphanProject = tempGitProject();
  const task = createRun(notOrphanProject, { intent: "a real failure, not an orphan", type: "bugfix", agent: "stub" });
  transitionRun(notOrphanProject, task.id, "briefed", "kernel");
  transitionRun(notOrphanProject, task.id, "dispatched", "kernel");
  transitionRun(notOrphanProject, task.id, "running", "kernel");
  const worktree = createWorktree(notOrphanProject, task.id, task.branch);
  patchRun(notOrphanProject, task.id, { worktree: worktree.path });
  writeFileSync(join(worktree.path, "PARTIAL_WORK.md"), "work\n", "utf8");
  // A genuinely failing check, not the kernel's own orphan note — worktree_adoptable
  // must never light up for this shape; it is not what Adopt is for.
  transitionRun(notOrphanProject, task.id, "failed", "kernel", "tests failed: 2/5");
  assert.equal(isWorktreeAdoptable(notOrphanProject, readRun(notOrphanProject, task.id)), false, "not the agent-process-gone shape");
});

// --- API harness (mirrors sessions-api-gaps.test.ts / delegation-api.test.ts) --------

const TOKEN = "test-token-0123456789abcdef0123456789abcdef";

async function startApi(projectDir: string): Promise<{ server: Server; port: number; feed: DelegationFeed }> {
  const feed = createDelegationFeed(projectDir, { heartbeatMs: 60_000 });
  const room = createRoomState();
  const pty = createPtyState();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const verdict = guardRequest(
      { method: req.method ?? "GET", headers: req.headers as Record<string, string | string[] | undefined>, pathname: url.pathname },
      { allowedOrigins: ["http://127.0.0.1"], token: TOKEN },
    );
    if (!verdict.ok) {
      res.writeHead(verdict.status, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: verdict.reason }));
      return;
    }
    if (await handleDelegationRoute({ projectDir, feed, room, pty }, req, res, url)) return;
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const port = (server.address() as AddressInfo).port;
  return { server, port, feed };
}

function apiFetch(port: number, path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { host: `127.0.0.1:${port}`, "content-type": "application/json" };
  if (options.method && options.method !== "GET") headers.authorization = `Bearer ${TOKEN}`;
  return fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers });
}

// --- 3. branch_landed served on the run API ------------------------------------------

// FAILS ON REVERT: withActivity() attaches no branch_landed key without this change —
// the stopped run's own object in GET /runs carries nothing to render "already landed"
// from, for either fixture below.
test("GET /runs carries branch_landed:true for a stopped run whose own branch already merged into HEAD, and no key at all otherwise", async () => {
  const project = tempGitProject();
  const { server, port, feed } = await startApi(project);
  try {
    const landed = createRun(project, { intent: "landed by hand under the bootstrap exception", type: "bugfix", agent: "stub" });
    transitionRun(project, landed.id, "briefed", "kernel");
    transitionRun(project, landed.id, "dispatched", "kernel");
    transitionRun(project, landed.id, "running", "kernel");
    const worktree = createWorktree(project, landed.id, landed.branch);
    writeFileSync(join(worktree.path, "landed.txt"), "1\n", "utf8");
    commitAll(worktree.path, "landed work");
    execFileSync("git", ["merge", "--no-ff", "-m", "merge", landed.branch], { cwd: project, stdio: "ignore", env: GIT_ENV });
    transitionRun(project, landed.id, "stopped", "kernel", "elapsed 59.8 min exceeded the 30 min budget — raise it by setting `budgets.minutes`");

    const stranded = createRun(project, { intent: "genuinely stranded, never landed", type: "bugfix", agent: "stub" });
    transitionRun(project, stranded.id, "briefed", "kernel");
    transitionRun(project, stranded.id, "dispatched", "kernel");
    transitionRun(project, stranded.id, "running", "kernel");
    transitionRun(project, stranded.id, "stopped", "kernel", "estimated spend $5.22 exceeded the $2.00 budget");

    const listed = (await (await apiFetch(port, "/runs")).json()) as { runs: Array<Record<string, unknown>> };
    const landedRun = listed.runs.find((r) => r.id === landed.id);
    const strandedRun = listed.runs.find((r) => r.id === stranded.id);
    assert.ok(landedRun && strandedRun, "both fixture runs must be listed");
    assert.equal(landedRun!.branch_landed, true, "fixture proof: the merged-branch zombie run must show branch_landed");
    assert.equal("branch_landed" in strandedRun!, false, "absence means absent — never merged, never landed");

    const detail = (await (await apiFetch(port, `/runs/${landed.id}`)).json()) as { run: Record<string, unknown> };
    assert.equal(detail.run.branch_landed, true, "the single-run detail route must agree with the list");
  } finally {
    feed.close();
    server.close();
  }
});

// FAILS ON REVERT: without the reject route accepting the honest "closed: work already
// landed on <branch>" note, this call either 400s (rejectRun still refuses a reason) or
// leaves the run stopped — never rejected with that exact note.
test("closing a landed zombie run as landed uses the existing reject transition with the honest note", async () => {
  const project = tempGitProject();
  const { server, port, feed } = await startApi(project);
  try {
    const landed = createRun(project, { intent: "close me as landed", type: "bugfix", agent: "stub" });
    transitionRun(project, landed.id, "briefed", "kernel");
    transitionRun(project, landed.id, "dispatched", "kernel");
    transitionRun(project, landed.id, "running", "kernel");
    const worktree = createWorktree(project, landed.id, landed.branch);
    writeFileSync(join(worktree.path, "landed.txt"), "1\n", "utf8");
    commitAll(worktree.path, "landed work");
    execFileSync("git", ["merge", "--no-ff", "-m", "merge", landed.branch], { cwd: project, stdio: "ignore", env: GIT_ENV });
    transitionRun(project, landed.id, "stopped", "kernel", "elapsed 59.8 min exceeded the 30 min budget");

    const res = await apiFetch(port, `/runs/${landed.id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: `closed: work already landed on ${landed.branch}` }),
    });
    const out = (await res.json()) as { ok: boolean; run: { state: string; state_history: Array<{ note?: string }> } };
    assert.equal(out.ok, true);
    assert.equal(out.run.state, "rejected", "the existing reject transition — no new state invented");
    assert.equal(out.run.state_history.at(-1)?.note, `closed: work already landed on ${landed.branch}`);
  } finally {
    feed.close();
    server.close();
  }
});

// --- 4. worktree_adoptable + the adopt route, on the real fixture shape --------------

// FAILS ON REVERT: withActivity() attaches no worktree_adoptable key without this
// change, so the Adopt button's affordance field is simply absent for this fixture.
test("GET /runs carries worktree_adoptable:true for an orphan-shaped failed run with real changes, absent for an ordinary failure", async () => {
  const project = tempGitProject();
  const { server, port, feed } = await startApi(project);
  try {
    const orphan = orphanedFailedRun(project);
    writeFileSync(join(orphan.worktree, "CHANGELOG.md"), "+112 real lines\n", "utf8");

    const ordinary = createRun(project, { intent: "an ordinary failure, not orphan-shaped", type: "bugfix", agent: "stub" });
    transitionRun(project, ordinary.id, "briefed", "kernel");
    transitionRun(project, ordinary.id, "dispatched", "kernel");
    transitionRun(project, ordinary.id, "running", "kernel");
    transitionRun(project, ordinary.id, "failed", "kernel", "tests failed: 2/5");

    const listed = (await (await apiFetch(port, "/runs")).json()) as { runs: Array<Record<string, unknown>> };
    const orphanRun = listed.runs.find((r) => r.id === orphan.runId);
    const ordinaryRun = listed.runs.find((r) => r.id === ordinary.id);
    assert.ok(orphanRun && ordinaryRun);
    assert.equal(orphanRun!.worktree_adoptable, true, "fixture proof: the orphan-shaped failed run must show worktree_adoptable");
    assert.equal("worktree_adoptable" in ordinaryRun!, false, "a plain failure is not what Adopt cures");
  } finally {
    feed.close();
    server.close();
  }
});

// FAILS ON REVERT: proves the affordance renders (worktree_adoptable) AND that the
// route it calls actually exists and lands the fixture at ready — without mutating
// the operator's own real orphan record, only this test's own tempGitProject fixture.
test("POST /runs/:id/adopt lands a fixture orphan-shaped failed run at ready", async () => {
  const project = tempGitProject();
  const { server, port, feed } = await startApi(project);
  try {
    const orphan = orphanedFailedRun(project);
    writeFileSync(join(orphan.worktree, "CHANGELOG.md"), "+112 real lines\n", "utf8");

    const before = (await (await apiFetch(port, `/runs/${orphan.runId}`)).json()) as { run: Record<string, unknown> };
    assert.equal(before.run.worktree_adoptable, true);

    const res = await apiFetch(port, `/runs/${orphan.runId}/adopt`, { method: "POST" });
    const out = (await res.json()) as { ok: boolean; detail: string; run: { state: string } };
    assert.equal(out.ok, true, out.detail);
    assert.equal(out.run.state, "ready", "adopt's own checks passed against the fixture worktree");
    assert.equal(readRun(project, orphan.runId).state, "ready");
  } finally {
    feed.close();
    server.close();
  }
});

// --- client-side derivations (app-client.ts), evaluated in a DOM-less vm sandbox -----
//
// Same technique receipt.test.ts uses: the real APP_CLIENT string is evaluated in a
// fresh vm context against a minimal `document` stub, and the exported pure functions
// are called directly — no source-text pattern matching, the actual code path runs.

interface FakeElement {
  tagName: string;
  className: string;
  textContent: string;
  children: FakeElement[];
  onclick: (() => void) | null;
  onkeydown: ((ev: unknown) => void) | null;
  title: string;
  style: Record<string, string>;
  appendChild(child: FakeElement): FakeElement;
}

function makeFakeElement(tag: string): FakeElement {
  const el = {
    tagName: tag,
    className: "",
    textContent: "",
    children: [] as FakeElement[],
    onclick: null,
    onkeydown: null,
    title: "",
    style: {} as Record<string, string>,
  } as FakeElement;
  el.appendChild = (child: FakeElement) => {
    el.children.push(child);
    return child;
  };
  return el;
}

function findAll(root: FakeElement, cls: string): FakeElement[] {
  const out: FakeElement[] = [];
  const walk = (el: FakeElement): void => {
    for (const child of el.children ?? []) {
      if (typeof child.className === "string" && child.className.split(" ").includes(cls)) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

function collectText(el: FakeElement | { textContent?: string; children?: FakeElement[] }): string {
  let out = String((el as { textContent?: string }).textContent || "");
  for (const child of (el as { children?: FakeElement[] }).children ?? []) out += collectText(child);
  return out;
}

function loadSandbox(extraElements: Record<string, FakeElement> = {}): Record<string, unknown> {
  const sandbox: Record<string, unknown> = {
    document: {
      createElement: (tag: string) => makeFakeElement(tag),
      createTextNode: (text: string) => ({ nodeType: 3, textContent: text, children: [] }),
      getElementById: (id: string) => extraElements[id] ?? null,
      body: makeFakeElement("body"),
    },
    // Read at the very top of the script (before STATE_DOT_COLOR and every function
    // under test are declared as `var`) — without this stub, execution throws before
    // those vars are ever assigned, and functions that reference them see `undefined`.
    navigator: { userAgent: "" },
    window: {},
    console,
  };
  try {
    runInNewContext(APP_CLIENT, sandbox, { timeout: 2000 });
  } catch {
    // Expected: top-level DOM wiring past the function declarations throws in this
    // DOM-less context. Function declarations are hoisted before any statement runs,
    // so every function under test is still defined regardless.
  }
  return sandbox;
}

// --- 5. resume cap-prefill parsing ----------------------------------------------------

// FAILS ON REVERT: parseCapFromStopNote does not exist without this change.
test("parseCapFromStopNote recognizes both budget-cap note shapes and degrades to null on an unrecognized note", () => {
  const sandbox = loadSandbox();
  const parseCapFromStopNote = sandbox.parseCapFromStopNote as (note: string) => string | null;
  assert.equal(
    parseCapFromStopNote("estimated spend $25.47 exceeded the $2.00 budget — resume it with `kage resume-run <run-id> --budget-usd <n>`"),
    "usd",
  );
  assert.equal(
    parseCapFromStopNote("elapsed 59.8 min exceeded the 30 min budget — raise it by setting `budgets.minutes` in .agent_memory/config.json"),
    "minutes",
  );
  assert.equal(parseCapFromStopNote("stalled: repeating the same failing command"), null, "a stall note has no cap to raise");
  assert.equal(parseCapFromStopNote(""), null);
  assert.equal(parseCapFromStopNote(undefined as unknown as string), null);
});

test("suggestedUsdRaise matches resumeStoppedRun's own refusal-message formula", () => {
  const sandbox = loadSandbox();
  const suggestedUsdRaise = sandbox.suggestedUsdRaise as (run: unknown) => number;
  const run = { spend: { usd_est: 5.22, minutes: 10 }, budgets: { usd: 2, minutes: 30 } };
  assert.equal(suggestedUsdRaise(run), Math.max(5.22 + 2, 2 * 2));
});

// --- 6. whatNowLine renders the documented sentence for each shape -------------------

// FAILS ON REVERT: whatNowLine does not exist without this change — every case below
// would be reading `undefined`.
test("whatNowLine renders the documented sentence for stopped, failed-with-claim, failed-orphan-shaped, ready, and branch_landed", () => {
  const sandbox = loadSandbox();
  const whatNowLine = sandbox.whatNowLine as (run: unknown, d: unknown) => string | null;

  const stopped = {
    display_state: "stopped",
    branch: "kage/x",
    state_history: [{ state: "stopped", note: "estimated spend $5.22 exceeded the $2.00 budget" }],
  };
  assert.equal(whatNowLine(stopped, {}), "stopped by the kernel: estimated spend $5.22 exceeded the $2.00 budget. Resume, take over, or reject.");

  const landed = { display_state: "stopped", branch: "kage/x", branch_landed: true, state_history: [] };
  assert.match(whatNowLine(landed, {}) ?? "", /work is already on/);
  assert.match(whatNowLine(landed, {}) ?? "", /Close as landed/);

  const failedWithClaim = { display_state: "failed", branch: "kage/y" };
  const claim = { checks: [{ id: "tests", result: "fail" }, { id: "diff-size", result: "pass" }] };
  assert.equal(whatNowLine(failedWithClaim, { claim }), "verification failed: tests. Steer a fix, or reject.");

  const failedOrphan = { display_state: "failed", branch: "kage/z", worktree_adoptable: true };
  assert.match(whatNowLine(failedOrphan, {}) ?? "", /Adopt it to verify what it left behind/);

  const ready = { display_state: "ready", branch: "kage/w" };
  assert.equal(whatNowLine(ready, {}), "verified — review the receipt and merge.");
});

// --- 7. goal detail markup ------------------------------------------------------------

// FAILS ON REVERT: renderGoalDetail does not exist without this change — the goal
// card's click had no detail view to open.
test("goal detail markup renders full intent, autonomy in words, and each wave's runs by name with a verdict chip and a link", () => {
  const elements: Record<string, FakeElement> = {
    "goal-title": makeFakeElement("h3"),
    "goal-body": makeFakeElement("div"),
  };
  const sandbox = loadSandbox(elements);
  const state = sandbox.state as {
    goals: unknown[];
    runs: unknown[];
    selectedGoal: string | null;
  };
  state.goals = [
    {
      id: "g1",
      intent: "ship the whole feature end to end, in full, unabridged",
      state: "executing",
      autonomy: "merge",
      plan: { waves: [{ run_ids: ["r1"] }, { run_ids: [] }] },
    },
  ];
  state.runs = [{ id: "r1", display_name: "Ship the thing", display_state: "ready", verdict_label: "VERIFIED 3/3" }];
  state.selectedGoal = "g1";

  (sandbox.renderGoalDetail as () => void)();

  assert.equal(elements["goal-title"].textContent, "ship the whole feature end to end, in full, unabridged", "the FULL intent, never truncated");
  const body = elements["goal-body"];
  const autonomyLine = findAll(body, "gd-autonomy")[0];
  assert.ok(autonomyLine, "autonomy must be explained in words, not just the chip");
  assert.match(autonomyLine.textContent, /Auto-merge/);

  const rows = findAll(body, "gd-run-row");
  assert.equal(rows.length, 1, "wave 1 has one run, wave 2 (empty) contributes none");
  assert.equal(collectText(rows[0]), "Ship the thingreadyVERIFIED 3/3", "the run's name, state and verdict chip");
  assert.equal(typeof rows[0].onclick, "function", "each run row must link to its run");
});

// --- 8. empty states teach, via the existing emptyBlock() pattern --------------------

// FAILS ON REVERT: renderQueue's empty branch shows the old generic sentence, not the
// documented teaching text about cmd-enter.
test("the Queue tab's empty state teaches what belongs there", () => {
  const sandbox = loadSandbox();
  const body = makeFakeElement("div");
  (sandbox.renderQueue as (body: FakeElement, runId: string, steers: unknown[]) => void)(body, "run-1", []);
  assert.ok(
    collectText(body).includes("Messages you queue with cmd-enter wait here and deliver at the agent's next pause."),
    "must follow the documented sentence, not a generic placeholder",
  );
});

// FAILS ON REVERT: renderClaimlessStoppedReceipt does not exist without this change —
// the Receipt tab for a claimless stopped run fell through to the old generic
// "No claim yet" sentence with no Resume/Reject actions attached.
test("the Receipt tab's claimless-stopped empty state teaches what happened and offers Resume and Reject", () => {
  const sandbox = loadSandbox();
  const body = makeFakeElement("div");
  const run = {
    id: "r1",
    display_state: "stopped",
    spend: { usd_est: 1, minutes: 1 },
    budgets: { usd: 2, minutes: 30 },
    state_history: [],
  };
  (sandbox.renderClaimlessStoppedReceipt as (body: FakeElement, run: unknown) => void)(body, run);
  const text = collectText(body);
  assert.ok(text.includes("No claim exists"));
  assert.ok(text.includes("The run stopped before reporting. Resume it to continue, or Reject to close."));
  const buttons = findAll(body, "btn").map((b) => b.textContent);
  assert.ok(buttons.includes("Resume"), "the buttons that apply — Resume");
  assert.ok(buttons.includes("Reject"), "the buttons that apply — Reject");
});

// --- 9. narrow-layout gates stay green, and the composed page still parses -----------

// FAILS ON REVERT: not on this run's own wiring, but on a broken template-literal
// escape in app-client.ts/app-html.ts/app-styles.ts (a stray backtick or ${ once broke
// this exact way) — new Function() throws a SyntaxError the moment one slips in.
test("the composed app page still parses with the six dead-end fixes wired in, and never uses innerHTML", () => {
  const html = delegationAppHtml("tok");
  const script = html.split("<script>")[1].split("</" + "script>")[0];
  assert.doesNotThrow(() => new Function(script));
  assert.ok(!script.includes("innerHTML"), "the client script must never use innerHTML");
  assert.ok(html.includes('id="goal-overlay"'), "the goal detail overlay must be part of the composed page");
});

test("every CSS class this run adds is actually applied to an element somewhere", () => {
  const html = delegationAppHtml("tok");
  const styleEnd = html.indexOf("</style>");
  const css = html.slice(0, styleEnd);
  const body = html.slice(styleEnd);
  for (const cls of ["whatnow", "empty-actions", "gd-meta", "gd-autonomy", "gd-wave-block", "gd-run-row", "gd-run-name", "gd-foot"]) {
    assert.ok(css.includes(`.${cls}`), `expected the composed page's CSS to style .${cls}`);
    assert.match(body, new RegExp(`\\b${cls}\\b`), `.${cls} is styled but never applied to any element`);
  }
});
