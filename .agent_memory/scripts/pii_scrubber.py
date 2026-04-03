"""
Kage PII & Secret Scrubber
Redacts sensitive data from text before it is written to memory nodes.
"""

import re

# (pattern, replacement) — order matters: most specific first
_PATTERNS = [
    # Anthropic API keys
    (r'sk-ant-[a-zA-Z0-9\-_]{20,}', '[ANTHROPIC_KEY]'),
    # OpenAI API keys
    (r'sk-[a-zA-Z0-9]{20,}', '[OPENAI_KEY]'),
    # GitHub tokens (classic + fine-grained)
    (r'gh[ps]_[a-zA-Z0-9]{36,}', '[GITHUB_TOKEN]'),
    (r'github_pat_[a-zA-Z0-9_]{82}', '[GITHUB_TOKEN]'),
    # Google API keys
    (r'AIza[a-zA-Z0-9\-_]{35}', '[GOOGLE_KEY]'),
    # AWS keys
    (r'AKIA[A-Z0-9]{16}', '[AWS_KEY]'),
    # PEM private keys (multiline)
    (r'-----BEGIN [A-Z ]+ PRIVATE KEY-----.*?-----END [A-Z ]+ PRIVATE KEY-----',
     '[PRIVATE_KEY]'),
    # Generic inline secrets: password=abc123, token: "xyz"
    (r'(?i)(password|passwd|secret|api[_-]?key|token|auth)\s*[:=]\s*["\']?([^\s"\'\\]{6,})["\']?',
     r'\1=[REDACTED]'),
    # Email addresses
    (r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b', '[EMAIL]'),
]

# Compiled for performance
_COMPILED = [
    (re.compile(p, re.DOTALL | re.MULTILINE), r)
    for p, r in _PATTERNS
]

# Only the key/token patterns are used for has_secrets() checks
_SECRET_PATTERNS = _COMPILED[:7]


def scrub(text: str) -> str:
    """Return a copy of text with all detected secrets redacted."""
    for pattern, replacement in _COMPILED:
        text = pattern.sub(replacement, text)
    return text


def has_secrets(text: str) -> bool:
    """Return True if text appears to contain API keys or private keys."""
    return any(p.search(text) for p, _ in _SECRET_PATTERNS)
