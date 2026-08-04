import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { hookResponse, parseHookPayload, runHook, type HookInput } from "./hook.js";
import { approve, ingestProposals, storeFor } from "./operations.js";
import { readReceipts } from "./receipts.js";
import { listCards } from "./store.js";
import type { Card, CardProposal, Citation, Provenance } from "./types.js";

const GIT = ["-c", "user.email=t@t.dev", "-c", "user.name=T"];
const PROVENANCE: Provenance = { source: "session", ref: "s-1", at: "2026-08-04T10:00:00.000Z" };

/** A clock for the tests that do not assert an age. Pinned so nothing here depends on the day. */
const NOW = () => new Date("2026-08-04T12:00:00.000Z");

/** dist/vnext/librarian -> repo root is four levels up. */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

/** A scratch product repo plus its own isolated store root — never the real ~/.kage. */
function scratch(): { projectDir: string; storeRoot: string } {
  const projectDir = mkdtempSync(join(tmpdir(), "kage-hook-repo-"));
  const storeRoot = mkdtempSync(join(tmpdir(), "kage-hook-store-"));
  mkdirSync(join(projectDir, "src"), { recursive: true });
  writeFileSync(
    join(projectDir, "src", "limits.ts"),
    "export const tenantLimit = 100;\nexport function withinLimit(n: number) { return n < tenantLimit; }\n",
  );
  writeFileSync(join(projectDir, "src", "unrelated.ts"), "export const noop = () => undefined;\n");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: projectDir });
  execFileSync("git", [...GIT, "add", "-A"], { cwd: projectDir });
  execFileSync("git", [...GIT, "commit", "-qm", "initial"], { cwd: projectDir });
  return { projectDir, storeRoot };
}

/**
 * A citation pinned to the tree as it stands — what a re-pin at approval time is meant to leave
 * behind. The fixture pins it itself so these tests measure the hook's stamp rather than whether
 * `approve()` persisted its own re-pin.
 */
function pinned(projectDir: string, path: string, symbol: string): Citation {
  const blobSha = execFileSync("git", ["hash-object", "--", path], { cwd: projectDir, encoding: "utf8" }).trim();
  return { path, symbol, blobSha };
}

function proposal(projectDir: string, overrides: Partial<CardProposal> = {}): CardProposal {
  return {
    kind: "caution",
    title: "tenantLimit comparison is exclusive on purpose",
    claim: "withinLimit uses < rather than <= so a tenant at exactly the limit is refused.",
    citations: [pinned(projectDir, "src/limits.ts", "withinLimit")],
    trigger: "editing src/limits.ts",
    ...overrides,
  };
}

/** One approved card in the scratch store — the only state recall is ever allowed to serve. */
function approvedCard(projectDir: string, storeRoot: string, overrides: Partial<CardProposal> = {}): Card {
  const store = storeFor(projectDir, storeRoot);
  const ingested = ingestProposals(store, [proposal(projectDir, overrides)], PROVENANCE);
  assert.equal(ingested.proposed, 1, "the fixture card must reach the store");
  const proposed = listCards(store, { state: "proposed" })[0];
  const result = approve(store, projectDir, proposed.id, "tester");
  assert.equal(result.ok, true);
  return result.card as Card;
}

/** The payload Claude Code actually writes to a PreToolUse hook's stdin. */
function editPayload(projectDir: string, filePath: string, toolName = "Edit"): string {
  return JSON.stringify({
    session_id: "3f6c9a1e-0b7d-4c2f-9a55-8de1c2b3a4f5",
    transcript_path: `${projectDir}/.transcript.jsonl`,
    cwd: projectDir,
    permission_mode: "default",
    hook_event_name: "PreToolUse",
    tool_name: toolName,
    tool_input: { file_path: filePath, old_string: "n < tenantLimit", new_string: "n <= tenantLimit" },
  });
}

/** Parse, insisting it parsed — these fixtures are the shapes the hook exists to handle. */
function inputFor(payload: string, fallbackProjectDir: string): HookInput {
  const input = parseHookPayload(payload, fallbackProjectDir);
  assert.ok(input, "the fixture payload must parse");
  return input;
}

// ── Parsing — somebody else's contract, read tolerantly ──────────────────────────────────────

