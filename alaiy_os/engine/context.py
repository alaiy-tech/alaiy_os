"""Run context for the AI client seam.

`llm.complete(model, system, messages, tools=None)` deliberately carries no
agent or run identity — every client must implement that signature, so widening
it would break any client that isn't ours (including the default BYOK one).

A managed client still needs to know *which agent* made a call, so usage can be
attributed per agent. The executor therefore publishes the run it is executing
here, and a client reads it if it cares. Clients that don't are unaffected:
nothing about the seam signature changes.

**This is attribution, not budgeting.** A site holds ONE gateway key with one
budget — that key is the credit pool, and every agent draws from it. Tagging a
request with its agent labels the spend inside that pool; it does not carve the
pool up. Per-agent budgets would need separate keys, which is deliberately not
how this works.

`frappe.local` is reset between jobs, so a value cannot leak from one run into
the next even in a long-lived worker.

    from alaiy_os.engine.context import agent_run, get_agent_context

    with agent_run(agent_id="sales_digest", run="RUN-2026-00007", trigger="Scheduled"):
        ...                                   # llm.complete() calls in here
    ctx = get_agent_context()                 # {} outside a run

## `chat_turn` — the same seam, for a conversation

A managed client also wants to know *which session, and who* for a chat
completion, so per-user spend is attributable the same way per-agent spend
already is (billing's alaiy_os_billing_service#20, item 5). `actor` here is
the raw Frappe user — an email, most often — never hashed: hashing is a
policy about what a *central* store may hold, and this module has no opinion
on that. `alaiy_os_ai_client.actor.hash_actor` is where a value crossing the
site boundary gets turned into an opaque id, the same function that already
hashes it for the interaction store. Passing a raw email through here and
hashing it only at the edge keeps that one function the only place the
hashing rule can drift.

A turn can write several messages, though, and `session_id` alone cannot
tell them apart — see `set_turn_seq` for the finer-grained id a caller needs
to attribute cost per *message*, not just per conversation.

    from alaiy_os.engine.context import chat_turn, get_chat_context, set_turn_seq

    with chat_turn(session_id=doc.name, actor=doc.owner):
        set_turn_seq(next_seq)               # before EACH llm.complete()
        ...                                   # llm.complete() calls in here
    ctx = get_chat_context()                   # {} outside a turn

A separate `frappe.local` attribute from `agent_run`'s, not a merged one: a
chat turn whose tool loop invokes an agent has both active, nested, at once,
and each has to restore only its own on the way out.
"""

from contextlib import contextmanager

import frappe

_ATTR = "alaiy_agent_context"
_CHAT_ATTR = "alaiy_chat_context"


def get_agent_context():
	"""The agent run currently executing, or {} when not inside one.

	Never raises: a client calls this on every request, including ones with
	nothing to do with an agent (an ad-hoc completion from a script, a tool
	invoked outside the executor).
	"""
	return getattr(frappe.local, _ATTR, None) or {}


@contextmanager
def agent_run(agent_id, run=None, trigger=None):
	"""Publish the executing agent for the duration of the block.

	Restores whatever was set before rather than clearing, so a nested run — an
	agent whose tool invokes another agent — leaves the outer context intact on
	the way out.
	"""
	previous = getattr(frappe.local, _ATTR, None)
	setattr(frappe.local, _ATTR, {
		"agent": agent_id,
		"run": run,
		"trigger": trigger,
	})
	try:
		yield
	finally:
		setattr(frappe.local, _ATTR, previous)


def get_chat_context():
	"""The chat turn currently executing, or {} when not inside one.

	Same contract as `get_agent_context`: never raises, called on every
	request whether or not it has anything to do with a chat turn.
	"""
	return getattr(frappe.local, _CHAT_ATTR, None) or {}


@contextmanager
def chat_turn(session_id, actor=None):
	"""Publish the executing chat turn for the duration of the block.

	Mirrors `agent_run` exactly, on its own attribute — restores whatever was
	set before, so a turn whose tool loop invokes an agent leaves the chat
	context intact once that nested run returns, the same way `agent_run`
	protects a nested agent call.

	`actor` is the raw Frappe user, unhashed — see this module's docstring on
	why the hash belongs at the edge, in `alaiy_os_ai_client`, and not here.
	"""
	previous = getattr(frappe.local, _CHAT_ATTR, None)
	setattr(frappe.local, _CHAT_ATTR, {
		"session": session_id,
		"actor": actor,
	})
	try:
		yield
	finally:
		setattr(frappe.local, _CHAT_ATTR, previous)


def set_turn_seq(seq):
	"""Record which `OS Chat Message` sequence the LLM call about to run will
	produce, so a managed client can attribute that call's spend to that
	exact message (billing's per-interaction cost — item 5 of
	alaiy_os_billing_service#20).

	`chat_turn` publishes one session/actor pair for a whole turn, but a turn
	can write several messages — a tool-only step, then the prose that
	follows it — each its OWN interaction once posted, from ONE LLM call
	each. `session_id` alone cannot tell those apart; `seq` is what does.

	A plain setter, not a nested context manager: it mutates the SAME dict
	`chat_turn` is already holding open, in place, so every read after this
	call sees the update without a second `with` block per message. Call it
	right before each `llm.complete()`, with the sequence number the runner
	predicts its next write will get (see `chat/runner.py`'s `_loop`) — since
	a session's messages are only ever written by that session's own turn,
	one at a time, the prediction is exact. A no-op outside a `chat_turn`
	block, so a stray call from anywhere else is harmless.
	"""
	context = getattr(frappe.local, _CHAT_ATTR, None)
	if context is not None:
		context["seq"] = seq
