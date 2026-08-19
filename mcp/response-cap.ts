// Shared MCP-boundary helper for capping large collections before they are
// serialized into a tool response. Several tool results (kage_refresh's
// stale_packets/validation.warnings today; kage_pr_check's stale_packets and
// similar list fields are candidates next) collect one entry per packet or
// finding across the whole repo — each entry is individually lean, but an
// uncapped array grows without bound as the repo accumulates packets, and a
// large-enough response gets refused outright by MCP clients instead of
// truncated gracefully. capCollection() caps the array, states the true
// total, and never drops entries silently.

export interface CappedCollection<T> {
  items: T[];
  total: number;
  shown: number;
  truncated: boolean;
  /** Human-readable "showing N of M <label>" note, or null when nothing was withheld. */
  note: string | null;
}

export function capCollection<T>(items: T[], limit: number, label: string): CappedCollection<T> {
  const total = items.length;
  const safeLimit = Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : total;
  const truncated = total > safeLimit;
  const shown = truncated ? items.slice(0, safeLimit) : items;
  return {
    items: shown,
    total,
    shown: shown.length,
    truncated,
    note: truncated ? `showing ${shown.length} of ${total} ${label}` : null,
  };
}

// Every MCP tool below opts into the same `limit`/`verbose` escape hatch kage_refresh
// established: default to a small, actionable cap; `verbose: true` returns everything;
// an explicit positive `limit` overrides the default. Centralized so each tool needs one
// line instead of re-deriving this three times.
export function responseCapLimit(args: Record<string, unknown> | undefined, total: number, defaultLimit = 10): number {
  if (Boolean(args?.verbose)) return total;
  const explicit = Number(args?.limit);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return defaultLimit;
}

// Caps one or more named array fields on an already-computed tool payload, in place at
// the MCP boundary (the underlying kernel function and the CLI that calls it directly
// are untouched, so CLI output stays exactly as verbose as before). Each capped field
// gets `<field>_total`/`<field>_truncated` siblings, and every truncation note is
// collected into `response_notes` — never drop entries without saying so, and never
// invent a different phrasing for the same "N of M" note kage_context already uses.
export function capFields<T extends object>(
  payload: T,
  args: Record<string, unknown> | undefined,
  fields: Array<{ key: string; label: string; defaultLimit?: number }>,
): T & { response_notes: string[] } {
  const record = payload as unknown as Record<string, unknown>;
  const notes: string[] = Array.isArray(record.response_notes) ? [...(record.response_notes as string[])] : [];
  const next: Record<string, unknown> = { ...record };
  for (const { key, label, defaultLimit = 10 } of fields) {
    const arr = record[key];
    if (!Array.isArray(arr)) continue;
    const capped = capCollection(arr, responseCapLimit(args, arr.length, defaultLimit), label);
    next[key] = capped.items;
    next[`${key}_total`] = capped.total;
    next[`${key}_truncated`] = capped.truncated;
    if (capped.note) notes.push(capped.note);
  }
  next.response_notes = notes;
  return next as T & { response_notes: string[] };
}
