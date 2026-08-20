// Tests for "kill the flicker" — the app repainted the whole UI on every poll tick and
// SSE notify. This file covers the render-calm seam added to app-client.ts (revision
// gating, keyed-list patch-vs-rebuild, the render-counter proof seam, the age ticker)
// and the api.ts server-side cache + correctness fix for branch_landed/worktree_adoptable
// folded into the same run.
//
// Its own file per this repo's rule — new behaviour gets a new test file, and
// mcp/delegation.test.ts is a known append-collision hotspot.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import type { AddressInfo } from "node:net";

import { createDelegationFeed, createPtyState, createRoomState, handleDelegationRoute, type DelegationFeed } from "./delegation/api.js";
import { guardRequest } from "./delegation/guard.js";
import { createRun, transitionRun, patchRun } from "./delegation/contract.js";
import { createWorktree } from "./delegation/worktree.js";
import { writeDelegationConfig } from "./delegation/config.js";
import { delegationAppHtml } from "./delegation/app-html.js";
import { APP_CLIENT } from "./delegation/app-client.js";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test Author",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test Author",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function tempProject(): string {
  return mkdtempSync(join(tmpdir(), "kage-render-calm-"));
}

function tempGitProject(): string {
  const project = tempProject();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: project, stdio: "ignore" });
  writeFileSync(join(project, "README.md"), "# fixture\n", "utf8");
  execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  execFileSync("git", ["commit", "-m", "seed"], { cwd: project, stdio: "ignore", env: GIT_ENV });
  return project;
}

