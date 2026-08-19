// Repo-level delegation config: the handful of answers Kage asks once and remembers
// (install asks two of them). Everything has a derived default, so a repo with no
// config file still dispatches — the file only records what could not be inferred.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Per-run spend/time/diff-size caps a hired agent is halted against — every field is
 * optional so a config that sets only `usd` leaves `minutes` and `diff_lines` at their
 * defaults (see effectiveBudgets). `diff_lines` here and the older top-level
 * `diff_budget` key name the SAME cap; when both are set, `diff_lines` wins — routing
 * every reader (diffBudget(), and the RunBudgets a dispatch is created with) through
 * configuredBudgets() below is what keeps the two from silently drifting apart.
 */
export interface BudgetsConfig {
  usd?: number;
  minutes?: number;
  diff_lines?: number;
}

export interface DelegationConfig {
  /** Command run once in a fresh worktree before the agent starts (e.g. "npm install"). */
  setup?: string;
  /** The repo's test command — the backbone check of every brief. */
  test?: string;
  /** Diff-size budget above which a claim is refused as "too large to review well". */
  diff_budget?: number;
  /** Any non-passing check blocks `ready`. Default true; honesty over convenience. */
  strict_verify?: boolean;
  /** Max concurrent running runs. */
  max_concurrent?: number;
  /**
   * Kernel-executed pre-claim static checks (tsc --noEmit, composed-page parse) that run
   * on every run before the claim is judged, regardless of what the agent declared.
   * Default true. A no-op for a repo with no tsconfig either way, but this flag exists
   * for a non-TypeScript repo that wants to skip the resolution attempt entirely.
   */
  static_checks?: boolean;
  /** Repo-wide overrides of the per-run budget a hired agent is halted against. */
  budgets?: BudgetsConfig;
  /**
   * The worker agent a dispatched run uses when the caller doesn't name one — set from
   * the app's add-project dialog or `kage projects add --agent`. Plain string, not
   * AdapterName: config.ts stays independent of adapters/index.ts, and an unknown value
   * here just falls back to "claude" at the call site rather than failing to parse.
   */
  default_agent?: string;
  /**
   * Reach the daemon from another device on the local network (a phone), not just this
   * machine. Off by default — enabling it binds the daemon to the LAN interface as well
   * as loopback and requires a pairing secret on every request that arrives that way.
   */
  lan?: boolean;
}

export const DEFAULT_DIFF_BUDGET = 400;
export const DEFAULT_MAX_CONCURRENT = 3;
// Mirrors contract.ts's DEFAULT_RUN_BUDGETS (usd/minutes) — kept here rather than
// imported so config.ts, the layer contract.ts's kernel is read BY, never depends on
// the kernel itself. Do not change these without changing DEFAULT_RUN_BUDGETS too.
export const DEFAULT_RUN_BUDGET_USD = 2;
export const DEFAULT_RUN_BUDGET_MINUTES = 30;

function configPath(projectDir: string): string {
  return join(projectDir, ".agent_memory", "config.json");
}

export function readDelegationConfig(projectDir: string): DelegationConfig {
  const path = configPath(projectDir);
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as { delegation?: DelegationConfig } & DelegationConfig;
    // Accept both a flat file and a { delegation: {...} } namespace so this can share
    // config.json with future sections without a migration.
    return raw.delegation ?? raw;
  } catch {
    return {};
  }
}

export function writeDelegationConfig(projectDir: string, patch: DelegationConfig): DelegationConfig {
  const merged = { ...readDelegationConfig(projectDir), ...patch };
  const path = configPath(projectDir);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
  return merged;
}

// Test command resolution order (design §3): explicit config → package.json script →
// nothing. A repo with no discoverable test command gets a brief with no command check
// and is told so, rather than a check that silently passes.
function hasTestScript(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    const pkg = JSON.parse(readFileSync(path, "utf8")) as { scripts?: Record<string, string> };
    return Boolean(pkg.scripts?.test);
  } catch {
    return false;
  }
}

// Where a repo keeps its package is not always its root — Kage's own repo has it under
// mcp/, which is how the first real dogfood run ended up with no executable check at
// all. Look one level down before giving up.
const NESTED_PACKAGE_DIRS = ["mcp", "packages", "app", "src", "server", "api", "backend", "web", "client"];

export function resolveTestCommand(projectDir: string): string | null {
  const config = readDelegationConfig(projectDir);
  if (config.test) return config.test;
  if (hasTestScript(join(projectDir, "package.json"))) return "npm test";
  for (const dir of NESTED_PACKAGE_DIRS) {
    if (hasTestScript(join(projectDir, dir, "package.json"))) return `npm test --prefix ${dir}`;
  }
  return null;
}

export function diffBudget(projectDir: string): number {
  return configuredBudgets(projectDir).diff_lines;
}

/**
 * The repo's configured run budgets, fully defaulted — usd/minutes default from
 * DEFAULT_RUN_BUDGET_USD/MINUTES, diff_lines from budgets.diff_lines, falling back to
 * the legacy top-level diff_budget, falling back to DEFAULT_DIFF_BUDGET. This is the
 * ONLY place that resolves diff_lines vs diff_budget, so every caller (diffBudget()
 * above, and dispatch's effectiveBudgets() below) always agrees on one number.
 */
export function configuredBudgets(projectDir: string): { usd: number; minutes: number; diff_lines: number } {
  const config = readDelegationConfig(projectDir);
  const configured = config.budgets ?? {};
  return {
    usd: configured.usd ?? DEFAULT_RUN_BUDGET_USD,
    minutes: configured.minutes ?? DEFAULT_RUN_BUDGET_MINUTES,
    diff_lines: configured.diff_lines ?? config.diff_budget ?? DEFAULT_DIFF_BUDGET,
  };
}

/**
 * configuredBudgets(), with an explicit per-dispatch override laid on top — an override
 * always wins over config, which wins over the default. Used at dispatch time to build
 * the RunBudgets a run is created with (e.g. `kage dispatch --budget-usd`).
 */
export function effectiveBudgets(
  projectDir: string,
  override?: Partial<{ usd: number; minutes: number; diff_lines: number }>,
): { usd: number; minutes: number; diff_lines: number } {
  const configured = configuredBudgets(projectDir);
  return {
    usd: override?.usd ?? configured.usd,
    minutes: override?.minutes ?? configured.minutes,
    diff_lines: override?.diff_lines ?? configured.diff_lines,
  };
}

export function strictVerify(projectDir: string): boolean {
  return readDelegationConfig(projectDir).strict_verify !== false;
}

export function maxConcurrent(projectDir: string): number {
  return readDelegationConfig(projectDir).max_concurrent ?? DEFAULT_MAX_CONCURRENT;
}

export function staticChecksEnabled(projectDir: string): boolean {
  return readDelegationConfig(projectDir).static_checks !== false;
}

export function lanModeEnabled(projectDir: string): boolean {
  return readDelegationConfig(projectDir).lan === true;
}
