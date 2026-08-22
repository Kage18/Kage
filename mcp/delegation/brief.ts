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
import { KNOWN_FILE_EXTENSIONS, KNOWN_TOP_LEVEL_PREFIXES, citedPaths } from "./verify.js";

export interface BriefMemory {
  id: string;
  title: string;
  summary: string;
  author: string | null;
  noted_at: string;
  paths: string[];
}

// Beliefs-first (docs/design/BELIEF_MEMORY.md "the retrieval flip"): consolidated,
// per-domain understanding recall ranks above episode packets. Empty when no belief
// matches the intent — the brief falls back to `memories` as primary context, unchanged.
export interface BriefBelief {
  id: string;
  title: string;
  confidence: string;
  summary: string;
  path: string;
  evidence: string[];
}

export interface BriefPlan {
  intent: string;
  type: RunType;
  beliefs: BriefBelief[];
  memories: BriefMemory[];
  touches: string[];
  /**
   * The subset of `touches` backed by direct evidence about THIS task — a path the
   * intent names outright, or a memory citation whose path text actually matches an
   * intent term — as opposed to the code graph's inference. blastRadiusFor uses this,
   * not the full `touches` set, because graph-derived touches already expand into the
   * dependents blastRadiusFor is trying to count; using them as the basis too would
   * double-count and undercount the risk in the same breath.
   */
  evidenceTouches: string[];
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

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

// Kage's own runtime storage, never something a code change lands near. Belt-and-
// suspenders: citedPaths already excludes it from the paths it extracts, but memory
// packets' own `paths` field (and, in principle, the graph) are not routed through
// citedPaths, so this is checked again at the point a path actually enters the touch set.
function isMemoryStoragePath(path: string): boolean {
  return path.startsWith(".agent_memory/");
}

// All files git actually tracks in this checkout — the ground truth a name from the
// intent is resolved against. Empty (not thrown) when there is no git repo here yet,
// same failure shape as every other optional signal in this compiler.
function repoTrackedFiles(projectDir: string): string[] {
  const result = git(projectDir, ["ls-files"]);
  return result.ok ? result.stdout.split("\n").filter(Boolean) : [];
}

// A path-shaped or bare-filename token resolves if it IS a tracked file, or is a unique
// suffix of exactly one — same resolution rule verify.ts's citation check uses, so a
// path the brief predicts and a path a claim later cites are judged by the same rule.
function resolveAgainstRepo(token: string, files: string[]): string | null {
  if (files.includes(token)) return token;
  const bySuffix = files.filter((file) => file === token || file.endsWith(`/${token}`));
  return bySuffix.length === 1 ? bySuffix[0] : null;
}

// "the room-pty file" names a file by stem, no extension. Resolved the same way as a
// bare filename, but matched against the tracked file's stem (extension stripped)
// instead of its full basename.
function resolveStemAgainstRepo(stem: string, files: string[]): string | null {
  const matches = files.filter((file) => {
    const base = file.slice(file.lastIndexOf("/") + 1);
    const dot = base.lastIndexOf(".");
    return (dot > 0 ? base.slice(0, dot) : base) === stem;
  });
  return matches.length === 1 ? matches[0] : null;
}

// A filename mentioned with no directory ("app-styles.ts", not "mcp/delegation/app-
// styles.ts") — citedPaths requires a slash, so it never sees these. Same known-
// extension whitelist citedPaths uses, so the two never disagree on what "looks like a
// source file" means.
function bareFilenameCandidates(intent: string): string[] {
  const found = new Set<string>();
  for (const match of intent.matchAll(/\b[\w-]+\.[A-Za-z0-9]{1,8}\b/g)) {
    const token = match[0];
    const ext = token.slice(token.lastIndexOf(".") + 1).toLowerCase();
    if (KNOWN_FILE_EXTENSIONS.has(ext)) found.add(token);
  }
  return [...found];
}

// "the room-pty file" — a bare stem followed by the word "file", no extension at all.
// Deliberately permissive (it will also capture "the file", "this file"): the actual
// filter is resolveStemAgainstRepo requiring a UNIQUE match against a real tracked
// file, so a generic word that happens to precede "file" simply resolves to nothing.
function fileStemCandidates(intent: string): string[] {
  const found = new Set<string>();
  for (const match of intent.matchAll(/\b([a-zA-Z][\w-]{1,60})\s+file\b/gi)) found.add(match[1].toLowerCase());
  return [...found];
}

// Paths the intent names directly — the strongest possible evidence about THIS task,
// because it isn't inferred from anything, it's just read off what the user typed.
// Every form is resolved against real tracked files before being trusted: an unresolved
// guess is worse than no prediction, so nothing here is offered on faith.
function namedTouches(projectDir: string, intent: string): string[] {
  const files = repoTrackedFiles(projectDir);
  if (!files.length) return [];
  const resolved = new Set<string>();
  for (const token of [...citedPaths(intent), ...bareFilenameCandidates(intent)]) {
    const hit = resolveAgainstRepo(token, files);
    if (hit) resolved.add(hit);
  }
  for (const stem of fileStemCandidates(intent)) {
    const hit = resolveStemAgainstRepo(stem, files);
    if (hit) resolved.add(hit);
  }
  return [...resolved];
}

// Generic words that show up in nearly every intent regardless of what it's actually
// about ("add", "fix", "change") or that this compiler's own extraction grammar adds
// as noise ("file"). Excluded so they can't correlate a candidate path by accident —
// a repo with a file named literally "fix.ts" is the one false negative this accepts.
// Top-level directory names (from verify.ts's own prefix list, not a second guess at
// what they are) are excluded too: "mcp" is in the name of nearly every file here, so
// as a term it correlates with everything — which means it correlates with nothing.
const CORRELATION_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "in", "on", "at", "to", "of", "for", "is", "this", "that", "it",
  "add", "fix", "make", "do", "does", "doing", "change", "changes", "changing", "file", "files",
  "something", "nothing", "else", "all", "one", "word", "local", "inside", "top",
  ...KNOWN_TOP_LEVEL_PREFIXES.map((prefix) => prefix.replace(/\/$/, "")),
]);

