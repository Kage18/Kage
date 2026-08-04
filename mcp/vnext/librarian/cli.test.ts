import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCardsCommand, type CardsCliDeps } from "./cli.js";
import { fakeProvider } from "./provider.js";
import type { Card } from "./types.js";

const GIT = ["-c", "user.email=t@t.dev", "-c", "user.name=T"];

/** Frozen so the relative ages this surface prints are assertable rather than wall-clock. */
const NOW = () => new Date("2026-08-04T12:00:00.000Z");

interface Scratch {
  projectDir: string;
  storeRoot: string;
}

/** A real git repo to mine, plus its own store root — never the operator's real ~/.kage. */
function scratch(): Scratch {
  const projectDir = mkdtempSync(join(tmpdir(), "kage-cards-cli-repo-"));
  const storeRoot = mkdtempSync(join(tmpdir(), "kage-cards-cli-store-"));
  mkdirSync(join(projectDir, "src"), { recursive: true });
  writeFileSync(
    join(projectDir, "src", "limits.ts"),
    "export const tenantLimit = 100;\nexport function withinLimit(n: number) { return n < tenantLimit; }\n",
  );
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });
  execFileSync("git", [...GIT, "add", "-A"], { cwd: projectDir });
  execFileSync("git", [...GIT, "commit", "-qm", "initial"], { cwd: projectDir });
  return { projectDir, storeRoot };
}

/** What a Librarian mining run replies with — one admissible card citing a file that exists. */
const MINED = JSON.stringify([
  {
    kind: "caution",
    title: "tenantLimit comparison is exclusive on purpose",
    claim: "withinLimit uses < rather than <= so a tenant at exactly the limit is refused; two commits flipped it and both were reverted.",
    citations: [{ path: "src/limits.ts", symbol: "withinLimit" }],
    trigger: "editing tenant limits in src/limits.ts",
  },
]);

function cli(dirs: Scratch, argv: string[], extra: CardsCliDeps = {}) {
  return runCardsCommand(argv, dirs.projectDir, { storeRoot: dirs.storeRoot, now: NOW, ...extra });
}

/** Mine one card and hand back its id — the setup nearly every verb below needs. */
async function mineOne(dirs: Scratch): Promise<string> {
  const mined = await cli(dirs, ["mine"], { provider: fakeProvider([MINED]) });
  assert.equal(mined.exitCode, 0, mined.out);
  const listed = await cli(dirs, ["list", "--json"]);
  const cards = JSON.parse(listed.out) as Card[];
  assert.equal(cards.length, 1, "the scripted reply proposes exactly one card");
  return cards[0].id;
}

// ── Listing ──────────────────────────────────────────────────────────────────────────────────

test("an empty store lists as an invitation to mine, not as an error", async () => {
  const dirs = scratch();
  const result = await cli(dirs, []);
  assert.equal(result.exitCode, 0);
  assert.match(result.out, /No cards yet/);
  assert.match(result.out, /kage cards mine/, "an empty surface offers the action that fills it");
});

test("a bad --state is refused rather than silently listing nothing", async () => {
  const dirs = scratch();
  const result = await cli(dirs, ["list", "--state", "pending"]);
  assert.equal(result.exitCode, 1);
  assert.match(result.out, /Unknown --state 'pending'/);
  assert.match(result.out, /proposed/, "the refusal names the states that do exist");
});

// ── Mining ───────────────────────────────────────────────────────────────────────────────────

test("mining proposes from the repo's own history and the proposals show up in the listing", async () => {
  const dirs = scratch();
  const mined = await cli(dirs, ["mine"], { provider: fakeProvider([MINED]) });
  assert.equal(mined.exitCode, 0);
  assert.match(mined.out, /1 proposed/);
  assert.match(mined.out, /already known/, "dedupe is reported separately from refusal");
  assert.match(mined.out, /kage cards list --state proposed/);

  const listed = await cli(dirs, ["list"]);
  assert.match(listed.out, /^proposed \(1\)$/m, "grouped by state, inbox first");
  assert.match(listed.out, /card_[0-9a-f]{8}\s+caution\s+tenantLimit comparison/, "id leads the line");
});

// The old product died of an estimated headline. A run whose usage was never reported says so.
test("a mining run with no measured usage says so instead of printing zero tokens", async () => {
  const dirs = scratch();
  const mined = await cli(dirs, ["mine"], { provider: fakeProvider([MINED]) });
  assert.match(mined.out, /token usage not measured/);
  assert.doesNotMatch(mined.out, /tokens 0/);
});

