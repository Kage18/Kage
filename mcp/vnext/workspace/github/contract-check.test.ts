import test from "node:test";
import assert from "node:assert/strict";

import { verdictFromReport, unavailableVerdict, publishContractCheck } from "./contract-check.js";
import type { MinimalChangeFinding } from "../../policy/types.js";
import type { Fetcher } from "./auth.js";

function finding(overrides: Partial<MinimalChangeFinding> = {}): MinimalChangeFinding {
  return {
    finding_id: "f1",
    kind: "public_api_change" as MinimalChangeFinding["kind"],
    title: "A public contract changed with no decision packet",
    explanation: "…",
    evidence: [],
    deterministic: true,
    severity: "blocking",
    suggested_files: ["mcp/vnext/api/types.ts"],
    ...overrides,
  };
}

test("a deterministic blocking finding fails the check and names what broke", () => {
  const verdict = verdictFromReport({ blocking: [finding()], warnings: [], findings: [finding()] });
  assert.equal(verdict.conclusion, "failure");
  assert.match(verdict.title, /1 contract finding/);
  assert.match(verdict.summary, /public contract changed/);
  assert.match(verdict.summary, /mcp\/vnext\/api\/types\.ts/, "a reviewer needs the file, not just the rule");
});

// The rule that keeps checks worth having. The report marks model-authored suggestions
// `deterministic: false`; a check that fails on an opinion teaches people to ignore checks,
// which is strictly worse than having none.
test("an opinion can never fail a check, even if it arrives in the blocking list", () => {
  const opinion = finding({ finding_id: "f2", deterministic: false, title: "Consider extracting a helper" });
  const verdict = verdictFromReport({ blocking: [opinion], warnings: [], findings: [opinion] });
  assert.notEqual(verdict.conclusion, "failure");
  assert.equal(verdict.conclusion, "success", "with nothing deterministic blocking, the diff passed");
});

test("advisories are neutral, not failure", () => {
  const warning = finding({ finding_id: "f3", severity: "warning", title: "Runbook not updated" });
  const verdict = verdictFromReport({ blocking: [], warnings: [warning], findings: [warning] });
  assert.equal(verdict.conclusion, "neutral");
  assert.match(verdict.summary, /Nothing here blocks the merge/);
  assert.match(verdict.summary, /Runbook not updated/);
});

test("a clean diff passes and says what was actually evaluated", () => {
  const verdict = verdictFromReport({ blocking: [], warnings: [], findings: [] });
  assert.equal(verdict.conclusion, "success");
  assert.match(verdict.summary, /evaluated against the repository model/);
});

// The single most important case: a check that could not run must never be green. A tick that
// silently means "we did not look" is the dishonesty this product exists to remove.
test("a check that could not run is neutral and says it checked NOTHING", () => {
  const verdict = unavailableVerdict("the repository model was unavailable");
  assert.notEqual(verdict.conclusion, "success");
  assert.equal(verdict.conclusion, "neutral");
  assert.match(verdict.summary, /NOT a pass/);
  assert.match(verdict.summary, /repository model was unavailable/);
});

test("a long finding list is truncated with a count, never silently cut", () => {
  const many = Array.from({ length: 14 }, (_, i) => finding({ finding_id: `f${i}`, title: `Break ${i}` }));
  const verdict = verdictFromReport({ blocking: many, warnings: [], findings: many });
  assert.match(verdict.summary, /…and 4 more\./, "the reader must know the list was cut");
});

test("a read-only installation is skipped, never reported as published", async () => {
  let called = false;
  const fetcher: Fetcher = async () => {
    called = true;
    return { ok: true, status: 201, json: async () => ({ id: 1 }) };
  };
  const result = await publishContractCheck({
    installation: { installation_id: "1", owner: "acme", repo: "api", permissions: {} },
    head_sha: "abc123",
    verdict: verdictFromReport({ blocking: [], warnings: [], findings: [] }),
    deps: { apiBaseUrl: "https://api.github.test", token: { token: "t", expires_at: "", permissions: {} }, fetcher },
  });
  assert.deepEqual(result, { status: "skipped_missing_permission" });
  assert.equal(called, false, "a least-privilege install must not attempt the write");
});

test("a granted installation publishes the verdict on the wire", async () => {
  let body: Record<string, unknown> = {};
  const fetcher: Fetcher = async (_url, init) => {
    body = JSON.parse(String((init as { body?: unknown }).body ?? "{}")) as Record<string, unknown>;
    return { ok: true, status: 201, json: async () => ({ id: 7 }) };
  };
  const result = await publishContractCheck({
    installation: { installation_id: "1", owner: "acme", repo: "api", permissions: { checks: "write" } },
    head_sha: "abc123",
    verdict: verdictFromReport({ blocking: [finding()], warnings: [], findings: [finding()] }),
    details_url: "https://kage.test/work/1",
    deps: { apiBaseUrl: "https://api.github.test", token: { token: "t", expires_at: "", permissions: {} }, fetcher },
  });
  assert.deepEqual(result, { status: "published", check_run_id: "7" });
  assert.equal(body.conclusion, "failure");
  assert.equal(body.head_sha, "abc123");
  assert.equal(body.details_url, "https://kage.test/work/1");
  assert.match(String((body.output as { summary?: string }).summary), /public contract changed/);
});
