// What `kage team` promises, asserted as sentences.
//
// The load-bearing one is the first: a solo store is a supported state. Most of this surface's
// behaviour is what it does when there is NO remote — because that is the state every store
// starts in, and the state a team product is most tempted to shout about.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { approveCard, openStore, proposeCard } from "./store.js";
import { runTeamCommand, type TeamCliDeps } from "./team-cli.js";
import type { CardProposal, Provenance } from "./types.js";

/** Explicit identity: the operator's own ~/.gitconfig must not decide whether a test passes. */
const GIT = ["-c", "user.email=t@t.dev", "-c", "user.name=T"];

interface Scratch {
  projectDir: string;
  storeRoot: string;
}

/** A real git repo to shadow, plus its own store root — never the operator's real ~/.kage. */
function scratch(): Scratch {
  const projectDir = mkdtempSync(join(tmpdir(), "kage-team-cli-repo-"));
  const storeRoot = mkdtempSync(join(tmpdir(), "kage-team-cli-store-"));
  mkdirSync(join(projectDir, "src"), { recursive: true });
  writeFileSync(join(projectDir, "src", "limits.ts"), "export const tenantLimit = 100;\n");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });
  execFileSync("git", [...GIT, "add", "-A"], { cwd: projectDir });
  execFileSync("git", [...GIT, "commit", "-qm", "initial"], { cwd: projectDir });
  return { projectDir, storeRoot };
}

/** A bare repo standing in for the host the team already trusts. */
function sharedRemote(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-team-cli-remote-"));
  execFileSync("git", ["init", "-q", "--bare", "-b", "main"], { cwd: dir });
  return dir;
}

function refsIn(bareRepo: string): string {
  return execFileSync("git", ["-C", bareRepo, "for-each-ref", "--format=%(refname)"], {
    encoding: "utf8",
  }).trim();
}

function cli(dirs: Scratch, argv: string[], extra: TeamCliDeps = {}) {
  // `me` is pinned so the cross-pollination copy does not depend on whoever runs the suite.
  return runTeamCommand(argv, dirs.projectDir, { storeRoot: dirs.storeRoot, me: "tester", ...extra });
}

// ── Solo — the state every store starts in ───────────────────────────────────────────────────

test("a store with no remote reports the solo state and exits 0, naming the one command that changes it", async () => {
  const dirs = scratch();
  const result = await cli(dirs, []);
  assert.equal(result.exitCode, 0, "solo is a supported state, not a failure");
  assert.match(result.out, /Remote {3}none/);
  assert.match(result.out, /offline/, "the copy says what solo IS, not only what it lacks");
  assert.match(result.out, /kage team remote <url>/, "an unshared store offers the action that shares it");
});

test("bare `kage team` and `kage team status` are the same read", async () => {
  const dirs = scratch();
  const bare = await cli(dirs, []);
  const explicit = await cli(dirs, ["status"]);
  assert.equal(bare.out, explicit.out);
  assert.equal(bare.exitCode, explicit.exitCode);
});

