"""Check connector health lists against their own repositories, with no bench.

Usage: python scripts/check_health_meta.py path/to/connector_meta.py [more paths]
Exits 1 when any list would fail on a real site.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from alaiy_os.health.static_check import check_connector  # noqa: E402


def main(paths):
    failed = False
    for path in paths:
        problems = check_connector(path)
        print(f"{path}: {'ok' if not problems else f'{len(problems)} problem(s)'}")
        for problem in problems:
            print(f"  - {problem}")
        failed = failed or bool(problems)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
