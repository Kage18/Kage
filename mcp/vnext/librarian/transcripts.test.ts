import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { claudeTranscriptDir, digestTranscript, listSessionFiles } from "./transcripts.js";

// Two things are under test here and they fail in opposite ways. The path munging is a contract
// with someone else's product: get it wrong and the Librarian silently finds zero sessions
// forever, on a machine full of them. The digest is a lossy compression of the user's own
// session: get it wrong and the Librarian reads churn instead of knowledge. So the munging is
// asserted to the byte, and the digest is asserted on what it KEEPS.

const scratchDirs: string[] = [];
after(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-transcripts-"));
  scratchDirs.push(dir);
  return dir;
}

/** A transcript file: one JSON event per line, the way Claude Code appends them. */
function jsonl(...events: unknown[]): string {
  return events.map((event) => JSON.stringify(event)).join("\n") + "\n";
}

function userEvent(text: string): unknown {
  return { type: "user", message: { role: "user", content: text } };
}

function assistantEvent(text: string): unknown {
  return { type: "assistant", message: { role: "assistant", content: text } };
}

// ── The path munging — a contract with Claude Code, not with us ───────────────────────────────

test("the transcript dir is the project path with every slash and dot flattened to a dash", () => {
  assert.equal(
    claudeTranscriptDir("/Users/x/code/Kage", "/home/fake"),
    "/home/fake/.claude/projects/-Users-x-code-Kage",
  );
  // The leading slash becomes a leading dash — the real layout has it, so we must too.
  assert.equal(
    claudeTranscriptDir("/srv/shop.web", "/home/fake"),
    "/home/fake/.claude/projects/-srv-shop-web",
  );
});

// Dots are flattened along with slashes, which means two different projects can share a
// directory. That is Claude Code's collision, and reproducing it is the whole point: a
// "smarter" munging would look correct and find nothing.
test("a dotted path collides with a nested one exactly as Claude Code collides them", () => {
  assert.equal(
    claudeTranscriptDir("/srv/shop.web", "/home/fake"),
    claudeTranscriptDir("/srv/shop/web", "/home/fake"),
  );
});

test("the home argument is a test seam; omitting it reads the real home", () => {
  assert.equal(
    claudeTranscriptDir("/srv/app"),
    join(homedir(), ".claude", "projects", "-srv-app"),
  );
});

// ── Listing sessions ─────────────────────────────────────────────────────────────────────────

// The common case on a fresh install: the project was never opened in Claude Code. "No sessions"
// is an answer, not a failure, and a throw here would take down every caller on day one.
test("an absent directory lists as no sessions rather than throwing", () => {
  assert.deepEqual(listSessionFiles(join(scratchDir(), "never-opened")), []);
});

test("only .jsonl files are sessions — neighbours and near-misses are ignored", () => {
  const dir = scratchDir();
  for (const name of ["a.jsonl", "b.jsonl", "notes.json", "a.jsonl.bak", "README.md"]) {
    writeFileSync(join(dir, name), "");
  }
  // A directory that happens to end in .jsonl is not a transcript.
  mkdirSync(join(dir, "archive.jsonl"));

  const listed = listSessionFiles(dir).map((f) => f.path);
  assert.deepEqual(listed.sort(), [join(dir, "a.jsonl"), join(dir, "b.jsonl")]);
});

test("sessions come back newest first, by mtime and not by name", () => {
  const dir = scratchDir();
  const times: Record<string, number> = { "a.jsonl": 1_000, "b.jsonl": 3_000, "c.jsonl": 2_000 };
  for (const [name, mtime] of Object.entries(times)) {
    const path = join(dir, name);
    writeFileSync(path, "");
    utimesSync(path, mtime, mtime);
  }

  const listed = listSessionFiles(dir);
  assert.deepEqual(
    listed.map((f) => f.path),
    ["b.jsonl", "c.jsonl", "a.jsonl"].map((name) => join(dir, name)),
  );
  assert.deepEqual(
    listed.map((f) => f.mtimeMs),
    [3_000_000, 2_000_000, 1_000_000],
  );
});

// ── Digesting — what was asked, what was concluded, what was touched ─────────────────────────

test("a session digests to one line per event: USER, ASSISTANT, and the tools they ran", () => {
  const digest = digestTranscript(
    jsonl(
      userEvent("why does the retry back off twice?"),
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Reading the limiter." },
            { type: "tool_use", name: "Read", input: { file_path: "src/limits.ts" } },
          ],
        },
      },
      // A tool result lands in a user turn. It is the bulk of the tokens and none of the
      // knowledge — dropping it is the reason this digest exists.
      {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", content: "export function withinLimit(n: number) {" }],
        },
      },
      assistantEvent("The doubling is deliberate; two PRs flattened it and both regressed."),
    ),
  );

  assert.deepEqual(digest.split("\n"), [
    "USER: why does the retry back off twice?",
    "ASSISTANT: Reading the limiter.",
    "TOOL: Read src/limits.ts",
    "ASSISTANT: The doubling is deliberate; two PRs flattened it and both regressed.",
  ]);
  assert.ok(!digest.includes("withinLimit"), "the tool result never reaches the Librarian");
});

