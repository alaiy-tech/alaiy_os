/**
 * AlaiyOS — Shared UI Utilities
 *
 * Loaded after constants/ files in app_include_js, and before
 * route_guard.js and alaiy_settings.js.
 *
 * Depends on (loaded before this file):
 *   constants/route_titles.js  — ALAIY_ROUTE_TITLES, ALAIY_ROUTE_PREFIX_TITLES
 *
 * Exports (window globals, used by route_guard.js and alaiy_settings.js):
 *   updateAlaiyTitle(section)   — sets document.title to the brand format
 *   resolveAlaiySection(route)  — maps a Frappe route string to a section label
 */

// ── Company name helper ───────────────────────────────────────────────────────
// Reads the ERPNext default company from frappe.boot, appends " OS" to form
// the page-title prefix.  e.g. company "Alto Moda" → prefix "Alto Moda OS".
// Falls back to "Alaiy OS" if boot data is not available (e.g. login page).
function _getAlaiyTitlePrefix() {
  const company =
    (frappe.boot &&
      frappe.boot.sysdefaults &&
      frappe.boot.sysdefaults.company) ||
    null;
  return company ? company + " OS" : "Alaiy OS";
}

// ── About modal patch ─────────────────────────────────────────────────────────

function _patchAboutModal(modalEl) {
  const $m = $(modalEl);
  if ($m.find(".modal-title").first().text().trim() !== "About") return;

  // Remove Frappe Framework version row and Installed Apps label
  $m.find(".about-info-rows, .about-info-row, .about-section-label").remove();

  // Replace app-versions list with Alaiy attribution
  const $av = $m.find("#about-app-versions");
  if ($av.length) {
    $av.html(
      '<p style="margin:16px 0 0;font-size:13px;color:var(--text-muted)">' +
        'Built by <a href="https://alaiy.com" target="_blank" rel="noopener noreferrer">Alaiy</a>' +
      "</p>"
    );
  }
}

function _startAboutModalObserver() {
  if (window._alaiyAboutObserver) return;
  window._alaiyAboutObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mut) {
      mut.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.classList.contains("modal") || node.classList.contains("frappe-dialog")) {
          requestAnimationFrame(function () { _patchAboutModal(node); });
        }
      });
    });
  });
  window._alaiyAboutObserver.observe(document.body, { childList: true });
}

// ── Sidebar header patch ──────────────────────────────────────────────────────

function _patchSidebarHeader() {
  const company =
    (frappe.boot && frappe.boot.sysdefaults && frappe.boot.sysdefaults.company) || "Alaiy";
  const titleText = company + " OS";

  $(".sidebar-header").each(function () {
    const $h = $(this);

    // Replace icon with logo-square.png (only once per element)
    const $icon = $h.find(".sidebar-item-icon");
    if ($icon.length && !$icon.find(".alaiy-logo-img").length) {
      $icon.empty().append(
        $('<img class="alaiy-logo-img">')
          .attr("src", "/assets/alaiy_os_core/images/logo-square.png")
          .attr("alt", "Logo")
          .css({ width: "28px", height: "28px", objectFit: "contain", borderRadius: "4px" })
      );
    }

    // Header title: "{Company} OS"
    const $title = $h.find(".header-title");
    if ($title.length && $title.text().trim() !== titleText) $title.text(titleText);

    // Header subtitle: "Alaiy OS"
    const $sub = $h.find(".header-subtitle");
    if ($sub.length && $sub.text().trim() !== "Alaiy OS") $sub.text("Alaiy OS");
  });
}

// ── Getting Started / Onboarding hider ───────────────────────────────────────

function _hideGettingStarted() {
  $(".onb-panel, .onboarding-widget-box, .ws-onboarding, .onboarding-status").hide();
  $(".sidebar-item-getting-started, [data-label='Getting Started']").hide();
  $(".standard-sidebar-item, .sidebar-item").filter(function () {
    return $(this).text().trim() === "Getting Started";
  }).hide();
}

// ── Wire all patches ──────────────────────────────────────────────────────────

$(document).on("app_ready", function () {
  _startAboutModalObserver();
  _patchSidebarHeader();
  _hideGettingStarted();
});

$(document).on("page-change", function () {
  _patchSidebarHeader();
  _hideGettingStarted();
  setTimeout(function () { _patchSidebarHeader(); _hideGettingStarted(); }, 400);
});

// ── Title helpers ─────────────────────────────────────────────────────────────

/**
 * Set the browser tab title to:
 *   "<Company> OS — <section> | Alaiy OS"
 *
 * The company name is read live from frappe.boot each time so it stays
 * correct across page loads without a hard-coded constant.
 *
 * @param {string|null} section  e.g. "Stock", "Settings · Selling".
 *   Pass null / undefined to reset to "Dashboard".
 */
// eslint-disable-next-line no-unused-vars
function updateAlaiyTitle(section) {
  const prefix = _getAlaiyTitlePrefix();
  document.title =
    prefix + " \u2014 " + (section || "Dashboard") + " | Alaiy OS";
}

/**
 * Resolve a Frappe route string to an AlaiyOS section label.
 * Called by route_guard.js on every navigation.
 *
 * Uses ALAIY_ROUTE_TITLES and ALAIY_ROUTE_PREFIX_TITLES from
 * constants/route_titles.js (loaded before this file).
 *
 * @param {string} route  frappe.get_route_str() value.
 * @returns {string}
 */
// eslint-disable-next-line no-unused-vars
function resolveAlaiySection(route) {
  if (!route) return "Dashboard";

  // Exact match
  if (ALAIY_ROUTE_TITLES[route]) return ALAIY_ROUTE_TITLES[route];

  // Prefix match (Form/*)
  for (const entry of ALAIY_ROUTE_PREFIX_TITLES) {
    if (route.startsWith(entry.prefix)) return entry.title;
  }

  // Workspace root and settings panel (title managed by alaiy_settings.js)
  if (route.startsWith("alaiy-os")) return "Dashboard";

  return "Alaiy OS";
}
