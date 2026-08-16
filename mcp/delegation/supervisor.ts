// The run supervisor — one detached process per run, holding one agent's stdin.
//
// This is what turns a dispatch from a job into a *session*. AO's agents live in tmux
// panes for the whole session and answering means writing into the live pane; Conductor
// parks the agent on its own question rather than restarting it. Both are only possible
// because something holds the process. A one-shot `claude -p` cannot be steered, cannot
// be answered, and loses its context the moment it blocks.
//
// It is a separate process from the daemon on purpose: a daemon restart — crash, upgrade,
// `daemon stop` — must never kill a 45-minute agent mid-edit.
import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { createServer, type Socket } from "node:net";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { adapterByName } from "./adapters/index.js";
import { sessionIdFrom, waitingSignal } from "./adapters/cli-agent.js";
import { compileBrief, renderBrief } from "./brief.js";
import { strictVerify } from "./config.js";
import {
  CLAIM_PROTOCOL_VERSION,
  type ClaimRecord,
  RUN_SCHEMA_VERSION,
  appendRunLedger,
  parseReportFence,
  patchRun,
  readBrief,
  readRun,
  runDir,
  runTranscriptPath,
  runWorkDir,
  transitionRun,
} from "./contract.js";
import { progressFromStreamEvent } from "./progress.js";
import { draftLearnings } from "./ratify.js";
import { verifyRun } from "./verify.js";
import { commitWorktree, createWorktree, worktreePath } from "./worktree.js";
import { hasCommits, isGitRepo } from "./git.js";

export interface SupervisorRecord {
  run_id: string;
  pid: number;
  socket: string;
  started_at: string;
}

/**
 * Control sockets live in the system temp dir, NOT beside the run.
 *
 * Unix domain socket paths are capped at ~104 bytes; a run directory nested under a long
 * project path blows straight past that, and `listen` then fails asynchronously — which
 * killed the supervisor outright the first time this ran for real. A short hashed name
 * is bounded no matter how deep the repo lives.
 */
export function socketPath(projectDir: string, runId: string): string {
  const digest = createHash("sha256").update(`${resolve(projectDir)}\0${runId}`).digest("hex").slice(0, 16);
  return join(tmpdir(), `kage-${digest}.sock`);
}

export function supervisorRecordPath(projectDir: string, runId: string): string {
  return join(runDir(projectDir, runId), "supervisor.json");
}

export type ControlOp =
  | { op: "tell"; message: string }
  | { op: "interrupt" }
  | { op: "stop" }
  | { op: "status" };

export interface ControlReply {
  ok: boolean;
  /** Honest delivery reporting: a buffered write is not a delivery. */
  delivered?: boolean;
  state?: string;
  detail?: string;
}

/** stream-json injection format, verified against the live CLI. */
export function userMessageFrame(message: string): string {
  return `${JSON.stringify({ type: "user", message: { role: "user", content: message }, parent_tool_use_id: null })}\n`;
}

export function interruptFrame(requestId = "kage-interrupt"): string {
  return `${JSON.stringify({ type: "control_request", request_id: requestId, request: { subtype: "interrupt" } })}\n`;
}

interface SupervisorState {
  waiting?: { detail: string; needs: string };
  sessionId?: string;
  finalMessage: string;
  stopped: boolean;
}

/**
 * Runs the whole life of one run, in this process, until the agent finishes.
 * Returns when verification is written and the run has left `running`.
 */
