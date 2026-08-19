// README.md is a storefront that has drifted from the shipped product before (see
// positioning.test.ts, which pins the headline). This file guards the rest of the page:
// every `kage ...` command shown in a bash block must be one the CLI actually implements,
// every flag it shows must exist somewhere in the CLI source, the receipt quoted on the
// page must be byte-for-byte what the real renderer produces (not hand-typed art), and
// the package name/version README implies must match mcp/package.json.
//
// Revert this run's README changes and two things fail here: "the README shows the
// orchestrator's own commands in a bash block" (kage app / kage room / kage dispatch /
// kage runs / kage review / kage merge / kage projects add all disappear from fenced
// bash blocks) and "the quoted receipt matches what renderClaimCard actually renders"
// (the hand-typed VERIFIED card goes away with it).
//
// __dirname is mcp/dist/ at runtime (compiled test) — one ".." reaches sibling mcp/
// sources, two reaches the repo root. Same convention as positioning.test.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ClaimRecord } from "./delegation/contract.js";
import { renderClaimCard } from "./delegation/verify.js";

const mcpPath = (...parts: string[]) => join(__dirname, "..", ...parts);
const repoPath = (...parts: string[]) => join(__dirname, "..", "..", ...parts);

function readReadme(): string {
  return readFileSync(repoPath("README.md"), "utf8");
}

function readCliSource(): string {
  return readFileSync(mcpPath("cli.ts"), "utf8");
}

