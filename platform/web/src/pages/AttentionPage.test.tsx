import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AttentionPage } from "./AttentionPage";
import type { AttentionItemDto } from "../api/types";

function staleItem(overrides: Partial<AttentionItemDto> = {}): AttentionItemDto {
  return {
    kind: "stale_critical",
    severity: 85,
    ref: "packet-1",
    summary: '"Old runbook" — cited code moved (recalled 20x in 30d)',
    actions: ["reverify", "supersede", "retire"],
    ...overrides,
  };
}

describe("Attention actions", () => {
  test("an empty queue reads as success, not as an error", () => {
    render(<AttentionPage items={[]} />);
    expect(screen.getByText(/Nothing needs you/)).toBeTruthy();
  });

  test("reverifying a stale claim reports what was actually re-anchored", async () => {
    render(
      <AttentionPage
        items={[staleItem()]}
        onReverify={async () => ({
          ok: true,
          result: {
            ok: true,
            packet_id: "packet-1",
            refreshed_paths: ["src/a.ts", "src/b.ts"],
            missing_paths: [],
            changed_paths: ["src/a.ts"],
            was_stale: true,
            errors: [],
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reverify" }));
    await waitFor(() => expect(screen.getByText(/re-anchored 2 path/)).toBeTruthy());
    expect(screen.getByText(/1 had changed/)).toBeTruthy();
  });

  // The honesty-critical path. The kernel refuses to reverify a packet whose cited code is
  // all gone, because doing so would rubber-stamp dead evidence. A refusal that rendered as
  // nothing would look like a successful click and leave a stale claim believed-good.
  test("a refused reverify shows the reason instead of failing silently", async () => {
    render(
      <AttentionPage
        items={[staleItem()]}
        onReverify={async () => ({
          ok: false,
          error: "All cited paths are gone — reverify would rubber-stamp dead evidence.",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reverify" }));
    await waitFor(() => expect(screen.getByText(/rubber-stamp dead evidence/)).toBeTruthy());
  });

  // Only actions that a single click can actually complete are offered as buttons.
  test("actions with no one-click operation are named, not offered as buttons", () => {
    render(<AttentionPage items={[staleItem()]} onReverify={async () => ({ ok: true })} />);
    expect(screen.getByText(/supersede \(needs a replacement\)/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /supersede/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /retire/i })).toBeNull();
  });
});
