import test from "node:test";
import assert from "node:assert/strict";
import { parseResponseText } from "./anthropic-proxy.js";
import { anthropicGateway, INTENT_MAX_CHARS } from "./gateway.js";
import type { RepositoryIdentity } from "../protocol/types.js";

// THE INGESTION GAP THIS CLOSES.
//
// Kage could not decide what was worth saving because it never stored the one signal that says so:
// the agent's own stated intent. Measured on a real session, the store held 498 tool_result events
// whose entire payload was {tool, path, outcome} and ZERO events carrying assistant prose — so the
// pair (what the agent expected, what actually happened) was uncomputable after the fact.
//
// The prose was never missing from the wire. `responseBody` carries the assistant's text blocks
// alongside its tool_use blocks; the parser simply dropped the text and kept the tool names. This
// captures it, attached to the tool_result event it precedes.
//
// Why the intent is attached to tool_result rather than a new event type: the v1 evidence-event
// enum is a FROZEN wire type (validate.ts EVIDENCE_EVENT_TYPES), so a new type would break protocol
// compatibility. Payloads are free-form JSON, so an added field is additive — old consumers ignore
// it. Practically it is also the right home: the prose immediately before a tool call carries BOTH
// the reaction to the previous result AND the expectation for this one, which is exactly the pair a
// divergence detector needs, and it is only ever stored in the local_raw tier.

const REPO: RepositoryIdentity = {
  repo_id: "repo_test",
  root: "/tmp/repo",
  remote: null,
  branch: "master",
  commit: "abc123",
  worktree: "/tmp/repo",
};

function ctx(responseBody: string, userPrompt = "check the thing") {
  return { repository: REPO, sessionId: "sess-1", userPrompt, responseBody, now: new Date("2026-07-24T00:00:00.000Z") };
}

function jsonResponse(blocks: unknown[]): string {
  return JSON.stringify({ id: "msg_1", type: "message", role: "assistant", content: blocks });
}

// ── the parser ──────────────────────────────────────────────────────────────────

test("parseResponseText extracts the assistant's prose and ignores tool_use blocks", () => {
  const raw = jsonResponse([
    { type: "text", text: "The attach line should say wired. Let me verify it." },
    { type: "tool_use", id: "tu_1", name: "Bash", input: { command: "kage status" } },
  ]);
  assert.equal(parseResponseText(raw), "The attach line should say wired. Let me verify it.");
});

test("parseResponseText joins multiple text blocks in order", () => {
  const raw = jsonResponse([
    { type: "text", text: "First thought." },
    { type: "tool_use", id: "tu_1", name: "Read", input: {} },
    { type: "text", text: "Second thought." },
  ]);
  assert.equal(parseResponseText(raw), "First thought.\nSecond thought.");
});

test("parseResponseText reassembles streamed text deltas", () => {
  // SSE is the common shape in practice; the prose arrives as text_delta fragments.
  const raw = [
    `data: ${JSON.stringify({ type: "content_block_start", content_block: { type: "text", text: "" } })}`,
    `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "I expect " } })}`,
    `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "wired." } })}`,
    `data: ${JSON.stringify({ type: "content_block_start", content_block: { type: "tool_use", id: "tu_1", name: "Bash" } })}`,
    "data: [DONE]",
  ].join("\n");
  assert.equal(parseResponseText(raw), "I expect wired.");
});

test("parseResponseText returns empty string when there is no prose, and never throws on junk", () => {
  assert.equal(parseResponseText(jsonResponse([{ type: "tool_use", id: "t", name: "Bash", input: {} }])), "");
  assert.equal(parseResponseText("not json at all"), "");
  assert.equal(parseResponseText(""), "");
  assert.equal(parseResponseText('{"content": "wrong shape"}'), "");
});

// ── the capture ─────────────────────────────────────────────────────────────────

test("captureEvents attaches the stated intent to the tool_result event it precedes", () => {
  const events = anthropicGateway.captureEvents(ctx(jsonResponse([
    { type: "text", text: "kage status should report attach: wired. Verifying." },
    { type: "tool_use", id: "tu_1", name: "Bash", input: { command: "kage status" } },
  ])));

  const toolResults = events.filter((e) => e.event_type === "tool_result");
  assert.equal(toolResults.length, 1);
  const payload = toolResults[0].payload as Record<string, unknown>;
  assert.equal(payload.tool, "Bash", "the existing payload contract is preserved");
  assert.equal(payload.intent, "kage status should report attach: wired. Verifying.");
  // Conversation content is local-only. This must never be promoted to a shareable tier.
  assert.equal(toolResults[0].privacy_class, "local_raw");
});

test("every tool_use in one turn carries the same stated intent", () => {
  // The prose covers the whole turn, so a turn that fires three tools shares one intent.
  const events = anthropicGateway.captureEvents(ctx(jsonResponse([
    { type: "text", text: "Checking all three endpoints." },
    { type: "tool_use", id: "a", name: "Bash", input: {} },
    { type: "tool_use", id: "b", name: "Read", input: {} },
    { type: "tool_use", id: "c", name: "Grep", input: {} },
  ])));
  const intents = events.filter((e) => e.event_type === "tool_result")
    .map((e) => (e.payload as Record<string, unknown>).intent);
  assert.deepEqual(intents, ["Checking all three endpoints.", "Checking all three endpoints.", "Checking all three endpoints."]);
});

test("a turn with no prose carries no intent field — an empty string is not evidence", () => {
  const events = anthropicGateway.captureEvents(ctx(jsonResponse([
    { type: "tool_use", id: "tu_1", name: "Bash", input: {} },
  ])));
  const payload = events.filter((e) => e.event_type === "tool_result")[0].payload as Record<string, unknown>;
  assert.ok(!("intent" in payload), "absent rather than empty, so queries can trust the field's presence");
});

test("intent is bounded so one verbose turn cannot bloat the event store", () => {
  const long = "x".repeat(INTENT_MAX_CHARS * 3);
  const events = anthropicGateway.captureEvents(ctx(jsonResponse([
    { type: "text", text: long },
    { type: "tool_use", id: "tu_1", name: "Bash", input: {} },
  ])));
  const intent = (events.filter((e) => e.event_type === "tool_result")[0].payload as Record<string, unknown>).intent;
  assert.equal(typeof intent, "string");
  assert.ok((intent as string).length <= INTENT_MAX_CHARS, `intent must be truncated to ${INTENT_MAX_CHARS}`);
});

test("the prompt event is unchanged — user text and assistant prose stay separate", () => {
  const events = anthropicGateway.captureEvents(ctx(jsonResponse([
    { type: "text", text: "assistant prose" },
    { type: "tool_use", id: "tu_1", name: "Bash", input: {} },
  ]), "the user's actual question"));
  const prompt = events.find((e) => e.event_type === "prompt");
  assert.ok(prompt, "a non-empty user prompt still emits its own event");
  assert.deepEqual(prompt.payload, { text: "the user's actual question" });
});
