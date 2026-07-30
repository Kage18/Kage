import { useEffect, useRef, useState } from "react";
import type { RepositoryDto } from "../api/types";
import type { DesktopRepo } from "../desktop";

// The repository identity control in the banner.
//
// The desktop app has supported adding, removing, and switching repositories at the process level
// since it was built (main's IPC handlers, the preload bridge) — this control is what makes that
// reachable. Outside the desktop app (browser, tests) there is exactly one repository and nothing to
// switch, so it falls back to a plain identity label.
//
// No `cursor: pointer` on the trigger and no hover affordance beyond focus — desktop controls do not
// use the hand cursor, and it is the single fastest tell that a window is a web page.

interface RepositorySwitcherProps {
  repository: RepositoryDto | null;
  /** Present only inside the desktop app; undefined in the browser or in tests that don't pass it. */
  desktopRepos?: DesktopRepo[];
  activeRepoPath?: string | null;
  onSwitchRepo?: (path: string) => void;
  onAddRepo?: () => void;
  onRemoveRepo?: (path: string) => void;
}

const DAEMON_CONFIDENCE: Record<DesktopRepo["daemon"], string> = {
  running: "measured",
  starting: "derived",
  stopped: "unknown",
  failed: "critical",
};

export function RepositorySwitcher({
  repository,
  desktopRepos,
  activeRepoPath,
  onSwitchRepo,
  onAddRepo,
  onRemoveRepo,
}: RepositorySwitcherProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const switchable = desktopRepos !== undefined && onSwitchRepo !== undefined;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!switchable) {
    if (!repository) {
      return (
        <button type="button" className="repo-switcher" disabled>
          <span className="repo-name">Detecting repository…</span>
        </button>
      );
    }
    return (
      <button type="button" className="repo-switcher" aria-label={`Current repository: ${repository.name}`}>
        <span className="repo-name">{repository.name}</span>
        {repository.branch ? (
          <span className="repo-branch">
            {repository.branch}
          </span>
        ) : null}
      </button>
    );
  }

  const active = (desktopRepos ?? []).find((repo) => repo.path === activeRepoPath) ?? null;
  const label = active ? active.name : repository ? repository.name : "Select a repository";

  return (
    <div className="repo-switcher-root" ref={rootRef}>
      <button
        type="button"
        className="repo-switcher"
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Current repository: ${label}. Open repository switcher`}
        onClick={() => setOpen((next) => !next)}
      >
        <span className="repo-name">{label}</span>
        {active?.path ? (
          <span className="repo-branch">
            {active.path}
          </span>
        ) : null}
      </button>

      {open && (
        <ul className="repo-menu" role="menu" aria-label="Switch repository">
          {(desktopRepos ?? []).map((repo) => (
            <li key={repo.path} className="repo-menu-item" role="none">
              <button
                type="button"
                role="menuitem"
                className="repo-menu-switch"
                aria-current={repo.path === activeRepoPath ? "true" : undefined}
                onClick={() => {
                  setOpen(false);
                  onSwitchRepo?.(repo.path);
                }}
              >
                <span className="status-glyph" aria-hidden="true" data-confidence={DAEMON_CONFIDENCE[repo.daemon]}>●</span>
                <span className="repo-menu-name">{repo.name}</span>
                <span className="fact repo-menu-state">{repo.daemon}</span>
              </button>
              {onRemoveRepo && (
                <button
                  type="button"
                  role="menuitem"
                  className="repo-menu-remove"
                  aria-label={`Remove ${repo.name}`}
                  onClick={() => {
                    if (window.confirm(`Remove ${repo.name}? Its daemon will stop.`)) {
                      onRemoveRepo(repo.path);
                    }
                  }}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
          {onAddRepo && (
            <li className="repo-menu-item" role="none">
              <button
                type="button"
                role="menuitem"
                className="repo-menu-add"
                onClick={() => {
                  setOpen(false);
                  onAddRepo();
                }}
              >
                Add a repository…
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
