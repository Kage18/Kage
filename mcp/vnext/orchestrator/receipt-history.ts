// The estimation actuals loop — closing the last honest gap on the Work board.
//
// Every estimate has always read `confidence: "none"` because `receiptHistory()` hard-returned
// `[]`. That was not laziness: receipts are measured per agent SESSION, work is tracked per
// ITEM, and NOTHING joined the two. Without a join there is no actual, and without an actual
// there is nothing to score an estimate against. Inventing one would have been the dishonest
// alternative, so the board said "none" for months instead.
//
// `WorkItemRecord.receipt_ids` is that join. This turns it into the sample set the estimator
// already knew how to consume.
//
// The rule that keeps this honest: a receipt counts ONLY when it is linked to an item whose
// blast radius is known. A receipt with no item is session cost, not the cost of a unit of
// work, and averaging the two would quietly turn "how big is this change" into "how much did
// this agent burn today".

import { radiusClass, type ReceiptSample } from "./estimate.js";
import { listWorkItemRecords } from "./work-items.js";

/** Just enough of a stored receipt to size work. Kept structural so any store can supply it. */
export interface MeasuredReceipt {
  receipt_id: string;
  /** Provider-measured tokens for the request. Null when the provider reported none. */
  total_tokens: number | null;
}

export interface ReceiptHistoryInputs {
  /** Blast paths per work item, from the packets the board already loaded. */
  blastByWorkId: Map<string, string[]>;
  /** Every receipt the runtime has stored, by id. */
  receiptsById: Map<string, MeasuredReceipt>;
}

/**
 * Build the sample set. One sample per WORK ITEM — not per receipt — because the thing being
 * estimated is a unit of work, and an item that took six requests is one data point about
 * size, not six.
 */
export function buildReceiptHistory(projectDir: string, inputs: ReceiptHistoryInputs): ReceiptSample[] {
  const samples: ReceiptSample[] = [];

  for (const record of listWorkItemRecords(projectDir)) {
    if (record.receipt_ids.length === 0) continue;
    const blast = inputs.blastByWorkId.get(record.work_id);
    // No blast set means no radius class, and a sample with no class cannot be matched against
    // future work. Counting it would only move the global cold-start average around.
    if (!blast || blast.length === 0) continue;

    let total = 0;
    let measured = 0;
    for (const id of record.receipt_ids) {
      const receipt = inputs.receiptsById.get(id);
      if (!receipt || receipt.total_tokens === null) continue;
      total += receipt.total_tokens;
      measured += 1;
    }
    // Every linked receipt was unmeasured, so this item has no actual. Recording a zero would
    // drag the median toward "free".
    if (measured === 0) continue;

    samples.push({
      receipt_id: record.work_id,
      radius_class: radiusClass({ blast_paths: blast, dependents: record.depends_on.length }),
      total_tokens: total,
      // Requests are the closest honest proxy for effort the receipt store carries; the
      // estimator treats this as a session count and never presents it as wall-clock.
      sessions: measured,
    });
  }

  return samples;
}
