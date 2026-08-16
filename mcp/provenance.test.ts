import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { packetProvenance } from "./delegation/provenance.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Ada",
  GIT_AUTHOR_EMAIL: "ada@example.com",
  GIT_COMMITTER_NAME: "Ada",
  GIT_COMMITTER_EMAIL: "ada@example.com",
};

function gitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-prov-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir, stdio: "ignore" });
  mkdirSync(join(dir, ".agent_memory", "packets"), { recursive: true });
  return dir;
}

function writePacket(dir: string, file: string, id: string, body = "text"): void {
  writeFileSync(
    join(dir, ".agent_memory", "packets", file),
    ["---", 'type: "Decision"', `x-kage-id: "${id}"`, "---", "", body, ""].join("\n"),
    "utf8",
  );
}

function commit(dir: string, message: string, env = GIT_ENV): void {
  execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore", env });
  execFileSync("git", ["commit", "-m", message], { cwd: dir, stdio: "ignore", env });
}

test("maps each packet id to its file and its last git author", () => {
  const dir = gitRepo();
  writePacket(dir, "a.md", "repo:x:decision:a");
  writePacket(dir, "b.md", "repo:x:decision:b");
  commit(dir, "two packets");

  const prov = packetProvenance(dir);
  assert.equal(prov.pathById.get("repo:x:decision:a"), join(dir, ".agent_memory", "packets", "a.md"));
  assert.equal(prov.authorById.get("repo:x:decision:a"), "Ada");
  assert.equal(prov.authorById.get("repo:x:decision:b"), "Ada");
});

test("the LAST author wins when a packet is edited by someone else", () => {
  const dir = gitRepo();
  writePacket(dir, "a.md", "repo:x:decision:a", "first");
  commit(dir, "ada writes it");

  writePacket(dir, "a.md", "repo:x:decision:a", "second");
  commit(dir, "grace edits it", {
    ...GIT_ENV,
    GIT_AUTHOR_NAME: "Grace",
    GIT_AUTHOR_EMAIL: "grace@example.com",
    GIT_COMMITTER_NAME: "Grace",
    GIT_COMMITTER_EMAIL: "grace@example.com",
  });

  // The whole point of walking the log newest-first: the first appearance of a path is
  // its most recent author, so the map must say Grace, not Ada.
  assert.equal(packetProvenance(dir).authorById.get("repo:x:decision:a"), "Grace");
});

test("an uncommitted packet is still located, just without an author", () => {
  const dir = gitRepo();
  writePacket(dir, "a.md", "repo:x:decision:a");
  commit(dir, "one packet");
  writePacket(dir, "fresh.md", "repo:x:decision:fresh"); // never committed

  const prov = packetProvenance(dir);
  assert.ok(prov.pathById.has("repo:x:decision:fresh"), "the file is found on disk");
  assert.equal(prov.authorById.get("repo:x:decision:fresh"), undefined, "git cannot name an author for it yet");
});

test("a packet with no id in frontmatter is skipped rather than crashing the walk", () => {
  const dir = gitRepo();
  writePacket(dir, "good.md", "repo:x:decision:good");
  writeFileSync(join(dir, ".agent_memory", "packets", "bad.md"), "no frontmatter at all\n", "utf8");
  commit(dir, "one good one bad");

  const prov = packetProvenance(dir);
  assert.equal(prov.pathById.size, 1);
  assert.ok(prov.pathById.has("repo:x:decision:good"));
});

test("a repo with no packets, and a non-git directory, both return empty maps", () => {
  const empty = gitRepo();
  const prov = packetProvenance(empty);
  assert.equal(prov.pathById.size, 0);
  assert.equal(prov.authorById.size, 0);

  const notGit = mkdtempSync(join(tmpdir(), "kage-nogit-"));
  mkdirSync(join(notGit, ".agent_memory", "packets"), { recursive: true });
  writePacket(notGit, "a.md", "repo:x:decision:a");
  const outside = packetProvenance(notGit);
  assert.ok(outside.pathById.has("repo:x:decision:a"), "the file is still located without git");
  assert.equal(outside.authorById.size, 0, "and no author is invented");
});

test("the cache refreshes when a packet is added or changed, not on a timer alone", () => {
  const dir = gitRepo();
  writePacket(dir, "a.md", "repo:x:decision:a");
  commit(dir, "one");
  assert.equal(packetProvenance(dir).pathById.size, 1);

  // The fingerprint is newest-mtime + count, so adding a packet must invalidate
  // immediately — a 15s TTL alone would serve a stale map to the console.
  writePacket(dir, "b.md", "repo:x:decision:b");
  commit(dir, "two");
  assert.equal(packetProvenance(dir).pathById.size, 2, "a new packet invalidates the cache at once");

  rmSync(join(dir, ".agent_memory", "packets", "b.md"));
  assert.equal(packetProvenance(dir).pathById.size, 1, "and so does a removed one");
});
