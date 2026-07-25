import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { capture, evaluateMemoryAdmission, hasRationaleLanguage } from "./kernel.js";
import type { MemoryPacket } from "./kernel.js";

// T2 — derivability-aware capture scoring.
//
// The live reuse A/B measured the core truth: memory adds ~ZERO value when the fact is derivable
// from the code (the agent just reads the code) and is transformative when it is not. The store
// audit confirmed it in usage: reference dumps measure 0.00 uses/packet and code explanations 0.12,
// while rationale/gotcha/ops knowledge carries all the demand. Admission therefore:
//   - PENALIZES a packet whose body merely RESTATES what its cited code already says
//     (high term containment in the cited files, no rationale/trigger language);
//   - BOOSTS knowledge the code cannot express (dead ends, rejected alternatives,
//     external-system quirks).

function projectWithFile(relPath: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-deriv-"));
  mkdirSync(join(dir, ".agent_memory", "packets"), { recursive: true });
  const filePath = join(dir, relPath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
  return dir;
}

const RETRY_SOURCE = [
  "// retry helper: exponential backoff with jitter",
  "export function retryWithBackoff(fn, attempts = 5) {",
  "  let delay = 100;",
  "  for (let attempt = 1; attempt <= attempts; attempt += 1) {",
  "    try { return fn(); } catch (error) {",
  "      if (attempt === attempts) throw error;",
  "      sleep(delay + Math.random() * 50);",
  "      delay *= 2;",
  "    }",
  "  }",
  "}",
].join("\n");

function packetShell(overrides: Partial<MemoryPacket>): MemoryPacket {
  const shell = {
    schema_version: 2,
    id: "repo:test:deriv",
    title: "t",
    summary: "s",
    body: "b",
    type: "code_explanation",
    scope: "repo",
    visibility: "team",
    sensitivity: "internal",
    status: "pending",
    confidence: 0.5,
    tags: [],
    paths: [],
    stack: [],
    source_refs: [{ kind: "explicit_capture", captured_at: "2026-07-21T00:00:00.000Z" }],
    context: {},
    freshness: { ttl_days: 365, last_verified_at: "2026-07-21T00:00:00.000Z", path_fingerprints: [] },
    edges: [],
    quality: {},
    created_at: "2026-07-21T00:00:00.000Z",
    updated_at: "2026-07-21T00:00:00.000Z",
  };
  return { ...shell, ...overrides } as unknown as MemoryPacket;
}

test("a code explanation that merely restates its cited code is penalized as derivable", () => {
  const dir = projectWithFile("src/retry.ts", RETRY_SOURCE);
  const restating = packetShell({
    type: "code_explanation",
    title: "retryWithBackoff retries with exponential backoff",
    summary: "The retry helper",
    // Restates the code: same identifiers, same mechanics, zero knowledge beyond the file.
    body: "retryWithBackoff retries fn up to attempts times with exponential backoff delay starting at 100 and doubling each attempt, with jitter via Math.random, throwing the error on the final attempt.",
    paths: ["src/retry.ts"],
  });
  const verdict = evaluateMemoryAdmission(dir, restating);
  assert.ok(
    verdict.risks.some((risk) => /derivable|restates/i.test(risk)),
    `expected a derivable-restatement risk; got ${JSON.stringify(verdict.risks)}`,
  );
  assert.ok(verdict.score < 45, `derivable restatement must not auto-admit (score ${verdict.score})`);
});

test("the same citation with rationale the code cannot express is NOT penalized", () => {
  const dir = projectWithFile("src/retry.ts", RETRY_SOURCE);
  const rationale = packetShell({
    type: "decision",
    title: "Retry uses jittered exponential backoff because the upstream rate limiter is bursty",
    summary: "Why the retry shape is what it is",
    body: "We chose jittered exponential backoff instead of fixed-interval retries because the upstream payment API rate-limits in 10s windows; synchronized retries stampeded it in the 2026-03 incident. Fixed intervals were rejected after reproducing the stampede in staging. Verified by: incident postmortem replay.",
    paths: ["src/retry.ts"],
  });
  const verdict = evaluateMemoryAdmission(dir, rationale);
  assert.ok(
    !verdict.risks.some((risk) => /derivable|restates/i.test(risk)),
    `rationale must not be flagged derivable; got ${JSON.stringify(verdict.risks)}`,
  );
  assert.ok(verdict.admit, `rationale-bearing decision must admit (score ${verdict.score})`);
});

test("knowledge the code cannot express gets the non-derivable boost", () => {
  const dir = mkdtempSync(join(tmpdir(), "kage-deriv-b-"));
  mkdirSync(join(dir, ".agent_memory", "packets"), { recursive: true });
  const gotcha = packetShell({
    type: "gotcha",
    title: "Stripe webhooks re-deliver aggressively behind our proxy",
    summary: "External quirk",
    body: "Stripe re-delivers webhooks for up to 3 days when our proxy returns 502s during deploys; dedupe by event id or refunds double-apply. Discovered after the 2026-05 incident; reproduced by replaying delivery logs.",
    paths: [],
  });
  const verdict = evaluateMemoryAdmission(dir, gotcha);
  assert.ok(
    verdict.reasons.some((reason) => /code cannot express|non-derivable/i.test(reason)),
    `expected the non-derivable boost reason; got ${JSON.stringify(verdict.reasons)}`,
  );
});

test("capture routes a derivable restatement away from auto-approval", () => {
  const dir = projectWithFile("src/retry.ts", RETRY_SOURCE);
  const result = capture({
    projectDir: dir,
    type: "code_explanation",
    title: "retryWithBackoff retries with exponential backoff",
    summary: "The retry helper",
    body: "retryWithBackoff retries fn up to attempts times with exponential backoff delay starting at 100 and doubling each attempt, with jitter via Math.random, throwing the error on the final attempt.",
    paths: ["src/retry.ts"],
  }) as unknown as { packet?: { status?: string } };
  const status = result.packet?.status ?? "unknown";
  assert.notEqual(status, "approved", `a derivable restatement must not auto-approve (status ${status})`);
});

// ── The guard that disabled the gate, and the type exemption that made it safe ────────────────
//
// Measured on a 228-packet store: the restatement check was reached by only 7% of packets, because
// the language guard exempting a body from the check matched `when|after|before|fix|issue|must` —
// words in almost any technical prose (top offenders: `fix` 59, `when` 40, `must` 16, `after` 14).
// The gate existed and was effectively off.
//
// Narrowing that guard to real rationale markers raised its reach to 35.5%, but then flagged 74
// packets as restatements — and 56 were `decision`, the highest-value type. A decision necessarily
// quotes the thing it decided about, so term overlap is not evidence of restatement for it. Types
// whose whole purpose is knowledge the code cannot state are therefore exempt BY TYPE, which brought
// the flagged set to 18/228 (7.9%) — all of them types that describe code.

test("the rationale guard matches cause and contrast, not bare temporal or bug words", () => {
  // This predicate decides whether the derivable-restatement check runs at all, so its precision IS
  // the gate. Tested directly rather than through a packet fixture: the check's containment threshold
  // sits close enough to real bodies that changing a word also changes containment, so an end-to-end
  // assertion would move two variables at once and prove nothing.
  //
  // Every string below used to return true. Measured consequence: 88.6% of a 228-packet store matched,
  // so the check it guards ran on only 7% of packets — the gate existed and was off.
  for (const bland of [
    "The handler runs when the queue drains.",
    "Restart the daemon after the migration.",
    "Validate the payload before writing.",
    "This is the fix for the upload issue.",
    "The policy must be applied to every request.",
    "A decision was recorded for the convention.",
  ]) {
    assert.equal(hasRationaleLanguage(bland), false, `must not count as rationale: ${bland}`);
  }

  // Genuine rationale — cause, contrast, rejected paths, invariants — must still exempt a body.
  for (const reasoned of [
    "We batch writes because the gateway rate-limits per connection.",
    "Absolute base instead of relative, which breaks at depth.",
    "Chose polling rather than webhooks for the firewall case.",
    "The root cause was a stale fingerprint.",
    "Must not run twice; the migration is not idempotent.",
    "Avoid the shared client: it is a known gotcha.",
    "Turns out the SDK retries internally.",
  ]) {
    assert.equal(hasRationaleLanguage(reasoned), true, `must count as rationale: ${reasoned}`);
  }
});

test("a decision is never penalized as a restatement, even quoting the code it decided about", () => {
  // REGRESSION: this is the false-positive storm the type exemption prevents — 56 of 74 flags.
  const dir = projectWithFile("src/retry.ts", RETRY_SOURCE);
  const admission = evaluateMemoryAdmission(dir, packetShell({
    type: "decision",
    title: "Exponential backoff over fixed delay",
    body: "We use retryWithBackoff with exponential delay and jitter rather than a fixed delay, since a fixed delay synchronised every client into the same retry window during an outage.",
    paths: ["src/retry.ts"],
  }));
  assert.ok(
    !admission.risks.some((r) => r.includes("restates what the cited code already says")),
    `a decision must never be flagged derivable; risks=${JSON.stringify(admission.risks)}`,
  );
});

test("rationale, constraint, and issue_context are exempt by type alongside gotcha", () => {
  const dir = projectWithFile("src/retry.ts", RETRY_SOURCE);
  for (const type of ["rationale", "constraint", "issue_context", "gotcha", "negative_result"]) {
    const admission = evaluateMemoryAdmission(dir, packetShell({
      type: type as MemoryPacket["type"],
      title: "retryWithBackoff attempts delay jitter",
      // Deliberately near-verbatim vocabulary from the cited source.
      body: "retryWithBackoff loops attempts times, doubles delay, and adds random jitter before sleeping.",
      paths: ["src/retry.ts"],
    }));
    assert.ok(
      !admission.risks.some((r) => r.includes("restates what the cited code already says")),
      `${type} must be exempt by type; risks=${JSON.stringify(admission.risks)}`,
    );
  }
});
