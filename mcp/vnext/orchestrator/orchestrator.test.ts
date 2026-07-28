import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { capture, claimWorkItem } from "../../kernel.js";
import { appendCommandEvent, readCommandEvents } from "./events.js";
import { correlateCommit } from "./correlate.js";
import { deriveWorkState } from "./derive.js";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function tempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-orch-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.name", "Orch Tester");
  git(dir, "config", "user.email", "o@t.dev");
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "limits.ts"), "export const tenantLimit = 10;\n", "utf8");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "orch-fixture" }), "utf8");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "initial");
  return dir;
}

function seedWorkItem(project: string): string {
  const result = capture({
    projectDir: project,
    type: "proposal",
    title: "Make tenantLimit configurable",
    body: "We should let each tenant configure tenantLimit so high-volume tenants can tune it themselves.",
    paths: ["src/limits.ts"],
  });
  assert.equal(result.ok, true);
  return result.packet!.id;
}

// ── Command events ──────────────────────────────────────────────────────────

test("command events append to a log and read back in order", () => {
  const project = tempRepo();
  const first = appendCommandEvent(project, { kind: "task.claimed", work_id: "w1", actor: "alice" });
  const second = appendCommandEvent(project, { kind: "gate.approved", work_id: "w1", actor: "bob" });
  assert.notEqual(first.event_id, second.event_id);

  const events = readCommandEvents(project);
  assert.equal(events.length, 2);
  assert.equal(events[0].kind, "task.claimed");
  assert.equal(events[1].kind, "gate.approved");
  // Append-only means replay-stable: a second read returns the identical sequence.
  assert.deepEqual(readCommandEvents(project).map((e) => e.event_id), events.map((e) => e.event_id));
});

// ── Correlation ─────────────────────────────────────────────────────────────

test("correlation ranks trailer above branch name above blast overlap", () => {
  const workId = "repo:x:proposal:make-tenantlimit-configurable-1";
  const items = [{ work_id: workId, blast_paths: ["src/limits.ts"] }];

  // Explicit trailer: the strongest signal.
  const trailer = correlateCommit(
    { message: `feat: limit config\n\n[kage:${workId}]`, branch: "anything", changed_paths: [] },
    items,
  );
  assert.equal(trailer?.work_id, workId);
  assert.equal(trailer?.confidence, "explicit");

  // Branch slug containing the work item's slug: strong.
  const branch = correlateCommit(
    { message: "wip", branch: "feat/make-tenantlimit-configurable", changed_paths: [] },
    items,
  );
  assert.equal(branch?.work_id, workId);
  assert.equal(branch?.confidence, "strong");

  // Blast overlap alone: weak — recorded, but a transition must not fire from it.
  const weak = correlateCommit(
    { message: "tweak", branch: "misc", changed_paths: ["src/limits.ts"] },
    items,
  );
  assert.equal(weak?.work_id, workId);
  assert.equal(weak?.confidence, "weak");

  // Nothing matches: no correlation invented.
  const none = correlateCommit({ message: "docs", branch: "docs", changed_paths: ["README.md"] }, items);
  assert.equal(none, null);
});

// ── Derivation ──────────────────────────────────────────────────────────────

test("stages derive from commands and git evidence, and weak correlation never advances", () => {
  const project = tempRepo();
  const workId = seedWorkItem(project);

  // No commands, no branches: the item is proposed/ready.
  let state = deriveWorkState(project);
  let item = state.items.find((entry) => entry.work_id === workId);
  assert.ok(item);
  assert.equal(item!.derived_stage, "proposed");

  // Claim (a command, through the existing lock machinery) → claimed.
  assert.equal(claimWorkItem(project, workId, "alice").ok, true);
  appendCommandEvent(project, { kind: "task.claimed", work_id: workId, actor: "alice" });
  state = deriveWorkState(project);
  item = state.items.find((entry) => entry.work_id === workId);
  assert.equal(item!.derived_stage, "claimed");

  // A commit on a correlated branch → building. Derived only: the packet file is untouched.
  git(project, "checkout", "-qb", "feat/make-tenantlimit-configurable");
  writeFileSync(join(project, "src", "limits.ts"), "export const tenantLimit = 20;\n", "utf8");
  git(project, "add", "-A");
  git(project, "commit", "-qm", `feat: start limit work\n\n[kage:${workId}]`);
  state = deriveWorkState(project);
  item = state.items.find((entry) => entry.work_id === workId);
  assert.equal(item!.derived_stage, "building");
  // Every transition names the evidence that caused it.
  assert.ok(item!.stage_log.every((step) => step.caused_by.length > 0));
  assert.ok(item!.stage_log.some((step) => step.stage === "building"));

  // A weak-correlation commit on an unrelated item must not move that item.
  const otherId = capture({
    projectDir: project,
    type: "proposal",
    title: "Unrelated logging work",
    body: "We should improve logging in the limits module for observability reasons.",
    paths: ["src/limits.ts"],
  }).packet!.id;
  state = deriveWorkState(project);
  const other = state.items.find((entry) => entry.work_id === otherId);
  // Same blast path was touched by the branch above, but only weakly correlated:
  assert.equal(other!.derived_stage, "proposed");
});