test("a failing Librarian makes mining a nonzero report, never a crash", async () => {
  const dirs = scratch();
  const result = await cli(dirs, ["mine"], {
    provider: { complete: () => Promise.reject(new Error("claude is not installed")) },
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.out, /Mining failed: .*not installed/);
});

// ── The gate ─────────────────────────────────────────────────────────────────────────────────

test("approving moves the card to approved and puts its claim in the repo's BRIEF", async () => {
  const dirs = scratch();
  const id = await mineOne(dirs);

  const approved = await cli(dirs, ["approve", id, "--note", "the reverts make the case"]);
  assert.equal(approved.exitCode, 0);
  assert.match(approved.out, new RegExp(`Approved ${id}`));
  assert.match(approved.out, /verified/, "a card approved today reads verified today");
  assert.match(approved.out, /BRIEF: .*AGENTS\.md \(1 card\)/, "the count is what reached the file");

  const listed = await cli(dirs, ["list"]);
  assert.match(listed.out, /^approved \(1\)$/m);

  const brief = readFileSync(join(dirs.projectDir, "AGENTS.md"), "utf8");
  assert.ok(existsSync(join(dirs.projectDir, "AGENTS.md")));
  assert.match(brief, /<!-- kage:begin -->/);
  assert.match(brief, /tenantLimit comparison is exclusive/);
});

test("a rejection without a reason is refused, because the reason is the only thing it teaches", async () => {
  const dirs = scratch();
  const id = await mineOne(dirs);

  const missing = await cli(dirs, ["reject", id]);
  assert.equal(missing.exitCode, 1);
  assert.match(missing.out, /--reason/);

  // A flag in the value position is not a reason either — recording "--json" as the reviewer's
  // reasoning would be worse than refusing.
  const flagAsReason = await cli(dirs, ["reject", id, "--reason", "--json"]);
  assert.equal(flagAsReason.exitCode, 1);

  const stillProposed = await cli(dirs, ["list", "--json"]);
  assert.equal((JSON.parse(stillProposed.out) as Card[])[0].state, "proposed");

  const rejected = await cli(dirs, ["reject", id, "--reason", "derivable from the code"]);
  assert.equal(rejected.exitCode, 0);
  assert.match(rejected.out, /derivable from the code/);
  assert.equal((JSON.parse((await cli(dirs, ["list", "--json"])).out) as Card[])[0].state, "retired");
});

test("showing a card prints the claim, the pinned citation, the trigger and the provenance", async () => {
  const dirs = scratch();
  const id = await mineOne(dirs);
  const shown = await cli(dirs, ["show", id]);
  assert.equal(shown.exitCode, 0);
  assert.match(shown.out, /withinLimit uses < rather than <=/);
  assert.match(shown.out, /Trigger\s+editing tenant limits/);
  assert.match(shown.out, /src\/limits\.ts#withinLimit\s+pinned —/, "an unchecked citation shows a dash, not a fake sha");
  assert.match(shown.out, /Provenance\s+mining · history:/);
});

test("showing a card that does not exist is a refusal, not an empty page", async () => {
  const dirs = scratch();
  const result = await cli(dirs, ["show", "card_deadbeef"]);
  assert.equal(result.exitCode, 1);
  assert.match(result.out, /No card card_deadbeef/);
});

// ── Recall — the withholding is the product ──────────────────────────────────────────────────

test("recall prints what would be served, with the why that earned it", async () => {
  const dirs = scratch();
  const id = await mineOne(dirs);
  await cli(dirs, ["approve", id]);

  const result = await cli(dirs, ["recall", "raising the tenant limit", "--files", "src/limits.ts"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.out, /Served 1/);
  assert.match(result.out, new RegExp(id));
  assert.match(result.out, /why: cites src\/limits\.ts/);
});

// A silent omission is indistinguishable from ignorance, so the withheld card gets its own
// section and its own reason.
test("recall prints withheld stale cards in their own section with the reason", async () => {
  const dirs = scratch();
  const id = await mineOne(dirs);
  await cli(dirs, ["approve", id]);

  // The cited symbol is gone; the claim is now about code that no longer exists.
  writeFileSync(join(dirs.projectDir, "src", "limits.ts"), "export const tenantLimit = 100;\n");
  const swept = await cli(dirs, ["verify"]);
  assert.match(swept.out, /1 stale/);
  assert.match(swept.out, /withheld from recall/);

  const result = await cli(dirs, ["recall", "raising the tenant limit", "--files", "src/limits.ts"]);
  assert.equal(result.exitCode, 0);
  assert.match(result.out, /Served nothing/);
  assert.match(result.out, /Withheld 1 — stale/);
  assert.match(result.out, new RegExp(`Withheld[\\s\\S]*${id}`), "the withheld card is named, not just counted");
});

test("recall with neither a query nor files refuses instead of dumping the store", async () => {
  const dirs = scratch();
  const result = await cli(dirs, ["recall"]);
  assert.equal(result.exitCode, 1);
  assert.match(result.out, /needs a query or --files/);
});

// ── Receipts and the BRIEF ───────────────────────────────────────────────────────────────────

test("receipts count events and never invent the ones that have not happened", async () => {
  const dirs = scratch();
  const empty = await cli(dirs, ["receipts"]);
  assert.equal(empty.exitCode, 0);
  assert.match(empty.out, /Nothing counted yet/);

  const id = await mineOne(dirs);
  await cli(dirs, ["approve", id]);
  const result = await cli(dirs, ["receipts"]);
  assert.match(result.out, /card_proposed\s+1/);
  assert.match(result.out, /card_approved\s+1/);
  assert.doesNotMatch(result.out, /recall_served/, "a type with no events is absent, never a zero");
});

test("brief reports where the block landed and how many cards reached it", async () => {
  const dirs = scratch();
  const empty = await cli(dirs, ["brief"]);
  assert.match(empty.out, /AGENTS\.md — no approved cards reached the file yet/);

  const id = await mineOne(dirs);
  await cli(dirs, ["approve", id]);
  assert.match((await cli(dirs, ["brief"])).out, /AGENTS\.md — 1 card\./);
});

// ── The dispatcher itself ────────────────────────────────────────────────────────────────────

test("an unknown subcommand answers with the whole verb list and a nonzero status", async () => {
  const dirs = scratch();
  const result = await cli(dirs, ["approv"]);
  assert.equal(result.exitCode, 1);
  assert.match(result.out, /Unknown subcommand 'approv'/);
  for (const verb of ["list", "show", "approve", "reject", "mine", "verify", "brief", "recall", "receipts"]) {
    assert.match(result.out, new RegExp(`kage cards ${verb}`), `usage names ${verb}`);
  }
});

test("a typo does not leave a store behind", async () => {
  const dirs = scratch();
  await cli(dirs, ["mien"]);
  assert.equal(existsSync(join(dirs.storeRoot)), true);
  assert.deepEqual(
    execFileSync("ls", [dirs.storeRoot], { encoding: "utf8" }).trim(),
    "",
    "openStore git-inits a directory; an unrecognized verb must not cause one",
  );
});

test("--json parses for every subcommand that offers it", async () => {
  const dirs = scratch();
  const mined = await cli(dirs, ["mine", "--json"], { provider: fakeProvider([MINED]) });
  assert.equal(mined.exitCode, 0);
  assert.equal((JSON.parse(mined.out) as { proposed: number }).proposed, 1);

  const cards = JSON.parse((await cli(dirs, ["list", "--json"])).out) as Card[];
  const id = cards[0].id;
  assert.equal(JSON.parse((await cli(dirs, ["show", id, "--json"])).out).id, id);

  await cli(dirs, ["approve", id]);

  const sweep = JSON.parse((await cli(dirs, ["verify", "--json"])).out) as Record<string, number>;
  assert.deepEqual(Object.keys(sweep).sort(), ["checked", "stale", "unverified", "verified"]);

  const brief = JSON.parse((await cli(dirs, ["brief", "--json"])).out) as { path: string; cards: number };
  assert.match(brief.path, /AGENTS\.md$/);
  assert.equal(brief.cards, 1);

  const recall = JSON.parse((await cli(dirs, ["recall", "tenant limit", "--json"])).out) as {
    query: string;
    served: unknown[];
    withheld: unknown[];
  };
  assert.equal(recall.query, "tenant limit");
  assert.equal(recall.served.length, 1);
  assert.deepEqual(recall.withheld, []);

  const receipts = JSON.parse((await cli(dirs, ["receipts", "--json"])).out) as {
    counts: Record<string, number>;
    recent: unknown[];
  };
  assert.equal(receipts.counts.card_approved, 1);
  assert.ok(receipts.recent.length >= 2);
});
