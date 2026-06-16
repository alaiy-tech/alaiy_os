/* =========================================================
   AlaiyOS Core — Desk customisations
   Loaded on every Frappe Desk page via app_include_js.

   Config is read from frappe.boot.alaiy_config which is
   injected server-side by boot.py (extend_bootinfo hook).
   Defaults below match brand_config.py so the UI is never
   broken even if boot hasn't loaded yet.
   ========================================================= */

frappe.provide("alaiy_os_core");

/* ── CSS cache-buster ─────────────────────────────────────── */
/* The theme.css URL has no hash, so browsers cache it indefinitely.
   Replace it with a versioned URL so every JS reload picks up
   the latest CSS without requiring a manual hard-refresh. */
(function () {
  var CSS_PATH = "/assets/alaiy_os_core/config/theme.css";
  var ver = (frappe.boot && frappe.boot.app_version) || "1";
  var old = document.querySelector('link[href*="alaiy_os_core/config/theme.css"]');
  if (old) old.remove();
  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_PATH + "?v=" + ver;
  document.head.appendChild(link);
})();

/* ── Helpers ─────────────────────────────────────────────── */
alaiy_os_core.cfg = function () {
  return Object.assign(
    {
      hide_desktop_option: true,
      redirect_home_to_workspace: true,
      custom_theme: true,
      toggle_default_theme: false,
      visible_workspaces: ["Stock"],
      about_website_url: "https://alaiy.com",
      about_github_url: "https://github.com/alaiy-tech",
      about_footer_text: "Built with ♥ by Alaiy",
    },
    (frappe.boot && frappe.boot.alaiy_config) || {},
  );
};

/* =========================================================
   1. HOME REDIRECT
   ========================================================= */
$(document).on("page-change", function () {
  if (!alaiy_os_core.cfg().redirect_home_to_workspace) return;
  var route = frappe.get_route_str();
  if (!route || route === "home") {
    frappe.set_route(alaiy_os_core.cfg().visible_workspaces[0].toLowerCase());
  }
});

/* =========================================================
   2. ONE-TIME DESK INIT (topbar injection + About intercept)
   ========================================================= */
alaiy_os_core._init_desk = function () {
  if (alaiy_os_core._inited) return;
  alaiy_os_core._inited = true;
  alaiy_os_core.inject_topbar_widgets();
  alaiy_os_core.setup_about_intercept();
};

$(document).on("app_ready", function () {
  alaiy_os_core._init_desk();
});

/* =========================================================
   3. PER-PAGE CLEANUP (dropdown items, toggles)
      Runs on every route change because the navbar may
      re-render after SPA navigation.
   ========================================================= */
$(document).on("page-change", function () {
  alaiy_os_core.remove_desktop_from_dropdown();
  alaiy_os_core.hide_website_nav_item();
  alaiy_os_core.hide_theme_toggle();
});

/* ── 3a. Remove "Desktop" from the app-switcher dropdown ── */
alaiy_os_core.remove_desktop_from_dropdown = function () {
  if (!alaiy_os_core.cfg().hide_desktop_option) return;

  // href-based (most reliable)
  $('a[href="/desk"]')
    .closest("li, .dropdown-item, .app-item, .sidebar-item")
    .hide();

  // text-content fallback
  $(
    ".navbar .dropdown-menu li, .app-item-area .app-item, .sidebar-menu .sidebar-item",
  )
    .filter(function () {
      return $(this).text().replace(/\s+/g, "") === "Desktop";
    })
    .hide();
};

/* ── 3b. Remove "Website" from the app-switcher dropdown ── */
alaiy_os_core.hide_website_nav_item = function () {
  $('a[href="/website"]')
    .closest("li, .dropdown-item, .app-item, .sidebar-item")
    .hide();

  $(
    ".navbar .dropdown-menu li, .app-item-area .app-item, .sidebar-menu .sidebar-item",
  )
    .filter(function () {
      return $(this).text().trim() === "Website";
    })
    .hide();
};

/* ── 3c. Hide dark/light theme toggle ────────────────────── */
alaiy_os_core.hide_theme_toggle = function () {
  if (alaiy_os_core.cfg().toggle_default_theme) return;

  var sel = [
    ".switch-theme",
    ".btn-switch-theme",
    '[data-label="Switch Theme"]',
    '[data-original-title="Switch Theme"]',
    ".dark-mode-toggle",
    ".color-mode-switcher",
    ".theme-switcher",
    ".theme-control",
    "[data-action='switch_theme']",
    ".navbar [onclick*='switch_theme']",
  ].join(", ");
  $(sel).hide();

  // Text fallback
  $(".navbar .dropdown-menu li, .navbar-nav .nav-item")
    .filter(function () {
      var t = $(this).text().trim();
      return (
        t === "Switch Theme" || t === "Toggle Dark Mode" || t === "Dark Mode"
      );
    })
    .hide();
};

