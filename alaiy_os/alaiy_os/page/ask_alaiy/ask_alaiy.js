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

class AlaiyAskPage {
	constructor(page) {
		this.page = page;
		this.session = null; // created lazily, on the first message
		this.last_seq = 0; // poll cursor
		this.running = false;
		this.poll_timer = null;
		this.sessions = [];
		this.query = "";

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
		};
		return (
			`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ` +
			`stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`
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
						<div class="ask-alaiy-composer">
							<textarea rows="1" placeholder="${__("Ask about stock, orders, listings…")}"
								aria-label="${__("Message Alaiy")}"></textarea>
							<button type="button" class="btn btn-primary ask-alaiy-send"
								aria-label="${__("Send")}" disabled>${this._icon("send")}</button>
						</div>
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

		this._show_welcome();
	}

	_bind() {
		const $composer = this.$shell.find(".ask-alaiy-composer");
		const $searchBox = this.$shell.find(".ask-alaiy-search");

		const autoGrow = () => {
			this.$input.css("height", "auto");
			this.$input.css("height", Math.min(this.$input[0].scrollHeight, 200) + "px");
		};

		this.$input.on("input", () => {
			this.$send.prop("disabled", this.running || !this.$input.val().trim());
			autoGrow();
		});
		this.$input.on("focus", () => $composer.addClass("is-focused"));
		this.$input.on("blur", () => $composer.removeClass("is-focused"));
		this.$input.on("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this._submit();
			}
		});
		this.$send.on("click", () => this._submit());

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
		if (!text || this.running) return;
		this.$input.val("").trigger("input").focus();
		this._send(text);
	}

	// ── Conversation ────────────────────────────────────────────────────────
	async _send(text) {
		this._clear_welcome();
		this._add(this._user_turn(text));
		this._set_running(true);

		try {
			if (!this.session) {
				const created = await frappe.xcall("alaiy_os.api.chat.create_session");
				this.session = created.session;
			}
			const sent = await frappe.xcall("alaiy_os.api.chat.send_message", {
				session: this.session,
				text: text,
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
	_user_turn(text) {
		return $('<div class="ask-alaiy-turn is-user"></div>').append(
			$('<div class="ask-alaiy-user-bubble"></div>').text(text),
		);
	}

	/** A tool round-trip is an assistant message of tool_use blocks followed by
	 * a user message of results. The results message has nothing to show, so it
	 * draws nothing rather than an empty bubble. */
	_draw(message) {
		if (message.role === "user") {
			// Replayed history (loading an old chat) reaches here; a message
			// just typed is already on screen.
			if (message.text) this._add(this._user_turn(message.text));
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
			$('<span class="ask-alaiy-step-name"></span>')
				.text(String(call.name || "").replace(/_/g, " "))
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
		this.$send.prop("disabled", running || !(this.$input.val() || "").trim());
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
