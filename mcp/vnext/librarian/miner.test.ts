import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { cardId } from "./card.js";
import { buildHistoryDigest, mineHistory, miningPrompt } from "./miner.js";

/** The same pinned identity the rest of this file uses, so machine git config is never assumed. */
const GIT_ID = ["-c", "user.email=t@t.dev", "-c", "user.name=T"];
import { fakeProvider } from "./provider.js";
import type { Card, CardProposal, CardState } from "./types.js";

// The miner is the answer to "a fresh install has no memory". Every test runs against a REAL
// scratch repo: the digest is git's output reshaped, so a faked git log would test our fixture
// rather than our reading of git. The provider is the only thing faked, because the one thing
// the miner must never do is depend on what a model happens to say.

const scratchDirs: string[] = [];
after(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

/** Identity is passed inline on every commit — the machine's git config is never assumed. */
function commit(dir: string, message: string): void {
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["-c", "user.email=t@t.dev", "-c", "user.name=T", "commit", "-q", "-m", message], {
    cwd: dir,
  });
}

/**
 * Three commits, the last of which is a revert — the shape the miner exists to find. retry.ts is
 * touched twice and config.ts once, so the hot-file ordering is decided, not incidental.
 */
function scratchRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-miner-"));
  scratchDirs.push(dir);
  execFileSync("git", ["init", "-q"], { cwd: dir });

  writeFileSync(join(dir, "config.ts"), "export const retries = 3;\n");
  commit(dir, "seed the config loader");
  writeFileSync(join(dir, "retry.ts"), "export const backoff = (n: number) => n * 2;\n");
  commit(dir, "add retry backoff");
  writeFileSync(join(dir, "retry.ts"), "export const backoff = (n: number) => n;\n");
  commit(dir, 'Revert "add retry backoff"');

  return dir;
}

function shortSha(dir: string, rev = "HEAD"): string {
  return execFileSync("git", ["log", "-1", "--pretty=format:%h", rev], { cwd: dir, encoding: "utf8" }).trim();
}

function proposal(overrides: Partial<CardProposal> = {}): CardProposal {
  return {
    kind: "caution",
    title: "the retry backoff was tried and undone",
    claim: "Doubling the backoff was added and reverted the same day; do not reintroduce it blind.",
    citations: [{ ref: "commit:abc1234" }],
    trigger: "changing retry or backoff behavior",
    ...overrides,
  };
}

/**
 * A card the store already holds, content-addressed exactly as proposeCard would have written
 * it — which is what makes the reconciler's verdict on a re-mine a real assertion rather than a
 * fixture agreeing with itself.
 */
