// Stub adapter: a scripted "agent" for tests and CI, where no coding-agent
// subscription exists. It exercises the full kernel loop — transcript, file edits,
// and every reporting-protocol behavior (claim, blocked, fence-less degradation).
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Adapter, AdapterInput, AdapterOutcome } from "./types.js";

export interface StubOptions {
  behavior?: "claim" | "blocked" | "no-fence";
  editFile?: { path: string; content: string };
  statement?: string;
  unsure?: string[];
  learned?: string[];
  /**
   * When set, the adapter also implements spawnLive: a real held child process (not a
   * real coding agent, just a tiny script) that speaks the same line-delimited
   * stream-json protocol superviseRun's control loop steers — one `kage-blocked` result,
   * then, once a stdin frame arrives (a tell), one `kage-claim` result. This is what
   * lets the blocked → tell → ready loop be exercised end to end without a real CLI
   * installed.
   */
  live?: {
    question: string;
    /**
     * What the FIRST stdin line gets back. "blocked" (default) exercises the
     * blocked → tell → claim loop; "claim" answers immediately, for exercising a
     * reattached resume where the first line IS the answer, not a fresh brief.
     */
    firstResult?: "blocked" | "claim";
  };
}

// A minimal stream-json speaker: advance one phase per stdin line it receives, exactly
// like a real held agent reacting to userMessageFrame injections. Values are threaded in
// through env vars, JSON-encoded — this script only ever runs with test-authored input.
// It never calls process.exit() itself: a pipe write is not guaranteed flushed before
// exit, which would truncate the very line the supervisor is waiting to read. Instead it
// relies on the supervisor ending its side of stdin once a claim's `result` line lands —
// exactly the real shutdown path being tested — which drains this process naturally.
const LIVE_STUB_SCRIPT = `
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const edit = JSON.parse(process.env.KAGE_STUB_EDIT);
const target = path.join(process.cwd(), edit.path);
fs.mkdirSync(path.dirname(target), { recursive: true });
const firstResult = process.env.KAGE_STUB_LIVE_FIRST || "blocked";
let phase = 0;
readline.createInterface({ input: process.stdin }).on("line", () => {
  phase += 1;
  if (phase === 1 && firstResult === "blocked") {
    process.stdout.write(JSON.stringify({ type: "result", result: process.env.KAGE_STUB_BLOCKED }) + "\\n");
  } else {
    fs.writeFileSync(target, edit.content, "utf8");
    process.stdout.write(JSON.stringify({ type: "result", result: process.env.KAGE_STUB_CLAIM }) + "\\n");
  }
});
`;

export function stubAdapter(options: StubOptions = {}): Adapter {
  const behavior = options.behavior ?? "claim";
  const edit = options.editFile ?? { path: "STUB_NOTE.md", content: "stub adapter was here\n" };
  const adapter: Adapter = {
    name: "stub",
    async run(input: AdapterInput): Promise<AdapterOutcome> {
      mkdirSync(dirname(input.transcriptPath), { recursive: true });
      const log = (event: Record<string, unknown>): void => {
        appendFileSync(input.transcriptPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, "utf8");
      };
      log({ kind: "start", adapter: "stub", run_id: input.runId });

      // Test-only hook: hold the run open long enough for a test to kill a process
      // watching it and still observe the run in flight. Opt-in and 0 by default, so it
      // changes nothing about the many tests that rely on the stub finishing instantly.
      const delayMs = Number(process.env.KAGE_STUB_RUN_DELAY_MS ?? 0);
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

      const target = join(input.workDir, edit.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, edit.content, "utf8");
      log({ kind: "tool", label: `editing ${edit.path}` });
      input.onProgress?.({ kind: "tool", label: `editing ${edit.path}` });

      let finalMessage: string;
      if (behavior === "blocked") {
        finalMessage = [
          "I need a decision before continuing.",
          "",
          "```kage-blocked",
          JSON.stringify({ need: "a decision", question: "stub question: proceed with plan A or B?" }),
          "```",
        ].join("\n");
      } else if (behavior === "no-fence") {
        finalMessage = "I did some things and everything seems fine.";
      } else {
        finalMessage = [
          "Done.",
          "",
          "```kage-claim",
          JSON.stringify({
            statement: options.statement ?? "stub work delivered",
            unsure: options.unsure ?? [],
            learned: options.learned ?? [],
          }),
          "```",
        ].join("\n");
      }
      log({ kind: "final", message: finalMessage });
      return { exit_code: 0, final_message: finalMessage };
    },
  };

  if (options.live) {
    const firstResult = options.live.firstResult ?? "blocked";
    const blocked = [
      "```kage-blocked",
      JSON.stringify({ need: "a decision", question: options.live.question }),
      "```",
    ].join("\n");
    const claim = [
      "```kage-claim",
      JSON.stringify({
        statement: options.statement ?? "stub work delivered",
        unsure: options.unsure ?? [],
        learned: options.learned ?? [],
      }),
      "```",
    ].join("\n");
    adapter.spawnLive = ({ workDir }) =>
      spawn(process.execPath, ["-e", LIVE_STUB_SCRIPT], {
        cwd: workDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          KAGE_STUB_BLOCKED: blocked,
          KAGE_STUB_CLAIM: claim,
          KAGE_STUB_EDIT: JSON.stringify(edit),
          KAGE_STUB_LIVE_FIRST: firstResult,
        },
      });
  }

  return adapter;
}