/* =========================================================
   4. TOPBAR: search bar + notification bell
   ========================================================= */
alaiy_os_core.inject_topbar_widgets = function () {
  if ($(".alaiy-topbar-search-wrap").length) return;

  // Find the right side of the navbar (works across Frappe v15/v16 layouts)
  var $target = $(".navbar .navbar-right").first();
  if (!$target.length) $target = $(".navbar-nav").last();
  if (!$target.length) $target = $(".navbar");

  // Search bar ─────────────────────────────────────────
  var $search = $(
    [
      '<li class="nav-item alaiy-topbar-search-wrap">',
      '  <div class="alaiy-search-bar" title="Search (Ctrl+K)">',
      '    <svg class="alaiy-search-icon" xmlns="http://www.w3.org/2000/svg"',
      '         width="13" height="13" viewBox="0 0 24 24" fill="none"',
      '         stroke="currentColor" stroke-width="2.2">',
      '      <circle cx="11" cy="11" r="8"/>',
      '      <line x1="21" y1="21" x2="16.65" y2="16.65"/>',
      "    </svg>",
      '    <span class="alaiy-search-placeholder">Search…</span>',
      '    <kbd class="alaiy-search-kbd">Ctrl K</kbd>',
      "  </div>",
      "</li>",
    ].join(""),
  );

  $search.on("click", function () {
    if (frappe.ui && frappe.ui.toolbar && frappe.ui.toolbar.search) {
      frappe.ui.toolbar.search.open();
    } else {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          ctrlKey: true,
          bubbles: true,
        }),
      );
    }
  });

  $target.prepend($search);

  // Move notification bell if it lives outside the navbar ──
  setTimeout(function () {
    var $bell = $(
      ".notification-icon, .toolbar-notification, .notification-bell",
    )
      .not(".alaiy-topbar-search-wrap *")
      .not(".navbar *");

    if ($bell.length) {
      $bell.closest("li, .nav-item").prependTo($target);
    }
  }, 400);
};

/* =========================================================
   5. ABOUT DIALOG — intercept and rebrand
   ========================================================= */
alaiy_os_core.setup_about_intercept = function () {
  // MutationObserver fires whenever a dialog is appended to <body>
  var obs = new MutationObserver(function (mutations) {
    mutations.forEach(function (mut) {
      mut.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        var $n = $(node);
        if ($n.hasClass("modal") || $n.hasClass("frappe-dialog")) {
          requestAnimationFrame(function () {
            alaiy_os_core._patch_about_if_visible($n);
          });
        }
      });
    });
  });
  obs.observe(document.body, { childList: true });

  // Belt-and-suspenders: also catch Help > About click
  $(document).on("click", '[data-label="About"]', function () {
    setTimeout(function () {
      $(".modal:visible, .frappe-dialog:visible").each(function () {
        alaiy_os_core._patch_about_if_visible($(this));
      });
    }, 200);
  });
};

