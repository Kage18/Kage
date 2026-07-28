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

import { kageRisk } from "../../kernel.js";

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
