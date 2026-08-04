// Can a model tell drift that INVALIDATES a claim from drift that does not?
//
// This is the kill criterion for Kage Watch, and it replaces the citation-rot one, which failed:
// citation-half-life.mjs measured hard staleness at 0-29% a year (1.6% on the cleanest sample)
// but DRIFT — the cited symbol still resolving while the code beneath it moved — at 54-100%.
// Drift is therefore the population a paid re-audit exists to triage, and it is far too large to
// forward wholesale: flagging ~70% of a team's cards every year is the exact noise that made
// Cursor delete its Memories feature. The product only works if the judging is good.
//
// GROUND TRUTH BY CONSTRUCTION, NOT BY MY OPINION. Asking a model to grade cases I labelled myself
// would measure agreement between two of the same thing. Instead each case starts from real code
// in a real repository, and two mutations are applied whose semantics are known a priori:
//
//   invalidating — flip the exact operator or constant the claim is about. The claim is now false.
//   cosmetic     — insert a comment and blank lines elsewhere in the file. The claim still holds.
//
// The judge sees only (claim, new code) and never which mutation it got.
//
// THE NUMBER THAT MATTERS IS THE FALSE-POSITIVE RATE on cosmetic drift. A judge that cries wolf on
// reformatting turns Watch into the noise generator it is meant to prevent. Recall matters less:
// missing an invalidation costs one stale card, which the existing citation check may still catch.
//
//   node benchmarks/drift-triage.mjs [--cases 12] [--repo <path>] [--json] [--concurrency 4]

import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";

const run = promisify(execFile);
const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? d : argv[i + 1];
};
const CASES = Number(flag("cases", "12"));
const CONCURRENCY = Number(flag("concurrency", "4"));
const AS_JSON = argv.includes("--json");
const REPOS = (flag("repos", "") || "").split(",").filter(Boolean);

// ── Find real code with a claimable, mutable fact in it ───────────────────────────────────────
//
// Only patterns where flipping one token provably changes behaviour AND a short claim can state
// that behaviour precisely. A claim that is vague cannot be graded, so vague candidates are skipped.
const PATTERNS = [
  {
    id: "strict-comparison",
    re: /(?<lhs>[A-Za-z_$][\w$.]*(?:\.length)?)\s*(?<op><=|>=|<|>)\s*(?<rhs>[A-Za-z_$0-9][\w$.]*)/,
    flip: { "<": "<=", "<=": "<", ">": ">=", ">=": ">" },
    // BEHAVIOURAL, not syntactic. The first version of this claim said "compares with `>`, not
    // `>=`", which is a statement about tokens — so the eval measured whether a model can diff
    // characters, which is not the job and not what a card looks like. A real card states what the
    // code DOES at the boundary, and flipping the operator makes exactly that statement false.
    // Identified by its OPERANDS, not by an enclosing function name. Attribution by "last
    // declaration seen above" kept naming functions that do not contain the comparison, and the
    // judge then correctly answered that the claim did not describe the code — scoring a harness
    // bug as a product failure. Operands are unambiguous and need no parser.
    claim: (m) => {
      const strict = m.groups.op === "<" || m.groups.op === ">";
      return strict
        ? `Where this code compares \`${m.groups.lhs}\` against \`${m.groups.rhs}\`, the boundary is EXCLUDED: when those two are exactly equal the condition does NOT pass. That strictness is deliberate.`
        : `Where this code compares \`${m.groups.lhs}\` against \`${m.groups.rhs}\`, the boundary is INCLUDED: when those two are exactly equal the condition DOES pass. That inclusiveness is deliberate.`;
    },
  },
];

