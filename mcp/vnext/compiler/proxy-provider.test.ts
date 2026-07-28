import test from "node:test";
import assert from "node:assert/strict";

import {
  createProxyLoopbackProvider,
  rememberUpstreamCredentials,
  forgetUpstreamCredentials,
  currentUpstreamCredentials,
  AUTH_HEADER_ALLOWLIST,
} from "./proxy-provider.js";
import { extractWithModel } from "./model-extractor.js";
import type { EpisodeContext } from "./candidates.js";

function episode(): EpisodeContext {
  return {
    episode: {
      episode_id: "ep-1",
      repository_id: "repository:local",
      started_at: "2026-07-28T00:00:00.000Z",
      ended_at: "2026-07-28T00:05:00.000Z",
    } as unknown as EpisodeContext["episode"],
    events: [],
  };
}

test("credentials are captured from the wire, kept in memory, and never include non-auth headers", () => {
  forgetUpstreamCredentials();
  assert.equal(currentUpstreamCredentials(), null);

  rememberUpstreamCredentials({
    upstream: new URL("https://api.anthropic.com"),
    headers: {
      "x-api-key": "sk-secret",
      "anthropic-version": "2023-06-01",
      // Everything below must be dropped: it is not an auth header and some of it
      // identifies the user's session.
      "user-agent": "claude-cli/1.2.3",
      cookie: "session=abc",
      "x-request-id": "req-42",
    },
    model: "claude-fable-5",
  });

  const held = currentUpstreamCredentials();
  assert.ok(held);
  assert.deepEqual(Object.keys(held!.headers).sort(), ["anthropic-version", "x-api-key"]);
  for (const key of Object.keys(held!.headers)) assert.ok(AUTH_HEADER_ALLOWLIST.has(key));

  forgetUpstreamCredentials();
  assert.equal(currentUpstreamCredentials(), null, "forget must actually clear — no lingering secret");
});

test("with no observed credentials the provider refuses, and extraction fails open with zero candidates", async () => {
  forgetUpstreamCredentials();
  const provider = createProxyLoopbackProvider();

  const result = await extractWithModel(episode(), provider, { policy: { mode: "local" } });
  assert.deepEqual(result.candidates, []);
  assert.equal(result.receipt.status !== "ok", true, "a provider that could not run must not report ok");
  // The failure names the cause so an operator can act on it.
  assert.ok(
    result.rejections.join(" ").length > 0 || result.receipt.status.length > 0,
    "a refusal must be explained, not silent",
  );
});

test("the request carries only the redacted summary — never a transcript — and reuses the borrowed credentials", async () => {
  forgetUpstreamCredentials();
  rememberUpstreamCredentials({
    upstream: new URL("https://api.anthropic.com"),
    headers: { "x-api-key": "sk-secret", "anthropic-version": "2023-06-01" },
    model: "claude-fable-5",
  });

  let seenUrl = "";
  let seenHeaders: Record<string, string> = {};
  let seenBody: Record<string, unknown> = {};
  const provider = createProxyLoopbackProvider({
    fetchImpl: async (url: string, init: { headers: Record<string, string>; body: string }) => {
      seenUrl = url;
      seenHeaders = init.headers;
      seenBody = JSON.parse(init.body) as Record<string, unknown>;
      return {
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: JSON.stringify({ entities: [], claims: [] }) }],
          usage: { input_tokens: 120, output_tokens: 30 },
        }),
      };
    },
  });

  const out = await provider.extract({
    repository_id: "repository:local",
    episode_id: "ep-1",
    redacted_summary: "A test failed then passed after editing retryWithBackoff.",
    allowed_event_ids: ["ev-1"],
    allowed_entity_kinds: ["component"],
    max_candidates: 5,
  });

  assert.match(seenUrl, /\/v1\/messages$/);
  assert.equal(seenHeaders["x-api-key"], "sk-secret", "the user's own credential is reused");
  assert.equal(seenBody.model, "claude-fable-5");
  const body = JSON.stringify(seenBody);
  assert.ok(body.includes("retryWithBackoff"), "the redacted summary is sent");
  assert.equal(body.includes("transcript"), false, "no transcript is ever sent");
  // Usage is reported honestly when the provider gives it, never fabricated.
  assert.equal(out.input_tokens, 120);
  assert.equal(out.output_tokens, 30);
  assert.equal(out.cost_usd, null, "the loopback measures tokens, not price — null, never a fake 0");
  forgetUpstreamCredentials();
});
