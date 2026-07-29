import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dispatchApi } from "./api-dispatch.js";
import { capture } from "../../kernel.js";

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "kage-dispatch-"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "t@t.dev"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "T"], { cwd: dir });
  return dir;
}

// The derived routes read packets + git + the command log, never the compiled model. They are
// answered BEFORE the model is opened so they work on any build — including one without
// node:sqlite, which is the whole reason the split exists.
test("the derived routes answer without opening the model", async () => {
  const dir = repo();
  for (const path of ["/v2/attention", "/v2/work", "/v2/proof", "/v2/agents"]) {
    const reply = await dispatchApi(dir, path);
    assert.equal(reply.status, 200, `${path} must answer on a bare repository`);
  }
});

test("the board's expensive knowledge pass is skippable from the query string", async () => {
  const dir = repo();
  capture({ projectDir: dir, type: "proposal", title: "T", body: "B", paths: [] });

  const lean = await dispatchApi(dir, "/v2/work", "?knowledge=0");
  const items = (lean.body as { items: Array<{ knowledge: unknown[] }> }).items;
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].knowledge, [], "no recall was run");

  // And the default still carries it, so nothing is lost by having the option.
  const full = await dispatchApi(dir, "/v2/work");
  assert.equal(full.status, 200);
});

test("a leading ? on the query string is tolerated, since callers pass either form", async () => {
  const dir = repo();
  const withMark = await dispatchApi(dir, "/v2/work", "?knowledge=0");
  const without = await dispatchApi(dir, "/v2/work", "knowledge=0");
  assert.equal(withMark.status, 200);
  assert.equal(without.status, 200);
});

// A missing item is a 404, never an empty item rendered as though it existed.
test("an unknown work item is a 404, not an empty shell", async () => {
  const reply = await dispatchApi(repo(), "/v2/work/repo:x:proposal:nope");
  assert.equal(reply.status, 404);
  assert.match(JSON.stringify(reply.body), /no work item/);
});

test("a path the API does not define is a 404 rather than a stray answer", async () => {
  const reply = await dispatchApi(repo(), "/v2/not-a-real-route");
  assert.equal(reply.status, 404);
});

// Nothing may throw out of here: this runs in a worker whose death takes every in-flight read
// with it, so a failure has to degrade to an honest status naming what could not be produced.
test("a broken project degrades to a stated failure rather than throwing", async () => {
  for (const path of ["/v2/attention", "/v2/work", "/v2/proof", "/v2/overview"]) {
    const reply = await dispatchApi("/no/such/directory/at/all", path);
    assert.ok(reply.status >= 200, `${path} returned a status rather than throwing`);
    assert.ok(reply.body !== undefined);
  }
});

test("a work item id containing colons survives the path round trip", async () => {
  const dir = repo();
  const id = capture({ projectDir: dir, type: "proposal", title: "Colons", body: "B", paths: [] }).packet!.id;
  assert.ok(id.includes(":"), "the fixture must actually exercise the encoding");
  const reply = await dispatchApi(dir, `/v2/work/${encodeURIComponent(id)}`);
  assert.equal(reply.status, 200);
  assert.equal((reply.body as { work_id: string }).work_id, id);
});
