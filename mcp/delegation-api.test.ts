import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { createDelegationFeed, createPtyState, createRoomState, handleDelegationRoute, type DelegationFeed } from "./delegation/api.js";
import type { askManager } from "./delegation/manager-client.js";
import { guardRequest } from "./delegation/guard.js";
import { RUN_STATES, createRun, patchRun, readRun, runTranscriptPath, transitionRun } from "./delegation/contract.js";
import { delegationAppHtml } from "./delegation/app-html.js";
import { dispatchRun } from "./delegation/dispatch.js";
import { mergeRun } from "./delegation/ratify.js";
import { stubAdapter } from "./delegation/adapters/stub.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { superviseRun } from "./delegation/supervisor.js";
import { isRunLive, sendControl } from "./delegation/control.js";
import { goalForRun, readGoal } from "./delegation/goal.js";
import { DEFAULT_SESSION, readActiveGoal } from "./delegation/room-sessions.js";

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-api-"));
}

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempGitProject(): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "src", "retry.ts"), "export function retry() { return true; }\n", "utf8");
  writeDelegationConfig(project, { test: "node -e \"process.exit(0)\"" });
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

const TOKEN = "test-token-0123456789abcdef0123456789abcdef";

/**
 * A miniature of the daemon's mounting: guard first, then the delegation handler.
 * Testing through this wrapper keeps the guard contract part of every API test —
 * a route that works unguarded is exactly the bug Phase 1.1 exists to prevent.
 */
async function startApi(
  projectDir: string,
  options: {
    askManagerFn?: typeof askManager;
    askRoomFn?: unknown;
    ensurePtyAttachedFn?: unknown;
    takeOverRunFn?: unknown;
    handBackFn?: unknown;
  } = {},
): Promise<{ server: Server; port: number; feed: DelegationFeed }> {
  const feed = createDelegationFeed(projectDir, { heartbeatMs: 60_000 });
  const room = createRoomState();
  const pty = createPtyState();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const verdict = guardRequest(
      { method: req.method ?? "GET", headers: req.headers as Record<string, string | string[] | undefined>, pathname: url.pathname },
      { allowedOrigins: ["http://127.0.0.1"], token: TOKEN },
    );
    if (!verdict.ok) {
      res.writeHead(verdict.status, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: verdict.reason }));
      return;
    }
    if (
      await handleDelegationRoute(
        {
          projectDir,
          feed,
          room,
          pty,
          askManagerFn: options.askManagerFn,
          askRoomFn: options.askRoomFn as never,
          ensurePtyAttachedFn: options.ensurePtyAttachedFn as never,
          takeOverRunFn: options.takeOverRunFn as never,
          handBackFn: options.handBackFn as never,
        },
        req,
        res,
        url,
      )
    )
      return;
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, port, feed };
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("timed out waiting for condition");
    await pause(20);
  }
}

function apiFetch(port: number, path: string, options: RequestInit & { token?: boolean } = {}): Promise<Response> {
  const headers: Record<string, string> = { host: `127.0.0.1:${port}`, "content-type": "application/json" };
  if (options.token !== false && options.method && options.method !== "GET") {
    headers.authorization = `Bearer ${TOKEN}`;
  }
  return fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers });
}

test("GET /runs lists what the kernel knows, in RunView form", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const empty = await (await apiFetch(port, "/runs")).json() as { ok: boolean; runs: unknown[] };
    assert.equal(empty.ok, true);
    assert.deepEqual(empty.runs, []);

    createRun(project, { intent: "add a health endpoint", type: "chore", agent: "stub" });
    const listed = await (await apiFetch(port, "/runs")).json() as { runs: Array<Record<string, unknown>> };
    assert.equal(listed.runs.length, 1);
    // The API must expose the derived truth, not just the raw record.
    assert.equal(listed.runs[0].display_state, "draft");
    assert.equal(listed.runs[0].ownership, "working");
  } finally {
    feed.close();
    server.close();
  }
});

test("a mutating route without the token is refused before the handler runs", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const refused = await apiFetch(port, "/runs", {
      method: "POST",
      body: JSON.stringify({ intent: "should never be created" }),
      token: false,
    });
    assert.equal(refused.status, 401);
    const listed = await (await apiFetch(port, "/runs")).json() as { runs: unknown[] };
    assert.equal(listed.runs.length, 0, "the refused dispatch must not have created a run");
  } finally {
    feed.close();
    server.close();
  }
});

test("POST /runs compiles a brief and returns the created run; hold skips the supervisor", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const created = await (await apiFetch(port, "/runs", {
      method: "POST",
      // hold:true — tests must not spawn a detached supervisor process.
      body: JSON.stringify({ intent: "rename the config key", agent: "stub", type: "chore", hold: true }),
    })).json() as { ok: boolean; run: Record<string, unknown>; supervisor_pid: number | null };
    assert.equal(created.ok, true);
    assert.equal(created.run.state, "briefed");
    assert.equal(created.supervisor_pid, null);

    const detail = await (await apiFetch(port, `/runs/${created.run.id}`)).json() as { ok: boolean; brief?: string };
    assert.equal(detail.ok, true);
    assert.ok(detail.brief && detail.brief.length > 0, "the compiled brief is part of the run detail");
  } finally {
    feed.close();
    server.close();
  }
});

test("POST /runs without an intent is a 400, not a crash", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const res = await apiFetch(port, "/runs", { method: "POST", body: JSON.stringify({}) });
    assert.equal(res.status, 400);
    const body = await res.json() as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert.match(body.error, /intent/);
  } finally {
    feed.close();
    server.close();
  }
});

test("tell reports its delivery honestly — a draft run with no live agent is never 'delivered'", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const run = createRun(project, { intent: "steer target", type: "chore", agent: "stub" });
    const out = await (await apiFetch(port, `/runs/${run.id}/tell`, {
      method: "POST",
      body: JSON.stringify({ message: "prefer the small fix" }),
    })).json() as { ok: boolean; delivery: string };
    assert.equal(out.ok, true);
    assert.notEqual(out.delivery, "delivered", "no supervisor socket exists, so delivery must not be claimed");
    assert.ok(["stored", "refused", "resumed"].includes(out.delivery), `delivery was ${out.delivery}`);
  } finally {
    feed.close();
    server.close();
  }
});

test("interrupt is an honest 503 with no live supervisor, and delivers to one that is — the session stays alive", async () => {
  const project = tempGitProject();
  const { server, port, feed } = await startApi(project);
  try {
    const idle = createRun(project, { intent: "idle run", type: "chore", agent: "stub" });
    const notLive = await apiFetch(port, `/runs/${idle.id}/interrupt`, { method: "POST" });
    assert.equal(notLive.status, 503);
    const notLiveBody = await notLive.json() as { ok: boolean; error: string };
    assert.equal(notLiveBody.ok, false);
    assert.match(notLiveBody.error, /no live supervisor/);

    const missing = await apiFetch(port, "/runs/does-not-exist/interrupt", { method: "POST" });
    assert.equal(missing.status, 404);

    // A genuinely live supervisor, held open by a real control socket this route reaches —
    // the same blocked-loop machinery delegation.test.ts exercises directly.
    const task = createRun(project, { intent: "needs a decision", type: "chore", agent: "stub" });
    transitionRun(project, task.id, "briefed", "kernel");
    const liveStub = stubAdapter({ live: { question: "proceed with plan A or B?" } });
    const supervised = superviseRun(project, task.id, liveStub);
    await waitFor(() => readRun(project, task.id).state === "blocked");
    // The state flip and the control socket becoming reachable are two different signals
    // — waiting on the socket itself (retried, not a one-shot check) is what the part-1
    // regression tests do before sending anything through it, and closes the gap a fixed
    // assumption about ordering does not.
    await waitFor(() => isRunLive(project, task.id));

    const live = await apiFetch(port, `/runs/${task.id}/interrupt`, { method: "POST" });
    assert.equal(live.status, 200);
    const liveBody = await live.json() as { ok: boolean; delivered: boolean };
    assert.equal(liveBody.ok, true);
    assert.equal(liveBody.delivered, true, "the interrupt frame actually reached the live socket");
    // Unlike stop, an interrupt never ends the session — it is still blocked, answerable.
    assert.equal(readRun(project, task.id).state, "blocked");

    const reply = await sendControl(project, task.id, { op: "tell", message: "go with plan A" });
    assert.equal(reply?.delivered, true);
    await supervised;
    assert.equal(readRun(project, task.id).state, "ready");
  } finally {
    feed.close();
    server.close();
  }
});

