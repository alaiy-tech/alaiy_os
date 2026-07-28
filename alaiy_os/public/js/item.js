// Item product images are usually supplier / marketplace CDN URLs, not files on
// this site. A number of those hosts run hotlink protection and answer 403 to
// any request carrying a cross-origin Referer, so the product image renders
// broken on the Item form. referrerpolicy="no-referrer" makes the browser send
// no Referer at all, which those hosts serve normally.
//
// Frappe builds these <img> tags itself and exposes no hook for extra
// attributes — the sidebar image comes from form_sidebar.html (src assigned by
// frappe.ui.form.set_user_image) and the Attach Image hover preview is built
// inside controls/attach_image.js — so we stamp them after render: once on
// refresh, then via a MutationObserver, because the sidebar image is re-rendered
// on every upload/remove and the popover <img> only exists while hovering.

const NO_REFERRER = "no-referrer";
const OBSERVER_KEY = "__alaiy_no_referrer_observer";

frappe.ui.form.on("Item", {
	refresh(frm) {
		stamp_images(frm.$wrapper);
		watch_images(frm);
	},
});

function stamp_images($container) {
	$container.find("img").each((_, img) => stamp_image(img));
}

function stamp_image(img) {
	if (!img || img.tagName !== "IMG") return;
	if (img.getAttribute("referrerpolicy") === NO_REFERRER) return;

	const src = img.getAttribute("src");
	img.setAttribute("referrerpolicy", NO_REFERRER);

	// The attribute only governs the *next* fetch, and Frappe assigns src to an
	// <img> that is already in the DOM — by the time we run, the request that
	// carried the Referer (and got the 403) has already gone out. Clearing src
	// and putting it back re-runs the load under the new policy.
	if (src) {
		img.removeAttribute("src");
		img.setAttribute("src", src);
	}
}

function watch_images(frm) {
	if (frm[OBSERVER_KEY]) return;

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type === "attributes") {
				// Already-stamped images short-circuit in stamp_image(), so our
				// own src re-assignment above does not loop back through here.
				stamp_image(mutation.target);
				continue;
			}
			mutation.addedNodes.forEach((node) => {
				if (node.nodeType !== Node.ELEMENT_NODE) return;
				if (node.tagName === "IMG") stamp_image(node);
				else node.querySelectorAll("img").forEach(stamp_image);
			});
		}
	});

	observer.observe(frm.$wrapper[0], {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["src"],
	});

	// frm objects are cached and reused per doctype, so this stays a single
	// observer for the Item form rather than one per route change.
	frm[OBSERVER_KEY] = observer;
}
