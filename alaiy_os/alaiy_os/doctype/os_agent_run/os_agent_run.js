frappe.ui.form.on("OS Agent Run", {
	refresh(frm) {
		render_image_preview(frm);
	},
});

function render_image_preview(frm) {
	const wrapper = frm.get_field("image_preview").$wrapper;
	wrapper.empty();

	let images;
	try {
		images = JSON.parse(frm.doc.output || "null")?.images;
	} catch (e) {
		return;
	}
	if (!Array.isArray(images) || !images.length) return;

	const cards = images
		.map((img) => {
			if (img.url) {
				return `
					<a href="${img.url}" target="_blank" class="text-muted" style="text-decoration: none;">
						<div style="display: inline-block; margin: 0 10px 10px 0; text-align: center; width: 160px;">
							<img src="${frappe.utils.escape_html(img.url)}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color);" />
							<div style="font-size: 12px; margin-top: 4px;">${frappe.utils.escape_html(img.kind || "")}</div>
						</div>
					</a>`;
			}
			return `
				<div style="display: inline-block; margin: 0 10px 10px 0; text-align: center; width: 160px;">
					<div style="width: 100%; height: 160px; border-radius: 4px; border: 1px dashed var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 12px; padding: 8px;">
						not generated
					</div>
					<div style="font-size: 12px; margin-top: 4px;">${frappe.utils.escape_html(img.kind || "")}</div>
				</div>`;
		})
		.join("");

	wrapper.html(`<div style="margin-top: 8px;">${cards}</div>`);
}
