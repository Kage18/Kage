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

function session(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    session_id: "s-1",
    agent: "claude",
    work_title: "Make tenantLimit configurable",
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

  // THE run-strip rule. A green tick asserts memory reached the agent, and that fact lives in the
  // proxy — so with no recall data the count is a dash. "0 recalls" would read as a measurement
  // that memory did not help, when the truth is that nothing was attributed.
  test("a run with no attributed recalls shows a dash, never a zero", () => {
    const { container } = render(
      page({ sessions: [session({ ticks: [{ recall: false, weight: 0.5 }, { recall: false, weight: 0.5 }] })] }),
    );
    const recalls = container.querySelector(".running-recalls");
    expect(recalls?.textContent).toBe("—");
    expect(recalls?.getAttribute("data-confidence")).toBe("unknown");
  });

  test("a run with attributed recalls counts them and wears the measured colour", () => {
    const { container } = render(
      page({ sessions: [session({ ticks: [{ recall: true, weight: 1 }, { recall: false, weight: 0.5 }] })] }),
    );
    const recalls = container.querySelector(".running-recalls");
    expect(recalls?.textContent).toBe("1 recalls");
    expect(recalls?.getAttribute("data-confidence")).toBe("measured");
  });
});

describe("RunStrip", () => {
  test("draws one tick per recorded event and nothing more", () => {
    const { container } = render(
      <RunStrip ticks={[{ recall: false, weight: 0.5 }, { recall: true, weight: 1 }, { recall: false, weight: 0.3 }]} />,
    );
    expect(container.querySelectorAll("rect")).toHaveLength(3);
    expect(container.querySelectorAll(".run-tick-recall")).toHaveLength(1);
  });

  test("an empty strip is empty, not a placeholder", () => {
    const { container } = render(<RunStrip ticks={[]} />);
    expect(container.querySelectorAll("rect")).toHaveLength(0);
  });
});
