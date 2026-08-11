// The GitHub webhook PROCESSOR — the thing that was `async () => {}`.
//
// Until now the intake was genuinely good (signature verified over the raw bytes before any
// parse, delivery id claimed before any side effect) and then every verified event was thrown
// away. The consequence was specific: `verifying` is the one work stage local git cannot see,
// because git has no concept of a pull request, so any team relying on the GitHub App had a
// stage that could never be reached.
//
// Two rules govern everything here:
//
//   1. A payload is UNTRUSTED INPUT. It arrives signed, which proves GitHub sent it — not that
//      its shape is what we expect. Every field is read defensively and a malformed event is
//      ignored rather than allowed to throw, because throwing here would make GitHub retry a
//      delivery that will never succeed.
//
//   2. Never invent state. `merged` comes from GitHub's own boolean, never inferred from
//      "closed"; a closed-unmerged PR is abandoned work, and flattening the two would report
//      abandoned work as shipped.

import type { Db } from "../db.js";

export interface WebhookEvent {
  name: string;
  deliveryId: string;
  workspaceId: string;
  payload: Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

/** GitHub's `pull_request` payload, reduced to the fields the orchestrator actually uses. */
interface PullRequestFacts {
  repository_full_name: string;
  number: number;
  head_ref: string;
  base_ref: string;
  state: string;
  merged: boolean;
  head_sha: string | null;
  title: string | null;
}

export function readPullRequest(payload: Record<string, unknown>): PullRequestFacts | null {
  const pr = record(payload.pull_request);
  const repo = record(payload.repository);
  if (!pr || !repo) return null;

  const fullName = str(repo.full_name);
  const number = int(pr.number);
  const head = record(pr.head);
  const base = record(pr.base);
  const headRef = head ? str(head.ref) : null;
  const baseRef = base ? str(base.ref) : null;
  const state = str(pr.state);
  if (!fullName || number === null || !headRef || !baseRef || !state) return null;

  return {
    repository_full_name: fullName,
    number,
    head_ref: headRef,
    base_ref: baseRef,
    state,
    // GitHub's own boolean. A closed PR that was never merged is abandoned, not shipped.
    merged: pr.merged === true,
    head_sha: head ? str(head.sha) : null,
    title: str(pr.title),
  };
}

/**
 * A concluded check suite, mapped to the head sha it ran against. Only a CONCLUDED suite is
 * recorded: an in-progress suite has no verdict, and writing one would invent a result.
 */
export function readCheckConclusion(
  payload: Record<string, unknown>,
): { repository_full_name: string; head_sha: string; conclusion: string } | null {
  const suite = record(payload.check_suite) ?? record(payload.check_run);
  const repo = record(payload.repository);
  if (!suite || !repo) return null;
  const fullName = str(repo.full_name);
  const headSha = str(suite.head_sha);
  const conclusion = str(suite.conclusion);
  if (!fullName || !headSha || !conclusion) return null;
  return { repository_full_name: fullName, head_sha: headSha, conclusion };
}

/**
 * Apply one verified event. Returns what it did, so the route can report something more useful
 * than "processed" and a test can assert the branch taken.
 */
export async function ingestGitHubEvent(db: Db, event: WebhookEvent): Promise<string> {
  if (event.name === "pull_request") {
    const facts = readPullRequest(event.payload);
    if (!facts) return "pull_request_malformed";
    await db.query(
      `INSERT INTO github_pull_requests
         (workspace_id, repository_full_name, number, head_ref, base_ref, state, merged, head_sha, title, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (workspace_id, repository_full_name, number) DO UPDATE SET
         head_ref = EXCLUDED.head_ref,
         base_ref = EXCLUDED.base_ref,
         state = EXCLUDED.state,
         merged = EXCLUDED.merged,
         head_sha = EXCLUDED.head_sha,
         title = EXCLUDED.title,
         updated_at = now()`,
      [
        event.workspaceId,
        facts.repository_full_name,
        facts.number,
        facts.head_ref,
        facts.base_ref,
        facts.state,
        facts.merged,
        facts.head_sha,
        facts.title,
      ],
    );
    return facts.merged ? "pull_request_merged" : `pull_request_${facts.state}`;
  }

  if (event.name === "check_suite" || event.name === "check_run") {
    const verdict = readCheckConclusion(event.payload);
    if (!verdict) return "check_not_concluded";
    // Attach the verdict to whichever PR currently has that head sha. A suite for a sha no PR
    // points at is not an error — it is a push build — so it simply matches nothing.
    const { rowCount } = await db.query(
      `UPDATE github_pull_requests
          SET check_conclusion = $1, updated_at = now()
        WHERE workspace_id = $2 AND repository_full_name = $3 AND head_sha = $4`,
      [verdict.conclusion, event.workspaceId, verdict.repository_full_name, verdict.head_sha],
    );
    return rowCount > 0 ? `check_${verdict.conclusion}` : "check_unmatched";
  }

  // installation / push / repository events are already handled by their own ledgers.
  return "ignored";
}

export interface OpenPullRequest {
  repository_full_name: string;
  number: number;
  head_ref: string;
  head_sha: string | null;
  check_conclusion: string | null;
}

/**
 * Branches with an open pull request — the team-tier answer to the same question the local
 * `gh` observer answers for a solo developer. One indexed read, because the board asks on
 * every render.
 */
export async function openPullRequests(db: Db, workspaceId: string): Promise<OpenPullRequest[]> {
  const { rows } = await db.query<OpenPullRequest>(
    `SELECT repository_full_name, number, head_ref, head_sha, check_conclusion
       FROM github_pull_requests
      WHERE workspace_id = $1 AND state = 'open'
      ORDER BY repository_full_name, number`,
    [workspaceId],
  );
  return rows;
}
