// OS Agent Registry form — shows a read-only "what this agent does" summary
// card first (built from themed .frappe-card/.control-label/.indicator-pill/
// .btn-primary primitives), with an Edit button that reveals the normal,
// fully-editable field layout and a "View summary" toolbar button to switch
// back without a reload. New/unsaved agents skip straight to the normal form
// since there's nothing yet to summarise.

frappe.ui.form.on("OS Agent Registry", {
	refresh(frm) {
		// Arriving from a list card: open straight in the editable layout,
		// skipping the read-only summary (flag set in os_agent_registry_list.js).
		if (frappe._osAgentOpenInEdit && frappe._osAgentOpenInEdit === frm.doc.name) {
			frappe._osAgentOpenInEdit = null;
			frm.__os_agent_edit_mode = true;
		}
		// New docs have nothing to summarise — stay in the editable layout.
		if (frm.is_new()) {
			frm.__os_agent_edit_mode = true;
			return;
		}
		if (frm.__os_agent_edit_mode) {
			// Frappe rebuilds custom buttons on every refresh, so adding it
			// here is idempotent — it won't stack up.
			frm.layout.wrapper.show();
			frm.add_custom_button(__("View summary"), () => {
				frm.__os_agent_edit_mode = false;
				frm.refresh();
			});
			return;
		}
		render_details_view(frm);
	},
});

function render_details_view(frm) {
	if (frm.__details_wrapper) frm.__details_wrapper.remove();
	frm.layout.wrapper.hide();

	// Child field is `tool_id` (OS Agent Tool) — show it as a pill, with the
	// tool's description as a hover title so admins can eyeball the wiring.
	const tools = (frm.doc.tools || []).filter((r) => r.tool_id);
	const toolsHtml = tools.length
		? tools
				.map(
					(r) =>
						`<span class="indicator-pill blue" title="${frappe.utils.escape_html(
							r.description || ""
						)}">${frappe.utils.escape_html(r.tool_id)}</span>`
				)
				.join(" ")
		: `<span class="text-muted">${__("No tools configured")}</span>`;

	const avatar = frm.doc.agent_avatar || "/assets/images/client-logo-square.png";
	const statusPill = frm.doc.is_enabled
		? `<span class="indicator-pill green">${__("Enabled")}</span>`
		: `<span class="indicator-pill gray">${__("Disabled")}</span>`;

	// Human-readable name for the heading; keep the machine agent_id visible
	// but demoted to a small code chip beside the status.
	const title = frm.doc.agent_name || frm.doc.agent_id || "";

	// The system prompt is authored in Markdown — render it so headings, bold
	// and lists read as intended instead of showing raw ## and ** literals.
	// System-Manager-only editable, so the rendered HTML is trusted.
	const promptHtml = frm.doc.system_prompt
		? frappe.markdown(frm.doc.system_prompt)
		: `<span class="text-muted">${__("No system prompt set yet.")}</span>`;

	const descHtml = frm.doc.description
		? `<p style="color:var(--s-ink); margin-bottom:var(--s-gap);">${frappe.utils.escape_html(
				frm.doc.description
		  )}</p>`
		: "";

	const $details = $(`
		<div class="frappe-card os-agent-details" style="margin-bottom: var(--s-gap);">
			<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:var(--s-gap);">
				<div style="display:flex; align-items:center; gap:14px;">
					<img src="${avatar}" style="width:48px; height:48px; border-radius:var(--s-radius); object-fit:cover; box-shadow:var(--s-shadow-sm);">
					<div>
						<div style="font-family:var(--s-font-serif); font-weight:var(--s-heading-weight); font-size:20px; color:var(--s-heading);">
							${frappe.utils.escape_html(title)}
						</div>
						<div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
							${statusPill}
							<code class="text-muted" style="font-size:12px;">${frappe.utils.escape_html(frm.doc.agent_id || "")}</code>
						</div>
					</div>
				</div>
				<button class="btn btn-primary btn-sm os-agent-edit-btn">${__("Edit")}</button>
			</div>

			${descHtml}

			<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:var(--s-gap); margin-bottom:var(--s-gap);">
				<div><div class="control-label">${__("Model")}</div><div>${frappe.utils.escape_html(frm.doc.model || "")}</div></div>
				<div><div class="control-label">${__("Max Turns")}</div><div>${frm.doc.max_turns || 0}</div></div>
				<div><div class="control-label">${__("Output Format")}</div><div>${frappe.utils.escape_html(frm.doc.output_format || "")}</div></div>
			</div>

			<div style="margin-bottom:var(--s-gap);">
				<div class="control-label">${__("Tools it can use")}</div>
				<div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">${toolsHtml}</div>
			</div>

			<div>
				<div class="control-label">${__("System prompt")}</div>
				<div class="os-agent-prompt" style="margin-top:6px; max-height:340px; overflow:auto; padding:12px 16px; border:1px solid var(--border-color); border-radius:var(--s-radius); background:var(--control-bg);">
					${promptHtml}
				</div>
			</div>
		</div>
	`).insertBefore(frm.layout.wrapper);

	$details.find(".os-agent-edit-btn").on("click", () => {
		frm.__os_agent_edit_mode = true;
		$details.remove();
		frm.__details_wrapper = null;
		// Full refresh so the layout comes back and the "View summary" toolbar
		// button is added by the refresh handler above.
		frm.refresh();
	});

	frm.__details_wrapper = $details;
}
