// `kage room` — the conversational front door. It launches the user's own coding agent
// as Kage's manager, wired to the delegation tools and carrying the constitution.
// We rent the mind exactly as we rent the labor: no model of our own, no API key, and
// the user's existing subscription pays for it.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { detectAgent } from "./adapters/index.js";
import { type RoomLaunch, buildRoomLaunch } from "./manager-prompt.js";
import { renderReport, buildReport } from "./report.js";

// The MCP server the manager talks to is this same package — delegation tools appear
// when KAGE_ROOM=1, so the room's toolset is exactly the delegation surface.
export function writeRoomMcpConfig(projectDir: string): string {
  const serverEntry = resolve(__dirname, "..", "index.js");
  const config = {
    mcpServers: {
      kage: {
        type: "stdio",
        command: process.execPath,
        args: [serverEntry],
        env: { KAGE_ROOM: "1", KAGE_PROJECT_DIR: projectDir },
      },
    },
  };
  const path = join(projectDir, ".agent_memory", "runs", "room-mcp.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return path;
}

export function planRoom(projectDir: string, agentOverride?: string): RoomLaunch {
  const agent = agentOverride ?? detectAgent();
  return buildRoomLaunch({ agent, mcpConfigPath: writeRoomMcpConfig(projectDir), projectDir });
}

export function openRoom(projectDir: string, agentOverride?: string): number {
  const launch = planRoom(projectDir, agentOverride);
  if (!launch.ok) {
    console.error(launch.reason);
    return 2;
  }
  // The room opens on the report: the first thing a manager should tell you is what
  // happened while you were gone.
  console.log(renderReport(projectDir, buildReport(projectDir)));
  console.log("");
  const result = spawnSync(launch.command, launch.args, {
    cwd: projectDir,
    stdio: "inherit",
    env: { ...process.env, ...launch.env },
  });
  return result.status ?? 0;
}
