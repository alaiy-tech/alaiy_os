// Connector Health Settings: a button to check the Slack webhook.
frappe.ui.form.on("Connector Health Settings", {
	refresh(frm) {
		frm.add_custom_button(__("Send test message"), () => {
			if (frm.is_dirty()) {
				frappe.msgprint({ title: __("Slack"), message: __("Save the settings first."), indicator: "orange" });
				return;
			}
			frappe.call({
				method: "alaiy_os.api.health.send_test_alert",
				freeze: true,
				callback: (r) => {
					const result = r.message || {};
					frappe.msgprint({
						title: __("Slack"),
						message: frappe.utils.escape_html(result.message || ""),
						indicator: result.sent ? "green" : "red",
					});
				},
			});
		});
	},
});
