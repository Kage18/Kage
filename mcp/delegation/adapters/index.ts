// Adapter registry + detection. Kage hires labor; it never builds an agent loop.
// Adding a brand is one spec object — that is the whole point of the contract.
import { execFileSync, spawn } from "node:child_process";
import { cliAgentAdapter, lastTextFromStreamJson } from "./cli-agent.js";
import { stubAdapter } from "./stub.js";
import type { Adapter } from "./types.js";

const AGENT_RUN_TIMEOUT_MS = 45 * 60_000;

/**
 * Tools a hired agent may use without a permission prompt. In headless `-p` mode
 * there is no interactive dialog to answer, so anything not on this list is denied
 * outright — `--permission-mode acceptEdits` only auto-approves file edits, it does
 * NOT cover Bash (the same gap already fixed once on the manager path; see
 * MANAGER_ALLOWED_TOOLS in manager-client.ts and the comment on room-supervisor.ts).
 *   - Read, Glob, Grep: find and inspect existing code before touching it.
 *   - Write, Edit: make the change (belt-and-braces with acceptEdits, which covers
 *     the same ground but only inside the interactive flow).
 *   - Bash: run the repo's own tests and build. Without it the agent can only
 *     REASON about whether its change works — with it, it can OBSERVE the result,
 *     which is the entire difference between a claim that was checked and one that
 *     was guessed.
 */
export const AGENT_ALLOWED_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"];

/**
 * Tools a hired REVIEWER may use. review.ts's reviewRun brief tells the reviewer plainly
 * it is "reviewing another agent's finished run... not writing code yourself" — Write and
 * Edit are absent here for the same reason AGENT_ALLOWED_TOOLS above grants them: the set
 * a headless `-p` agent gets is the entire permission surface it has, nothing implicit.
 * Read/Glob/Grep let it look past what the review brief already excerpted (truncated at
 * MAX_DIFF_CHARS for a large diff); Bash lets it re-run a command to check a specific
 * claim rather than trust prose, never to redo the kernel's own mechanical checks — the
 * brief already tells it not to repeat those.
 */
export const REVIEWER_ALLOWED_TOOLS = ["Read", "Glob", "Grep", "Bash"];

export const claudeAdapter = (): Adapter => ({
  ...cliAgentAdapter({
    name: "claude",
    bin: "claude",
    // Headless, non-interactive, edits allowed inside the isolated worktree. Rides the
    // user's existing subscription — no API key, no separate billing.
    //
    // The session id is pre-assigned (or resumed) so a blocked agent can be ANSWERED
    // rather than restarted: `--resume` restores its full context, where a fresh
    // dispatch would throw away everything it had figured out.
    args: (brief, input) => claudeOneShotArgs(brief, input),
    finalMessage: lastTextFromStreamJson,
    timeoutMs: AGENT_RUN_TIMEOUT_MS,
  }),
  // The supervised path: stdin stays open for the run's whole life so a blocked turn
  // can be answered in place. NOTE: with `--input-format stream-json` the prompt does
  // NOT come from `-p` — the agent reads it as a user message on stdin. Passing `-p`
  // here made the agent sit silently waiting for input (found live).
  spawnLive: ({ workDir, sessionId, resumeSessionId }) =>
    spawn("claude", claudeLiveArgs({ sessionId, resumeSessionId }), { cwd: workDir, stdio: ["pipe", "pipe", "pipe"] }),
});

/**
 * Argv for the one-shot (`run()`) spawn, split out so the flags are unit-testable
 * without spawning the real CLI — same reasoning as `claudeLiveArgs` below.
 */
export function claudeOneShotArgs(brief: string, input: { sessionId?: string; resumeSessionId?: string }): string[] {
  return [
    ...(input.resumeSessionId ? ["--resume", input.resumeSessionId] : input.sessionId ? ["--session-id", input.sessionId] : []),
    "-p",
    brief,
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    AGENT_ALLOWED_TOOLS.join(","),
  ];
}

/**
 * Argv for the live (stdin-held) spawn, split out from `spawnLive` so the
 * `--resume` vs `--session-id` choice is unit-testable without spawning the real CLI.
 * `--resume` reattaches an existing session (its supervisor died, the agent's context
 * didn't); `--session-id` starts a fresh one under a chosen id. Never both.
 */
export function claudeLiveArgs(input: { sessionId?: string; resumeSessionId?: string }): string[] {
  return [
    ...(input.resumeSessionId ? ["--resume", input.resumeSessionId] : input.sessionId ? ["--session-id", input.sessionId] : []),
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    AGENT_ALLOWED_TOOLS.join(","),
  ];
}

