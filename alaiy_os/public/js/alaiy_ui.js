/**
 * AlaiyOS — Shared UI Utilities
 *
 * Depends on:
 *   constants/roles.js
 *   constants/route_titles.js
 */

// ── Page-container failsafe ───────────────────────────────────────────────────

function _ensurePageVisible() {
  let attempts = 0;

  const interval = setInterval(() => {
    attempts++;

    const pc = document.querySelector(".page-container");
    const splash = document.querySelector(".centered.splash");

    if (pc && getComputedStyle(pc).display === "none") {
      pc.style.removeProperty("display");
    }

    if (splash && getComputedStyle(splash).display !== "none") {
      splash.style.display = "none";
    }

    if ((pc && pc.offsetHeight > 0) || attempts >= 10) {
      clearInterval(interval);
    }
  }, 500);
}

$(document).on("app_ready", function () {
  _ensurePageVisible();
});

// ── Title helpers ─────────────────────────────────────────────────────────────

window.updateAlaiyTitle = function (section) {
  document.title = `${section || "Dashboard"} | Alaiy OS`;
};

window.resolveAlaiySection = function (route) {
  if (!route) return "Dashboard";

  if (ALAIY_ROUTE_TITLES[route]) {
    return ALAIY_ROUTE_TITLES[route];
  }

  for (const entry of ALAIY_ROUTE_PREFIX_TITLES) {
    if (route.startsWith(entry.prefix)) {
      return entry.title;
    }
  }

  // Matched by route (stable), not workspace name — the Workspace doc is
  // renamed to match the current company branding.
  if (
    route === ALAIY_OS_ROUTE ||
    route.startsWith(ALAIY_OS_ROUTE + "/")
  ) {
    return "Dashboard";
  }

  return "Alaiy OS";
};