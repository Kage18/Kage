import test from "node:test";
import assert from "node:assert/strict";

import {
  agentCommand,
  agentEnv,
  applyEvent,
  closeSession,
  newSession,
  parseStreamLine,
  stripTicks,
  type AgentSession,
} from "./session.js";

function session(): AgentSession {
  return newSession({ session_id: "s-1", work_id: "repo:x:proposal:one", agent: "claude" });
}

function feed(lines: string[]): AgentSession {
  let current = session();
  for (const line of lines) {
    for (const event of parseStreamLine(line)) current = applyEvent(current, event);
  }
  return current;
}

const INIT = JSON.stringify({ type: "system", subtype: "init" });
const tool = (name: string, input: unknown) =>
  JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
const text = (body: string) =>
  JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: body }] } });
const RESULT = JSON.stringify({ type: "result", subtype: "success" });

test("an agent runs headless, and only agents whose contract was checked can launch", () => {
  const claude = agentCommand("claude", "do the thing");
  assert.deepEqual(claude, {
    command: "claude",
    args: ["--print", "--output-format", "stream-json", "--verbose", "do the thing"],
  });
  // Guessing flags produces a process that hangs on a TTY or prints help — refuse instead.
  assert.equal(agentCommand("some-unknown-agent", "x"), null);
});

test("the child's environment carries the proxy and nothing else", () => {
  assert.deepEqual(agentEnv(8788), { ANTHROPIC_BASE_URL: "http://127.0.0.1:8788" });
});

test("a tool call becomes a readable line, not raw JSON", () => {
  const [event] = parseStreamLine(tool("Edit", { file_path: "src/limits.ts" }));
  assert.equal(event.kind, "tool");
  assert.equal(event.summary, "Edit src/limits.ts");
});

test("one assistant message can carry prose and several tool calls at once", () => {
  const line = JSON.stringify({
    type: "assistant",
    message: {
      content: [
        { type: "text", text: "Let me look at both files." },
        { type: "tool_use", name: "Read", input: { file_path: "a.ts" } },
        { type: "tool_use", name: "Read", input: { file_path: "b.ts" } },
      ],
    },
  });
  const events = parseStreamLine(line);
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((e) => e.kind), ["text", "tool", "tool"]);
});

// An agent is free to print whatever it likes. A stray line must never break a running session.
test("noise in the stream is ignored rather than fatal", () => {
  for (const noise of ["", "   ", "Loading…", "{ not json", "[]", JSON.stringify({ type: "unknown" })]) {
    assert.deepEqual(parseStreamLine(noise), [], `"${noise}" must yield nothing`);
  }
});

test("the session moves starting → running → exited as the stream arrives", () => {
  assert.equal(session().state, "starting");
  assert.equal(feed([INIT]).state, "running");
  assert.equal(feed([INIT, tool("Read", {}), RESULT]).state, "exited");
});

test("a tool call alone starts the session, because not every agent emits an init line", () => {
  assert.equal(feed([tool("Read", { file_path: "a.ts" })]).state, "running");
});

test("an error result fails the session rather than quietly completing it", () => {
  const line = JSON.stringify({ type: "result", subtype: "error", is_error: true });
  assert.equal(feed([INIT, line]).state, "failed");
});

// THE rule. An agent that printed "done" and then exited non-zero did not succeed, and reporting
// the stream's optimism would be exactly the quiet lie this product exists to prevent.
test("a non-zero exit overrides a stream that claimed success", () => {
  const finished = feed([INIT, tool("Edit", {}), RESULT]);
  assert.equal(finished.state, "exited");
  const closed = closeSession(finished, 1);
  assert.equal(closed.state, "failed");
  assert.equal(closed.exit_code, 1);
});

test("a clean exit stays exited", () => {
  const closed = closeSession(feed([INIT, RESULT]), 0);
  assert.equal(closed.state, "exited");
  assert.equal(closed.exit_code, 0);
});

test("events are sequenced so the UI can key them without guessing", () => {
  const s = feed([INIT, tool("Read", {}), tool("Edit", {})]);
  assert.deepEqual(s.events.map((e) => e.seq), [0, 1, 2]);
});

test("cost stays null until an agent reports one — never zero", () => {
  // Zero would read as "this run was free", which is a measurement nobody made.
  assert.equal(feed([INIT, RESULT]).cost_usd, null);
});

// ── The run strip ────────────────────────────────────────────────────────────────────────────

test("the strip draws one tick per tool call, and nothing per prose", () => {
  const s = feed([INIT, text("thinking"), tool("Read", {}), tool("Edit", {}), text("more"), tool("Bash", {})]);
  assert.equal(stripTicks(s.events).length, 3);
});

// The honesty rule that makes the strip worth showing at all: a green tick asserts that memory
// reached the agent, and that fact lives in the proxy. With nothing supplied, there are none.
test("with no recall data the strip shows NO recalls rather than inventing them", () => {
  const s = feed([INIT, tool("Read", {}), tool("Edit", {})]);
  assert.equal(stripTicks(s.events).every((tick) => !tick.recall), true);
});

test("recalls are marked by assistant TURN index, never by timing", () => {
  const s = feed([
    text("turn one"),
    tool("Read", {}),
    text("turn two"),
    tool("Edit", {}),
    tool("Bash", {}),
  ]);
  // The proxy attached memory on the second turn only.
  const ticks = stripTicks(s.events, new Set([2]));
  assert.deepEqual(ticks.map((t) => t.recall), [false, true, true]);
});

test("an empty session has an empty strip, not a placeholder", () => {
  assert.deepEqual(stripTicks([]), []);
});