test("GET/POST /runs/:id/steers exposes the queue and maps ops to the kernel mutations", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const run = createRun(project, { intent: "queue target", type: "chore", agent: "stub" });

    const empty = await (await apiFetch(port, `/runs/${run.id}/steers`)).json() as { ok: boolean; steers: unknown[] };
    assert.equal(empty.ok, true);
    assert.deepEqual(empty.steers, []);

    // Seed two queued steers through the real tell path — no supervisor exists yet, so
    // both are recorded but stay queued (refused delivery, never a lie about it).
    await apiFetch(port, `/runs/${run.id}/tell`, { method: "POST", body: JSON.stringify({ message: "first" }) });
    await apiFetch(port, `/runs/${run.id}/tell`, { method: "POST", body: JSON.stringify({ message: "second" }) });

    const listed = await (await apiFetch(port, `/runs/${run.id}/steers`)).json() as {
      steers: Array<{ id: string; message: string; status: string }>;
    };
    assert.equal(listed.steers.length, 2);
    assert.ok(listed.steers.every((s) => s.status === "queued"));
    const [first, second] = listed.steers;

    const edited = await (await apiFetch(port, `/runs/${run.id}/steers`, {
      method: "POST",
      body: JSON.stringify({ op: "edit", id: first.id, message: "first, revised" }),
    })).json() as { ok: boolean; steers: Array<{ id: string; message: string }> };
    assert.equal(edited.ok, true);
    assert.equal(edited.steers.find((s) => s.id === first.id)?.message, "first, revised");

    const reordered = await (await apiFetch(port, `/runs/${run.id}/steers`, {
      method: "POST",
      body: JSON.stringify({ op: "reorder", order: [second.id, first.id] }),
    })).json() as { ok: boolean; steers: Array<{ id: string }> };
    assert.equal(reordered.ok, true);
    assert.deepEqual(reordered.steers.map((s) => s.id), [second.id, first.id]);

    const deleted = await (await apiFetch(port, `/runs/${run.id}/steers`, {
      method: "POST",
      body: JSON.stringify({ op: "delete", id: first.id }),
    })).json() as { ok: boolean; steers: Array<{ id: string }> };
    assert.equal(deleted.ok, true);
    assert.deepEqual(deleted.steers.map((s) => s.id), [second.id]);

    const badOp = await apiFetch(port, `/runs/${run.id}/steers`, { method: "POST", body: JSON.stringify({ op: "bogus" }) });
    assert.equal(badOp.status, 400);

    const missing = await apiFetch(port, "/runs/does-not-exist/steers");
    assert.equal(missing.status, 404);
  } finally {
    feed.close();
    server.close();
  }
});

test("POST /runs/:id/steers op:add appends a pure queue entry — no delivery attempted", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const run = createRun(project, { intent: "queue-only target", type: "chore", agent: "stub" });
    const added = await (await apiFetch(port, `/runs/${run.id}/steers`, {
      method: "POST",
      body: JSON.stringify({ op: "add", message: "queue this for later" }),
    })).json() as { ok: boolean; steers: Array<{ message: string; status: string }> };
    assert.equal(added.ok, true);
    assert.equal(added.steers.length, 1);
    assert.equal(added.steers[0].message, "queue this for later");
    assert.equal(added.steers[0].status, "queued", "op:add never attempts delivery, so it can never be delivered");

    const blank = await apiFetch(port, `/runs/${run.id}/steers`, { method: "POST", body: JSON.stringify({ op: "add", message: "   " }) });
    assert.equal(blank.status, 400);
  } finally {
    feed.close();
    server.close();
  }
});

test("take-over: the seam's attachment is wired to the pty routes, a second take-over is idempotent, and handback clears it", async () => {
  const project = tempProject();
  const written: string[] = [];
  const resizes: Array<[number, number]> = [];
  const fakeTakeOver = async (_projectDir: string, runId: string) => ({
    ok: true as const,
    runId,
    pid: 4242,
    attachment: {
      write: (data: string) => written.push(data),
      resize: (cols: number, rows: number) => resizes.push([cols, rows]),
      snapshot: () => "banner\n",
      onData: () => {},
      onExit: () => {},
      detach: () => {},
    },
  });
  const fakeHandBack = async (projectDir: string, runId: string) => ({ ok: true as const, task: readRun(projectDir, runId) });
  const { server, port, feed } = await startApi(project, { takeOverRunFn: fakeTakeOver, handBackFn: fakeHandBack });
  try {
    const run = createRun(project, { intent: "take over target", type: "chore", agent: "stub" });

    const missing = await apiFetch(port, "/runs/does-not-exist/takeover", { method: "POST" });
    assert.equal(missing.status, 404);

    const taken = await (await apiFetch(port, `/runs/${run.id}/takeover`, { method: "POST" })).json() as { ok: boolean; pid: number };
    assert.equal(taken.ok, true);
    assert.equal(taken.pid, 4242, "the seam's pid is what the route reports — never a real claude spawned");

    const snap = await (await apiFetch(port, `/runs/${run.id}/pty/snapshot`)).json() as { ok: boolean; alive: boolean; scrollback: string };
    assert.equal(snap.alive, true);
    assert.equal(snap.scrollback, "banner\n");

    const wrote = await apiFetch(port, `/runs/${run.id}/pty/write`, { method: "POST", body: JSON.stringify({ data: "ls\n" }) });
    assert.equal(wrote.status, 202);
    assert.deepEqual(written, ["ls\n"]);

    const resized = await apiFetch(port, `/runs/${run.id}/pty/resize`, { method: "POST", body: JSON.stringify({ cols: 100, rows: 30 }) });
    assert.equal(resized.status, 202);
    assert.deepEqual(resizes, [[100, 30]]);

    // A second take-over while one is already active is idempotent, not a re-spawn.
    const again = await (await apiFetch(port, `/runs/${run.id}/takeover`, { method: "POST" })).json() as { ok: boolean; already?: boolean };
    assert.equal(again.ok, true);
    assert.equal(again.already, true);

    const handedBack = await (await apiFetch(port, `/runs/${run.id}/handback`, { method: "POST" })).json() as { ok: boolean };
    assert.equal(handedBack.ok, true);

    // Once handed back, the pty routes are honestly 503 — nothing is live to write to.
    const deadWrite = await apiFetch(port, `/runs/${run.id}/pty/write`, { method: "POST", body: JSON.stringify({ data: "x" }) });
    assert.equal(deadWrite.status, 503);
  } finally {
    feed.close();
    server.close();
  }
});

