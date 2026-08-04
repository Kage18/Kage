import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fakeProvider } from "./provider.js";
import { readReceipts } from "./receipts.js";
import { listCards } from "./store.js";
import { storeFor } from "./operations.js";
import { claudeTranscriptDir } from "./transcripts.js";
import {
  distillIdleSessions,
  findIdleSessions,
  loadWatcherState,
  saveWatcherState,
  type WatcherState,
} from "./watcher.js";

// Everything here is about spending the user's own tokens exactly once. The watcher decides two
// things — which sessions are quiet enough to read, and which ones it has already paid for — and
// both failure modes are expensive: reading a live session extracts a conclusion nobody reached,
// and forgetting a session that has been read spawns a headless agent over the same transcript
// on every tick, forever. So the tests below drive real transcript files with pinned mtimes and
// assert on what the watcher REMEMBERS, not just on what it returns.

const scratchDirs: string[] = [];
after(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

/** A fixed clock. Idleness is arithmetic on mtimes, so the test owns the time. */
const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

interface Scratch {
  projectDir: string;
  storeRoot: string;
  home: string;
  transcripts: string;
}

/** A scratch product repo, its own store root, and a fake home holding fake transcripts. */
function scratch(): Scratch {
  const projectDir = mkdtempSync(join(tmpdir(), "kage-watch-repo-"));
  const storeRoot = mkdtempSync(join(tmpdir(), "kage-watch-store-"));
  const home = mkdtempSync(join(tmpdir(), "kage-watch-home-"));
  scratchDirs.push(projectDir, storeRoot, home);

  mkdirSync(join(projectDir, "src"), { recursive: true });
  writeFileSync(join(projectDir, "src", "limits.ts"), "export function withinLimit(n: number) { return n < 100; }\n");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });

  const transcripts = claudeTranscriptDir(projectDir, home);
  mkdirSync(transcripts, { recursive: true });
  return { projectDir, storeRoot, home, transcripts };
}

/** A transcript whose last turn landed `ageMs` before NOW. Returns its path. */
function transcript(dir: string, name: string, ageMs: number, body?: string): string {
  const path = join(dir, `${name}.jsonl`);
  writeFileSync(
    path,
    body ??
      [
        JSON.stringify({ type: "user", message: { role: "user", content: "why is the tenant cap exclusive?" } }),
        JSON.stringify({
          type: "assistant",
          message: { role: "assistant", content: "The comparison is < on purpose; two PRs flipped it and regressed." },
        }),
      ].join("\n") + "\n",
  );
  touch(path, ageMs);
  return path;
}

function touch(path: string, ageMs: number): void {
  const seconds = (NOW - ageMs) / 1000;
  utimesSync(path, seconds, seconds);
}

/** The extractor's reply — one well-formed card the deterministic gate will accept. */
const EXTRACTED = JSON.stringify([
  {
    kind: "caution",
    title: "the tenant limit comparison is exclusive on purpose",
    claim: "withinLimit uses < rather than <=, so a tenant sitting exactly at the limit is refused.",
    citations: [{ path: "src/limits.ts", symbol: "withinLimit" }],
    trigger: "editing src/limits.ts",
  },
]);

// ── Which sessions are quiet ────────────────────────────────────────────────────────────────

// Claude Code emits no "session ended" event, so the mtime is the whole signal. A session the
// user is still typing into must not be read: half a session distils to a conclusion nobody
// reached, and the tokens are spent proving it.
test("only a session that has gone quiet is picked up", () => {
  const { projectDir, home, transcripts } = scratch();
  transcript(transcripts, "live", 2 * MINUTE);
  const quiet = transcript(transcripts, "quiet", 30 * MINUTE);

  const idle = findIdleSessions(projectDir, { seen: {} }, { home, now: NOW });

  assert.deepEqual(idle.map((s) => s.path), [quiet]);
  assert.equal(idle[0].sessionRef, "quiet", "the session id is the basename, which provenance records");
});

test("sessions come back newest first, so a capped run reads what the user just finished", () => {
  const { projectDir, home, transcripts } = scratch();
  const older = transcript(transcripts, "older", 90 * MINUTE);
  const newer = transcript(transcripts, "newer", 20 * MINUTE);

  const idle = findIdleSessions(projectDir, { seen: {} }, { home, now: NOW });
  assert.deepEqual(idle.map((s) => s.path), [newer, older]);
});

