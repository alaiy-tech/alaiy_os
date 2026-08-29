# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""The chat's one route to the public web.

Everything else Ask Alaiy can reach is this business's own data. This tool is the
exception, and it is deliberately a poor default: the model is told to answer
from local tools first, and — when only the web could settle a question — to say
so, offer to look, and stop. The search happens on the next turn, because the
person said yes.

## Why a tool, and not a flag on the turn

The gateway turns searching on with a request-level body parameter, which means
something has to decide *before* the model reads the message. Making that
decision outside the model would mean pattern-matching the user's words for
consent, which is exactly the kind of brittle guessing that gets "yeah go on
then" wrong. A tool moves the decision inside the model, where the whole
conversation is: the model already knows whether it offered and whether the user
agreed, and calling this tool is how it acts on that.

The trade is honest and worth stating: the confirmation rule is prompt-enforced,
not machine-enforced. `chat/runner.py` tells the model to offer first, and a
model that ignores it will search when it should have asked. What that costs is
a search charge and a slightly over-eager assistant — not a write, not a
disclosure. The search itself reads nothing belonging to this site: the query is
whatever the model composes, and it goes to a search engine, so an over-eager
call leaks the question and nothing else. If that ever needs to be a hard
guarantee rather than a strong default, the place to put it is a pending-offer
record written here and checked before the call, not a regex over the transcript.

## What comes back

`{"answer", "citations"}` — prose from a search-grounded model, plus the URLs it
rested on where the gateway hands them over. The prompt asks the model to cite
what it uses, because an unsourced web claim sitting next to a figure read out of
this site's own database is the failure mode worth designing against: they look
identical in a chat bubble and only one of them is verifiable.
"""

import frappe

from alaiy_os.engine import llm

TOOL = "web_search"

#: Enough of a question to search for. Below this it is a stray token, and the
#: search is a wasted per-query charge.
MIN_QUERY_CHARS = 3

#: Queries are sentences, not documents. A model pasting half the conversation in
#: here is a bug in the making — searching costs per query and the engine ignores
#: the tail anyway.
MAX_QUERY_CHARS = 400


#: The tool as `chat/tools.py` serves it — the same
#: `{name, description, input_schema, run}` shape a `chat_tool_sources` entry
#: uses.
#:
#: The description carries the confirmation rule as well as the system prompt
#: does, and on purpose: the prompt is one paragraph among many and is the first
#: thing a long conversation pushes out of the model's attention, while a tool
#: description is re-sent, verbatim, on every single request.
TOOL_SPEC = {
	"name": TOOL,
	"description": (
		"Search the public web and return a grounded answer with its sources. "
		"This is the ONLY tool that reads anything outside this business's own "
		"data.\n\n"
		"DO NOT call this tool until the user has asked for a web search or "
		"agreed to one. When a question needs the public web — a competitor's "
		"price, a supplier you hold no record of, a marketplace policy, market "
		"rates, anything after your training cutoff — first answer what you can "
		"from this site's data, say plainly what you could not establish, and end "
		"your reply by offering: \"I can look this up on the web — want me to go "
		"ahead?\" Then stop and let them answer. Call this tool on the next turn "
		"only if they say yes, or whenever they ask for a search outright.\n\n"
		"`query` is what you want to know, written as you would type it into a "
		"search engine — not the user's message pasted back. Searching costs "
		"money per query, so ask one good question rather than three near-"
		"identical ones.\n\n"
		"Returns {answer, citations: [{title, url}]}. The answer comes from a "
		"model reading the live web; treat it as a source, not as fact. Cite the "
		"sources it gives you, and keep this site's own records as the source of "
		"truth: where the web disagrees with a document here, report both and say "
		"which is which. Never present a web figure as though you read it out of "
		"the system."
	),
	"input_schema": {
		"type": "object",
		"properties": {
			"query": {
				"type": "string",
				"description": (
					"The search query, phrased for a search engine. Be specific and "
					"include the details that narrow it — a brand, a model number, a "
					"marketplace, a year."
				),
			},
		},
		"required": ["query"],
	},
	"run": lambda arguments: run(arguments),
}


def run(arguments):
	"""Search the web for `query`.

	Raises rather than returning an error dict: `chat_tools.call_tool` lets the
	exception through and the runner records it as an errored `tool_result`, which
	is what puts the reason in front of the model instead of leaving it to guess
	from an empty answer.
	"""
	query = str((arguments or {}).get("query") or "").strip()
	if len(query) < MIN_QUERY_CHARS:
		frappe.throw("web_search needs a `query` — what should I look up?")
	if len(query) > MAX_QUERY_CHARS:
		frappe.throw(
			f"That query is {len(query)} characters. Ask a search engine a question, "
			f"not a paragraph — {MAX_QUERY_CHARS} characters at most."
		)

	result = llm.web_search(query)
	return {
		"query": query,
		"answer": result.get("answer") or "",
		"citations": result.get("citations") or [],
	}
