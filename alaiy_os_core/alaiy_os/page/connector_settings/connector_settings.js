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

	// Highlight the "Connectors" sidebar item as active
	document.querySelectorAll(".sidebar-item-container").forEach((el) => {
		if (el.getAttribute("item-name") === "Connectors") {
			el.classList.add("active-sidebar");
		} else {
			el.classList.remove("active-sidebar");
		}
	});

	const bodyEl = page.body instanceof jQuery ? page.body[0] : page.body;

	if (
		window.alaiy_os &&
		alaiy_os.settings &&
		typeof alaiy_os.settings._mountConnectorsTab === "function"
	) {
		alaiy_os.settings._mountConnectorsTab(bodyEl);
	} else {
		const msg = document.createElement("div");
		msg.className = "alert alert-warning";
		msg.style.margin = "0";
		msg.textContent = __("Connector settings module not loaded.");
		bodyEl.appendChild(msg);
	}
};
