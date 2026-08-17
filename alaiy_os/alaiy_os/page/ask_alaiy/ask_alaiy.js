// "Ask Alaiy" — the assistant, as a real desk Page (route: /app/ask-alaiy).
//
// A standalone Page rather than a dialog, so it behaves like every other
// sidebar tab: back/forward, bookmarkable URL, full-height layout.
//
// Layout is a two-pane app that fills the viewport: a history rail on the
// start side, a thread that scrolls on its own, and a composer pinned to the
// bottom. The desk's own page body scrolls the whole document, which is wrong
// for a chat (the composer would walk off-screen), so the shell measures its
// own top offset and claims the remaining viewport height. See _fit().
//
// It talks to alaiy_os.api.chat (see alaiy_os/chat/CHAT.md). A turn runs in a
// Frappe worker — an LLM call plus a chain of tool calls outlives any request
// timeout — so sending only queues it and this polls for steps as they are
// committed. No worker running means the reply never arrives.
//
// THEMING: every colour, radius and font below reads a --s-* token that
// OS Theme Settings actually emits (see _LIGHT_COLOR_FIELDS / _DIM_FIELDS in
// os_theme_settings.py). Note there are no --s-shadow-* or --s-card-shadow
// tokens — those exist only as fallbacks inside Frappe's --shadow-* vars — so
// shadows here read var(--shadow-*), and the error colour is --s-red.

frappe.pages["ask-alaiy"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Ask Alaiy"),
		single_column: true,
	});

	wrapper.__alaiy_ask = new AlaiyAskPage(page);

	// This is a standalone Page route, not a Workspace route, so Frappe's own
	// sidebar resolver (frappe.ui.Sidebar#set_workspace_sidebar) can't match it
	// to any workspace and leaves whatever sidebar was showing before — which,
	// on a cold/direct load, is the generic module-tree fallback instead of the
	// themed "OS" sidebar every other tab shows. Force it explicitly.
	if (frappe.app && frappe.app.sidebar) {
		frappe.app.sidebar.setup("OS");
		// setup() rebuilds the sidebar DOM from scratch, which would wipe out
		// the "Ask Alaiy" active-tab highlighting if that ran (via the
		// router's "change" event, see alaiy_workspace.js) before this did —
		// re-apply it against the fresh DOM.
		if (alaiy_os.workspace && alaiy_os.workspace._syncAskAlaiyActiveState) {
			alaiy_os.workspace._syncAskAlaiyActiveState();
		}
	}
};

// Returning to the tab should show chats started elsewhere since.
frappe.pages["ask-alaiy"].on_page_show = function (wrapper) {
	if (wrapper.__alaiy_ask) wrapper.__alaiy_ask.on_show();
};

const POLL_INTERVAL_MS = 1000;
const NEAR_BOTTOM_PX = 120;

// Mirrors chat/attachments.py SUPPORTED. Only a hint to the file picker — the
// server re-checks, since this attribute is trivially bypassed and the
// browser-supplied content type is not evidence of anything.
const ACCEPT_ATTRIBUTE =
	".pdf,.xlsx,.xlsm,.csv,.tsv,.txt,.md,.json,.yaml,.yml,.py,.js,.ts,.sql,.log,.xml,.html,.htm,.css,.ini,.cfg,.toml";
const MAX_ATTACHMENTS = 5;

