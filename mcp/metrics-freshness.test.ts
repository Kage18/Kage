// metrics.json backs the app's Memory-tab health strip. Until now it was written only
// by `kage gc` and `kage compact` — maintenance commands a normal user never runs — so
// it froze indefinitely while `kage refresh`'s own help text claimed to rebuild it.
// These tests pin refreshProject to actually writing (and re-writing) that file.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { capture, memoryRoot, refreshProject } from "./kernel.js";

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-metrics-test-"));
  mkdirSync(join(dir, ".agent_memory", "nodes"), { recursive: true });
  return dir;
}

const gitIdentityEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function commitAll(project: string, message: string): void {
  execFileSync("git", ["add", "."], { cwd: project, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", message], { cwd: project, stdio: "ignore", env: gitIdentityEnv });
}

function metricsPath(project: string): string {
  return join(memoryRoot(project), "metrics.json");
}

function readMetrics(project: string): Record<string, any> {
  return JSON.parse(readFileSync(metricsPath(project), "utf8"));
}

// Reverting the fix (removing the writeJson call added to refreshProject) makes this
// fail: metrics.json would never be created by a plain refresh.
test("refreshProject writes metrics.json where none existed", () => {
  const project = tempProject();
  execFileSync("git", ["init"], { cwd: project, stdio: "ignore" });
  capture({
    projectDir: project,
    title: "Runbook for the deploy script",
    body: "Run npm run deploy after tagging a release. Verified by watching the deploy log.",
    type: "runbook",
  });

  assert.equal(existsSync(metricsPath(project)), false);
  const result = refreshProject(project);
  assert.equal(result.ok, true);
  assert.equal(existsSync(metricsPath(project)), true);

  const metrics = readMetrics(project);
  assert.equal(metrics.schema_version, 1);
  assert.equal(typeof metrics.generated_at, "string");
  assert.ok(metrics.code_graph);
});

// Reverting the fix makes this fail: generated_at would stay pinned at whatever an
// earlier `kage gc`/`kage compact` last wrote, however old.
test("refreshProject updates an existing metrics.json instead of leaving it frozen", () => {
  const project = tempProject();
  execFileSync("git", ["init"], { cwd: project, stdio: "ignore" });
  capture({ projectDir: project, title: "Seed memory", body: "Seed body text for the packet store.", type: "decision" });

  refreshProject(project);
  const frozenTimestamp = "2020-01-01T00:00:00.000Z";
  const frozen = readMetrics(project);
  writeFileSync(metricsPath(project), JSON.stringify({ ...frozen, generated_at: frozenTimestamp }, null, 2), "utf8");
  assert.equal(readMetrics(project).generated_at, frozenTimestamp);

  refreshProject(project);
  const refreshed = readMetrics(project);
  assert.notEqual(refreshed.generated_at, frozenTimestamp);
  assert.ok(new Date(refreshed.generated_at).getTime() > new Date(frozenTimestamp).getTime());
});

// Reverting the fix makes this fail: approved_packets on disk would stay at whatever
// count was true the last time `kage gc`/`kage compact` ran, not the live packet store.
test("refreshProject's written totals track a live count of the packet store", () => {
  const project = tempProject();
  execFileSync("git", ["init"], { cwd: project, stdio: "ignore" });
  capture({ projectDir: project, title: "First memory", body: "First packet body text for the store.", type: "decision", allowLowQuality: true });

  refreshProject(project);
  const first = readMetrics(project);
  assert.equal(first.memory_graph.approved_packets, 1);

  capture({ projectDir: project, title: "Second memory", body: "Second packet body text for the store.", type: "decision", allowLowQuality: true });
  refreshProject(project);
  const second = readMetrics(project);
  assert.equal(second.memory_graph.approved_packets, 2);
});

// Reverting the fix makes this fail: on a feature branch metrics.json would never be
// written at all (refreshProject never wrote it, quiet or not), so the health strip
// would stay frozen on exactly the branches where work actually happens day to day.
// Packet metadata staying byte-identical on the quiet path is existing, unrelated
// behavior (covered elsewhere) — asserted here only to confirm this fix does not
// disturb it.
test("a quiet (non-default-branch) refresh still updates metrics.json", () => {
  const project = tempProject();
  execFileSync("git", ["init"], { cwd: project, stdio: "ignore" });
  execFileSync("git", ["symbolic-ref", "HEAD", "refs/heads/main"], { cwd: project, stdio: "ignore" });
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "node --test" } }), "utf8");
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "server.ts"), "export function createApp() { return {}; }\n", "utf8");
  const captured = capture({
    projectDir: project,
    title: "Server setup convention",
    body: "createApp owns middleware setup. Verified by: npm test",
    type: "decision",
    paths: ["src/server.ts"],
  });
  assert.equal(captured.ok, true);
  commitAll(project, "seed");

  execFileSync("git", ["checkout", "-b", "feature/quiet"], { cwd: project, stdio: "ignore" });
  writeFileSync(join(project, "src", "server.ts"), "export function createApp() { return { changed: true }; }\n", "utf8");
  const packetBefore = readFileSync(captured.path!, "utf8");

  const result = refreshProject(project);
  assert.equal(result.quiet_refresh, true);
  // Packet metadata is untouched on a quiet refresh (unrelated, pre-existing behavior)...
  assert.equal(readFileSync(captured.path!, "utf8"), packetBefore);
  // ...but the derived metrics report is not packet metadata, and must still update.
  assert.equal(existsSync(metricsPath(project)), true);
  const metrics = readMetrics(project);
  assert.equal(metrics.quality.totals.stale, 1);
});
