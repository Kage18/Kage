import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildAgentsReport } from "./agents.js";

const NOW = Date.parse("2026-07-28T00:00:00.000Z");

function repoWith(sessions: unknown, setup: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-agents-"));
  mkdirSync(join(dir, ".agent_memory", "reports"), { recursive: true });
  if (sessions !== undefined) {
    writeFileSync(join(dir, ".agent_memory", "reports", "sessions.json"), JSON.stringify(sessions), "utf8");
  }
  if (setup !== undefined) {
    writeFileSync(join(dir, ".agent_memory", "reports", "setup.json"), JSON.stringify(setup), "utf8");
  }
  return dir;
}

function find(dir: string, agent: string) {
  const found = buildAgentsReport(dir, NOW).agents.find((entry) => entry.agent === agent);
  assert.ok(found, `expected an entry for ${agent}`);
  return found!;
}

// The distinction the whole surface exists for. "A config file is present" and "this agent is
// actually feeding memory" are different facts, and a dashboard that conflates them shows four
// green checkmarks for a system nobody is using.
test("wired-but-never-observed is a distinct state, not a healthy one", () => {
  const project = repoWith(
    { sessions: [] },
    [{ agent: "codex", configured: true, config_path: "/home/u/.codex/config.toml" }],
  );

  const codex = find(project, "codex");
  assert.equal(codex.configured, true);
  assert.equal(codex.status, "silent", "a wired agent with no observations is not active");
  assert.equal(codex.last_seen_at, null, "never observed is null, never a fabricated timestamp");
  assert.equal(codex.sessions, 0);
  // The most common broken install. The message must name the cause, not say "no data yet".
  assert.match(codex.next_step ?? "", /Restart the agent/);
});

// Corrected after running this against a real repo. Being OBSERVED proves capture is working
// — Kage can only see an agent because its work was captured — so "observed but not wired"
// is a contradiction, not a state. And the setup report lists every agent Kage knows HOW to
// wire (sixteen here), so treating merely-supported agents as broken installs turned a healthy
// repository into a wall of red.
test("supported-but-unadopted agents are not listed at all, and observed ones are fine", () => {
  const project = repoWith(
    { sessions: [{ session_id: "s1", last_at: "2026-07-27T00:00:00.000Z", observations: 40, durable_observations: 3, agents: ["kage-proxy"] }] },
    [
      { agent: "aider", configured: false, config_path: null },
      { agent: "windsurf", configured: false, config_path: null },
    ],
  );
  const report = buildAgentsReport(project, NOW);
  assert.deepEqual(
    report.agents.map((entry) => entry.agent),
    ["kage-proxy"],
    "agents Kage merely SUPPORTS must not be reported as problems",
  );
  const proxy = report.agents[0];
  assert.equal(proxy.status, "active", "observation is proof that capture works");
  assert.equal(proxy.next_step, null, "a working capture path needs no instruction");
});

test("recency separates active from idle, and totals come from real sessions", () => {
  const project = repoWith(
    {
      sessions: [
        { session_id: "s1", last_at: "2026-07-27T00:00:00.000Z", observations: 100, durable_observations: 8, agents: ["claude-code"] },
        { session_id: "s2", last_at: "2026-07-20T00:00:00.000Z", observations: 50, durable_observations: 2, agents: ["claude-code"] },
        { session_id: "s3", last_at: "2026-05-01T00:00:00.000Z", observations: 10, durable_observations: 0, agents: ["codex"] },
      ],
    },
    [
      { agent: "claude-code", configured: true, config_path: "/home/u/.claude.json" },
      { agent: "codex", configured: true, config_path: "/home/u/.codex/config.toml" },
    ],
  );

  const claude = find(project, "claude-code");
  assert.equal(claude.status, "active");
  assert.equal(claude.sessions, 2);
  assert.equal(claude.observations, 150);
  assert.equal(claude.durable_observations, 10);
  assert.equal(claude.last_seen_at, "2026-07-27T00:00:00.000Z", "the most recent session wins");
  assert.equal(claude.next_step, null, "a healthy agent is not given busywork");

  const codex = find(project, "codex");
  assert.equal(codex.status, "idle", "months-old activity is not active");
  // Observed, but nothing it learned survived — the loop is half-connected and says so.
  assert.match(codex.next_step ?? "", /nothing it learned became durable/);
});

test("broken installs rank above healthy ones", () => {
  const project = repoWith(
    { sessions: [{ session_id: "s1", last_at: "2026-07-27T00:00:00.000Z", observations: 900, durable_observations: 40, agents: ["claude-code"] }] },
    [
      { agent: "claude-code", configured: true, config_path: "/home/u/.claude.json" },
      { agent: "codex", configured: true, config_path: "/home/u/.codex/config.toml" },
    ],
  );
  const report = buildAgentsReport(project, NOW);
  assert.equal(report.agents[0].agent, "codex", "the silent agent needs attention before the busy one");
  assert.equal(report.never_observed, false);
});

test("a repo with no reports at all says so instead of rendering an empty table", () => {
  const project = repoWith(undefined, undefined);
  const report = buildAgentsReport(project, NOW);
  assert.deepEqual(report.agents, []);
  assert.equal(report.never_observed, true);
});
