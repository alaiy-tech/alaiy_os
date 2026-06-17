/**
 * AlaiyOS Workspace Content Loader
 *
 * Intercepts workspace card / shortcut clicks for AlaiyOS users using a
 * capture-phase listener (fires before Frappe's bubble-phase jQuery handlers).
 * Instead of navigating to a DocType page, renders a list → form view inside
 * a full-height overlay within the workspace container.
 *
 * Route stays at /app/alaiy-os throughout — route_guard.js is never triggered.
 *
 * Depends on (loaded before this file):
 *   constants/roles.js — ALAIY_OS_ROLES, ALAIY_OS_BYPASS, ALAIY_OS_ROUTE
 *   alaiy_ui.js        — updateAlaiyTitle()
 */

frappe.provide("alaiy_os.workspace");

// ── Label → DocType map  ──────────────────────────────────────────────────────
// Mirrors WORKSPACE_LINKS labels in constants/workspace.py — keep in sync.
/* eslint-disable no-unused-vars */
const ALAIY_LABEL_TO_DOCTYPE = {
  "Stock Entry":          "Stock Entry",
  "Products":             "Item",
  "Item Group":           "Item Group",
  "Item Attribute":       "Item Attribute",
  "Item Price":           "Item Price",
  "Item Variant Details": "Item Variant Attribute",
  "Brand":                "Brand",
  "Stock Reconciliation": "Stock Reconciliation",
  "Purchase Receipt":     "Purchase Receipt",
  "Sales Order":          "Sales Order",
  "Sales Invoice":        "Sales Invoice",
  "Price List":           "Price List",
  "Pricing Rule":         "Pricing Rule",
  "Customers":            "Customer",
  "Customer Groups":      "Customer Group",
  "Address":              "Address",
  "Contact":              "Contact",
  "UTM Source":           "UTM Source",
  "Purchase Order":       "Purchase Order",
  "Purchase Invoice":     "Purchase Invoice",
  "Supplier":             "Supplier",
  "Supplier Group":       "Supplier Group",
  "Contacts":             "Contact",
};
/* eslint-enable no-unused-vars */

// Clicks on these labels are handled by alaiy_settings.js or are placeholders
const _SKIP_LABELS = new Set([
  "Settings", "Ask AlaiyOS", "Dashboard", "My Pinned", "Reports & Analytics",
]);

// ── Module state ──────────────────────────────────────────────────────────────
const AW = alaiy_os.workspace;
AW._overlay   = null;
AW._doctype   = null;
AW._inited    = false;

// ── User check ────────────────────────────────────────────────────────────────
function _isAlaiyWsUser() {
  const roles = frappe.user_roles || [];
  if (ALAIY_OS_BYPASS.some((r) => roles.includes(r))) return false;
  return ALAIY_OS_ROLES.some((r) => roles.includes(r));
}

// ── Label extraction ──────────────────────────────────────────────────────────
function _labelFrom(el) {
  const selectors = [
    ".link-item-label",
    ".widget-title",
    ".shortcut-widget-box .widget-head .widget-title",
    ".item-name",
    "span",
  ];
  for (const sel of selectors) {
    const child = el.querySelector(sel);
    if (child && child.textContent) {
      const t = child.textContent.trim().split("\n")[0].trim();
      if (t) return t;
    }
  }
  return (el.getAttribute("data-label") || el.textContent || "").trim().split("\n")[0].trim();
}

// ── Overlay management ────────────────────────────────────────────────────────
AW._ensureOverlay = function () {
  const ws = document.querySelector(
    ".workspace-container, .layout-main-section, .page-content"
  );
  if (!ws) return null;

  if (!AW._overlay || !document.body.contains(AW._overlay)) {
    const el = document.createElement("div");
    el.id = "alaiy-ws-content";
    if (getComputedStyle(ws).position === "static") ws.style.position = "relative";
    ws.appendChild(el);
    AW._overlay = el;
  }
  return AW._overlay;
};

AW.close = function () {
  if (AW._overlay) AW._overlay.classList.remove("visible");
  AW._doctype = null;
  if (typeof updateAlaiyTitle === "function") updateAlaiyTitle("Dashboard");
};

// ── List view ─────────────────────────────────────────────────────────────────
AW.openList = function (doctype, label) {
  AW._doctype = doctype;
  const overlay = AW._ensureOverlay();
  if (!overlay) return;

  overlay.className = "alaiy-ws-content visible";
  overlay.innerHTML = "";

  const header = document.createElement("div");
  header.className = "alaiy-ws-header";
  header.innerHTML =
    '<button class="alaiy-ws-back">← Back</button>' +
    '<span class="alaiy-ws-title">' + (label || doctype) + "</span>" +
    '<button class="btn btn-primary btn-sm alaiy-ws-new">＋ New</button>';
  overlay.appendChild(header);

  header.querySelector(".alaiy-ws-back").addEventListener("click", AW.close);
  header.querySelector(".alaiy-ws-new").addEventListener("click", function () {
    AW._newForm(doctype, label);
  });

  const body = document.createElement("div");
  body.className = "alaiy-ws-body";
  overlay.appendChild(body);

  AW._renderList(body, doctype, label);
  if (typeof updateAlaiyTitle === "function") updateAlaiyTitle(label || doctype);
};

