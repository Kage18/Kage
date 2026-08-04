import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { planInstall, renderInstallPlan, renderNextSteps, type InstallPlan } from "./install.js";
import { BRIEF_BEGIN, BRIEF_END } from "./brief.js";

const GIT = ["-c", "user.email=t@t.dev", "-c", "user.name=T"];

interface Scratch {
  projectDir: string;
  /** A scratch HOME, so probing for agents never reads the operator's real one. */
  home: string;
}

function scratch(): Scratch {
  return {
    projectDir: mkdtempSync(join(tmpdir(), "kage-install-repo-")),
    home: mkdtempSync(join(tmpdir(), "kage-install-home-")),
  };
}

/** A real git repo with `commits` empty commits — enough for `git rev-list --count` to answer. */
function gitRepo(projectDir: string, commits: number): void {
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });
  for (let index = 0; index < commits; index += 1) {
    execFileSync("git", [...GIT, "commit", "-q", "--allow-empty", "-m", `c${index}`], { cwd: projectDir });
  }
}

/** The state that says "Kage has a card store for this repo", exactly as hook.ts reads it. */
function fakeExistingStore(plan: InstallPlan): void {
  mkdirSync(join(plan.storeDir, "cards"), { recursive: true });
}

function lineCount(text: string): number {
  return text.split("\n").length;
}

// ── Planning is a read ───────────────────────────────────────────────────────────────────────

test("planning an install writes nothing at all — not even the store it describes", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 1);
  const before = readdirSync(dirs.projectDir).sort();

  const plan = planInstall(dirs.projectDir, dirs.home);

  assert.equal(existsSync(plan.storeDir), false, "a plan that created the store could never report alreadyInstalled twice");
  assert.deepEqual(readdirSync(dirs.projectDir).sort(), before, "the project is untouched by planning");
  assert.deepEqual(readdirSync(dirs.home), [], "the home dir is untouched by planning");
});

test("memory is planned into the shadow store under home, never into the project", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 1);

  const plan = planInstall(dirs.projectDir, dirs.home);

  assert.ok(
    plan.storeDir.startsWith(join(dirs.home, ".kage", "store")),
    `expected a store under the scratch home, got ${plan.storeDir}`,
  );
  assert.ok(!plan.storeDir.startsWith(dirs.projectDir), "the whole repo-clutter answer is that this is not in the repo");
});

// ── History: is day-one mining worth offering? ───────────────────────────────────────────────

test("a repo with twenty commits has history worth mining; nineteen does not", () => {
  const dirs = scratch();
  // Twenty is the line: below it the digest is thinner than the README, and mining would spend
  // the user's own tokens to rediscover the initial commit.
  gitRepo(dirs.projectDir, 20);
  assert.equal(planInstall(dirs.projectDir, dirs.home).hasHistory, true);

  execFileSync("git", ["reset", "--hard", "-q", "HEAD~1"], { cwd: dirs.projectDir });
  assert.equal(planInstall(dirs.projectDir, dirs.home).hasHistory, false, "the threshold is a floor, not a hint");
});

test("a repo with no commits and a directory that is not a repo both plan as no history", () => {
  const fresh = scratch();
  gitRepo(fresh.projectDir, 0); // git init, unborn HEAD
  assert.equal(planInstall(fresh.projectDir, fresh.home).hasHistory, false);

  const notARepo = scratch();
  assert.equal(
    planInstall(notARepo.projectDir, notARepo.home).hasHistory,
    false,
    "a failed read is answered honestly, never guessed at",
  );
});

// ── Agent detection ──────────────────────────────────────────────────────────────────────────

test("a machine with no agent config dirs detects an empty list rather than guessing one", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 1);

  const plan = planInstall(dirs.projectDir, dirs.home);

  assert.deepEqual(plan.detectedAgents, []);
  assert.match(renderInstallPlan(plan), /none detected — wire one: kage setup <agent>/);
  assert.match(renderNextSteps(plan), /No agent wired yet/, "the screen says nothing is wired instead of implying it is");
});

test("agents are detected by their config directories, the way the installer wires them", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 1);
  mkdirSync(join(dirs.home, ".claude"), { recursive: true });
  mkdirSync(join(dirs.home, ".cursor"), { recursive: true });
  mkdirSync(join(dirs.home, ".config", "goose"), { recursive: true });

  const plan = planInstall(dirs.projectDir, dirs.home);

  assert.deepEqual(plan.detectedAgents, ["claude-code", "cursor", "goose"]);
  assert.match(renderInstallPlan(plan), /claude-code, cursor, goose/);
  assert.match(renderNextSteps(plan), /Restart claude-code, cursor, goose/, "tools load at session start, so a restart is required");
});

// ── Already installed ────────────────────────────────────────────────────────────────────────

test("a repo Kage has never seen plans as a first install", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 1);

  const plan = planInstall(dirs.projectDir, dirs.home);

  assert.equal(plan.alreadyInstalled, false);
  assert.match(renderInstallPlan(plan), /one card store outside your repo, one fenced block inside it/);
});

