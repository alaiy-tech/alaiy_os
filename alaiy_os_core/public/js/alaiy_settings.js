/**
 * AlaiyOS Settings Controller
 *
 * Mounts a settings panel inside the workspace container when the user clicks
 * the Settings shortcut/link. Uses Frappe's own form/list APIs to render real
 * ERPNext views inside the panel — no iframes, no new routes, no new tabs.
 *
 * Panel structure:
 *   [Left: vertical tab list] | [Right: content area]
 *
 * Tab types:
 *   single   — loads a Single DocType form directly (e.g. Stock Settings)
 *   stacked  — loads multiple sub-lists/forms stacked vertically
 *              (e.g. Organisation: Company + Letter Head + Email Account)
 *              Clicking a list row drills into that record's form.
 *
 * NOTE on form rendering:
 *   We render forms with `new frappe.ui.form.Form(doctype, wrapper, false)`,
 *   the same mechanism Frappe uses for form-in-dialog. If that constructor is
 *   unavailable in a future build, `_mountFormInWrapper` reports the error
 *   loudly (no silent swallow) so it can be swapped for `frappe.set_route`.
 */

frappe.provide("alaiy_os");

// ── Tab Definitions ───────────────────────────────────────────────────────────
// Single source of truth for the settings layout. Add/remove a tab here only.
const ALAIY_SETTINGS_TABS = [
  // ── Single DocType forms ──────────────────────────────────────────────────
  { id: "stock",         label: "Stock",                 icon: "package",      type: "single", doctype: "Stock Settings" },
  { id: "item-variants", label: "Item Variant Settings", icon: "settings",     type: "single", doctype: "Item Variant Settings" },
  { id: "selling",       label: "Selling",               icon: "briefcase",    type: "single", doctype: "Selling Settings" },
  { id: "buying",        label: "Buying",                icon: "shopping-cart", type: "single", doctype: "Buying Settings" },
  { id: "accounts",      label: "Accounts",              icon: "accounting",   type: "single", doctype: "Accounts Settings" },

  // ── Stacked: multiple lists/forms on one page ─────────────────────────────
  {
    id: "organisation", label: "Organisation", icon: "building", type: "stacked",
    items: [
      { label: "Company",       doctype: "Company" },
      { label: "Letter Head",   doctype: "Letter Head" },
      { label: "Email Account", doctype: "Email Account" },
    ],
  },
  {
    id: "users", label: "Users", icon: "users", type: "stacked",
    items: [
      { label: "Users", doctype: "User" },
      { label: "Roles", doctype: "Role" },
    ],
  },
  {
    id: "audits", label: "Audits", icon: "list", type: "stacked",
    items: [
      { label: "Activity Log",   doctype: "Activity Log" },
      { label: "Permission Log", doctype: "Permission Log" },
      { label: "Access Log",     doctype: "Access Log" },
    ],
  },
];

// ── State ──────────────────────────────────────────────────────────────────
const AlaiySettings = {
  panel: null,
  tabList: null,
  contentArea: null,
  activeTabId: null,
  drilldown: null, // { doctype, docname, parentTabId }
};