function correlationTerms(intent: string): string[] {
  return dedupe(
    intent
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3 && !CORRELATION_STOPWORDS.has(word)),
  );
}

// Whether a candidate path is actually about what the intent says, not just something
// recall's fuzzy text match or the graph's term scoring happened to surface. Judged on
// the path's own filename, not its full text — kernel.ts should not "correlate" with
// an intent that merely contains the word "in" or "on".
function pathCorrelates(path: string, terms: string[]): boolean {
  if (!terms.length) return false;
  const base = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const stem = base.replace(/\.[^./]+$/, "");
  const words = stem.split(/[-_.]+/).filter((word) => word.length >= 3);
  return terms.some((term) => stem.includes(term) || term.includes(stem) || words.some((word) => word.includes(term) || term.includes(word)));
}

export function compileBrief(projectDir: string, intent: string, type: RunType, limit = 5): BriefPlan {
  const notes: string[] = [];

  // 1. Memory. recall() already withholds stale packets and stale beliefs, so a brief
  // can never carry a claim the code has moved past. Beliefs (consolidated understanding)
  // come first; episode packets ride along as their drill-down evidence.
  let beliefs: BriefBelief[] = [];
  let memories: BriefMemory[] = [];
  try {
    const recalled = recall(projectDir, intent, limit);
    // Provenance comes from one cached git pass, not a spawn per packet.
    const { authorById } = packetProvenance(projectDir);
    beliefs = (recalled.beliefs ?? []).map((belief) => ({
      id: belief.id,
      title: belief.title,
      confidence: belief.confidence,
      summary: belief.summary,
      path: belief.path,
      evidence: belief.cited_packets,
    }));
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
    if (recalled.beliefs_withheld?.length) {
      notes.push(`${recalled.beliefs_withheld.length} belief(s) withheld as stale — not included in this brief.`);
    }
  } catch {
    notes.push("Memory recall unavailable (no index yet) — briefing without repo memory.");
  }

  // 2. Predicted touch set, in priority order:
  //   a) paths the intent NAMES outright — direct evidence about THIS task, always
  //      kept, never crowded out;
  //   b) memory citations whose path text actually correlates with an intent term —
  //      evidence about a SIMILAR past task, filtered so a loosely-recalled packet
  //      can't smuggle in an unrelated file;
  //   c) the code graph's own answer for the intent, correlation-filtered the same
  //      way, and given guaranteed slots — a memory recall with many citations must
  //      never be able to fill all 8 slots before the graph is even asked.
  // .agent_memory/** never appears: it is Kage's own storage, not source the task
  // would touch, and citing it as a "likely touch" would be actively misleading.
  const TOUCH_CAP = 8;
  const touches = new Set<string>();
  const evidence = new Set<string>();

  for (const path of namedTouches(projectDir, intent)) {
    touches.add(path);
    evidence.add(path);
  }

  const terms = correlationTerms(intent);
  const memoryCandidates = dedupe(memories.flatMap((memory) => memory.paths.slice(0, 3)))
    .filter((path) => !isMemoryStoragePath(path) && !touches.has(path) && pathCorrelates(path, terms));

  let graphCandidates: string[] = [];
  try {
    const graph = queryCodeGraph(projectDir, intent, 6);
    graphCandidates = dedupe([...graph.files.slice(0, 4).map((f) => f.path), ...graph.symbols.slice(0, 4).map((s) => s.path)])
      .filter((path) => !isMemoryStoragePath(path) && !touches.has(path) && pathCorrelates(path, terms));
  } catch {
    notes.push("Code graph unavailable — run `kage index` for touch-set prediction.");
  }

  // Reserve at least half of what's left for the graph before memory can spend it —
  // memory is evidence about a similar past task, the graph is the direct answer for
  // THIS one, and it must never be crowded to zero just because recall had more to say.
  const remainingAfterNamed = Math.max(0, TOUCH_CAP - touches.size);
  const graphReserved = Math.ceil(remainingAfterNamed / 2);
  const memoryBudget = remainingAfterNamed - graphReserved;
  for (const path of memoryCandidates.slice(0, memoryBudget)) {
    touches.add(path);
    evidence.add(path);
  }
  const graphBudget = TOUCH_CAP - touches.size;
  for (const path of graphCandidates.slice(0, graphBudget)) touches.add(path);

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
    beliefs,
    memories,
    touches: [...touches].slice(0, TOUCH_CAP),
    evidenceTouches: [...evidence],
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
  if (plan.beliefs.length) {
    lines.push("_Consolidated understanding — episode packets below are drill-down evidence for these, not the primary claim._", "");
    for (const belief of plan.beliefs) {
      lines.push(`- **${belief.title}** (confidence: ${belief.confidence})`);
      lines.push(`  ${belief.summary}`);
      lines.push(`  evidenced by ${belief.evidence.length} packet(s), e.g. ${belief.evidence.slice(0, 2).join(", ") || "none cited"} · ${belief.path}`);
    }
    lines.push("");
  }
  if (plan.memories.length) {
    if (plan.beliefs.length) lines.push("_Supporting episode packets:_", "");
    for (const memory of plan.memories) {
      const who = memory.author ? `${memory.author}, ` : "";
      lines.push(`- **${memory.title}** (${who}${memory.noted_at})`);
      lines.push(`  ${memory.summary}`);
      if (memory.paths.length) lines.push(`  cites: ${memory.paths.slice(0, 4).join(", ")}`);
    }
    lines.push("", "Treat these as verified repo knowledge — they were checked against the current code. If you find one is wrong, say so in your claim.");
  } else if (!plan.beliefs.length) {
    lines.push("_Nothing relevant in repo memory yet — you are the first to work here._");
  }

  lines.push("", "## Likely touch set", "");
  if (plan.touches.length) {
    lines.push(plan.touches.map((path) => `- ${path}`).join("\n"));
    lines.push("", "Staying inside this set is expected but not mandatory — if the work belongs elsewhere, say so in your claim.");
  } else {
    // No path named, no correlated memory citation, no correlated graph match: a
    // guess here would be the brief lying in the reassuring direction, so it says
    // nothing rather than offer a set nobody should trust.
    lines.push("_No prediction available — work from the intent above._");
  }

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
