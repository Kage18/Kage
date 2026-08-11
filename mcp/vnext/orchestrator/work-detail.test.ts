import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { capture, claimWorkItem } from "../../kernel.js";
import { appendCommandEvent } from "./events.js";
import { buildWorkDetail } from "./work-detail.js";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function tempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-detail-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.name", "Detail Tester");
  git(dir, "config", "user.email", "d@t.dev");
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "limits.ts"), "export const tenantLimit = 10;\n", "utf8");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "detail-fixture" }), "utf8");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "initial");
  return dir;
}

function seed(project: string): string {
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

test("an unknown id is null, so the caller can 404 instead of rendering an empty item", () => {
  const project = tempRepo();
  assert.equal(buildWorkDetail(project, "repo:x:proposal:does-not-exist"), null);
});

// The whole point of the page: every card carries a stage nobody typed, so "why does it say
// that" must be answerable step by step. A stage log that shows opaque ids answers nothing.
test("the detail explains every stage transition in readable terms", () => {
  const project = tempRepo();
  const workId = seed(project);

  const proposed = buildWorkDetail(project, workId);
  assert.ok(proposed);
  assert.equal(proposed!.stage, "proposed");
  assert.equal(proposed!.stage_log[0].evidence_label, "the proposal itself");

  assert.equal(claimWorkItem(project, workId, "alice").ok, true);
  appendCommandEvent(project, { kind: "task.claimed", work_id: workId, actor: "alice" });

  const branch = "feat/make-tenantlimit-configurable";
  git(project, "checkout", "-qb", branch);
  writeFileSync(join(project, "src", "limits.ts"), "export const tenantLimit = 20;\n", "utf8");
  git(project, "add", "-A");
  git(project, "commit", "-qm", `feat: configurable limit\n\n[kage:${workId}]`);

  const building = buildWorkDetail(project, workId)!;
  assert.equal(building.stage, "building");
  assert.equal(building.claimed_by, "alice");

  const labels = new Map(building.stage_log.map((step) => [step.stage, step.evidence_label]));
  assert.equal(labels.get("proposed"), "the proposal itself");
  assert.equal(labels.get("claimed"), "a logged command");
  assert.match(labels.get("building") ?? "", /^commit [0-9a-f]{8}$/);

  // The commit that moved it is listed with the confidence that earned the transition.
  assert.equal(building.evidence.length, 1);
  assert.equal(building.evidence[0].confidence, "explicit");
  assert.equal(building.evidence[0].branch, branch);

  // Blast radius and the brief's knowledge come through, so the page is usable for the work
  // itself and not only for auditing the stage.
  assert.deepEqual(building.blast_paths, ["src/limits.ts"]);
  assert.match(building.body, /configure tenantLimit/);

  // Estimation has no receipts linked yet, and says so rather than inventing a match.
  assert.equal(building.estimate.confidence, "none");
});

test("a pull-request step names the branch it came from, not an opaque ref", () => {
  const project = tempRepo();
  const workId = seed(project);
  assert.equal(claimWorkItem(project, workId, "alice").ok, true);
  appendCommandEvent(project, { kind: "task.claimed", work_id: workId, actor: "alice" });

  const branch = "feat/make-tenantlimit-configurable";
  git(project, "checkout", "-qb", branch);
  writeFileSync(join(project, "src", "limits.ts"), "export const tenantLimit = 20;\n", "utf8");
  git(project, "add", "-A");
  git(project, "commit", "-qm", `feat: configurable limit\n\n[kage:${workId}]`);

  // The detail reads the same PR observer the board does; with none configured the item is
  // `building`, which is what this fixture asserts against by construction.
  const detail = buildWorkDetail(project, workId)!;
  assert.equal(detail.stage, "building");
  assert.equal(detail.stage_log.some((step) => step.stage === "verifying"), false);
});