function candidatesFrom(repo) {
  const files = execFileSync("git", ["-C", repo, "ls-tree", "-r", "--name-only", "HEAD"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter((f) => /\.(ts|js|mjs)$/.test(f) && !/(test|spec|fixture|node_modules|dist)/i.test(f));

  const found = [];
  for (const file of files) {
    let source;
    try {
      source = execFileSync("git", ["-C", repo, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    } catch {
      continue;
    }
    const lines = source.split("\n");
    // The enclosing declared name, so the claim can name the thing it is about.
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(PATTERNS[0].re);
      // Attribute to the ENCLOSING declaration, and only update it on lines that do not also hold
      // the comparison: otherwise `const x = a > 1` names the local `x` rather than the function
      // it lives in, and the claim ends up being about a variable nobody would write a card about.
      if (!m) continue;
      // Skip lines where the operator is part of an arrow, JSX, or a generic.
      if (/=>|<\/|<[A-Z]/.test(lines[i])) continue;
      found.push({ repo, file, line: i, symbol: `${m.groups.lhs} ${m.groups.op} ${m.groups.rhs}`, source, op: m.groups.op, m });
      break; // one per file: variety across the corpus beats depth in one file
    }
    if (found.length >= CASES * 3) break;
  }
  return found;
}

function mutate(candidate, kind) {
  const lines = candidate.source.split("\n");
  if (kind === "invalidating") {
    const flipped = PATTERNS[0].flip[candidate.op];
    // Replace only the operator occurrence on that line, leaving everything else byte-identical.
    lines[candidate.line] = lines[candidate.line].replace(candidate.op, flipped);
  } else {
    // Cosmetic: a comment and blank lines somewhere ELSE in the file. Semantics untouched.
    const at = Math.max(0, candidate.line - 5);
    lines.splice(at, 0, "", "// NOTE: refactored for readability; behaviour unchanged.", "");
  }
  return lines.join("\n");
}

/** A window around the cited line — what a reviewer, or Watch, would actually be shown. */
function excerpt(source, line, radius = 22) {
  const lines = source.split("\n");
  const start = Math.max(0, line - radius);
  return lines.slice(start, line + radius).join("\n");
}

// ── The judge ─────────────────────────────────────────────────────────────────────────────────
//
// TWO FRAMINGS, because the first run of this eval measured the PROMPT rather than the model. It
// told the judge that "a false alarm trains them to ignore you" and got precisely what it asked
// for: 0% false alarms and 33% recall. That is one point on a trade-off curve, not a capability
// ceiling, and publishing it as "a model cannot do this" would have killed a product line on the
// strength of my own wording. Both framings are runnable so the trade-off is visible, not assumed.
const FRAMING = {
  // Precision-biased — what a product that fears noise above all would ship.
  strict: `Be strict about what counts. Reformatting, comments, renames elsewhere, and unrelated edits do NOT
invalidate a claim. Only a change to the specific behaviour the claim describes does. A false alarm
costs a human's attention and trains them to ignore you, so when the claim still holds, say so.`,
  // Neutral — no thumb on either scale, both errors named as equally bad.
  balanced: `Read the claim as a statement about what the code DOES, and check it against the code shown.
Answer true if the code no longer behaves the way the claim describes, and false if it still does.
Weigh the two mistakes equally: a missed invalidation leaves a false claim in circulation where
agents keep being told it, and a false alarm wastes a human's attention.`,
};
const FRAMING_KEY = flag("framing", "balanced") === "strict" ? "strict" : "balanced";
const BALANCED = FRAMING[FRAMING_KEY];

const PROMPT = (claim, code, file) => `You maintain a team's engineering memory.

A teammate previously recorded this CLAIM about the code, and a human approved it:

  "${claim}"

The file ${file} has since changed. Here is the CURRENT code:

\`\`\`
${code}
\`\`\`

Decide ONE thing: does the current code make that claim FALSE?

${BALANCED}

Reply with ONLY a JSON object, no prose, no code fence. Put the reasoning FIRST and the verdict
last, so the verdict follows from the reasoning rather than preceding it:
{"reason": "work it out in one or two sentences", "invalidated": true or false}`;

async function judge(claim, code, file) {
  try {
    const { stdout } = await run("claude", ["-p", PROMPT(claim, code, file)], {
      maxBuffer: 8 * 1024 * 1024,
      timeout: 120_000,
    });
    // Last object, not first: a model that narrates before answering can emit a stray brace early.
    const objects = stdout.match(/\{[\s\S]*?\}/g);
    const match = objects ? [objects[objects.length - 1]] : null;
    if (!match) return { error: "no json in reply", raw: stdout.slice(0, 200) };
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.invalidated !== "boolean") return { error: "no boolean verdict" };
    return parsed;
  } catch (error) {
    return { error: error instanceof Error ? error.message.slice(0, 160) : String(error) };
  }
}

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

// ── Build the corpus ──────────────────────────────────────────────────────────────────────────
const repos = REPOS.length ? REPOS : [process.cwd()];
let candidates = [];
for (const repo of repos) candidates = candidates.concat(candidatesFrom(repo));
candidates = candidates.slice(0, CASES);

if (!candidates.length) {
  console.error("\n  No claimable comparison sites found. Pass --repos <path>,<path>.\n");
  process.exit(1);
}

const trials = [];
for (const c of candidates) {
  const claim = PATTERNS[0].claim(c.m);
  for (const kind of ["invalidating", "cosmetic"]) {
    trials.push({ ...c, claim, kind, code: excerpt(mutate(c, kind), c.line) });
  }
}

if (!AS_JSON) console.log(`\n  Judging ${trials.length} cases (${candidates.length} sites x 2 mutations)...\n`);

const verdicts = await pool(trials, CONCURRENCY, async (t) => ({ ...t, verdict: await judge(t.claim, t.code, t.file) }));

// ── Score ─────────────────────────────────────────────────────────────────────────────────────
const usable = verdicts.filter((v) => !v.verdict.error);
const errors = verdicts.length - usable.length;

const cosmetic = usable.filter((v) => v.kind === "cosmetic");
const invalidating = usable.filter((v) => v.kind === "invalidating");

const falsePositives = cosmetic.filter((v) => v.verdict.invalidated === true);
const truePositives = invalidating.filter((v) => v.verdict.invalidated === true);

const fpRate = cosmetic.length ? falsePositives.length / cosmetic.length : NaN;
const recall = invalidating.length ? truePositives.length / invalidating.length : NaN;

// Stated before the run. A judge at chance is worthless; a judge that cries wolf is worse than
// worthless, because it actively trains people to ignore the product.
const FP_CEILING = 0.2;
const RECALL_FLOOR = 0.7;
const enoughData = cosmetic.length >= 8 && invalidating.length >= 8;
const verdict = !enoughData
  ? "INCONCLUSIVE"
  : fpRate <= FP_CEILING && recall >= RECALL_FLOOR
    ? "SUPPORTED"
    : "NOT SUPPORTED";

const report = {
  framing: FRAMING_KEY,
  cases: candidates.length,
  trials: trials.length,
  judged: usable.length,
  errors,
  cosmetic_n: cosmetic.length,
  invalidating_n: invalidating.length,
  false_positives: falsePositives.length,
  false_positive_rate: Number.isNaN(fpRate) ? null : Number(fpRate.toFixed(4)),
  recall: Number.isNaN(recall) ? null : Number(recall.toFixed(4)),
  fp_ceiling: FP_CEILING,
  recall_floor: RECALL_FLOOR,
  verdict,
};

if (AS_JSON) {
  console.log(JSON.stringify({ ...report, misses: verdicts.filter((v) => v.verdict.error || (v.kind === "cosmetic" && v.verdict.invalidated) || (v.kind === "invalidating" && v.verdict.invalidated === false)).map((v) => ({ file: v.file, symbol: v.symbol, kind: v.kind, verdict: v.verdict })).slice(0, 20) }, null, 2));
  process.exit(verdict === "SUPPORTED" ? 0 : 1);
}

const pct = (n) => (Number.isNaN(n) ? "n/a" : `${(n * 100).toFixed(1)}%`);
console.log(`  Drift triage — can the judge tell an invalidating change from a cosmetic one?

  sites            ${candidates.length} real comparison sites across ${repos.length} repo(s)
  judged           ${usable.length} of ${trials.length}${errors ? `  (${errors} errored)` : ""}

  COSMETIC drift   ${cosmetic.length} cases — the claim still holds; a flag here is a false alarm
    false alarms   ${falsePositives.length}  (${pct(fpRate)})   ceiling ${pct(FP_CEILING)}

  INVALIDATING     ${invalidating.length} cases — the operator the claim names was flipped
    caught         ${truePositives.length}  (${pct(recall)})   floor ${pct(RECALL_FLOOR)}

  Verdict: ${verdict}
  ${
    verdict === "SUPPORTED"
      ? "The judge separates the two. Watch has a product: it can forward the changes that matter\n  without burying a human in the ones that do not."
      : verdict === "INCONCLUSIVE"
        ? "Too few cases to decide. Raise --cases and add --repos."
        : `Watch does not have a product on this evidence. ${fpRate > FP_CEILING ? `A ${pct(fpRate)} false-alarm rate on\n  cosmetic edits is the noise that made Cursor delete Memories.` : `Missing ${pct(1 - recall)} of real\n  invalidations means the claims it lets through cannot be trusted either.`}`
  }
`);

if (falsePositives.length) {
  console.log("  False alarms (claim still true, judge said invalidated):");
  for (const f of falsePositives.slice(0, 5)) console.log(`    ${f.file}  ${f.symbol}  — "${f.verdict.reason}"`);
  console.log();
}
