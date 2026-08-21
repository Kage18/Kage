import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { callTool } from "./index.js";
import { capture, prCheck, supersedeMemory } from "./kernel.js";
import { capCollection, capFields } from "./response-cap.js";
import { okfConceptToPacket, packetToOkfConcept } from "./okf.js";

// The actual shipped CLI binary, invoked as a real subprocess: the MCP-boundary caps
// added in index.ts must never touch what `kage <command> --json` prints, since that
// output is read by a human who scrolls, not loaded whole into an agent's context.
const CLI_PATH = join(__dirname, "cli.js");
function runCli(args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf8" });
    return { stdout, status: 0 };
  } catch (error) {
    const err = error as { stdout?: string; status?: number | null };
    return { stdout: err.stdout ?? "", status: err.status ?? 1 };
  }
}

// Hermetic personal store: recall reads $KAGE_HOME/memory, so tool tests must
// never see the developer's real ~/.kage.
if (!process.env.KAGE_HOME) process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-response-size-home-"));

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-response-size-test-"));
  mkdirSync(join(dir, ".agent_memory", "nodes"), { recursive: true });
  return dir;
}

const gitIdentityEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

// pr_check reads git state (branch, porcelain status) via buildBranchOverlay, so its
// fixtures need a real (if minimal) git repo, unlike the plain tempProject() above.
function tempGitProject(): string {
  const dir = tempProject();
  execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["add", "."], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "initial", "--allow-empty"], { cwd: dir, stdio: "ignore", env: gitIdentityEnv });
  return dir;
}

function textContent(result: Awaited<ReturnType<typeof callTool>>): string {
  const first = result.content[0];
  assert.equal(first.type, "text");
  return String(first.text);
}

// kage_pr_check prefixes its JSON payload with a human-readable stale-catch guard
// line (see index.ts), so callers that want the JSON body must skip past it.
function prCheckPayload(result: Awaited<ReturnType<typeof callTool>>): any {
  const text = textContent(result);
  return JSON.parse(text.slice(text.indexOf("{")));
}

// Each packet cites a path that does not exist, which refreshProject flags stale
// with suggested_action "update". Setting a packet's status to "deprecated" instead
// flags it "mark_stale" (higher urgency), used to exercise the ranking behavior.
function seedStalePackets(project: string, count: number, options: { deprecatedCount?: number } = {}): void {
  const deprecatedCount = options.deprecatedCount ?? 0;
  for (let i = 0; i < count; i++) {
    const result = capture({
      projectDir: project,
      title: `Stale fixture memory ${i}`,
      body: `This fixture packet cites a path that does not exist so refresh flags it stale. Verified by fixture ${i}.`,
      type: "gotcha",
      paths: [`src/missing-${i}.ts`],
      tags: ["fixture"],
    });
    assert.equal(result.ok, true, `capture ${i} should succeed: ${result.errors.join("; ")}`);
    if (i < deprecatedCount) {
      const packet = okfConceptToPacket(readFileSync(result.path!, "utf8"));
      assert.ok(packet);
      packet.status = "deprecated";
      writeFileSync(result.path!, packetToOkfConcept(packet), "utf8");
    }
  }
}

// Short body, no paths, no tags: base 45 + high-value-type 14 + always-present source
// evidence 12 - too-short 18 - not-grounded 10 = 43, under the 55 quality-score warning
// threshold. Enough near-identical fixtures also trip the duplicate-candidate warning.
function seedLowQualityPackets(project: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const result = capture({
      projectDir: project,
      title: `Thin note ${i}`,
      body: `Thin note ${i} body.`,
      type: "gotcha",
    });
    assert.equal(result.ok, true, `capture ${i} should succeed: ${result.errors.join("; ")}`);
  }
}

test("capCollection returns everything untouched when under the limit", () => {
  const result = capCollection(["a", "b"], 10, "widgets");
  assert.deepEqual(result.items, ["a", "b"]);
  assert.equal(result.total, 2);
  assert.equal(result.truncated, false);
  assert.equal(result.note, null);
});

test("capCollection truncates and states an honest total", () => {
  const items = Array.from({ length: 25 }, (_, i) => `item-${i}`);
  const result = capCollection(items, 10, "widgets");
  assert.equal(result.items.length, 10);
  assert.equal(result.total, 25);
  assert.equal(result.truncated, true);
  assert.equal(result.note, "showing 10 of 25 widgets");
});