alaiy_os.settings = {
  /**
   * Called when the Settings shortcut/link is clicked.
   * Builds the panel once, then shows it and activates the first tab.
   */
  open() {
    const workspace = document.querySelector(
      ".workspace-container, .layout-main-section"
    );
    if (!workspace) {
      frappe.msgprint(__("Could not find the workspace container."));
      return;
    }

    if (!AlaiySettings.panel || !document.body.contains(AlaiySettings.panel)) {
      this._buildPanel(workspace);
    }

    AlaiySettings.panel.classList.add("visible");
    this._activateTab(AlaiySettings.activeTabId || ALAIY_SETTINGS_TABS[0].id);
  },

  close() {
    if (AlaiySettings.panel) {
      AlaiySettings.panel.classList.remove("visible");
    }
  },

  // ── Panel Construction ──────────────────────────────────────────────────

  _buildPanel(container) {
    // Make container relative so the panel can overlay it.
    if (getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }

    const panel = document.createElement("div");
    panel.id = "alaiy-settings-panel";

    const tabs = document.createElement("div");
    tabs.className = "alaiy-settings-tabs";
    tabs.id = "alaiy-settings-tab-list";

    const content = document.createElement("div");
    content.className = "alaiy-settings-content";
    content.id = "alaiy-settings-content";

    panel.appendChild(tabs);
    panel.appendChild(content);
    container.appendChild(panel);

    AlaiySettings.panel = panel;
    AlaiySettings.tabList = tabs;
    AlaiySettings.contentArea = content;

    this._renderTabList();
  },

  _renderTabList() {
    const tabList = AlaiySettings.tabList;
    tabList.innerHTML = "";

    const label = document.createElement("div");
    label.className = "tab-section-label";
    label.textContent = __("Settings");
    tabList.appendChild(label);

    ALAIY_SETTINGS_TABS.forEach((tab) => {
      const item = document.createElement("div");
      item.className = "tab-item";
      item.dataset.tabId = tab.id;

      const icon = document.createElement("span");
      icon.className = "tab-icon";
      icon.innerHTML = frappe.utils.icon(tab.icon, "sm");

      const text = document.createElement("span");
      text.textContent = tab.label;

      item.appendChild(icon);
      item.appendChild(text);
      item.addEventListener("click", () => this._activateTab(tab.id));
      tabList.appendChild(item);
    });
  },

  // ── Tab Activation ──────────────────────────────────────────────────────

  _activateTab(tabId) {
    AlaiySettings.activeTabId = tabId;
    AlaiySettings.drilldown = null;

    AlaiySettings.tabList.querySelectorAll(".tab-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.tabId === tabId);
    });

    const tab = ALAIY_SETTINGS_TABS.find((t) => t.id === tabId);
    if (!tab) return;

    this._renderContent(tab);
  },

  // ── Content Rendering ─────────────────────────────────────────────────────

  /** Reset the content area to an empty state with the persistent close button. */
  _resetContent() {
    const content = AlaiySettings.contentArea;
    content.innerHTML = "";

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-xs btn-default";
    closeBtn.style.cssText = "position:absolute;top:16px;right:24px;z-index:1;";
    closeBtn.textContent = "✕  " + __("Close Settings");
    closeBtn.addEventListener("click", () => this.close());
    content.appendChild(closeBtn);

    return content;
  },

  _renderContent(tab) {
    const content = this._resetContent();

    const title = document.createElement("div");
    title.className = "settings-section-title";
    title.textContent = tab.label;
    content.appendChild(title);

    if (tab.type === "single") {
      this._mountSingleForm(content, tab.doctype);
    } else if (tab.type === "stacked") {
      this._mountStackedItems(content, tab);
    }
  },

  /** Mount a Single DocType form (e.g. Stock Settings) directly. */
  _mountSingleForm(container, doctype) {
    const host = document.createElement("div");
    container.appendChild(host);
    this._mountFormInWrapper(host, doctype, doctype);
  },

  /**
   * Stacked tabs (Organisation, Users, Audits): one card per item, each
   * holding a compact list. Clicking a row drills into that record's form.
   */
  _mountStackedItems(container, tab) {
    tab.items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "alaiy-settings-stacked-form";

      const header = document.createElement("div");
      header.className = "stacked-form-header";
      header.textContent = item.label;
      card.appendChild(header);

      const body = document.createElement("div");
      body.className = "stacked-form-body";
      card.appendChild(body);

      container.appendChild(card);

      this._mountListInContainer(body, item.doctype, tab.id);
    });
  },

  /** Render a compact list of records; row click drills into the form. */
  _mountListInContainer(container, doctype, parentTabId) {
    this._showLoading(container);

    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: doctype,
        fields: ["name", "modified"],
        limit: 50,
        order_by: "modified desc",
      },
      callback: (r) => {
        container.querySelector(".settings-loading")?.remove();

        const rows = r.message || [];
        if (rows.length === 0) {
          const empty = document.createElement("div");
          empty.className = "text-muted";
          empty.textContent = __("No records found.");
          container.appendChild(empty);
          return;
        }

        const table = document.createElement("table");
        table.className = "table table-bordered";
        table.style.cssText = "font-size:13px;cursor:pointer;margin:0;";

        const thead = document.createElement("thead");
        const htr = document.createElement("tr");
        [__("Name"), __("Last Modified")].forEach((h) => {
          const th = document.createElement("th");
          th.textContent = h;
          htr.appendChild(th);
        });
        thead.appendChild(htr);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        rows.forEach((row) => {
          const tr = document.createElement("tr");

          const nameTd = document.createElement("td");
          nameTd.textContent = row.name;

          const modTd = document.createElement("td");
          modTd.textContent = frappe.datetime.str_to_user(row.modified);

          tr.appendChild(nameTd);
          tr.appendChild(modTd);
          tr.addEventListener("click", () =>
            this._drilldown(doctype, row.name, parentTabId)
          );
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);
      },
      error: () => {
        container.querySelector(".settings-loading")?.remove();
        const err = document.createElement("div");
        err.className = "text-danger";
        err.textContent = __("Could not load {0}.", [doctype]);
        container.appendChild(err);
      },
    });
  },

  /**
   * Drill-down: replace the content area with a single record's form and a
   * Back button that returns to the parent stacked tab.
   */
  _drilldown(doctype, docname, parentTabId) {
    AlaiySettings.drilldown = { doctype, docname, parentTabId };
    const content = this._resetContent();

    const back = document.createElement("div");
    back.className = "settings-back-btn";
    back.textContent = "← " + __("Back");
    back.addEventListener("click", () => {
      AlaiySettings.drilldown = null;
      this._activateTab(parentTabId);
    });
    content.appendChild(back);

    const title = document.createElement("div");
    title.className = "settings-section-title";
    title.textContent = `${doctype}: ${docname}`;
    content.appendChild(title);

    const host = document.createElement("div");
    content.appendChild(host);
    this._mountFormInWrapper(host, doctype, docname);
  },

  // ── Form mounting ───────────────────────────────────────────────────────

  /**
   * Render a real Frappe form for `doctype`/`docname` inside `wrapper`.
   * For Single DocTypes, docname === doctype.
   */
  _mountFormInWrapper(wrapper, doctype, docname) {
    this._showLoading(wrapper);

    frappe.model.with_doctype(doctype, () => {
      frappe.model.with_doc(doctype, docname, () => {
        wrapper.querySelector(".settings-loading")?.remove();

        const FormClass = frappe.ui.form && frappe.ui.form.Form;
        if (typeof FormClass !== "function") {
          // Fail loudly — do not silently swallow. Operator can switch this
          // branch to `frappe.set_route("Form", doctype, docname)` if needed.
          frappe.msgprint(
            __("Unable to render the form for {0} in-place on this build.", [doctype])
          );
          return;
        }

        try {
          const form = new FormClass(doctype, wrapper, false);
          form.refresh(docname);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[AlaiyOS] settings form render failed:", e);
          frappe.msgprint(
            __("Could not load {0}: {1}", [doctype, e.message || e])
          );
        }
      });
    });
  },

  // ── Helpers ───────────────────────────────────────────────────────────────

  _showLoading(container) {
    const el = document.createElement("div");
    el.className = "settings-loading";
    el.textContent = __("Loading…");
    container.appendChild(el);
  },
};

// ── Hook into the Settings shortcut/link click ───────────────────────────────
// Event delegation on the document so it survives Frappe re-rendering the
// workspace on route change. Matches both the shortcut card and the sidebar
// link whose label is exactly "Settings".
document.addEventListener("click", function (e) {
  const target = e.target.closest(
    ".widget.shortcut-widget-box, .shortcut-widget-box, .workspace-shortcut-card, .link-item, a"
  );
  if (!target) return;

  const labelText = (target.textContent || "").trim();
  if (labelText !== "Settings") return;

  // Only act inside the Alaiy OS workspace route.
  const route = (frappe.get_route_str && frappe.get_route_str()) || "";
  if (!route.startsWith("alaiy-os")) return;

  e.preventDefault();
  e.stopPropagation();
  alaiy_os.settings.open();
});
