// Do code citations actually rot? The kill criterion for the whole "Kage Watch" business model.
//
// Watch is a paid service that re-audits every card on every merge. If cited code survives
// untouched for a year, Watch has nothing to do and nobody should pay for it. So this is measured
// BEFORE anything is built, and it is allowed to return an answer that kills the plan.
//
// THE MEASUREMENT MUST BE RETROSPECTIVE, and that is the only subtle thing here. Today's cards
// all cite code that currently resolves — the auditor just verified them — so replaying today's
// citations forward would report "nothing ever rots" by construction. That number would be
// flattering and worthless. Instead this asks the honest counterfactual:
//
//     If a Librarian had mined this repo N months ago, what fraction of the citations it would
//     have written are still valid at HEAD today?
//
// Staleness is defined exactly as the shipped auditor defines it (verify.ts/checkCodeCitation):
// the file is gone, OR the symbol is no longer present as a whole word. Nothing else counts —
// a file that was merely edited is NOT stale, which is the conservative direction, and it means
// any rot this reports is rot the product would actually act on.
//
//   node benchmarks/citation-half-life.mjs [--repo <path>] [--months 12] [--commits 200] [--json]

import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const REPO = flag("repo", process.cwd());
const MONTHS = Number(flag("months", "12"));
const SAMPLE_COMMITS = Number(flag("commits", "200"));
const AS_JSON = argv.includes("--json");

const git = (args) => {
  try {
    return execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
};

// Only source files a citation would plausibly name. Lock files and generated output are not
// knowledge, and including them would inflate the rot rate with churn nobody writes cards about.
const SOURCE = /\.(ts|tsx|js|jsx|mjs|py|go|rs|rb|java|kt|swift|c|h|cc|cpp|cs|php|scala)$/;
const isNoise = (path) =>
  /(^|\/)(node_modules|dist|build|vendor|\.git|__snapshots__|coverage)\//.test(path) ||
  /(package-lock|yarn\.lock|pnpm-lock)/.test(path) ||
  /\.min\.(js|css)$/.test(path);

/**
 * Symbols a card would cite: exported/declared names. Deliberately the same shape the Librarian
 * is prompted to produce — a function or class name, not a local variable — because the survival
 * of `const i` would tell us nothing about the survival of knowledge.
 */
function declaredSymbols(source) {
  const found = new Set();
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /export\s+(?:const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
    /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
    /^class\s+([A-Za-z_$][\w$]*)/gm,
    /^def\s+([A-Za-z_$][\w$]*)/gm,
    /^func\s+([A-Za-z_$][\w$]*)/gm,
    /^(?:pub\s+)?fn\s+([A-Za-z_$][\w$]*)/gm,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      // Very short names produce false "still present" hits by coincidence.
      if (m[1] && m[1].length >= 4) found.add(m[1]);
    }
  }
  return [...found];
}

const wordPresent = (source, symbol) =>
  new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(source);

// ── Pick the historical vantage point ─────────────────────────────────────────────────────────
const since = new Date();
since.setMonth(since.getMonth() - MONTHS);
const sinceIso = since.toISOString().slice(0, 10);

const baseline = git(["rev-list", "-1", `--before=${sinceIso}`, "HEAD"]).trim();
if (!baseline) {
  console.error(`\n  ${REPO} has no history before ${sinceIso}. Try a smaller --months.\n`);
  process.exit(1);
}
const head = git(["rev-parse", "HEAD"]).trim();
const baselineDate = git(["show", "-s", "--format=%ci", baseline]).trim();

// What a Librarian mining AT the baseline would have looked at: the files touched by the commits
// leading up to it. That is exactly what miner.ts does — recent work is what carries decisions.
const touched = new Set();
const log = git(["log", baseline, `-${SAMPLE_COMMITS}`, "--name-only", "--format=%H"]);
for (const line of log.split("\n")) {
  const path = line.trim();
  if (path && !path.match(/^[0-9a-f]{40}$/) && SOURCE.test(path) && !isNoise(path)) touched.add(path);
}

// ── Build the citations that would have been written ──────────────────────────────────────────
// Only files that EXIST at the baseline: `git log --name-only` also lists paths deleted by those
// commits, and a file already gone at the vantage point was never citable from it.
const baselineFiles = new Set(git(["ls-tree", "-r", "--name-only", baseline]).split("\n").filter(Boolean));

const citations = [];
for (const path of touched) {
  if (!baselineFiles.has(path)) continue;
  const atBaseline = git(["show", `${baseline}:${path}`]);
  if (!atBaseline) continue;
  for (const symbol of declaredSymbols(atBaseline).slice(0, 3)) {
    citations.push({ path, symbol });
  }
}

if (!citations.length) {
  console.error(`\n  No citable symbols found at ${baseline.slice(0, 8)}. Is this a source repo?\n`);
  process.exit(1);
}

// ── Check each against HEAD, exactly as the shipped auditor would ─────────────────────────────
const headFiles = new Set(git(["ls-tree", "-r", "--name-only", "HEAD"]).split("\n").filter(Boolean));
const contentCache = new Map();
const contentAtHead = (path) => {
  if (!contentCache.has(path)) contentCache.set(path, git(["show", `HEAD:${path}`]));
  return contentCache.get(path);
};

let fileGone = 0;
let symbolGone = 0;
let alive = 0;
let drifted = 0;
const dead = [];

