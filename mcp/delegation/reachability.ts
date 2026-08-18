// Reachability check — kernel-executed, never agent-declared. Every static check that
// came before this one (tsc, the composed-page parse) asks "does the code compile and
// parse"; none of them ask "does anything real ever call it". Seven separate runs shipped
// green — compiled, tested, merged — while landing code nothing on a real entry point
// could ever reach: an orphaned state-machine transition, a struct field written by one
// process and read by another that never received the write, helper functions with zero
// callers. Every one of those tests passed because the test called the new symbol
// DIRECTLY or patched a field by hand, which proves the code runs, never that anything
// real would ever run it. This module answers that second question by building a
// reference graph from mcp/**/*.ts and computing what is actually reachable from the
// product's real entry points (mcp/cli.ts, mcp/index.ts, mcp/daemon.ts,
// mcp/delegation/api.ts, and any `bin` target in mcp/package.json) — never "something,
// somewhere, imports it".
//
// This is a heuristic, regex-based scan, not a type-checker: it has no import
// resolution, so two unrelated symbols that happen to share a name are treated as the
// same node (a deliberate bias toward fewer false positives — see the "never hard-fail"
// note on runReachabilityCheck below). It is good enough to catch the exact defect class
// it was built for, not a substitute for a real language server.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { CheckOutcome } from "./contract.js";
import { writeEvidence } from "./verify.js";

export type OrphanRule = "orphan-export" | "write-only-field" | "read-only-field";

export interface OrphanFinding {
  symbol: string;
  file: string;
  line: number;
  rule: OrphanRule;
  detail: string;
}

// A symbol or field with this comment on the line directly above it is deliberate public
// API, not rot — but the marker must carry an actual reason, or the exemption becomes the
// next version of the same hole (an unexplained escape hatch nobody has to justify).
const EXEMPTION_MARKER = /^\s*\/\/\s*reachability:\s*(.*)$/;

function exemptionReason(lines: string[], declLineIndex0: number): string | undefined {
  const prev = lines[declLineIndex0 - 1];
  if (prev === undefined) return undefined;
  const match = EXEMPTION_MARKER.exec(prev);
  if (!match) return undefined;
  const reason = match[1].trim();
  return reason.length > 0 ? reason : undefined;
}

function walkTsFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const path = join(root, entry);
    let stats;
    try {
      stats = statSync(path);
    } catch {
      continue;
    }
    if (stats.isDirectory()) out.push(...walkTsFiles(path));
    else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) out.push(path);
  }
  return out.sort();
}

function isTestFile(relPath: string): boolean {
  return relPath.endsWith(".test.ts");
}

type ScopeKind = "function" | "const" | "class" | "interface" | "type";

interface Scope {
  name: string;
  kind: ScopeKind;
  exported: boolean;
  file: string;
  startLine: number; // 1-indexed
  endLine: number; // 1-indexed, inclusive
  exemptReason?: string;
  // 0-indexed column, within the RAW startLine, where the declared name itself begins.
  // Lets the reference scan skip only the declaration's own name token on its own header
  // line (e.g. the `RunState` in `export type RunState = (typeof RUN_STATES)[number];`)
  // instead of blanket-skipping the whole line, which used to hide a real reference
  // (`RUN_STATES`) sitting right next to the declaration on the same line.
  nameColumn: number;
}

interface ParsedFile {
  file: string;
  lines: string[];
  scopes: Scope[];
  lineOwner: (string | null)[]; // 0-indexed, owning scope name (if any)
  isImportLine: boolean[]; // 0-indexed
}

