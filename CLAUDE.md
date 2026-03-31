# Kage Agent Memory

Before suggesting any code changes, architectural decisions, or framework usage, you MUST read the memory indexes below. Follow any rules found in those nodes exactly.

- Read [.agent_memory/index.md](.agent_memory/index.md) for repo-specific context
- If `.global_memory/index.md` exists, read it for org-wide rules

## Saving New Memories

When you resolve a non-trivial bug, establish an architectural rule, or uncover a hidden requirement, save it to memory by running:

```bash
python3 .agent_memory/scripts/distiller_tool.py \
  --title "Short Title" \
  --category "architecture|framework_bug|repo_context|debugging" \
  --tags '["tag1", "tag2"]' \
  --content "Markdown description of problem and solution." \
  --paths "backend,frontend/api"
```

Use `--paths` to route the memory to the correct domain indexes (e.g. `backend`, `frontend`, `frontend/auth`).
