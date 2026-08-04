// Citation verification against the working tree — the trust reading is computed, never asserted.
//
// A card's verify state is the product's core promise: recall only what the tree still supports.
// This module is the only place that reading may come from. Three values (DIRECTION.md):
//
//   stale       a cited symbol or file is GONE, or a commit ref no longer exists — withheld
//   unverified  the cited file DRIFTED (blob sha differs from the pinned one) since the last check
//   verified    every pinned sha matches the tree right now
//
// Deterministic on purpose: an LLM judges what is worth remembering; only bytes and shas decide
// whether it is still true. Nothing here can be argued with by a model, and nothing here guesses.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { Card, Citation, CodeCitation, RefCitation, VerifyState } from "./types.js";
import { isCodeCitation } from "./types.js";

/** One citation, one verdict. `blobSha` is the tree's current sha, not the pinned one. */
export interface CitationCheck {
  citation: Citation;
  ok: boolean;
  reason: string;
  blobSha?: string;
  symbolPresent?: boolean;
}

export function checkCitation(projectDir: string, citation: Citation): CitationCheck {
  return isCodeCitation(citation)
    ? checkCodeCitation(projectDir, citation)
    : checkRefCitation(projectDir, citation);
}

function checkCodeCitation(projectDir: string, citation: CodeCitation): CitationCheck {
  const root = resolve(projectDir);
  const target = resolve(root, citation.path);
  if (target !== root && !target.startsWith(root + sep)) {
    // card.ts already refuses traversal at the gate, but the auditor also runs against cards
    // read back from disk — a hand-edited card file must not turn verification into an
    // arbitrary-path reader.
    return { citation, ok: false, reason: "path escapes the project" };
  }

  let isFile = false;
  try {
    isFile = statSync(target).isFile();
  } catch {
    // Missing is a verdict, not an error.
  }
  if (!isFile) {
    return { citation, ok: false, reason: "file missing" };
  }

  const blobSha = blobShaOf(root, citation.path, target);

  if (citation.symbol) {
    // Word-bounded so `limit` cannot claim `withinLimit` as evidence; escaped so a symbol
    // containing regex metacharacters is matched as text, not as a pattern.
    const escaped = citation.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const symbolPresent = new RegExp(`\\b${escaped}\\b`).test(readFileSync(target, "utf8"));
    if (!symbolPresent) {
      return { citation, ok: false, reason: `symbol ${citation.symbol} not found`, blobSha, symbolPresent };
    }
    return { citation, ok: true, reason: "resolved", blobSha, symbolPresent };
  }

  return { citation, ok: true, reason: "resolved", blobSha };
}

function checkRefCitation(projectDir: string, citation: RefCitation): CitationCheck {
  if (citation.ref.startsWith("commit:")) {
    const sha = citation.ref.slice("commit:".length);
    try {
      execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], {
        cwd: resolve(projectDir),
        stdio: "ignore",
      });
      return { citation, ok: true, reason: "commit present" };
    } catch {
      // Covers a garbage-collected sha and a worktree that is not a repo at all — either way
      // the cited history is not reachable from here, which is what stale means.
      return { citation, ok: false, reason: "commit not found" };
    }
  }
  // "pr:<n>" and URLs live outside the worktree. HONEST: we do not pretend to verify what we
  // cannot — the pass is explicit so a reader sees it was a pass, not a check.
  return { citation, ok: true, reason: "not locally checkable" };
}

/**
 * The current blob sha of a working-tree file. git's hash is preferred because it matches what
 * `git hash-object` produces anywhere else; when git fails (a worktree is not guaranteed to be
 * a repo, or to have git at all) sha256 of the bytes serves instead. Only consistency matters
 * for drift detection — both sides of every comparison come from this function — and a
 * mixed-environment mismatch degrades to "unverified" (re-check), never to a false "verified".
 */
function blobShaOf(root: string, relPath: string, absPath: string): string {
  try {
    return execFileSync("git", ["hash-object", "--", relPath], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return createHash("sha256").update(readFileSync(absPath)).digest("hex");
  }
}

// ── The audit ────────────────────────────────────────────────────────────────────────────────

export interface AuditResult {
  verify: VerifyState;
  checks: CitationCheck[];
}

/**
 * The whole card's reading, from its citations. GONE beats DRIFTED: one failed check makes the
 * card stale no matter how pristine the rest is, because a claim that cites vanished evidence
 * cannot be re-checked, only re-written. The not-locally-checkable pass reports ok and so never
 * forces stale — but it also never upgrades anything.
 */
export function auditCard(projectDir: string, card: Card): AuditResult {
  const checks = card.citations.map((citation) => checkCitation(projectDir, citation));

  // A card with zero citations cannot exist per the gate, but a hand-edited file might arrive
  // here anyway — and vacuous evidence must not read as verified.
  if (checks.length === 0 || checks.some((check) => !check.ok)) {
    return { verify: "stale", checks };
  }

  // A citation with NO pinned sha counts as unverified: verification is an act, not an
  // assumption, and a pin that was never made has never been checked against anything.
  const drifted = checks.some(
    (check) =>
      isCodeCitation(check.citation) &&
      (check.citation.blobSha === undefined || check.citation.blobSha !== check.blobSha),
  );
  return { verify: drifted ? "unverified" : "verified", checks };
}

// ── Re-pinning ───────────────────────────────────────────────────────────────────────────────

/**
 * Copies of `citations` with blobSha stamped to the current tree, for code citations that
 * resolve. This is the act the audit later holds the tree to — it runs at approval and after a
 * human re-verify, never automatically, or drift detection would only ever detect itself.
 * Citations that fail their check are copied unstamped: a pin must mean "checked against this",
 * so an unresolvable citation keeps whatever pin it had. Never mutates its input — the caller's
 * array may be the store's live card.
 */
export function repinCitations(projectDir: string, citations: Citation[]): Citation[] {
  return citations.map((citation) => {
    if (!isCodeCitation(citation)) return { ...citation };
    const check = checkCitation(projectDir, citation);
    if (!check.ok || check.blobSha === undefined) return { ...citation };
    return { ...citation, blobSha: check.blobSha };
  });
}
