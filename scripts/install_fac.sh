#!/usr/bin/env bash
#
# Fetch and install Frappe Assistant Core (FAC) for a site running Alaiy OS.
#
# FAC supplies the MCP protocol, OAuth and audit logging that alaiy_os's
# assistant_tools/ plug into. It stays *optional* — a site without it runs the
# OS unchanged (see hooks.py's assistant_tools comment) — but the default
# install path should not leave it to be remembered by hand.
#
# Why a script rather than an after_install hook: fetching an app is a
# bench/pip-level operation outside the site transaction, and a freshly
# pip-installed app is not importable in the process that installed it. So a
# hook could fetch FAC but could never install it. alaiy_os's provisioning
# instead *detects* FAC and prints a pointer to this script when it is missing.
#
# Idempotent: every step is skipped when it is already done, so re-running is
# always safe. Opt out entirely with ALAIY_OS_INSTALL_FAC=false or --no-fac.
#
# Usage: bash apps/alaiy_os/scripts/install_fac.sh --site <site> [options]
#
set -euo pipefail

FAC_APP="frappe_assistant_core"
FAC_REPO_DEFAULT="https://github.com/buildswithpaul/Frappe_Assistant_Core"

# Exit codes, so a caller (CI, a provisioning wrapper) can tell *what* failed.
EX_USAGE=1
EX_PRECONDITION=2
EX_GET_APP=3
EX_INSTALL_APP=4
EX_ENABLE_PLUGIN=5

log()  { printf 'alaiy_os: %s\n' "$*" >&2; }
ok() {
	if [ "${DRY_RUN:-0}" -eq 1 ]; then
		printf 'alaiy_os: ✓ %s (dry run)\n' "$*" >&2
	else
		printf 'alaiy_os: ✓ %s\n' "$*" >&2
	fi
}
die()  { printf 'alaiy_os: ✗ %s\n' "$2" >&2; exit "$1"; }

usage() {
	cat >&2 <<'EOF'
Install Frappe Assistant Core (FAC) for a site running Alaiy OS.

Usage:
  bash apps/alaiy_os/scripts/install_fac.sh [--site <site>] [options]

Options:
  --site <site>   Site to install FAC on. Defaults to $SITE, or to the only
                  site in sites/ when the bench has exactly one.
  --repo <url>    FAC repository to fetch. Default:
                  https://github.com/buildswithpaul/Frappe_Assistant_Core
  --branch <ref>  Branch/tag to fetch (passed to bench get-app --branch).
  --no-fac        Skip everything and exit 0. Same as ALAIY_OS_INSTALL_FAC=false.
  --dry-run       Print the commands that would run; change nothing.
  -h, --help      Show this help.

Environment:
  ALAIY_OS_INSTALL_FAC   Set to false/0/no to skip (for CI: no network calls).
  SITE                   Fallback for --site.

Steps (each skipped when already satisfied):
  1. bench get-app <repo>
  2. bench --site <site> install-app frappe_assistant_core
  3. bench --site <site> execute alaiy_os.setup.install.enable_fac_custom_tools

Exit codes: 1 usage, 2 precondition, 3 get-app, 4 install-app, 5 enable-plugin.
EOF
}

# ── Arguments ────────────────────────────────────────────────────────────────

SITE="${SITE:-}"
REPO="$FAC_REPO_DEFAULT"
BRANCH=""
NO_FAC=0
DRY_RUN=0

while [ $# -gt 0 ]; do
	case "$1" in
		--site)   [ $# -ge 2 ] || { usage; die "$EX_USAGE" "--site needs a value"; }
		          SITE="$2"; shift 2 ;;
		--repo)   [ $# -ge 2 ] || { usage; die "$EX_USAGE" "--repo needs a value"; }
		          REPO="$2"; shift 2 ;;
		--branch) [ $# -ge 2 ] || { usage; die "$EX_USAGE" "--branch needs a value"; }
		          BRANCH="$2"; shift 2 ;;
		--no-fac) NO_FAC=1; shift ;;
		--dry-run) DRY_RUN=1; shift ;;
		-h|--help) usage; exit 0 ;;
		*) usage; die "$EX_USAGE" "unknown argument: $1" ;;
	esac
done

# ── Opt-out, before anything that touches the network ────────────────────────

case "$(printf '%s' "${ALAIY_OS_INSTALL_FAC:-true}" | tr '[:upper:]' '[:lower:]')" in
	false|0|no|off) NO_FAC=1 ;;
esac

if [ "$NO_FAC" -eq 1 ]; then
	log "skipping FAC install (ALAIY_OS_INSTALL_FAC / --no-fac)."
	log "The OS runs fine without FAC; assistant_tools/ simply stays unexposed."
	exit 0
fi

# ── Preconditions ────────────────────────────────────────────────────────────

# This script always lives at <bench>/apps/alaiy_os/scripts/install_fac.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BENCH_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

