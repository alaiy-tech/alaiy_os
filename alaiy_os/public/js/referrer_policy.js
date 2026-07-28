/**
 * Alaiy OS — no-referrer for the desk
 *
 * Item product images are supplier / marketplace CDN URLs, not files on this
 * site. A number of those hosts run hotlink protection and answer 403 to any
 * request carrying a cross-origin Referer, so the product image renders broken.
 *
 * Deliberately scoped to <img> elements and nothing else. A referrerpolicy
 * attribute is per-element and overrides the document policy, so it is also what
 * decides the policy Chrome reports for an individual image in the Network
 * panel. The document-level alternatives (a <meta name="referrer"> or a
 * Referrer-Policy response header) would change the referrer for every request
 * the desk makes, which is not wanted here — the cost of that narrower scope is
 * that a CSS background-image cannot be reached at all, since the attribute does
 * not exist for it. That is where the form's title thumbnail comes from
 * (frappe.ui.form.set_user_image), so it keeps sending a Referer.
 *
 * Depends on nothing, and must stay FIRST in app_include_js: the observer has to
 * be watching before the desk boots and starts fetching images.
 */

(function () {
	const POLICY = "no-referrer";

	function stamp(img) {
		if (!img || img.tagName !== "IMG") return;
		if (img.getAttribute("referrerpolicy") === POLICY) return;

		const src = img.getAttribute("src");
		img.setAttribute("referrerpolicy", POLICY);

		// The attribute only governs the *next* fetch, and Frappe assigns src to
		// an <img> that is already in the DOM (frappe.ui.form.set_user_image does
		// .attr("src", image) on the sidebar image). Attribute mutations reach us
		// in a microtask, by which point the browser has already started the
		// request that carried the Referer — clearing src and putting it back
		// re-runs the load under the new policy.
		if (src) {
			img.removeAttribute("src");
			img.setAttribute("src", src);
		}
	}

	function stamp_all(root) {
		if (root.tagName === "IMG") stamp(root);
		else root.querySelectorAll?.("img").forEach(stamp);
	}

	// Document-wide rather than per-doctype: Item images also show up in the list
	// view, link previews and dashboards, and a doctype_js hook would only cover
	// the form. It also sidesteps doctype_js being inlined into the doctype's
	// cached meta, which needs a bench clear-cache to pick up edits.
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type === "attributes") {
				// Already-stamped images short-circuit in stamp(), so the src
				// re-assignment above does not loop back through here.
				stamp(mutation.target);
				continue;
			}
			mutation.addedNodes.forEach((node) => {
				if (node.nodeType === Node.ELEMENT_NODE) stamp_all(node);
			});
		}
	}).observe(document.documentElement, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["src"],
	});

	stamp_all(document.documentElement);
})();
