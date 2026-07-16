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
// "Ask Alaiy" needs no special-casing here anymore: its Workspace Shortcut
// record is correctly configured (type: Page, link_to: ask-alaiy), so it
// navigates to /app/ask-alaiy natively, same as any other shortcut.
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
  if (!label) return;

  if (ALAIY_SKIP_LABELS.has(label)) return;

  const doctype =
    ALAIY_LABEL_TO_DOCTYPE[label] ||
    (target.getAttribute && target.getAttribute("data-doctype")) ||
    null;
  if (!doctype) return;

  e.preventDefault();
  e.stopPropagation();
  AW.openList(doctype);
};

// ── "Ask Alaiy" active-tab state — reuses .active-sidebar, the exact class
// Frappe's own link-type sidebar items get when selected (already themed:
// see .standard-sidebar-item.active-sidebar in OS Theme Settings' CSS). Our
// item is a JS-handled "action", not a real link, so nothing gives it this
// automatically — set it ourselves on every route change. ──────────────────
AW._syncAskAlaiyActiveState = function () {
  const items = document.querySelectorAll(
    ".standard-sidebar-item, .sidebar-item-container",
  );
  for (const el of items) {
    if (_labelFrom(el) === "Ask Alaiy") {
      el.classList.toggle("active-sidebar", frappe.get_route_str() === "ask-alaiy");
      break;
    }
  }
};

// ── Init ──────────────────────────────────────────────────────────────────────
AW.init = function () {
  if (AW._inited) return;
  AW._inited = true;
  document.addEventListener("click", AW._onCapture, true);
  frappe.router.on("change", AW._syncAskAlaiyActiveState);
  AW._syncAskAlaiyActiveState();
};

$(document).on("app_ready", function () {
  AW.init();
});
