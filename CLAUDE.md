# Kage v2 — Agent Memory

This project uses Kage v2 for persistent agent memory.

## Rules

- Use the `kage-memory` sub-agent **before** implementing auth, API patterns, database operations, or any domain-specific feature
- Do **NOT** read `.agent_memory/` files directly — always delegate to `kage-memory`
- After completing significant work, memory is auto-distilled at session end (no action needed)
- Review pending nodes with `/kage review`

## Memory Tiers

| Tier | Location | Shared with |
|---|---|---|
| Project | `.agent_memory/` (committed) | Whole team via git |
| Personal | `~/.agent_memory/` | You only |
| Packs | `~/.agent_memory/packs/` | Anyone who installs |

## CLI

```
/kage review          — approve/reject pending nodes
/kage prune           — deprecate outdated nodes
/kage digest          — regenerate SUMMARY.md
/kage add <org/repo>  — install a community memory pack
/kage publish         — prepare this project as a shareable pack
/kage search <query>  — find community packs
```