test("the real PreToolUse Edit payload parses into the repo and the file about to change", () => {
  assert.deepEqual(inputFor(editPayload("/repo", "/repo/src/limits.ts"), "/fallback"), {
    event: "pre-tool",
    projectDir: "/repo",
    toolName: "Edit",
    filePaths: ["/repo/src/limits.ts"],
  });
});

test("SessionStart and Stop parse; an event Kage does not act on parses as nothing at all", () => {
  const sessionStart = inputFor(
    JSON.stringify({ session_id: "s", cwd: "/repo", hook_event_name: "SessionStart", source: "startup" }),
    "/fallback",
  );
  assert.deepEqual(sessionStart, { event: "session-start", projectDir: "/repo" });

  // A Stop payload carries no cwd, so the launching environment's guess is the only answer there is.
  const stop = inputFor(
    JSON.stringify({ session_id: "s", hook_event_name: "Stop", stop_hook_active: false }),
    "/fallback",
  );
  assert.deepEqual(stop, { event: "stop", projectDir: "/fallback" });

  for (const other of ["PostToolUse", "UserPromptSubmit", "SubagentStop", "PreCompact", ""]) {
    assert.equal(parseHookPayload(JSON.stringify({ hook_event_name: other, cwd: "/repo" }), "/f"), null, other);
  }
});

test("a NotebookEdit payload is read from its own path field, camelCase spellings included", () => {
  const input = inputFor(
    JSON.stringify({
      hookEventName: "PreToolUse",
      cwd: "/repo",
      toolName: "NotebookEdit",
      toolInput: { notebook_path: "/repo/analysis.ipynb" },
    }),
    "/fallback",
  );
  assert.deepEqual(input, {
    event: "pre-tool",
    projectDir: "/repo",
    toolName: "NotebookEdit",
    filePaths: ["/repo/analysis.ipynb"],
  });
});

test("a malformed payload is nothing, never a throw", () => {
  for (const junk of ["", "not json at all", "{unterminated", "[]", "null", '"a string"', "42"]) {
    assert.doesNotThrow(() => parseHookPayload(junk, "/fallback"), junk);
    assert.equal(parseHookPayload(junk, "/fallback"), null, junk);
  }
});

// ── Silence is the common case, and it must cost nothing ─────────────────────────────────────

test("a non-editing tool is answered with silence, and no store is brought into existence", () => {
  const { projectDir, storeRoot } = scratch();
  for (const toolName of ["Bash", "Read", "Grep", "TodoWrite"]) {
    const input = inputFor(editPayload(projectDir, join(projectDir, "src/limits.ts"), toolName), projectDir);
    assert.equal(hookResponse(input, { storeRoot, now: NOW }), "", toolName);
  }
  // The whole reason this hook does not call storeFor(): it runs before every edit in every repo
  // on the machine, and must never leave a git-inited store behind for a project nobody set up.
  assert.deepEqual(readdirSync(storeRoot), []);
});

test("session-start and stop print nothing — the BRIEF and the watcher already own those moments", () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);
  for (const event of ["session-start", "stop"] as const) {
    assert.equal(hookResponse({ event, projectDir }, { storeRoot, now: NOW }), "");
  }
});

test("a repo with no store yields silence, and does not create one", () => {
  const { projectDir, storeRoot } = scratch();
  const input = inputFor(editPayload(projectDir, join(projectDir, "src", "limits.ts")), projectDir);
  assert.equal(hookResponse(input, { storeRoot, now: NOW }), "");
  assert.deepEqual(readdirSync(storeRoot), []);
});

test("a file outside the project is not this repo's memory", () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);
  const input = inputFor(editPayload(projectDir, "/etc/hosts"), projectDir);
  assert.equal(hookResponse(input, { storeRoot, now: NOW }), "");
});

test("a broken input cannot break the edit — no paths, no project, no store", () => {
  const missingStore = mkdtempSync(join(tmpdir(), "kage-hook-store-"));
  rmSync(missingStore, { recursive: true, force: true });

  assert.equal(hookResponse({ event: "pre-tool", projectDir: "/nonexistent-repo" }, { storeRoot: missingStore, now: NOW }), "");
  assert.equal(
    hookResponse(
      { event: "pre-tool", toolName: "Edit", filePaths: ["src/limits.ts"], projectDir: "/nonexistent-repo" },
      { storeRoot: missingStore, now: NOW },
    ),
    "",
  );
});

