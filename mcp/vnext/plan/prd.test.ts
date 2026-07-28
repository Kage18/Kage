import test from "node:test";
import assert from "node:assert/strict";

import { draftPrd, buildPrdPrompt, type DraftPrdInput } from "./prd.js";
import type { ModelExtractionProvider } from "../compiler/model-provider.js";

function input(overrides: Partial<DraftPrdInput> = {}): DraftPrdInput {
  return {
    title: "Make tenantLimit configurable",
    intent: "Let each tenant tune their own limit",
    blast_paths: ["src/limits.ts", "src/settings.tsx"],
    bearing_memory: [{ title: "tenantLimit is 10 because the billing tier caps it" }],
    ...overrides,
  };
}

/** A provider that returns whatever text the test wants, through the real code path. */
function providerReturning(text: string): ModelExtractionProvider {
  return {
    provider_id: "test",
    async extract() {
      return { raw_text: text } as unknown as Awaited<ReturnType<ModelExtractionProvider["extract"]>>;
    },
  } as ModelExtractionProvider;
}

test("a grounded draft comes back with an outcome and checkable acceptance", async () => {
  const result = await draftPrd(
    input(),
    providerReturning(JSON.stringify({
      outcome: "Each tenant can set their own limit from settings.",
      acceptance: ["A tenant can change the limit", "The change is visible without a restart"],
      cited_paths: ["src/limits.ts"],
    })),
  );
  assert.equal(result.ok, true);
  assert.match(result.draft!.outcome, /own limit/);
  assert.equal(result.draft!.acceptance.length, 2);
  assert.deepEqual(result.draft!.cited_paths, ["src/limits.ts"]);
  assert.deepEqual(result.rejected_paths, []);
});

// THE rule. A model that invents a file has invented work, and a plan citing a file nobody
// chose is how an agent ends up editing something no one agreed to touch.
test("a path outside the blast set is dropped AND reported, never silently trimmed", async () => {
  const result = await draftPrd(
    input(),
    providerReturning(JSON.stringify({
      outcome: "Configurable limits.",
      acceptance: ["It works"],
      cited_paths: ["src/limits.ts", "src/billing/invoice.ts", "infra/terraform/main.tf"],
    })),
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.draft!.cited_paths, ["src/limits.ts"], "only grounded paths survive");
  assert.deepEqual(
    result.rejected_paths,
    ["src/billing/invoice.ts", "infra/terraform/main.tf"],
    "the caller must be able to see the model reached outside its grounding",
  );
});

test("a preamble before the JSON is not a failure", async () => {
  const result = await draftPrd(
    input(),
    providerReturning('Sure! Here is the draft:\n\n{"outcome":"Limits are configurable.","acceptance":[],"cited_paths":[]}\n\nHope that helps.'),
  );
  assert.equal(result.ok, true);
  assert.match(result.draft!.outcome, /configurable/);
});

// A refusal is a RESULT. The deterministic item stands; only the prose is absent.
test("no provider is a stated absence, not an error", async () => {
  const result = await draftPrd(input(), null);
  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
  assert.match(result.reason ?? "", /no model provider/);
});

test("an ungrounded item is refused, because nothing could constrain the draft", async () => {
  const result = await draftPrd(input({ blast_paths: [] }), providerReturning("{}"));
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /not grounded/);
});

test("an unusable reply yields no draft rather than a fabricated one", async () => {
  for (const text of ["", "I cannot help with that", "{ not json", JSON.stringify({ acceptance: [] })]) {
    const result = await draftPrd(input(), providerReturning(text));
    assert.equal(result.ok, false, `"${text.slice(0, 20)}" must not produce a draft`);
    assert.equal(result.draft, null);
  }
});

test("a provider that throws is caught and named, never allowed to break the plan", async () => {
  const exploding: ModelExtractionProvider = {
    provider_id: "boom",
    async extract() {
      throw new Error("no upstream credentials observed yet");
    },
  } as ModelExtractionProvider;
  const result = await draftPrd(input(), exploding);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /no upstream credentials/);
});

// The prompt carries titles and paths, never file CONTENTS: a planning draft does not need the
// source, and sending it would push repository code through the loopback for a paragraph.
test("the prompt lists the grounded files and sends no file contents", () => {
  const prompt = buildPrdPrompt(input());
  assert.match(prompt, /src\/limits\.ts/);
  assert.match(prompt, /ONLY these/);
  assert.match(prompt, /tenantLimit is 10 because/, "what the team knows is included");
  assert.equal(/export const|function |import /.test(prompt), false, "no source code is sent");
});
