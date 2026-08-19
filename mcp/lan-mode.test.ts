// Tests for LAN mode: reaching the daemon from a phone on the local network without
// opening a hole. Extends guard.ts's Host/Origin/token model with a LAN-only path that
// requires a pairing secret on every request — reads included — while every existing
// loopback assertion in guard.test.ts keeps holding true, unchanged, when LAN mode is off.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { guardRequest, lanOrigins, loopbackOrigins, type GuardContext } from "./delegation/guard.js";
import { lanAddresses, lanPairingMessage, provisionPairingSecret } from "./daemon.js";

const PORT = 3111;
const TOKEN = "a".repeat(64);
const LAN_SECRET = "b".repeat(64);
// A fictitious LAN address (not this machine's real one) so the test does not depend on
// whatever network the CI box happens to be on.
const LAN_HOST = "10.20.30.40";

function request(overrides: Partial<{ method: string; headers: Record<string, string>; pathname: string }> = {}) {
  return {
    method: overrides.method ?? "GET",
    headers: { host: `127.0.0.1:${PORT}`, ...(overrides.headers ?? {}) },
    pathname: overrides.pathname ?? "/runs",
  };
}

const LOOPBACK_ONLY: GuardContext = { allowedOrigins: loopbackOrigins(PORT), token: TOKEN };
const LAN_ENABLED: GuardContext = {
  allowedOrigins: [...loopbackOrigins(PORT), ...lanOrigins([LAN_HOST], PORT)],
  token: TOKEN,
  lanHosts: new Set([LAN_HOST]),
  lanToken: LAN_SECRET,
};

test("default path (LAN mode off) matches the pre-LAN guard exactly: reads open, mutations need the daemon token, foreign hosts refused", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(guardRequest(request({ method }), LOOPBACK_ONLY).ok, true, `${method} should not need a token`);
  }
  const noToken = guardRequest(request({ method: "POST" }), LOOPBACK_ONLY);
  assert.equal(noToken.ok, false);
  assert.equal(noToken.status, 401);

  const withToken = guardRequest(request({ method: "POST", headers: { authorization: `Bearer ${TOKEN}` } }), LOOPBACK_ONLY);
  assert.equal(withToken.ok, true);

  const rebind = guardRequest(request({ headers: { host: "kage.attacker.example" } }), LOOPBACK_ONLY);
  assert.equal(rebind.ok, false);
  assert.equal(rebind.status, 403);
});

test("a LAN address is refused when no LAN context is configured — LAN mode off means no LAN path exists", () => {
  const verdict = guardRequest(request({ headers: { host: `${LAN_HOST}:${PORT}` } }), LOOPBACK_ONLY);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, 403);
  assert.match(verdict.reason ?? "", /loopback only/);
});

test("LAN mode on: the configured LAN host with the pairing secret succeeds — the case that breaks if this change is reverted", () => {
  const ok = guardRequest(
    request({ headers: { host: `${LAN_HOST}:${PORT}`, authorization: `Bearer ${LAN_SECRET}` } }),
    LAN_ENABLED,
  );
  assert.equal(ok.ok, true);

  // LAN mode does not carve out an unauthenticated read path the way loopback does —
  // the secret is required on every method, GET included.
  const readNoSecret = guardRequest(request({ headers: { host: `${LAN_HOST}:${PORT}` } }), LAN_ENABLED);
  assert.equal(readNoSecret.ok, false);
  assert.equal(readNoSecret.status, 401);
  assert.match(readNoSecret.reason ?? "", /pairing secret/);

  const wrongSecret = guardRequest(
    request({ headers: { host: `${LAN_HOST}:${PORT}`, authorization: `Bearer ${"c".repeat(64)}` } }),
    LAN_ENABLED,
  );
  assert.equal(wrongSecret.ok, false);
  assert.equal(wrongSecret.status, 401);
});

test("a foreign Host is refused whether LAN mode is off or on — widening to 'any host' would reopen DNS rebinding", () => {
  const foreignHeaders = { host: "kage.attacker.example", authorization: `Bearer ${LAN_SECRET}` };
  const off = guardRequest(request({ headers: foreignHeaders }), LOOPBACK_ONLY);
  assert.equal(off.ok, false);
  assert.equal(off.status, 403);

  const on = guardRequest(request({ headers: foreignHeaders }), LAN_ENABLED);
  assert.equal(on.ok, false);
  assert.equal(on.status, 403);
});

test("the loopback token and LAN pairing secret are separate credentials — neither substitutes for the other", () => {
  assert.equal(guardRequest(request(), LAN_ENABLED).ok, true);

  const noToken = guardRequest(request({ method: "POST" }), LAN_ENABLED);
  assert.equal(noToken.ok, false);
  assert.equal(noToken.status, 401);

  const withDaemonToken = guardRequest(
    request({ method: "POST", headers: { authorization: `Bearer ${TOKEN}` } }),
    LAN_ENABLED,
  );
  assert.equal(withDaemonToken.ok, true);

  const lanSecretOnLoopback = guardRequest(
    request({ method: "POST", headers: { authorization: `Bearer ${LAN_SECRET}` } }),
    LAN_ENABLED,
  );
  assert.equal(lanSecretOnLoopback.ok, false, "the LAN pairing secret must not work as the loopback mutation token");

  const daemonTokenOnLan = guardRequest(
    request({ headers: { host: `${LAN_HOST}:${PORT}`, authorization: `Bearer ${TOKEN}` } }),
    LAN_ENABLED,
  );
  assert.equal(daemonTokenOnLan.ok, false, "the loopback daemon token must not work as the LAN pairing secret");
  assert.equal(daemonTokenOnLan.status, 401);
});

