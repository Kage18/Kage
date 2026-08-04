import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  approveCard,
  getCard,
  listCards,
  openStore,
  proposeCard,
  rejectCard,
  repoStoreId,
  setVerifyState,
} from "./store.js";
import type { CardStore } from "./store.js";
import type { CardProblem } from "./card.js";
import type { Card, CardProposal, Provenance } from "./types.js";

// The store's promise is not "cards are saved" — it is "git is the audit trail". So these tests
// run against real git repos in real temp dirs and read the commit log back, because the two
// claims that matter (one mutation = exactly one commit; a refused proposal leaves no trace at
// all) are claims about git, and a mocked git would let both of them quietly rot.

const scratchDirs: string[] = [];
after(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

function scratchDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

/** Identity is passed inline — the machine's ~/.gitconfig is never assumed to exist. */
function gitInit(dir: string): string {
  execFileSync("git", ["-C", dir, "init", "-q", "-b", "main"]);
  return dir;
}

function git(store: CardStore, args: string[]): string {
  return execFileSync("git", ["-C", store.dir, ...args], { encoding: "utf8" }).trim();
}

function commitCount(store: CardStore): number {
  return Number(git(store, ["rev-list", "--count", "HEAD"]));
}

function headSubject(store: CardStore): string {
  return git(store, ["log", "-1", "--format=%s"]);
}

/** The files a single commit touched — how "in the SAME commit" is actually checked. */
function filesInHead(store: CardStore): string[] {
  return git(store, ["show", "--name-only", "--format=", "HEAD"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

/** A fresh product repo shadowed by a fresh store root — every test is fully isolated. */
function newStore(): CardStore {
  return openStore(scratchDir("kage-project-"), scratchDir("kage-root-"));
}

type Proposal = CardProposal & { supersedes?: string };

const PROVENANCE: Provenance = { source: "session", ref: "s-1", at: "2026-08-04T10:00:00.000Z" };

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    kind: "caution",
    title: "tenantLimit comparison is exclusive on purpose",
    claim: "withinLimit uses < rather than <= so a tenant at exactly the limit is refused.",
    citations: [{ path: "src/limits.ts", symbol: "withinLimit" }],
    trigger: "editing src/limits.ts",
    ...overrides,
  };
}

// Unwrappers that narrow by throwing: the union result types are the point of this API, and a
// test that silently took the wrong branch would assert nothing.

type ProposeResult = ReturnType<typeof proposeCard>;
type GateResult = { card: Card } | { error: string };

function expectProposed(result: ProposeResult): { card: Card; deduped: boolean } {
  if ("problems" in result) throw new Error(`refused: ${JSON.stringify(result.problems)}`);
  return result;
}

function expectProblems(result: ProposeResult): CardProblem[] {
  if (!("problems" in result)) throw new Error(`expected a refusal, got ${result.card.id}`);
  return result.problems;
}

function expectCard(result: GateResult): Card {
  if ("error" in result) throw new Error(result.error);
  return result.card;
}

function expectError(result: GateResult): string {
  if (!("error" in result)) throw new Error(`expected an error, got a ${result.card.state} card`);
  return result.error;
}

function propose(store: CardStore, overrides: Partial<Proposal> = {}, now?: Date): Card {
  return expectProposed(proposeCard(store, proposal(overrides), PROVENANCE, now)).card;
}

// ── Identity: which store a project belongs to ────────────────────────────────────────────────

test("the same project resolves to the same store id every time — memory must not move under a repo", () => {
  const project = scratchDir("kage-project-");
  assert.equal(repoStoreId(project), repoStoreId(project));
  assert.match(repoStoreId(project), /^[0-9a-f]{12}$/);
});

test("a repo with a remote and one without get different ids, and the remote's id is the stable one", () => {
  const solo = gitInit(scratchDir("kage-project-"));
  const byPath = repoStoreId(solo);

  execFileSync("git", ["-C", solo, "remote", "add", "origin", "https://example.com/team/app.git"]);
  const byRemote = repoStoreId(solo);
  assert.notEqual(byRemote, byPath, "adding an origin changes which store the repo belongs to");
  assert.equal(repoStoreId(solo), byRemote, "and the remote-derived id is itself stable");

  // The reason the remote wins: two clones on two machines are the same team memory, and the
  // path they happen to sit at must not fork it.
  const clone = gitInit(scratchDir("kage-elsewhere-"));
  execFileSync("git", ["-C", clone, "remote", "add", "origin", "https://example.com/team/app.git"]);
  assert.equal(repoStoreId(clone), byRemote);

  // A never-pushed project is first-class, not an error — it just gets its own path-keyed store.
  const other = scratchDir("kage-project-");
  assert.notEqual(repoStoreId(other), byPath);
});

// ── Opening ──────────────────────────────────────────────────────────────────────────────────

test("opening a store leaves a real git repo whose HEAD already exists", () => {
  const store = newStore();
  assert.ok(existsSync(join(store.dir, ".git")));
  // One commit before the first card, so every later mutation has a parent and log/blame work
  // from minute one.
  assert.equal(commitCount(store), 1);
  assert.match(headSubject(store), /^init: /);
  assert.ok(existsSync(join(store.dir, "README.md")), "a human poking around ~/.kage deserves an answer");
});

test("reopening a store touches nothing — open is idempotent, not a reset", () => {
  const projectDir = scratchDir("kage-project-");
  const root = scratchDir("kage-root-");
  const store = openStore(projectDir, root);
  const card = propose(store);

  const reopened = openStore(projectDir, root);
  assert.equal(reopened.dir, store.dir);
  assert.equal(commitCount(reopened), 2, "reopening added no commit");
  assert.equal(listCards(reopened).length, 1);
  assert.equal(getCard(reopened, card.id)?.id, card.id);
});

// ── Proposing: one mutation, one commit ──────────────────────────────────────────────────────

test("proposing a card writes its file and makes exactly one commit", () => {
  const store = newStore();
  const before = commitCount(store);
  const card = propose(store);

  assert.equal(card.state, "proposed");
  assert.equal(card.verify, "unverified", "verification is an act, not a birthright");
  assert.ok(existsSync(join(store.dir, "cards", `${card.id}.md`)));
  assert.equal(commitCount(store), before + 1, "one mutation, exactly one commit");
  assert.deepEqual(filesInHead(store), [`cards/${card.id}.md`], "and only its own file");
  assert.equal(headSubject(store), `propose: ${card.id} ${card.title}`);
});

test("proposing the identical claim twice returns the existing card and commits nothing", () => {
  const store = newStore();
  const first = propose(store);
  const after = commitCount(store);

  const second = expectProposed(proposeCard(store, proposal(), PROVENANCE));
  assert.equal(second.deduped, true);
  assert.equal(second.card.id, first.id);
  assert.equal(commitCount(store), after, "dedupe is free because ids are content-addressed");
  assert.equal(listCards(store).length, 1);
});

test("re-proposing an approved card returns it approved — dedupe must not send it back to review", () => {
  const store = newStore();
  const card = propose(store);
  expectCard(approveCard(store, card.id, "kushal"));

  const again = expectProposed(proposeCard(store, proposal(), PROVENANCE));
  assert.equal(again.deduped, true);
  assert.equal(again.card.state, "approved", "a re-run of the Librarian cannot re-open settled knowledge");
});

// ── The gate's hardest no ────────────────────────────────────────────────────────────────────

test("a proposal carrying a secret is refused by name, and leaves no trace at all", () => {
  const store = newStore();
  const before = commitCount(store);
  const problems = expectProblems(
    proposeCard(
      store,
      proposal({ claim: "The staging runner authenticates with AKIAIOSFODNN7EXAMPLE, which must be rotated." }),
      PROVENANCE,
    ),
  );

  assert.equal(problems.length, 1);
  assert.match(problems[0].reason, /secret detected: aws access key/);
  // A refused proposal must not exist on disk or in history — a synced secret cannot be unsynced.
  assert.equal(commitCount(store), before);
  assert.deepEqual(readdirSync(join(store.dir, "cards")), []);
});

test("the secret scan covers every free-form field, not just the claim", () => {
  const store = newStore();
  const problems = expectProblems(
    proposeCard(store, proposal({ trigger: "rotating -----BEGIN RSA PRIVATE KEY----- material" }), PROVENANCE),
  );
  assert.match(problems[0].reason, /secret detected: private key block/);
  // Reported against "claim" because the scan reads the authored surface as one text; the
  // pattern name, not the field, is what tells the author what to remove.
  assert.equal(problems[0].field, "claim");
});

// ── Validation reports, never throws ─────────────────────────────────────────────────────────

test("a card that cites nothing comes back as problems, never as a thrown error", () => {
  const store = newStore();
  const before = commitCount(store);
  const result = proposeCard(store, proposal({ citations: [] }), PROVENANCE);
  const problems = expectProblems(result);

  assert.equal(problems[0].field, "citations");
  assert.match(problems[0].reason, /cites nothing/);
  assert.equal(commitCount(store), before, "an inadmissible proposal never reaches disk");
});

test("validation problems and a secret are reported together — the author fixes both at once", () => {
  const store = newStore();
  const problems = expectProblems(
    proposeCard(
      store,
      proposal({ citations: [], claim: "key AKIAIOSFODNN7EXAMPLE is in the runner env" }),
      PROVENANCE,
    ),
  );
  assert.equal(problems.length, 2);
  assert.ok(problems.some((p) => /cites nothing/.test(p.reason)));
  assert.ok(problems.some((p) => /secret detected/.test(p.reason)));
});

// ── Reads ────────────────────────────────────────────────────────────────────────────────────

test("a corrupt card file is skipped, not fatal — one bad file cannot take the listing down", () => {
  const store = newStore();
  const good = propose(store);
  writeFileSync(join(store.dir, "cards", "card_00000000.md"), "hand-mangled, no frontmatter at all\n");
  writeFileSync(join(store.dir, "cards", "notes.txt"), "not a card file\n");

  const listed = listCards(store);
  assert.deepEqual(listed.map((c) => c.id), [good.id]);
  assert.equal(getCard(store, "card_00000000"), null);
});

test("a path-shaped id reads as no-such-card — ids arrive from CLI args and app routes", () => {
  const store = newStore();
  for (const id of ["../../etc/passwd", "/etc/passwd", "card_00000000/../README"]) {
    assert.equal(getCard(store, id), null, id);
  }
});

test("cards list newest change first, so the Inbox shows what just moved", () => {
  const store = newStore();
  const older = propose(store, {}, new Date("2026-08-01T00:00:00.000Z"));
  const newer = propose(
    store,
    { title: "retries are capped at three", claim: "The fourth attempt is dropped on purpose." },
    new Date("2026-08-03T00:00:00.000Z"),
  );
  assert.deepEqual(listCards(store).map((c) => c.id), [newer.id, older.id]);
});

// ── Filtering ────────────────────────────────────────────────────────────────────────────────

test("listCards filters by state, kind and verify, and combined filters narrow", () => {
  const store = newStore();
  const caution = propose(store);
  const runbook = propose(store, {
    kind: "runbook",
    title: "how to replay a stuck billing webhook",
    claim: "Re-send from the provider dashboard; the handler is idempotent on event id.",
  });
  expectCard(approveCard(store, runbook.id, "kushal"));
  setVerifyState(store, caution.id, "stale");

  assert.deepEqual(listCards(store, { state: "approved" }).map((c) => c.id), [runbook.id]);
  assert.deepEqual(listCards(store, { state: "proposed" }).map((c) => c.id), [caution.id]);
  assert.deepEqual(listCards(store, { kind: "runbook" }).map((c) => c.id), [runbook.id]);
  assert.deepEqual(listCards(store, { verify: "stale" }).map((c) => c.id), [caution.id]);
  assert.deepEqual(listCards(store, { state: "approved", kind: "caution" }), [], "filters are AND, not OR");
});

test("the text filter is case-insensitive and reads the claim as well as the title", () => {
  const store = newStore();
  const card = propose(store);

  assert.deepEqual(listCards(store, { text: "EXCLUSIVE ON PURPOSE" }).map((c) => c.id), [card.id]);
  assert.deepEqual(listCards(store, { text: "tenant at exactly" }).map((c) => c.id), [card.id]);
  assert.deepEqual(listCards(store, { text: "kubernetes" }), []);
});

// ── The human gate ───────────────────────────────────────────────────────────────────────────

test("approving flips the state and records who said yes", () => {
  const store = newStore();
  const card = propose(store);
  const before = commitCount(store);

  const approved = expectCard(approveCard(store, card.id, "kushal", "checked against main"));
  assert.equal(approved.state, "approved");
  assert.equal(approved.reviewedBy, "kushal");
  assert.equal(approved.reviewNote, "checked against main");
  assert.notEqual(approved.updatedAt, card.updatedAt);
  assert.equal(commitCount(store), before + 1);
  // Persisted, not just returned — the next process reads the file, not this object.
  assert.equal(getCard(store, card.id)?.state, "approved");
});

test("approving a superseding card retires the card it replaces IN THE SAME COMMIT", () => {
  const store = newStore();
  const old = propose(store);
  expectCard(approveCard(store, old.id, "kushal"));
  const replacement = propose(store, {
    title: "tenantLimit comparison became inclusive in v5",
    claim: "withinLimit now uses <= after the v5 billing change; the old exclusive rule is wrong.",
    supersedes: old.id,
  });
  const before = commitCount(store);

  const approved = expectCard(approveCard(store, replacement.id, "kushal"));
  assert.equal(approved.state, "approved");
  const superseded = getCard(store, old.id);
  assert.equal(superseded?.state, "superseded");
  assert.equal(superseded?.supersededBy, replacement.id);
  assert.equal(superseded?.updatedAt, approved.updatedAt, "one event, one timestamp");

  // The whole point: there is no window in which both cards read as live team knowledge.
  assert.equal(commitCount(store), before + 1);
  assert.deepEqual(filesInHead(store), [`cards/${old.id}.md`, `cards/${replacement.id}.md`].sort());
});

test("a supersede aimed at a card that was never approved leaves it alone", () => {
  const store = newStore();
  const never = propose(store);
  const replacement = propose(store, {
    title: "tenantLimit comparison became inclusive in v5",
    claim: "withinLimit now uses <= after the v5 billing change.",
    supersedes: never.id,
  });

  expectCard(approveCard(store, replacement.id, "kushal"));
  // It was never team knowledge, so there is nothing to supersede — and the approval commit
  // touches only the approved card.
  assert.equal(getCard(store, never.id)?.state, "proposed");
  assert.equal(getCard(store, never.id)?.supersededBy, undefined);
  assert.deepEqual(filesInHead(store), [`cards/${replacement.id}.md`]);
});

test("rejecting retires the card and keeps the reason on record", () => {
  const store = newStore();
  const card = propose(store);
  const before = commitCount(store);

  const retired = expectCard(rejectCard(store, card.id, "kushal", "restates the code, no decision in it"));
  assert.equal(retired.state, "retired");
  assert.equal(retired.reviewNote, "restates the code, no decision in it");
  assert.equal(retired.reviewedBy, "kushal");
  assert.equal(commitCount(store), before + 1);
  // Retired, never deleted: the reason is what stops the same junk being re-proposed forever.
  assert.equal(getCard(store, card.id)?.reviewNote, "restates the code, no decision in it");
});

test("an illegal transition comes back as an error and writes nothing", () => {
  const store = newStore();
  const card = propose(store);
  expectCard(approveCard(store, card.id, "kushal"));
  const before = commitCount(store);

  assert.match(expectError(approveCard(store, card.id, "kushal")), /cannot approve an? approved card/);

  const retired = expectCard(rejectCard(store, propose(store, {
    title: "unused helper is dead",
    claim: "formatCents is called nowhere and can go.",
  }).id, "kushal", "not knowledge"));
  const afterReject = commitCount(store);
  assert.match(expectError(rejectCard(store, retired.id, "kushal", "again")), /cannot reject a retired card/);
  assert.match(expectError(approveCard(store, retired.id, "kushal")), /cannot approve a retired card/);

  assert.ok(before < afterReject, "the legal mutations did commit");
  assert.equal(commitCount(store), afterReject, "the refused ones did not");
});

test("acting on a card that does not exist is an error, not a crash", () => {
  const store = newStore();
  assert.match(expectError(approveCard(store, "card_deadbeef", "kushal")), /no card card_deadbeef/);
  assert.match(expectError(rejectCard(store, "card_deadbeef", "kushal", "n/a")), /no card card_deadbeef/);
  assert.equal(setVerifyState(store, "card_deadbeef", "stale"), null);
});

// ── Verification state ───────────────────────────────────────────────────────────────────────

test("setting the verify state persists and is committed like any other mutation", () => {
  const store = newStore();
  const card = propose(store);
  expectCard(approveCard(store, card.id, "kushal"));
  const before = commitCount(store);

  const stale = setVerifyState(store, card.id, "stale");
  assert.equal(stale?.verify, "stale");
  assert.equal(getCard(store, card.id)?.verify, "stale");
  // A card going stale and being withheld from recall is exactly the event the log must show.
  assert.equal(commitCount(store), before + 1);
  assert.match(headSubject(store), new RegExp(`^verify: ${card.id} `));

  // Verification moves independently of the lifecycle — the card is still approved.
  assert.equal(getCard(store, card.id)?.state, "approved");
  assert.equal(setVerifyState(store, card.id, "verified")?.verify, "verified");
  assert.equal(getCard(store, card.id)?.verify, "verified");
});