// --- vm-sandbox harness for the pure render-calm functions ---------------------------
//
// Same technique dead-ends.test.ts / receipt.test.ts use: the real APP_CLIENT string is
// evaluated in a fresh vm context against a minimal `document` stub, and the exported
// pure functions are called directly — no source-text pattern matching, the actual code
// path runs. Function declarations (and top-level `var` initializers reached before the
// first DOM-less throw) are all live in the sandbox regardless of where execution later
// aborts.
function makeMinimalDocument(extra: Record<string, unknown> = {}) {
  return {
    createElement: (tag: string) => ({ tagName: tag, className: "", textContent: "", children: [] as unknown[], appendChild(c: unknown) { (this.children as unknown[]).push(c); return c; } }),
    createTextNode: (text: string) => ({ nodeType: 3, textContent: text }),
    getElementById: () => null,
    body: { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
    ...extra,
  };
}

function loadSandbox(extraDoc: Record<string, unknown> = {}): Record<string, unknown> {
  const sandbox: Record<string, unknown> = {
    document: makeMinimalDocument(extraDoc),
    navigator: { userAgent: "" },
    window: {},
    console,
  };
  try {
    runInNewContext(APP_CLIENT, sandbox, { timeout: 2000 });
  } catch {
    // Expected: top-level DOM wiring past the function declarations throws in this
    // DOM-less context (getElementById returns null here, same as dead-ends.test.ts's
    // own stub). Every function under test — and every `var` initialized before that
    // abort point, which is where the render-calm seam lives — is still defined.
  }
  return sandbox;
}

// --- render-counter seam ---------------------------------------------------------------

test("RENDER_COUNTS exists with one counter per gated section, and window.__kageRenderCounts exposes the same object for the console", () => {
  const sandbox = loadSandbox();
  const counts = sandbox.RENDER_COUNTS as Record<string, number>;
  assert.ok(counts, "RENDER_COUNTS must be defined");
  for (const section of ["runs", "board", "sidebar", "goalRail", "room", "memory", "detail"]) {
    assert.equal(typeof counts[section], "number", `RENDER_COUNTS.${section} must start as a number`);
  }
  const win = sandbox.window as Record<string, unknown>;
  assert.equal(win.__kageRenderCounts, counts, "the console-reachable handle must be the SAME object bumpRenderCount mutates");
});

test("bumpRenderCount increments exactly the named section and nothing else", () => {
  const sandbox = loadSandbox();
  const counts = sandbox.RENDER_COUNTS as Record<string, number>;
  const bump = sandbox.bumpRenderCount as (name: string) => void;
  const before = { ...counts };
  bump("runs");
  assert.equal(counts.runs, (before.runs || 0) + 1);
  for (const section of Object.keys(before)) {
    if (section === "runs") continue;
    assert.equal(counts[section], before[section], `${section} must be untouched by bumping "runs"`);
  }
});

// --- revision gating: "two identical payloads -> one render", section isolation -------

test("revisionChanged: two consecutive identical payloads render exactly once, a changed payload renders again", () => {
  const sandbox = loadSandbox();
  const revisionChanged = sandbox.revisionChanged as (section: string, payload: unknown) => boolean;
  const bump = sandbox.bumpRenderCount as (name: string) => void;
  const counts = sandbox.RENDER_COUNTS as Record<string, number>;

  function simulateSectionRender(section: string, payload: unknown): boolean {
    if (revisionChanged(section, payload)) {
      bump(section);
      return true;
    }
    return false;
  }

  const payloadA = { runs: [{ id: "r1", display_state: "running" }] };
  assert.equal(simulateSectionRender("runs", payloadA), true, "first sighting of a payload must render");
  assert.equal(counts.runs, 1);
  // The exact same payload (a fresh object, same shape) — a poll tick returning
  // unchanged data — must skip the DOM work entirely.
  const payloadA2 = { runs: [{ id: "r1", display_state: "running" }] };
  assert.equal(simulateSectionRender("runs", payloadA2), false, "an identical payload must be gated, not re-rendered");
  assert.equal(counts.runs, 1, "the counter must not move on a gated render");

  // A real change (one run's state flips) must render again.
  const payloadB = { runs: [{ id: "r1", display_state: "blocked" }] };
  assert.equal(simulateSectionRender("runs", payloadB), true);
  assert.equal(counts.runs, 2);
});

test("revisionChanged: a payload change in one section never bumps another section's counter — the render-counter proof for section isolation", () => {
  const sandbox = loadSandbox();
  const revisionChanged = sandbox.revisionChanged as (section: string, payload: unknown) => boolean;
  const bump = sandbox.bumpRenderCount as (name: string) => void;
  const counts = sandbox.RENDER_COUNTS as Record<string, number>;

  function simulateSectionRender(section: string, payload: unknown): boolean {
    if (revisionChanged(section, payload)) {
      bump(section);
      return true;
    }
    return false;
  }

  // Paint every section once so each has a remembered revision to compare against.
  simulateSectionRender("runs", { runs: [{ id: "r1", display_state: "running" }] });
  simulateSectionRender("room", { turns: 3 });
  simulateSectionRender("memory", { packets: 10 });
  simulateSectionRender("goalRail", { goals: [{ id: "g1" }] });
  const before = { ...counts };

  // Only "runs" changes: one run's own display_state moves.
  simulateSectionRender("runs", { runs: [{ id: "r1", display_state: "ready" }] });
  assert.equal(counts.runs, before.runs + 1, "the changed section must render");
  assert.equal(counts.room, before.room, "room's counter must be untouched by a runs-only change");
  assert.equal(counts.memory, before.memory, "memory's counter must be untouched by a runs-only change");
  assert.equal(counts.goalRail, before.goalRail, "goalRail's counter must be untouched by a runs-only change");
});

test("stableStringify sorts object keys so two payloads differing only in key order hash identically", () => {
  const sandbox = loadSandbox();
  const stableStringify = sandbox.stableStringify as (v: unknown) => string;
  assert.equal(stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }));
  assert.notEqual(stableStringify({ a: 1 }), stableStringify({ a: 2 }));
  assert.equal(stableStringify([1, { x: 1, y: 2 }]), stableStringify([1, { y: 2, x: 1 }]));
});

// --- keyed-list patch-vs-rebuild decision ----------------------------------------------

// keyedListPlan runs inside the vm sandbox, so its return value's arrays/object come
// from a DIFFERENT realm than this test file's own Array/Object — deepStrictEqual
// treats same-shaped cross-realm values as unequal (a prototype-identity check, not a
// structural one), so results are normalized back into this realm via JSON round-trip
// before comparing.
function normalize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("keyedListPlan: never names a key that is neither added nor removed, and detects reordering of survivors", () => {
  const sandbox = loadSandbox();
  const keyedListPlan = sandbox.keyedListPlan as (existing: string[], next: string[]) => { removed: string[]; added: string[]; reordered: boolean };

  const noChange = normalize(keyedListPlan(["a", "b", "c"], ["a", "b", "c"]));
  assert.deepEqual(noChange, { removed: [], added: [], reordered: false }, "an unchanged list touches nothing");

  const addRemove = normalize(keyedListPlan(["a", "b", "c"], ["a", "c", "d"]));
  assert.deepEqual(addRemove.removed, ["b"]);
  assert.deepEqual(addRemove.added, ["d"]);
  assert.equal(addRemove.reordered, false, "a survives at position 0, c survives after b's removal — no reorder among survivors");

  const reorder = normalize(keyedListPlan(["a", "b", "c"], ["c", "a", "b"]));
  assert.deepEqual(reorder.removed, []);
  assert.deepEqual(reorder.added, []);
  assert.equal(reorder.reordered, true, "same three keys, different order");
});

