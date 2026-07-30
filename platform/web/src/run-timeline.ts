// Placing a run on a time axis.
//
// The run strip claims "memory reached this agent mid-flight". That claim needs two series on one
// clock: the tool calls the app observed as the agent's stream arrived, and the deliveries the proxy
// recorded when it attached memory to a request. Both readings come from the same system clock,
// because the app spawns the proxy itself — so plotting them together is not an inference.
//
// The strip used to mark recalls by ASSISTANT TURN INDEX instead. That never rendered: a delivery
// row is only written when something was composed, so the rows are a subsequence of the requests and
// the index is lost. Time is the axis both series actually have.
//
// No correspondence is claimed between a mark and a tick. The strip says "these things happened, in
// this order, this far apart" — nothing more, which is exactly as much as was measured.

/** A tool call the app observed, as `stripTicks` produces it. */
export interface TimelineTick {
  at: string;
  weight: number;
}

export interface RunTimeline {
  /** Tool calls at their fraction of the run, 0 (start) to 1 (now). */
  ticks: Array<{ x: number; weight: number }>;
  /** Fractions where the proxy recorded that memory reached the agent. */
  recalls: number[];
  /** Seconds the axis spans end to end — what a reader is actually looking across. */
  spanS: number;
  /**
   * Deliveries that could not be placed. The recall COUNT is measured exactly from the delivery
   * rows, so an unplaceable mark must not quietly shrink it: a caller keeps showing the true count
   * and can say that this many moments could not be located.
   */
  unplacedRecalls: number;
}

/** A run shorter than this still gets a full-width axis rather than a division by zero. */
const MIN_SPAN_S = 1;

function ms(value: number | string): number {
  return typeof value === "number" ? value : Date.parse(value);
}

export function runTimeline(input: {
  startedAt: number | string;
  now: number | string;
  ticks: readonly TimelineTick[];
  /** `delivered_at` values from the proxy's own delivery rows. */
  recallAt: readonly string[];
}): RunTimeline {
  const start = ms(input.startedAt);
  // Without a usable start there is no axis to place anything on, and a NaN position renders as a
  // mark at an arbitrary spot. Nothing is drawn, and every recall is reported as unplaced.
  if (!Number.isFinite(start)) {
    return { ticks: [], recalls: [], spanS: MIN_SPAN_S, unplacedRecalls: input.recallAt.length };
  }

  const observed = input.ticks.map((tick) => ms(tick.at));

  // The axis has to cover everything it was handed. An agent can out-run the last IPC push, so the
  // newest tick may sit past the reported clock — stretching is right, clipping would hide work.
  const latest = Math.max(ms(input.now), ...observed.filter(Number.isFinite));
  const spanMs = Math.max(latest - start, MIN_SPAN_S * 1000);
  const place = (t: number) => Math.min(1, Math.max(0, (t - start) / spanMs));

  const ticks = input.ticks
    .map((tick, index) => ({ tick, t: observed[index] }))
    .filter((entry) => Number.isFinite(entry.t))
    .map((entry) => ({ x: place(entry.t), weight: entry.tick.weight }));

  const recalls: number[] = [];
  let unplacedRecalls = 0;
  for (const stamp of input.recallAt) {
    const t = ms(stamp);
    // Unparseable, or earlier than the run itself. Clamping the latter to 0 would draw memory
    // arriving before the agent started — a moment that did not happen. Drop it and say so.
    if (!Number.isFinite(t) || t < start) {
      unplacedRecalls += 1;
      continue;
    }
    recalls.push(place(t));
  }

  return { ticks, recalls, spanS: spanMs / 1000, unplacedRecalls };
}
