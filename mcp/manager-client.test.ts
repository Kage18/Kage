import test from "node:test";
import assert from "node:assert/strict";
import { MANAGER_ALLOWED_TOOLS, buildManagerArgs, composePrompt, guardManagerProse, parseManagerStream } from "./delegation/manager-client.js";

test("the manager launch carries its tools and its constitution", () => {
  const launch = buildManagerArgs({ mcpConfigPath: "/tmp/mcp.json", prompt: "what needs me?", agent: "claude" });
  assert.equal(launch.command, "claude");
  assert.equal(launch.args.includes("--mcp-config"), true);
  assert.equal(launch.args[launch.args.indexOf("--mcp-config") + 1], "/tmp/mcp.json");

  const allowed = launch.args[launch.args.indexOf("--allowedTools") + 1];
  for (const tool of MANAGER_ALLOWED_TOOLS) assert.ok(allowed.includes(tool), `${tool} must be pre-approved`);
  // Some clients hide MCP tools behind ToolSearch; without it the manager can see the
  // tools but never load them (observed live).
  assert.ok(allowed.includes("ToolSearch"));
  // The manager may act on delegation, but nothing here grants it shell or file writes.
  assert.equal(allowed.includes("Bash"), false);
  assert.equal(allowed.includes("Write"), false);

  const constitution = launch.args[launch.args.indexOf("--append-system-prompt") + 1];
  assert.match(constitution, /FIRST tool call in any session is kage_room_state/);
  assert.match(constitution, /PASS YOUR JUDGMENT WITH IT/);
});

test("prompts replay recent history so a one-shot manager keeps the thread", () => {
  const prompt = composePrompt("/repo", [
    { role: "you", text: "what needs me?" },
    { role: "kage", text: "one claim is ready" },
  ], "merge it");
  assert.match(prompt, /repository at \/repo/);
  assert.match(prompt, /User: what needs me\?/);
  assert.match(prompt, /You: one claim is ready/);
  assert.match(prompt, /User: merge it/);

  // History is bounded so a long conversation cannot grow the prompt without limit.
  const long = Array.from({ length: 30 }, (_, index) => ({ role: "you" as const, text: `turn ${index}` }));
  const bounded = composePrompt("/repo", long, "now what?");
  assert.equal(bounded.includes("turn 0"), false);
  assert.equal(bounded.includes("turn 29"), true);
});

test("with no facts to check against, verdicts and n/n counts still fall back to redaction", () => {
  // Verbatim from the first live manager session — it broke the constitution rule.
  const live = guardManagerProse("Dispatched and back already: VERIFIED 3/3, single-file 1-line diff.");
  assert.doesNotMatch(live.text, /VERIFIED/);
  assert.doesNotMatch(live.text, /3\/3/);
  assert.match(live.text, /\[verdict on the card\]/);
  // The manager's own comma-separated "1-line" survives unredacted now: with no facts
  // wired up, size claims are left alone rather than blindly censored (rule: dollars and
  // sizes never fall back to blind redaction, only verdicts and n/n counts do).
  assert.match(live.text, /1-line/);
  assert.deepEqual(live.corrections, ["VERIFIED 3/3"]);

  // Also verbatim from a live session, after the first version of the guard shipped:
  // the count leaked through in words instead of a fraction.
  const counted = guardManagerProse("the kernel verified all 3 checks (tests, diff-size, citations)");
  assert.doesNotMatch(counted.text, /all 3 checks/);
  assert.match(counted.text, /\[counts on the card\]/);
  // A number that is not a card number survives — this is a memory's content, not a verdict.
  const memoryFact = guardManagerProse("The backoff cap was 3 attempts for the old SOAP gateway.");
  assert.deepEqual(memoryFact.corrections, []);

  const failing = guardManagerProse("It came back NOT VERIFIED so I would not merge yet.");
  assert.match(failing.text, /\[verdict on the card\]/);
  assert.doesNotMatch(failing.text, /NOT VERIFIED/);

  // Dollar figures and diff-size restatements are never blind-redacted, even with no
  // facts at all — they mostly fire on legitimate prose that has nothing to do with a
  // card, and silently erasing them would be noise, not safety.
  const cost = guardManagerProse("That run cost $0.22 and changed 3 files changed.");
  assert.equal(cost.text, "That run cost $0.22 and changed 3 files changed.");
  assert.deepEqual(cost.corrections, []);

  // Judgment and pointers survive untouched — the guard removes restated verdicts,
  // not the manager's actual contribution.
  const useful = guardManagerProse("Check that the idempotency key gates the credit logic at retry.ts line 42, not just a comment.");
  assert.deepEqual(useful.corrections, []);
  assert.equal(useful.text, "Check that the idempotency key gates the credit logic at retry.ts line 42, not just a comment.");
});

test("guarded prose flows through the parsed reply", () => {
  const stream = JSON.stringify({ type: "result", result: "All good — VERIFIED 2/2." });
  const reply = parseManagerStream(stream);
  assert.ok(reply);
  assert.doesNotMatch(reply.text, /VERIFIED 2\/2/);
  assert.deepEqual(reply.corrections, ["VERIFIED 2/2"]);
});

test("the manager's stream yields its final words, the tools it used, and its cost", () => {
  const stream = [
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "mcp__kage__kage_room_state" }] } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "interim thought" }] } }),
    JSON.stringify({ type: "result", result: "One claim is ready to merge.", total_cost_usd: 0.12 }),
  ].join("\n");
  const reply = parseManagerStream(stream);
  assert.ok(reply);
  assert.equal(reply.ok, true);
  assert.equal(reply.text, "One claim is ready to merge.");
  assert.deepEqual(reply.tools, ["mcp__kage__kage_room_state"]);
  assert.equal(reply.cost_usd, 0.12);

  // Non-JSON output is not mistaken for an answer.
  assert.equal(parseManagerStream("command not found"), null);
});
