import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildNpmReleasePlan, parseReleaseArgs } from "./release.js";

test("release args default to a dry run unless publish is explicit", () => {
  assert.deepEqual(parseReleaseArgs([]), {
    publish: false,
    push: false,
    smoke: false,
    cache: "/private/tmp/kage-npm-cache",
  });
  assert.deepEqual(parseReleaseArgs(["--publish", "--push", "--smoke", "--cache", "/tmp/npm-cache"]), {
    publish: true,
    push: true,
    smoke: true,
    cache: "/tmp/npm-cache",
  });
});

test("npm release plan preflights remote state and pushes before publish", () => {
  const plan = buildNpmReleasePlan({
    branch: "master",
    packageName: "@kage-core/kage-graph-mcp",
    version: "1.1.15",
    publish: true,
    push: true,
    smoke: true,
    cache: "/tmp/kage-cache",
  });
  const names = plan.map((step) => step.name);

  assert.deepEqual(names.slice(0, 5), [
    "ensure clean worktree",
    "fetch remote branch",
    "ensure branch contains remote",
    "run package tests",
    "pack dry run",
  ]);
  assert.equal(names.indexOf("push branch") < names.indexOf("publish package"), true);
  assert.equal(names.includes("verify npm version"), true);
  assert.equal(names.includes("smoke install published package"), true);
  assert.equal(plan.find((step) => step.name === "verify npm version")?.retries, 10);
  assert.equal(plan.find((step) => step.name === "verify npm version")?.retryDelayMs, 3000);

  const gitSteps = plan.filter((step) => step.command === "git");
  assert.equal(gitSteps.every((step) => step.env?.GIT_EDITOR === "true"), true);
  assert.deepEqual(plan.find((step) => step.name === "ensure branch contains remote")?.args, [
    "merge-base",
    "--is-ancestor",
    "origin/master",
    "HEAD",
  ]);
  assert.deepEqual(plan.find((step) => step.name === "publish package")?.args, [
    "--cache",
    "/tmp/kage-cache",
    "publish",
    "--access",
    "public",
  ]);
});

// Distribution manifests drifted three minor versions behind npm before this guard
// existed (plugin 2.5.5/2.0.1, server.json 2.3.3 vs package 3.1.0). Lockstep or fail.
test("distribution manifests stay in version lockstep with the npm package", () => {
  const version = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
  const manifests = ["../server.json", "../plugin/.claude-plugin/plugin.json", "../plugin/.codex-plugin/plugin.json"];
  for (const path of manifests) {
    const manifest = JSON.parse(readFileSync(path, "utf8")) as { version?: string; packages?: Array<{ version?: string }> };
    assert.equal(manifest.version, version, `${path} version must match package.json (${version})`);
    for (const pkg of manifest.packages ?? []) {
      assert.equal(pkg.version, version, `${path} packages[].version must match package.json (${version})`);
    }
  }
});

test("maintainer release helper is not exposed in public package metadata", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    files?: string[];
    scripts?: Record<string, string>;
  };

  assert.equal(pkg.scripts?.["release:npm"], undefined);
  assert.equal(pkg.scripts?.["release:npm:dry-run"], undefined);
  assert.equal(pkg.files?.includes("!dist/release.js"), true);
});
