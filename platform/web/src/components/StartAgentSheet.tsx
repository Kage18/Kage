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

/** The Work item value that means "a task I'll type", distinct from "nothing selected yet". */
export const FREE_FORM = "__free_form__";

export function StartAgentSheet({
  items,
  brief,
  selectedWorkId,
  task,
  onSelectWork,
  onTaskChange,
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
  /** What the user typed, when the free-form option is chosen. */
  task: string;
  onSelectWork: (workId: string) => void;
  onTaskChange: (task: string) => void;
  onStart: (agent: string) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}): ReactElement {
  const [agent, setAgent] = useState<string>(AGENTS[0]);
  const [showPrompt, setShowPrompt] = useState(false);

  // Nothing selected IS the free-form case. Deriving it rather than waiting for an effect to set it
  // keeps the select's displayed option and the sheet's behaviour from disagreeing — a `null` value
  // matches no <option>, so the browser shows the first one while the code still thinks nothing is
  // chosen, and the Task field silently fails to appear.
  const mode = selectedWorkId ?? FREE_FORM;
  const freeForm = mode === FREE_FORM;
  // What has to be true for a run to be startable, stated once so the button and the empty state
  // cannot disagree about it.
  const ready = freeForm ? task.trim().length > 0 : Boolean(brief);

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Start an agent">
      <div className="sheet">
        <h2 className="sheet-title">Start an agent</h2>

        <label className="sheet-label" htmlFor="start-work">Work item</label>
        <select
          id="start-work"
          className="sheet-select"
          value={mode}
          onChange={(event) => onSelectWork(event.target.value)}
        >
          {/* Always available, and the only option on a repository with nothing derived yet. Without
              it, a fresh repository could not start an agent at all. */}
          <option value={FREE_FORM}>A task I'll describe</option>
          {/* "No work items yet" while a request is in flight is a claim nobody verified — the
              board takes seconds to derive on a cold cache, and saying it is empty in the meantime
              is the same class of lie as painting an unmeasured value as a zero. */}
          {items === null && <option value="" disabled>Loading the board…</option>}
          {(items ?? []).map((item) => (
            <option key={item.work_id} value={item.work_id}>
              {item.title} · {item.stage}
            </option>
          ))}
        </select>
        {items?.length === 0 && (
          <p className="sheet-note">
            No work items derived yet — they appear once a branch or a proposal exists. Describe the
            task instead.
          </p>
        )}

        {freeForm && (
          <>
            <label className="sheet-label" htmlFor="start-task">Task</label>
            <textarea
              id="start-task"
              className="sheet-task"
              rows={3}
              value={task}
              onChange={(event) => onTaskChange(event.target.value)}
              placeholder="What should the agent do?"
            />
          </>
        )}

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
            // "Assembling…" is only true when something is actually in flight. With nothing chosen,
            // saying it would be a spinner for work that is never going to start — which is exactly
            // what a repository with no work items used to show, forever.
            <p className="muted">
              {freeForm
                ? "Type the task above and it becomes the brief, verbatim."
                : "Choose a work item, or describe a task."}
            </p>
          ) : (
            <>
              {brief.memories.length === 0 ? (
                <p className="muted">
                  {freeForm
                    ? "Nothing is attached up front. Memory is injected as the agent works, and every delivery shows on its run strip."
                    : "Nothing recorded about these files yet. The agent runs without prior knowledge — what it learns will be captured."}
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
              {/* A free-form task has no chosen file set, so there is nothing to be grounded TO.
                  "not grounded to any file yet" would imply a grounding that is merely missing. */}
              {!freeForm && (
                <p className="fact sheet-paths">
                  {brief.paths.length ? brief.paths.join(" · ") : "not grounded to any file yet"}
                </p>
              )}
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
            disabled={busy || !ready}
          >
            {busy ? "Starting…" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
