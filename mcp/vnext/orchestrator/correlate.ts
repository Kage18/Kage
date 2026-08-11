// Correlation before reduction (tech design §6).
//
// Most events do not name a work item, so resolving which item a commit belongs to is an
// explicit, confidence-ranked step — and the confidence travels with the answer, because
// the reducer's cardinal rule is that a WEAK correlation never fires a stage transition
// on its own. The ladder:
//
//   explicit  — a `[kage:<work_id>]` trailer in the commit message. Exact, unambiguous.
//   strong    — the branch name contains the work item's slug. Convention, near-certain.
//   weak      — changed paths overlap the item's blast set. Suggestive, never sufficient.
//
// Ambiguity is honesty's edge case: if two items match at the winning tier, the answer is
// null — inventing a correlation is worse than admitting none.

export interface CorrelatableCommit {
  message: string;
  branch: string;
  changed_paths: string[];
}

export interface WorkItemRef {
  work_id: string;
  blast_paths: string[];
}

export type CorrelationConfidence = "explicit" | "strong" | "weak";

export interface Correlation {
  work_id: string;
  confidence: CorrelationConfidence;
}

const TRAILER = /\[kage:([^\]\s]+)\]/;

// The slug is the human-readable tail of a work id — `repo:<key>:proposal:<slug>-<n>`
// minus the numeric suffix capture appends. Short slugs are refused as branch evidence:
// `fix` appearing in a branch name proves nothing.
export function workItemSlug(workId: string): string | null {
  const tail = workId.split(":").pop() ?? "";
  const slug = tail.replace(/-\d+$/, "");
  return slug.length >= 8 ? slug : null;
}

export function correlateCommit(commit: CorrelatableCommit, items: WorkItemRef[]): Correlation | null {
  const trailer = TRAILER.exec(commit.message);
  if (trailer) {
    const named = items.find((item) => item.work_id === trailer[1]);
    if (named) return { work_id: named.work_id, confidence: "explicit" };
    // A trailer naming an unknown item is not evidence for any OTHER item.
    return null;
  }

  const branch = commit.branch.toLowerCase();
  const byBranch = items.filter((item) => {
    const slug = workItemSlug(item.work_id);
    return slug !== null && branch.includes(slug.toLowerCase());
  });
  if (byBranch.length === 1) return { work_id: byBranch[0].work_id, confidence: "strong" };
  if (byBranch.length > 1) return null;

  const changed = new Set(commit.changed_paths.map((path) => path.replace(/\\/g, "/")));
  const byBlast = items.filter((item) => item.blast_paths.some((path) => changed.has(path.replace(/\\/g, "/"))));
  if (byBlast.length === 1) return { work_id: byBlast[0].work_id, confidence: "weak" };
  return null;
}
