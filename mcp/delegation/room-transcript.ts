// Reads claude's OWN native transcript — the jsonl it already writes for every
// interactive session under ~/.claude/projects/<cwd>/<session-id>.jsonl — into the
// structured shape a chat view can render. This is what makes Chat a VIEW of the real
// pty session instead of a second manager: both surfaces read the same file claude
// itself produces. The format is claude's, not ours and not a stable contract, so every
// parse below is defensive — unknown/malformed lines are skipped, never thrown.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * The directory claude's own CLI keeps native transcripts under. Honors
 * CLAUDE_CONFIG_DIR the same way claude itself does, so a relocated config dir is
 * still found — falls back to ~/.claude, the default every machine actually has.
 */
export function claudeProjectsDir(): string {
  const override = process.env.CLAUDE_CONFIG_DIR?.trim();
  return join(override ? resolve(override) : join(homedir(), ".claude"), "projects");
}

/**
 * claude munges a session's cwd into its transcript directory name by replacing every
 * character that is not a letter or digit with `-` — verified against this machine's
 * own ~/.claude/projects/ names: cwd ".../Kage/.agent_memory/worktrees/<id>" produced
 * "-Users-...-Kage--agent-memory-worktrees-<id>" (note the double dash: "/." both
 * became "-", and "_" did too, ruling out "just replace slashes"). No collapsing of
 * repeated separators — character-for-character, not path-segment-for-segment.
 */
export function mungeClaudeProjectDir(cwd: string): string {
  return resolve(cwd).replace(/[^a-zA-Z0-9]/g, "-");
}

/** Where claude will write (or has written) the native transcript for one session. */
export function resolveNativeTranscriptPath(cwd: string, sessionId: string): string {
  return join(claudeProjectsDir(), mungeClaudeProjectDir(cwd), `${sessionId}.jsonl`);
}

export interface TranscriptTurn {
  role: "user" | "assistant";
  /** Concatenated text content blocks. Empty when a turn is tool-only (e.g. a bare
   * tool_result or a tool_use with no accompanying prose). */
  text: string;
  /** Tool names used in this turn, collapsed from tool_use blocks — no inputs/outputs,
   * matching the "tool calls collapsed to names" contract this endpoint promises. */
  tools: string[];
  timestamp?: string;
}

function extractContent(content: unknown): { text: string; tools: string[] } {
  if (typeof content === "string") return { text: content, tools: [] };
  if (!Array.isArray(content)) return { text: "", tools: [] };
  const texts: string[] = [];
  const tools: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const typed = block as Record<string, unknown>;
    if (typed.type === "text" && typeof typed.text === "string") texts.push(typed.text);
    else if (typed.type === "tool_use" && typeof typed.name === "string") tools.push(typed.name);
    // "thinking" and "tool_result" blocks are deliberately skipped: thinking is never
    // shown to the chat view, and a tool's raw result is exactly the noise "collapsed
    // to names" exists to hide.
  }
  return { text: texts.join("\n\n"), tools };
}

/**
 * Parses claude's native jsonl into turns. Only `type: "user"` / `type: "assistant"`
 * lines whose `message.role` matches become turns — the file also carries lines this
 * product has no use for (queue-operation, ai-title, attachment, last-prompt,
 * atis-latch, mode, ...); those, and any line that fails to parse as JSON at all, are
 * silently skipped. A turn with neither text nor a tool call (a bare tool_result echo)
 * is dropped too — it carries no signal a chat view would render.
 */
export function parseNativeTranscript(raw: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (obj.type !== "user" && obj.type !== "assistant") continue;
    const message = obj.message as Record<string, unknown> | undefined;
    if (!message || (message.role !== "user" && message.role !== "assistant")) continue;
    const { text, tools } = extractContent(message.content);
    if (!text && !tools.length) continue;
    turns.push({
      role: message.role as "user" | "assistant",
      text,
      tools,
      ...(typeof obj.timestamp === "string" ? { timestamp: obj.timestamp } : {}),
    });
  }
  return turns;
}

