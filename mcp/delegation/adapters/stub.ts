// Stub adapter: a scripted "agent" for tests and CI, where no coding-agent
// subscription exists. It exercises the full kernel loop — transcript, file edits,
// and every reporting-protocol behavior (claim, blocked, fence-less degradation).
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Adapter, AdapterInput, AdapterOutcome } from "./types.js";

export interface StubOptions {
  behavior?: "claim" | "blocked" | "no-fence";
  editFile?: { path: string; content: string };
  statement?: string;
  unsure?: string[];
  learned?: string[];
}

export function stubAdapter(options: StubOptions = {}): Adapter {
  const behavior = options.behavior ?? "claim";
  return {
    name: "stub",
    async run(input: AdapterInput): Promise<AdapterOutcome> {
      mkdirSync(dirname(input.transcriptPath), { recursive: true });
      const log = (event: Record<string, unknown>): void => {
        appendFileSync(input.transcriptPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, "utf8");
      };
      log({ kind: "start", adapter: "stub", run_id: input.runId });

      const edit = options.editFile ?? { path: "STUB_NOTE.md", content: "stub adapter was here\n" };
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
}
