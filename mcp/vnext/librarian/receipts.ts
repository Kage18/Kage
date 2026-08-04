// The receipts ledger — the only source any displayed number may have.
//
// Every figure on the app's Receipts surface is a replay of events recorded here: one JSON
// line per event, appended to a month-bucketed .jsonl under storeDir/receipts/. The old
// product died by estimation (a 447.7M "tokens saved" headline against an 8.1M honest replay),
// so this ledger holds counted events only — if it isn't a line in one of these files, it
// does not get displayed.
//
// Two asymmetries are load-bearing. Appending never throws: a failed receipt is a gap in a
// report, a thrown receipt is a broken session, and no report is worth breaking the session
// it reports on. Reading never trusts a line: one corrupt write (a crash mid-append, a
// concurrent writer) degrades to "that line was skipped", never to a dead ledger.

import { appendFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ReceiptEvent } from "./types.js";

const RECEIPT_TYPES: ReadonlySet<string> = new Set<ReceiptEvent["type"]>([
  "card_proposed",
  "card_approved",
  "card_rejected",
  "card_superseded",
  "recall_served",
  "stale_withheld",
  "card_misleading",
  "librarian_run",
  "mining_run",
]);

/**
 * Month bucket from the event's own timestamp, so a receipt lands with the events it belongs
 * beside even when it is written late. A malformed timestamp buckets to "0000-00": still
 * recorded (a counted event happened), sorted oldest so it never masquerades as recent.
 */
function monthOf(at: string): string {
  return /^(\d{4}-\d{2})/.exec(at)?.[1] ?? "0000-00";
}

export function appendReceipt(storeDir: string, event: ReceiptEvent): void {
  try {
    const dir = join(storeDir, "receipts");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, `${monthOf(event.at)}.jsonl`), `${JSON.stringify(event)}\n`);
  } catch {
    // Swallowed on purpose — see the file-top comment. A receipt that cannot be written is
    // a gap in a report; throwing here would break the session the receipt describes.
  }
}

/**
 * All receipts, newest first. Order is derived from where events sit in the ledger — files
 * descending by month, lines reversed within a file — not by re-sorting on the self-reported
 * `at`: append order is the honest record of when we learned something, and a skewed clock
 * should not be able to rewrite that history.
 */
export function readReceipts(storeDir: string, opts?: { limit?: number }): ReceiptEvent[] {
  const dir = join(storeDir, "receipts");
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((name) => name.endsWith(".jsonl"))
      .sort()
      .reverse(); // YYYY-MM sorts lexicographically = chronologically; reversed is newest month first.
  } catch {
    return []; // No ledger yet. Nothing counted is honestly nothing to report.
  }

  const events: ReceiptEvent[] = [];
  const limit = opts?.limit;
  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(join(dir, file), "utf8");
    } catch {
      continue; // A vanished or unreadable month is a gap, not a failure.
    }
    for (const line of content.split("\n").filter(Boolean).reverse()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue; // A torn write. Skip the line, keep the ledger.
      }
      const event = parsed as ReceiptEvent;
      // Shape-check before admitting: a line with an unknown type or missing timestamp is
      // corruption for counting purposes — better absent than miscounted.
      if (
        event === null ||
        typeof event !== "object" ||
        !RECEIPT_TYPES.has(event.type) ||
        typeof event.at !== "string"
      ) {
        continue;
      }
      events.push(event);
    }
    if (limit !== undefined && events.length >= limit) break;
  }
  return limit !== undefined ? events.slice(0, limit) : events;
}

/**
 * Counted events by type — the exact numbers the Receipts surface renders. Types with zero
 * events are absent, not zero: the app renders an absent measurement as an unlock action,
 * and a fabricated 0 would claim a measurement that never ran.
 */
export function receiptCounts(storeDir: string): Partial<Record<ReceiptEvent["type"], number>> {
  const counts: Partial<Record<ReceiptEvent["type"], number>> = {};
  for (const event of readReceipts(storeDir)) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }
  return counts;
}