test("refusal reasons never echo the pairing secret back", () => {
  const wrongSecret = guardRequest(
    request({ headers: { host: `${LAN_HOST}:${PORT}`, authorization: `Bearer ${"c".repeat(64)}` } }),
    LAN_ENABLED,
  );
  assert.equal((wrongSecret.reason ?? "").includes(LAN_SECRET), false);

  const noSecret = guardRequest(request({ headers: { host: `${LAN_HOST}:${PORT}` } }), LAN_ENABLED);
  assert.equal((noSecret.reason ?? "").includes(LAN_SECRET), false);
});

function startGuardedServer(context: GuardContext): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const verdict = guardRequest(
      { method: req.method ?? "GET", headers: req.headers as Record<string, string | string[] | undefined>, pathname: url.pathname },
      context,
    );
    if (!verdict.ok) {
      res.writeHead(verdict.status, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: verdict.reason }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  return new Promise((resolveListen) => {
    server.listen(0, "127.0.0.1", () => resolveListen({ server, port: (server.address() as AddressInfo).port }));
  });
}

/**
 * Sends a real socket request to loopback while claiming an arbitrary Host header — the
 * exact shape of a DNS-rebinding request, and the only way to test it: the global `fetch`
 * treats Host as a forbidden header and silently overwrites it with the real one, so it
 * cannot exercise this path at all.
 */
function rawRequest(port: number, path: string, headers: Record<string, string>): Promise<{ status: number }> {
  return new Promise((resolveRequest, rejectRequest) => {
    const req = httpRequest({ host: "127.0.0.1", port, path, method: "GET", headers }, (res) => {
      res.resume();
      res.on("end", () => resolveRequest({ status: res.statusCode ?? 0 }));
    });
    req.on("error", rejectRequest);
    req.end();
  });
}

test("end-to-end over real sockets: the pairing secret grants LAN access and nothing the daemon logs contains it", async () => {
  const context: GuardContext = {
    allowedOrigins: [],
    token: TOKEN,
    lanHosts: new Set([LAN_HOST]),
    lanToken: LAN_SECRET,
  };
  const { server, port } = await startGuardedServer(context);
  const logs: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  try {
    const withSecret = await rawRequest(port, "/health", { host: `${LAN_HOST}:${port}`, authorization: `Bearer ${LAN_SECRET}` });
    assert.equal(withSecret.status, 200);

    const withoutSecret = await rawRequest(port, "/health", { host: `${LAN_HOST}:${port}` });
    assert.equal(withoutSecret.status, 401);

    const wrongSecret = await rawRequest(port, "/health", { host: `${LAN_HOST}:${port}`, authorization: `Bearer ${"c".repeat(64)}` });
    assert.equal(wrongSecret.status, 401);

    // Physically connecting to loopback while claiming to be a foreign host is exactly
    // the DNS-rebinding shape — still refused, secret or no secret.
    const foreignHost = await rawRequest(port, "/health", { host: "kage.attacker.example", authorization: `Bearer ${LAN_SECRET}` });
    assert.equal(foreignHost.status, 403);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    server.close();
  }
  for (const line of logs) {
    assert.equal(line.includes(LAN_SECRET), false, `a log line leaked the pairing secret: ${line}`);
  }
});

test("provisionPairingSecret persists a 64-hex secret with 0600 permissions and reuses it across calls", () => {
  const project = mkdtempSync(join(tmpdir(), "kage-lan-"));
  const first = provisionPairingSecret(project);
  assert.equal(first.length, 64);
  assert.match(first, /^[0-9a-f]{64}$/);

  // Unlike the daemon token (regenerated every start), the pairing secret must survive a
  // restart or a phone that already paired would be locked out every time the daemon
  // relaunches.
  const second = provisionPairingSecret(project);
  assert.equal(second, first);

  const path = join(project, ".agent_memory", "daemon", "lan-secret");
  const mode = statSync(path).mode & 0o777;
  assert.equal(mode, 0o600);
  assert.equal(readFileSync(path, "utf8").trim(), first);
});

test("lanPairingMessage prints exactly what a phone needs, and a clear line when there is nowhere to point it", () => {
  const message = lanPairingMessage(["192.168.1.5"], 3111, LAN_SECRET);
  assert.match(message, /192\.168\.1\.5:3111/);
  assert.match(message, new RegExp(LAN_SECRET));
  assert.match(message, /opens a port on your local network/);

  const empty = lanPairingMessage([], 3111, LAN_SECRET);
  assert.equal(empty.includes(LAN_SECRET), false);
  assert.match(empty, /no local network address/);
});

test("lanAddresses never reports loopback as a LAN address", () => {
  const addresses = lanAddresses();
  assert.ok(Array.isArray(addresses));
  for (const address of addresses) {
    assert.notEqual(address, "127.0.0.1");
    assert.notEqual(address, "::1");
  }
});
