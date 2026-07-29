import type { ReactNode } from "react";
import type { RepositoryDto } from "../api/types";
import { navGroups, withBase } from "../router";
import { RepositorySwitcher } from "./RepositorySwitcher";
import { LiveIndicator } from "./LiveIndicator";

// The application shell.
//
// Two things about it are deliberate and easy to undo by accident:
//
//   The nav groups are separated by SPACE, not by rendered captions. `NOW` / `WORK` / `MEMORY` in
//   letterspaced caps was the noisiest thing on the sidebar and said nothing a gap does not. The
//   group name survives as `aria-label`, so assistive tech still gets the structure a sighted
//   reader gets from the spacing.
//
//   In the desktop app the traffic lights are inset over the top-left of the window, so the banner
//   reserves space for them and becomes the drag region. Gated on `data-kage-desktop`, which the
//   preload stamps on the root element — the web portal is untouched.

interface AppShellProps {
  repository: RepositoryDto | null;
  route: string;
  children: ReactNode;
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

export function AppShell({ repository, route, children }: AppShellProps): React.ReactElement {
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
            <RepositorySwitcher repository={repository} />
          </header>

          <nav className="shell-nav" aria-label="Sections">
          {navGroups.map((group) => (
            <ul key={group.label} className="nav-group" aria-label={group.label}>
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
          ))}

          </nav>

          <div className="shell-nav-foot">
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
