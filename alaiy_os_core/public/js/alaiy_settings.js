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
  /**
   * Called when the Settings shortcut/link is clicked.
   * Builds the panel once, then shows it and activates the first tab.
   */
  open() {
    const workspace = document.querySelector(
      ".workspace-container, .layout-main-section",
    );
    if (!workspace) {
      frappe.msgprint(__("Could not find the workspace container."));
      return;
    }

    if (!AlaiySettings.panel || !document.body.contains(AlaiySettings.panel)) {
      this._buildPanel(workspace);
    }

    AlaiySettings.panel.classList.add("visible");
    const firstTabId = AlaiySettings.activeTabId || ALAIY_SETTINGS_TABS[0].id;
    this._activateTab(firstTabId);
    // Update title to reflect the settings panel being open
    if (typeof updateAlaiyTitle === "function") {
      const firstTab = ALAIY_SETTINGS_TABS.find((t) => t.id === firstTabId);
      updateAlaiyTitle(
        "Settings \u00b7 " + (firstTab ? firstTab.label : "Settings"),
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
      (subtitle
        ? `<div class="alaiy-connector-subtitle">${subtitle}</div>`
        : "");
    header.appendChild(meta);

    const statusBadge = document.createElement("div");
    const statusVal = connector.connection_status || "untested";
    statusBadge.className = `alaiy-connector-status status-${statusVal}`;
    statusBadge.textContent = statusVal.replace(/-/g, " ");
    header.appendChild(statusBadge);

    card.appendChild(header);

    // ── Body (fields, loaded async) ──────────────────────────────────────────
    const body = document.createElement("div");
    body.className = "alaiy-connector-body";
    this._showLoading(body);
    card.appendChild(body);

    // ── Footer ───────────────────────────────────────────────────────────────
    const footer = document.createElement("div");
    footer.className = "alaiy-connector-footer";

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-sm btn-primary alaiy-connector-save";
    saveBtn.textContent = __("Save & Test");
    footer.appendChild(saveBtn);

    if (connector.last_tested_at) {
      const testedEl = document.createElement("span");
      testedEl.className = "alaiy-connector-last-tested";
      testedEl.textContent = __(
        "Last tested: {0}",
        [frappe.datetime.comment_when(connector.last_tested_at)],
      );
      footer.appendChild(testedEl);
    }

    const resultMsg = document.createElement("div");
    resultMsg.className = "alaiy-connector-result";
    footer.appendChild(resultMsg);

    card.appendChild(footer);
    container.appendChild(card);

    // Load field config
    frappe.call({
      method: "alaiy_os_core.api.connectors.get_connector_config",
      args: { connector_id: connector.connector_id },
      callback: (r) => {
        body.querySelector(".settings-loading")?.remove();
        const { fields, values } = r.message || {};
        if (!fields || !fields.length) {
          const p = document.createElement("p");
          p.className = "text-muted";
          p.textContent = __("No configuration fields.");
          body.appendChild(p);
          return;
        }
        fields.forEach((f) => this._renderConnectorField(body, f, values[f.fieldname]));
      },
      error: () => {
        body.querySelector(".settings-loading")?.remove();
        const p = document.createElement("p");
        p.className = "text-danger";
        p.textContent = __("Could not load settings.");
        body.appendChild(p);
      },
    });

    // Save & Test handler
    saveBtn.addEventListener("click", () => {
      const vals = this._collectConnectorValues(body);
      saveBtn.disabled = true;
      saveBtn.textContent = __("Saving…");
      resultMsg.textContent = "";
      resultMsg.className = "alaiy-connector-result";

      frappe.call({
        method: "alaiy_os_core.api.connectors.save_and_test",
        args: {
          connector_id: connector.connector_id,
          values: JSON.stringify(vals),
        },
        callback: (r) => {
          saveBtn.disabled = false;
          saveBtn.textContent = __("Save & Test");
          const res = r.message || {};
          if (res.success) {
            resultMsg.className = "alaiy-connector-result success";
            resultMsg.textContent =
              "✓ " + (res.message || __("Connected successfully"));
            statusBadge.className = "alaiy-connector-status status-connected";
            statusBadge.textContent = "connected";
          } else {
            resultMsg.className = "alaiy-connector-result error";
            resultMsg.textContent =
              "✗ " + (res.message || __("Connection failed"));
            statusBadge.className = "alaiy-connector-status status-failed";
            statusBadge.textContent = "failed";
          }
        },
        error: () => {
          saveBtn.disabled = false;
          saveBtn.textContent = __("Save & Test");
          resultMsg.className = "alaiy-connector-result error";
          resultMsg.textContent = __("An error occurred. Check the console.");
        },
      });
    });
  },

  _renderConnectorField(container, field, value) {
    const row = document.createElement("div");
    row.className = "alaiy-connector-field-row";

    const label = document.createElement("label");
    label.className = "alaiy-connector-field-label";
    label.textContent = field.label || field.fieldname;

    let input;
    if (field.fieldtype === "Password") {
      input = document.createElement("input");
      input.type = "password";
      input.className = "form-control alaiy-connector-field-input";
      input.dataset.fieldname = field.fieldname;
      input.dataset.fieldtype = "password";
      input.placeholder =
        value && value._set
          ? __("(saved — type to replace)")
          : __("Enter value");
    } else if (field.fieldtype === "Check") {
      const wrap = document.createElement("div");
      wrap.className = "alaiy-connector-field-check-wrap";
      input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.fieldname = field.fieldname;
      input.dataset.fieldtype = "check";
      input.checked = !!value;
      wrap.appendChild(input);
      row.appendChild(label);
      row.appendChild(wrap);
      container.appendChild(row);
      return;
    } else if (field.fieldtype === "Select" && field.options) {
      input = document.createElement("select");
      input.className = "form-control alaiy-connector-field-input";
      input.dataset.fieldname = field.fieldname;
      field.options.split("\n").forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt || __("(select)");
        if (opt === value) option.selected = true;
        input.appendChild(option);
      });
    } else {
      input = document.createElement("input");
      input.type = field.fieldtype === "Int" ? "number" : "text";
      input.className = "form-control alaiy-connector-field-input";
      input.dataset.fieldname = field.fieldname;
      input.value = value !== null && value !== undefined ? value : "";
    }

    if (field.description) {
      const desc = document.createElement("div");
      desc.className = "alaiy-connector-field-desc";
      desc.textContent = field.description;
      row.appendChild(label);
      row.appendChild(input);
      container.appendChild(row);
      const descRow = document.createElement("div");
      descRow.className = "alaiy-connector-field-desc-row";
      descRow.appendChild(desc);
      container.appendChild(descRow);
      return;
    }

    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  },

  _collectConnectorValues(body) {
    const values = {};
    body.querySelectorAll("[data-fieldname]").forEach((el) => {
      const name = el.dataset.fieldname;
      const type = el.dataset.fieldtype;
      if (type === "check") {
        values[name] = el.checked ? 1 : 0;
      } else if (type === "password") {
        if (el.value.trim()) values[name] = el.value.trim();
      } else {
        values[name] = el.value;
      }
    });
    return values;
  },
};

// ── Hook into the Settings shortcut/link click ───────────────────────────────
// Event delegation on the document so it survives Frappe re-rendering the
// workspace on route change. Matches both the shortcut card and the sidebar
// link whose label is exactly "Settings".
document.addEventListener("click", function (e) {
  const target = e.target.closest(
    ".widget.shortcut-widget-box, .shortcut-widget-box, .workspace-shortcut-card, .link-item, a",
  );
  if (!target) return;

  const labelText = (target.textContent || "").trim();
  if (labelText !== "Settings") return;

  // Only act inside the Alaiy OS workspace route.
  const route = (frappe.get_route_str && frappe.get_route_str()) || "";
  if (!route.startsWith("os")) return;

  e.preventDefault();
  e.stopPropagation();
  alaiy_os.settings.open();
});
