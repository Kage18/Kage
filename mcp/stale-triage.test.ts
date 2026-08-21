// Tests for `kage stale` — the triage surface for memory withheld from recall because
// its cited paths moved (mcp/kernel.ts: staleTriage, formatStaleTriage). Deliberately its
// own file per repo convention: new behaviour gets its own test file, and
// mcp/delegation.test.ts is a known merge-conflict hotspot other runs collide in.
//
// The one property under test throughout: staleTriage must never itself reverify or
// clear a stale flag — it only reports what moved and prints the exact single-packet
// command (reverify or supersede) for a human to run. reverifyMemory (tested in
// kernel.test.ts) refreshes grounding, not the claim; a triage surface that quietly
// cleared flags for the caller would be exactly the "bulk reverify" the brief forbids.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { capture, formatStaleTriage, packetsDir, staleTriage } from "./kernel.js";
import { okfConceptToPacket, packetToOkfConcept } from "./okf.js";

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-stale-triage-"));
  mkdirSync(join(dir, ".agent_memory", "nodes"), { recursive: true });
  return dir;
}

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempGitProject(): string {
  const dir = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir, stdio: "ignore" });
  return dir;
}

// Commits a path's content with a given subject/body at a given date. Dates are pinned
// deliberately far in the future (2030+) so they always sort after a packet's
// last_verified_at, which is real wall-clock "now" at capture time — this is what makes
// staleTriage's `--since=<last_verified_at>` window pick these commits up regardless of
// when the test suite actually runs.
function commitPath(project: string, path: string, content: string, subject: string, isoDate: string, body?: string): void {
  writeFileSync(join(project, path), content, "utf8");
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  const messageArgs = body ? ["-m", subject, "-m", body] : ["-m", subject];
  execFileSync("git", ["commit", "--date", isoDate, ...messageArgs], {
    cwd: project,
    stdio: "ignore",
    env: { ...GIT_ENV, GIT_AUTHOR_DATE: isoDate, GIT_COMMITTER_DATE: isoDate },
  });
}

// This repo's own commit subjects can run to hundreds of characters (a dispatch brief as
// the subject line) — this is the exact shape that made "kage stale" unreadable.
const VERY_LONG_SUBJECT =
  "Build a stale-memory triage surface that lets a human decide reverify or supersede " +
  "for every packet whose cited grounding moved during a large refactor without opening five files each";
const BODY_MARKER = "BODY_TEXT_MUST_NEVER_APPEAR_IN_TRIAGE_OUTPUT";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readPacketFile(path: string): any {
  return okfConceptToPacket(readFileSync(path, "utf8"));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writePacketFile(path: string, packet: any): void {
  writeFileSync(path, packetToOkfConcept(packet), "utf8");
}

function packetFileFor(project: string, id: string): string {
  const dir = packetsDir(project);
  const name = readdirSync(dir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".json"))
    .find((f) => readPacketFile(join(dir, f))?.id === id);
  if (!name) throw new Error(`no packet file found for ${id}`);
  return join(dir, name);
}

// Mutates a captured packet's on-disk quality.score, so ranking tests don't depend on
// the derived quality scorer's internals — only on staleTriage's own weighting.
function setQualityScore(project: string, id: string, score: number): void {
  const path = packetFileFor(project, id);
  const packet = readPacketFile(path);
  packet.quality = { ...(packet.quality ?? {}), score };
  writePacketFile(path, packet);
}

test("lists a stale packet with the cited path that moved, and what changed under it", () => {
  const project = tempProject();
  writeFileSync(join(project, "src.ts"), "export const x = 1;\n", "utf8");
  const captured = capture({
    projectDir: project,
    title: "Src rule",
    body: "Src rule: the constant x lives in src.ts and must stay in sync with the config loader.",
    type: "decision",
    paths: ["src.ts"],
  });
  assert.equal(captured.ok, true, JSON.stringify(captured.errors));
  const id = captured.packet!.id;

  // Simulate the file moving out from under the packet (a rename/delete during a refactor).
  rmSync(join(project, "src.ts"));

  const result = staleTriage(project);
  assert.equal(result.total_stale, 1);
  const entry = result.entries.find((item) => item.id === id);
  assert.ok(entry, "moved packet should appear in triage");
  assert.deepEqual(entry!.moved_paths, ["src.ts"]);
  assert.deepEqual(entry!.missing_paths, ["src.ts"]);
  assert.equal(entry!.present_paths.length, 0);
  assert.equal(entry!.what_changed.length, 1);
  assert.equal(entry!.what_changed[0].path, "src.ts");
  assert.equal(typeof entry!.what_changed[0].summary, "string");
  assert.ok(entry!.what_changed[0].summary.length > 0);
  assert.equal(entry!.reasons.length > 0, true);
  // Every cited path is gone here, so the honest suggestion is supersede, not reverify.
  assert.equal(entry!.suggested_action, "supersede");
  assert.match(entry!.command, /^kage supersede --project .* --packet /);
});