test("kage_refresh caps stale_packets to at most 10 and states the true total", async () => {
  const project = tempProject();
  seedStalePackets(project, 15, { deprecatedCount: 3 });

  const result = await callTool("kage_refresh", { project_dir: project });
  const payload = JSON.parse(textContent(result));

  assert.equal(Array.isArray(payload.stale_packets), true);
  assert.ok(payload.stale_packets.length <= 10, `expected at most 10 stale_packets, got ${payload.stale_packets.length}`);
  assert.equal(payload.stale_packets_total, 15);
  assert.equal(payload.stale_packets_truncated, true);

  // (b) the truncation notice text actually appears in the returned payload.
  assert.match(textContent(result), /showing 10 of 15 stale packets/);
  assert.ok(payload.response_notes.includes("showing 10 of 15 stale packets"));

  // Ranking: the 3 deprecated (mark_stale, most urgent) findings must survive the cap
  // even though they were captured last, i.e. this is not an insertion-order slice.
  const shownActions = payload.stale_packets.map((entry: { suggested_action: string }) => entry.suggested_action);
  assert.equal(shownActions.filter((action: string) => action === "mark_stale").length, 3);
});

test("kage_refresh limit/verbose return more than the capped default", async () => {
  const project = tempProject();
  seedStalePackets(project, 15);

  const capped = JSON.parse(textContent(await callTool("kage_refresh", { project_dir: project })));
  assert.equal(capped.stale_packets.length, 10);

  const limited = JSON.parse(textContent(await callTool("kage_refresh", { project_dir: project, limit: 12 })));
  assert.equal(limited.stale_packets.length, 12);
  assert.equal(limited.stale_packets_truncated, true);

  const verbose = JSON.parse(textContent(await callTool("kage_refresh", { project_dir: project, verbose: true })));
  assert.equal(verbose.stale_packets.length, 15);
  assert.equal(verbose.stale_packets_total, 15);
  assert.equal(verbose.stale_packets_truncated, false);
});

test("kage_refresh leaves a repo with few stale packets unaffected", async () => {
  const project = tempProject();
  seedStalePackets(project, 2);

  const result = await callTool("kage_refresh", { project_dir: project });
  const payload = JSON.parse(textContent(result));

  assert.equal(payload.stale_packets.length, 2);
  assert.equal(payload.stale_packets_total, 2);
  assert.equal(payload.stale_packets_truncated, false);
  assert.equal(payload.response_notes.includes("showing 2 of 2 stale packets"), false);
});

test("kage_refresh caps validation warnings and states the true total", async () => {
  const project = tempProject();
  seedLowQualityPackets(project, 15);

  const result = await callTool("kage_refresh", { project_dir: project });
  const payload = JSON.parse(textContent(result));

  assert.ok(payload.validation.warnings_total >= 11, `expected fixture to produce >10 warnings, got ${payload.validation.warnings_total}`);
  assert.ok(payload.validation.warnings.length <= 10);
  assert.equal(payload.validation.warnings_truncated, true);
  assert.ok(payload.response_notes.some((note: string) => note.startsWith("showing 10 of") && note.endsWith("validation warnings")));
});

// This repo's own refresh call measured 149,739 chars (177 stale packets, 78 warnings)
// before this fix, large enough that the MCP client refused it outright. A fixture at
// comparable scale (60 stale packets, 15 deprecated) must stay well under a sane budget
// with the default cap applied. 40,000 bytes is ~3.7x under the previous overflow and
// leaves generous room for the index/metrics/graph fields that are never capped.
test("kage_refresh default response for a repo-scale fixture stays under a sane byte budget", async () => {
  const project = tempProject();
  seedStalePackets(project, 60, { deprecatedCount: 15 });

  const result = await callTool("kage_refresh", { project_dir: project });
  const text = textContent(result);
  const BYTE_BUDGET = 40_000;
  assert.ok(
    Buffer.byteLength(text, "utf8") < BYTE_BUDGET,
    `expected under ${BYTE_BUDGET} bytes, got ${Buffer.byteLength(text, "utf8")}`,
  );
});

// ---------------------------------------------------------------------------
// capFields: the shared helper the tools below use to cap named array fields
// on an already-computed payload without touching the kernel function itself.
// ---------------------------------------------------------------------------

