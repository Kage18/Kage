// Pre-claim static checks — kernel-executed, never agent-declared. A hired agent cannot
// execute code in its own sandbox, so a narrowly declared check (or none at all) is not
// enough: two independent runs shipped `import.meta` into this CommonJS project (TS1470)
// and one shipped an under-escaped `\n` inside the app-client template literal that
// killed the ENTIRE browser script at parse time — every declared test passed, the app
// was blank. These two checks run automatically, in the run's own worktree, on every run,
// before the claim is judged. The agent has no say in whether they run.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import { staticChecksEnabled } from "./config.js";
import type { CheckOutcome, CheckResultKind } from "./contract.js";
import { spawnWithTreeKill, writeEvidence } from "./verify.js";

const STATIC_CHECK_TIMEOUT_MS = 120_000;
// "command not found" / "cannot execute" — the environment could not run the check at
// all. Never evidence that the agent's code is broken; same honesty contract verify.ts
// already applies to declared checks.
const NO_ENV_EXIT_CODES = new Set([126, 127]);
// A timeout is the same kind of "could not judge" as a missing interpreter: it says
// nothing about whether the code is actually broken, so it must never render as a fail.
const TIMEOUT_EXIT_CODE = 124;

// Repo-root-relative paths, matching what git.ts's stageAndMeasure reports — the composed
// page parse check always runs when any of these changed, regardless of whether tsc
// passed.
const APP_RENDERER_FILES = new Set([
  "mcp/delegation/app-client.ts",
  "mcp/delegation/app-html.ts",
  "mcp/delegation/app-styles.ts",
]);

export interface StaticCheckResult {
  checks: CheckOutcome[];
}

function resolveTsconfig(worktreeDir: string): string | null {
  if (existsSync(join(worktreeDir, "mcp", "tsconfig.json"))) return join("mcp", "tsconfig.json");
  if (existsSync(join(worktreeDir, "tsconfig.json"))) return "tsconfig.json";
  return null;
}

// A worktree that already has its own node_modules (the normal case once a repo's
// `setup` command has run) gets a direct, network-free binary invocation; only a
// worktree with no local install at all falls through to `npx` resolution.
function resolveTscCommand(worktreeDir: string, tsconfigRel: string): { cmd: string; args: string[]; label: string } {
  const localBin = join(worktreeDir, dirname(tsconfigRel), "node_modules", ".bin", "tsc");
  const args = ["--noEmit", "-p", tsconfigRel];
  if (existsSync(localBin)) return { cmd: localBin, args, label: `npx tsc ${args.join(" ")}` };
  return { cmd: "npx", args: ["tsc", ...args], label: `npx tsc ${args.join(" ")}` };
}

interface CommandResult {
  exitCode: number;
  output: string;
  /** True only when this call's own timeout fired and verify.ts's group sweep ran. */
  treeKilled: boolean;
}

// No shell, fixed argument arrays throughout — never a string built from worktree-derived
// paths handed to a shell for interpretation. Runs through verify.ts's spawnWithTreeKill so
// a hung tsc/node process tree gets the same group-kill fix declared checks get, rather
// than a second hand-rolled timeout path that could quietly drift from it.
function runCommand(cmd: string, args: string[], cwd: string): CommandResult {
  const spawned = spawnWithTreeKill(cmd, args, { cwd, maxBuffer: 16 * 1024 * 1024 }, STATIC_CHECK_TIMEOUT_MS);
  const exitCode = spawned.treeKilled
    ? TIMEOUT_EXIT_CODE
    : typeof spawned.status === "number"
      ? spawned.status
      : 1;
  // The success path only ever reported stdout (stderr silently dropped) before this fix
  // and still does — only a non-zero/timed-out outcome pulls stderr into the output too.
  const output = exitCode === 0 ? spawned.stdout : `${spawned.stdout}\n${spawned.stderr}`;
  return { exitCode, output, treeKilled: spawned.treeKilled };
}

