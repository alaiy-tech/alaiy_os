"""
AlaiyOS Core — Workspace patcher.

================================================================================
WHAT THIS DOES
================================================================================
On every `bench migrate` (and on install), patch_workspaces() reads
WORKSPACE_CONFIG and makes the LIVE ERPNext Workspace documents match it:

  * Disabled workspace  -> set is_hidden = 1 (kept in DB so it can come back).
  * Enabled workspace   -> set is_hidden = 0, then toggle the `hidden` flag on
                           every `links` row: hidden = 0 for whitelisted
                           DocTypes/Reports, hidden = 1 for everything else.

================================================================================
SIDEBAR DIAGNOSIS (why we toggle `hidden` instead of deleting rows)
================================================================================
In Frappe v15/v16 the left workspace sidebar tree AND the main card grid are
BOTH rendered from the single `Workspace` doc's `links` child table. There is no
separate hardcoded JS list of Stock items — the desk reads `tabWorkspace Link`
and skips rows whose `hidden` flag is set. (`onboard` is a legacy flag that older
render paths used to surface "getting started" items; we clear it too, belt and
suspenders.)

The reason all ~50 Stock items keep reappearing is that `bench migrate` re-imports
ERPNext's standard fixture (erpnext/stock/workspace/stock/stock.json) into
`tabWorkspace`, resetting every flag. That is exactly why this function runs in
the `after_migrate` hook — AFTER the fixture sync — and re-applies our flags.

We TOGGLE flags rather than delete rows so ERPNext's own data is never destroyed:
re-enabling an item in config simply flips `hidden` back to 0 on the next deploy.

IDEMPOTENT
Running this repeatedly produces the same result — each row's `hidden`/`onboard`
flags are set to the value derived from config every time.

ROLE SCOPE
Workspaces are global docs, so hiding a link hides it for everyone in the desk
view. System Administrators still reach every DocType/Report via the Awesome Bar
and direct URL (route_guard skips admins; permissions.py never denies them), so
this is the desired "remove from UI, keep backend" behaviour.
================================================================================
"""

import frappe

from alaiy_os_core.client.config.workspace_config import (
    WORKSPACE_CONFIG,
    get_blocked_reports,
)

# Link "type" values in the Workspace `links` child table that we manage.
# "Card Break" rows are group headers; "Link" rows are the actual items.
_LINK_ROW_TYPE = "Link"
_CARD_BREAK_TYPE = "Card Break"


def patch_workspaces():
    """
    Entry point called from hooks (after_install / after_migrate).

    Iterates WORKSPACE_CONFIG and reconciles each Workspace doc. Wrapped so a
    failure on one workspace (e.g. it does not exist on this install) never
    aborts the whole migrate.
    """
    blocked_reports = set(get_blocked_reports())

    for ws_name, ws_cfg in WORKSPACE_CONFIG.items():
        try:
            _patch_single_workspace(ws_name, ws_cfg, blocked_reports)
        except Exception:
            # Log and continue — a missing/renamed workspace must not break migrate.
            frappe.log_error(
                title="AlaiyOS: workspace patch failed",
                message=f"Workspace '{ws_name}'\n{frappe.get_traceback()}",
            )

    frappe.db.commit()
    frappe.clear_cache()


def _patch_single_workspace(ws_name, ws_cfg, blocked_reports):
    """Reconcile one Workspace doc with its config entry."""
    if not frappe.db.exists("Workspace", ws_name):
        # Standard workspace not present on this site — nothing to do.
        return

    # ── Disabled workspace: just hide it and stop. ────────────────────────────
    if not ws_cfg.get("enabled"):
        if frappe.db.get_value("Workspace", ws_name, "is_hidden") != 1:
            frappe.db.set_value("Workspace", ws_name, "is_hidden", 1)
        return

    # ── Enabled workspace: make sure it is visible, then toggle link flags. ───
    doc = frappe.get_doc("Workspace", ws_name)
    if doc.is_hidden:
        doc.is_hidden = 0

    visible_doctypes = set(ws_cfg.get("visible_doctypes", []))
    visible_reports = set(ws_cfg.get("visible_reports", []))
    visible_pages = set(ws_cfg.get("visible_pages", []))

    _toggle_link_flags(
        doc, visible_doctypes, visible_reports, visible_pages, blocked_reports
    )

    # Always save: migrate just re-synced the fixture, so flags need re-applying
    # every run. ignore_permissions because migrate runs as Administrator.
    doc.save(ignore_permissions=True)


def _is_visible_link(row, visible_doctypes, visible_reports, visible_pages):
    """
    Return True if this `links` row points at a whitelisted target and should
    therefore stay visible. Only DocType/Report/Page rows are judged; any other
    custom link type defaults to visible (we never hide things we don't manage).
    """
    link_to = (row.link_to or "").strip()
    link_type = (row.link_type or "").strip()

    if not link_to:
        return True  # safety; real Card Breaks are handled by the caller

    if link_type == "DocType":
        return link_to in visible_doctypes
    if link_type == "Report":
        return link_to in visible_reports
    if link_type == "Page":
        return link_to in visible_pages

    # Unknown/custom link type — leave it visible.
    return True


def _toggle_link_flags(doc, visible_doctypes, visible_reports, visible_pages, blocked_reports):
    """
    Set `hidden`/`onboard` on every Link row per the whitelist (NON-destructive):

      * Whitelisted DocType/Report/Page link -> hidden = 0
      * Everything else (Link rows)          -> hidden = 1, onboard = 0
      * Card Break headers                   -> hidden = 1 if every Link under
                                                them (until the next Card Break)
                                                is hidden, else hidden = 0.

    Rows are never deleted, so ERPNext's data is preserved and re-enabling an
    item in config just flips its flag back on the next deploy.
    """
    rows = list(doc.links)
    n = len(rows)

    # First pass: set hidden/onboard on every actual Link row.
    for row in rows:
        if (row.type or "").strip() != _LINK_ROW_TYPE:
            continue  # Card Breaks handled in the second pass

        # Belt-and-suspenders: explicitly blocked reports are always hidden,
        # even if a future config edit forgets to drop them from a visible list.
        is_blocked_report = (
            (row.link_type or "") == "Report"
            and (row.link_to or "") in blocked_reports
        )

        visible = (
            not is_blocked_report
            and _is_visible_link(row, visible_doctypes, visible_reports, visible_pages)
        )

        row.hidden = 0 if visible else 1
        if not visible:
            # Clear the legacy onboarding flag so hidden items never surface.
            if hasattr(row, "onboard"):
                row.onboard = 0

    # Second pass: hide Card Break headers whose entire section is now hidden.
    for i, row in enumerate(rows):
        if (row.type or "").strip() != _CARD_BREAK_TYPE:
            continue

        any_visible_child = False
        j = i + 1
        while j < n and (rows[j].type or "").strip() != _CARD_BREAK_TYPE:
            child = rows[j]
            if (child.type or "").strip() == _LINK_ROW_TYPE and not child.hidden:
                any_visible_child = True
                break
            j += 1

        row.hidden = 0 if any_visible_child else 1
