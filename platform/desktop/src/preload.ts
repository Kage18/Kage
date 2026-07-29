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
});

export interface DesktopSession {
  session_id: string;
  work_id: string | null;
  work_title: string | null;
  agent: string;
  state: "starting" | "running" | "exited" | "failed";
  elapsed_s: number;
  step: string | null;
  ticks: Array<{ recall: boolean; weight: number }>;
  recalls: number;
}
