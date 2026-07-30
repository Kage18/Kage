// An agent session the desktop app started, and the events it produced.
//
// The app runs agents HEADLESS — `claude -p --output-format stream-json` — rather than embedding a
// terminal. That is the right shape for an orchestrator: you hand an agent a brief (which Kage
// already compiles) and collect a receipt (which the proxy already writes). It also avoids
// `node-pty`, a native module needing an ABI rebuild for every Electron version.
//
// CORRELATION, which is the part that has to be right. The run strip claims "memory reached the
// agent at this moment", and that fact lives in the proxy, not in the agent's stdout. The proxy
// generates its session id ONCE PER PROCESS (`proxy.ts`: "a stable per-process id"), so the app
// gives every session its own proxy on its own port. Then every receipt from that proxy belongs to
// that session BY CONSTRUCTION — no attribution by timing, which the correlation ladder refuses
// everywhere else and would be no more honest here.
//
// What this module does NOT do: invent recall marks. Tool ticks come from the agent's own stream
// and are therefore directly observed; recall marks come from the proxy's own delivery rows, and
// when there are none the strip simply has none.
//
// PLACEMENT, revised. An earlier version marked recalls by ASSISTANT TURN INDEX, reasoning that the
// Nth proxy request is structurally the Nth turn. That mapping does not survive contact with the
// delivery store: `buildProxyDelivery` writes NO ROW for a request that composed nothing, so the
// rows are a SUBSEQUENCE of the requests and the index is genuinely lost. Nobody ever supplied the
// turn set, so the strip's whole thesis — memory reaching an agent mid-flight — could not render.
//
// So the strip is a TIMELINE rather than an index sequence. Every tool tick carries the time the app
// observed it, every recall carries the `delivered_at` the proxy recorded, and both are read from
// the same system clock because the app spawns the proxy itself. No correspondence is claimed
// between a mark and a tick — they are two measured series plotted on one axis, which is strictly
// more honest than the index scheme AND actually renders.

export type SessionState = "starting" | "running" | "exited" | "failed";

export interface SessionEvent {
  seq: number;
  kind: "started" | "tool" | "text" | "result" | "error";
  /** One line a person can read. Never raw JSON. */
  summary: string;
  /**
   * When the app OBSERVED this event, ISO-8601.
   *
   * Stamped at the process edge — main reads the agent's stdout as it arrives — rather than inside
   * `parseStreamLine`, which stays pure. The agent's stream carries no timestamps of its own, so
   * this is the only real reading available, and it is an observation rather than an inference.
   */
  at: string;
}

export interface AgentSession {
  session_id: string;
  work_id: string | null;
  agent: string;
  state: SessionState;
  /** Set once the agent reports a terminal result. */
  exit_code: number | null;
  /** Cost in USD, only when the agent reported it. Null means unmeasured, never zero. */
  cost_usd: number | null;
  events: SessionEvent[];
}

export function newSession(spec: { session_id: string; work_id: string | null; agent: string }): AgentSession {
  return { ...spec, state: "starting", exit_code: null, cost_usd: null, events: [] };
}

/**
 * The command that runs one agent headlessly against a brief.
 *
 * Per-agent, because the flags genuinely differ and guessing produces a process that either hangs
 * waiting for a TTY or prints help. Only agents whose headless contract has been checked are here;
 * an unknown agent is refused rather than launched hopefully.
 */
export function agentCommand(agent: string, prompt: string): { command: string; args: string[] } | null {
  switch (agent) {
    case "claude":
      // `--print` is the headless mode; stream-json emits one JSON object per line as it goes,
      // and `--verbose` is required for stream-json to include tool events.
      return { command: "claude", args: ["--print", "--output-format", "stream-json", "--verbose", prompt] };
    case "codex":
      return { command: "codex", args: ["exec", "--json", prompt] };
    default:
      return null;
  }
}

