frappe.pages["connector-settings"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Connector Settings"),
		single_column: true,
	});
	wrapper.__alaiy_page = page;
	$(page.body).css({ padding: "24px", overflowY: "auto" });
};

frappe.pages["connector-settings"].on_page_show = function (wrapper) {
	const page = wrapper.__alaiy_page;
	if (!page) return;

	$(page.body).empty();

	if (
		window.alaiy_os &&
		alaiy_os.settings &&
		typeof alaiy_os.settings._mountConnectorsTab === "function"
	) {
		alaiy_os.settings._mountConnectorsTab(page.body);
	} else {
		const msg = document.createElement("div");
		msg.className = "alert alert-warning";
		msg.style.margin = "0";
		msg.textContent = __("Connector settings module not loaded.");
		page.body.appendChild(msg);
	}
};
