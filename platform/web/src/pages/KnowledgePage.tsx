// Knowledge — one page for every kind, replacing ten sidebar entries that were the same page
// with a different filter.
//
// The old IA put Features, Components, Flows, Runbooks, Decisions, Contracts, Data Models,
// Invariants, Incidents and Documents in the sidebar as ten peers. All ten rendered the
// identical component. So the navigation was ten items wide to express one page and one
// parameter, and the cost was real: you could not see that a repository had 164 decisions and
// zero features without visiting ten pages to find out, and a search only ever covered the one
// kind you happened to be standing in.
//
// A kind is a FILTER, not a destination. The chips carry counts, so the shape of what a
// repository knows is legible before you click anything — and a kind with nothing in it says
// so instead of being an empty page you had to navigate to.

import { useMemo, useState, type ReactElement } from "react";
import type { EntityListDto } from "../api/types";
import { withBase } from "../router";

export interface KnowledgeKind {
  kind: string;
  label: string;
  list: EntityListDto | null;
  /** Null until loaded — a count of 0 and "not loaded yet" are different facts. */
  count: number | null;
}

type Health = "all" | "verified" | "needs_attention";

function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

export function KnowledgePage({
  kinds,
  selected,
  onSelect,
}: {
  kinds: KnowledgeKind[];
  /** The active kind, or "all". */
  selected: string;
  onSelect: (kind: string) => void;
}): ReactElement {
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<Health>("all");

  // Searching across EVERY kind at once is the capability the old IA made impossible: an
  // answer you half-remember is rarely filed where you expect it.
  const pool = useMemo(() => {
    const chosen = selected === "all" ? kinds : kinds.filter((k) => k.kind === selected);
    return chosen.flatMap((k) =>
      (k.list?.entities ?? []).map((entity) => ({ entity, kind: k.kind, label: k.label })),
    );
  }, [kinds, selected]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pool.filter(({ entity }) => {
      if (health === "verified" && entity.verified_claims === 0) return false;
      if (health === "needs_attention" && entity.stale_claims === 0 && entity.disputed_claims === 0) return false;
      if (!needle) return true;
      return matches(entity.canonical_name, needle) || matches(entity.summary ?? "", needle);
    });
  }, [pool, query, health]);

  const total = pool.length;
  const loaded = kinds.filter((k) => k.count !== null);
  const grandTotal = loaded.reduce((sum, k) => sum + (k.count ?? 0), 0);

  return (
    <section aria-label="Knowledge">
      <header>
        <h1 className="visually-hidden">Knowledge</h1>
        <p className="board-lede">
          A kind is a filter rather than a destination, so a search covers all of them at once — an
          answer you half-remember is rarely filed where you expect it.
        </p>

        <div className="kind-chips" role="group" aria-label="Filter by kind">
          <button
            type="button"
            className="kind-chip"
            aria-pressed={selected === "all"}
            onClick={() => onSelect("all")}
          >
            All <span className="kind-count">{grandTotal.toLocaleString()}</span>
          </button>
          {kinds.map((kind) => (
            <button
              key={kind.kind}
              type="button"
              className="kind-chip"
              aria-pressed={selected === kind.kind}
              // A kind with nothing in it is disabled rather than hidden: "we have no runbooks"
              // is information, and hiding it makes the absence invisible.
              disabled={kind.count === 0}
              onClick={() => onSelect(kind.kind)}
            >
              {kind.label}{" "}
              <span className="kind-count">{kind.count === null ? "…" : kind.count.toLocaleString()}</span>
            </button>
          ))}
        </div>

        <div className="list-controls">
          <input
            type="search"
            className="list-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search everything…"
            aria-label="Search knowledge"
          />
          <div className="list-filters" role="group" aria-label="Filter by health">
            {([["all", "All"], ["verified", "Verified"], ["needs_attention", "Needs attention"]] as Array<[Health, string]>)
              .map(([value, label]) => (
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
          {/* Always says what is being hidden — a filtered count shown as a total reads as
              "this knowledge is missing", which is the worst thing a memory tool can imply. */}
          {filtered.length === total
            ? `${total.toLocaleString()} ${total === 1 ? "entry" : "entries"}`
            : `${filtered.length.toLocaleString()} of ${total.toLocaleString()} shown`}
        </p>
      </header>

      {filtered.length === 0 ? (
        <p className="empty-state">
          {total === 0
            ? "Nothing captured for this kind yet."
            : `Nothing matches that filter. ${total.toLocaleString()} entries exist here — clear the search or switch back to All.`}
        </p>
      ) : (
        <ul className="knowledge-list">
          {filtered.map(({ entity, kind, label }) => (
            <li key={`${kind}:${entity.entity_id}`} className="knowledge-row">
              <div className="knowledge-row-head">
                {/* In the "All" view the kind is the thing you cannot infer from the title. */}
                <span className="fact knowledge-kind">{label}</span>
                {/* Health carries the confidence rung: a claim nobody verified must not look like
                    one that was, and a stale one has to be visible without opening it. */}
                <span
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
                </span>
              </div>
              <a className="knowledge-title" href={withBase(`/${kind}/${entity.slug}`)}>
                {entity.canonical_name}
              </a>
              {entity.summary && <p className="knowledge-summary">{entity.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
