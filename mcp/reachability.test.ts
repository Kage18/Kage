// Tests for the reachability check (delegation/reachability.ts) — kept out of
// delegation.test.ts deliberately: that file is a merge-conflict hotspot (every run
// appends to its end; three merges collided there in one day), so a new, independently
// growable surface gets its own file.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findOrphans } from "./delegation/reachability.js";
import { createRun, runDir, transitionRun } from "./delegation/contract.js";
import { dispatchRun } from "./delegation/dispatch.js";
import { superviseRun } from "./delegation/supervisor.js";
import { stubAdapter } from "./delegation/adapters/stub.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-reachability-"));
}

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

// A real git repo with a real (trivial) test command — the substrate the wiring tests
// dispatch real runs against. Deliberately has no mcp/ tree: the reachability check must
// no-op cleanly (still emitting its check, never a fail) on a repo shaped nothing like
// this one.
function tempGitProject(): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

function write(dir: string, relPath: string, content: string): void {
  const full = join(dir, relPath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

test("RULE A: an export referenced only by a test file is reported as an orphan", () => {
  const dir = tempProject();
  write(dir, "mcp/cli.ts", "export function main() {}\n");
  write(dir, "mcp/foo.ts", "export function helperOnly() {\n  return 1;\n}\n");
  write(dir, "mcp/foo.test.ts", 'import { helperOnly } from "./foo.js";\nhelperOnly();\n');

  const findings = findOrphans(dir, ["mcp/foo.ts"]);
  const finding = findings.find((f) => f.symbol === "helperOnly");
  assert.ok(finding, "an export only ever called from a test is an orphan — nothing in production reaches it");
  assert.equal(finding?.rule, "orphan-export");
  assert.match(finding!.detail, /test file/);
});

test("RULE A: an export reachable from cli.ts is not reported", () => {
  const dir = tempProject();
  write(dir, "mcp/foo.ts", "export function helperUsed() {\n  return 2;\n}\n");
  write(dir, "mcp/cli.ts", 'import { helperUsed } from "./foo.js";\nhelperUsed();\n');

  const findings = findOrphans(dir, ["mcp/foo.ts"]);
  assert.equal(
    findings.find((f) => f.symbol === "helperUsed"),
    undefined,
    "a real reference from a root file (cli.ts) makes the export reachable",
  );
});

test("RULE A: an export reachable only via another orphan is reported too (the transitive case)", () => {
  const dir = tempProject();
  write(dir, "mcp/cli.ts", "export function main() {}\n");
  write(
    dir,
    "mcp/chain.ts",
    ["export function orphanEntry() {", "  return orphanLeaf();", "}", "", "export function orphanLeaf() {", "  return 42;", "}", ""].join(
      "\n",
    ),
  );

  const findings = findOrphans(dir, ["mcp/chain.ts"]);
  const entry = findings.find((f) => f.symbol === "orphanEntry");
  const leaf = findings.find((f) => f.symbol === "orphanLeaf");
  assert.ok(entry, "orphanEntry has no root caller — it is an orphan itself");
  assert.ok(leaf, "orphanLeaf's only caller (orphanEntry) is itself unreachable, so leaf stays an orphan transitively");
  assert.match(leaf!.detail, /unreachable/);
});

test("RULE B: a field with a reader and no non-test writer is reported", () => {
  const dir = tempProject();
  write(dir, "mcp/cli.ts", "export function main() {}\n");
  write(dir, "mcp/record.ts", ["export interface RecordX {", "  supervisor_pid?: number;", "}", ""].join("\n"));
  write(dir, "mcp/reader.ts", ["export function readIt(x) {", "  return x.supervisor_pid;", "}", ""].join("\n"));

  const findings = findOrphans(dir, ["mcp/record.ts"]);
  const finding = findings.find((f) => f.symbol === "supervisor_pid");
  assert.ok(finding, "a field read somewhere but never written outside its own declaration is reported");
  assert.equal(finding?.rule, "read-only-field");
});

test("RULE B: a field with a non-test writer and no reader is reported", () => {
  const dir = tempProject();
  write(dir, "mcp/cli.ts", "export function main() {}\n");
  write(dir, "mcp/record2.ts", ["export interface RecordY {", "  agent_pid?: number;", "}", ""].join("\n"));
  write(dir, "mcp/writer.ts", ["export function patchIt(x, pid) {", "  patch(x, { agent_pid: pid });", "}", "function patch(a, b) {}", ""].join("\n"));

  const findings = findOrphans(dir, ["mcp/record2.ts"]);
  const finding = findings.find((f) => f.symbol === "agent_pid");
  assert.ok(finding, "a field written somewhere but never read outside its own declaration is reported");
  assert.equal(finding?.rule, "write-only-field");
});

test("ESCAPE HATCH: '// reachability: <reason>' exempts an otherwise-orphaned export", () => {
  const dir = tempProject();
  write(dir, "mcp/cli.ts", "export function main() {}\n");
  write(
    dir,
    "mcp/api-surface.ts",
    ["// reachability: deliberate public API, consumed by external callers of the package", "export function publicHelper() {", "  return 1;", "}", ""].join(
      "\n",
    ),
  );

  const findings = findOrphans(dir, ["mcp/api-surface.ts"]);
  assert.equal(
    findings.find((f) => f.symbol === "publicHelper"),
    undefined,
    "a marker with a written reason exempts the symbol",
  );
});

test("ESCAPE HATCH: an unexplained '// reachability:' marker does not exempt", () => {
  const dir = tempProject();
  write(dir, "mcp/cli.ts", "export function main() {}\n");
  write(
    dir,
    "mcp/api-surface2.ts",
    ["// reachability:", "export function unexplainedHelper() {", "  return 1;", "}", ""].join("\n"),
  );

  const findings = findOrphans(dir, ["mcp/api-surface2.ts"]);
  const finding = findings.find((f) => f.symbol === "unexplainedHelper");
  assert.ok(finding, "a marker with no written reason must not exempt — an unexplained exemption is how this rot returns");
});

test("both executeRun (foreground) and superviseRun (detached) run the reachability check", async () => {
  const project = tempGitProject();

  const { claim: dispatchedClaim } = await dispatchRun(project, { intent: "wiring check A", type: "chore" }, stubAdapter());
  assert.ok(dispatchedClaim, "a real stub run must produce a claim");
  assert.ok(
    dispatchedClaim?.checks.some((check) => check.id === "reachability"),
    "executeRun (dispatch.ts) must run the kernel-executed reachability check",
  );

  const task = createRun(project, { intent: "wiring check B", type: "chore", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  await superviseRun(project, task.id);
  const claim = JSON.parse(readFileSync(join(runDir(project, task.id), "claim.json"), "utf8")) as {
    checks: Array<{ id: string }>;
  };
  assert.ok(
    claim.checks.some((check) => check.id === "reachability"),
    "superviseRun (supervisor.ts) must run the same kernel-executed reachability check",
  );
});

test("the reachability check never fails a run, even with findings — result is always 'pass'", () => {
  const dir = tempProject();
  write(dir, "mcp/cli.ts", "export function main() {}\n");
  write(dir, "mcp/dead.ts", "export function neverCalled() {\n  return 1;\n}\n");
  const findings = findOrphans(dir, ["mcp/dead.ts"]);
  assert.ok(findings.length > 0, "fixture must actually produce a finding for this assertion to mean anything");
});

test("SELF-TEST: findOrphans against this repo's own delegation/goal.ts", () => {
  // __dirname at runtime is mcp/dist (the compiled location of this test file) —
  // two levels up is the repo root, whose mcp/ subtree findOrphans expects.
  const repoRoot = join(__dirname, "..", "..");
  const findings = findOrphans(repoRoot, ["mcp/delegation/goal.ts"]);
  // eslint-disable-next-line no-console
  console.log("SELF-TEST findOrphans(goal.ts) findings:", JSON.stringify(findings, null, 2));
  assert.ok(Array.isArray(findings), "findOrphans must return an array even against the real repo tree");
});
