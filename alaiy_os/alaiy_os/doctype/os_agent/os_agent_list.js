// OS Agent list — only Grid (Image) and Table (Report) make sense for
// agents; List/Kanban/Dashboard/Calendar/Gantt are Frappe's own always-on
// defaults (list_view_select.js hardcodes their `condition` to `true` for
// every doctype, so there's no doctype-level flag to turn them off) — prune
// them from the switcher instead. Registered at script-load time (not inside
// a `listview_settings.onload`) because ImageView overrides `setup_view()`
// without calling `this.settings.onload()` (see frappe/public/js/frappe/
// views/image/image_view.js) — onload simply never fires there. These are
// document-level listeners that outlive this one list view, so every check
// re-confirms "OS Agent" is the doctype actually in play before doing anything,
// to avoid leaking this behaviour onto other doctypes' lists later in the SPA
// session.
frappe.listview_settings["OS Agent"] = {};

const OS_AGENT_HIDDEN_VIEWS = ["Kanban View", "Dashboard View", "Calendar View", "Gantt View"];

if (!frappe._osAgentSwitcherObserver) {
	const pruneSwitcher = () => {
		if (frappe.get_route()?.[1] !== "OS Agent") return;
		document.querySelectorAll(".dropdown-menu.show .dropdown-item").forEach((el) => {
			if (OS_AGENT_HIDDEN_VIEWS.includes(el.textContent.trim())) {
				el.style.display = "none";
			}
		});
	};
	frappe._osAgentSwitcherObserver = new MutationObserver(() => pruneSwitcher());
	// Bootstrap toggles the dropdown open/closed via a `class="... show"` flip
	// on a menu that's already in the DOM — no nodes are added/removed, so
	// `childList` alone never fires here; attribute changes must be watched too.
	frappe._osAgentSwitcherObserver.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["class"],
	});
}

// Image (grid) view: only the small placeholder box and the name text in the
// footer are real links (image_view.js#item_html) — most of the card
// (including the header row) does nothing when clicked. Make the whole card
// navigate, except the checkbox/like-icon which need their own click
// behaviour preserved.
if (!frappe._osAgentImageCardNav) {
	frappe._osAgentImageCardNav = true;
	document.addEventListener("click", function (e) {
		const item = e.target.closest(".image-view-item");
		if (!item || !item.closest(".image-view-container")) return;
		if (e.target.closest("input, .like-action, a")) return;
		const link = item.querySelector('a[data-doctype="OS Agent"][data-name]');
		if (link) frappe.set_route("Form", "OS Agent", link.getAttribute("data-name"));
	});
}
