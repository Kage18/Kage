// The real LibrarianProvider — the seam where Kage borrows the user's own agent.
//
// `claude -p` runs headless on the subscription the user already pays for, so Kage pays for
// zero inference, ever (DIRECTION.md). This file owns exactly two things: the argument
// contract for that spawn, and the honest reading of what comes back. buildClaudeArgs is
// exported on its own so the contract has unit tests that never spawn anything; fakeProvider
// lives here too so every consumer test scripts the seam the same way.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { LibrarianProvider, ProviderReply } from "./types.js";

const execFileAsync = promisify(execFile);

export interface ClaudeProviderOptions {
  /** The binary to spawn. Defaults to "claude" on PATH; tests point it at a script. */
  command?: string;
  cwd?: string;
  triageModel?: string;
  extractModel?: string;
  timeoutMs?: number;
}

/**
 * The exact argv for a headless run. Exported separately so the argument contract is
 * unit-testable without spawning anything — a wrong flag here fails *quietly* in production
 * (the runner prints help text, which reads as an unparseable reply) but loudly in a test.
 * Tier maps to the cheapest model for triage and the working model for extraction.
 */
export function buildClaudeArgs(
  prompt: string,
  tier: "triage" | "extract",
  opts: ClaudeProviderOptions = {},
): string[] {
  const model = tier === "triage" ? (opts.triageModel ?? "haiku") : (opts.extractModel ?? "sonnet");
  return ["-p", "--output-format", "json", "--model", model, prompt];
}

export function claudeProvider(opts: ClaudeProviderOptions = {}): LibrarianProvider {
  return {
    async complete({ prompt, tier }) {
      // Spawn failures — missing binary, nonzero exit, timeout — REJECT. The caller decides
      // whether a failed run is retryable; only successful runs with odd output degrade.
      const { stdout } = await execFileAsync(
        opts.command ?? "claude",
        buildClaudeArgs(prompt, tier, opts),
        {
          cwd: opts.cwd,
          // 3 minutes: extraction over a long digest is slow, but a hung runner must not
          // wedge the daemon that dispatched it.
          timeout: opts.timeoutMs ?? 180_000,
          // 32MB: -p --output-format json delivers the whole reply as one stdout blob.
          maxBuffer: 32 * 1024 * 1024,
        },
      );
      return readRunnerEnvelope(stdout);
    },
  };
}

/**
 * The runner's envelope is {result, usage:{input_tokens,output_tokens}, total_cost_usd}.
 * Anything else degrades to {text: rawStdout, usage all null} — HONEST: text arrived, usage
 * was not measured. Never invent numbers for a reply we could not parse; null renders as
 * "unmeasured" downstream, and a fabricated zero would read as a measurement.
 */
function readRunnerEnvelope(stdout: string): ProviderReply {
  try {
    const parsed = JSON.parse(stdout) as {
      result?: unknown;
      usage?: { input_tokens?: unknown; output_tokens?: unknown };
      total_cost_usd?: unknown;
    };
    if (typeof parsed?.result === "string") {
      return {
        text: parsed.result,
        inputTokens: typeof parsed.usage?.input_tokens === "number" ? parsed.usage.input_tokens : null,
        outputTokens: typeof parsed.usage?.output_tokens === "number" ? parsed.usage.output_tokens : null,
        costUsd: typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : null,
      };
    }
  } catch {
    // Not JSON at all — fall through to the raw-text reading.
  }
  return { text: stdout, inputTokens: null, outputTokens: null, costUsd: null };
}

/**
 * Scripted replies for tests. Sequential on purpose: a test that scripts two replies and
 * triggers a third call has a wrong mental model of the pipeline, and the throw says so
 * immediately instead of silently replaying stale text.
 */
export function fakeProvider(
  replies: Array<string | ((prompt: string) => string)>,
): LibrarianProvider & { calls: Array<{ prompt: string; tier: string }> } {
  const calls: Array<{ prompt: string; tier: string }> = [];
  let next = 0;
  return {
    calls,
    async complete({ prompt, tier }) {
      calls.push({ prompt, tier });
      if (next >= replies.length) {
        throw new Error(`fakeProvider exhausted: ${replies.length} replies scripted, call ${next + 1} made`);
      }
      const reply = replies[next++];
      const text = typeof reply === "function" ? reply(prompt) : reply;
      return { text, inputTokens: null, outputTokens: null, costUsd: null };
    },
  };
}
