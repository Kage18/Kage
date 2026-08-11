// The agents read model — the half of "orchestrator of memory and agents" that had no surface.
//
// The product's claim is that agents and memory feed each other, so the question this answers
// is not "is a config file present" but "is this agent actually working, and is any of what it
// learned surviving as knowledge". Those are different, and conflating them is how a dashboard
// ends up showing four green checkmarks for a system nobody is using.
//
// Every field is read from what Kage already records: the setup report (wired) and the session
// report (observed). Nothing here is inferred from the absence of data.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type AgentStatus =
  /** Observed producing work recently. */
  | "active"
  /** Has worked before, but nothing recent. */
  | "idle"
  /** Wired, and Kage has never seen a single observation from it — the real broken install. */
  | "silent";

export interface AgentDto {
  agent: string;
  status: AgentStatus;
  configured: boolean;
  config_path: string | null;
  /** Null when never observed — not a zero. */
  last_seen_at: string | null;
  sessions: number;
  observations: number;
  /** Observations that became durable knowledge: the only number that means memory grew. */
  durable_observations: number;
  /** What to do about this agent, when there is something to do. */
  next_step: string | null;
}

export interface AgentsReportDto {
  project_dir: string;
  generated_at: string;
  agents: AgentDto[];
  /** True when no agent has ever been observed — the app renders onboarding, not an empty table. */
  never_observed: boolean;
}

const ACTIVE_WINDOW_MS = 7 * 86_400_000;

interface SessionRow {
  session_id?: unknown;
  last_at?: unknown;
  observations?: unknown;
  durable_observations?: unknown;
  agents?: unknown;
}

interface SetupRow {
  agent?: unknown;
  configured?: unknown;
  config_path?: unknown;
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function buildAgentsReport(projectDir: string, now: number = Date.now()): AgentsReportDto {
  const reports = join(projectDir, ".agent_memory", "reports");
  const sessions = readJson<{ sessions?: SessionRow[] }>(join(reports, "sessions.json"))?.sessions ?? [];
  const setup = readJson<SetupRow[]>(join(reports, "setup.json")) ?? [];

  interface Accumulator {
    sessions: number;
    observations: number;
    durable: number;
    lastSeen: number;
  }
  const observed = new Map<string, Accumulator>();

  for (const row of sessions) {
    const names = Array.isArray(row.agents) ? row.agents.filter((n): n is string => typeof n === "string") : [];
    const at = Date.parse(typeof row.last_at === "string" ? row.last_at : "");
    for (const name of names) {
      const entry = observed.get(name) ?? { sessions: 0, observations: 0, durable: 0, lastSeen: 0 };
      entry.sessions += 1;
      entry.observations += count(row.observations);
      entry.durable += count(row.durable_observations);
      if (Number.isFinite(at) && at > entry.lastSeen) entry.lastSeen = at;
      observed.set(name, entry);
    }
  }

  const wired = new Map<string, { configured: boolean; config_path: string | null }>();
  for (const row of setup) {
    if (typeof row.agent !== "string") continue;
    wired.set(row.agent, {
      configured: row.configured === true,
      config_path: typeof row.config_path === "string" ? row.config_path : null,
    });
  }

  // Only agents that are WIRED or OBSERVED. The setup report lists every agent Kage knows how
  // to configure — sixteen of them — and rendering the fourteen nobody has set up as problems
  // turned a healthy install into a wall of red. Supported is not the same as adopted.
  const names = [...new Set([...wired.keys(), ...observed.keys()])]
    .filter((agent) => wired.get(agent)?.configured === true || observed.has(agent))
    .sort();
  const agents = names.map((agent): AgentDto => {
    const seen = observed.get(agent);
    const config = wired.get(agent);
    const configured = config?.configured === true;

    // Being OBSERVED proves capture is working — Kage can only see an agent because its work
    // was captured. So there is no "observed but not captured" state to report; the only
    // failure worth alarming on is wired-and-never-seen.
    let status: AgentStatus;
    let next_step: string | null = null;
    if (!seen) {
      status = "silent";
      next_step = "Wired, but Kage has never observed it. Restart the agent, then run a task through it.";
    } else if (now - seen.lastSeen <= ACTIVE_WINDOW_MS) {
      status = "active";
    } else {
      status = "idle";
    }

    // Working but contributing nothing durable is worth saying out loud: it means the loop is
    // half-connected — observations arrive, knowledge does not.
    if (!next_step && seen && seen.durable === 0 && seen.observations > 0) {
      next_step = "Observed working, but nothing it learned became durable memory yet.";
    }

    return {
      agent,
      status,
      configured,
      config_path: config?.config_path ?? null,
      last_seen_at: seen?.lastSeen ? new Date(seen.lastSeen).toISOString() : null,
      sessions: seen?.sessions ?? 0,
      observations: seen?.observations ?? 0,
      durable_observations: seen?.durable ?? 0,
      next_step,
    };
  });

  // Rank by what needs attention, then by how much they are doing: broken installs first.
  const rank: Record<AgentStatus, number> = { silent: 0, active: 1, idle: 2 };
  agents.sort((a, b) => rank[a.status] - rank[b.status] || b.observations - a.observations);

  return {
    project_dir: projectDir,
    generated_at: new Date(now).toISOString(),
    agents,
    never_observed: observed.size === 0,
  };
}
