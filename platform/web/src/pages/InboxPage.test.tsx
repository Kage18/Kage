import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { InboxPage } from "./InboxPage";
import type { DesktopCard, MineOutcome } from "../desktop";

function card(overrides: Partial<DesktopCard> = {}): DesktopCard {
  return {
    id: "card_aaaa0001",
    kind: "caution",
    state: "proposed",
    verify: "unverified",
    title: "tenantLimit comparison is exclusive on purpose",
    claim: "withinLimit uses < rather than <=. Two PRs flipped it and both were reverted.",
    citations: [{ path: "src/limits.ts", symbol: "withinLimit" }],
    trigger: "editing src/limits.ts",
    provenance: { source: "mining", ref: "history:200", at: "2026-08-04T10:00:00.000Z" },
    tags: [],
    createdAt: "2026-08-04T10:00:00.000Z",
    updatedAt: "2026-08-04T10:00:00.000Z",
    ...overrides,
  };
}

function page(props: Partial<Parameters<typeof InboxPage>[0]> = {}) {
  return (
    <InboxPage
      cards={[card()]}
      busy={null}
      mining={false}
      lastMine={null}
      error={null}
      onApprove={() => {}}
      onReject={() => {}}
      onMine={() => {}}
      canMutate
      {...props}
    />
  );
}

describe("Inbox — the approval console", () => {
  test("a proposal shows its claim, citations, trigger, and provenance — knowledge with no origin cannot be judged", () => {
    render(page());
    expect(screen.getByText(/withinLimit uses/)).toBeTruthy();
    expect(screen.getByText("src/limits.ts#withinLimit")).toBeTruthy();
    expect(screen.getByText(/recalls when: editing src\/limits.ts/)).toBeTruthy();
    expect(screen.getByText(/mined from history · 2026-08-04/)).toBeTruthy();
  });

  test("only proposed cards appear — approved knowledge does not wait in an inbox", () => {
    render(page({ cards: [card(), card({ id: "card_bbbb0002", state: "approved", title: "already approved" })] }));
    expect(screen.queryByText("already approved")).toBeNull();
  });

  // Loading and empty are different facts, and the empty state says how something would arrive.
  test("loading is not rendered as an empty inbox", () => {
    render(page({ cards: null }));
    expect(screen.getByText("Loading proposals…")).toBeTruthy();
    expect(screen.queryByText(/nothing becomes team knowledge/i)).toBeNull();
  });

  test("an empty inbox says what would fill it", () => {
    render(page({ cards: [] }));
    expect(screen.getByText(/proposes cards after agent sessions end/)).toBeTruthy();
  });

  test("verdict buttons exist only where a verdict can be executed", () => {
    render(page({ canMutate: false }));
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mine history" })).toBeNull();
  });

  test("approve and reject carry the card id", () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(page({ onApprove, onReject }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledWith("card_aaaa0001");
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalledWith("card_aaaa0001", "rejected in review");
  });

  test("the keyboard clears the inbox: j/k move, a approves the selected card", () => {
    const onApprove = vi.fn();
    render(
      page({
        cards: [card(), card({ id: "card_bbbb0002", title: "second proposal" })],
        onApprove,
      }),
    );
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { key: "a" });
    expect(onApprove).toHaveBeenCalledWith("card_bbbb0002");
  });

  // The token line is measured or absent — never an estimate dressed as a reading.
  test("a mining result reports measured tokens, or says not measured", () => {
    const measured: MineOutcome = { ok: true, proposed: 7, rejected: 1, deduped: 2, inputTokens: 84210, outputTokens: 3120, costUsd: null };
    const { rerender } = render(page({ lastMine: measured }));
    expect(screen.getByText(/84,210 in \/ 3,120 out tokens on your subscription/)).toBeTruthy();
    const unmeasured: MineOutcome = { ...measured, inputTokens: null, outputTokens: null };
    rerender(page({ lastMine: unmeasured }));
    expect(screen.getByText(/token usage not measured/)).toBeTruthy();
  });
});
