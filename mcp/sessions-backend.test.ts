// Regression tests for W1 of the sessions surface — the backend data the AO-style UI
// needs, per docs/design/SESSIONS_SURFACE.md: named workers (display_name), the
// verdict-derived ghost suggestion (suggestedNextPrompt), the run API's per-file diff
// tree, and orchestrator presence on GET /room.
//
// Its own file per this repo's rule — new behaviour gets a new test file, and
// mcp/delegation.test.ts is a known append-collision hotspot.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createRun,
  deriveDisplayName,
  readRun,
  RUN_SCHEMA_VERSION,
  type ClaimRecord,
  type TaskRecord,
} from "./delegation/contract.js";
import { suggestedNextPrompt } from "./delegation/suggest.js";
import { orchestratorPresence, runFilesTree } from "./delegation/api.js";
import { dispatchRun } from "./delegation/dispatch.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { worktreePath } from "./delegation/worktree.js";
import { roomPtySocketPath } from "./delegation/room-pty.js";
import { appendRoomTurn, readRoomHistory } from "./delegation/room-history.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-sessions-backend-"));
}

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempGitProject(): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

// --- 1. Named workers: display_name -----------------------------------------------------

// FAILS ON REVERT: without display_name on CreateRunInput/TaskRecord, createRun ignores
// displayName entirely and this run's record has no display_name field at all.
test("display_name persists on the run record when the caller provides one", () => {
  const project = tempProject();
  const { id } = createRun(project, {
    intent: "wire the sessions surface's backend data",
    type: "feature",
    agent: "stub",
    displayName: "Sessions backend",
  });
  assert.equal(readRun(project, id).display_name, "Sessions backend");
});

// FAILS ON REVERT: without the fallback, a run dispatched with no displayName has
// display_name === undefined instead of a derived name.
test("display_name derives from the intent when the caller provides none, using the SAME function createRun calls", () => {
  const project = tempProject();
  const intent = "Wire the sessions surface's backend data into the run API responses";
  const { id } = createRun(project, { intent, type: "feature", agent: "stub" });
  assert.equal(readRun(project, id).display_name, deriveDisplayName(intent));
});

// FAILS ON REVERT: deriveDisplayName does not exist without this change.
test("deriveDisplayName truncates on a word boundary and never returns empty", () => {
  assert.equal(deriveDisplayName("fix the bug"), "fix the bug", "a short intent is returned unchanged");

  const long = "Wire the sessions surface's backend data into the run API responses for the composer";
  const derived = deriveDisplayName(long);
  assert.ok(derived.length <= 41, `expected at most 41 chars (40 + ellipsis), got ${derived.length}: "${derived}"`);
  assert.ok(derived.endsWith("…"), `expected an ellipsis, got "${derived}"`);
  const withoutEllipsis = derived.slice(0, -1);
  assert.ok(long.startsWith(withoutEllipsis), "the truncated prefix must be a real prefix of the intent");
  const nextChar = long[withoutEllipsis.length];
  assert.ok(nextChar === " " || nextChar === undefined, `expected the cut to land on a word boundary, next char was "${nextChar}"`);

  assert.equal(deriveDisplayName(""), "Untitled run", "an empty intent must never derive an empty name");
  assert.equal(deriveDisplayName("   \n  "), "Untitled run", "a whitespace-only intent must never derive an empty name");

  // A single word longer than the budget has no space to cut on — still non-empty.
  const singleWord = "a".repeat(80);
  const derivedWord = deriveDisplayName(singleWord);
  assert.ok(derivedWord.length > 0, "a single overlong word must still derive a non-empty name");
  assert.ok(derivedWord.endsWith("…"));
});

// --- 2. Verdict-derived ghost suggestion -------------------------------------------------

function fixtureTask(
  overrides: Partial<Pick<TaskRecord, "state" | "state_history" | "waiting_on">>,
): Pick<TaskRecord, "state" | "state_history" | "waiting_on"> {
  return {
    state: "running",
    state_history: [{ state: "draft", at: "2026-08-20T00:00:00.000Z", by: "kernel" }],
    ...overrides,
  };
}

function fixtureClaim(checks: ClaimRecord["checks"]): ClaimRecord {
  return {
    schema_version: RUN_SCHEMA_VERSION,
    run_id: "fixture-run",
    statement: "fixture statement",
    checks,
    unsure: [],
    learnings: [],
    protocol_ok: true,
    diff: { files: 1, lines: 10, paths: ["a.ts"] },
    created_at: "2026-08-20T00:00:00.000Z",
  };
}

// FAILS ON REVERT: mcp/delegation/suggest.ts does not exist without this change, so this
// import fails to compile.
test("suggestedNextPrompt names the failing command verbatim when a check failed", () => {
  const claim = fixtureClaim([
    { id: "tests", kind: "command", expect: "exit 0", cmd: "npm run test --prefix mcp", result: "fail", exit_code: 1 },
  ]);
  const task = fixtureTask({ state: "failed" });
  assert.equal(suggestedNextPrompt(task, claim), "the tests check failed: npm run test --prefix mcp - fix and reverify");
});

test("suggestedNextPrompt returns null for a failed run with no failing command check", () => {
  // A claim whose only failure is a static check (diff-size, citations) has no command
  // to name verbatim — the rule is specifically about executed commands.
  const claim = fixtureClaim([{ id: "diff-size", kind: "diff", expect: "at most 400 lines", result: "fail" }]);
  assert.equal(suggestedNextPrompt(fixtureTask({ state: "failed" }), claim), null);
  assert.equal(suggestedNextPrompt(fixtureTask({ state: "failed" }), null), null);
});