alaiy_os_core._patch_about_if_visible = function ($dialog) {
  var title = $dialog
    .find(".modal-title, .dialog-title, .frappe-dialog-title")
    .first()
    .text()
    .trim();

  if (title !== "About") return;

  var cfg = alaiy_os_core.cfg();

  // ── Icons row ─────────────────────────────────────────
  var $icons = $dialog.find(".about-icons a, .modal-body .icon-row a");

  // 1st icon → alaiy.com
  if ($icons.eq(0).length) {
    $icons.eq(0).attr("href", "https://alaiy.com").attr("target", "_blank");
  }
  $dialog
    .find('a[href*="frappeframework"], a[href*="frappe.io"]')
    .attr("href", "https://alaiy.com");

  // 2nd icon → github.com/alaiy-tech
  if ($icons.eq(1).length) {
    $icons
      .eq(1)
      .attr("href", "https://github.com/alaiy-tech")
      .attr("target", "_blank");
  }
  $dialog
    .find('a[href*="github.com/frappe"]')
    .attr("href", "https://github.com/alaiy-tech");

  // 3rd icon (discuss) → remove
  if ($icons.eq(2).length) $icons.eq(2).remove();
  $dialog
    .find('a[href*="discuss.frappe"], a[href*="discuss.erpnext"]')
    .remove();

  // ── Hide Frappe version + Installed Apps sections ─────
  $dialog.find(".modal-body > *, .frappe-dialog-body > *").each(function () {
    var txt = $(this).text();
    if (
      /Frappe Framework Version/i.test(txt) ||
      /frappe\s*:\s*\d/.test(txt) ||
      /Installed Apps/i.test(txt) ||
      /INSTALLED APPS/i.test(txt) ||
      /erpnext\s*:/i.test(txt) ||
      /alaiy_os_core\s*:/i.test(txt)
    ) {
      $(this).hide();
    }
  });

  // Hide orphaned <hr> dividers left by hidden sections
  $dialog.find("hr").each(function () {
    var $hr = $(this);
    if (!$hr.prevAll(":visible").length || !$hr.nextAll(":visible").length) {
      $hr.hide();
    }
  });

  // ── Footer ────────────────────────────────────────────
  var $footer = $dialog.find(
    ".modal-footer, .frappe-dialog-footer, .about-footer",
  );
  var footerHtml =
    '<div class="alaiy-about-footer">Built with ' +
    '<span style="color:#e25555">♥</span> by Alaiy</div>';

  if ($footer.length) {
    $footer.html(footerHtml);
  } else {
    $dialog.find(".modal-body, .frappe-dialog-body").last().after(footerHtml);
  }
};


