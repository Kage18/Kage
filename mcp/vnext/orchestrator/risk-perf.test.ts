// A performance contract, enforced as a correctness test.
//
// `kageRisk` took 118 SECONDS on the Kage repo itself, which made `kage plan` — the command
// that turns an intent into work items — never return. The cause was not slow git: it was
// `gitCoChangePartnersForPath` spawning `1 + 80` git processes PER TARGET, so 18 changed
// files cost roughly 1,460 process spawns.
//
// Counting spawns rather than timing makes this a deterministic guard: a wall-clock budget
// would be flaky on a loaded machine, while "how many child processes does one call fork"
// is exactly the property that regressed and is stable everywhere.

import test from "node:test";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { capture, kageRisk } from "../../kernel.js";
import { deriveWorkState } from "./derive.js";
import { buildWorkBoard } from "./board.js";
import { appendCommandEvent } from "./events.js";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
}

// A repo with real history: two files that always change together, one that never does.
function historyRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-risk-perf-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.name", "Risk Tester");
  git(dir, "config", "user.email", "r@t.dev");
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "risk-fixture" }), "utf8");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "initial");

  for (let i = 0; i < 12; i += 1) {
    writeFileSync(join(dir, "src", "limits.ts"), `export const tenantLimit = ${i};\n`, "utf8");
    writeFileSync(join(dir, "src", "limits.test.ts"), `// covers limits ${i}\n`, "utf8");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", `change limits ${i}`);
  }
  writeFileSync(join(dir, "src", "unrelated.ts"), "export const other = 1;\n", "utf8");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "unrelated");
  return dir;
}

function countingGitSpawns<T>(run: () => T): { result: T; spawns: number } {
  const original = childProcess.execFileSync;
  let spawns = 0;
  (childProcess as { execFileSync: typeof childProcess.execFileSync }).execFileSync = ((
    file: string,
    ...rest: unknown[]
  ) => {
    if (file === "git") spawns += 1;
    return (original as (...args: unknown[]) => unknown)(file, ...rest);
  }) as typeof childProcess.execFileSync;
  try {
    return { result: run(), spawns };
  } finally {
    (childProcess as { execFileSync: typeof childProcess.execFileSync }).execFileSync = original;
  }
}

test("risk over several targets does not fork a git process per commit per file", () => {
  const project = historyRepo();
  const targets = ["src/limits.ts", "src/limits.test.ts", "src/unrelated.ts"];

  const { result, spawns } = countingGitSpawns(() => kageRisk(project, targets));

  // The old shape was ~(1 + 80) spawns per target for co-change alone. A shared history pass
  // makes the cost a small constant plus a little per target — the budget is deliberately
  // generous so this fails only on a return to per-commit forking.
  assert.ok(
    spawns <= 12 * targets.length,
    `risk forked ${spawns} git processes for ${targets.length} targets — the per-commit storm is back`,
  );

  // The speed must not have cost the signal. Co-change is the thing the storm was computing.
  const limits = result.targets["src/limits.ts"];
  assert.ok(limits, "the named target must be assessed");
  assert.equal(
    limits.git.co_change_partners.some((partner: { file_path: string }) => partner.file_path === "src/limits.test.ts"),
    true,
    "a file changed in every one of the same commits must be reported as a co-change partner",
  );
  assert.equal(
    limits.git.co_change_partners.some((partner: { file_path: string }) => partner.file_path === "src/unrelated.ts"),
    false,
    "a file that never changed alongside the target must not be a partner",
  );
});

// The board re-derives on every request, so its git cost is paid per page load. It forked a
// `git diff-tree` per commit to learn which files changed — up to 20 branches x 30 commits =
// 600 extra processes — and `GET /v2/work` took 6-7 seconds every single time. `--name-only`
// answers the same question inside the log call that was already being made.
test("deriving the board does not fork a git process per commit", () => {
  const project = historyRepo();
  capture({
    projectDir: project,
    type: "proposal",
    title: "Make tenantLimit configurable",
    body: "We should let each tenant configure tenantLimit so high-volume tenants can tune it themselves.",
    paths: ["src/limits.ts"],
  });

  const { result, spawns } = countingGitSpawns(() => deriveWorkState(project));

  // The fixture has 13 commits on one branch. Per-commit forking would put this in the dozens.
  assert.ok(spawns <= 10, `derivation forked ${spawns} git processes — the per-commit storm is back`);
  // Correctness is not traded for it: blast paths still come through, which is what
  // weak correlation is matched on.
  assert.equal(result.items.length, 1);
});

// Caching the board is only acceptable if it can never serve a stale answer, so the signature
// covers every input the board reads: branch tips, the command log, and per-file packet
// mtimes. Per-FILE deliberately, because a directory's mtime does not change when a file
// inside it is rewritten in place.
//
// The two assertions below are the ones the board cache actually governs. An in-place packet
// edit is NOT asserted here, and that is not an oversight: `loadApprovedPackets` memoizes in
// the kernel, so a packet rewritten behind Kage's back stays stale one layer down no matter
// what this cache does. The packet mtime remains in the signature as correct, cheap defence
// for when that layer is fixed.
test("the board cache is invalidated by new commits and new commands", () => {
  const project = historyRepo();
  const workId = capture({
    projectDir: project,
    type: "proposal",
    title: "Make tenantLimit configurable",
    body: "We should let each tenant configure tenantLimit so high-volume tenants can tune it themselves.",
    paths: ["src/limits.ts"],
  }).packet!.id;

  assert.equal(buildWorkBoard(project).items[0].stage, "proposed");

  // A command must be seen immediately — this is the click-to-render path in the app.
  appendCommandEvent(project, { kind: "task.claimed", work_id: workId, actor: "alice" });
  assert.equal(buildWorkBoard(project).items[0].stage, "claimed", "a new command must invalidate the cache");

  // A commit must be seen too.
  git(project, "checkout", "-qb", "feat/limits-work");
  writeFileSync(join(project, "src", "limits.ts"), "export const tenantLimit = 99;\n", "utf8");
  git(project, "add", "-A");
  git(project, "commit", "-qm", `feat: work\n\n[kage:${workId}]`);
  assert.equal(buildWorkBoard(project).items[0].stage, "building", "a new commit must invalidate the cache");
});

// Global hotspots were empty in EVERY install and nothing reported it: the query passed
// `--format=__KAGE_COMMIT__`, git reads a format with no `%` as the name of a built-in format,
// so every call exited "invalid --pretty format" — and the error was swallowed. A test that
// only checked the field existed would have passed throughout. This one requires content.
test("a repository with recent churn reports hotspots rather than silently nothing", () => {
  const project = historyRepo();
  // The fixture's two files otherwise tie at 12 commits and rank alphabetically. Give the
  // target a clear lead so "ranks first" tests the ranking rather than the tie-break.
  for (let i = 0; i < 3; i += 1) {
    writeFileSync(join(project, "src", "limits.ts"), `export const tenantLimit = ${100 + i};\n`, "utf8");
    git(project, "add", "-A");
    git(project, "commit", "-qm", `tune limits ${i}`);
  }
  const report = kageRisk(project, ["src/limits.ts"]);

  assert.ok(
    report.global_hotspots.length > 0,
    "a repo whose files were just committed 12 times must have hotspots",
  );
  const top = report.global_hotspots[0];
  assert.equal(top.file_path, "src/limits.ts", "the most-changed file ranks first");
  assert.ok(top.commit_count_90d >= 12, `expected the real churn count, got ${top.commit_count_90d}`);
  assert.ok(top.primary_owner, "a hotspot names who owns it");
});
