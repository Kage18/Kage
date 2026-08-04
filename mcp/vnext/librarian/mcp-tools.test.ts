import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LIBRARIAN_TOOL_DEFINITIONS, callLibrarianTool } from "./mcp-tools.js";
import { approve, ingestProposals, storeFor } from "./operations.js";
import { readReceipts } from "./receipts.js";
import { listCards } from "./store.js";
import type { CardProposal, Provenance } from "./types.js";

const GIT = ["-c", "user.email=t@t.dev", "-c", "user.name=T"];
const PROVENANCE: Provenance = { source: "session", ref: "s-1", at: "2026-08-04T10:00:00.000Z" };
const NOW = () => new Date("2026-08-04T12:00:00.000Z");

/** A scratch product repo plus its own isolated store root — never the real ~/.kage. */
function scratch(): { projectDir: string; storeRoot: string } {
  const projectDir = mkdtempSync(join(tmpdir(), "kage-tools-repo-"));
  const storeRoot = mkdtempSync(join(tmpdir(), "kage-tools-store-"));
  mkdirSync(join(projectDir, "src"), { recursive: true });
  writeFileSync(
    join(projectDir, "src", "limits.ts"),
    "export const tenantLimit = 100;\nexport function withinLimit(n: number) { return n < tenantLimit; }\n",
  );
  writeFileSync(join(projectDir, "src", "retry.ts"), "export const backoffMs = [100, 200, 400];\n");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });
  execFileSync("git", [...GIT, "add", "-A"], { cwd: projectDir });
  execFileSync("git", [...GIT, "commit", "-qm", "initial"], { cwd: projectDir });
  return { projectDir, storeRoot };
}

function proposal(overrides: Partial<CardProposal> = {}): CardProposal {
  return {
    kind: "caution",
    title: "the tenant limit comparison is exclusive on purpose",
    claim: "withinLimit uses < rather than <= so a tenant at exactly the limit is refused; two commits flipped it and both were reverted.",
    citations: [{ path: "src/limits.ts", symbol: "withinLimit" }],
    trigger: "editing the tenant limit check",
    ...overrides,
  };
}

/**
 * The blob sha a citation pins against right now — the same value verify.ts computes.
 *
 * Tests stamp it into the proposal because approval does not persist the pin it computes:
 * operations.approve re-pins, audits the re-pinned copy, then saves the verdict through
 * setVerifyState, which rewrites only `verify` and drops the citations it was holding. An
 * unpinned citation reads "unverified" forever, so the flagship stamp needs a real pin to exist.
 */
function pin(projectDir: string, relPath: string): string {
  return execFileSync("git", ["hash-object", "--", relPath], { cwd: projectDir, encoding: "utf8" }).trim();
}

/** Propose and approve in one step — the state every recall test needs to start from. */
function approvedCard(projectDir: string, storeRoot: string, overrides: Partial<CardProposal> = {}): string {
  const store = storeFor(projectDir, storeRoot);
  const summary = ingestProposals(store, [proposal(overrides)], PROVENANCE);
  assert.equal(summary.rejected, 0, summary.problems.join("; "));
  const id = listCards(store, { state: "proposed" })[0].id;
  const result = approve(store, projectDir, id, "kushal");
  assert.equal(result.ok, true);
  return id;
}

async function call(name: string, args: Record<string, unknown>, storeRoot: string): Promise<string> {
  const result = await callLibrarianTool(name, args, { storeRoot, now: NOW });
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, "text");
  return result.content[0].text;
}

// ── The definitions ──────────────────────────────────────────────────────────────────────────

test("the surface is exactly three tools, each with a project_dir it cannot work without", () => {
  assert.deepEqual(
    LIBRARIAN_TOOL_DEFINITIONS.map((tool) => tool.name),
    ["kage_recall", "kage_remember", "kage_cards"],
  );
  for (const tool of LIBRARIAN_TOOL_DEFINITIONS) {
    const schema = tool.inputSchema as { properties: Record<string, unknown>; required: string[] };
    assert.ok(schema.properties.project_dir, `${tool.name} must take project_dir`);
    assert.ok(schema.required.includes("project_dir"), `${tool.name} must require project_dir`);
    assert.ok(tool.description.length > 80, `${tool.name} needs a description an agent can decide from`);
  }
});

// ── kage_recall ──────────────────────────────────────────────────────────────────────────────