// The auditor has THREE verdicts, not two (verify.ts/auditCard), and conflating them understates
// the work by a wide margin:
//   stale       — the citation no longer resolves. The card is WITHHELD from every agent.
//   unverified  — it still resolves, but the cited blob changed since it was pinned. The claim
//                 may now be false while still looking plausible: `withinLimit` still exists,
//                 someone just changed `<` to `<=`. A human has to re-read it.
//   verified    — pinned blob still matches.
// `stale` is the dramatic case and the rare one. `unverified` is the population a merge-triggered
// re-audit actually exists to route, so it is measured separately rather than folded in.
const contentAtBaseline = new Map();
const baselineContent = (path) => {
  if (!contentAtBaseline.has(path)) contentAtBaseline.set(path, git(["show", `${baseline}:${path}`]));
  return contentAtBaseline.get(path);
};

for (const citation of citations) {
  if (!headFiles.has(citation.path)) {
    fileGone += 1;
    dead.push({ ...citation, reason: "file missing" });
    continue;
  }
  if (!wordPresent(contentAtHead(citation.path), citation.symbol)) {
    symbolGone += 1;
    dead.push({ ...citation, reason: `symbol ${citation.symbol} not found` });
    continue;
  }
  alive += 1;
  if (baselineContent(citation.path) !== contentAtHead(citation.path)) drifted += 1;
}

const total = citations.length;
const rotted = fileGone + symbolGone;
const rotRate = rotted / total;
const survival = alive / total;

// Citation-level rot double-counts: one deleted file kills every symbol cited from it, so a single
// deletion can look like three failures. The first run of this script reported 16.7% rot of which
// three quarters was ONE file. File-level rot is the conservative reading, and the verdict is
// taken from the conservative one — a business case must not rest on the flattering denominator.
const distinctFiles = new Set(citations.map((c) => c.path));
const distinctDeadFiles = new Set(dead.map((d) => d.path));
const fileRotRate = distinctDeadFiles.size / distinctFiles.size;

// THE CRITERION, stated before the number is known so it cannot be rationalised afterwards.
// Watch re-audits on every merge. If almost everything survives a year, there is no work to do.
const VERDICT_FLOOR = 0.15;
// A sample this small cannot settle a business decision either way. Saying so is the whole point:
// the alternative is a two-digit percentage with no error bar being quoted back as evidence.
const MIN_SAMPLE = 100;
const verdict =
  total < MIN_SAMPLE || distinctFiles.size < 40
    ? "INCONCLUSIVE"
    : fileRotRate >= VERDICT_FLOOR
      ? "SUPPORTED"
      : "NOT SUPPORTED";

const report = {
  repo: REPO,
  months: MONTHS,
  baseline_commit: baseline.slice(0, 8),
  baseline_date: baselineDate,
  head_commit: head.slice(0, 8),
  files_sampled: touched.size,
  citations_sampled: total,
  still_valid: alive,
  rotted,
  rotted_file_missing: fileGone,
  rotted_symbol_removed: symbolGone,
  survival_rate: Number(survival.toFixed(4)),
  rot_rate: Number(rotRate.toFixed(4)),
  file_rot_rate: Number(fileRotRate.toFixed(4)),
  drifted: drifted,
  drift_rate: Number((alive ? drifted / alive : 0).toFixed(4)),
  threshold: VERDICT_FLOOR,
  verdict,
};

if (AS_JSON) {
  console.log(JSON.stringify({ ...report, dead_sample: dead.slice(0, 20) }, null, 2));
  process.exit(0);
}

const pct = (n) => `${(n * 100).toFixed(1)}%`;
console.log(`
  Citation half-life — would a card written ${MONTHS} months ago still be true?

  repo        ${REPO}
  baseline    ${baseline.slice(0, 8)}  (${baselineDate})
  head        ${head.slice(0, 8)}

  sampled     ${total} citations across ${distinctFiles.size} files a Librarian would have mined

  still valid ${alive}  (${pct(survival)})
  rotted      ${rotted}  (${pct(rotRate)})
                ${fileGone} file deleted
                ${symbolGone} symbol removed

  by file     ${distinctDeadFiles.size} of ${distinctFiles.size} cited files rotted  (${pct(fileRotRate)})
              ^ the honest denominator: one deleted file kills every symbol cited from it,
                so the citation-level figure above flatters the case.

  drifted     ${drifted} of the ${alive} still-resolving citations sit in a file that CHANGED  (${pct(alive ? drifted / alive : 0)})
              ^ auditor verdict "unverified": the symbol survives but the code under it moved,
                so the claim may be false while still looking plausible. This is the population
                a merge-triggered re-audit routes to a human — and it is much larger than rot.

  Verdict: ${verdict} — file-level rot ${pct(fileRotRate)} vs a ${pct(VERDICT_FLOOR)} floor set before measuring.
  ${
    verdict === "INCONCLUSIVE"
      ? `Sample too small to decide: ${total} citations across ${distinctFiles.size} files (need ${MIN_SAMPLE}+ across 40+).\n  Run this against several mature repositories before letting it justify anything.`
      : verdict === "SUPPORTED"
        ? `Roughly ${Math.round(fileRotRate * 100)} of every 100 cited files would be silently wrong after ${MONTHS}\n  months with nothing re-checking them. That is the work Watch does.`
        : `Citations mostly survive. A merge-triggered re-audit has little to do, and nobody should be\n  charged for it. The business model that depends on this does not hold on this evidence.`
  }

  Sample of what rotted:
${dead.slice(0, 8).map((d) => `    ${d.path}  ${d.reason}`).join("\n") || "    (nothing)"}
`);
