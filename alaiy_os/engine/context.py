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
"""

from contextlib import contextmanager

import frappe

_ATTR = "alaiy_agent_context"


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
