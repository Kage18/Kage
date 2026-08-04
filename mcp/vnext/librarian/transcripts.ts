// Session discovery and digestion — how the Librarian reads what an agent actually did.
//
// Claude Code writes one JSONL transcript per session under ~/.claude/projects/<munged dir>.
// Raw transcripts are on the never-stored list, so nothing here persists anything: we find the
// files, boil each one down to the events that carry knowledge — what the user asked, what the
// assistant concluded, which tools touched what — and hand that one ephemeral string to the
// Librarian. The start of a session states the task and the end states the resolution; the
// middle is churn, so the cap keeps both halves and elides the middle by count, never silently.

import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Where Claude Code keeps this project's transcripts. The munging is Claude Code's, not ours:
 * the absolute project path with EVERY "/" and "." flattened to "-", dots included so that
 * "/srv/shop.web" and "/srv/shop/web" collide the same way Claude Code collides them —
 * verified against the real layout (/Users/x/code/Kage -> -Users-x-code-Kage).
 */
export function claudeTranscriptDir(projectDir: string, home?: string): string {
  return join(home ?? homedir(), ".claude", "projects", projectDir.replace(/[/.]/g, "-"));
}

/**
 * Every *.jsonl session in the dir, newest first — the Librarian works backwards from the most
 * recent session. An absent dir is the common case (project never opened in Claude Code) and
 * reads as "no sessions", never as an error.
 */
export function listSessionFiles(dir: string): Array<{ path: string; mtimeMs: number }> {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const files: Array<{ path: string; mtimeMs: number }> = [];
  for (const name of names) {
    if (!name.endsWith(".jsonl")) continue;
    const path = join(dir, name);
    try {
      const stat = statSync(path);
      if (stat.isFile()) files.push({ path, mtimeMs: stat.mtimeMs });
    } catch {
      continue; // Raced away between readdir and stat — a session that vanished is not there.
    }
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * One transcript, boiled down to one line per event worth keeping:
 *
 *   USER: <first 300 chars>            what was asked
 *   ASSISTANT: <first 300 chars>       what was concluded
 *   TOOL: <name> <first 120 of the first path-or-command-looking arg>   what was touched
 *
 * Tool RESULTS are dropped on purpose — they are the bulk of any session's tokens and almost
 * never the knowledge. Unparseable lines are skipped, not fatal: a transcript is an append-only
 * log another process owns, and a torn last line is normal.
 *
 * Over `maxChars` (default 24000) the digest keeps the FIRST half and the LAST half with a
 * counted "... [N events elided] ..." marker between — the start (the task) and the end (the
 * resolution) carry the knowledge, the middle is churn.
 */
export function digestTranscript(jsonl: string, opts?: { maxChars?: number }): string {
  const lines: string[] = [];
  for (const raw of jsonl.split("\n")) {
    if (!raw.trim()) continue;
    let event: unknown;
    try {
      event = JSON.parse(raw);
    } catch {
      continue;
    }
    if (event === null || typeof event !== "object") continue;
    const record = event as Record<string, unknown>;
    // Claude Code wraps the API message in an envelope ({type, message}); tolerate both the
    // wrapped and the bare shape so a format tweak degrades to "fewer lines", not zero lines.
    const message = (
      record.message && typeof record.message === "object" ? record.message : record
    ) as Record<string, unknown>;
    const role = typeof message.role === "string" ? message.role : record.type;
    const content = message.content;

    if (role === "user") {
      if (typeof content === "string") pushText(lines, "USER", content);
      else if (Array.isArray(content)) {
        for (const block of content) {
          if (isTextBlock(block)) pushText(lines, "USER", block.text);
          // tool_result blocks land in user turns; they are the churn this digest exists to drop.
        }
      }
    } else if (role === "assistant") {
      if (typeof content === "string") pushText(lines, "ASSISTANT", content);
      else if (Array.isArray(content)) {
        for (const block of content) {
          if (isTextBlock(block)) {
            pushText(lines, "ASSISTANT", block.text);
          } else if (isToolUseBlock(block)) {
            const arg = firstPathOrCommandArg(block.input);
            lines.push(arg === null ? `TOOL: ${block.name}` : `TOOL: ${block.name} ${arg}`);
          }
        }
      }
    }
  }
  return elideMiddle(lines, opts?.maxChars ?? 24000);
}

function isTextBlock(block: unknown): block is { type: "text"; text: string } {
  const b = block as { type?: unknown; text?: unknown };
  return !!block && b.type === "text" && typeof b.text === "string";
}

function isToolUseBlock(block: unknown): block is { type: "tool_use"; name: string; input?: unknown } {
  const b = block as { type?: unknown; name?: unknown };
  return !!block && b.type === "tool_use" && typeof b.name === "string";
}

function pushText(lines: string[], prefix: "USER" | "ASSISTANT", text: string): void {
  // Collapse to one line — the "one line per event" invariant is what makes the digest scannable.
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine) lines.push(`${prefix}: ${oneLine.slice(0, 300)}`);
}

/**
 * The first string argument that looks like a path or a command — a separator, a space, or a
 * dot/home-relative start. Which KEY holds it varies per tool (file_path, command, pattern...),
 * so we go by shape, not by name; a tool call with no such arg reads as just the tool name.
 */
function firstPathOrCommandArg(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  for (const value of Object.values(input)) {
    if (typeof value !== "string") continue;
    const oneLine = value.replace(/\s+/g, " ").trim();
    if (/[/\\ ]/.test(oneLine) || /^[.~]/.test(oneLine)) return oneLine.slice(0, 120);
  }
  return null;
}

function elideMiddle(lines: string[], maxChars: number): string {
  const full = lines.join("\n");
  if (full.length <= maxChars) return full;
  // Each half gets an even share of the budget, minus room for the marker line.
  const half = Math.max(0, Math.floor((maxChars - 40) / 2));
  const head: string[] = [];
  let used = 0;
  let i = 0;
  while (i < lines.length && used + lines[i].length + 1 <= half) {
    head.push(lines[i]);
    used += lines[i].length + 1;
    i += 1;
  }
  const tail: string[] = [];
  used = 0;
  let j = lines.length - 1;
  while (j >= i && used + lines[j].length + 1 <= half) {
    tail.unshift(lines[j]);
    used += lines[j].length + 1;
    j -= 1;
  }
  return [...head, `... [${j - i + 1} events elided] ...`, ...tail].join("\n");
}