![](http://3.108.81.131/assets/erpnext/icons/desktop_icons/solid/stock.svg)

Stock
ERPNext

SearchCtrl+K

Notification

[Home](http://3.108.81.131/desk/stock)

[Dashboard](http://3.108.81.131/desk/dashboard-view/Stock)

[Stock Entry](http://3.108.81.131/desk/stock-entry)

[Purchase Receipt](http://3.108.81.131/desk/purchase-receipt)

[Delivery Note](http://3.108.81.131/desk/delivery-note)

[Material Request](http://3.108.81.131/desk/material-request)

[Pick List](http://3.108.81.131/desk/pick-list)

Tools

Setup

Reports

Settings


these options are supposed to show up in the sidebar, when in stock pge. but I think everything is hidden kinda :(
    
    So like you know, we are working on app called `alaiy_os_core`. This app acts as a configuration and customization layer on top of ERPNext. I need you to implement a robust, config-driven UI visibility system for the Stock workspace that:
    
    1. Completely removes hidden items from the UI (not just CSS-hidden)
    2. Responds dynamically to enable/disable config changes on every deploy/build
    3. Never modifies ERPNext core files
    4. Keeps backend ERPNext functionality intact
    
    PART 1: Config System
    
    Create a central config file at `alaiy_os_core/config/workspace_config.py` (or `.json`) that defines which workspaces and which DocTypes/Reports/Links within each workspace are enabled.
    
    The config must be the single source of truth. When a feature is toggled in this config and the app is redeployed or `bench migrate` is run, the changes must propagate automatically into ERPNext's live data (Workspace docs, Custom Scripts, etc.).
    
    Example config shape:
    
    ```
    WORKSPACE_CONFIG = {
        "Stock": {
            "enabled": True,
            "visible_doctypes": [
                "Item", "Item Group", "Brand", "Warehouse",
                "Stock Ledger", "Stock Balance", "Stock Summary",
                "Stock Reconciliation", "Purchase Receipt",
                "Batch", "Serial No", "Stock Settings"
            ],
            "visible_reports": [
                "Stock Ledger", "Stock Balance", "Stock Summary"
            ]
        },
        "Accounts": {
            "enabled": False
        }
        # ... other workspaces
    }
    ```
    All DocTypes and Reports NOT in the `visible_*` lists for their workspace must be treated as hidden.
    
    PART 2: What Must Be Removed (not just hidden) for Non-System-Administrators
    
    For any DocType/Report/Link that is disabled in config, remove it from:
    
    1. Workspace cards/shortcuts — patch the Workspace doc in the database to strip those links from the `links` and `shortcuts` child tables
    2. Module pages — remove from module page link lists
    3. Sidebar navigation — ensure no nav entry exists
    4. Awesome Bar search — use a `boot` hook or `DocType Search` override so disabled DocTypes don't appear in Ctrl+K / Awesome Bar for non-admins
    5. Link field suggestions — suppress suggestions for hidden DocTypes in link field searches (via `frappe.db.get_list` permission layer or a query override)
    6. Reports list — patch the Reports Workspace and standard report list to exclude hidden reports
    
    All removals must be role-scoped: System Administrators must still see and access everything.
    
    PART 3: Stock Workspace — Specific Visibility Rules
    
    KEEP VISIBLE:
    
    - Item, Item Group, Brand, Warehouse
    - Stock Ledger, Stock Balance, Stock Summary
    - Stock Reconciliation, Purchase Receipt
    - Batch, Serial No, Stock Settings
    
    REMOVE FROM UI ENTIRELY (non-admins):
    
    Masters: Product Bundle, Shipping Rule, Item Alternative
    
    Transactions: Material Request, Stock Entry, Delivery Note, Pick List, Delivery Trip
    
    Reports: Stock Projected Qty, Stock Ageing, Item Price Stock, Warehouse Wise Stock Balance, Delivery Note Trends, Purchase Receipt Trends, Sales Order Analysis, Purchase Order Analysis, Item Shortage Report, Batch-Wise Balance History, Requested Items To Be Transferred, Batch Item Expiry Status, Itemwise Recommended Reorder Level, Subcontracted Raw Materials To Be Transferred, Subcontracted Item To Be Received
    
    Settings: Unit of Measure, Item Variant Settings, Item Attribute, UOM Conversion Factor
    
    Serial & Batch: Installation Note, Serial No Service Contract Expiry, Serial No Status, Serial No Warranty Expiry, Serial No Ledger, Serial No and Batch Traceability
    
    Tools: Landed Cost Voucher, Packing Slip, Quality Inspection, Quality Inspection Template, Quick Stock Balance
    
    If any of these DocTypes are required internally by ERPNext for stock calculations or backend logic (e.g. Stock Entry, Delivery Note), keep their backend functionality fully intact — only remove their discoverability from the UI.
    
    PART 4: Propagation on Every Deploy
    
    The system must work like this:
    
    - On `bench migrate` or app install/update, a `setup` hook (in `hooks.py`) must run a Python function that reads `WORKSPACE_CONFIG` and programmatically patches ERPNext's Workspace docs in the database to match the config exactly
    - This means: if a workspace was disabled and is now enabled in config → it reappears on next deploy; if disabled again → it disappears again
    - Use `after_migrate` or `after_install` hooks in `hooks.py` to trigger this patching function automatically
    - The patching function should be idempotent — safe to run multiple times
    
    Example scenario: Stock is enabled at install. Two weeks later, Accounts is enabled in config, app is rebuilt and deployed → Accounts workspace appears. If Accounts is then disabled and redeployed → it disappears.
    
    PART 5: Role-Based Enforcement at Runtime
    
    Beyond the workspace patching, add a runtime enforcement layer so that even if someone navigates to a hidden DocType directly via URL:
    
    - Non-System-Administrators get a permission error or are redirected
    - System Administrators are unaffected
    
    Implement this via a `has_permission` hook or a `boot` session hook that injects a list of blocked DocTypes into the JS client session for non-admins. Then add a client-side route guard (in a JS file hooked into `app.js`) that intercepts navigation to blocked routes and shows an appropriate "not available" message instead of a broken page or JS error.
    
    PART 6: Implementation Constraints
    
    - Never modify files inside the `erpnext` or `frappe` app directories
    - All changes go inside `alaiy_os_core/`
    - Use Frappe's standard override mechanisms: `hooks.py`, `fixtures/`, `patches/`, custom scripts, `override_whitelisted_methods`
    - The Workspace patching should work by loading the Workspace doc by name and surgically removing/adding only the controlled links — not replacing the entire workspace document (to avoid breaking ERPNext's own workspace customizations outside our controlled set)
    - Add clear comments in every file explaining what the code does and why, for future maintainability
    
    Deliverable
    
    Produce the complete, working code for all files listed above. Make sure:
    
    - `hooks.py` correctly wires up `after_migrate`, `after_install`, and `boot` hooks
    - `workspace_manager.py` is idempotent, reads from `workspace_config.py`, and correctly patches Frappe Workspace docs
    - `route_guard.js` correctly blocks navigation for non-admins without JS errors
    - The Stock workspace ends up with exactly and only the visible items listed in Part 3
    - The solution compiles with no import errors and is ready to drop into the existing `alaiy_os_core` app
    - Precise Commands to deploy the changes onto the app running in prod, and how to update the deployment

    