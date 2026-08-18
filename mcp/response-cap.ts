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
