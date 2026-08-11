import test from "node:test";
import assert from "node:assert/strict";

import { openVnextDatabase, type LocalDatabase } from "../storage/database.js";
import { migrateLocalDatabase } from "../storage/migrations.js";
import { KAGE_PROTOCOL_VERSION, type EvidenceEvent } from "../protocol/index.js";
import { EventStore } from "../storage/event-store.js";
import { Repository } from "../repo-model/repository.js";
import { isInjectableTrustState } from "../repo-model/types.js";
import type { ModelExtractionProvider } from "./model-provider.js";
import {
  Pipeline,
  REPOSITORY_COMPILER_NAME,
  computeModelLag,
  latestCompiledAt,
} from "./pipeline.js";

function migratedDatabase(): LocalDatabase {
  const db = openVnextDatabase(":memory:");
  migrateLocalDatabase(db);
  return db;
}

// `time` is minutes from an arbitrary epoch, matching the episode-builder tests.
function event(
  type: EvidenceEvent["event_type"],
  time: number,
  payload: Record<string, unknown> = {},
  repository = "repo-1",
  task = "task-1",
): EvidenceEvent {
  return {
    protocol_version: KAGE_PROTOCOL_VERSION,
    event_id: `${repository}-${task}-${type}-${time}`,
    event_type: type,
    occurred_at: new Date(time * 60_000).toISOString(),
    repository_id: repository,
    task_id: task,
    privacy_class: "local_raw",
    source_fingerprint: `fp-${repository}-${task}-${type}-${time}`,
    payload,
  };
}

// A debugging episode (a resolved failure) for repo-1: it yields at least one claim candidate.
function seedDebuggingEpisode(events: EventStore): void {
  for (const e of [
    event("prompt", 0),
    event("file_edit", 10, { path: "src/auth.ts" }),
    event("tool_result", 20, { command: "npm test", exit_code: 1 }),
    event("file_edit", 30, { path: "src/auth.ts" }),
    event("tool_result", 40, { command: "npm test", exit_code: 0 }),
    event("session_end", 50),
  ]) {
    events.append(e);
  }
}

function fixturePipeline(): Pipeline {
  const db = migratedDatabase();
  const events = new EventStore(db);
  const model = new Repository(db);
  seedDebuggingEpisode(events);
  return new Pipeline({ model, events });
}

test("the compiler produces at least one claim from real events", async () => {
  const pipeline = fixturePipeline();
  const result = await pipeline.run("repo-1");
  assert.ok(result.episodes >= 1, "at least one episode");
  assert.ok(pipeline.model.countClaims() >= 1, "at least one claim");
});

test("compiler checkpoint makes replay idempotent", async () => {
  const pipeline = fixturePipeline();
  await pipeline.run("repo-1");
  const first = pipeline.model.countClaims();
  assert.ok(first >= 1);
  await pipeline.run("repo-1");
  assert.equal(pipeline.model.countClaims(), first);
});

test("the pipeline advances a checkpoint and reports zero lag once caught up", async () => {
  const db = migratedDatabase();
  const events = new EventStore(db);
  const model = new Repository(db);
  seedDebuggingEpisode(events);
  const pipeline = new Pipeline({ model, events });

  assert.equal(latestCompiledAt(db), null, "nothing compiled yet");
  assert.ok(computeModelLag(db) >= 1, "events are lagging before the first run");

  await pipeline.run("repo-1");

  const checkpoint = model.getCheckpoint(REPOSITORY_COMPILER_NAME, "repo-1");
  assert.ok(checkpoint, "a checkpoint exists after a run");
  assert.notEqual(checkpoint!.last_event_id, null);
  assert.equal(computeModelLag(db), 0, "no events lag once compiled");
  assert.notEqual(latestCompiledAt(db), null, "a compiled-at timestamp is exposed");
});

test("a shadow-mode compile never emits an injectable claim it cannot ground", async () => {
  // Without a repository snapshot, an ad-hoc command is a real observation but nothing in the repo
  // declares it — so every claim it yields must stay non-injectable (proposed), never verified.
  const pipeline = fixturePipeline();
  await pipeline.run("repo-1");
  const injectable = pipeline.model
    .listEntities("repo-1")
    .flatMap((entity) => pipeline.model.claimsForEntity(entity.entity_id))
    .filter((claim) => isInjectableTrustState(claim.trust_state));
  assert.equal(injectable.length, 0, "no claim is injectable without ground-truth backing");
});

