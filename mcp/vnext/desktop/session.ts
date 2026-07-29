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
// and are therefore directly observed; recall marks are supplied by the caller from the receipt
// store, and when they are unavailable the strip simply has none.

export type SessionState = "starting" | "running" | "exited" | "failed";

export interface SessionEvent {
  seq: number;
  kind: "started" | "tool" | "text" | "result" | "error";
  /** One line a person can read. Never raw JSON. */
  summary: string;
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
 */
export function parseStreamLine(line: string): Array<Omit<SessionEvent, "seq">> {
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
    const events: Array<Omit<SessionEvent, "seq">> = [];
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
  /** True where the proxy recorded that memory was injected for this turn. */
  recall: boolean;
  /** 0..1, for tick height. Uniform when nothing better is known. */
  weight: number;
}

/**
 * The run strip's data: one tick per tool call the agent actually made.
 *
 * `recallTurns` is the set of assistant-turn indices where the proxy attached memory, supplied by
 * the caller from the receipt store. It is a SET OF INDICES rather than timestamps on purpose —
 * the Nth proxy request corresponds to the Nth assistant turn structurally, whereas matching on
 * time would be a guess dressed as a measurement. Pass an empty set and the strip honestly shows
 * no recalls rather than inventing them.
 */
export function stripTicks(events: readonly SessionEvent[], recallTurns: ReadonlySet<number> = new Set()): Tick[] {
  const ticks: Tick[] = [];
  let turn = 0;
  for (const event of events) {
    if (event.kind === "text") turn += 1; // prose marks the start of an assistant turn
    if (event.kind !== "tool") continue;
    ticks.push({ recall: recallTurns.has(turn), weight: 0.5 });
  }
  return ticks;
}
