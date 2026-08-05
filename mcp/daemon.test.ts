import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, get } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INDEX_DEBOUNCE_MS, MIN_INDEX_INTERVAL_MS, appRedirectLocation, daemonContextReport, daemonDoctor, extractWorkItemId, resolveAppAsset, shouldTriggerReindex, startLiveFeed, startOptionalVnextRuntime, viewerBenchmarkReport, viewerRedirectLocation, viewerReportPaths, viewerStaticHeaders, viewerUrl } from "./daemon.js";
import { capture, indexProject } from "./kernel.js";

// THE regression test for the worst bug this daemon has had: the watcher re-triggering on files
// the re-index itself writes. That loop cost 118 hours of CPU over 5 days on an untouched repo —
// 91% of a core — and it shipped, because the filter named three .agent_memory subdirectories
// individually while the callback wrote to two others.
//
// These assertions are written as "the daemon never re-indexes because of its OWN output", not as
// "these three paths are excluded", because the latter is the exact shape of the original bug.
test("the index watcher ignores everything the daemon itself writes", () => {
  // Every path below is written during a re-index pass. If any one of them triggers another pass,
  // the daemon feeds itself forever on a repository nobody is touching.
  for (const written of [
    ".agent_memory/daemon/status.json", // rewritten EVERY tick — last_indexed_at always differs
    ".agent_memory/structural/manifest.json", // ~41 MB of structural output per pass
    ".agent_memory/structural/symbols.json",
    ".agent_memory/structural/file-cache.json",
    ".agent_memory/indexes/packets.json",
    ".agent_memory/code_graph/graph.json",
    ".agent_memory/graph/graph.json",
    ".agent_memory/observations/2026-08-05.jsonl",
    ".agent_memory/packets/some-packet.md",
  ]) {
    assert.equal(shouldTriggerReindex(written), false, `${written} must not re-arm the indexer`);
  }

  // Noise that is never source.
  assert.equal(shouldTriggerReindex("node_modules/left-pad/index.js"), false);
  assert.equal(shouldTriggerReindex(".git/index"), false);
  assert.equal(shouldTriggerReindex(""), false, "a watch event with no filename is not a change");

  // ...and it still does its job: real source edits re-index.
  for (const source of ["mcp/kernel.ts", "src/limits.ts", "platform/web/src/main.tsx", "README.md"]) {
    assert.equal(shouldTriggerReindex(source), true, `${source} is source and must re-index`);
  }
});

// The debounce coalesces a burst; only the floor bounds the RATE. A loop re-arms after the
// previous pass finished, so the debounce alone can never stop one — that distinction is why the
// original bug ran unbounded, and it is worth pinning so neither value is "simplified" away.
test("index passes are both debounced and rate-floored", () => {
  assert.ok(INDEX_DEBOUNCE_MS >= 1_000, "a sub-second debounce re-indexes mid-edit");
  assert.ok(MIN_INDEX_INTERVAL_MS >= 10_000, "the floor is what makes a re-trigger loop cheap");
  assert.ok(MIN_INDEX_INTERVAL_MS > INDEX_DEBOUNCE_MS, "a floor below the debounce bounds nothing");
});

// The legacy dashboard bundle is gone; there is one UI now. These assert that removing it did not
// 404 anyone: the origin and every old /viewer/ path land on the portal, query string intact.
test("the origin and retired viewer paths redirect to the portal, preserving query params", () => {
  assert.equal(viewerRedirectLocation("/", "", "?graph=/repo/.agent_memory/graph/graph.json"), "/app/?graph=/repo/.agent_memory/graph/graph.json");
  assert.equal(viewerRedirectLocation("/viewer", "", "?graph=/repo/.agent_memory/graph/graph.json"), "/app/?graph=/repo/.agent_memory/graph/graph.json");
  assert.equal(viewerRedirectLocation("/viewer/", "?graph=/repo/.agent_memory/graph/graph.json", "?fallback=true"), "/app/?graph=/repo/.agent_memory/graph/graph.json");
  // A deep legacy link must redirect too, not 404 — the bundle it pointed at no longer exists.
  assert.equal(viewerRedirectLocation("/viewer/graph.html", "?g=1", "?fallback=true"), "/app/?g=1");
  // Anything that was never the viewer is still not a redirect target.
  assert.equal(viewerRedirectLocation("/v2/cards", "", ""), null);
  assert.equal(viewerRedirectLocation("/app/", "", ""), null);
});