test("capFields caps named array fields and states true totals in *_total/*_truncated", () => {
  const payload = { ok: true, widgets: Array.from({ length: 25 }, (_, i) => ({ id: i })), gizmos: ["a", "b"] };
  const result = capFields(payload, undefined, [{ key: "widgets", label: "widgets" }, { key: "gizmos", label: "gizmos" }]);
  assert.equal(result.widgets.length, 10);
  assert.equal((result as any).widgets_total, 25);
  assert.equal((result as any).widgets_truncated, true);
  assert.equal(result.gizmos.length, 2);
  assert.equal((result as any).gizmos_truncated, false);
  assert.deepEqual(result.response_notes, ["showing 10 of 25 widgets"]);
});

test("capFields honors verbose and an explicit limit", () => {
  const payload = { widgets: Array.from({ length: 25 }, (_, i) => i) };
  const verbose = capFields(payload, { verbose: true }, [{ key: "widgets", label: "widgets" }]);
  assert.equal(verbose.widgets.length, 25);
  const limited = capFields(payload, { limit: 5 }, [{ key: "widgets", label: "widgets" }]);
  assert.equal(limited.widgets.length, 5);
});

// ---------------------------------------------------------------------------
// kage_pr_check: measured 321,873 chars / ~80,000 tokens on the real Kage repo before
// this fix - a third of a context window for a call CLAUDE.md mandates before every
// finish. Reverting the capping in index.ts (but keeping kernel.ts's prCheck() itself
// untouched) makes every assertion below fail.
// ---------------------------------------------------------------------------

function seedManyStaleAndLowQualityPackets(project: string, staleCount: number, lowQualityCount: number): void {
  seedStalePackets(project, staleCount);
  seedLowQualityPackets(project, lowQualityCount);
}

test("kage_pr_check caps stale_packets, validation.warnings/errors, and memory_reconciliation.items with true totals", async () => {
  const project = tempGitProject();
  seedManyStaleAndLowQualityPackets(project, 20, 20);

  const result = await callTool("kage_pr_check", { project_dir: project });
  const payload = prCheckPayload(result);

  assert.ok(payload.stale_packets.length <= 10, `expected at most 10 stale_packets, got ${payload.stale_packets.length}`);
  assert.equal(payload.stale_packets_total, 20);
  assert.equal(payload.stale_packets_truncated, true);

  assert.ok(payload.validation.warnings.length <= 10);
  assert.ok(payload.validation.warnings_total >= 11, `expected fixture to produce >10 warnings, got ${payload.validation.warnings_total}`);
  assert.equal(payload.validation.warnings_truncated, true);

  assert.ok(Array.isArray(payload.response_notes) && payload.response_notes.length > 0);
  assert.ok(payload.response_notes.some((note: string) => note.endsWith("stale packets")));
});

test("kage_pr_check does not send validation.warnings twice under the top-level warnings field", async () => {
  const project = tempGitProject();
  seedLowQualityPackets(project, 20);

  const result = await callTool("kage_pr_check", { project_dir: project });
  const payload = prCheckPayload(result);

  // Ground truth: prCheck() itself builds `warnings` as `[...validation.warnings, ...own]`
  // (kernel.ts) - the MCP handler must de-duplicate that down to prCheck's own lines only.
  const fullValidationWarnings = new Set(prCheck(project).validation.warnings);
  for (const warning of payload.warnings) {
    assert.equal(fullValidationWarnings.has(warning), false, `top-level warnings should not repeat a validation.warnings entry: "${warning}"`);
  }
  assert.ok(payload.warnings.length < payload.validation.warnings_total);
});

// This repo's own kage_pr_check call measured 321,873 chars before this fix. A fixture
// at comparable scale (40 stale, 40 low-quality) must stay well under a sane budget.
test("kage_pr_check default response for a repo-scale fixture stays under a sane byte budget", async () => {
  const project = tempGitProject();
  seedManyStaleAndLowQualityPackets(project, 40, 40);

  const result = await callTool("kage_pr_check", { project_dir: project });
  const text = textContent(result);
  const BYTE_BUDGET = 40_000;
  assert.ok(
    Buffer.byteLength(text, "utf8") < BYTE_BUDGET,
    `expected under ${BYTE_BUDGET} bytes, got ${Buffer.byteLength(text, "utf8")}`,
  );
});

