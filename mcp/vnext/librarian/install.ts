// The front door — what `npx -y @kage-core/kage-graph-mcp install` actually delivers, and the
// screen a person reads three seconds later.
//
// Install is the first thing anyone runs and often the only thing. Until now it wired the LEGACY
// packet store: it created `.agent_memory/`, bootstrapped a heuristic starter packet, wired the
// agent, and left the Librarian — the product (DIRECTION.md) — uninstalled. This module is the
// Librarian's half of that flow. It does NOT replace kernel.ts's setupAgent: the MCP server entry,
// the hook scripts and the settings merge are still written there. This plans what all of it means
// for THIS repo, and says it in words a new user will finish reading.
//
// Three shapes are deliberate.
//
//   planInstall is a PURE read. It computes where things go and what is already there and writes
//   nothing at all — so the caller can plan, then act, then print, and so every string below is
//   testable without a single side effect. An installer whose report is produced by the same code
//   that does the work can only tell you what it meant to do.
//
//   It is also the caller's SINGLE source of truth for which agents get wired. Detection lives
//   here, named once, so the screen cannot claim an agent the installer skipped (or skip one it
//   claimed) — the two lists cannot drift because there is only one.
//
//   Rendering is separated from doing because renderNextSteps is the most-read string in the
//   product. It names ONE command, states whose tokens pay for the Librarian (theirs, always —
//   Kage buys no inference, ever), and says where memory lives and what the repo gets. At most ten
//   lines, because a wall of text after an install is not read, and an unread instruction is an
//   uninstalled product.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { BRIEF_BEGIN, BRIEF_END, briefTarget } from "./brief.js";
import { defaultStoreRoot, repoStoreId } from "./store.js";

/**
 * The line below which mining is not worth offering. Under ~20 commits the history digest is
 * thinner than the README — the miner would spend the user's own tokens to rediscover the initial
 * commit, and a first run that proposes nothing teaches them the feature does not work.
 */
const HISTORY_THRESHOLD = 20;

/**
 * Config-dir presence, not PATH: agents like Cursor never install a binary. This table mirrors the
 * probes in mcp/cli.ts's install command by DUPLICATION rather than import, on purpose — the
 * librarian core imports nothing from kernel.ts (24k lines) and this is a data table, not logic.
 * The duplication is safe in one direction only, which is why the caller wires `detectedAgents`
 * from this plan instead of probing again: one list, one claim.
 */
const AGENT_PROBES: ReadonlyArray<{ agent: string; paths: ReadonlyArray<readonly string[]> }> = [
  { agent: "claude-code", paths: [[".claude.json"], [".claude"]] },
  { agent: "codex", paths: [[".codex"]] },
  { agent: "cursor", paths: [[".cursor"]] },
  { agent: "windsurf", paths: [[".codeium", "windsurf"]] },
  { agent: "gemini-cli", paths: [[".gemini"]] },
  { agent: "opencode", paths: [[".config", "opencode"], [".opencode"]] },
  { agent: "goose", paths: [[".config", "goose"]] },
  { agent: "aider", paths: [[".aider.conf.yml"]] },
];

export interface InstallPlan {
  /** The shadow store for this repo — under the home dir, NEVER inside the project. */
  storeDir: string;
  /** Absolute path of the file that will carry the fenced block (AGENTS.md, else CLAUDE.md). */
  briefTarget: string;
  /**
   * Whether the fenced block is ALREADY in that file — not merely whether the file exists. That
   * is the distinction the screen needs: a repo whose AGENTS.md already carries the block is being
   * refreshed in place, and telling its owner "your repo gets a block" reads as a second one.
   */
  briefExists: boolean;
  /** Agents detected on this machine, in probe order. Empty means none found — never a guess. */
  detectedAgents: string[];
  /** Whether this repo has enough history that day-one mining is worth offering. */
  hasHistory: boolean;
  /** Whether Kage already has a card store for this repo — i.e. this run is a refresh. */
  alreadyInstalled: boolean;
}

// ── Planning (pure reads only) ───────────────────────────────────────────────────────────────

