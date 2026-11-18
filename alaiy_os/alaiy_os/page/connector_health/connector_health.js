// Connector Health (route: /app/connector-health, System Manager only).
//
// One screen for "is every connector actually working": platform checks on top, then a card per
// connector with a row per function it performs. All numbers come from alaiy_os.api.health.get_health;
// this file only draws them. Text that originates in a connector (names, reasons, errors) is escaped
// wherever it is drawn. Colours read the --s-* theme tokens; the page is flat (no shadows).

frappe.provide("alaiy_os.health");

(function (health) {
	const esc = (value) => frappe.utils.escape_html(value == null ? "" : String(value));

	const TONES = {
		healthy: "green", ok: "green",
		warning: "amber", warn: "amber",
		failing: "red", stuck: "red", overdue: "red", config_invalid: "red", red: "red",
		no_data: "gray", disabled: "gray", no_contract: "gray", unknown: "gray",
	};
	const LABELS = {
		healthy: "Healthy", warning: "Warning", failing: "Failing", stuck: "Stuck", overdue: "Overdue",
		config_invalid: "Config invalid", no_data: "No data", disabled: "Disabled", no_contract: "No health contract",
		ok: "OK", warn: "Warning", red: "Red", unknown: "Unknown",
	};

	health.tone = (state) => TONES[state] || "gray";

	health.interval_text = (minutes) => {
		if (!minutes) return "On demand";
		const unit = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
		if (minutes % 1440 === 0) return unit(minutes / 1440, "day");
		if (minutes % 60 === 0) return unit(minutes / 60, "hour");
		return `${minutes} min`;
	};

	const pill = (state) =>
		`<span class="ch-pill ch-${health.tone(state)}"><span class="ch-dot"></span>${esc(__(LABELS[state] || state))}</span>`;

	const synced = (at) =>
		at ? `${esc(frappe.datetime.prettyDate(at))}<div class="ch-muted">${esc(frappe.datetime.str_to_user(at))}</div>` : esc(__("Never"));

	const counts = (c) =>
		c ? `${esc(c.processed)} ${esc(__("processed"))}, ${esc(c.changed)} ${esc(__("changed"))}, ${esc(c.failed)} ${esc(__("failed"))}, ${esc(c.skipped)} ${esc(__("skipped"))}` : "—";

	const platformCard = (check) =>
		`<div class="ch-check">${pill(check.state)}<div><b>${esc(check.label)}</b><div class="ch-muted">${esc(check.detail)}</div></div></div>`;

	const functionRow = (fn) => {
		const ok = (fn.runs_24h || 0) - (fn.failures_24h || 0);
		const filter = esc(JSON.stringify(fn.log_filter || {}));
		return `<tr>
			<td>${pill(fn.state)}${fn.reason ? `<div class="ch-muted">${esc(fn.reason)}</div>` : ""}</td>
			<td>${esc(fn.label)}</td>
			<td>${synced(fn.last_success_at)}</td>
			<td>${esc(health.interval_text(fn.interval_minutes))}</td>
			<td>${counts(fn.last_counts)}</td>
			<td class="ch-error">${fn.last_error ? esc(fn.last_error) : "—"}</td>
			<td>${esc(ok)} ${esc(__("ok"))}, ${esc(fn.failures_24h || 0)} ${esc(__("failed"))}</td>
			<td><a href="#" data-action="log" data-doctype="${esc(fn.log_doctype)}" data-filter="${filter}">${esc(__("Sync log"))}</a></td>
		</tr>`;
	};

	const buttons = (c) => {
		const run = (c.operations || []).map(
			(op) => `<button class="btn btn-default btn-xs" data-action="run" data-connector="${esc(c.connector_id)}" data-op="${esc(op)}">${esc(__("Run"))} ${esc(op)}</button>`
		);
		const test = c.can_test
			? [`<button class="btn btn-default btn-xs" data-action="test" data-connector="${esc(c.connector_id)}">${esc(__("Test connection"))}</button>`]
			: [];
		return [...run, ...test].join(" ");
	};

	const connectorCard = (c) => {
		const body = c.has_contract
			? `<table class="ch-table"><colgroup><col style="width:22%"><col style="width:12%"><col style="width:13%"><col style="width:8%"><col style="width:18%"><col style="width:12%"><col style="width:9%"><col style="width:6%"></colgroup><thead><tr>
					<th>${esc(__("State"))}</th><th>${esc(__("Function"))}</th><th>${esc(__("Last synced"))}</th><th>${esc(__("Interval"))}</th>
					<th>${esc(__("Last run"))}</th><th>${esc(__("Last error"))}</th><th>${esc(__("Last 24 h"))}</th><th></th>
				</tr></thead><tbody>${(c.functions || []).map(functionRow).join("")}</tbody></table>`
			: `<div class="ch-muted">${esc(__("No health contract"))}</div>`;
		return `<section class="ch-card">
			<header><b>${esc(c.connector_name)}</b> ${pill(c.state)}<span class="ch-actions">${buttons(c)}</span></header>
			${body}
		</section>`;
	};

	health.render_html = (data) =>
		`<div class="ch-checked ch-muted">${esc(__("Checked"))} ${esc(frappe.datetime.str_to_user(data.checked_at))}</div>
		<div class="ch-platform">${(data.platform || []).map(platformCard).join("")}</div>
		${(data.connectors || []).map(connectorCard).join("")}`;

	health.CSS = `
		.ch-root { padding: var(--s-gap, 12px) 0; }
		.ch-muted { color: var(--s-muted, var(--text-muted)); font-size: var(--s-font-size-sm, 12px); }
		.ch-platform { display: flex; flex-wrap: wrap; gap: var(--s-gap, 12px); margin: 8px 0 16px; }
		.ch-check { display: flex; gap: 8px; align-items: flex-start; border: 1px solid var(--s-border, var(--border-color)); border-radius: var(--s-radius, 8px); padding: 8px 12px; background: var(--s-white, var(--card-bg)); }
		.ch-card { border: 1px solid var(--s-border, var(--border-color)); border-radius: var(--s-radius, 8px); background: var(--s-white, var(--card-bg)); margin-bottom: 16px; padding: var(--s-card-pad, 16px); overflow-x: auto; }
		.ch-card header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
		.ch-actions { margin-left: auto; display: flex; gap: 6px; }
		.ch-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
		.ch-table th { text-align: left; font-weight: 500; color: var(--s-muted, var(--text-muted)); padding: 6px 8px; border-bottom: 1px solid var(--s-border, var(--border-color)); }
		.ch-table td { vertical-align: top; padding: 8px; border-bottom: 1px solid var(--s-border, var(--border-color)); }
		.ch-error { max-width: 22em; word-break: break-word; }
		.ch-pill { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
		.ch-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--s-gray, #6b7280); }
		.ch-green .ch-dot { background: var(--s-green, #15803d); }
		.ch-amber .ch-dot { background: var(--s-amber, #b45309); }
		.ch-red .ch-dot { background: var(--s-red, #b42318); }
	`;

	class ConnectorHealthPage {
		constructor(page) {
			this.page = page;
			this.timer = null;
			frappe.dom.set_style(health.CSS, "connector-health-style");
			this.$body = $('<div class="ch-root"></div>').appendTo(page.body);
			page.set_primary_action(__("Refresh"), () => this.load(), "refresh");
			this.$body.on("click", "[data-action]", (event) => this.act(event));
		}

		show() {
			this.load();
			this.startTimer();
		}

		startTimer() {
			if (this.timer) return;
			// The desk has no page-hide event, so the timer stops itself once the route moves on.
			this.timer = setInterval(() => {
				if (frappe.get_route()[0] !== "connector-health") {
					clearInterval(this.timer);
					this.timer = null;
					return;
				}
				this.load(true);
			}, 60000);
		}

		load(quiet) {
			frappe.call({
				method: "alaiy_os.api.health.get_health",
				freeze: !quiet,
				callback: (r) => r.message && this.$body.html(health.render_html(r.message)),
			});
		}

		act(event) {
			event.preventDefault();
			const $el = $(event.currentTarget);
			const action = $el.data("action");
			if (action === "log") {
				frappe.set_route("List", $el.attr("data-doctype"), JSON.parse($el.attr("data-filter") || "{}"));
			} else if (action === "run") {
				frappe.call({
					method: "alaiy_os.api.health.run_sync",
					args: { connector_id: $el.data("connector"), operation: $el.attr("data-op") },
					freeze: true,
					callback: () => { frappe.show_alert({ message: __("Started"), indicator: "green" }); this.load(true); },
				});
			} else if (action === "test") {
				frappe.call({
					method: "alaiy_os.api.connectors.test_connector",
					args: { connector_id: $el.data("connector") },
					freeze: true,
					callback: (r) => {
						const ok = r.message && r.message.success;
						frappe.show_alert({ message: ok ? __("Connection works") : __("Connection failed"), indicator: ok ? "green" : "red" });
						this.load(true);
					},
				});
			}
		}
	}

	frappe.pages["connector-health"].on_page_load = function (wrapper) {
		const page = frappe.ui.make_app_page({ parent: wrapper, title: __("Connector Health"), single_column: true });
		wrapper.__connector_health = new ConnectorHealthPage(page);
	};

	frappe.pages["connector-health"].on_page_show = function (wrapper) {
		if (wrapper.__connector_health) wrapper.__connector_health.show();
	};
})(alaiy_os.health);