function known(proposal: CardProposal, state: CardState = "proposed"): Card {
  return {
    id: cardId(proposal),
    kind: proposal.kind,
    state,
    verify: "unverified",
    title: proposal.title,
    claim: proposal.claim,
    citations: proposal.citations,
    trigger: proposal.trigger,
    provenance: { source: "mining", ref: "history:3", at: "2026-08-04T00:00:00.000Z" },
    tags: [],
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}

function card(title: string): Card {
  return {
    id: "card_00000000",
    kind: "decision",
    state: "approved",
    verify: "verified",
    title,
    claim: "already known.",
    citations: [{ ref: "commit:abc1234" }],
    trigger: "whenever",
    provenance: { source: "mining", ref: "history:HEAD~200", at: "2026-08-04T00:00:00.000Z" },
    tags: [],
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}

// ── The digest — git log, compressed into something citable ──────────────────────────────────

test("the digest counts commits and reverts, and names all three sections", () => {
  const digest = buildHistoryDigest(scratchRepo());

  assert.equal(digest.commits, 3);
  assert.equal(digest.reverts, 1);
  assert.ok(digest.text.includes("COMMITS (3 most recent, newest first)"));
  assert.ok(digest.text.includes("REVERTS (1 — something was tried and undone)"));
  assert.ok(digest.text.includes("HOT FILES (top 2 by change count over the same range)"));

  // Order matters: the model reads top-down, and the cautions must arrive before the file stats.
  const text = digest.text;
  assert.ok(text.indexOf("COMMITS (") < text.indexOf("REVERTS ("));
  assert.ok(text.indexOf("REVERTS (") < text.indexOf("HOT FILES ("));
});

// Reverts are gold: something was tried and undone, which is a caution with its own evidence.
// They get their own section so the strongest signal is not buried in 200 commit lines.
test("a revert appears in its own section as well as in the commit list", () => {
  const repo = scratchRepo();
  const digest = buildHistoryDigest(repo);
  const revertSection = digest.text.slice(digest.text.indexOf("REVERTS ("), digest.text.indexOf("HOT FILES ("));

  assert.ok(revertSection.includes('Revert "add retry backoff"'));
  assert.ok(revertSection.includes(shortSha(repo)), "the sha is there to be cited");
  assert.ok(!revertSection.includes("seed the config loader"), "only reverts are in the reverts section");
});

// The shas are the citation currency — a digest the model cannot cite from produces cards the
// gate will refuse, and the run costs the user tokens for nothing.
test("every commit line carries the sha, the date, and the subject", () => {
  const repo = scratchRepo();
  const digest = buildHistoryDigest(repo);
  const lines = digest.text.split("\n");
  const first = lines[lines.indexOf("COMMITS (3 most recent, newest first)") + 1];

  assert.match(first, /^[0-9a-f]{7,}\|\d{4}-\d{2}-\d{2}\|Revert "add retry backoff"$/);
  assert.ok(first.startsWith(`${shortSha(repo)}|`), "newest first: HEAD leads the list");
});

test("hot files are ranked by how often they changed, most-churned first", () => {
  const digest = buildHistoryDigest(scratchRepo());
  const lines = digest.text.split("\n");
  const start = lines.indexOf("HOT FILES (top 2 by change count over the same range)");

  assert.deepEqual(lines.slice(start + 1, start + 3), ["2\tretry.ts", "1\tconfig.ts"]);
});

test("maxCommits bounds the range the digest is built from", () => {
  const digest = buildHistoryDigest(scratchRepo(), { maxCommits: 1 });

  assert.equal(digest.commits, 1);
  assert.ok(digest.text.includes("COMMITS (1 most recent, newest first)"));
  assert.ok(!digest.text.includes("seed the config loader"), "the older commits are outside the range");
});

test("a repo with no reverts says so rather than leaving the section empty", () => {
  const dir = mkdtempSync(join(tmpdir(), "kage-miner-"));
  scratchDirs.push(dir);
  execFileSync("git", ["init", "-q"], { cwd: dir });
  writeFileSync(join(dir, "only.ts"), "export const a = 1;\n");
  commit(dir, "the only commit");

  const digest = buildHistoryDigest(dir);
  assert.equal(digest.reverts, 0);
  assert.ok(digest.text.includes("REVERTS (0 — something was tried and undone)\n(none)"));
});

// ── The prompt — the gate's rules, restated so the model wastes fewer of the user's tokens ───

test("the prompt lists the existing titles the model must not re-propose", () => {
  const digest = buildHistoryDigest(scratchRepo());
  const prompt = miningPrompt(digest, ["the retry backoff was tried and undone", "config lives in config.ts"]);

  assert.ok(prompt.includes("Do not re-propose these existing card titles:"));
  assert.ok(prompt.includes("- the retry backoff was tried and undone"));
  assert.ok(prompt.includes("- config lives in config.ts"));
});

test("an empty store says '(none yet)' rather than presenting a blank list", () => {
  const prompt = miningPrompt(buildHistoryDigest(scratchRepo()), []);
  assert.ok(prompt.includes("(none yet)"));
});

test("the prompt carries the cap, the citation rule, and the digest itself", () => {
  const digest = buildHistoryDigest(scratchRepo());
  const prompt = miningPrompt(digest, []);

  assert.ok(prompt.includes("propose up to 10 cards"));
  assert.ok(prompt.includes("A card that cites nothing will be discarded."));
  assert.ok(prompt.endsWith(digest.text), "the digest is the last thing the model reads");
  assert.ok(prompt.includes("HISTORY DIGEST"));
});

// ── Mining — one call, then the deterministic half of the gate ────────────────────────────────

test("a good reply becomes proposals, in one extract-tier call, with usage reported honestly", async () => {
  const repo = scratchRepo();
  const sha = shortSha(repo);
  const provider = fakeProvider([
    // Models wrap JSON in prose and fences. Prose is not an error; the array is recovered.
    `Here are the cards I found:\n\`\`\`json\n${JSON.stringify([
      {
        kind: "caution",
        title: "the retry backoff was tried and undone",
        claim: "Doubling the backoff was added and reverted the same day.",
        citations: [{ ref: `commit:${sha}` }],
        trigger: "changing retry or backoff behavior",
      },
      {
        kind: "decision",
        title: "retry policy lives in retry.ts",
        claim: "Retry behavior is centralized in retry.ts rather than at each call site.",
        citations: [{ path: "retry.ts" }],
        trigger: "adding a retry anywhere",
        tags: ["retry"],
      },
    ])}\n\`\`\`\nHope that helps.`,
  ]);

  const result = await mineHistory(provider, repo, []);

  assert.equal(result.proposals.length, 2);
  assert.deepEqual(result.rejected, []);
  assert.equal(result.proposals[0].kind, "caution");
  assert.deepEqual(result.proposals[1].tags, ["retry"], "tags survive the coercion");
  // An empty store can collide with nothing, so every card is an add and nothing was known.
  assert.deepEqual(result.actions, [{ action: "add" }, { action: "add" }]);
  assert.equal(result.alreadyKnown, 0);

  // ONE call, at extract tier: the user asked for mining explicitly, so there is nothing to triage.
  assert.equal(provider.calls.length, 1);
  assert.equal(provider.calls[0].tier, "extract");
  assert.ok(provider.calls[0].prompt.includes("COMMITS (3 most recent, newest first)"));

  // The fake measures nothing, and nothing is invented on its behalf.
  assert.deepEqual(result.usage, { inputTokens: null, outputTokens: null, costUsd: null });
  assert.equal(result.digest.commits, 3);
});

test("the existing titles reach the model through the prompt the miner builds", async () => {
  const repo = scratchRepo();
  const provider = fakeProvider(["[]"]);
  await mineHistory(provider, repo, [card("retry policy lives in retry.ts")]);

  assert.ok(provider.calls[0].prompt.includes("- retry policy lives in retry.ts"));
});

test("the cap holds however many the model returns", async () => {
  const repo = scratchRepo();
  const sha = shortSha(repo);
  const many = Array.from({ length: 14 }, (_, i) => ({
    kind: "decision",
    title: `finding number ${i}`,
    claim: `The team settled this in commit ${sha}.`,
    citations: [{ ref: `commit:${sha}` }],
    trigger: `whenever finding ${i} is relevant`,
  }));

  const result = await mineHistory(fakeProvider([JSON.stringify(many)]), repo, []);

  assert.equal(result.proposals.length, 10);
  assert.equal(result.actions.length, 10, "every survivor carries exactly one verdict");
  assert.deepEqual(result.rejected, [], "the overflow is dropped, not rejected — it was never judged");
  assert.equal(result.proposals[0].title, "finding number 0", "the cap takes the first ten, in order");
});

// The load-bearing refusal. A claim nothing can falsify is trivia, and the gate says so as
// DATA — mining must return a batch a human can review, never a throw halfway through it.
test("a proposal that cites nothing is refused by the gate and returned as a reason", async () => {
  const repo = scratchRepo();
  const sha = shortSha(repo);
  const result = await mineHistory(
    fakeProvider([
      JSON.stringify([
        { ...proposal({ citations: [] }), title: "an uncitable feeling" },
        { ...proposal(), citations: [{ ref: `commit:${sha}` }] },
      ]),
    ]),
    repo,
    [],
  );

  assert.equal(result.proposals.length, 1, "the admissible proposal is unaffected by its neighbour");
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].proposal.title, "an uncitable feeling");
  assert.deepEqual(result.rejected[0].problems, [
    { field: "citations", reason: "a card that cites nothing cannot exist" },
  ]);
});

