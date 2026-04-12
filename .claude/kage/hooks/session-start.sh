#!/usr/bin/env bash
# Kage v2 SessionStart Hook
# Injects a system message telling Claude which memory tiers are available.

set -euo pipefail

HOOK_JSON="$(cat)"
CWD="$(echo "$HOOK_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('cwd',''))" 2>/dev/null || echo "")"

GLOBAL_MEM="$HOME/.agent_memory"

HAS_PROJECT=""
HAS_GLOBAL=""
PACK_INFO=""

# Check project memory
if [[ -f "$CWD/.agent_memory/index.md" ]]; then
  NODE_COUNT="$(ls "$CWD/.agent_memory/nodes/"*.md 2>/dev/null | wc -l | tr -d ' ')"
  HAS_PROJECT="Project memory: .agent_memory/ ($NODE_COUNT nodes)."
fi

# Check global personal memory
if [[ -f "$GLOBAL_MEM/index.md" ]]; then
  GLOBAL_COUNT="$(ls "$GLOBAL_MEM/nodes/"*.md 2>/dev/null | wc -l | tr -d ' ')"
  HAS_GLOBAL="Personal memory: ~/.agent_memory/ ($GLOBAL_COUNT nodes)."
fi

# Check installed packs
if [[ -d "$GLOBAL_MEM/packs" ]]; then
  PACK_COUNT="$(ls -d "$GLOBAL_MEM/packs/"*/ 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$PACK_COUNT" -gt 0 ]]; then
    PACK_INFO="Packs installed: $PACK_COUNT."
  fi
fi

# Only emit if at least one tier has memory
if [[ -z "$HAS_PROJECT$HAS_GLOBAL" ]]; then
  exit 0
fi

MSG="Kage memory active. $HAS_PROJECT $HAS_GLOBAL $PACK_INFO Use the kage-memory sub-agent before making architectural decisions, implementing patterns, or working in a specific domain."

python3 -c "import json, sys; print(json.dumps({'systemMessage': '$MSG'}))" 2>/dev/null || exit 0
