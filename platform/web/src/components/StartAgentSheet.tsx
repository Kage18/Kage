// Start an agent — the screen where memory and agents visibly meet.
//
// Before anything runs you see the exact brief Kage assembled: which memories, marked verified or
// derived, which files it is grounded to, and roughly what it costs in context. Nobody else shows
// you what your agent is about to be told, and it is the product's whole claim made visible one
// second before it pays off.
//
// The preview is the PROMISE, not an illustration: the string shown here is the string sent, and
// the main process forwards it unchanged.

import { useState, type ReactElement } from "react";
import type { WorkCardDto } from "../api/types";
import type { Brief } from "../desktop";

const AGENTS = ["claude", "codex"] as const;

export function StartAgentSheet({
  items,
  brief,
  selectedWorkId,
  onSelectWork,
  onStart,
  onCancel,
  busy,
  error,
}: {
  /** Null while the board is still loading — distinct from an empty board, which is a fact. */
  items: WorkCardDto[] | null;
  /** Null while the selected item's detail is still loading. */
  brief: Brief | null;
  selectedWorkId: string | null;
  onSelectWork: (workId: string) => void;
  onStart: (agent: string) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}): ReactElement {
  const [agent, setAgent] = useState<string>(AGENTS[0]);
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Start an agent">
      <div className="sheet">
        <h2 className="sheet-title">Start an agent</h2>

        <label className="sheet-label" htmlFor="start-work">Work item</label>
        <select
          id="start-work"
          className="sheet-select"
          value={selectedWorkId ?? ""}
          onChange={(event) => onSelectWork(event.target.value)}
        >
          {/* "No work items yet" while a request is in flight is a claim nobody verified — the
              board takes seconds to derive on a cold cache, and saying it is empty in the meantime
              is the same class of lie as painting an unmeasured value as a zero. */}
          {items === null && <option value="">Loading the board…</option>}
          {items?.length === 0 && <option value="">No work items yet</option>}
          {(items ?? []).map((item) => (
            <option key={item.work_id} value={item.work_id}>
              {item.title} · {item.stage}
            </option>
          ))}
        </select>

        <p className="sheet-label">Agent</p>
        <div className="sheet-agents" role="group" aria-label="Agent">
          {AGENTS.map((name) => (
            <button
              key={name}
              type="button"
              className="sheet-agent"
              aria-pressed={agent === name}
              onClick={() => setAgent(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="sheet-brief-head">
          <p className="sheet-label">What it will be told</p>
          {brief && (
            <span className="fact">
              {brief.memories.length} {brief.memories.length === 1 ? "memory" : "memories"} ·{" "}
              {brief.paths.length} {brief.paths.length === 1 ? "file" : "files"} · ~
              {brief.tokens_est.toLocaleString()} tokens
            </span>
          )}
        </div>

        <div className="sheet-brief">
          {!brief ? (
            <p className="muted">Assembling the brief…</p>
          ) : (
            <>
              {brief.memories.length === 0 ? (
                <p className="muted">
                  Nothing recorded about these files yet. The agent runs without prior knowledge —
                  what it learns will be captured.
                </p>
              ) : (
                brief.memories.map((memory) => (
                  <div key={memory.title} className="sheet-memory">
                    <span className="status-glyph" aria-hidden="true">●</span>
                    <div>
                      <p className="sheet-memory-title">{memory.title}</p>
                      {memory.summary && <p className="fact sheet-memory-summary">{memory.summary}</p>}
                    </div>
                  </div>
                ))
              )}
              <p className="fact sheet-paths">
                {brief.paths.length ? brief.paths.join(" · ") : "not grounded to any file yet"}
              </p>
              <button type="button" className="sheet-reveal" onClick={() => setShowPrompt((open) => !open)}>
                {showPrompt ? "Hide the exact prompt" : "Show the exact prompt"}
              </button>
              {showPrompt && <pre className="sheet-prompt">{brief.prompt}</pre>}
            </>
          )}
        </div>

        {error && <p className="sheet-error">{error}</p>}

        <div className="sheet-actions">
          {/* Assist is the mode that injects memory, which is the whole reason to run an agent
              through Kage rather than directly. Stated, not offered as a choice to get wrong. */}
          <span className="fact sheet-mode">assist · memory is injected</span>
          <button type="button" className="sheet-cancel" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="sheet-start"
            onClick={() => onStart(agent)}
            disabled={busy || !brief || !selectedWorkId}
          >
            {busy ? "Starting…" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