test("suggestedNextPrompt quotes the stall evidence verbatim when stopped by the stall detector", () => {
  const task = fixtureTask({
    state: "stopped",
    state_history: [
      { state: "running", at: "2026-08-20T00:00:00.000Z", by: "kernel" },
      {
        state: "stopped",
        at: "2026-08-20T00:05:00.000Z",
        by: "kernel",
        note: "stalled: `npm test` failed with exit 1 on 3 consecutive turns",
      },
    ],
  });
  assert.equal(suggestedNextPrompt(task, null), "stalled: `npm test` failed with exit 1 on 3 consecutive turns");
});

test("suggestedNextPrompt returns null for a stop that is not a stall (e.g. a budget halt)", () => {
  const task = fixtureTask({
    state: "stopped",
    state_history: [{ state: "stopped", at: "2026-08-20T00:00:00.000Z", by: "kernel", note: "budget exceeded: $5.00 > $2.00" }],
  });
  assert.equal(suggestedNextPrompt(task, null), null);
});

test('suggestedNextPrompt says "review the receipt" when ready', () => {
  assert.equal(suggestedNextPrompt(fixtureTask({ state: "ready" }), null), "review the receipt");
});

test("suggestedNextPrompt returns the agent's own question, verbatim, when blocked", () => {
  const task = fixtureTask({ state: "blocked", waiting_on: { detail: "proceed with plan A or B?", needs: "a decision" } });
  assert.equal(suggestedNextPrompt(task, null), "proceed with plan A or B?");
});

test("suggestedNextPrompt returns null for blocked with no waiting_on recorded, and for a plain running run", () => {
  assert.equal(suggestedNextPrompt(fixtureTask({ state: "blocked" }), null), null);
  assert.equal(suggestedNextPrompt(fixtureTask({ state: "running" }), null), null);
});

// --- 3. Files tree: the run API's structured diff data -----------------------------------

// FAILS ON REVERT: without runFilesTree (and without git.ts's diffFileTree, and without
// api.ts exposing it), this import fails to compile, or the returned tree is empty for a
// run whose work is fully committed — exactly the vacuous-diff bug class fixed today for
// the diff-size check (measureDiff), reproduced here for the FILES panel's own data.
test(
  "the files tree reports the correct status and +/- lines for a fixture diff, including a committed-work worktree",
  async () => {
    const project = tempGitProject();
    const content = `${Array.from({ length: 12 }, (_, i) => `line ${i}`).join("\n")}\n`;
    const { task } = await dispatchRun(
      project,
      { intent: "add a files-tree fixture file", type: "chore" },
      stubAdapter({ editFile: { path: "files-tree-fixture.ts", content } }),
    );
    assert.equal(task.state, "ready");

    // Confirm the work is genuinely committed onto the run's branch — the exact worktree
    // state (`git status` clean) that made the OLD uncommitted-only measurement read the
    // real change as zero.
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: worktreePath(project, task.id), encoding: "utf8" });
    assert.equal(status.trim(), "", "the run's work must already be committed, like a real claim-time commit");

    const tree = runFilesTree(project, task.id);
    const entry = tree.find((file) => file.path === "files-tree-fixture.ts");
    assert.ok(entry, `expected files-tree-fixture.ts in the tree, got ${JSON.stringify(tree)}`);
    assert.equal(entry!.status, "added");
    assert.equal(entry!.added, 12);
    assert.equal(entry!.removed, 0);
  },
);

test("the files tree is empty for a run with no branch and no worktree (never throws)", () => {
  const project = tempGitProject();
  const { id } = createRun(project, { intent: "never dispatched", type: "chore", agent: "stub" });
  assert.deepEqual(runFilesTree(project, id), []);
});

// --- 4. Orchestrator presence -------------------------------------------------------------

// FAILS ON REVERT: orchestratorPresence does not exist without this change, so this
// import fails to compile.
test("orchestrator presence reads false with no session, and true once a live pty answers (the test seam)", async () => {
  const project = tempProject();
  const before = await orchestratorPresence(project);
  assert.equal(before.live, false, "no room-pty or room-supervisor socket exists yet");
  assert.equal(before.activity_at, null);

  // The test seam: a real unix socket standing in for a live room pty, same technique
  // room-pty.test.ts already uses to prove isRoomPtyLive without a real node-pty process
  // — write anything back on connect and isRoomPtyLive resolves true.
  const socketPath = roomPtySocketPath(project);
  const sockets = new Set<import("node:net").Socket>();
  const server = createServer((connection) => {
    sockets.add(connection);
    connection.on("close", () => sockets.delete(connection));
    connection.write(`${JSON.stringify({ kind: "status" })}\n`);
    // isRoomPtyLive's own client half-closes with socket.end() once it sees data; this
    // side must close too, or the connection (and the server's listen handle behind it)
    // never fully releases and the test process hangs after the assertions already pass.
    connection.end();
  });
  await new Promise<void>((resolveListen) => server.listen(socketPath, () => resolveListen()));
  try {
    const live = await orchestratorPresence(project);
    assert.equal(live.live, true, "a live pty must read the orchestrator as present");
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    rmSync(socketPath, { force: true });
  }
});

test("orchestrator presence's activity timestamp is the last room turn when one exists", async () => {
  const project = tempProject();
  appendRoomTurn(project, { role: "you", text: "hello" });
  const turns = readRoomHistory(project);
  const presence = await orchestratorPresence(project);
  assert.equal(presence.activity_at, turns[turns.length - 1].at);
});
