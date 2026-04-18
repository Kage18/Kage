#!/usr/bin/env bash
# Kage UserPromptSubmit Hook
# Injects a hard reminder to use kage-memory before file reads.
# Fires before every user message — acts as a constant forcing function.

set -euo pipefail

HOOK_JSON="$(cat)"
CWD="$(echo "$HOOK_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null || echo "")"

# Only fire if project memory exists
if [[ ! -f "$CWD/.agent_memory/index.md" ]]; then
  exit 0
fi

NODE_COUNT="$(ls "$CWD/.agent_memory/nodes/"*.md 2>/dev/null | wc -l | tr -d ' ')"

MSG="KAGE ENFORCEMENT: This project has $NODE_COUNT memory nodes in .agent_memory/. You MUST invoke the kage-memory sub-agent as your FIRST action before reading any file, running any search, or exploring the codebase. No exceptions — not for quick lookups, not for simple questions. kage-memory first, always."

KAGE_MSG="$MSG" python3 -c "import json,os; print(json.dumps({'hookSpecificOutput': os.environ['KAGE_MSG']}))" 2>/dev/null || exit 0
