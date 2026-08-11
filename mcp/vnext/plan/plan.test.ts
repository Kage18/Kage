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

// Titles a human reads in a queue. Both of these shipped, and both showed up on the board
// when this repo planned its own work: a work item titled "… — ." (the cluster for
// root-level files), and an intent cut mid-word to "…one writer for stage d", which reads
// as a typo rather than as a truncation.
test("planned titles name their cluster and never truncate mid-word", () => {
  const project = tempRepo();
  // Ground the intent to a ROOT-level file so the bare-dot cluster is exercised.
  assert.equal(capture({
    projectDir: project,
    type: "decision",
    title: "The package manifest pins the supported Node range",
    body: "package.json pins the supported Node range because the sqlite bindings differ across majors.",
    paths: ["package.json"],
  }).ok, true);
  assert.equal(capture({
    projectDir: project,
    type: "decision",
    title: "Limits live in src and are read by the settings page",
    body: "src/limits.ts holds the tenant limit and web/settings.tsx reads it, so both move together.",
    paths: ["src/limits.ts"],
  }).ok, true);

  const intent =
    "Close the orchestrator P0 truth loop: one writer for stage decisions, merge and PR derived stages, and a Proof surface";
  const plan = planIntent(project, intent);
  assert.equal(plan.ok, true, plan.errors.join("; "));

  for (const item of plan.items) {
    assert.ok(!item.title.endsWith(" — ."), `a cluster must be named, got "${item.title}"`);
    // The exact regression: "…one writer for stage decisions" cut to "…stage d".
    assert.ok(!/stage d\b(?!ecisions)/.test(item.title), `title was cut mid-word: "${item.title}"`);
    // Any truncation ends at a word boundary and says it happened.
    if (item.title.includes("…")) {
      const head = item.title.slice(0, item.title.indexOf("…"));
      assert.ok(head.endsWith(" ") === false, "no trailing space before the ellipsis");
      assert.ok(intent.startsWith(head), `truncated title must be a prefix of the intent: "${head}"`);
      assert.ok(
        intent[head.length] === " " || intent.length === head.length,
        `truncation must land on a word boundary, got "${head}"`,
      );
    }
  }
});
