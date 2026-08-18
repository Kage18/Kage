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

export const codexAdapter = (): Adapter =>
  cliAgentAdapter({
    name: "codex",
    bin: "codex",
    args: (brief) => ["exec", "--full-auto", brief],
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
