"""Make error text safe to show on a page or post to Slack.

Connector errors have carried keys inside tracebacks and request URLs. Only the first line is kept,
and anything that looks like a credential is replaced.
"""

import re

_RULES = [
    (re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+"), "Bearer [hidden]"),
    (re.compile(r"""(?i)(https?://[^\s?"']+)\?[^\s"']*"""), r"\1?[hidden]"),
    (re.compile(
        r"""(?i)\b(token|key|secret|password|passwd|pwd|authorization|api[_-]?key|access[_-]?key)"""
        r"""(["']?\s*[=:]\s*["']?)[^\s,;"'}&]+"""), r"\1\2[hidden]"),
    (re.compile(r"\b[A-Za-z0-9_-]{32,}\b"), "[hidden]"),
]


def scrub(text, max_len=300):
    if not text:
        return ""
    lines = str(text).strip().splitlines()
    line = lines[0] if lines else ""
    for pattern, replacement in _RULES:
        line = pattern.sub(replacement, line)
    return line[:max_len]
