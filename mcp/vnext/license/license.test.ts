import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";

import {
  GRACE_PERIOD_DAYS,
  ISSUER_PUBLIC_KEY_SPKI,
  describeLicense,
  isEntitled,
  seatStatus,
  verifyLicense,
  type LicensePayload,
} from "./license.js";

// A throwaway issuer for the tests. The real private key never exists in this repo — it is the
// one secret the whole scheme depends on, and it lives with whoever sells the licences.
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const ISSUER = publicKey.export({ type: "spki", format: "der" }).toString("base64");
const { privateKey: otherPrivateKey } = generateKeyPairSync("ed25519");

const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function issue(payload: Partial<LicensePayload> = {}, key = privateKey): string {
  const full: LicensePayload = {
    id: "lic_test",
    tier: "team",
    seats: 5,
    issued_to: "acme engineering",
    issued_at: "2026-01-01T00:00:00.000Z",
    ...payload,
  };
  const segment = b64url(Buffer.from(JSON.stringify(full), "utf8"));
  return `kage_${segment}.${b64url(sign(null, Buffer.from(segment), key))}`;
}

const at = (iso: string) => ({ now: new Date(iso), issuerPublicKey: ISSUER });

test("a validly signed licence activates the team tier", () => {
  const state = verifyLicense(issue(), at("2026-06-01T00:00:00.000Z"));
  assert.equal(state.status, "active");
  assert.equal(state.tier, "team");
  assert.equal(state.payload?.issued_to, "acme engineering");
  assert.equal(isEntitled(state), true);
});

// THE property that matters more than any revenue: a licence problem must never cost anyone a
// card. Every failure path lands on the free tier, which is a complete product, not a crippled one.
test("every bad input degrades to the free tier and nothing throws", () => {
  const bad = [
    undefined,
    "",
    "   ",
    "not-a-key",
    "kage_",
    "kage_onlyonesegment",
    "kage_a.b.c",
    "kage_!!!.???",
    "kage_" + b64url(Buffer.from("{not json")) + "." + b64url(Buffer.from("sig")),
  ];
  for (const key of bad) {
    const state = verifyLicense(key, at("2026-06-01T00:00:00.000Z"));
    assert.equal(state.tier, "free", `${JSON.stringify(key)} must fall back to free`);
    assert.equal(isEntitled(state), false);
  }
});

test("a licence signed by anyone else does not verify", () => {
  const forged = verifyLicense(issue({}, otherPrivateKey), at("2026-06-01T00:00:00.000Z"));
  assert.equal(forged.status, "invalid");
  assert.equal(isEntitled(forged), false);
});

// The signature must cover the exact bytes that were signed. Verifying a re-serialized object is
// how a signature check silently becomes a no-op the moment key order or spacing differs.
test("editing the payload invalidates the key", () => {
  const key = verifyLicense(issue({ seats: 5 }), at("2026-06-01T00:00:00.000Z"));
  assert.equal(key.payload?.seats, 5);

  const [segment, signature] = issue({ seats: 5 }).slice("kage_".length).split(".");
  const decoded = JSON.parse(Buffer.from(segment, "base64").toString("utf8"));
  decoded.seats = 500; // a customer editing their own key
  const tampered = `kage_${b64url(Buffer.from(JSON.stringify(decoded)))}.${signature}`;

  const state = verifyLicense(tampered, at("2026-06-01T00:00:00.000Z"));
  assert.equal(state.status, "invalid");
  assert.equal(isEntitled(state), false);
});

test("a lapsed licence keeps working through the grace period, and says how long", () => {
  const key = issue({ expires_at: "2026-06-01T00:00:00.000Z" });

  const dayBefore = verifyLicense(key, at("2026-05-31T00:00:00.000Z"));
  assert.equal(dayBefore.status, "active");

  const dayAfter = verifyLicense(key, at("2026-06-02T00:00:00.000Z"));
  assert.equal(dayAfter.status, "grace");
  assert.equal(isEntitled(dayAfter), true, "grace that disables the product is not grace");
  assert.equal(dayAfter.graceDaysLeft, GRACE_PERIOD_DAYS - 1);
  assert.match(dayAfter.message ?? "", /keeps working/);
});

test("past the grace period the tier drops — and the message promises the cards are safe", () => {
  const key = issue({ expires_at: "2026-06-01T00:00:00.000Z" });
  const state = verifyLicense(key, at("2026-07-01T00:00:00.000Z"));
  assert.equal(state.status, "expired");
  assert.equal(state.tier, "free");
  assert.equal(isEntitled(state), false);
  // A memory product must say this explicitly at exactly the moment a user fears the opposite.
  assert.match(state.message ?? "", /every card you have is untouched/i);
});

test("a perpetual licence never expires", () => {
  const state = verifyLicense(issue({ expires_at: undefined }), at("2099-01-01T00:00:00.000Z"));
  assert.equal(state.status, "active");
});

// Seats are reported, never enforced. Kage has no server and no directory, so a headcount is a
// number it CANNOT verify — and acting on an unverifiable number is the one thing this product
// refuses to do anywhere else.
test("seat overage is reported and blocks nothing", () => {
  const state = verifyLicense(issue({ seats: 3 }), at("2026-06-01T00:00:00.000Z"));
  const under = seatStatus(state, 2);
  assert.equal(under.over, false);
  assert.equal(under.message, undefined);

  const over = seatStatus(state, 7);
  assert.equal(over.over, true);
  assert.equal(over.seats, 3);
  assert.equal(over.used, 7);
  assert.match(over.message ?? "", /Nothing is blocked/);
  // The entitlement is untouched by overage: the eleventh teammate is not locked out.
  assert.equal(isEntitled(state), true);
});

// An unconfigured build (no real issuer key compiled in) must behave exactly like a build for
// which no licence has been issued: free tier, silent, no crash on a machine that did nothing.
test("a build with no real issuer key runs as free rather than failing", () => {
  const state = verifyLicense(issue(), { now: new Date("2026-06-01T00:00:00.000Z"), issuerPublicKey: ISSUER_PUBLIC_KEY_SPKI });
  assert.equal(state.tier, "free");
  assert.equal(isEntitled(state), false);
});

test("the free tier describes itself as free, not as a trial that will end", () => {
  const free = describeLicense(verifyLicense(undefined, at("2026-06-01T00:00:00.000Z")));
  assert.match(free, /free, and not a trial/);
  assert.doesNotMatch(free, /trial ends|upgrade now|expires/i);

  const active = describeLicense(verifyLicense(issue({ seats: 1 }), at("2026-06-01T00:00:00.000Z")));
  assert.match(active, /1 seat\b/, "seat count is singular when it is one");
});
