// orchestratorSpawnEnv is the shared seam both the pty spawn (room-pty.ts) and the
// headless room spawn (room-supervisor.ts) now pass their env through — see its own
// comment in room-supervisor.ts for why: claude marks every child process it spawns
// with CLAUDE_CODE_CHILD_SESSION=1, and when Kage's daemon is itself launched from
// inside such a child, that marker leaks into every `claude` the daemon spawns in turn.
// An interactive one reads the inherited marker as "do not persist my own transcript",
// which is what silently breaks Chat's has_transcript flag. Reverting orchestratorSpawnEnv
// to a passthrough (or dropping its use at either spawn site) is exactly what the first
// two tests below catch: they assert the marker is gone and the persistence flag is set,
// which only holds with the fix in place.
import test from "node:test";
import assert from "node:assert/strict";

import { orchestratorSpawnEnv } from "./delegation/room-supervisor.js";

test("orchestratorSpawnEnv deletes the inherited CLAUDE_CODE_CHILD_SESSION marker", () => {
  const env = orchestratorSpawnEnv({ CLAUDE_CODE_CHILD_SESSION: "1", PATH: "/usr/bin" });
  assert.equal("CLAUDE_CODE_CHILD_SESSION" in env, false);
});

test("orchestratorSpawnEnv always sets CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1, marker present or not", () => {
  const withMarker = orchestratorSpawnEnv({ CLAUDE_CODE_CHILD_SESSION: "1" });
  assert.equal(withMarker.CLAUDE_CODE_FORCE_SESSION_PERSISTENCE, "1");

  const withoutMarker = orchestratorSpawnEnv({ PATH: "/usr/bin" });
  assert.equal(withoutMarker.CLAUDE_CODE_FORCE_SESSION_PERSISTENCE, "1");
});

test("orchestratorSpawnEnv passes an env WITHOUT the marker through otherwise untouched — no accidental scrubbing", () => {
  const base = { PATH: "/usr/bin", HOME: "/home/kage", KAGE_PROJECT_DIR: "/repo", CUSTOM_VAR: "keep-me" };
  const env = orchestratorSpawnEnv(base);
  for (const [key, value] of Object.entries(base)) {
    assert.equal(env[key], value, `expected ${key} to pass through unchanged`);
  }
  // Only the persistence flag is added on top of the untouched input.
  assert.deepEqual(
    Object.keys(env).sort(),
    [...Object.keys(base), "CLAUDE_CODE_FORCE_SESSION_PERSISTENCE"].sort(),
  );
});

test("orchestratorSpawnEnv drops undefined-valued env entries rather than passing them through as strings", () => {
  const env = orchestratorSpawnEnv({ PATH: "/usr/bin", MAYBE_UNSET: undefined });
  assert.equal("MAYBE_UNSET" in env, false);
});
