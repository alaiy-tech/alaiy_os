/**
 * AlaiyOS — Product Catalog page
 *
 * A self-contained catalog view over the "OS Product" DocType.
 * Features: stats summary, status filters, search, table/grid toggle,
 * CSV download and CSV import. Backed by alaiy_os_core.api.products.
 */

frappe.provide("alaiy_os.product_catalog");

const STATUSES = ["Active", "Draft", "Out of Stock", "Discontinued"];

const STATUS_CLASS = {
	"Active": "st-active",
	"Draft": "st-draft",
	"Out of Stock": "st-oos",
	"Discontinued": "st-disc",
};

const COLUMNS = [
	{ key: "sku", label: "SKU" },
	{ key: "brand", label: "Brand" },
	{ key: "product_name", label: "Product" },
	{ key: "category", label: "Category" },
	{ key: "supplier", label: "Supplier" },
	{ key: "fulfillment", label: "Fulfillment" },
	{ key: "cost", label: "Cost", money: true },
	{ key: "sale_price", label: "Sale Price", money: true },
	{ key: "retail_price", label: "Retail", money: true },
	{ key: "inventory", label: "Inv.", num: true },
	{ key: "status", label: "Status" },
];

const PC = alaiy_os.product_catalog;

PC.state = {
	rows: [],
	filter: "All",
	search: "",
	view: "table", // "table" | "grid"
};

frappe.pages["product-catalog"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Product Catalog"),
		single_column: true,
	});
	wrapper.__pc_page = page;
	PC._injectStyles();

	// Header action buttons
	page.set_primary_action(
		__("Import Products"),
		() => PC.openImport(),
		"upload",
	);
	page.add_button(__("Download CSV"), () => PC.downloadCSV(), { icon: "download" });
	page.add_button(__("New Product"), () => frappe.new_doc("OS Product"));
	page.add_menu_item(__("Seed 40 demo products"), () => PC.seed(40, false));
	page.add_menu_item(__("Purge & reseed"), () => PC.seed(40, true));

	// Body scaffold
	const body = page.body instanceof jQuery ? page.body[0] : page.body;
	body.innerHTML = `
		<div class="pc-root">
			<div class="pc-stats" id="pc-stats"></div>
			<div class="pc-toolbar">
				<div class="pc-filters" id="pc-filters"></div>
				<div class="pc-toolbar-right">
					<div class="pc-search">
						<span>${frappe.utils.icon("search", "sm")}</span>
						<input type="text" id="pc-search" placeholder="${__("Search SKU, product, brand…")}">
					</div>
					<div class="pc-view-toggle" id="pc-view-toggle">
						<button data-view="table" class="active" title="${__("Table view")}">
							${frappe.utils.icon("list", "sm")}
						</button>
						<button data-view="grid" title="${__("Grid view")}">
							${frappe.utils.icon("grid", "sm")}
						</button>
					</div>
				</div>
			</div>
			<div class="pc-content" id="pc-content"></div>
		</div>`;

	// Wire up static controls
	body.querySelector("#pc-search").addEventListener("input", (e) => {
		PC.state.search = e.target.value.trim().toLowerCase();
		PC.render();
	});
	body.querySelectorAll("#pc-view-toggle button").forEach((btn) => {
		btn.addEventListener("click", () => {
			PC.state.view = btn.dataset.view;
			body.querySelectorAll("#pc-view-toggle button").forEach((b) =>
				b.classList.toggle("active", b === btn),
			);
			PC.render();
		});
	});

	PC._renderFilters(body);
};

frappe.pages["product-catalog"].on_page_show = function () {
	PC.reload();
};

// ── Data ────────────────────────────────────────────────────────────────────

PC.reload = function () {
	const content = document.getElementById("pc-content");
	if (content) content.innerHTML = `<div class="pc-empty">${__("Loading…")}</div>`;
	frappe.call({
		method: "alaiy_os_core.api.products.get_products",
		callback: (r) => {
			PC.state.rows = r.message || [];
			PC.render();
		},
		error: () => {
			if (content)
				content.innerHTML = `<div class="pc-empty pc-error">${__("Could not load products.")}</div>`;
		},
	});
};