test("recall hands the agent the claim, its citations, and the sha it was verified against", async () => {
  const { projectDir, storeRoot } = scratch();
  const id = approvedCard(projectDir, storeRoot, {
    citations: [{ path: "src/limits.ts", symbol: "withinLimit", blobSha: pin(projectDir, "src/limits.ts") }],
  });

  const text = await call("kage_recall", { project_dir: projectDir, files: ["src/limits.ts"] }, storeRoot);

  assert.match(text, /the tenant limit comparison is exclusive on purpose/);
  assert.match(text, new RegExp(id));
  // The citation is what makes the claim checkable rather than a rumour.
  assert.match(text, /cites: src\/limits\.ts#withinLimit/);
  // The stamp names the exact bytes the claim was held to — "verified" alone is an assertion.
  assert.match(text, /trust: verified against [0-9a-f]{7}/);
  assert.match(text, /why:\s+cites src\/limits\.ts/);
});

test("a file whose bytes moved since approval is served as a lead, not as a fact", async () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot, {
    citations: [{ path: "src/limits.ts", symbol: "withinLimit", blobSha: pin(projectDir, "src/limits.ts") }],
  });

  // The symbol survives, so the card is not stale — but the file drifted from its pin. The store
  // still says "verified"; only a reading taken at serve time can tell the agent otherwise.
  writeFileSync(
    join(projectDir, "src", "limits.ts"),
    "export const tenantLimit = 250;\nexport function withinLimit(n: number) { return n < tenantLimit; }\n",
  );

  const text = await call("kage_recall", { project_dir: projectDir, files: ["src/limits.ts"] }, storeRoot);
  assert.match(text, /trust: unverified — the cited file changed since this was checked/);
  assert.doesNotMatch(text, /verified against/);
});

// Verification is an act, not an assumption (verify.ts): a citation nothing was ever checked
// against cannot be reported as checked, however confidently the card's stored field reads.
test("a card whose citation was never pinned is served as a lead too", async () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot, { citations: [{ path: "src/limits.ts", symbol: "withinLimit" }] });

  const text = await call("kage_recall", { project_dir: projectDir, files: ["src/limits.ts"] }, storeRoot);
  assert.match(text, /trust: unverified/);
});

// The hardest rule in the product, at the surface where breaking it would mislead an agent.
test("a stale card never reaches the agent's text, and its withholding is still counted out loud", async () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);

  // The cited symbol is deleted AFTER approval and no sweep has run: the store still reads
  // "verified", so only a live audit at serve time can catch this.
  writeFileSync(join(projectDir, "src", "limits.ts"), "export const tenantLimit = 100;\n");

  const text = await call("kage_recall", { project_dir: projectDir, files: ["src/limits.ts"] }, storeRoot);

  assert.doesNotMatch(text, /exclusive on purpose/, "a stale claim must not reach the agent by any route");
  assert.doesNotMatch(text, /withinLimit uses </);
  // But the count is said: a silently shrinking answer is indistinguishable from an empty store.
  assert.match(text, /Withheld 1 stale card/);
  assert.match(text, /No approved card covers this action/);
});

test("every card an agent is served leaves a counted receipt, and every withholding leaves one too", async () => {
  const { projectDir, storeRoot } = scratch();
  const first = approvedCard(projectDir, storeRoot);
  const second = approvedCard(projectDir, storeRoot, {
    kind: "decision",
    title: "the retry backoff doubles by design",
    claim: "backoffMs doubles because the upstream rate limiter buckets per second; a flat backoff regressed twice.",
    citations: [{ path: "src/retry.ts", symbol: "backoffMs" }],
    trigger: "changing retry timing",
  });

  await call("kage_recall", { project_dir: projectDir, files: ["src/limits.ts", "src/retry.ts"] }, storeRoot);

  const store = storeFor(projectDir, storeRoot);
  const servedIds = readReceipts(store.dir)
    .filter((event) => event.type === "recall_served")
    .map((event) => event.cardId)
    .sort();
  assert.deepEqual(servedIds, [first, second].sort(), "one receipt per served card, no more and no less");

  // Now break one card and ask again: the refusal is an event too, or the product's own
  // "stale caught" number would only ever count what the sweep happened to notice.
  writeFileSync(join(projectDir, "src", "limits.ts"), "export const tenantLimit = 100;\n");
  await call("kage_recall", { project_dir: projectDir, files: ["src/limits.ts"] }, storeRoot);
  const withheld = readReceipts(store.dir).filter((event) => event.type === "stale_withheld");
  assert.equal(withheld.length, 1);
  assert.equal(withheld[0].cardId, first);
});