test("running an empty repository is a no-op that fabricates nothing", async () => {
  const db = migratedDatabase();
  const events = new EventStore(db);
  const model = new Repository(db);
  const pipeline = new Pipeline({ model, events });
  const result = await pipeline.run("repo-1");
  assert.equal(result.episodes, 0);
  assert.equal(model.countClaims(), 0);
  // An empty run reports honest zero lag and a null checkpoint cursor (never a fabricated event id).
  const checkpoint = model.getCheckpoint(REPOSITORY_COMPILER_NAME, "repo-1");
  assert.equal(checkpoint?.last_event_id ?? null, null);
});

// ── The semantic pass, wired ────────────────────────────────────────────────
// The deterministic extractors see shapes (a command failed, then passed). They cannot see
// WHY a change was made. The model pass proposes that — and must land in the same admission
// path as everything else, never a side channel.

function seededEvents(repositoryId: string): EvidenceEvent[] {
  const base = {
    protocol_version: KAGE_PROTOCOL_VERSION,
    repository_id: repositoryId,
    task_id: "task-sem-1",
    privacy_class: "team_metadata" as const,
  };
  return [
    { ...base, event_id: "ev-sem-1", event_type: "session_start" as const, occurred_at: "2026-07-28T00:00:00.000Z", source_fingerprint: "fp-1", payload: {} },
    { ...base, event_id: "ev-sem-2", event_type: "tool_result" as const, occurred_at: "2026-07-28T00:01:00.000Z", source_fingerprint: "fp-2", payload: { tool: "Bash", command: "npm test", exit_code: 1 } },
    { ...base, event_id: "ev-sem-3", event_type: "tool_result" as const, occurred_at: "2026-07-28T00:02:00.000Z", source_fingerprint: "fp-3", payload: { tool: "Bash", command: "npm test", exit_code: 0 } },
    { ...base, event_id: "ev-sem-4", event_type: "session_end" as const, occurred_at: "2026-07-28T00:03:00.000Z", source_fingerprint: "fp-4", payload: {} },
  ];
}

function fakeProvider(response: unknown): ModelExtractionProvider {
  return {
    provider_id: "fake",
    extract: async () => ({ response, input_tokens: 10, output_tokens: 5, cost_usd: null }),
  };
}

test("the semantic pass contributes candidates through the same admission path", async () => {
  const db = migratedDatabase();
  const model = new Repository(db);
  const events = new EventStore(db);
  const repositoryId = "repository:sem";
  for (const event of seededEvents(repositoryId)) events.append(event);

  const withoutModel = await new Pipeline({ model, events }).run(repositoryId);

  const db2 = migratedDatabase();
  const model2 = new Repository(db2);
  const events2 = new EventStore(db2);
  for (const event of seededEvents(repositoryId)) events2.append(event);

  const withModel = await new Pipeline({
    model: model2,
    events: events2,
    modelProvider: fakeProvider({
      entities: [{ kind: "component", name: "Retry policy", evidence_event_ids: ["ev-sem-3"] }],
      claims: [{
        entity_name: "Retry policy",
        claim_kind: "rationale",
        content: "The retry limit stays at 3 because the vendor rate-limits above that.",
        evidence_event_ids: ["ev-sem-3"],
        impact_class: "medium",
      }],
    }),
    modelPolicy: { mode: "local" },
  }).run(repositoryId);

  // The model added something the deterministic extractors could not see.
  assert.ok(
    withModel.candidates > withoutModel.candidates,
    `expected the model pass to add candidates (${withoutModel.candidates} -> ${withModel.candidates})`,
  );

  // And whatever it proposed is NOT injectable: a model is a source of hypotheses, and the
  // store's own gate is the only thing that can make a claim readable by an agent.
  for (const entity of model2.listEntities(repositoryId)) {
    for (const claim of model2.claimsForEntity(entity.entity_id)) {
      if (claim.normalized_content.includes("vendor rate-limits")) {
        assert.equal(isInjectableTrustState(claim.trust_state), false, "a model proposal must never be born injectable");
      }
    }
  }
});

test("a provider that throws leaves the deterministic pipeline intact", async () => {
  const db = migratedDatabase();
  const model = new Repository(db);
  const events = new EventStore(db);
  const repositoryId = "repository:sem-fail";
  for (const event of seededEvents(repositoryId)) events.append(event);

  const result = await new Pipeline({
    model,
    events,
    modelProvider: { provider_id: "broken", extract: async () => { throw new Error("upstream down"); } },
    modelPolicy: { mode: "local" },
  }).run(repositoryId);

  // Fail-open: the run completes and the deterministic claims are still there.
  assert.ok(result.episodes > 0, "episodes still compiled despite the model failure");
});