// --- reconcileChildren: real node-identity reuse, not destroy-and-recreate ------------

interface FakeNode {
  id: string;
  parent: FakeContainer | null;
  nextSibling: FakeNode | null;
}
interface FakeContainer {
  childNodes: FakeNode[];
  firstChild: FakeNode | null;
  removeChild(node: FakeNode): void;
  insertBefore(node: FakeNode, ref: FakeNode | null): void;
}
function makeFakeContainer(initial: FakeNode[]): FakeContainer {
  const container: FakeContainer = {
    childNodes: [...initial],
    get firstChild(): FakeNode | null {
      return container.childNodes[0] ?? null;
    },
    removeChild(node) {
      const at = container.childNodes.indexOf(node);
      if (at < 0) throw new Error("removeChild: not a child");
      container.childNodes.splice(at, 1);
      node.parent = null;
      relink(container);
    },
    insertBefore(node, ref) {
      const from = container.childNodes.indexOf(node);
      if (from >= 0) container.childNodes.splice(from, 1);
      const at = ref ? container.childNodes.indexOf(ref) : -1;
      if (ref && at < 0) throw new Error("insertBefore: ref not a child");
      if (at < 0) container.childNodes.push(node);
      else container.childNodes.splice(at, 0, node);
      node.parent = container;
      relink(container);
    },
  } as FakeContainer;
  initial.forEach((n) => { n.parent = container; });
  relink(container);
  return container;
}
function relink(container: FakeContainer): void {
  container.childNodes.forEach((n, i) => { n.nextSibling = container.childNodes[i + 1] ?? null; });
}
function node(id: string): FakeNode {
  return { id, parent: null, nextSibling: null };
}

test("reconcileChildren removes only dropped nodes, appends only new ones, and preserves node IDENTITY for everything kept", () => {
  const sandbox = loadSandbox();
  const reconcileChildren = sandbox.reconcileChildren as (container: unknown, desired: unknown[]) => void;

  const a = node("a");
  const b = node("b");
  const c = node("c");
  const container = makeFakeContainer([a, b, c]);
  const d = node("d");

  // Drop b, add d, keep a and c in their relative order — the exact "one run's state
  // changed" shape: unaffected siblings must never be touched.
  reconcileChildren(container, [a, c, d]);

  assert.deepEqual(container.childNodes.map((n) => n.id), ["a", "c", "d"]);
  // The critical assertion: `a` and `c` in the final children array are the SAME
  // object references passed in, not new nodes with the same id — proof that an
  // unaffected row's DOM node is moved, never destroyed and recreated.
  assert.equal(container.childNodes[0], a);
  assert.equal(container.childNodes[1], c);
  assert.equal(b.parent, null, "the dropped node must actually be removed");
});

test("reconcileChildren reorders survivors without recreating them", () => {
  const sandbox = loadSandbox();
  const reconcileChildren = sandbox.reconcileChildren as (container: unknown, desired: unknown[]) => void;

  const a = node("a");
  const b = node("b");
  const c = node("c");
  const container = makeFakeContainer([a, b, c]);

  reconcileChildren(container, [c, a, b]);
  assert.deepEqual(container.childNodes.map((n) => n.id), ["c", "a", "b"]);
  assert.equal(container.childNodes[0], c);
  assert.equal(container.childNodes[1], a);
  assert.equal(container.childNodes[2], b);
});

