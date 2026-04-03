#!/usr/bin/env python3
"""
kage — Kage Agent Memory CLI

Commands:
  review       Review and approve/reject staged memory nodes
  prune        Deprecate outdated memory nodes
  check-links  Validate all relative markdown links in .agent_memory/
  save         Interactively save a new memory node

Usage:
  python3 kage.py <command>
"""

import argparse
import datetime
import os
import re
import sys
from pathlib import Path

KAGE_ROOT = Path(__file__).resolve().parent
AGENT_MEM = KAGE_ROOT / ".agent_memory"
NODES_DIR = AGENT_MEM / "nodes"
PENDING_DIR = AGENT_MEM / "pending"
DEPRECATED_DIR = AGENT_MEM / "deprecated"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_frontmatter(text: str) -> tuple[dict, str]:
    """Return (frontmatter_dict, body) from a markdown file string."""
    fm: dict = {}
    body = text
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            for line in parts[1].splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    fm[k.strip()] = v.strip().strip('"')
            body = parts[2].lstrip("\n")
    return fm, body


def _write_frontmatter(fm: dict, body: str) -> str:
    lines = ["---"]
    for k, v in fm.items():
        lines.append(f'{k}: "{v}"')
    lines.append("---\n")
    return "\n".join(lines) + body


def _append_link_to_index(base_dir: Path, path: str, title: str, filename: str):
    index_dir = base_dir / path
    index_dir.mkdir(parents=True, exist_ok=True)
    index_file = index_dir / "index.md"

    if not index_file.exists():
        index_file.write_text(f"# {path.capitalize()} Context Index\n\n## Uncategorized\n\n")

    depth = len(path.strip("/").split("/"))
    rel_prefix = "../" * depth
    rel_link = f"{rel_prefix}nodes/{filename}"

    with open(index_file, "a", encoding="utf-8") as f:
        f.write(f"*   [{title}]({rel_link})\n")


def _remove_link_from_indexes(filename: str):
    """Remove all links pointing to `filename` from every index.md."""
    for index_file in AGENT_MEM.rglob("index.md"):
        text = index_file.read_text(encoding="utf-8")
        new_text = "\n".join(
            line for line in text.splitlines()
            if filename not in line
        )
        if new_text != text:
            index_file.write_text(new_text + "\n", encoding="utf-8")
            print(f"  Removed link from {index_file.relative_to(KAGE_ROOT)}")


# ── review ────────────────────────────────────────────────────────────────────

def cmd_review(_args):
    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    pending = sorted(PENDING_DIR.glob("*.md"))

    if not pending:
        print("No pending memories. All clear.")
        return

    print(f"\n{len(pending)} pending memory node(s) awaiting review.\n")

    for i, path in enumerate(pending, 1):
        text = path.read_text(encoding="utf-8")
        fm, body = _parse_frontmatter(text)
        title = fm.get("title") or re.search(r"^#\s+(.+)", body, re.MULTILINE)
        if hasattr(title, "group"):
            title = title.group(1)

        print("─" * 60)
        print(f"[{i}/{len(pending)}] {path.stem}")
        print(f"  Category : {fm.get('category', '?')}")
        print(f"  Tags     : {fm.get('tags', '?')}")
        print(f"  Paths    : {fm.get('paths', '?')}")
        print(f"  Date     : {fm.get('date', '?')}")
        print()
        print(body.strip())
        print()

        while True:
            choice = input("  (a)pprove / (r)eject / (s)kip: ").strip().lower()
            if choice in ("a", "r", "s"):
                break

        if choice == "s":
            print("  Skipped.\n")
            continue

        if choice == "r":
            path.unlink()
            print("  Rejected and deleted.\n")
            continue

        # Approve: move to nodes/, update indexes
        NODES_DIR.mkdir(parents=True, exist_ok=True)
        dest = NODES_DIR / path.name

        # Rebuild without pending flag
        clean_fm = {k: v for k, v in fm.items() if k != "pending"}
        dest.write_text(_write_frontmatter(clean_fm, body), encoding="utf-8")
        path.unlink()

        paths_str = fm.get("paths", "")
        node_title = fm.get("title", path.stem)
        for p in [x.strip() for x in paths_str.split(",") if x.strip()]:
            _append_link_to_index(AGENT_MEM, p, node_title, path.name)

        print(f"  Approved: saved to nodes/{path.name}\n")

    print("Review complete.")