test("gate approval is a command, and self-approval is rejected at validation", () => {
  const project = tempRepo();
  const workId = seedWorkItem(project);
  assert.equal(claimWorkItem(project, workId, "alice").ok, true);
  appendCommandEvent(project, { kind: "task.claimed", work_id: workId, actor: "alice" });

  // The claimant cannot approve their own gate — validated at append, not downstream.
  assert.throws(
    () => appendCommandEvent(project, { kind: "gate.approved", work_id: workId, actor: "alice" }),
    /self.approval/i,
  );
  // A different actor can.
  const approved = appendCommandEvent(project, { kind: "gate.approved", work_id: workId, actor: "bob" });
  assert.equal(approved.kind, "gate.approved");
});

// ── One writer for stage decisions ──────────────────────────────────────────
// The command log and the packet store were drifting: a claim made through the app
// appended an event but never moved the packet, so the board showed `claimed` with
// `claimed_by: null` — the derived stage and the stored owner disagreeing on real data.

test("a command event also applies the packet transition, once, idempotently", () => {
  const project = tempRepo();
  const workId = seedWorkItem(project);

  // The app path: an event alone used to leave the packet untouched.
  appendCommandEvent(project, { kind: "task.claimed", work_id: workId, actor: "bob" });

  const state = deriveWorkState(project);
  const item = state.items.find((entry) => entry.work_id === workId);
  assert.equal(item?.derived_stage, "claimed");
  assert.equal(item?.claimed_by, "bob", "the stored owner must agree with the derived stage");
});

test("the CLI path stays correct when the kernel already transitioned", () => {
  const project = tempRepo();
  const workId = seedWorkItem(project);

  // `kage claim` transitions the packet first, then logs the event. Appending must not
  // fail or double-transition on an already-claimed item.
  assert.equal(claimWorkItem(project, workId, "alice").ok, true);
  appendCommandEvent(project, { kind: "task.claimed", work_id: workId, actor: "alice" });

  const item = deriveWorkState(project).items.find((entry) => entry.work_id === workId);
  assert.equal(item?.derived_stage, "claimed");
  assert.equal(item?.claimed_by, "alice");
});

// ── Merge closes the loop ───────────────────────────────────────────────────
// `done` required a human gate command, so an item whose work actually shipped sat at
// `building` forever. Merging is observable: if the correlated commits are reachable from
// the default branch, the work landed — no command, no click.

// ── The branch cap must never hide the branch you are standing on ───────────
// Found on the Kage repo itself: 92 branches, a cap of 20, and branches read in the order
// `for-each-ref` returned them — alphabetical. The branch actually being worked on sorted
// well past the cap, so the developer's own commits were invisible to the board and the item
// sat at `claimed` while the work was plainly happening.

test("the checked-out branch is scanned even past the branch cap", () => {
  const project = tempRepo();
  const workId = seedWorkItem(project);
  assert.equal(claimWorkItem(project, workId, "alice").ok, true);
  appendCommandEvent(project, { kind: "task.claimed", work_id: workId, actor: "alice" });

  // Enough decoy branches to overflow the cap several times over, all sorting BEFORE the
  // working branch alphabetically so an alphabetical scan would never reach it.
  for (let i = 0; i < 40; i += 1) {
    git(project, "checkout", "-qb", `aaa-decoy-${String(i).padStart(3, "0")}`, "main");
  }

  git(project, "checkout", "-qb", "zzz-working-branch", "main");
  writeFileSync(join(project, "src", "limits.ts"), "export const tenantLimit = 42;\n", "utf8");
  git(project, "add", "-A");
  git(project, "commit", "-qm", `feat: real work\n\n[kage:${workId}]`);

  const item = deriveWorkState(project).items.find((entry) => entry.work_id === workId);
  assert.equal(
    item?.derived_stage,
    "building",
    "the branch that is checked out must be observed no matter how many others exist",
  );
});

