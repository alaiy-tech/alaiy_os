/**
 * AlaiyOS — Shared UI Utilities
 *
 * - Hides Frappe's default navbar user-menu button and injects a custom
 *   dropdown with: Toggle Sidebar, Toggle Width, Reload, About, Logout.
 * - Renders a custom About modal (no Frappe modal dependency).
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

// ── Custom About Modal ────────────────────────────────────────────────────────

function _buildAboutModal() {
  if (document.getElementById("alaiy-about-modal")) return;

  const overlay = document.createElement("div");
  overlay.id = "alaiy-about-modal";
  overlay.style.cssText = [
    "display:none;position:fixed;inset:0;z-index:9999",
    "background:rgba(0,0,0,0.45);align-items:center;justify-content:center",
  ].join(";");

  overlay.innerHTML = [
    '<div style="background:#fff;border-radius:12px;padding:32px 36px;max-width:420px;width:90%;',
    'font-family:Poppins,sans-serif;position:relative;box-shadow:0 8px 40px rgba(0,0,0,0.18)">',
    '  <button id="alaiy-about-close" style="position:absolute;top:12px;right:16px;background:none;',
    '    border:none;font-size:20px;cursor:pointer;color:#64748b;line-height:1">&times;</button>',
    '  <img src="/assets/alaiy_os_core/images/logo-hor.png" alt="Alaiy OS"',
    '    style="height:28px;display:block;margin-bottom:10px">',
    '  <p style="margin:0 0 20px;font-size:13px;color:#64748b">An AI-native E-Commerce OS</p>',
    '  <div style="display:flex;gap:12px;margin-bottom:20px">',
    '    <a href="https://alaiy.com" target="_blank" rel="noopener noreferrer"',
    '      style="color:#0891b2;font-size:13px;text-decoration:none">Website</a>',
    '    <a href="https://github.com/alaiy-tech" target="_blank" rel="noopener noreferrer"',
    '      style="color:#0891b2;font-size:13px;text-decoration:none">GitHub</a>',
    '  </div>',
    '  <p style="margin:0;font-size:12px;color:#94a3b8">',
    '    Built with &#10084;&#65039; by <a href="https://alaiy.com" target="_blank"',
    '    rel="noopener noreferrer" style="color:#0891b2">Alaiy</a>',
    '  </p>',
    '</div>',
  ].join("");

  document.body.appendChild(overlay);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) overlay.style.display = "none";
  });
  document.getElementById("alaiy-about-close").addEventListener("click", function () {
    overlay.style.display = "none";
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") overlay.style.display = "none";
  });
}

function _showAboutModal() {
  _buildAboutModal();
  var m = document.getElementById("alaiy-about-modal");
  if (m) m.style.display = "flex";
}

// ── Custom Navbar Dropdown ────────────────────────────────────────────────────

function _injectCustomNavbar() {
  if (document.getElementById("alaiy-nav-btn")) return;

  // Hide Frappe's existing user-menu / navbar-user trigger
  // (server-rendered; CSS is the only reliable approach)
  var style = document.createElement("style");
  style.id = "alaiy-hide-frappe-nav";
  style.textContent = [
    // Hide the default user/avatar button in the top navbar
    ".navbar .navbar-nav .nav-item.dropdown:has(.navbar-avatar),",
    ".navbar .navbar-nav .nav-item.dropdown:has([data-toggle='dropdown']),",
    ".navbar-right .dropdown { display: none !important; }",
  ].join("\n");
  document.head.appendChild(style);

  // Build custom button + dropdown
  var btn = document.createElement("button");
  btn.id = "alaiy-nav-btn";
  btn.title = "Menu";
  btn.style.cssText = [
    "background:none;border:none;cursor:pointer;padding:6px 10px",
    "color:var(--text-color,#1c2126);display:flex;align-items:center",
    "gap:6px;font-family:Poppins,sans-serif;font-size:13px;border-radius:6px",
  ].join(";");
  btn.innerHTML = [
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    '  <circle cx="12" cy="8" r="1.5" fill="currentColor"/>',
    '  <circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    '  <circle cx="12" cy="16" r="1.5" fill="currentColor"/>',
    '</svg>',
  ].join("");

  var menu = document.createElement("div");
  menu.id = "alaiy-nav-menu";
  menu.style.cssText = [
    "display:none;position:absolute;top:calc(100% + 4px);right:0",
    "background:#fff;border:1px solid var(--border-color,#e2e8f0);border-radius:8px",
    "box-shadow:0 4px 20px rgba(0,0,0,0.10);min-width:180px;z-index:1050",
    "font-family:Poppins,sans-serif;padding:4px 0",
  ].join(";");

  function _menuItem(label, onClick) {
    var li = document.createElement("button");
    li.textContent = label;
    li.style.cssText = [
      "display:block;width:100%;padding:9px 16px;background:none;border:none",
      "text-align:left;font-size:13px;cursor:pointer;color:var(--text-color,#1c2126)",
      "font-family:Poppins,sans-serif",
    ].join(";");
    li.addEventListener("mouseenter", function () { li.style.background = "var(--control-bg,#f4f5f6)"; });
    li.addEventListener("mouseleave", function () { li.style.background = "none"; });
    li.addEventListener("click", function () {
      menu.style.display = "none";
      onClick();
    });
    return li;
  }

  function _divider() {
    var d = document.createElement("div");
    d.style.cssText = "height:1px;background:var(--border-color,#e2e8f0);margin:4px 0";
    return d;
  }

  menu.appendChild(_menuItem("Toggle Sidebar", function () {
    var toggleBtn = document.querySelector(".collapse-sidebar-link, .btn-collapse-sidebar");
    if (toggleBtn) toggleBtn.click();
  }));
  menu.appendChild(_menuItem("Toggle Full Width", function () {
    if (frappe.ui && frappe.ui.toolbar && frappe.ui.toolbar.toggle_full_width) {
      frappe.ui.toolbar.toggle_full_width();
    }
  }));
  menu.appendChild(_menuItem("Reload", function () {
    window.location.reload();
  }));
  menu.appendChild(_divider());
  menu.appendChild(_menuItem("About", function () {
    _showAboutModal();
  }));
  menu.appendChild(_divider());
  menu.appendChild(_menuItem("Logout", function () {
    frappe.app.logout ? frappe.app.logout() : (window.location.href = "/logout");
  }));

  var wrapper = document.createElement("div");
  wrapper.id = "alaiy-nav-wrapper";
  wrapper.style.cssText = "position:relative;display:flex;align-items:center";
  wrapper.appendChild(btn);
  wrapper.appendChild(menu);

  // Toggle menu on button click
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    var visible = menu.style.display === "block";
    menu.style.display = visible ? "none" : "block";
  });

  // Close on outside click
  document.addEventListener("click", function () {
    menu.style.display = "none";
  });

  // Inject into navbar — try common Frappe navbar selectors
  function _tryInject() {
    var target =
      document.querySelector(".navbar-right") ||
      document.querySelector(".navbar .navbar-nav.ml-auto") ||
      document.querySelector(".navbar .container > .navbar-collapse");
    if (!target) return false;
    target.appendChild(wrapper);
    return true;
  }

  if (!_tryInject()) {
    // Retry after short delay in case Frappe renders navbar late
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      if (_tryInject() || attempts > 10) clearInterval(iv);
    }, 200);
  }
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
  _injectCustomNavbar();
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