{ [ -d "$BENCH_DIR/apps" ] && [ -d "$BENCH_DIR/sites" ]; } || die "$EX_PRECONDITION" \
	"$BENCH_DIR does not look like a bench directory (no apps/ and sites/).
   Expected this script to live at <bench>/apps/alaiy_os/scripts/install_fac.sh."

command -v bench >/dev/null 2>&1 || die "$EX_PRECONDITION" \
	"'bench' not found on PATH.
   Activate the bench's virtualenv (source $BENCH_DIR/env/bin/activate) or run
   this as the bench user."

cd "$BENCH_DIR"

if [ -z "$SITE" ]; then
	# Exactly one site is the overwhelmingly common case on a dev bench; more
	# than one is ambiguous and guessing would install FAC on the wrong site.
	found=""
	count=0
	for candidate in sites/*/site_config.json; do
		[ -f "$candidate" ] || continue
		found="$(basename "$(dirname "$candidate")")"
		count=$((count + 1))
	done
	if [ "$count" -eq 1 ]; then
		SITE="$found"
		log "no --site given; using the bench's only site: $SITE"
	elif [ "$count" -eq 0 ]; then
		die "$EX_PRECONDITION" "no sites found under $BENCH_DIR/sites — create one first."
	else
		die "$EX_USAGE" "this bench has $count sites; pass --site <site> to pick one."
	fi
fi

[ -f "sites/$SITE/site_config.json" ] || die "$EX_PRECONDITION" \
	"site '$SITE' not found. Sites on this bench:
$(ls -1 sites/*/site_config.json 2>/dev/null | sed 's#^sites/#   - #; s#/site_config.json$##' || echo '   (none)')"

run() {
	log "\$ $*"
	if [ "$DRY_RUN" -eq 1 ]; then
		return 0
	fi
	"$@"
}

if [ "$DRY_RUN" -eq 1 ]; then
	log "dry run — no commands will actually execute."
fi

# ── 1. Fetch FAC into apps/ ──────────────────────────────────────────────────

if [ -d "apps/$FAC_APP" ]; then
	ok "$FAC_APP already present at apps/$FAC_APP — skipping get-app."
else
	log "fetching FAC from $REPO"
	if [ -n "$BRANCH" ]; then
		get_app_cmd=(bench get-app --branch "$BRANCH" "$REPO")
	else
		get_app_cmd=(bench get-app "$REPO")
	fi
	run "${get_app_cmd[@]}" || die "$EX_GET_APP" \
		"'bench get-app' failed.
   - Check network access and that $REPO is reachable.
   - On a permission error, run this as the user that owns $BENCH_DIR.
   - To proceed without FAC: ALAIY_OS_INSTALL_FAC=false"
	ok "fetched $FAC_APP into apps/"
fi

# ── 2. Install FAC on the site ───────────────────────────────────────────────

# `bench list-apps` prints one app per line (with a version column on some
# bench versions), so match the app name as a whole word. This read is safe to
# run under --dry-run too, so the dry run reports what would really happen.
#
# It doubles as a reachability check: if it cannot even list the site's apps,
# install-app would fail too, and saying why here beats a bench traceback.
if ! site_apps="$(bench --site "$SITE" list-apps 2>/dev/null)"; then
	die "$EX_PRECONDITION" \
		"cannot read the installed apps of site $SITE.
   - Is the database running? (service mariadb start)
   - Run 'bench --site $SITE list-apps' to see the underlying error."
fi

installed=0
if printf '%s' "$site_apps" | grep -qw "$FAC_APP"; then
	installed=1
fi

if [ "$installed" -eq 1 ]; then
	ok "$FAC_APP already installed on $SITE — skipping install-app."
else
	run bench --site "$SITE" install-app "$FAC_APP" || die "$EX_INSTALL_APP" \
		"'bench install-app $FAC_APP' failed on site $SITE.
   - Check the site's Error Log and bench's console output above.
   - The site is otherwise untouched; alaiy_os keeps working without FAC.
   - Re-run this script once the cause is fixed; it is idempotent."
	ok "installed $FAC_APP on $SITE"
fi

# ── 3. Enable FAC's custom_tools plugin ──────────────────────────────────────
#
# Without this plugin FAC never resolves alaiy_os's `assistant_tools` hook, so
# the OS's MCP tools exist but are invisible to every client. Calling the one
# provisioning step directly is far cheaper than a full `bench migrate`.

run bench --site "$SITE" execute alaiy_os.setup.install.enable_fac_custom_tools \
	|| die "$EX_ENABLE_PLUGIN" \
	"could not enable FAC's custom_tools plugin on $SITE.
   FAC is installed, but alaiy_os's MCP tools will not be exposed until it is.
   Enable it by hand in FAC admin → Plugins, or re-run:
     bench --site $SITE execute alaiy_os.setup.install.enable_fac_custom_tools"

ok "FAC ready on $SITE — alaiy_os's MCP tools are exposed."
