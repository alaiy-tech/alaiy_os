import json

import frappe

from alaiy_os.constants.workspace import WORKSPACE_SIDEBAR_ITEMS


def _to_sidebar_config(items):
	"""Derive the JS click-router's config shape from WORKSPACE_SIDEBAR_ITEMS.

	WORKSPACE_SIDEBAR_ITEMS is written in the shape Frappe's Workspace Sidebar
	rows need (type/link_type/link_to/child/indent/icon). The JS click
	interceptor (public/js/alaiy_workspace.js) only needs to know, per label,
	whether it's a section header, a DocType link (and if so which DocType),
	or anything else it should leave alone (a Workspace link, e.g. "Settings"
	or the top "Ask Alaiy"/"Dashboard"/"My Pinned" actions) — so this is a
	pure, deterministic reshaping of the one list of items, not a second copy
	of the data itself.
	"""
	config = []
	for item in items:
		label = item.get("label")
		if not label:
			continue
		if item.get("type") == "Section Break":
			config.append({"label": label, "type": "section", "icon": item.get("icon")})
		elif item.get("type") == "Link" and item.get("link_type") == "DocType":
			config.append({
				"label": label,
				"type": "link",
				"doctype": item.get("link_to"),
				"icon": item.get("icon"),
			})
		else:
			# Workspace links (and anything else) navigate on their own —
			# the click interceptor must not hijack them to a DocType list.
			config.append({"label": label, "type": "action", "icon": item.get("icon")})
	return config


@frappe.whitelist(allow_guest=True)
def sidebar_config_js():
	"""
	Serve the OS workspace sidebar's click-router config as JS, generated
	fresh from constants/workspace.py:WORKSPACE_SIDEBAR_ITEMS on every
	request — the single source of truth for both the DB-provisioned
	sidebar (setup/install.py) and this JS. There is deliberately no
	public/constants/workspace_config.js file to keep in sync by hand.
	"""
	config = _to_sidebar_config(WORKSPACE_SIDEBAR_ITEMS)

	js = f"""/* Generated from alaiy_os.constants.workspace.WORKSPACE_SIDEBAR_ITEMS —
 * do not edit by hand, and do not add a public/constants/workspace_config.js
 * file. Change the sidebar in constants/workspace.py instead. */
/* eslint-disable no-unused-vars */
const ALAIY_SIDEBAR_CONFIG = {json.dumps(config)};

// ── Derived lookups ────────────────────────────────────────────────────────

// label -> DocType for every "link" entry
const ALAIY_LABEL_TO_DOCTYPE = {{}};
ALAIY_SIDEBAR_CONFIG.forEach(function (item) {{
  if (item.type === "link" && item.doctype) {{
    ALAIY_LABEL_TO_DOCTYPE[item.label] = item.doctype;
  }}
}});

// Labels that should NOT open the overlay (actions + section headers)
const ALAIY_SKIP_LABELS = new Set(
  ALAIY_SIDEBAR_CONFIG.filter(function (item) {{
    return item.type !== "link";
  }}).map(function (item) {{
    return item.label;
  }}),
);
/* eslint-enable no-unused-vars */
"""

	frappe.response["type"] = "download"
	frappe.response["filename"] = "workspace_config.js"
	frappe.response["filecontent"] = js
	frappe.response["content_type"] = "application/javascript"
	frappe.response["display_content_as"] = "inline"
