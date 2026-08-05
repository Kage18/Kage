import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// A command that runs but appears in no help output is a command nobody can find.
//
// `kage okf` was exactly that for an unknown stretch: four working subcommands (since deleted),
// referenced by this
// repo's own CLAUDE.md, absent from `kage help --all`. `audit-log`, `memory-handoff`, and a dozen
// other aliases were the same. You could only learn they existed by reading cli.ts.
//
// This test closes that door: every command the CLI dispatches must be reachable from either the
// full reference or the legacy map. Adding a command and forgetting to document it now fails CI
// rather than quietly shipping.

// dist/cli-discoverability.test.js -> mcp/ (the build emits CommonJS, so __dirname is available)
const mcpRoot = join(__dirname, "..");
const cliJs = join(mcpRoot, "dist", "cli.js");
const cliTs = join(mcpRoot, "cli.ts");

/**
 * Meta-commands that are their own discovery mechanism. Exempting these is not a loophole for
 * "commands I did not feel like documenting" — it is exactly the two verbs whose whole job is to
 * print the lists this test checks against.
 */
const SELF_EVIDENT = new Set(["help", "legacy"]);

function run(...args: string[]): string {
  try {
    return execFileSync(process.execPath, [cliJs, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    // Some help verbs exit non-zero; their stdout is still the thing under test.
    const out = (error as { stdout?: string }).stdout;
    if (typeof out === "string" && out) return out;
    throw error;
  }
}

/** Every command string the CLI actually dispatches on. */
function dispatchedCommands(): string[] {
  const source = readFileSync(cliTs, "utf8");
  const found = new Set<string>();
  for (const match of source.matchAll(/command === "([a-z0-9-]+)"/g)) found.add(match[1]);
  return [...found].sort();
}

test("the CLI dispatches a non-trivial number of commands (guards the parser itself)", () => {
  // If the regex above ever stops matching, every other assertion here passes vacuously.
  assert.ok(dispatchedCommands().length > 50, `expected a large command surface, got ${dispatchedCommands().length}`);
});

test("every dispatched command is discoverable in help or the legacy map", () => {
  const documented = `${run("help", "--all")}\n${run("legacy", "--help")}`;
  const missing = dispatchedCommands()
    .filter((command) => !SELF_EVIDENT.has(command))
    .filter((command) => !new RegExp(`(^|\\s)kage ${command}(\\s|$)`, "m").test(documented));

  assert.deepEqual(
    missing,
    [],
    `these commands run but appear in no help output, so a user can only find them by reading cli.ts:\n  ${missing.join("\n  ")}`,
  );
});

// The `kage okf` command tree was deleted (DIRECTION.md kill list: no third-party consumer ever
// read a bundle, and the "lossless" round trip doubled every packet). Its named canary went with
// it; the general guard above still covers every command that IS dispatched.

// The three tests below guard the OTHER direction, which only became a failure mode when the
// short help stopped being a near-complete list.
//
// `kage` and `kage --help` used to print most of the surface, so "documented" and "promised on
// the front page" were one set and one guard covered both. They are two sets now: the front page
// is hand-curated down to the core, and a hand-curated list can promise a verb that was renamed,
// misspelled, or never existed — with nothing to catch it but a new user typing it and getting
// `usage`. It can also creep back to 131 lines one reasonable-looking addition at a time, which
// is precisely how it got there the first time.

/** What `kage` with no arguments prints — the curated front page. It exits 1; run() keeps stdout. */
function shortHelp(): string {
  return run();
}

test("every command the short help promises is a command the CLI dispatches", () => {
  const dispatched = new Set(dispatchedCommands());
  const promised = new Set([...shortHelp().matchAll(/kage ([a-z][a-z0-9-]*)/g)].map((match) => match[1]));
  const phantom = [...promised].filter((command) => !dispatched.has(command)).sort();

  assert.deepEqual(
    phantom,
    [],
    `the front page names commands the CLI does not dispatch, so the first thing a new user types fails:\n  ${phantom.join("\n  ")}`,
  );
});

test("the short help leads with cards and points at the reference for everything else", () => {
  const short = shortHelp();
  // Cards are the product (DIRECTION.md). A front page that buries them is the state this
  // collapse was undoing, not a cosmetic preference.
  assert.match(short, /kage cards/, "`kage cards` must be on the front page");
  assert.match(short, /kage help --all/, "the front page must say where the other ~120 commands live");
});

test("the short help stays a core, not a second copy of the reference", () => {
  const short = shortHelp();
  // A sample of the long tail, one per section of `help --all`. These are not forbidden forever —
  // they are the canaries: if any of them is back on the front page, the grouping has been
  // re-flattened and the reference and the core have merged again.
  for (const buried of ["kage benchmark", "kage graph-insights", "kage slots", "kage workspace"]) {
    assert.ok(!short.includes(buried), `${buried} belongs in \`kage help --all\`, not in the short help`);
  }
  // A ceiling on ceremony rather than a measurement: the point of the front page is that it can
  // be read before choosing, and nothing readable in one screen needs eighty lines.
  const lines = short.split("\n").length;
  assert.ok(lines <= 50, `the short help is ${lines} lines; it is meant to be readable at a glance`);
});