PC._filtered = function () {
	const { rows, filter, search } = PC.state;
	return rows.filter((row) => {
		if (filter !== "All" && row.status !== filter) return false;
		if (search) {
			const hay = `${row.sku} ${row.product_name} ${row.brand} ${row.category} ${row.supplier}`.toLowerCase();
			if (!hay.includes(search)) return false;
		}
		return true;
	});
};

// ── Rendering ─────────────────────────────────────────────────────────────

PC.render = function () {
	PC._renderStats();
	PC._syncFilterCounts();
	const content = document.getElementById("pc-content");
	if (!content) return;

	const rows = PC._filtered();
	if (!rows.length) {
		content.innerHTML = `<div class="pc-empty">${
			PC.state.rows.length
				? __("No products match your filters.")
				: __("No products yet. Use “Import Products” or the ⋯ menu to seed demo data.")
		}</div>`;
		return;
	}

	content.innerHTML = PC.state.view === "grid" ? PC._grid(rows) : PC._table(rows);
	PC._wireRowActions(content);
};

PC._renderStats = function () {
	const el = document.getElementById("pc-stats");
	if (!el) return;
	const rows = PC.state.rows;
	const active = rows.filter((r) => r.status === "Active").length;
	const oos = rows.filter((r) => r.status === "Out of Stock").length;
	const invValue = rows.reduce((s, r) => s + (r.cost || 0) * (r.inventory || 0), 0);
	const cards = [
		{ label: __("Total Products"), value: rows.length, icon: "package" },
		{ label: __("Active"), value: active, icon: "check", accent: "green" },
		{ label: __("Out of Stock"), value: oos, icon: "alert", accent: "red" },
		{ label: __("Inventory Value"), value: PC._money(invValue), icon: "money", accent: "blue" },
	];
	el.innerHTML = cards
		.map(
			(c) => `
		<div class="pc-stat ${c.accent ? "accent-" + c.accent : ""}">
			<div class="pc-stat-icon">${frappe.utils.icon(c.icon, "md")}</div>
			<div class="pc-stat-body">
				<div class="pc-stat-value">${c.value}</div>
				<div class="pc-stat-label">${c.label}</div>
			</div>
		</div>`,
		)
		.join("");
};

PC._renderFilters = function (body) {
	const el = body.querySelector("#pc-filters");
	const chips = ["All", ...STATUSES];
	el.innerHTML = chips
		.map(
			(s) =>
				`<button class="pc-chip ${s === "All" ? "active" : ""}" data-status="${s}">
					<span class="pc-chip-label">${__(s)}</span>
					<span class="pc-chip-count" data-count="${s}"></span>
				</button>`,
		)
		.join("");
	el.querySelectorAll(".pc-chip").forEach((chip) => {
		chip.addEventListener("click", () => {
			PC.state.filter = chip.dataset.status;
			el.querySelectorAll(".pc-chip").forEach((c) =>
				c.classList.toggle("active", c === chip),
			);
			PC.render();
		});
	});
};

PC._syncFilterCounts = function () {
	const rows = PC.state.rows;
	document.querySelectorAll(".pc-chip-count").forEach((el) => {
		const s = el.dataset.count;
		el.textContent = s === "All" ? rows.length : rows.filter((r) => r.status === s).length;
	});
};