// The `d` flag (match indices) lets parseFile recover exactly where the captured name
// starts within the matched (trimmed) line, so it can be mapped back to a column in the
// raw line — see Scope.nameColumn.
const DECL_PATTERNS: Array<{ re: RegExp; kind: ScopeKind; exported: boolean }> = [
  { re: /^export\s+default\s+async\s+function\s+([A-Za-z_$][\w$]*)/d, kind: "function", exported: true },
  { re: /^export\s+default\s+function\s+([A-Za-z_$][\w$]*)/d, kind: "function", exported: true },
  { re: /^export\s+async\s+function\s+([A-Za-z_$][\w$]*)/d, kind: "function", exported: true },
  { re: /^export\s+function\s+([A-Za-z_$][\w$]*)/d, kind: "function", exported: true },
  { re: /^async\s+function\s+([A-Za-z_$][\w$]*)/d, kind: "function", exported: false },
  { re: /^function\s+([A-Za-z_$][\w$]*)/d, kind: "function", exported: false },
  { re: /^export\s+const\s+([A-Za-z_$][\w$]*)/d, kind: "const", exported: true },
  { re: /^const\s+([A-Za-z_$][\w$]*)/d, kind: "const", exported: false },
  { re: /^export\s+class\s+([A-Za-z_$][\w$]*)/d, kind: "class", exported: true },
  { re: /^class\s+([A-Za-z_$][\w$]*)/d, kind: "class", exported: false },
  { re: /^export\s+interface\s+([A-Za-z_$][\w$]*)/d, kind: "interface", exported: true },
  { re: /^interface\s+([A-Za-z_$][\w$]*)/d, kind: "interface", exported: false },
  { re: /^export\s+type\s+([A-Za-z_$][\w$]*)/d, kind: "type", exported: true },
  { re: /^type\s+([A-Za-z_$][\w$]*)/d, kind: "type", exported: false },
];

