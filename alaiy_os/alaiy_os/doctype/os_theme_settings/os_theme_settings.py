import os
import shutil

import frappe
from frappe.model.document import Document

# Google Fonts loaded for whichever font names are configured. Deduplicated
# and formatted into a single @import at the top of the generated CSS.
_FONT_WEIGHTS = ":400,500,600,700"

# Fixed filenames the site's shared (non-app-namespaced) assets folder always
# uses for the org's logos — both the install-time defaults (setup/install.py)
# and this doctype's uploads write to the exact same two paths, so anything
# referencing them (core.css, Navbar Settings.app_logo) never needs updating.
SQUARE_LOGO_FILENAME = "client-logo-square.png"
HOR_LOGO_FILENAME = "client-logo-hor.png"

# Ported verbatim from Alaiy-os-theme-generator/solist_theme.css's ENGINE +
# component-rule sections (everything from "ENGINE — wires the control panel
# into Frappe" through its generic fixes at the end), with two exclusions:
#   - its own hardcoded [data-theme="dark"] {...} control-panel values (that's
#     the "CONTROL PANEL" half this doctype's dark_* fields replace — see
#     _build_root_and_dark_blocks() below, not this static template)
#   - its "BUSINESS DASHBOARD PAGE" block (styles a page that doesn't exist
#     in this app)
# Every selector here reads var(--s-*) — never a literal color/size — so it
# re-skins correctly from whatever :root/[data-theme="dark"] values get
# prepended to it.
_ENGINE_AND_COMPONENTS_CSS = r"""
/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ENGINE — wires the control panel into Frappe. No need to edit.        ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */

:root,
[data-theme="light"],
[data-theme="dark"] {
	--primary: var(--s-black); --primary-color: var(--s-black); --primary-light: var(--s-hover);
	--brand-color: var(--s-black); --btn-primary: var(--s-black); --border-primary: var(--s-black);
	--checkbox-color: var(--s-black);

	--text-color: var(--s-ink); --heading-color: var(--s-black);
	--text-muted: var(--s-muted); --text-light: var(--s-muted);
	--bg-color: var(--s-cream); --fg-color: var(--s-white); --card-bg: var(--s-white);
	--modal-bg: var(--s-white); --popover-bg: var(--s-white); --control-bg: var(--s-white);
	--navbar-bg: var(--s-white);
	--subtle-accent: var(--s-hover); --subtle-fg: var(--s-active);
	--fg-hover-color: var(--s-hover); --highlight-color: var(--s-hover);
	--sidebar-hover-color: var(--s-hover); --sidebar-select-color: var(--s-active);

	--border-color: var(--s-border); --dark-border-color: var(--s-border);
	--table-border-color: var(--s-border); --btn-group-border-color: var(--s-border);

	--s-nav-hover:  color-mix(in srgb, var(--s-nav) 88%, var(--s-nav-text));
	--s-nav-active: color-mix(in srgb, var(--s-nav) 80%, var(--s-nav-text));
	--s-nav-muted:  color-mix(in srgb, var(--s-nav-text) 60%, var(--s-nav));
	--s-nav-border: color-mix(in srgb, var(--s-nav) 82%, var(--s-nav-text));

	--scrollbar-thumb-color: #CFCCC5; --scrollbar-track-color: transparent;

	--font-stack: var(--s-font); --font-size-base: var(--s-font-size);
	--navbar-height: var(--s-navbar-height); --sidebar-width: var(--s-sidebar-width);
	--page-max-width: var(--s-page-max-width);

	--shadow-xs: var(--s-shadow-xs, 0 1px 2px rgba(0,0,0,.08)); --shadow-sm: var(--s-shadow-sm, 0 1px 3px rgba(0,0,0,.1));
	--shadow-base: var(--s-shadow-sm, 0 1px 3px rgba(0,0,0,.1)); --shadow-md: var(--s-shadow-md, 0 6px 20px rgba(0,0,0,.08)); --shadow-lg: var(--s-shadow-lg, 0 16px 40px rgba(0,0,0,.12));
	--card-shadow: var(--s-shadow-sm, 0 1px 3px rgba(0,0,0,.1)); --modal-shadow: var(--s-shadow-lg, 0 16px 40px rgba(0,0,0,.12)); --btn-shadow: none;
}

[data-theme="dark"] {
	--s-shadow-xs:  0 1px 2px rgba(0,0,0,.30);
	--s-shadow-sm:  0 1px 3px rgba(0,0,0,.40);
	--s-shadow-md:  0 6px 20px rgba(0,0,0,.45);
	--s-shadow-lg:  0 16px 40px rgba(0,0,0,.55);
	--scrollbar-thumb-color: #4A473F;
}

/* Global radius baseline — token-driven so each theme controls it (sharp theme
 * sets --s-radius-sm:0; rounded theme sets it >0). Components with their own
 * radius rule still win via higher specificity. */
* {
    border-radius: var(--s-radius-sm) !important;
}
/* ── Typography: sans body, serif headings & brand ─────────────────────── */
body, .page-body, input, select, textarea, .form-control, .btn, .list-row, .navbar, button {
	font-family: var(--s-font) !important; letter-spacing: 0;
}
body { font-size: var(--s-font-size) !important; line-height: var(--s-line-height) !important; font-weight: var(--s-body-weight) !important; color: var(--s-ink); background: var(--s-cream); }
code, pre, .dt-instance, .control-value.font-monospace { font-family: var(--s-font-mono) !important; }
h1,h2,h3,h4,h5,.h1,.h2,.h3,.h4,.page-title .title-text,.head-title,.section-head,.modal-title,.widget-title,.ce-block h1,.ce-block h2 {
	font-family: var(--s-font-serif) !important;
	font-weight: var(--s-heading-weight) !important;
	letter-spacing: var(--s-heading-tracking) !important;
	color: var(--s-heading) !important;
}
.body-sidebar .header-title, .navbar-brand, .app-logo-title, .navbar .app-logo + span {
	font-family: var(--s-font-serif) !important; text-transform: uppercase !important;
	letter-spacing: var(--s-brand-tracking) !important; font-weight: var(--s-heading-weight) !important;
	color: var(--s-black) !important;
}
.control-label, .list-row-head .list-subject { font-weight: var(--s-medium-weight) !important; color: var(--s-muted) !important; }
.body-sidebar .standard-sidebar-section > .standard-sidebar-label, .sidebar-label {
	text-transform: uppercase !important; letter-spacing: var(--s-label-tracking) !important;
	font-size: 11px !important; font-weight: var(--s-medium-weight) !important; color: var(--s-muted) !important;
}
.list-row-head, .list-row-head .list-row-col, .list-row-head .level-left, .list-row-head .level-right,
.list-row-head .list-subject, .dt-cell--header .dt-cell__content {
	text-transform: none !important; letter-spacing: 0 !important;
	font-size: 12px !important; font-weight: var(--s-medium-weight) !important; color: var(--s-muted) !important;
	background: transparent !important;
}

/* ── Accents (checkbox / selection / scrollbar) ────────────────────────── */
input[type="checkbox"], input[type="radio"] {
	accent-color: var(--s-black) !important;
	border-color: var(--s-border) !important;
	border-radius: var(--s-radius-sm) !important;
	vertical-align: middle !important;
}
input[type="checkbox"]:checked, input[type="radio"]:checked {
	background-color: var(--s-black) !important;
	border-color: var(--s-black) !important;
}
input[type="checkbox"]:focus, input[type="radio"]:focus {
	box-shadow: 0 0 0 3px rgba(17,17,17,.12) !important;
}
input[type="checkbox"]:disabled, input[type="checkbox"].disabled-deselected {
	border-color: var(--s-border) !important; background-color: var(--s-hover) !important;
}
.list-header-checkbox, .list-row-checkbox { vertical-align: middle !important; margin-top: 0 !important; }
::selection { background: var(--s-black) !important; color: var(--s-on-black) !important; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb-color) !important; border-radius: var(--s-pill); border: 2px solid transparent; background-clip: content-box; }
::-webkit-scrollbar-thumb:hover { background: var(--s-scroll-hover); background-clip: content-box; }

/* ── Buttons: primary + default ─────────────────────────────────────────── */
.btn {
	border-radius: var(--s-btn-radius) !important;
	border: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
	padding: var(--s-btn-pad-y) var(--s-btn-pad-x) !important;
	box-shadow: none !important;
}
.btn-primary, .btn.btn-primary, .btn-modal-primary, .primary-action {
	background: var(--s-black) !important; border-color: var(--s-black) !important; color: var(--s-on-black) !important;
}
.btn-primary:hover, .btn.btn-primary:hover, .btn-modal-primary:hover {
	background: var(--s-black-hover) !important; border-color: var(--s-black-hover) !important; color: var(--s-on-black) !important; transform: translateY(-1px) !important;
}
.btn-default, .btn.btn-default, .btn-secondary {
	background: var(--s-white) !important; border: var(--s-border-width) var(--s-border-style) var(--s-border) !important; color: var(--s-ink) !important;
}
.btn-default:hover, .btn.btn-default:hover, .btn-secondary:hover { background: var(--s-hover) !important; border-color: var(--s-border) !important; color: var(--s-black) !important; }
.btn-link { color: var(--s-black) !important; text-decoration: underline; }
.btn:focus, .btn:focus-visible { box-shadow: 0 0 0 3px rgba(17,17,17,.12) !important; }

/* ── Inputs ─────────────────────────────────────────────────────────────── */
.form-control, .input-with-feedback, textarea.form-control, .like-disabled-input, .ql-editor {
	border-radius: var(--s-radius-sm) !important;
	border: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
	background: var(--s-white) !important; color: var(--s-ink) !important;
	padding-left: var(--s-control-pad-x) !important; padding-right: var(--s-control-pad-x) !important;
}
.form-control:not(textarea), .input-with-feedback:not(textarea) { min-height: var(--s-control-height) !important; }
.form-control:focus, .input-with-feedback:focus, textarea.form-control:focus, .ql-container.ql-focused,
.awesomplete input:focus, .search-bar .form-control:focus {
	border-color: var(--s-black) !important; box-shadow: 0 0 0 3px rgba(17,17,17,.10) !important; outline: none !important;
}

/* ── Surfaces ───────────────────────────────────────────────────────────── */
.form-section, .form-dashboard, .frappe-card, .widget {
	border-radius: var(--s-radius-lg) !important; background: var(--s-white) !important;
	border: var(--s-border-width) var(--s-border-style) var(--s-border) !important; box-shadow: var(--s-card-shadow) !important;
}
.form-section, .frappe-card { padding: var(--s-section-pad) !important; }
.widget { padding: var(--s-card-pad) !important; transition: box-shadow .16s, border-color .16s !important; }
.widget:hover { border-color: var(--s-border) !important; box-shadow: var(--s-shadow-md) !important; }
.dropdown-menu { border: var(--s-border-width) var(--s-border-style) var(--s-border) !important; border-radius: var(--s-radius) !important; box-shadow: var(--s-shadow-lg) !important; padding: 6px !important; }
.dropdown-item { border-radius: var(--s-radius-sm) !important; padding: var(--s-btn-gap) var(--s-control-pad-x) !important; }
.dropdown-item:hover, .dropdown-item:focus { background: var(--s-hover) !important; color: var(--s-black) !important; }
.modal-content { border: var(--s-border-width) var(--s-border-style) var(--s-border) !important; border-radius: var(--s-radius-xl) !important; box-shadow: var(--s-shadow-lg) !important; overflow: hidden; }
.modal-header, .modal-footer { padding: var(--s-card-pad) var(--s-section-pad) !important; }
.modal-body { padding: var(--s-section-pad) !important; }
.layout-main-section { padding: var(--s-page-pad) !important; }
.frappe-control { margin-bottom: var(--s-field-gap) !important; }

/* ── List view / report / datatable ────────────────────────────────────── */
.frappe-list, .result, .result.no-assign-to, .frappe-list .result {
	border: none !important; border-radius: 0 !important; background: transparent !important;
	overflow: visible !important; box-shadow: none !important;
}
.report-wrapper, .dt-instance {
	border: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
	border-radius: var(--s-radius-lg) !important; background: var(--s-white) !important; overflow: hidden !important;
}
.list-row-container {
	padding: 0% !important;
	border-top: none !important;
	border-bottom: none !important; border-radius: 0 !important;
	border-left: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
	border-right: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
	background: transparent !important; box-shadow: none !important;
}
.list-row-head { background: var(--s-white) !important; border: none !important; border-bottom: var(--s-border-width) var(--s-border-style) var(--s-border) !important; border-radius: 0 !important; }
.frappe-list .result .list-row-container {
	border-left: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
	border-right: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
}
.frappe-list .result .list-row-container:first-child {
	border-top: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
}
.frappe-list .result .list-row-container:last-child {
	border-bottom: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
}
.list-row {
	border: none !important; border-radius: 0 !important;
	border-bottom: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
	background: var(--s-white) !important;
	padding-top: var(--s-field-gap) !important; padding-bottom: var(--s-field-gap) !important;
}
.list-row-container:last-child .list-row { border-bottom: none !important; }
.list-row:hover, .list-row-container:hover { background: var(--s-hover) !important; }
.list-row .level-right, .list-row-container .level-right {
	background: var(--s-white) !important; padding-left: 8px !important;
}
.list-row:hover .level-right, .list-row-container:hover .level-right {
	background: var(--s-hover) !important;
}
.list-row .list-row-col.text-muted { background: transparent !important; }
.list-paging-area { border-top: var(--s-border-width) var(--s-border-style) var(--s-border) !important; padding: 14px 4px !important; margin-top: 0 !important; background: transparent !important; }
.list-row .list-subject .level-item .ellipsis { color: var(--s-ink) !important; font-weight: var(--s-medium-weight) !important; }
.dt-header, .dt-cell--header .dt-cell__content { background: var(--s-white) !important; color: var(--s-muted) !important; }
.dt-row:hover .dt-cell { background: var(--s-hover) !important; }
.dt-cell--focus { border: 1px solid var(--s-black) !important; }

/* ── Status pills / indicators ─────────────────────────────────────────── */
.indicator-pill, .indicator-pill-round {
	background: transparent !important; border: 1px solid currentColor !important; border-radius: var(--s-pill) !important;
	font-weight: var(--s-medium-weight) !important; padding: 3px 10px !important;
}
.indicator-pill.green, .indicator-pill-green { color: var(--s-green) !important; }
.indicator-pill.blue, .indicator-pill.cyan { color: var(--s-blue) !important; }
.indicator-pill.orange, .indicator-pill.yellow { color: var(--s-amber) !important; }
.indicator-pill.gray, .indicator-pill.grey, .indicator-pill.darkgrey { color: var(--s-gray) !important; }
.indicator-pill.red { color: var(--s-red) !important; }
.indicator-pill:empty, .page-indicator-pill:empty { display: none !important; border: none !important; padding: 0 !important; }
.badge { background: transparent !important; border: 1px solid var(--s-border) !important; color: var(--s-ink) !important; border-radius: var(--s-radius-sm) !important; }

/* ── Tabs / links / progress ───────────────────────────────────────────── */
.form-tabs .nav-link.active, .nav-tabs .nav-link.active { color: var(--s-black) !important; border-bottom: 2px solid var(--s-black) !important; font-weight: var(--s-medium-weight) !important; }
.form-tabs .nav-link:hover, .nav-tabs .nav-link:hover { color: var(--s-black) !important; }
.text-primary, a.text-primary, .navbar-breadcrumbs a:hover { color: var(--s-black) !important; }
.progress-bar { background: var(--s-black) !important; }
.avatar .avatar-frame { background: var(--s-black) !important; color: var(--s-on-black) !important; }

/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║  LEFT SIDEBAR                                                           ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */
.body-sidebar, .body-sidebar .sidebar-header, .body-sidebar .body-sidebar-bottom { background-color: var(--s-nav) !important; }
.body-sidebar { border-right: var(--s-border-width) var(--s-border-style) var(--s-nav-border) !important; }
.body-sidebar .sidebar-header { padding: 10px 8px 10px 12px !important; }
.body-sidebar .header-title {
	font-family: var(--s-font-serif) !important; font-size: 20px !important; line-height: 1.15 !important;
	text-transform: uppercase !important; letter-spacing: 0.14em !important;
	font-weight: var(--s-heading-weight) !important; color: var(--s-nav-text) !important;
}
.body-sidebar .standard-sidebar-item { border-radius: var(--s-radius) !important; margin: 2px 10px !important; transition: background .14s !important; }
.body-sidebar .standard-sidebar-item .item-anchor, .body-sidebar .standard-sidebar-item .sidebar-item-label { color: var(--s-nav-text) !important; }
.body-sidebar .standard-sidebar-item .text-muted, .body-sidebar .standard-sidebar-item .text-secondary { color: var(--s-nav-muted) !important; }
.body-sidebar .standard-sidebar-item:hover { background: var(--s-nav-hover) !important; }
.body-sidebar .standard-sidebar-item.active-sidebar, .body-sidebar .standard-sidebar-item.selected { background: var(--s-nav-active) !important; box-shadow: none !important; }
.body-sidebar .standard-sidebar-item.active-sidebar .sidebar-item-label, .body-sidebar .standard-sidebar-item.active-sidebar .item-anchor { color: var(--s-nav-text) !important; font-weight: var(--s-medium-weight) !important; }
.body-sidebar .sidebar-item-icon svg, .body-sidebar .icon, .body-sidebar .es-icon { color: var(--s-nav-text) !important; }
.body-sidebar .standard-sidebar-item.active-sidebar .sidebar-item-icon svg { color: var(--s-nav-text) !important; fill: none !important; }
.body-sidebar .sidebar-user-button, .body-sidebar .dropdown-navbar-user .nav-link { color: var(--s-nav-text) !important; border-radius: var(--s-radius) !important; padding: 8px 10px !important; }
.body-sidebar .sidebar-user-button:hover, .body-sidebar .dropdown-navbar-user .nav-link:hover { background: var(--s-nav-hover) !important; }
.body-sidebar .sidebar-user-button .avatar-name-email > span:first-child { color: var(--s-nav-text) !important; font-weight: var(--s-medium-weight) !important; }
.body-sidebar .sidebar-user-button .text-secondary { color: var(--s-nav-muted) !important; }

.navbar { background: var(--s-nav) !important; height: var(--s-navbar-height) !important; border-bottom: var(--s-border-width) var(--s-border-style) var(--s-nav-border) !important; }
.navbar .navbar-brand, .navbar .nav-link, .navbar a { color: var(--s-nav-text) !important; }
.page-head { border-bottom: var(--s-border-width) var(--s-border-style) var(--s-border) !important; }

/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║  COMPACT / DENSE CONTROLS + ICON BUTTONS                                ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */
.form-control.input-xs, .input-with-feedback.input-xs, input.input-xs { min-height: 28px !important; height: 28px !important; padding: 3px 9px !important; font-size: var(--s-font-size-sm) !important; border-radius: var(--s-radius-sm) !important; }
.form-control.input-sm, .input-with-feedback.input-sm { min-height: 30px !important; height: 30px !important; padding: 4px 10px !important; font-size: var(--s-font-size-sm) !important; border-radius: var(--s-radius-sm) !important; }
.btn.btn-sm, .btn.btn-xs, .btn.filter-button, .btn.match-type-drpdown-btn, .match-type-drpdown-btn {
	min-height: 28px !important; height: 28px !important; padding: 3px 10px !important; font-size: var(--s-font-size-sm) !important;
	border-radius: var(--s-radius-sm) !important; line-height: 1 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important;
}
.btn.match-type-drpdown-btn, .match-type-drpdown-btn { padding: 3px 8px !important; min-width: 28px !important; }
.btn.filter-button.btn-primary-light, .btn.btn-primary-light { background: var(--s-hover) !important; color: var(--s-black) !important; border-color: var(--s-border) !important; }
.btn.filter-button.btn-primary-light:hover, .btn.btn-primary-light:hover { background: var(--s-active) !important; color: var(--s-black) !important; }
.filter-box, .standard-filter-section, .filter-selector, .filter-list, .tag-filters-area, .list-filters, .filter-area { align-items: center !important; }
.page-form {
	margin-left: 15px !important; margin-right: 15px !important;
	border-left: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
	border-right: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
	border-top: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
	border-bottom: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
	padding: 12px 16px !important;
	align-items: center !important; flex-wrap: nowrap !important;
	overflow-x:scroll !important;
}
.page-form .standard-filter-section, .page-form .filter-selector, .page-form .sort-selector {
	display: flex !important; align-items: center !important; margin: 0 !important; align-self: center !important;
}
.filter-box .frappe-control, .standard-filter-section .frappe-control, .filter-selector .frappe-control, .tag-filters-area .frappe-control { margin-bottom: 0 !important; }
.filter-box .input-group, .filter-selector .input-group { gap: 4px !important; align-items: center !important; }

.btn.icon-btn, .btn.more-button, .btn.menu-more-button {
	padding: 0 !important; width: 32px !important; height: 32px !important; min-width: 32px !important;
	border: none !important; background: transparent !important; box-shadow: none !important;
	border-radius: var(--s-radius-sm) !important; display: inline-flex !important; align-items: center !important; justify-content: center !important;
}
.btn.icon-btn:hover, .btn.more-button:hover, .btn.menu-more-button:hover { background: var(--s-hover) !important; color: var(--s-black) !important; transform: none !important; }
.btn.icon-btn svg, .btn.icon-btn use, .btn.icon-btn .icon, .btn.menu-more-button svg, .btn.more-button svg { width: 16px !important; height: 16px !important; }
.btn.hide, .btn.hidden, .hide.btn, [hidden].btn { display: none !important; }

#nprogress .bar { background: var(--s-black) !important; height: 2px !important; }
#nprogress .peg { box-shadow: 0 0 10px var(--s-black), 0 0 5px var(--s-black) !important; }
#nprogress .spinner-icon { border-top-color: var(--s-black) !important; border-left-color: var(--s-black) !important; }

.checkbox {
    padding: 9px 5px 2px 5px !important;
}

.form-dashboard {
	border:none !important;
}

.form-tabs{
	border: var(--s-border-width) var(--s-border-style) var(--s-border) !important;
	border-radius: var(--s-radius-lg) !important;
}
.form-page{
	background:none !important;
}

.level-right{
	background:var(--s-white) !important;
}

.card-section{
	border-radius: var(--s-radius-lg) !important;
	margin: 10px !important;
}
""".strip("\n")

