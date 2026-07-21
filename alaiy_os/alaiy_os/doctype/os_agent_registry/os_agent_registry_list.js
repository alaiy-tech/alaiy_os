// OS Agent Registry list.
//
// The List view is rendered as one rich card per agent (see render_agent_cards
// below) instead of Frappe's tabular rows — every field except the system
// prompt, with the whole card clicking through to the record in edit mode.
//
// Only Grid (Image) and Table (Report) also make sense here; List/Kanban/
// Dashboard/Calendar/Gantt are Frappe's own always-on defaults
// (list_view_select.js hardcodes their `condition` to `true` for every
// doctype, so there's no doctype-level flag to turn them off) — prune the ones
// we don't want from the switcher instead. The switcher/image observers are
// document-level and outlive this one list view, so every check re-confirms
// "OS Agent Registry" is the doctype actually in play before doing anything.

frappe.listview_settings["OS Agent Registry"] = {
	// Top-level fields the card needs; child-table `tools` is fetched
	// separately (see below) since list queries don't return child rows.
	add_fields: [
		"agent_name",
		"agent_id",
		"is_enabled",
		"description",
		"icon",
		"model",
		"max_turns",
		"output_format",
	],
	// base_list.js calls settings.refresh(listview) after every data render
	// (filter/sort/paginate/reload all pass through here).
	refresh(listview) {
		render_agent_cards(listview);
	},
};

// parent name -> [tool_id, ...]; undefined means "not fetched yet". Tools are
// immutable per render pass, so caching avoids re-querying on every redraw.
const OS_AGENT_TOOLS = {};

function render_agent_cards(listview) {
	// settings.refresh is shared by every view that extends BaseList; only the
	// plain List view should become cards (Image/Report render themselves).
	if (listview.view_name !== "List") return;

	const $result = listview.$result;
	// Hide Frappe's tabular rows + header row (both are .list-row-container).
	// render_list() rebuilds and re-shows them before each settings.refresh,
	// so we re-hide on every pass.
	$result.find(".list-row-container").hide();

	// Our own container, rebuilt each render. Sit above the paging area so
	// "Load More" stays at the bottom.
	$result.find(".os-agent-cards").remove();
	const $cards = $(`<div class="os-agent-cards"></div>`);
	const $paging = $result.find(".list-paging-area");
	$paging.length ? $cards.insertBefore($paging) : $cards.appendTo($result);

	const rows = listview.data || [];
	const draw = () => {
		$cards.empty();
		rows.forEach((doc) => $cards.append(build_agent_card(doc)));
	};
	draw();
	if (!rows.length) return;

	// Batch-fetch tools for any agents we haven't seen yet, then redraw so the
	// pills fill in. One query for the whole page.
	const missing = rows.map((d) => d.name).filter((n) => !(n in OS_AGENT_TOOLS));
	if (!missing.length) return;

	frappe.db
		.get_list("OS Agent Tool", {
			// A child table can only be queried with its parent doctype named
			// here — it authorises the read via the parent's permissions
			// (DatabaseQuery.execute(parent_doctype=...)). Passing `parent`
			// instead throws "unexpected keyword argument 'parent'".
			parent_doctype: "OS Agent Registry",
			filters: { parenttype: "OS Agent Registry", parent: ["in", missing] },
			fields: ["parent", "tool_id"],
			order_by: "idx asc",
			limit: 0,
		})
		.then((tool_rows) => {
			missing.forEach((n) => (OS_AGENT_TOOLS[n] = []));
			(tool_rows || []).forEach((r) => {
				(OS_AGENT_TOOLS[r.parent] || (OS_AGENT_TOOLS[r.parent] = [])).push(r.tool_id);
			});
			draw();
		});
}

function build_agent_card(doc) {
	const statusPill = doc.is_enabled
		? `<span class="indicator-pill green">${__("Enabled")}</span>`
		: `<span class="indicator-pill gray">${__("Disabled")}</span>`;

	// Feather icon name lives on the `icon` field; render it if set, else a
	// neutral placeholder square so the header aligns.
	const iconHtml = doc.icon
		? `<span class="os-agent-card-icon">${frappe.utils.icon(doc.icon, "lg")}</span>`
		: `<span class="os-agent-card-icon os-agent-card-icon--empty"></span>`;

	const tools = OS_AGENT_TOOLS[doc.name];
	let toolsHtml;
	if (tools === undefined) {
		toolsHtml = `<span class="text-muted">${__("Loading tools…")}</span>`;
	} else if (!tools.length) {
		toolsHtml = `<span class="text-muted">${__("No tools configured")}</span>`;
	} else {
		toolsHtml = tools
			.map((t) => `<span class="indicator-pill blue">${frappe.utils.escape_html(t)}</span>`)
			.join(" ");
	}

	const title = doc.agent_name || doc.agent_id || doc.name || "";
	const descHtml = doc.description
		? `<p style="color:var(--s-ink, var(--text-color)); margin:0 0 var(--s-gap, 16px);">${frappe.utils.escape_html(
				doc.description
		  )}</p>`
		: "";

	const $card = $(`
		<div class="frappe-card os-agent-card" style="cursor:pointer; margin-bottom:var(--s-gap, 16px);">
			<div style="display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:var(--s-gap, 16px);">
				<div style="display:flex; align-items:center; gap:14px; min-width:0;">
					${iconHtml}
					<div style="min-width:0;">
						<div style="font-family:var(--s-font-serif, inherit); font-weight:var(--s-heading-weight, 600); font-size:18px; color:var(--s-heading, var(--heading-color)); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
							${frappe.utils.escape_html(title)}
						</div>
						<code class="text-muted" style="font-size:12px;">${frappe.utils.escape_html(doc.agent_id || doc.name || "")}</code>
					</div>
				</div>
				${statusPill}
			</div>

			${descHtml}

			<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:var(--s-gap, 16px); margin-bottom:var(--s-gap, 16px);">
				<div><div class="control-label">${__("Model")}</div><div>${frappe.utils.escape_html(doc.model || "")}</div></div>
				<div><div class="control-label">${__("Max Turns")}</div><div>${doc.max_turns || 0}</div></div>
				<div><div class="control-label">${__("Output Format")}</div><div>${frappe.utils.escape_html(doc.output_format || "")}</div></div>
			</div>

			<div>
				<div class="control-label">${__("Tools it can use")}</div>
				<div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">${toolsHtml}</div>
			</div>
		</div>
	`);

	$card.on("click", () => {
		// Land directly in the editable form, skipping the read-only summary
		// card (os_agent_registry.js reads this flag on its first refresh).
		frappe._osAgentOpenInEdit = doc.name;
		frappe.set_route("Form", "OS Agent Registry", doc.name);
	});

	return $card;
}

const OS_AGENT_HIDDEN_VIEWS = ["Kanban View", "Dashboard View", "Calendar View", "Gantt View"];

if (!frappe._osAgentSwitcherObserver) {
	const pruneSwitcher = () => {
		if (frappe.get_route()?.[1] !== "OS Agent Registry") return;
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
		const link = item.querySelector('a[data-doctype="OS Agent Registry"][data-name]');
		if (link) frappe.set_route("Form", "OS Agent Registry", link.getAttribute("data-name"));
	});
}
