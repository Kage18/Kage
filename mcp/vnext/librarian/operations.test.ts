import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { approve, ingestProposals, mineRepository, refreshBrief, reject, storeFor, verifySweep } from "./operations.js";
import { fakeProvider } from "./provider.js";
import { listCards } from "./store.js";
import { readReceipts } from "./receipts.js";
import type { CardProposal, Provenance } from "./types.js";

const GIT = ["-c", "user.email=t@t.dev", "-c", "user.name=T"];

/** A scratch product repo plus its own isolated store root — never the real ~/.kage. */
function scratch(): { projectDir: string; storeRoot: string } {
  const projectDir = mkdtempSync(join(tmpdir(), "kage-ops-repo-"));
  const storeRoot = mkdtempSync(join(tmpdir(), "kage-ops-store-"));
  mkdirSync(join(projectDir, "src"), { recursive: true });
  writeFileSync(join(projectDir, "src", "limits.ts"), "export const tenantLimit = 100;\nexport function withinLimit(n: number) { return n < tenantLimit; }\n");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });
  execFileSync("git", [...GIT, "add", "-A"], { cwd: projectDir });
  execFileSync("git", [...GIT, "commit", "-qm", "initial"], { cwd: projectDir });
  return { projectDir, storeRoot };
}

function proposal(overrides: Partial<CardProposal> = {}): CardProposal {
  return {
    kind: "caution",
    title: "tenantLimit comparison is exclusive on purpose",
    claim: "withinLimit uses < rather than <= so a tenant at exactly the limit is refused.",
    citations: [{ path: "src/limits.ts", symbol: "withinLimit" }],
    trigger: "editing src/limits.ts",
    ...overrides,
  };
}

const PROVENANCE: Provenance = { source: "session", ref: "s-1", at: "2026-08-04T10:00:00.000Z" };

test("ingest counts 'already knew that' separately from 'the gate refused this'", () => {
  const { projectDir, storeRoot } = scratch();
  const store = storeFor(projectDir, storeRoot);

  const first = ingestProposals(store, [proposal()], PROVENANCE);
  assert.equal(first.proposed, 1);

  // The same claim again is the system working; a citation-less card is a quality signal about
  // the extractor. Fusing them into one number would hide whichever is degrading.
  const second = ingestProposals(store, [proposal(), proposal({ title: "no citations", citations: [] })], PROVENANCE);
  assert.equal(second.deduped, 1);
  assert.equal(second.rejected, 1);
  assert.equal(second.proposed, 0);
  assert.match(second.problems[0], /cites nothing/);
});

// Approval is not one write. If any surface assembled this sequence itself, two surfaces would
// eventually assemble it differently.
test("approving re-pins, verifies, receipts, and refreshes the brief in one act", () => {
  const { projectDir, storeRoot } = scratch();
  const store = storeFor(projectDir, storeRoot);
  const { proposed } = ingestProposals(store, [proposal()], PROVENANCE);
  assert.equal(proposed, 1);
  const id = listCards(store)[0].id;

  const result = approve(store, projectDir, id, "kushal");
  assert.equal(result.ok, true);
  // Pinned at approval time against the tree as it stands now, so a card approved today reads
  // verified today rather than arriving already drifted.
  assert.equal(result.card?.verify, "verified");
  assert.equal(result.card?.state, "approved");

  const brief = readFileSync(join(projectDir, "AGENTS.md"), "utf8");
  assert.match(brief, /kage:begin/);
  assert.match(brief, /tenantLimit comparison is exclusive/);

  const types = readReceipts(store.dir).map((event) => event.type);
  assert.ok(types.includes("card_approved"));
  assert.ok(types.includes("card_proposed"));
});

test("an illegal approval is an error, not a thrown exception", () => {
  const { projectDir, storeRoot } = scratch();
  const store = storeFor(projectDir, storeRoot);
  const outcome = approve(store, projectDir, "card_doesnotexist", "kushal");
  assert.equal(outcome.ok, false);
  assert.ok(outcome.error);
});

test("rejecting retires the card with its reason and leaves the brief alone", () => {
  const { projectDir, storeRoot } = scratch();
  const store = storeFor(projectDir, storeRoot);
  ingestProposals(store, [proposal()], PROVENANCE);
  const id = listCards(store)[0].id;

  const outcome = reject(store, id, "kushal", "derivable from the code");
  assert.equal(outcome.ok, true);
  assert.equal(outcome.card?.state, "retired");
  assert.equal(listCards(store, { state: "approved" }).length, 0);
});

