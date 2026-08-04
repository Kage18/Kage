// The only bridge between the renderer and the main process.
//
// Deliberately narrow: the renderer gets four verbs and one subscription, and no way to name a
// channel of its own. Everything the portal already does — reading work, memory, attention — goes
// over ordinary same-origin `fetch`, answered by the `kage://` handler. Only concerns that belong
// to the APP rather than to a repository come through here.

import { contextBridge, ipcRenderer } from "electron";

export interface DesktopRepo {
  path: string;
  name: string;
  port: number;
  daemon: "starting" | "running" | "stopped" | "failed";
}

export interface DesktopState {
  repos: DesktopRepo[];
  active: string | null;
}

contextBridge.exposeInMainWorld("kageDesktop", {
  /** Present only in the desktop app, so the SPA can render app-only chrome when it is there. */
  isDesktop: true,

  getState: (): Promise<DesktopState> => ipcRenderer.invoke("kage:state"),
  addRepository: (): Promise<void> => ipcRenderer.invoke("kage:repos:add"),
  removeRepository: (path: string): Promise<DesktopState> => ipcRenderer.invoke("kage:repos:remove", path),
  switchRepository: (path: string): Promise<DesktopState> => ipcRenderer.invoke("kage:repos:switch", path),

  /** Main pushes a new state whenever repositories or daemons change. Returns an unsubscribe. */
  onState: (listener: (state: DesktopState) => void): (() => void) => {
    const handler = (_event: unknown, next: DesktopState) => listener(next);
    ipcRenderer.on("kage:state", handler);
    return () => ipcRenderer.removeListener("kage:state", handler);
  },

  // Agent sessions. Starting one is the only verb here that spends money, so it carries the
  // fully-composed prompt the user was shown — main never rewrites or augments it, which is what
  // makes the brief preview a promise rather than an illustration.
  getSessions: (): Promise<DesktopSession[]> => ipcRenderer.invoke("kage:sessions"),
  startSession: (input: { work_id: string | null; work_title: string | null; agent: string; prompt: string }): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("kage:sessions:start", input),
  stopSession: (id: string): Promise<DesktopSession[]> => ipcRenderer.invoke("kage:sessions:stop", id),

  /** Fires when this repository's memory or work changed. One subscription, held in main. */
  onChanged: (listener: () => void): (() => void) => {
    const handler = () => listener();
    ipcRenderer.on("kage:changed", handler);
    return () => ipcRenderer.removeListener("kage:changed", handler);
  },

  onSessions: (listener: (sessions: DesktopSession[]) => void): (() => void) => {
    const handler = (_event: unknown, next: DesktopSession[]) => listener(next);
    ipcRenderer.on("kage:sessions", handler);
    return () => ipcRenderer.removeListener("kage:sessions", handler);
  },

  // The Librarian's cards. These belong to the APP rather than to a repository read: a verdict
  // mutates the shadow store and regenerates the BRIEF block, which is not something a browser tab
  // may do. All four are scoped to the active repository by main — the renderer never names one.
  listCards: (filter?: { state?: DesktopCard["state"] }): Promise<DesktopCard[]> =>
    ipcRenderer.invoke("kage:cards:list", filter),
  approveCard: (id: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("kage:cards:approve", id),
  rejectCard: (id: string, reason: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("kage:cards:reject", id, reason),
  /** Minutes, on the user's own Claude subscription. The promise settles when the run is over. */
  mineHistory: (): Promise<MineOutcome> => ipcRenderer.invoke("kage:cards:mine"),
  /** The counted ledger. Every number on the Receipts surface comes from here. */
  readReceipts: (): Promise<unknown> => ipcRenderer.invoke("kage:cards:receipts"),

  /** Fires after any verdict or mining run. The Inbox refetches; nothing is pushed with it. */
  onCardsChanged: (listener: () => void): (() => void) => {
    const handler = () => listener();
    ipcRenderer.on("kage:cards-changed", handler);
    return () => ipcRenderer.removeListener("kage:cards-changed", handler);
  },
});

/** The Librarian's unit of memory, shaped for review. Mirrors platform/web/src/desktop.ts. */
export interface DesktopCard {
  id: string;
  kind: "decision" | "runbook" | "caution";
  state: "proposed" | "approved" | "superseded" | "retired";
  verify: "verified" | "unverified" | "stale";
  title: string;
  claim: string;
  citations: Array<{ path?: string; symbol?: string; ref?: string }>;
  trigger: string;
  provenance: { source: "session" | "mining" | "human"; ref: string; at: string };
  tags: string[];
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface MineOutcome {
  ok: boolean;
  proposed: number;
  rejected: number;
  deduped: number;
  /** Measured when the runner reported usage; null is honest and rendered as such. */
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  error?: string;
}

export interface DesktopSession {
  session_id: string;
  work_id: string | null;
  work_title: string | null;
  agent: string;
  state: "starting" | "running" | "exited" | "failed";
  started_at: string;
  elapsed_s: number;
  step: string | null;
  ticks: Array<{ at: string; weight: number }>;
  recalls: number;
  recall_at: string[];
}
