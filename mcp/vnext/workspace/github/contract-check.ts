// The contract checker: a pull request gets Kage's verdict as a GitHub check.
//
// Deliberately NOT a second rule engine. `buildMinimalChangeReport` already evaluates a diff
// against the repository model and produces findings with severity, evidence and a
// blocking/warning split. What was missing was the LAST MILE — that report only ever ran from
// a local `kage pr check`, so it never reached the place a reviewer actually looks.
//
// Three rules shape everything here:
//
//   1. Only a DETERMINISTIC finding can fail a check. The report already marks model-authored
//      suggestions `deterministic: false`; a check that fails on an opinion trains people to
//      ignore checks, which is worse than having none.
//   2. The summary is a REVIEW ARTEFACT, never a payload dump. It carries titles, severities
//      and file paths — `publishCheck` independently refuses anything containing raw prompt or
//      tool content, so this is defence in depth rather than the only guard.
//   3. A check that could not run reports `neutral`, never `success`. Silence that looks like
//      approval is the failure mode this whole product exists to prevent.

import type { MinimalChangeFinding } from "../../policy/types.js";
import type { PolicyReport } from "../../policy/report.js";
import { canPublishChecks, publishCheck, type CheckInstallation, type CheckPublishResult, type PublishDeps } from "./checks.js";

export type CheckConclusion = "success" | "neutral" | "failure";

export interface ContractVerdict {
  conclusion: CheckConclusion;
  title: string;
  summary: string;
  /** Findings that determined the conclusion, for a caller that wants to log or store them. */
  blocking: readonly MinimalChangeFinding[];
}

const MAX_LISTED = 10;

function line(finding: MinimalChangeFinding): string {
  const where = finding.suggested_files.length ? ` — ${finding.suggested_files.slice(0, 3).join(", ")}` : "";
  return `- **${finding.title}** (${finding.severity})${where}`;
}

/**
 * Turn a policy report into a check verdict. Pure, so the mapping that decides whether a PR is
 * blocked is testable without a network, a database, or a GitHub App.
 */
export function verdictFromReport(
  report: Pick<PolicyReport, "blocking" | "warnings" | "findings">,
): ContractVerdict {
  // An opinion must never block. The report already separates deterministic findings from
  // model-authored ones; this re-checks rather than trusting the caller's split.
  const blocking = report.blocking.filter((entry: MinimalChangeFinding) => entry.deterministic);

  if (blocking.length > 0) {
    const listed = blocking.slice(0, MAX_LISTED).map(line).join("\n");
    const more = blocking.length > MAX_LISTED ? `\n\n…and ${blocking.length - MAX_LISTED} more.` : "";
    return {
      conclusion: "failure",
      title: `${blocking.length} contract finding${blocking.length === 1 ? "" : "s"}`,
      summary:
        `This change breaks ${blocking.length} rule${blocking.length === 1 ? "" : "s"} the repository `
        + `enforces.\n\n${listed}${more}\n\n`
        + `Every finding above is derived from the diff and the repository model — none is a suggestion.`,
      blocking,
    };
  }

  if (report.warnings.length > 0) {
    const listed = report.warnings.slice(0, MAX_LISTED).map(line).join("\n");
    return {
      conclusion: "neutral",
      title: `${report.warnings.length} advisory finding${report.warnings.length === 1 ? "" : "s"}`,
      // Neutral, not failure: an advisory that blocks the merge is an advisory nobody will
      // leave enabled.
      summary: `Nothing here blocks the merge. These are worth a look:\n\n${listed}`,
      blocking: [],
    };
  }

  return {
    conclusion: "success",
    title: "No contract findings",
    summary: "The diff was evaluated against the repository model and broke none of the enforced rules.",
    blocking: [],
  };
}

/**
 * The verdict for a check that could not be evaluated. NEVER `success` — a green tick that
 * actually means "we did not look" is the exact dishonesty this product exists to remove.
 */
export function unavailableVerdict(reason: string): ContractVerdict {
  return {
    conclusion: "neutral",
    title: "Contract check did not run",
    summary: `Kage could not evaluate this change: ${reason}\n\nThis is NOT a pass — nothing was checked.`,
    blocking: [],
  };
}

export interface PublishContractCheckInput {
  installation: CheckInstallation;
  head_sha: string;
  verdict: ContractVerdict;
  details_url?: string;
  deps: PublishDeps;
}

/**
 * Publish a verdict. A read-only installation is skipped rather than failed: `checks: write` is
 * a separate opt-in, and a least-privilege install must degrade cleanly instead of erroring on
 * every pull request.
 */
export async function publishContractCheck(input: PublishContractCheckInput): Promise<CheckPublishResult> {
  if (!canPublishChecks(input.installation)) return { status: "skipped_missing_permission" };
  return publishCheck(
    input.installation,
    {
      head_sha: input.head_sha,
      conclusion: input.verdict.conclusion,
      title: input.verdict.title,
      summary: input.verdict.summary,
      ...(input.details_url ? { details_url: input.details_url } : {}),
    },
    input.deps,
  );
}
