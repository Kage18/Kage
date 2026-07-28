// The proxy-loopback model provider — the concrete provider the extraction seam was built
// for, and the reason Kage can be AI-powered while holding no API key of its own.
//
// Kage already sits between the agent and the model. When a request passes through, the
// proxy remembers ONLY the credential headers, in memory, for the life of the process. The
// compiler then borrows that same credential to ask the user's own model one narrow
// question about an episode. Consequences that make this defensible:
//
//   - No key custody. Nothing is read from disk, written to disk, or logged. `forgetUpstreamCredentials`
//     clears it, and a restart clears it by construction.
//   - No new bill. The call bills the user's existing account, on their existing plan.
//   - No new trust surface. It reaches exactly the upstream the user was already talking to.
//
// What crosses the wire is the REDACTED summary `model-extractor.ts` builds — never a
// transcript, never tool output, never a secret. The response is a proposal that the
// extractor validates against an evidence-id allowlist and floors to `proposed`.

import type { ModelExtractionProvider, ModelExtractionRequest } from "./model-provider.js";

// The only headers worth keeping: what authenticates the call and what versions the API.
// Everything else a client sends (user-agent, cookies, request ids, telemetry) identifies the
// user's session and is dropped at the door rather than filtered later.
export const AUTH_HEADER_ALLOWLIST: ReadonlySet<string> = new Set([
  "authorization",
  "x-api-key",
  "anthropic-version",
  "anthropic-beta",
  "openai-organization",
]);

export interface UpstreamCredentials {
  upstream: URL;
  headers: Record<string, string>;
  model: string;
}

// Process-lifetime memory only. Deliberately a module-level binding and not a file, a cache
// directory, or an environment variable — there must be no path by which this outlives the
// process that observed it.
let borrowed: UpstreamCredentials | null = null;

export function rememberUpstreamCredentials(input: UpstreamCredentials): void {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.headers)) {
    const lower = key.toLowerCase();
    if (AUTH_HEADER_ALLOWLIST.has(lower) && typeof value === "string" && value.length) {
      headers[lower] = value;
    }
  }
  borrowed = { upstream: input.upstream, headers, model: input.model };
}

export function currentUpstreamCredentials(): UpstreamCredentials | null {
  return borrowed;
}

export function forgetUpstreamCredentials(): void {
  borrowed = null;
}

interface FetchLikeResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<FetchLikeResponse>;

// One instruction, one shape. The model is asked for a proposal in a fixed JSON form; anything
// it invents beyond the allowlists is discarded downstream by the extractor's validator, so the
// prompt does not need to be defensive — it needs to be narrow.
function buildPrompt(request: ModelExtractionRequest): string {
  return [
    "You are reading a redacted summary of one development episode in a repository.",
    "Propose ONLY durable knowledge a future engineer or agent could not derive by reading the code:",
    "decisions and their reasons, gotchas, constraints, and runbook steps.",
    "",
    "Rules:",
    `- Cite evidence only from these ids: ${request.allowed_event_ids.join(", ") || "(none)"}`,
    `- Use only these entity kinds: ${request.allowed_entity_kinds.join(", ")}`,
    `- Propose at most ${request.max_candidates} claims.`,
    "- If the episode contains nothing durable, return empty arrays. That is a valid, expected answer.",
    "",
    'Reply with JSON only: {"entities":[{"kind":"","name":"","evidence_event_ids":[]}],',
    '"claims":[{"entity_name":"","claim_kind":"","content":"","evidence_event_ids":[],"impact_class":"low"}]}',
    "",
    "Episode summary:",
    request.redacted_summary,
  ].join("\n");
}

// Pull the assistant's text out of an Anthropic-shaped response, then parse it as JSON. A
// model that wraps JSON in prose or a fence still parses; one that returns nothing usable
// yields null and the extractor records a fail-open receipt.
function parseModelJson(raw: unknown): unknown {
  const body = raw as { content?: Array<{ type?: string; text?: string }> };
  const text = (body?.content ?? [])
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("");
  if (!text.trim()) return null;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

export function createProxyLoopbackProvider(options: {
  fetchImpl?: FetchLike;
  credentials?: () => UpstreamCredentials | null;
  maxOutputTokens?: number;
} = {}): ModelExtractionProvider {
  const readCredentials = options.credentials ?? currentUpstreamCredentials;
  const doFetch: FetchLike = options.fetchImpl
    ?? (async (url, init) => (await fetch(url, init)) as unknown as FetchLikeResponse);

  return {
    provider_id: "kage-proxy-loopback",
    async extract(request) {
      const credentials = readCredentials();
      if (!credentials) {
        // Nothing has passed through the proxy yet, so there is no credential to borrow.
        // Refusing loudly is right: silently returning "no knowledge here" would be
        // indistinguishable from a genuinely empty episode.
        throw new Error(
          "no upstream credentials observed yet — run an agent through `kage up` so the loopback has a model to borrow",
        );
      }

      const response = await doFetch(new URL("/v1/messages", credentials.upstream).toString(), {
        method: "POST",
        headers: { ...credentials.headers, "content-type": "application/json" },
        body: JSON.stringify({
          model: credentials.model,
          max_tokens: options.maxOutputTokens ?? 1024,
          messages: [{ role: "user", content: buildPrompt(request) }],
        }),
      });
      if (!response.ok) throw new Error("upstream refused the extraction request");

      const raw = await response.json();
      const usage = (raw as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
      return {
        response: parseModelJson(raw),
        input_tokens: typeof usage?.input_tokens === "number" ? usage.input_tokens : null,
        output_tokens: typeof usage?.output_tokens === "number" ? usage.output_tokens : null,
        // The loopback measures tokens, not price: it does not know the user's plan or rate.
        // Null is the honest answer; a computed zero would be a lie.
        cost_usd: null,
      };
    },
  };
}
