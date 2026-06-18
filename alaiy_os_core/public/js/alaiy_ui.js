/**
 * AlaiyOS — Shared UI Utilities
 *
 * Loaded after constants/ files in app_include_js, and before
 * route_guard.js and alaiy_settings.js.
 *
 * Depends on (loaded before this file):
 *   constants/roles.js         — ALAIY_OS_ROLES, ALAIY_OS_BYPASS, ALAIY_OS_WORKSPACE
 *   constants/route_titles.js  — ALAIY_ROUTE_TITLES, ALAIY_ROUTE_PREFIX_TITLES
 *
 * Exports (window globals used by other modules):
 *   updateAlaiyTitle(section)   — sets document.title to the brand format
 *   resolveAlaiySection(route)  — maps a Frappe route string to a section label
 */

// ── User check ────────────────────────────────────────────────────────────────
// Returns true for AlaiyOS-only users; false for admins/system managers.
function _isAlaiyUser() {
  const roles = frappe.user_roles || [];
  if (ALAIY_OS_BYPASS.some((r) => roles.includes(r))) return false;
  return ALAIY_OS_ROLES.some((r) => roles.includes(r));
}

// ── Company name helper ───────────────────────────────────────────────────────
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
  if ($m.find(".alaiy-about-patched").length) return; // already patched

  // ── Logo: replace Frappe wordmark with alaiyOS logo ──
  $m.find(".about-frappe-wordmark")
    .attr("src", "/assets/alaiy_os_core/images/alaiy/logo-hor.png")
    .attr("alt", "Alaiy OS")
    .css({ height: "28px", width: "auto" });

  // ── Tagline ───────────────────────────────────────────
  $m.find(".about-tagline").text("An AI-native E-Commerce OS");

  // ── Social buttons: update URLs, remove Forum ─────────
  $m.find("a.about-icon-btn[href*='frappe.io']").attr("href", "https://alaiy.com");
  $m.find("a.about-icon-btn[href*='github.com']").attr("href", "https://github.com/alaiy-tech");
  // Remove forum button (message-circle icon)
  $m.find("a.about-icon-btn[href*='discuss']").remove();
  $m.find("a.about-icon-btn").filter(function () {
    return $(this).find("use[href*='message-circle'], use[xlink\\:href*='message-circle']").length > 0;
  }).remove();

  // ── Footer copyright → Built with ❤️ by Alaiy ────────
  $m.find(".about-footer").html(
    'Built with \u2764\ufe0f by <a href="https://alaiy.com" target="_blank" rel="noopener noreferrer">Alaiy</a>'
  );

  // ── Remove version/installed-apps rows ────────────────
  $m.find(".about-info-rows, .about-info-row, .about-section-label, #about-app-versions").remove();

  // Mark patched
  $m.find(".about-body").append('<span class="alaiy-about-patched" style="display:none"></span>');
}

function _startAboutModalObserver() {
  if (window._alaiyAboutObserver) return;

  // Bootstrap modal shown event — fires reliably in Frappe v16
  $(document).on("shown.bs.modal.alaiy", ".modal", function () {
    _patchAboutModal(this);
  });

  // MutationObserver fallback for Frappe dialogs that bypass Bootstrap
  window._alaiyAboutObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mut) {
      mut.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        var targets = [node].concat(
          Array.from(node.querySelectorAll ? node.querySelectorAll(".modal, .frappe-dialog") : [])
        );
        targets.forEach(function (el) {
          if (el.classList.contains("modal") || el.classList.contains("frappe-dialog")) {
            requestAnimationFrame(function () { _patchAboutModal(el); });
          }
        });
      });
    });
  });
  window._alaiyAboutObserver.observe(document.body, { childList: true, subtree: true });
}

// ── Navbar / sidebar dropdown patch ──────────────────────────────────────────
// Removes items that are irrelevant for AlaiyOS-only users:
//   • "Desktop"         — link back to /desk (not relevant inside AlaiyOS)
//   • "Workspaces"      — link to workspace switcher (AlaiyOS users have one workspace)
//   • "Website"         — link to public website frontend
//   • "Frappe Support"  — sub-item under Help (Frappe-specific)