test("ranks a decision with surviving grounding above a low-quality bug_fix that lost everything", () => {
  const project = tempProject();
  mkdirSync(join(project, "keep"), { recursive: true });
  writeFileSync(join(project, "keep", "a.ts"), "export const a = 1;\n", "utf8");
  writeFileSync(join(project, "keep", "gone-a.ts"), "export const b = 1;\n", "utf8");
  writeFileSync(join(project, "keep", "gone-b.ts"), "export const c = 1;\n", "utf8");

  const decision = capture({
    projectDir: project,
    title: "High-value decision",
    body: "High-value decision: we standardized on keep/a.ts and keep/gone-a.ts for this contract, chosen over the alternative because it isolates the boundary.",
    type: "decision",
    paths: ["keep/a.ts", "keep/gone-a.ts"],
  });
  assert.equal(decision.ok, true, JSON.stringify(decision.errors));
  setQualityScore(project, decision.packet!.id, 90);

  const bugFix = capture({
    projectDir: project,
    title: "Low-value bug fix",
    body: "Low-value bug fix: a null check was missing in keep/gone-a.ts and keep/gone-b.ts, causing a crash on empty input.",
    type: "bug_fix",
    paths: ["keep/gone-a.ts", "keep/gone-b.ts"],
  });
  assert.equal(bugFix.ok, true, JSON.stringify(bugFix.errors));
  setQualityScore(project, bugFix.packet!.id, 40);

  // Move only one of the decision's two paths (it keeps half its grounding); move both
  // of the bug fix's paths (it loses all of its grounding).
  rmSync(join(project, "keep", "gone-a.ts"));
  rmSync(join(project, "keep", "gone-b.ts"));

  const result = staleTriage(project);
  assert.equal(result.total_stale, 2);
  assert.equal(result.entries[0].id, decision.packet!.id, "the decision with more surviving grounding and a higher quality score should rank first");
  assert.equal(result.entries[1].id, bugFix.packet!.id);
  assert.ok(result.entries[0].rescue_score > result.entries[1].rescue_score);
  // The bug fix lost every citation, so it must be offered supersede, never reverify.
  assert.equal(result.entries[1].suggested_action, "supersede");
  assert.equal(result.entries[0].suggested_action, "reverify");
  assert.match(result.entries[0].command, /^kage reverify --project .* --packet /);
});

test("--limit caps the list and reports how many were withheld", () => {
  const project = tempProject();
  const ids: string[] = [];
  for (const name of ["p1", "p2", "p3"]) {
    writeFileSync(join(project, `${name}.ts`), `export const ${name} = 1;\n`, "utf8");
    const captured = capture({
      projectDir: project,
      title: `Rule about ${name}`,
      body: `Rule about ${name}: the ${name} constant lives in ${name}.ts and downstream code depends on it staying exported.`,
      type: "reference",
      paths: [`${name}.ts`],
    });
    assert.equal(captured.ok, true, JSON.stringify(captured.errors));
    ids.push(captured.packet!.id);
    rmSync(join(project, `${name}.ts`));
  }

  const full = staleTriage(project, { limit: 20 });
  assert.equal(full.total_stale, 3);
  assert.equal(full.shown, 3);
  assert.equal(full.withheld, 0);

  const capped = staleTriage(project, { limit: 1 });
  assert.equal(capped.total_stale, 3);
  assert.equal(capped.shown, 1);
  assert.equal(capped.entries.length, 1);
  assert.equal(capped.withheld, 2);

  const rendered = formatStaleTriage(capped, 1);
  assert.ok(rendered.some((line) => line.includes("2 more withheld by --limit 1")));
});

test("a repo with no stale memory prints a clean empty state that teaches the next action", () => {
  const project = tempProject();
  writeFileSync(join(project, "fine.ts"), "export const fine = 1;\n", "utf8");
  const captured = capture({
    projectDir: project,
    title: "Fine rule",
    body: "Fine rule: fine.ts holds a constant that nothing else depends on breaking.",
    type: "reference",
    paths: ["fine.ts"],
  });
  assert.equal(captured.ok, true, JSON.stringify(captured.errors));

  const result = staleTriage(project);
  assert.equal(result.ok, true);
  assert.equal(result.total_stale, 0);
  assert.equal(result.entries.length, 0);

  const rendered = formatStaleTriage(result, 20);
  assert.equal(rendered.length, 2);
  assert.match(rendered[0], /No stale memory to triage/);
  // Teaches the next action instead of just saying "nothing here".
  assert.match(rendered.join("\n"), /re-run it after a large refactor/);
});

