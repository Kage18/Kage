// The brief compiler — where memory becomes load-bearing.
//
// Every competitor dispatches `raw prompt + static AGENTS.md`. Kage compiles a per-task
// brief: what the repo already learned (with who learned it and when), which code the
// task will touch, and the checks the work will be held to. The brief is also the
// felt-memory surface: the user watches their repo's knowledge get put to work.
import { queryCodeGraph, recall } from "../kernel.js";
import { diffBudget, resolveTestCommand } from "./config.js";
import { packetProvenance } from "./provenance.js";
import {
  CLAIM_PROTOCOL_INSTRUCTIONS,
  CLAIM_PROTOCOL_VERSION,
  type CheckSpec,
  type RunType,
  type TaskRecord,
} from "./contract.js";
import { git } from "./git.js";
import { type ConfidenceVerdict, confidenceFor } from "./trackrecord.js";

export interface BriefMemory {
  id: string;
  title: string;
  summary: string;
  author: string | null;
  noted_at: string;
  paths: string[];
}

export interface BriefPlan {
  intent: string;
  type: RunType;
  memories: BriefMemory[];
  touches: string[];
  checks: CheckSpec[];
  confidence: ConfidenceVerdict;
  /** Actions that always need a human, regardless of confidence or autonomy. */
  deny: string[];
  notes: string[];
}

export const DENY_LIST = [
  "committing or printing secrets, tokens, or credentials",
  "deleting files or data outside the task's scope",
  "changing CI, deploy, or infrastructure configuration",
  "force-pushing, rewriting history, or touching git remotes",
];

export function compileBrief(projectDir: string, intent: string, type: RunType, limit = 5): BriefPlan {
  const notes: string[] = [];

  // 1. Memory. recall() already withholds stale packets, so a brief can never carry a
  // claim the code has moved past.
  let memories: BriefMemory[] = [];
  try {
    const recalled = recall(projectDir, intent, limit);
    // Provenance comes from one cached git pass, not a spawn per packet.
    const { authorById } = packetProvenance(projectDir);
    memories = recalled.results.map((entry) => ({
      id: entry.packet.id,
      title: entry.packet.title,
      summary: entry.packet.summary,
      author: authorById.get(entry.packet.id) ?? null,
      noted_at: (entry.packet.created_at ?? "").slice(0, 10),
      paths: entry.packet.paths ?? [],
    }));
    if (recalled.suppressed?.length) {
      notes.push(`${recalled.suppressed.length} memory item(s) withheld as stale — not included in this brief.`);
    }
  } catch {
    notes.push("Memory recall unavailable (no index yet) — briefing without repo memory.");
  }

  // 2. Predicted touch set: memory citations first (they are evidence this task has
  // history), then the code graph's answer for the intent's terms.
  const touches = new Set<string>();
  for (const memory of memories) for (const path of memory.paths.slice(0, 3)) touches.add(path);
  try {
    const graph = queryCodeGraph(projectDir, intent, 6);
    for (const file of graph.files.slice(0, 4)) touches.add(file.path);
    for (const symbol of graph.symbols.slice(0, 4)) touches.add(symbol.path);
  } catch {
    notes.push("Code graph unavailable — run `kage index` for touch-set prediction.");
  }

  // 3. Checks. The test command is the backbone; the diff budget and citation truth
  // apply to every run. A repo with no discoverable test command is told so plainly
  // rather than given a check that always passes.
  const checks: CheckSpec[] = [];
  const testCommand = resolveTestCommand(projectDir);
  if (testCommand) {
    checks.push({ id: "tests", kind: "command", cmd: testCommand, expect: "exit code 0" });
  } else {
    notes.push("No test command found — set one with `kage config --test \"<cmd>\"` so claims can be verified by execution.");
  }
  const budget = diffBudget(projectDir);
  checks.push({ id: "diff-size", kind: "diff", expect: `at most ${budget} changed lines` });
  checks.push({ id: "citations", kind: "citation", expect: "every cited path exists in the worktree" });

  return {
    intent,
    type,
    memories,
    touches: [...touches].slice(0, 8),
    checks,
    confidence: confidenceFor(projectDir, type, { memories: memories.length }),
    deny: DENY_LIST,
    notes,
  };
}

// A suggested (not mandatory) name for a new test file, derived from the run's own
// type/intent — cheap to compute, and it gives the agent a concrete default instead of
// a blank "name something" instruction, which is what the ad-hoc prose version was and
// why it kept losing to `mcp/delegation.test.ts`'s gravity.
function suggestedTestFile(plan: BriefPlan): string {
  const words = plan.intent
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter(Boolean)
    .slice(0, 4)
    .join("-");
  const slug = (words || plan.type).slice(0, 40).replace(/-+$/, "");
  return `mcp/${slug}.test.ts`;
}

