import os
import sys
import argparse
import datetime
import re
from pathlib import Path

# Allow running as a script from any directory
sys.path.insert(0, str(Path(__file__).parent))
from pii_scrubber import scrub


def _base_dir() -> str:
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _safe_filename(title: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_\-]', '_', title).lower() + '.md'


def create_memory_node(title, category, tags, content, relative_paths, pending=False):
    """
    Creates a new memory node and appends links to the specified index paths.

    If pending=True, writes to .agent_memory/pending/ instead of nodes/ and
    does NOT update any indexes. The node stores 'paths' in its frontmatter so
    `kage review` can complete the approval later.
    """
    base_dir = _base_dir()
    safe_filename = _safe_filename(title)

    # Scrub PII/secrets from content before writing
    content = scrub(content)

    if pending:
        dest_dir = os.path.join(base_dir, 'pending')
        os.makedirs(dest_dir, exist_ok=True)
        node_path = os.path.join(dest_dir, safe_filename)

        with open(node_path, 'w', encoding='utf-8') as f:
            f.write(
                f"---\n"
                f"pending: true\n"
                f"category: \"{category}\"\n"
                f"tags: {tags}\n"
                f"paths: \"{','.join(relative_paths)}\"\n"
                f"date: \"{datetime.date.today()}\"\n"
                f"---\n\n"
            )
            f.write(f"# {title}\n\n")
            f.write(content + "\n")

        print(f"Staged for review: {node_path}")
        print("Run `python3 kage.py review` to approve or reject.")
        return

    # Direct write to nodes/ + update indexes
    nodes_dir = os.path.join(base_dir, 'nodes')
    os.makedirs(nodes_dir, exist_ok=True)
    node_path = os.path.join(nodes_dir, safe_filename)

    with open(node_path, 'w', encoding='utf-8') as f:
        f.write(
            f"---\n"
            f"category: \"{category}\"\n"
            f"tags: {tags}\n"
            f"date: \"{datetime.date.today()}\"\n"
            f"---\n\n"
        )
        f.write(f"# {title}\n\n")
        f.write(content + "\n")

    print(f"Created memory node: {node_path}")

    for path in relative_paths:
        index_dir = os.path.join(base_dir, path)
        os.makedirs(index_dir, exist_ok=True)
        index_file = os.path.join(index_dir, 'index.md')

        if not os.path.exists(index_file):
            with open(index_file, 'w', encoding='utf-8') as f:
                f.write(f"# {path.capitalize()} Context Index\n\n## Uncategorized\n\n")

        depth = len(path.strip('/').split('/'))
        rel_prefix = '../' * depth
        rel_link = f"{rel_prefix}nodes/{safe_filename}"

        with open(index_file, 'a', encoding='utf-8') as f:
            f.write(f"*   [{title}]({rel_link})\n")

        print(f"Appended link to {index_file}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Agent Memory Distiller Tool")
    parser.add_argument('--title',    required=True,  help="Title of the memory")
    parser.add_argument('--category', default="repo_context", help="Category type")
    parser.add_argument('--tags',     default="[]",   help="JSON array of tags")
    parser.add_argument('--content',  required=True,  help="The core memory text")
    parser.add_argument('--paths',    required=True,  help="Comma-separated index paths (e.g. frontend,backend/api)")
    parser.add_argument('--pending',  action='store_true',
                        help="Stage for human review instead of writing directly to nodes/")

    args = parser.parse_args()
    paths_list = [p.strip() for p in args.paths.split(',')]

    create_memory_node(args.title, args.category, args.tags, args.content, paths_list,
                       pending=args.pending)