/**
 * Which agents are set up on this machine. Every failure degrades to a shorter list, never to a
 * guess: an installer that claims to have wired Cursor because it could not read the home
 * directory has told the user a comfortable lie about where their memory will show up.
 */
function detectAgents(home: string): string[] {
  const found: string[] = [];
  for (const probe of AGENT_PROBES) {
    try {
      if (probe.paths.some((segments) => existsSync(join(home, ...segments)))) found.push(probe.agent);
    } catch {
      // An unreadable home, a permission wall, a path that is not a directory. This agent is
      // simply not detected; the others still get their turn.
    }
  }
  return found;
}

/**
 * Is there history worth mining? `--max-count` caps the walk at the threshold, so this costs the
 * same on a twenty-commit repo and on linux.git. A fresh `git init`, an unborn HEAD, a directory
 * that is not a repo at all, or no git on PATH all answer the same honest "no" — those users are
 * pointed at session capture instead, which is the path that actually works for them.
 */
function hasMinableHistory(projectDir: string): boolean {
  try {
    const out = execFileSync(
      "git",
      ["-C", projectDir, "rev-list", "--count", `--max-count=${HISTORY_THRESHOLD}`, "HEAD"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    // NaN (empty output) compares false, which is the answer we want for an unreadable count.
    return Number.parseInt(out.trim(), 10) >= HISTORY_THRESHOLD;
  } catch {
    return false;
  }
}

/** Whether the generated block is already spliced into the target file. */
function briefBlockPresent(target: string): boolean {
  try {
    return readFileSync(target, "utf8").includes(BRIEF_BEGIN);
  } catch {
    return false; // No file, no block. Not an error: this is the common first-install case.
  }
}

/**
 * Everything the installer needs to decide and to say, computed without touching anything.
 *
 * `home` is a parameter rather than an env read because store.ts's rule holds all the way up: the
 * CLI edge owns the environment, and every layer below takes its roots explicitly — which is also
 * what lets a test run this against a scratch home instead of the operator's real ~/.kage.
 */
export function planInstall(projectDir: string, home?: string): InstallPlan {
  const resolvedHome = home ?? homedir();
  // Deliberately not openStore(): that CREATES the shadow repo, and a plan that brought the thing
  // it is describing into existence could never report `alreadyInstalled: false` twice.
  const storeDir = join(defaultStoreRoot(resolvedHome), repoStoreId(projectDir));
  const target = briefTarget(projectDir);
  return {
    storeDir,
    briefTarget: target,
    briefExists: briefBlockPresent(target),
    detectedAgents: detectAgents(resolvedHome),
    hasHistory: hasMinableHistory(projectDir),
    // The store is the one durable PER-REPO signal, and openStore is the only thing that creates
    // it. Hooks and the MCP server entry are machine-level and re-run idempotently, so folding
    // them in would make the second repo on a wired machine report "already installed" before it
    // held a single card.
    alreadyInstalled: existsSync(join(storeDir, "cards")),
  };
}

// ── Rendering ────────────────────────────────────────────────────────────────────────────────

/** `  Label      text` — a fixed label column, so the four facts read as a table, not prose. */
function row(label: string, text: string): string {
  return `  ${label.padEnd(11)}${text}`;
}

/** Continuation under a row, aligned with its text column. */
function under(text: string): string {
  return `${" ".repeat(13)}${text}`;
}

function agentList(plan: InstallPlan): string {
  return plan.detectedAgents.join(", ");
}

/**
 * Where the install puts things — four facts, in the order a sceptic asks them: where does my
 * memory go, what happens to my repo, which agents get it, is there anything to read today.
 *
 * Written as noun phrases rather than "will create" / "created" so the same string is honest
 * before the work and after it — the caller plans, acts, then prints this.
 *
 * It deliberately does NOT name the MCP tools. mcp/index.ts renames one of them at registration
 * (`kage_recall` → `kage_cards_recall`, until the legacy packet tool releases the name), so a plan
 * printing the librarian's own names would name a tool that resolves to something else.
 */
export function renderInstallPlan(plan: InstallPlan): string {
  const brief = basename(plan.briefTarget);
  const lines: string[] = [
    plan.alreadyInstalled
      ? "The Librarian — already set up for this repo; re-running keeps every card you have:"
      : "The Librarian — one card store outside your repo, one fenced block inside it:",
    "",
    row("Memory", plan.storeDir),
    under("a git repo of its own, outside your project — team memory never lives in it"),
    row(
      "Your repo",
      plan.briefExists
        ? `${brief} — the fenced block is already there and is refreshed in place`
        : `${brief} — one fenced block, added below whatever you already wrote`,
    ),
    under(`${BRIEF_BEGIN} … ${BRIEF_END} — no memory file is written into your repo`),
    row(
      "Agents",
      plan.detectedAgents.length > 0
        ? `${agentList(plan)} — Kage tools plus the pre-edit cards hook`
        : "none detected — wire one: kage setup <agent> --project . --write",
    ),
    row(
      "History",
      plan.hasHistory
        ? `${HISTORY_THRESHOLD}+ commits — there is something to mine today`
        : `under ${HISTORY_THRESHOLD} commits — too thin to mine; cards will come from your sessions`,
    ),
  ];
  return lines.join("\n");
}

/**
 * The most important string in the product: what to do now.
 *
 * The rules it keeps, each paid for by a failure mode:
 *
 *   ONE command. A list of five options is a decision, and a decision three seconds after an
 *   install is a tab that gets closed. Which one it is depends on the repo — mining is only worth
 *   naming where there is history to mine, and offering it to a two-commit repo would spend the
 *   user's tokens to produce nothing on the very first try.
 *
 *   Whose tokens, always. The Librarian runs headless on the user's OWN coding-agent subscription
 *   (DIRECTION.md: Kage pays for zero inference, ever). That is a genuine advantage and also a
 *   genuine cost to them; discovering it from a usage bill instead of from this screen would be
 *   the kind of surprise that ends the relationship.
 *
 *   Where memory lives, and the size of the footprint in their repo. "One fenced block and
 *   nothing else" is the promise that makes a team willing to install this at all — the old model
 *   put memory noise in 200 of the last 200 commits.
 *
 * At most ten lines, enforced by test.
 */
export function renderNextSteps(plan: InstallPlan): string {
  const brief = basename(plan.briefTarget);
  // The restart is not optional and not obvious: the MCP tools and the cards hook are read when a
  // session starts, so an agent already running has none of them and the user's first impression
  // would be a product that does nothing. With no agent detected, the honest line is that nothing
  // is wired yet at all.
  const wiring =
    plan.detectedAgents.length > 0
      ? `  Restart ${agentList(plan)} so the Kage tools and the pre-edit hook load.`
      : "  No agent wired yet: kage setup <agent> --project . --write";

  const opening = plan.hasHistory
    ? [
        "Next — one command:",
        "",
        "  kage cards mine        propose cards from this repo's own history",
        wiring,
        "",
        "Mining runs on YOUR coding-agent subscription and spends YOUR tokens, not ours.",
      ]
    : [
        "Next — nothing to run:",
        "",
        "  Start coding. The Librarian proposes cards when your session ends;",
        "  review them with `kage cards list --state proposed`.",
        wiring,
        "",
        "It runs on YOUR coding-agent subscription and spends YOUR tokens, not ours.",
      ];

  return [
    ...opening,
    `Memory lives in ${plan.storeDir} — its own git repo, outside this project.`,
    // "and nothing else" was false, and measurably so: an install also writes the agent policy
    // (AGENTS.md + CLAUDE.md, which is what tells an agent to use Kage at all), a .gitignore entry
    // and a merge-driver .gitattributes — four staged files, not one. The claim that matters is
    // about MEMORY, and that one is true and worth stating precisely: none of your memory is
    // committed to this repo. Overstating it to "nothing else" trades a strong true claim for a
    // weak false one, in a product whose whole pitch is that its numbers are honest.
    `No memory is written into this repo — you get one fenced block in ${brief}, plus the agent`,
    `policy and a .gitignore entry. Everything Kage remembers lives in the store above.`,
  ].join("\n");
}
