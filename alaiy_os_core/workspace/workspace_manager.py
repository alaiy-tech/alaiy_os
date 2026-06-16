"""
AlaiyOS Core — Workspace patcher.

================================================================================
WHAT THIS DOES
================================================================================
On every `bench migrate` (and on install), patch_workspaces() reads
WORKSPACE_CONFIG and makes the LIVE ERPNext Workspace documents match it:

  * Disabled workspace  -> set is_hidden = 1 (kept in DB so it can come back).
  * Enabled workspace   -> set is_hidden = 0, then SURGICALLY remove any
                           DocType-/Report-/Page-type links and shortcuts that
                           are NOT in that workspace's visible_* whitelist.

WHY SURGICAL (not full replace)
ERPNext (and admins) may add their own links to a workspace. We must only touch
the controlled set — link rows that point at a DocType / Report / Page. We leave
everything else (Card Breaks we still need, custom links, headers) untouched,
except empty "Card Break" groups left dangling after we strip their children.

IDEMPOTENT
Running this repeatedly produces the same result: once a disallowed link is gone
it stays gone; once is_hidden is set it stays set. Re-enabling in config restores
visibility on the next run because ERPNext re-imports the standard workspace
fixtures during migrate before this hook fires.

ROLE SCOPE
Workspaces in Frappe are global docs, so hiding a link hides it for everyone in
the *default* workspace view. System Administrators still reach every DocType via
the Awesome Bar / direct URL (we never deny them in permissions.py), so this is
the desired "remove from UI, keep backend" behaviour.
================================================================================
"""

import frappe

from alaiy_os_core.config.workspace_config import (
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

    # ── Enabled workspace: make sure it is visible, then prune links. ─────────
    doc = frappe.get_doc("Workspace", ws_name)
    if doc.is_hidden:
        doc.is_hidden = 0

    visible_doctypes = set(ws_cfg.get("visible_doctypes", []))
    visible_reports = set(ws_cfg.get("visible_reports", []))
    visible_pages = set(ws_cfg.get("visible_pages", []))

    changed = False
    changed |= _prune_links(doc, visible_doctypes, visible_reports, visible_pages, blocked_reports)
    changed |= _prune_shortcuts(doc, visible_doctypes, visible_reports, visible_pages)

    if changed or doc.is_hidden == 0:
        # ignore_permissions: migrate runs as Administrator already, but be explicit.
        doc.save(ignore_permissions=True)


def _is_allowed_link(link, visible_doctypes, visible_reports, visible_pages):
    """
    Decide whether a single `links` row should be KEPT.

    We only judge rows that point at a DocType / Report / Page. Any other link
    type (e.g. a custom URL or dashboard) is left untouched by returning True.
    """
    link_to = (link.link_to or "").strip()
    link_type = (link.link_type or "").strip()

    if not link_to:
        # Header/Card Break or empty row — not our concern here.
        return True

    if link_type == "DocType":
        return link_to in visible_doctypes
    if link_type == "Report":
        return link_to in visible_reports
    if link_type == "Page":
        return link_to in visible_pages

    # Unknown/custom link type — do not touch it.
    return True


def _prune_links(doc, visible_doctypes, visible_reports, visible_pages, blocked_reports):
    """
    Rebuild doc.links keeping only:
      * Card Break group headers that still have at least one visible child, and
      * Link rows that pass the whitelist check.

    Returns True if anything was removed.
    """
    original = list(doc.links)
    kept = []

    for row in original:
        row_type = (row.type or "").strip()

        if row_type == _CARD_BREAK_TYPE:
            # Defer the decision: keep the header for now, prune empty ones later.
            kept.append(row)
            continue

        # Belt-and-suspenders: drop explicitly blocked reports even if a future
        # config edit forgets to remove them from a visible list.
        if (row.link_type or "") == "Report" and (row.link_to or "") in blocked_reports:
            continue

        if _is_allowed_link(row, visible_doctypes, visible_reports, visible_pages):
            kept.append(row)
        # else: dropped

    kept = _drop_empty_card_breaks(kept)

    if len(kept) != len(original):
        doc.links = kept
        _renumber(doc.links)
        return True
    return False


def _drop_empty_card_breaks(rows):
    """
    Remove Card Break headers that have no Link rows before the next Card Break.
    Keeps the UI clean (no empty section titles) after children were stripped.
    """
    result = []
    i = 0
    n = len(rows)
    while i < n:
        row = rows[i]
        if (row.type or "").strip() == _CARD_BREAK_TYPE:
            # Look ahead: is there at least one Link before the next Card Break?
            has_child = False
            j = i + 1
            while j < n and (rows[j].type or "").strip() != _CARD_BREAK_TYPE:
                if (rows[j].type or "").strip() == _LINK_ROW_TYPE:
                    has_child = True
                    break
                j += 1
            if has_child:
                result.append(row)
            # else: skip this empty Card Break header
        else:
            result.append(row)
        i += 1
    return result


def _prune_shortcuts(doc, visible_doctypes, visible_reports, visible_pages):
    """
    Rebuild doc.shortcuts keeping only those pointing at whitelisted targets.
    Shortcut rows use `type` (DocType/Report/Page/URL) and `link_to`.
    Returns True if anything was removed.
    """
    original = list(doc.shortcuts)
    kept = []

    for sc in original:
        sc_type = (sc.type or "").strip()
        link_to = (sc.link_to or "").strip()

        if sc_type == "DocType":
            if link_to in visible_doctypes:
                kept.append(sc)
        elif sc_type == "Report":
            if link_to in visible_reports:
                kept.append(sc)
        elif sc_type == "Page":
            if link_to in visible_pages:
                kept.append(sc)
        else:
            # URL / dashboard / unknown — leave untouched.
            kept.append(sc)

    if len(kept) != len(original):
        doc.shortcuts = kept
        _renumber(doc.shortcuts)
        return True
    return False


def _renumber(child_rows):
    """Re-sequence child-table idx values after rows were removed (1-based)."""
    for i, row in enumerate(child_rows, start=1):
        row.idx = i
