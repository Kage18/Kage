import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readWorkItem, writeWorkItem, listWorkItemRecords, dependencyOrder } from "./work-items.js";
import { buildReceiptHistory } from "./receipt-history.js";
import { estimateWork } from "./estimate.js";

function project(): string {
  return mkdtempSync(join(tmpdir(), "kage-workitem-"));
}

const WORK_A = "repo:x:proposal:make-tenantlimit-configurable-1";
const WORK_B = "repo:x:proposal:extract-billing-client-2";

test("an item with no record reads as empty rather than missing", () => {
  const dir = project();
  const record = readWorkItem(dir, WORK_A);
  assert.equal(record.assignee, null);
  assert.deepEqual(record.depends_on, []);
  assert.equal(record.contract, null);
  assert.deepEqual(record.receipt_ids, []);
});

// Work ids carry colons and slashes, so they are not filenames. A round trip through the
// store is the thing that breaks first if that is handled by sanitising instead of encoding.
test("a work id with colons round-trips through the store", () => {
  const dir = project();
  writeWorkItem(dir, WORK_A, { assignee: "alice" });
  assert.equal(readWorkItem(dir, WORK_A).assignee, "alice");
  assert.deepEqual(listWorkItemRecords(dir).map((r) => r.work_id), [WORK_A]);
});

test("assignee is separate from who holds the claim", () => {
  const dir = project();
  const record = writeWorkItem(dir, WORK_A, { assignee: "alice" });
  // `assignee` says who SHOULD do it. `claimed_by` lives on the packet and says who HAS it.
  // Collapsing them would make an unclaimed assignment indistinguishable from an unassigned one.
  assert.equal(record.assignee, "alice");
  assert.equal("claimed_by" in record, false);
});

test("receipts append and de-duplicate — an actual is never counted twice", () => {
  const dir = project();
  writeWorkItem(dir, WORK_A, { add_receipt_ids: ["r1", "r2"] });
  const record = writeWorkItem(dir, WORK_A, { add_receipt_ids: ["r2", "r3"] });
  assert.deepEqual(record.receipt_ids, ["r1", "r2", "r3"]);
});

test("a hand-edited or torn file degrades to empty instead of taking the board down", () => {
  const dir = project();
  mkdirSync(join(dir, ".agent_memory", "work", "items"), { recursive: true });
  writeFileSync(join(dir, ".agent_memory", "work", "items", `${encodeURIComponent(WORK_A)}.json`), "{ not json", "utf8");
  assert.deepEqual(readWorkItem(dir, WORK_A).receipt_ids, []);
});

// ── Dependencies ────────────────────────────────────────────────────────────

test("dependencies order the plan, and a dependency outside the set is ignored", () => {
  const dir = project();
  writeWorkItem(dir, WORK_A, { depends_on: [WORK_B, "repo:x:proposal:not-planned"] });
  writeWorkItem(dir, WORK_B, {});
  const { order, cycle } = dependencyOrder(listWorkItemRecords(dir));
  assert.deepEqual(cycle, []);
  assert.ok(order.indexOf(WORK_B) < order.indexOf(WORK_A), "a dependency lands before its dependent");
});

// Silently choosing an order for work that depends on itself hands a lead a plan that cannot
// be executed and looks perfectly fine.
test("a dependency cycle is reported, never quietly broken", () => {
  const dir = project();
  writeWorkItem(dir, WORK_A, { depends_on: [WORK_B] });
  writeWorkItem(dir, WORK_B, { depends_on: [WORK_A] });
  const { order, cycle } = dependencyOrder(listWorkItemRecords(dir));
  assert.deepEqual(order, [], "no order is offered for an unexecutable plan");
  assert.ok(cycle.includes(WORK_A) && cycle.includes(WORK_B), "the cycle names its members");
});

// ── The estimation actuals loop ─────────────────────────────────────────────

test("linked receipts become the history an estimate can finally match against", () => {
  const dir = project();
  // Three finished items of the same shape, each with a measured receipt.
  for (const [id, tokens] of [["w1", 10_000], ["w2", 30_000], ["w3", 20_000]] as const) {
    writeWorkItem(dir, id, { add_receipt_ids: [`r-${id}`] });
  }
  const history = buildReceiptHistory(dir, {
    blastByWorkId: new Map([
      ["w1", ["a.ts", "b.ts", "c.ts"]],
      ["w2", ["a.ts", "b.ts", "c.ts"]],
      ["w3", ["a.ts", "b.ts", "c.ts"]],
    ]),
    receiptsById: new Map([
      ["r-w1", { receipt_id: "r-w1", total_tokens: 10_000 }],
      ["r-w2", { receipt_id: "r-w2", total_tokens: 30_000 }],
      ["r-w3", { receipt_id: "r-w3", total_tokens: 20_000 }],
    ]),
  });
  assert.equal(history.length, 3);

  // The whole point: an estimate that used to say "none" can now say "matched".
  const estimate = estimateWork({ blast_paths: ["a.ts", "b.ts", "c.ts"], dependents: 0 }, history);
  assert.equal(estimate.confidence, "matched");
  assert.equal(estimate.tokens_p50, 20_000);
  assert.ok(estimate.basis.length > 0, "an estimate must cite the actuals it came from");
});

// A receipt with no work item is SESSION cost, not the cost of a unit of work. Averaging the
// two turns "how big is this change" into "how much did this agent burn today".
test("a receipt with no blast set is excluded, not averaged in", () => {
  const dir = project();
  writeWorkItem(dir, "w1", { add_receipt_ids: ["r1"] });
  const history = buildReceiptHistory(dir, {
    blastByWorkId: new Map(),
    receiptsById: new Map([["r1", { receipt_id: "r1", total_tokens: 99_000 }]]),
  });
  assert.deepEqual(history, []);
});

// Recording a zero would drag the median toward "free".
test("an item whose receipts were all unmeasured yields no sample", () => {
  const dir = project();
  writeWorkItem(dir, "w1", { add_receipt_ids: ["r1"] });
  const history = buildReceiptHistory(dir, {
    blastByWorkId: new Map([["w1", ["a.ts"]]]),
    receiptsById: new Map([["r1", { receipt_id: "r1", total_tokens: null }]]),
  });
  assert.deepEqual(history, []);
});

test("one item is one data point, however many requests it took", () => {
  const dir = project();
  writeWorkItem(dir, "w1", { add_receipt_ids: ["r1", "r2", "r3"] });
  const history = buildReceiptHistory(dir, {
    blastByWorkId: new Map([["w1", ["a.ts"]]]),
    receiptsById: new Map([
      ["r1", { receipt_id: "r1", total_tokens: 1_000 }],
      ["r2", { receipt_id: "r2", total_tokens: 2_000 }],
      ["r3", { receipt_id: "r3", total_tokens: 3_000 }],
    ]),
  });
  assert.equal(history.length, 1, "an item that took six requests is one point about SIZE");
  assert.equal(history[0].total_tokens, 6_000, "its cost is the sum of what it actually spent");
  assert.equal(history[0].sessions, 3);
});
