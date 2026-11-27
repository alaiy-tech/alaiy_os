"""Parse a connector's sync-interval setting.

Connectors store intervals as Select text such as "30 min", "1 hour", "6 hours" or "Disabled".
A value the code does not accept (for example "30" with no unit) is reported as invalid and never
read as disabled; reading it as disabled is how a sync silently stops.
"""

import re
from typing import NamedTuple

_UNITS = {
    "min": 1, "mins": 1, "minute": 1, "minutes": 1,
    "hour": 60, "hours": 60, "hr": 60, "hrs": 60,
    "day": 1440, "days": 1440,
}
_WORDS = {"hourly": 60, "daily": 1440, "weekly": 10080}
_PATTERN = re.compile(r"^(\d+)\s*([a-z]*)$")


class Interval(NamedTuple):
    kind: str  # "ok" | "disabled" | "invalid"
    minutes: int | None = None


def parse_interval(value, bare_unit=None) -> Interval:
    """`bare_unit` ("min", "hour" or "day") is what a number with no unit means. Without it such a
    number is invalid: an interval saved as "30" instead of "30 min" once stopped a sync silently."""
    text = "" if value is None else str(value).strip().lower()
    if text in ("", "disabled", "off", "none"):
        return Interval("disabled")
    if text in _WORDS:
        return Interval("ok", _WORDS[text])
    match = _PATTERN.match(text)
    unit = (match.group(2) or bare_unit) if match else None
    if unit not in _UNITS:
        return Interval("invalid")
    minutes = int(match.group(1)) * _UNITS[unit]
    return Interval("ok", minutes) if minutes > 0 else Interval("invalid")
