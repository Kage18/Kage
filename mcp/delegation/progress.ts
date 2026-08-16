// Live progress. A delegation tool that goes silent for thirteen minutes is a tool you
// cannot trust — the research on delegated work is blunt about it: visibility without a
// steering verb is dread, but NO visibility is worse. So a run always says what it is
// doing right now, in one line, without becoming a log stream.
import { existsSync, readFileSync } from "node:fs";

export type ProgressKind = "start" | "think" | "tool" | "say" | "check" | "phase" | "done";

export interface ProgressEvent {
  kind: ProgressKind;
  /** One short clause: "editing mcp/cli.ts", "running npm test", "verifying". */
  label: string;
  at?: string;
}

export type ProgressSink = (event: ProgressEvent) => void;

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m${String(seconds % 60).padStart(2, "0")}s`;
}

// A single self-rewriting line on a TTY; plain milestone lines everywhere else (CI,
// pipes, the room's captured output) so nothing depends on terminal control codes.
export class ProgressLine {
  private readonly started = Date.now();
  private frame = 0;
  private timer: NodeJS.Timeout | null = null;
  private label = "starting";
  private actions = 0;
  private readonly tty: boolean;
  private lastPrinted = "";

  constructor(private readonly prefix: string, stream: NodeJS.WriteStream = process.stdout) {
    this.tty = Boolean(stream.isTTY);
    this.stream = stream;
  }
  private readonly stream: NodeJS.WriteStream;

  start(): void {
    if (!this.tty) {
      this.stream.write(`${this.prefix}: started\n`);
      return;
    }
    this.timer = setInterval(() => this.render(), 120);
    if (typeof this.timer.unref === "function") this.timer.unref();
  }

  update(event: ProgressEvent): void {
    if (event.kind === "tool") this.actions += 1;
    this.label = event.label;
    if (!this.tty) {
      // Milestones only: tool-by-tool chatter would drown a CI log.
      if (event.kind === "check" || event.kind === "phase" || event.kind === "done") {
        this.stream.write(`${this.prefix}: ${event.label} (${formatElapsed(Date.now() - this.started)})\n`);
      }
      return;
    }
    this.render();
  }

  private render(): void {
    const spin = SPINNER[this.frame++ % SPINNER.length];
    const actions = this.actions ? ` · ${this.actions} action${this.actions === 1 ? "" : "s"}` : "";
    const line = `${spin} ${formatElapsed(Date.now() - this.started)}  ${this.label}${actions}`;
    if (line === this.lastPrinted) return;
    this.lastPrinted = line;
    this.stream.write(`\r[2K${line}`);
  }

  stop(summary?: string): void {
    if (this.timer) clearInterval(this.timer);
    const elapsed = formatElapsed(Date.now() - this.started);
    if (this.tty) this.stream.write(`\r[2K`);
    if (summary) this.stream.write(`${summary} (${elapsed}${this.actions ? `, ${this.actions} actions` : ""})\n`);
  }

  get elapsedMs(): number {
    return Date.now() - this.started;
  }
}

// What a run is doing right now, reconstructed from its transcript — this is what makes
// `kage status --watch` possible for runs the current process did not launch.
export interface TranscriptActivity {
  last_label: string;
  actions: number;
  last_at: string | null;
}

export function readActivity(transcriptPath: string): TranscriptActivity {
  if (!existsSync(transcriptPath)) return { last_label: "no activity yet", actions: 0, last_at: null };
  let actions = 0;
  let lastLabel = "working";
  let lastAt: string | null = null;
  try {
    for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as { kind?: string; label?: string; at?: string };
      if (event.at) lastAt = event.at;
      if (event.kind === "tool") {
        actions += 1;
        if (event.label) lastLabel = event.label;
      } else if (event.kind === "say" && event.label) {
        lastLabel = event.label;
      } else if (event.kind === "final") {
        lastLabel = "finished";
      }
    }
  } catch {
    // A partially written transcript still yields whatever parsed.
  }
  return { last_label: lastLabel, actions, last_at: lastAt };
}

// Turn one stream-json event from a hired agent into a human clause. Kept deliberately
// small: the point is "what is it touching", not a replay of its reasoning.
export function progressFromStreamEvent(raw: string): ProgressEvent | null {
  let event: {
    type?: string;
    message?: { content?: Array<{ type?: string; name?: string; text?: string; input?: Record<string, unknown> }> };
  };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return null;
  }
  for (const block of event.message?.content ?? []) {
    if (block.type === "tool_use") {
      const input = block.input ?? {};
      const target =
        (typeof input.file_path === "string" && input.file_path) ||
        (typeof input.path === "string" && input.path) ||
        (typeof input.command === "string" && String(input.command).slice(0, 48)) ||
        (typeof input.pattern === "string" && String(input.pattern).slice(0, 32)) ||
        "";
      const verb = toolVerb(String(block.name ?? "working"));
      return { kind: "tool", label: target ? `${verb} ${shorten(String(target))}` : verb };
    }
    if (block.type === "text" && block.text?.trim()) {
      return { kind: "say", label: shorten(block.text.trim().split("\n")[0], 64) };
    }
  }
  if (event.type === "result") return { kind: "done", label: "wrapping up" };
  return null;
}

function toolVerb(name: string): string {
  const map: Record<string, string> = {
    Read: "reading",
    Edit: "editing",
    Write: "writing",
    MultiEdit: "editing",
    Bash: "running",
    Grep: "searching",
    Glob: "listing",
    Task: "delegating",
    WebFetch: "fetching",
    TodoWrite: "planning",
  };
  return map[name] ?? `using ${name}`;
}

function shorten(text: string, max = 44): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
