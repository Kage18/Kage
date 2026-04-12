# Kage v2 — Agent Memory for Claude Code

Kage is a **daemon-free, Claude Code-native agent memory system**. It automatically distills your coding sessions into a searchable knowledge graph that compounds over time — like a team member who remembers everything.

No background process. No external API key. No pip install. Just Claude Code.

---

## How It Works

```
You work in Claude Code
       ↓
Session ends → Stop hook fires → kage-distiller sub-agent reads transcript
       ↓
Valuable learnings written to .agent_memory/pending/
       ↓
You run /kage review → approve/reject → approved nodes committed to git
       ↓
Teammates get your knowledge on git pull
       ↓
Share universally with /kage publish → /kage add (anyone)
```

---

## Install

```
/kage-install
```

That's it. Claude Code installs Claude Code. No pip, no brew, no API keys, no daemon.

---

## Memory Tiers

| Tier | Location | Who sees it |
|---|---|---|
| **Project** | `.agent_memory/` (committed to git) | Whole team via `git pull` |
| **Personal** | `~/.agent_memory/` (your machine only) | You across all your projects |
| **Packs** | `~/.agent_memory/packs/` | Anyone who runs `/kage add` |

---

## What Gets Captured

Kage captures anything a new team member would need to know:

- **How to work the repo**: setup, env vars, deploy steps, dev workflows
- **Architecture**: why things are structured this way, key services, data flows  
- **Bugs and workarounds**: what broke, why, and the fix
- **Patterns and conventions**: how auth works, how APIs are called, error handling
- **External integrations**: third-party API shapes, connection gotchas
- **Design decisions**: choices made and why

---

## Daily Usage

```
/kage review          — approve/reject auto-distilled pending nodes
/kage prune           — deprecate outdated nodes
/kage digest          — regenerate SUMMARY.md overview
/kage add <org/repo>  — install a community memory pack
/kage publish         — bundle your nodes as a shareable pack
/kage search <query>  — find community packs in the registry
```

---

## Memory Retrieval

The `kage-memory` sub-agent is invoked by Claude before architectural decisions. It navigates the index hierarchy to find relevant nodes without loading everything into context.

```
CLAUDE.md → kage-memory sub-agent → .agent_memory/index.md
                                   → backend/index.md
                                   → nodes/matching-node.md  ← returns this only
```

---

## Community Packs

Memory packs are plain git repos. Install community knowledge:

```
/kage add kage-registry/nextjs-patterns
/kage add kage-registry/azure-auth-gotchas
/kage add your-company/internal-patterns
```

Search the registry:
```
/kage search nextjs
```

Publish your own:
```
/kage publish
# → pushes to GitHub, others can /kage add your-org/your-repo
```

---

## Repository Structure

```
.agent_memory/
├── index.md              # Root index (domain list)
├── SUMMARY.md            # Compact digest (auto-generated)
├── nodes/                # Approved memory nodes (committed to git)
│   └── <slug>.md
├── pending/              # HITL review queue (gitignored)
├── deprecated/           # Retired nodes
└── <domain>/
    └── index.md          # Domain index

.claude/
├── agents/
│   ├── kage-memory.md    # Retrieval sub-agent
│   └── kage-distiller.md # Distillation sub-agent (Stop hook)
├── skills/
│   ├── kage/SKILL.md     # /kage management skill
│   └── kage-install/SKILL.md  # /kage-install bootstrap
└── kage/
    ├── hooks/
    │   ├── stop.sh            # Stop hook → triggers distillation
    │   └── session-start.sh   # SessionStart hook → injects context
    └── kage.json              # Installed packs registry
```

---

## vs v1

| | v1 | v2 |
|---|---|---|
| Distillation | Python daemon, polls every 5 min | Stop hook, fires once per session |
| LLM | External Gemini/Anthropic API key | Claude Code's own auth |
| Install | `pip install` + LaunchAgent plist | `/kage-install` skill |
| Sharing | None | Pack system + community registry |
| Memory scope | Per-project only | Project + Personal + Community packs |
