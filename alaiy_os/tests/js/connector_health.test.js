// Rendering rules of the Connector Health page. Run: node --test alaiy_os/tests/js
//
// The page draws text that comes from connectors (names, errors, reasons), so escaping is tested
// first; then the state-to-colour mapping, the wording of an interval, and the buttons.

const test = require("node:test");
const assert = require("node:assert");

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
global.__ = (s) => s;
global.frappe = {
	pages: { "connector-health": {} },
	provide(path) { path.split(".").reduce((o, k) => (o[k] = o[k] || {}), global); },
	utils: { escape_html: escape },
	datetime: { prettyDate: () => "2 hours ago", str_to_user: (s) => `at ${s}` },
};
require("../../alaiy_os/page/connector_health/connector_health.js");
const H = global.alaiy_os.health;

const fn = (extra = {}) => ({
	key: "stock", label: "Stock sync", state: "healthy", reason: "", last_error: "", last_run_at: "2026-11-18 10:00:00",
	last_success_at: "2026-11-18 10:00:00", interval_minutes: 30, runs_24h: 10, failures_24h: 1,
	last_counts: { processed: 10, changed: 8, failed: 0, skipped: 2 }, log_doctype: "Some Log", log_filter: { sync_type: "stock" },
	...extra,
});
const connector = (extra = {}) => ({
	connector_id: "alpha", connector_name: "Alpha", state: "healthy", has_contract: true, operations: ["Items"], can_test: true,
	functions: [fn()], ...extra,
});
const data = (extra = {}) => ({ checked_at: "2026-11-18 12:00:00", platform: [], connectors: [connector()], ...extra });

test("text from connectors is escaped everywhere it is drawn", () => {
	const evil = "<img src=x onerror=alert(1)>";
	const html = H.render_html(data({
		platform: [{ key: "disk", label: evil, state: "red", detail: evil }],
		connectors: [connector({ connector_name: evil, operations: [evil], functions: [fn({ label: evil, reason: evil, last_error: evil, log_doctype: evil })] })],
	}));
	assert.ok(!html.includes("<img"), "raw tag leaked");
	assert.ok(html.includes("&lt;img"));
});

test("a log filter cannot break out of its attribute", () => {
	const html = H.render_html(data({ connectors: [connector({ functions: [fn({ log_filter: { sync_type: '"><img src=x onerror=alert(1)>' } })] })] }));
	assert.ok(!html.includes("<img"));
	assert.ok(!html.includes('data-filter="{"'));
});

test("states map to a tone", () => {
	const tones = { healthy: "green", warning: "amber", failing: "red", stuck: "red", overdue: "red", config_invalid: "red", no_data: "gray", disabled: "gray", no_contract: "gray", mystery: "gray" };
	for (const [state, tone] of Object.entries(tones)) assert.strictEqual(H.tone(state), tone, state);
	for (const [state, tone] of Object.entries({ ok: "green", warn: "amber", red: "red", unknown: "gray" })) assert.strictEqual(H.tone(state), tone, state);
});

test("an interval is written the way a person says it", () => {
	assert.strictEqual(H.interval_text(5), "5 min");
	assert.strictEqual(H.interval_text(60), "1 hour");
	assert.strictEqual(H.interval_text(360), "6 hours");
	assert.strictEqual(H.interval_text(1440), "1 day");
	assert.strictEqual(H.interval_text(null), "On demand");
});

test("a connector with no contract says so and offers no buttons", () => {
	const html = H.render_html(data({ connectors: [connector({ has_contract: false, state: "no_contract", functions: [], operations: [], can_test: false })] }));
	assert.ok(html.includes("No health contract"));
	assert.ok(!html.includes('data-action="run"') && !html.includes('data-action="test"') && !html.includes('data-action="log"'));
});

test("buttons follow what the connector offers", () => {
	const both = H.render_html(data());
	assert.ok(both.includes('data-action="run"') && both.includes('data-op="Items"'));
	assert.ok(both.includes('data-action="test"'));
	const none = H.render_html(data({ connectors: [connector({ operations: [], can_test: false })] }));
	assert.ok(!none.includes('data-action="run"') && !none.includes('data-action="test"'));
});

test("a function that never synced says never", () => {
	const html = H.render_html(data({ connectors: [connector({ functions: [fn({ last_success_at: null, last_run_at: null, last_counts: null })] })] }));
	assert.ok(html.includes("Never"));
});

test("the row shows last synced, counts, interval and the 24 hour figures", () => {
	const html = H.render_html(data());
	for (const part of ["2 hours ago", "at 2026-11-18 10:00:00", "30 min", "10 processed", "2 skipped", "9 ok", "1 failed"]) assert.ok(html.includes(part), part);
});

