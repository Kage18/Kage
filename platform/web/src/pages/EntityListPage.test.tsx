import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { EntityListPage } from "./EntityListPage";
import type { EntityListDto } from "../api/types";

function entity(overrides: Partial<EntityListDto["entities"][number]> = {}) {
  return {
    entity_id: overrides.slug ?? "e1",
    kind: "decision",
    slug: "a-decision",
    canonical_name: "A decision",
    summary: "",
    status: "active",
    verified_claims: 1,
    stale_claims: 0,
    disputed_claims: 0,
    ...overrides,
  } as EntityListDto["entities"][number];
}

function list(entities: EntityListDto["entities"]): EntityListDto {
  return { kind: "decision", entities };
}

describe("browse list filtering", () => {
  const fixture = list([
    entity({ slug: "proxy", canonical_name: "The proxy borrows credentials", summary: "in memory only" }),
    entity({ slug: "stale", canonical_name: "Staleness gate prefers symbols", verified_claims: 0, stale_claims: 2 }),
    entity({ slug: "gate", canonical_name: "Self-approval is refused", summary: "a second pair of eyes" }),
  ]);

  test("searching matches names and summaries", () => {
    render(<EntityListPage title="Decisions" section="decisions" list={fixture} />);
    expect(screen.getByText("3 entries")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search decisions"), { target: { value: "credentials" } });
    expect(screen.getByText("The proxy borrows credentials")).toBeTruthy();
    expect(screen.queryByText("Self-approval is refused")).toBeNull();

    // Summary text is searchable too — the title alone is often not what you remember.
    fireEvent.change(screen.getByLabelText("Search decisions"), { target: { value: "second pair" } });
    expect(screen.getByText("Self-approval is refused")).toBeTruthy();
  });

  // The failure this guards against: a filtered count rendered as if it were the whole set,
  // which reads as "this knowledge is missing" rather than "you are filtering".
  test("a filtered list always says how much it is hiding", () => {
    render(<EntityListPage title="Decisions" section="decisions" list={fixture} />);
    fireEvent.change(screen.getByLabelText("Search decisions"), { target: { value: "credentials" } });
    expect(screen.getByText("1 of 3 shown")).toBeTruthy();
  });

  test("health filters split trustworthy from needs-attention", () => {
    render(<EntityListPage title="Decisions" section="decisions" list={fixture} />);

    fireEvent.click(screen.getByRole("button", { name: "Needs attention" }));
    expect(screen.getByText("Staleness gate prefers symbols")).toBeTruthy();
    expect(screen.queryByText("The proxy borrows credentials")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Verified" }));
    expect(screen.queryByText("Staleness gate prefers symbols")).toBeNull();
    expect(screen.getByText("The proxy borrows credentials")).toBeTruthy();
  });

  test("an empty result explains that entries exist, rather than reading as an empty section", () => {
    render(<EntityListPage title="Decisions" section="decisions" list={fixture} />);
    fireEvent.change(screen.getByLabelText("Search decisions"), { target: { value: "zzzzz" } });
    expect(screen.getByText(/3 entries exist in this section/)).toBeTruthy();
  });

  test("a genuinely empty section is still stated plainly", () => {
    render(<EntityListPage title="Decisions" section="decisions" list={list([])} />);
    expect(screen.getByText(/No decisions have been captured/)).toBeTruthy();
  });
});