test("take-over reports a real refusal as its own 409 reason, and handback with nothing active is an honest 409", async () => {
  const project = tempProject();
  const fakeTakeOver = async () => ({ ok: false as const, reason: "no agent session recorded — there is no session to take over." });
  const { server, port, feed } = await startApi(project, { takeOverRunFn: fakeTakeOver });
  try {
    const run = createRun(project, { intent: "no session", type: "chore", agent: "stub" });
    const refused = await apiFetch(port, `/runs/${run.id}/takeover`, { method: "POST" });
    assert.equal(refused.status, 409);
    const refusedBody = await refused.json() as { ok: boolean; error: string };
    assert.match(refusedBody.error, /no agent session/);

    // No takeover ever happened, so the real handBack (untouched by any seam) must
    // refuse honestly too — never spawning a reattach for a session that was never seized.
    const handback = await apiFetch(port, `/runs/${run.id}/handback`, { method: "POST" });
    assert.equal(handback.status, 409);
    const handbackBody = await handback.json() as { ok: boolean; error: string };
    assert.match(handbackBody.error, /no active terminal take-over/);
  } finally {
    feed.close();
    server.close();
  }
});

test("merge on a run that is not ready is a 409 with the kernel's reason", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const run = createRun(project, { intent: "premature merge", type: "chore", agent: "stub" });
    const res = await apiFetch(port, `/runs/${run.id}/merge`, { method: "POST" });
    assert.equal(res.status, 409);
    const body = await res.json() as { ok: boolean; detail: string };
    assert.equal(body.ok, false);
    assert.match(body.detail, /ready/i);
  } finally {
    feed.close();
    server.close();
  }
});

test("reject requires a reason — the rejection is memory, not a delete", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const run = createRun(project, { intent: "reject target", type: "chore", agent: "stub" });
    const missing = await apiFetch(port, `/runs/${run.id}/reject`, { method: "POST", body: JSON.stringify({}) });
    assert.equal(missing.status, 400);
    assert.equal(readRun(project, run.id).state, "draft", "a refused rejection changes nothing");
  } finally {
    feed.close();
    server.close();
  }
});

test("unknown run ids are a 404, and foreign paths fall through to the daemon", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const missing = await apiFetch(port, "/runs/does-not-exist");
    assert.equal(missing.status, 404);
    const foreign = await apiFetch(port, "/kage/metrics");
    assert.equal(foreign.status, 404, "non-delegation paths are not handled here");
  } finally {
    feed.close();
    server.close();
  }
});

test("SSE handshake is deterministic and API mutations notify without watcher latency", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const controller = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/runs/events`, {
      headers: { host: `127.0.0.1:${port}` },
      signal: controller.signal,
    });
    assert.equal(res.headers.get("content-type"), "text/event-stream");
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const readUntil = async (marker: string) => {
      const deadline = Date.now() + 4000;
      while (!buffer.includes(marker)) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${marker} in: ${buffer}`);
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
      }
    };
    await readUntil("event: hello");
    assert.equal(feed.clientCount(), 1);

    // Events are notifications: the payload carries run_id + seq and nothing else.
    feed.notify("some-run");
    await readUntil("event: run");
    assert.match(buffer, /"run_id":"some-run"/);
    assert.match(buffer, /"seq":\d+/);
    assert.doesNotMatch(buffer, /"state"/, "state never rides the event bus — clients re-read /runs");
    controller.abort();
  } finally {
    feed.close();
    server.close();
  }
});

test("the emitted client script is syntactically valid JavaScript", () => {
  // The app is authored inside a TS template literal, where an unescaped \\n in a
  // client string silently becomes a real newline and kills the whole script at
  // parse time. new Function() is the same parser the browser uses.
  const html = delegationAppHtml("tok");
  const script = html.split("<script>")[1].split("</" + "script>")[0];
  assert.doesNotThrow(() => new Function(script));
});

test("the client script never assigns innerHTML — DOM nodes only, never string HTML", () => {
  // The room now renders markdown (bold, inline code) straight from manager text.
  // innerHTML would turn that into live HTML at the first "<" a manager ever wrote;
  // the renderer must build every node by hand instead.
  const html = delegationAppHtml("tok");
  const script = html.split("<script>")[1].split("</" + "script>")[0];
  assert.ok(!script.includes("innerHTML"), "the client script must never use innerHTML");
});

test("the tokenizer's delimiter list splits on markdown emphasis so run ids inside **bold** are matched", () => {
  // The manager writes run ids wrapped in **bold** or inline code; tokenizeText must
  // split on "*" (and on a backtick, appended via charCode since this file can't hold
  // a literal backtick) or the token never equals a bare run id.
  const html = delegationAppHtml("tok");
  const script = html.split("<script>")[1].split("</" + "script>")[0];
  assert.ok(script.includes('"<", ">", "*"'), "the delims array must include \"*\" for markdown emphasis");
});

test("the app HTML is self-contained, carries the token, and never leaks the placeholder", () => {
  const html = delegationAppHtml("tok-abc123");
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes('"tok-abc123"'), "the mutation token is injected");
  assert.ok(!html.includes("__KAGE_TOKEN__"), "the placeholder must be replaced");
  assert.ok(!/https?:\/\/(?!127\.0\.0\.1)/.test(html), "no external hosts — the page must work offline behind the guard");
  for (const view of ["v-room", "v-work", "v-memory"]) assert.ok(html.includes(view), `${view} missing`);
  assert.ok(html.includes("/preflight?intent="), "the composer asks for a pre-flight forecast while you type");
  // One surface, one power set. Inbox/Runs/Board were three doors into the same runs
  // with different powers each; if a second detail pane (or a resurrected door) ever
  // appears, powers have started depending on the door again.
  for (const gone of ["v-inbox", "v-runs", "v-board"]) assert.ok(!html.includes(gone), `${gone} resurrected — Work is the one surface`);
  assert.equal(html.split('id="run-detail"').length, 2, "exactly one run detail — powers attach to the run, not the view");
  assert.ok(html.includes("/runs/events"), "the SSE re-read loop is wired");
});

test("the renderer only ever compares against vocabulary the kernel actually emits", () => {
  // A typo in one of these string comparisons is invisible: the branch simply never
  // fires, so a badge silently never appears. That shipped once — the projects rail
  // filtered on ownership === "human", which is not a value the kernel has ever
  // produced. The renderer is the one place these unions are re-stated by hand, so
  // the gate is here rather than trusting a reading of the diff.
  const html = delegationAppHtml("tok");
  const OWNERSHIP = ["working", "needs_you", "done"];
  // Read the vocabulary from the kernel itself. A hand-copied list here would carry
  // exactly the defect this test exists to catch — and did, on the first run: it
  // flagged "draft" as bogus when "draft" is the very first RunState.
  const DISPLAY = [...RUN_STATES, "dropped"] as string[];
  const check = (field: string, allowed: string[]) => {
    const pattern = new RegExp(`${field}\\s*(?:===|!==)\\s*"([a-z_]+)"`, "g");
    const seen = new Set<string>();
    for (const match of html.matchAll(pattern)) seen.add(match[1]);
    for (const value of seen) {
      assert.ok(allowed.includes(value), `the renderer compares ${field} against "${value}", which the kernel never emits`);
    }
    return seen;
  };
  const ownershipSeen = check("ownership", OWNERSHIP);
  check("display_state", DISPLAY);
  assert.ok(ownershipSeen.size > 0, "the guard must actually be finding comparisons to check");

  // Array membership is the other shape these unions get re-stated in.
  for (const match of html.matchAll(/display_state\)\s*[<>]=?\s*0/g)) assert.ok(match, "");
  const listed = html.matchAll(/\[([^\]]*)\]\.indexOf\(\s*r?u?n?\.?display_state/g);
  for (const match of listed) {
    for (const raw of match[1].split(",")) {
      const value = raw.trim().replace(/^"|"$/g, "");
      if (!value) continue;
      assert.ok(DISPLAY.includes(value), `the renderer lists display_state "${value}", which the kernel never emits`);
    }
  }
});

