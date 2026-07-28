// Reading the receipts the proxy actually stored.
//
// The board needs measured token totals to score an estimate against, and they live in the
// runtime's sqlite database. Two constraints shape this module:
//
//   `node:sqlite` is imported LAZILY, never at module top level. It does not exist before Node
//   22.5, and a top-level import would take down every `kage` command on an older runtime —
//   including the ones that have nothing to do with receipts.
//
//   Absence is never an error. No database, no table, an unsupported Node: all return `[]`, and
//   an empty history makes the estimator report `confidence: "none"`. That is the truthful
//   answer. A fabricated sample would be worse than no estimate at all.

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MeasuredReceipt } from "./receipt-history.js";

function databasePath(projectDir: string): string {
  return join(projectDir, ".agent_memory", "daemon", "vnext", "local.db");
}

export function readStoredReceipts(projectDir: string): MeasuredReceipt[] {
  const path = databasePath(projectDir);
  if (!existsSync(path)) return [];
  try {
    // Lazy on purpose — see the module comment.
    const { DatabaseSync } = require("node:sqlite") as {
      DatabaseSync: new (p: string, o?: { readOnly?: boolean }) => {
        prepare(sql: string): { all(): Array<Record<string, unknown>> };
        close(): void;
      };
    };
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      const rows = db
        .prepare(
          `SELECT receipt_id, before_input_tokens, after_input_tokens, output_tokens
             FROM transformation_receipts`,
        )
        .all();
      return rows.map((row): MeasuredReceipt => {
        // The cost of the request as SENT plus what came back. `after_input_tokens` is the
        // prompt Kage actually forwarded, so it is the honest input figure; a receipt the
        // provider never measured contributes null rather than a zero.
        const input = typeof row.after_input_tokens === "number" ? row.after_input_tokens : null;
        const output = typeof row.output_tokens === "number" ? row.output_tokens : null;
        const total = input === null && output === null ? null : (input ?? 0) + (output ?? 0);
        return { receipt_id: String(row.receipt_id), total_tokens: total };
      });
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}
