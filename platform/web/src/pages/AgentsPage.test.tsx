import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AgentsPage } from "./AgentsPage";
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

function report(agents: AgentDto[]): AgentsReportDto {
  return {
    project_dir: "/repo",
    generated_at: new Date().toISOString(),
    agents,
    never_observed: agents.length === 0,
  };
}

describe("Agents status is never carried by colour alone", () => {
  // The defect this exists to prevent, and it was real: `validate_palette.js` puts this
  // product's success green and critical red at ΔE 2.1 under DEUTERANOPIA in light mode —
  // 26.2 to normal vision. Green-vs-red is THE colour-vision collision and no palette tuning
  // fixes it. A deuteranopic lead reading this page could not tell a working agent from a
  // broken one, because the status was a coloured pill and nothing else.
  test("every status carries a text label, so it survives with colour switched off", () => {
    render(
      <AgentsPage
        report={report([
          agent({ agent: "claude-code", status: "active" }),
          agent({ agent: "codex", status: "silent", sessions: 0, observations: 0, durable_observations: 0, last_seen_at: null }),
          agent({ agent: "aider", status: "idle" }),
        ])}
      />,
    );
    // The words are the fact. Colour is a fast path on top of them, not the carrier.
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Never seen")).toBeTruthy();
    expect(screen.getByText("Idle")).toBeTruthy();
  });

  test("healthy and broken differ by more than hue", () => {
    const { container } = render(
      <AgentsPage
        report={report([
          agent({ agent: "claude-code", status: "active" }),
          agent({ agent: "codex", status: "silent", last_seen_at: null }),
        ])}
      />,
    );
    const statuses = [...container.querySelectorAll(".status")];
    const values = statuses.map((el) => el.getAttribute("data-status"));
    expect(values).toContain("measured");
    expect(values).toContain("critical");

    // Each status also renders a glyph whose SILHOUETTE differs — not two dots in two hues,
    // which is what a colourblind reader would see as identical.
    const glyphs = [...container.querySelectorAll(".status-glyph")].map((el) => el.textContent);
    expect(new Set(glyphs).size).toBeGreaterThan(1);
  });

  test("the glyph is decorative to assistive tech — the label already says it", () => {
    const { container } = render(<AgentsPage report={report([agent()])} />);
    for (const glyph of container.querySelectorAll(".status-glyph")) {
      // A screen reader announcing "black circle Active" is worse than "Active".
      expect(glyph.getAttribute("aria-hidden")).toBe("true");
    }
  });

  test("a card's rail differs in border STYLE, not only colour", () => {
    const { container } = render(
      <AgentsPage
        report={report([
          agent({ agent: "claude-code", status: "active" }),
          agent({ agent: "codex", status: "silent", last_seen_at: null }),
        ])}
      />,
    );
    const confidences = [...container.querySelectorAll(".entity-card")].map((el) =>
      el.getAttribute("data-confidence"),
    );
    // The stylesheet maps these to solid / dashed / double, so the rail is legible with the
    // colour channel gone entirely.
    expect(confidences).toContain("measured");
    expect(confidences).toContain("critical");
  });

  test("a zero durable count is not painted as a measured success", () => {
    const { container } = render(
      <AgentsPage report={report([agent({ durable_observations: 0 })])} />,
    );
    const stat = container.querySelector(".agent-stat-strong");
    // Nothing became knowledge, so the number must not wear the measured colour.
    expect(stat?.getAttribute("data-confidence")).toBe("unknown");
  });
});
