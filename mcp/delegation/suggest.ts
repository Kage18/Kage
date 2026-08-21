// The composer's ghost suggestion — one server-side source, per docs/design/
// SESSIONS_SURFACE.md §4. AO derives its ghost text from the transcript tail (whatever
// the worker's session said last, unverified); Kage derives it from the verdict, the
// same source every other surface (the receipt, the verdict chip) already reads. A run
// with nothing honest to suggest returns null — absence means absent, never filler text.
import type { ClaimRecord, TaskRecord } from "./contract.js";

export function suggestedNextPrompt(
  task: Pick<TaskRecord, "state" | "state_history" | "waiting_on">,
  claim: ClaimRecord | null,
): string | null {
  // A failed check names the failing command verbatim — the same check.cmd/exit_code
  // claimVerdict already reads (verify.ts), never text the agent typed about the failure.
  if (task.state === "failed" && claim) {
    const failedCommand = claim.checks.find((check) => check.kind === "command" && check.result === "fail" && check.cmd);
    if (failedCommand) return `the ${failedCommand.id} check failed: ${failedCommand.cmd} - fix and reverify`;
  }
  // Stopped by the stall detector (supervisor.ts's evaluateStallTurn) always leads its
  // note with "stalled:" — quote it verbatim. A stop for any other reason (budget halt,
  // a plain user stop) has no such note and falls through to null.
  if (task.state === "stopped") {
    const stopNote = [...task.state_history].reverse().find((entry) => entry.state === "stopped")?.note;
    if (stopNote && stopNote.startsWith("stalled:")) return stopNote;
  }
  if (task.state === "ready") return "review the receipt";
  if (task.state === "blocked" && task.waiting_on?.detail) return task.waiting_on.detail;
  return null;
}

// The Room composer's ghost text (docs/design/SESSIONS_SURFACE.md §4, §6): a room is
// not a TaskRecord, so it has no state/waiting_on of its own — but a manager pauses a
// goal by putting one of its DISPATCHED RUNS into "blocked" (dispatch.ts's plan-approval
// path, supervisor.ts's own blocked transitions), the exact same "blocked" rule
// suggestedNextPrompt already encodes. This wrapper is the room-shaped door onto that
// one rule: no new suggestion text, no new pattern-matching — a run not in "blocked"
// contributes nothing (suggestedNextPrompt's other branches all need a claim, e.g. a
// failed check's command, which a room-wide sweep does not carry), so passing `null`
// for claim on every candidate is safe and never produces a wrong answer, only a
// missed "review the receipt"/"stalled" one — appropriate, since those are per-run
// facts, not something the room as a whole is "waiting on" from the user.
export function suggestedNextForRoom(runs: Pick<TaskRecord, "state" | "state_history" | "waiting_on">[]): string | null {
  for (const run of runs) {
    if (run.state !== "blocked") continue;
    const suggestion = suggestedNextPrompt(run, null);
    if (suggestion) return suggestion;
  }
  return null;
}
