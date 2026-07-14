// OS Theme Settings — client script.
// Ported from Alaiy-os-theme-generator/theme_editor.html: the 11 built-in
// theme presets (+ per-theme dimension "personality"), the palette-expansion
// helper (pal()), the random-theme generator, and a live mock-Desk preview
// panel. All of it renders into the "theme_preview" HTML field's wrapper —
// the doctype's real fields (Section Breaks below it) are the actual saved
// state; this is just a friendlier way to set them.

frappe.provide("alaiy_os.theme_settings");

(function (ns) {
	// ============ hex color utils (ported verbatim from theme_editor.html) ============
	function h2r(h) {
		h = h.replace("#", "");
		if (h.length === 3) h = h.split("").map((c) => c + c).join("");
		return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
	}
	function r2h(a) {
		return "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
	}
	function mix(a, b, t) {
		var x = h2r(a), y = h2r(b);
		return r2h([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
	}
	function hsl2hex(h, s, l) {
		s /= 100; l /= 100;
		var k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l),
			f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
		return r2h([255 * f(0), 255 * f(8), 255 * f(4)]);
	}

	// Expand a compact palette spec into every --s-* colour token. One colour
	// theme only (light) — see os_theme_settings.py's build_css().
	function pal(s) {
		return {
			ink: s.ink, black: s.primary, white: s.surface, cream: s.page,
			muted: s.muted, border: s.border,
			hover: mix(s.surface, s.ink, 0.05),
			active: mix(s.surface, s.ink, 0.09),
			on_black: s.onPrimary,
			black_hover: mix(s.primary, "#000000", 0.30),
			grid_line: mix(s.surface, s.border, 0.5),
			scroll_hover: mix(s.border, s.ink, 0.25),
			nav: s.nav || s.surface,
			nav_text: s.navText || s.ink,
			heading: s.heading || s.primary,
			green: s.green, blue: s.blue, amber: s.amber, gray: s.gray || s.muted, red: s.red,
		};
	}

	var F = (sans, serif, mono) => ({ sans: sans, serif: serif, mono: mono });
	var THEMES = [
		{ name: "The Solist", fonts: F("Inter", "Playfair Display", "JetBrains Mono"),
			light: { ink: "#1A1A1A", primary: "#111111", surface: "#FFFFFF", page: "#FAF9F6", muted: "#8A8A8A", border: "#D9D5C9", green: "#2E7D5B", blue: "#3B5BB5", amber: "#B7791F", gray: "#8A8A8A", red: "#B23A3A", onPrimary: "#FFFFFF" } },
		{ name: "Zinc (Minimal)", fonts: F("Inter", "Inter", "Roboto Mono"),
			light: { ink: "#18181B", primary: "#18181B", surface: "#FFFFFF", page: "#FAFAFA", muted: "#71717A", border: "#E4E4E7", green: "#16A34A", blue: "#2563EB", amber: "#D97706", gray: "#71717A", red: "#DC2626", onPrimary: "#FFFFFF" } },
		{ name: "GitHub", fonts: F("Inter", "Inter", "Roboto Mono"),
			light: { ink: "#1F2328", primary: "#0969DA", surface: "#FFFFFF", page: "#F6F8FA", muted: "#656D76", border: "#D0D7DE", green: "#1A7F37", blue: "#0969DA", amber: "#9A6700", gray: "#656D76", red: "#CF222E", onPrimary: "#FFFFFF" } },
		{ name: "Nord", fonts: F("Inter", "Space Grotesk", "JetBrains Mono"),
			light: { ink: "#2E3440", primary: "#5E81AC", surface: "#FFFFFF", page: "#ECEFF4", muted: "#4C566A", border: "#D8DEE9", green: "#A3BE8C", blue: "#5E81AC", amber: "#EBCB8B", gray: "#4C566A", red: "#BF616A", onPrimary: "#FFFFFF" } },
		{ name: "Catppuccin", fonts: F("DM Sans", "Fraunces", "JetBrains Mono"),
			light: { ink: "#4C4F69", primary: "#8839EF", surface: "#FFFFFF", page: "#EFF1F5", muted: "#6C6F85", border: "#CCD0DA", green: "#40A02B", blue: "#1E66F5", amber: "#DF8E1D", gray: "#6C6F85", red: "#D20F39", onPrimary: "#FFFFFF" } },
		{ name: "Dracula", fonts: F("Inter", "Space Grotesk", "Fira Code"),
			light: { ink: "#282A36", primary: "#7C4DFF", surface: "#FFFFFF", page: "#F5F4FB", muted: "#6C6F85", border: "#E3E0F0", green: "#2FA96A", blue: "#3BA5C4", amber: "#B7891F", gray: "#6C6F85", red: "#E5484D", onPrimary: "#FFFFFF" } },
		{ name: "Tokyo Night", fonts: F("Inter", "Space Grotesk", "JetBrains Mono"),
			light: { ink: "#343B58", primary: "#2E7DE9", surface: "#FFFFFF", page: "#E1E2E7", muted: "#6172B0", border: "#C4C8DA", green: "#587539", blue: "#2E7DE9", amber: "#8C6C3E", gray: "#6172B0", red: "#F52A65", onPrimary: "#FFFFFF" } },
		{ name: "Rosé Pine", fonts: F("DM Sans", "Fraunces", "Space Mono"),
			light: { ink: "#575279", primary: "#907AA9", surface: "#FFFAF3", page: "#FAF4ED", muted: "#797593", border: "#DFDAD9", green: "#56949F", blue: "#286983", amber: "#EA9D34", gray: "#797593", red: "#B4637A", onPrimary: "#FFFFFF" } },
		{ name: "Solarized", fonts: F("IBM Plex Sans", "Lora", "IBM Plex Mono"),
			light: { ink: "#586E75", primary: "#268BD2", surface: "#FDF6E3", page: "#EEE8D5", muted: "#93A1A1", border: "#DDD6C1", green: "#859900", blue: "#268BD2", amber: "#B58900", gray: "#93A1A1", red: "#DC322F", onPrimary: "#FDF6E3" } },
		{ name: "Gruvbox", fonts: F("Work Sans", "Bitter", "JetBrains Mono"),
			light: { ink: "#3C3836", primary: "#B57614", surface: "#FBF1C7", page: "#F2E5BC", muted: "#7C6F64", border: "#D5C4A1", green: "#79740E", blue: "#076678", amber: "#B57614", gray: "#7C6F64", red: "#9D0006", onPrimary: "#FBF1C7" } },
		{ name: "Sepia Paper", fonts: F("Lora", "Playfair Display", "JetBrains Mono"),
			light: { ink: "#433422", primary: "#7A5C3E", surface: "#FBF7EF", page: "#F3EAD9", muted: "#8A7B63", border: "#DED3BD", green: "#5C7A3E", blue: "#3E5C7A", amber: "#A9791F", gray: "#8A7B63", red: "#A6402F", onPrimary: "#FBF7EF" } },
	];

	var DIM_DEFAULTS = {
		font_size: "14px", font_size_sm: "12.5px", line_height: "1.5",
		body_weight: "450", medium_weight: "550", heading_weight: "600",
		heading_tracking: "0.005em", brand_tracking: "0.14em", label_tracking: "0.07em",
		btn_radius: "5px", btn_pad_y: "8px", btn_pad_x: "16px",
		sidebar_width: "252px", navbar_height: "56px", control_height: "36px", page_max_width: "1200px",
		page_pad: "28px", card_pad: "20px", section_pad: "22px", gap: "16px", field_gap: "13px",
		btn_gap: "8px", control_pad_x: "12px",
		radius: "4px", radius_sm: "0px", radius_lg: "6px", radius_xl: "8px", pill: "999px",
		border_width: "1px", border_style: "solid",
	};

	var THEME_DIMS = {
		"The Solist": { radius_sm: "0px", radius: "4px", radius_lg: "6px", radius_xl: "8px", btn_radius: "5px", border_width: "1px" },
		"Zinc (Minimal)": { radius_sm: "6px", radius: "8px", radius_lg: "10px", radius_xl: "12px", btn_radius: "8px", card_pad: "22px", section_pad: "24px", gap: "18px" },
		"GitHub": { radius_sm: "6px", radius: "6px", radius_lg: "8px", radius_xl: "12px", btn_radius: "6px" },
		"Nord": { radius_sm: "6px", radius: "8px", radius_lg: "12px", radius_xl: "16px", btn_radius: "8px", card_pad: "22px", gap: "18px" },
		"Catppuccin": { radius_sm: "8px", radius: "12px", radius_lg: "16px", radius_xl: "20px", btn_radius: "12px", card_pad: "24px", section_pad: "24px", gap: "18px", field_gap: "15px" },
		"Dracula": { radius_sm: "6px", radius: "10px", radius_lg: "12px", radius_xl: "16px", btn_radius: "10px", card_pad: "22px" },
		"Tokyo Night": { radius_sm: "4px", radius: "6px", radius_lg: "8px", radius_xl: "12px", btn_radius: "6px" },
		"Rosé Pine": { radius_sm: "6px", radius: "9px", radius_lg: "12px", radius_xl: "16px", btn_radius: "9px", card_pad: "24px", section_pad: "24px", gap: "18px" },
		"Solarized": { radius_sm: "3px", radius: "4px", radius_lg: "5px", radius_xl: "6px", btn_radius: "4px" },
		"Gruvbox": { radius_sm: "0px", radius: "2px", radius_lg: "3px", radius_xl: "4px", btn_radius: "2px", border_width: "2px", card_pad: "18px", gap: "14px", field_gap: "9px", font_size: "13.5px" },
		"Sepia Paper": { radius_sm: "0px", radius: "2px", radius_lg: "3px", radius_xl: "4px", btn_radius: "2px", card_pad: "24px", section_pad: "26px", page_pad: "32px", gap: "18px", field_gap: "18px", font_size: "15px" },
	};

	var GOOGLE_FONTS = ["Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Nunito", "Nunito Sans",
		"Work Sans", "Source Sans 3", "Raleway", "Rubik", "Karla", "Manrope", "DM Sans", "Mulish", "Figtree",
		"Plus Jakarta Sans", "Outfit", "Space Grotesk", "Albert Sans", "Lexend", "Public Sans", "IBM Plex Sans",
		"Noto Sans", "PT Sans", "Cabin", "Barlow", "Josefin Sans", "Quicksand", "Assistant", "Hanken Grotesk",
		"Onest", "Playfair Display", "Merriweather", "Lora", "PT Serif", "Noto Serif", "Source Serif 4",
		"EB Garamond", "Cormorant Garamond", "Cormorant", "Crimson Text", "Crimson Pro", "Libre Baskerville",
		"Bitter", "Domine", "Spectral", "Fraunces", "Newsreader", "DM Serif Display", "Bodoni Moda",
		"JetBrains Mono", "Roboto Mono", "Source Code Pro", "IBM Plex Mono", "Fira Code", "Space Mono",
		"Inconsolata", "Ubuntu Mono", "DM Mono", "Oswald", "Bebas Neue", "Anton", "Archivo", "Abril Fatface"];

	var LIGHT_FIELDS = ["ink", "black", "white", "cream", "muted", "border", "hover", "active", "on_black",
		"black_hover", "grid_line", "scroll_hover", "nav", "nav_text", "heading", "green", "blue", "amber", "gray", "red"];

	// Every field the live preview reacts to — built once, reused both to wire
	// per-field triggers (see bottom of file) and to repaint the preview.
	var WATCHED_FIELDS = [];
	LIGHT_FIELDS.forEach((k) => WATCHED_FIELDS.push("color_" + k));
	WATCHED_FIELDS.push("font_sans", "font_serif", "font_mono");
	Object.keys(DIM_DEFAULTS).forEach((k) => WATCHED_FIELDS.push(k));
	ns.WATCHED_FIELDS = WATCHED_FIELDS;
	ns.update_preview = function (frm) { update_preview(frm); };

	// Accepts either a bare family name ("Playfair Display") or a pasted
	// Google Fonts link — the CSS2 embed link
	// (fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700) or a
	// specimen page link (fonts.google.com/specimen/Playfair+Display) — and
	// returns just the family name so the field always ends up holding what
	// the backend's own @import builder expects.
	function extractFontFamily(value) {
		value = (value || "").trim();
		if (!value) return null;

		var family = null;
		if (/fonts\.googleapis\.com/.test(value)) {
			var m = value.match(/family=([^&]+)/);
			if (m) family = decodeURIComponent(m[1]).split(":")[0];
		} else if (/fonts\.google\.com\/specimen\//.test(value)) {
			var m2 = value.match(/specimen\/([^/?&]+)/);
			if (m2) family = decodeURIComponent(m2[1]);
		} else {
			return null; // not a link — leave typed-in family names untouched
		}

		return family ? family.replace(/\+/g, " ").trim() : null;
	}

	function applyPreset(frm, name) {
		var t = THEMES.find((x) => x.name === name);
		if (!t) return;
		var light = pal(t.light);
		var dims = Object.assign({}, DIM_DEFAULTS, THEME_DIMS[name] || {});
		var values = { last_preset: name, font_sans: t.fonts.sans, font_serif: t.fonts.serif, font_mono: t.fonts.mono };
		LIGHT_FIELDS.forEach((key) => { values["color_" + key] = light[key]; });
		Object.keys(dims).forEach((key) => { values[key] = dims[key]; });
		frappe.run_serially(Object.keys(values).map((k) => () => frm.set_value(k, values[k]))).then(() => {
			frm.dirty();
			update_preview(frm);
		});
	}

	function generateTheme(frm) {
		var hue = Math.floor(Math.random() * 360);
		var ac = hsl2hex(hue, 55, 45);
		var L = { ink: "#1c1c1e", primary: ac, surface: "#ffffff", page: hsl2hex(hue, 22, 97), muted: "#77767b",
			border: hsl2hex(hue, 16, 88), green: "#2E7D5B", blue: "#3B5BB5", amber: "#B7791F", gray: "#8A8A8A", red: "#B23A3A", onPrimary: "#ffffff" };
		var light = pal(L);
		var chars = [{ sm: 0, r: 2, lg: 3, xl: 4, bt: 2 }, { sm: 4, r: 6, lg: 8, xl: 12, bt: 6 },
			{ sm: 6, r: 9, lg: 12, xl: 16, bt: 9 }, { sm: 8, r: 12, lg: 16, xl: 20, bt: 12 }];
		var ch = chars[Math.floor(Math.random() * chars.length)];
		var dims = Object.assign({}, DIM_DEFAULTS, {
			radius_sm: ch.sm + "px", radius: ch.r + "px", radius_lg: ch.lg + "px", radius_xl: ch.xl + "px", btn_radius: ch.bt + "px",
		});
		var values = { last_preset: "Generated (hue " + hue + ")" };
		LIGHT_FIELDS.forEach((key) => { values["color_" + key] = light[key]; });
		Object.keys(dims).forEach((key) => { values[key] = dims[key]; });
		frappe.run_serially(Object.keys(values).map((k) => () => frm.set_value(k, values[k]))).then(() => {
			frm.dirty();
			update_preview(frm);
		});
	}

	function update_preview(frm) {
		var $preview = frm.$theme_preview_el;
		if (!$preview) return;
		LIGHT_FIELDS.forEach((key) => {
			$preview.css("--s-" + key.replace(/_/g, "-"), frm.doc["color_" + key] || "");
		});
		["font_sans", "font_serif", "font_mono"].forEach((f) => {
			var token = f === "font_sans" ? "--s-font" : f === "font_serif" ? "--s-font-serif" : "--s-font-mono";
			$preview.css(token, frm.doc[f] ? '"' + frm.doc[f] + '"' : "");
		});
		Object.keys(DIM_DEFAULTS).forEach((f) => {
			$preview.css("--s-" + f.replace(/_/g, "-"), frm.doc[f] || DIM_DEFAULTS[f]);
		});
	}

	function render_preview_markup() {
		return (
			'<style>' +
			'#alaiy-theme-preview{font-family:var(--s-font);font-size:var(--s-font-size);line-height:var(--s-line-height);font-weight:var(--s-body-weight);color:var(--s-ink);background:var(--s-cream);border:1px solid var(--s-border);border-radius:var(--s-radius-lg);overflow:hidden;display:grid;grid-template-columns:var(--s-sidebar-width) 1fr;min-height:420px;box-shadow:0 6px 20px rgba(0,0,0,.08);}' +
			'#alaiy-theme-preview .sidebar{background:var(--s-nav);border-right:1px solid var(--s-border);padding:14px 10px;}' +
			'#alaiy-theme-preview .brand{font-family:var(--s-font-serif);text-transform:uppercase;font-weight:var(--s-heading-weight);letter-spacing:var(--s-brand-tracking);color:var(--s-nav-text);font-size:20px;padding:6px 10px 16px;}' +
			'#alaiy-theme-preview .nav-label{text-transform:uppercase;letter-spacing:var(--s-label-tracking);font-size:11px;font-weight:var(--s-medium-weight);color:var(--s-nav-text);opacity:.6;padding:12px 12px 6px;}' +
			'#alaiy-theme-preview .nav-item{display:flex;align-items:center;gap:8px;padding:8px 12px;margin:2px 4px;border-radius:var(--s-radius);color:var(--s-nav-text);}' +
			'#alaiy-theme-preview .nav-item .dot{width:8px;height:8px;border-radius:999px;border:1px solid var(--s-nav-text);opacity:.5;}' +
			'#alaiy-theme-preview .nav-item.active{background:var(--s-active);font-weight:var(--s-medium-weight);}' +
			'#alaiy-theme-preview .main{display:flex;flex-direction:column;min-width:0;}' +
			'#alaiy-theme-preview .navbar{height:var(--s-navbar-height);background:var(--s-nav);border-bottom:1px solid var(--s-border);display:flex;align-items:center;padding:0 var(--s-page-pad);gap:10px;}' +
			'#alaiy-theme-preview .crumb{color:var(--s-nav-text);opacity:.7;font-size:13px;}' +
			'#alaiy-theme-preview .crumb b{color:var(--s-nav-text);font-weight:var(--s-medium-weight);}' +
			'#alaiy-theme-preview .body{padding:var(--s-page-pad);display:flex;flex-direction:column;gap:var(--s-gap);}' +
			'#alaiy-theme-preview h2{font-family:var(--s-font-serif);font-weight:var(--s-heading-weight);letter-spacing:var(--s-heading-tracking);color:var(--s-heading);margin:0;font-size:26px;}' +
			'#alaiy-theme-preview .btnrow{display:flex;gap:var(--s-btn-gap);flex-wrap:wrap;}' +
			'#alaiy-theme-preview .btn{font-family:var(--s-font);font-weight:var(--s-medium-weight);font-size:var(--s-font-size);padding:var(--s-btn-pad-y) var(--s-btn-pad-x);border-radius:var(--s-btn-radius);border:1px solid var(--s-border);cursor:pointer;}' +
			'#alaiy-theme-preview .btn.primary{background:var(--s-black);color:var(--s-on-black);border-color:var(--s-black);}' +
			'#alaiy-theme-preview .btn.default{background:var(--s-white);color:var(--s-ink);}' +
			'#alaiy-theme-preview .card{background:var(--s-white);border:1px solid var(--s-border);border-radius:var(--s-radius-lg);padding:var(--s-section-pad);}' +
			'#alaiy-theme-preview .field{margin-bottom:var(--s-field-gap);}' +
			'#alaiy-theme-preview .clabel{text-transform:uppercase;letter-spacing:var(--s-label-tracking);font-size:11px;font-weight:var(--s-medium-weight);color:var(--s-muted);display:block;margin-bottom:5px;}' +
			'#alaiy-theme-preview .control{width:100%;min-height:var(--s-control-height);border:1px solid var(--s-border);border-radius:var(--s-radius-sm);background:var(--s-white);color:var(--s-ink);padding:0 var(--s-control-pad-x);font-family:var(--s-font);font-size:var(--s-font-size);}' +
			'#alaiy-theme-preview .pillrow{display:flex;gap:8px;flex-wrap:wrap;}' +
			'#alaiy-theme-preview .pill{background:transparent;border:1px solid currentColor;border-radius:var(--s-pill);font-weight:var(--s-medium-weight);padding:3px 10px;font-size:12px;}' +
			'#alaiy-theme-preview .pill.green{color:var(--s-green);} #alaiy-theme-preview .pill.blue{color:var(--s-blue);}' +
			'#alaiy-theme-preview .pill.amber{color:var(--s-amber);} #alaiy-theme-preview .pill.gray{color:var(--s-gray);} #alaiy-theme-preview .pill.red{color:var(--s-red);}' +
			'#alaiy-theme-preview table{width:100%;border-collapse:collapse;background:var(--s-white);border:1px solid var(--s-border);border-radius:var(--s-radius-lg);overflow:hidden;font-size:13px;}' +
			'#alaiy-theme-preview thead th{text-align:left;font-weight:var(--s-medium-weight);color:var(--s-muted);border-bottom:1px solid var(--s-border);padding:9px 12px;}' +
			'#alaiy-theme-preview tbody td{color:var(--s-ink);border-bottom:1px solid var(--s-grid-line);padding:9px 12px;}' +
			'</style>' +
			'<div id="alaiy-theme-preview">' +
			'<div class="sidebar"><div class="brand">Stock</div>' +
			'<div class="nav-label">Menu</div>' +
			'<div class="nav-item active"><span class="dot"></span> Dashboard</div>' +
			'<div class="nav-item"><span class="dot"></span> Stock Entry</div>' +
			'<div class="nav-item"><span class="dot"></span> Delivery Note</div>' +
			'</div>' +
			'<div class="main">' +
			'<div class="navbar"><span class="crumb">Stock / <b>Item</b></span></div>' +
			'<div class="body">' +
			'<h2>Signature Silk Scarf</h2>' +
			'<div class="btnrow"><button class="btn primary">Save</button><button class="btn default">Cancel</button></div>' +
			'<div class="pillrow"><span class="pill green">Enabled</span><span class="pill blue">Draft</span><span class="pill amber">Pending</span><span class="pill gray">Closed</span><span class="pill red">Cancelled</span></div>' +
			'<div class="card"><div class="field"><label class="clabel">Item Name</label><input class="control" value="Signature Silk Scarf" readonly></div>' +
			'<div class="field"><label class="clabel">Item Group</label><input class="control" value="Accessories" readonly></div></div>' +
			'<table><thead><tr><th>Posting Date</th><th>Account</th><th>Debit</th><th>Credit</th></tr></thead>' +
			'<tbody><tr><td>03-07-2026</td><td>Stock In Hand</td><td>1,80,38,000.00</td><td>0.00</td></tr></tbody></table>' +
			"</div></div></div>"
		);
	}

	ns.render_theme_ui = function (frm) {
		if (frm.__theme_ui_rendered) {
			update_preview(frm);
			return;
		}
		frm.__theme_ui_rendered = true;

		var $wrapper = frm.fields_dict.theme_preview.$wrapper;
		$wrapper.empty();

		var $presets = $('<div style="margin-bottom:16px;"><div style="font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:#8d99a6;margin-bottom:8px;">Theme Presets — one click</div><div class="alaiy-preset-row" style="display:flex;flex-wrap:wrap;gap:8px;"></div></div>').appendTo($wrapper);
		var $row = $presets.find(".alaiy-preset-row");
		THEMES.forEach(function (t) {
			var swatch = t.light.primary;
			var $btn = $(
				'<button type="button" class="btn btn-default btn-sm" style="display:flex;align-items:center;gap:6px;">' +
				'<span style="width:12px;height:12px;border-radius:3px;display:inline-block;background:' + swatch + ';border:1px solid rgba(0,0,0,.15);"></span>' +
				frappe.utils.escape_html(t.name) +
				"</button>"
			).appendTo($row);
			$btn.on("click", function () { applyPreset(frm, t.name); });
		});
		var $gen = $('<button type="button" class="btn btn-default btn-sm">🎲 Generate a theme</button>').appendTo($row);
		$gen.on("click", function () { generateTheme(frm); });

		$('<div style="font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:#8d99a6;margin-bottom:8px;">Live Preview</div>').appendTo($wrapper);
		var $previewHost = $('<div></div>').appendTo($wrapper);
		$previewHost.html(render_preview_markup());
		frm.$theme_preview_el = $previewHost.find("#alaiy-theme-preview");

		// Google Fonts datalist + autocomplete on the 3 font fields, plus:
		// paste a Google Fonts link straight in and it resolves to just the
		// family name (see extractFontFamily above) instead of requiring the
		// exact family name to be typed out.
		var $datalist = $('<datalist id="alaiy-google-fonts"></datalist>').appendTo($wrapper);
		GOOGLE_FONTS.forEach(function (f) { $datalist.append('<option value="' + f + '">'); });
		["font_sans", "font_serif", "font_mono"].forEach(function (fieldname) {
			var field = frm.fields_dict[fieldname];
			if (!field || !field.$input) return;
			field.$input.attr("list", "alaiy-google-fonts");
			field.$input.attr("placeholder", "Font name, or paste a Google Fonts link");
			field.$input.on("paste", function () {
				setTimeout(function () {
					var family = extractFontFamily(field.$input.val());
					if (family) frm.set_value(fieldname, family);
				}, 0); // run after the paste actually lands in the input
			});
		});

		update_preview(frm);
	};
})(alaiy_os.theme_settings);

// Real per-field triggers (not a df.onchange patched on after render, which
// only fires from the initial control setup and never on live typing/blur/
// picker changes) — this is what makes every field, including colour
// pickers, repaint the live preview immediately.
(function () {
	var events = {
		refresh(frm) {
			alaiy_os.theme_settings.render_theme_ui(frm);
		},
		after_save(frm) {
			// The Desk's own CSS/bootinfo is cached client- and server-side, so a
			// saved theme only shows up after the same clear-cache + hard reload
			// the navbar's "Reload" button does. Delay slightly so the "Saved"
			// toast is visible before the page reloads out from under it.
			frappe.show_alert({ message: __("Applying theme…"), indicator: "blue" });
			setTimeout(() => frappe.ui.toolbar.clear_cache(), 800);
		},
	};
	alaiy_os.theme_settings.WATCHED_FIELDS.forEach(function (fieldname) {
		events[fieldname] = function (frm) {
			if (frm.$theme_preview_el) alaiy_os.theme_settings.update_preview(frm);
		};
	});
	frappe.ui.form.on("OS Theme Settings", events);
})();