// ── Verifying: the stage local git cannot see ───────────────────────────────
// A branch with an open PR is in review, which is a different decision for a lead than
// "still being written". Git alone cannot tell those apart — it needs a PR observer, so the
// observer is injected here rather than shelling out to `gh` in a test.

test("an open pull request on a correlated branch derives to verifying", () => {
  const project = tempRepo();
  const workId = seedWorkItem(project);
  assert.equal(claimWorkItem(project, workId, "alice").ok, true);
  appendCommandEvent(project, { kind: "task.claimed", work_id: workId, actor: "alice" });

  const branch = "feat/make-tenantlimit-configurable";
  git(project, "checkout", "-qb", branch);
  writeFileSync(join(project, "src", "limits.ts"), "export const tenantLimit = 20;\n", "utf8");
  git(project, "add", "-A");
  git(project, "commit", "-qm", `feat: configurable limit\n\n[kage:${workId}]`);

  // With no PR observer at all, the item is `building` — an absent observer costs derivation
  // DEPTH, never correctness.
  assert.equal(
    deriveWorkState(project).items.find((entry) => entry.work_id === workId)?.derived_stage,
    "building",
  );

  // With one, the same commits read as `verifying`.
  const withPr = deriveWorkState(project, { openPullRequestBranches: () => new Set([branch]) });
  const item = withPr.items.find((entry) => entry.work_id === workId);
  assert.equal(item?.derived_stage, "verifying");
  assert.ok(
    item?.stage_log.some((step) => step.stage === "verifying" && step.caused_by.length > 0),
    "the verifying step must name the PR branch that caused it",
  );
});

test("a merged branch is done even while its pull request still reads open", () => {
  const project = tempRepo();
  const workId = seedWorkItem(project);
  assert.equal(claimWorkItem(project, workId, "alice").ok, true);
  appendCommandEvent(project, { kind: "task.claimed", work_id: workId, actor: "alice" });

  const branch = "feat/make-tenantlimit-configurable";
  git(project, "checkout", "-qb", branch);
  writeFileSync(join(project, "src", "limits.ts"), "export const tenantLimit = 20;\n", "utf8");
  git(project, "add", "-A");
  git(project, "commit", "-qm", `feat: configurable limit\n\n[kage:${workId}]`);
  git(project, "checkout", "-q", "main");
  git(project, "merge", "-q", "--no-ff", "-m", "merge limit work", branch);

  // A stale PR listing must never drag a shipped item backwards: the merge is the stronger,
  // locally-verifiable fact and wins.
  const item = deriveWorkState(project, { openPullRequestBranches: () => new Set([branch]) })
    .items.find((entry) => entry.work_id === workId);
  assert.equal(item?.derived_stage, "done");
});

test("an item whose commits are merged into the default branch derives to done", () => {
  const project = tempRepo();
  const workId = seedWorkItem(project);
  assert.equal(claimWorkItem(project, workId, "alice").ok, true);
  appendCommandEvent(project, { kind: "task.claimed", work_id: workId, actor: "alice" });

  git(project, "checkout", "-qb", "feat/make-tenantlimit-configurable");
  writeFileSync(join(project, "src", "limits.ts"), "export const tenantLimit = 20;\n", "utf8");
  git(project, "add", "-A");
  git(project, "commit", "-qm", `feat: configurable limit\n\n[kage:${workId}]`);

  // Still on the branch, unmerged: building.
  assert.equal(
    deriveWorkState(project).items.find((entry) => entry.work_id === workId)?.derived_stage,
    "building",
  );

  // Merge it. Nobody runs a command; the work simply landed.
  git(project, "checkout", "-q", "main");
  git(project, "merge", "-q", "--no-ff", "-m", "merge limit work", "feat/make-tenantlimit-configurable");

  const item = deriveWorkState(project).items.find((entry) => entry.work_id === workId);
  assert.equal(item?.derived_stage, "done", "a merged branch means the work shipped");
  assert.ok(
    item?.stage_log.some((step) => step.stage === "done"),
    "the done step must name the merge that caused it",
  );
});
