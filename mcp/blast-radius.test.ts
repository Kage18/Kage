import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { blastRadiusFor } from "./delegation/blast-radius.js";

function project(): string {
  return mkdtempSync(join(tmpdir(), "kage-blast-"));
}

function writeImports(dir: string, edges: Array<{ from_path: string; to_path: string | null }>): void {
  mkdirSync(join(dir, ".agent_memory", "structural"), { recursive: true });
  writeFileSync(join(dir, ".agent_memory", "structural", "imports.json"), JSON.stringify(edges), "utf8");
}

test("counts the files that import what changed, excluding the change itself", () => {
  const dir = project();
  writeImports(dir, [
    { from_path: "src/a.ts", to_path: "src/core.ts" },
    { from_path: "src/b.ts", to_path: "src/core.ts" },
    { from_path: "src/c.ts", to_path: "src/core.ts" },
    // The run also edited helper.ts, and core imports it — intra-change, not blast.
    { from_path: "src/core.ts", to_path: "src/helper.ts" },
    // External package edges have to_path null and must be ignored.
    { from_path: "src/a.ts", to_path: null },
  ]);
  const blast = blastRadiusFor(dir, ["src/core.ts", "src/helper.ts"]);
  assert.ok(blast);
  assert.equal(blast.dependents, 3);
  assert.deepEqual(blast.sample, ["src/a.ts", "src/b.ts", "src/c.ts"]);
});

test("a leaf file reports zero dependents — a real measured zero, not an invented one", () => {
  const dir = project();
  writeImports(dir, [{ from_path: "src/a.ts", to_path: "src/core.ts" }]);
  const blast = blastRadiusFor(dir, ["docs/README.md"]);
  assert.ok(blast, "the index exists and answered — zero is a measurement here");
  assert.equal(blast.dependents, 0);
});

test("no index means NO ANSWER, never a reassuring zero", () => {
  const dir = project(); // .agent_memory/structural never created
  assert.equal(blastRadiusFor(dir, ["src/core.ts"]), null);
});

test("no changed paths (an old claim) means no answer", () => {
  const dir = project();
  writeImports(dir, [{ from_path: "src/a.ts", to_path: "src/core.ts" }]);
  assert.equal(blastRadiusFor(dir, []), null);
});

test("a torn index degrades to no answer instead of throwing", () => {
  const dir = project();
  mkdirSync(join(dir, ".agent_memory", "structural"), { recursive: true });
  writeFileSync(join(dir, ".agent_memory", "structural", "imports.json"), "{ not json", "utf8");
  assert.equal(blastRadiusFor(dir, ["src/core.ts"]), null);
});

test("the cache refreshes when the index is rewritten", () => {
  const dir = project();
  writeImports(dir, [{ from_path: "src/a.ts", to_path: "src/core.ts" }]);
  assert.equal(blastRadiusFor(dir, ["src/core.ts"])!.dependents, 1);
  // Rewrite with more edges and a bumped mtime; the cached map must not survive.
  const future = new Date(Date.now() + 5000);
  writeImports(dir, [
    { from_path: "src/a.ts", to_path: "src/core.ts" },
    { from_path: "src/b.ts", to_path: "src/core.ts" },
  ]);
  utimesSync(join(dir, ".agent_memory", "structural", "imports.json"), future, future);
  assert.equal(blastRadiusFor(dir, ["src/core.ts"])!.dependents, 2);
});
