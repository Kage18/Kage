// A NUL byte in a source file makes that file read as BINARY to grep, ripgrep, git diff and
// every code-review tool — they return nothing for any search over it, silently.
//
// This was not hypothetical. `mcp/vnext/workspace/server.ts` carried one literal NUL for
// months as the fallback in the workspace-deletion confirmation gate. While investigating an
// unrelated question I searched that file repeatedly, got zero hits for terms I could see with
// my own eyes in the editor, and concluded the code did not exist. The instruments that would
// catch a bad guard were blinded by the guard itself.
//
// One byte, one test, and the whole class is closed.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..");

/** Every text source git tracks. Binary assets are excluded by extension, not by guessing. */
function trackedSources(): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return out
    .split("\0")
    .filter(Boolean)
    .filter((path) => /\.(ts|tsx|js|mjs|cjs|json|css|md|yml|yaml|sql|sh)$/.test(path));
}

test("no tracked source file contains a NUL byte", () => {
  const offenders: string[] = [];
  for (const path of trackedSources()) {
    let buf: Buffer;
    try {
      buf = readFileSync(join(REPO_ROOT, path));
    } catch {
      continue; // a path removed between listing and reading is not a hygiene failure
    }
    if (buf.includes(0)) offenders.push(`${path} (first at byte ${buf.indexOf(0)})`);
  }

  assert.deepEqual(
    offenders,
    [],
    `these files read as BINARY to grep/ripgrep/git diff, so every search over them silently `
      + `returns nothing:\n  ${offenders.join("\n  ")}\n`
      + `Write the escape (\\u0000) inside a string instead of embedding the raw byte.`,
  );
});
