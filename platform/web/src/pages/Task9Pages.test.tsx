import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";
import { AdminDiagnosticsPage } from "./AdminDiagnosticsPage";
import type { DesktopRepo } from "../desktop";

function fixtureDesktopRepo(overrides: Partial<DesktopRepo> = {}): DesktopRepo {
  return {
    path: "/Users/kushal/code/kage",
    name: "kage",
    port: 4317,
    daemon: "running",
    ...overrides,
  };
}

describe("SettingsPage", () => {
  test("shows the local privacy posture, retention, and budget as configured facts", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText(/audit mode/i)).toBeInTheDocument();
    expect(screen.getByText("Retention")).toBeInTheDocument();
    expect(screen.getByText("Privacy mode")).toBeInTheDocument();
    expect(screen.getByText("Budget")).toBeInTheDocument();
  });

  test("links to the segregated admin diagnostics surface rather than inlining raw data", () => {
    render(<SettingsPage />);
    const link = screen.getByRole("link", { name: /admin diagnostics/i });
    expect(link).toHaveAttribute("href", "/admin/diagnostics");
    // Settings itself never inlines raw packet/graph/database dumps.
    expect(screen.queryByText(/raw graph edges/i)).toBeNull();
    expect(screen.queryByText(/packet files/i)).toBeNull();
  });

  test("renders no Repositories section outside the desktop app", () => {
    render(<SettingsPage />);
    expect(screen.queryByRole("heading", { name: "Repositories" })).toBeNull();
  });

  test("lists every repository, marks the active one, and lets you switch, add, and remove", () => {
    const onSwitchRepo = vi.fn();
    const onAddRepo = vi.fn();
    const onRemoveRepo = vi.fn();
    const repos = [
      fixtureDesktopRepo({ path: "/a", name: "acme" }),
      fixtureDesktopRepo({ path: "/b", name: "beta", daemon: "stopped" }),
    ];
    render(
      <SettingsPage
        desktopRepos={repos}
        activeRepoPath="/a"
        onSwitchRepo={onSwitchRepo}
        onAddRepo={onAddRepo}
        onRemoveRepo={onRemoveRepo}
      />,
    );
    expect(screen.getByRole("heading", { name: "Repositories" })).toBeInTheDocument();
    expect(screen.getByText("acme")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /switch to this repository/i }));
    expect(onSwitchRepo).toHaveBeenCalledWith("/b");

    fireEvent.click(screen.getByRole("button", { name: /add a repository/i }));
    expect(onAddRepo).toHaveBeenCalledTimes(1);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(onRemoveRepo).toHaveBeenCalledWith("/a");
    confirmSpy.mockRestore();
  });
});

describe("AdminDiagnosticsPage", () => {
  test("is the ONLY place raw packets, graph edges, checkpoints, and database diagnostics appear", () => {
    render(<AdminDiagnosticsPage />);
    const region = screen.getByRole("region", { name: /raw diagnostics/i });
    expect(within(region).getByText(/packet files/i)).toBeInTheDocument();
    expect(within(region).getByText(/raw graph edges/i)).toBeInTheDocument();
    expect(within(region).getByText(/compiler checkpoints/i)).toBeInTheDocument();
    expect(within(region).getByText(/database diagnostics/i)).toBeInTheDocument();
  });

  test("warns that this surface exposes low-level internals for operators only", () => {
    render(<AdminDiagnosticsPage />);
    expect(screen.getByText(/operators/i)).toBeInTheDocument();
  });
});
