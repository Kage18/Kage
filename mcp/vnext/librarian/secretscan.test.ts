import test from "node:test";
import assert from "node:assert/strict";

import { scanForSecrets } from "./secretscan.js";

// False positives are acceptable here in a way false negatives are not: a blocked card can be
// rephrased in a minute; a synced secret cannot be unsynced.
test("real secret shapes are caught", () => {
  const cases: Array<[string, string]> = [
    ["AKIAIOSFODNN7EXAMPLE", "aws access key"],
    ["sk-ant-api03-abcdefghijklmnopqrstuvwx", "anthropic/openai-style key"],
    [`ghp_${"a".repeat(36)}`, "github token"],
    ["xoxb-1234567890-abcdefghij", "slack token"],
    ["-----BEGIN RSA PRIVATE KEY-----", "private key block"],
    [`Authorization: Bearer ${"Ab3".repeat(10)}`, "bearer token"],
    ['const apiKey = "aVeryLongOpaqueSecretValue123"', "credential assignment"],
  ];
  for (const [text, expected] of cases) {
    assert.ok(scanForSecrets(text).includes(expected), `${expected} in ${text.slice(0, 40)}`);
  }
});

test("ordinary engineering claims pass clean", () => {
  const claims = [
    "withinLimit uses < rather than <= so a tenant at exactly the limit is refused.",
    "The proxy appends memory to the last user turn, never the system prompt.",
    "Set KAGE_STORE_DIR to relocate the store in tests.",
    "the token count is measured by nobody here, so it stays null",
    "password validation lives in auth/validate.ts",
  ];
  for (const claim of claims) {
    assert.deepEqual(scanForSecrets(claim), [], claim);
  }
});