AW._renderList = function (body, doctype, label) {
  body.innerHTML = '<div class="alaiy-ws-loading">Loading…</div>';

  frappe.call({
    method: "frappe.client.get_list",
    args: { doctype: doctype, fields: ["name", "modified"], limit_page_length: 100, order_by: "modified desc" },
    callback: function (r) {
      body.innerHTML = "";
      const rows = (r && r.message) || [];

      if (!rows.length) {
        body.innerHTML = '<div class="alaiy-ws-empty">No records. Click <strong>＋ New</strong> to create one.</div>';
        return;
      }

      const tbl = document.createElement("table");
      tbl.className = "alaiy-ws-table";
      tbl.innerHTML = "<thead><tr><th>Name</th><th>Last Modified</th></tr></thead>";
      const tb = document.createElement("tbody");

      rows.forEach(function (row) {
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        td1.textContent = row.name;
        const td2 = document.createElement("td");
        td2.textContent = frappe.datetime.str_to_user(row.modified);
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.addEventListener("click", function () {
          AW._openForm(body, doctype, row.name, label);
        });
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      body.appendChild(tbl);
    },
    error: function () {
      body.innerHTML = '<div class="text-danger" style="padding:20px">Could not load ' + doctype + ".</div>";
    },
  });
};

// ── Form view ─────────────────────────────────────────────────────────────────
AW._openForm = function (body, doctype, docname, label) {
  body.innerHTML =
    '<button class="btn btn-sm btn-default alaiy-ws-back" style="margin:16px 0 12px">' +
    "← Back to list</button>" +
    '<div class="alaiy-ws-form-host"></div>';

  body.querySelector(".alaiy-ws-back").addEventListener("click", function () {
    AW._renderList(body, doctype, label);
  });

  AW._mountForm(body.querySelector(".alaiy-ws-form-host"), doctype, docname);
};

AW._newForm = function (doctype, label) {
  const body = AW._overlay && AW._overlay.querySelector(".alaiy-ws-body");
  if (!body) return;
  const tempName = "new-" + frappe.model.scrub(doctype) + "-1";
  frappe.model.clear_doc(doctype, tempName);
  AW._openForm(body, doctype, tempName, label);
};

AW._mountForm = function (host, doctype, docname) {
  host.innerHTML = '<div class="alaiy-ws-loading">Loading form…</div>';

  frappe.model.with_doctype(doctype, function () {
    frappe.model.with_doc(doctype, docname, function () {
      host.innerHTML = "";

      const FormClass = frappe.ui && frappe.ui.form && frappe.ui.form.Form;
      if (typeof FormClass !== "function") {
        host.innerHTML =
          '<div class="text-danger" style="padding:20px">Form renderer unavailable.</div>';
        return;
      }
      try {
        const form = new FormClass(doctype, host, false);
        form.refresh(docname);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[AlaiyOS workspace] form render:", e);
        host.innerHTML =
          '<div class="text-warning" style="padding:20px">Could not render form: ' +
          (e.message || e) + ".</div>";
      }
    });
  });
};

// ── Capture-phase click interceptor ──────────────────────────────────────────
AW._onCapture = function (e) {
  if (!_isAlaiyWsUser()) return;

  // Only on the Alaiy OS workspace route.
  // frappe.get_route_str() returns "Workspaces/Alaiy OS" when on the workspace,
  // not the "alaiy-os" slug — use the URL path as the reliable check.
  const route = (frappe.get_route_str && frappe.get_route_str()) || "";
  const onWorkspace = window.location.pathname.includes("/" + ALAIY_OS_ROUTE) ||
                      route.startsWith(ALAIY_OS_ROUTE);
  if (!onWorkspace) return;

  // Never intercept clicks inside our own overlay
  if (e.target.closest && e.target.closest("#alaiy-ws-content")) return;

  // Find a workspace link or shortcut element in the ancestor chain
  const target = e.target.closest
    ? e.target.closest(
        ".link-item, .workspace-link-item, .shortcut-widget-box, " +
        ".workspace-shortcut-card, [data-doctype]"
      )
    : null;
  if (!target) return;

  const label = _labelFrom(target);
  if (!label || _SKIP_LABELS.has(label)) return;

  const doctype =
    ALAIY_LABEL_TO_DOCTYPE[label] ||
    (target.getAttribute && target.getAttribute("data-doctype")) ||
    null;
  if (!doctype) return;

  e.preventDefault();
  e.stopImmediatePropagation();
  AW.openList(doctype, label);
};

// ── Init ──────────────────────────────────────────────────────────────────────
AW.init = function () {
  if (AW._inited) return;
  AW._inited = true;
  document.addEventListener("click", AW._onCapture, true);
};

$(document).on("app_ready", function () {
  AW.init();
});
