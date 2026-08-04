import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { CardsPage, type CardsFilter, type KnowledgeCard } from "./CardsPage";

function card(overrides: Partial<KnowledgeCard> = {}): KnowledgeCard {
  return {
    id: "card_aaaa0001",
    kind: "caution",
    state: "approved",
    verify: "verified",
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

const ALL: CardsFilter = { kind: "all", trust: "all" };

function page(props: Partial<Parameters<typeof CardsPage>[0]> = {}) {
  return (
    <CardsPage
      cards={[card()]}
      filter={ALL}
      onFilter={() => {}}
      onSupersede={() => {}}
      {...props}
    />
  );
}

describe("Knowledge — the cards the team believes", () => {
  test("a card shows its claim, citations, trigger and provenance, like the room it was approved in", () => {
    render(page());
    expect(screen.getByText(/withinLimit uses/)).toBeTruthy();
    expect(screen.getByText("src/limits.ts#withinLimit")).toBeTruthy();
    expect(screen.getByText(/recalls when: editing src\/limits.ts/)).toBeTruthy();
    expect(screen.getByText(/mined from history · 2026-08-04/)).toBeTruthy();
  });

  test("the kind filter narrows the list to that kind", () => {
    render(
      page({
        cards: [card(), card({ id: "card_bbbb0002", kind: "runbook", title: "how to cut a release" })],
        filter: { kind: "runbook", trust: "all" },
      }),
    );
    expect(screen.getByText("how to cut a release")).toBeTruthy();
    expect(screen.queryByText(/tenantLimit comparison/)).toBeNull();
    expect(screen.getByText("1 of 2 shown")).toBeTruthy();
  });

  test("the trust filter narrows the list to that reading", () => {
    render(
      page({
        cards: [card(), card({ id: "card_bbbb0002", verify: "stale", title: "cites a deleted module" })],
        filter: { kind: "all", trust: "stale" },
      }),
    );
    expect(screen.getByText("cites a deleted module")).toBeTruthy();
    expect(screen.queryByText(/tenantLimit comparison/)).toBeNull();
  });

  test("a chip reports the filter it would apply, and keeps the other axis", () => {
    const onFilter = vi.fn();
    render(page({ filter: { kind: "all", trust: "stale" }, onFilter }));
    fireEvent.click(screen.getByRole("button", { name: /^Caution/ }));
    expect(onFilter).toHaveBeenCalledWith({ kind: "caution", trust: "stale" });
  });

  // Colour cannot be the carrier: this product's green and red sit at ΔE 2.1 under deuteranopia.
  test("a stale card states its trust as a word, not only as a colour", () => {
    const { container } = render(page({ cards: [card({ verify: "stale" })] }));
    const trust = container.querySelector("#card_aaaa0001 .card-trust");
    expect(trust?.textContent).toContain("Stale");
    // The rail carries the state too, so the row is readable with colour switched off entirely.
    expect(container.querySelector<HTMLElement>("#card_aaaa0001")?.dataset.verify).toBe("stale");
  });

  test("a stale card tells a human why it is withheld and what would end it", () => {
    render(page({ cards: [card({ verify: "stale" })] }));
    expect(screen.getByText(/Withheld from agents/)).toBeTruthy();
    expect(screen.getByText(/no longer resolves in this repository/)).toBeTruthy();
    expect(screen.getByText(/or by superseding this card with one that cites what exists now/)).toBeTruthy();
  });

  test("the auditor's own reason is preferred over the definition of the state", () => {
    render(page({ cards: [card({ verify: "stale", staleReason: "symbol withinLimit not found" })] }));
    expect(screen.getByText(/symbol withinLimit not found/)).toBeTruthy();
    expect(screen.queryByText(/no longer resolves in this repository/)).toBeNull();
  });

  test("a superseded card links to what replaced it, and a live card links to nothing", () => {
    const { unmount } = render(
      page({
        cards: [
          card({ state: "superseded", supersededBy: "card_bbbb0002" }),
          card({ id: "card_bbbb0002", title: "tenantLimit is inclusive since the quota rewrite" }),
        ],
      }),
    );
    const link = screen.getByRole("link", { name: "tenantLimit is inclusive since the quota rewrite" });
    expect(link.getAttribute("href")).toBe("#card_bbbb0002");
    unmount();

    render(page());
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("a chain that points outside this view says so rather than printing nothing", () => {
    render(page({ cards: [card({ state: "superseded", supersededBy: "card_cccc0003" })] }));
    expect(screen.getByText(/card_cccc0003 — not in this view/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("the empty state names how cards arrive", () => {
    render(page({ cards: [] }));
    expect(screen.getByText(/proposes them when an agent session ends/)).toBeTruthy();
    expect(screen.getByText(/waits in the Inbox until you approve it/)).toBeTruthy();
  });

  test("counts are measured over what the team believes, not over the approval queue", () => {
    render(
      page({
        cards: [
          card(),
          card({ id: "card_bbbb0002", verify: "stale" }),
          card({ id: "card_cccc0003", state: "proposed", verify: "unverified", title: "still awaiting a verdict" }),
        ],
      }),
    );
    expect(screen.getByText("2 cards · 1 verified · 1 stale")).toBeTruthy();
    expect(screen.queryByText("still awaiting a verdict")).toBeNull();
  });

  // Zero stale is a real reading; a reading nobody has taken is a dash.
  test("a measured zero is a zero, and an unread store is a dash", () => {
    const { unmount } = render(page({ cards: [card()] }));
    expect(screen.getByText("1 card · 1 verified · 0 stale")).toBeTruthy();
    unmount();

    render(page({ cards: null }));
    expect(screen.getByText(/— cards · — verified · — stale/)).toBeTruthy();
    expect(screen.queryByText(/0 stale/)).toBeNull();
    // Loading is not an empty shelf — the arrival story belongs to a store that answered "none".
    expect(screen.queryByText(/proposes them when an agent session ends/)).toBeNull();
  });

  test("the stale action appears only when there is a measured stale count to act on", () => {
    const onFilter = vi.fn();
    const { unmount } = render(page({ cards: [card({ verify: "stale" })], onFilter }));
    fireEvent.click(screen.getByRole("button", { name: "Show 1 stale" }));
    expect(onFilter).toHaveBeenCalledWith({ kind: "all", trust: "stale" });
    unmount();

    render(page({ cards: [card()] }));
    expect(screen.queryByRole("button", { name: /^Show / })).toBeNull();
  });

  test("supersede is offered only where it can execute, and only on a card still believed", () => {
    const onSupersede = vi.fn();
    const { unmount } = render(page({ onSupersede }));
    fireEvent.click(screen.getByRole("button", { name: "Supersede" }));
    expect(onSupersede).toHaveBeenCalledWith("card_aaaa0001");
    unmount();

    // The browser portal renders the same list read-only: the shadow store is a desktop write.
    const { unmount: unmountReadOnly } = render(page({ onSupersede: null }));
    expect(screen.queryByRole("button", { name: "Supersede" })).toBeNull();
    unmountReadOnly();

    render(page({ cards: [card({ state: "retired" })] }));
    expect(screen.queryByRole("button", { name: "Supersede" })).toBeNull();
  });

  test("a kind with nothing in it stays visible and disabled — an absence is information", () => {
    render(page({ cards: [card({ kind: "caution" })] }));
    const runbook = screen.getByRole("button", { name: /^Runbook/ });
    expect(runbook.hasAttribute("disabled")).toBe(true);
    expect(runbook.textContent).toContain("0");
  });
});
