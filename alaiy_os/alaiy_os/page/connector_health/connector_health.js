// Connector Health (route: /app/connector-health, System Manager only).
//
// One screen for "is every connector actually working": a summary and filter on top, the platform
// checks, then a card per connector with a block per function it performs. All numbers come from
// alaiy_os.api.health.get_health; this file only draws them. Text that originates in a connector
// (names, reasons, errors) is escaped wherever it is drawn. Colours read the --s-* theme tokens;
// the page is flat (no shadows).

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
	const ATTENTION = ["warning", "failing", "stuck", "overdue", "config_invalid"];
	const BREAKDOWN = ["failing", "overdue", "stuck", "config_invalid", "warning"];

	const ORDER = ["stuck", "failing", "overdue", "config_invalid", "warning", "no_data", "disabled", "healthy", "no_contract"];
	const rank = (state) => (ORDER.includes(state) ? ORDER.indexOf(state) : ORDER.length);
	const sortConnectors = (connectors) =>
		[...connectors].sort((a, b) => rank(a.state) - rank(b.state) || String(a.connector_name).localeCompare(String(b.connector_name)));

	health.tone = (state) => TONES[state] || "gray";
	health.needs_attention = (state) => ATTENTION.includes(state);

	health.interval_text = (minutes) => {
		if (!minutes) return "On demand";
		const unit = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
		if (minutes % 1440 === 0) return unit(minutes / 1440, "day");
		if (minutes % 60 === 0) return unit(minutes / 60, "hour");
		return `${minutes} min`;
	};

	// The connector whose detail is shown: the one asked for, else the worst one. "*" shows every connector.
	health.pick_selected = (data, selected) => {
		const connectors = sortConnectors(data.connectors || []);
		if (selected === "*") return "*";
		if (selected && connectors.some((c) => c.connector_id === selected)) return selected;
		const first = connectors.find((c) => health.needs_attention(c.state)) || connectors[0];
		return first ? first.connector_id : "*";
	};

	health.summary = (data) => {
		const counts = {};
		let total = 0;
		for (const connector of data.connectors || []) {
			for (const fn of connector.functions || []) {
				counts[fn.state] = (counts[fn.state] || 0) + 1;
				total += 1;
			}
		}
		return { total, counts, attention: ATTENTION.reduce((sum, state) => sum + (counts[state] || 0), 0) };
	};

	health.latency_text = (ms) => {
		if (ms == null) return "—";
		return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
	};

	// A check (a connector's own, or the platform's) needs attention when it is red or warn.
	const checkNeeds = (check) => check.state === "red" || check.state === "warn";
	const attentionCount = (c) =>
		(c.functions || []).filter((fn) => health.needs_attention(fn.state)).length + (c.checks || []).filter(checkNeeds).length;

	const windowText = (minutes) => (minutes === 60 ? "last hour" : `last ${minutes} min`);
	const percent = (rate) => `${Number((rate * 100).toFixed(1))}%`;

	const pill = (state) =>
		`<span class="ch-pill ch-${health.tone(state)}"><span class="ch-dot"></span>${esc(__(LABELS[state] || state))}</span>`;

	const synced = (at) =>
		at ? `${esc(frappe.datetime.prettyDate(at))}<div class="ch-muted">${esc(frappe.datetime.str_to_user(at))}</div>` : esc(__("Never"));

	const counts = (c) =>
		c ? `${esc(c.processed)} ${esc(__("processed"))}, ${esc(c.changed)} ${esc(__("changed"))}, ${esc(c.failed)} ${esc(__("failed"))}, ${esc(c.skipped)} ${esc(__("skipped"))}` : "—";

	const fact = (label, value) => `<div class="ch-fact"><dt>${esc(__(label))}</dt><dd>${value}</dd></div>`;

	const platformCard = (check) =>
		`<div class="ch-check ch-tone-${health.tone(check.state)}">${pill(check.state)}<div><b>${esc(check.label)}</b><div class="ch-muted">${esc(check.detail)}</div></div></div>`;

	const runFacts = (fn, ok) =>
		fact("Last synced", synced(fn.last_success_at)) +
		fact("Interval", esc(health.interval_text(fn.interval_minutes))) +
		fact("Last run", counts(fn.last_counts)) +
		fact("Last 24 h", `${esc(ok)} ${esc(__("ok"))}, ${esc(fn.failures_24h || 0)} ${esc(__("failed"))}`);

	const requestFacts = (fn) => {
		const total = fn.requests || 0;
		const failed = (fn.last_counts && fn.last_counts.failed) || 0;
		const rate = fn.error_rate == null ? "" : ` (${percent(fn.error_rate)})`;
		const latency = fn.latency_avg_ms == null ? "—" : `avg ${health.latency_text(fn.latency_avg_ms)} · p95 ${health.latency_text(fn.latency_p95_ms)}`;
		return fact("Last success", synced(fn.last_success_at)) +
			fact(`Requests (${windowText(fn.window_minutes || 60)})`, `${esc(total)} ${esc(__("requests"))}, ${esc(failed)} ${esc(__("failed"))}${esc(rate)}`) +
			fact("Latency", esc(latency));
	};

	const functionBlock = (fn) => {
		const ok = (fn.runs_24h || 0) - (fn.failures_24h || 0);
		const filter = esc(JSON.stringify(fn.log_filter || {}));
		const needs = health.needs_attention(fn.state) ? " ch-needs" : "";
		return `<article class="ch-fn ch-tone-${health.tone(fn.state)}${needs}">
			<div class="ch-fn-head">
				<div class="ch-fn-title">${pill(fn.state)}<span class="ch-fn-name">${esc(fn.label)}</span></div>
				<a href="#" data-action="log" data-doctype="${esc(fn.log_doctype)}" data-filter="${filter}">${esc(__("Sync log"))}</a>
			</div>
			${fn.reason ? `<p class="ch-reason">${esc(fn.reason)}</p>` : ""}
			<dl class="ch-facts">
				${fn.kind === "requests" ? requestFacts(fn) : runFacts(fn, ok)}
				${fn.last_error ? "" : fact("Last error", "—")}
			</dl>
			${fn.last_error ? `<div class="ch-err"><div class="ch-label">${esc(__("Last error"))}</div>${esc(fn.last_error)}</div>` : ""}
		</article>`;
	};

	const buttons = (c) => {
		const run = (c.operations || []).map(
			(op) => `<button class="btn btn-default btn-sm" data-action="run" data-connector="${esc(c.connector_id)}" data-op="${esc(op)}">${esc(__("Run"))} ${esc(op)}</button>`
		);
		const test = c.can_test
			? [`<button class="btn btn-default btn-sm" data-action="test" data-connector="${esc(c.connector_id)}">${esc(__("Test connection"))}</button>`]
			: [];
		return [...run, ...test].join(" ");
	};

	const connectorCard = (c) => {
		const functions = c.functions || [];
		const needs = attentionCount(c) ? " ch-needs" : "";
		const count = `${functions.length} ${functions.length === 1 ? "function" : "functions"}`;
		const checks = (c.checks || []).length
			? `<div class="ch-fn ch-checks"><div class="ch-label">${esc(__("Extra checks"))}</div>${c.checks.map(
				(check) => `<div class="ch-check-row">${pill(check.state)}<b>${esc(check.label)}</b><span class="ch-muted">${esc(check.detail)}</span></div>`
			).join("")}</div>`
			: "";
		const body = c.has_contract
			? checks + functions.map(functionBlock).join("")
			: `<div class="ch-fn"><p class="ch-muted">${esc(__("No health contract"))}</p></div>`;
		return `<section class="ch-card${needs}">
			<header>
				<div class="ch-card-title"><h4>${esc(c.connector_name)}</h4>${pill(c.state)}${c.has_contract ? `<span class="ch-muted">${count}</span>` : ""}</div>
				<div class="ch-actions">${buttons(c)}</div>
			</header>
			${body}
		</section>`;
	};

	const breakdown = (s) =>
		BREAKDOWN.filter((state) => s.counts[state]).map((state) => `${esc(__(LABELS[state]))} ${esc(s.counts[state])}`).join(" · ");

	const tile = (c, selected) => {
		const functions = c.functions || [];
		const attention = attentionCount(c);
		const meta = c.has_contract
			? `${functions.length} ${functions.length === 1 ? "function" : "functions"}${attention ? ` · <b class="ch-attn">${attention} ${esc(__("need attention"))}</b>` : ""}`
			: esc(__("No health contract"));
		const on = selected === c.connector_id ? " ch-tile-on" : "";
		return `<button class="ch-tile ch-tone-${health.tone(c.state)}${on}" data-action="select" data-connector="${esc(c.connector_id)}">
			<span class="ch-tile-top"><span class="ch-tile-name">${esc(c.connector_name)}</span>${pill(c.state)}</span>
			<span class="ch-tile-meta ch-muted">${meta}</span>
		</button>`;
	};

	const allTile = (s, selected) =>
		`<button class="ch-tile ch-tile-all${selected === "*" ? " ch-tile-on" : ""}" data-action="select" data-connector="*">
			<span class="ch-tile-top"><span class="ch-tile-name">${esc(__("All connectors"))}</span></span>
			<span class="ch-tile-meta ch-muted">${s.total} ${esc(__("functions"))}${s.attention ? ` · <b class="ch-attn">${s.attention} ${esc(__("need attention"))}</b>` : ""}</span>
		</button>`;

	health.render_html = (data, filter, selected) => {
		const s = health.summary(data);
		const mode = filter === "attention" ? "attention" : "all";
		const connectors = sortConnectors(data.connectors || []);
		const chosen = health.pick_selected(data, selected);
		const shown = chosen === "*" ? connectors : connectors.filter((c) => c.connector_id === chosen);
		const chip = (name, label, n) =>
			`<button class="ch-chip${mode === name ? " ch-chip-on" : ""}" data-action="filter" data-filter="${name}">${esc(__(label))} <b>${esc(n)}</b></button>`;
		return `<div class="ch-view${mode === "attention" ? " ch-only-attention" : ""}">
			<div class="ch-toolbar">
				<div class="ch-chips">${chip("all", "All functions", s.total)}${chip("attention", "Needs attention", s.attention)}</div>
				<div class="ch-breakdown ch-muted">${breakdown(s)}</div>
				<div class="ch-checked ch-muted">${esc(__("Checked"))} ${esc(frappe.datetime.str_to_user(data.checked_at))}</div>
			</div>
			<h3 class="ch-section">${esc(__("Platform"))}</h3>
			<div class="ch-platform">${(data.platform || []).map(platformCard).join("")}</div>
			<h3 class="ch-section">${esc(__("Connectors"))}</h3>
			<div class="ch-tiles">${allTile(s, chosen)}${connectors.map((c) => tile(c, chosen)).join("")}</div>
			<div class="ch-detail">${shown.map(connectorCard).join("")}</div>
		</div>`;
	};

	health.CSS = `
		.ch-view { padding: 4px 0 40px; }
		.ch-muted { color: var(--s-muted, var(--text-muted, #6b7280)); font-size: var(--s-font-size-sm, 12px); }
		.ch-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; margin: 8px 0 8px; }
		.ch-chips { display: flex; gap: 8px; }
		.ch-chip { border: 1px solid var(--s-border, var(--border-color, #e5e7eb)); background: var(--s-white, var(--card-bg, #ffffff)); color: inherit; border-radius: 999px; padding: 6px 16px; font: inherit; cursor: pointer; }
		.ch-chip b { margin-left: 6px; }
		.ch-chip-on { background: var(--s-ink, #111827); color: var(--s-white, #fff); border-color: var(--s-ink, #111827); }
		.ch-breakdown { flex: 1; }
		.ch-section { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--s-muted, var(--text-muted, #6b7280)); margin: 36px 0 14px; }
		.ch-platform { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
		.ch-check { display: flex; gap: 10px; align-items: flex-start; border: 1px solid var(--s-border, var(--border-color, #e5e7eb)); border-radius: var(--s-radius, 8px); padding: 10px 14px; background: var(--s-white, var(--card-bg, #ffffff)); }
		.ch-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
		.ch-tile { display: flex; flex-direction: column; gap: 10px; text-align: left; font: inherit; color: inherit; cursor: pointer; border: 1px solid var(--s-border, var(--border-color, #e5e7eb)); border-top: 3px solid var(--s-border, var(--border-color, #e5e7eb)); border-radius: var(--s-radius, 8px); background: var(--s-white, var(--card-bg, #ffffff)); padding: 14px 16px; }
		.ch-tile.ch-tone-red { border-top-color: var(--s-red, #b42318); }
		.ch-tile.ch-tone-amber { border-top-color: var(--s-amber, #b45309); }
		.ch-tile.ch-tone-green { border-top-color: var(--s-green, #15803d); }
		.ch-tile-on { outline: 2px solid var(--s-ink, #111827); outline-offset: -1px; }
		.ch-tile-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
		.ch-tile-name { font-weight: 600; font-size: 14px; }
		.ch-attn { color: var(--s-red, #b42318); font-weight: 600; }
		.ch-detail { margin-top: 28px; }
		.ch-card { border: 1px solid var(--s-border, var(--border-color, #e5e7eb)); border-radius: var(--s-radius, 8px); background: var(--s-white, var(--card-bg, #ffffff)); margin-bottom: 28px; overflow: hidden; }
		.ch-card > header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; padding: 20px 24px; border-bottom: 1px solid var(--s-border, var(--border-color, #e5e7eb)); }
		.ch-card-title { display: flex; align-items: center; gap: 14px; }
		.ch-card-title h4 { margin: 0; font-size: 16px; font-weight: 600; }
		.ch-actions { display: flex; flex-wrap: wrap; gap: 8px; }
		.ch-fn { padding: 22px 24px 24px; border-bottom: 1px solid var(--s-border, var(--border-color, #e5e7eb)); border-left: 4px solid transparent; }
		.ch-fn:last-child { border-bottom: 0; }
		.ch-fn.ch-tone-red { border-left-color: var(--s-red, #b42318); }
		.ch-fn.ch-tone-amber { border-left-color: var(--s-amber, #b45309); }
		.ch-fn-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
		.ch-fn-title { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
		.ch-fn-name { font-size: 15px; font-weight: 600; }
		.ch-reason { margin: 10px 0 0; color: var(--s-muted, var(--text-muted, #6b7280)); }
		.ch-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px 32px; margin: 18px 0 0; }
		.ch-fact dt { font-size: 11px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; color: var(--s-muted, var(--text-muted, #6b7280)); margin-bottom: 5px; }
		.ch-fact dd { margin: 0; line-height: 1.5; }
		.ch-err { margin-top: 18px; padding: 12px 16px; border: 1px solid var(--s-border, var(--border-color, #e5e7eb)); border-left: 4px solid var(--s-red, #b42318); border-radius: 6px; font-family: var(--s-font-mono, monospace); font-size: 12.5px; white-space: pre-wrap; word-break: break-word; }
		.ch-label { font-family: var(--s-font, inherit); font-size: 11px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; color: var(--s-muted, var(--text-muted, #6b7280)); margin-bottom: 4px; }
		.ch-pill { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; padding: 3px 12px; border-radius: 999px; font-weight: 500; background: var(--s-hover, #f3f4f6); }
		.ch-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--s-gray, #6b7280); }
		.ch-green .ch-dot { background: var(--s-green, #15803d); }
		.ch-amber .ch-dot { background: var(--s-amber, #b45309); }
		.ch-red .ch-dot { background: var(--s-red, #b42318); }
		.ch-green.ch-pill { background: color-mix(in srgb, var(--s-green, #15803d) 12%, transparent); }
		.ch-amber.ch-pill { background: color-mix(in srgb, var(--s-amber, #b45309) 14%, transparent); }
		.ch-red.ch-pill { background: color-mix(in srgb, var(--s-red, #b42318) 12%, transparent); }
		.ch-check-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 14px; padding: 6px 0; }
		.ch-only-attention .ch-fn:not(.ch-needs) { display: none; }
		.ch-only-attention .ch-card:not(.ch-needs) { display: none; }
	`;

	class ConnectorHealthPage {
		constructor(page) {
			this.page = page;
			this.timer = null;
			this.data = null;
			this.filter = this.savedFilter();
			this.selected = null;
			frappe.dom.set_style(health.CSS, "connector-health-style");
			this.$body = $('<div class="ch-root"></div>').appendTo(page.body);
			page.set_primary_action(__("Refresh"), () => this.load(), "refresh");
			page.set_secondary_action(__("Alert settings"), () => frappe.set_route("Form", "Connector Health Settings"), "settings");
			this.$body.on("click", "[data-action]", (event) => this.act(event));
		}

		savedFilter() {
			try { return window.localStorage.getItem("alaiy_connector_health_filter") === "attention" ? "attention" : "all"; } catch (e) { return "all"; }
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

		draw() {
			if (this.data) this.$body.html(health.render_html(this.data, this.filter, this.selected));
		}

		load(quiet) {
			frappe.call({
				method: "alaiy_os.api.health.get_health",
				freeze: !quiet,
				callback: (r) => { if (r.message) { this.data = r.message; this.draw(); } },
			});
		}

		act(event) {
			event.preventDefault();
			const $el = $(event.currentTarget);
			const action = $el.data("action");
			if (action === "select") {
				this.selected = $el.attr("data-connector");
				this.draw();
				const detail = this.$body.find(".ch-detail")[0];
				if (detail && detail.scrollIntoView) detail.scrollIntoView({ behavior: "smooth", block: "start" });
			} else if (action === "filter") {
				this.filter = $el.attr("data-filter") === "attention" ? "attention" : "all";
				try { window.localStorage.setItem("alaiy_connector_health_filter", this.filter); } catch (e) { /* a view preference only */ }
				this.draw();
			} else if (action === "log") {
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
