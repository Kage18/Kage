// How a local daemon learns it has a workspace — and how it behaves when it does not.
//
// A workspace connection is entirely OPTIONAL. With no configuration the daemon is a local-only install:
// it stores, composes and serves context exactly as before, its portal reports "no workspace connected",
// and nothing here ever opens a socket. Configuration is read from the environment (a real secret store
// or config surface lands with the workspace operations task); all of URL, token and workspace id must
// be present, because a partial configuration is a misconfiguration and must not half-connect.
import { createHash } from "node:crypto";
import { httpTransport } from "./client.js";
import { createWorkspaceLink, type WorkspaceLink } from "./workspace-link.js";
import type { TeamMetricsReport } from "../sync/team-metrics.js";

export interface WorkspaceConnection {
  base_url: string;
  workspace_id: string;
  service_token: string;
  repository_id: string | null;
  /** Salt for actor pseudonyms. Derived per install when unset — never a constant. */
  actor_salt: string;
  sync_interval_ms: number;
}

const DEFAULT_SYNC_INTERVAL_MS = 60_000;

/**
 * Read a workspace connection from the environment, or null when this install has none. Null is the
 * normal, fully supported state: local context must never depend on a workspace existing.
 */
export function readWorkspaceConnection(
  env: NodeJS.ProcessEnv,
  projectDir: string,
): WorkspaceConnection | null {
  const baseUrl = env.KAGE_WORKSPACE_URL?.trim();
  const token = env.KAGE_WORKSPACE_TOKEN?.trim();
  const workspaceId = env.KAGE_WORKSPACE_ID?.trim();
  if (!baseUrl || !token || !workspaceId) return null;
  const interval = Number.parseInt(env.KAGE_WORKSPACE_SYNC_INTERVAL_MS ?? "", 10);
  return {
    base_url: baseUrl.replace(/\/$/, ""),
    workspace_id: workspaceId,
    service_token: token,
    repository_id: env.KAGE_WORKSPACE_REPOSITORY?.trim() || null,
    // An explicit salt is preferred; the fallback is derived from the install path and workspace id so
    // it is stable for this install and different from every other install's — never a shared constant,
    // which would make the pseudonyms comparable (and reversible) across installs.
    actor_salt:
      env.KAGE_WORKSPACE_ACTOR_SALT?.trim() ||
      createHash("sha256").update(`${projectDir}\u0000${workspaceId}`).digest("hex").slice(0, 32),
    sync_interval_ms:
      Number.isSafeInteger(interval) && interval >= 1_000 ? interval : DEFAULT_SYNC_INTERVAL_MS,
  };
}

/**
 * Build the link for a connection: a real HTTP transport for pushes, and a metrics fetch for the portal
 * panel. Both are used out of band — never on a local read path.
 */
export function createConnectedLink(connection: WorkspaceConnection): WorkspaceLink {
  const headers = { authorization: `Bearer ${connection.service_token}` };
  return createWorkspaceLink({
    transport: httpTransport(connection.base_url, connection.service_token),
    async fetchTeamMetrics(): Promise<TeamMetricsReport> {
      const url = new URL(`${connection.base_url}/v1/workspaces/${connection.workspace_id}/metrics`);
      if (connection.repository_id) url.searchParams.set("repository", connection.repository_id);
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`workspace metrics failed: ${response.status}`);
      return ((await response.json()) as { metrics: TeamMetricsReport }).metrics;
    },
  });
}
