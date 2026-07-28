import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { capture, claimWorkItem } from "../../kernel.js";
import { appendCommandEvent } from "./events.js";
import { buildProof } from "./proof.js";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function tempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-proof-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.name", "Proof Tester");
  git(dir, "config", "user.email", "p@t.dev");
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "limits.ts"), "export const tenantLimit = 10;\n", "utf8");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "initial");
  return dir;
}

function seedWorkItem(project: string): string {
  const result = capture({
    projectDir: project,
    type: "proposal",
    title: "Make tenantLimit configurable",
    body: "We should let each tenant configure tenantLimit so high-volume tenants can tune it themselves.",
    paths: ["src/limits.ts"],
  });
  assert.equal(result.ok, true);
  return result.packet!.id;
}

function metric(project: string, id: string) {
  const found = buildProof(project).metrics.find((entry) => entry.id === id);
  assert.ok(found, `expected a metric named ${id}`);
  return found!;
}

// ── The honesty rule ────────────────────────────────────────────────────────
// This is the page a team renews on, so an unmeasured number must read as unmeasured.
// A zero standing in for "we never observed this" is the single failure mode that would
// make the whole surface untrustworthy.

test("an unmeasured metric is null and says what would unlock it — never a zero", () => {
  const project = tempRepo();
  seedWorkItem(project);

  for (const id of ["cycle_time_median", "recalls_served", "rework_prevented", "tokens_saved"]) {
    const entry = metric(project, id);
    assert.equal(entry.value, null, `${id} was never measured and must not report a number`);
    assert.ok(entry.unlock && entry.unlock.length > 0, `${id} must say how to make it measurable`);
  }

  // Every metric, measured or not, states how it is computed. No unauditable numbers.
  for (const entry of buildProof(project).metrics) {
    assert.ok(entry.formula.length > 0, `${entry.id} must carry its formula`);
  }
});

test("estimate accuracy stays null while receipts are unlinked, and says so", () => {
  const project = tempRepo();
  const entry = metric(project, "estimate_accuracy");
  assert.equal(entry.value, null);
  assert.match(entry.unlock ?? "", /receipt/i, "the unlock must name the actual blocker");
});

// ── Cycle time ──────────────────────────────────────────────────────────────

test("cycle time is measured only when both ends were observed", () => {
  const project = tempRepo();
  const workId = seedWorkItem(project);

  // Claimed but not shipped: one end observed, so there is no cycle time yet.
  assert.equal(claimWorkItem(project, workId, "alice").ok, true);
  appendCommandEvent(project, { kind: "task.claimed", work_id: workId, actor: "alice" });
  assert.equal(metric(project, "cycle_time_median").value, null, "an in-flight item has no cycle time");
  assert.equal(buildProof(project).cycle_times.length, 0);

  // Ship it. Merging closes the loop, so both ends are now observed.
  git(project, "checkout", "-qb", "feat/make-tenantlimit-configurable");
  writeFileSync(join(project, "src", "limits.ts"), "export const tenantLimit = 20;\n", "utf8");
  git(project, "add", "-A");
  git(project, "commit", "-qm", `feat: configurable limit\n\n[kage:${workId}]`);
  git(project, "checkout", "-q", "main");
  git(project, "merge", "-q", "--no-ff", "-m", "merge limit work", "feat/make-tenantlimit-configurable");

  const report = buildProof(project);
  const cycle = report.metrics.find((entry) => entry.id === "cycle_time_median")!;
  assert.equal(typeof cycle.value, "number", "a shipped item makes cycle time measurable");
  assert.ok(cycle.value! >= 0);
  assert.equal(cycle.unlock, undefined, "a measured metric carries no unlock prompt");

  assert.equal(report.cycle_times.length, 1);
  assert.equal(report.cycle_times[0].work_id, workId);
  assert.equal(report.metrics.find((entry) => entry.id === "items_shipped")!.value, 1);
});
