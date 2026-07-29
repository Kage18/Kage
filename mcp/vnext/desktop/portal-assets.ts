// Resolving the built knowledge portal on disk, and the task id that joins a proxy session to its
// receipts.
//
// These live here — apart from `daemon.ts` and `anthropic-proxy.ts`, which is where they used to
// be — for one reason found by launching a packaged build: the desktop shell needs exactly these
// three functions, and requiring them from their old homes dragged in `kernel.js`, which requires
// `typescript`. The packaged app ships `mcp/dist` WITHOUT node_modules, so the whole thing died on
// launch with "Cannot find module 'typescript'" while working perfectly from a source checkout.
// That is the same class of fault that shipped a 404 portal to every npm user in 4.0.0.
//
// So: node builtins only, no imports from the rest of the tree. `daemon.ts` re-exports these, so
// there is still exactly ONE implementation — this is a move, not a copy.

import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { join, normalize, resolve } from "node:path";

/** True when `candidate` is inside `root` — the guard that stops a request escaping the bundle. */
function isInside(root: string, candidate: string): boolean {
  const base = resolve(root);
  const target = resolve(candidate);
  return target === base || target.startsWith(`${base}/`);
}

/**
 * Where the built knowledge portal lives, resolved from a base directory (the compiled core's own
 * directory at runtime).
 *
 * It ships INSIDE the npm package at `dist/app` (bundled from platform/web/dist at publish time);
 * a source checkout has no such bundle and serves straight from the monorepo build two levels up.
 * Prefer whichever actually has an index.html; when neither does, return the bundled path so
 * `/app/` yields a coherent portal_not_built 404 rather than pointing at a stray directory.
 *
 * Bundled-first exists because 4.0.0 shipped only the monorepo path — which does not exist in an
 * installed package — so `/app/` 404'd for every npm user while working from source.
 */
export function resolvePortalDir(baseDir: string): string {
  const bundled = resolve(baseDir, "app");
  const monorepo = resolve(baseDir, "..", "..", "platform", "web", "dist");
  for (const candidate of [bundled, monorepo]) {
    if (existsSync(join(candidate, "index.html"))) return candidate;
  }
  return bundled;
}

/**
 * Resolve an `/app/...` request to a file inside the built portal.
 *
 * Returns null for non-`/app` paths (the caller handles those). Real built assets resolve to
 * themselves; the entry and any client-side deep link (a path with no matching file) fall back to
 * `index.html` so History-API routing works; path traversal outside the build dir is refused by
 * falling back to the entry rather than escaping.
 */
export function resolveAppAsset(appDir: string, pathname: string): string | null {
  if (pathname !== "/app" && pathname !== "/app/" && !pathname.startsWith("/app/")) return null;
  const index = join(appDir, "index.html");
  if (pathname === "/app" || pathname === "/app/") return index;
  const candidate = join(appDir, normalize(pathname.replace(/^\/app\//, "")));
  if (!isInside(appDir, candidate)) return index; // never escape the build dir
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return index; // SPA fallback for client-side routes
}

/**
 * Stable per-(repo, session) task id, in the same shape the Claude adapter uses, so proxy receipts
 * and hook events can be attributed to the same task later.
 *
 * This is the join key the desktop app depends on: it chooses a session id, passes it to the proxy
 * as `KAGE_PROXY_SESSION_ID`, and can then name that session's task without guessing.
 */
export function proxyTaskId(projectRoot: string, sessionId: string): string {
  const digest = createHash("sha256").update(`${projectRoot}|${sessionId}`).digest("hex").slice(0, 32);
  return `task_${digest}`;
}