test("recall that matches nothing reads as one plain sentence, not an apology or a guess", async () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);

  const text = await call(
    "kage_recall",
    { project_dir: projectDir, files: ["docs/README.md"], query: "changelog formatting" },
    storeRoot,
  );
  assert.equal(text, "No approved card covers this action.");
});

test("recall with neither a query nor files refuses rather than dumping the store", async () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);

  const text = await call("kage_recall", { project_dir: projectDir }, storeRoot);
  assert.match(text, /needs a query or files/);
  assert.doesNotMatch(text, /exclusive on purpose/);
});

test("the serve limit is a budget, and a comma-joined files string is still read as files", async () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);
  approvedCard(projectDir, storeRoot, {
    kind: "decision",
    title: "the retry backoff doubles by design",
    claim: "backoffMs doubles because the upstream rate limiter buckets per second.",
    citations: [{ path: "src/retry.ts", symbol: "backoffMs" }],
    trigger: "changing retry timing",
  });

  const text = await call(
    "kage_recall",
    { project_dir: projectDir, files: "src/limits.ts,src/retry.ts", limit: 1 },
    storeRoot,
  );
  assert.match(text, /Kage — 1 approved card for this action/);
});

// ── kage_remember ────────────────────────────────────────────────────────────────────────────

test("remember puts an agent's own claim in the review queue, not into team knowledge", async () => {
  const { projectDir, storeRoot } = scratch();

  const text = await call(
    "kage_remember",
    {
      project_dir: projectDir,
      kind: "decision",
      title: "the tenant limit stays exclusive",
      claim: "We keep < rather than <= after the second revert; the billing test suite depends on it.",
      citations: [{ path: "src/limits.ts", symbol: "withinLimit" }],
      trigger: "editing the tenant limit check",
      session_id: "sess-42",
    },
    storeRoot,
  );

  assert.match(text, /Proposed card_[0-9a-f]{8}/);
  assert.match(text, /review queue/);
  assert.match(text, /A human approves cards/);

  const store = storeFor(projectDir, storeRoot);
  const cards = listCards(store);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].state, "proposed", "an agent's claim is a proposal, never approved knowledge");
  assert.equal(cards[0].provenance.ref, "sess-42");
  assert.equal(cards[0].provenance.source, "session");
});

// The gate's reasons are the only feedback the agent gets. Paraphrasing them makes the retry a guess.
test("a citation-less claim comes back with the validator's reason verbatim", async () => {
  const { projectDir, storeRoot } = scratch();

  const text = await call(
    "kage_remember",
    {
      project_dir: projectDir,
      kind: "decision",
      title: "we should probably keep things simple",
      claim: "Simplicity is good and the team agrees.",
      citations: [],
      trigger: "always",
    },
    storeRoot,
  );

  assert.match(text, /Refused by the gate/);
  assert.match(text, /a card that cites nothing cannot exist/);
  assert.match(text, /send it again/);
  assert.equal(listCards(storeFor(projectDir, storeRoot)).length, 0, "a refused proposal leaves no trace");
});

test("a claim carrying a secret is refused with the pattern named", async () => {
  const { projectDir, storeRoot } = scratch();

  const text = await call(
    "kage_remember",
    {
      project_dir: projectDir,
      kind: "runbook",
      title: "how to run the importer",
      // AWS's own documented example key — the point is the shape, not the value.
      claim: "Export AKIAIOSFODNN7EXAMPLE before running the importer against staging.",
      citations: [{ path: "src/limits.ts" }],
      trigger: "running the importer",
    },
    storeRoot,
  );

  assert.match(text, /Refused by the gate/);
  assert.match(text, /secret detected: aws access key/);
  assert.equal(listCards(storeFor(projectDir, storeRoot)).length, 0);
});

test("an unknown kind is reported as the gate's problem, not silently corrected", async () => {
  const { projectDir, storeRoot } = scratch();

  const text = await call(
    "kage_remember",
    {
      project_dir: projectDir,
      kind: "gotcha",
      title: "the tenant limit is exclusive",
      claim: "withinLimit uses < on purpose.",
      citations: ["src/limits.ts"],
      trigger: "editing limits",
    },
    storeRoot,
  );
  assert.match(text, /kind must be one of decision, runbook, caution/);
});

