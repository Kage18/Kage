// The Settings section. It states the LOCAL operating posture — privacy mode, retention, and budget —
// as configured facts about how this daemon runs, and points operators at the segregated diagnostics
// surface for low-level internals. It never inlines raw packets, graph edges, or database dumps: those
// live only under /admin/diagnostics so the honesty boundary between "product view" and "raw internals"
// is explicit.
//
// The Repositories section is the same repo list/add/remove/switch surface as the sidebar switcher —
// this page is where it's discoverable and readable at full width, not a second implementation of it.

import { withBase } from "../router";
import type { DesktopRepo } from "../desktop";

const DAEMON_CONFIDENCE: Record<DesktopRepo["daemon"], string> = {
  running: "measured",
  starting: "derived",
  stopped: "unknown",
  failed: "critical",
};

interface SettingsPageProps {
  desktopRepos?: DesktopRepo[];
  activeRepoPath?: string | null;
  onSwitchRepo?: (path: string) => void;
  onAddRepo?: () => void;
  onRemoveRepo?: (path: string) => void;
}

export function SettingsPage({
  desktopRepos,
  activeRepoPath,
  onSwitchRepo,
  onAddRepo,
  onRemoveRepo,
}: SettingsPageProps): React.ReactElement {
  return (
    <section aria-label="Settings">
      <h1>Settings</h1>
      <p className="muted">
        How this local Kage daemon is configured. These are the current operating facts, read from the
        local configuration — not remote account settings.
      </p>

      <dl className="settings-list">
        <div className="settings-row">
          <dt>Privacy mode</dt>
          <dd>
            Audit mode. The portal is read-only and never sits on the context-delivery path; the live
            feed emits identifiers and enums only, never raw prompt text or claim content.
          </dd>
        </div>
        <div className="settings-row">
          <dt>Retention</dt>
          <dd>
            Events, receipts, and knowledge are retained locally in this repository&rsquo;s Kage
            database. Nothing is sent to a remote service in the local single-user model.
          </dd>
        </div>
        <div className="settings-row">
          <dt>Budget</dt>
          <dd>
            Context budgets and compression thresholds are governed by the local vNext configuration.
            The proxy&rsquo;s mode (audit or assist) determines whether requests are transformed at all.
          </dd>
        </div>
      </dl>

      {desktopRepos !== undefined && (
        <>
          <h2>Repositories</h2>
          <p className="muted">
            Every repository this app has added, and the daemon each one runs locally. Switching here
            does the same thing as switching from the sidebar.
          </p>
          <ul className="settings-repo-list">
            {desktopRepos.map((repo) => (
              <li key={repo.path} className="settings-repo-row">
                <span
                  className="status-glyph"
                  aria-hidden="true"
                  data-confidence={DAEMON_CONFIDENCE[repo.daemon]}
                >
                  ●
                </span>
                <span className="settings-repo-name">{repo.name}</span>
                <span className="fact settings-repo-path">{repo.path}</span>
                <span className="fact settings-repo-state">{repo.daemon}</span>
                {repo.path === activeRepoPath ? (
                  <span className="settings-repo-current">Current</span>
                ) : (
                  onSwitchRepo && (
                    <button type="button" onClick={() => onSwitchRepo(repo.path)}>
                      Switch to this repository
                    </button>
                  )
                )}
                {onRemoveRepo && (
                  <button
                    type="button"
                    className="settings-repo-remove"
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
          </ul>
          {onAddRepo && (
            <p>
              <button type="button" onClick={onAddRepo}>
                Add a repository…
              </button>
            </p>
          )}
        </>
      )}

      <h2>Operator tools</h2>
      <p>
        Low-level internals — raw memory packets, graph internals, compiler state, and storage
        diagnostics — are kept off the product surfaces and exposed only to operators.
      </p>
      <p>
        <a href={withBase("/admin/diagnostics")}>Open admin diagnostics</a>
      </p>
    </section>
  );
}
