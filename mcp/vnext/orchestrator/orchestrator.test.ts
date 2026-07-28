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