function _patchNavbarDropdown() {
  if (!_isAlaiyUser()) return;

  var REMOVE_LABELS = ["Desktop", "Workspaces", "Website"];

  // Remove items whose exact text matches REMOVE_LABELS
  $("a").filter(function () {
    return REMOVE_LABELS.indexOf($(this).text().trim()) !== -1;
  }).each(function () {
    var $li = $(this).closest("li");
    ($li.length ? $li : $(this)).remove();
  });

  // Remove "Frappe Support" sub-item under Help
  $("a").filter(function () {
    return /^frappe\s+support$/i.test($(this).text().trim());
  }).each(function () {
    var $li = $(this).closest("li");
    ($li.length ? $li : $(this)).remove();
  });

  // Also catch it by href
  $("a[href*='support.frappe.io']").each(function () {
    var $li = $(this).closest("li");
    ($li.length ? $li : $(this)).remove();
  });

  // Clean up stacked/leading/trailing dividers that become orphaned
  $(".dropdown-divider + .dropdown-divider").remove();
  $(".dropdown-menu .dropdown-divider:first-child").remove();
  $(".dropdown-menu .dropdown-divider:last-child").remove();
}

function _startNavDropdownObserver() {
  if (window._alaiyNavDropInited) return;
  window._alaiyNavDropInited = true;

  // Re-run whenever any Bootstrap dropdown opens
  $(document).on("shown.bs.dropdown.alaiy", function () {
    setTimeout(_patchNavbarDropdown, 0);
  });

  // Also patch whenever a new dropdown-menu is inserted (Frappe renders lazily)
  var obs = new MutationObserver(function (mutations) {
    var needed = false;
    mutations.forEach(function (mut) {
      mut.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (
          (node.classList && node.classList.contains("dropdown-menu")) ||
          (node.querySelector && node.querySelector(".dropdown-menu"))
        ) {
          needed = true;
        }
      });
    });
    if (needed) setTimeout(_patchNavbarDropdown, 50);
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // Initial pass (handles anything already rendered at app_ready)
  setTimeout(_patchNavbarDropdown, 0);
}

// ── Page-container failsafe ───────────────────────────────────────────────────
// If socket.io fails the promise rejects and page.show() is never called —
// leaving the workspace hidden under the splash screen.  Poll briefly.
function _ensurePageVisible() {
  var attempts = 0;
  var interval = setInterval(function () {
    attempts++;
    var pc     = document.querySelector(".page-container");
    var splash = document.querySelector(".centered.splash");
    if (pc && getComputedStyle(pc).display === "none") {
      pc.style.removeProperty("display");
      pc.style.display = "block";
    }
    if (splash && getComputedStyle(splash).display !== "none") {
      splash.style.display = "none";
    }
    if ((pc && pc.offsetHeight > 0) || attempts >= 10) {
      clearInterval(interval);
    }
  }, 500);
}

// ── Wire patches ──────────────────────────────────────────────────────────────

$(document).on("app_ready", function () {
  _startAboutModalObserver();
  _startNavDropdownObserver();
  _ensurePageVisible();
});

// ── Title helpers ─────────────────────────────────────────────────────────────

/**
 * Set the browser tab title to:
 *   "<Company> OS — <section> | Alaiy OS"
 *
 * @param {string|null} section  e.g. "Sales Order", "Catalog · Products".
 */
// eslint-disable-next-line no-unused-vars
function updateAlaiyTitle(section) {
  const prefix = _getAlaiyTitlePrefix();
  document.title =
    prefix + " — " + (section || "Dashboard") + " | Alaiy OS";
}

/**
 * Resolve a Frappe route string to an AlaiyOS section label.
 * Called by route_guard.js on every navigation.
 *
 * @param {string} route  frappe.get_route_str() value.
 * @returns {string}
 */
// eslint-disable-next-line no-unused-vars
function resolveAlaiySection(route) {
  if (!route) return "Dashboard";

  if (ALAIY_ROUTE_TITLES[route]) return ALAIY_ROUTE_TITLES[route];

  for (const entry of ALAIY_ROUTE_PREFIX_TITLES) {
    if (route.startsWith(entry.prefix)) return entry.title;
  }

  if (route.startsWith("os") ||
      route === "Workspaces/" + ALAIY_OS_WORKSPACE) return "Dashboard";

  return "Alaiy OS";
}