test("reconcileChildren is a no-op (no removeChild/insertBefore calls) when the desired order already matches", () => {
  const sandbox = loadSandbox();
  const reconcileChildren = sandbox.reconcileChildren as (container: unknown, desired: unknown[]) => void;

  const a = node("a");
  const b = node("b");
  const container = makeFakeContainer([a, b]);
  let removeCalls = 0;
  let insertCalls = 0;
  const originalRemove = container.removeChild.bind(container);
  const originalInsert = container.insertBefore.bind(container);
  container.removeChild = (n) => { removeCalls += 1; originalRemove(n); };
  container.insertBefore = (n, ref) => { insertCalls += 1; originalInsert(n, ref); };

  reconcileChildren(container, [a, b]);
  assert.equal(removeCalls, 0, "nothing should be removed when the list is unchanged");
  assert.equal(insertCalls, 0, "nothing should be moved when the order already matches — this is the flicker-killing property");
});

// --- age ticker: patches text without incrementing any section render counter ---------

test("tickAges patches every [data-age] node's text in place and never touches RENDER_COUNTS", () => {
  const iso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // ~3h ago
  const ageNode = { attrs: { "data-age": iso } as Record<string, string>, textContent: "stale" };
  const prefixedNode = { attrs: { "data-age": iso, "data-age-prefix": "done · " } as Record<string, string>, textContent: "stale" };
  const fakeNodes = [ageNode, prefixedNode].map((n) => ({
    getAttribute: (name: string) => n.attrs[name] ?? null,
    setAttribute: (name: string, value: string) => { n.attrs[name] = value; },
    get textContent() { return n.textContent; },
    set textContent(v: string) { n.textContent = v; },
  }));
  const sandbox = loadSandbox({ querySelectorAll: (sel: string) => (sel === "[data-age]" ? fakeNodes : []) });
  const counts = sandbox.RENDER_COUNTS as Record<string, number>;
  const before = { ...counts };
  const ago = sandbox.ago as (iso: string) => string;
  const expected = ago(iso);

  (sandbox.tickAges as () => void)();

  assert.equal(ageNode.textContent, expected, "a bare age label must read the same as ago() computes");
  assert.equal(prefixedNode.textContent, "done · " + expected, "a prefixed age label must keep its prefix");
  assert.deepEqual(normalize(counts), before, "tickAges must never bump any section's render counter — it is a text patch, not a render");
});

// --- server-side cache + correctness fix (item 6 + the vacuous-ancestor bug) ----------

const TOKEN = "test-token-0123456789abcdef0123456789abcdef";

async function startApi(projectDir: string): Promise<{ server: Server; port: number; feed: DelegationFeed }> {
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
    if (await handleDelegationRoute({ projectDir, feed, room, pty }, req, res, url)) return;
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const port = (server.address() as AddressInfo).port;
  return { server, port, feed };
}

function apiFetch(port: number, path: string): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, { headers: { host: `127.0.0.1:${port}`, "content-type": "application/json" } });
}

// The exact orphan shape a stopped agent leaves: created, dispatched, running, its
// worktree checked out off HEAD with zero commits of its own, then killed.
function orphanedFailedRun(project: string): { runId: string; branch: string; worktree: string } {
  const task = createRun(project, { intent: "orphaned work, never committed", type: "bugfix", agent: "stub" });
  transitionRun(project, task.id, "briefed", "kernel");
  transitionRun(project, task.id, "dispatched", "kernel");
  transitionRun(project, task.id, "running", "kernel");
  const worktree = createWorktree(project, task.id, task.branch);
  patchRun(project, task.id, { worktree: worktree.path });
  transitionRun(project, task.id, "failed", "kernel", "agent process gone");
  writeDelegationConfig(project, { test: "true" });
  return { runId: task.id, branch: task.branch, worktree: worktree.path };
}

