// The kage_dispatch MCP tool — the Room manager's dispatch path — must hand a run to a
// DETACHED supervisor instead of running the hired agent inline, for the same reason
// `kage dispatch` (mcp/cli.ts) was fixed on 2026-08-18: a run executed as a plain child
// of the calling process dies the moment that process does. For the CLI that process is
// a shell; for this tool it is the MCP SERVER ITSELF, which makes the defect worse — a
// manager-dispatched run used to die with the MCP server, not just with the terminal.
//
// Deliberately its own file per repo convention: new behaviour gets its own test file,
// and mcp/delegation.test.ts (which already exercises kage_dispatch for goal-attachment
// behaviour) is a known merge-conflict hotspot other runs collide in.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listRuns, readRun, runTranscriptPath } from "./delegation/contract.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { callTool } from "./index.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

// A real git repo with a trivial, always-passing test command — same fixture shape as
// mcp/dispatch-durability.test.ts, which proved this pattern for the CLI path.
function tempGitProject(): string {
  const project = mkdtempSync(join(tmpdir(), "kage-mcp-dispatch-detached-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "note.ts"), "export function note() { return true; }\n", "utf8");
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

// The stub adapter (delegation/adapters/stub.ts) appends a `{"kind":"final",...}` line to
// the run's transcript only once its (possibly delayed) work is done — after the artificial
// KAGE_STUB_RUN_DELAY_MS sleep, the file edit, and the "tool" log line. Its presence is a
// direct, structural signal that the agent has finished; its absence is a direct signal it
// has not. Missing entirely (the detached supervisor hasn't even started writing yet) also
// means "not finished" — never treated as a read failure.
function transcriptHasFinalEvent(project: string, runId: string): boolean {
  let content: string;
  try {
    content = readFileSync(runTranscriptPath(project, runId), "utf8");
  } catch {
    return false;
  }
  return content.split("\n").some((line) => {
    if (!line.trim()) return false;
    try {
      return (JSON.parse(line) as { kind?: string }).kind === "final";
    } catch {
      return false;
    }
  });
}

test("REGRESSION: kage_dispatch returns before the hired agent finishes, and the run keeps working detached", async () => {
  const project = tempGitProject();
  // Holds the stub agent open for 3s so we can observe the run genuinely in flight at
  // the moment callTool resolves — the exact window in which the old inline path would
  // already have finished (or, if this process died, taken the run down with it).
  process.env.KAGE_STUB_RUN_DELAY_MS = "3000";
  try {
    const response = await callTool("kage_dispatch", {
      project_dir: project,
      intent: "leave a durable note via the manager",
      type: "chore",
      agent: "stub",
    });
    const responseText = response.content[0].text as string;

    const runs = listRuns(project);
    assert.equal(runs.length, 1, "the run must exist even though the agent has not finished");
    const runId = runs[0].id;

    // REVERT CHECK: before this fix, callTool awaited dispatchRun end-to-end, so by the
    // time it resolved the stub would already have slept its full delay and appended its
    // "kind":"final" transcript line. This asserts the ORDERING the test actually cares
    // about — kage_dispatch returns before the agent finishes — directly off the run's own
    // transcript, rather than off a wall-clock margin: FAILS if kage_dispatch is ever
    // changed back to await the agent inline, without depending on how fast any given
    // machine happens to run the synchronous brief-compile-and-handoff path.
    assert.ok(
      !transcriptHasFinalEvent(project, runId),
      "kage_dispatch must return before the stub's delayed agent work (and its transcript's final event) completes",
    );
    assert.ok(responseText.includes(runId), "the tool must return the run id promptly, not just a bare acknowledgement");

    // Still in flight at the moment the tool returned — this is what a synchronous
    // inline dispatch could never produce, since it would only return once the run had
    // already reached ready/failed.
    assert.ok(
      ["briefed", "dispatched", "running"].includes(runs[0].state),
      `expected the run still in flight right after kage_dispatch returned, got "${runs[0].state}"`,
    );
    assert.doesNotMatch(responseText, /verification failed|claim ready/i, "a not-yet-finished run must not read like a finished result");

    // The run keeps making progress after this call returns, owned by a detached
    // supervisor rather than this test process (or the MCP server it stands in for).
    await waitFor(() => {
      const state = readRun(project, runId).state;
      return state === "ready" || state === "failed";
    }, 15_000);
    const finished = readRun(project, runId);
    assert.equal(finished.state, "ready", "a stub run with passing checks must reach ready once its detached supervisor finishes");
    assert.ok(finished.supervisor_pid, "the run must be owned by a detached supervisor process, not this test process");
  } finally {
    delete process.env.KAGE_STUB_RUN_DELAY_MS;
  }
});

test("kage_dispatch still compiles and holds the brief before any detached work starts", async () => {
  const project = tempGitProject();
  const response = await callTool("kage_dispatch", {
    project_dir: project,
    intent: "brief card sanity check",
    type: "chore",
    agent: "stub",
  });
  const responseText = response.content[0].text as string;
  const runs = listRuns(project);
  assert.equal(runs.length, 1);
  // The brief card (what would be dispatched) must still be readable synchronously —
  // only the agent's execution moved off this call, not the brief compilation.
  assert.match(responseText, /BRIEF/);
  assert.match(responseText, /brief card sanity check/);
});