// The scan covers every field the model authored, not just the claim: a card is about to become
// durable, synced, team-visible text, and a secret in a trigger syncs exactly as far.
test("a secret anywhere in a proposal trips the scan, even in an otherwise valid card", async () => {
  const repo = scratchRepo();
  const result = await mineHistory(
    fakeProvider([
      JSON.stringify([
        proposal({ trigger: `when rotating sk-${"A".repeat(24)} in the deploy config` }),
      ]),
    ]),
    repo,
    [],
  );

  assert.deepEqual(result.proposals, []);
  assert.equal(result.rejected.length, 1);
  assert.deepEqual(result.rejected[0].problems, [
    { field: "claim", reason: "secret scan tripped: anthropic/openai-style key" },
  ]);
});

test("a malformed field is coerced into shape and judged, never thrown over", async () => {
  const repo = scratchRepo();
  const result = await mineHistory(
    fakeProvider([
      JSON.stringify([
        { kind: "insight", title: 42, claim: null, citations: "commit:abc", trigger: ["later"] },
      ]),
    ]),
    repo,
    [],
  );

  assert.deepEqual(result.proposals, []);
  assert.equal(result.rejected.length, 1);
  assert.deepEqual(
    result.rejected[0].problems.map((p) => p.field).sort(),
    ["citations", "claim", "kind", "title", "trigger"],
  );
});