PC._table = function (rows) {
	const head = COLUMNS.map(
		(c) => `<th class="${c.money || c.num ? "num" : ""}">${__(c.label)}</th>`,
	).join("");
	const body = rows
		.map((row) => {
			const cells = COLUMNS.map((c) => {
				if (c.key === "status") {
					return `<td>${PC._badge(row.status)}</td>`;
				}
				if (c.money) return `<td class="num">${PC._money(row[c.key])}</td>`;
				if (c.num) return `<td class="num">${row[c.key] ?? 0}</td>`;
				const val = frappe.utils.escape_html(row[c.key] || "");
				const strong = c.key === "product_name" ? "pc-strong" : "";
				return `<td class="${strong}">${val || '<span class="pc-muted">—</span>'}</td>`;
			}).join("");
			return `<tr data-name="${frappe.utils.escape_html(row.name)}">
				${cells}
				<td class="pc-actions">
					<button class="pc-icon-btn" data-act="edit" title="${__("Edit")}">${frappe.utils.icon("edit", "sm")}</button>
					<button class="pc-icon-btn danger" data-act="delete" title="${__("Delete")}">${frappe.utils.icon("delete", "sm")}</button>
				</td>
			</tr>`;
		})
		.join("");
	return `<div class="pc-table-wrap">
		<table class="pc-table">
			<thead><tr>${head}<th class="num">${__("Actions")}</th></tr></thead>
			<tbody>${body}</tbody>
		</table>
	</div>`;
};

PC._grid = function (rows) {
	const cards = rows
		.map((row) => {
			const margin = row.retail_price && row.cost
				? Math.round(((row.retail_price - row.cost) / row.retail_price) * 100)
				: null;
			return `<div class="pc-card" data-name="${frappe.utils.escape_html(row.name)}">
				<div class="pc-card-top">
					<span class="pc-card-sku">${frappe.utils.escape_html(row.sku)}</span>
					${PC._badge(row.status)}
				</div>
				<div class="pc-card-title">${frappe.utils.escape_html(row.product_name || "")}</div>
				<div class="pc-card-sub">${frappe.utils.escape_html(row.brand || "—")} · ${frappe.utils.escape_html(row.category || "—")}</div>
				<div class="pc-card-grid">
					<div><span>${__("Retail")}</span><b>${PC._money(row.retail_price)}</b></div>
					<div><span>${__("Sale")}</span><b>${PC._money(row.sale_price)}</b></div>
					<div><span>${__("Cost")}</span><b>${PC._money(row.cost)}</b></div>
					<div><span>${__("Inv.")}</span><b>${row.inventory ?? 0}</b></div>
				</div>
				<div class="pc-card-foot">
					<span class="pc-muted">${frappe.utils.escape_html(row.supplier || "")}${
						margin !== null ? ` · ${margin}% ${__("margin")}` : ""
					}</span>
					<span class="pc-card-actions">
						<button class="pc-icon-btn" data-act="edit" title="${__("Edit")}">${frappe.utils.icon("edit", "sm")}</button>
						<button class="pc-icon-btn danger" data-act="delete" title="${__("Delete")}">${frappe.utils.icon("delete", "sm")}</button>
					</span>
				</div>
			</div>`;
		})
		.join("");
	return `<div class="pc-cards">${cards}</div>`;
};

PC._wireRowActions = function (content) {
	content.querySelectorAll("[data-act]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			const host = btn.closest("[data-name]");
			const name = host && host.dataset.name;
			if (!name) return;
			if (btn.dataset.act === "edit") {
				frappe.set_route("Form", "OS Product", name);
			} else if (btn.dataset.act === "delete") {
				frappe.confirm(__("Delete product {0}?", [name]), () => {
					frappe.call({
						method: "frappe.client.delete",
						args: { doctype: "OS Product", name },
						callback: () => {
							frappe.show_alert({ message: __("Deleted"), indicator: "green" });
							PC.reload();
						},
					});
				});
			}
		});
	});
};

// ── CSV download ────────────────────────────────────────────────────────────

