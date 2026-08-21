// Closes the dmg-first onboarding gap: a user who downloads Kage.app before ever
// running the npm install had no `kage` on PATH, and resolveCli()'s fallback to a bare
// 'kage' turned that into a raw spawn ENOENT shown plainly in the window — a broken-app
// impression instead of an honest "you're missing a dependency" moment. shell/bootstrap.js
// now detects the missing engine before any spawn, asks consent via a native dialog, and
// runs the official npx install through the login shell on approval.
//
// Like shell/update.js, this module touches the `electron` module (dialog, shell) and
// spawns a real login shell to resolve PATH the way a packaged, Finder-launched app must
// — neither exists inside mcp's plain `node --test` process, so there is no seam to
// import shell/bootstrap.js here and exercise it directly. These tests pin the module's
// *shape and wiring* by reading the source as text instead, same technique
// release-wiring-for-the.test.ts already uses for shell/update.js.
//
// REGRESSION: reverting shell/bootstrap.js's consent-gated install flow, or main.js's
// call into it ahead of ensureDaemon(), fails the corresponding assertion below.
//
// __dirname is mcp/dist/ at runtime (compiled test) — one ".." reaches sibling mcp/
// sources, two reaches the repo root. Same convention as readme-claims.test.ts /
// release-wiring-for-the.test.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoPath = (...parts: string[]) => join(__dirname, "..", "..", ...parts);

function readBootstrapJs(): string {
  return readFileSync(repoPath("shell", "bootstrap.js"), "utf8");
}

function readMainJs(): string {
  return readFileSync(repoPath("shell", "main.js"), "utf8");
}

function readBuilderConfig(): string {
  return readFileSync(repoPath("shell", "electron-builder.config.js"), "utf8");
}

test("shell/bootstrap.js detects the engine via the login shell before any install prompt", () => {
  const source = readBootstrapJs();
  assert.ok(/command -v \$\{command\}|command -v.*command/.test(source), "expected a login-shell `command -v` check");
  assert.ok(/["'`]-lic["'`]/.test(source), "expected the login+interactive shell flags used elsewhere in shell/ for PATH resolution");
  assert.ok(source.includes("function engineInstalled"), "expected an engineInstalled() check");
  assert.ok(source.includes("function nodeToolingAvailable"), "expected a nodeToolingAvailable() check for node/npx presence");
});

test("shell/bootstrap.js never installs without explicit dialog consent, and never retries on failure", () => {
  const source = readBootstrapJs();
  assert.ok(source.includes("dialog.showMessageBox"), "expected a native Electron dialog, not a custom renderer prompt");
  assert.ok(/Install engine/.test(source) && /Quit/.test(source), "expected explicit Install engine / Quit choices");
  assert.ok(
    source.includes("Kage runs on a local engine installed via npm"),
    "expected the dialog to say plainly what Kage needs, in the brief's own words",
  );
  assert.ok(
    source.includes("npx -y @kage-core/kage-graph-mcp install"),
    "expected the official install command to be the one actually run (and the one shown back to the user on failure)",
  );
  // No retry loop: runInstall() must be invoked at most once per ensureEngineAvailable() pass.
  const runInstallCalls = source.match(/await runInstall\(/g) || [];
  assert.equal(runInstallCalls.length, 1, "expected exactly one invocation of runInstall — no retry loop on failure");
});

test("shell/bootstrap.js tells the user plainly when node/npx are missing, and points at nodejs.org", () => {
  const source = readBootstrapJs();
  assert.ok(source.includes("https://nodejs.org"), "expected a link to nodejs.org when node/npx are absent");
  assert.ok(source.includes("shell.openExternal(NODEJS_URL)"), "expected nodejs.org to actually be opened, not just mentioned");
  assert.ok(/Node\.js was not found/i.test(source), "expected an honest 'Node.js was not found' message, not a pretend install attempt");
});

test("shell/bootstrap.js respects KAGE_NO_BOOTSTRAP=1 by skipping the whole flow", () => {
  const source = readBootstrapJs();
  assert.ok(source.includes('process.env.KAGE_NO_BOOTSTRAP === "1"'), "expected an explicit KAGE_NO_BOOTSTRAP=1 escape hatch");
});

test("shell/main.js calls the bootstrap check before resolveCli()/ensureDaemon() ever spawn the engine", () => {
  const source = readMainJs();
  assert.ok(source.includes('require("./bootstrap.js")'), "expected main.js to import the bootstrap module");
  const bootstrapCallIndex = source.indexOf("ensureEngineAvailable(");
  const ensureDaemonCallIndex = source.indexOf("await ensureDaemon()");
  assert.ok(bootstrapCallIndex > -1, "expected main.js to call ensureEngineAvailable()");
  assert.ok(ensureDaemonCallIndex > -1, "expected main.js to still call ensureDaemon()");
  assert.ok(
    bootstrapCallIndex < ensureDaemonCallIndex,
    "expected the engine-bootstrap check to run BEFORE ensureDaemon() spawns anything",
  );
});

test("shell/electron-builder.config.js bundles bootstrap.js into the packaged app", () => {
  const source = readBuilderConfig();
  const filesMatch = source.match(/files:\s*\[([^\]]*)\]/);
  assert.ok(filesMatch, "expected a files: [...] array in electron-builder.config.js");
  assert.ok(filesMatch![1].includes("bootstrap.js"), "expected bootstrap.js to be listed in the packaged files array");
});
