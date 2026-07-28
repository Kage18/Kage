-- Kage workspace service — migration 013: what a verified GitHub webhook actually leaves behind.
--
-- Until now the intake was real (signature over raw bytes, delivery-id idempotency) and the
-- processor was `async () => {}`: every verified event was recorded in the delivery ledger and
-- then DISCARDED. So `verifying` — the one work stage local git cannot see, because git has no
-- concept of a pull request — was underivable for any team on the GitHub App.
--
-- This is deliberately a STATE table, not an event log. The orchestrator asks one question of
-- GitHub ("is there an open PR on this branch, and did it merge?"), and a state row answers it
-- in one indexed read. An event log would make every board render replay history to find out.
--
-- Tenant-scoped like every other table: a webhook can never write across workspaces.

CREATE TABLE github_pull_requests (
  workspace_id UUID NOT NULL,
  repository_full_name TEXT NOT NULL,
  number INTEGER NOT NULL,
  -- The branch the PR is FROM. This is the join key back to a work item: the orchestrator
  -- correlates commits to work by branch, so the branch is what makes a PR mean "that item is
  -- in review" rather than just "a PR exists".
  head_ref TEXT NOT NULL,
  base_ref TEXT NOT NULL,
  -- GitHub's own words: open | closed. Merged is NOT a state in GitHub's model — a merged PR is
  -- closed with merged=true — and flattening the two would make an abandoned PR look shipped.
  state TEXT NOT NULL,
  merged BOOLEAN NOT NULL DEFAULT FALSE,
  head_sha TEXT,
  title TEXT,
  -- The CI verdict for head_sha, when a check_suite has reported one: success | failure |
  -- neutral | cancelled | timed_out | action_required. NULL means no suite has concluded, which
  -- is different from a suite that concluded neutral.
  check_conclusion TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id, repository_full_name, number)
);

-- The board's question is "which branches have an open PR", so that is the index.
CREATE INDEX github_pull_requests_open_by_branch
  ON github_pull_requests(workspace_id, head_ref)
  WHERE state = 'open';
