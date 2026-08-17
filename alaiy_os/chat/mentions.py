"""`@mentions` — naming a record instead of describing it.

Typing `@` in the composer opens a picker; choosing an entry inserts a visible
token *and* records the structured fact behind it. The turn then carries both:
the user's own words, and a leading block telling the model exactly which record
those words meant.

## Why the structure matters

Without it, "how did Royal Canin do last month?" asks the model to guess three
things — which `Brand` row that name is, whether it is a brand at all rather
than an item, and what dates "last month" covers. The last one is the worst:
`_system_prompt` tells the model today's date, which is an *invitation* to do
calendar arithmetic. A mention replaces the invitation with the answer.

## This module owns the mechanism and none of the data

There are no brands, SKUs, channels or date tokens in this file, and there is no
list of what a mention may be. A deployment registers sources on the
`chat_mention_sources` hook; core searches them, re-resolves what comes back
from the client, and renders the block. That is the same division as
`chat_system_context`: what is true of one customer's business belongs in that
customer's app.

A site with no provider gets an `@` picker that opens empty, which is the honest
outcome — not a crash, and not a hardcoded guess about which doctypes a
deployment keeps its brands in.

## The hook contract

Each entry is a dotted path to a no-argument callable returning a list of
sources, one per `@` kind:

    {
      "kind":      "brand",           # stable id, stored on the message
      "label":     "Brands",          # the picker's group heading
      "min_chars": 2,                 # below this the search is not called
      "search":    fn(term) -> [option],
      "resolve":   fn(value) -> option | None,
    }

An option is `{value, label, sublabel?, icon?, hint?, **extras}`. `value` is the
identity — a docname, a slug, whatever the source resolves against. `hint` is
the one line the model reads about it, written by the source because only the
source knows what the value *means* (that a channel id filters
`unicommerce_channel_id`, say). `extras` ride along into storage, which is how a
date mention carries its resolved `from`/`to`.

## Never trust the client

`resolve` exists because a picker's output is a claim, not a fact. The label and
any extras are rebuilt from the source on every send, so a stale menu — a tab
left open across a permission change, or a hand-edited request — cannot smuggle
in a record the user may no longer read, nor a date range they made up.

A mention that fails to resolve is **dropped silently**, deliberately unlike a
skill slug, which throws. A skill is the user's whole intent, so getting it
wrong must fail loudly; a mention is one hint among several, and killing the
message over a stale one is worse than answering without it.
"""

import json

import frappe

# Per group, per query. A picker is for recognising the thing you already have in
# mind, not for browsing — past half a dozen rows it is a list view with worse
# keyboard handling.
PER_KIND = 6

# Mentions carried by one message. A block naming forty records has stopped
# being context and become a query the user should have asked directly.
MAX_PER_MESSAGE = 10

# A source that does not say otherwise is searched even on a bare `@` — right for
# a small fixed set (channels, date windows), wrong for anything with a LIKE
# behind it, which should declare 2 or more.
DEFAULT_MIN_CHARS = 0

HOOK = "chat_mention_sources"

# Keys core assigns or owns; everything else a source returns is an extra and is
# stored as-is. `kind` is core's because a source must not be able to answer for
# another one.
_RESERVED = ("kind", "value", "label", "sublabel", "icon", "hint")


def sources():
	"""Every registered mention source, in hook order.

	One broken provider must not empty the picker — same bargain
	`runner._tenant_context` makes about the system prompt.
	"""
	found = []
	for entry in frappe.get_hooks(HOOK) or []:
		try:
			found.extend(frappe.get_attr(entry)() or [])
		except Exception:
			frappe.log_error(title=f"Mention source {entry} failed to load")
	return [s for s in found if s.get("kind") and callable(s.get("search"))]


