// The pull-request observer (tech design §7). Local git knows branches and merges but has no
// concept of review, so `verifying` needs a source outside the repository. The GitHub App is
// that source for teams; this is the source for everyone else — the `gh` CLI the developer is
// already authenticated with.
//
// Tenet T4 governs the failure modes: an absent observer costs derivation DEPTH, never
// correctness. No `gh`, not authenticated, no remote, offline, rate-limited — every one of
// those returns an empty set, and items sit at `building` instead of reporting something false.

import { execFileSync } from "node:child_process";

interface PullRequestRow {
  headRefName?: unknown;
}

const LOOKUP_TIMEOUT_MS = 4000;

/**
 * Branch names with an open pull request. Empty whenever the observer cannot answer — never a
 * throw, because a board that fails to render is worse than one showing less detail.
 */
export function openPullRequestBranches(projectDir: string): Set<string> {
  try {
    const raw = execFileSync(
      "gh",
      ["pr", "list", "--state", "open", "--limit", "100", "--json", "headRefName"],
      { cwd: projectDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: LOOKUP_TIMEOUT_MS },
    );
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const branches = new Set<string>();
    for (const row of parsed as PullRequestRow[]) {
      if (typeof row?.headRefName === "string" && row.headRefName.trim()) branches.add(row.headRefName.trim());
    }
    return branches;
  } catch {
    return new Set();
  }
}

// Cached per process: `gh pr list` is a network round trip, and the board re-derives on every
// request. A short TTL keeps a freshly-opened PR from taking minutes to appear while still
// collapsing the burst of derivations a single page load causes.
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; branches: Set<string> }>();

export function cachedOpenPullRequestBranches(projectDir: string): Set<string> {
  const hit = cache.get(projectDir);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.branches;
  const branches = openPullRequestBranches(projectDir);
  cache.set(projectDir, { at: now, branches });
  return branches;
}
