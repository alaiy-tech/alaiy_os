// OS Agent form — shows a read-only "what this agent does" summary first
// (built from .frappe-card/.control-label/.indicator-pill/.btn-primary —
// all already themed, nothing new), with an Edit button that reveals the
// normal, fully-editable field layout. New/unsaved agents skip straight to
// the normal form since there's nothing yet to summarise.

frappe.ui.form.on("OS Agent", {
	refresh(frm) {
		if (frm.is_new() || frm.__os_agent_edit_mode) return;
		render_details_view(frm);
	},
});

function render_details_view(frm) {
	if (frm.__details_wrapper) frm.__details_wrapper.remove();
	frm.layout.wrapper.hide();

	const tools = (frm.doc.tools || []).map((r) => r.tool).filter(Boolean);
	const toolsHtml = tools.length
		? tools
				.map((t) => `<span class="indicator-pill blue">${frappe.utils.escape_html(t)}</span>`)
				.join(" ")
		: `<span class="text-muted">${__("No tools configured")}</span>`;

	const avatar = frm.doc.agent_avatar || "/assets/images/client-logo-square.png";
	const statusPill = frm.doc.is_enabled
		? `<span class="indicator-pill green">${__("Enabled")}</span>`
		: `<span class="indicator-pill gray">${__("Disabled")}</span>`;

	const $details = $(`
		<div class="frappe-card os-agent-details" style="margin-bottom: var(--s-gap);">
			<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:var(--s-gap);">
				<div style="display:flex; align-items:center; gap:14px;">
					<img src="${avatar}" style="width:48px; height:48px; border-radius:var(--s-radius); object-fit:cover; box-shadow:var(--s-shadow-sm);">
					<div>
						<div style="font-family:var(--s-font-serif); font-weight:var(--s-heading-weight); font-size:20px; color:var(--s-heading);">
							${frappe.utils.escape_html(frm.doc.agent_id || "")}
						</div>
						<div style="margin-top:4px;">${statusPill}</div>
					</div>
				</div>
				<button class="btn btn-primary os-agent-edit-btn">${__("Edit")}</button>
			</div>

			<div style="margin-bottom:var(--s-gap);">
				<div class="control-label">${__("What this agent does")}</div>
				<p style="color:var(--s-ink); white-space:pre-wrap; margin-top:6px;">
					${frappe.utils.escape_html(frm.doc.system_prompt || __("No description set yet."))}
				</p>
			</div>

			<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:var(--s-gap); margin-bottom:var(--s-gap);">
				<div><div class="control-label">${__("Model")}</div><div>${frappe.utils.escape_html(frm.doc.model || "")}</div></div>
				<div><div class="control-label">${__("Max Turns")}</div><div>${frm.doc.max_turns || 0}</div></div>
				<div><div class="control-label">${__("Output Format")}</div><div>${frappe.utils.escape_html(frm.doc.output_format || "")}</div></div>
			</div>

			<div>
				<div class="control-label">${__("Tools it can use")}</div>
				<div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">${toolsHtml}</div>
			</div>
		</div>
	`).insertBefore(frm.layout.wrapper);

	$details.find(".os-agent-edit-btn").on("click", () => {
		frm.__os_agent_edit_mode = true;
		$details.remove();
		frm.__details_wrapper = null;
		frm.layout.wrapper.show();
	});

	frm.__details_wrapper = $details;
}