// ── The visceral moment — an edit to a cited file brings the card back ───────────────────────

test("editing a cited file serves its card, stamped with the sha it was verified against", () => {
  const { projectDir, storeRoot } = scratch();
  const card = approvedCard(projectDir, storeRoot);
  assert.equal(card.verify, "verified");
  // Two hours after the card was last written, whenever the suite happens to run.
  const twoHoursOn = () => new Date(Date.parse(card.updatedAt) + 2 * 60 * 60 * 1000);

  const input = inputFor(editPayload(projectDir, join(projectDir, "src", "limits.ts")), projectDir);
  const block = hookResponse(input, { storeRoot, now: twoHoursOn });

  assert.match(block, /^<<<KAGE_MEMORY>>>/);
  assert.match(block, /<<<END_KAGE_MEMORY>>>$/);
  assert.match(block, /\[caution\] tenantLimit comparison is exclusive on purpose/);
  assert.match(block, /withinLimit uses < rather than <=/);
  // The live trust stamp: which sha the claim was checked against, and how old that record is.
  assert.match(block, /verified against [0-9a-f]{7}, updated 2h ago/);
  assert.match(block, /src\/limits\.ts#withinLimit/);
  assert.ok(block.includes(card.id), "the id is what every other verb takes as its argument");
});

test("editing a file no card cites says nothing at all", () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);
  const input = inputFor(editPayload(projectDir, join(projectDir, "src", "unrelated.ts")), projectDir);
  assert.equal(hookResponse(input, { storeRoot, now: NOW }), "");
});

test("a card whose cited code drifted is served, but never as verified", () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);
  // The symbol survives, the bytes do not: the claim is still checkable, just no longer checked.
  writeFileSync(
    join(projectDir, "src", "limits.ts"),
    "export const tenantLimit = 250;\nexport function withinLimit(n: number) { return n < tenantLimit; }\n",
  );

  const input = inputFor(editPayload(projectDir, join(projectDir, "src", "limits.ts")), projectDir);
  const block = hookResponse(input, { storeRoot, now: NOW });
  assert.match(block, /unverified — the cited code changed since [0-9a-f]{7} was checked/);
  assert.doesNotMatch(block, /verified against/);
});

// ── The hardest rule — a stale card is never served ──────────────────────────────────────────

test("a stale card is never served, however exactly it cites the file being edited", () => {
  const { projectDir, storeRoot } = scratch();
  const card = approvedCard(projectDir, storeRoot);
  // Gone since the last sweep: the store still reads "verified", the tree says otherwise. The
  // tree wins here, in the hook, without waiting for a sweep to heal the store.
  rmSync(join(projectDir, "src", "limits.ts"));

  const input = inputFor(editPayload(projectDir, join(projectDir, "src", "limits.ts")), projectDir);
  assert.equal(hookResponse(input, { storeRoot, now: NOW }), "");

  // Withheld, never silent: the event is counted even though the agent was told nothing.
  const store = storeFor(projectDir, storeRoot);
  const withheld = readReceipts(store.dir).filter((event) => event.type === "stale_withheld");
  assert.equal(withheld.length, 1);
  assert.equal(withheld[0].cardId, card.id);
  assert.equal(readReceipts(store.dir).some((event) => event.type === "recall_served"), false);
});

// ── Every injection is a counted event ───────────────────────────────────────────────────────

test("serving a card writes the receipt the Receipts surface replays", () => {
  const { projectDir, storeRoot } = scratch();
  const card = approvedCard(projectDir, storeRoot);
  const input = inputFor(editPayload(projectDir, join(projectDir, "src", "limits.ts")), projectDir);
  assert.notEqual(hookResponse(input, { storeRoot, now: NOW }), "");

  const store = storeFor(projectDir, storeRoot);
  const served = readReceipts(store.dir).filter((event) => event.type === "recall_served");
  assert.equal(served.length, 1);
  assert.equal(served[0].cardId, card.id);
  assert.equal(served[0].at, NOW().toISOString());
  assert.match(served[0].detail ?? "", /src\/limits\.ts/);
});

test("an edit that serves nothing counts nothing — the ledger holds events, not attempts", () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);
  const store = storeFor(projectDir, storeRoot);
  const before = readReceipts(store.dir).length;

  const input = inputFor(editPayload(projectDir, join(projectDir, "src", "unrelated.ts")), projectDir);
  assert.equal(hookResponse(input, { storeRoot, now: NOW }), "");
  assert.equal(readReceipts(store.dir).length, before);
});