# Every --s-* token this doctype's fields cover, in the order the reference
# generator's buildCSS() emits them — (doctype fieldname, css custom property).
_LIGHT_COLOR_FIELDS = [
    ("color_ink", "--s-ink"), ("color_black", "--s-black"), ("color_white", "--s-white"),
    ("color_cream", "--s-cream"), ("color_muted", "--s-muted"), ("color_border", "--s-border"),
    ("color_hover", "--s-hover"), ("color_active", "--s-active"), ("color_on_black", "--s-on-black"),
    ("color_black_hover", "--s-black-hover"), ("color_grid_line", "--s-grid-line"),
    ("color_scroll_hover", "--s-scroll-hover"), ("color_nav", "--s-nav"), ("color_nav_text", "--s-nav-text"),
    ("color_heading", "--s-heading"), ("color_green", "--s-green"), ("color_blue", "--s-blue"),
    ("color_amber", "--s-amber"), ("color_gray", "--s-gray"), ("color_red", "--s-red"),
]
_DARK_COLOR_FIELDS = [(f"dark_{name[6:]}", token) for name, token in _LIGHT_COLOR_FIELDS]

_FONT_FIELDS = [
    ("font_sans", "--s-font"), ("font_serif", "--s-font-serif"), ("font_mono", "--s-font-mono"),
]

