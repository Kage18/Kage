// The Board: what is in flight, what stage it derived to, and on what evidence.
//
// Stages are never editable. Nobody types a status here — they are reduced from commits and the
// command log — and the only two actions are the genuine decisions a machine cannot observe:
// claiming work, and approving a ship gate.
//
// Grouped by stage rather than listed flat, because "what is being built right now" and "what
// nobody has picked up" are different questions and a flat list answers neither. Each group's
// rail carries its stage, and a stage nobody has claimed gets the attention rail — an agent
// building something unowned is the most expensive thing on this page.

import React from "react";
import type { WorkBoardDto, WorkCardDto } from "../api/types";
import { withBase } from "../router";
import { PageHeader } from "../components/PageHeader";

// Most-active first. `done` is last because it is the only group you scroll past rather than to.
const STAGE_ORDER: Array<WorkCardDto["stage"]> = ["building", "verifying", "claimed", "proposed", "done"];

const STAGE_LABEL: Record<WorkCardDto["stage"], string> = {
  building: "Building",
  verifying: "Verifying",
  claimed: "Claimed",
  proposed: "Proposed",
  done: "Done",
};

/** The rail's confidence rung. Building is lit because it is happening; proposed recedes. */
function railTone(card: WorkCardDto): string {
  // Unclaimed but being built is the expensive case, and it is why this is not just `stage`.
  if (card.stage === "building" && !card.claimed_by) return "critical";
  if (card.stage === "building") return "measured";
  if (card.stage === "verifying") return "attention";
  if (card.stage === "claimed") return "derived";
  return "unknown";
}

function evidenceLine(card: WorkCardDto): string {
  const parts: string[] = [];
  if (card.evidence.length) {
    parts.push(`${card.evidence[0].branch}`);
    parts.push(`${card.evidence.length} commit${card.evidence.length === 1 ? "" : "s"}`);
  } else {
    parts.push("no branch yet");
  }
  if (card.claimed_by) parts.push(card.claimed_by);
  else if (card.stage === "building") parts.push("nobody claimed it");
  return parts.join(" · ");
}

function estimateLine(card: WorkCardDto): string {
  const { estimate } = card;
  if (estimate.confidence === "none") return "no estimate yet";
  const basis =
    estimate.confidence === "cold_start"
      ? "cold start"
      : `from ${estimate.basis.length} similar change${estimate.basis.length === 1 ? "" : "s"}`;
  return `~${estimate.tokens_p50.toLocaleString()} tokens · ${basis}`;
}

export function WorkPage({
  board,
  actor,
  onActorChange,
  onCommand,
  pending,
  error,
}: {
  board: WorkBoardDto;
  actor: string;
  onActorChange: (next: string) => void;
  onCommand: (kind: string, workId: string) => void;
  pending: string | null;
  error: string | null;
}): React.ReactElement {
  const grouped = STAGE_ORDER.map((stage) => ({
    stage,
    cards: board.items.filter((card) => card.stage === stage),
  })).filter((group) => group.cards.length > 0);

  return (
    <section aria-label="Board">
      <PageHeader
        title="Board"
        lede="Every stage is derived from git and the command log. Nobody typed any of it."
        action={
          <label className="board-actor">
            <span className="fact">acting as</span>
            <input value={actor} onChange={(event) => onActorChange(event.target.value)} aria-label="Acting as" />
          </label>
        }
      />

      {error ? <p className="sheet-error">{error}</p> : null}

      {board.items.length === 0 ? (
        <p className="activity-empty">
          No work items yet. Create one from an intent: <code>kage plan --intent "…"</code>
        </p>
      ) : (
        <div className="board-cols">
          {grouped.map((group) => (
          <div key={group.stage} className="board-group">
            <p className="board-group-head">
              <span>{STAGE_LABEL[group.stage]}</span>
              <span className="fact">{group.cards.length}</span>
            </p>

            <ul className="board-list">
              {group.cards.map((card) => (
                <li key={card.work_id} className="board-card" data-confidence={railTone(card)}>
                  <a className="board-card-title" href={withBase(`/work/${encodeURIComponent(card.work_id)}`)}>
                    {card.title}
                  </a>
                  <p className="fact board-card-evidence">{evidenceLine(card)}</p>

                  {/* What's already known about the code this touches — the reason to read
                      the board before starting, rather than after. */}
                  {card.knowledge.length > 0 && (
                    <ul className="board-card-knowledge">
                      {card.knowledge.slice(0, 3).map((entry, index) => (
                        <li key={index}>{entry.title}</li>
                      ))}
                    </ul>
                  )}

                  <p className="fact board-card-estimate">
                    {estimateLine(card)}
                    {card.blast_paths.length ? ` · ${card.blast_paths.length} file${card.blast_paths.length === 1 ? "" : "s"}` : ""}
                    {/* Recorded, but never enough to move a stage on their own. */}
                    {card.weak_evidence > 0 ? ` · ${card.weak_evidence} weakly correlated` : ""}
                  </p>

                  <div className="board-card-actions">
                    {card.stage === "proposed" && (
                      <button
                        type="button"
                        className="board-action button-primary"
                        disabled={pending === card.work_id || !actor.trim()}
                        onClick={() => onCommand("task.claimed", card.work_id)}
                      >
                        {pending === card.work_id ? "Claiming…" : "Claim"}
                      </button>
                    )}
                    {(card.stage === "claimed" || card.stage === "building" || card.stage === "verifying") && (
                      <>
                        <button
                          type="button"
                          className="board-action button-primary"
                          disabled={pending === card.work_id || !actor.trim()}
                          onClick={() => onCommand("gate.approved", card.work_id)}
                        >
                            Approve ship gate
                        </button>
                        {/* Quiet: releasing is the undo, not the intent. */}
                        <button
                          type="button"
                          className="board-action-quiet"
                          disabled={pending === card.work_id || !actor.trim()}
                          onClick={() => onCommand("task.released", card.work_id)}
                        >
                            Release
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          ))}
        </div>
      )}
    </section>
  );
}
