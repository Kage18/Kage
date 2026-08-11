import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { appendCommandEvent } from "./events.js";
import { buildTimeline, timelineCoverage } from "./timeline.js";

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-timeline-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  return dir;
}

const WORK = "repo:x:proposal:one";
const OTHER = "repo:x:proposal:two";

test("decisions and observations arrive in one ordered timeline, each naming its store", () => {
  const dir = repo();
  appendCommandEvent(dir, { kind: "task.claimed", work_id: WORK, actor: "alice" });

  const entries = buildTimeline(dir, {
    inputs: {
      git: [{ hash: "abc12345", branch: "feat/one", at: "2026-07-28T10:00:00.000Z", work_id: WORK }],
      wire: [{ event_id: "ev-1", type: "tool_result", at: "2026-07-28T09:00:00.000Z" }],
    },
  });

  // Every store contributed, and each entry says which one it came from — a reader can always
  // tell a decision someone MADE from something the machine OBSERVED.
  assert.deepEqual(timelineCoverage(entries), { command: 1, wire: 1, git: 1 });
  assert.deepEqual([...new Set(entries.map((e) => e.source))].sort(), ["command", "git", "wire"]);

  // Ordered by time across stores, which is the thing neither store could do alone.
  const times = entries.map((e) => e.ts);
  assert.deepEqual([...times].sort(), times);
});

test("a decision reads as prose, not as an event kind", () => {
  const dir = repo();
  appendCommandEvent(dir, { kind: "task.claimed", work_id: WORK, actor: "alice" });
  const [entry] = buildTimeline(dir);
  assert.equal(entry.summary, "alice claimed the work");
  assert.equal(entry.actor, "alice");
});

test("an observation has no actor, because nobody actors a tool result", () => {
  const dir = repo();
  const entries = buildTimeline(dir, {
    inputs: { wire: [{ event_id: "ev-1", type: "tool_result", at: "2026-07-28T09:00:00.000Z" }] },
  });
  assert.equal(entries[0].actor, null);
  assert.equal(entries[0].source, "wire");
});

test("filtering to one work item excludes another item's decisions and commits", () => {
  const dir = repo();
  appendCommandEvent(dir, { kind: "task.claimed", work_id: WORK, actor: "alice" });
  appendCommandEvent(dir, { kind: "task.claimed", work_id: OTHER, actor: "bob" });

  const entries = buildTimeline(dir, {
    work_ref: WORK,
    inputs: {
      git: [
        { hash: "aaa", branch: "feat/one", at: "2026-07-28T10:00:00.000Z", work_id: WORK },
        { hash: "bbb", branch: "feat/two", at: "2026-07-28T11:00:00.000Z", work_id: OTHER },
      ],
    },
  });
  // The other item's commit must be absent, and this item's present.
  assert.equal(entries.some((e) => e.ref === "aaa"), true, "this item's commit is included");
  assert.equal(entries.every((e) => e.work_ref === WORK), true);
  assert.equal(entries.some((e) => e.ref === "bbb"), false);
});

// The rule that keeps this honest. Wire observations are session-scoped, not item-scoped.
// Attributing a tool result to a work item on timing alone would be a GUESS — and the
// correlation ladder already refuses to move a stage on weak evidence, so smuggling a
// timing-based link in here would break the same rule from a different direction.
test("a session observation is never attributed to a work item by timing", () => {
  const dir = repo();
  appendCommandEvent(dir, { kind: "task.claimed", work_id: WORK, actor: "alice" });
  const entries = buildTimeline(dir, {
    work_ref: WORK,
    // An observation landing in the middle of the work, which timing alone would happily claim.
    inputs: { wire: [{ event_id: "ev-1", type: "file_change", at: "2026-07-28T10:30:00.000Z" }] },
  });
  assert.equal(entries.some((e) => e.source === "wire"), false, "no guessed attribution");
});

test("an empty repository yields an empty timeline, not an error", () => {
  const dir = repo();
  assert.deepEqual(buildTimeline(dir), []);
  assert.deepEqual(timelineCoverage([]), { command: 0, wire: 0, git: 0 });
});
