// OS Agent Registry list.
//
// The List view is rendered as one rich card per agent (see render_agent_cards
// below) instead of Frappe's tabular rows — every field except the system
// prompt, with the whole card clicking through to the record in edit mode.
//
// Only Table (Report) also makes sense here; List/Kanban/
// Dashboard/Calendar/Gantt are Frappe's own always-on defaults
// (list_view_select.js hardcodes their `condition` to `true` for every
// doctype, so there's no doctype-level flag to turn them off) — prune the ones
// we don't want from the switcher instead. The switcher observer is
// document-level and outlives this one list view, so every check re-confirms
// "OS Agent Registry" is the doctype actually in play before doing anything.

frappe.listview_settings["OS Agent Registry"] = {
	// Top-level fields the card needs; child-table `tools` is fetched
	// separately (see below) since list queries don't return child rows.
	add_fields: [
		"agent_name",
		"agent_id",
		"description",
		"model",
		"max_turns",
		"output_format",
	],
	// Drop the default "ID" quick filter (search-by-docname, i.e. agent_id) --
	// agent_name (in_standard_filter: 1 on the doctype) is the one search box
	// this list should show.
	hide_name_filter: true,
	// base_list.js calls settings.refresh(listview) after every data render
	// (filter/sort/paginate/reload all pass through here).
	refresh(listview) {
		relabel_add_button(listview);
		simplify_toolbar(listview);
		render_agent_cards(listview);
	},
};

// The stock toolbar's "Filter" button (advanced filter builder) and sort
// selector are overkill for a small, card-based registry -- collapse the
// header down to just the Agent Name quick-search box (see in_standard_filter
// on that field). $filter_section is built once during list-view init and
// persists across re-renders, so hiding it is a one-time no-op past the
// first refresh, not a fight against re-rendering like the row/card swap
// below.
function simplify_toolbar(listview) {
	listview.$filter_section && listview.$filter_section.hide();
}

// The primary action is auto-labelled "Add {doctype}" — "Add OS Agent
// Registry" here. Users think of these as "OS Agents", so relabel just the
// button (not the doctype) to "Add OS Agent". Done on every refresh because
// ListView.set_primary_action() runs during view setup, before this hook.
function relabel_add_button(listview) {
	const btn = listview.page && listview.page.btn_primary;
	if (!btn || !btn.length) return;
	const label = __("Add OS Agent");
	const $span = btn.find("span"); // the single .hidden-xs label span
	$span.length ? $span.text(label) : btn.text(label);
	btn.attr("title", label).attr("data-label", label);
}

// parent name -> [tool_id, ...]; undefined means "not fetched yet". Tools are
// immutable per render pass, so caching avoids re-querying on every redraw.
// The cards need child-table data a plain list query can't return.
const OS_AGENT_TOOLS = {};

// Fetches OS Agent Tool rows for whichever names aren't cached yet, then
// calls on_loaded(). No-ops (and never calls on_loaded) if everything asked
// for is already cached.
function ensure_tools_fetched(names, on_loaded) {
	const missing = names.filter((n) => !(n in OS_AGENT_TOOLS));
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
			on_loaded();
		})
		.catch(() => {
			// Deliberately don't mark `missing` as resolved (e.g. to []) here --
			// that would misreport a fetch failure as "no tools configured".
			// Cards are left showing "Loading tools..." and the toast below is
			// the signal that something actually went wrong.
			alaiy_os.ui.show_error(__("Could not load agent tools."));
		});
}

function render_agent_cards(listview) {
	// settings.refresh is shared by every view that extends BaseList; only the
	// plain List view should become cards (Report renders itself).
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
	if (rows.length) ensure_tools_fetched(rows.map((d) => d.name), draw);
}

function build_agent_card(doc) {
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
			<div style="min-width:0; margin-bottom:var(--s-gap, 16px);">
				<div style="font-family:var(--s-font-serif, inherit); font-weight:var(--s-heading-weight, 600); font-size:18px; color:var(--s-heading, var(--heading-color)); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
					${frappe.utils.escape_html(title)}
				</div>
				<code class="text-muted" style="font-size:12px;">${frappe.utils.escape_html(doc.agent_id || doc.name || "")}</code>
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
		// Land on the read-only summary card (os_agent_registry.js); its Edit
		// button switches to the full form when needed.
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
