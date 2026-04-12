"""
Kage Session Watcher -- macOS / Claude Code edition
Monitors ~/.claude/projects/ for new conversation turns, then uses the
configured LLM to distill learnings into .agent_memory/ nodes.
"""

import os
import time
import json
import subprocess
import glob
from pathlib import Path

# Allow running as a script from any directory
import sys
sys.path.insert(0, str(Path(__file__).parent))
from pii_scrubber import scrub, has_secrets
import llm_client

KAGE_ROOT = Path(__file__).resolve().parent.parent.parent  # repo root
LAST_CHECKED_FILE = KAGE_ROOT / ".last_distill_time"
PROCESSED_IDS_FILE = KAGE_ROOT / ".agent_memory" / ".processed_sessions"
CLAUDE_PROJECTS_DIR = Path.home() / ".claude" / "projects"


def _load_config() -> dict:
    cfg_path = KAGE_ROOT / "kage.config.json"
    if cfg_path.exists():
        with open(cfg_path) as f:
            return json.load(f)
    return {}


# ---------------------------------------------------------------------------
# Timestamp helpers
# ---------------------------------------------------------------------------

def get_last_run_time() -> float:
    if LAST_CHECKED_FILE.exists():
        return float(LAST_CHECKED_FILE.read_text().strip())
    return 0.0


def update_last_run_time():
    LAST_CHECKED_FILE.write_text(str(time.time()))


def load_processed_ids() -> set:
    if PROCESSED_IDS_FILE.exists():
        return set(PROCESSED_IDS_FILE.read_text().splitlines())
    return set()


def mark_session_processed(session_id: str):
    with open(PROCESSED_IDS_FILE, "a") as f:
        f.write(session_id + "\n")


# ---------------------------------------------------------------------------
# Claude Code log harvesting
# ---------------------------------------------------------------------------

def extract_text(content) -> str:
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


def get_claude_code_logs(last_run: float, processed_ids: set) -> list:
    results = []
    pattern = str(CLAUDE_PROJECTS_DIR / "*" / "*.jsonl")
    for jsonl_path in glob.glob(pattern):
        session_id = Path(jsonl_path).stem
        # Skip sessions already successfully processed
        if session_id in processed_ids:
            continue
        # Skip sessions older than last run that we haven't seen before
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

            # Filter out noise messages before building transcript
            _NOISE_PREFIXES = (
                "Base directory for this skill:",
                "[Request interrupted",
                "This session is being continued from a previous conversation",
                "Implement tasks from an OpenSpec change",
                "Fast-forward through artifact creation",
                "Sync delta specs from a change",
                "Start a new change using the experimental",
                "Enter explore mode. Think deeply",
            )
            def _is_noise(text: str) -> bool:
                return (
                    text.startswith(_NOISE_PREFIXES)
                    or "<local-command-" in text[:80]
                    or (len(text) > 10000)  # session summaries / huge context blobs
                )
            messages = [m for m in messages if not _is_noise(m.split("] ", 1)[-1] if "] " in m else m)]

            project_dir = Path(jsonl_path).parent.name.replace("-", "/")
            session_id = Path(jsonl_path).stem
            transcript = "\n\n".join(messages[-60:])
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

Read the conversation below and decide: does this session contain a concrete, reusable engineering insight worth saving? Save it if ANY of these are true:
- A bug was diagnosed and fixed (even in newly written code)
- A codebase pattern or API convention was discovered (e.g. "use X not Y to call this API")
- An architectural or design decision was made and explained
- A non-obvious requirement or constraint was uncovered
- A workflow, data structure, or integration was mapped out in detail

Output exactly: SKIP if the session is purely exploratory/Q&A with no concrete resolution, or incomplete.

If there IS something worth saving, output ONLY a valid JSON object with these exact keys:
  - title      : short, descriptive title (string)
  - category   : one of repo_context | framework_bug | architecture | debugging
  - tags       : stringified JSON array, e.g. "[\"auth\", \"backend\"]"
  - content    : clear markdown describing the problem, pattern, or decision (be specific — include actual method names, types, config keys, etc.)
  - paths      : comma-separated domain index paths, e.g. "backend,frontend/api"

Transcript:
{transcript}
"""


_NOISE_PATTERNS = [
    r'<thinking>.*?</thinking>',                         # Claude's internal reasoning
    r'<ide_(?:selection|opened_file)[^>]*>.*?</ide_(?:selection|opened_file)>',  # IDE context
    r'<command-(?:message|name|args)>.*?</command-(?:message|name|args)>',       # slash-command metadata
    r'<local-command-(?:stdout|stderr|caveat)>.*?</local-command-(?:stdout|stderr|caveat)>',
    r'Base directory for this skill:.*?(?=\n\n|\Z)',     # skill invocation preamble (can be 5k chars)
]

def _clean_transcript(transcript: str) -> str:
    """Strip internal reasoning and IDE noise before sending to LLM."""
    import re
    for pattern in _NOISE_PATTERNS:
        transcript = re.sub(pattern, '', transcript, flags=re.DOTALL)
    transcript = re.sub(r'\n{3,}', '\n\n', transcript)
    return transcript.strip()


def distill_session(session: dict):
    # Scrub secrets from transcript before sending to LLM
    safe_transcript = scrub(session["transcript"])
    safe_transcript = _clean_transcript(safe_transcript)
    prompt = DISTILL_PROMPT.format(transcript=safe_transcript)
    print(f"  Distilling session {session['session_id']} ...")

    raw = llm_client.complete(prompt)

    if raw == "SKIP" or not raw.startswith("{"):
        return None

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# ---------------------------------------------------------------------------
# Save to memory graph
# ---------------------------------------------------------------------------

def save_memory(learning: dict, pending: bool):
    distiller = str(KAGE_ROOT / ".agent_memory" / "scripts" / "distiller_tool.py")
    cmd = [
        "python3", distiller,
        "--title",    learning["title"],
        "--category", learning["category"],
        "--tags",     learning["tags"],
        "--content",  learning["content"],
        "--paths",    learning["paths"],
    ]
    if pending:
        cmd.append("--pending")
    subprocess.run(cmd, check=True)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    cfg = _load_config()
    pending_review = cfg.get("pending_review", True)
    pii_scrub = cfg.get("pii_scrub", True)

    print(f"Kage Session Watcher started. Repo: {KAGE_ROOT}")
    print(f"Watching: {CLAUDE_PROJECTS_DIR}")
    print(f"Mode: {'pending review queue' if pending_review else 'direct write'} | PII scrub: {pii_scrub}")

    while True:
        last_run = get_last_run_time()
        processed_ids = load_processed_ids()
        sessions = get_claude_code_logs(last_run, processed_ids)

        if sessions:
            print(f"Found {len(sessions)} updated session(s).")
            for session in sessions:
                try:
                    # Warn if raw transcript has secrets (belt-and-suspenders)
                    if pii_scrub and has_secrets(session["transcript"]):
                        print(f"  Warning: secrets detected in session {session['session_id']}, scrubbing.")

                    learning = distill_session(session)
                    if learning:
                        print(f"  Saving: {learning['title']}")
                        save_memory(learning, pending=pending_review)
                    else:
                        print(f"  Nothing to save in {session['session_id']}.")
                    # Only mark as processed on success (no exception)
                    mark_session_processed(session["session_id"])
                except Exception as e:
                    print(f"  Error processing session {session['session_id']}: {e}")
                    # Do NOT mark as processed — will retry next cycle

        update_last_run_time()
        print("Sleeping 5 minutes...")
        time.sleep(300)