test("every CSS custom property the renderer uses is actually defined", () => {
  // An undefined var() fails silently: the declaration is simply dropped, so a badge
  // renders with no background and looks like plain text. Two shipped that way in the
  // projects rail (--warn, --bad — the palette calls them --amber and --crimson).
  // There is no browser here to catch it, so the check is textual.
  const html = delegationAppHtml("tok");
  const css = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
  const defined = new Set<string>();
  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(match[1]);
  const used = new Set<string>();
  for (const match of css.matchAll(/var\((--[a-z0-9-]+)/g)) used.add(match[1]);
  // A floor, not a count — it only proves the regex still matches this stylesheet.
  assert.ok(used.size >= 15, `the guard must actually be finding variables to check (found ${used.size})`);
  const missing = [...used].filter((name) => !defined.has(name));
  assert.deepEqual(missing, [], `these custom properties are used but never defined: ${missing.join(", ")}`);
});

test("every CSS class the renderer styles is actually put on an element somewhere", () => {
  // The third silent-styling failure of this shape: .mem-health was styled as a grid
  // while the markup only carried id="mem-health", so the rule matched nothing and six
  // stat tiles stacked full-width. Like an undefined var(), a selector that matches
  // nothing produces no error — only a layout that quietly looks wrong.
  //
  // Classes reach the DOM two ways here: literally in the markup, or through
  // h(tag, "class-name") in the client script. Both are string literals in this file,
  // so a textual check covers both.
  const html = delegationAppHtml("tok");
  const styleEnd = html.indexOf("</style>");
  // Strip /* comments */ before scanning: a comment that mentions a selector (e.g.
  // explaining what ".stat-chip strong" does on the website) is prose, not a rule,
  // and flagging it as an orphan is the gate reporting on itself.
  const css = html.slice(0, styleEnd).replace(/\/\*[\s\S]*?\*\//g, " ");
  const body = html.slice(styleEnd);

  const styled = new Set<string>();
  for (const match of css.matchAll(/\.([a-z][a-z0-9-]{2,})/g)) styled.add(match[1]);
  // Two legitimate ways a class reaches the DOM without its full name appearing:
  // built by concatenation (h("span", "chip state-" + run.display_state)), and owned
  // by the vendored xterm stylesheet rather than by us. Both are checked by their
  // stem instead, so the gate keeps catching genuine orphans without false alarms.
  const dynamic = (name: string) =>
    (name.startsWith("state-") && body.includes('"chip state-" +')) || name.startsWith("xterm");
  for (const name of [...styled]) if (dynamic(name)) styled.delete(name);
  // ".css" in a filename string is not a selector.
  styled.delete("css");

  // Names that appear anywhere in the body as a bare word are considered applied —
  // deliberately loose, because the goal is catching orphans, not policing style.
  const orphans = [...styled].filter((name) => !new RegExp(`\\b${name}\\b`).test(body));
  assert.ok(styled.size > 40, `the guard must be finding classes to check (found ${styled.size})`);
  assert.deepEqual(orphans, [], `these classes are styled but never applied to any element: ${orphans.join(", ")}`);
});

test("pre-flight forecast: the brief's own prediction plus its dependents, before any diff exists", async () => {
  const project = tempGitProject();
  const { capture } = await import("./kernel.js");
  const learned = capture({
    projectDir: project,
    title: "Retry helper must stay idempotent",
    body: "src/retry.ts is called from the payment path; retries must be idempotent or charges double.",
    type: "decision",
    paths: ["src/retry.ts"],
  });
  assert.equal(learned.ok, true);
  // Two real files really import the area memory predicts this task will land in.
  // Hand-seeding imports.json does not survive here: recall() keeps the structural
  // index fresh, so the kernel overwrites the file with what the code actually says
  // — which is the honest pipeline anyway.
  writeFileSync(join(project, "src", "a.ts"), 'import { retry } from "./retry.js";\nexport const a = retry();\n', "utf8");
  writeFileSync(join(project, "src", "b.ts"), 'import { retry } from "./retry.js";\nexport const b = retry();\n', "utf8");
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "memory"], { cwd: project, stdio: "ignore", env: GIT_ENV });

  const { server, port, feed } = await startApi(project);
  try {
    const out = await (await apiFetch(port, `/preflight?intent=${encodeURIComponent("make the retry helper idempotent")}`)).json() as {
      ok: boolean;
      forecast: { touches: string[]; memories: number; blast: { dependents: number } | null } | null;
    };
    assert.equal(out.ok, true);
    assert.ok(out.forecast, "memory has something to say about this intent");
    assert.ok(out.forecast.touches.includes("src/retry.ts"), "the forecast IS the brief's own touch prediction");
    assert.ok(out.forecast.memories >= 1, "the packets the brief will carry are counted");
    assert.equal(out.forecast.blast?.dependents, 2, "dependents come from the same imports index the receipt uses");

    // A keystroke is not an intent — no forecast, never an invented one.
    const quiet = await (await apiFetch(port, "/preflight?intent=zz")).json() as { forecast: unknown };
    assert.equal(quiet.forecast, null);
  } finally {
    feed.close();
    server.close();
  }
});

test("pre-flight stays silent when memory and the graph have nothing to say", async () => {
  // A bare repo with no packets and no imports index must produce NO forecast —
  // a confident-looking prediction from zero evidence would be the pre-flight
  // lying in the reassuring direction.
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const out = await (await apiFetch(port, `/preflight?intent=${encodeURIComponent("refactor the payment retry pipeline")}`)).json() as { ok: boolean; forecast: unknown };
    assert.equal(out.ok, true);
    assert.equal(out.forecast, null);
  } finally {
    feed.close();
    server.close();
  }
});

test("the flywheel rides the API: a merged run lists what it taught, the packet links back", async () => {
  const project = tempGitProject();
  const dispatched = await dispatchRun(
    project,
    { intent: "leave a lesson behind", type: "chore" },
    stubAdapter({
      editFile: { path: "src/note.md", content: "note\n" },
      learned: ["Notes belong in src, and the build ignores them"],
    }),
  );
  const merge = mergeRun(project, dispatched.task.id);
  assert.equal(merge.ok, true, merge.message);

  const { server, port, feed } = await startApi(project);
  try {
    const detail = await (await apiFetch(port, `/runs/${dispatched.task.id}`)).json() as {
      taught?: Array<{ id: string; title: string; status: string }>;
    };
    assert.ok(detail.taught?.length, "a merged run lists the packets it ratified");
    assert.equal(detail.taught[0].status, "approved");

    const packet = await (await apiFetch(port, `/memory/${encodeURIComponent(detail.taught[0].id)}`)).json() as {
      ok: boolean;
      born_from_run: { id: string } | null;
    };
    assert.equal(packet.ok, true);
    assert.equal(packet.born_from_run?.id, dispatched.task.id, "the packet names the run that taught it");
  } finally {
    feed.close();
    server.close();
  }
});