// A model that finds nothing, or answers in prose, is a normal outcome of a mining run — not an
// error to surface to the user, and never a crash in the middle of their first five minutes.
test("a reply with no recoverable array yields an empty batch without throwing", async () => {
  const repo = scratchRepo();
  for (const reply of [
    "I could not find anything worth recording in this history.",
    "",
    "[{oops, not json}]",
    '{"kind":"decision"}',
    "[",
  ]) {
    const result = await mineHistory(fakeProvider([reply]), repo, []);
    assert.deepEqual(result.proposals, [], JSON.stringify(reply));
    assert.deepEqual(result.rejected, [], JSON.stringify(reply));
    assert.equal(result.digest.commits, 3, "the digest is still returned — the run happened");
  }
});

// ── Re-mining — the reconciler, not a second Inbox ───────────────────────────────────────────
//
// Measured on this repository before the reconciler was wired in: a second `kage cards mine`
// proposed 10 fresh cards and reported "0 already known", because the store's content address
// was the only dedupe and the model had rephrased everything. Mining re-reads history the run
// before it already read, so this is not an edge case — it is what the second run always is.

test("a second run over the same history proposes nothing and counts what it already knew", async () => {
  const repo = scratchRepo();
  const sha = shortSha(repo);
  const found = [
    proposal({ citations: [{ ref: `commit:${sha}` }] }),
    proposal({
      kind: "decision",
      title: "retry policy lives in retry.ts",
      claim: "Retry behavior is centralized in retry.ts rather than at each call site.",
      citations: [{ path: "retry.ts" }],
      trigger: "adding a retry anywhere",
    }),
  ];
  const reply = JSON.stringify(found);

  const first = await mineHistory(fakeProvider([reply]), repo, []);
  assert.equal(first.proposals.length, 2);
  assert.equal(first.alreadyKnown, 0);

  // What the store holds afterwards, reviewed or not: a proposed card is knowledge the Inbox is
  // already carrying, so re-proposing it costs a human the same glance twice.
  const second = await mineHistory(fakeProvider([reply]), repo, first.proposals.map((p) => known(p)));

  assert.deepEqual(second.proposals, [], "nothing new to review");
  assert.deepEqual(second.actions, []);
  assert.equal(second.alreadyKnown, 2, "the run says what it recognised rather than dropping it silently");
  assert.deepEqual(second.rejected, [], "a card we already have was never refused — that is a different fact");
  assert.equal(second.digest.commits, 3, "the run still happened and still reports its range");
});

test("a genuinely new fact still gets through a re-mine", async () => {
  const repo = scratchRepo();
  const sha = shortSha(repo);
  const stored = proposal({ citations: [{ ref: `commit:${sha}` }] });
  const fresh = proposal({
    kind: "decision",
    title: "config defaults live in config.ts",
    claim: "The retry count default is set in config.ts so the loader owns it, not each caller.",
    citations: [{ path: "config.ts" }],
    trigger: "changing a default",
  });

  const result = await mineHistory(fakeProvider([JSON.stringify([stored, fresh])]), repo, [known(stored)]);

  assert.deepEqual(result.proposals.map((p) => p.title), [fresh.title]);
  assert.deepEqual(result.actions, [{ action: "add" }]);
  assert.equal(result.alreadyKnown, 1);
});

