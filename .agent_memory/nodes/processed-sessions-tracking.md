---
title: "Session deduplication via .processed_sessions tracking"
category: repo_context
tags: ["session-management", "deduplication", "persistence"]
paths: "backend,devops"
date: "2026-04-12"
source: "inline"
---

# Session deduplication via .processed_sessions tracking

## Problem

The `stop.sh` hook can fire multiple times for the same session (e.g., when the user stops the session, or due to timeout/crash recovery). Without deduplication, `kage-distiller` would process the same transcript multiple times, creating duplicate memory nodes.

## Solution

Kage v2 uses a `.processed_sessions` file stored at `~/.claude/kage/.processed_sessions` to track which session IDs have already been distilled.

**Workflow:**

1. **Before launching distiller** — `stop.sh` reads `~/.claude/kage/.processed_sessions` and checks if the current `session_id` is already listed
2. **If already processed** — skip the distiller invocation entirely
3. **If new** — launch `kage-distiller` with the transcript path
4. **After distiller completes successfully** — append the `session_id` to `~/.claude/kage/.processed_sessions`

**File format:** One session ID per line, plain text.

**Location rationale:** Stored in `~/.claude/kage/` (personal agent directory, not in the repo) so it is machine-local and persists across git operations without being committed. This prevents duplicate nodes when the repository is cloned or a new developer works on the same project.

## Implementation details

- File is created lazily (on first write) if it doesn't exist
- `stop.sh` checks file existence before reading to handle first-run case
- Session ID is appended only after successful distillation (not on error)
- No sorting or cleanup needed — just a simple append-only log