test("viewer static responses include browser security headers", () => {
  const headers = viewerStaticHeaders("/repo/mcp/viewer/index.html");
  assert.equal(headers["content-type"], "text/html; charset=utf-8");
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["referrer-policy"], "no-referrer");
  assert.equal(headers["cross-origin-opener-policy"], "same-origin");
  assert.match(headers["content-security-policy"], /default-src 'self'/);
  assert.match(headers["content-security-policy"], /script-src 'self'/);
  assert.match(headers["content-security-policy"], /script-src-attr 'none'/);
  assert.doesNotMatch(headers["content-security-policy"], /script-src 'unsafe-inline'/);
});

test("the built portal is served under /app/ with SPA fallback and no path traversal", () => {
  const appDir = mkdtempSync(join(tmpdir(), "kage-app-"));
  mkdirSync(join(appDir, "assets"), { recursive: true });
  writeFileSync(join(appDir, "index.html"), "<!doctype html><title>portal</title>");
  writeFileSync(join(appDir, "assets", "main.js"), "export const x = 1;");

  // A real built asset resolves to itself.
  assert.equal(resolveAppAsset(appDir, "/app/assets/main.js"), join(appDir, "assets", "main.js"));
  // The bare /app/ and /app entry both resolve to the SPA entry document.
  assert.equal(resolveAppAsset(appDir, "/app/"), join(appDir, "index.html"));
  assert.equal(resolveAppAsset(appDir, "/app"), join(appDir, "index.html"));
  // A client-side deep link (no matching file) falls back to the SPA entry so history routing works.
  assert.equal(resolveAppAsset(appDir, "/app/review"), join(appDir, "index.html"));
  assert.equal(resolveAppAsset(appDir, "/app/admin/diagnostics"), join(appDir, "index.html"));
  // Path traversal outside the built portal is refused (never escapes appDir).
  assert.equal(resolveAppAsset(appDir, "/app/../../etc/passwd"), join(appDir, "index.html"));
  // Non-/app paths are not this resolver's concern.
  assert.equal(resolveAppAsset(appDir, "/viewer/index.html"), null);
  assert.equal(resolveAppAsset(appDir, "/kage/events"), null);
});

test("bare /app redirects to /app/ so relative asset URLs resolve", () => {
  assert.equal(appRedirectLocation("/app"), "/app/");
  assert.equal(appRedirectLocation("/app/"), null);
  assert.equal(appRedirectLocation("/app/review"), null);
  assert.equal(appRedirectLocation("/viewer"), null);
});

test("the report paths are still computed, and the viewer URL is just the portal", () => {
  const reports = viewerReportPaths("/repo");
  assert.equal(reports.value, "/repo/.agent_memory/reports/value.json");
  assert.equal(reports.trust, "/repo/.agent_memory/reports/trust.json");
  assert.equal(reports.metrics, "/repo/.agent_memory/metrics.json");
  assert.equal(reports.teamLink, "/repo/.agent_memory/reports/team-link.json");

  // The URL used to carry ~30 of these as query parameters, which meant printing thirty absolute
  // paths from the operator's home directory into a link the portal never read. The portal gets
  // its data from the daemon's routes; the address bar is not a data channel.
  const url = viewerUrl("127.0.0.1", 3113);
  assert.equal(url, "http://127.0.0.1:3113/app/");
  assert.doesNotMatch(url, /agent_memory/, "no filesystem paths in the URL");
});

// The legacy dashboard bundle it asserted on (mcp/viewer/index.html + console.js) was deleted;
// its test goes with it rather than being left asserting a page nobody serves.

test("viewer benchmark report combines local gates with coding memory retrieval proof", () => {
  const project = mkdtempSync(join(tmpdir(), "kage-viewer-benchmark-"));
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "vitest" } }), "utf8");

  const report = viewerBenchmarkReport(project);

  assert.equal(Array.isArray(report.gates), true);
  assert.equal(report.summary.benchmark, "Kage coding memory quality");
  assert.equal(report.summary.recall_at_10_percent, 100);
  assert.equal(report.memory_quality.dataset.observations, 240);
  assert.equal(report.memory_quality.summary.context_reduction_percent > 0, true);
  assert.equal(report.memory_scale.summary.largest_packets, 240);
  assert.equal(report.memory_scale.summary.largest_hit_rate_percent, 100);
});