test("diff and raw serve the run's real artifacts after a full stub dispatch", async () => {
  const project = tempGitProject();
  const dispatched = await dispatchRun(
    project,
    { intent: "leave a stub note", type: "chore" },
    stubAdapter({ editFile: { path: "src/note.md", content: "the stub was here\n" } }),
  );
  const { server, port, feed } = await startApi(project);
  try {
    const diff = await (await apiFetch(port, `/runs/${dispatched.task.id}/diff`)).text();
    assert.match(diff, /src\/note\.md/, "the diff shows the file the run actually changed");
    assert.match(diff, /\+the stub was here/);

    const raw = await (await apiFetch(port, `/runs/${dispatched.task.id}/raw`)).text();
    assert.match(raw, /"kind":"start"/, "raw is the transcript exactly as the adapter wrote it");

    const detail = await (await apiFetch(port, `/runs/${dispatched.task.id}`)).json() as { receipt?: string };
    assert.ok(detail.receipt, "a finished run carries its receipt");
  } finally {
    feed.close();
    server.close();
  }
});

test("an in-flight run carries its live activity in list and detail", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const run = createRun(project, { intent: "activity check", type: "chore", agent: "stub" });
    transitionRun(project, run.id, "briefed", "kernel");
    transitionRun(project, run.id, "dispatched", "kernel");
    // Simulate the adapter's transcript so activity has something to read. The fake
    // pid below is this process, which is alive — so display_state stays in-flight.
    patchRun(project, run.id, { agent_pid: process.pid });
    writeFileSync(
      runTranscriptPath(project, run.id),
      `${JSON.stringify({ kind: "tool", label: "editing src/retry.ts" })}\n`,
      "utf8",
    );
    const { runs } = await (await apiFetch(port, "/runs")).json() as { runs: Array<{ activity?: { last_label: string } }> };
    assert.equal(runs[0].activity?.last_label, "editing src/retry.ts");
  } finally {
    feed.close();
    server.close();
  }
});

test("GET /room starts empty and unguarded reads still require nothing but the loopback guard", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const out = await (await apiFetch(port, "/room")).json() as { ok: boolean; turns: unknown[]; busy: boolean };
    assert.equal(out.ok, true);
    assert.deepEqual(out.turns, []);
    assert.equal(out.busy, false);
  } finally {
    feed.close();
    server.close();
  }
});

test("POST /room/message without a message is a 400, and requires the token like every mutation", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const empty = await apiFetch(port, "/room/message", { method: "POST", body: JSON.stringify({}) });
    assert.equal(empty.status, 400);

    const refused = await apiFetch(port, "/room/message", {
      method: "POST",
      body: JSON.stringify({ message: "hello" }),
      token: false,
    });
    assert.equal(refused.status, 401);
    const after = await (await apiFetch(port, "/room")).json() as { turns: unknown[] };
    assert.equal(after.turns.length, 0, "a refused message must not be persisted");
  } finally {
    feed.close();
    server.close();
  }
});

test("a room message is accepted immediately, the reply lands once the manager finishes, and history round-trips into its prompt", async () => {
  const project = tempProject();
  let seenHistory: Array<{ role: string; text: string }> | undefined;
  const fakeAsk: typeof askManager = async (options) => {
    seenHistory = options.history;
    options.onEvent?.({ kind: "text", text: "thinking…" });
    await pause(10);
    return { ok: true, text: "Done — I'll take a look.", tools: ["mcp__kage__kage_dispatch"] };
  };
  const { server, port, feed } = await startApi(project, { askManagerFn: fakeAsk });
  try {
    const first = await apiFetch(port, "/room/message", { method: "POST", body: JSON.stringify({ message: "fix the flaky test" }) });
    assert.equal(first.status, 202);
    const accepted = await first.json() as { ok: boolean; accepted: boolean };
    assert.equal(accepted.accepted, true);

    // The "you" turn is visible immediately — the manager hasn't been asked anything yet.
    const midFlight = await (await apiFetch(port, "/room")).json() as { turns: Array<{ role: string; text: string }>; busy: boolean };
    assert.equal(midFlight.turns.length, 1);
    assert.equal(midFlight.turns[0].role, "you");

    await waitFor(async () => {
      const out = await (await apiFetch(port, "/room")).json() as { turns: unknown[] };
      return out.turns.length >= 2;
    });
    const done = await (await apiFetch(port, "/room")).json() as { turns: Array<Record<string, unknown>>; busy: boolean };
    assert.equal(done.busy, false);
    assert.equal(done.turns[1].role, "kage");
    assert.equal(done.turns[1].text, "Done — I'll take a look.");
    assert.deepEqual(done.turns[1].tools, ["mcp__kage__kage_dispatch"]);
    assert.deepEqual(seenHistory, [], "the manager must not be asked the same message it's about to answer");

    // A second turn should replay the first exchange as history.
    await apiFetch(port, "/room/message", { method: "POST", body: JSON.stringify({ message: "how did that go?" }) });
    await waitFor(async () => {
      const out = await (await apiFetch(port, "/room")).json() as { turns: unknown[] };
      return out.turns.length >= 4;
    });
    assert.deepEqual(seenHistory, [
      { role: "you", text: "fix the flaky test" },
      { role: "kage", text: "Done — I'll take a look." },
    ]);
  } finally {
    feed.close();
    server.close();
  }
});

test("two rapid room messages queue rather than race, and busy reflects the whole queue", async () => {
  const project = tempProject();
  const seen: string[] = [];
  const fakeAsk: typeof askManager = async (options) => {
    seen.push(options.question);
    await pause(60);
    return { ok: true, text: `reply to: ${options.question}`, tools: [] };
  };
  const { server, port, feed } = await startApi(project, { askManagerFn: fakeAsk });
  try {
    await apiFetch(port, "/room/message", { method: "POST", body: JSON.stringify({ message: "first" }) });
    await apiFetch(port, "/room/message", { method: "POST", body: JSON.stringify({ message: "second" }) });

    // Busy must stay true across BOTH turns, not flip false between them — a boolean
    // set by whichever turn finishes first would report "idle" while one is still queued.
    await pause(70);
    const midway = await (await apiFetch(port, "/room")).json() as { busy: boolean };
    assert.equal(midway.busy, true, "the second turn is still running");

    await waitFor(async () => {
      const out = await (await apiFetch(port, "/room")).json() as { turns: unknown[] };
      return out.turns.length >= 4;
    });
    const done = await (await apiFetch(port, "/room")).json() as { turns: Array<{ role: string; text: string }>; busy: boolean };
    assert.equal(done.busy, false);
    assert.deepEqual(seen, ["first", "second"], "the manager was asked in order, never interleaved");
    // Both "you" turns land immediately (you can send a follow-up while waiting on a
    // reply, same as any chat) — only the manager's replies are serialized.
    assert.deepEqual(
      done.turns.map((turn) => turn.role),
      ["you", "you", "kage", "kage"],
    );
  } finally {
    feed.close();
    server.close();
  }
});

test("askManagerFn alone (no askRoomFn) must skip the live room supervisor entirely — never spawn a real process from a test", async () => {
  // Regression test for a real bug caught while building this: resolveRoomReply tried
  // the live claude path FIRST regardless of test seams, so on any machine with claude
  // actually on PATH (this one), every existing room test would spawn a real detached
  // supervisor process before falling back to its injected fake. Setting askManagerFn
  // must be enough, on its own, to guarantee nothing real gets touched.
  const project = tempProject();
  const fakeAsk: typeof askManager = async () => ({ ok: true, text: "fallback reply", tools: [] });
  const { server, port, feed } = await startApi(project, { askManagerFn: fakeAsk });
  try {
    const started = Date.now();
    await apiFetch(port, "/room/message", { method: "POST", body: JSON.stringify({ message: "hi" }) });
    await waitFor(async () => {
      const out = await (await apiFetch(port, "/room")).json() as { turns: unknown[] };
      return out.turns.length >= 2;
    });
    const elapsedMs = Date.now() - started;
    // The live path's own startup wait alone is several seconds; resolving near-
    // instantly is strong evidence it was never attempted.
    assert.ok(elapsedMs < 2000, `resolved in ${elapsedMs}ms — a real live-supervisor attempt would have taken much longer`);
    const out = await (await apiFetch(port, "/room")).json() as { turns: Array<{ text: string }> };
    assert.equal(out.turns[1].text, "fallback reply");
    // The live path's first move on failure is writing a supervisor record to disk —
    // its absence is direct evidence, not just a timing inference.
    const { readRoomSupervisorRecord } = await import("./delegation/room-supervisor.js");
    assert.equal(readRoomSupervisorRecord(project), null, "no room supervisor record should exist — nothing real was ever spawned");
  } finally {
    feed.close();
    server.close();
  }
});

