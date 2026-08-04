import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { activateLicense, currentLicense, deactivateLicense, licensePath, runLicenseCommand } from "./storage.js";
import * as licenseModule from "./license.js";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const ISSUER = publicKey.export({ type: "spki", format: "der" }).toString("base64");
const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function issue(overrides: Record<string, unknown> = {}): string {
  const payload = {
    id: "lic_t", tier: "team", seats: 4, issued_to: "acme", issued_at: "2026-01-01T00:00:00.000Z", ...overrides,
  };
  const segment = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `kage_${segment}.${b64url(sign(null, Buffer.from(segment), privateKey))}`;
}

// The real ISSUER_PUBLIC_KEY_SPKI is a placeholder until release, so these tests point the module
// at a test issuer. Patching the exported constant keeps storage.ts free of a test-only parameter.
const original = licenseModule.ISSUER_PUBLIC_KEY_SPKI;
function withTestIssuer<T>(fn: () => T): T {
  Object.defineProperty(licenseModule, "ISSUER_PUBLIC_KEY_SPKI", { value: ISSUER, configurable: true });
  try {
    return fn();
  } finally {
    Object.defineProperty(licenseModule, "ISSUER_PUBLIC_KEY_SPKI", { value: original, configurable: true });
  }
}

const home = () => mkdtempSync(join(tmpdir(), "kage-license-"));

test("the licence lives in the home directory, never in a project", () => {
  const dir = home();
  const path = licensePath(dir);
  assert.equal(path, join(dir, ".kage", "license.key"));
  // A licence is a credential. Committing one would hand a paid entitlement to every fork.
  assert.ok(!path.includes("/.agent_memory/"), "a licence key must never live inside a repo");
});

test("no key installed is the free tier, not an error", () => {
  const state = currentLicense({ home: home() });
  assert.equal(state.status, "none");
  assert.equal(state.tier, "free");
});

test("an unreadable licence file degrades to free rather than throwing", () => {
  const dir = home();
  const path = licensePath(dir);
  mkdirSync(join(dir, ".kage"), { recursive: true });
  writeFileSync(path, "not a key at all");
  const state = currentLicense({ home: dir });
  assert.equal(state.tier, "free");
});

test("activate stores a valid key at 0600 and reports what it entitles", () => {
  withTestIssuer(() => {
    const dir = home();
    const key = issue();
    const result = activateLicense(key, { home: dir, now: new Date("2026-06-01T00:00:00.000Z") });
    assert.equal(result.ok, true);
    assert.match(result.message, /4 seats, issued to acme/);
    assert.equal(readFileSync(licensePath(dir), "utf8"), key);
    // A credential written world-readable is a bug, not a detail.
    assert.equal(statSync(licensePath(dir)).mode & 0o777, 0o600);
  });
});

// Refusing to store a bad key is the point: the customer finds out now, not in three weeks.
test("activate refuses an invalid key and writes nothing", () => {
  withTestIssuer(() => {
    const dir = home();
    const result = activateLicense("kage_garbage.notasignature", { home: dir });
    assert.equal(result.ok, false);
    assert.equal(currentLicense({ home: dir }).status, "none", "a refused key must not be persisted");
  });
});

test("activate refuses a key that is already past its grace period", () => {
  withTestIssuer(() => {
    const dir = home();
    const key = issue({ expires_at: "2026-01-01T00:00:00.000Z" });
    const result = activateLicense(key, { home: dir, now: new Date("2026-06-01T00:00:00.000Z") });
    assert.equal(result.ok, false);
    assert.match(result.message, /expired/i);
  });
});

test("deactivate is idempotent and promises the cards are untouched", () => {
  withTestIssuer(() => {
    const dir = home();
    activateLicense(issue(), { home: dir, now: new Date("2026-06-01T00:00:00.000Z") });
    const first = deactivateLicense({ home: dir });
    assert.equal(first.removed, true);
    assert.match(first.message, /stays exactly where it is/);
    const second = deactivateLicense({ home: dir });
    assert.equal(second.removed, false, "removing twice is not an error");
  });
});

test("`kage license` with nothing installed sells honestly and never calls itself a trial", () => {
  const result = runLicenseCommand([], { home: home() });
  assert.equal(result.exitCode, 0);
  assert.match(result.out, /free, and not a trial/);
  // The point is the absence of PRESSURE, not the absence of the word: a free tier that nags is
  // how you lose the distribution engine that makes the free tier worth having.
  assert.doesNotMatch(result.out, /trial (ends|expires)|expires in|upgrade now|limited time|X days left/i);
});

test("the CLI round-trips activate -> show -> deactivate", () => {
  withTestIssuer(() => {
    const dir = home();
    const now = new Date("2026-06-01T00:00:00.000Z");
    assert.equal(runLicenseCommand(["activate", issue()], { home: dir, now }).exitCode, 0);
    assert.match(runLicenseCommand([], { home: dir, now }).out, /Team licence/);
    assert.equal(runLicenseCommand(["deactivate"], { home: dir, now }).exitCode, 0);
    assert.match(runLicenseCommand([], { home: dir, now }).out, /free, and not a trial/);
  });
});

test("activate with no key argument explains itself instead of failing silently", () => {
  const result = runLicenseCommand(["activate"], { home: home() });
  assert.equal(result.exitCode, 1);
  assert.match(result.out, /Usage: kage license activate/);
});

test("an unknown subcommand prints the usage rather than guessing", () => {
  const result = runLicenseCommand(["renew"], { home: home() });
  assert.equal(result.exitCode, 1);
  assert.match(result.out, /Unknown subcommand 'renew'/);
});