test("the same claim twice is already known, and writes no second card", async () => {
  const { projectDir, storeRoot } = scratch();
  const args = {
    project_dir: projectDir,
    kind: "caution",
    title: "the tenant limit comparison is exclusive on purpose",
    claim: "withinLimit uses < rather than <= so a tenant at exactly the limit is refused.",
    // A bare string citation: agents send these constantly, and refusing on the technicality
    // would cost a round trip that teaches nothing about the claim.
    citations: ["src/limits.ts"],
    trigger: "editing the tenant limit check",
  };

  assert.match(await call("kage_remember", args, storeRoot), /Proposed card_/);
  const second = await call("kage_remember", args, storeRoot);
  assert.match(second, /Already known — card_[0-9a-f]{8} holds this exact claim \(proposed\)/);
  assert.equal(listCards(storeFor(projectDir, storeRoot)).length, 1);
});

// ── kage_cards ───────────────────────────────────────────────────────────────────────────────

test("cards lists what the team believes and counts what is still waiting on a human", async () => {
  const { projectDir, storeRoot } = scratch();
  const approved = approvedCard(projectDir, storeRoot);
  ingestProposals(
    storeFor(projectDir, storeRoot),
    [proposal({ title: "an unreviewed suggestion", claim: "backoffMs doubles by design.", citations: [{ path: "src/retry.ts" }] })],
    PROVENANCE,
  );

  const text = await call("kage_cards", { project_dir: projectDir }, storeRoot);
  assert.match(text, /1 approved card:/);
  assert.match(text, new RegExp(approved));
  assert.doesNotMatch(text, /an unreviewed suggestion/, "a proposal is not something the team believes");
  assert.match(text, /1 card proposed and waiting on a human/);
});

test("an empty store says it is empty, and says nothing is being withheld", async () => {
  const { projectDir, storeRoot } = scratch();
  const text = await call("kage_cards", { project_dir: projectDir }, storeRoot);
  assert.match(text, /no approved cards yet/);
  assert.match(text, /Nothing is being withheld/);
});

test("an unknown filter value is named, so 'nothing' never reads as 'this repo has none'", async () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);

  assert.match(
    await call("kage_cards", { project_dir: projectDir, state: "pending" }, storeRoot),
    /does not know the state 'pending'.*proposed, approved, superseded, retired/s,
  );
  assert.match(
    await call("kage_cards", { project_dir: projectDir, kind: "gotcha" }, storeRoot),
    /does not know the kind 'gotcha'/,
  );
});

// ── Degrading honestly ───────────────────────────────────────────────────────────────────────

test("an unknown tool name is a sentence naming the real ones, not a throw", async () => {
  const { storeRoot } = scratch();
  const text = await call("kage_frobnicate", { project_dir: "/nowhere" }, storeRoot);
  assert.match(text, /kage_frobnicate is not one of the Kage card tools/);
  assert.match(text, /kage_recall, kage_remember, kage_cards/);
});

test("a missing or bogus project_dir is a sentence, and leaves no store behind", async () => {
  const { storeRoot } = scratch();

  const missing = await call("kage_recall", { query: "limits" }, storeRoot);
  assert.match(missing, /kage_recall needs project_dir/);

  const bogus = await call(
    "kage_cards",
    { project_dir: join(tmpdir(), "kage-tools-does-not-exist-9d3f") },
    storeRoot,
  );
  assert.match(bogus, /is not a directory on this machine/);

  // The check runs before storeFor, which CREATES and git-inits a directory: a typo must never
  // leave a store behind, least of all one attributed to the process's cwd.
  assert.deepEqual(readdirSync(storeRoot), []);
});

test("a project that stopped being a directory mid-flight reports, it does not crash", async () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);
  rmSync(projectDir, { recursive: true, force: true });

  const text = await call("kage_recall", { project_dir: projectDir, files: ["src/limits.ts"] }, storeRoot);
  // Whatever it says, it says something: a memory tool must never take a session down with it.
  assert.ok(text.length > 0);
  assert.doesNotMatch(text, /exclusive on purpose/, "no claim can be verified against a tree that is gone");
});
