import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ActivityPage, RunStrip, type RunningSession } from "./ActivityPage";
import type { AgentDto, AgentsReportDto } from "../api/types";

function agent(overrides: Partial<AgentDto> = {}): AgentDto {
  return {
    agent: "claude-code",
    status: "active",
    configured: true,
    config_path: "/home/u/.claude.json",
    last_seen_at: new Date().toISOString(),
    sessions: 18,
    observations: 5321,
    durable_observations: 173,
    next_step: null,
    ...overrides,
  };
}

function agents(list: AgentDto[]): AgentsReportDto {
  return {
    project_dir: "/repo",
    generated_at: new Date().toISOString(),
    agents: list,
    never_observed: list.length === 0,
  };
}

const RUN_START = "2026-07-30T12:00:00.000Z";
/** A time this many seconds into the fixture run — the strip's axis is real elapsed time. */
const into = (seconds: number) => new Date(Date.parse(RUN_START) + seconds * 1000).toISOString();

function session(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    session_id: "s-1",
    agent: "claude",
    work_title: "Make tenantLimit configurable",
    started_at: RUN_START,
    elapsed_s: 252,
    step: "Edit src/settings.tsx",
    ticks: [],
    ...overrides,
  };
}

function page(props: Partial<Parameters<typeof ActivityPage>[0]> = {}) {
  return <ActivityPage attention={[]} tasks={[]} agents={null} {...props} />;
}

// These rules moved here when Agents folded into Activity. The defect they exist to prevent was
// real and measured: `validate_palette.js` puts this product's success green and critical red at
// ΔE 2.1 under DEUTERANOPIA (26.2 to normal vision). Green-vs-red is THE colour-vision collision
// and no palette tuning fixes it, so status is carried by label and glyph as well as colour.
describe("Agent status is never carried by colour alone", () => {
  test("every observed status carries a text label, so it survives with colour switched off", () => {
    render(
      page({
        agents: agents([
          agent({ agent: "claude-code", status: "active" }),
          agent({ agent: "codex", status: "silent", last_seen_at: null, durable_observations: 0 }),
          agent({ agent: "aider", status: "idle" }),
        ]),
      }),
    );
    // The words are the fact. Colour is a fast path on top of them, not the carrier.
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Never seen")).toBeTruthy();
    expect(screen.getByText("Idle")).toBeTruthy();
  });

  test("working and broken differ by more than hue", () => {
    const { container } = render(
      page({
        agents: agents([
          agent({ agent: "claude-code", status: "active" }),
          agent({ agent: "codex", status: "silent", last_seen_at: null }),
        ]),
      }),
    );
    const states = [...container.querySelectorAll(".observed-state")].map((el) => el.getAttribute("data-status"));
    expect(states).toContain("measured");
    expect(states).toContain("critical");

    // The glyphs differ in SILHOUETTE — not two dots in two hues, which is what a colourblind
    // reader would see as identical.
    const glyphs = [...container.querySelectorAll(".status-glyph")].map((el) => el.textContent);
    expect(new Set(glyphs).size).toBeGreaterThan(1);
  });

  test("the glyph is decorative to assistive tech — the label already says it", () => {
    const { container } = render(page({ agents: agents([agent()]) }));
    for (const glyph of container.querySelectorAll(".status-glyph")) {
      // A screen reader announcing "black circle Active" is worse than "Active".
      expect(glyph.getAttribute("aria-hidden")).toBe("true");
    }
  });

  test("an agent that learned nothing shows a dash, not a zero painted as measured", () => {
    const { container } = render(page({ agents: agents([agent({ durable_observations: 0 })]) }));
    const count = container.querySelector(".observed-count");
    expect(count?.getAttribute("data-confidence")).toBe("unknown");
    expect(count?.textContent).toBe("—");
  });
});

