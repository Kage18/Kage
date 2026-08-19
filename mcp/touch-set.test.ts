// The brief's predicted touch set (mcp/delegation/brief.ts, compileBrief) must be
// correlated with the actual request, not with whatever memory recall's loose text
// match happened to surface. Before this fix, memory citations went into the touch
// set first (up to 3 paths x 5 recalled memories = 15 candidates for 8 slots), so the
// code graph's answer for the intent was routinely crowded out before it was even
// consulted, and neither surface was filtered for relevance to THIS request. Live
// probes against the daemon showed a one-file rename intent forecasting 26 unrelated
// dependents, a one-line comment intent forecasting 20, and a one-word README typo
// forecasting 50 — with the actually-named file absent from the forecast every time.
//
// REGRESSION: every test below fails on the pre-fix compileBrief. Reverting the
// namedTouches/correlationTerms/pathCorrelates changes in brief.ts (and the
// evidenceTouches-based blast basis in preflight.ts) reproduces the crowding and the
// uncorrelated matches this file exists to catch.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileBrief } from "./delegation/brief.js";
import { preflightForecast } from "./delegation/preflight.js";
import { capture } from "./kernel.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempGitProject(): string {
  const project = mkdtempSync(join(tmpdir(), "kage-touch-set-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeFileSync(join(project, "README.md"), "# fixture\n\nSecond paragraph, unchanged for now.\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

function commitAll(project: string, message: string): void {
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", message], { cwd: project, stdio: "ignore", env: GIT_ENV });
}

test("an intent naming a full repo path yields that path in the touch set", () => {
  const project = tempGitProject();
  mkdirSync(join(project, "mcp", "delegation"), { recursive: true });
  writeFileSync(join(project, "mcp", "delegation", "verify.ts"), "export function renderClaimCard() { return ''; }\n", "utf8");
  commitAll(project, "add verify.ts");

  const plan = compileBrief(
    project,
    "Rename the local variable inside renderClaimCard in mcp/delegation/verify.ts. Nothing else changes.",
    "bugfix",
  );
  assert.ok(
    plan.touches.includes("mcp/delegation/verify.ts"),
    `the named file must be in the touch set, got: ${plan.touches.join(", ")}`,
  );
  assert.ok(plan.evidenceTouches.includes("mcp/delegation/verify.ts"), "a named path is direct evidence, not a graph inference");
});

test("an intent naming a bare filename (no directory) resolves it against the real tree", () => {
  const project = tempGitProject();
  mkdirSync(join(project, "mcp", "delegation"), { recursive: true });
  writeFileSync(join(project, "mcp", "delegation", "app-styles.ts"), "export const styles = '';\n", "utf8");
  commitAll(project, "add app-styles.ts");

  const plan = compileBrief(
    project,
    "Add a comment header to the top of app-styles.ts and change nothing else at all.",
    "chore",
  );
  assert.ok(
    plan.touches.includes("mcp/delegation/app-styles.ts"),
    `the bare filename must resolve to the real tracked file, got: ${plan.touches.join(", ")}`,
  );
});

test("a stem named as \"the X file\" resolves the same way", () => {
  const project = tempGitProject();
  mkdirSync(join(project, "mcp", "delegation"), { recursive: true });
  writeFileSync(join(project, "mcp", "delegation", "room-pty.ts"), "export const pty = 1;\n", "utf8");
  commitAll(project, "add room-pty.ts");

  const plan = compileBrief(project, "Something is wrong with the room-pty file, please look at it.", "bugfix");
  assert.ok(
    plan.touches.includes("mcp/delegation/room-pty.ts"),
    `"the room-pty file" must resolve to the tracked file, got: ${plan.touches.join(", ")}`,
  );
});

test("a memory packet citing another memory packet never leaks .agent_memory/ into the touch set", () => {
  const project = tempGitProject();
  // A packet whose OWN citation includes a path under .agent_memory/ — exactly the
  // shape a real repo's memory-of-memory citations take. The path string correlates
  // with the intent on purpose (it shares "bar"/"module"), so only the explicit
  // .agent_memory/ guard — not the correlation filter — can be what excludes it.
  const learned = capture({
    projectDir: project,
    title: "Bar module packaging quirk",
    body: "The bar module needs special packaging; see src/bar.ts for details.",
    type: "decision",
    paths: ["src/bar.ts", ".agent_memory/packets/bar-module-packaging-quirk.md"],
  });
  assert.equal(learned.ok, true);
  commitAll(project, "memory");

  const plan = compileBrief(project, "fix the bar module packaging", "bugfix");
  assert.ok(plan.memories.length >= 1, "the bar-module memory should be recalled");
  for (const path of plan.touches) {
    assert.ok(!path.startsWith(".agent_memory/"), `touch set must never offer Kage's own storage, got: ${path}`);
  }
  for (const path of plan.evidenceTouches) {
    assert.ok(!path.startsWith(".agent_memory/"), `evidence touches must never offer Kage's own storage, got: ${path}`);
  }
});

test("the code graph still contributes touches when the intent names no path at all", () => {
  const project = tempGitProject();
  const plan = compileBrief(project, "make the retry helper idempotent", "bugfix");
  assert.ok(
    plan.touches.includes("src/retry.ts"),
    `the graph's own answer for the intent must still surface, got: ${plan.touches.join(", ")}`,
  );
  // It's an inference from the intent's terms, not direct evidence — it must not be
  // promoted into evidenceTouches, which blast-radius counting treats as ground truth.
  assert.ok(!plan.evidenceTouches.includes("src/retry.ts"), "a graph-only match is not direct evidence");
});

test("many memory citations cannot crowd the graph's answer out of the touch set", () => {
  const project = tempGitProject();
  // Five memories, three paths apiece — 15 candidates, none of them correlated with
  // this request — sized to reproduce the exact crowding the live daemon showed: by
  // the old first-memory-then-graph fill order, these alone would have filled every
  // one of the 8 slots before the graph was ever asked.
  for (let i = 0; i < 5; i++) {
    const learned = capture({
      projectDir: project,
      title: `Unrelated packaging note ${i}`,
      body: "Notes about packaging and release tooling, unrelated to this task.",
      type: "decision",
      paths: [`pkg/unrelated-${i}-a.ts`, `pkg/unrelated-${i}-b.ts`, `pkg/unrelated-${i}-c.ts`],
    });
    assert.equal(learned.ok, true);
  }
  commitAll(project, "memory");

  const plan = compileBrief(project, "make the retry helper idempotent", "bugfix");
  assert.ok(
    plan.touches.includes("src/retry.ts"),
    `the graph must still get a slot despite 15 uncorrelated memory candidates, got: ${plan.touches.join(", ")}`,
  );
});

test("a low-signal intent degrades to the honest empty touch set instead of a confident wrong list", () => {
  const project = tempGitProject();
  const plan = compileBrief(project, "improve the onboarding docs experience for new contributors", "chore");
  assert.deepEqual(plan.touches, [], `no named path, no correlated memory, no correlated graph match — expected [], got: ${plan.touches.join(", ")}`);
});

test("REGRESSION: the README typo intent must not forecast dozens of unrelated dependents", () => {
  const project = tempGitProject();
  // A memory that would have crowded the old touch set — its cited paths share no real
  // term with "fix a typo in README", so a correlated compiler must not offer them.
  const learned = capture({
    projectDir: project,
    title: "Retry timing note",
    body: "src/retry.ts must back off before retrying the payment call.",
    type: "decision",
    paths: ["src/retry.ts"],
  });
  assert.equal(learned.ok, true);
  commitAll(project, "memory");

  const intent = "Fix a typo in the second paragraph of README.md. One word.";
  const plan = compileBrief(project, intent, "chore");
  assert.ok(plan.touches.includes("README.md"), `README.md itself, being named, must be the prediction, got: ${plan.touches.join(", ")}`);
  assert.ok(!plan.touches.includes("src/retry.ts"), "an uncorrelated memory citation must not ride along into the touch set");

  const forecast = preflightForecast(project, intent, "chore");
  assert.ok(forecast, "a named, resolved file is evidence enough to forecast");
  assert.ok(
    !forecast!.blast || forecast!.blast.dependents < 5,
    `a one-word README typo must not forecast a large blast radius, got: ${JSON.stringify(forecast!.blast)}`,
  );
});
