/* =========================================================
   AlaiyOS Core â€” Desk customisations
   Loaded on every Frappe Desk page via app_include_js.

   Config is read from frappe.boot.alaiy_config which is
   injected server-side by boot.py (extend_bootinfo hook).
   Defaults below match brand_config.py so the UI is never
   broken even if boot hasn't loaded yet.
   ========================================================= */

frappe.provide("alaiy_os_core");


/* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
      about_footer_text: "Built with â™¥ by Alaiy",
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

/* â”€â”€ 3a. Remove "Desktop" from the app-switcher dropdown â”€â”€ */
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

/* â”€â”€ 3b. Remove "Website" from the app-switcher dropdown â”€â”€ */
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

/* â”€â”€ 3c. Hide dark/light theme toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

  // Search bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      '    <span class="alaiy-search-placeholder">Searchâ€¦</span>',
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

  // Move notification bell if it lives outside the navbar â”€â”€
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
   5. ABOUT DIALOG â€” intercept and rebrand
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

  // â”€â”€ Icons row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  var $icons = $dialog.find(".about-icons a, .modal-body .icon-row a");

  // 1st icon â†’ alaiy.com
  if ($icons.eq(0).length) {
    $icons.eq(0).attr("href", "https://alaiy.com").attr("target", "_blank");
  }
  $dialog
    .find('a[href*="frappeframework"], a[href*="frappe.io"]')
    .attr("href", "https://alaiy.com");

  // 2nd icon â†’ github.com/alaiy-tech
  if ($icons.eq(1).length) {
    $icons
      .eq(1)
      .attr("href", "https://github.com/alaiy-tech")
      .attr("target", "_blank");
  }
  $dialog
    .find('a[href*="github.com/frappe"]')
    .attr("href", "https://github.com/alaiy-tech");

  // 3rd icon (discuss) â†’ remove
  if ($icons.eq(2).length) $icons.eq(2).remove();
  $dialog
    .find('a[href*="discuss.frappe"], a[href*="discuss.erpnext"]')
    .remove();

  // â”€â”€ Hide Frappe version + Installed Apps sections â”€â”€â”€â”€â”€
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

  // â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  var $footer = $dialog.find(
    ".modal-footer, .frappe-dialog-footer, .about-footer",
  );
  var footerHtml =
    '<div class="alaiy-about-footer">Built with ' +
    '<span style="color:#e25555">â™¥</span> by Alaiy</div>';

  if ($footer.length) {
    $footer.html(footerHtml);
  } else {
    $dialog.find(".modal-body, .frappe-dialog-body").last().after(footerHtml);
  }
};

