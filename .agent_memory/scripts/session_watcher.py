"""
Kage Session Watcher -- macOS / Claude Code edition
Monitors ~/.claude/projects/ for new conversation turns, then uses the
Anthropic API to distill learnings into .agent_memory/ nodes.
"""

import os
import time
import json
import subprocess
import glob
from pathlib import Path

import anthropic

KAGE_ROOT = Path(__file__).resolve().parent.parent.parent  # repo root
LAST_CHECKED_FILE = KAGE_ROOT / ".last_distill_time"
CLAUDE_PROJECTS_DIR = Path.home() / ".claude" / "projects"

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env


# ---------------------------------------------------------------------------
# Timestamp helpers
# ---------------------------------------------------------------------------

def get_last_run_time() -> float:
    if LAST_CHECKED_FILE.exists():
        return float(LAST_CHECKED_FILE.read_text().strip())
    return 0.0


def update_last_run_time():
    LAST_CHECKED_FILE.write_text(str(time.time()))


# ---------------------------------------------------------------------------
# Claude Code log harvesting
# ---------------------------------------------------------------------------

def extract_text(content) -> str:
    """Flatten a Claude message content field to plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif block.get("type") == "tool_result":
                    for inner in block.get("content", []):
                        if isinstance(inner, dict) and inner.get("type") == "text":
                            parts.append(inner.get("text", ""))
        return "\n".join(parts)
    return ""


def get_claude_code_logs(last_run: float) -> list:
    """
    Scan every project session JSONL under ~/.claude/projects/ for files
    modified since last_run. Returns a list of:
        { "session_id": str, "project": str, "transcript": str }
    """
    results = []
    pattern = str(CLAUDE_PROJECTS_DIR / "*" / "*.jsonl")
    for jsonl_path in glob.glob(pattern):
        if os.path.getmtime(jsonl_path) <= last_run:
            continue
        try:
            messages = []
            with open(jsonl_path, encoding="utf-8") as f:
                for raw in f:
                    raw = raw.strip()
                    if not raw:
                        continue
                    entry = json.loads(raw)
                    if entry.get("type") not in ("user", "assistant"):
                        continue
                    msg = entry.get("message", {})
                    role = msg.get("role", entry.get("type", ""))
                    text = extract_text(msg.get("content", ""))
                    if text.strip():
                        messages.append(f"[{role.upper()}]: {text.strip()}")

            if len(messages) < 4:
                continue

            project_dir = Path(jsonl_path).parent.name.replace("-", "/")
            session_id = Path(jsonl_path).stem
            transcript = "\n\n".join(messages[-60:])  # last ~60 turns
            results.append({
                "session_id": session_id,
                "project": project_dir,
                "transcript": transcript,
            })
        except Exception as e:
            print(f"  Warning: could not parse {jsonl_path}: {e}")

    return results


# ---------------------------------------------------------------------------
# LLM distillation
# ---------------------------------------------------------------------------

DISTILL_PROMPT = """\
You are a background Distiller Agent reviewing an AI coding session transcript.

Read the conversation below and decide: did the human and AI agent conclusively solve a non-trivial framework bug, establish an architectural rule, or uncover a hidden requirement?

Rules:
- If NO (just chatting, exploratory, or incomplete), output exactly: SKIP
- If YES, output ONLY a valid JSON object with these exact keys:
  - title      : short, descriptive title (string)
  - category   : one of repo_context | framework_bug | architecture | debugging
  - tags       : stringified JSON array, e.g. "[\"auth\", \"backend\"]"
  - content    : clear markdown describing the problem and solution (no fluff)
  - paths      : comma-separated domain index paths, e.g. "backend,frontend/api"

Transcript:
{transcript}
"""


def distill_session(session: dict):
    prompt = DISTILL_PROMPT.format(transcript=session["transcript"])
    print(f"  Distilling session {session['session_id']} ...")

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()

    if raw == "SKIP" or not raw.startswith("{"):
        return None

    # Strip possible markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# ---------------------------------------------------------------------------
# Save to memory graph
# ---------------------------------------------------------------------------

def save_memory(learning: dict):
    distiller = str(KAGE_ROOT / ".agent_memory" / "scripts" / "distiller_tool.py")
    subprocess.run(
        [
            "python3", distiller,
            "--title",    learning["title"],
            "--category", learning["category"],
            "--tags",     learning["tags"],
            "--content",  learning["content"],
            "--paths",    learning["paths"],
        ],
        check=True,
    )


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Kage Session Watcher started. Repo: {KAGE_ROOT}")
    print(f"Watching: {CLAUDE_PROJECTS_DIR}")

    while True:
        last_run = get_last_run_time()
        sessions = get_claude_code_logs(last_run)

        if sessions:
            print(f"Found {len(sessions)} updated session(s).")
            for session in sessions:
                try:
                    learning = distill_session(session)
                    if learning:
                        print(f"  Saving: {learning['title']}")
                        save_memory(learning)
                    else:
                        print(f"  Nothing to save in {session['session_id']}.")
                except Exception as e:
                    print(f"  Error processing session {session['session_id']}: {e}")

        update_last_run_time()
        print("Sleeping 5 minutes...")
        time.sleep(300)
