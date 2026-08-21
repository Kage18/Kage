// Talking to the manager from anywhere (the console's Ask pane, scripts, a session
// harness). The manager is a rented mind: we spawn the user's own coding agent headless,
// hand it Kage's tools and constitution, and let it act. Nothing here interprets its
// answer — the kernel already owns every guarantee it could touch.
import { spawn } from "node:child_process";
import { detectAgent } from "./adapters/index.js";
import { listRuns, readClaim } from "./contract.js";
import { MANAGER_CONSTITUTION } from "./manager-prompt.js";
import { writeRoomMcpConfig } from "./room.js";
import { claimVerdict } from "./verify.js";

/** Tools a manager may use without a permission prompt. Read + delegation verbs only. */
export const MANAGER_ALLOWED_TOOLS = [
  "kage_room_state",
  "kage_events_since",
  "kage_compile_brief",
  "kage_dispatch",
  "kage_task",
  "kage_tell",
  "kage_stop",
  "kage_review_run",
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
  /**
   * Card numbers the manager restated, checked against the truth on the way out. Each
   * entry is either a correction ("said X, card says Y") when a fact proved the
   * manager wrong, or the bare figure when no fact was available to check it against
   * (see guardManagerProse).
   */
  corrections?: string[];
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
      const facts = collectManagerFacts(options.projectDir);
      resolve(parseManagerStream(out, facts) ?? { ok: false, text: err.trim() || "the manager said nothing", tools: [] });
    });
  });
}

// Constitution law 11 says the manager must never restate a number from a card. It
// broke that rule on its very first live session ("Dispatched and verified 3/3"), which
// is the expected failure of any prompt-only rule: a model that paraphrases a verdict
// can paraphrase it WRONG, and a wrong verdict in friendly prose is exactly the failure
// this product exists to prevent.
//
// The first guard (blind redaction of every matching number, regardless of whether the
// manager was right) fixed the overclaim risk but broke the product's most human-facing
// surface: correct reporting got shot exactly as hard as fabrication, and it fired on
// numbers that had nothing to do with any card (a budget cap, a test count, a ledger
// figure). This version checks instead of censoring: given the facts a card is built
// from (verdict, diff size, spend), a restated figure that MATCHES survives untouched,
// one that MISMATCHES gets corrected in place, and one with no fact to check it against
// is left alone — silently erasing an unrelated number is noise, not safety.

/** One run's ground truth, gathered the same way its own claim card is rendered. */
export interface ManagerFactCheck {
  run_id: string;
  /** claimVerdict's own label, e.g. "VERIFIED 5/5" or "NOT VERIFIED 3/5" — never re-derived. */
  verdict?: string;
  diff?: { files: number; lines: number };
  spend_usd?: number;
}

/**
 * Every run's card facts, gathered from the exact same sources renderClaimCard reads
 * (claimVerdict, claim.diff, run.spend) — never a second derivation of these numbers.
 * Cheap enough to call once per manager turn: runs are read from disk, not recomputed.
 */
export function collectManagerFacts(projectDir: string): ManagerFactCheck[] {
  const facts: ManagerFactCheck[] = [];
  for (const run of listRuns(projectDir)) {
    const claim = readClaim(projectDir, run.id);
    const fact: ManagerFactCheck = { run_id: run.id };
    if (claim) {
      fact.verdict = claimVerdict(claim).label;
      fact.diff = { files: claim.diff.files, lines: claim.diff.lines };
    }
    if (run.spend.usd_est > 0) fact.spend_usd = run.spend.usd_est;
    if (fact.verdict || fact.diff || fact.spend_usd !== undefined) facts.push(fact);
  }
  return facts;
}

// Case-sensitive and excludes hyphen/letter neighbors on both sides: the kernel always
// writes these tokens in exact caps ("VERIFIED", "NOT VERIFIED", "UNVERIFIED"), so this
// stops the guard firing inside "hand-verified" or on the plain English word "unverified"
// in ordinary prose ("3 unverified claims") — neither is the manager restating a card.
const VERDICT_PATTERN = /(?<![A-Za-z-])(NOT VERIFIED|UNVERIFIED|VERIFIED)(?![A-Za-z-])(\s+\d+\s*\/\s*\d+)?/g;
// Excludes a count already consumed by VERDICT_PATTERN above (accurate, corrected, or
// left alone, it is never an unrelated fraction this pass should re-examine).
const BARE_COUNT_PATTERN = /(?<!(?:NOT VERIFIED|UNVERIFIED|VERIFIED)\s)\b\d+\s*\/\s*\d+\b/g;
// "all 3 checks" is a restated count too — caught live after the first guard shipped.
const CHECKS_COUNT_PATTERN = /\b(?:all\s+)?\d+\s+checks?\b/gi;
const DIFF_LINES_PATTERN = /\b\d+[-\s]lines?\b(?!\s+\d)/gi;
const DIFF_FILES_PATTERN = /\b\d+\s+files?\s+changed\b/gi;
const DOLLAR_PATTERN = /\$\s?\d+(?:\.\d+)?/g;