function resultFor(exitCode: number): CheckResultKind {
  if (exitCode === 0) return "pass";
  if (exitCode === TIMEOUT_EXIT_CODE || NO_ENV_EXIT_CODES.has(exitCode)) return "unverified_no_env";
  return "fail";
}

function summarize(output: string, pattern: RegExp | undefined, max: number): string {
  const lines = output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const matched = pattern ? lines.filter((line) => pattern.test(line)) : [];
  return (matched.length ? matched : lines).slice(0, max).join("\n");
}

function writeCheckEvidence(
  projectDir: string,
  runId: string,
  id: string,
  cmdLabel: string,
  cwd: string,
  exitCode: number,
  output: string,
  treeKilled: boolean,
  errorPattern?: RegExp,
): string {
  const detail = summarize(output, errorPattern, 5) || "(no output)";
  const timeoutNote =
    exitCode === TIMEOUT_EXIT_CODE
      ? treeKilled
        ? ` (timeout after ${STATIC_CHECK_TIMEOUT_MS / 1000}s - process tree killed, not counted as a failure)`
        : ` (timeout after ${STATIC_CHECK_TIMEOUT_MS / 1000}s — could not judge, not counted as a failure)`
      : "";
  return writeEvidence(
    projectDir,
    runId,
    id,
    `$ ${cmdLabel}\n(cwd: ${cwd})\n\n${detail}\n\n--- exit code: ${exitCode}${timeoutNote} ---\n`,
  );
}

const TS_ERROR_PATTERN = /error TS\d+/;

function runTypecheck(projectDir: string, runId: string, worktreeDir: string, tsconfigRel: string): CheckOutcome {
  const { cmd, args, label } = resolveTscCommand(worktreeDir, tsconfigRel);
  const { exitCode, output, treeKilled } = runCommand(cmd, args, worktreeDir);
  const result = resultFor(exitCode);
  const evidence = writeCheckEvidence(projectDir, runId, "static-typecheck", label, worktreeDir, exitCode, output, treeKilled, TS_ERROR_PATTERN);
  return {
    id: "static-typecheck",
    kind: "command",
    cmd: label,
    expect: "exit code 0 (no `error TS` output)",
    result,
    exit_code: exitCode,
    evidence,
  };
}

// app-client.ts, app-styles.ts, and app-html.ts each self-document as one continuous
// template literal running from their `const NAME = \`` line to end of file (app-html.ts's
// own top-of-file GOTCHA comment states the invariant; delegation-api.test.ts's "emitted
// client script is syntactically valid" test already depends on it). Evaluating that
// slice — not just reading the .ts source as text — is what catches the actual bug class:
// a bare `\n` in app-client.ts parses as a real newline CHARACTER at the source level
// (perfectly valid TS on its own), and only becomes a broken script once that runtime
// string value is composed into the page and treated as browser JS. A pure text/regex
// read of the .ts files would never see it; only evaluating them the way Node itself
// would reproduces the bug.
function extractTrailingConst(source: string, name: string): string | null {
  const marker = new RegExp(`^(?:export )?const ${name} = `, "m");
  const match = marker.exec(source);
  if (!match) return null;
  return `const ${name} = ${source.slice(match.index + match[0].length)}`;
}

function composedAppHtml(worktreeDir: string): string | null {
  const dir = join(worktreeDir, "mcp", "delegation");
  const clientDecl = extractTrailingConst(readFileSync(join(dir, "app-client.ts"), "utf8"), "APP_CLIENT");
  const stylesDecl = extractTrailingConst(readFileSync(join(dir, "app-styles.ts"), "utf8"), "APP_STYLES");
  const htmlDecl = extractTrailingConst(readFileSync(join(dir, "app-html.ts"), "utf8"), "APP_HTML");
  if (!clientDecl || !stylesDecl || !htmlDecl) return null;
  const source = `${clientDecl}\n${stylesDecl}\n${htmlDecl}\nAPP_HTML;`;
  // A fresh, empty context — this only ever needs to evaluate three template-literal
  // declarations, never anything with a reason to touch the filesystem or network.
  return String(runInNewContext(source, {}, { timeout: 2000 }));
}