// ── The entry the shell script calls, and the wiring that calls it ───────────────────────────

test("the entry wraps a block in the PreToolUse envelope, and prints nothing when there is nothing", () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);

  const out = runHook(editPayload(projectDir, join(projectDir, "src", "limits.ts")), projectDir, {
    storeRoot,
    now: NOW,
  });
  const parsed = JSON.parse(out) as {
    hookSpecificOutput: { hookEventName: string; additionalContext: string };
  };
  assert.equal(parsed.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.match(parsed.hookSpecificOutput.additionalContext, /tenantLimit comparison is exclusive/);
  assert.equal(out.includes("\n"), false, "one line, so the shell can print it unmodified");

  // An empty block prints NOTHING rather than an envelope carrying "", which would still register
  // as an injection on the other side.
  const quiet = editPayload(projectDir, join(projectDir, "src", "unrelated.ts"));
  assert.equal(runHook(quiet, projectDir, { storeRoot, now: NOW }), "");
  assert.equal(runHook("not json", projectDir, { storeRoot, now: NOW }), "");
});

test("the shell hook pipes a real payload to the compiled entry and prints the envelope", () => {
  const { projectDir, storeRoot } = scratch();
  approvedCard(projectDir, storeRoot);
  const script = join(REPO_ROOT, "plugin", "hooks", "kage-cards-context.sh");

  const out = execFileSync("bash", [script], {
    input: editPayload(projectDir, join(projectDir, "src", "limits.ts")),
    encoding: "utf8",
    env: {
      ...process.env,
      // The entry as it ships, beside this compiled test — and a scratch store, so the smoke
      // test never reads the real ~/.kage.
      KAGE_HOOK_ENTRY: join(__dirname, "hook.js"),
      KAGE_STORE_ROOT: storeRoot,
      CLAUDE_PROJECT_DIR: projectDir,
    },
  });
  const parsed = JSON.parse(out) as { hookSpecificOutput: { additionalContext: string } };
  assert.match(parsed.hookSpecificOutput.additionalContext, /tenantLimit comparison is exclusive/);

  // The common path: an edit nothing cites prints not one byte, so a hook firing on every edit
  // stays invisible until it has something to say.
  const quiet = execFileSync("bash", [script], {
    input: editPayload(projectDir, join(projectDir, "src", "unrelated.ts")),
    encoding: "utf8",
    env: { ...process.env, KAGE_HOOK_ENTRY: join(__dirname, "hook.js"), KAGE_STORE_ROOT: storeRoot, CLAUDE_PROJECT_DIR: projectDir },
  });
  assert.equal(quiet, "");

  // No entry to run, and no node: still exit 0, still silent. A memory hook that fails an edit
  // is worse than no memory at all.
  const noEntry = execFileSync("bash", [script], {
    input: editPayload(projectDir, join(projectDir, "src", "limits.ts")),
    encoding: "utf8",
    env: { ...process.env, KAGE_HOOK_ENTRY: "", CLAUDE_PLUGIN_ROOT: "/nonexistent", CLAUDE_PROJECT_DIR: "/nonexistent" },
  });
  assert.equal(noEntry, "");
});

test("the shell hook exists, is executable, and is registered for exactly the editing tools", () => {
  // Compiled logic nothing calls is worth nothing. This is the wiring, asserted.
  const script = join(REPO_ROOT, "plugin", "hooks", "kage-cards-context.sh");
  assert.ok(existsSync(script), script);
  assert.ok(statSync(script).mode & 0o111, "the hook must be executable");

  const hooks = JSON.parse(readFileSync(join(REPO_ROOT, "plugin", "hooks", "hooks.json"), "utf8")) as {
    hooks: { PreToolUse: Array<{ matcher?: string; hooks: Array<{ command: string }> }> };
  };
  const registered = hooks.hooks.PreToolUse.find((entry) =>
    entry.hooks.some((hook) => hook.command.includes("kage-cards-context.sh")),
  );
  assert.ok(registered, "kage-cards-context.sh must be registered under PreToolUse");
  assert.equal(registered.matcher, "Edit|Write|MultiEdit|NotebookEdit");
});
