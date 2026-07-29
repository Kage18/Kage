// First run — the app with no repository yet.
//
// An invitation, not an apology. The failure mode this replaces is worse than an ugly screen: with
// no repository there is no daemon, so every API call 503s and the window rendered "Repository
// knowledge is unavailable" — a technical error for a state that is not an error at all. It is
// simply the beginning.
//
// Desktop only. In a browser the portal is always served BY a repository's daemon, so this state
// cannot occur there.

import type { ReactElement } from "react";

/** The mark, flattened — one stroke, one fill. Same shape as the sidebar and the app icon. */
function Mark(): ReactElement {
  return (
    <svg className="firstrun-mark" viewBox="0 0 96 96" aria-hidden="true">
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

export function FirstRunPage({
  onAddRepository,
  busy = false,
  error,
}: {
  onAddRepository: () => void;
  busy?: boolean;
  error?: string | null;
}): ReactElement {
  return (
    <section className="firstrun" aria-label="Add a repository">
      <Mark />
      <h1 className="firstrun-title">Point Kage at a repository</h1>
      <p className="firstrun-lede">
        It reads the git history to work out what is in flight, and starts remembering what your
        agents learn. Everything stays on this machine — nothing is sent anywhere.
      </p>

      {/* Stated up front rather than discovered on failure: Kage derives work from commits, so a
          folder without a git history could only ever produce an empty app. */}
      <p className="fact firstrun-note">a git repository · nothing is uploaded</p>

      {error ? <p className="sheet-error firstrun-error">{error}</p> : null}

      <button type="button" className="firstrun-action" onClick={onAddRepository} disabled={busy}>
        {busy ? "Opening…" : "Choose a folder…"}
      </button>
    </section>
  );
}