test("askRoomFn fully replaces the room reply pipeline when a test provides it", async () => {
  const project = tempProject();
  let sawHistory: Array<{ role: string; text: string }> | undefined;
  const fakeRoom = async (message: string, history: Array<{ role: string; text: string }>) => {
    sawHistory = history;
    return { text: `you said: ${message}`, tools: ["mcp__kage__kage_dispatch"] };
  };
  const { server, port, feed } = await startApi(project, { askRoomFn: fakeRoom as never });
  try {
    await apiFetch(port, "/room/message", { method: "POST", body: JSON.stringify({ message: "ping" }) });
    await waitFor(async () => {
      const out = await (await apiFetch(port, "/room")).json() as { turns: unknown[] };
      return out.turns.length >= 2;
    });
    const out = await (await apiFetch(port, "/room")).json() as { turns: Array<{ text: string; tools?: string[] }> };
    assert.equal(out.turns[1].text, "you said: ping");
    assert.deepEqual(out.turns[1].tools, ["mcp__kage__kage_dispatch"]);
    assert.deepEqual(sawHistory, []);
  } finally {
    feed.close();
    server.close();
  }
});

test("a manager failure becomes a visible kage turn instead of a silently dropped reply", async () => {
  const project = tempProject();
  const failingAsk: typeof askManager = async () => {
    throw new Error("claude exited 1");
  };
  const { server, port, feed } = await startApi(project, { askManagerFn: failingAsk });
  try {
    await apiFetch(port, "/room/message", { method: "POST", body: JSON.stringify({ message: "do something" }) });
    await waitFor(async () => {
      const out = await (await apiFetch(port, "/room")).json() as { turns: unknown[] };
      return out.turns.length >= 2;
    });
    const out = await (await apiFetch(port, "/room")).json() as { turns: Array<{ role: string; text: string }> };
    assert.equal(out.turns[1].role, "kage");
    assert.match(out.turns[1].text, /claude exited 1/);
  } finally {
    feed.close();
    server.close();
  }
});

test("room SSE deltas carry text but are still just notifications — /room after 'final' is the truth", async () => {
  const project = tempProject();
  const fakeAsk: typeof askManager = async (options) => {
    options.onEvent?.({ kind: "tool", text: "kage_dispatch" });
    options.onEvent?.({ kind: "text", text: "partial…" });
    return { ok: true, text: "final answer", tools: [] };
  };
  const { server, port, feed } = await startApi(project, { askManagerFn: fakeAsk });
  try {
    const controller = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/runs/events`, {
      headers: { host: `127.0.0.1:${port}` },
      signal: controller.signal,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const readUntil = async (marker: string) => {
      const deadline = Date.now() + 4000;
      while (!buffer.includes(marker)) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${marker} in: ${buffer}`);
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
      }
    };
    await readUntil("event: hello");

    await apiFetch(port, "/room/message", { method: "POST", body: JSON.stringify({ message: "go" }) });
    await readUntil('"kind":"final"');
    assert.match(buffer, /"text":"partial…"/);
    controller.abort();
  } finally {
    feed.close();
    server.close();
  }
});

test("run detail ships the KERNEL's verdict, so a surface can never certify a run the kernel failed", async () => {
  // Caught live: the GUI re-derived the verdict from checks[] and rendered a green
  // "VERIFIED 2/3" for a run the kernel had already marked failed, because a check
  // that could not run read as merely absent rather than as a reason not to certify.
  // The verdict must travel from where the checks actually ran.
  const project = tempGitProject();
  const dispatched = await dispatchRun(
    project,
    { intent: "verdict travels with the claim", type: "chore" },
    stubAdapter({ editFile: { path: "src/note.md", content: "note\n" } }),
  );
  const { server, port, feed } = await startApi(project);
  try {
    const detail = await (await apiFetch(port, `/runs/${dispatched.task.id}`)).json() as {
      verdict?: { label: string; executed: boolean; passed: boolean };
      claim?: { checks: Array<{ result: string }> };
    };
    assert.ok(detail.verdict, "the API must send a kernel-computed verdict");
    assert.equal(typeof detail.verdict!.label, "string");
    assert.equal(typeof detail.verdict!.executed, "boolean");
    assert.equal(typeof detail.verdict!.passed, "boolean");
    // The label must agree with the kernel's own pass/fail determination — never be
    // a friendlier restatement of it.
    if (!detail.verdict!.passed) {
      assert.doesNotMatch(detail.verdict!.label, /^VERIFIED/, "a non-passing run must not be labelled VERIFIED");
    }
  } finally {
    feed.close();
    server.close();
  }
});

test("GET /vendor/xterm.js and xterm.css serve the real installed dependency, not a 404", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const js = await apiFetch(port, "/vendor/xterm.js");
    assert.equal(js.status, 200);
    assert.match(js.headers.get("content-type") ?? "", /javascript/);
    const jsBody = await js.text();
    assert.ok(jsBody.length > 1000, "xterm's real bundle is not this small");

    const css = await apiFetch(port, "/vendor/xterm.css");
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type") ?? "", /css/);

    const fit = await apiFetch(port, "/vendor/xterm-addon-fit.js");
    assert.equal(fit.status, 200);
  } finally {
    feed.close();
    server.close();
  }
});

test("GET /room/pty/status reports alive honestly from whatever ensurePtyAttachedFn returns — real spawning never touched", async () => {
  const project = tempProject();
  let calls = 0;
  const fakeAttach = async () => {
    calls += 1;
    return { write: () => {}, resize: () => {}, close: () => {} };
  };
  const { server, port, feed } = await startApi(project, { ensurePtyAttachedFn: fakeAttach as never });
  try {
    const out = await (await apiFetch(port, "/room/pty/status")).json() as { ok: boolean; alive: boolean };
    assert.deepEqual(out, { ok: true, alive: true });
    assert.equal(calls, 1);
  } finally {
    feed.close();
    server.close();
  }
});

test("GET /room/pty/status reports alive:false when nothing is attached, without throwing", async () => {
  const project = tempProject();
  const fakeAttach = async () => null;
  const { server, port, feed } = await startApi(project, { ensurePtyAttachedFn: fakeAttach as never });
  try {
    const out = await (await apiFetch(port, "/room/pty/status")).json() as { ok: boolean; alive: boolean };
    assert.deepEqual(out, { ok: true, alive: false });
  } finally {
    feed.close();
    server.close();
  }
});