// Blanks a template literal's LITERAL TEXT while leaving each `${...}` substitution's code
// untouched (including any template literal nested inside it, to arbitrary depth) — so a
// symbol referenced only inside an interpolation (e.g. `` `protocol: ${CLAIM_PROTOCOL_VERSION}` ``)
// still counts as a reference, and a nested template inside a substitution (e.g.
// `` `${cond ? `a` : `b`}` ``) does not throw off brace-depth counting for the rest of the
// file. A naive "pair up consecutive backticks" strip mis-pairs on that nested case: it
// swallows the outer `${` along with real code, both erasing genuine references and
// producing an unbalanced brace count that can prematurely end an enclosing function's
// scope (everything after reads as ownerless, so a real reference inside it looks
// unreachable). Falls back to returning the line untouched if backticks never balance
// (a genuine multi-line, non-EOF template — rare, and not this scanner's job to solve;
// the untouched braces get counted as-is, matching this module's existing conservative
// fallback for anything it can't fully parse).
function stripTemplateLiteralText(line: string): string {
  const stack: Array<"tmpl" | "expr"> = [];
  const exprBraceDepth: number[] = []; // parallel to "expr" frames: extra {} nesting within that substitution
  let out = "";
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    const top = stack[stack.length - 1];
    if (top === "tmpl") {
      if (ch === "\\") {
        out += "  ";
        i += 2;
        continue;
      }
      if (ch === "`") {
        stack.pop();
        out += ch;
        i += 1;
        continue;
      }
      if (ch === "$" && line[i + 1] === "{") {
        stack.push("expr");
        exprBraceDepth.push(0);
        out += "${";
        i += 2;
        continue;
      }
      out += " ";
      i += 1;
      continue;
    }
    if (ch === "`") {
      stack.push("tmpl");
      out += ch;
      i += 1;
      continue;
    }
    if (top === "expr") {
      if (ch === "{") {
        exprBraceDepth[exprBraceDepth.length - 1] += 1;
        out += ch;
        i += 1;
        continue;
      }
      if (ch === "}") {
        const depth = exprBraceDepth[exprBraceDepth.length - 1];
        if (depth === 0) {
          stack.pop();
          exprBraceDepth.pop();
        } else {
          exprBraceDepth[exprBraceDepth.length - 1] = depth - 1;
        }
        out += ch;
        i += 1;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return stack.length === 0 ? out : line;
}

// Strips string/template/comment content so brace-counting does not trip over a brace
// that only exists inside a literal (e.g. a JSON.stringify template or a URL comment),
// while keeping real code that lives inside a template substitution intact.
function stripForBraceCounting(line: string): string {
  let stripped = line.replace(/(?<!:)\/\/.*$/, "");
  stripped = stripped.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  stripped = stripped.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  return stripTemplateLiteralText(stripped);
}

function braceDelta(strippedLine: string): number {
  let delta = 0;
  for (const ch of strippedLine) {
    if (ch === "{" || ch === "(" || ch === "[") delta += 1;
    else if (ch === "}" || ch === ")" || ch === "]") delta -= 1;
  }
  return delta;
}

function parseFile(file: string, source: string): ParsedFile {
  const lines = source.split("\n");
  const scopes: Scope[] = [];
  const lineOwner: (string | null)[] = new Array(lines.length).fill(null);
  const isImportLine: boolean[] = new Array(lines.length).fill(false);

  let depth = 0;
  let currentScope: Scope | null = null;
  let templateLiteralToEof = false;
  let inImportBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (templateLiteralToEof) {
      if (currentScope) {
        currentScope.endLine = i + 1;
        lineOwner[i] = currentScope.name;
      }
      continue;
    }

    // Multi-line import blocks (`import {\n  a,\n  b,\n} from "...";`) are never a real
    // reference — merely importing a name is not evidence anything calls it.
    if (depth === 0 && !inImportBlock && /^import\b/.test(trimmed)) {
      inImportBlock = !/;\s*$/.test(trimmed) && !/^import\s*\(/.test(trimmed);
      isImportLine[i] = true;
      continue;
    }
    if (inImportBlock) {
      isImportLine[i] = true;
      if (/;\s*$/.test(trimmed) || /}\s*from\s+["'][^"']*["'];?\s*$/.test(trimmed)) inImportBlock = false;
      continue;
    }

    if (depth === 0) {
      let matched = false;
      for (const pattern of DECL_PATTERNS) {
        const m = pattern.re.exec(trimmed) as (RegExpExecArray & { indices?: Array<[number, number] | undefined> }) | null;
        if (!m) continue;
        // trimStart (not full trim) is what shifted the match's offsets away from `raw` —
        // trailing whitespace trimEnd removed never affects a start offset.
        const leadingWs = raw.length - raw.trimStart().length;
        const nameColumn = leadingWs + (m.indices?.[1]?.[0] ?? raw.indexOf(m[1]));
        const scope: Scope = {
          name: m[1],
          kind: pattern.kind,
          exported: pattern.exported,
          file,
          startLine: i + 1,
          endLine: i + 1,
          exemptReason: exemptionReason(lines, i),
          nameColumn,
        };
        scopes.push(scope);
        currentScope = scope;
        matched = true;
        // A top-level const that opens an unclosed template literal on its own
        // declaration line documents itself (per app-client.ts/app-html.ts/
        // app-styles.ts's own invariant) as running to end of file.
        const rawBacktickCount = (raw.match(/`/g) ?? []).length;
        if (pattern.kind === "const" && /`\s*$/.test(raw.trimEnd()) && rawBacktickCount % 2 === 1) {
          templateLiteralToEof = true;
        }
        break;
      }
      if (!matched) {
        // Not a new declaration and not inside one: a blank line, comment, or a bare
        // top-level statement (e.g. root-file dispatch code that runs at module scope).
        lineOwner[i] = null;
      }
    }

    if (currentScope) lineOwner[i] = currentScope.name;

    const stripped = stripForBraceCounting(raw);
    depth += braceDelta(stripped);
    if (depth < 0) depth = 0;

    if (currentScope) {
      currentScope.endLine = i + 1;
      if (depth === 0) currentScope = null;
    }
  }

  return { file, lines, scopes, lineOwner, isImportLine };
}

function toRepoRelative(projectDir: string, absPath: string): string {
  return relative(projectDir, absPath).split("\\").join("/");
}

function resolveRootFiles(projectDir: string, mcpRoot: string): Set<string> {
  const roots = new Set<string>(["mcp/cli.ts", "mcp/index.ts", "mcp/daemon.ts", "mcp/delegation/api.ts"]);
  const pkgPath = join(mcpRoot, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { bin?: Record<string, string> | string };
      const binEntries = typeof pkg.bin === "string" ? [pkg.bin] : Object.values(pkg.bin ?? {});
      for (const entry of binEntries) {
        // dist/cli.js -> mcp/cli.ts — the same convention static-checks.ts's own
        // tsconfig resolution relies on (a compiled dist mirrors the mcp/ source tree).
        const srcCandidate = entry.replace(/^dist\//, "mcp/").replace(/\.js$/, ".ts");
        if (existsSync(join(projectDir, srcCandidate))) roots.add(srcCandidate);
      }
    } catch {
      // A malformed package.json falls back to the hardcoded root set — never fatal.
    }
  }
  return new Set([...roots].filter((root) => existsSync(join(projectDir, root))));
}

const TOKEN_RE = /[A-Za-z_$][\w$]*/g;

// Every symbol-name token on a line with its column, used both to seed direct root
// reachability and to build the reference graph between declared scopes. Positions matter:
// a declaration's header line must exclude only the declared name's OWN occurrence, not
// every occurrence of every token on that line (see nameColumn on Scope).
function tokensOf(line: string): Array<{ token: string; column: number }> {
  const out: Array<{ token: string; column: number }> = [];
  for (const m of line.matchAll(TOKEN_RE)) out.push({ token: m[0], column: m.index });
  return out;
}

interface Reference {
  file: string;
  line: number;
  ownerName: string | null;
  isTest: boolean;
}

interface AnalysisResult {
  parsedByFile: Map<string, ParsedFile>;
  declByName: Map<string, Scope[]>;
  refsByName: Map<string, Reference[]>;
  reachable: Set<string>;
  rootFiles: Set<string>;
}

function analyze(projectDir: string, mcpRoot: string): AnalysisResult {
  const absFiles = walkTsFiles(mcpRoot);
  const parsedByFile = new Map<string, ParsedFile>();
  const declByName = new Map<string, Scope[]>();

  for (const abs of absFiles) {
    const relPath = toRepoRelative(projectDir, abs);
    let source: string;
    try {
      source = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const parsed = parseFile(relPath, source);
    parsedByFile.set(relPath, parsed);
    for (const scope of parsed.scopes) {
      const list = declByName.get(scope.name) ?? [];
      list.push(scope);
      declByName.set(scope.name, list);
    }
  }

  const rootFiles = resolveRootFiles(projectDir, mcpRoot);
  const refsByName = new Map<string, Reference[]>();
  // `${file}:${line}` -> the declared name and column that line's own header introduces.
  // Used to skip only that one self-referencing token, never the rest of the line — a
  // one-line declaration like `export type RunState = (typeof RUN_STATES)[number];` both
  // declares RunState AND genuinely references RUN_STATES; blanket-skipping the whole line
  // used to hide that second, real reference.
  const declHeaderAnchor = new Map<string, { name: string; column: number }>();
  for (const list of declByName.values()) {
    for (const scope of list) declHeaderAnchor.set(`${scope.file}:${scope.startLine}`, { name: scope.name, column: scope.nameColumn });
  }

  const rootDirect = new Set<string>();

  for (const [file, parsed] of parsedByFile) {
    const isRoot = rootFiles.has(file);
    const isTest = isTestFile(file);
    for (let i = 0; i < parsed.lines.length; i++) {
      if (parsed.isImportLine[i]) continue;
      const stripped = stripForBraceCounting(parsed.lines[i]);
      const anchor = declHeaderAnchor.get(`${file}:${i + 1}`);
      for (const { token, column } of tokensOf(stripped)) {
        if (!declByName.has(token)) continue;
        if (anchor && anchor.name === token && anchor.column === column) continue; // the decl's own name, not a reference
        const list = refsByName.get(token) ?? [];
        list.push({ file, line: i + 1, ownerName: parsed.lineOwner[i], isTest });
        refsByName.set(token, list);
        if (isRoot && !isTest) rootDirect.add(token);
      }
    }
  }

  // BFS from every symbol directly named in a root file, expanding through each
  // reachable symbol's own body (its scope's references), production files only — a
  // test file exercising a symbol directly is never evidence anything real reaches it.
  // refsByName is keyed by the REFERENCED symbol, not the referencing owner, so each
  // step walks it from the other direction: for every not-yet-reachable symbol `next`,
  // if any of its non-test references has an ownerName already known reachable, `next`
  // becomes reachable too.
  const reachable = new Set<string>(rootDirect);
  const queue = [...rootDirect];
  const visitedOwners = new Set<string>();
  while (queue.length) {
    const name = queue.shift()!;
    if (visitedOwners.has(name)) continue;
    visitedOwners.add(name);
    for (const [next, refs] of refsByName) {
      if (reachable.has(next)) continue;
      const calledFromReachableOwner = refs.some((ref) => !ref.isTest && ref.ownerName === name);
      if (calledFromReachableOwner) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }

  return { parsedByFile, declByName, refsByName, reachable, rootFiles };
}

// RULE A — an export from a changed file that nothing on a real entry point reaches,
// transitively, is dead on arrival: it exists, it may even be unit-tested, but no path
// from cli.ts/index.ts/daemon.ts/api.ts (or a package.json bin target) ever calls it.
function findOrphanExports(analysis: AnalysisResult, changedFiles: Set<string>): OrphanFinding[] {
  const findings: OrphanFinding[] = [];
  for (const [file, parsed] of analysis.parsedByFile) {
    if (!changedFiles.has(file) || isTestFile(file)) continue;
    for (const scope of parsed.scopes) {
      if (!scope.exported || (scope.kind !== "function" && scope.kind !== "const" && scope.kind !== "class")) continue;
      if (scope.exemptReason) continue;
      if (analysis.reachable.has(scope.name)) continue;

      const refs = analysis.refsByName.get(scope.name) ?? [];
      const prodRefs = refs.filter((ref) => !ref.isTest);
      const testRefs = refs.filter((ref) => ref.isTest);
      let detail: string;
      if (!refs.length) {
        detail = "no references anywhere in mcp/**/*.ts — nothing calls it, production or test";
      } else if (!prodRefs.length) {
        detail = `only referenced by test file(s) (e.g. ${testRefs[0].file}:${testRefs[0].line}) — never in production code`;
      } else {
        const example = prodRefs[0];
        detail = `referenced only from unreachable code (e.g. ${example.file}:${example.line}) — the referencing symbol is itself not reachable from a real entry point`;
      }
      findings.push({ symbol: scope.name, file: scope.file, line: scope.startLine, rule: "orphan-export", detail });
    }
  }
  return findings;
}

const FIELD_LINE = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??:\s*[^(]/;
const WRITE_DOT_ASSIGN = (name: string) => new RegExp(`\\.${name}\\s*=(?!=)`);
const WRITE_COLON_LITERAL = (name: string) => new RegExp(`\\b${name}\\s*:`);
const READ_DOT_ACCESS = (name: string) => new RegExp(`\\.${name}\\b(?!\\s*=(?!=))`);

function isWithinScopeKind(analysis: AnalysisResult, file: string, line: number, kinds: ScopeKind[]): boolean {
  const parsed = analysis.parsedByFile.get(file);
  if (!parsed) return false;
  return parsed.scopes.some((scope) => kinds.includes(scope.kind) && line >= scope.startLine && line <= scope.endLine);
}

// RULE B — a field only ever written (never read outside its own declaration) or only
// ever read (never written outside a test) is exactly as dead as an unreached function:
// the supervisor_pid case, where the write existed but the one call path that mattered
// never made it, so the read was permanently starved of the value it depended on.
function findOrphanFields(analysis: AnalysisResult, changedFiles: Set<string>): OrphanFinding[] {
  const findings: OrphanFinding[] = [];
  for (const [file, parsed] of analysis.parsedByFile) {
    if (!changedFiles.has(file) || isTestFile(file)) continue;
    for (const scope of parsed.scopes) {
      if (scope.kind !== "interface") continue;
      const seen = new Set<string>();
      for (let ln = scope.startLine; ln <= scope.endLine; ln++) {
        const raw = parsed.lines[ln - 1];
        if (raw === undefined) continue;
        const m = FIELD_LINE.exec(raw);
        if (!m) continue;
        const fieldName = m[1];
        if (seen.has(fieldName)) continue;
        seen.add(fieldName);
        const fieldExempt = exemptionReason(parsed.lines, ln - 1);
        if (fieldExempt) continue;

        const readers: Reference[] = [];
        const writers: Reference[] = [];
        for (const [otherFile, otherParsed] of analysis.parsedByFile) {
          if (isTestFile(otherFile)) continue;
          for (let i = 0; i < otherParsed.lines.length; i++) {
            if (otherFile === file && i + 1 === ln) continue; // the field's own declaration
            if (isWithinScopeKind(analysis, otherFile, i + 1, ["interface", "type"])) continue;
            const raw2 = otherParsed.lines[i];
            const stripped = stripForBraceCounting(raw2);
            if (!new RegExp(`\\b${fieldName}\\b`).test(stripped)) continue;
            const ref: Reference = { file: otherFile, line: i + 1, ownerName: otherParsed.lineOwner[i], isTest: false };
            if (WRITE_DOT_ASSIGN(fieldName).test(stripped) || WRITE_COLON_LITERAL(fieldName).test(stripped)) {
              writers.push(ref);
            } else if (READ_DOT_ACCESS(fieldName).test(stripped)) {
              readers.push(ref);
            }
          }
        }

        if (readers.length && !writers.length) {
          findings.push({
            symbol: fieldName,
            file,
            line: ln,
            rule: "read-only-field",
            detail: `read at ${readers[0].file}:${readers[0].line} but never written outside its own declaration`,
          });
        } else if (writers.length && !readers.length) {
          findings.push({
            symbol: fieldName,
            file,
            line: ln,
            rule: "write-only-field",
            detail: `written at ${writers[0].file}:${writers[0].line} but never read outside its own declaration`,
          });
        }
      }
    }
  }
  return findings;
}

/**
 * Finds code that exists, compiles, and may even be tested, but that nothing on a real
 * entry point can ever reach. `changedFiles` are repo-relative paths (the same shape as
 * verifyRun's diff.paths, e.g. "mcp/delegation/goal.ts"); `projectDir` is the root of the
 * tree to analyze (the run's own worktree when wired into a claim, or this repo's root
 * when used directly, as the self-test does).
 */
export function findOrphans(projectDir: string, changedFiles: string[]): OrphanFinding[] {
  const mcpRoot = join(projectDir, "mcp");
  if (!existsSync(mcpRoot)) return [];
  const analysis = analyze(projectDir, mcpRoot);
  const changed = new Set(changedFiles);
  return [...findOrphanExports(analysis, changed), ...findOrphanFields(analysis, changed)];
}

export interface ReachabilityCheckResult {
  checks: CheckOutcome[];
}

// Wired into both dispatch.ts's executeRun and supervisor.ts's superviseRun, exactly
// where runStaticChecks already is — see static-checks.ts's own header for why this has
// to be kernel-executed rather than agent-declared. Unlike static checks, a finding here
// is NEVER a fail: `result` is always "pass", so this can never flip a run's ready/failed
// gate. The findings still need to be genuinely visible, so they ride in `expect` (which
// renderClaimCard prints on the check's own receipt line) as well as in the full evidence
// log — a false positive that could block a merge would get this check disabled inside a
// week, and then nobody would ever see a true positive again either.
export function runReachabilityCheck(
  projectDir: string,
  runId: string,
  worktreeDir: string,
  changedPaths: string[],
): ReachabilityCheckResult {
  const findings = findOrphans(worktreeDir, changedPaths);
  const summary = findings.length
    ? findings.map((f) => `${f.rule.toUpperCase()} ${f.symbol} (${f.file}:${f.line}) — ${f.detail}`).join("\n")
    : "no unreachable exports or fields introduced by this change\n";
  const evidence = writeEvidence(projectDir, runId, "reachability", summary);
  const expect = findings.length
    ? `${findings.length} unreachable symbol(s)/field(s) found — advisory only, review before merge: ${findings
        .map((f) => f.symbol)
        .join(", ")}`
    : "no unreachable exports or fields introduced";
  const check: CheckOutcome = {
    id: "reachability",
    // Not "command": this analysis executes nothing, and claimVerdict derives
    // "was anything actually executed?" from the command kind alone.
    kind: "analysis",
    expect,
    result: "pass",
    evidence,
  };
  return { checks: [check] };
}
