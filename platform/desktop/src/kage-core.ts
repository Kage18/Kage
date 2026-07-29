// The one place the desktop shell reaches into the compiled Kage core.
//
// Everything with a rule in it — repo identity, ports, daemon lifecycle, what is worth
// interrupting a human for, protocol routing — lives in `mcp/vnext/desktop/` and is tested by the
// main suite. This file is the typed boundary: it locates that build at runtime and re-exports it
// with real signatures, so the rest of the shell never writes `require` or `any`.
//
// The core is CommonJS (mcp has no `"type": "module"`), which is why `require` is correct here.

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Where the compiled core lives. Packaged, electron-builder copies `mcp/dist` to
 * `<resources>/kage/dist`; from a source checkout it is three levels up. Prefer whichever actually
 * exists rather than branching on `app.isPackaged`, so running the built app out of the repo works
 * too — the packaging fault that shipped a 404 portal in 4.0.0 was exactly this kind of
 * single-path assumption.
 */
export function resolveCoreDir(resourcesPath: string): string {
  const candidates = [
    join(resourcesPath, "kage", "dist"),
    resolve(__dirname, "..", "..", "..", "mcp", "dist"),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "kernel.js"))) return candidate;
  }
  throw new Error(
    `Could not find the Kage core build. Looked in:\n  ${candidates.join("\n  ")}\n` +
      "Run `npm run build --prefix mcp` first.",
  );
}

// ── Types mirroring the core's public surface ────────────────────────────────────────────────

export interface WatchedRepo {
  path: string;
  name: string;
  added_at: string;
  last_opened_at: string | null;
  port: number;
}

export interface DesktopState {
  version: 1;
  repos: WatchedRepo[];
  active: string | null;
}

export interface AddResult {
  ok: boolean;
  state: DesktopState;
  repo?: WatchedRepo;
  error?: string;
}

export type ProtocolDecision =
  | { kind: "forward"; pathname: string; search: string }
  | { kind: "file"; pathname: string }
  | { kind: "deny"; reason: string };

export interface AlertCandidate {
  ref: string;
  kind: string;
  severity: number;
  summary: string;
}

export interface Alert {
  title: string;
  body: string;
  refs: string[];
  route: string;
}

export interface DaemonStatus {
  repo: string;
  port: number;
  state: "starting" | "running" | "stopped" | "failed";
  pid: number | null;
  detail?: string;
}

export interface SpawnedProcess {
  pid: number | null;
  kill(signal?: string): void;
}

export type SessionState = "starting" | "running" | "exited" | "failed";

export interface SessionEvent {
  seq: number;
  kind: "started" | "tool" | "text" | "result" | "error";
  summary: string;
}

export interface AgentSession {
  session_id: string;
  work_id: string | null;
  agent: string;
  state: SessionState;
  exit_code: number | null;
  cost_usd: number | null;
  events: SessionEvent[];
}

export interface KageCore {
  emptyState(): DesktopState;
  loadState(home: string): DesktopState;
  saveState(home: string, state: DesktopState): void;
  addRepo(state: DesktopState, path: string): AddResult;
  removeRepo(state: DesktopState, path: string): DesktopState;
  openRepo(state: DesktopState, path: string): DesktopState;
  activeRepo(state: DesktopState): WatchedRepo | null;

  routeDesktopRequest(input: { url: string; hasActiveRepo: boolean }): ProtocolDecision;
  daemonOrigin(port: number): string;

  decideAlerts(input: {
    repoName: string;
    candidates: AlertCandidate[];
    seen: readonly string[];
    observedBefore: boolean;
  }): { alert: Alert | null; seen: string[] };

  DaemonSupervisor: new (
    deps: {
      spawn(command: string, args: string[], cwd: string): SpawnedProcess;
      probe(port: number): Promise<boolean>;
      wait(ms: number): Promise<void>;
    },
    nodeBinary: string,
    cliPath: string,
  ) => {
    start(repo: string, port: number): Promise<DaemonStatus>;
    stop(repo: string): void;
    stopAll(): void;
    statusFor(repo: string): DaemonStatus | null;
    all(): DaemonStatus[];
  };

  /** The daemon's own hardened portal resolver — traversal-safe, with SPA fallback. */
  resolvePortalDir(baseDir: string): string;
  resolveAppAsset(appDir: string, pathname: string): string | null;

  // Agent sessions. The rules — which agents may launch, how a stream becomes readable events,
  // and that a non-zero exit overrides a stream claiming success — all live in the tested core.
  newSession(spec: { session_id: string; work_id: string | null; agent: string }): AgentSession;
  agentCommand(agent: string, prompt: string): { command: string; args: string[] } | null;
  agentEnv(proxyPort: number): Record<string, string>;
  parseStreamLine(line: string): Array<Omit<SessionEvent, "seq">>;
  applyEvent(session: AgentSession, event: Omit<SessionEvent, "seq">): AgentSession;
  closeSession(session: AgentSession, exitCode: number | null): AgentSession;
  stripTicks(events: readonly SessionEvent[], recallTurns?: ReadonlySet<number>): Array<{ recall: boolean; weight: number }>;
}

export function loadKageCore(resourcesPath: string): KageCore {
  const dir = resolveCoreDir(resourcesPath);
  /* eslint-disable @typescript-eslint/no-var-requires */
  const workspace = require(join(dir, "vnext", "desktop", "workspace.js"));
  const protocolMod = require(join(dir, "vnext", "desktop", "protocol.js"));
  const alerts = require(join(dir, "vnext", "desktop", "alerts.js"));
  const supervisor = require(join(dir, "vnext", "desktop", "supervisor.js"));
  const sessionMod = require(join(dir, "vnext", "desktop", "session.js"));
  const daemon = require(join(dir, "daemon.js"));
  /* eslint-enable @typescript-eslint/no-var-requires */

  return {
    emptyState: workspace.emptyState,
    loadState: workspace.loadState,
    saveState: workspace.saveState,
    addRepo: workspace.addRepo,
    removeRepo: workspace.removeRepo,
    openRepo: workspace.openRepo,
    activeRepo: workspace.activeRepo,
    routeDesktopRequest: protocolMod.routeDesktopRequest,
    daemonOrigin: protocolMod.daemonOrigin,
    decideAlerts: alerts.decideAlerts,
    DaemonSupervisor: supervisor.DaemonSupervisor,
    resolvePortalDir: daemon.resolvePortalDir,
    resolveAppAsset: daemon.resolveAppAsset,
    newSession: sessionMod.newSession,
    agentCommand: sessionMod.agentCommand,
    agentEnv: sessionMod.agentEnv,
    parseStreamLine: sessionMod.parseStreamLine,
    applyEvent: sessionMod.applyEvent,
    closeSession: sessionMod.closeSession,
    stripTicks: sessionMod.stripTicks,
  };
}

/** The CLI entry the supervisor spawns, beside the core build. */
export function cliPathFor(coreDir: string): string {
  return join(coreDir, "cli.js");
}
