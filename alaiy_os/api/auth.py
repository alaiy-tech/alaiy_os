import frappe


@frappe.whitelist()
def get_csrf_token():
	"""The Next.js BFF proxy calls this once per mutating request (see
	interface/src/lib/frappe/proxy.server.ts) and attaches the result as
	X-Frappe-CSRF-Token - cookie-session POST/PUT/DELETE requests are rejected
	without it. Not needed for login/logout, which are exempted in the proxy
	since there's no session yet (login) or the token doesn't matter (logout).
	"""
	return frappe.sessions.get_csrf_token()