// What the hired agent actually receives. Written as an instruction sheet for a
// competent colleague: context, boundaries, and how to report back.
export function renderBrief(task: TaskRecord, plan: BriefPlan, steers: string[] = []): string {
  const lines = [
    `# Brief: ${plan.intent}`,
    "",
    `run: ${task.id} · type: ${plan.type} · protocol: ${CLAIM_PROTOCOL_VERSION}`,
    "",
    "## Intent",
    "",
    plan.intent,
    "",
    "## What this repo already knows",
    "",
  ];
  if (plan.memories.length) {
    for (const memory of plan.memories) {
      const who = memory.author ? `${memory.author}, ` : "";
      lines.push(`- **${memory.title}** (${who}${memory.noted_at})`);
      lines.push(`  ${memory.summary}`);
      if (memory.paths.length) lines.push(`  cites: ${memory.paths.slice(0, 4).join(", ")}`);
    }
    lines.push("", "Treat these as verified repo knowledge — they were checked against the current code. If you find one is wrong, say so in your claim.");
  } else {
    lines.push("_Nothing relevant in repo memory yet — you are the first to work here._");
  }

  lines.push("", "## Likely touch set", "");
  lines.push(plan.touches.length ? plan.touches.map((path) => `- ${path}`).join("\n") : "_No prediction available._");
  lines.push("", "Staying inside this set is expected but not mandatory — if the work belongs elsewhere, say so in your claim.");

  lines.push("", "## You will be held to these checks", "");
  for (const check of plan.checks) {
    lines.push(`- \`${check.id}\`: ${check.cmd ? `\`${check.cmd}\` → ` : ""}${check.expect}`);
  }
  lines.push(
    "",
    "Kage re-runs these itself after you finish. Claiming a check passed without running it will be caught.",
    "",
    "You have Bash access — actually run the repo's tests and build before you make your claim,",
    "rather than reasoning about whether they'd pass. If a command is denied or unavailable, say",
    "so plainly in your claim's `unsure` list instead of guessing at the result.",
    "",
    "You may be running without permission to execute commands. That is fine and expected —",
    "Kage does the verifying. Do NOT claim you ran something you could not run: say plainly",
    "in your claim's `unsure` list what you were unable to check and how you reasoned instead.",
  );

  lines.push(
    "",
    "## Test placement",
    "",
    "New behaviour gets its own test file — never append to `mcp/delegation.test.ts`, a",
    "merge-conflict hotspot where several runs collide in it on the same day. Suggested:",
    `\`${suggestedTestFile(plan)}\` (rename it if the behaviour warrants a better name).`,
    "",
    "New behaviour must ship with a test that FAILS if your change is reverted — a test",
    "that passes either way proves nothing, and a green suite can't tell them apart. Say",
    "in your claim which test would fail on revert.",
  );

  lines.push("", "## Never do these without asking", "");
  for (const rule of plan.deny) lines.push(`- ${rule}`);

  if (steers.length) {
    lines.push("", "## Steering from the user", "");
    for (const steer of steers) lines.push(`- ${steer}`);
  }

  lines.push(
    "",
    "## You do not run repo harness tools",
    "",
    "You never run `kage_refresh`, `kage_learn`, or `kage_pr_check` — those are the operator's",
    "job, not yours. Your learnings reach memory through the `learned[]` field of your claim",
    "fence below; merge-ratification is what promotes them into repo memory. Never block on,",
    "or ask permission to run, those tools — just fill in `learned[]` and finish.",
    "",
    "This project compiles to CommonJS — no `import.meta`, no top-level `await` — so avoid",
    "those in any code or tests you add; they fail TypeScript compilation (TS1470) here.",
  );

  lines.push(
    "",
    "## The claim fence is required, not optional",
    "",
    "Skipping it is a failure, not a shortcut: it is the only way your own account, your",
    "unsure notes, and your learnings reach the operator and repo memory. A run that lands",
    "without one has its statement reverse-engineered from the diff instead.",
  );
  lines.push("", CLAIM_PROTOCOL_INSTRUCTIONS, "");
  return lines.join("\n");
}

// The dispatch card the human sees — kernel facts only, no manager prose.
export function renderBriefCard(task: TaskRecord, plan: BriefPlan): string {
  const memoryLines = plan.memories.length
    ? plan.memories.map((memory) => `           • ${memory.title}${memory.author ? ` (${memory.author}, ${memory.noted_at})` : ` (${memory.noted_at})`}`)
    : ["           (nothing relevant yet — this repo is new to me)"];
  return [
    "┌ BRIEF ─────────────────────────────────────────────────────────",
    `│ Intent     ${plan.intent}`,
    `│ Touches    ${plan.touches.slice(0, 4).join(" · ") || "unpredicted"}`,
    "│ Knows",
    ...memoryLines.map((line) => `│${line}`),
    `│ Checks     ${plan.checks.map((check) => check.cmd ?? check.id).join(" · ")}`,
    `│ Budget     $${task.budgets.usd.toFixed(2)} · ${task.budgets.minutes} min · ${task.budgets.diff_lines} diff lines`,
    `│ Agent      ${task.agent} · worktree ${task.branch}`,
    `│ Confidence ${plan.confidence.band} (${plan.confidence.basis})`,
    "└────────────────────────────────────────────────────────────────",
    ...plan.notes.map((note) => `  note: ${note}`),
  ].join("\n");
}
