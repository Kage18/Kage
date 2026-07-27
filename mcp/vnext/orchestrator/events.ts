// The command half of the orchestrator's event model (tech design §3, §5).
//
// Exactly two things in the work state machine are human/agent DECISIONS rather than
// observable facts: claiming a task and approving a ship gate. Those arrive as commands,
// are validated HERE at append time, and become append-only events. Everything else the
// reducer derives from git and the wire — no command exists for "mark as building",
// deliberately.
//
// The log is plain JSONL under .agent_memory/work/ so it is git-carriable like every
// other durable work artifact, and replay order is file order.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export type CommandEventKind = "task.claimed" | "task.released" | "gate.approved" | "gate.held";

export interface CommandEvent {
  event_id: string;
  ts: string;
  kind: CommandEventKind;
  work_id: string;
  actor: string;
  note?: string;
}

export interface CommandEventInput {
  kind: CommandEventKind;
  work_id: string;
  actor: string;
  note?: string;
}

function workDir(projectDir: string): string {
  return join(projectDir, ".agent_memory", "work");
}

function commandLogPath(projectDir: string): string {
  return join(workDir(projectDir), "commands.jsonl");
}

export function readCommandEvents(projectDir: string): CommandEvent[] {
  const path = commandLogPath(projectDir);
  if (!existsSync(path)) return [];
  const events: CommandEvent[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as CommandEvent;
      if (parsed && typeof parsed.event_id === "string" && typeof parsed.kind === "string") events.push(parsed);
    } catch {
      // A torn write must not poison replay; skip the line, keep the log readable.
    }
  }
  return events;
}

export function appendCommandEvent(projectDir: string, input: CommandEventInput): CommandEvent {
  const actor = input.actor.trim();
  if (!actor) throw new Error("command events require an actor");
  if (!input.work_id.trim()) throw new Error("command events require a work_id");

  if (input.kind === "gate.approved") {
    // The gate exists to put a SECOND pair of eyes on high-impact shipping. Validated at
    // append — the earliest possible moment — so no downstream consumer ever sees a
    // self-approved gate event at all.
    const events = readCommandEvents(projectDir);
    const lastClaim = [...events].reverse().find(
      (event) => event.kind === "task.claimed" && event.work_id === input.work_id,
    );
    if (lastClaim && lastClaim.actor === actor) {
      throw new Error(`self-approval blocked: ${actor} claimed ${input.work_id} and cannot approve its gate`);
    }
  }

  const event: CommandEvent = {
    event_id: `cmd-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`,
    ts: new Date().toISOString(),
    kind: input.kind,
    work_id: input.work_id,
    actor,
    ...(input.note ? { note: input.note } : {}),
  };
  mkdirSync(workDir(projectDir), { recursive: true });
  appendFileSync(commandLogPath(projectDir), `${JSON.stringify(event)}\n`, "utf8");
  return event;
}