// FAILS ON REVERT: reverting the branchHasRealCommits check in api.ts's computeDeadFields
// (or reverting to calling isBranchLanded alone) makes this a `git merge-base
// --is-ancestor` call whose branch tip sits exactly at the merge-base — trivially "an
// ancestor of HEAD" — so branch_landed comes back true for a run that only has
// UNCOMMITTED changes in its worktree. Reproduced live: run
// write-the-release-notes-for-the-next-ver-260818-cb42 had a zero-commit branch and a
// dirty worktree, and the detail pane offered BOTH "Adopt" and "Close as landed" —
// clicking the latter would reject a record while telling the user their work was safe.
test("a run whose branch never diverged from HEAD (all its work is uncommitted in the worktree) never shows branch_landed, even though it is worktree_adoptable", async () => {
  const project = tempGitProject();
  const { server, port, feed } = await startApi(project);
  try {
    const orphan = orphanedFailedRun(project);
    // Dirty the worktree without ever committing on the branch — the exact orphaned-run
    // shape: real uncommitted work, zero commits beyond the fork point.
    writeFileSync(join(orphan.worktree, "CHANGELOG.md"), "+112 real lines, never committed\n", "utf8");

    const listed = (await (await apiFetch(port, "/runs")).json()) as { runs: Array<Record<string, unknown>> };
    const run = listed.runs.find((r) => r.id === orphan.runId);
    assert.ok(run, "the fixture run must be listed");
    assert.equal(run!.worktree_adoptable, true, "fixture proof: this is exactly the shape Adopt exists for");
    assert.equal("branch_landed" in run!, false, "a branch that never diverged from HEAD must never read as landed — never both affordances at once");

    const detail = (await (await apiFetch(port, `/runs/${orphan.runId}`)).json()) as { run: Record<string, unknown> };
    assert.equal("branch_landed" in detail.run, false, "the single-run detail route must agree with the list");
  } finally {
    feed.close();
    server.close();
  }
});

// FAILS ON REVERT: a genuinely landed branch (real commits, merged into HEAD) must still
// show branch_landed:true — the fix narrows the vacuous case, it must not also swallow
// the real one.
test("a run whose branch has real commits that ARE merged into HEAD still shows branch_landed:true", async () => {
  const project = tempGitProject();
  const { server, port, feed } = await startApi(project);
  try {
    const landed = createRun(project, { intent: "landed by hand under the bootstrap exception", type: "bugfix", agent: "stub" });
    transitionRun(project, landed.id, "briefed", "kernel");
    transitionRun(project, landed.id, "dispatched", "kernel");
    transitionRun(project, landed.id, "running", "kernel");
    const worktree = createWorktree(project, landed.id, landed.branch);
    writeFileSync(join(worktree.path, "landed.txt"), "1\n", "utf8");
    execFileSync("git", ["add", "-A"], { cwd: worktree.path, stdio: "ignore", env: GIT_ENV });
    execFileSync("git", ["commit", "-m", "landed work"], { cwd: worktree.path, stdio: "ignore", env: GIT_ENV });
    execFileSync("git", ["merge", "--no-ff", "-m", "merge", landed.branch], { cwd: project, stdio: "ignore", env: GIT_ENV });
    transitionRun(project, landed.id, "stopped", "kernel", "elapsed 59.8 min exceeded the 30 min budget");

    const listed = (await (await apiFetch(port, "/runs")).json()) as { runs: Array<Record<string, unknown>> };
    const run = listed.runs.find((r) => r.id === landed.id);
    assert.equal(run!.branch_landed, true);
  } finally {
    feed.close();
    server.close();
  }
});

// FAILS ON REVERT: without the cache, a second identical /runs poll for an unchanged run
// re-derives worktree_adoptable from git a second time — this proves it does not, by
// cleaning the worktree AFTER the first poll cached it (which would make a fresh check
// answer false) and confirming the SECOND poll still reports the cached (now stale)
// true, because the run's own updated_at — the cache key — never moved.
test("computeDeadFields caches per run id + updated_at — a second poll of an unchanged run does not re-derive its dead fields from git", async () => {
  const project = tempGitProject();
  const { server, port, feed } = await startApi(project);
  try {
    const orphan = orphanedFailedRun(project);
    const dirtyFile = join(orphan.worktree, "CHANGELOG.md");
    writeFileSync(dirtyFile, "+1\n", "utf8");

    const first = (await (await apiFetch(port, "/runs")).json()) as { runs: Array<Record<string, unknown>> };
    const firstRun = first.runs.find((r) => r.id === orphan.runId);
    assert.equal(firstRun!.worktree_adoptable, true, "fixture proof: a dirty orphaned worktree is adoptable");

    // Clean the worktree AFTER the first poll cached the answer, without touching the
    // run record's own updated_at — a FRESH isWorktreeAdoptable check against this now-
    // clean worktree would answer false, so the second poll reporting true again proves
    // the cache served its stored answer rather than re-deriving it.
    rmSync(dirtyFile);

    const second = (await (await apiFetch(port, "/runs")).json()) as { runs: Array<Record<string, unknown>> };
    const secondRun = second.runs.find((r) => r.id === orphan.runId);
    assert.equal(secondRun!.worktree_adoptable, true, "the cached dead-fields answer must still be served, unchanged");
  } finally {
    feed.close();
    server.close();
  }
});