test("viewer benchmark report exposes a proof ledger with runnable commands", () => {
  const project = mkdtempSync(join(tmpdir(), "kage-viewer-benchmark-proof-"));
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "vitest" } }), "utf8");

  const report = viewerBenchmarkReport(project);

  assert.equal(report.proof_ledger.length >= 3, true);
  assert.ok(report.proof_ledger.some((item) => item.id === "memory-quality" && item.command === "kage benchmark --memory-quality --json" && item.pass));
  assert.ok(report.proof_ledger.some((item) => item.id === "source-diversity" && item.command === "kage benchmark --memory-quality --json" && item.pass));
  assert.ok(report.proof_ledger.some((item) => item.id === "memory-scale" && item.command === "kage benchmark --scale --sizes 240 --json"));
  assert.ok(report.proof_ledger.some((item) => item.id === "local-gates" && item.command === "kage benchmark --project . --json"));
  for (const item of report.proof_ledger) {
    assert.equal(typeof item.label, "string");
    assert.equal(typeof item.metric, "string");
    assert.equal(typeof item.next_action, "string");
    assert.equal(item.next_action.length > 0, true);
  }
});

test("live feed streams packet writes and value ledger events over SSE", async () => {
  const project = mkdtempSync(join(tmpdir(), "kage-live-feed-"));
  mkdirSync(join(project, ".agent_memory", "packets"), { recursive: true });
  mkdirSync(join(project, ".agent_memory", "reports"), { recursive: true });
  const feed = startLiveFeed(project, { debounceMs: 25, heartbeatMs: 60_000 });
  const server = createServer((req, res) => {
    if (req.url === "/kage/events") {
      feed.handleRequest(req, res);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  let received = "";
  const request = get(`http://127.0.0.1:${port}/kage/events`, (res) => {
    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers["content-type"]), /text\/event-stream/);
    res.on("data", (chunk) => { received += String(chunk); });
  });
  const waitFor = async (pattern: RegExp) => {
    const deadline = Date.now() + 5000;
    while (!pattern.test(received)) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${pattern}; received so far: ${received}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };

  try {
    await waitFor(/: connected/);
    assert.equal(feed.clientCount(), 1);

    // new packet file -> packet_written with the packet title
    writeFileSync(join(project, ".agent_memory", "packets", "demo-packet.json"), JSON.stringify({ title: "Demo packet from the live feed" }), "utf8");
    await waitFor(/"type":"packet_written"/);
    await waitFor(/Demo packet from the live feed/);

    // same file rewritten -> packet_updated
    writeFileSync(join(project, ".agent_memory", "packets", "demo-packet.json"), JSON.stringify({ title: "Demo packet, revised" }), "utf8");
    await waitFor(/"type":"packet_updated"/);

    // value ledger append -> value_event carrying the ledger entry
    writeFileSync(
      join(project, ".agent_memory", "reports", "value.json"),
      JSON.stringify({ totals: { tokens_saved: 1200 }, events: [{ kind: "recall_served", tokens_saved: 1200, at: new Date().toISOString() }] }),
      "utf8"
    );
    await waitFor(/"type":"value_event"/);
    await waitFor(/"kind":"recall_served"/);
  } finally {
    request.destroy();
    feed.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("live feed enriches packet events with work-item fields for a real .md proposal packet, and readPacketTitle no longer silently fails on .md packets", async () => {
  const project = mkdtempSync(join(tmpdir(), "kage-live-feed-workitem-"));
  mkdirSync(join(project, ".agent_memory", "packets"), { recursive: true });
  mkdirSync(join(project, ".agent_memory", "reports"), { recursive: true });
  const feed = startLiveFeed(project, { debounceMs: 25, heartbeatMs: 60_000 });
  const server = createServer((req, res) => {
    if (req.url === "/kage/events") {
      feed.handleRequest(req, res);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  let received = "";
  const request = get(`http://127.0.0.1:${port}/kage/events`, (res) => {
    res.on("data", (chunk) => { received += String(chunk); });
  });
  const waitFor = async (pattern: RegExp) => {
    const deadline = Date.now() + 5000;
    while (!pattern.test(received)) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${pattern}; received so far: ${received}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };

  try {
    await waitFor(/: connected/);
    // capture() writes a real .md OKF packet (the current on-disk format) — this
    // is exactly the case that silently broke the old raw-JSON.parse
    // readPacketTitle: it would swallow the parse error and fall back to the raw
    // filename (still carrying ".md") as a fake title.
    const result = capture({
      projectDir: project,
      title: "Add retry logic to sync client",
      body: "We should add retry logic because transient network errors currently fail sync silently.",
      type: "proposal",
      allowMissingPaths: true,
    });
    assert.equal(result.ok, true);
    await waitFor(/"type":"packet_written"/);
    await waitFor(/Add retry logic to sync client/);
    assert.doesNotMatch(received, /"title":"[^"]*\.md"/, "title must never be the raw filename with .md still attached");
    assert.match(received, /"packet_type":"proposal"/);
    assert.match(received, /"stage":"proposed"/);
  } finally {
    request.destroy();
    feed.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("daemon doctor advertises complete REST memory operations", () => {
  const project = mkdtempSync(join(tmpdir(), "kage-daemon-doctor-"));

  const report = daemonDoctor(project);

  assert.ok(report.endpoints.includes("POST http://127.0.0.1:3111/kage/context"));
  assert.ok(report.endpoints.includes("POST http://127.0.0.1:3111/kage/capture"));
  assert.ok(report.endpoints.includes("POST http://127.0.0.1:3111/kage/learn"));
  assert.ok(report.endpoints.includes("POST http://127.0.0.1:3111/kage/feedback"));
  assert.ok(report.endpoints.includes("GET http://127.0.0.1:3111/kage/setup-doctor"));
  assert.ok(report.endpoints.includes("GET http://127.0.0.1:3111/kage/profile"));
  assert.ok(report.endpoints.includes("GET http://127.0.0.1:3111/kage/xray"));
  assert.ok(report.endpoints.includes("GET http://127.0.0.1:3111/kage/capabilities"));
  assert.ok(report.endpoints.includes("GET http://127.0.0.1:3111/kage/context-slots"));
  assert.ok(report.endpoints.includes("POST http://127.0.0.1:3111/kage/context-slots"));
  assert.ok(report.endpoints.includes("GET http://127.0.0.1:3111/kage/replay"));
  assert.ok(report.endpoints.includes("GET http://127.0.0.1:3111/kage/learning-ledger"));
  assert.ok(report.endpoints.includes("GET http://127.0.0.1:3111/kage/work-items"));
  assert.ok(report.endpoints.includes("POST http://127.0.0.1:3111/kage/work-items/:id/claim"));
  assert.ok(report.endpoints.includes("POST http://127.0.0.1:3111/kage/work-items/:id/transition"));
});

test("optional vNext startup fails open without preventing the legacy daemon", async () => {
  const reports: string[] = [];
  let starts = 0;

  const runtime = await startOptionalVnextRuntime(
    "/repo",
    true,
    async () => {
      starts += 1;
      throw new Error("runtime unavailable");
    },
    (message) => reports.push(message),
  );

  assert.equal(runtime, null);
  assert.equal(starts, 1);
  assert.equal(reports.length, 1);
  assert.match(reports[0], /vNext runtime.*runtime unavailable/i);
});

test("legacy daemon leaves optional vNext startup disabled by default", async () => {
  let starts = 0;
  const runtime = await startOptionalVnextRuntime(
    "/repo",
    false,
    async () => {
      starts += 1;
      throw new Error("must not start");
    },
  );

  assert.equal(runtime, null);
  assert.equal(starts, 0);
});

test("extractWorkItemId decodes a colon-bearing packet id and rejects a non-matching path", () => {
  const id = "repo:memory:proposal:add-retry-logic-to-sync-client-1783683329060";
  const encoded = encodeURIComponent(id);
  assert.equal(extractWorkItemId(`/kage/work-items/${encoded}/claim`, "/claim"), id);
  assert.equal(extractWorkItemId(`/kage/work-items/${encoded}/transition`, "/transition"), id);
  // Wrong suffix, wrong prefix, empty id, and a "/claim"-suffixed-but-not-this-route
  // path must all miss — a false positive here would route a claim as a transition.
  assert.equal(extractWorkItemId(`/kage/work-items/${encoded}/transition`, "/claim"), null);
  assert.equal(extractWorkItemId(`/kage/other/${encoded}/claim`, "/claim"), null);
  assert.equal(extractWorkItemId("/kage/work-items//claim", "/claim"), null);
  assert.equal(extractWorkItemId("/kage/work-items", "/claim"), null);
});

test("daemon context report gives REST agents combined memory graph and risk context", () => {
  const project = mkdtempSync(join(tmpdir(), "kage-daemon-context-"));
  mkdirSync(join(project, "src"), { recursive: true });
  mkdirSync(join(project, "test"), { recursive: true });
  writeFileSync(join(project, "src", "auth.ts"), "export function verifyToken(token: string) { return token.length > 0; }\n", "utf8");
  writeFileSync(
    join(project, "test", "auth.test.ts"),
    "import { verifyToken } from '../src/auth.js';\ntest('verifyToken accepts non-empty tokens', () => verifyToken('token'));\n",
    "utf8"
  );
  const captured = capture({
    projectDir: project,
    title: "Auth token verification gotcha",
    body: "When editing src/auth.ts, keep token verification side-effect free because middleware callers retry failed requests.",
    type: "gotcha",
    paths: ["src/auth.ts"],
    tags: ["auth", "rest"],
  });
  assert.equal(captured.ok, true);
  indexProject(project);

  const report = daemonContextReport(project, {
    query: "auth token flow in src/auth.ts",
    targets: ["src/auth.ts"],
    limit: 3,
  });

  assert.match(report.context_block, /# Kage Context/);
  assert.match(report.context_block, /Teammate Brief/);
  assert.match(report.context_block, /Verification Contract/);
  assert.match(report.context_block, /test\/auth\.test\.ts/);
  assert.match(report.context_block, /Auth token verification gotcha/);
  assert.equal(report.recall.results.some((item) => item.packet.title === "Auth token verification gotcha"), true);
  assert.equal(report.graph.entities.length + report.graph.edges.length > 0, true);
  assert.ok(report.risk);
  assert.equal(report.risk.targets["src/auth.ts"].target, "src/auth.ts");
});

// The board re-derives on every request, so a claim made anywhere — the CLI, an agent, a
// teammate through the app — changes what every other viewer should be seeing. Without a
// signal on the wire, an operator stares at a stale board until they think to reload, which
// is exactly when two people claim the same item.
test("live feed announces work-state changes when a command is logged", async () => {
  const project = mkdtempSync(join(tmpdir(), "kage-live-work-"));
  mkdirSync(join(project, ".agent_memory", "packets"), { recursive: true });
  mkdirSync(join(project, ".agent_memory", "reports"), { recursive: true });
  mkdirSync(join(project, ".agent_memory", "work"), { recursive: true });
  const feed = startLiveFeed(project, { debounceMs: 25, heartbeatMs: 60_000 });
  const server = createServer((req, res) => {
    if (req.url === "/kage/events") { feed.handleRequest(req, res); return; }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  let received = "";
  const request = get(`http://127.0.0.1:${port}/kage/events`, (res) => {
    res.on("data", (chunk) => { received += String(chunk); });
  });
  const waitFor = async (pattern: RegExp) => {
    const deadline = Date.now() + 5000;
    while (!pattern.test(received)) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${pattern}; received: ${received}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };

  try {
    await waitFor(/: connected/);
    // A command appended by ANY surface — this writes the log directly, exactly as the CLI
    // and the app both ultimately do.
    writeFileSync(
      join(project, ".agent_memory", "work", "commands.jsonl"),
      `${JSON.stringify({ event_id: "cmd-1", ts: new Date().toISOString(), kind: "task.claimed", work_id: "w-1", actor: "alice" })}\n`,
      "utf8",
    );
    await waitFor(/work_changed/);
    // The event names the decision that caused it, so a client can show "alice claimed w-1"
    // without refetching the whole board just to find out what happened.
    await waitFor(/task\.claimed/);
    await waitFor(/alice/);
  } finally {
    request.destroy();
    feed.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
