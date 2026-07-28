// The Work board (orchestrator design §8): what is in flight, what stage it derived to and
// on what evidence, what the team already knows about the code it touches, and what it is
// costing against estimate. Stages are never editable — the only actions here are the two
// genuine decisions, claim and gate approval, which go through the command loop.

import React from "react";
import type { WorkBoardDto, WorkCardDto } from "../api/types";

const STAGE_ORDER: Array<WorkCardDto["stage"]> = ["proposed", "claimed", "building", "done"];

function Estimate({ card }: { card: WorkCardDto }): React.ReactElement {
  const { estimate } = card;
  if (estimate.confidence === "none") {
    return <span className="muted">no estimate yet — lands after the first tracked changes</span>;
  }
  return (
    <span className="muted">
      ~{estimate.tokens_p50.toLocaleString()} tokens (p90 {estimate.tokens_p90.toLocaleString()}) ·{" "}
      {estimate.confidence === "cold_start" ? "cold start, low confidence" : `from ${estimate.basis.length} similar changes`}
    </span>
  );
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
  return (
    <section>
      <header className="page-header">
        <h1>Work</h1>
        <p className="page-subtitle">
          Stages derive from commits and commands — nobody updates a status here. Claiming and
          approving a ship gate are the only decisions, because they are the only things a
          machine cannot observe.
        </p>
        <div className="entity-card-header">
          {STAGE_ORDER.filter((stage) => board.totals[stage]).map((stage) => (
            <span key={stage} className="pill">
              {stage} {board.totals[stage]}
            </span>
          ))}
          <label className="muted">
            {" "}acting as{" "}
            <input
              value={actor}
              onChange={(event) => onActorChange(event.target.value)}
              aria-label="Acting as"
            />
          </label>
        </div>
        {error ? <p className="empty-state">{error}</p> : null}
      </header>

      {board.items.length === 0 ? (
        <p className="empty-state">
          No work items yet. Create one from an intent: <code>kage plan --intent "…"</code>
        </p>
      ) : (
        <ul className="entity-list">
          {board.items.map((card) => (
            <li key={card.work_id} className="entity-card">
              <div className="entity-card-header">
                <span className="pill">{card.stage}</span>
                {card.claimed_by ? <span className="muted">claimed by {card.claimed_by}</span> : null}
                {card.evidence.length ? (
                  <span className="muted">
                    {card.evidence.length} commit{card.evidence.length === 1 ? "" : "s"} ·{" "}
                    {card.evidence[0].branch}
                  </span>
                ) : null}
              </div>
              <h2>{card.title}</h2>

              {card.knowledge.length ? (
                <div>
                  <p className="muted">What the team already knows about this code:</p>
                  <ul>
                    {card.knowledge.map((entry, index) => (
                      <li key={index}>{entry.title}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="muted">No prior memory cites this code — you are first here.</p>
              )}

              {card.blast_paths.length ? (
                <p className="muted">Touches: {card.blast_paths.slice(0, 6).join(", ")}</p>
              ) : null}

              <p>
                <Estimate card={card} />
              </p>

              {card.weak_evidence > 0 ? (
                <p className="muted">
                  {card.weak_evidence} weakly-correlated commit(s) — recorded, but never enough to
                  move a stage on their own.
                </p>
              ) : null}

              <div className="entity-card-header">
                {card.stage === "proposed" ? (
                  <button
                    type="button"
                    disabled={pending === card.work_id || !actor.trim()}
                    onClick={() => onCommand("task.claimed", card.work_id)}
                  >
                    {pending === card.work_id ? "Claiming…" : "Claim"}
                  </button>
                ) : null}
                {card.stage === "claimed" || card.stage === "building" ? (
                  <>
                    <button
                      type="button"
                      disabled={pending === card.work_id || !actor.trim()}
                      onClick={() => onCommand("task.released", card.work_id)}
                    >
                      Release
                    </button>
                    <button
                      type="button"
                      disabled={pending === card.work_id || !actor.trim()}
                      onClick={() => onCommand("gate.approved", card.work_id)}
                    >
                      Approve ship gate
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
