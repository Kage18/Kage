#!/usr/bin/env bash
# Kage PreToolUse(Edit/Write/MultiEdit/NotebookEdit) hook — the Librarian's cards, served at the
# moment the agent is about to change a file it has memory about.
#
# All the logic lives in mcp/vnext/librarian/hook.ts, where it is unit-tested: this file finds the
# compiled entry and pipes the payload to it. Logic written in bash is logic nobody tests, and this
# hook fires on every edit in every session.
#
# It is silent on the common path — most edits touch nothing any card cites, and the entry prints
# nothing at all for those — and it fails open at every step. A memory hook that blocks an edit is
# strictly worse than no memory at all, so every failure here is an exit 0 with no output.
#
# Unlike the older kage-*-context.sh hooks it does NOT look for .agent_memory: cards live in the
# shadow store under ~/.kage/store, and whether one exists for this repo is the entry's decision.
# kage-hooks-v5
set -uo pipefail  # NOT -e: a candidate path that does not exist must not abort the hook.

PAYLOAD="$(cat || true)"

# The compiled entry, most specific first: an explicit override (development and tests), the repo
# the plugin was installed from (this checkout ships mcp/dist beside plugin/), the project's own
# checkout when hooks are wired without the plugin, then a project-local npm install of the
# package. A globally installed CLI is reached by setting KAGE_HOOK_ENTRY.
ENTRY=""
for CANDIDATE in \
  "${KAGE_HOOK_ENTRY:-}" \
  "${CLAUDE_PLUGIN_ROOT:-}/../mcp/dist/vnext/librarian/hook.js" \
  "${CLAUDE_PROJECT_DIR:-$PWD}/mcp/dist/vnext/librarian/hook.js" \
  "${CLAUDE_PROJECT_DIR:-$PWD}/node_modules/@kage-core/kage-graph-mcp/dist/vnext/librarian/hook.js"
do
  if [[ -n "$CANDIDATE" && -f "$CANDIDATE" ]]; then
    ENTRY="$CANDIDATE"
    break
  fi
done
[[ -n "$ENTRY" ]] || exit 0
command -v node >/dev/null 2>&1 || exit 0

# One line of stdout or nothing. stderr is discarded and the exit status ignored: a crash, a
# corrupt store, or a node the user's PATH cannot run all come out the same way — silence. The
# wall clock is bounded by the timeout in hooks.json, which Claude Code enforces.
printf '%s' "$PAYLOAD" | node "$ENTRY" "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || true

exit 0
