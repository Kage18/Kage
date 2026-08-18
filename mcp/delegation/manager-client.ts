// Talking to the manager from anywhere (the console's Ask pane, scripts, a session
// harness). The manager is a rented mind: we spawn the user's own coding agent headless,
// hand it Kage's tools and constitution, and let it act. Nothing here interprets its
// answer — the kernel already owns every guarantee it could touch.
import { spawn } from "node:child_process";
import { detectAgent } from "./adapters/index.js";
import { MANAGER_CONSTITUTION } from "./manager-prompt.js";
import { writeRoomMcpConfig } from "./room.js";

/** Tools a manager may use without a permission prompt. Read + delegation verbs only. */
export const MANAGER_ALLOWED_TOOLS = [
  "kage_room_state",
  "kage_events_since",
  "kage_compile_brief",
  "kage_dispatch",
  "kage_task",
  "kage_tell",
  "kage_stop",
  "kage_merge_run",
  "kage_reject_run",
  "kage_report",
  "kage_judgment",
  "kage_goal_create",
  "kage_goal_status",
  "kage_goal_finish",
].map((name) => `mcp__kage__${name}`);

export interface ManagerTurn {
  role: "you" | "kage";
  text: string;
}

export interface ManagerReply {
  text: string;
  tools: string[];
  cost_usd?: number;
  ok: boolean;
  /** Card numbers the manager tried to restate, replaced on the way out. */
  redactions?: string[];
}

export interface ManagerLaunch {
  command: string;
  args: string[];
}

// Pure, so the wiring is testable without spending a token.
export function buildManagerArgs(options: { mcpConfigPath: string; prompt: string; agent?: string }): ManagerLaunch {
  const agent = options.agent ?? "claude";
  if (agent === "codex") {
    return { command: "codex", args: ["exec", "--full-auto", options.prompt] };
  }
  return {
    command: "claude",
    args: [
      "-p",
      options.prompt,
      "--mcp-config",
      options.mcpConfigPath,
      // ToolSearch is included because some clients defer MCP tools behind it; without
      // it the manager can see the tools but not load them.
      "--allowedTools",
      [...MANAGER_ALLOWED_TOOLS, "ToolSearch"].join(","),
      "--append-system-prompt",
      MANAGER_CONSTITUTION,
      "--output-format",
      "stream-json",
      "--verbose",
    ],
  };
}

// `claude -p` is one-shot, so continuity comes from replaying the conversation in the
// prompt. Honest limitation: it is a transcript, not a resumed session.
export function composePrompt(projectDir: string, history: ManagerTurn[], question: string): string {
  const lines = [`You are managing delegation for the repository at ${projectDir}.`, ""];
  if (history.length) {
    lines.push("Conversation so far:");
    for (const turn of history.slice(-8)) lines.push(`${turn.role === "you" ? "User" : "You"}: ${turn.text}`);
    lines.push("");
  }
  lines.push(`User: ${question}`, "", "Reply in at most four short sentences. Act with your tools when action is warranted.");
  return lines.join("\n");
}

/** A live event from the manager as it works — text as it forms, tools as it calls them. */
export interface ManagerEvent {
  kind: "text" | "tool";
  text: string;
}

export function managerEventFrom(line: string): ManagerEvent | null {
  try {
    const event = JSON.parse(line) as {
      type?: string;
      result?: unknown;
      message?: { content?: Array<{ type?: string; text?: string; name?: string; input?: Record<string, unknown> }> };
    };
    for (const block of event.message?.content ?? []) {
      if (block.type === "tool_use" && block.name) {
        const target = typeof block.input?.intent === "string" ? `: ${String(block.input.intent).slice(0, 40)}` : "";
        return { kind: "tool", text: `${block.name.replace("mcp__kage__", "")}${target}` };
      }
      if (block.type === "text" && block.text?.trim()) return { kind: "text", text: block.text.trim() };
    }
  } catch {
    return null;
  }
  return null;
}

