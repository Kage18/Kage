// Surface rendering for the reviewer role — board/TUI rendering of the new
// reviewing/approved/changes_requested states, and api.ts's review-verdict route.
//
// This run also completed three small gaps left in the kernel contract's OWN stated
// design (contract.ts's ownership(), steer.ts's REENTRANT_STATES, ratify.ts's
// REJECTABLE_STATES) — without them the new states rendered but every surface action
// on top of them (grouping, resume, reject) either misfiled the run or 409'd. Those
// fixes are covered here too, not just the pure-rendering pieces.
//
// A separate file per the repo's own rule — delegation.test.ts is a same-day
// merge-conflict hotspot several runs already collide in.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

import { createDelegationFeed, createPtyState, createRoomState, handleDelegationRoute, type DelegationFeed } from "./delegation/api.js";
import { guardRequest } from "./delegation/guard.js";
import { createRun, patchRun, readRun, toRunView, transitionRun } from "./delegation/contract.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { steerRun } from "./delegation/steer.js";
import { rejectRun } from "./delegation/ratify.js";
import { writeAgentReview, type AgentReviewRecord } from "./delegation/review.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-surface-review-"));
}

// Same fixture shape as review-contract.test.ts's tempGitProject — duplicated rather
// than imported, matching how this suite is already organized (delegation.test.ts and
// its siblings are off-limits to touch for this run).
function tempGitProject(): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeDelegationConfig(project, { test: "true" });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

// Drive a bare createRun()'d task straight to "reviewing" through the exact same legal
// transitions dispatch/verification would take, without paying for a real adapter run —
// review-contract.test.ts's own tests use this same direct-transition shape.
function toReviewing(project: string, intent: string): string {
  const task = createRun(project, { intent, type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  transitionRun(project, task.id, "verifying", "kernel");
  transitionRun(project, task.id, "ready", "kernel");
  patchRun(project, task.id, { review_required: true });
  transitionRun(project, task.id, "reviewing", "kernel");
  return task.id;
}

const TOKEN = "test-token-0123456789abcdef0123456789abcdef";

// A miniature of the daemon's mounting, matching delegation-api.test.ts's own startApi.
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
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, port, feed };
}

function apiFetch(port: number, path: string, options: RequestInit & { token?: boolean } = {}): Promise<Response> {
  const headers: Record<string, string> = { host: `127.0.0.1:${port}`, "content-type": "application/json" };
  if (options.token !== false && options.method && options.method !== "GET") {
    headers.authorization = `Bearer ${TOKEN}`;
  }
  return fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers });
}

// --- contract.ts: ownership() must place the three new states correctly, or the board's
// "Ready to merge"/"Needs a decision" grouping and the sidebar's needs-you badge count
// silently misfile them (a run in board.acard/workRow never surfaces as attention-needed
// even though it is sitting there wanting a merge or a steer).
test("ownership(): approved and changes_requested need a human, reviewing does not", () => {
  const project = tempGitProject();

  const reviewingId = toReviewing(project, "reviewing ownership check");
  assert.equal(toRunView(readRun(project, reviewingId)).ownership, "working", "an agent is actively reviewing — same family as running");

  const approvedId = toReviewing(project, "approved ownership check");
  transitionRun(project, approvedId, "approved", "kernel");
  assert.equal(toRunView(readRun(project, approvedId)).ownership, "needs_you", "approved is exactly as mergeable as ready — a human's call");

  const changesId = toReviewing(project, "changes requested ownership check");
  transitionRun(project, changesId, "changes_requested", "kernel");
  assert.equal(
    toRunView(readRun(project, changesId)).ownership,
    "needs_you",
    "changes_requested cannot progress on its own — a human must steer or reject it",
  );
});

