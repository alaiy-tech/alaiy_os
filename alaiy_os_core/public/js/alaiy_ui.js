/**
 * AlaiyOS — Shared UI Utilities
 *
 * - Exposes updateAlaiyTitle() and resolveAlaiySection() for route_guard.js.
 *
 * Depends on (loaded before this file):
 *   constants/roles.js        — ALAIY_OS_ROUTE, ALAIY_OS_WORKSPACE
 *   constants/route_titles.js — ALAIY_ROUTE_TITLES, ALAIY_ROUTE_PREFIX_TITLES
 */

// ── Company name helper ───────────────────────────────────────────────────────
function _getAlaiyTitlePrefix() {
  const company =
    (frappe.boot &&
      frappe.boot.sysdefaults &&
      frappe.boot.sysdefaults.company) ||
    null;
  return company ? company + " OS" : "Alaiy OS";
}

// ── Page-container failsafe ───────────────────────────────────────────────────
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
  _ensurePageVisible();
});

// ── Title helpers ─────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
function updateAlaiyTitle(section) {
  const prefix = _getAlaiyTitlePrefix();
  document.title = prefix + " — " + (section || "Dashboard") + " | Alaiy OS";
}

// eslint-disable-next-line no-unused-vars
function resolveAlaiySection(route) {
  if (!route) return "Dashboard";
  if (ALAIY_ROUTE_TITLES[route]) return ALAIY_ROUTE_TITLES[route];
  for (const entry of ALAIY_ROUTE_PREFIX_TITLES) {
    if (route.startsWith(entry.prefix)) return entry.title;
  }
  if (route.startsWith("os") || route === "Workspaces/" + ALAIY_OS_WORKSPACE)
    return "Dashboard";
  return "Alaiy OS";
}