export async function askManager(options: {
  projectDir: string;
  question: string;
  history?: ManagerTurn[];
  timeoutMs?: number;
  /** Fires as the manager works, so the pane is never a 20-second blank stare. */
  onEvent?: (event: ManagerEvent) => void;
}): Promise<ManagerReply> {
  const agent = detectAgent();
  if (!agent) {
    return { ok: false, text: "No coding agent found on PATH — install Claude Code or Codex to use the manager.", tools: [] };
  }
  const launch = buildManagerArgs({
    mcpConfigPath: writeRoomMcpConfig(options.projectDir),
    prompt: composePrompt(options.projectDir, options.history ?? [], options.question),
    agent,
  });

  return await new Promise<ManagerReply>((resolve) => {
    let child;
    try {
      child = spawn(launch.command, launch.args, { cwd: options.projectDir, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      resolve({ ok: false, text: `could not start ${launch.command}: ${String(error)}`, tools: [] });
      return;
    }
    let out = "";
    let err = "";
    let pending = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeoutMs ?? 5 * 60_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      const textChunk = chunk.toString("utf8");
      out += textChunk;
      if (!options.onEvent) return;
      // Parse per line as it lands so the caller can render progress live.
      pending += textChunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        const event = managerEventFrom(line);
        if (event) options.onEvent(event);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => (err += chunk.toString("utf8")));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, text: `manager could not run: ${String(error)}`, tools: [] });
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve(parseManagerStream(out) ?? { ok: false, text: err.trim() || "the manager said nothing", tools: [] });
    });
  });
}

// Constitution law 11 says the manager must never restate a number from a card. It
// broke that rule on its very first live session ("Dispatched and verified 3/3"), which
// is the expected failure of any prompt-only rule: a model that paraphrases a verdict
// can paraphrase it WRONG, and a wrong verdict in friendly prose is exactly the failure
// this product exists to prevent. So the rule is enforced where it can be — in the
// kernel, on the way out — rather than merely requested.
const CARD_NUMBER_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(NOT VERIFIED|UNVERIFIED|VERIFIED)\b/gi, replacement: "[verdict on the card]" },
  { pattern: /\b\d+\s*\/\s*\d+\b/g, replacement: "[counts on the card]" },
  // "all 3 checks" is a restated count too — caught live after the first guard shipped.
  { pattern: /\b(?:all\s+)?\d+\s+checks?\b/gi, replacement: "[counts on the card]" },
  { pattern: /\b\d+[-\s]lines?\b(?!\s+\d)/gi, replacement: "[size on the card]" },
  { pattern: /\b\d+\s+files?\s+changed\b/gi, replacement: "[size on the card]" },
  { pattern: /\$\s?\d+(?:\.\d+)?/g, replacement: "[cost on the card]" },
];

export interface GuardedProse {
  text: string;
  redactions: string[];
}

export function guardManagerProse(text: string): GuardedProse {
  const redactions: string[] = [];
  let guarded = text;
  for (const { pattern, replacement } of CARD_NUMBER_PATTERNS) {
    guarded = guarded.replace(pattern, (match) => {
      redactions.push(match.trim());
      return replacement;
    });
  }
  return { text: guarded, redactions };
}

export function parseManagerStream(stdout: string): ManagerReply | null {
  const tools: string[] = [];
  let text = "";
  let cost: number | undefined;
  let sawAny = false;
  for (const line of stdout.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    let event: {
      type?: string;
      result?: unknown;
      total_cost_usd?: number;
      message?: { content?: Array<{ type?: string; text?: string; name?: string }> };
    };
    try {
      event = JSON.parse(line) as typeof event;
    } catch {
      continue;
    }
    sawAny = true;
    for (const block of event.message?.content ?? []) {
      if (block.type === "tool_use" && block.name) tools.push(block.name);
      if (block.type === "text" && block.text?.trim()) text = block.text.trim();
    }
    if (typeof event.result === "string" && event.result.trim()) text = event.result.trim();
    if (typeof event.total_cost_usd === "number") cost = event.total_cost_usd;
  }
  if (!sawAny) return null;
  const guarded = guardManagerProse(text);
  return {
    ok: Boolean(text),
    text: guarded.text || "(the manager returned nothing)",
    tools,
    ...(cost === undefined ? {} : { cost_usd: cost }),
    ...(guarded.redactions.length ? { redactions: guarded.redactions } : {}),
  };
}
