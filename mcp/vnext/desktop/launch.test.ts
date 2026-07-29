import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { installedAppPaths, openDesktopApp, sourceShellPaths } from "./launch.js";
import { loadState } from "./workspace.js";

function gitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-launch-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  return dir;
}

function home(): string {
  return mkdtempSync(join(tmpdir(), "kage-launch-home-"));
}

test("an installed app is opened the way any Mac app is", () => {
  const opened: string[] = [];
  const result = openDesktopApp({
    exists: (path) => path === "/Applications/Kage.app",
    openInstalled: (path) => opened.push(path),
    home: home(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.via, "installed");
  assert.deepEqual(opened, ["/Applications/Kage.app"]);
});

// The single-path assumption is what shipped a 404 portal in 4.0.0. Both locations are tried.
test("with nothing installed, the built shell in a checkout is used instead", () => {
  const ran: Array<[string, string]> = [];
  const result = openDesktopApp({
    exists: (path) => path.includes("platform/desktop"),
    runSource: (electron, main) => ran.push([electron, main]),
    home: home(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.via, "source");
  assert.equal(ran.length, 1);
  assert.match(ran[0][1], /platform\/desktop\/dist\/main\.js$/);
});

test("with neither present it says how to get one, rather than failing silently", () => {
  const result = openDesktopApp({ exists: () => false, home: home() });
  assert.equal(result.ok, false);
  assert.match(result.message, /npm start --prefix platform\/desktop/);
  assert.match(result.message, /dist:mac/);
});

// Adding the repository BEFORE launching means the app opens already watching it, rather than
// opening empty and needing a second action. It goes through the SAME state file the app writes —
// one writer, one format.
test("--project adds the repository to the watch list before the app opens", () => {
  const dir = gitRepo();
  const h = home();
  const result = openDesktopApp({
    project_dir: dir,
    exists: (path) => path === "/Applications/Kage.app",
    openInstalled: () => {},
    home: h,
  });
  assert.equal(result.ok, true);
  const state = loadState(h);
  assert.equal(state.repos.length, 1);
  assert.equal(state.active, state.repos[0].path);
});

test("a path that cannot be watched is refused BEFORE anything is launched", () => {
  const opened: string[] = [];
  const plain = mkdtempSync(join(tmpdir(), "kage-launch-notrepo-"));
  const result = openDesktopApp({
    project_dir: plain,
    exists: () => true,
    openInstalled: (path) => opened.push(path),
    home: home(),
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /not a git repository/);
  assert.deepEqual(opened, [], "nothing was launched");
});

test("both well-known install locations are considered", () => {
  const paths = installedAppPaths();
  assert.equal(paths.some((p) => p.startsWith("/Applications/")), true);
  assert.equal(paths.some((p) => p.includes("Applications") && !p.startsWith("/Applications/")), true, "a user-local install too");
});

test("the source shell is resolved relative to the core build, not the cwd", () => {
  const paths = sourceShellPaths("/somewhere/mcp/dist");
  assert.equal(paths.main, "/somewhere/platform/desktop/dist/main.js");
  assert.match(paths.electron, /platform\/desktop\/node_modules\/\.bin\/electron$/);
});
