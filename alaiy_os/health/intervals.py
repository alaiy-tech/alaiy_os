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
_PATTERN = re.compile(r"^(\d+)\s*([a-z]+)$")


class Interval(NamedTuple):
    kind: str  # "ok" | "disabled" | "invalid"
    minutes: int | None = None


def parse_interval(value) -> Interval:
    text = "" if value is None else str(value).strip().lower()
    if text in ("", "disabled", "off", "none"):
        return Interval("disabled")
    match = _PATTERN.match(text)
    if not match or match.group(2) not in _UNITS:
        return Interval("invalid")
    minutes = int(match.group(1)) * _UNITS[match.group(2)]
    return Interval("ok", minutes) if minutes > 0 else Interval("invalid")