// The `@` token being typed, matched against the text LEFT OF THE CARET — `$`
// on that slice is what "the caret is at the end of this token" means, and it
// is why a mention works mid-sentence where a `/` skill only works alone.
//
// The leading boundary group is what stops "prajwal@alaiy.com" from opening a
// picker: the character before the `@` must be the start of the line or
// punctuation, never a word character.
//
// Spaces inside the term are allowed, up to two, so "Royal Canin" keeps
// matching as it is typed. That is unavoidable for real record names and it is
// also the one loose end here — see `_sync_mentions`, which closes the picker
// once a multi-word term stops matching anything, so typing prose after a
// mention does not leave a dead menu open.
const MENTION_RE = /(?:^|[\s(\[{,;:"'“‘])@([^\s@]{0,40}(?:[ ][^\s@]{0,40}){0,2})?$/;

// Every keystroke asks the server (the catalogue is per-query and can be
// thousands of items), so unlike the `/` picker this one is debounced. Short
// enough to feel live, long enough that holding a key down is one request.
const MENTION_DEBOUNCE_MS = 120;

// Keys that move the caret without changing the value, so `input` never fires.
// ArrowUp/Down are listed for the closed case only: while the picker is open it
// has already consumed them at keydown, so the caret has not moved.
const CARET_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];

class AlaiyAskPage {
	constructor(page) {
		this.page = page;
		this.session = null; // created lazily, on the first message
		this.last_seq = 0; // poll cursor
		this.running = false;
		this.poll_timer = null;
		this.sessions = [];
		this.query = "";
		// Staged uploads, keyed by a client id so a chip exists (and can show a
		// spinner or an error) before the server has given it a name.
		this.pending = new Map();
		this.upload_seq = 0;
		// The `/` catalogue, fetched once on the first slash. null = not yet
		// asked; [] = asked and this site has no skills.
		this.skills = null;
		this.skill_matches = [];
		this.skill_index = 0;
		// The `@` picker. Unlike skills, the options depend on what is typed, so
		// they are cached per query rather than fetched once. `mention_options`
		// is the flattened list the arrow keys walk — the group headings are
		// drawn from the response but are not selectable.
		this.mention_options = [];
		this.mention_index = 0;
		this.mention_groups = [];
		this.mention_term = "";
		this.mention_cache = new Map();
		// Bumped per request so a slow response for an earlier query cannot
		// overwrite the menu for the one being typed now.
		this.mention_req = 0;
		// The structured identity behind each token inserted into the composer.
		// Reconciled against the final text on submit — see `_collect_mentions`.
		this.mentions = [];
		this._sync_mentions = frappe.utils.debounce(
			() => this._sync_mentions_now(),
			MENTION_DEBOUNCE_MS,
		);

		this._ensure_styles();
		this._render();
		this._bind();
		this._fit();
		this._load_sessions();

		this.page.set_primary_action(__("New chat"), () => this._reset(), "add");
	}

	on_show() {
		this._fit();
		this._load_sessions();
	}

	/** The desk scrolls the document; a chat needs its own scroll region, so
	 * claim whatever viewport is left below wherever the shell landed. */
	_fit() {
		if (!this.$shell || !this.$shell.is(":visible")) return;
		const top = this.$shell[0].getBoundingClientRect().top + window.scrollY;
		this.$shell.css("height", `max(420px, calc(100vh - ${Math.round(top)}px - 24px))`);
	}

	// ── Chrome ──────────────────────────────────────────────────────────────
	_ensure_styles() {
		if (document.getElementById("ask-alaiy-styles")) return;
		const style = document.createElement("style");
		style.id = "ask-alaiy-styles";
		style.textContent = `
			.ask-alaiy-shell {
				display: flex; gap: 0; overflow: hidden;
				background: var(--s-white);
				border: var(--s-border-width) var(--s-border-style) var(--s-border);
				border-radius: var(--s-radius-lg);
				box-shadow: var(--shadow-sm);
			}

			/* ── History rail ────────────────────────────────────────────── */
			.ask-alaiy-rail {
				width: 268px; flex: none; display: flex; flex-direction: column;
				border-inline-end: var(--s-border-width) var(--s-border-style) var(--s-border);
				background: var(--s-cream);
			}
			.ask-alaiy-rail-head { padding: 14px 14px 10px; }
			.ask-alaiy-search {
				display: flex; align-items: center; gap: 7px;
				background: var(--s-white);
				border: var(--s-border-width) var(--s-border-style) var(--s-border);
				border-radius: var(--s-radius-sm); padding: 6px 10px;
				transition: border-color .15s, box-shadow .15s;
			}
			.ask-alaiy-search.is-focused { border-color: var(--s-black); box-shadow: 0 0 0 3px var(--s-hover); }
			.ask-alaiy-search svg { flex: none; color: var(--s-muted); }
			.ask-alaiy-search input {
				flex: 1; min-width: 0; border: none; outline: none; background: transparent;
				font-family: var(--s-font); font-size: 13px; color: var(--s-ink);
			}
			.ask-alaiy-list { flex: 1; overflow-y: auto; padding: 0 8px 12px; }
			.ask-alaiy-group {
				font-size: 10.5px; text-transform: uppercase; letter-spacing: var(--s-label-tracking, .04em);
				font-weight: var(--s-medium-weight); color: var(--s-muted);
				padding: 14px 8px 5px;
			}
			.ask-alaiy-row {
				display: flex; align-items: center; gap: 4px;
				border-radius: var(--s-radius-sm); padding-inline-end: 4px;
				transition: background .12s;
			}
			.ask-alaiy-row:hover { background: var(--s-hover); }
			.ask-alaiy-row.is-active { background: var(--s-active); }
			.ask-alaiy-row-open {
				flex: 1; min-width: 0; border: none; background: none; cursor: pointer;
				text-align: start; padding: 7px 4px 7px 10px; color: var(--s-ink);
				font-family: var(--s-font); font-size: 13.5px;
				white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
			}
			.ask-alaiy-row.is-active .ask-alaiy-row-open { font-weight: var(--s-medium-weight); }
			.ask-alaiy-row-del {
				flex: none; border: none; background: none; cursor: pointer; padding: 4px;
				border-radius: var(--s-radius-sm); color: var(--s-muted); line-height: 0;
				opacity: 0; transition: opacity .12s, color .12s;
			}
			.ask-alaiy-row:hover .ask-alaiy-row-del,
			.ask-alaiy-row-del:focus-visible { opacity: 1; }
			.ask-alaiy-row-del:hover { color: var(--s-red); background: var(--s-white); }
			.ask-alaiy-row-live {
				flex: none; width: 6px; height: 6px; border-radius: 50%;
				background: var(--s-black); margin-inline-end: 6px;
				animation: ask-alaiy-pulse 1.3s infinite;
			}
			.ask-alaiy-rail-empty { padding: 18px 12px; color: var(--s-muted); font-size: 13px; }

			/* ── Thread ──────────────────────────────────────────────────── */
			.ask-alaiy-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
			.ask-alaiy-scroll { flex: 1; overflow-y: auto; scroll-behavior: smooth; }
			.ask-alaiy-thread {
				max-width: 720px; margin: 0 auto; padding: 28px 28px 8px;
				display: flex; flex-direction: column; gap: 22px;
			}

			.ask-alaiy-turn { display: flex; gap: 12px; }
			.ask-alaiy-turn.is-user { justify-content: flex-end; }
			.ask-alaiy-mark {
				flex: none; width: 26px; height: 26px; border-radius: 50%; margin-top: 1px;
				background: var(--s-hover); display: flex; align-items: center; justify-content: center;
				color: var(--s-muted);
			}
			.ask-alaiy-body { min-width: 0; flex: 1; }
			.ask-alaiy-user-bubble {
				max-width: 78%; background: var(--s-black); color: var(--s-on-black);
				border-radius: var(--s-radius-lg); padding: 9px 14px;
				font-size: 14.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
			}
			.ask-alaiy-answer { font-size: 14.5px; line-height: 1.65; color: var(--s-ink); word-break: break-word; }

			/* Answer formatting — the model replies in markdown. */
			.ask-alaiy-answer > :first-child { margin-top: 0; }
			.ask-alaiy-answer > :last-child { margin-bottom: 0; }
			.ask-alaiy-answer p { margin: 0 0 11px; }
			.ask-alaiy-answer h4 {
				font-family: var(--s-font); font-size: 14.5px; font-weight: 600;
				color: var(--s-heading); margin: 18px 0 7px; letter-spacing: 0;
			}
			.ask-alaiy-answer ul, .ask-alaiy-answer ol { margin: 0 0 11px; padding-inline-start: 22px; }
			.ask-alaiy-answer li { margin-bottom: 4px; }
			.ask-alaiy-answer li::marker { color: var(--s-muted); }
			.ask-alaiy-answer code {
				background: var(--s-hover); border-radius: 4px; padding: 1.5px 5px;
				font-family: var(--s-font-mono); font-size: 12.5px;
			}
			.ask-alaiy-answer pre {
				background: var(--s-cream); border: var(--s-border-width) var(--s-border-style) var(--s-border);
				border-radius: var(--s-radius-sm); padding: 11px 13px; margin: 0 0 11px; overflow-x: auto;
			}
			.ask-alaiy-answer pre code { background: none; padding: 0; font-size: 12.5px; }
			.ask-alaiy-answer blockquote {
				margin: 0 0 11px; padding-inline-start: 12px;
				border-inline-start: 2px solid var(--s-border); color: var(--s-muted);
			}
			.ask-alaiy-table-wrap {
				overflow-x: auto; margin: 0 0 11px;
				border: var(--s-border-width) var(--s-border-style) var(--s-border);
				border-radius: var(--s-radius-sm);
			}
			.ask-alaiy-answer table { border-collapse: collapse; width: 100%; font-size: 13px; }
			.ask-alaiy-answer th, .ask-alaiy-answer td {
				padding: 7px 11px; text-align: start; vertical-align: top;
				border-bottom: var(--s-border-width) var(--s-border-style) var(--s-border);
			}
			.ask-alaiy-answer tr:last-child td { border-bottom: none; }
			.ask-alaiy-answer th {
				background: var(--s-cream); font-weight: var(--s-medium-weight);
				color: var(--s-muted); white-space: nowrap;
			}

			/* ── Work trail ──────────────────────────────────────────────
			   What the assistant actually did. These tools read and change real
			   orders and stock, so the steps stay in the conversation as a
			   receipt rather than hiding behind a spinner. */
			.ask-alaiy-trail { position: relative; margin: 0 0 12px; padding-inline-start: 17px; }
			.ask-alaiy-trail::before {
				content: ""; position: absolute; inset-block: 9px; inset-inline-start: 4px;
				width: 1px; background: var(--s-border);
			}
			.ask-alaiy-step { position: relative; }
			.ask-alaiy-step > summary {
				list-style: none; cursor: default; display: flex; align-items: center; gap: 6px;
				padding: 3px 0; font-size: 12.5px; color: var(--s-muted);
				border-radius: var(--s-radius-sm);
			}
			.ask-alaiy-step > summary::-webkit-details-marker { display: none; }
			.ask-alaiy-step.has-args > summary { cursor: pointer; }
			.ask-alaiy-step.has-args > summary:hover { color: var(--s-ink); }
			.ask-alaiy-step > summary::before {
				content: ""; position: absolute; inset-inline-start: -17px; top: 9px;
				width: 7px; height: 7px; border-radius: 50%;
				background: var(--s-border); box-shadow: 0 0 0 3px var(--s-white);
			}
			.ask-alaiy-step[open] > summary::before { background: var(--s-black); }
			.ask-alaiy-step.is-failed > summary { color: var(--s-red); }
			.ask-alaiy-step.is-failed > summary::before { background: var(--s-red); }
			.ask-alaiy-step-name { font-weight: var(--s-medium-weight); }
			.ask-alaiy-step-caret { transition: transform .15s; opacity: .5; }
			.ask-alaiy-step[open] .ask-alaiy-step-caret { transform: rotate(90deg); }
			.ask-alaiy-args {
				margin: 1px 0 7px; padding: 7px 11px;
				background: var(--s-cream); border-radius: var(--s-radius-sm);
				font-family: var(--s-font-mono); font-size: 11.5px; color: var(--s-ink);
				display: grid; grid-template-columns: auto 1fr; gap: 3px 12px;
			}
			.ask-alaiy-args dt { color: var(--s-muted); }
			.ask-alaiy-args dd { margin: 0; word-break: break-word; }

			.ask-alaiy-working {
				display: flex; align-items: center; gap: 6px; padding: 3px 0;
				font-size: 12.5px; color: var(--s-muted); position: relative;
			}
			.ask-alaiy-working::before {
				content: ""; position: absolute; inset-inline-start: -17px; top: 9px;
				width: 7px; height: 7px; border-radius: 50%; background: var(--s-black);
				box-shadow: 0 0 0 3px var(--s-white); animation: ask-alaiy-pulse 1.3s infinite;
			}
			@keyframes ask-alaiy-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }

			.ask-alaiy-typing { display: flex; gap: 4px; align-items: center; height: 26px; }
			.ask-alaiy-typing span {
				width: 6px; height: 6px; border-radius: 50%; background: var(--s-muted);
				animation: ask-alaiy-bounce 1.2s infinite ease-in-out;
			}
			.ask-alaiy-typing span:nth-child(2) { animation-delay: .15s; }
			.ask-alaiy-typing span:nth-child(3) { animation-delay: .3s; }
			@keyframes ask-alaiy-bounce {
				0%, 60%, 100% { transform: translateY(0); opacity: .45; }
				30% { transform: translateY(-4px); opacity: 1; }
			}

			.ask-alaiy-error {
				display: flex; gap: 8px; align-items: flex-start;
				color: var(--s-red); font-size: 13.5px; line-height: 1.5;
			}

			/* Copy action, revealed on hover over a finished answer. */
			.ask-alaiy-tools { margin-top: 8px; height: 20px; }
			.ask-alaiy-copy {
				border: none; background: none; cursor: pointer; padding: 2px 6px;
				border-radius: var(--s-radius-sm); color: var(--s-muted);
				font-family: var(--s-font); font-size: 11.5px;
				opacity: 0; transition: opacity .12s, background .12s;
			}
			.ask-alaiy-turn:hover .ask-alaiy-copy, .ask-alaiy-copy:focus-visible { opacity: 1; }
			.ask-alaiy-copy:hover { background: var(--s-hover); color: var(--s-ink); }

			/* ── Welcome ─────────────────────────────────────────────────── */
			.ask-alaiy-welcome {
				flex: 1; display: flex; flex-direction: column; align-items: center;
				justify-content: center; text-align: center; padding: 32px 28px;
			}
			.ask-alaiy-welcome-icon {
				width: 52px; height: 52px; border-radius: var(--s-radius-lg); object-fit: contain;
				margin-bottom: 18px; box-shadow: var(--shadow-md);
			}
			.ask-alaiy-welcome-title {
				font-family: var(--s-font-serif); font-weight: var(--s-heading-weight);
				letter-spacing: var(--s-heading-tracking); color: var(--s-heading);
				font-size: 25px; margin-bottom: 7px;
			}
			.ask-alaiy-welcome-sub { color: var(--s-muted); font-size: 14px; max-width: 420px; }
			.ask-alaiy-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 22px; }
			.ask-alaiy-chip {
				border: var(--s-border-width) var(--s-border-style) var(--s-border);
				background: var(--s-white); border-radius: var(--s-pill);
				padding: 7px 14px; cursor: pointer; color: var(--s-ink);
				font-family: var(--s-font); font-size: 13px;
				transition: border-color .14s, background .14s, transform .14s;
			}
			.ask-alaiy-chip:hover {
				border-color: var(--s-black); background: var(--s-hover); transform: translateY(-1px);
			}

			/* ── Composer ────────────────────────────────────────────────── */
			.ask-alaiy-composer-wrap {
				padding: 12px 28px 20px; max-width: 720px; width: 100%; margin: 0 auto;
			}
			.ask-alaiy-composer {
				display: flex; align-items: flex-end; gap: 10px;
				background: var(--s-white);
				border: var(--s-border-width) var(--s-border-style) var(--s-border);
				border-radius: var(--s-radius-xl); padding: 10px 10px 10px 18px;
				box-shadow: var(--shadow-sm); transition: border-color .15s, box-shadow .15s;
			}
			.ask-alaiy-composer.is-focused { border-color: var(--s-black); box-shadow: 0 0 0 3px var(--s-hover); }
			.ask-alaiy-composer textarea {
				flex: 1; border: none !important; outline: none; resize: none; background: transparent !important;
				font-family: var(--s-font); font-size: 15px; line-height: 1.5; color: var(--s-ink);
				max-height: 200px; padding: 6px 0 !important; min-height: auto !important; box-shadow: none !important;
			}
			.ask-alaiy-send {
				flex: none; width: 36px; height: 36px; border-radius: 50% !important;
				padding: 0 !important; display: flex; align-items: center; justify-content: center;
				transition: transform .12s ease, opacity .12s ease;
			}
			.ask-alaiy-send:disabled { opacity: .35; }
			.ask-alaiy-send:not(:disabled):hover { transform: scale(1.06); }
			.ask-alaiy-hint {
				margin: 7px 4px 0; font-size: 11.5px; color: var(--s-muted); text-align: center;
			}
			.ask-alaiy-attach {
				flex: none; width: 36px; height: 36px; border-radius: 50%; border: none;
				background: none; cursor: pointer; color: var(--s-muted);
				display: flex; align-items: center; justify-content: center;
				transition: background .12s, color .12s;
			}
			.ask-alaiy-attach:hover { background: var(--s-hover); color: var(--s-ink); }
			.ask-alaiy-attach:disabled { opacity: .35; cursor: default; background: none; }
			.ask-alaiy-file-input { display: none; }

			/* ── Pickers ─────────────────────────────────────────────────────
			   Both open above the composer — "/" for skills, "@" for data
			   points. Positioned relative to the wrap so they float over the
			   thread instead of pushing the composer down: the input must not
			   move while the user is typing into it.

			   One shared rule rather than two, because they occupy the same slot
			   and only ever one is open at a time (see _sync_mentions) — two
			   copies would be two things to keep in step. */
			.ask-alaiy-composer-wrap { position: relative; }
			.ask-alaiy-skills, .ask-alaiy-mentions {
				position: absolute; left: 28px; right: 28px; bottom: 100%;
				margin-bottom: 8px; z-index: 5; overflow: hidden auto; max-height: 260px;
				background: var(--s-white);
				border: var(--s-border-width) var(--s-border-style) var(--s-border);
				border-radius: var(--s-radius-lg); box-shadow: var(--shadow-md);
			}
			.ask-alaiy-skill {
				display: block; width: 100%; text-align: start; border: none; background: none;
				cursor: pointer; padding: 9px 14px; font-family: var(--s-font); color: var(--s-ink);
				border-bottom: var(--s-border-width) var(--s-border-style) var(--s-border);
			}
			.ask-alaiy-skill:last-child { border-bottom: none; }
			.ask-alaiy-skill.is-active, .ask-alaiy-skill:hover { background: var(--s-hover); }
			.ask-alaiy-skill-slug { font-size: 13.5px; font-weight: 600; }
			.ask-alaiy-skill-label { font-size: 13.5px; color: var(--s-muted); margin-inline-start: 8px; }
			.ask-alaiy-skill-desc {
				display: block; font-size: 11.5px; color: var(--s-muted); margin-top: 2px;
				overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
			}
			.ask-alaiy-skills-empty { padding: 10px 14px; font-size: 12.5px; color: var(--s-muted); }

			/* ── Mention picker ──────────────────────────────────────────────
			   Grouped, because "@ro" legitimately matches a brand and a SKU at
			   once and which one was meant is the whole question. Headings stick
			   so the group a row belongs to stays on screen while scrolling. */
			.ask-alaiy-mention-group {
				position: sticky; top: 0; z-index: 1; background: var(--s-white);
				padding: 8px 14px 3px; font-family: var(--s-font); font-size: 11px;
				font-weight: var(--s-medium-weight); text-transform: uppercase;
				letter-spacing: var(--s-heading-tracking); color: var(--s-muted);
			}
			.ask-alaiy-mention {
				display: flex; align-items: center; gap: 9px; width: 100%; text-align: start;
				border: none; background: none; cursor: pointer; padding: 8px 14px;
				font-family: var(--s-font); color: var(--s-ink);
			}
			.ask-alaiy-mention.is-active, .ask-alaiy-mention:hover { background: var(--s-hover); }
			.ask-alaiy-mention-icon { flex: none; display: flex; color: var(--s-muted); }
			.ask-alaiy-mention-text { min-width: 0; }
			.ask-alaiy-mention-label {
				display: block; font-size: 13.5px; font-weight: 600;
				overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
			}
			.ask-alaiy-mention-sub {
				display: block; font-size: 11.5px; color: var(--s-muted); margin-top: 1px;
				overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
			}
			.ask-alaiy-mentions-empty { padding: 10px 14px; font-size: 12.5px; color: var(--s-muted); }

			/* A sent mention, inside the user's own bubble. Quiet on purpose: it
			   marks which words the assistant was given as a record, and the
			   sentence still has to read as a sentence.

			   Weight and an underline rather than a background: the bubble is
			   --s-black with --s-on-black text, so any panel colour would be a
			   high-contrast block sitting in the middle of a sentence. currentColor
			   is also the one "palette" that cannot be wrong in a theme we have
			   not seen. */
			.ask-alaiy-chip-mention {
				font-weight: var(--s-medium-weight);
				text-decoration: underline; text-decoration-style: dotted;
				text-underline-offset: 2px;
			}

			/* ── Attachment chips ────────────────────────────────────────────
			   The tray sits above the composer while files are staged; the same
			   chip markup is reused inside a sent message, where it is inert. */
			.ask-alaiy-tray {
				display: flex; flex-wrap: wrap; gap: 7px; margin: 0 0 8px;
			}
			.ask-alaiy-tray:empty { display: none; }
			.ask-alaiy-file {
				display: inline-flex; align-items: center; gap: 7px; max-width: 260px;
				padding: 6px 9px; background: var(--s-cream);
				border: var(--s-border-width) var(--s-border-style) var(--s-border);
				border-radius: var(--s-radius-sm);
				font-family: var(--s-font); font-size: 12.5px; color: var(--s-ink);
			}
			.ask-alaiy-file-icon { flex: none; display: flex; color: var(--s-muted); }
			.ask-alaiy-file-text { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
			.ask-alaiy-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
			.ask-alaiy-file-meta { font-size: 11px; color: var(--s-muted); }
			.ask-alaiy-file.is-error {
				border-color: var(--s-red); color: var(--s-red); background: var(--s-white);
			}
			.ask-alaiy-file.is-error .ask-alaiy-file-icon,
			.ask-alaiy-file.is-error .ask-alaiy-file-meta { color: var(--s-red); }
			.ask-alaiy-file-remove {
				flex: none; border: none; background: none; cursor: pointer; padding: 2px;
				border-radius: var(--s-radius-sm); color: var(--s-muted); display: flex;
			}
			.ask-alaiy-file-remove:hover { background: var(--s-hover); color: var(--s-ink); }
			/* Spinner shares the icon slot, so a chip does not resize when it lands. */
			.ask-alaiy-file-spinner {
				flex: none; width: 14px; height: 14px; border-radius: 50%;
				border: 1.9px solid var(--s-border); border-top-color: var(--s-black);
				animation: ask-alaiy-spin .7s linear infinite;
			}
			@keyframes ask-alaiy-spin { to { transform: rotate(360deg); } }

			/* Chips attached to a sent message, above the user's bubble. */
			.ask-alaiy-turn.is-user .ask-alaiy-tray { justify-content: flex-end; margin-bottom: 6px; }
			.ask-alaiy-turn.is-user .ask-alaiy-file { background: var(--s-white); }
			.ask-alaiy-file-link { color: inherit; text-decoration: none; }
			.ask-alaiy-file-link:hover .ask-alaiy-file-name { text-decoration: underline; }

			/* Drag-and-drop target: the whole thread, so the user does not have
			   to hit the small paperclip. */
			.ask-alaiy-main.is-dropping .ask-alaiy-scroll {
				outline: 2px dashed var(--s-black); outline-offset: -10px;
				border-radius: var(--s-radius-lg);
			}

			@media (max-width: 900px) {
				.ask-alaiy-rail { display: none; }
				.ask-alaiy-thread, .ask-alaiy-composer-wrap { padding-inline: 16px; }
			}
			@media (prefers-reduced-motion: reduce) {
				.ask-alaiy-scroll { scroll-behavior: auto; }
				.ask-alaiy-typing span, .ask-alaiy-working::before, .ask-alaiy-row-live { animation: none; }
			}
		`;
		document.head.appendChild(style);
	}

	_icon(name) {
		const paths = {
			search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
			trash: '<path d="M4 6h16"/><path d="M9 6V4h6v2"/><path d="M7 6l1 14h8l1-14"/>',
			send: '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
			caret: '<path d="M9 6l6 6-6 6"/>',
			spark: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
			warn: '<path d="M12 3l9 16H3z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
			paperclip:
				'<path d="M21 11.5l-8.8 8.8a5 5 0 01-7.1-7.1l9-9a3.3 3.3 0 014.7 4.7l-9 9a1.7 1.7 0 01-2.4-2.4l8.3-8.3"/>',
			file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>',
			close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
			// Mention kinds. A mention source picks one of these by name; an
			// unrecognised name draws nothing rather than breaking the row, so a
			// deployment can add a kind without needing a path here first.
			at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 006 0v-1a9 9 0 10-3.5 7.1"/>',
			tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-7-7V4h9.6l7.4 7.4a1.4 1.4 0 010 2z"/><path d="M7.5 7.5h.01"/>',
			box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
			store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
			calendar:
				'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
		};
		return (
			`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ` +
			`stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ""}</svg>`
		);
	}

	_render() {
		$(this.page.body).empty();

		this.$shell = $(`
			<div class="ask-alaiy-shell">
				<aside class="ask-alaiy-rail">
					<div class="ask-alaiy-rail-head">
						<div class="ask-alaiy-search">
							${this._icon("search")}
							<input type="search" placeholder="${__("Search chats")}" aria-label="${__("Search chats")}">
						</div>
					</div>
					<nav class="ask-alaiy-list" aria-label="${__("Chat history")}"></nav>
				</aside>

				<div class="ask-alaiy-main">
					<div class="ask-alaiy-scroll">
						<div class="ask-alaiy-thread"></div>
					</div>
					<div class="ask-alaiy-composer-wrap">
						<div class="ask-alaiy-skills" role="listbox" aria-label="${__("Skills")}" hidden></div>
						<div class="ask-alaiy-mentions" role="listbox" aria-label="${__(
							"Data points",
						)}" hidden></div>
						<div class="ask-alaiy-tray" aria-live="polite"></div>
						<div class="ask-alaiy-composer">
							<button type="button" class="ask-alaiy-attach"
								aria-label="${__("Attach a file")}" title="${__(
									"Attach a PDF, spreadsheet, CSV or text file",
								)}">${this._icon("paperclip")}</button>
							<textarea rows="1" placeholder="${__("Ask about stock, orders, listings…")}"
								aria-label="${__("Message Alaiy")}"></textarea>
							<button type="button" class="btn btn-primary ask-alaiy-send"
								aria-label="${__("Send")}" disabled>${this._icon("send")}</button>
						</div>
						<input type="file" class="ask-alaiy-file-input" multiple
							accept="${ACCEPT_ATTRIBUTE}" aria-hidden="true" tabindex="-1">
						<p class="ask-alaiy-hint">${__("Alaiy reads live business data. Check anything it changes.")}</p>
					</div>
				</div>
			</div>
		`).appendTo(this.page.body);

		this.$rail = this.$shell.find(".ask-alaiy-list");
		this.$search = this.$shell.find(".ask-alaiy-search input");
		this.$scroll = this.$shell.find(".ask-alaiy-scroll");
		this.$thread = this.$shell.find(".ask-alaiy-thread");
		this.$input = this.$shell.find(".ask-alaiy-composer textarea");
		this.$send = this.$shell.find(".ask-alaiy-send");
		this.$tray = this.$shell.find(".ask-alaiy-composer-wrap .ask-alaiy-tray");
		this.$attach = this.$shell.find(".ask-alaiy-attach");
		this.$file_input = this.$shell.find(".ask-alaiy-file-input");
		this.$skills = this.$shell.find(".ask-alaiy-skills");
		this.$mentions = this.$shell.find(".ask-alaiy-mentions");

		this._show_welcome();
	}

	_bind() {
		const $composer = this.$shell.find(".ask-alaiy-composer");
		const $searchBox = this.$shell.find(".ask-alaiy-search");

		// Kept on the instance as well: `_apply_mention` needs to resize without
		// firing `input`, which would re-open the picker it just closed.
		const autoGrow = () => {
			this.$input.css("height", "auto");
			this.$input.css("height", Math.min(this.$input[0].scrollHeight, 200) + "px");
		};
		this._autogrow = autoGrow;

		this.$input.on("input", () => {
			this._sync_send();
			this._sync_skills();
			this._sync_mentions();
			autoGrow();
		});
		// A mention is matched against the caret, not the end of the value, so
		// moving the caret changes the answer — and neither an arrow key nor a
		// click fires `input`. The `/` picker never needed this because a slash
		// command is the whole message.
		this.$input.on("keyup", (e) => {
			if (CARET_KEYS.includes(e.key)) this._sync_mentions();
		});
		this.$input.on("click", () => this._sync_mentions());
		this.$input.on("focus", () => $composer.addClass("is-focused"));
		this.$input.on("blur", () => {
			$composer.removeClass("is-focused");
			// A click on a picker row blurs the textarea before it fires, so the
			// pickers cannot close synchronously or the mousedown lands on nothing.
			setTimeout(() => {
				this._close_skills();
				this._close_mentions();
			}, 150);
		});
		this.$input.on("keydown", (e) => {
			// Whichever picker is open owns the arrow keys and Enter — the same
			// bargain every command palette makes. Mentions get first refusal
			// only because they are the one that can be open mid-sentence; the
			// two are mutually exclusive, so the order is a formality.
			if (this._mentions_open() && this._mention_keydown(e)) return;
			if (this._skills_open() && this._skill_keydown(e)) return;
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this._submit();
			}
		});
		this.$send.on("click", () => this._submit());

		// ── Attachments ────────────────────────────────────────────────────
		this.$attach.on("click", () => this.$file_input.trigger("click"));
		this.$file_input.on("change", (e) => {
			this._upload_files(e.target.files);
			// Reset, or picking the same file twice in a row fires no change.
			e.target.value = "";
		});

		this.$input.on("paste", (e) => {
			const files = (e.originalEvent.clipboardData || {}).files;
			if (files && files.length) {
				// Pasted a file, not text — let it become an attachment rather
				// than dumping a filename into the textarea.
				e.preventDefault();
				this._upload_files(files);
			}
		});

		// Drop anywhere on the conversation. dragenter/dragleave fire for every
		// child element, so the counter is what keeps the outline from
		// flickering as the pointer crosses message boundaries.
		const $main = this.$shell.find(".ask-alaiy-main");
		let drag_depth = 0;
		const has_files = (e) =>
			Array.from(e.originalEvent.dataTransfer.types || []).includes("Files");

		$main.on("dragenter dragover", (e) => {
			if (!has_files(e)) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.type === "dragenter" && drag_depth++ === 0) $main.addClass("is-dropping");
		});
		$main.on("dragleave", (e) => {
			if (!has_files(e)) return;
			if (--drag_depth <= 0) {
				drag_depth = 0;
				$main.removeClass("is-dropping");
			}
		});
		$main.on("drop", (e) => {
			if (!has_files(e)) return;
			e.preventDefault();
			e.stopPropagation();
			drag_depth = 0;
			$main.removeClass("is-dropping");
			this._upload_files(e.originalEvent.dataTransfer.files);
		});

		this.$search.on("focus", () => $searchBox.addClass("is-focused"));
		this.$search.on("blur", () => $searchBox.removeClass("is-focused"));
		this.$search.on("input", () => {
			this.query = (this.$search.val() || "").trim().toLowerCase();
			this._draw_sessions();
		});

		$(window).on("resize.askalaiy", frappe.utils.debounce(() => this._fit(), 120));
		setTimeout(() => this.$input.focus(), 200);
	}

	_submit() {
		const text = (this.$input.val() || "").trim();
		if (!this._can_send()) return;
		// Typing a slug in full and pressing Enter should run the skill, whether
		// or not the picker was still showing — otherwise "/daily-digest" is
		// sent to the model as a line of prose it can do nothing with.
		const skill = this._exact_skill(text);
		// Read before the textarea is cleared — reconciliation needs the text the
		// user actually sent, not an empty box.
		const mentions = this._collect_mentions(text);
		this.$input.val("").trigger("input").focus();
		this.mentions = [];
		this._close_skills();
		this._close_mentions();
		this._send(text, skill, mentions);
	}

	// ── Skill picker ────────────────────────────────────────────────────────
	/** The partial slug being typed, or null when this is not a `/` command.
	 *
	 * Only a message that is *entirely* a slash command counts. A slash inside
	 * a sentence ("check 24/7 coverage") is text, and a slug that already has a
	 * space after it is a sentence too — skills take no arguments, so there is
	 * nothing to complete past that point. */
	_skill_query() {
		const value = this.$input.val() || "";
		const match = /^\/([a-z0-9-]*)$/.exec(value.trimStart());
		return match ? match[1] : null;
	}

	_exact_skill(text) {
		const slug = /^\/([a-z0-9-]+)$/.exec(text);
		if (!slug || !this.skills) return null;
		return this.skills.some((s) => s.slug === slug[1]) ? slug[1] : null;
	}

	_skills_open() {
		return !this.$skills.prop("hidden");
	}

	async _sync_skills() {
		const query = this._skill_query();
		if (query === null) return this._close_skills();

		if (this.skills === null) {
			// One fetch per page load. A failure is not worth an error banner —
			// the user can still type their question — so it degrades to "this
			// site has no skills" and will not be retried in a tight loop.
			try {
				this.skills = await frappe.xcall("alaiy_os.api.chat.list_skills");
			} catch (e) {
				this.skills = [];
			}
			// The user may have typed on past the slash while that was in flight.
			if (this._skill_query() === null) return this._close_skills();
		}

		this.skill_matches = this.skills.filter(
			(s) => s.slug.includes(query) || (s.label || "").toLowerCase().includes(query),
		);
		this.skill_index = 0;
		this._draw_skills();
	}

	_draw_skills() {
		this.$skills.empty().prop("hidden", false);

		if (!this.skill_matches.length) {
			this.$skills.append(
				$('<div class="ask-alaiy-skills-empty"></div>').text(
					this.skills.length ? __("No matching skill.") : __("No skills are set up on this site."),
				),
			);
			return;
		}

		this.skill_matches.forEach((skill, i) => {
			const $row = $('<button type="button" class="ask-alaiy-skill" role="option"></button>')
				.toggleClass("is-active", i === this.skill_index)
				.appendTo(this.$skills);
			$('<span class="ask-alaiy-skill-slug"></span>').text("/" + skill.slug).appendTo($row);
			$('<span class="ask-alaiy-skill-label"></span>').text(skill.label || "").appendTo($row);
			if (skill.description) {
				$('<span class="ask-alaiy-skill-desc"></span>').text(skill.description).appendTo($row);
			}
			// mousedown, not click: the textarea's blur fires first on click and
			// would have closed the picker out from under the pointer.
			$row.on("mousedown", (e) => {
				e.preventDefault();
				this._run_skill(skill);
			});
		});
	}

	_skill_keydown(e) {
		const last = this.skill_matches.length - 1;
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			if (last < 0) return true;
			const step = e.key === "ArrowDown" ? 1 : -1;
			this.skill_index = (this.skill_index + step + this.skill_matches.length) % this.skill_matches.length;
			this._draw_skills();
			return true;
		}
		if (e.key === "Escape") {
			e.preventDefault();
			this._close_skills();
			return true;
		}
		if (e.key === "Enter" || e.key === "Tab") {
			const chosen = this.skill_matches[this.skill_index];
			if (!chosen) return false;
			e.preventDefault();
			this._run_skill(chosen);
			return true;
		}
		return false;
	}

	_run_skill(skill) {
		this._close_skills();
		this._close_mentions();
		if (this.running) return;
		this.$input.val("").trigger("input").focus();
		this._send("/" + skill.slug, skill.slug);
	}

	_close_skills() {
		this.$skills.empty().prop("hidden", true);
		this.skill_matches = [];
		this.skill_index = 0;
	}

	// ── Mention picker ──────────────────────────────────────────────────────
	/** The `@` token under the caret: `{term, start, end}`, or null.
	 *
	 * An object rather than a string, because unlike a skill slug the empty
	 * term is meaningful — a bare `@` is a request for the whole menu — and the
	 * span has to come back too, so selecting a row can replace exactly the
	 * token that was typed and leave the rest of the sentence alone. */
	_mention_query() {
		const el = this.$input[0];
		const caret = el.selectionStart;
		// A selection rather than a caret: the user is about to replace text,
		// not extend a token.
		if (caret !== el.selectionEnd) return null;
		const match = MENTION_RE.exec((el.value || "").slice(0, caret));
		if (!match) return null;
		return {
			term: match[1] || "",
			start: match.index + match[0].indexOf("@"),
			end: caret,
		};
	}

	_mentions_open() {
		return !this.$mentions.prop("hidden");
	}

	async _sync_mentions_now() {
		const query = this._mention_query();
		// The two pickers share one slot above the composer. A `/` command wins:
		// it is the whole message, so there is no mention to be typing.
		if (!query || this._skill_query() !== null) return this._close_mentions();

		let groups = this.mention_cache.get(query.term);
		if (!groups) {
			const req = ++this.mention_req;
			try {
				const data = await frappe.xcall("alaiy_os.api.chat.list_mentions", {
					q: query.term,
				});
				groups = data.groups || [];
				this.mention_cache.set(query.term, groups);
			} catch (e) {
				// Same bargain as the skill catalogue: the user can still type
				// their question, so this is not worth an error banner. Not
				// cached either — the next keystroke retries.
				groups = [];
			}
			// A slower response for an earlier query, or the user typed past the
			// mention while this was in flight.
			if (req !== this.mention_req) return;
			const now = this._mention_query();
			if (!now || now.term !== query.term) return;
		}

		this.mention_options = groups.reduce((all, g) => all.concat(g.options || []), []);
		this.mention_index = 0;

		// Multi-word terms are allowed so "Royal Canin" keeps matching, which
		// means ordinary prose after a mention also keeps matching. Nothing found
		// and a space in the term is the signal that the user has moved on from
		// picking and is just writing — so get out of their way.
		if (!this.mention_options.length && query.term.includes(" ")) {
			return this._close_mentions();
		}

		this._draw_mentions(groups, query.term);
	}

	_draw_mentions(groups, term) {
		// Kept so moving the selection can redraw without re-querying.
		this.mention_groups = groups;
		this.mention_term = term;
		this.$mentions.empty().prop("hidden", false);

		if (!this.mention_options.length) {
			// Which of the two empty states this is matters: "keep typing" and
			// "there is nothing here" ask for opposite things from the user.
			const waiting = groups.some((g) => term.length < (g.min_chars || 0));
			this.$mentions.append(
				$('<div class="ask-alaiy-mentions-empty"></div>').text(
					groups.length === 0
						? __("Nothing can be mentioned on this site yet.")
						: waiting
							? __("Keep typing to search brands and items.")
							: __("Nothing matches."),
				),
			);
			return;
		}

		// The flat index the arrow keys walk, counted across groups — headings
		// are not selectable, so it is not the same as a row's position here.
		let flat = 0;
		groups.forEach((group) => {
			const options = group.options || [];
			if (!options.length) return;
			$('<div class="ask-alaiy-mention-group"></div>')
				.text(group.label || group.kind)
				.appendTo(this.$mentions);

			options.forEach((option) => {
				const index = flat++;
				const $row = $('<button type="button" class="ask-alaiy-mention" role="option"></button>')
					.toggleClass("is-active", index === this.mention_index)
					.appendTo(this.$mentions);
				$(`<span class="ask-alaiy-mention-icon">${this._icon(option.icon)}</span>`).appendTo($row);
				const $text = $('<span class="ask-alaiy-mention-text"></span>').appendTo($row);
				$('<span class="ask-alaiy-mention-label"></span>').text(option.label).appendTo($text);
				if (option.sublabel) {
					$('<span class="ask-alaiy-mention-sub"></span>').text(option.sublabel).appendTo($text);
				}
				// mousedown, not click: the textarea's blur fires first on click
				// and would have closed the picker out from under the pointer.
				$row.on("mousedown", (e) => {
					e.preventDefault();
					this._apply_mention(option);
				});
			});
		});

		// Arrowing down a long list must not leave the selection off-screen.
		const $active = this.$mentions.find(".is-active")[0];
		if ($active) $active.scrollIntoView({ block: "nearest" });
	}

	_mention_keydown(e) {
		const count = this.mention_options.length;
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			if (!count) return true;
			const step = e.key === "ArrowDown" ? 1 : -1;
			this.mention_index = (this.mention_index + step + count) % count;
			// Redraws what is already on screen — moving the selection is not a
			// reason to ask the server anything.
			this._draw_mentions(this.mention_groups, this.mention_term);
			return true;
		}
		if (e.key === "Escape") {
			e.preventDefault();
			this._close_mentions();
			return true;
		}
		if (e.key === "Enter" || e.key === "Tab") {
			const chosen = this.mention_options[this.mention_index];
			if (!chosen) return false;
			e.preventDefault();
			this._apply_mention(chosen);
			return true;
		}
		return false;
	}

	/** Replace the typed token with the chosen record's label, and remember what
	 * it stands for. */
	_apply_mention(option) {
		const query = this._mention_query();
		this._close_mentions();
		if (!query) return;

		const el = this.$input[0];
		const value = el.value;
		const token = "@" + option.label;
		const tail = value.slice(query.end);
		// A space after the token, so the next character does not re-open the
		// picker — unless the sentence already continues with one, which is the
		// mid-sentence case and would otherwise gain a double space.
		const gap = /^\s/.test(tail) ? "" : " ";
		// Splice [start, end) — `end` is the caret, not the end of the value, so
		// completing in the middle of a sentence leaves the tail intact.
		el.value = value.slice(0, query.start) + token + gap + tail;
		const caret = query.start + token.length + gap.length;
		el.setSelectionRange(caret, caret);

		this.mentions.push({ kind: option.kind, value: option.value, token: token });

		// Deliberately NOT `.trigger("input")`. The token now ends in a space, and
		// the trigger regex tolerates trailing spaces so that multi-word names
		// keep matching as they are typed — which means an input event here would
		// re-open the picker on "Royal Canin " the instant it was chosen. So do
		// the two things the input handler would have done, and nothing else.
		this._sync_send();
		this._autogrow();
		this.$input.focus();
	}

	_close_mentions() {
		this.$mentions.empty().prop("hidden", true);
		this.mention_options = [];
		this.mention_index = 0;
	}

	/** The mentions still genuinely present in the message being sent.
	 *
	 * The composer is a plain textarea, so a token has no identity of its own —
	 * the visible words and the record behind them are two parallel records that
	 * the user can pull apart by editing. Rather than track offsets through every
	 * keystroke, reconcile once here: a token the user broke stops being a
	 * mention and goes on as the prose it already looks like. The model still
	 * reads the words either way; only the resolved record is lost.
	 *
	 * Deduplicated on kind+value, so mentioning the same brand twice sends it
	 * once. Two different records that render to the same label are genuinely
	 * indistinguishable in plain text and collapse — the cost of not using a
	 * contenteditable, which would buy that back at the price of breaking
	 * `.val()`, the auto-grow measurement and the paste handler. */
	_collect_mentions(text) {
		const seen = new Set();
		return this.mentions.filter((m) => {
			const key = m.kind + " " + m.value;
			if (seen.has(key) || !text.includes(m.token)) return false;
			seen.add(key);
			return true;
		});
	}

	/** The user's own text with its mention tokens marked.
	 *
	 * Escape first, then add our markup — never the other way round. The tokens
	 * come from record labels, which are data. */
	_mention_html(text, mentions) {
		let html = frappe.utils.escape_html(text);
		(mentions || []).forEach((m) => {
			const token = frappe.utils.escape_html(m.token);
			html = html.split(token).join(`<span class="ask-alaiy-chip-mention">${token}</span>`);
		});
		return html;
	}

	/** Ready to send: not mid-turn, and there is either something typed or at
	 * least one attachment that finished uploading. A file on its own is a
	 * legitimate message — "what do you make of this?" is implied. */
	_can_send() {
		if (this.running) return false;
		if ((this.$input.val() || "").trim()) return true;
		return this._ready_attachments().length > 0;
	}

	_ready_attachments() {
		return Array.from(this.pending.values()).filter((a) => a.name);
	}

	_sync_send() {
		this.$send.prop("disabled", !this._can_send());
	}

	// ── Attachments ─────────────────────────────────────────────────────────
	/** The session id, creating the session if this is the first thing to
	 * happen in it. Attaching a file needs somewhere to put it, so a chat that
	 * starts with an upload rather than a message has to be created here. */
	async _ensure_session() {
		if (!this.session) {
			const created = await frappe.xcall("alaiy_os.api.chat.create_session");
			this.session = created.session;
		}
		return this.session;
	}

	/** Upload each picked file independently, so one rejection does not lose
	 * the others and each chip carries its own progress and error. */
	async _upload_files(files) {
		const picked = Array.from(files || []);
		if (!picked.length || this.running) return;

		const room = MAX_ATTACHMENTS - this.pending.size;
		if (room <= 0) {
			frappe.show_alert({
				message: __("You can attach up to {0} files to one message.", [MAX_ATTACHMENTS]),
				indicator: "orange",
			});
			return;
		}
		if (picked.length > room) {
			frappe.show_alert({
				message: __("Only the first {0} files were attached — the limit is {1} per message.", [
					room,
					MAX_ATTACHMENTS,
				]),
				indicator: "orange",
			});
		}

		let session;
		try {
			session = await this._ensure_session();
		} catch (e) {
			this._show_error(this._error_text(e, __("Could not start a chat for this file.")));
			return;
		}

		picked.slice(0, room).forEach((file) => this._upload_one(session, file));
	}

	async _upload_one(session, file) {
		const id = `up-${++this.upload_seq}`;
		this.pending.set(id, { id, file_name: file.name, file_size: file.size, uploading: true });
		this._draw_tray();

		try {
			const body = new FormData();
			body.append("file", file);

			// Not frappe.xcall: this is multipart, and xcall serialises to form
			// fields. The CSRF token has to be sent by hand for the same reason.
			const response = await fetch(
				`/api/method/alaiy_os.api.chat.upload_attachment?session=${encodeURIComponent(session)}`,
				{
					method: "POST",
					headers: { "X-Frappe-CSRF-Token": frappe.csrf_token },
					credentials: "same-origin",
					body: body,
				},
			);
			const payload = await response.json();
			if (!response.ok) throw payload;

			// A chat opened while this was in flight — the file belongs to a
			// session no longer on screen.
			if (this.session !== session || !this.pending.has(id)) return;

			this.pending.set(id, { id, uploading: false, ...payload.message });
		} catch (e) {
			if (this.session !== session || !this.pending.has(id)) return;
			this.pending.set(id, {
				id,
				file_name: file.name,
				file_size: file.size,
				uploading: false,
				error: this._upload_error(e),
			});
		}

		this._draw_tray();
	}

	/** Frappe reports a thrown message in _server_messages, as a JSON array of
	 * JSON strings. Anything else is a network or gateway failure. */
	_upload_error(e) {
		try {
			const messages = JSON.parse(e._server_messages || "[]");
			const first = JSON.parse(messages[0]);
			// frappe.throw wraps the message in markup. It is rendered into a
			// chip with .text(), so strip the tags rather than trusting them.
			const plain = (first.message || "").replace(/<[^>]*>/g, "").trim();
			if (plain) return plain;
		} catch (_) {
			// Not a Frappe error payload — fall through.
		}
		return (e && e.message) || __("Upload failed.");
	}

	async _remove_attachment(id) {
		const entry = this.pending.get(id);
		this.pending.delete(id);
		this._draw_tray();

		// A failed upload never produced a row, and one still in flight will
		// find itself dropped when it lands (see the guards in _upload_one).
		if (entry && entry.name) {
			try {
				await frappe.xcall("alaiy_os.api.chat.delete_attachment", { attachment: entry.name });
			} catch (e) {
				// The chip is already gone and the file is unreferenced; the
				// session's own delete will collect it. Not worth interrupting.
			}
		}
	}

	_draw_tray() {
		this.$tray.empty();
		this.pending.forEach((entry) => {
			this.$tray.append(
				this._file_chip(entry, {
					onRemove: () => this._remove_attachment(entry.id),
				}),
			);
		});
		this.$attach.prop("disabled", this.running || this.pending.size >= MAX_ATTACHMENTS);
		this._sync_send();
	}

	/** One file, as a chip. Used both in the composer tray (removable, may be
	 * mid-upload or failed) and above a sent message (inert, links to the
	 * stored file). */
	_file_chip(entry, options) {
		const opts = options || {};
		const $chip = $('<div class="ask-alaiy-file"></div>');
		if (entry.error) $chip.addClass("is-error");

		$chip.append(
			entry.uploading
				? '<div class="ask-alaiy-file-spinner" role="progressbar"></div>'
				: `<span class="ask-alaiy-file-icon">${this._icon("file")}</span>`,
		);

		const $text = $('<div class="ask-alaiy-file-text"></div>').appendTo($chip);
		$('<div class="ask-alaiy-file-name"></div>').text(entry.file_name || "").appendTo($text);
		$('<div class="ask-alaiy-file-meta"></div>')
			.text(this._file_meta(entry))
			.appendTo($text);

		if (entry.file_url && !opts.onRemove) {
			// Sent messages link to the stored file; it is private, so only the
			// people who can read the chat can open it.
			$text.wrap($('<a class="ask-alaiy-file-link" target="_blank" rel="noopener"></a>').attr("href", entry.file_url));
		}

		if (opts.onRemove) {
			$(`<button type="button" class="ask-alaiy-file-remove" aria-label="${__("Remove")}">
					${this._icon("close")}
				</button>`)
				.on("click", opts.onRemove)
				.appendTo($chip);
		}

		return $chip;
	}

	_file_meta(entry) {
		if (entry.error) return entry.error;
		if (entry.uploading) return __("Reading…");
		const size = frappe.form.formatters.FileSize(entry.file_size || 0);
		// Characters, not bytes, is what decides how much of the file the model
		// actually sees — a 4 MB PDF of scans and a 4 MB PDF of text are very
		// different inputs.
		return entry.chars ? `${size} · ${__("{0} characters read", [entry.chars])}` : size;
	}

	// ── Conversation ────────────────────────────────────────────────────────
	async _send(text, skill, mentions) {
		const attached = this._ready_attachments();

		this._clear_welcome();
		this._add(this._user_turn(text, attached, mentions));
		this.pending.clear();
		this._draw_tray();
		this._set_running(true);

		try {
			const session = await this._ensure_session();
			const sent = await frappe.xcall("alaiy_os.api.chat.send_message", {
				session: session,
				text: text,
				attachments: JSON.stringify(attached.map((a) => a.name)),
				// Only kind and value are read server-side; the label and any
				// dates are rebuilt there, so what is sent is a reference and
				// not a claim about what the record says.
				mentions: JSON.stringify(mentions || []),
				skill: skill || null,
				// This page IS the assistant, so there is no other screen to
				// report. A host embedding the panel alongside a list view would
				// pass its own route here.
				screen: "ask-alaiy",
			});
			// Skip past our own message: it is already on screen.
			this.last_seq = sent.seq;
			this._schedule_poll();
		} catch (e) {
			this._set_running(false);
			this._show_error(this._error_text(e, __("Could not send the message.")));
		}
	}

	_schedule_poll() {
		this._stop_poll();
		this.poll_timer = setTimeout(() => this._poll(), POLL_INTERVAL_MS);
	}

	async _poll() {
		const session = this.session;
		try {
			const data = await frappe.xcall("alaiy_os.api.chat.get_messages", {
				session: session,
				after: this.last_seq,
			});
			// A different chat was opened while this was in flight — the answer
			// belongs to a conversation no longer on screen.
			if (session !== this.session) return;

			(data.messages || []).forEach((message) => {
				this.last_seq = message.seq;
				this._draw(message);
			});

			if (data.status === "Running") {
				this._schedule_poll();
				return;
			}

			this._set_running(false);
			if (data.status === "Failed") {
				// The stored error is a traceback; the last line is the part a
				// person can act on.
				const lines = (data.error || "").trim().split("\n");
				this._show_error(lines[lines.length - 1] || __("The assistant failed to reply."));
			}
			// The title is written server-side from the first message, so the
			// rail only has something worth showing once a turn has finished.
			this._load_sessions();
		} catch (e) {
			if (session !== this.session) return;
			this._set_running(false);
			this._show_error(this._error_text(e, __("Lost contact with the assistant.")));
		}
	}

	// ── Rendering ───────────────────────────────────────────────────────────
	_user_turn(text, attachments, mentions) {
		const $turn = $('<div class="ask-alaiy-turn is-user"></div>');

		const files = attachments || [];
		if (files.length) {
			const $tray = $('<div class="ask-alaiy-tray"></div>').appendTo($turn);
			files.forEach((file) => $tray.append(this._file_chip(file, {})));
		}
		// An attachment-only message has no bubble — the chips are the message.
		if (text) {
			// `.html`, not `.text`, so mention tokens can be marked — which is
			// why `_mention_html` escapes before adding any markup of its own.
			$turn.append(
				$('<div class="ask-alaiy-user-bubble"></div>').html(this._mention_html(text, mentions)),
			);
		}

		return $turn;
	}

	/** A tool round-trip is an assistant message of tool_use blocks followed by
	 * a user message of results. The results message has nothing to show, so it
	 * draws nothing rather than an empty bubble. */
	_draw(message) {
		if (message.role === "user") {
			// Replayed history (loading an old chat) reaches here; a message
			// just typed is already on screen. Tool-result messages have
			// neither text nor files and draw nothing.
			const files = message.attachments || [];
			// The stored mentions are what make a reopened chat look like the one
			// that was sent — the tokens are marked again from the record, not
			// re-guessed out of the text.
			if (message.text || files.length) {
				this._add(this._user_turn(message.text, files, message.mentions));
			}
			return;
		}

		const tools = message.tool_calls || [];
		if (!message.text && tools.length === 0) return;

		const $turn = $('<div class="ask-alaiy-turn"></div>');
		$(`<div class="ask-alaiy-mark">${this._icon("spark")}</div>`).appendTo($turn);
		const $body = $('<div class="ask-alaiy-body"></div>').appendTo($turn);

		if (tools.length) $body.append(this._trail(tools, new Set(message.tool_errors || [])));

		if (message.text) {
			// Model output is untrusted text: escape first, then apply our own
			// markup. Never the other way round.
			$body.append($('<div class="ask-alaiy-answer"></div>').html(this._markdown(message.text)));
			$body.append(this._copy_button(message.text));
		}

		this._add($turn);
	}

	_trail(tools, failed) {
		const $trail = $('<div class="ask-alaiy-trail"></div>');

		tools.forEach((call) => {
			const bad = failed.has(call.id);
			const args = Object.entries(call.input || {}).filter(([, v]) => v !== null && v !== "");

			const $step = $('<details class="ask-alaiy-step"></details>')
				.toggleClass("is-failed", bad)
				.toggleClass("has-args", args.length > 0)
				.appendTo($trail);

			const $summary = $("<summary></summary>").appendTo($step);
			// A `/skill` dispatch arrives as a tool call named "skill:<slug>"
			// (see chat/skills.py). Show it as the command the user typed rather
			// than as a tool they have never heard of.
			const name = String(call.name || "");
			$('<span class="ask-alaiy-step-name"></span>')
				.text(name.startsWith("skill:") ? "/" + name.slice(6) : name.replace(/_/g, " "))
				.appendTo($summary);
			if (bad) $summary.append(document.createTextNode(" · " + __("refused")));
			if (args.length) $summary.append(`<span class="ask-alaiy-step-caret">${this._icon("caret")}</span>`);

			if (args.length) {
				const $args = $('<dl class="ask-alaiy-args"></dl>').appendTo($step);
				args.forEach(([key, value]) => {
					$("<dt></dt>").text(key).appendTo($args);
					$("<dd></dd>")
						.text(typeof value === "string" ? value : JSON.stringify(value))
						.appendTo($args);
				});
			}
		});

		return $trail;
	}

	_copy_button(text) {
		const $wrap = $('<div class="ask-alaiy-tools"></div>');
		$('<button type="button" class="ask-alaiy-copy"></button>')
			.text(__("Copy"))
			.on("click", function () {
				navigator.clipboard.writeText(text);
				const $btn = $(this);
				$btn.text(__("Copied"));
				setTimeout(() => $btn.text(__("Copy")), 1400);
			})
			.appendTo($wrap);
		return $wrap;
	}

	/** Just enough markdown for what the assistant actually writes: headings,
	 * bold, inline code, fenced code, lists, quotes and tables. */
	_markdown(text) {
		const lines = String(text).split("\n");
		const out = [];
		let paragraph = [];
		let list = null;

		const flushParagraph = () => {
			if (paragraph.length) out.push(`<p>${this._inline(paragraph.join(" "))}</p>`);
			paragraph = [];
		};
		const flushList = () => {
			if (list) {
				out.push(
					`<${list.tag}>${list.items.map((item) => `<li>${this._inline(item)}</li>`).join("")}</${list.tag}>`,
				);
			}
			list = null;
		};
		const flush = () => {
			flushParagraph();
			flushList();
		};

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (!line.trim()) {
				flush();
				continue;
			}

			if (line.trimStart().startsWith("```")) {
				flush();
				const body = [];
				i++;
				while (i < lines.length && !lines[i].trimStart().startsWith("```")) body.push(lines[i++]);
				out.push(`<pre><code>${frappe.utils.escape_html(body.join("\n"))}</code></pre>`);
				continue;
			}

			// Table: a header row, a divider, then body rows.
			if (line.includes("|") && lines[i + 1] && /^\|?[\s:|-]*-[\s:|-]*$/.test(lines[i + 1])) {
				flush();
				const cells = (row) =>
					row
						.replace(/^\||\|$/g, "")
						.split("|")
						.map((cell) => cell.trim());
				const head = cells(line);
				i += 2;
				const body = [];
				while (i < lines.length && lines[i].includes("|") && lines[i].trim()) body.push(cells(lines[i++]));
				i--;
				out.push(
					'<div class="ask-alaiy-table-wrap"><table><thead><tr>' +
						head.map((cell) => `<th>${this._inline(cell)}</th>`).join("") +
						"</tr></thead><tbody>" +
						body
							.map((row) => `<tr>${row.map((cell) => `<td>${this._inline(cell)}</td>`).join("")}</tr>`)
							.join("") +
						"</tbody></table></div>",
				);
				continue;
			}

			const heading = /^#{1,4}\s+(.*)$/.exec(line);
			if (heading) {
				flush();
				out.push(`<h4>${this._inline(heading[1])}</h4>`);
				continue;
			}

			const quote = /^>\s?(.*)$/.exec(line);
			if (quote) {
				flush();
				out.push(`<blockquote>${this._inline(quote[1])}</blockquote>`);
				continue;
			}

			const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
			const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
			if (bullet || numbered) {
				flushParagraph();
				const tag = numbered ? "ol" : "ul";
				if (!list || list.tag !== tag) {
					flushList();
					list = { tag: tag, items: [] };
				}
				list.items.push((bullet || numbered)[1]);
				continue;
			}

			flushList();
			paragraph.push(line.trim());
		}

		flush();
		return out.join("");
	}

	/** Bold and inline code, applied to already-escaped text. */
	_inline(text) {
		return frappe.utils
			.escape_html(text)
			.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
			.replace(/`([^`]+)`/g, "<code>$1</code>");
	}

	// ── Thread state ────────────────────────────────────────────────────────
	_add($el) {
		const stick = this._near_bottom();
		const $typing = this.$thread.find(".ask-alaiy-typing-turn");
		if ($typing.length) $typing.before($el);
		else this.$thread.append($el);
		if (stick) this._scroll_to_end();
	}

	/** Only follow the tail if the reader is already there — yanking someone
	 * back down while they are reading earlier answers is worse than a missed
	 * scroll. */
	_near_bottom() {
		const el = this.$scroll[0];
		if (!el) return true;
		return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
	}

	_scroll_to_end() {
		const el = this.$scroll[0];
		if (el) el.scrollTop = el.scrollHeight;
	}

	_set_running(running) {
		this.running = running;
		this._sync_send();
		this.$attach.prop("disabled", running || this.pending.size >= MAX_ATTACHMENTS);
		this.$thread.find(".ask-alaiy-typing-turn").remove();
		if (running) {
			this.$thread.append(`
				<div class="ask-alaiy-turn ask-alaiy-typing-turn">
					<div class="ask-alaiy-mark">${this._icon("spark")}</div>
					<div class="ask-alaiy-typing"><span></span><span></span><span></span></div>
				</div>
			`);
			this._scroll_to_end();
		}
	}

	_show_error(text) {
		this._add(
			$('<div class="ask-alaiy-turn"></div>')
				.append(`<div class="ask-alaiy-mark">${this._icon("warn")}</div>`)
				.append($('<div class="ask-alaiy-error"></div>').text(text)),
		);
	}

	_error_text(e, fallback) {
		return (e && (e.message || e._server_messages)) || fallback;
	}

	_show_welcome() {
		const chips = [
			__("Which items are low on stock?"),
			__("How did sales go this month?"),
			__("Check the catalogue for missing prices and images"),
			__("Are any channel listings out of sync?"),
		];

		const $welcome = $(`
			<div class="ask-alaiy-welcome">
				<img class="ask-alaiy-welcome-icon" src="/assets/images/client-logo-square.png" alt="">
				<div class="ask-alaiy-welcome-title">${__("Ask Alaiy anything")}</div>
				<p class="ask-alaiy-welcome-sub">${__(
					"Answers about your inventory, orders and channels — read straight from your live data.",
				)}</p>
				<div class="ask-alaiy-chips"></div>
			</div>
		`);

		const $chips = $welcome.find(".ask-alaiy-chips");
		chips.forEach((label) => {
			$('<button type="button" class="ask-alaiy-chip"></button>')
				.text(label)
				.on("click", () => this._send(label))
				.appendTo($chips);
		});

		// The welcome sits above the thread and fills the scroll area, so an
		// empty chat is centred without the composer moving.
		this.$scroll.prepend($welcome);
		this.$welcome = $welcome;
		this.$scroll.css("display", "flex").css("flex-direction", "column");
	}

	_clear_welcome() {
		if (this.$welcome) {
			this.$welcome.remove();
			this.$welcome = null;
			this.$scroll.css("display", "block");
		}
	}

	// ── History rail ────────────────────────────────────────────────────────
	async _load_sessions() {
		try {
			this.sessions = await frappe.xcall("alaiy_os.api.chat.list_sessions", { limit: 50 });
		} catch (e) {
			this.sessions = [];
			this.rail_failed = true;
		}
		this._draw_sessions();
	}

	_draw_sessions() {
		this.$rail.empty();

		const matching = this.query
			? this.sessions.filter((s) => (s.title || "").toLowerCase().includes(this.query))
			: this.sessions;

		if (!matching.length) {
			const message = this.rail_failed
				? __("Could not load your chats.")
				: this.query
					? __("No chats match that.")
					: __("Your chats will appear here.");
			$('<p class="ask-alaiy-rail-empty"></p>').text(message).appendTo(this.$rail);
			return;
		}

		const today = new Date().setHours(0, 0, 0, 0);
		const groups = new Map();
		matching.forEach((session) => {
			// Floor both sides to midnight before comparing — raw instants file
			// yesterday afternoon as "Today", since it is under 24h old.
			const stamp = new Date(session.last_activity || session.modified).setHours(0, 0, 0, 0);
			const days = Math.round((today - stamp) / 86400000);
			const label =
				days < 1
					? __("Today")
					: days < 2
						? __("Yesterday")
						: days < 7
							? __("Previous 7 days")
							: days < 30
								? __("Previous 30 days")
								: __("Older");
			if (!groups.has(label)) groups.set(label, []);
			groups.get(label).push(session);
		});

		groups.forEach((rows, label) => {
			$('<div class="ask-alaiy-group"></div>').text(label).appendTo(this.$rail);
			rows.forEach((session) => this._session_row(session).appendTo(this.$rail));
		});
	}

	_session_row(session) {
		const $row = $('<div class="ask-alaiy-row"></div>').toggleClass(
			"is-active",
			session.name === this.session,
		);

		$('<button type="button" class="ask-alaiy-row-open"></button>')
			.text(session.title || __("New chat"))
			.attr("title", session.title || __("New chat"))
			.on("click", () => this._load(session.name))
			.appendTo($row);

		if (session.status === "Running") {
			$(`<span class="ask-alaiy-row-live" title="${__("Still answering")}"></span>`).appendTo($row);
		}

		$('<button type="button" class="ask-alaiy-row-del"></button>')
			.attr("aria-label", __("Delete chat"))
			.html(this._icon("trash"))
			.on("click", (e) => {
				e.stopPropagation();
				this._confirm_delete(session);
			})
			.appendTo($row);

		return $row;
	}

	_confirm_delete(session) {
		frappe.confirm(
			__("Delete {0}? Every message in it goes too, and this cannot be undone.", [
				`<b>${frappe.utils.escape_html(session.title || __("this chat"))}</b>`,
			]),
			async () => {
				try {
					await frappe.xcall("alaiy_os.api.chat.delete_session", { session: session.name });
				} catch (e) {
					frappe.show_alert({ message: __("Could not delete that chat."), indicator: "red" });
					return;
				}
				if (this.session === session.name) this._reset();
				this._load_sessions();
			},
		);
	}

	async _load(name) {
		if (this.session === name) return;
		this._reset({ keep_rail: true });
		this.session = name;
		this._clear_welcome();
		this._draw_sessions(); // move the active highlight straight away

		try {
			const data = await frappe.xcall("alaiy_os.api.chat.get_messages", { session: name, after: 0 });
			if (this.session !== name) return;

			(data.messages || []).forEach((message) => {
				this.last_seq = message.seq;
				this._draw(message);
			});
			this._scroll_to_end();

			// It may still be mid-turn — started in another tab, or before a reload.
			if (data.status === "Running") {
				this._set_running(true);
				this._schedule_poll();
			}
		} catch (e) {
			this._show_error(this._error_text(e, __("Could not open that chat.")));
		}
	}

	_reset(options) {
		this._stop_poll();
		// Dropping the id is enough: the session and its messages stay in the
		// database, this page just stops following them.
		this.session = null;
		this.last_seq = 0;
		// Staged uploads belong to the session being left behind. Dropping them
		// from the tray is enough — they are attached to that session and go
		// with it if it is ever deleted.
		this.pending.clear();
		this._draw_tray();
		// Whatever was half-composed belongs to the chat being left. The query
		// cache is kept: it is a catalogue, not conversation state, and survives
		// for the life of the page exactly as `this.skills` does.
		this.mentions = [];
		this._close_mentions();
		this._set_running(false);
		this.$thread.empty();
		this.rail_failed = false;
		if (!this.$welcome) this._show_welcome();
		if (!(options && options.keep_rail)) this._draw_sessions();
		this.$input.focus();
	}

	_stop_poll() {
		if (this.poll_timer) {
			clearTimeout(this.poll_timer);
			this.poll_timer = null;
		}
	}
}