export interface GuardedProse {
  text: string;
  /** What changed on the way out — see ManagerReply.corrections. */
  corrections: string[];
}

/**
 * Verify a manager's restated card numbers against `facts` instead of blindly redacting
 * them. `facts` defaults to empty for callers that genuinely have no ground truth at
 * hand: for those, verdicts and n/n counts still fall back to the old redaction (the
 * one place a wrong figure is worse than a missing one) but dollar figures and diff
 * sizes are left untouched — they mostly fire on legitimate prose unrelated to any
 * card, and silently erasing them would be noise, not safety.
 */
export function guardManagerProse(text: string, facts: ManagerFactCheck[] = []): GuardedProse {
  const corrections: string[] = [];
  const verdictTruths = facts.map((fact) => fact.verdict).filter((v): v is string => Boolean(v));

  let guarded = text.replace(VERDICT_PATTERN, (match) => {
    const said = match.replace(/\s+/g, " ").trim();
    // A fact's label can be longer than what the manager said ("UNVERIFIED — nothing
    // was executed (2/3 static checks)" vs just "UNVERIFIED") — that's an abbreviation,
    // not a wrong number, so prefix matches count as accurate too.
    if (verdictTruths.some((truth) => truth === said || truth.startsWith(said))) return match;
    if (verdictTruths.length) {
      const truth = verdictTruths[0];
      corrections.push(`said "${said}", card says "${truth}"`);
      return truth;
    }
    if (!facts.length) {
      corrections.push(said);
      return "[verdict on the card]";
    }
    // Facts exist for this turn (other runs, other fields) but none carry a verdict to
    // check this one against — not ours to touch.
    return match;
  });

  guarded = guarded.replace(BARE_COUNT_PATTERN, (match) => {
    if (!facts.length) {
      corrections.push(match.trim());
      return "[counts on the card]";
    }
    return match;
  });

  guarded = guarded.replace(CHECKS_COUNT_PATTERN, (match) => {
    if (!facts.length) {
      corrections.push(match.trim());
      return "[counts on the card]";
    }
    return match;
  });

  // Diff size and dollar figures mostly fire on legitimate prose that has nothing to do
  // with any card (an unrelated file count, a budget cap) — rule 4's "tighten" applies
  // here harder than for a verdict. A figure that matches a known fact is confirmed
  // accurate and left alone. A figure that mismatches is only ever corrected when
  // exactly one fact is in scope — with several runs' facts in play (collectManagerFacts'
  // normal case), a mismatch is at least as likely to be a genuinely different number
  // (a budget cap, another run entirely) as a wrong restatement, and guessing which run
  // it "should" be would risk fabricating a correction of its own.
  const diffTruths = facts.map((fact) => fact.diff).filter((d): d is { files: number; lines: number } => Boolean(d));

  guarded = guarded.replace(DIFF_LINES_PATTERN, (match) => {
    if (!diffTruths.length) return match;
    const said = Number(match.match(/\d+/)?.[0]);
    if (diffTruths.some((diff) => diff.lines === said) || diffTruths.length !== 1) return match;
    const truth = diffTruths[0];
    corrections.push(`said "${match.trim()}", card says ${truth.lines} line(s)`);
    return match.replace(/\d+/, String(truth.lines));
  });

  guarded = guarded.replace(DIFF_FILES_PATTERN, (match) => {
    if (!diffTruths.length) return match;
    const said = Number(match.match(/\d+/)?.[0]);
    if (diffTruths.some((diff) => diff.files === said) || diffTruths.length !== 1) return match;
    const truth = diffTruths[0];
    corrections.push(`said "${match.trim()}", card says ${truth.files} file(s)`);
    return match.replace(/\d+/, String(truth.files));
  });

  const spendTruths = facts.map((fact) => fact.spend_usd).filter((s): s is number => typeof s === "number");

  guarded = guarded.replace(DOLLAR_PATTERN, (match) => {
    if (!spendTruths.length) return match;
    const said = Number(match.replace(/[$\s]/g, ""));
    if (spendTruths.some((spend) => Math.abs(spend - said) < 0.005) || spendTruths.length !== 1) return match;
    const truth = spendTruths[0];
    corrections.push(`said "${match.trim()}", recorded spend is $${truth.toFixed(2)}`);
    return `$${truth.toFixed(2)}`;
  });

  return { text: guarded, corrections };
}

export function parseManagerStream(stdout: string, facts: ManagerFactCheck[] = []): ManagerReply | null {
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
  const guarded = guardManagerProse(text, facts);
  return {
    ok: Boolean(text),
    text: guarded.text || "(the manager returned nothing)",
    tools,
    ...(cost === undefined ? {} : { cost_usd: cost }),
    ...(guarded.corrections.length ? { corrections: guarded.corrections } : {}),
  };
}
