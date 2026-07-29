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
});
