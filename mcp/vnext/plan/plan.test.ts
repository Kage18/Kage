import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { capture } from "../../kernel.js";
import { planIntent } from "./plan.js";
import { deriveWorkState } from "../orchestrator/derive.js";

function tempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-plan-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Plan Tester"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "p@t.dev"], { cwd: dir });
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "web"), { recursive: true });
  writeFileSync(join(dir, "src", "limits.ts"), "export const tenantLimit = 10;\n", "utf8");
  writeFileSync(join(dir, "web", "settings.tsx"), "export const SettingsPage = () => null;\n", "utf8");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "plan-fixture" }), "utf8");
  return dir;
}

test("an intent becomes grounded work items, clustered by repo area, with bearing memory surfaced", () => {
  const project = tempRepo();
  // The team's prior knowledge — this is what must surface at PLAN time.
  assert.equal(capture({
    projectDir: project,
    type: "decision",
    title: "tenantLimit is 10 because the billing tier caps it",
    body: "We set tenantLimit to 10 because the starter billing tier caps concurrent tenants there; raising it needs a billing change first.",
    paths: ["src/limits.ts"],
  }).ok, true);
  assert.equal(capture({
    projectDir: project,
    type: "gotcha",
    title: "Settings page caches tenant config aggressively",
    body: "The settings page caches tenant config for 10 minutes, so limit changes appear delayed unless the cache is invalidated on write.",
    paths: ["web/settings.tsx"],
  }).ok, true);

  const plan = planIntent(project, "Let each tenant configure their own tenantLimit from the settings page");
  assert.equal(plan.ok, true, plan.errors.join("; "));

  // Prior decisions surfaced before any work starts — the whole point of planning here.
  assert.ok(plan.bearing_memory.some((entry) => /billing tier caps/.test(entry.title)));

  // Two repo areas grounded → two work items, each carrying its own paths.
  assert.equal(plan.items.length, 2);
  const areas = plan.items.map((item) => item.paths[0]?.split("/")[0]).sort();
  assert.deepEqual(areas, ["src", "web"]);

  // Estimates refuse to invent numbers with no receipt history.
  for (const item of plan.items) assert.equal(item.estimate.confidence, "none");

  // The planned items land on the derived board immediately, claimable like any work.
  const board = deriveWorkState(project);
  for (const item of plan.items) {
    const derived = board.items.find((entry) => entry.work_id === item.work_id);
    assert.ok(derived, `planned item ${item.work_id} must appear on the board`);
    assert.equal(derived!.derived_stage, "proposed");
  }
});

test("a bare phrase is refused with guidance, not planned into junk", () => {
  const project = tempRepo();
  const plan = planIntent(project, "fix limits");
  assert.equal(plan.ok, false);
  assert.match(plan.errors[0], /sentence/);
});