function bashBlocks(markdown: string): string[] {
  return [...markdown.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
}

// Top-level commands the CLI actually handles, the same pattern release.test.ts uses to
// check the help table against the real dispatch — proven against this exact file.
function implementedCommands(source: string): Set<string> {
  return new Set([...source.matchAll(/command === "([a-z-]+)"/g)].map((m) => m[1]));
}

// Whether a `kage <first> <second>` pair is a real two-word command (e.g. "projects add",
// "pr check") as opposed to a one-word command followed by a user-supplied example value
// (e.g. "setup claude-code", where the usage text's next token is the `<agent>`
// placeholder, not a literal word). Determined by looking at the first "kage <first> "
// occurrence in the source: if the token right after it is a literal lowercase word, the
// second word must appear verbatim somewhere as "kage <first> <second>"; if it's a
// placeholder/flag, any example value is accepted.
function twoWordCommandIsValid(source: string, first: string, second: string): boolean {
  const nextTokenMatch = source.match(new RegExp(`kage ${first} (\\S+)`));
  const nextToken = nextTokenMatch?.[1] ?? "";
  const nextTokenIsLiteralWord = /^[a-z][a-z0-9-]*$/.test(nextToken);
  if (!nextTokenIsLiteralWord) return true;
  return source.includes(`kage ${first} ${second}`);
}

function commandLineIsKnown(source: string, implemented: Set<string>, words: string): boolean {
  const [first, second] = words.split(" ");
  if (!implemented.has(first)) return false;
  if (!second) return true;
  return twoWordCommandIsValid(source, first, second);
}

test("every `kage ...` command shown in a README bash block exists in the CLI", () => {
  const source = readCliSource();
  const implemented = implementedCommands(source);
  assert.ok(implemented.size >= 20, `expected a real command set, found ${implemented.size}`);

  const readme = readReadme();
  const blocks = bashBlocks(readme);
  assert.ok(blocks.length >= 3, `expected several bash blocks in the README, found ${blocks.length}`);

  const seen: string[] = [];
  for (const block of blocks) {
    for (const rawLine of block.split("\n")) {
      const line = rawLine.replace(/#.*$/, "").trim();
      const match = line.match(/^kage ([a-z][a-z0-9-]*(?:\s[a-z][a-z0-9-]*)?)\b/);
      if (!match) continue;
      const words = match[1];
      seen.push(words);
      assert.ok(
        commandLineIsKnown(source, implemented, words),
        `README shows "kage ${words}" in a bash block but the CLI has no such command`,
      );
    }
  }
  assert.ok(seen.length >= 8, `expected several kage commands documented in bash blocks, found ${seen.length}`);
});

test("the README documents the orchestrator commands, not just the memory ones", () => {
  // The gap this run fixes: `kage app`, `kage room`, `kage dispatch`, `kage runs`,
  // `kage review`, `kage merge`, and `kage projects add` were not shown in any bash
  // block before this change, even though they are the product's differentiator.
  const readme = readReadme();
  const combined = bashBlocks(readme).join("\n");
  for (const command of ["kage app", "kage room", "kage dispatch", "kage runs", "kage review", "kage merge", "kage projects add"]) {
    assert.ok(combined.includes(command), `README bash blocks should show "${command}"`);
  }
});

test("every `--flag` shown alongside a README `kage` command exists in the CLI source", () => {
  const source = readCliSource();
  const readme = readReadme();
  const flags = new Set<string>();
  for (const block of bashBlocks(readme)) {
    for (const rawLine of block.split("\n")) {
      const line = rawLine.replace(/#.*$/, "").trim();
      if (!line.startsWith("kage ")) continue;
      for (const flagMatch of line.matchAll(/--[a-z][a-z-]*/g)) flags.add(flagMatch[0]);
    }
  }
  assert.ok(flags.size >= 3, `expected README kage lines to use several flags, found ${flags.size}`);
  for (const flag of flags) {
    assert.ok(source.includes(flag), `README uses "${flag}" on a kage command but it appears nowhere in cli.ts`);
  }
});

test("the receipt quoted in the README is byte-for-byte what renderClaimCard produces", () => {
  // Mirrors receipt.test.ts's VERIFIED_CLAIM fixture, itself a verbatim reproduction of a
  // real run's claim (build-a-stale-memory-triage-surface-do-n-260818-ec2c). Rendered here
  // independently so this test fails the moment the quoted receipt and the real renderer
  // disagree, whether because the README was hand-edited wrong or verify.ts's format changed.
  const claim: ClaimRecord = {
    schema_version: 1,
    run_id: "build-a-stale-memory-triage-surface-do-n-260818-ec2c",
    statement: "the stale-memory triage surface is built and wired into the review flow",
    checks: [
      { id: "tests", kind: "command", cmd: "npm test --prefix mcp", expect: "exit code 0", result: "pass", exit_code: 0, evidence: "evidence/tests.log" },
      { id: "diff-size", kind: "diff", expect: "at most 800 changed lines", result: "pass", evidence: "evidence/diff-size.log" },
      {
        id: "citations",
        kind: "citation",
        expect: "every formally cited path exists (directly, or as a unique suffix) in the worktree",
        result: "pass",
        evidence: "evidence/citations.log",
      },
    ],
    unsure: [],
    learnings: [],
    protocol_ok: true,
    diff: { files: 4, lines: 212 },
    created_at: "2026-08-18T16:34:01.294Z",
  };

  const card = renderClaimCard(claim, { budget: 800 });
  const readme = readReadme();
  assert.ok(
    readme.includes(card),
    "the README's quoted receipt no longer matches renderClaimCard's real output — re-render it and re-quote verbatim",
  );
});

test("the README's package name matches mcp/package.json", () => {
  const pkg = JSON.parse(readFileSync(mcpPath("package.json"), "utf8")) as { name: string; version: string };
  const readme = readReadme();
  assert.ok(readme.includes(pkg.name), `README should reference the real package name "${pkg.name}"`);

  // No version literal is expected in README today (it uses a live npm shields badge
  // instead) — but if one is ever added, it must not silently drift from package.json.
  const versionLiterals = [...readme.matchAll(/\bv?(\d+\.\d+\.\d+)\b/g)]
    .map((m) => m[1])
    .filter((v) => v !== pkg.version);
  assert.deepEqual(versionLiterals, [], `README names a version that disagrees with mcp/package.json (${pkg.version})`);
});