/** Environment for the child: the proxy, and nothing else. */
export function agentEnv(proxyPort: number): Record<string, string> {
  return { ANTHROPIC_BASE_URL: `http://127.0.0.1:${proxyPort}` };
}

function describeTool(name: string, input: unknown): string {
  const record = (input ?? {}) as Record<string, unknown>;
  const target = record.file_path ?? record.path ?? record.pattern ?? record.command ?? record.url;
  return typeof target === "string" && target.length > 0 ? `${name} ${target}` : name;
}

/**
 * Parse one line of an agent's stream into events.
 *
 * Returns an array because a single assistant message can carry both prose and several tool calls.
 * Unparseable or uninteresting lines yield nothing — an agent is free to print whatever it likes,
 * and a stray line must never break a running session.
 *
 * PURE: no `at`, because this function reads no clock. The stream carries no timestamps, so the only
 * honest reading is when the app observed the line, and that belongs at the process edge.
 */
export function parseStreamLine(line: string): Array<Omit<SessionEvent, "seq" | "at">> {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return [];
  }

  const type = parsed.type;

  if (type === "system" && parsed.subtype === "init") {
    return [{ kind: "started", summary: "session started" }];
  }

  if (type === "assistant") {
    const message = (parsed.message ?? {}) as { content?: unknown };
    const content = Array.isArray(message.content) ? message.content : [];
    const events: Array<Omit<SessionEvent, "seq" | "at">> = [];
    for (const block of content) {
      const item = (block ?? {}) as Record<string, unknown>;
      if (item.type === "tool_use" && typeof item.name === "string") {
        events.push({ kind: "tool", summary: describeTool(item.name, item.input) });
      } else if (item.type === "text" && typeof item.text === "string" && item.text.trim()) {
        events.push({ kind: "text", summary: item.text.trim().split("\n")[0].slice(0, 160) });
      }
    }
    return events;
  }

  if (type === "result") {
    const failed = parsed.is_error === true || parsed.subtype === "error";
    return [{ kind: failed ? "error" : "result", summary: failed ? "the agent reported an error" : "done" }];
  }

  return [];
}

/** Fold one parsed event into a session. Pure — the app keeps the state, this decides it. */
export function applyEvent(session: AgentSession, event: Omit<SessionEvent, "seq">): AgentSession {
  const events = [...session.events, { ...event, seq: session.events.length }];
  let state: SessionState = session.state;
  if (event.kind === "started" && state === "starting") state = "running";
  if (event.kind === "result") state = "exited";
  if (event.kind === "error") state = "failed";
  // A tool call before any init line still means it is running — some agents skip the init event.
  if (event.kind === "tool" && state === "starting") state = "running";
  return { ...session, state, events };
}

/**
 * Close a session on process exit.
 *
 * The exit code is authoritative over the stream: an agent that printed "done" and then exited
 * non-zero did NOT succeed, and reporting the stream's optimism would be the kind of quiet lie
 * this product exists to prevent.
 */
export function closeSession(session: AgentSession, exitCode: number | null): AgentSession {
  const failed = exitCode !== 0 && exitCode !== null;
  return {
    ...session,
    exit_code: exitCode,
    state: failed ? "failed" : session.state === "failed" ? "failed" : "exited",
  };
}

export interface Tick {
  /** When the app observed the tool call, ISO-8601 — carried through from the event. */
  at: string;
  /** 0..1, for tick height. Uniform when nothing better is known. */
  weight: number;
}

/**
 * The run strip's tool-call series: one tick per tool call the agent actually made, at the time the
 * app observed it. Prose contributes nothing — a tick is an action, not a thought.
 *
 * Recall marks are NOT produced here. They come from the proxy's delivery rows and are placed on the
 * same time axis by the caller; see the PLACEMENT note at the top of this file for why the previous
 * turn-index scheme was abandoned.
 */
export function stripTicks(events: readonly SessionEvent[]): Tick[] {
  return events.filter((event) => event.kind === "tool").map((event) => ({ at: event.at, weight: 0.5 }));
}