// The hardest rule in the product, at the surface that enforces it: a claim whose code moved
// must stop being served before it misleads anyone.
test("a sweep catches a card whose cited symbol vanished and pulls it from the brief", () => {
  const { projectDir, storeRoot } = scratch();
  const store = storeFor(projectDir, storeRoot);
  ingestProposals(store, [proposal()], PROVENANCE);
  const id = listCards(store)[0].id;
  approve(store, projectDir, id, "kushal");
  assert.match(readFileSync(join(projectDir, "AGENTS.md"), "utf8"), /tenantLimit comparison/);

  writeFileSync(join(projectDir, "src", "limits.ts"), "export const tenantLimit = 100;\n");
  const counts = verifySweep(store, projectDir);
  assert.equal(counts.stale, 1);
  assert.equal(listCards(store)[0].verify, "stale");
  assert.doesNotMatch(
    readFileSync(join(projectDir, "AGENTS.md"), "utf8"),
    /tenantLimit comparison/,
    "a stale claim in the always-on brief would reach every session",
  );
});

test("the brief counts what reached the file, not what was approved", () => {
  const { projectDir, storeRoot } = scratch();
  const store = storeFor(projectDir, storeRoot);
  const { path, cards } = refreshBrief(store, projectDir);
  assert.equal(path, join(projectDir, "AGENTS.md"));
  assert.equal(cards, 0);
});

// ── Mining ───────────────────────────────────────────────────────────────────────────────────

test("mining ingests the Librarian's proposals and reports measured usage", async () => {
  const { projectDir, storeRoot } = scratch();
  const store = storeFor(projectDir, storeRoot);
  const provider = fakeProvider([
    JSON.stringify([
      {
        kind: "caution",
        title: "the limit comparison was reverted twice",
        claim: "Two commits flipped withinLimit to <= and both were reverted.",
        citations: [{ path: "src/limits.ts" }],
        trigger: "changing the limit comparison",
      },
    ]),
  ]);

  const summary = await mineRepository(provider, store, projectDir);
  assert.equal(summary.ok, true);
  assert.equal(summary.proposed, 1);
  assert.ok(summary.commits >= 1);
  assert.ok(readReceipts(store.dir).some((event) => event.type === "mining_run"));
});

// Measured on this repository: a second `kage cards mine` proposed 10 fresh cards and reported
// "0 already known". The store's content address only catches what reaches proposeCard, and the
// miner's reconciler now recognises a re-mine before that — so the count has to span both, or
// the CLI's "already known" column reads zero while the Inbox fills up.
test("a second mining run reports what it already knew instead of refilling the Inbox", async () => {
  const { projectDir, storeRoot } = scratch();
  const store = storeFor(projectDir, storeRoot);
  const mined = JSON.stringify([
    {
      kind: "caution",
      title: "the limit comparison was reverted twice",
      claim: "Two commits flipped withinLimit to <= and both were reverted.",
      citations: [{ path: "src/limits.ts" }],
      trigger: "changing the limit comparison",
    },
  ]);

  const first = await mineRepository(fakeProvider([mined]), store, projectDir);
  assert.equal(first.proposed, 1);
  assert.equal(first.deduped, 0);

  const second = await mineRepository(fakeProvider([mined]), store, projectDir);
  assert.equal(second.ok, true);
  assert.equal(second.proposed, 0, "nothing new was queued for review");
  assert.equal(second.deduped, 1, "the run says it already knew this");
  assert.equal(second.rejected, 0, "already known is not the gate refusing anything");
  assert.equal(listCards(store).length, 1, "and the store did not grow a near-sibling");
});

test("a genuinely new card still reaches the Inbox on a re-mine", async () => {
  const { projectDir, storeRoot } = scratch();
  const store = storeFor(projectDir, storeRoot);
  const first = {
    kind: "caution",
    title: "the limit comparison was reverted twice",
    claim: "Two commits flipped withinLimit to <= and both were reverted.",
    citations: [{ path: "src/limits.ts" }],
    trigger: "changing the limit comparison",
  };
  const second = {
    kind: "decision",
    title: "the tenant cap is a constant, not configuration",
    claim: "tenantLimit is a source constant so a change is reviewed like code rather than set at runtime.",
    citations: [{ path: "src/limits.ts" }],
    trigger: "making a limit configurable",
  };

  await mineRepository(fakeProvider([JSON.stringify([first])]), store, projectDir);
  // The same batch again plus one new finding, and one the gate must refuse: the three outcomes
  // have to stay three numbers, because each one degrades for a different reason.
  const summary = await mineRepository(
    fakeProvider([JSON.stringify([first, second, { ...first, title: "no citations", citations: [] }])]),
    store,
    projectDir,
  );

  assert.equal(summary.proposed, 1);
  assert.equal(summary.deduped, 1);
  assert.equal(summary.rejected, 1);
  assert.match(summary.problems[0], /cites nothing/);
  assert.equal(listCards(store).length, 2);
});

// The user pressed a button; they deserve to be told what happened to it.
test("a failing provider makes mining a report, never a crash", async () => {
  const { projectDir, storeRoot } = scratch();
  const store = storeFor(projectDir, storeRoot);
  const provider = {
    complete: () => Promise.reject(new Error("claude is not installed")),
  };

  const summary = await mineRepository(provider, store, projectDir);
  assert.equal(summary.ok, false);
  assert.match(summary.error ?? "", /not installed/);
  assert.equal(summary.proposed, 0);
});
