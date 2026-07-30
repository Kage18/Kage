// The desktop app's bridge, and the brief an agent is handed.
//
// Two separate things live here on purpose:
//
//   `desktop()` is the capability check. The portal runs in a browser too, where none of this
//   exists, so every caller has to handle null rather than assume the app.
//
//   `buildBrief` composes the prompt. It is pure and tested because it is the product's central
//   claim made executable: the agent is told exactly what the team already knows about the files
//   it is about to touch. The sheet shows the user this exact string before anything runs, and
//   main forwards it unchanged — so the preview is a promise, not an illustration.

import type { WorkDetailDto } from "./api/types";

export interface DesktopSession {
  session_id: string;
  work_id: string | null;
  work_title: string | null;
  agent: string;
  state: "starting" | "running" | "exited" | "failed";
  /** When the session started, ISO-8601 — the origin of the run strip's time axis. */
  started_at: string;
  elapsed_s: number;
  step: string | null;
  /** One per tool call, at the time the app observed it. */
  ticks: Array<{ at: string; weight: number }>;
  /** Deliveries the proxy recorded for this session. Measured, not inferred. */
  recalls: number;
  /** When each of those deliveries happened — the strip's second series, on the same clock. */
  recall_at: string[];
}

export interface DesktopRepo {
  path: string;
  name: string;
  port: number;
  daemon: "starting" | "running" | "stopped" | "failed";
}

export interface KageDesktop {
  isDesktop: true;
  getState(): Promise<{ repos: DesktopRepo[]; active: string | null }>;
  addRepository(): Promise<void>;
  removeRepository(path: string): Promise<unknown>;
  switchRepository(path: string): Promise<unknown>;
  onState(listener: (state: { repos: DesktopRepo[]; active: string | null }) => void): () => void;
  getSessions(): Promise<DesktopSession[]>;
  startSession(input: { work_id: string | null; work_title: string | null; agent: string; prompt: string }): Promise<{ ok: boolean; error?: string }>;
  stopSession(id: string): Promise<DesktopSession[]>;
  /** Fires when this repository's memory or work changed. One connection, held in main. */
  onChanged(listener: () => void): () => void;
  onSessions(listener: (sessions: DesktopSession[]) => void): () => void;
}

declare global {
  interface Window {
    kageDesktop?: KageDesktop;
  }
}

/** The app's bridge, or null in a browser. Callers must handle null — the portal still ships. */
export function desktop(): KageDesktop | null {
  return typeof window !== "undefined" && window.kageDesktop ? window.kageDesktop : null;
}

export interface BriefMemory {
  title: string;
  summary: string;
}

export interface Brief {
  /** Exactly what the agent will be sent. */
  prompt: string;
  memories: BriefMemory[];
  paths: string[];
  /** Rough, and labelled as rough wherever it is shown. ~4 characters per token. */
  tokens_est: number;
}

/**
 * Compose the brief for one grounded work item.
 *
 * The rules, and each exists because breaking it produces a specific failure:
 *
 *   Only the item's blast paths are named. An agent told about files nobody chose will edit files
 *   nobody agreed to touch — the same grounding gate the PRD drafter enforces.
 *
 *   File CONTENTS are never included. The agent can read the repository itself; sending source
 *   through the prompt spends the context window on something free.
 *
 *   Memory is quoted as-is, with no editorialising. If a claim is wrong the fix is to correct the
 *   memory, not to paraphrase it here where nobody can see it happen.
 */
export function buildBrief(detail: WorkDetailDto): Brief {
  const memories = detail.knowledge.map((entry) => ({ title: entry.title, summary: entry.summary }));
  const paths = detail.blast_paths;

  const lines = [
    detail.title,
    "",
    detail.body.trim() || "(no further description)",
    "",
    "Files this work is grounded to — change only these unless you explain why:",
    ...(paths.length ? paths.map((path) => `- ${path}`) : ["- (none recorded yet)"]),
  ];

  if (memories.length) {
    lines.push(
      "",
      "What the team already knows about this code. Treat it as established unless the code",
      "proves otherwise, and say so if it does:",
      ...memories.map((memory) => `- ${memory.title}${memory.summary ? ` — ${memory.summary}` : ""}`),
    );
  }

  const prompt = lines.join("\n");
  return { prompt, memories, paths, tokens_est: Math.ceil(prompt.length / 4) };
}

/**
 * The brief for a task the user typed, rather than a derived work item.
 *
 * This exists because a repository with no derived work items had no way to start an agent at all —
 * the Start button required a selection, and the brief pane sat on "Assembling the brief…" for
 * something that was never coming. That is the first screen after adding a first repository.
 *
 * The prompt is the task VERBATIM. No grounding block, because no work item means nobody chose a set
 * of files, and naming some would tell the agent a decision had been made that had not. No memory
 * section either: there is no free-text recall route in the read API, and a heading with nothing
 * under it reads as "the team knows nothing about this" — a claim nobody checked.
 *
 * A run started this way is still a full Kage run. The proxy injects memory per request in assist
 * mode, so recalls land while the agent works — which is exactly what the run strip records.
 */
export function buildFreeFormBrief(task: string): Brief {
  const prompt = task.trim();
  return { prompt, memories: [], paths: [], tokens_est: Math.ceil(prompt.length / 4) };
}
