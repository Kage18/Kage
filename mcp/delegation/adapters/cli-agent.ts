// Shared implementation for CLI-driven coding agents (claude, codex). An adapter is
// deliberately thin: spawn the agent headless in the run's worktree, stream everything
// to the transcript, and hand back the final message. Kage's guarantees live in the
// kernel, never in the agent's cooperation.
import { spawn } from "node:child_process";
import { appendFileSync, createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { progressFromStreamEvent } from "../progress.js";
import type { Adapter, AdapterInput, AdapterOutcome } from "./types.js";

export interface CliAgentSpec {
  name: string;
  /** Executable to look for on PATH. */
  bin: string;
  /** Argv builder — the brief is passed as the prompt. */
  args: (briefBody: string, input: AdapterInput) => string[];
  /**
   * Pull the assistant's final text out of the agent's stdout. Agents differ: some
   * stream JSON lines, some print prose. Default: the raw stdout.
   */
  finalMessage?: (stdout: string) => string;
  timeoutMs?: number;
}

export function cliAgentAdapter(spec: CliAgentSpec): Adapter {
  return {
    name: spec.name,
    async run(input: AdapterInput): Promise<AdapterOutcome> {
      mkdirSync(dirname(input.transcriptPath), { recursive: true });
      const transcript = createWriteStream(input.transcriptPath, { flags: "a" });
      const log = (event: Record<string, unknown>): void => {
        transcript.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
      };
      log({ kind: "start", adapter: spec.name, bin: spec.bin, run_id: input.runId });

      return await new Promise<AdapterOutcome>((resolve) => {
        let child;
        try {
          child = spawn(spec.bin, spec.args(input.briefBody, input), {
            cwd: input.workDir,
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, KAGE_RUN_ID: input.runId },
          });
          input.onStart?.(child.pid);
          log({ kind: "pid", pid: child.pid });
        } catch (error) {
          log({ kind: "spawn_error", error: String(error) });
          transcript.end();
          resolve({ exit_code: 127, final_message: `${spec.bin} could not be started: ${String(error)}` });
          return;
        }

        let stdout = "";
        let stderr = "";
        let pending = "";
        let waiting: { detail: string; needs: string } | undefined;
        let sessionId: string | undefined = input.sessionId ?? input.resumeSessionId;
        let usage = { usd: 0, tokens: 0 };
        const timer = spec.timeoutMs
          ? setTimeout(() => {
              log({ kind: "timeout", ms: spec.timeoutMs });
              child.kill("SIGTERM");
            }, spec.timeoutMs)
          : null;

        child.stdout?.on("data", (chunk: Buffer) => {
          const text = chunk.toString("utf8");
          stdout += text;
          // Parse line-by-line as the agent works so the transcript holds structured
          // activity ("editing mcp/cli.ts") rather than a wall of raw stream chunks —
          // that is what makes live progress and `kage status --watch` possible.
          pending += text;
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            // The agent's own machine-readable "I am waiting on a human" signal. It fires
            // even when the agent asks in plain prose without any protocol fence, which is
            // the case a claim-fence-only design misses entirely.
            const signal = waitingSignal(line);
            if (signal) {
              waiting = signal;
              log({ kind: "waiting", ...signal });
              input.onProgress?.({ kind: "phase", label: `waiting on you: ${signal.detail}` });
            }
            const id = sessionIdFrom(line);
            if (id) sessionId = id;
            const turnUsage = usageFrom(line);
            if (turnUsage) {
              // A steered run has one result event per turn; the run's spend is their sum.
              usage = { usd: usage.usd + turnUsage.usd, tokens: usage.tokens + turnUsage.tokens };
              log({ kind: "usage", usd: turnUsage.usd, tokens: turnUsage.tokens });
            }
            const event = progressFromStreamEvent(line);
            if (event) {
              log(event as unknown as Record<string, unknown>);
              input.onProgress?.(event);
            } else {
              log({ kind: "stdout", text: line });
            }
          }
        });
        child.stderr?.on("data", (chunk: Buffer) => {
          const text = chunk.toString("utf8");
          stderr += text;
          log({ kind: "stderr", text });
        });
        child.on("error", (error) => {
          if (timer) clearTimeout(timer);
          log({ kind: "error", error: String(error) });
          transcript.end();
          resolve({ exit_code: 127, final_message: `${spec.bin} is not available: ${String(error)}` });
        });
        child.on("close", (code) => {
          if (timer) clearTimeout(timer);
          const finalMessage = (spec.finalMessage ? spec.finalMessage(stdout) : stdout) || stderr;
          log({ kind: "final", exit_code: code ?? 0, message: finalMessage, session_id: sessionId });
          transcript.end();
          resolve({
            exit_code: code ?? 0,
            final_message: finalMessage,
            ...(waiting ? { waiting } : {}),
            ...(sessionId ? { session_id: sessionId } : {}),
            ...(usage.usd > 0 || usage.tokens > 0 ? { usage } : {}),
          });
        });
      });
    },
  };
}