PC.downloadCSV = function () {
	const rows = PC._filtered();
	if (!rows.length) {
		frappe.msgprint(__("Nothing to export."));
		return;
	}
	const headers = COLUMNS.map((c) => c.label);
	const keys = COLUMNS.map((c) => c.key);
	const esc = (v) => {
		const s = v === null || v === undefined ? "" : String(v);
		return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	const lines = [headers.join(",")];
	rows.forEach((row) => lines.push(keys.map((k) => esc(row[k])).join(",")));
	const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `product-catalog-${frappe.datetime.now_date()}.csv`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
};

// ── CSV import ────────────────────────────────────────────────────────────────

// Maps flexible CSV headers → OS Product fieldnames.
const IMPORT_HEADER_MAP = {
	sku: "sku",
	brand: "brand",
	product: "product_name",
	"product name": "product_name",
	category: "category",
	supplier: "supplier",
	fulfillment: "fulfillment",
	cost: "cost",
	"sale price": "sale_price",
	"solist price": "sale_price",
	retail: "retail_price",
	"retail price": "retail_price",
	inv: "inventory",
	"inv.": "inventory",
	inventory: "inventory",
	status: "status",
};

PC.openImport = function () {
	const cols = ["SKU", "Product", "Brand", "Category", "Supplier", "Fulfillment", "Cost", "Sale Price", "Retail", "Inv.", "Status"];
	const d = new frappe.ui.Dialog({
		title: __("Import Products"),
		size: "large",
		fields: [
			{
				fieldtype: "HTML",
				options: `<div class="pc-import-help">
					<h4>${frappe.utils.icon("upload", "sm")} ${__("Upload a CSV file")}</h4>
					<p>${__("The file needs a header row. Rows are matched to existing products by SKU — existing SKUs are updated and new ones are created.")}</p>
					<div class="pc-import-cols-label">${__("Recognised columns")}</div>
					<div class="pc-import-cols">${cols.map((c) => `<span>${frappe.utils.escape_html(c)}</span>`).join("")}</div>
					<p class="pc-import-foot">${__("Not sure about the format?")} <a class="pc-import-link" data-pc-sample="1">${__("Download a sample CSV")}</a></p>
				</div>`,
			},
			{ fieldtype: "Attach", fieldname: "csv", label: __("CSV File"), reqd: 1 },
		],
		primary_action_label: __("Import"),
		primary_action: (values) => {
			PC._doImport(values.csv, d);
		},
	});
	d.$wrapper.find("[data-pc-sample]").on("click", (e) => {
		e.preventDefault();
		PC.downloadSample();
	});
	d.show();
};

// Small starter CSV so users can see the exact expected shape.
PC.downloadSample = function () {
	const headers = COLUMNS.map((c) => c.label);
	const rows = [
		["ACME-1001", "Alto Moda", "Classic Tee", "Apparel", "Meridian Supply Co", "In-house", "12.50", "24.00", "29.99", "120", "Active"],
		["ACME-1002", "Zephyr", "Everyday Sneaker", "Footwear", "Bluewave Traders", "Dropship", "38.00", "79.00", "89.00", "45", "Active"],
	];
	const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
	const lines = [headers.join(",")];
	rows.forEach((r) => lines.push(r.map(esc).join(",")));
	const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "product-catalog-sample.csv";
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
};

PC._doImport = function (fileUrl, dialog) {
	// fileUrl is a server path (e.g. /files/x.csv) — fetch and parse it.
	fetch(fileUrl)
		.then((r) => r.text())
		.then((text) => {
			const rows = PC._parseCSV(text);
			if (!rows.length) {
				frappe.msgprint(__("No data rows found in the file."));
				return;
			}
			frappe.call({
				method: "alaiy_os_core.api.products.import_products",
				args: { rows: JSON.stringify(rows) },
				freeze: true,
				freeze_message: __("Importing…"),
				callback: (r) => {
					const res = r.message || {};
					dialog.hide();
					let msg = __("Imported: {0} created, {1} updated.", [
						res.created || 0,
						res.updated || 0,
					]);
					if (res.errors && res.errors.length) {
						msg += "<br><br><b>" + __("Errors") + ":</b><br>" + res.errors.join("<br>");
					}
					frappe.msgprint({ title: __("Import complete"), message: msg });
					PC.reload();
				},
			});
		})
		.catch(() => frappe.msgprint(__("Could not read the uploaded file.")));
};

PC._parseCSV = function (text) {
	const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim() !== "");
	if (lines.length < 2) return [];
	const header = PC._splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
	const out = [];
	for (let i = 1; i < lines.length; i++) {
		const cells = PC._splitCSVLine(lines[i]);
		const row = {};
		header.forEach((h, idx) => {
			const field = IMPORT_HEADER_MAP[h];
			if (field) row[field] = (cells[idx] || "").trim();
		});
		if (row.sku) out.push(row);
	}
	return out;
};