// An update is NOT dropped: a refinement of a card the store holds is knowledge, and whether it
// replaces the original is the human's call at the gate. The reconciler only says which card it
// is about, so the reviewer never sees two rival half-truths with no signal which is current.
test("a rephrasing of a known card arrives as an update against it, not as a rival card", async () => {
  const repo = scratchRepo();
  const sha = shortSha(repo);
  const stored = proposal({ citations: [{ ref: `commit:${sha}` }] });
  const rephrased = proposal({
    title: `${stored.title}, re-checked`,
    claim: "The backoff revert still stands on main; the doubling was never reintroduced.",
    citations: [{ ref: `commit:${sha}` }],
  });

  const result = await mineHistory(fakeProvider([JSON.stringify([rephrased])]), repo, [known(stored)]);

  assert.equal(result.proposals.length, 1);
  assert.deepEqual(result.actions, [{ action: "update", id: cardId(stored) }]);
  assert.equal(result.alreadyKnown, 0, "an update is new knowledge to review, not something we already had");
});

// The reason a rejection is recorded rather than deleted is so the same junk is not mined back
// in next week.
test("a card the team already rejected is not mined back into the Inbox", async () => {
  const repo = scratchRepo();
  const sha = shortSha(repo);
  const junk = proposal({ citations: [{ ref: `commit:${sha}` }] });

  const result = await mineHistory(fakeProvider([JSON.stringify([junk])]), repo, [known(junk, "retired")]);

  assert.deepEqual(result.proposals, []);
  assert.equal(result.alreadyKnown, 1);
});

// Gate first, reconciler second. A proposal that is both a duplicate and inadmissible is
// reported as REFUSED, because that is the louder fact about the extractor's quality.
test("a duplicate that also fails the gate is refused, never counted as already known", async () => {
  const repo = scratchRepo();
  const sha = shortSha(repo);
  // The same fact the store holds, re-proposed with its evidence dropped — the content address
  // ignores citations, so this collides AND is inadmissible.
  const stored = proposal({ citations: [{ ref: `commit:${sha}` }] });
  const uncited: CardProposal = { ...stored, citations: [] };

  const result = await mineHistory(fakeProvider([JSON.stringify([uncited])]), repo, [known(stored)]);

  assert.deepEqual(result.proposals, []);
  assert.equal(result.alreadyKnown, 0);
  assert.equal(result.rejected.length, 1);
  assert.deepEqual(result.rejected[0].problems, [
    { field: "citations", reason: "a card that cites nothing cannot exist" },
  ]);
});

// Found by dogfooding, which is the only way this class of bug ever surfaces: the miner used
// `git log --grep=Revert`, which searches the WHOLE message. The commit that introduced this
// module has a body reading "Reverts are gold", so the miner reported it as reverted — and the
// Librarian dutifully proposed a card warning that the Librarian itself had been rolled back.
// A revert is a commit whose SUBJECT is `Revert "..."`, nothing looser.
test("a commit that merely discusses reverting is not counted as a revert", () => {
  const dir = mkdtempSync(join(tmpdir(), "kage-miner-revert-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  writeFileSync(join(dir, "a.txt"), "one\n");
  execFileSync("git", [...GIT_ID, "add", "-A"], { cwd: dir });
  execFileSync("git", [...GIT_ID, "commit", "-qm", "feat: the new core\n\nReverts are gold — something was tried and undone.\nhistory/blame/revert are native git."], { cwd: dir });

  writeFileSync(join(dir, "b.txt"), "two\n");
  execFileSync("git", [...GIT_ID, "add", "-A"], { cwd: dir });
  execFileSync("git", [...GIT_ID, "commit", "-qm", 'Revert "feat: the thing that did not work"'], { cwd: dir });

  const digest = buildHistoryDigest(dir);
  assert.equal(digest.commits, 2);
  assert.equal(digest.reverts, 1, "only the commit whose SUBJECT is a revert counts");
  assert.match(digest.text, /Revert "feat: the thing that did not work"/);
  assert.doesNotMatch(digest.text.split("REVERTS")[1] ?? "", /the new core/);
});
