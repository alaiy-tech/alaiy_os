/**
 * AlaiyOS — Shared connector status card.
 *
 * Mounted at the top of each connector's own Settings DocType form (via
 * frm.dashboard) to show its icon, name, and live connection status.
 * Action buttons (Test Connection, Sync...) are NOT part of this card — each
 * connector adds those to its own form's "Actions" dropdown, right next to
 * the API calls it already knows about. This keeps connectors decoupled:
 * this module only needs to know how to render one registry row.
 */

frappe.provide("alaiy_os.connector_card");

alaiy_os.connector_card.mount = function (frm, connector_id) {
  frappe.call({
    method: "alaiy_os.api.connectors.get_all_connectors",
    callback(r) {
      const connector = (r.message || []).find(
        (c) => c.connector_id === connector_id,
      );
      if (!connector) return;
      frm.dashboard.add_section(
        alaiy_os.connector_card._html(connector),
        __("Connector Status"),
      );
      frm.dashboard.show();
    },
  });
};

alaiy_os.connector_card._html = function (connector) {
  const statusVal = connector.connection_status || "untested";
  const labels = {
    untested: __("Not configured"),
    connected: __("Connected"),
    failed: __("Failed"),
  };
  const iconHtml = connector.icon_url
    ? `<img src="${connector.icon_url}" alt="" class="alaiy-connector-icon-img">`
    : frappe.utils.icon(connector.icon || "plug", "lg");
  const subtitle = [connector.connector_type, connector.description]
    .filter(Boolean)
    .join(" · ");
  const tested = connector.last_tested_at
    ? `<span class="alaiy-connector-last-tested">${__("Tested: {0}", [
        frappe.datetime.comment_when(connector.last_tested_at),
      ])}</span>`
    : "";

  return `
		<div class="alaiy-connector-card">
			<div class="alaiy-connector-header">
				<div class="alaiy-connector-icon-wrap">${iconHtml}</div>
				<div class="alaiy-connector-meta">
					<div class="alaiy-connector-name">${frappe.utils.escape_html(connector.connector_name || "")}</div>
					${subtitle ? `<div class="alaiy-connector-subtitle">${frappe.utils.escape_html(subtitle)}</div>` : ""}
				</div>
				<div class="alaiy-connector-status status-${statusVal}">
					<span class="alaiy-status-dot"></span><span>${labels[statusVal] || statusVal}</span>
				</div>
			</div>
			${tested ? `<div class="alaiy-connector-footer">${tested}</div>` : ""}
		</div>
	`;
};

/**
 * Reveal a Password field's real value while focused; mask it again on blur.
 * Frappe never sends the real value to the client for a saved Password
 * field, so this fetches it on demand via get_connector_password(). On
 * blur, frm.refresh_field() re-renders the control from frm.doc (untouched
 * placeholder), which also resets the input type back to "password" —
 * cheaper and safer than manually restoring attributes.
 */
alaiy_os.connector_card.setup_password_reveal = function (
  frm,
  fieldname,
  connector_id,
) {
  const field = frm.get_field(fieldname);
  if (!field || !field.$input) return;
  const $input = field.$input;

  $input.off("focus.alaiy-reveal blur.alaiy-reveal");

  $input.on("focus.alaiy-reveal", () => {
    if (frm.doc.__unsaved || frm.is_new()) return;
    frappe.call({
      method: "alaiy_os.api.connectors.get_connector_password",
      args: { connector_id, fieldname },
      callback(r) {
        if (r.message) {
          $input.attr("type", "text").val(r.message);
        }
      },
    });
  });

  $input.on("blur.alaiy-reveal", () => {
    frm.refresh_field(fieldname);
  });
};
