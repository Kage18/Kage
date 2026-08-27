---
type: "belief"
title: "Room MCP Config and Thread Scoping"
tags: ["room", "mcp-config", "threads", "sessions", "backward-compatibility"]
snapshot_at: "2026-08-27T16:13:28.448Z"
citation_fingerprints: [{"path":".agent_memory/packets/decision-the-kage-room-1-env-var-that-gates-delegation-tool-behavior-at-the-mcp-server-pr-b5d1a436.md","sha256":"2ec72d0fca5f62966d46a56c34091dd62ac53f9df9b759c881cc7d4ef87fd832","size":19330},{"path":".agent_memory/packets/decision-room-threads-are-conversations-not-workspaces-and-the-default-thread-never-moves-712246c4.md","sha256":"1a432774de2c090b4eed012714b1fddc03ab47754e9f136e6fbb27f563f86b9c","size":11735}]
---

# Room MCP Config and Thread Scoping

**Confidence:** firm — both facts are stated directly in source comments/tests cited by the packets and are load-bearing backward-compatibility constraints, not incidental details.

The Room does not gate its delegation-tool behavior through an environment variable set by whatever shell launched the daemon; instead, `writeRoomMcpConfig` (`mcp/delegation/room.ts`) generates the MCP config's `env` block itself, embedding `KAGE_ROOM=1` directly into the config file the spawned `claude` process reads. Both manager code paths — the persistent held supervisor (`superviseRoom`) and the one-shot `askManager` fallback — go through `writeRoomMcpConfig`, so the `KAGE_ROOM===1` gate that `kage_dispatch` and other delegation tools check works identically regardless of which leg answered a given turn. This "generate the config, don't inherit the environment" approach is what makes the Room's tool-gating reliable across process-spawn boundaries. A parallel but distinct kind of per-room scoping exists one layer up, in how the Room's runtime *files* are laid out: the Room now supports several concurrent conversation threads per project (`mcp/delegation/room-sessions.ts`), and this was deliberately built to preserve the original single-thread file layout rather than migrating it. The default thread (`"main"`) keeps the historical FLAT paths — `.agent_memory/room/{history,session,supervisor,pty-supervisor}.json` — and, critically, its ORIGINAL socket digest seeds (`<dir>\0__room__` and `<dir>\0__room_pty__`, with no thread key appended); only additional threads created after the feature shipped nest their runtime state under `room/s/<key>/` with their own scoped file set. This was a conscious choice, not an oversight: a migration that half-fails was judged a worse trade than a small asymmetry between "main" and everything else, and changing "main"'s socket digest would make a live manager appear dead to an old caller on upgrade, causing a silent respawn underneath an in-progress conversation. Threads are also a narrower concept than they might look: they exist only so unrelated conversations don't share one context window — the units of actual work stay runs in worktrees, dispatched by whichever thread's manager is talking, so a run, diff, or piece of durable state hanging off a specific thread would be a bug, not a feature.

## Supporting evidence

- `.agent_memory/packets/decision-the-kage-room-1-env-var-that-gates-delegation-tool-behavior-at-the-mcp-server-pr-b5d1a436.md` — KAGE_ROOM=1 is embedded by writeRoomMcpConfig's generated config, not the spawning shell, and covers both the held supervisor and the askManager fallback identically.
- `.agent_memory/packets/decision-room-threads-are-conversations-not-workspaces-and-the-default-thread-never-moves-712246c4.md` — the flat-vs-nested file layout split between "main" and later threads, the unchanged socket digest seeds for "main", and why threads hold conversations only, never work.

## Contradictions / open questions

None found in the cited evidence. One open question the packets themselves don't resolve: whether any additional per-thread MCP config divergence exists beyond the shared `KAGE_ROOM=1` gate (e.g. per-thread tool allow-lists) — the evidence here only confirms the env-var mechanism and the file-layout split, not whether MCP config content itself ever varies by thread.