describe("Activity", () => {
  // Only the desktop app can spawn a process, so a browser must not offer a button that cannot work.
  test("the start button appears only where an agent can actually be started", () => {
    const { rerender } = render(page());
    expect(screen.queryByRole("button", { name: "Start an agent" })).toBeNull();
    rerender(page({ canStartAgents: true }));
    expect(screen.getByRole("button", { name: "Start an agent" })).toBeTruthy();
  });

  test("with nothing running the band says what would put something there", () => {
    render(page());
    expect(screen.getByText(/No agent is running/)).toBeTruthy();
    expect(screen.getByText(/kage run -- claude/)).toBeTruthy();
  });

  // The home screen must never hide the thing that is blocking you behind another click.
  test("the single most urgent decision is surfaced inline, and the rest are counted", () => {
    render(
      page({
        attention: [
          { kind: "parked", severity: 40, ref: "a", summary: "Parked item", actions: [] },
          { kind: "overlap_warning", severity: 95, ref: "b", summary: "Two agents are editing the same file", actions: [] },
        ],
      }),
    );
    expect(screen.getByText("Two agents are editing the same file")).toBeTruthy();
    expect(screen.queryByText("Parked item")).toBeNull();
    expect(screen.getByText(/and 1 more decisions/)).toBeTruthy();
  });

  test("a running session names its work and its latest step", () => {
    render(page({ sessions: [session()] }));
    expect(screen.getByText("Make tenantLimit configurable")).toBeTruthy();
    expect(screen.getByText("Edit src/settings.tsx")).toBeTruthy();
    expect(screen.getByText("4:12")).toBeTruthy();
  });

  // THE run-strip rule. A lit mark asserts memory reached the agent, and that fact lives in the
  // proxy — so with no recall data the count is a dash. "0 recalls" would read as a measurement
  // that memory did not help, when the truth is that nothing was attributed.
  test("a run with no attributed recalls shows a dash, never a zero", () => {
    const { container } = render(
      page({ sessions: [session({ ticks: [{ at: into(4), weight: 0.5 }, { at: into(9), weight: 0.5 }] })] }),
    );
    const recalls = container.querySelector(".running-recalls");
    expect(recalls?.textContent).toBe("—");
    expect(recalls?.getAttribute("data-confidence")).toBe("unknown");
  });

  test("a run with attributed recalls counts them and wears the measured colour", () => {
    const { container } = render(
      page({
        sessions: [
          session({
            ticks: [{ at: into(4), weight: 0.5 }],
            recalls: 3,
            recall_at: [into(2), into(30), into(90)],
          }),
        ],
      }),
    );
    const recalls = container.querySelector(".running-recalls");
    expect(recalls?.textContent).toBe("3 recalls");
    expect(recalls?.getAttribute("data-confidence")).toBe("measured");
  });

  // The count is measured from the delivery rows. A tick is a TOOL CALL, so inferring the count from
  // the strip would be counting the wrong events — the old code fell back to exactly that.
  test("the recall count never falls back to counting tool calls", () => {
    const { container } = render(
      page({ sessions: [session({ ticks: Array.from({ length: 7 }, (_, i) => ({ at: into(i), weight: 0.5 })) })] }),
    );
    expect(container.querySelector(".running-recalls")?.textContent).toBe("—");
  });

  test("one recall reads as one, not as a plural", () => {
    const { container } = render(page({ sessions: [session({ recalls: 1, recall_at: [into(5)] })] }));
    expect(container.querySelector(".running-recalls")?.textContent).toBe("1 recall");
  });
});

describe("The lede states whether the loop is working, not how busy it is", () => {
  // It used to read "0 agents running · 0 recalls delivered · …" — a zero standing in for "nothing
  // is happening yet", which is the one thing this product's confidence ladder forbids.
  test("with nothing running it says so, and never claims zero recalls", () => {
    render(page({ sessions: [] }));
    expect(screen.getByText(/no agent running/)).toBeTruthy();
    expect(screen.queryByText(/0 recalls/)).toBeNull();
  });

  test("a run before memory has landed says so, rather than reporting a zero", () => {
    render(page({ sessions: [session()] }));
    expect(screen.getByText(/no memory delivered yet/)).toBeTruthy();
  });

  test("once memory lands, the lede states the outcome and agrees with the count", () => {
    render(page({ sessions: [session({ recalls: 4, recall_at: [into(1)] })] }));
    expect(screen.getByText(/memory reached it 4 times/)).toBeTruthy();
  });
});

describe("RunStrip", () => {
  const strip = (props: Partial<Parameters<typeof RunStrip>[0]> = {}) => (
    <RunStrip ticks={[]} startedAt={RUN_START} elapsedS={100} {...props} />
  );

  test("draws one tick per recorded tool call and nothing more", () => {
    const { container } = render(
      strip({ ticks: [{ at: into(10), weight: 0.5 }, { at: into(50), weight: 0.3 }] }),
    );
    expect(container.querySelectorAll(".run-tick")).toHaveLength(2);
    expect(container.querySelectorAll(".run-recall")).toHaveLength(0);
  });

  // The claim the strip exists to make, and the one that never rendered before: memory reaching an
  // agent mid-run, at the moment the proxy recorded it.
  test("a delivered recall draws a mark at its own place in the run", () => {
    const { container } = render(strip({ ticks: [{ at: into(10), weight: 0.5 }], recallAt: [into(50)] }));
    const mark = container.querySelector(".run-recall line");
    expect(mark).toBeTruthy();
    // Halfway through a 100s run, on a 1000-unit axis.
    expect(mark?.getAttribute("x1")).toBe("500");
  });

  // Shape before colour: green and red collide under deuteranopia, so a recall must be legible with
  // hue removed. It is full height and capped; a tool tick is short and has no cap.
  test("a recall differs from a tick in shape, not only in colour", () => {
    const { container } = render(strip({ ticks: [{ at: into(10), weight: 0.5 }], recallAt: [into(50)] }));
    const tick = container.querySelector(".run-tick") as SVGLineElement;
    const recall = container.querySelector(".run-recall line") as SVGLineElement;
    const height = (line: SVGLineElement) =>
      Math.abs(Number(line.getAttribute("y1")) - Number(line.getAttribute("y2")));
    expect(height(recall)).toBeGreaterThan(height(tick));
    expect(container.querySelector(".run-recall-cap")).toBeTruthy();
  });

  test("the label states both series in words, for anyone not looking at the picture", () => {
    const { container } = render(strip({ ticks: [{ at: into(10), weight: 0.5 }], recallAt: [into(50)] }));
    const label = container.querySelector(".run-strip")?.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/1 tool call/);
    expect(label).toMatch(/1 moment memory reached the agent/);
  });

  test("an empty strip draws its axis and nothing else", () => {
    const { container } = render(strip());
    expect(container.querySelectorAll(".run-tick")).toHaveLength(0);
    expect(container.querySelectorAll(".run-recall")).toHaveLength(0);
    expect(container.querySelectorAll(".run-axis")).toHaveLength(1);
  });
});
