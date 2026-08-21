// Adding a project from the app, honestly.
//
// AO gets from "+" to a live orchestrator session in four clicks: pick what you're
// importing, pick the folder, pick agents, "Create and start". Kage had no equivalent —
// the sidebar's "+" was a bare `window.prompt`, and the daemon side only checked
// `.git`/`.agent_memory` existed, never why a path was unusable. This module is the
// one place that decides whether a folder becomes a project, so the app dialog and the
// CLI (`kage projects add`) can never give a different answer for the same path.
//
// Deliberately NOT a workspace concept — Kage has none. A folder that holds several
// git repos is disambiguated by listing them, never by silently picking one.
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { ADAPTER_NAMES, isAgentInstalled, type AdapterName } from "./adapters/index.js";
import { writeDelegationConfig } from "./config.js";
import { rememberProject, type KnownProject } from "./projects.js";
import { resolveWorkspaceKind, type WorkspaceKind } from "./worktree.js";

// Directories that are never themselves "the project" a user meant to add, so a repo
// full of tooling noise never shows up as a pickable candidate next to the real ones.
const SKIP_DIR_NAMES = new Set(["node_modules", "dist", "build", ".next", ".cache", "vendor"]);

/**
 * Immediate subdirectories of `dir` that are themselves git repos — one level deep.
 * This is the whole of Kage's "multi-repo folder" handling: no workspace object, no
 * persisted grouping, just enough to stop a folder of several repos from having one
 * silently chosen for it.
 */
export function findNestedGitRepos(dir: string): string[] {
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || SKIP_DIR_NAMES.has(entry.name)) continue;
    const candidate = join(dir, entry.name);
    if (existsSync(join(candidate, ".git"))) found.push(candidate);
  }
  return found;
}

export type AddProjectRefusalReason = "not_found" | "not_a_repo" | "git_trouble" | "ambiguous";

export interface AddProjectRefused {
  ok: false;
  reason: AddProjectRefusalReason;
  /** One line, naming the reason plainly — never raw git stderr. */
  message: string;
  /** Only set when reason is "ambiguous": the git repos found under the given path. */
  candidates?: string[];
}

export interface AddProjectResult {
  ok: true;
  dir: string;
  name: string;
  kind: WorkspaceKind;
  projects: KnownProject[];
}

/**
 * Resolve a user-typed path to exactly one git repo, or explain why it can't be one —
 * never by picking silently among several. Split from `addProject` so the app can
 * validate as the user types, before committing to registering anything.
 */
export function resolveProjectPath(rawPath: string): { ok: true; dir: string } | AddProjectRefused {
  const trimmed = rawPath.trim();
  if (!trimmed) return { ok: false, reason: "not_found", message: "Enter a path to a git repository." };
  const dir = resolve(trimmed);
  if (!existsSync(dir)) {
    return { ok: false, reason: "not_found", message: `${trimmed} does not exist.` };
  }
  if (!statSync(dir).isDirectory()) {
    return { ok: false, reason: "not_a_repo", message: `${trimmed} is a file, not a folder.` };
  }
  if (existsSync(join(dir, ".git"))) return { ok: true, dir };

  const nested = findNestedGitRepos(dir);
  if (nested.length > 0) {
    return {
      ok: false,
      reason: "ambiguous",
      message: `${trimmed} holds ${nested.length} git ${nested.length === 1 ? "repo" : "repos"} — pick which one to add.`,
      candidates: nested,
    };
  }
  return { ok: false, reason: "not_a_repo", message: `${trimmed} is not a git repository.` };
}

/**
 * Validate, register, and (optionally) record the worker agent this project should
 * dispatch runs with by default. Never starts a daemon — that is the API/CLI caller's
 * job, kept separate so this stays fast and testable without spinning up a server.
 */
export function addProject(rawPath: string, opts: { worker_agent?: AdapterName } = {}): AddProjectResult | AddProjectRefused {
  const resolved = resolveProjectPath(rawPath);
  if (!resolved.ok) return resolved;
  const { dir } = resolved;

  let kind: WorkspaceKind;
  try {
    // resolveWorkspaceKind is the same check a dispatched run's worktree goes through —
    // reusing it means "added successfully" and "can actually run a brief" can never
    // disagree. It throws (rather than quietly sandboxing) when `.git` exists but git
    // itself is unhappy, which is exactly the class of failure AO's raw-stderr bug
    // belongs to; that thrown reason is passed straight through as the one-line message.
    kind = resolveWorkspaceKind(dir);
  } catch (error) {
    return { ok: false, reason: "git_trouble", message: (error as Error).message };
  }

  if (opts.worker_agent) writeDelegationConfig(dir, { default_agent: opts.worker_agent });
  const projects = rememberProject(dir);
  return { ok: true, dir, name: basename(dir) || dir, kind, projects };
}

/** Agents Kage can actually hire — installed on this machine, in preference order. */
export function installedAgents(): AdapterName[] {
  return ADAPTER_NAMES.filter((name): name is AdapterName => name !== "stub" && isAgentInstalled(name));
}