PC._splitCSVLine = function (line) {
	const result = [];
	let cur = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"' && line[i + 1] === '"') {
				cur += '"';
				i++;
			} else if (ch === '"') {
				inQuotes = false;
			} else {
				cur += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ",") {
			result.push(cur);
			cur = "";
		} else {
			cur += ch;
		}
	}
	result.push(cur);
	return result;
};

// ── Seeding (demo) ────────────────────────────────────────────────────────

PC.seed = function (count, purge) {
	frappe.call({
		method: "alaiy_os_core.api.products.seed_products",
		args: { count, purge: purge ? 1 : 0 },
		freeze: true,
		freeze_message: __("Generating demo products…"),
		callback: (r) => {
			frappe.show_alert({
				message: __("Seeded {0} products", [(r.message || {}).seeded || 0]),
				indicator: "green",
			});
			PC.reload();
		},
	});
};

// ── Helpers ───────────────────────────────────────────────────────────────

PC._badge = function (status) {
	const cls = STATUS_CLASS[status] || "st-draft";
	return `<span class="pc-badge ${cls}">${frappe.utils.escape_html(status || "—")}</span>`;
};

PC._money = function (v) {
	if (v === null || v === undefined || v === "") return '<span class="pc-muted">—</span>';
	try {
		return format_currency(v, frappe.boot.sysdefaults.currency);
	} catch (e) {
		return Number(v).toFixed(2);
	}
};

// ── Styles ────────────────────────────────────────────────────────────────