test("POST /room/pty/write requires data, forwards it to the attachment, and reports 503 when nothing is live", async () => {
  const project = tempProject();
  const written: string[] = [];
  const fakeAttach = async () => ({ write: (data: string) => written.push(data), resize: () => {}, close: () => {} });
  const { server, port, feed } = await startApi(project, { ensurePtyAttachedFn: fakeAttach as never });
  try {
    const missing = await apiFetch(port, "/room/pty/write", { method: "POST", body: JSON.stringify({}) });
    assert.equal(missing.status, 400);

    const ok = await apiFetch(port, "/room/pty/write", { method: "POST", body: JSON.stringify({ data: "ls -la\r" }) });
    assert.equal(ok.status, 202);
    assert.deepEqual(written, ["ls -la\r"]);
  } finally {
    feed.close();
    server.close();
  }

  const fakeDead = async () => null;
  const dead = await startApi(project, { ensurePtyAttachedFn: fakeDead as never });
  try {
    const res = await apiFetch(dead.port, "/room/pty/write", { method: "POST", body: JSON.stringify({ data: "x" }) });
    assert.equal(res.status, 503);
  } finally {
    dead.feed.close();
    dead.server.close();
  }
});

test("POST /room/pty/resize validates cols/rows and forwards a good resize to the attachment", async () => {
  const project = tempProject();
  const resizes: Array<[number, number]> = [];
  const fakeAttach = async () => ({ write: () => {}, resize: (c: number, r: number) => resizes.push([c, r]), close: () => {} });
  const { server, port, feed } = await startApi(project, { ensurePtyAttachedFn: fakeAttach as never });
  try {
    const bad = await apiFetch(port, "/room/pty/resize", { method: "POST", body: JSON.stringify({ cols: 0, rows: -1 }) });
    assert.equal(bad.status, 400);

    const ok = await apiFetch(port, "/room/pty/resize", { method: "POST", body: JSON.stringify({ cols: 120, rows: 40 }) });
    assert.equal(ok.status, 202);
    assert.deepEqual(resizes, [[120, 40]]);
  } finally {
    feed.close();
    server.close();
  }
});

test("a blocked run reads as needs_you through the API, with the agent's question attached", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const run = createRun(project, { intent: "ask me something", type: "chore", agent: "stub" });
    transitionRun(project, run.id, "briefed", "kernel");
    transitionRun(project, run.id, "dispatched", "kernel");
    transitionRun(project, run.id, "running", "kernel");
    transitionRun(project, run.id, "blocked", "kernel", "needs a decision");
    const { runs } = await (await apiFetch(port, "/runs")).json() as { runs: Array<Record<string, unknown>> };
    assert.equal(runs[0].ownership, "needs_you");
    assert.equal(runs[0].display_state, "blocked");
  } finally {
    feed.close();
    server.close();
  }
});

test("GET /projects remembers the current project and marks it current", async () => {
  process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-home-"));
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const out = await (await apiFetch(port, "/projects")).json() as {
      ok: boolean; current: string; projects: Array<{ dir: string }>;
    };
    assert.equal(out.ok, true);
    assert.equal(out.current, project);
    assert.equal(out.projects.length, 1);
    assert.equal(out.projects[0].dir, project, "opening the app is what makes a project known");
  } finally {
    feed.close();
    server.close();
  }
});

test("POST /projects/forget refuses to forget the project this daemon serves", async () => {
  process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-home-"));
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    await apiFetch(port, "/projects");
    const res = await apiFetch(port, "/projects/forget", { method: "POST", body: JSON.stringify({ dir: project }) });
    assert.equal(res.status, 400, "removing the row you are standing on would leave the rail unable to show you");
    const still = await (await apiFetch(port, "/projects")).json() as { projects: unknown[] };
    assert.equal(still.projects.length, 1);
  } finally {
    feed.close();
    server.close();
  }
});

test("POST /projects/open rejects a path that is not a repo, without starting a daemon", async () => {
  process.env.KAGE_HOME = mkdtempSync(join(tmpdir(), "kage-home-"));
  const project = tempProject();
  const notARepo = mkdtempSync(join(tmpdir(), "kage-plain-"));
  const { server, port, feed } = await startApi(project);
  try {
    const res = await apiFetch(port, "/projects/open", { method: "POST", body: JSON.stringify({ dir: notARepo }) });
    assert.equal(res.status, 400);
    const body = await res.json() as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert.match(body.error, /not a git repo/);
    // And a rejected open must not have quietly added it to the rail.
    const known = await (await apiFetch(port, "/projects")).json() as { projects: Array<{ dir: string }> };
    assert.ok(!known.projects.some((entry) => entry.dir === notARepo));
  } finally {
    feed.close();
    server.close();
  }
});

test("threads keep separate transcripts, and each answers only for the thread that was asked", async () => {
  const project = tempProject();
  const seen: string[] = [];
  const { server, port, feed } = await startApi(project, {
    askRoomFn: async (message: string) => {
      seen.push(message);
      return { text: `re: ${message}`, tools: [] };
    },
  });
  try {
    const created = await (await apiFetch(port, "/room/sessions", { method: "POST", body: JSON.stringify({ title: "Flaky hunt" }) })).json() as {
      ok: boolean; session: { key: string; title: string };
    };
    assert.equal(created.ok, true);
    assert.equal(created.session.title, "Flaky hunt");

    await apiFetch(port, "/room/message", { method: "POST", body: JSON.stringify({ message: "about the refactor" }) });
    await apiFetch(port, `/room/message?session=${created.session.key}`, { method: "POST", body: JSON.stringify({ message: "about the flake" }) });
    // Both turns are queued; wait for both threads to go idle.
    for (let i = 0; i < 60; i += 1) {
      const a = await (await apiFetch(port, "/room")).json() as { busy: boolean };
      const b = await (await apiFetch(port, `/room?session=${created.session.key}`)).json() as { busy: boolean };
      if (!a.busy && !b.busy) break;
      await new Promise((pause) => setTimeout(pause, 25));
    }

    const main = await (await apiFetch(port, "/room")).json() as { session: string; turns: Array<{ text: string }> };
    const other = await (await apiFetch(port, `/room?session=${created.session.key}`)).json() as { session: string; turns: Array<{ text: string }> };
    assert.equal(main.session, "main");
    assert.equal(other.session, created.session.key);
    assert.deepEqual(main.turns.map((t) => t.text), ["about the refactor", "re: about the refactor"]);
    assert.deepEqual(other.turns.map((t) => t.text), ["about the flake", "re: about the flake"], "one thread must never see the other's words");
  } finally {
    feed.close();
    server.close();
  }
});

test("the default thread cannot be closed through the API", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const res = await apiFetch(port, "/room/sessions/close", { method: "POST", body: JSON.stringify({ session: "main" }) });
    assert.equal(res.status, 400);
    const listed = await (await apiFetch(port, "/room")).json() as { sessions: Array<{ key: string }> };
    assert.ok(listed.sessions.some((s) => s.key === "main"), "the room must always have somewhere to land");
  } finally {
    feed.close();
    server.close();
  }
});

test("a room reply is scoped to its own thread even when the client asks about another", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project, {
    askRoomFn: async (message: string) => ({ text: `re: ${message}`, tools: [] }),
  });
  try {
    const created = await (await apiFetch(port, "/room/sessions", { method: "POST", body: "{}" })).json() as { session: { key: string } };
    await apiFetch(port, `/room/message?session=${created.session.key}`, { method: "POST", body: JSON.stringify({ message: "only here" }) });
    for (let i = 0; i < 60; i += 1) {
      const b = await (await apiFetch(port, `/room?session=${created.session.key}`)).json() as { busy: boolean };
      if (!b.busy) break;
      await new Promise((pause) => setTimeout(pause, 25));
    }
    const main = await (await apiFetch(port, "/room")).json() as { turns: unknown[] };
    assert.deepEqual(main.turns, [], "the default thread stays empty when another thread was addressed");
  } finally {
    feed.close();
    server.close();
  }
});

