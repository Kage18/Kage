// Mint a Kage team licence key.
//
// This is the seller's tool. It is deliberately tiny and offline: signing a licence needs one
// Ed25519 private key and no infrastructure, so there is no billing service to run, nothing to
// keep up, and no customer data held anywhere. Charge however you like — Stripe Payment Link,
// an invoice, a bank transfer — then run this and send the key.
//
// THE PRIVATE KEY NEVER ENTERS THIS REPOSITORY. --keygen writes it outside the repo at 0600 and
// prints only the public half, which is what gets compiled into license.ts. If that private key
// leaks, anyone can mint licences; if it is lost, previously issued keys keep working (they are
// already signed) but no new ones can be made. Back it up somewhere you would back up a signing
// certificate.
//
//   node scripts/issue-license.mjs --keygen
//   node scripts/issue-license.mjs --key ~/.kage-issuer/private.pem --to "Acme Eng" --seats 8 --months 12
//   node scripts/issue-license.mjs --key ... --to "Acme Eng" --seats 8 --perpetual
//   node scripts/issue-license.mjs --verify kage_xxx.yyy --pub <spki-base64>

import { generateKeyPairSync, sign, verify, createPublicKey, randomUUID } from "node:crypto";
import { writeFileSync, readFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

// ── Generate the issuing keypair ──────────────────────────────────────────────────────────────
if (has("keygen")) {
  const dir = flag("out") ?? join(homedir(), ".kage-issuer");
  const privatePath = join(dir, "private.pem");
  if (existsSync(privatePath) && !has("force")) {
    die(`${privatePath} already exists. Refusing to overwrite an issuing key — pass --force only if you are certain no licences were signed with it.`);
  }
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  chmodSync(privatePath, 0o600);
  const spki = publicKey.export({ type: "spki", format: "der" }).toString("base64");

  console.log(`
  Issuing key written to ${privatePath} (0600, outside the repo).

  BACK THIS UP. Lose it and you cannot issue new licences; leak it and anyone can.

  Now paste this public key into mcp/vnext/license/license.ts as ISSUER_PUBLIC_KEY_SPKI:

    "${spki}"

  Until you do, every licence key verifies as "free" — which is the safe default, not a crash.
`);
  process.exit(0);
}

// ── Verify a key (a support tool: "is the key I sent this customer real?") ────────────────────
if (has("verify")) {
  const key = flag("verify");
  const pub = flag("pub");
  if (!key || !pub) die("Usage: --verify <kage_key> --pub <spki-base64>");
  const [segment, signature] = key.replace(/^kage_/, "").split(".");
  if (!segment || !signature) die("Malformed key.");
  const issuer = createPublicKey({ key: Buffer.from(pub, "base64"), format: "der", type: "spki" });
  const fromB64url = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const ok = verify(null, Buffer.from(segment), issuer, fromB64url(signature));
  console.log(`\n  signature: ${ok ? "VALID" : "INVALID"}`);
  console.log(`  payload:   ${ok ? JSON.stringify(JSON.parse(fromB64url(segment).toString("utf8")), null, 2).replace(/\n/g, "\n             ") : "(not shown for an unverified key)"}\n`);
  process.exit(ok ? 0 : 1);
}

// ── Issue ─────────────────────────────────────────────────────────────────────────────────────
const keyPath = flag("key") ?? join(homedir(), ".kage-issuer", "private.pem");
const to = flag("to");
const seats = Number(flag("seats") ?? "1");
const months = flag("months") ? Number(flag("months")) : has("perpetual") ? null : 12;

if (!to) die('Who is it for? Pass --to "Acme Engineering". Run with --keygen first if you have no issuing key.');
if (!Number.isInteger(seats) || seats < 1) die("--seats must be a whole number of 1 or more.");
if (months !== null && (!Number.isInteger(months) || months < 1)) die("--months must be a whole number of 1 or more, or pass --perpetual.");
if (!existsSync(keyPath)) die(`No issuing key at ${keyPath}. Run:  node scripts/issue-license.mjs --keygen`);

const privateKey = readFileSync(keyPath, "utf8");
const issuedAt = new Date();
const expires = months === null ? null : new Date(Date.UTC(issuedAt.getUTCFullYear(), issuedAt.getUTCMonth() + months, issuedAt.getUTCDate()));

const payload = {
  id: `lic_${randomUUID().slice(0, 8)}`,
  tier: "team",
  seats,
  issued_to: to,
  issued_at: issuedAt.toISOString(),
  ...(expires ? { expires_at: expires.toISOString() } : {}),
};

const segment = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
const key = `kage_${segment}.${b64url(sign(null, Buffer.from(segment), privateKey))}`;

console.log(`
  ${payload.id} — ${to}, ${seats} seat${seats === 1 ? "" : "s"}, ${expires ? `expires ${expires.toISOString().slice(0, 10)}` : "perpetual"}

${key}

  Send that to the customer. They run:  kage license activate <key>

  It verifies offline on their machine — no account, nothing to call home to. Keep a copy: there
  is no server holding a record of what you issued, only what you keep here.
`);