/**
 * `post_turn_summary` is the only machine-readable "this agent is waiting on you" signal
 * — the run's `result` still reports success, so a design that only reads the final
 * message cannot tell a finished agent from a stuck one. It also fires when the agent
 * asks in plain prose, which no protocol fence can catch.
 */
export function waitingSignal(line: string): { detail: string; needs: string } | null {
  try {
    const event = JSON.parse(line) as {
      subtype?: string;
      status_category?: string;
      status_detail?: string;
      needs_action?: string;
    };
    if (event.subtype !== "post_turn_summary" || event.status_category !== "blocked") return null;
    return { detail: (event.status_detail ?? "waiting on you").trim(), needs: (event.needs_action ?? "").trim() };
  } catch {
    return null;
  }
}

/**
 * Cost and tokens from claude's `result` stream event. The run schema has carried a
 * spend field from day one and it was permanently zero: this line was already being
 * parsed (for session_id) and the total_cost_usd / usage fields on the SAME OBJECT
 * were discarded — the diff-paths bug again, in miniature. Returns null unless the
 * agent actually reported numbers; nothing here estimates.
 */
export function usageFrom(line: string): { usd: number; tokens: number } | null {
  try {
    const event = JSON.parse(line) as {
      type?: string;
      total_cost_usd?: number;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    };
    if (event.type !== "result") return null;
    const usd = typeof event.total_cost_usd === "number" ? event.total_cost_usd : 0;
    // ALL token fields, cache included: a run's cost is dominated by cache reads, and
    // "619 tok" beside "$0.19" reads as a contradiction when the other 60k tokens are
    // sitting in cache fields. The total should explain the price.
    const usage = event.usage ?? {};
    const tokens =
      (usage.input_tokens ?? 0) +
      (usage.output_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0);
    if (usd <= 0 && tokens <= 0) return null;
    return { usd, tokens };
  } catch {
    return null;
  }
}

export function sessionIdFrom(line: string): string | null {
  try {
    const event = JSON.parse(line) as { session_id?: string };
    return typeof event.session_id === "string" && event.session_id ? event.session_id : null;
  } catch {
    return null;
  }
}

// stream-json transports emit one JSON object per line; the last assistant/result text
// is the agent's final word. Falls back to raw stdout when the stream is not JSON, so a
// format change degrades to "we still have the text" rather than an empty claim.
export function lastTextFromStreamJson(stdout: string): string {
  const texts: string[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const event = JSON.parse(trimmed) as {
        type?: string;
        result?: unknown;
        message?: { content?: Array<{ type?: string; text?: string }> };
      };
      if (typeof event.result === "string" && event.result.trim()) texts.push(event.result);
      for (const block of event.message?.content ?? []) {
        if (block.type === "text" && block.text?.trim()) texts.push(block.text);
      }
    } catch {
      // Not a JSON line — ignored; the raw fallback below still applies.
    }
  }
  return texts.length ? texts[texts.length - 1] : stdout;
}

export function appendTranscript(path: string, event: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, "utf8");
}
