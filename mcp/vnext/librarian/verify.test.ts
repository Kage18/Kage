import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { auditCard, checkCitation, repinCitations } from "./verify.js";
import type { Card, Citation, CodeCitation } from "./types.js";

// Every test runs against a real scratch repo — the auditor's whole job is to disagree with
// stored state when the tree moved, so a faked tree would test nothing.

const scratchDirs: string[] = [];
after(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-verify-"));
  scratchDirs.push(dir);
  return dir;
}

/** A real git repo with one committed file. Identity is passed inline — machine config is never assumed. */
function scratchRepo(): string {
  const dir = scratchDir();
  execFileSync("git", ["init", "-q"], { cwd: dir });
  writeFileSync(join(dir, "limits.ts"), "export function withinLimit(n: number) {\n  return n < 10;\n}\n");
  commit(dir, "seed");
  return dir;
}

function commit(dir: string, message: string): string {
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["-c", "user.email=t@t.dev", "-c", "user.name=T", "commit", "-q", "-m", message], {
    cwd: dir,
  });
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
}

function card(citations: Citation[]): Card {
  return {
    id: "card_deadbeef",
    kind: "caution",
    state: "approved",
    verify: "unverified",
    title: "withinLimit is exclusive on purpose",
    claim: "The comparison is < rather than <= so a tenant at exactly the limit is refused.",
    citations,
    trigger: "editing limits.ts",
    provenance: { source: "human", ref: "t", at: "2026-08-04T00:00:00.000Z" },
    tags: [],
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}

// ── Stale: the evidence is gone ──────────────────────────────────────────────────────────────

test("a missing file makes the card stale — gone is withheld, not merely drifted", () => {
  const repo = scratchRepo();
  const result = auditCard(repo, card([{ path: "deleted.ts" }]));
  assert.equal(result.verify, "stale");
  assert.equal(result.checks[0].ok, false);
  assert.equal(result.checks[0].reason, "file missing");
});

test("a removed symbol makes the card stale even though the file survives", () => {
  const repo = scratchRepo();
  const pinned = repinCitations(repo, [{ path: "limits.ts", symbol: "withinLimit" }]);
  writeFileSync(join(repo, "limits.ts"), "export function underLimit(n: number) {\n  return n < 10;\n}\n");
  const result = auditCard(repo, card(pinned));
  assert.equal(result.verify, "stale");
  assert.match(result.checks[0].reason, /symbol withinLimit not found/);
  assert.equal(result.checks[0].symbolPresent, false);
});

test("symbol matching is word-bounded — a substring of another identifier is not evidence", () => {
  const repo = scratchRepo();
  // "within" appears inside "withinLimit", but that is a different identifier entirely.
  const check = checkCitation(repo, { path: "limits.ts", symbol: "within" });
  assert.equal(check.ok, false);
  assert.equal(check.symbolPresent, false);
});

test("a traversal path is refused, not read — the auditor is not an arbitrary-path reader", () => {
  const repo = scratchRepo();
  for (const path of ["../outside.ts", "/etc/passwd"]) {
    const check = checkCitation(repo, { path });
    assert.equal(check.ok, false, path);
    assert.match(check.reason, /escapes the project/, path);
  }
  assert.equal(auditCard(repo, card([{ path: "../outside.ts" }])).verify, "stale");
});

// ── Unverified: the evidence moved, or was never pinned ──────────────────────────────────────

test("a file that drifted after the pin reads unverified — resolvable, but must be re-checked", () => {
  const repo = scratchRepo();
  const pinned = repinCitations(repo, [{ path: "limits.ts", symbol: "withinLimit" }]);
  writeFileSync(join(repo, "limits.ts"), "// edited\nexport function withinLimit(n: number) {\n  return n < 10;\n}\n");
  const result = auditCard(repo, card(pinned));
  assert.equal(result.verify, "unverified");
  // Drift is not failure: the citation still resolves, so the check itself passes.
  assert.equal(result.checks[0].ok, true);
});

test("a citation with no pinned sha is unverified — verification is an act, not an assumption", () => {
  const repo = scratchRepo();
  const result = auditCard(repo, card([{ path: "limits.ts" }]));
  assert.equal(result.verify, "unverified");
  assert.equal(result.checks[0].ok, true, "the citation resolves; it has just never been verified");
});

// ── Verified: every pin matches the tree right now ───────────────────────────────────────────

test("repin then audit reads verified — pinning is the act the audit holds the tree to", () => {
  const repo = scratchRepo();
  const pinned = repinCitations(repo, [{ path: "limits.ts", symbol: "withinLimit" }]);
  assert.ok((pinned[0] as CodeCitation).blobSha, "repin stamps the current blob sha");
  assert.equal(auditCard(repo, card(pinned)).verify, "verified");
});

// ── History refs ─────────────────────────────────────────────────────────────────────────────

test("a commit ref is checked for real: present passes, vanished makes the card stale", () => {
  const repo = scratchRepo();
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  assert.equal(checkCitation(repo, { ref: `commit:${sha}` }).ok, true);

  const gone = checkCitation(repo, { ref: `commit:${"0".repeat(40)}` });
  assert.equal(gone.ok, false);
  assert.equal(gone.reason, "commit not found");
  assert.equal(auditCard(repo, card([{ ref: `commit:${"0".repeat(40)}` }])).verify, "stale");
});

test("a pr ref or URL is an honest pass — we do not pretend to verify what we cannot", () => {
  const repo = scratchRepo();
  for (const ref of ["pr:42", "https://example.com/incident-7"]) {
    const check = checkCitation(repo, { ref });
    assert.equal(check.ok, true, ref);
    assert.equal(check.reason, "not locally checkable", ref);
  }
  // The pass neither poisons nor upgrades the audit: a pinned code citation alongside it
  // still decides the reading.
  const pinned = repinCitations(repo, [{ path: "limits.ts" }]);
  assert.equal(auditCard(repo, card([...pinned, { ref: "pr:42" }])).verify, "verified");
});

// ── Re-pinning ───────────────────────────────────────────────────────────────────────────────

test("repin returns copies and never mutates its input — the caller's array may be the live card", () => {
  const repo = scratchRepo();
  const input: Citation[] = [{ path: "limits.ts" }, { ref: "pr:42" }];
  const pinned = repinCitations(repo, input);
  assert.equal((input[0] as CodeCitation).blobSha, undefined, "the original citation is untouched");
  assert.ok((pinned[0] as CodeCitation).blobSha);
  assert.notEqual(pinned[0], input[0]);
  assert.notEqual(pinned[1], input[1]);
});

test("repin leaves an unresolvable citation unstamped — a pin must mean checked-against-this", () => {
  const repo = scratchRepo();
  const pinned = repinCitations(repo, [{ path: "deleted.ts" }, { path: "limits.ts", symbol: "notThere" }]);
  assert.equal((pinned[0] as CodeCitation).blobSha, undefined);
  assert.equal((pinned[1] as CodeCitation).blobSha, undefined);
});

test("a plain directory that is not a git repo still pins and verifies — a worktree is not guaranteed to be a repo", () => {
  const dir = scratchDir();
  writeFileSync(join(dir, "notes.ts"), "export const a = 1;\n");
  const pinned = repinCitations(dir, [{ path: "notes.ts" }]);
  assert.ok((pinned[0] as CodeCitation).blobSha);
  assert.equal(auditCard(dir, card(pinned)).verify, "verified");
});
