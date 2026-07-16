// "Ask Alaiy" — a real desk Page (route: /app/ask-alaiy), not a dialog, so it
// behaves exactly like every other sidebar tab (back/forward, bookmarkable
// URL, full-height layout). Same landing-style panel as before: icon,
// heading, pill input with a round send button, suggestion chips. Every
// colour/font/radius/shadow below reads a --s-* token or an already-themed
// class (.btn-primary, .indicator-pill.*) — nothing new to theme.

frappe.pages["ask-alaiy"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Ask Alaiy"),
		single_column: true,
	});

	new AlaiyAskPage(page);

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

class AlaiyAskPage {
	constructor(page) {
		this.page = page;
		this._ensure_styles();
		this._render();
		this._bind();
	}

	_ensure_styles() {
		if (document.getElementById("ask-alaiy-styles")) return;
		const style = document.createElement("style");
		style.id = "ask-alaiy-styles";
		style.textContent = `
			.ask-alaiy-page {
				max-width: 640px; margin: 6vh auto 0; padding: 0 16px;
			}
			.ask-alaiy-hero { text-align: center; margin-bottom: 28px; }
			.ask-alaiy-icon {
				width: 64px; height: 64px; border-radius: var(--s-radius-lg); display: block;
				margin: 0 auto 18px; box-shadow: var(--s-shadow-md); object-fit: contain;
			}
			.ask-alaiy-heading {
				font-family: var(--s-font-serif); font-weight: var(--s-heading-weight);
				font-size: 26px; color: var(--s-heading); margin-bottom: 8px;
			}
			.ask-alaiy-sub { color: var(--s-muted); font-size: 14px; max-width: 440px; margin: 0 auto; }
			.ask-alaiy-input-row {
				display: flex; align-items: flex-end; gap: 10px;
				background: var(--s-white); border: var(--s-border-width) var(--s-border-style) var(--s-border);
				border-radius: var(--s-radius-xl); padding: 14px 12px 14px 22px;
				box-shadow: var(--s-shadow-md); transition: border-color .15s, box-shadow .15s;
			}
			.ask-alaiy-input-row.is-focused { border-color: var(--s-black); box-shadow: 0 0 0 3px rgba(17,17,17,.08); }
			.ask-alaiy-input-row textarea {
				flex: 1; border: none !important; outline: none; resize: none; background: transparent !important;
				font-family: var(--s-font); font-size: 16px; line-height: 1.5; color: var(--s-ink);
				max-height: 220px; padding: 7px 0 !important; min-height: auto !important; box-shadow: none !important;
			}
			.ask-alaiy-send {
				flex: none; width: 42px; height: 42px; border-radius: 50% !important;
				padding: 0 !important; display: flex; align-items: center; justify-content: center;
				transition: transform .12s ease, opacity .12s ease;
			}
			.ask-alaiy-send:disabled { opacity: .4; }
			.ask-alaiy-send:not(:disabled):hover { transform: scale(1.06); }
			.ask-alaiy-suggestions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 20px; }
			.ask-alaiy-chip { cursor: pointer; user-select: none; transition: transform .1s ease; }
			.ask-alaiy-chip:hover { transform: translateY(-1px); }
			.ask-alaiy-thread { max-width: 640px; margin: 28px auto 0; padding: 0 16px 40px; }
			.ask-alaiy-msg {
				background: var(--s-white); border: var(--s-border-width) var(--s-border-style) var(--s-border);
				border-radius: var(--s-radius-lg); box-shadow: var(--s-card-shadow); padding: var(--s-card-pad);
				margin-bottom: 14px; color: var(--s-ink); font-family: var(--s-font); font-size: 14.5px;
			}
			.ask-alaiy-msg.is-user { background: var(--s-hover); color: var(--s-ink); font-weight: var(--s-medium-weight); }
			.ask-alaiy-msg.is-reply { color: var(--s-muted); }
		`;
		document.head.appendChild(style);
	}

	_render() {
		const sendIcon =
			'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
			'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
			'<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';

		const suggestions = [
			{ label: __("Low stock items"), color: "amber" },
			{ label: __("Today's sales"), color: "green" },
			{ label: __("Pending deliveries"), color: "blue" },
		];

		$(this.page.body).empty();
		this.$wrapper = $(`
			<div class="ask-alaiy-page">
				<div class="ask-alaiy-hero">
					<img class="ask-alaiy-icon" src="/assets/images/client-logo-square.png" alt="Alaiy">
					<div class="ask-alaiy-heading">${__("Ask Alaiy anything")}</div>
					<p class="ask-alaiy-sub">${__(
						"Get instant answers about your inventory, orders and business — just ask.",
					)}</p>
				</div>
				<div class="ask-alaiy-input-row" id="ask-alaiy-input-row">
					<textarea id="ask-alaiy-input" rows="1"
						placeholder="${__("Ask about sales, stock, orders…")}"></textarea>
					<button type="button" class="btn btn-primary ask-alaiy-send" id="ask-alaiy-send"
						aria-label="${__("Send")}" disabled>${sendIcon}</button>
				</div>
				<div class="ask-alaiy-suggestions">
					${suggestions
						.map(
							(s) =>
								`<span class="indicator-pill ${s.color} ask-alaiy-chip">${frappe.utils.escape_html(s.label)}</span>`,
						)
						.join("")}
				</div>
			</div>
			<div class="ask-alaiy-thread" id="ask-alaiy-thread"></div>
		`).appendTo(this.page.body);
	}

	_bind() {
		const $row = this.$wrapper.find("#ask-alaiy-input-row");
		const $input = this.$wrapper.find("#ask-alaiy-input");
		const $send = this.$wrapper.find("#ask-alaiy-send");
		const $thread = $(this.page.body).find("#ask-alaiy-thread");

		const autoGrow = () => {
			$input.css("height", "auto");
			$input.css("height", Math.min($input[0].scrollHeight, 220) + "px");
		};

		const send = () => {
			const val = ($input.val() || "").trim();
			if (!val) return;
			$thread.append(
				`<div class="ask-alaiy-msg is-user">${frappe.utils.escape_html(val)}</div>` +
					`<div class="ask-alaiy-msg is-reply">${__("Got it — Alaiy is still learning to answer that.")}</div>`,
			);
			$input.val("").trigger("input");
			$input.focus();
		};

		$input.on("input", () => {
			$send.prop("disabled", !$input.val().trim());
			autoGrow();
		});
		$input.on("focus", () => $row.addClass("is-focused"));
		$input.on("blur", () => $row.removeClass("is-focused"));
		$input.on("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				send();
			}
		});
		$send.on("click", send);
		this.$wrapper.find(".ask-alaiy-chip").on("click", function () {
			$input.val($(this).text().trim()).trigger("input").trigger("focus");
		});

		setTimeout(() => $input.focus(), 200);
	}
}