PC._injectStyles = function () {
	if (document.getElementById("pc-styles")) return;
	const style = document.createElement("style");
	style.id = "pc-styles";
	style.textContent = `
	.pc-root { padding: 4px 2px 40px; }
	.pc-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 20px; }
	.pc-stat { display: flex; align-items: center; gap: 14px; background: var(--card-bg, #fff); border: 1px solid var(--border-color, #e5e7eb); border-radius: 12px; padding: 16px 18px; box-shadow: 0 1px 2px rgba(0,0,0,.03); }
	.pc-stat-icon { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 10px; background: var(--bg-light-gray, #f3f4f6); color: var(--text-muted, #6b7280); }
	.pc-stat.accent-green .pc-stat-icon { background: #dcfce7; color: #16a34a; }
	.pc-stat.accent-red .pc-stat-icon { background: #fee2e2; color: #dc2626; }
	.pc-stat.accent-blue .pc-stat-icon { background: #dbeafe; color: #2563eb; }
	.pc-stat-value { font-size: 22px; font-weight: 700; line-height: 1.1; color: var(--text-color, #111827); }
	.pc-stat-label { font-size: 12px; color: var(--text-muted, #6b7280); margin-top: 2px; }

	.pc-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
	.pc-filters { display: flex; gap: 8px; flex-wrap: wrap; }
	.pc-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border-color, #e5e7eb); background: var(--card-bg, #fff); color: var(--text-muted, #6b7280); border-radius: 999px; padding: 5px 13px; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all .12s; }
	.pc-chip:hover { border-color: var(--gray-400, #9ca3af); }
	.pc-chip.active { background: var(--text-color, #111827); border-color: var(--text-color, #111827); color: #fff; }
	.pc-chip-count { font-size: 11px; background: rgba(0,0,0,.06); padding: 0 6px; border-radius: 999px; min-width: 18px; text-align: center; }
	.pc-chip.active .pc-chip-count { background: rgba(255,255,255,.22); }

	.pc-toolbar-right { display: flex; align-items: center; gap: 10px; }
	.pc-search { display: flex; align-items: center; gap: 6px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; padding: 5px 10px; background: var(--card-bg, #fff); color: var(--text-muted, #6b7280); }
	.pc-search input { border: none; outline: none; background: transparent; font-size: 13px; width: 200px; color: var(--text-color, #111827); }
	.pc-view-toggle { display: inline-flex; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; overflow: hidden; }
	.pc-view-toggle button { border: none; background: var(--card-bg, #fff); padding: 6px 10px; cursor: pointer; color: var(--text-muted, #9ca3af); display: flex; align-items: center; }
	.pc-view-toggle button.active { background: var(--text-color, #111827); color: #fff; }

	.pc-table-wrap { overflow-x: auto; border: 1px solid var(--border-color, #e5e7eb); border-radius: 12px; background: var(--card-bg, #fff); }
	.pc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
	.pc-table thead th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted, #6b7280); font-weight: 600; padding: 12px 14px; border-bottom: 1px solid var(--border-color, #e5e7eb); background: var(--bg-light-gray, #f9fafb); white-space: nowrap; }
	.pc-table tbody td { padding: 11px 14px; border-bottom: 1px solid var(--border-color, #f1f3f5); color: var(--text-color, #374151); white-space: nowrap; }
	.pc-table tbody tr:last-child td { border-bottom: none; }
	.pc-table tbody tr:hover { background: var(--bg-light-gray, #f9fafb); }
	.pc-table .num { text-align: right; }
	.pc-strong { font-weight: 600; color: var(--text-color, #111827); }
	.pc-muted { color: var(--text-muted, #9ca3af); }

	.pc-badge { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
	.pc-badge.st-active { background: #dcfce7; color: #15803d; }
	.pc-badge.st-draft { background: #f3f4f6; color: #6b7280; }
	.pc-badge.st-oos { background: #fef3c7; color: #b45309; }
	.pc-badge.st-disc { background: #fee2e2; color: #b91c1c; }

	.pc-actions, .pc-card-actions { display: flex; gap: 6px; justify-content: flex-end; }
	.pc-icon-btn { border: 1px solid var(--border-color, #e5e7eb); background: var(--card-bg, #fff); border-radius: 7px; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted, #6b7280); }
	.pc-icon-btn:hover { background: var(--bg-light-gray, #f3f4f6); color: var(--text-color, #111827); }
	.pc-icon-btn.danger:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }

	.pc-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
	.pc-card { border: 1px solid var(--border-color, #e5e7eb); border-radius: 12px; background: var(--card-bg, #fff); padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.03); transition: box-shadow .12s, transform .12s; }
	.pc-card:hover { box-shadow: 0 6px 18px rgba(0,0,0,.08); transform: translateY(-2px); }
	.pc-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
	.pc-card-sku { font-size: 11px; font-weight: 600; letter-spacing: .04em; color: var(--text-muted, #9ca3af); }
	.pc-card-title { font-size: 15px; font-weight: 600; color: var(--text-color, #111827); }
	.pc-card-sub { font-size: 12px; color: var(--text-muted, #6b7280); margin-top: 2px; margin-bottom: 12px; }
	.pc-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; padding: 12px 0; border-top: 1px solid var(--border-color, #f1f3f5); }
	.pc-card-grid span { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted, #9ca3af); }
	.pc-card-grid b { font-size: 14px; color: var(--text-color, #111827); }
	.pc-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color, #f1f3f5); font-size: 11.5px; }

	.pc-empty { text-align: center; padding: 60px 20px; color: var(--text-muted, #9ca3af); font-size: 14px; }
	.pc-empty.pc-error { color: #dc2626; }

		/* ── v2 polish: spacing, accent colour & refined controls ─────────────── */
		.pc-root { padding: 24px 32px 56px; }
		.pc-stats { gap: 18px; margin-bottom: 26px; }
		.pc-stat { padding: 18px 20px; border-radius: 14px; gap: 16px; box-shadow: 0 1px 3px rgba(16,24,40,.06); transition: box-shadow .15s ease; }
		.pc-stat:hover { box-shadow: 0 6px 16px rgba(16,24,40,.09); }
		.pc-stat-icon { width: 44px; height: 44px; border-radius: 12px; }
		.pc-stat-value { font-size: 23px; }

		.pc-toolbar { margin-bottom: 22px; gap: 18px; }
		.pc-filters { gap: 9px; }
		.pc-chip { padding: 7px 15px; font-size: 13px; border-radius: 10px; gap: 8px; font-weight: 500; transition: all .14s ease; }
		.pc-chip:hover { border-color: #c7cbf5; color: var(--text-color, #111827); background: #f7f7ff; }
		.pc-chip.active { background: #4f46e5; border-color: #4f46e5; color: #fff; box-shadow: 0 2px 8px rgba(79,70,229,.30); }
		.pc-chip-count { background: rgba(17,24,39,.07); font-weight: 600; }
		.pc-chip.active .pc-chip-count { background: rgba(255,255,255,.24); color: #fff; }

		.pc-search { padding: 7px 12px; border-radius: 10px; transition: border-color .14s, box-shadow .14s; }
		.pc-search:focus-within { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.14); }
		.pc-search input { width: 230px; }

		.pc-view-toggle { border: none; border-radius: 10px; padding: 3px; gap: 3px; background: var(--bg-light-gray, #f3f4f6); }
		.pc-view-toggle button { border-radius: 8px; padding: 6px 11px; color: var(--text-muted, #6b7280); transition: all .14s; }
		.pc-view-toggle button:hover { color: var(--text-color, #111827); }
		.pc-view-toggle button.active { background: #4f46e5; color: #fff; box-shadow: 0 1px 4px rgba(79,70,229,.4); }

		.pc-table-wrap { border-radius: 14px; }
		.pc-table thead th { padding: 13px 16px; }
		.pc-table tbody td { padding: 13px 16px; }
		.pc-table tbody tr:hover { background: #f7f7ff; }
		.pc-strong { color: #4f46e5; }

		.pc-cards { gap: 18px; }
		.pc-card { padding: 18px; border-radius: 14px; }
		.pc-card:hover { box-shadow: 0 10px 26px rgba(16,24,40,.10); border-color: #c7cbf5; transform: translateY(-3px); }
		.pc-card-title { font-size: 15.5px; }

		.pc-icon-btn { border-radius: 9px; transition: all .14s; }
		.pc-icon-btn:hover { border-color: #c7cbf5; color: #4f46e5; background: #f4f3ff; }

		.pc-import-help { border: 1px solid var(--border-color, #e5e7eb); background: var(--bg-light-gray, #f9fafb); border-radius: 12px; padding: 16px 18px; margin-bottom: 4px; }
		.pc-import-help h4 { margin: 0 0 8px; font-size: 13.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; color: var(--text-color, #111827); }
		.pc-import-help p { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--text-muted, #6b7280); }
		.pc-import-cols-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; color: var(--text-muted, #9ca3af); margin: 14px 0 7px; }
		.pc-import-cols { display: flex; flex-wrap: wrap; gap: 6px; }
		.pc-import-cols span { font-size: 11px; background: #eef2ff; color: #4f46e5; border-radius: 6px; padding: 3px 9px; font-weight: 600; }
		.pc-import-foot { margin-top: 14px !important; }
		.pc-import-link { color: #4f46e5; font-weight: 600; cursor: pointer; text-decoration: underline; }

		@media (max-width: 640px) {
			.pc-root { padding: 16px 14px 40px; }
			.pc-search input { width: 140px; }
		}
	`;
	document.head.appendChild(style);
};