test("goal routes round-trip: create, list, get, abandon", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const empty = await (await apiFetch(port, "/goals")).json() as { ok: boolean; goals: unknown[] };
    assert.equal(empty.ok, true);
    assert.deepEqual(empty.goals, []);

    const created = await (await apiFetch(port, "/goals", {
      method: "POST",
      body: JSON.stringify({
        intent: "ship the orchestration substrate",
        plan: [[{ intent: "build goal.ts", type: "feature", files_scope: ["mcp/delegation/goal.ts"] }]],
      }),
    })).json() as { ok: boolean; goal: Record<string, unknown> };
    assert.equal(created.ok, true);
    assert.equal(created.goal.state, "planning");
    assert.equal(created.goal.autonomy, "recommend");

    const listed = await (await apiFetch(port, "/goals")).json() as { goals: Array<{ id: string }> };
    assert.equal(listed.goals.length, 1);
    assert.equal(listed.goals[0].id, created.goal.id);

    const fetched = await (await apiFetch(port, `/goals/${created.goal.id}`)).json() as { ok: boolean; goal: { id: string } };
    assert.equal(fetched.ok, true);
    assert.equal(fetched.goal.id, created.goal.id);

    const missing = await apiFetch(port, "/goals/does-not-exist");
    assert.equal(missing.status, 404);

    const abandoned = await (await apiFetch(port, `/goals/${created.goal.id}/abandon`, {
      method: "POST",
      body: JSON.stringify({ reason: "superseded by a new plan" }),
    })).json() as { ok: boolean; goal: { state: string; state_history: Array<{ note?: string }> } };
    assert.equal(abandoned.ok, true);
    assert.equal(abandoned.goal.state, "abandoned");
    assert.equal(abandoned.goal.state_history.at(-1)?.note, "superseded by a new plan");

    // abandoned is terminal — a second abandon must fail, not silently succeed.
    const illegal = await apiFetch(port, `/goals/${created.goal.id}/abandon`, { method: "POST", body: "{}" });
    assert.equal(illegal.status, 400);
  } finally {
    feed.close();
    server.close();
  }
});

test("POST /goals owns the goal by the session it was created from, defaulting to main", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const defaulted = await (await apiFetch(port, "/goals", {
      method: "POST",
      body: JSON.stringify({ intent: "owned by main" }),
    })).json() as { goal: { id: string } };
    assert.equal(readActiveGoal(project, DEFAULT_SESSION), defaulted.goal.id);

    const scoped = await (await apiFetch(port, "/goals", {
      method: "POST",
      body: JSON.stringify({ intent: "owned by thread-2", session: "thread-2" }),
    })).json() as { goal: { id: string } };
    assert.equal(readActiveGoal(project, "thread-2"), scoped.goal.id);
    // Creating the second goal must not disturb the first thread's pointer.
    assert.equal(readActiveGoal(project, DEFAULT_SESSION), defaulted.goal.id);
  } finally {
    feed.close();
    server.close();
  }
});

test("POST /goals/:id/activate moves a goal's active-thread pointer; abandoning it clears that pointer everywhere", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const created = await (await apiFetch(port, "/goals", {
      method: "POST",
      body: JSON.stringify({ intent: "reassignable wave" }),
    })).json() as { goal: { id: string } };
    assert.equal(readActiveGoal(project, DEFAULT_SESSION), created.goal.id);

    const activated = await (await apiFetch(port, `/goals/${created.goal.id}/activate`, {
      method: "POST",
      body: JSON.stringify({ session: "thread-2" }),
    })).json() as { ok: boolean; goal: { id: string } };
    assert.equal(activated.ok, true);
    assert.equal(readActiveGoal(project, "thread-2"), created.goal.id);

    const missing = await apiFetch(port, "/goals/does-not-exist/activate", { method: "POST", body: "{}" });
    assert.equal(missing.status, 404);

    const abandoned = await (await apiFetch(port, `/goals/${created.goal.id}/abandon`, { method: "POST", body: "{}" })).json() as {
      goal: { state: string };
    };
    assert.equal(abandoned.goal.state, "abandoned");
    assert.equal(readActiveGoal(project, DEFAULT_SESSION), null, "abandon clears every thread's pointer to it");
    assert.equal(readActiveGoal(project, "thread-2"), null);
  } finally {
    feed.close();
    server.close();
  }
});

test("POST /goals rejects an empty intent", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const res = await apiFetch(port, "/goals", { method: "POST", body: JSON.stringify({ intent: "  " }) });
    assert.equal(res.status, 400);
  } finally {
    feed.close();
    server.close();
  }
});

test("POST /runs with goal_id attaches the new run to the goal", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const goal = await (await apiFetch(port, "/goals", {
      method: "POST",
      body: JSON.stringify({ intent: "wave one" }),
    })).json() as { goal: { id: string } };

    const created = await (await apiFetch(port, "/runs", {
      method: "POST",
      body: JSON.stringify({ intent: "attached run", agent: "stub", type: "chore", hold: true, goal_id: goal.goal.id }),
    })).json() as { ok: boolean; run: { id: string } };
    assert.equal(created.ok, true);

    const owner = goalForRun(project, created.run.id);
    assert.equal(owner?.id, goal.goal.id);
    const persisted = readGoal(project, goal.goal.id);
    assert.ok(persisted.plan.waves.some((wave) => wave.run_ids.includes(created.run.id)));

    // A run created WITHOUT goal_id must never be attached to anything.
    const plain = await (await apiFetch(port, "/runs", {
      method: "POST",
      body: JSON.stringify({ intent: "plain run", agent: "stub", type: "chore", hold: true }),
    })).json() as { run: { id: string } };
    assert.equal(goalForRun(project, plain.run.id), null);

    // An unknown goal_id must fail the whole dispatch, not silently drop the attach.
    const bad = await apiFetch(port, "/runs", {
      method: "POST",
      body: JSON.stringify({ intent: "bad goal", agent: "stub", type: "chore", hold: true, goal_id: "does-not-exist" }),
    });
    assert.equal(bad.status, 400);
  } finally {
    feed.close();
    server.close();
  }
});

test("a goal-owned run carries goal_id through both /runs and /runs/:id, a goal-less run carries null", async () => {
  const project = tempProject();
  const { server, port, feed } = await startApi(project);
  try {
    const goal = await (await apiFetch(port, "/goals", {
      method: "POST",
      body: JSON.stringify({ intent: "the goal surface" }),
    })).json() as { goal: { id: string } };

    const owned = await (await apiFetch(port, "/runs", {
      method: "POST",
      body: JSON.stringify({ intent: "owned run", agent: "stub", type: "chore", hold: true, goal_id: goal.goal.id }),
    })).json() as { run: { id: string } };
    const plain = await (await apiFetch(port, "/runs", {
      method: "POST",
      body: JSON.stringify({ intent: "plain run", agent: "stub", type: "chore", hold: true }),
    })).json() as { run: { id: string } };

    const list = await (await apiFetch(port, "/runs")).json() as { runs: Array<{ id: string; goal_id: string | null }> };
    const ownedInList = list.runs.find((r) => r.id === owned.run.id);
    const plainInList = list.runs.find((r) => r.id === plain.run.id);
    assert.equal(ownedInList?.goal_id, goal.goal.id);
    assert.equal(plainInList?.goal_id, null);

    const ownedDetail = await (await apiFetch(port, `/runs/${owned.run.id}`)).json() as { run: { goal_id: string | null } };
    assert.equal(ownedDetail.run.goal_id, goal.goal.id);
    const plainDetail = await (await apiFetch(port, `/runs/${plain.run.id}`)).json() as { run: { goal_id: string | null } };
    assert.equal(plainDetail.run.goal_id, null);
  } finally {
    feed.close();
    server.close();
  }
});
