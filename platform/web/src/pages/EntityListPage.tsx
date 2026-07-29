import { useMemo, useState, type ReactElement } from "react";
import type { EntityListDto } from "../api/types";
import { withBase } from "../router";

// The browse-list for one entity kind (Components, Flows, Runbooks, Decisions). Each entity links to
// its detail page and carries the same verified/stale/disputed health the System Map shows. An empty
// list states so plainly — it is never a "coming soon" placeholder.
//
// Filtering is here rather than per-page because every knowledge kind needs it equally: this repo has
// 164 decisions and 44 components, and a product that calls itself a memory orchestrator cannot make
// you scroll a hundred cards to find one thing. It filters client-side over the list already fetched,
// so it is instant and adds no request.

/** Health filters, chosen because they map to a decision: what can I trust, what needs work. */
type Health = "all" | "verified" | "needs_attention";

function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

export function EntityListPage({
  title,
  section,
  list,
}: {
  title: string;
  /** URL segment for the detail route, e.g. "components" → /components/<slug>. */
  section: string;
  list: EntityListDto;
}): ReactElement {
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<Health>("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return list.entities.filter((entity) => {
      if (health === "verified" && entity.verified_claims === 0) return false;
      if (health === "needs_attention" && entity.stale_claims === 0 && entity.disputed_claims === 0) return false;
      if (!needle) return true;
      return matches(entity.canonical_name, needle) || matches(entity.summary ?? "", needle);
    });
  }, [list.entities, query, health]);

  if (list.entities.length === 0) {
    return (
      <section aria-label={title}>
        <h1>{title}</h1>
        <p className="muted">No {title.toLowerCase()} have been captured for this repository yet.</p>
      </section>
    );
  }

  const total = list.entities.length;
  const showing = filtered.length;

  return (
    <section aria-label={title}>
      <header>
        <h1 className="detail-title">{title}</h1>
        <div className="list-controls">
          <input
            type="search"
            className="list-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${title.toLowerCase()}…`}
            aria-label={`Search ${title.toLowerCase()}`}
          />
          <div className="list-filters" role="group" aria-label="Filter by health">
            {([
              ["all", "All"],
              ["verified", "Verified"],
              ["needs_attention", "Needs attention"],
            ] as Array<[Health, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="list-filter"
                aria-pressed={health === value}
                onClick={() => setHealth(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="muted">
          {/* Always says what is being hidden. A filtered count shown as if it were the whole
              set is how a reader concludes knowledge is missing when it is merely filtered. */}
          {showing === total
            ? `${total} ${total === 1 ? "entry" : "entries"}`
            : `${showing} of ${total} shown`}
        </p>
      </header>

      {showing === 0 ? (
        <p className="empty-state">
          Nothing matches that filter. {total} {total === 1 ? "entry" : "entries"} exist in this
          section — clear the search or switch back to All.
        </p>
      ) : (
        <ul className="knowledge-list">
          {filtered.map((entity) => (
            <li key={entity.entity_id} className="knowledge-row">
              <a className="knowledge-title" href={withBase(`/${section}/${entity.slug}`)}>
                {entity.canonical_name}
              </a>
              {entity.summary && <p className="knowledge-summary">{entity.summary}</p>}
              {/* Health carries the confidence rung, same as the Knowledge page: an unverified
                  claim must not look like a verified one. */}
              <p
                className="fact knowledge-health"
                data-confidence={
                  entity.stale_claims > 0 || entity.disputed_claims > 0
                    ? "attention"
                    : entity.verified_claims > 0
                      ? "measured"
                      : "unknown"
                }
              >
                {entity.verified_claims > 0 ? `${entity.verified_claims} verified` : "unverified"}
                {entity.stale_claims > 0 && ` · ${entity.stale_claims} stale`}
                {entity.disputed_claims > 0 && ` · ${entity.disputed_claims} disputed`}
                {entity.status === "archived" && " · archived"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
