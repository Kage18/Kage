import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ProofPage } from "./ProofPage";
import type { ProofReportDto } from "../api/types";

function report(overrides: Partial<ProofReportDto> = {}): ProofReportDto {
  return {
    project_dir: "/repo",
    generated_at: "2026-07-28T00:00:00.000Z",
    metrics: [],
    cycle_times: [],
    ...overrides,
  };
}

describe("Proof honesty", () => {
  test("an unmeasured metric never renders as a zero, and shows how to unlock it", () => {
    render(
      <ProofPage
        report={report({
          metrics: [
            {
              id: "recalls_served",
              label: "Recalls served",
              value: null,
              unit: "count",
              formula: "ledger events where memory was injected instead of rediscovered",
              unlock: "Run an agent through `kage up`.",
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("Not measured")).toBeTruthy();
    // The failure this test exists to prevent: a null rendering as a confident 0.
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByText(/To measure this/)).toBeTruthy();
  });

  test("a measured metric shows its number, its formula, and no unlock prompt", () => {
    render(
      <ProofPage
        report={report({
          metrics: [
            {
              id: "items_shipped",
              label: "Items shipped",
              value: 7,
              unit: "count",
              formula: "work items whose commits reached the default branch",
            },
          ],
          cycle_times: [{ work_id: "w1", title: "Configurable limits", days: 3.5 }],
        })}
      />,
    );

    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText(/commits reached the default branch/)).toBeTruthy();
    expect(screen.queryByText(/To measure this/)).toBeNull();
    expect(screen.getByText("Configurable limits")).toBeTruthy();
    expect(screen.getByText("3.5 days")).toBeTruthy();
  });

  test("a measured zero-day cycle time reads as duration, not as an empty value", () => {
    render(
      <ProofPage
        report={report({
          metrics: [
            {
              id: "cycle_time_median",
              label: "Cycle time (median)",
              value: 0,
              unit: "days",
              formula: "median(done.at − claimed.at)",
            },
          ],
        })}
      />,
    );
    // 0 days is a real measurement (work that shipped same-day) and must not read as absent.
    expect(screen.getByText("under a day")).toBeTruthy();
    expect(screen.queryByText("Not measured")).toBeNull();
  });
});
