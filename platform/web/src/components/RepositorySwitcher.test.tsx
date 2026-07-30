import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RepositorySwitcher } from "./RepositorySwitcher";
import type { DesktopRepo } from "../desktop";
import { fixtureRepository } from "../test/fixtures";

function fixtureDesktopRepo(overrides: Partial<DesktopRepo> = {}): DesktopRepo {
  return {
    path: "/Users/kushal/code/kage",
    name: "kage",
    port: 4317,
    daemon: "running",
    ...overrides,
  };
}

describe("RepositorySwitcher", () => {
  test("falls back to a static identity label when desktop props are absent", () => {
    render(<RepositorySwitcher repository={fixtureRepository({ name: "acme" })} />);
    expect(screen.getByRole("button", { name: /acme/i })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("renders the repo list when opened", () => {
    const repos = [fixtureDesktopRepo({ path: "/a", name: "acme" }), fixtureDesktopRepo({ path: "/b", name: "beta" })];
    render(
      <RepositorySwitcher
        repository={fixtureRepository()}
        desktopRepos={repos}
        activeRepoPath="/a"
        onSwitchRepo={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /open repository switcher/i }));
    expect(screen.getByRole("menu", { name: "Switch repository" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /acme/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /beta/i })).toBeInTheDocument();
  });

  test("clicking a repo calls onSwitchRepo with its path and closes the menu", () => {
    const onSwitchRepo = vi.fn();
    const repos = [fixtureDesktopRepo({ path: "/a", name: "acme" }), fixtureDesktopRepo({ path: "/b", name: "beta" })];
    render(
      <RepositorySwitcher
        repository={fixtureRepository()}
        desktopRepos={repos}
        activeRepoPath="/a"
        onSwitchRepo={onSwitchRepo}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /open repository switcher/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /beta/i }));
    expect(onSwitchRepo).toHaveBeenCalledWith("/b");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("clicking Add a repository calls onAddRepo", () => {
    const onAddRepo = vi.fn();
    const repos = [fixtureDesktopRepo()];
    render(
      <RepositorySwitcher
        repository={fixtureRepository()}
        desktopRepos={repos}
        activeRepoPath="/Users/kushal/code/kage"
        onSwitchRepo={vi.fn()}
        onAddRepo={onAddRepo}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /open repository switcher/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /add a repository/i }));
    expect(onAddRepo).toHaveBeenCalledTimes(1);
  });

  test("removing a repo asks for confirmation before calling onRemoveRepo", () => {
    const onRemoveRepo = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const repos = [fixtureDesktopRepo({ path: "/a", name: "acme" })];
    render(
      <RepositorySwitcher
        repository={fixtureRepository()}
        desktopRepos={repos}
        activeRepoPath="/a"
        onSwitchRepo={vi.fn()}
        onRemoveRepo={onRemoveRepo}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /open repository switcher/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /remove acme/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onRemoveRepo).toHaveBeenCalledWith("/a");
    confirmSpy.mockRestore();
  });
});
