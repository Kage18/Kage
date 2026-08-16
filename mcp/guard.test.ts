import test from "node:test";
import assert from "node:assert/strict";
import { bearerToken, guardRequest, isLoopbackHost, loopbackOrigins, makeToken, safeEqual } from "./delegation/guard.js";

const TOKEN = "a".repeat(64);
const CONTEXT = { allowedOrigins: loopbackOrigins(3111), token: TOKEN };

function request(overrides: Partial<{ method: string; headers: Record<string, string>; pathname: string }> = {}) {
  return {
    method: overrides.method ?? "GET",
    headers: { host: "127.0.0.1:3111", ...(overrides.headers ?? {}) },
    pathname: overrides.pathname ?? "/runs",
  };
}

test("loopback hosts are recognised, anything else is not", () => {
  assert.equal(isLoopbackHost("127.0.0.1:3111"), true);
  assert.equal(isLoopbackHost("localhost:3113"), true);
  assert.equal(isLoopbackHost("[::1]:3111"), true);
  assert.equal(isLoopbackHost("evil.example.com"), false);
  assert.equal(isLoopbackHost("192.168.1.10:3111"), false);
  assert.equal(isLoopbackHost(""), false);
});

test("a DNS-rebinding request is refused even though the packet is local", () => {
  // The attacker's hostname resolves to 127.0.0.1, so the connection really does arrive
  // here — the Host header is the only thing that gives the trick away.
  const verdict = guardRequest(request({ headers: { host: "kage.attacker.example" } }), CONTEXT);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, 403);
  assert.match(verdict.reason ?? "", /loopback only/);
});

test("a cross-site request is refused; same-origin and header-less clients pass", () => {
  const foreign = guardRequest(request({ headers: { origin: "https://evil.example" } }), CONTEXT);
  assert.equal(foreign.ok, false);
  assert.equal(foreign.status, 403);
  assert.match(foreign.reason ?? "", /evil\.example/);

  // Our own page.
  assert.equal(guardRequest(request({ headers: { origin: "http://127.0.0.1:3111" } }), CONTEXT).ok, true);
  // curl / the CLI / the desktop shell send no Origin at all.
  assert.equal(guardRequest(request(), CONTEXT).ok, true);
});

test("mutating routes require the token; reads do not", () => {
  // This is the case that matters: without it, any open web page could POST a dispatch.
  const noToken = guardRequest(request({ method: "POST" }), CONTEXT);
  assert.equal(noToken.ok, false);
  assert.equal(noToken.status, 401);
  assert.match(noToken.reason ?? "", /requires the daemon token/);

  const wrongToken = guardRequest(request({ method: "POST", headers: { authorization: `Bearer ${"b".repeat(64)}` } }), CONTEXT);
  assert.equal(wrongToken.ok, false);
  assert.equal(wrongToken.status, 401);

  assert.equal(guardRequest(request({ method: "POST", headers: { authorization: `Bearer ${TOKEN}` } }), CONTEXT).ok, true);
  assert.equal(guardRequest(request({ method: "POST", headers: { "x-kage-token": TOKEN } }), CONTEXT).ok, true);
  assert.equal(guardRequest(request({ method: "DELETE", headers: { "x-kage-token": TOKEN } }), CONTEXT).ok, true);

  // Reads stay open so the board and `kage status` work without ceremony.
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(guardRequest(request({ method }), CONTEXT).ok, true, `${method} should not need a token`);
  }
});

test("a daemon with no provisioned token refuses to mutate at all", () => {
  const verdict = guardRequest(request({ method: "POST", headers: { "x-kage-token": TOKEN } }), { ...CONTEXT, token: "" });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, 503);
});

test("token extraction and comparison", () => {
  assert.equal(bearerToken(request({ headers: { authorization: "Bearer abc" } })), "abc");
  assert.equal(bearerToken(request({ headers: { authorization: "bearer abc" } })), "abc");
  assert.equal(bearerToken(request({ headers: { "x-kage-token": "xyz" } })), "xyz");
  assert.equal(bearerToken(request()), "");

  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "ab"), false);

  const token = makeToken();
  assert.equal(token.length, 64);
  assert.notEqual(token, makeToken());
});
