// The store manifest (.agent_memory/store/manifest.json) and openStore(),
// the one door M2/M3 use to get a StoreBackend. See
// docs/design/MEMORY_STORE.md, "(a) A StoreBackend seam" -- "A manifest
// ... records which backend is active and a schema version."

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { JsonStoreBackend } from "./json.js";
import { detect, SqliteStoreBackend, type RequireFn } from "./sqlite.js";
import type { BackendKind, StoreBackend } from "./types.js";

export interface StoreManifest {
  schema_version: number;
  active_backend: BackendKind;
  // When set, openStore() uses this backend regardless of detect() --
  // the escape hatch for "roll back to JSON" the design's Law 2 promises,
  // and what lets `kage store rebuild --backend json` (M2) force a choice.
  forced_backend: BackendKind | null;
  counts: Record<string, number>;
  last_rebuild_at: string | null;
}

const MANIFEST_SCHEMA_VERSION = 1;

export function manifestPath(projectDir: string): string {
  return join(projectDir, ".agent_memory", "store", "manifest.json");
}

function defaultManifest(activeBackend: BackendKind): StoreManifest {
  return { schema_version: MANIFEST_SCHEMA_VERSION, active_backend: activeBackend, forced_backend: null, counts: {}, last_rebuild_at: null };
}

export function readManifest(projectDir: string): StoreManifest | null {
  const path = manifestPath(projectDir);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as StoreManifest;
  } catch {
    return null;
  }
}

export function writeManifest(projectDir: string, manifest: StoreManifest): void {
  const path = manifestPath(projectDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export interface OpenStoreOptions {
  /** Overrides the manifest's forced_backend for this call only; does not persist. */
  forceBackend?: BackendKind;
  /** Injectable in place of require(), so tests can simulate node:sqlite being absent. */
  requireFn?: RequireFn;
}

export interface OpenStoreResult {
  backend: StoreBackend;
  manifest: StoreManifest;
}

/**
 * The only door M2/M3 use to get a StoreBackend. Picks SqliteStoreBackend
 * when node:sqlite is feature-detected as available (mcp/store/sqlite.ts's
 * detect()) and nothing forces JSON; otherwise picks JsonStoreBackend.
 * A forced backend -- via `opts.forceBackend` or a persisted
 * `manifest.forced_backend` -- always wins over detection, in that order.
 * Opens the chosen backend, migrates it, updates and persists the
 * manifest's `active_backend`, and returns both.
 */
export function openStore(projectDir: string, opts: OpenStoreOptions = {}): OpenStoreResult {
  const existing = readManifest(projectDir);
  const forced = opts.forceBackend ?? existing?.forced_backend ?? null;
  const detection = detect(opts.requireFn);
  const kind: BackendKind = forced ?? (detection.available ? "sqlite" : "json");

  const backend: StoreBackend = kind === "sqlite" ? new SqliteStoreBackend(opts.requireFn) : new JsonStoreBackend();
  backend.open(projectDir);

  const manifest: StoreManifest = {
    ...(existing ?? defaultManifest(kind)),
    schema_version: MANIFEST_SCHEMA_VERSION,
    active_backend: kind,
    forced_backend: existing?.forced_backend ?? null,
  };
  writeManifest(projectDir, manifest);
  return { backend, manifest };
}