// The LAST <script> block with no `src` attribute — the inline client script, as opposed
// to the `<script src="...">` vendor tags the page also loads.
function lastInlineScript(html: string): string | null {
  const scriptTag = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  let last: string | null = null;
  while ((match = scriptTag.exec(html))) {
    const attrs = match[1] ?? "";
    if (!/\bsrc\s*=/.test(attrs)) last = match[2];
  }
  return last;
}

function runComposedPageCheck(projectDir: string, runId: string, worktreeDir: string): CheckOutcome {
  const expect = "valid JS (node --check on the composed inline <script>)";
  let html: string | null = null;
  let extractError: string | null = null;
  try {
    html = composedAppHtml(worktreeDir);
  } catch (error) {
    extractError = String(error);
  }
  const script = html !== null ? lastInlineScript(html) : null;
  if (script === null) {
    // Could not derive the composed script at all (missing file, unexpected shape). This
    // says nothing about whether the agent's code is broken — never a fail.
    const evidence = writeEvidence(
      projectDir,
      runId,
      "static-app-parse",
      `could not extract the composed inline <script> from app-html.ts — not counted as a failure\n${extractError ?? ""}\n`,
    );
    return { id: "static-app-parse", kind: "command", expect, result: "unverified_no_env", evidence };
  }
  const tmpDir = mkdtempSync(join(tmpdir(), "kage-static-check-"));
  const tmpFile = join(tmpDir, "composed-app.js");
  try {
    writeFileSync(tmpFile, script, "utf8");
    const { exitCode, output, treeKilled } = runCommand(process.execPath, ["--check", tmpFile], tmpDir);
    const result = resultFor(exitCode);
    const evidence = writeCheckEvidence(projectDir, runId, "static-app-parse", "node --check <composed inline script>", worktreeDir, exitCode, output, treeKilled);
    return { id: "static-app-parse", kind: "command", cmd: "node --check <composed inline script>", expect, result, exit_code: exitCode, evidence };
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // A leftover temp file is not worth failing the run over.
    }
  }
}

/**
 * Runs the pre-claim static checks in the run's own worktree: a TypeScript compile
 * (`tsc --noEmit`) and, when it matters, a parse check on the actually-composed client
 * script. Returns checks to be merged into the same list the agent's declared checks
 * produce — these are kernel-executed, attributed to Kage, and count toward the same
 * VERIFIED n/n line the receipt already renders.
 *
 * No-ops (returns no checks at all) when static checks are disabled via config, or when
 * the worktree has no tsconfig at all — a non-TypeScript repo must not have every run
 * fail a check that makes no sense for it.
 */
export function runStaticChecks(projectDir: string, runId: string, worktreeDir: string, changedPaths: string[]): StaticCheckResult {
  if (!staticChecksEnabled(projectDir)) return { checks: [] };
  const tsconfigRel = resolveTsconfig(worktreeDir);
  if (!tsconfigRel) return { checks: [] };

  const checks: CheckOutcome[] = [];
  const typecheck = runTypecheck(projectDir, runId, worktreeDir, tsconfigRel);
  checks.push(typecheck);

  // The parse check only makes sense for a repo that actually has the delegation app
  // renderer; skip it entirely (never a fail) when that file is not part of this repo.
  const hasAppRenderer = existsSync(join(worktreeDir, "mcp", "delegation", "app-html.ts"));
  const appRendererTouched = changedPaths.some((path) => APP_RENDERER_FILES.has(path));
  // Skip only when the app renderer was not touched AND tsc came back clean — any other
  // outcome (touched, or tsc could not confirm clean) always runs it.
  const skipParseCheck = !hasAppRenderer || (!appRendererTouched && typecheck.result === "pass");
  if (!skipParseCheck) checks.push(runComposedPageCheck(projectDir, runId, worktreeDir));

  return { checks };
}