// --- steer.ts: a changes_requested run resumes through the SAME tell/steer path
// blocked/stopped/failed already use — contract.ts's LEGAL_TRANSITIONS already allowed
// the kernel-level move, but steer.ts's own resumability gate had no entry for it, so a
// human "answering" a changes_requested run from any surface would flatly refuse.
test("steerRun treats changes_requested as resumable, not a dead end", async () => {
  const project = tempGitProject();
  const runId = toReviewing(project, "steer after changes requested");
  transitionRun(project, runId, "changes_requested", "kernel");
  // agent_pid alive (this very test process) so `!isProcessAlive(pid)` alone cannot be
  // what makes the run resumable — only the changes_requested branch itself can.
  patchRun(project, runId, { agent_pid: process.pid });

  const result = await steerRun(project, runId, "please add the missing negative-path test", () => stubAdapter());
  // Before this fix, steer.ts's REENTRANT_STATES/resumable check had no entry for
  // changes_requested, so this fell straight to the flat "nothing to steer" refusal.
  // Now it is treated exactly like blocked/stopped/failed and refuses only because THIS
  // run has no recorded agent session — proof the state itself is no longer a dead end.
  assert.equal(result.delivery, "refused");
  assert.match(result.message, /no agent session recorded/);
  assert.doesNotMatch(result.message, /nothing to steer/);
});

// --- ratify.ts: the reviewer-role design's own stated gate (goal
// add-a-reviewer-agent-role-to-kage-s-run-260819-d1c6, wave 1's brief) says reject must
// work from reviewing/changes_requested/approved, mirroring ready/failed/stopped — the
// landed kernel contract left REJECTABLE_STATES unchanged, so every one of those three
// would 409 from any surface's Reject button.
test("rejectRun accepts reviewing/approved/changes_requested", () => {
  const project = tempGitProject();
  const targets: Array<"reviewing" | "approved" | "changes_requested"> = ["reviewing", "approved", "changes_requested"];
  for (const target of targets) {
    const runId = toReviewing(project, `reject from ${target}`);
    if (target !== "reviewing") transitionRun(project, runId, target, "kernel");

    const result = rejectRun(project, runId, `rejecting a ${target} run`);
    assert.equal(result.ok, true, `reject from ${target} must be allowed: ${result.message}`);
    assert.equal(readRun(project, runId).state, "rejected");
  }
});

// --- api.ts: the review-verdict route, and the same verdict riding along with the
// run's own detail view so a client never needs a second request to know why a run is
// stuck (the repo's "one derived truth per surface" rule).
test("GET /runs/:id/review is honest about absence, then serves the reviewer's verdict once one exists — and runDetail carries it too", async () => {
  const project = tempGitProject();
  const runId = toReviewing(project, "review route roundtrip");

  const { server, port, feed } = await startApi(project);
  try {
    const before = await apiFetch(port, `/runs/${runId}/review`);
    assert.equal(before.status, 404, "no reviewer verdict recorded yet — the route must say so honestly, never guess one");

    const review: AgentReviewRecord = {
      schema_version: 1,
      run_id: runId,
      at: new Date().toISOString(),
      verdict: "changes_requested",
      findings: ["the new check has no negative-path test"],
      protocol_ok: true,
    };
    writeAgentReview(project, review);
    transitionRun(project, runId, "changes_requested", "kernel");

    const after = (await (await apiFetch(port, `/runs/${runId}/review`)).json()) as { ok: boolean; review?: AgentReviewRecord };
    assert.equal(after.ok, true);
    assert.equal(after.review?.verdict, "changes_requested");
    assert.deepEqual(after.review?.findings, ["the new check has no negative-path test"]);

    const detail = (await (await apiFetch(port, `/runs/${runId}`)).json()) as { agent_review?: AgentReviewRecord };
    assert.equal(detail.agent_review?.verdict, "changes_requested", "the run's own detail view must carry the same verdict, not just the dedicated route");
  } finally {
    feed.close();
    server.close();
  }
});

test("GET /runs/:id omits agent_review entirely for a run that never opted into review — absent, never a guessed verdict", async () => {
  const project = tempGitProject();
  const task = createRun(project, { intent: "plain run, no review", type: "chore", agent: "stub" });

  const { server, port, feed } = await startApi(project);
  try {
    const detail = (await (await apiFetch(port, `/runs/${task.id}`)).json()) as Record<string, unknown>;
    assert.equal("agent_review" in detail, false);
  } finally {
    feed.close();
    server.close();
  }
});