export async function superviseRun(projectDir: string, runId: string): Promise<void> {
  const task = readRun(projectDir, runId);
  const plan = compileBrief(projectDir, task.intent, task.type);
  const dir = runDir(projectDir, runId);
  mkdirSync(dir, { recursive: true });

  // Workspace: a real worktree when git allows, else a sandbox — stated, never silent.
  let workspace: string;
  let workspaceKind: "worktree" | "sandbox";
  if (isGitRepo(projectDir) && hasCommits(projectDir)) {
    workspace = createWorktree(projectDir, runId, task.branch).path;
    workspaceKind = "worktree";
  } else {
    workspace = runWorkDir(projectDir, runId);
    mkdirSync(workspace, { recursive: true });
    workspaceKind = "sandbox";
  }

  const brief = existsSync(join(dir, "brief.md")) ? readBrief(projectDir, runId) : renderBrief(task, plan);
  const adapter = adapterByName(task.agent);
  const state: SupervisorState = { finalMessage: "", stopped: false };

  // The agent, with stdin held open for its whole life.
  // NOTE: with `--input-format stream-json` the prompt does NOT come from `-p` — the
  // agent reads it as a user message on stdin. Passing `-p` here made the agent sit
  // silently waiting for input, and the run only moved when a steer arrived and
  // accidentally became its prompt. Found live; the brief is written below instead.
  const args = [
    ...(task.agent_session_id ? ["--session-id", task.agent_session_id] : []),
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "acceptEdits",
  ];
  // Only `claude` has the stream-json stdin protocol this supervisor holds open for
  // live steering. Earlier this branch spawned a `node -e process.exit(0)` placeholder
  // for every other agent — real, awaited work only ever happened through the
  // IN-PROCESS dispatch path (dispatch.ts's executeRun). Any run started through the
  // web app or `POST /runs` (which always detaches) got a verdict built from that
  // placeholder's empty stdout: an untouched worktree, a canned "agent skipped the
  // fence" statement, and generic checks passing trivially against a zero-line diff —
  // VERIFIED 3/3 for work that never happened. Found while checking the app's live
  // Follow view actually had something to render. Non-claude agents now run for real,
  // through the exact same Adapter.run() the in-process path already trusted.
  const usesLiveStdinProtocol = adapter.name === "claude";
  const child: ChildProcess | null = usesLiveStdinProtocol
    ? spawn("claude", args, { cwd: workspace, stdio: ["pipe", "pipe", "pipe"] })
    : null;

  if (child) {
    // The brief IS the first user message on the open stdin.
    child.stdin?.write(userMessageFrame(brief));
    patchRun(projectDir, runId, { agent_pid: child.pid });
  } else {
    // No live child to key liveness off; the supervisor process itself is what's
    // "running" for the run's duration, so stand in with its own pid.
    patchRun(projectDir, runId, { agent_pid: process.pid });
  }
  // The run is genuinely in flight now — a supervisor that never moved the state left
  // every surface reporting "briefed" while an agent worked (found on the first live run).
  if (readRun(projectDir, runId).state === "briefed") transitionRun(projectDir, runId, "dispatched", "kernel");
  if (readRun(projectDir, runId).state === "dispatched") {
    transitionRun(projectDir, runId, "running", "kernel", workspaceKind === "sandbox" ? "no git worktree — running in a sandbox" : undefined);
  }
  const record: SupervisorRecord = {
    run_id: runId,
    pid: process.pid,
    socket: socketPath(projectDir, runId),
    started_at: new Date().toISOString(),
  };
  writeFileSync(supervisorRecordPath(projectDir, runId), `${JSON.stringify(record, null, 2)}\n`, "utf8");

  const transcriptPath = runTranscriptPath(projectDir, runId);
  mkdirSync(dirname(transcriptPath), { recursive: true });
  const log = (event: Record<string, unknown>): void => {
    try {
      writeFileSync(transcriptPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, { flag: "a" });
    } catch {
      // Never let logging break a run.
    }
  };
  log({ kind: "start", adapter: adapter.name, run_id: runId, supervisor_pid: process.pid });

  // Control socket: how any surface reaches this live agent.
  const server = createServer((connection: Socket) => {
    connection.setEncoding("utf8");
    connection.on("data", (raw: string) => {
      let reply: ControlReply;
      try {
        const op = JSON.parse(raw) as ControlOp;
        reply = handleControl(op);
      } catch (error) {
        reply = { ok: false, detail: `unreadable control message: ${String(error)}` };
      }
      connection.end(`${JSON.stringify(reply)}\n`);
    });
  });
  // A socket failure must never take the run down with it: listen() reports errors
  // asynchronously, so an unhandled 'error' event would crash the supervisor and strand
  // the agent. Without a socket the run still completes — it just cannot be steered.
  server.on("error", (error) => log({ kind: "control_socket_error", error: String(error) }));
  try {
    rmSync(record.socket, { force: true });
    mkdirSync(dirname(record.socket), { recursive: true });
    server.listen(record.socket);
  } catch (error) {
    log({ kind: "control_socket_error", error: String(error) });
  }

  function handleControl(op: ControlOp): ControlReply {
    if (op.op === "status") {
      return { ok: true, state: state.waiting ? "waiting" : "working", detail: state.waiting?.needs };
    }
    if (op.op === "stop") {
      state.stopped = true;
      // Best-effort for a non-claude agent: there is no live process handle to kill,
      // only an in-flight Adapter.run() promise with no cancellation of its own — the
      // run will still be marked stopped once it returns, same honesty the fake
      // placeholder child offered, just without pretending work happened meanwhile.
      child?.kill("SIGTERM");
      return { ok: true, delivered: Boolean(child), detail: child ? "agent stopped" : `${adapter.name} has no live process to interrupt — it will stop once its current turn returns` };
    }
    if (op.op === "interrupt") {
      // A true interrupt: the in-flight tool is rejected and the process stays alive.
      const wrote = child?.stdin?.write(interruptFrame()) ?? false;
      return { ok: wrote, delivered: wrote, detail: wrote ? "interrupt sent" : "could not write to the agent" };
    }
    // `tell`: a message the agent receives at its next tool-result boundary. Report the
    // WRITE result — a false return means the buffer is full and it is not delivered.
    const wrote = child?.stdin?.write(userMessageFrame(op.message)) ?? false;
    return { ok: wrote, delivered: wrote, detail: wrote ? "delivered to the live agent" : "agent stdin is not writable" };
  }

  if (child) {
    await new Promise<void>((resolve) => {
      let pending = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        pending += chunk.toString("utf8");
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const signal = waitingSignal(line);
          if (signal) {
            state.waiting = signal;
            patchRun(projectDir, runId, { waiting_on: signal });
            log({ kind: "waiting", ...signal });
          }
          const id = sessionIdFrom(line);
          if (id) state.sessionId = id;
          const event = progressFromStreamEvent(line);
          if (event) log(event as unknown as Record<string, unknown>);
          else log({ kind: "stdout", text: line });
          try {
            const parsed = JSON.parse(line) as { type?: string; result?: unknown };
            if (typeof parsed.result === "string" && parsed.result.trim()) state.finalMessage = parsed.result;
            // Holding stdin open is what makes a run steerable — but it also means the
            // agent waits for more input instead of exiting, so process death can never be
            // the "turn is over" signal. The `result` event is. Close stdin on it, and the
            // agent shuts down cleanly into verification. (Found live: a finished run sat
            // in `running` forever with its work already done.)
            if (parsed.type === "result" && !state.stopped) {
              log({ kind: "turn_complete", label: "agent finished its turn" });
              try {
                child.stdin?.end();
              } catch {
                // If stdin is already gone the close handler still fires.
              }
            }
          } catch {
            // not a result line
          }
        }
      });
      child.stderr?.on("data", (chunk: Buffer) => log({ kind: "stderr", text: chunk.toString("utf8") }));
      child.on("error", (error) => {
        log({ kind: "spawn_error", error: String(error) });
        resolve();
      });
      child.on("close", (code) => {
        log({ kind: "final", exit_code: code ?? 0, session_id: state.sessionId });
        resolve();
      });
    });
  } else {
    // No live stdin to hold: run the adapter the same way the in-process path does
    // (dispatch.ts's executeRun) and wait for its one real answer.
    try {
      // No onProgress here: every adapter already journals its own events straight to
      // transcriptPath (stub.ts, cli-agent.ts both do) — onProgress is a SEPARATE side
      // channel for a live console line (dispatch.ts's ProgressLine uses it that way).
      // Wiring it to log() too double-wrote every event (caught immediately by looking
      // at a real transcript after this fix landed).
      const outcome = await adapter.run({
        runId,
        workDir: workspace,
        briefBody: brief,
        transcriptPath,
        sessionId: task.agent_session_id ?? undefined,
        onStart: (pid) => {
          if (pid) patchRun(projectDir, runId, { agent_pid: pid });
        },
      });
      state.finalMessage = outcome.final_message;
      if (outcome.waiting) {
        state.waiting = outcome.waiting;
        patchRun(projectDir, runId, { waiting_on: outcome.waiting });
      }
      if (outcome.session_id) state.sessionId = outcome.session_id;
      // NOT kind:"final" — the adapter already wrote its own {kind:"final", message}
      // for its real answer (stub.ts does; renderConversation renders that as a
      // bubble). A second "final" with no .message field would render as an empty
      // bubble right after the real one. "turn_complete" is the claude branch's own
      // name for this exact bookkeeping moment — reused here for the same reason:
      // it's a marker the transcript view already knows to leave unrendered.
      log({ kind: "turn_complete", label: "agent finished its turn", exit_code: outcome.exit_code, session_id: state.sessionId });
    } catch (error) {
      log({ kind: "spawn_error", error: String(error) });
    }
  }

  try {
    server.close();
    rmSync(record.socket, { force: true });
    rmSync(supervisorRecordPath(projectDir, runId), { force: true });
  } catch {
    // Cleanup is best effort.
  }

  patchRun(projectDir, runId, {
    agent_pid: undefined,
    ...(state.sessionId ? { agent_session_id: state.sessionId } : {}),
  });

  if (state.stopped) {
    transitionRun(projectDir, runId, "stopped", "user", "stopped by request");
    return;
  }

  const fence = parseReportFence(state.finalMessage);
  if (fence?.kind === "blocked" || state.waiting) {
    const note = fence?.question ?? fence?.need ?? state.waiting?.detail ?? "blocked without a stated question";
    transitionRun(projectDir, runId, "blocked", "kernel", note);
    return;
  }

  transitionRun(projectDir, runId, "verifying", "kernel");
  const statement = fence?.statement ?? `work delivered — see diff (agent skipped the ${CLAIM_PROTOCOL_VERSION} fence)`;
  const verification = verifyRun(projectDir, runId, workspace, plan.checks, `${statement}\n${(fence?.learned ?? []).join("\n")}`);
  const claim: ClaimRecord = {
    schema_version: RUN_SCHEMA_VERSION,
    run_id: runId,
    statement,
    checks: verification.checks,
    unsure: fence?.unsure ?? [],
    learnings: fence?.learned ?? [],
    protocol_ok: Boolean(fence),
    diff: { files: verification.diff.files, lines: verification.diff.lines },
    created_at: new Date().toISOString(),
  };
  writeFileSync(join(dir, "claim.json"), `${JSON.stringify(claim, null, 2)}\n`, "utf8");

  if (workspaceKind === "worktree") {
    if (claim.learnings.length) draftLearnings(projectDir, readRun(projectDir, runId), claim, verification.diff.paths);
    commitWorktree(projectDir, runId, `kage: ${task.intent}\n\nRun: ${runId}\nClaim: ${claim.statement}`);
  }

  const ready = verification.passed || !strictVerify(projectDir);
  transitionRun(
    projectDir,
    runId,
    ready ? "ready" : "failed",
    "kernel",
    ready ? undefined : verification.checks.filter((check) => check.result !== "pass").map((check) => check.id).join(", "),
  );
  appendRunLedger(projectDir, {
    kind: "verified",
    run_id: runId,
    type: task.type,
    passed: verification.passed,
    checks: verification.checks.map((check) => ({ id: check.id, result: check.result })),
  });
}