/** Response cap for GET /room/transcript, mirroring room-history's own MAX_TURNS (200)
 * and the EVENT_PAGE precedent in report.ts — every list endpoint in this repo states
 * and enforces its own bound rather than returning an unbounded body. */
export const TRANSCRIPT_PAGE_CAP = 200;

export interface TranscriptPage {
  turns: TranscriptTurn[];
  /** Pass back as `cursor` to fetch the page immediately before this one (older turns).
   * null when this page already reaches the start of the session. */
  cursor: number | null;
  /** Total turns parsed from the file at read time — lets a client know how much more
   * history exists without walking every page. */
  total: number;
}

/**
 * Reads and parses the native transcript file, returning the latest `limit` turns
 * ending at `cursor` (an index into the full parsed turn list; omit for "the very
 * latest"). A missing or unreadable file returns an empty page rather than throwing —
 * a session that has not produced a transcript yet, or was never a real pty session, is
 * not an error condition for this endpoint.
 */
export function readNativeTranscriptPage(path: string, options: { limit?: number; cursor?: number } = {}): TranscriptPage {
  if (!existsSync(path)) return { turns: [], cursor: null, total: 0 };
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { turns: [], cursor: null, total: 0 };
  }
  const all = parseNativeTranscript(raw);
  const limit = Math.min(Math.max(1, options.limit ?? TRANSCRIPT_PAGE_CAP), TRANSCRIPT_PAGE_CAP);
  const end = options.cursor != null ? Math.min(Math.max(0, options.cursor), all.length) : all.length;
  const start = Math.max(0, end - limit);
  return { turns: all.slice(start, end), cursor: start > 0 ? start : null, total: all.length };
}

/** Real production delay — overridable so tests never actually wait. */
async function realSleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export interface WaitForReplyOptions {
  /** Total turn count (TranscriptPage.total) captured immediately before the message
   * was written into the pty — only turns beyond this count count as "the reply". */
  beforeTotal: number;
  timeoutMs: number;
  pollMs: number;
  /** How long the transcript must stop growing before an assistant reply is considered
   * settled — a single turn can arrive as several jsonl lines (thinking, a tool call,
   * its result, more thinking, then text), so the first new assistant line is not
   * necessarily the last. */
  quietMs: number;
  sleep?: (ms: number) => Promise<void>;
  /** Real time source, overridable so a test can drive the quiet-window logic without
   * a real clock. */
  now?: () => number;
}

/**
 * Polls a native transcript for new assistant turns after a just-sent message, up to a
 * bounded timeout. Returns whatever new assistant turns it found — an empty array on
 * timeout, never a fabricated reply: the pty path has no structured "turn finished"
 * signal the way the headless stream-json protocol does (see the manager's own claim
 * for this run), so this is a best-effort wait, not a proof the manager is done.
 */
export async function waitForNewAssistantTurns(readPage: () => TranscriptPage, options: WaitForReplyOptions): Promise<TranscriptTurn[]> {
  const sleep = options.sleep ?? realSleep;
  const now = options.now ?? Date.now;
  const deadline = now() + options.timeoutMs;
  let lastTotal = options.beforeTotal;
  let lastGrewAt = now();
  while (now() < deadline) {
    const page = readPage();
    if (page.total > lastTotal) {
      lastTotal = page.total;
      lastGrewAt = now();
    }
    const newCount = page.total - options.beforeTotal;
    const quiet = now() - lastGrewAt >= options.quietMs;
    if (newCount > 0 && quiet) {
      // page.turns is the tail of the full list (readPage always asks for "the
      // latest") — the last `newCount` of them are exactly the turns added since the
      // snapshot, as long as growth this round didn't exceed one page's worth.
      const newTurns = page.turns.slice(-newCount);
      const assistantTurns = newTurns.filter((turn) => turn.role === "assistant");
      if (assistantTurns.length) return assistantTurns;
      // Grew but nothing assistant-shaped landed (e.g. only our own echoed user turn
      // arrived so far) — keep waiting rather than returning an empty "reply".
    }
    await sleep(options.pollMs);
  }
  return [];
}
