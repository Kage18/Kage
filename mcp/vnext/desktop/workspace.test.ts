import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  addRepo,
  activeRepo,
  emptyState,
  loadState,
  openRepo,
  portForPath,
  removeRepo,
  saveState,
  statePath,
} from "./workspace.js";

function gitRepo(name = "repo"): string {
  const dir = mkdtempSync(join(tmpdir(), `kage-desktop-${name}-`));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  return dir;
}

const anyRepo = () => true;

test("adding a repository records it, names it, and makes it active", () => {
  const dir = gitRepo();
  const result = addRepo(emptyState(), dir, { isRepo: anyRepo });
  assert.equal(result.ok, true);
  assert.equal(result.state.repos.length, 1);
  assert.equal(result.state.active, result.repo!.path);
  assert.ok(result.repo!.name.length > 0, "the UI needs something to call it");
});

// The bug this prevents is not cosmetic: two entries for one repository means two daemons
// writing the same `.agent_memory`, and they fight.
test("the same repository via a symlink is ONE entry, not two", () => {
  const dir = gitRepo();
  const linkDir = mkdtempSync(join(tmpdir(), "kage-desktop-link-"));
  const link = join(linkDir, "alias");
  symlinkSync(dir, link);

  const first = addRepo(emptyState(), dir, { isRepo: anyRepo });
  const second = addRepo(first.state, link, { isRepo: anyRepo });

  assert.equal(second.ok, true);
  assert.equal(second.state.repos.length, 1, "one repository, reached two ways");
});

test("a trailing slash is the same repository", () => {
  const dir = gitRepo();
  const first = addRepo(emptyState(), dir, { isRepo: anyRepo });
  const second = addRepo(first.state, `${dir}/`, { isRepo: anyRepo });
  assert.equal(second.state.repos.length, 1);
});

test("a directory that is not a git repository is refused, with the reason", () => {
  const plain = mkdtempSync(join(tmpdir(), "kage-desktop-plain-"));
  const result = addRepo(emptyState(), plain);
  assert.equal(result.ok, false);
  assert.match(result.error!, /not a git repository/);
  assert.equal(result.state.repos.length, 0);
});

test("a path that does not exist is refused rather than recorded", () => {
  const result = addRepo(emptyState(), "/no/such/place/at/all");
  assert.equal(result.ok, false);
  assert.match(result.error!, /not a directory that exists/);
});

test("a file is not a repository", () => {
  const dir = mkdtempSync(join(tmpdir(), "kage-desktop-file-"));
  const file = join(dir, "README.md");
  writeFileSync(file, "hello");
  const result = addRepo(emptyState(), file);
  assert.equal(result.ok, false);
});

// Stability is the point: a window that was on one port yesterday is on it today.
test("a repository's port is derived from its path, so it survives a relaunch", () => {
  const a = portForPath("/Users/x/code/Kage", new Set());
  const b = portForPath("/Users/x/code/Kage", new Set());
  assert.equal(a, b);
});

test("two repositories never share a port, even when their paths collide in the hash", () => {
  const first = portForPath("/a", new Set());
  // Force the collision: pretend the derived port is already taken.
  const second = portForPath("/a", new Set([first]));
  assert.notEqual(second, first);
});

test("adding several repositories gives every one a distinct port", () => {
  let state = emptyState();
  for (const name of ["one", "two", "three", "four"]) {
    state = addRepo(state, gitRepo(name), { isRepo: anyRepo }).state;
  }
  const ports = state.repos.map((repo) => repo.port);
  assert.equal(new Set(ports).size, ports.length, "no two daemons on one port");
});

test("removing the active repository moves to another rather than leaving a dangling window", () => {
  let state = addRepo(emptyState(), gitRepo("a"), { isRepo: anyRepo }).state;
  const kept = state.repos[0].path;
  const added = addRepo(state, gitRepo("b"), { isRepo: anyRepo });
  state = added.state;
  assert.equal(state.active, added.repo!.path, "the newly added one is showing");

  state = removeRepo(state, added.repo!.path);
  assert.equal(state.active, kept, "the window falls back to a repository that still exists");
});

test("removing the last repository leaves no dangling active pointer", () => {
  const added = addRepo(emptyState(), gitRepo(), { isRepo: anyRepo });
  const state = removeRepo(added.state, added.repo!.path);
  assert.equal(state.active, null);
  assert.equal(activeRepo(state), null);
});

test("adding one already watched just switches to it", () => {
  const dir = gitRepo();
  let state = addRepo(emptyState(), dir, { isRepo: anyRepo }).state;
  state = addRepo(state, gitRepo("other"), { isRepo: anyRepo }).state;
  const again = addRepo(state, dir, { isRepo: anyRepo });
  assert.equal(again.ok, true);
  assert.equal(again.state.repos.length, 2, "nothing duplicated");
  assert.equal(activeRepo(again.state)!.path, again.repo!.path, "and it is now the one showing");
});

test("opening stamps when it was last opened", () => {
  const added = addRepo(emptyState(), gitRepo(), { isRepo: anyRepo });
  const opened = openRepo(added.state, added.repo!.path, "2026-07-29T10:00:00.000Z");
  assert.equal(opened.repos[0].last_opened_at, "2026-07-29T10:00:00.000Z");
});

test("state survives a round trip through disk", () => {
  const home = mkdtempSync(join(tmpdir(), "kage-desktop-home-"));
  const added = addRepo(emptyState(), gitRepo(), { isRepo: anyRepo });
  saveState(home, added.state);
  const loaded = loadState(home);
  assert.deepEqual(loaded.repos.map((r) => r.path), added.state.repos.map((r) => r.path));
  assert.equal(loaded.active, added.state.active);
});

// An app that will not launch because a JSON file got truncated is a broken app.
test("a corrupt state file starts the app empty rather than refusing to launch", () => {
  const home = mkdtempSync(join(tmpdir(), "kage-desktop-corrupt-"));
  mkdirSync(join(home, ".kage"), { recursive: true });
  writeFileSync(statePath(home), "{ this is not json");
  assert.deepEqual(loadState(home), emptyState());
});

test("no state file at all is an empty app, not an error", () => {
  const home = mkdtempSync(join(tmpdir(), "kage-desktop-fresh-"));
  assert.deepEqual(loadState(home), emptyState());
});

test("a saved active repository that is no longer in the list is repaired on load", () => {
  const home = mkdtempSync(join(tmpdir(), "kage-desktop-repair-"));
  const added = addRepo(emptyState(), gitRepo(), { isRepo: anyRepo });
  saveState(home, { ...added.state, active: "/somewhere/deleted" });
  const loaded = loadState(home);
  assert.equal(loaded.active, added.state.repos[0].path, "falls back to a real one");
});