/** Argv for codex's one-shot spawn, split out so it is unit-testable without spawning
 * the real CLI — same reasoning as claudeOneShotArgs above. */
export function codexArgs(brief: string): string[] {
  return ["exec", "--full-auto", brief];
}

export const codexAdapter = (): Adapter =>
  cliAgentAdapter({
    name: "codex",
    bin: "codex",
    args: (brief) => codexArgs(brief),
    timeoutMs: AGENT_RUN_TIMEOUT_MS,
  });

export const ADAPTER_NAMES = ["claude", "codex", "stub"] as const;
export type AdapterName = (typeof ADAPTER_NAMES)[number];

export function adapterByName(name: string): Adapter {
  if (name === "claude") return claudeAdapter();
  if (name === "codex") return codexAdapter();
  if (name === "stub") return stubAdapter();
  throw new Error(`Unknown agent: ${name}. One of: ${ADAPTER_NAMES.join(", ")}`);
}

/**
 * Argv for a reviewer pass over claude: the same one-shot shape as claudeOneShotArgs,
 * but REVIEWER_ALLOWED_TOOLS (no Write/Edit) instead of AGENT_ALLOWED_TOOLS, and no
 * `--permission-mode acceptEdits` — a reviewer has nothing to accept edits FOR. Keeps
 * claudeOneShotArgs's {sessionId, resumeSessionId} shape even though review.ts's
 * reviewRun never passes either today (one pass per invocation, no resume) — a future
 * resumed review then costs nothing to wire.
 */
export function claudeReviewerArgs(brief: string, input: { sessionId?: string; resumeSessionId?: string } = {}): string[] {
  return [
    ...(input.resumeSessionId ? ["--resume", input.resumeSessionId] : input.sessionId ? ["--session-id", input.sessionId] : []),
    "-p",
    brief,
    "--output-format",
    "stream-json",
    "--verbose",
    "--allowedTools",
    REVIEWER_ALLOWED_TOOLS.join(","),
  ];
}

export const claudeReviewerAdapter = (): Adapter =>
  cliAgentAdapter({
    name: "claude",
    bin: "claude",
    args: (brief, input) => claudeReviewerArgs(brief, input),
    finalMessage: lastTextFromStreamJson,
    timeoutMs: AGENT_RUN_TIMEOUT_MS,
  });

/**
 * Codex has no documented flag in this codebase for a read-only/no-edit review mode —
 * unlike claude's --allowedTools, --full-auto is codex exec's own approval policy, and
 * there is no verified equivalent to strip Write/Edit from it short of guessing at an
 * unconfirmed flag. This reuses codexArgs verbatim rather than invent one: a reviewer
 * running under codex gets the same edit-capable sandbox a worker does today. Tightening
 * this is a follow-up once a real codex flag for it is confirmed.
 */
export const codexReviewerArgs = codexArgs;

export const codexReviewerAdapter = (): Adapter =>
  cliAgentAdapter({ name: "codex", bin: "codex", args: (brief) => codexReviewerArgs(brief), timeoutMs: AGENT_RUN_TIMEOUT_MS });

/**
 * Resolve a REVIEWER adapter for the same agent brand a worker run used (task.agent) —
 * dispatch.ts's dispatchReviewer calls this so a claude-worked run is reviewed by claude
 * and a codex-worked one by codex, each in its own restricted review mode above. "stub"
 * defaults to an approving scripted review; a test wanting a specific verdict constructs
 * stubAdapter({review: {...}}) directly instead of going through this resolver.
 */
export function reviewerAdapterByName(name: string): Adapter {
  if (name === "claude") return claudeReviewerAdapter();
  if (name === "codex") return codexReviewerAdapter();
  if (name === "stub") return stubAdapter({ review: { verdict: "approved" } });
  throw new Error(`Unknown agent: ${name}. One of: ${ADAPTER_NAMES.join(", ")}`);
}

export function isAgentInstalled(bin: string): boolean {
  try {
    // `sh -c` with an explicit argv (rather than shell:true + args) — same lookup, no
    // Node deprecation warning leaking into the user's terminal.
    execFileSync("sh", ["-c", `command -v ${bin}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** First installed agent, in preference order. null when the user has none. */
export function detectAgent(): AdapterName | null {
  if (isAgentInstalled("claude")) return "claude";
  if (isAgentInstalled("codex")) return "codex";
  return null;
}
