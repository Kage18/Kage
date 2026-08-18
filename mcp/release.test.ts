import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  const manifests = [
    "../server.json",
    "../plugin/.claude-plugin/plugin.json",
    "../plugin/.codex-plugin/plugin.json",
    "../shell/package.json",
  ];
  for (const path of manifests) {
    const manifest = JSON.parse(readFileSync(path, "utf8")) as { version?: string; packages?: Array<{ version?: string }> };
    assert.equal(manifest.version, version, `${path} version must match package.json (${version})`);
    for (const pkg of manifest.packages ?? []) {
      assert.equal(pkg.version, version, `${path} packages[].version must match package.json (${version})`);
    }
  }
});

test("node-pty is an optional dependency, not a hard one", () => {
  // node-pty's install falls back to compiling with node-gyp when no prebuilt binary
  // is available (offline, a proxy, an unsupported platform/arch); as a hard dependency
  // that failure takes down the whole `npm i -g`, even though only the terminal views
  // need a pty. As an optional dependency, npm treats a failed install as non-fatal.
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };

  assert.equal(pkg.dependencies?.["node-pty"], undefined, "node-pty must not be a hard dependency");
  assert.ok(pkg.optionalDependencies?.["node-pty"], "node-pty must be listed in optionalDependencies");
});

test("node-pty is only ever loaded through a lazy import", () => {
  // A future refactor could quietly turn the lazy `await import("node-pty")` into a
  // top-level `import ... from "node-pty"`, which would make node-pty mandatory again
  // at module-load time even though package.json now marks it optional.
  const sources = [
    join(__dirname, "delegation", "run-pty.ts"),
    join(__dirname, "delegation", "room-pty.ts"),
  ];
  for (const path of sources) {
    const source = readFileSync(path, "utf8");
    assert.ok(source.includes('await import("node-pty")'), `${path} must lazily import node-pty`);
    assert.doesNotMatch(
      source,
      /^import .*node-pty/m,
      `${path} must not statically import node-pty at the top level`,
    );
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

test("every command the help advertises actually exists, and the flagship ones are advertised", () => {
  // Help drifted badly once: `kage app` — the desktop app the product is sold on —
  // appeared nowhere in `kage help`, while `kage viewer` (the legacy dashboard) was
  // listed in its place. A user installing Kage had no way to discover the app.
  const source = readFileSync(join(__dirname, "..", "cli.ts"), "utf8");
  const implemented = new Set([...source.matchAll(/command === "([a-z-]+)"/g)].map((m) => m[1]));

  const coreStart = source.indexOf("const CORE_USAGE");
  const coreEnd = source.indexOf("`;", coreStart);
  const help = source.slice(coreStart, coreEnd);
  const advertised = [...help.matchAll(/^\s{2}kage ([a-z-]+)/gm)].map((m) => m[1]);

  assert.ok(advertised.length >= 10, `help should list the real command set (found ${advertised.length})`);
  for (const name of advertised) {
    assert.ok(implemented.has(name), `help advertises "kage ${name}" but no such command is implemented`);
  }
  // The surfaces a new user must be able to find.
  for (const name of ["app", "room", "dispatch", "recall", "install"]) {
    assert.ok(advertised.includes(name), `"kage ${name}" must be discoverable from plain \`kage help\``);
  }
});

test("the kernel's index matches the section markers actually in the file", () => {
  // kernel.ts is ~21k lines and splitting it was measured and rejected (see its own
  // header). What replaced the split is navigation: an index at the top and § markers
  // through the body. An index that drifts from the markers is worse than none — it
  // sends a reader to a section that is not there — so the two are checked against
  // each other, in order.
  const source = readFileSync(join(__dirname, "..", "kernel.ts"), "utf8");

  const indexed = [...source.matchAll(/^\/\/ {3}§ (\w+)/gm)].map((m) => m[1]);
  const markers = [...source.matchAll(/^\/\/ § (\w+)$/gm)].map((m) => m[1]);

  assert.ok(indexed.length >= 8, `the index should list the kernel's sections (found ${indexed.length})`);
  assert.deepEqual(
    indexed,
    markers,
    "the index at the top of kernel.ts must list exactly the § markers in the file, in the order they appear",
  );
});
