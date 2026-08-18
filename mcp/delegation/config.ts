// Repo-level delegation config: the handful of answers Kage asks once and remembers
// (install asks two of them). Everything has a derived default, so a repo with no
// config file still dispatches — the file only records what could not be inferred.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

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
}

export const DEFAULT_DIFF_BUDGET = 400;
export const DEFAULT_MAX_CONCURRENT = 3;

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
  return readDelegationConfig(projectDir).diff_budget ?? DEFAULT_DIFF_BUDGET;
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