test("kage pr check --json via the real CLI binary is NOT capped - unchanged by the MCP-only fix", () => {
  const project = tempGitProject();
  seedManyStaleAndLowQualityPackets(project, 20, 20);

  const cli = runCli(["pr", "check", "--project", project, "--json"]);
  const cliPayload = JSON.parse(cli.stdout);
  assert.ok(cliPayload.stale_packets.length >= 20, `CLI should return all stale packets uncapped, got ${cliPayload.stale_packets.length}`);
  assert.equal(cliPayload.stale_packets_total, undefined, "CLI's prCheck() output has no capping metadata - it never caps");
});

// ---------------------------------------------------------------------------
// kage_supersede: measured ~10,000 tokens for one call on the real repo, echoing full
// MemoryPacket bodies (with a freshness.path_fingerprints sha256 per cited file/symbol)
// for both packets, vs. the two summary lines `kage supersede` prints for the same
// mutation.
// ---------------------------------------------------------------------------

function captureTwoPackets(project: string): { oldId: string; replacementId: string } {
  const oldResult = capture({ projectDir: project, title: "Old fact about retries", body: "The retry module used to retry three times before giving up.", type: "decision" });
  const replacementResult = capture({ projectDir: project, title: "New fact about retries", body: "The retry module now retries five times with backoff before giving up.", type: "decision" });
  assert.equal(oldResult.ok, true);
  assert.equal(replacementResult.ok, true);
  return { oldId: oldResult.packet!.id, replacementId: replacementResult.packet!.id };
}

test("kage_supersede returns ids and titles, not full packet bodies", async () => {
  const project = tempProject();
  const { oldId, replacementId } = captureTwoPackets(project);

  const result = await callTool("kage_supersede", { project_dir: project, packet_id: oldId, replacement_packet_id: replacementId, reason: "newer fact" });
  const payload = JSON.parse(textContent(result));

  assert.equal(payload.ok, true);
  assert.equal(payload.old_packet_id, oldId);
  assert.equal(payload.replacement_packet_id, replacementId);
  assert.equal(payload.old_packet_title, "Old fact about retries");
  assert.equal(payload.replacement_packet_title, "New fact about retries");
  assert.equal("old_packet" in payload, false, "full old_packet body must not be echoed back");
  assert.equal("replacement_packet" in payload, false, "full replacement_packet body must not be echoed back");
  assert.ok(Buffer.byteLength(textContent(result), "utf8") < 2_000, "supersede confirmation should be a few hundred bytes, not thousands");
});

test("kage supersede via the real CLI binary still prints the two summary lines it always has", () => {
  const project = tempProject();
  const { oldId, replacementId } = captureTwoPackets(project);

  const cli = runCli(["supersede", "--project", project, "--packet", oldId, "--replacement", replacementId, "--reason", "newer fact"]);
  assert.match(cli.stdout, /^Superseded memory: /m);
  assert.match(cli.stdout, /^Replacement: /m);
  assert.ok(!cli.stdout.includes("path_fingerprints"), "CLI's human-readable path never dumps packet internals either");
});

test("kage supersede --json via the real CLI binary still returns full packet bodies - unchanged by the MCP-only fix", () => {
  const project = tempProject();
  const { oldId, replacementId } = captureTwoPackets(project);

  const cli = runCli(["supersede", "--project", project, "--packet", oldId, "--replacement", replacementId, "--json"]);
  const payload = JSON.parse(cli.stdout);
  assert.equal(payload.old_packet.body, "The retry module used to retry three times before giving up.");
  assert.ok(payload.old_packet.freshness, "CLI --json output still carries the full packet, freshness included");
});

// ---------------------------------------------------------------------------
// kage_memory_lifecycle: measured 1,859,953 chars on the real Kage repo (433 packets) -
// the worst tool on the whole MCP surface, because `items` carried every packet's full
// `body` (1,050,730 of those chars alone). The CLI's non-JSON `lifecycle` command never
// prints `items` at all, only totals and recommendations, so this is pure MCP-only bloat.
// ---------------------------------------------------------------------------

