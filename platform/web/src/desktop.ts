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
  elapsed_s: number;
  step: string | null;
  ticks: Array<{ recall: boolean; weight: number }>;
  /** Deliveries the proxy recorded for this session. Measured, not inferred. */
  recalls: number;
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