def catalogue(q=None, kind=None):
	"""The `@` picker's options for `q`, grouped by kind.

	One call serves every kind, so the client has a single code path and no
	knowledge of which kinds are cheap. Whether a query reaches a database is
	decided here, per source, by its `min_chars`: on a bare `@` the small fixed
	sets come back in full and the LIKE-backed ones come back empty without
	being called at all.

	`kind` narrows the result to one group. The desk picker does not use it — it
	is for a client that wants a SKU-only affordance, and for testing a source
	from the console.
	"""
	term = (q or "").strip()
	groups = []

	for source in sources():
		if kind and source["kind"] != kind:
			continue
		groups.append(
			{
				"kind": source["kind"],
				"label": source.get("label") or source["kind"].title(),
				"min_chars": int(source.get("min_chars", DEFAULT_MIN_CHARS)),
				"options": _search(source, term),
			}
		)

	return {"query": term, "groups": groups}


def resolve(raw):
	"""Client-supplied mentions, rebuilt from their sources. Never raises.

	Returns the list stored on the message and rendered into `context_block` —
	canonical, capped, deduplicated, and containing only what still resolves.
	"""
	entries = raw or []
	if isinstance(entries, str):
		try:
			entries = json.loads(entries or "[]")
		except ValueError:
			# A malformed payload is a client bug, not something to fail the
			# user's message over — their words are still worth answering.
			frappe.log_error(title="Mentions payload was not JSON")
			return []
	if not isinstance(entries, list):
		return []

	by_kind = {s["kind"]: s for s in sources() if callable(s.get("resolve"))}
	found, seen = [], set()

	for entry in entries:
		if not isinstance(entry, dict) or len(found) >= MAX_PER_MESSAGE:
			continue
		kind, value = entry.get("kind"), entry.get("value")
		source = by_kind.get(kind)
		if not source or not value or (kind, value) in seen:
			continue
		try:
			option = source["resolve"](value)
		except Exception:
			# Includes PermissionError: a mention the user may no longer read
			# simply stops being one. It is not worth an error to the user, whose
			# own words still say what they were asking about.
			option = None
		if not option:
			continue
		seen.add((kind, value))
		found.append(_normalise(kind, option))

	return found


def context_block(mentions):
	"""The block that puts resolved mentions in front of the user's question.

	Delimited rather than merged into their prose, for the reason
	`attachments.render_block` is: the model has to be able to tell what it was
	handed from what it was asked.
	"""
	if not mentions:
		return None

	lines = []
	for m in mentions:
		hint = m.get("hint")
		lines.append(f"- {m['kind']}: \"{m['label']}\"" + (f" — {hint}" if hint else ""))

	return {
		"type": "text",
		"text": (
			"<mentions>\n"
			"The user named these records explicitly. Use these exact values as tool "
			"arguments and filters — do not look them up by name again, and do not work "
			"out any dates yourself; they are already resolved below.\n"
			+ "\n".join(lines)
			+ "\n</mentions>"
		),
	}


def _search(source, term):
	"""One source's options for `term`, capped and normalised. Never raises."""
	if len(term) < int(source.get("min_chars", DEFAULT_MIN_CHARS)):
		return []
	try:
		found = source["search"](term) or []
	except frappe.PermissionError:
		# A role without read on the underlying doctype loses that group, not the
		# whole picker. Not logged: it is a configuration fact, not a fault, and
		# it would log on every keystroke.
		return []
	except Exception:
		frappe.log_error(title=f"Mention search failed for @{source['kind']}")
		return []
	return [_normalise(source["kind"], o) for o in found[:PER_KIND] if o.get("value")]


def _normalise(kind, option):
	"""One option in the shape the client draws and the message stores."""
	out = {
		"kind": kind,
		"value": option["value"],
		"label": option.get("label") or option["value"],
		"sublabel": option.get("sublabel"),
		"icon": option.get("icon"),
		"hint": option.get("hint"),
	}
	out.update({k: v for k, v in option.items() if k not in _RESERVED})
	return out
