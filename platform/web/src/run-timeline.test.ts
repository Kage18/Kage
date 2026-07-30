import { describe, expect, test } from "vitest";
import { runTimeline } from "./run-timeline";

const START = Date.parse("2026-07-30T12:00:00.000Z");
const at = (s: number) => new Date(START + s * 1000).toISOString();

function timeline(options: {
  ticks?: number[];
  recalls?: string[];
  nowS?: number;
}) {
  return runTimeline({
    startedAt: START,
    now: START + (options.nowS ?? 100) * 1000,
    ticks: (options.ticks ?? []).map((s) => ({ at: at(s), weight: 0.5 })),
    recallAt: options.recalls ?? [],
  });
}

describe("the run strip's time axis", () => {
  // The whole point of the rewrite: the axis is TIME, so a tick's position is when it happened and
  // not where it sits in a list. A run that paused for a minute must LOOK like it paused.
  test("a tick sits at its own fraction of the elapsed run, not at its list index", () => {
    const { ticks } = timeline({ ticks: [0, 25, 50], nowS: 100 });
    expect(ticks.map((tick) => tick.x)).toEqual([0, 0.25, 0.5]);
  });

  test("two tool calls a second apart stay a second apart, however long the run gets", () => {
    const early = timeline({ ticks: [10, 11], nowS: 20 });
    const late = timeline({ ticks: [10, 11], nowS: 200 });
    const gap = (t: ReturnType<typeof timeline>) => t.ticks[1].x - t.ticks[0].x;
    // The same real gap reads as a smaller fraction of a longer run — that is the axis working.
    expect(gap(early)).toBeGreaterThan(gap(late));
  });

  test("a recall is placed from the delivered_at the proxy recorded, on the same axis", () => {
    const { recalls } = timeline({ ticks: [10], recalls: [at(40)], nowS: 80 });
    expect(recalls).toEqual([0.5]);
  });

  // Memory is attached when the request is FORWARDED, so a recall legitimately lands before the
  // tool calls it informed. That ordering is the product's whole story and must survive rendering.
  test("a recall can precede the ticks it informed, because that is the real order", () => {
    const { ticks, recalls } = timeline({ ticks: [30, 60], recalls: [at(20)], nowS: 100 });
    expect(recalls[0]).toBeLessThan(ticks[0].x);
  });
});

describe("what the axis refuses to draw", () => {
  // A mark at a wrong position is worse than no mark: it asserts a moment that never happened.
  test("an unparseable delivery time is dropped rather than placed at zero", () => {
    const result = timeline({ recalls: ["not a timestamp"], nowS: 100 });
    expect(result.recalls).toEqual([]);
    expect(result.unplacedRecalls).toBe(1);
  });

  // Clamping this to 0 would draw memory arriving before the run began.
  test("a delivery earlier than the session start is dropped, never clamped to the start", () => {
    const result = timeline({ recalls: [at(-30)], nowS: 100 });
    expect(result.recalls).toEqual([]);
    expect(result.unplacedRecalls).toBe(1);
  });

  // Sub-second jitter between main's push and this render is not an anomaly, so the trailing edge
  // clamps instead of dropping — the delivery genuinely happened, just a moment ago.
  test("a delivery a moment past `now` clamps to the trailing edge instead of vanishing", () => {
    const result = timeline({ recalls: [at(101)], nowS: 100 });
    expect(result.recalls).toEqual([1]);
    expect(result.unplacedRecalls).toBe(0);
  });

  // The count of recalls is measured EXACTLY from the delivery rows. If a mark cannot be placed the
  // count must not silently shrink with it, or the strip would quietly contradict the number beside
  // it. `unplacedRecalls` is what lets a caller keep the two consistent.
  test("dropped marks are reported, so a measured count is never quietly reduced", () => {
    const result = timeline({ recalls: [at(10), "rubbish", at(-1)], nowS: 100 });
    expect(result.recalls).toHaveLength(1);
    expect(result.unplacedRecalls).toBe(2);
  });

  test("a session that just started does not divide by zero", () => {
    const result = timeline({ ticks: [0], recalls: [at(0)], nowS: 0 });
    expect(result.ticks[0].x).toBeGreaterThanOrEqual(0);
    expect(result.ticks[0].x).toBeLessThanOrEqual(1);
    expect(Number.isFinite(result.spanS)).toBe(true);
    expect(result.spanS).toBeGreaterThan(0);
  });

  // An agent can out-run the last IPC push, so the newest tick may sit past `now`. The axis has to
  // cover every event it was given rather than pushing recent work off its right edge.
  test("the axis stretches to cover a tick newer than the reported clock", () => {
    const { ticks, spanS } = timeline({ ticks: [10, 150], nowS: 100 });
    expect(spanS).toBeGreaterThanOrEqual(150);
    expect(ticks[1].x).toBeLessThanOrEqual(1);
  });

  test("an unusable session start draws nothing at all, rather than marks at arbitrary spots", () => {
    const result = runTimeline({
      startedAt: "not a timestamp",
      now: START,
      ticks: [{ at: at(1), weight: 0.5 }],
      recallAt: [at(2), at(3)],
    });
    expect(result.ticks).toEqual([]);
    expect(result.recalls).toEqual([]);
    expect(result.unplacedRecalls).toBe(2);
  });

  test("nothing recorded is an empty axis, not a placeholder tick", () => {
    const result = timeline({ nowS: 60 });
    expect(result.ticks).toEqual([]);
    expect(result.recalls).toEqual([]);
    expect(result.unplacedRecalls).toBe(0);
  });
});
