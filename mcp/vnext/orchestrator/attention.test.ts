import test from "node:test";
import assert from "node:assert/strict";

import { deriveAttention, attachBlast, type AttentionInputs } from "./attention.js";
import { estimateWork, radiusClass, type ReceiptSample } from "./estimate.js";
import type { DerivedWorkItem } from "./derive.js";

function workItem(overrides: Partial<DerivedWorkItem>): DerivedWorkItem {
  return {
    work_id: "w1",
    title: "Some work",
    stored_stage: "proposed",
    claimed_by: null,
    derived_stage: "proposed",
    stage_log: [{ stage: "proposed", at: "2026-07-01T00:00:00.000Z", caused_by: ["packet:w1"] }],
    correlated_commits: [],
    weak_evidence: 0,
    ...overrides,
  };
}

const NOW = "2026-07-27T00:00:00.000Z";

test("attention: commits on unclaimed work outrank everything else present", () => {
  const inputs: AttentionInputs = {
    now: NOW,
    work_items: [
      workItem({
        work_id: "w-unclaimed",
        title: "Rate limit config",
        correlated_commits: [{ hash: "abc123", branch: "feat/rate-limit-config", confidence: "strong" }],
      }),
      attachBlast(
        workItem({
          work_id: "w-parked",
          title: "Old cleanup",
          claimed_by: "alice",
          derived_stage: "claimed",
          stage_log: [
            { stage: "proposed", at: "2026-06-01T00:00:00.000Z", caused_by: ["packet:w-parked"] },
            { stage: "claimed", at: "2026-06-10T00:00:00.000Z", caused_by: ["cmd-1"] },
          ],
        }),
        ["src/cleanup.ts"],
      ),
    ],
    contradictions: [],
    stale_critical: [{ packet_id: "p-stale", title: "Old runbook", reason: "cited code moved" }],
  };

  const queue = deriveAttention(inputs);
  assert.equal(queue[0].kind, "unclaimed_building");
  assert.match(queue[0].summary, /nobody has claimed/);
  // The parked item: claimed 2026-06-10, now 2026-07-27 → 47 idle days, present but below.
  assert.ok(queue.some((item) => item.kind === "parked" && /47 days/.test(item.summary)));
  assert.ok(queue.some((item) => item.kind === "stale_critical"));
  // Severity ordering is monotone — the list arrives ready to render.
  for (let i = 1; i < queue.length; i++) assert.ok(queue[i - 1].severity >= queue[i].severity);
});

test("attention: two claimed items sharing blast paths raise an overlap warning", () => {
  const a = attachBlast(
    workItem({ work_id: "w-a", title: "Limit middleware", claimed_by: "alice", derived_stage: "claimed" }),
    ["src/limits.ts", "src/middleware.ts"],
  );
  const b = attachBlast(
    workItem({ work_id: "w-b", title: "Tenant overrides", claimed_by: "bob", derived_stage: "claimed" }),
    ["src/limits.ts"],
  );
  const queue = deriveAttention({ now: NOW, work_items: [a, b], contradictions: [], stale_critical: [] });
  const overlap = queue.find((item) => item.kind === "overlap_warning");
  assert.ok(overlap, "expected an overlap warning");
  assert.match(overlap!.summary, /src\/limits\.ts/);
  assert.deepEqual(overlap!.actions, ["sequence them", "merge them"]);
});

test("estimation: matched class uses neighbors and cites them; cold start says so; empty refuses", () => {
  assert.equal(radiusClass({ blast_paths: ["a", "b"], dependents: 0 }), "S");
  assert.equal(radiusClass({ blast_paths: ["a", "b", "c"], dependents: 4 }), "M");
  assert.equal(radiusClass({ blast_paths: Array(10).fill("x"), dependents: 3 }), "L");

  const history: ReceiptSample[] = [
    { receipt_id: "r1", radius_class: "M", total_tokens: 10_000, sessions: 1 },
    { receipt_id: "r2", radius_class: "M", total_tokens: 30_000, sessions: 2 },
    { receipt_id: "r3", radius_class: "M", total_tokens: 20_000, sessions: 2 },
    { receipt_id: "r4", radius_class: "S", total_tokens: 4_000, sessions: 1 },
  ];

  const matched = estimateWork({ blast_paths: ["a", "b", "c"], dependents: 2 }, history);
  assert.equal(matched.confidence, "matched");
  assert.equal(matched.tokens_p50, 20_000);
  assert.ok(matched.tokens_p90 >= matched.tokens_p50);
  assert.deepEqual([...matched.basis].sort(), ["r1", "r2", "r3"]);

  // Only one L sample would exist — cold start scales global history and admits it.
  const cold = estimateWork({ blast_paths: Array(12).fill("x"), dependents: 4 }, history);
  assert.equal(cold.confidence, "cold_start");
  assert.ok(cold.tokens_p50 > 0);
  assert.ok(cold.basis.length > 0);

  // No history: no invented numbers.
  const none = estimateWork({ blast_paths: ["a"], dependents: 0 }, []);
  assert.equal(none.confidence, "none");
  assert.equal(none.tokens_p50, 0);
});
