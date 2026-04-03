"""
Kage Distiller Hook -- post-commit hook script
Analyzes the latest git commit diff and, if a real architectural lesson was
learned, saves it as a memory node via distiller_tool.py.
"""

import os
import subprocess
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pii_scrubber import scrub, has_secrets
import llm_client

KAGE_ROOT = Path(__file__).resolve().parent.parent.parent


def _load_config() -> dict:
    cfg_path = KAGE_ROOT / "kage.config.json"
    if cfg_path.exists():
        with open(cfg_path) as f:
            return json.load(f)
    return {}


def get_latest_commit_data():
    try:
        msg = subprocess.check_output(
            ["git", "log", "-1", "--pretty=%B"], cwd=KAGE_ROOT
        ).decode("utf-8").strip()
        diff = subprocess.check_output(
            ["git", "show", "--stat", "-p"], cwd=KAGE_ROOT
        ).decode("utf-8")
        return msg, diff
    except subprocess.CalledProcessError:
        print("Not inside a git repository or no commits yet.")
        sys.exit(0)


DISTILL_PROMPT = """\
You are an automated Distiller Agent monitoring Git commits.

Read the commit message and diff below. Did this commit conclusively solve a non-trivial framework bug, implement an architectural rule, or resolve an obscure environment issue?

Rules:
- If NO (routine feature, cleanup, dependency bump, etc.), output exactly: SKIP
- If YES, output ONLY a valid JSON object with these exact keys:
  - title      : short, descriptive title (string)
  - category   : one of repo_context | framework_bug | architecture | debugging
  - tags       : stringified JSON array, e.g. "[\"auth\", \"backend\"]"
  - content    : clear markdown describing the problem and solution (no fluff)
  - paths      : comma-separated domain index paths, e.g. "backend,frontend/api"

Commit Message: {msg}

Diff:
{diff}
"""


def call_llm_distiller(commit_msg: str, diff: str):
    # Scrub secrets from diff before sending to LLM
    safe_diff = scrub(diff[:4000])
    prompt = DISTILL_PROMPT.format(msg=commit_msg, diff=safe_diff)
    print("Distiller Agent analyzing commit...")

    raw = llm_client.complete(prompt)

    if raw == "SKIP" or not raw.startswith("{"):
        return None

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def commit_memory_updates():
    try:
        subprocess.check_call(["git", "add", ".agent_memory/"], cwd=KAGE_ROOT)
        subprocess.check_call(
            ["git", "commit", "--amend", "--no-edit"], cwd=KAGE_ROOT
        )
        print("Distiller updated the Memory Graph.")
    except subprocess.CalledProcessError as e:
        print(f"Failed to amend commit: {e}")


if __name__ == "__main__":
    cfg = _load_config()
    pending_review = cfg.get("pending_review", True)
    pii_scrub = cfg.get("pii_scrub", True)

    msg, diff = get_latest_commit_data()

    # Prevent infinite loops on automated commits
    if "Distiller Agent" in msg or msg.startswith("Merge "):
        sys.exit(0)

    # Warn if diff contains secrets
    if pii_scrub and has_secrets(diff):
        print("Warning: secrets detected in diff — scrubbing before distillation.")

    learning = call_llm_distiller(msg, diff)

    if learning:
        distiller = str(KAGE_ROOT / ".agent_memory" / "scripts" / "distiller_tool.py")
        cmd = [
            sys.executable, distiller,
            "--title",    learning["title"],
            "--category", learning["category"],
            "--tags",     learning["tags"],
            "--content",  learning["content"],
            "--paths",    learning["paths"],
        ]
        if pending_review:
            cmd.append("--pending")
        subprocess.run(cmd, check=True)

        # Only amend the commit if we wrote directly (not pending)
        if not pending_review:
            commit_memory_updates()
    else:
        print("Distiller found no learnings in this commit.")