// Which KEY holds the interesting argument changes per tool, so the digest goes by shape.
test("a tool's argument is picked by shape, not by key name, and may be absent", () => {
  const digest = digestTranscript(
    jsonl({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          // "run" is a bare word and loses to "npm test", which has a space in it.
          { type: "tool_use", name: "Bash", input: { description: "run", command: "npm test" } },
          { type: "tool_use", name: "Read", input: { file_path: "./relative.ts" } },
          { type: "tool_use", name: "TodoWrite", input: { status: "done", count: 3 } },
        ],
      },
    }),
  );

  assert.deepEqual(digest.split("\n"), [
    "TOOL: Bash npm test",
    "TOOL: Read ./relative.ts",
    "TOOL: TodoWrite",
  ]);
});

// A transcript is an append-only log another process owns. A torn final line is normal, not
// corruption, and one bad line must never cost us the session.
test("unparseable and non-event lines are skipped, never fatal", () => {
  const digest = digestTranscript(
    [
      JSON.stringify(userEvent("the task")),
      "",
      "   ",
      "null",
      "42",
      '"a bare string"',
      '{"type":"user","message":{"rol', // the process was killed mid-append
      JSON.stringify(assistantEvent("the resolution")),
    ].join("\n"),
  );

  assert.deepEqual(digest.split("\n"), ["USER: the task", "ASSISTANT: the resolution"]);
});

test("both the wrapped and the bare event shape are read — a format tweak costs lines, not everything", () => {
  const digest = digestTranscript(
    jsonl(
      { role: "user", content: "bare, with no envelope" },
      // Wrapped, but the role lives on the envelope rather than the message.
      { type: "assistant", message: { content: [{ type: "text", text: "envelope role only" }] } },
    ),
  );

  assert.deepEqual(digest.split("\n"), [
    "USER: bare, with no envelope",
    "ASSISTANT: envelope role only",
  ]);
});

test("each event is collapsed to a single line and capped at 300 characters", () => {
  const digest = digestTranscript(
    jsonl(userEvent("  first line\n\tsecond   line  "), assistantEvent("a".repeat(400))),
  );
  const lines = digest.split("\n");

  assert.equal(lines[0], "USER: first line second line");
  assert.equal(lines[1], `ASSISTANT: ${"a".repeat(300)}`);
  assert.equal(lines[1].length, 311, "the prefix is not part of the 300-character budget");
});

test("an empty transcript digests to an empty string", () => {
  assert.equal(digestTranscript(""), "");
  assert.equal(digestTranscript("\n\n"), "");
});

// ── The cap — the middle is churn, the ends are the knowledge ────────────────────────────────

// THE reason the cap elides the middle instead of truncating the tail: the start of a session
// states the task and the end states the resolution. A tail truncation would keep the question
// and throw away the answer.
test("over the cap, the digest keeps BOTH the task at the start and the resolution at the end", () => {
  const events = [
    userEvent("TASK: make the tenant cap exclusive"),
    ...Array.from({ length: 58 }, (_, i) => assistantEvent(`churn step ${i} ${"x".repeat(60)}`)),
    assistantEvent("RESOLUTION: the comparison is < on purpose"),
  ];
  const digest = digestTranscript(jsonl(...events), { maxChars: 600 });
  const lines = digest.split("\n");

  assert.ok(digest.length <= 600, `the cap is a cap: ${digest.length} chars`);
  assert.equal(lines[0], "USER: TASK: make the tenant cap exclusive");
  assert.equal(lines.at(-1), "ASSISTANT: RESOLUTION: the comparison is < on purpose");
  assert.ok(!digest.includes("churn step 30"), "the middle is what got dropped");

  // The elision is counted, never silent — and the count accounts for every event.
  const marker = lines.findIndex((line) => line.startsWith("... ["));
  assert.ok(marker > 0, "the marker sits between the two halves");
  const elided = Number(/^\.\.\. \[(\d+) events elided\] \.\.\.$/.exec(lines[marker])![1]);
  const head = marker;
  const tail = lines.length - marker - 1;
  assert.equal(head + elided + tail, events.length, "every event is kept or counted as elided");
  assert.ok(head > 1 && tail > 1, "both halves survive, not just one");
});

test("under the cap nothing is elided and no marker appears", () => {
  const digest = digestTranscript(jsonl(userEvent("short"), assistantEvent("also short")));
  assert.ok(!digest.includes("elided"));
  assert.deepEqual(digest.split("\n"), ["USER: short", "ASSISTANT: also short"]);
});

// The degenerate case: not even one line fits a half. The cap still holds, and the marker still
// says how much went missing — an honest empty beats a quietly-over-budget prompt.
test("a cap too small for even one event yields the counted marker alone", () => {
  const digest = digestTranscript(jsonl(userEvent("b".repeat(400))), { maxChars: 100 });
  assert.equal(digest, "... [1 events elided] ...");
});
