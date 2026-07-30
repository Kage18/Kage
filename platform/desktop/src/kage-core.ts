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
  /** When the app observed this event. Stamped here, at the edge — the stream carries no times. */
  at: string;
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

  /** The proxy's task id for a session id — the join key that makes receipts attributable. */
  proxyTaskId(projectRoot: string, sessionId: string): string;

  /** The daemon's own hardened portal resolver — traversal-safe, with SPA fallback. */
  resolvePortalDir(baseDir: string): string;
  resolveAppAsset(appDir: string, pathname: string): string | null;

  // Agent sessions. The rules — which agents may launch, how a stream becomes readable events,
  // and that a non-zero exit overrides a stream claiming success — all live in the tested core.
  newSession(spec: { session_id: string; work_id: string | null; agent: string }): AgentSession;
  agentCommand(agent: string, prompt: string): { command: string; args: string[] } | null;
  agentEnv(proxyPort: number): Record<string, string>;
  /** Pure: reads no clock. The caller stamps `at` when it observes the line. */
  parseStreamLine(line: string): Array<Omit<SessionEvent, "seq" | "at">>;
  applyEvent(session: AgentSession, event: Omit<SessionEvent, "seq">): AgentSession;
  closeSession(session: AgentSession, exitCode: number | null): AgentSession;
  stripTicks(events: readonly SessionEvent[]): Array<{ at: string; weight: number }>;
}

export function loadKageCore(resourcesPath: string): KageCore {
  const dir = resolveCoreDir(resourcesPath);
  /* eslint-disable @typescript-eslint/no-var-requires */
  const workspace = require(join(dir, "vnext", "desktop", "workspace.js"));
  const protocolMod = require(join(dir, "vnext", "desktop", "protocol.js"));
  const alerts = require(join(dir, "vnext", "desktop", "alerts.js"));
  const supervisor = require(join(dir, "vnext", "desktop", "supervisor.js"));
  const sessionMod = require(join(dir, "vnext", "desktop", "session.js"));
  // portal-assets, NOT daemon.js or anthropic-proxy.js. Those pull kernel.js -> `typescript`, and
  // the packaged app ships mcp/dist WITHOUT node_modules — requiring them killed the packaged app
  // on launch ("Cannot find module 'typescript'") while working perfectly from a source checkout.
  const portalAssets = require(join(dir, "vnext", "desktop", "portal-assets.js"));
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
    proxyTaskId: portalAssets.proxyTaskId,
    resolvePortalDir: portalAssets.resolvePortalDir,
    resolveAppAsset: portalAssets.resolveAppAsset,
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
