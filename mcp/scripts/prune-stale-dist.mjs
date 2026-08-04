// Delete compiled output in dist/ whose TypeScript source no longer exists.
//
// `tsc` never removes stale output. When a source file is deleted, its old .js lingers in dist/
// forever — and because the test script globs `dist/**/*.test.js`, a deleted test keeps running,
// asserting a contract the codebase retired. That is how dist/cloud-server.test.js survived the
// commit that cut the cloud server and failed the suite against the current help text.
//
// This runs as prebuild. It only removes files it can prove are orphaned: a dist/x.js with no
// x.ts beside it in the source tree. Generated directories that have no TypeScript source at all
// (dist/app, the bundled knowledge portal) are skipped wholesale.

import { readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const distRoot = join(pkgRoot, "dist");

// Emitted from a .ts source; anything else in dist/ is a copied asset we must not touch.
const COMPILED = [".js", ".js.map", ".d.ts", ".d.ts.map"];
// Directories under dist/ that are generated wholesale, not compiled from TypeScript.
const GENERATED_DIRS = new Set(["app"]);

function sourceFor(distFile) {
  const rel = relative(distRoot, distFile);
  for (const ext of COMPILED) {
    if (rel.endsWith(ext)) return join(pkgRoot, rel.slice(0, -ext.length) + ".ts");
  }
  return null;
}

const pruned = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (dir === distRoot && GENERATED_DIRS.has(entry)) continue;
      walk(full);
      continue;
    }
    const source = sourceFor(full);
    // No source mapping means it is not tsc output — leave it alone.
    if (!source) continue;
    if (existsSync(source)) continue;
    rmSync(full);
    pruned.push(relative(pkgRoot, full));
  }
}

if (existsSync(distRoot)) walk(distRoot);

if (pruned.length > 0) {
  console.log(`prune-stale-dist: removed ${pruned.length} orphaned build artifact(s):`);
  for (const p of pruned) console.log(`  ${p}`);
}