// The seen map is keyed by mtime rather than being a set of paths, and this is why: a session
// the user resumed has new material in it that the earlier pass never saw.
test("a session already read at this mtime is left alone, but one that resumed is read again", () => {
  const { projectDir, home, transcripts } = scratch();
  const path = transcript(transcripts, "s1", 30 * MINUTE);
  const state: WatcherState = { seen: { [path]: NOW - 30 * MINUTE } };

  assert.deepEqual(findIdleSessions(projectDir, state, { home, now: NOW }), []);

  touch(path, 15 * MINUTE); // the user came back, worked, and went quiet again
  const idle = findIdleSessions(projectDir, state, { home, now: NOW });
  assert.deepEqual(idle.map((s) => s.path), [path]);
  assert.equal(idle[0].mtimeMs, NOW - 15 * MINUTE);
});

test("the idle threshold is a parameter, and a project never opened in Claude Code has no sessions", () => {
  const { projectDir, home, transcripts } = scratch();
  transcript(transcripts, "recent", 3 * MINUTE);

  assert.equal(findIdleSessions(projectDir, { seen: {} }, { home, now: NOW, idleMs: MINUTE }).length, 1);
  assert.deepEqual(findIdleSessions("/no/such/project", { seen: {} }, { home, now: NOW }), []);
});

// ── The state file ──────────────────────────────────────────────────────────────────────────

test("what the watcher remembers survives a save and load", () => {
  const { storeRoot } = scratch();
  const state: WatcherState = { seen: { "/home/x/.claude/projects/-p/a.jsonl": 1_700_000_000_000 } };

  saveWatcherState(storeRoot, state);
  assert.deepEqual(loadWatcherState(storeRoot), state);
});

// Degrading to empty costs one repeated pass, which the store's content address dedupes into
// spend and no duplicate cards. Throwing would cost every future capture until a human deleted
// a file they do not know exists.
test("a corrupt state file reads as nothing seen rather than throwing", () => {
  const { storeRoot } = scratch();

  assert.deepEqual(loadWatcherState(storeRoot), { seen: {} }, "an absent file is not an error");

  writeFileSync(join(storeRoot, "watcher.json"), '{"seen":{"/a.jsonl":170000');
  assert.deepEqual(loadWatcherState(storeRoot), { seen: {} });

  writeFileSync(join(storeRoot, "watcher.json"), '{"seen":{"/a.jsonl":"yesterday","/b.jsonl":42}}');
  assert.deepEqual(
    loadWatcherState(storeRoot),
    { seen: { "/b.jsonl": 42 } },
    "an unreadable mtime can never match a real one, so it would mean 'read this forever'",
  );
});

// ── One tick of the capture loop ────────────────────────────────────────────────────────────

test("a distilled session's proposals reach the store stamped with the session that taught them", async () => {
  const { projectDir, storeRoot, home, transcripts } = scratch();
  const store = storeFor(projectDir, storeRoot);
  transcript(transcripts, "sess-abc", 30 * MINUTE);
  const provider = fakeProvider(["YES: a decision with a reason", EXTRACTED]);

  const summary = await distillIdleSessions(provider, store, projectDir, { home, now: NOW });

  assert.deepEqual(summary, { distilled: 1, skipped: 0, proposed: 1, deduped: 0, rejected: 0 });
  const [card] = listCards(store);
  assert.equal(card.state, "proposed", "nothing becomes team knowledge without the human gate");
  assert.deepEqual(card.provenance, { source: "session", ref: "sess-abc", at: new Date(NOW).toISOString() });
  assert.deepEqual(provider.calls.map((c) => c.tier), ["triage", "extract"]);
});

// Triage is expected to refuse ~90% of sessions; the expensive mistake is refusing the same
// session again tomorrow, and the day after.
test("a triage refusal still records the session, so the refusal is paid for exactly once", async () => {
  const { projectDir, storeRoot, home, transcripts } = scratch();
  const store = storeFor(projectDir, storeRoot);
  const path = transcript(transcripts, "chatter", 30 * MINUTE);
  const first = fakeProvider(["NO: routine edits, nothing durable"]);

  const summary = await distillIdleSessions(first, store, projectDir, { home, now: NOW });
  assert.deepEqual(summary, { distilled: 0, skipped: 1, proposed: 0, deduped: 0, rejected: 0 });
  assert.equal(first.calls.length, 1, "a refusal costs one cheap call, not two");
  assert.equal(loadWatcherState(store.dir).seen[path], NOW - 30 * MINUTE);

  const second = fakeProvider(["NO: routine edits, nothing durable"]);
  const again = await distillIdleSessions(second, store, projectDir, { home, now: NOW });
  assert.equal(second.calls.length, 0, "re-reading a session the Librarian already judged burns tokens forever");
  assert.equal(again.skipped, 0);

  const run = readReceipts(store.dir).find((event) => event.type === "librarian_run");
  assert.match(run?.detail ?? "", /nothing durable/);
});