_DIM_FIELDS = [
    "font_size", "font_size_sm", "line_height", "body_weight", "medium_weight", "heading_weight",
    "heading_tracking", "brand_tracking", "label_tracking", "btn_radius", "btn_pad_y", "btn_pad_x",
    "sidebar_width", "navbar_height", "control_height", "page_max_width", "page_pad", "card_pad",
    "section_pad", "gap", "field_gap", "btn_gap", "control_pad_x", "radius", "radius_sm", "radius_lg",
    "radius_xl", "pill", "border_width", "border_style",
]
_DIM_FIELD_TOKENS = {f: f"--s-{f.replace('_', '-')}" for f in _DIM_FIELDS}


class OSThemeSettings(Document):
    def on_update(self):
        self._apply_logos()
        self._write_custom_css()
        frappe.clear_cache()

    def _sites_assets_images_dir(self):
        path = os.path.join(frappe.local.sites_path, "assets", "images")
        os.makedirs(path, exist_ok=True)
        return path

    def _apply_logos(self):
        images_dir = self._sites_assets_images_dir()
        if self.square_logo:
            self._copy_attached_file(self.square_logo, os.path.join(images_dir, SQUARE_LOGO_FILENAME))
        if self.horizontal_logo:
            self._copy_attached_file(self.horizontal_logo, os.path.join(images_dir, HOR_LOGO_FILENAME))

    def _copy_attached_file(self, file_url, dest_path):
        file_name = frappe.db.get_value("File", {"file_url": file_url}, "name")
        if not file_name:
            return
        file_doc = frappe.get_doc("File", file_name)
        source_path = file_doc.get_full_path()
        if os.path.exists(source_path):
            shutil.copyfile(source_path, dest_path)

    def _font_stack(self, name, fallback):
        if not name:
            return fallback
        return f'"{name}", {fallback}'

    def _build_font_import(self):
        families = []
        for fieldname, _ in _FONT_FIELDS:
            value = (self.get(fieldname) or "").strip()
            if value and value not in families:
                families.append(value)
        if not families:
            return ""
        family_param = "|".join(f.replace(" ", "+") + _FONT_WEIGHTS for f in families)
        return f"@import url('https://fonts.googleapis.com/css?family={family_param}&display=swap');"

    def _build_root_and_dark_blocks(self):
        font_fallbacks = {
            "--s-font": '-apple-system, "Segoe UI", Roboto, system-ui, sans-serif',
            "--s-font-serif": '"Georgia", "Times New Roman", serif',
            "--s-font-mono": "ui-monospace, Menlo, monospace",
        }

        root_lines = [":root {"]
        for fieldname, token in _LIGHT_COLOR_FIELDS:
            root_lines.append(f"  {token}: {self.get(fieldname) or '#000000'};")
        for fieldname, token in _FONT_FIELDS:
            root_lines.append(f"  {token}: {self._font_stack(self.get(fieldname), font_fallbacks[token])};")
        for fieldname in _DIM_FIELDS:
            token = _DIM_FIELD_TOKENS[fieldname]
            value = self.get(fieldname)
            if value not in (None, ""):
                root_lines.append(f"  {token}: {value};")
        root_lines.append("}")

        dark_lines = ['[data-theme="dark"] {']
        for fieldname, token in _DARK_COLOR_FIELDS:
            dark_lines.append(f"  {token}: {self.get(fieldname) or '#000000'};")
        dark_lines.append("}")

        return "\n".join(root_lines), "\n".join(dark_lines)

    def build_css(self):
        """Full, self-contained stylesheet text for the current field values."""
        font_import = self._build_font_import()
        root_block, dark_block = self._build_root_and_dark_blocks()
        parts = [p for p in (font_import, root_block, dark_block, _ENGINE_AND_COMPONENTS_CSS) if p]
        return "\n\n".join(parts) + "\n"

    def _custom_css_path(self):
        return frappe.get_app_path("alaiy_os", "public", "css", "custom.css")

    def _write_custom_css(self):
        content = self.build_css() if self.enable_custom_theme else ""
        with open(self._custom_css_path(), "w", encoding="utf-8") as f:
            f.write(content)
