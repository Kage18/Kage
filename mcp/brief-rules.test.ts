// Guards the brief's test-placement and coverage rules (mcp/delegation/brief.ts).
// New test file per the repo convention this same rule states — see brief.ts's
// "## Test placement" section.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileBrief, renderBrief } from "./delegation/brief.js";
import { createRun } from "./delegation/contract.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-brief-rules-"));
}

// Byte budget for the rendered brief on a minimal fixture task (no memories, no touch
// prediction, no steers). This is the floor the brief carries before any task-specific
// content is added — asserting it stays under a fixed budget keeps this section (and any
// future one) from growing unbounded without a deliberate change to the number below.
const RENDERED_BRIEF_BYTE_BUDGET = 6000;

test("renderBrief states the test-placement rule and puts delegation.test.ts off-limits", () => {
  const project = tempProject();
  const plan = compileBrief(project, "add a retry budget gate", "feature");
  const task = createRun(project, { intent: "x", type: "feature", agent: "stub" });
  const rendered = renderBrief(task, plan);

  assert.match(rendered, /## Test placement/);
  assert.match(rendered, /never append to `mcp\/delegation\.test\.ts`/);
  assert.match(rendered, /merge-conflict hotspot/);
});

test("renderBrief states the fails-without-the-change coverage rule and asks which test would fail on revert", () => {
  const project = tempProject();
  const plan = compileBrief(project, "add a retry budget gate", "feature");
  const task = createRun(project, { intent: "x", type: "feature", agent: "stub" });
  const rendered = renderBrief(task, plan);

  assert.match(rendered, /must ship with a test that FAILS if your change is reverted/);
  assert.match(rendered, /passes either way proves nothing/);
  assert.match(rendered, /which test would fail on revert/i);
});

test("renderBrief phrases the claim fence as required, not optional", () => {
  const project = tempProject();
  const plan = compileBrief(project, "do something", "chore");
  const task = createRun(project, { intent: "x", type: "chore", agent: "stub" });
  const rendered = renderBrief(task, plan);

  assert.match(rendered, /## The claim fence is required, not optional/);
  assert.match(rendered, /Skipping it is a failure, not a shortcut/);
  assert.match(rendered, /kage-claim-v1/);
});

test("the rendered brief stays under its byte budget for a minimal fixture task", () => {
  const project = tempProject();
  const plan = compileBrief(project, "do something small", "chore");
  const task = createRun(project, { intent: "do something small", type: "chore", agent: "stub" });
  const rendered = renderBrief(task, plan);

  assert.ok(
    Buffer.byteLength(rendered, "utf8") < RENDERED_BRIEF_BYTE_BUDGET,
    `brief grew to ${Buffer.byteLength(rendered, "utf8")} bytes, over the ${RENDERED_BRIEF_BYTE_BUDGET}-byte budget`,
  );
});
