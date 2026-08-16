import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { forgetProject, projectsRegistryPath, readKnownProjects, rememberProject } from "./delegation/projects.js";

function sandbox(): string {
  const home = mkdtempSync(join(tmpdir(), "kage-projects-"));
  process.env.KAGE_HOME = home;
  return home;
}

function repo(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), `kage-repo-${name}-`));
  mkdirSync(join(dir, ".git"), { recursive: true });
  return dir;
}

test("the registry starts empty and remembering a project is idempotent", () => {
  sandbox();
  assert.deepEqual(readKnownProjects(), []);

  const alpha = repo("alpha");
  rememberProject(alpha);
  rememberProject(alpha);
  const known = readKnownProjects();
  assert.equal(known.length, 1, "remembering twice must not duplicate the row");
  assert.equal(known[0].dir, alpha);
  assert.ok(known[0].name.startsWith("kage-repo-alpha"));
});

test("most recently opened sorts first", () => {
  sandbox();
  const alpha = repo("alpha");
  const beta = repo("beta");
  rememberProject(alpha);
  rememberProject(beta);
  assert.equal(readKnownProjects()[0].dir, beta);
  rememberProject(alpha);
  assert.equal(readKnownProjects()[0].dir, alpha, "re-opening moves a project back to the top");
});

test("a project whose directory is gone drops out of the list", () => {
  sandbox();
  const alpha = repo("alpha");
  const beta = repo("beta");
  rememberProject(alpha);
  rememberProject(beta);
  rmSync(beta, { recursive: true, force: true });
  const known = readKnownProjects();
  assert.equal(known.length, 1);
  assert.equal(known[0].dir, alpha, "a deleted or moved repo must not haunt the sidebar");
});

test("forgetting removes the row and never touches the repo", () => {
  sandbox();
  const alpha = repo("alpha");
  rememberProject(alpha);
  const left = forgetProject(alpha);
  assert.deepEqual(left, []);
  // The point of the assertion: forget is a list operation, not a delete.
  assert.deepEqual(readKnownProjects(), []);
  assert.ok(existsSync(join(alpha, ".git")), "the repo survives being forgotten");
});

test("a corrupt registry reads as empty rather than throwing", () => {
  const home = sandbox();
  mkdirSync(home, { recursive: true });
  writeFileSync(projectsRegistryPath(), "{ not json at all", "utf8");
  assert.deepEqual(readKnownProjects(), [], "a damaged convenience file must never break the app");
  // And it must be recoverable by simply writing again.
  const alpha = repo("alpha");
  rememberProject(alpha);
  assert.equal(readKnownProjects().length, 1);
});
