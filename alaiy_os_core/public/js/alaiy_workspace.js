// Intercepts workspace sidebar/card clicks and routes to the DocType list view.

frappe.provide("alaiy_os.workspace");

const AW = alaiy_os.workspace;
AW._inited = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
function _isOsPath(path) {
  if (!path) return false;
  // Matched by route (stable), not workspace name — the Workspace doc is
  // renamed to match the current company branding.
  return (
    path === `/desk/${ALAIY_OS_ROUTE}` ||
    path.startsWith(`/desk/${ALAIY_OS_ROUTE}/`)
  );
}

function _labelFrom(el) {
  const dl = el.getAttribute && el.getAttribute("data-label");
  if (dl && dl.trim()) return dl.trim();

  const selectors = [
    ".link-item-label",
    ".widget-title",
    ".shortcut-widget-box .widget-head .widget-title",
    ".item-name",
    ".sidebar-item-label",
    "span",
  ];
  for (const sel of selectors) {
    const child = el.querySelector(sel);
    if (child && child.textContent) {
      const t = child.textContent.trim().split("\n")[0].trim();
      if (t) return t;
    }
  }
  return (el.textContent || "").trim().split("\n")[0].trim();
}

// ── Navigate to DocType list ──────────────────────────────────────────────────
AW.openList = function (doctype) {
  frappe.set_route("List", doctype);
};

// ── Capture-phase click interceptor ──────────────────────────────────────────
AW._onCapture = function (e) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

  const path = window.location.pathname;
  if (!_isOsPath(path)) return;

  const target = e.target.closest
    ? e.target.closest(
        ".link-item, .workspace-link-item, .shortcut-widget-box, " +
          ".workspace-shortcut-card, [data-doctype], " +
          ".standard-sidebar-item, .workspace-sidebar-item, " +
          ".sidebar-item-container",
      )
    : null;
  if (!target) return;

  const label = _labelFrom(target);
  if (!label || ALAIY_SKIP_LABELS.has(label)) return;

  const doctype =
    ALAIY_LABEL_TO_DOCTYPE[label] ||
    (target.getAttribute && target.getAttribute("data-doctype")) ||
    null;
  if (!doctype) return;

  e.preventDefault();
  e.stopPropagation();
  AW.openList(doctype);
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
