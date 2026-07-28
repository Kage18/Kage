// The processor that was `async () => {}`.
//
// A signed payload proves GitHub sent it, NOT that its shape is what we expect, so these tests
// lean on the two rules that matter: malformed input is ignored rather than thrown (a throw
// would make GitHub retry a delivery that can never succeed), and state is never invented —
// `merged` comes from GitHub's own boolean, because a closed-unmerged PR is abandoned work and
// reporting it as shipped would be a lie the board then repeats.

import test from "node:test";
import assert from "node:assert/strict";
import { ingestGitHubEvent, openPullRequests, readPullRequest, readCheckConclusion } from "./ingest.js";
import type { Db } from "../db.js";

const WORKSPACE = "11111111-1111-1111-1111-111111111111";

/** A minimal in-memory stand-in: these tests are about TRANSLATION, not about postgres. */
function fakeDb(): Db & { rows: Map<string, Record<string, unknown>> } {
  const rows = new Map<string, Record<string, unknown>>();
  const db = {
    rows,
    async query(sql: string, params: unknown[] = []): Promise<{ rows: never[]; rowCount: number }> {
      if (sql.includes("INSERT INTO github_pull_requests")) {
        const [workspace_id, repository_full_name, number, head_ref, base_ref, state, merged, head_sha, title] =
          params as [string, string, number, string, string, string, boolean, string | null, string | null];
        rows.set(`${workspace_id}:${repository_full_name}:${number}`, {
          workspace_id, repository_full_name, number, head_ref, base_ref, state, merged, head_sha, title,
          check_conclusion: rows.get(`${workspace_id}:${repository_full_name}:${number}`)?.check_conclusion ?? null,
        });
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("UPDATE github_pull_requests")) {
        const [conclusion, workspace_id, repo, sha] = params as [string, string, string, string];
        let updated = 0;
        for (const row of rows.values()) {
          if (row.workspace_id === workspace_id && row.repository_full_name === repo && row.head_sha === sha) {
            row.check_conclusion = conclusion;
            updated += 1;
          }
        }
        return { rows: [], rowCount: updated };
      }
      if (sql.includes("SELECT repository_full_name")) {
        const [workspace_id] = params as [string];
        const open = [...rows.values()].filter((r) => r.workspace_id === workspace_id && r.state === "open");
        return { rows: open as never[], rowCount: open.length };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Db & { rows: Map<string, Record<string, unknown>> };
  return db;
}

function prPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    repository: { full_name: "acme/api" },
    pull_request: {
      number: 42,
      state: "open",
      merged: false,
      title: "Make tenantLimit configurable",
      head: { ref: "feat/limits", sha: "abc123" },
      base: { ref: "main" },
      ...overrides,
    },
  };
}

test("an opened pull request becomes the branch state the board reads", async () => {
  const db = fakeDb();
  const outcome = await ingestGitHubEvent(db, {
    name: "pull_request",
    deliveryId: "d1",
    workspaceId: WORKSPACE,
    payload: prPayload(),
  });
  assert.equal(outcome, "pull_request_open");

  const open = await openPullRequests(db, WORKSPACE);
  assert.equal(open.length, 1);
  // The BRANCH is the join key back to a work item — the orchestrator correlates commits by
  // branch, so this is what makes a PR mean "that item is in review".
  assert.equal(open[0].head_ref, "feat/limits");
});

// The mistake that would be easy and wrong: treating "closed" as "shipped".
test("a closed-but-unmerged pull request is abandoned, never reported as merged", async () => {
  const db = fakeDb();
  const outcome = await ingestGitHubEvent(db, {
    name: "pull_request",
    deliveryId: "d2",
    workspaceId: WORKSPACE,
    payload: prPayload({ state: "closed", merged: false }),
  });
  assert.equal(outcome, "pull_request_closed", "closed-unmerged must not read as merged");
  assert.equal((await openPullRequests(db, WORKSPACE)).length, 0, "it is no longer in review");
});

test("a merged pull request says so, from GitHub's own boolean", async () => {
  const db = fakeDb();
  const outcome = await ingestGitHubEvent(db, {
    name: "pull_request",
    deliveryId: "d3",
    workspaceId: WORKSPACE,
    payload: prPayload({ state: "closed", merged: true }),
  });
  assert.equal(outcome, "pull_request_merged");
});

test("a concluded check attaches its verdict to the PR with that head sha", async () => {
  const db = fakeDb();
  await ingestGitHubEvent(db, { name: "pull_request", deliveryId: "d4", workspaceId: WORKSPACE, payload: prPayload() });

  const outcome = await ingestGitHubEvent(db, {
    name: "check_suite",
    deliveryId: "d5",
    workspaceId: WORKSPACE,
    payload: { repository: { full_name: "acme/api" }, check_suite: { head_sha: "abc123", conclusion: "failure" } },
  });
  assert.equal(outcome, "check_failure");
  assert.equal((await openPullRequests(db, WORKSPACE))[0].check_conclusion, "failure");
});

// An in-progress suite has no verdict. Recording one would invent a result.
test("an unconcluded check writes nothing", async () => {
  const db = fakeDb();
  const outcome = await ingestGitHubEvent(db, {
    name: "check_suite",
    deliveryId: "d6",
    workspaceId: WORKSPACE,
    payload: { repository: { full_name: "acme/api" }, check_suite: { head_sha: "abc123", conclusion: null } },
  });
  assert.equal(outcome, "check_not_concluded");
});

// A signed payload proves the SENDER, not the SHAPE. Throwing here would make GitHub retry a
// delivery that can never succeed, forever.
test("a malformed payload is ignored, never thrown", async () => {
  const db = fakeDb();
  for (const payload of [
    {},
    { pull_request: {} },
    { repository: { full_name: "acme/api" }, pull_request: { number: "not-a-number" } },
    { repository: {}, pull_request: { number: 1, state: "open", head: {}, base: {} } },
  ]) {
    const outcome = await ingestGitHubEvent(db, {
      name: "pull_request",
      deliveryId: "dx",
      workspaceId: WORKSPACE,
      payload: payload as Record<string, unknown>,
    });
    assert.equal(outcome, "pull_request_malformed");
  }
  assert.equal((await openPullRequests(db, WORKSPACE)).length, 0);
});

test("the readers reject partial shapes rather than filling in blanks", () => {
  assert.equal(readPullRequest({}), null);
  assert.equal(readPullRequest({ repository: { full_name: "a/b" } }), null);
  assert.equal(readCheckConclusion({ repository: { full_name: "a/b" } }), null);
  // A suite with no conclusion is not a verdict.
  assert.equal(
    readCheckConclusion({ repository: { full_name: "a/b" }, check_suite: { head_sha: "s" } }),
    null,
  );
});

test("events Kage does not model are ignored without error", async () => {
  const db = fakeDb();
  assert.equal(
    await ingestGitHubEvent(db, { name: "push", deliveryId: "d7", workspaceId: WORKSPACE, payload: {} }),
    "ignored",
  );
});