// A provider that dies on one transcript will die on it again. Retried on every tick it is an
// infinite bill that never produces a card.
test("a provider that throws records the session and the run moves on", async () => {
  const { projectDir, storeRoot, home, transcripts } = scratch();
  const store = storeFor(projectDir, storeRoot);
  const path = transcript(transcripts, "doomed", 30 * MINUTE);
  const provider = { complete: () => Promise.reject(new Error("claude is not installed")) };

  const summary = await distillIdleSessions(provider, store, projectDir, { home, now: NOW });

  assert.equal(summary.skipped, 1);
  assert.equal(summary.distilled, 0);
  assert.equal(loadWatcherState(store.dir).seen[path], NOW - 30 * MINUTE);
  // The card that never appeared has to be explainable, so the failure is on the ledger.
  const run = readReceipts(store.dir).find((event) => event.type === "librarian_run");
  assert.match(run?.detail ?? "", /failed: claude is not installed/);
});

// The rule the old product died on: no displayed number may be invented. A fake provider reports
// no usage, so the receipt carries none — an absent field renders as a dash, a zero would claim
// the run was measured and free.
test("a run with no measured usage writes no usage fields at all", async () => {
  const { projectDir, storeRoot, home, transcripts } = scratch();
  const store = storeFor(projectDir, storeRoot);
  transcript(transcripts, "sess-1", 30 * MINUTE);

  await distillIdleSessions(fakeProvider(["YES: durable", EXTRACTED]), store, projectDir, { home, now: NOW });

  const run = readReceipts(store.dir).find((event) => event.type === "librarian_run")!;
  assert.equal(run.sessionRef, "sess-1");
  assert.ok(!("inputTokens" in run) && !("outputTokens" in run) && !("costUsd" in run));
});

test("a second session claiming the same thing is deduped, not proposed twice", async () => {
  const { projectDir, storeRoot, home, transcripts } = scratch();
  const store = storeFor(projectDir, storeRoot);
  transcript(transcripts, "newer", 20 * MINUTE);
  transcript(transcripts, "older", 40 * MINUTE);
  const provider = fakeProvider(["YES: durable", EXTRACTED, "YES: durable", EXTRACTED]);

  const summary = await distillIdleSessions(provider, store, projectDir, { home, now: NOW });

  assert.equal(summary.distilled, 2);
  assert.equal(summary.proposed, 1);
  assert.equal(summary.deduped, 1, "'we already knew that' is the system working, not a rejection");
  assert.equal(listCards(store).length, 1);
});

// The cap is latency, never lost knowledge: an unread session is still unseen.
test("a capped run leaves the older sessions for the next tick", async () => {
  const { projectDir, storeRoot, home, transcripts } = scratch();
  const store = storeFor(projectDir, storeRoot);
  const older = transcript(transcripts, "older", 90 * MINUTE);
  transcript(transcripts, "newer", 20 * MINUTE);

  await distillIdleSessions(fakeProvider(["NO: nothing"]), store, projectDir, { home, now: NOW, limit: 1 });

  const seen = loadWatcherState(store.dir).seen;
  assert.equal(Object.keys(seen).length, 1);
  assert.ok(!(older in seen));
  const next = fakeProvider(["NO: nothing"]);
  await distillIdleSessions(next, store, projectDir, { home, now: NOW, limit: 1 });
  assert.equal(next.calls.length, 1, "the session the cap skipped is picked up, not lost");
});

// An empty or unreadable transcript has nothing in it to judge, and asking the model to confirm
// that costs a real call.
test("an empty transcript is recorded without spending a call on it", async () => {
  const { projectDir, storeRoot, home, transcripts } = scratch();
  const store = storeFor(projectDir, storeRoot);
  const path = transcript(transcripts, "empty", 30 * MINUTE, "\n\n");
  const provider = fakeProvider([]);

  const summary = await distillIdleSessions(provider, store, projectDir, { home, now: NOW });

  assert.equal(summary.skipped, 1);
  assert.equal(provider.calls.length, 0);
  assert.equal(loadWatcherState(store.dir).seen[path], NOW - 30 * MINUTE);
  assert.equal(readReceipts(store.dir).length, 0, "nothing ran, so there is nothing to count");
});

test("the state file is written as readable JSON in the store, never into the product repo", async () => {
  const { projectDir, storeRoot, home, transcripts } = scratch();
  const store = storeFor(projectDir, storeRoot);
  transcript(transcripts, "sess-1", 30 * MINUTE);

  await distillIdleSessions(fakeProvider(["NO: nothing"]), store, projectDir, { home, now: NOW });

  const raw = readFileSync(join(store.dir, "watcher.json"), "utf8");
  assert.deepEqual(Object.keys(JSON.parse(raw)), ["seen"]);
  // Transcript paths are machine-local; the store only ever commits the card files it touched.
  const tracked = execFileSync("git", ["-C", store.dir, "ls-files"], { encoding: "utf8" });
  assert.ok(!tracked.includes("watcher.json"));
});