// --- composed page: parses, no innerHTML, the counter seam is reachable, narrow-layout
// gates stay green -----------------------------------------------------------------

test("the composed app page still parses as valid JS with the render-calm seam wired in, and never uses innerHTML", () => {
  const html = delegationAppHtml("tok");
  const script = html.split("<script>")[1].split("</" + "script>")[0];
  const dir = mkdtempSync(join(tmpdir(), "kage-render-calm-parse-"));
  try {
    const file = join(dir, "composed-app.js");
    writeFileSync(file, script, "utf8");
    // Same class of bug this file's whole seam is written inside a template literal
    // against: a raw backtick or un-escaped ${ silently breaks the composed page even
    // though app-client.ts alone type-checks as valid TypeScript.
    execFileSync(process.execPath, ["--check", file], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.ok(!script.includes("innerHTML"), "the client script must never use innerHTML");
});

test("the render-counter seam is reachable from the composed page: RENDER_COUNTS and window.__kageRenderCounts are both wired in", () => {
  const html = delegationAppHtml("tok");
  const script = html.split("<script>")[1].split("</" + "script>")[0];
  assert.match(script, /var RENDER_COUNTS\s*=\s*\{/, "RENDER_COUNTS must be declared in the shipped page");
  assert.match(script, /window\.__kageRenderCounts\s*=\s*RENDER_COUNTS/, "the console-reachable handle must be wired into the shipped page");
  assert.match(script, /function bumpRenderCount/, "bumpRenderCount must ship");
});

test("every gated section actually calls revisionChanged and bumpRenderCount with its own name — the seam is wired, not just defined", () => {
  const html = delegationAppHtml("tok");
  const script = html.split("<script>")[1].split("</" + "script>")[0];
  for (const section of ["runs", "board", "sidebar", "goalRail", "room", "memory"]) {
    assert.match(script, new RegExp(`bumpRenderCount\\("${section}"\\)`), `${section} must call bumpRenderCount on a real paint`);
  }
  for (const section of ["runs", "board", "sidebar", "goalRail", "memory"]) {
    assert.match(script, new RegExp(`revisionChanged\\("${section}"`), `${section} must gate through revisionChanged`);
  }
  // The detail pane uses its own per-run-id map instead of the shared revisionChanged
  // slot (item 3: "revision per run id") — still bumps the same counter on a real paint.
  assert.match(script, /bumpRenderCount\("detail"\)/);
  assert.match(script, /detailRevisionByRun/);
});

test("the age ticker is wired to a real interval, independent of the refresh()/refreshRoom() polling cadences", () => {
  const html = delegationAppHtml("tok");
  const script = html.split("<script>")[1].split("</" + "script>")[0];
  assert.match(script, /setInterval\(tickAges,\s*15000\)/);
  assert.match(script, /function tickAges\(\)/);
});

test("SSE run events are coalesced through a 50ms trailing debounce, not called straight into refresh()", () => {
  const html = delegationAppHtml("tok");
  const script = html.split("<script>")[1].split("</" + "script>")[0];
  assert.match(script, /scheduleRunRefresh/);
  assert.match(script, /setTimeout\(function \(\) \{\s*runEventDebounce = null;\s*refresh\(\);\s*\}, 50\)/);
  assert.doesNotMatch(script, /addEventListener\("run", function \(\) \{ refresh\(\); \}\)/, "the run listener must go through the debounce, not call refresh() directly");
});

test("narrow-layout gates stay green: the mobile-detail toggle this run's refactor of renderWork/renderWorkList/renderBoard sits beside is unchanged", () => {
  const html = delegationAppHtml("tok");
  const script = html.split("<script>")[1].split("</" + "script>")[0];
  // Mirrors narrow-layout.test.ts's own assertions — a lightweight proof, run here too,
  // that the keyed-reuse rewrite of renderWorkList/renderBoard did not disturb the
  // narrow single-pane wiring those functions sit beside in renderWork/selectRun.
  assert.match(script, /state\.mobileDetailOpen = true/);
  assert.match(script, /view\.classList\.toggle\("mobile-detail"/);
});
