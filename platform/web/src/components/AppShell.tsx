import type { ReactNode } from "react";
import type { RepositoryDto } from "../api/types";
import type { DesktopRepo } from "../desktop";
import { navGroups, withBase } from "../router";
import { RepositorySwitcher } from "./RepositorySwitcher";
import { LiveIndicator } from "./LiveIndicator";

// The application shell.
//
// Two things about it are deliberate and easy to undo by accident:
//
//   The nav groups render a quiet caption — `NOW` / `WORK` / `MEMORY` — dim and small. A nav with
//   zero visible grouping relies entirely on spatial memory, which is a real source of "confusing
//   IA" for anyone but the person who built it.
//
//   There are NO ICONS, here or anywhere. That is the design's rule, not an omission: one mark (the
//   eye) and nothing else. An icon set would be a second visual vocabulary competing with the one
//   that already carries the meaning — labels, rails, and the luminance ladder. A previous pass
//   added a lucide glyph to every nav item, every page title and every row, and that is most of why
//   the app stopped looking like its own design.
//
//   In the desktop app the traffic lights are inset over the top-left of the window, so the banner
//   reserves space for them and becomes the drag region. Gated on `data-kage-desktop`, which the
//   preload stamps on the root element — the web portal is untouched.

interface AppShellProps {
  repository: RepositoryDto | null;
  route: string;
  children: ReactNode;
  /** Present only inside the desktop app; undefined in the browser, where there is nothing to switch. */
  desktopRepos?: DesktopRepo[];
  activeRepoPath?: string | null;
  onSwitchRepo?: (path: string) => void;
  onAddRepo?: () => void;
  onRemoveRepo?: (path: string) => void;
}

function firstSegment(path: string): string {
  const clean = path.split("?")[0];
  const segments = clean.split("/").filter((s) => s.length > 0);
  return segments[0] ?? "activity";
}

function isActive(href: string, route: string): boolean {
  return firstSegment(route) === firstSegment(href);
}

/** The mark: the eye, flattened to one stroke and one fill. No gradient — it has to hold at 15px. */
function Mark(): React.ReactElement {
  return (
    <svg className="shell-mark" viewBox="0 0 96 96" aria-hidden="true">
      <path
        d="M9 49c9-15 22-23 39-23s30 8 39 23c-9 14-22 21-39 21S18 63 9 49Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
      />
      <circle cx="48" cy="48" r="12" fill="currentColor" />
    </svg>
  );
}

export function AppShell({
  repository,
  route,
  children,
  desktopRepos,
  activeRepoPath,
  onSwitchRepo,
  onAddRepo,
  onRemoveRepo,
}: AppShellProps): React.ReactElement {
  return (
    <div className="kage-app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="shell-body">
        <div className="shell-rail">
          {/* A real `banner` landmark, kept when the banner moved from a bar across the top into
              the head of the sidebar. It sits OUTSIDE the nav — a header nested inside a nav is
              not a banner, and quietly losing the landmark is the kind of regression that only
              shows up for someone navigating by landmark. */}
          <header className="shell-identity">
            <Mark />
            <RepositorySwitcher
              repository={repository}
              desktopRepos={desktopRepos}
              activeRepoPath={activeRepoPath}
              onSwitchRepo={onSwitchRepo}
              onAddRepo={onAddRepo}
              onRemoveRepo={onRemoveRepo}
            />
          </header>

          <nav className="shell-nav" aria-label="Sections">
          {navGroups.map((group) => (
            <div key={group.label} className="nav-group-block">
              <span className="nav-group-label" aria-hidden="true">
                {group.label}
              </span>
              <ul className="nav-group" aria-label={group.label}>
                {group.links.map((link) => {
                  const active = isActive(link.href, route);
                  return (
                    <li key={link.href}>
                      <a href={withBase(link.href)} aria-current={active ? "page" : undefined}>
                        {link.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          </nav>

          <div className="shell-nav-foot">
            <a
              href={withBase("/settings")}
              className="shell-preferences-link"
              aria-current={isActive("/settings", route) ? "page" : undefined}
            >
              Preferences
            </a>
            <LiveIndicator />
          </div>
        </div>

        <main className="shell-main" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