test("an existing card store makes the install a refresh, and the screen promises nothing is lost", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 1);
  fakeExistingStore(planInstall(dirs.projectDir, dirs.home));

  const plan = planInstall(dirs.projectDir, dirs.home);

  assert.equal(plan.alreadyInstalled, true);
  assert.match(renderInstallPlan(plan), /already set up for this repo; re-running keeps every card/);
});

// ── The one artifact in the repo ─────────────────────────────────────────────────────────────

test("a repo with no agent file targets AGENTS.md, and the block is planned as new", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 1);

  const plan = planInstall(dirs.projectDir, dirs.home);

  assert.equal(plan.briefTarget, join(dirs.projectDir, "AGENTS.md"));
  assert.equal(plan.briefExists, false);
  assert.match(renderInstallPlan(plan), /AGENTS\.md — one fenced block, added below whatever you already wrote/);
  assert.ok(
    renderInstallPlan(plan).includes(`${BRIEF_BEGIN} … ${BRIEF_END}`),
    "the exact markers are shown: the reader can grep their own repo for them",
  );
});

test("an AGENTS.md that already carries the block is refreshed in place, not given a second one", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 1);
  writeFileSync(join(dirs.projectDir, "AGENTS.md"), `# Our rules\n\n${BRIEF_BEGIN}\n- old\n${BRIEF_END}\n`);

  const plan = planInstall(dirs.projectDir, dirs.home);

  assert.equal(plan.briefExists, true);
  assert.match(renderInstallPlan(plan), /the fenced block is already there and is refreshed in place/);
});

test("an AGENTS.md written by the team, with no block yet, plans as a first block", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 1);
  writeFileSync(join(dirs.projectDir, "AGENTS.md"), "# Our rules\n\nRun the tests before you push.\n");

  // The file exists; the BLOCK does not. Conflating the two would tell this team their prose is
  // about to be replaced.
  assert.equal(planInstall(dirs.projectDir, dirs.home).briefExists, false);
});

test("a repo with only CLAUDE.md is told about CLAUDE.md, not about a file it does not have", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 1);
  writeFileSync(join(dirs.projectDir, "CLAUDE.md"), "# House rules\n");

  const plan = planInstall(dirs.projectDir, dirs.home);

  assert.equal(plan.briefTarget, join(dirs.projectDir, "CLAUDE.md"));
  assert.match(renderNextSteps(plan), /one fenced block in CLAUDE\.md/);
});

// ── Next steps: the most-read string in the product ──────────────────────────────────────────

test("with history to mine, the one named command is the one that produces value now", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 20);

  const out = renderNextSteps(planInstall(dirs.projectDir, dirs.home));

  assert.match(out, /kage cards mine/);
  assert.match(out, /propose cards from this repo's own history/);
});

test("with no history, mining is not named — the honest next step is to start coding", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 2);

  const out = renderNextSteps(planInstall(dirs.projectDir, dirs.home));

  assert.doesNotMatch(out, /kage cards mine/, "offering a mine over two commits burns their tokens for nothing");
  assert.match(out, /Start coding/);
  assert.match(out, /The Librarian proposes cards when your session ends/);
  assert.match(out, /kage cards list --state proposed/, "a proposal nobody can find is a proposal nobody approves");
});

test("whose tokens pay is stated on both paths, because discovering it from a bill is worse", () => {
  const withHistory = scratch();
  gitRepo(withHistory.projectDir, 20);
  const without = scratch();
  gitRepo(without.projectDir, 2);

  for (const dirs of [withHistory, without]) {
    const out = renderNextSteps(planInstall(dirs.projectDir, dirs.home));
    assert.match(out, /YOUR coding-agent subscription/, out);
    assert.match(out, /spends YOUR tokens, not ours/, out);
  }
});

test("next steps say where memory lives and how small the repo footprint is", () => {
  const dirs = scratch();
  gitRepo(dirs.projectDir, 20);
  const plan = planInstall(dirs.projectDir, dirs.home);

  const out = renderNextSteps(plan);

  assert.ok(out.includes(plan.storeDir), "the path is printed whole; 'somewhere in your home' is not an answer");
  assert.match(out, /its own git repo, outside this project/);
  assert.match(out, /one fenced block in AGENTS\.md/);
  // The claim must be about MEMORY, not about the whole repo. An install also writes the agent
  // policy, a .gitignore entry and a merge-driver .gitattributes — four staged files — so
  // "and nothing else" was measurably false, and this asserts it cannot come back.
  assert.match(out, /No memory is written into this repo/);
  assert.doesNotMatch(out, /and nothing else/, "an install must not overstate what it leaves behind");
});

test("next steps stay under ten lines in every combination of history and detected agents", () => {
  const withHistory = scratch();
  gitRepo(withHistory.projectDir, 20);
  const without = scratch();
  gitRepo(without.projectDir, 2);

  for (const dirs of [withHistory, without]) {
    for (const agents of [false, true]) {
      if (agents) mkdirSync(join(dirs.home, ".claude"), { recursive: true });
      const out = renderNextSteps(planInstall(dirs.projectDir, dirs.home));
      // Ten lines is the cap because a wall of text after an install is not read, and an unread
      // instruction is an uninstalled product.
      assert.ok(lineCount(out) <= 10, `next steps ran to ${lineCount(out)} lines:\n${out}`);
      assert.ok(out.trim().length > 0);
    }
  }
});
