// The Receipts page has one job, and every test here is a statement of it: a number appears only
// when an event was counted to produce it. The failures these guard against are all the same
// failure wearing different clothes — a zero standing in for "we never looked".

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ReceiptsPage, type ReceiptsView } from "./ReceiptsPage";

function view(overrides: Partial<ReceiptsView> = {}): ReceiptsView {
  return { counts: {}, recent: [], ...overrides };
}

/** An ISO timestamp `seconds` in the past, so relative rendering is deterministic under test. */
function agoIso(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

describe("Receipts — the honesty surface", () => {
  test("an event type that never occurred renders the action that would unlock it, never a 0", () => {
    render(<ReceiptsPage view={view()} loading={false} />);

    // The whole page, and nowhere on it a fabricated measurement.
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByText(/Run `kage cards mine`/)).toBeTruthy();
    expect(screen.getByText(/Approve a proposal in the Inbox/)).toBeTruthy();
    // The dash is what an unmeasured figure looks like: one per supporting figure.
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  test("a measured zero renders as 0 and is not an unlock — observed-and-none differs from never-observed", () => {
    render(<ReceiptsPage view={view({ counts: { stale_withheld: 0 } })} loading={false} />);

    // Present-with-zero is a real reading: the ledger was counted and nothing was withheld.
    const zero = screen.getByText("0");
    expect(zero).toBeTruthy();
    expect(zero.getAttribute("data-confidence")).toBe("measured");
    // And precisely because it IS measured, it must not carry the prompt to go and measure it.
    expect(screen.queryByText(/Counted the first time a stale card/)).toBeNull();
    // Its unmeasured neighbours still do.
    expect(screen.getByText(/Run `kage cards mine`/)).toBeTruthy();
  });

  test("the lead recall figure is shown when counted, and replaced by its unlock when it is not", () => {
    const { rerender } = render(<ReceiptsPage view={view({ counts: { recall_served: 12 } })} loading={false} />);
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText(/times an agent was handed something/)).toBeTruthy();
    expect(screen.queryByText(/No recall counted yet/)).toBeNull();

    rerender(<ReceiptsPage view={view()} loading={false} />);
    expect(screen.getByText(/No recall counted yet/)).toBeTruthy();
    expect(screen.getByText(/Run an agent through `kage up`/)).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  test("unmeasured token usage reads 'not measured' rather than a zero or an estimate", () => {
    render(<ReceiptsPage view={view({ recent: [{ type: "mining_run", at: agoIso(60) }] })} loading={false} />);

    expect(screen.getByText(/not measured/)).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    // And it says WHY there is no figure, rather than substituting a model for a reading.
    expect(screen.getByText(/an estimate would be a different kind of number/)).toBeTruthy();
  });

  test("token and cost totals are summed only from the receipts that reported usage", () => {
    render(
      <ReceiptsPage
        view={view({
          recent: [
            { type: "mining_run", at: agoIso(60), inputTokens: 900, outputTokens: 200, costUsd: 0.25 },
            // No usage fields: this receipt must not contribute a silent zero to the sums, and it
            // must not be counted in the denominator that qualifies them.
            { type: "card_proposed", at: agoIso(120), cardId: "card_aaaa0001" },
          ],
        })}
        loading={false}
      />,
    );

    expect(screen.getByText("900")).toBeTruthy();
    expect(screen.getByText("200")).toBeTruthy();
    expect(screen.getByText("$0.25")).toBeTruthy();
    // The sum names its own scope — a partial sum presented as a total is the estimation failure
    // this page exists to prevent, one level down.
    expect(screen.getAllByText("from 1 of 2 receipts shown").length).toBeGreaterThan(0);
  });

  test("loading is a distinct state and is never rendered as an empty ledger", () => {
    render(<ReceiptsPage view={null} loading />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/Reading the receipts ledger/)).toBeTruthy();
    // Nothing may claim emptiness before the ledger has been read.
    expect(screen.queryByText(/No event counted yet/)).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.queryByText("0")).toBeNull();
  });

  test("an empty ledger says what would produce the first event", () => {
    render(<ReceiptsPage view={view()} loading={false} />);
    expect(screen.getByText(/No event counted yet/)).toBeTruthy();
    expect(screen.getByText(/when the Librarian proposes a card/)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("absent cross-pollination renders nothing at all, rather than a team number of zero", () => {
    const { rerender } = render(<ReceiptsPage view={view()} loading={false} />);
    expect(screen.queryByText(/Cross-pollination/)).toBeNull();
    expect(screen.queryByText(/another person's agent/)).toBeNull();

    // Null is the same fact as absent — a solo store has no team to have a team number about.
    rerender(<ReceiptsPage view={view({ crossPollination: null })} loading={false} />);
    expect(screen.queryByText(/Cross-pollination/)).toBeNull();
  });

  test("present cross-pollination shows the count, its authors, and why it is the honest team number", () => {
    render(
      <ReceiptsPage
        view={view({
          crossPollination: {
            total: 7,
            byAuthor: [
              { author: "kushal@kage.dev", delivered: 5 },
              { author: "sam@kage.dev", delivered: 2 },
            ],
          },
        })}
        loading={false}
      />,
    );

    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText(/delivered into another person's agent/)).toBeTruthy();
    // The claim it deliberately does NOT make, named on the page so nobody re-invents it.
    expect(screen.getByText(/repeat failures prevented/)).toBeTruthy();
    expect(screen.getByText("kushal@kage.dev")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  test("recent receipts are listed with relative times and their own vocabulary", () => {
    render(
      <ReceiptsPage
        view={view({
          recent: [
            { type: "recall_served", at: agoIso(10), cardId: "card_aaaa0001" },
            { type: "stale_withheld", at: agoIso(3 * 60), detail: "citation vanished" },
            { type: "mining_run", at: agoIso(5 * 3600), detail: "200 commits" },
          ],
        })}
        loading={false}
      />,
    );

    expect(screen.getByText("recall served")).toBeTruthy();
    expect(screen.getByText("just now")).toBeTruthy();
    expect(screen.getByText("stale claim withheld")).toBeTruthy();
    expect(screen.getByText("3m ago")).toBeTruthy();
    expect(screen.getByText("5h ago")).toBeTruthy();
    expect(screen.getByText("citation vanished")).toBeTruthy();
  });

  test("a per-event usage line prints only the half that was reported", () => {
    render(
      <ReceiptsPage
        view={view({ recent: [{ type: "mining_run", at: agoIso(60), outputTokens: 340 }] })}
        loading={false}
      />,
    );

    // "0 in / 340 out" would be the obvious shortcut and would print a number nobody measured.
    expect(screen.getByText("340 out")).toBeTruthy();
    expect(screen.queryByText(/0 in/)).toBeNull();
  });

  test("a receipt with an unrecognised type still appears — a counted event is never hidden", () => {
    render(<ReceiptsPage view={view({ recent: [{ type: "future_event", at: agoIso(30) }] })} loading={false} />);
    expect(screen.getByText("future_event")).toBeTruthy();
  });

  test("a clock-skewed receipt from the future reads as now, never as a time yet to come", () => {
    const future = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
    render(<ReceiptsPage view={view({ recent: [{ type: "librarian_run", at: future }] })} loading={false} />);
    expect(screen.getByText("just now")).toBeTruthy();
  });
});