# ── prune ─────────────────────────────────────────────────────────────────────

def cmd_prune(_args):
    NODES_DIR.mkdir(parents=True, exist_ok=True)
    nodes = sorted(NODES_DIR.glob("*.md"))

    if not nodes:
        print("No memory nodes found.")
        return

    print(f"\n{len(nodes)} memory node(s):\n")
    for i, path in enumerate(nodes, 1):
        fm, _ = _parse_frontmatter(path.read_text(encoding="utf-8"))
        print(f"  [{i:2}] {path.stem:<45} {fm.get('category', ''):<15} {fm.get('date', '')}")

    print()
    raw = input("Enter node number to deprecate (or q to quit): ").strip()
    if raw.lower() == "q" or not raw.isdigit():
        return

    idx = int(raw) - 1
    if idx < 0 or idx >= len(nodes):
        print("Invalid number.")
        return

    target = nodes[idx]
    text = target.read_text(encoding="utf-8")
    fm, body = _parse_frontmatter(text)

    confirm = input(f"  Deprecate '{target.stem}'? (y/n): ").strip().lower()
    if confirm != "y":
        print("Cancelled.")
        return

    DEPRECATED_DIR.mkdir(parents=True, exist_ok=True)
    fm["deprecated"] = "true"
    fm["deprecated_date"] = str(datetime.date.today())

    dest = DEPRECATED_DIR / target.name
    dest.write_text(_write_frontmatter(fm, body), encoding="utf-8")
    target.unlink()

    _remove_link_from_indexes(target.name)
    print(f"  Deprecated: moved to deprecated/{target.name}")


# ── check-links ───────────────────────────────────────────────────────────────

def cmd_check_links(_args):
    link_re = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    broken = []
    checked = 0

    for md_file in AGENT_MEM.rglob("*.md"):
        text = md_file.read_text(encoding="utf-8")
        for match in link_re.finditer(text):
            link_text, target = match.group(1), match.group(2)
            if target.startswith("http"):
                continue  # skip external links
            resolved = (md_file.parent / target).resolve()
            checked += 1
            if resolved.exists():
                print(f"  OK   {md_file.relative_to(KAGE_ROOT)} -> {target}")
            else:
                print(f"  BROKEN {md_file.relative_to(KAGE_ROOT)} -> {target}")
                broken.append((md_file, target))

    print(f"\n{checked} link(s) checked. {len(broken)} broken.")
    if broken:
        sys.exit(1)


# ── save ──────────────────────────────────────────────────────────────────────

def cmd_save(_args):
    sys.path.insert(0, str(AGENT_MEM / "scripts"))
    from distiller_tool import create_memory_node
    import json as _json

    print("\nSave a new memory node\n")
    title    = input("Title: ").strip()
    category = input("Category (repo_context/framework_bug/architecture/debugging) [repo_context]: ").strip() or "repo_context"
    tags_raw = input('Tags as JSON array (e.g. ["auth","backend"]) [[]]: ').strip() or "[]"
    paths    = input("Domain paths, comma-separated (e.g. backend,frontend/api): ").strip()
    print("Content (end with a line containing only '.'): ")
    lines = []
    while True:
        line = input()
        if line == ".":
            break
        lines.append(line)
    content = "\n".join(lines)

    import json as _json2
    cfg_path = KAGE_ROOT / "kage.config.json"
    cfg = _json2.load(open(cfg_path)) if cfg_path.exists() else {}
    pending = cfg.get("pending_review", True)

    paths_list = [p.strip() for p in paths.split(",") if p.strip()]
    create_memory_node(title, category, tags_raw, content, paths_list, pending=pending)


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        prog="kage",
        description="Kage Agent Memory CLI",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("review",      help="Review and approve/reject pending memory nodes")
    sub.add_parser("prune",       help="Deprecate stale memory nodes")
    sub.add_parser("check-links", help="Validate all relative links in .agent_memory/")
    sub.add_parser("save",        help="Interactively save a new memory node")

    args = parser.parse_args()
    {
        "review":      cmd_review,
        "prune":       cmd_prune,
        "check-links": cmd_check_links,
        "save":        cmd_save,
    }[args.command](args)


if __name__ == "__main__":
    main()
