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

// ALAIY_SETTINGS_TABS is defined in constants/settings_tabs.js (loaded before
// this file via app_include_js). Edit tab definitions there, not here.

// ── State ──────────────────────────────────────────────────────────────────
const AlaiySettings = {
  panel: null,
  tabList: null,
  contentArea: null,
  activeTabId: null,
  drilldown: null, // { doctype, docname, parentTabId }
};

alaiy_os.settings = {
  /** Open the panel at the last-active tab (or the first tab). */
  open() {
    this.openTab(null);
  },

  /**
   * Open the panel and activate a specific tab.
   * Uses .layout-main-section as the container so the workspace sidebar
   * remains visible while the panel is open.
   */
  openTab(tabId) {
    // Prefer the main content section so the sidebar stays visible.
    const workspace =
      document.querySelector(".layout-main-section") ||
      document.querySelector(".workspace-container");
    if (!workspace) {
      frappe.msgprint(__("Could not find the workspace container."));
      return;
    }

    if (!AlaiySettings.panel || !document.body.contains(AlaiySettings.panel)) {
      this._buildPanel(workspace);
    }

    AlaiySettings.panel.classList.add("visible");
    const targetTabId =
      tabId || AlaiySettings.activeTabId || ALAIY_SETTINGS_TABS[0].id;
    this._activateTab(targetTabId);
    if (typeof updateAlaiyTitle === "function") {
      const tab = ALAIY_SETTINGS_TABS.find((t) => t.id === targetTabId);
      updateAlaiyTitle(
        "Settings \u00b7 " + (tab ? tab.label : "Settings"),
      );
    }
  },

  close() {
    if (AlaiySettings.panel) {
      AlaiySettings.panel.classList.remove("visible");
    }
    // Return title to workspace default
    if (typeof updateAlaiyTitle === "function") {
      updateAlaiyTitle("Dashboard");
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
    // Update browser tab title
    if (typeof updateAlaiyTitle === "function") {
      updateAlaiyTitle("Settings \u00b7 " + tab.label);
    }
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
    } else if (tab.type === "connectors") {
      this._mountConnectorsTab(content);
    }
  },

  /** Mount a Single DocType form (e.g. Stock Settings) directly. */
  _mountSingleForm(container, doctype) {
    const host = document.createElement("div");
    container.appendChild(host);
    this._mountFormInWrapper(host, doctype, doctype);
  },

  /**
   * Stacked tabs (Organisation, Users, Audits): one card per item.
   * Items with type "single" mount a Single DocType form directly.
   * Items with type "list" (or no type) render a records list with drill-down.
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

      // Route to the correct renderer based on item type
      if (item.type === "single") {
        // Single DocType — mount the form directly (no list)
        this._mountSingleForm(body, item.doctype);
      } else {
        // List DocType — render records table with drill-down
        this._mountListInContainer(body, item.doctype, tab.id);
      }
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
            this._drilldown(doctype, row.name, parentTabId),
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
    // Update title to reflect the drilled-into section
    if (typeof updateAlaiyTitle === "function") {
      const parentTab = ALAIY_SETTINGS_TABS.find((t) => t.id === parentTabId);
      updateAlaiyTitle(
        "Settings \u00b7 " + (parentTab ? parentTab.label : "Settings"),
      );
    }
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
            __("Unable to render the form for {0} in-place on this build.", [
              doctype,
            ]),
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
            __("Could not load {0}: {1}", [doctype, e.message || e]),
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

  // ── Connectors tab ────────────────────────────────────────────────────────

  _mountConnectorsTab(container) {
    this._showLoading(container);
    frappe.call({
      method: "alaiy_os_core.api.connectors.get_all_connectors",
      callback: (r) => {
        container.querySelector(".settings-loading")?.remove();
        const connectors = r.message || [];
        if (!connectors.length) {
          const empty = document.createElement("div");
          empty.className = "text-muted";
          empty.style.paddingTop = "8px";
          empty.textContent = __(
            "No connectors installed. Install a connector app and run bench migrate.",
          );
          container.appendChild(empty);
          return;
        }
        connectors.forEach((c) => this._buildConnectorCard(container, c));
      },
      error: () => {
        container.querySelector(".settings-loading")?.remove();
        const err = document.createElement("div");
        err.className = "text-danger";
        err.style.paddingTop = "8px";
        err.textContent = __("Could not load connectors.");
        container.appendChild(err);
      },
    });
  },

  _buildConnectorCard(container, connector) {
    const card = document.createElement("div");
    card.className = "alaiy-connector-card";
    card.dataset.connectorId = connector.connector_id;

    // ── Header ──────────────────────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "alaiy-connector-header";

    const iconWrap = document.createElement("div");
    iconWrap.className = "alaiy-connector-icon-wrap";
    if (connector.icon_url) {
      const img = document.createElement("img");
      img.src = connector.icon_url;
      img.alt = connector.connector_name;
      img.className = "alaiy-connector-icon-img";
      iconWrap.appendChild(img);
    } else {
      iconWrap.innerHTML = frappe.utils.icon(connector.icon || "plug", "lg");
    }
    header.appendChild(iconWrap);

    const meta = document.createElement("div");
    meta.className = "alaiy-connector-meta";
    const subtitle = [connector.connector_type, connector.description]
      .filter(Boolean)
      .join(" · ");
    meta.innerHTML =
      `<div class="alaiy-connector-name">${connector.connector_name}</div>` +
      (subtitle ? `<div class="alaiy-connector-subtitle">${subtitle}</div>` : "");
    header.appendChild(meta);

    const statusBadge = document.createElement("div");
    const statusVal = connector.connection_status || "untested";
    statusBadge.className = `alaiy-connector-status status-${statusVal}`;
    statusBadge.innerHTML = _alaiyStatusBadgeHtml(statusVal);
    header.appendChild(statusBadge);

    card.appendChild(header);

    // ── Footer: Configure + Test ─────────────────────────────────────────────
    const footer = document.createElement("div");
    footer.className = "alaiy-connector-footer";

    if (connector.settings_doctype) {
      const configBtn = document.createElement("button");
      configBtn.className = "btn btn-sm btn-default alaiy-connector-configure";
      configBtn.textContent = __("Configure");
      configBtn.addEventListener("click", () => {
        alaiy_os.settings.close();
        frappe.set_route("Form", connector.settings_doctype, connector.settings_doctype);
      });
      footer.appendChild(configBtn);
    }

    if (connector.test_method) {
      const testBtn = document.createElement("button");
      testBtn.className = "btn btn-sm btn-primary alaiy-connector-test";
      testBtn.textContent = __("Test Connection");
      footer.appendChild(testBtn);

      // Timestamp anchored to the right via margin-left:auto (CSS)
      if (connector.last_tested_at) {
        const testedEl = document.createElement("span");
        testedEl.className = "alaiy-connector-last-tested";
        // comment_when() returns an HTML <span> with tooltip — must use innerHTML
        testedEl.innerHTML = __(
          "Tested: {0}",
          [frappe.datetime.comment_when(connector.last_tested_at)],
        );
        footer.appendChild(testedEl);
      }

      testBtn.addEventListener("click", () => {
        testBtn.disabled = true;
        testBtn.textContent = __("Testing…");
        frappe.call({
          method: "alaiy_os_core.api.connectors.test_connector",
          args: { connector_id: connector.connector_id },
          callback: (r) => {
            testBtn.disabled = false;
            testBtn.textContent = __("Test Connection");
            const res = r.message || {};
            if (res.success) {
              frappe.show_alert({
                message: res.message || __("Connected successfully"),
                indicator: "green",
              }, 5);
              statusBadge.className = "alaiy-connector-status status-connected";
              statusBadge.innerHTML = _alaiyStatusBadgeHtml("connected");
            } else {
              frappe.show_alert({
                message: res.message || __("Connection failed"),
                indicator: "red",
              }, 7);
              statusBadge.className = "alaiy-connector-status status-failed";
              statusBadge.innerHTML = _alaiyStatusBadgeHtml("failed");
            }
          },
          error: () => {
            testBtn.disabled = false;
            testBtn.textContent = __("Test Connection");
            frappe.show_alert({
              message: __("Test failed — check the browser console."),
              indicator: "red",
            }, 7);
          },
        });
      });
    }

    card.appendChild(footer);

    // ── Sync section ─────────────────────────────────────────────────────────
    if (connector.sync_categories_method || connector.sync_items_method) {
      const syncSection = document.createElement("div");
      syncSection.className = "alaiy-connector-sync-section";

      const syncTitle = document.createElement("div");
      syncTitle.className = "alaiy-connector-sync-title";
      syncTitle.textContent = __("Data Sync");
      syncSection.appendChild(syncTitle);

      if (connector.sync_categories_method) {
        const label = connector.sync_categories_label || __("Category Tree");
        this._buildSyncRow(syncSection, label, connector.sync_categories_method,
          connector.sync_status_method, "categories");
      }
      if (connector.sync_items_method) {
        const label = connector.sync_items_label || __("Items");
        this._buildSyncRow(syncSection, label, connector.sync_items_method,
          connector.sync_status_method, "items");
      }
      card.appendChild(syncSection);
    }

    container.appendChild(card);
  },

  _buildSyncRow(container, label, triggerMethod, statusMethod, syncType) {
    const row = document.createElement("div");
    row.className = "alaiy-connector-sync-row";

    const btn = document.createElement("button");
    btn.className = "btn btn-xs btn-default alaiy-connector-sync-btn";
    btn.textContent = __("Sync {0}", [label]);

    const statusEl = document.createElement("span");
    statusEl.className = "alaiy-connector-sync-status";
    statusEl.textContent = __("Loading…");

    row.appendChild(btn);
    row.appendChild(statusEl);
    container.appendChild(row);

    const refreshStatus = () => {
      frappe.call({
        method: statusMethod,
        args: { sync_type: syncType },
        callback: (r) => {
          const logs = r.message || [];
          const last = logs[0];
          if (!last) { statusEl.textContent = __("Never synced"); statusEl.className = "alaiy-connector-sync-status muted"; return; }
          const when = frappe.datetime.comment_when(last.started_at);
          if (last.status === "running") {
            const pct = last.pages_total ? Math.round((last.pages_done / last.pages_total) * 100) : "…";
            statusEl.textContent = __("Running ({0}%)…", [pct]);
            statusEl.className = "alaiy-connector-sync-status running";
            btn.disabled = true;
            setTimeout(refreshStatus, 3000);
          } else if (last.status === "success") {
            statusEl.innerHTML = "✓ " + when + " · " + (last.items_processed || 0) + " items";
            statusEl.className = "alaiy-connector-sync-status success";
            btn.disabled = false;
          } else {
            statusEl.innerHTML = "✗ " + when + " · " + (last.error_message || __("Failed"));
            statusEl.className = "alaiy-connector-sync-status error";
            btn.disabled = false;
          }
        },
        error: () => { statusEl.textContent = ""; btn.disabled = false; },
      });
    };

    btn.addEventListener("click", () => {
      btn.disabled = true;
      statusEl.textContent = __("Queued…");
      statusEl.className = "alaiy-connector-sync-status running";
      frappe.call({
        method: triggerMethod,
        callback: () => { setTimeout(refreshStatus, 1500); },
        error: () => {
          btn.disabled = false;
          statusEl.textContent = __("Failed to queue");
          statusEl.className = "alaiy-connector-sync-status error";
        },
      });
    });

    refreshStatus();
  },

};

function _alaiyStatusBadgeHtml(statusVal) {
  const labels = {
    untested: __("Not configured"),
    connected: __("Connected"),
    failed: __("Failed"),
  };
  const label = labels[statusVal] || statusVal;
  return `<span class="alaiy-status-dot"></span><span>${label}</span>`;
}
