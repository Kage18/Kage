import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ProofPage } from "./ProofPage";
import type { ProofReportDto, TeamReportDto } from "../api/types";

function report(overrides: Partial<ProofReportDto> = {}): ProofReportDto {
  return {
    project_dir: "/repo",
    generated_at: "2026-07-28T00:00:00.000Z",
    metrics: [],
    cycle_times: [],
    ...overrides,
  };
}

/** Only the fields Proof reads. The ledger DTO is large and the rest is irrelevant here. */
function ledger(overrides: Record<string, unknown> = {}): TeamReportDto {
  return {
    value: {
      recalls_served: 6418,
      stale_withheld: 730,
      tokens_saved_estimated: 900_000,
      replay_tokens_estimated: 300_000,
    },
    composition: { total_packets: 283, non_derivable_share: 0.62 },
    ...overrides,
  } as unknown as TeamReportDto;
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

    // The failure this test exists to prevent: a null rendering as a confident 0.
    expect(screen.queryByText("0")).toBeNull();
    // A dash is the rendering of "we never looked" — and it must be visibly not-a-number.
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText(/Run an agent through/)).toBeTruthy();
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
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.getByText("Configurable limits")).toBeTruthy();
    expect(screen.getByText("3.5d")).toBeTruthy();
  });

  test("a measured zero-day cycle time reads as a duration, not as an absence", () => {
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
    // 0 days is a real measurement — work that shipped same-day — and must not read as absent.
    expect(screen.getByText("<1d")).toBeTruthy();
    // Specifically, it must be distinguishable from the unmeasured dash.
    expect(screen.queryByText("—")).toBeNull();
  });

  // Proof absorbed Overview, and the merge introduced a real defect on first run: the ledger's
  // rows and the proof metrics carry the SAME facts, so the page rendered "Stale claims withheld"
  // twice — once as 13.0k from the ledger and once as 12975 from the metric — and did the same
  // for recalls and tokens. One source, or the reader has to work out which number to believe.
  test("a fact the ledger and the metrics both carry is rendered exactly once", () => {
    render(
      <ProofPage
        report={report({
          metrics: [
            { id: "recalls_served", label: "Recalls served", value: 469, unit: "count", formula: "ledger events where memory was injected" },
            { id: "stale_withheld", label: "Stale claims withheld", value: 12975, unit: "count", formula: "withholding events at recall time" },
          ],
        })}
        ledger={ledger()}
      />,
    );

    // The lead figure is the metric's, and it appears once — not also as a row beneath itself.
    expect(screen.getAllByText("469")).toHaveLength(1);
    expect(screen.queryByText("6.4k")).toBeNull();
    // And the ledger's own rendering of the same fact is gone.
    expect(screen.getAllByText(/Stale claims withheld/)).toHaveLength(1);
    expect(screen.queryByText("13.0k")).toBeNull();
  });

  // The headline number must be able to say how it was computed. That is the whole difference
  // between this page and a dashboard.
  test("the lead figure carries its formula", () => {
    render(
      <ProofPage
        report={report({
          metrics: [
            { id: "recalls_served", label: "Recalls served", value: 469, unit: "count", formula: "ledger events where memory was injected" },
          ],
        })}
        ledger={ledger()}
      />,
    );
    expect(screen.getByText(/ledger events where memory was injected/)).toBeTruthy();
  });

  // An estimate is a model, not a count, and the two must not look alike.
  test("an estimated metric never wears the measured colour", () => {
    const { container } = render(
      <ProofPage
        report={report({
          metrics: [
            { id: "tokens_saved", label: "Tokens saved (estimated)", value: 198_800_000, unit: "tokens", formula: "estimated read-vs-source difference" },
          ],
        })}
      />,
    );
    expect(container.querySelector('[data-confidence="estimated"]')).toBeTruthy();
    expect(container.querySelector('.proof-row-value[data-confidence="measured"]')).toBeNull();
  });

  test("with nothing measured at all the page says so rather than showing zeros", () => {
    render(<ProofPage report={report()} ledger={null} />);
    expect(screen.getByText(/Nothing measured yet/)).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  // Each unmeasured metric names the specific input IT needs. A blanket "run an agent" above them
  // would say the same thing twice while being less useful than either.
  test("the page does not repeat a generic hint above rows that carry their own unlocks", () => {
    render(
      <ProofPage
        report={report({
          metrics: [
            { id: "recalls_served", label: "Recalls served", value: null, unit: "count", formula: "f", unlock: "Run an agent through `kage up`." },
          ],
        })}
      />,
    );
    expect(screen.getAllByText(/Run an agent through/)).toHaveLength(1);
    expect(screen.queryByText(/Nothing measured yet/)).toBeNull();
  });
});