test("staleTriage never mutates packets on disk (it is read-only triage, not bulk reverify)", () => {
  const project = tempProject();
  writeFileSync(join(project, "watched.ts"), "export const watched = 1;\n", "utf8");
  const captured = capture({
    projectDir: project,
    title: "Watched rule",
    body: "Watched rule: watched.ts holds a constant referenced by the billing job scheduler.",
    type: "decision",
    paths: ["watched.ts"],
  });
  assert.equal(captured.ok, true, JSON.stringify(captured.errors));
  const id = captured.packet!.id;
  rmSync(join(project, "watched.ts"));

  const before = readPacketFile(packetFileFor(project, id));
  staleTriage(project);
  const after = readPacketFile(packetFileFor(project, id));
  assert.deepEqual(before, after);
});

// Reproduces the bloat measured live on this repo: "kage stale --limit 1" emitted 3,979
// chars and "--limit 3" emitted 15,747, because "what changed" printed FULL commit
// subjects (this repo's own subjects run to 313 chars) and every commit body. Sets up a
// packet whose cited path has 5 commits dated AFTER capture (so staleTriage's `--since`
// window picks up all 5), the most recent of which has a >200-char subject and a body.
function captureWithLongCommitHistory(project: string, name: string): string {
  commitPath(project, `${name}.ts`, `export const ${name} = 0;\n`, `seed ${name}`, "2020-01-01T00:00:00");
  const captured = capture({
    projectDir: project,
    title: `Rule about ${name}`,
    body: `Rule about ${name}: the ${name} constant lives in ${name}.ts and downstream code depends on it staying exported.`,
    type: "decision",
    paths: [`${name}.ts`],
  });
  assert.equal(captured.ok, true, JSON.stringify(captured.errors));
  for (let i = 1; i <= 4; i += 1) {
    commitPath(project, `${name}.ts`, `export const ${name} = ${i};\n`, `bump ${name} to ${i}`, `2030-06-0${i}T00:00:00`);
  }
  // The 5th (most recent) commit is the long, brief-shaped one with a body.
  commitPath(project, `${name}.ts`, `export const ${name} = 5;\n`, VERY_LONG_SUBJECT, "2030-06-05T00:00:00", BODY_MARKER);
  rmSync(join(project, `${name}.ts`));
  return captured.packet!.id;
}

test("a long commit subject is truncated on a word boundary and no commit body ever appears", () => {
  const project = tempGitProject();
  const id = captureWithLongCommitHistory(project, "src");

  const result = staleTriage(project);
  const entry = result.entries.find((item) => item.id === id);
  assert.ok(entry, "the packet with a moved path should appear in triage");
  assert.equal(entry!.what_changed.length, 1);
  const summary = entry!.what_changed[0].summary;

  assert.ok(VERY_LONG_SUBJECT.length > 72, "fixture subject must actually need truncation");
  assert.ok(!summary.includes(VERY_LONG_SUBJECT), "the full 200+ char subject must never appear verbatim");
  assert.ok(!summary.includes(BODY_MARKER), "a commit body must never appear in triage output");
  assert.match(summary, /…/, "a truncated subject ends with a single-character ellipsis");
  // Each shown commit is "<short-hash> <<=72 char subject><ellipsis>" — comfortably under
  // 90 chars including the hash, never the 200+ chars the raw subject would cost.
  for (const commitToken of summary.split(" (+")[0].split(" | ")) {
    assert.ok(commitToken.length < 90, `commit token too long: "${commitToken}" (${commitToken.length} chars)`);
  }
});

test("the per-path commit cap holds at 3 and states how many more there were", () => {
  const project = tempGitProject();
  const id = captureWithLongCommitHistory(project, "capped");

  const result = staleTriage(project);
  const entry = result.entries.find((item) => item.id === id);
  assert.ok(entry);
  const summary = entry!.what_changed[0].summary;

  // 5 commits were made after capture; only 3 are ever shown per path.
  const shownCommits = summary.split(" (+")[0].split(" | ");
  assert.equal(shownCommits.length, 3, `expected exactly 3 commits shown, got: ${summary}`);
  assert.match(summary, /\(\+2 more\)$/, "the remaining 2 commits must be stated, in the same honest register as --limit withholding");
});

test("REGRESSION: kage stale --limit 3 total output stays comfortably under a 3,000 char ceiling", () => {
  // Chosen ceiling: 3,000 chars for --limit 3 (the brief's target). Before this fix, the
  // measured output for --limit 3 on this repo was 15,747 chars — over 5x this ceiling —
  // purely from unbounded commit subjects and bodies in "what changed". This test FAILS if
  // that truncation/cap is reverted, even with only 3 packets each carrying a realistic
  // (5-commit, one long-subject) moved-path history.
  const project = tempGitProject();
  captureWithLongCommitHistory(project, "alpha");
  captureWithLongCommitHistory(project, "bravo");
  captureWithLongCommitHistory(project, "charlie");

  const result = staleTriage(project, { limit: 3 });
  assert.equal(result.shown, 3);
  const rendered = formatStaleTriage(result, 3).join("\n");
  assert.ok(rendered.length < 3000, `expected under 3,000 chars, got ${rendered.length}`);
});