test("kage_memory_lifecycle drops body/summary from items and caps the list with a true total", async () => {
  const project = tempProject();
  for (let i = 0; i < 15; i++) {
    const result = capture({
      projectDir: project,
      title: `Lifecycle fixture ${i}`,
      body: `Body prose for lifecycle fixture ${i}. `.repeat(20),
      type: "gotcha",
      paths: [`src/lifecycle-${i}.ts`],
    });
    assert.equal(result.ok, true);
  }

  const result = await callTool("kage_memory_lifecycle", { project_dir: project });
  const payload = JSON.parse(textContent(result));

  assert.ok(payload.items.length <= 10, `expected at most 10 items, got ${payload.items.length}`);
  assert.equal(payload.items_total, 15);
  assert.equal(payload.items_truncated, true);
  for (const item of payload.items) {
    assert.equal("body" in item, false, "item must not carry the full packet body");
    assert.equal("summary" in item, false, "item must not carry the packet summary either");
  }
  assert.ok(payload.response_notes.some((note: string) => note.includes("lifecycle items")));
});

// ---------------------------------------------------------------------------
// The remaining tools measured over 190,000 chars each on the real repo (kage_inbox
// 432,613; kage_memory_access 416,841; kage_memory_timeline 397,437; kage_quality
// 292,400; kage_conflicts 195,516), all from the same disease: one lean entry per
// packet/finding, uncapped across the whole repo.
// ---------------------------------------------------------------------------

test("kage_inbox caps items with a true total", async () => {
  const project = tempProject();
  seedLowQualityPackets(project, 20);
  const result = await callTool("kage_inbox", { project_dir: project });
  const payload = JSON.parse(textContent(result));
  assert.ok(payload.items.length <= 10);
  assert.ok(payload.items_total > 10);
  assert.equal(payload.items_truncated, true);
});

test("kage_memory_access caps entries with a true total", async () => {
  const project = tempProject();
  for (let i = 0; i < 20; i++) {
    assert.equal(capture({ projectDir: project, title: `Access fixture ${i}`, body: `Access fixture body ${i}.`, type: "gotcha", paths: [`src/access-${i}.ts`] }).ok, true);
  }
  const result = await callTool("kage_memory_access", { project_dir: project });
  const payload = JSON.parse(textContent(result));
  assert.ok(payload.entries.length <= 10);
  assert.equal(payload.entries_total, 20);
  assert.equal(payload.entries_truncated, true);
});

test("kage_memory_timeline caps entries with a true total", async () => {
  const project = tempProject();
  for (let i = 0; i < 20; i++) {
    assert.equal(capture({ projectDir: project, title: `Timeline fixture ${i}`, body: `Timeline fixture body ${i}.`, type: "gotcha", paths: [`src/timeline-${i}.ts`] }).ok, true);
  }
  const result = await callTool("kage_memory_timeline", { project_dir: project });
  const payload = JSON.parse(textContent(result));
  assert.ok(payload.entries.length <= 10);
  assert.equal(payload.entries_total, 20);
  assert.equal(payload.entries_truncated, true);
});

test("kage_quality caps packets with a true total", async () => {
  const project = tempProject();
  seedLowQualityPackets(project, 20);
  const result = await callTool("kage_quality", { project_dir: project });
  const payload = JSON.parse(textContent(result));
  assert.ok(payload.packets.length <= 10);
  assert.equal(payload.packets_total, 20);
  assert.equal(payload.packets_truncated, true);
});

test("kage_conflicts caps pairs with a true total", async () => {
  const project = tempProject();
  // Two packets citing the same path with opposing claims trip detectContradictions.
  for (let i = 0; i < 8; i++) {
    assert.equal(capture({ projectDir: project, title: `Retries are synchronous ${i}`, body: `The retry queue at src/shared-${i}.ts always runs synchronously, never async.`, type: "decision", paths: [`src/shared-${i}.ts`] }).ok, true);
    assert.equal(capture({ projectDir: project, title: `Retries are asynchronous ${i}`, body: `The retry queue at src/shared-${i}.ts always runs asynchronously, never sync.`, type: "decision", paths: [`src/shared-${i}.ts`] }).ok, true);
  }
  const result = await callTool("kage_conflicts", { project_dir: project });
  const payload = JSON.parse(textContent(result));
  if (payload.pairs_total > 10) {
    assert.ok(payload.pairs.length <= 10);
    assert.equal(payload.pairs_truncated, true);
  } else {
    // Contradiction detection is heuristic; assert the capping fields exist and are
    // consistent even when this fixture doesn't happen to cross the default limit.
    assert.equal(payload.pairs.length, payload.pairs_total);
    assert.equal(payload.pairs_truncated, false);
  }
});