// A solo store has no teammates, so cross-pollination has nothing to count — which is a
// different fact from having counted nothing. The unlock action says which one it is.
test("score on a store with no remote offers the unlock action instead of printing a zero", async () => {
  const dirs = scratch();
  const result = await cli(dirs, ["score"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.out, /Not measurable yet/);
  assert.match(result.out, /kage team remote <url>/);
  assert.doesNotMatch(result.out, /\b0\b/, "an unmeasured number is never rendered as 0");
});

test("push and pull with no remote are refused with the command that would configure one", async () => {
  const dirs = scratch();
  for (const verb of ["push", "pull"]) {
    const result = await cli(dirs, [verb]);
    assert.equal(result.exitCode, 1, `${verb} has nowhere to go`);
    assert.match(result.out, new RegExp(`nothing to ${verb}`));
    assert.match(result.out, /supported state, not a broken one/);
    assert.match(result.out, /kage team remote <url>/);
  }
});

test("--json parses on a solo store for every subcommand that has an answer without a remote", async () => {
  const dirs = scratch();

  const status = JSON.parse((await cli(dirs, ["status", "--json"])).out) as {
    store: string;
    me: string;
    remote: { configured: boolean };
    crossPollination: { total: number };
  };
  assert.equal(status.remote.configured, false);
  assert.equal(status.me, "tester");
  assert.match(status.store, /kage-team-cli-store-/, "the store path is the scratch one, never ~/.kage");
  assert.equal(typeof status.crossPollination.total, "number");

  const score = JSON.parse((await cli(dirs, ["score", "--json"])).out) as {
    configured: boolean;
    total: number;
    byAuthor: unknown[];
  };
  assert.equal(score.configured, false);
  assert.deepEqual(score.byAuthor, []);

  // The refusals are JSON too: a --json caller that hit the solo state must still get JSON out
  // and a nonzero status in, not a paragraph it cannot parse.
  for (const verb of ["push", "pull"]) {
    const refused = await cli(dirs, [verb, "--json"]);
    assert.equal(refused.exitCode, 1);
    assert.equal((JSON.parse(refused.out) as { ok: boolean }).ok, false);
  }
});

// ── Configuring and syncing against a real repo ──────────────────────────────────────────────

test("setting a remote says nothing has moved yet, because configuring is not sharing", async () => {
  const dirs = scratch();
  const result = await cli(dirs, ["remote", sharedRemote()]);
  assert.equal(result.exitCode, 0, result.out);
  assert.match(result.out, /Remote set:/);
  assert.match(result.out, /Nothing has moved yet/);
  assert.match(result.out, /kage team push/);
});

test("remote without a url is refused rather than clearing the one that is set", async () => {
  const dirs = scratch();
  const result = await cli(dirs, ["remote"]);
  assert.equal(result.exitCode, 1);
  assert.match(result.out, /remote needs a url/);
});

test("remote then push then status: the store's commits reach the shared repo and status names it", async () => {
  const dirs = scratch();
  const remote = sharedRemote();
  assert.equal(refsIn(remote), "", "the shared repo starts empty");

  const configured = await cli(dirs, ["remote", remote]);
  assert.equal(configured.exitCode, 0, configured.out);

  const pushed = await cli(dirs, ["push"]);
  assert.equal(pushed.exitCode, 0, pushed.out);
  assert.match(pushed.out, /Pushed \d+ commit/, "the count is labelled with the unit git counted in");
  assert.notEqual(refsIn(remote), "", "push moves this store's commits onto the shared repo");

  const status = await cli(dirs, ["status"]);
  assert.equal(status.exitCode, 0, status.out);
  assert.match(status.out, new RegExp(remote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(status.out, /Remote {3}none/);

  // Nothing new upstream: the honest answer is "nothing to pull", not a fabricated merge count.
  const pulled = await cli(dirs, ["pull"]);
  assert.equal(pulled.exitCode, 0, pulled.out);
});

test("score against a shared remote reports from receipts and never invents a teammate", async () => {
  const dirs = scratch();
  await cli(dirs, ["remote", sharedRemote()]);

  const result = await cli(dirs, ["score"]);
  assert.equal(result.exitCode, 0, result.out);
  assert.match(result.out, /Nothing from a teammate has been served here yet/);
  assert.match(result.out, /never estimated/, "the number's provenance is stated wherever it is shown");

  const parsed = JSON.parse((await cli(dirs, ["score", "--json"])).out) as { total: number; byAuthor: unknown[] };
  assert.equal(parsed.total, 0, "the machine surface carries the raw count; the human one does not print it");
  assert.deepEqual(parsed.byAuthor, []);
});

// ── Conflicts — the one output this surface may never round off ──────────────────────────────

/** The claim both teammates land on. Content-addressed, so it is the same card id on each machine. */
const PROPOSAL: CardProposal = {
  kind: "caution",
  title: "tenantLimit comparison is exclusive on purpose",
  claim:
    "withinLimit uses < rather than <= so a tenant at exactly the limit is refused; two commits flipped it and both were reverted.",
  citations: [{ path: "src/limits.ts" }],
  trigger: "editing tenant limits in src/limits.ts",
};

const PROVENANCE: Provenance = { source: "human", ref: "test", at: "2026-08-04T12:00:00.000Z" };

test("a conflicted pull names every card, exits nonzero, and never reports a merge it did not finish", async () => {
  // Two teammates shadowing the same project on two machines: same store id, same card id, and
  // the same claim approved in each of their own words. That is the shape of a real card
  // conflict — not a hypothetical, and the one thing a sync surface must not smooth over.
  const project = mkdtempSync(join(tmpdir(), "kage-team-cli-shared-"));
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "limits.ts"), "export const tenantLimit = 100;\n");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project });

  const remote = sharedRemote();
  const roots = { alice: mkdtempSync(join(tmpdir(), "kage-team-cli-alice-")), bob: mkdtempSync(join(tmpdir(), "kage-team-cli-bob-")) };
  const ids: string[] = [];
  for (const [who, root] of Object.entries(roots)) {
    const store = openStore(project, root);
    const proposed = proposeCard(store, PROPOSAL, PROVENANCE);
    assert.ok("card" in proposed, "the gate admits the proposal on both machines");
    approveCard(store, proposed.card.id, who, `${who} wrote the review note differently`);
    ids.push(proposed.card.id);
  }
  assert.equal(ids[0], ids[1], "the same claim is the same card id on both machines");

  const run = (root: string, argv: string[]) => runTeamCommand(argv, project, { storeRoot: root, me: "bob" });
  await run(roots.alice, ["remote", remote]);
  assert.equal((await run(roots.alice, ["push"])).exitCode, 0);
  await run(roots.bob, ["remote", remote]);

  const pulled = await run(roots.bob, ["pull"]);
  assert.equal(pulled.exitCode, 1, "something is waiting on a human, so the exit status says so");
  assert.match(pulled.out, /Pull stopped on 1 conflict/);
  assert.match(pulled.out, new RegExp(ids[0]), "the conflicted card is named, not just counted");
  assert.match(pulled.out, /Resolve them in the store repo/);
  assert.match(pulled.out, new RegExp(roots.bob.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "with the path to go to");
  assert.doesNotMatch(pulled.out, /Pulled \d/, "a stopped merge is never reported as a finished one");

  const asJson = await run(roots.bob, ["pull", "--json"]);
  assert.equal(asJson.exitCode, 1, "a script reading only the exit code must not be told this succeeded");
  const parsed = JSON.parse(asJson.out) as { ok: boolean; conflicts: string[] };
  assert.deepEqual(parsed.conflicts, [ids[0]]);
});

// ── The dispatcher itself ────────────────────────────────────────────────────────────────────

test("an unknown subcommand answers with the whole verb list and a nonzero status", async () => {
  const dirs = scratch();
  const result = await cli(dirs, ["pssh"]);
  assert.equal(result.exitCode, 1);
  assert.match(result.out, /Unknown subcommand 'pssh'/);
  for (const verb of ["status", "remote", "push", "pull", "score"]) {
    assert.match(result.out, new RegExp(`kage team ${verb}`), `usage names ${verb}`);
  }
});

test("a typo does not leave a store behind", async () => {
  const dirs = scratch();
  await cli(dirs, ["puhs"]);
  assert.equal(existsSync(dirs.storeRoot), true);
  assert.equal(
    execFileSync("ls", [dirs.storeRoot], { encoding: "utf8" }).trim(),
    "",
    "openStore git-inits a directory; an unrecognized verb must not cause one",
  );
});

test("--help prints the usage block without touching the store", async () => {
  const dirs = scratch();
  const result = await cli(dirs, ["--help"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.out, /kage team — your card store is a git repo/);
  assert.equal(execFileSync("ls", [dirs.storeRoot], { encoding: "utf8" }).trim(), "");
});