test("platform checks are drawn above the connectors", () => {
	const html = H.render_html(data({ platform: [{ key: "disk", label: "Disk space", state: "red", detail: "9% free" }] }));
	assert.ok(html.indexOf("Disk space") < html.indexOf("Alpha"));
	assert.ok(html.includes("9% free"));
});


// ── layout: summary, filter, sections, one block per function ────────────────────────────────

const mixed = () => data({
	connectors: [
		connector({ connector_id: "a", connector_name: "Alpha", state: "failing", functions: [
			fn({ key: "f1", label: "Healthy one", state: "healthy" }),
			fn({ key: "f2", label: "Failing one", state: "failing", reason: "The last 3 runs failed", last_error: "401 Unauthorized" }),
			fn({ key: "f3", label: "Overdue one", state: "overdue" }),
			fn({ key: "f4", label: "Off one", state: "disabled" }),
		] }),
		connector({ connector_id: "b", connector_name: "Beta", state: "healthy", functions: [fn({ key: "g1", label: "Fine", state: "healthy" })] }),
		connector({ connector_id: "c", connector_name: "Gamma", state: "no_contract", has_contract: false, functions: [], operations: [], can_test: false }),
	],
});

test("the summary counts functions and the ones that need attention", () => {
	const s = H.summary(mixed());
	assert.strictEqual(s.total, 5);
	assert.strictEqual(s.attention, 2);
	assert.strictEqual(s.counts.failing, 1);
	assert.strictEqual(s.counts.overdue, 1);
	assert.strictEqual(s.counts.healthy, 2);
	assert.strictEqual(H.summary(data({ connectors: [] })).total, 0);
});

test("warning, failing, stuck, overdue and config invalid need attention; the rest do not", () => {
	for (const state of ["warning", "failing", "stuck", "overdue", "config_invalid"]) assert.ok(H.needs_attention(state), state);
	for (const state of ["healthy", "disabled", "no_data", "no_contract", "ok", "warn", "red", "unknown"]) assert.ok(!H.needs_attention(state), state);
});

test("the toolbar offers all and needs-attention with their counts", () => {
	const html = H.render_html(mixed());
	assert.ok(html.includes('data-action="filter" data-filter="all"'));
	assert.ok(html.includes('data-action="filter" data-filter="attention"'));
	assert.ok(/Needs attention[^<]*<b>2<\/b>/.test(html));
	assert.ok(/All[^<]*<b>5<\/b>/.test(html));
});

test("the chosen filter is applied to the view and marks its chip", () => {
	assert.ok(!H.render_html(mixed()).includes("ch-only-attention"));
	const html = H.render_html(mixed(), "attention");
	assert.ok(html.includes("ch-only-attention"));
	assert.ok(/ch-chip-on"[^>]*data-filter="attention"/.test(html));
});

test("only problem functions and the connectors holding them are marked as needing attention", () => {
	const html = H.render_html(mixed());
	assert.strictEqual((html.match(/class="ch-fn [^"]*ch-needs/g) || []).length, 2);
	assert.strictEqual((html.match(/class="ch-card [^"]*ch-needs/g) || []).length, 1);
	assert.strictEqual((html.match(/class="ch-fn /g) || []).length, 5);
});

test("the page has Platform and Connectors sections in that order", () => {
	const html = H.render_html(mixed());
	assert.ok(html.indexOf(">Platform<") > -1 && html.indexOf(">Platform<") < html.indexOf(">Connectors<"));
});

test("a connector card says how many functions it has", () => {
	const html = H.render_html(mixed());
	assert.ok(html.includes("4 functions"));
	assert.ok(html.includes("1 function<") || html.includes("1 function "));
});

test("every fact is still shown for a function, labelled", () => {
	const html = H.render_html(data());
	for (const label of ["Last synced", "Interval", "Last run", "Last 24 h", "Last error"]) assert.ok(html.includes(`>${label}<`), label);
	assert.ok(html.includes("Sync log"));
});

test("an error is shown in its own block with the reason beside the state", () => {
	const html = H.render_html(mixed());
	assert.ok(html.includes("ch-err"));
	assert.ok(html.includes("401 Unauthorized"));
	assert.ok(html.includes("The last 3 runs failed"));
});

test("a function with no error shows a dash instead of an error block", () => {
	const html = H.render_html(data());
	assert.ok(!html.includes('class="ch-err"'));
});

test("a card is marked when any of its functions needs attention, and not when it has none", () => {
	const cards = H.render_html(mixed()).split('<section class="ch-card').slice(1);
	const byName = Object.fromEntries(cards.map((c) => [/<h4>([^<]*)<\/h4>/.exec(c)[1], /^[^"]*ch-needs/.test(c.slice(0, c.indexOf(">")))]));
	assert.deepStrictEqual(byName, { Alpha: true, Beta: false, Gamma: false });
});
