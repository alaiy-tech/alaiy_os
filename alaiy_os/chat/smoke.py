"""One full chat turn, synchronously, from the command line.

	bench --site <site> execute alaiy_os.chat.smoke.run
	bench --site <site> execute alaiy_os.chat.smoke.run --kwargs "{'question': '...'}"

Runs the loop in-process rather than enqueueing it, so it needs no worker and
you see the traceback rather than digging it out of the Error Log. It costs one
real LLM call and its tools touch live data — the default question is read-only,
so keep it that way unless you mean it.

`--kwargs "{'user': 'someone@example.com'}"` runs the turn as that user, which
is how you check that the tool list really does shrink for a non-manager.

`run_export` is the other half: the file writers and the `File` row with no LLM
call at all, for when the question is "does this xlsx open" rather than "does the
model reach for it".

	bench --site <site> execute alaiy_os.chat.smoke.run_export
	bench --site <site> execute alaiy_os.chat.smoke.run_export --kwargs "{'fmt': 'pdf', 'rows': 40}"

`run_chip` builds a real session containing a real generated file, with no LLM
call at all, so the *plumbing* can be judged separately from whether the site's
model is capable of driving it. Open the session in any client afterwards and the
download chip either renders or it does not.

	bench --site <site> execute alaiy_os.chat.smoke.run_chip
	bench --site <site> execute alaiy_os.chat.smoke.run_chip --kwargs "{'fmt': 'pdf'}"

`run_stream` checks the streaming path with a scripted client instead of a
provider: no network, no cost, and a fixed answer so the assertions can be exact.
It is the one that answers "did the text actually arrive in pieces, and does
turning streaming off still produce the same message".

	bench --site <site> execute alaiy_os.chat.smoke.run_stream

`run_stream_live` is the other half of that: one real call to *this site's*
provider, checking that it actually streams. It has to be asked separately,
because `runner` falls back to a buffered call in silence — a base_url that
buffers gives a site no streaming at all and nothing anywhere says so.

	bench --site <site> execute alaiy_os.chat.smoke.run_stream_live

`run_suggest` checks the follow-up chips, also against a scripted client: no
network, no cost, and a fixed answer *and* a fixed suggestion payload, so the
assertions can be exact. It covers the two things that make the feature reach a
user at all — that the suggestions are written before the session goes Idle, and
that `get_messages` returns them at the top level where a poller past its cursor
can still see them — plus the parser, which has to survive a model that answers
in prose.

	bench --site <site> execute alaiy_os.chat.smoke.run_suggest

`dump` prints a stored session in full — tool arguments AND tool results, which
`api/chat.get_messages` deliberately withholds and no client therefore shows. It
is the only way to see *why* a model retried a tool eleven times, so it is the
first thing to reach for when a turn went in circles.

	bench --site <site> execute alaiy_os.chat.smoke.dump
	bench --site <site> execute alaiy_os.chat.smoke.dump --kwargs "{'session': 'CHAT-2026-00107'}"
"""

import json

import frappe

from alaiy_os.api import chat as chat_api
from alaiy_os.chat import artifacts, runner, suggest, tools
from alaiy_os.engine import llm

DEFAULT_QUESTION = "How many sales orders were created this month? Use a tool to check."


def run(question=None, user=None, keep=False):
	if user:
		frappe.set_user(user)
	question = question or DEFAULT_QUESTION

	specs = tools.tool_specs()
	print(f"user: {frappe.session.user}")
	print(f"tools available: {len(specs)}")
	for spec in specs:
		print(f"  - {spec['name']}")
	if not specs:
		print(
			"  (none — is frappe_assistant_core installed and its tools enabled? "
			"an empty list is also how a broken chat_tool_sources hook fails, so "
			"check the Error Log before assuming this user is simply scoped out)"
		)

	session = frappe.get_doc(
		{"doctype": "OS Chat Session", "model": runner.default_model(), "status": "Idle"}
	).insert()
	runner._append(session.name, "user", [{"type": "text", "text": question}], text=question)
	frappe.db.commit()

	print(f"\n{session.name} — one turn on {session.model}\nQ: {question}\n")
	runner.run_turn(session.name)

	session.reload()
	print(f"status={session.status}  tokens in={session.input_tokens} out={session.output_tokens}")
	if session.error:
		print(f"\nERROR:\n{session.error}")

	print("\n--- transcript ---")
	for row in frappe.get_all(
		"OS Chat Message",
		filters={"session": session.name},
		fields=["seq", "role", "text", "blocks", "attachments"],
		order_by="seq asc",
	):
		blocks = json.loads(row.blocks)
		calls = [b["name"] for b in blocks if b.get("type") == "tool_use"]
		errors = sum(1 for b in blocks if b.get("type") == "tool_result" and b.get("is_error"))
		suffix = f" -> {', '.join(calls)}" if calls else (f" ({errors} failed)" if errors else "")
		print(f"[{row.seq}] {row.role}{suffix}")
		if row.text:
			print(f"    {row.text[:800]}")
		# The chips the client would draw. A generated file that never reaches this
		# column reached nobody, however well the writer worked.
		for entry in json.loads(row.attachments or "[]"):
			kind = entry.get("kind") or "upload"
			print(f"    [{kind}] {entry.get('file_name')}  {entry.get('file_url')}")

	if keep:
		print(f"\nkept: {session.name}")
	else:
		frappe.delete_doc("OS Chat Session", session.name, force=True)
		frappe.db.commit()
		print("\n(session deleted; pass --kwargs \"{'keep': True}\" to keep it)")


def run_export(fmt="xlsx", rows=25, keep=False):
	"""The writer path with no LLM: build a table, call the tool, print the file.

	Bypasses `_loop` entirely, so it is the fast way to answer "does this file
	open in Excel" — and the only way to exercise the pdf writer without paying
	for a model to decide it wants one.
	"""
	session = frappe.get_doc(
		{"doctype": "OS Chat Session", "model": runner.default_model(), "status": "Idle"}
	).insert()
	# What `run_turn` would have done. `create` refuses outside a turn, and that
	# refusal is worth keeping rather than special-casing for the test.
	artifacts.reset(session.name)

	count = int(rows)
	result = artifacts.create(
		file_name=f"smoke-{fmt}",
		format=fmt,
		title="Smoke test export",
		columns=["SKU", "Brand", "Units", "GMV"],
		rows=[
			[f"SKU-{index:04d}", "Royal Canin" if index % 2 else "Pedigree", index, index * 1234.5]
			for index in range(1, count + 1)
		],
	)
	print(json.dumps(result, indent=2))

	staged = artifacts.drain()
	print("\nmeta that would reach the client:")
	print(json.dumps(staged, indent=2))

	frappe.db.commit()
	if keep:
		print(f"\nkept: {session.name}")
	else:
		frappe.delete_doc("OS Chat Session", session.name, force=True)
		frappe.db.commit()
		print("\n(session and its file deleted; pass keep=True to keep them)")


def dump(session=None, chars=600):
	"""Print one stored session: prose, tool calls, tool results, download chips.

	`session` defaults to the most recently created one. Read-only — one select
	over `OS Chat Message`, nothing is written, so it is safe against a live site.

	Reads `blocks` rather than going through `api.chat.get_messages`, because that
	endpoint drops tool results on purpose (they are raw JSON the model has
	already summarised, and can be megabytes). When a turn misbehaves the results
	are exactly what you need, so this is the escape hatch.
	"""
	session = session or frappe.db.get_value(
		"OS Chat Session", {}, "name", order_by="creation desc"
	)
	if not session:
		print("no chat sessions on this site")
		return

	doc = frappe.get_doc("OS Chat Session", session)
	print(f"{doc.name}  status={doc.status}  model={doc.model}")
	print(f"tokens in={doc.input_tokens} out={doc.output_tokens}")
	if doc.error:
		print(f"\nERROR:\n{doc.error}")

	calls = {}
	for row in frappe.get_all(
		"OS Chat Message",
		filters={"session": session},
		fields=["seq", "role", "blocks", "attachments"],
		order_by="seq asc",
	):
		print(f"\n{'=' * 72}\n[{row.seq}] {row.role}")
		for block in json.loads(row.blocks or "[]"):
			kind = block.get("type")
			if kind == "text" and block.get("text"):
				print(f"  text: {block['text'][:chars]}")
			elif kind == "tool_use":
				name = block.get("name")
				# Count repeats on the resolved arguments, which is what turns "it
				# called SQL eleven times" into "it called the SAME query eleven
				# times" — a different diagnosis with a different fix.
				key = f"{name}:{json.dumps(block.get('input'), sort_keys=True, default=str)}"
				calls[key] = calls.get(key, 0) + 1
				repeat = f"  ← repeat #{calls[key]}" if calls[key] > 1 else ""
				print(f"  CALL {name}{repeat}")
				print(f"       args={json.dumps(block.get('input'), default=str)[:chars]}")
			elif kind == "tool_result":
				content = block.get("content")
				if not isinstance(content, str):
					content = json.dumps(content, default=str)
				flag = "  [IS_ERROR]" if block.get("is_error") else ""
				print(f"  RESULT{flag}: {content[:chars]}")
		for entry in json.loads(row.attachments or "[]"):
			print(f"  CHIP [{entry.get('kind') or 'upload'}] {entry.get('file_name')} {entry.get('file_url')}")

	repeated = {k: n for k, n in calls.items() if n > 1}
	if repeated:
		print(f"\n{'=' * 72}\nREPEATED CALLS (identical arguments):")
		for key, count in sorted(repeated.items(), key=lambda kv: -kv[1]):
			print(f"  {count}x  {key[:200]}")


def run_chip(fmt="xlsx", rows=12):
	"""Write a session whose assistant message carries a generated file. No LLM.

	The point is isolation. Every other path to a download chip runs through a
	model deciding to call `create_download` and getting its arguments right, so a
	weak model makes the whole feature look broken. This writes the same two
	messages `_loop` would have written — a question, then an answer with the
	artifact meta attached — and stops.

	It therefore exercises exactly the parts a model cannot break: the writers,
	`save_file` and its permission, the `attachments` column, `_present`, and both
	clients' chip rendering. The session is KEPT, because looking at it in the UI
	is the whole point.

	Prints the session name. Open Ask Alaiy, pick it out of the history rail, and
	the chip should sit under the reply with a download arrow.
	"""
	session = frappe.get_doc(
		{"doctype": "OS Chat Session", "title": f"chip smoke ({fmt})",
		 "model": runner.default_model(), "status": "Idle"}
	).insert()
	artifacts.reset(session.name)

	question = f"Give me this month's top {rows} SKUs by revenue as a {fmt}."
	runner._append(session.name, "user", [{"type": "text", "text": question}], text=question)

	result = artifacts.create(
		file_name="top-skus-this-month",
		format=fmt,
		title="Top SKUs this month",
		columns=["SKU", "Brand", "Units", "Revenue"],
		rows=[
			[f"SKU-{index:04d}", "Royal Canin" if index % 2 else "Pedigree", index * 3, index * 1234.5]
			for index in range(1, int(rows) + 1)
		],
	)

	# What the model would have said, and what `_loop` would have attached to it.
	answer = (
		f"Revenue was led by SKU-0001. The full list of {rows} is in the file below."
	)
	runner._append(
		session.name,
		"assistant",
		[{"type": "text", "text": answer}],
		text=answer,
		attachments=artifacts.drain(),
	)
	frappe.db.commit()

	print(json.dumps(result, indent=2))
	print(f"\nsession: {session.name}")
	print("open Ask Alaiy, pick it from the history rail, and look for the chip")


# ── Streaming ────────────────────────────────────────────────────────────────
STREAM_CHUNKS = [
	"Sales orders ",
	"created this month: 412, ",
	"up 9% on last month. ",
	"The lift is almost entirely Royal Canin, ",
	"which added 38 orders week on week. ",
	# Deliberately long, to trip STREAM_FLUSH_CHARS rather than the clock: both
	# thresholds have to be exercised or a regression in either goes unnoticed.
	# Stripped so the joined answer has no trailing space — `runner._text_of`
	# strips, and the final row is written from the blocks, not from the buffer.
	("Everything else was flat. " * 12).strip(),
]
STREAM_ANSWER = "".join(STREAM_CHUNKS)


class _BufferedClient:
	"""An `ai_client` that answers from a script, buffered. No key, no cost.

	Also stands in for every managed client written before streaming existed:
	`complete` and nothing else, which is what `llm.streaming_available()` has to
	notice. A turn against one must take the old path in silence rather than fail.
	"""

	def __init__(self, session=None, delay=0.25):
		self.session = session
		self.delay = delay
		self.snapshots = []
		self.leaked = []

	def _result(self):
		return {
			"content": [{"type": "text", "text": STREAM_ANSWER}],
			"stop_reason": "end_turn",
			"usage": {"input_tokens": 100, "output_tokens": 200},
		}

	def complete(self, model, system, messages, tools=None):
		return self._result()


class _StreamingClient(_BufferedClient):
	"""The same script, handed over in pieces.

	`stream` returns the identical dict `complete` does, which is the invariant
	the whole feature rests on: `chat/runner.py` chooses between them per turn, so
	nothing downstream may be able to tell which one ran.

	`snapshots` records what a poll would have seen, taken from inside the stream
	— the only place it can be observed, since by the time `run_turn` returns the
	message is finished.
	"""

	def stream(self, model, system, messages, tools=None, on_text=None):
		import time

		for chunk in STREAM_CHUNKS:
			if on_text:
				on_text(chunk)
			if self.session:
				# Through the endpoint, not the table: what a client would see is
				# the thing under test, and it is the only place the opt-in can be
				# observed at all — by the time `run_turn` returns there is no
				# partial row left to hide.
				from alaiy_os.api import chat as chat_api

				shown = chat_api.get_messages(self.session, after=0, partial=1)["messages"]
				hidden = chat_api.get_messages(self.session, after=0)["messages"]
				self.snapshots.append(len(shown[-1]["text"] or "") if shown else 0)
				self.leaked.append(any(m["partial"] for m in hidden))
			time.sleep(self.delay)
		return self._result()


def _one_turn(client, question="How many sales orders this month?"):
	"""Drive one turn in-process against `client`, returning (session, text)."""
	session = frappe.get_doc(
		{"doctype": "OS Chat Session", "model": runner.default_model(), "status": "Idle"}
	).insert()
	runner._append(session.name, "user", [{"type": "text", "text": question}], text=question)
	frappe.db.commit()

	client.session = session.name
	original = llm._client
	llm._client = lambda: client
	try:
		runner.run_turn(session.name)
	finally:
		llm._client = original

	session.reload()
	row = frappe.db.get_value(
		"OS Chat Message",
		{"session": session.name, "role": "assistant"},
		["text", "is_partial", "blocks"],
		order_by="seq desc",
		as_dict=True,
	)
	return session, row


def _cleanup(*sessions):
	for session in sessions:
		frappe.delete_doc("OS Chat Session", session.name, force=True)
	frappe.db.commit()


def run_stream(keep=False):
	"""The streaming path, end to end, with a scripted client instead of a model.

	Five things, in the order they can break:

	  1. the answer was readable *before* the turn finished, and grew;
	  2. `get_messages` hides the half-written row unless asked for it, and shows
	     it when asked — the compatibility promise the whole default rests on;
	  3. the finished row is complete, correct and no longer partial;
	  4. `chat_streaming: false` produces byte-identical text;
	  5. a client with no `stream` method takes the buffered path in silence.

	Tools are not exercised: the script always stops with `end_turn`, so this is
	about the transport. `run` is the one that puts a real model through `_loop`.
	"""
	original_flag = frappe.conf.get("chat_streaming")
	sessions = []
	try:
		# 1 + 2 — streaming on (the default)
		frappe.conf["chat_streaming"] = True
		client = _StreamingClient()
		streamed, row = _one_turn(client)
		sessions.append(streamed)

		print(f"{streamed.name} — streaming on")
		print(f"  partial lengths seen mid-turn: {client.snapshots}")
		growth = [b for a, b in zip(client.snapshots, client.snapshots[1:]) if b > a]
		assert client.snapshots, "no partial row was visible while the turn ran"
		# More than one step, or a single flush at the end would pass — which is
		# exactly the regression to catch (a throttle that never fires mid-stream
		# is indistinguishable from no streaming at all from the client's side).
		assert len(growth) >= 2, f"the partial row barely grew: {client.snapshots}"
		assert client.snapshots[0] < len(STREAM_ANSWER), "the first flush held the whole answer"
		# 2 — the endpoint's default must not carry a half-written message
		assert client.leaked, "the opt-in was never exercised"
		assert not any(client.leaked), (
			"get_messages() returned a partial row without partial=1 — every "
			"existing poller would skip past it and never see the finished message"
		)
		print("  get_messages() hid it by default, returned it with partial=1")

		print(f"  final: is_partial={row.is_partial} chars={len(row.text or '')}")
		assert not row.is_partial, "the finished message is still flagged partial"
		assert row.text == STREAM_ANSWER, "the stored text is not what the model said"
		assert json.loads(row.blocks or "[]"), "the finished message has no blocks to replay"

		# 4 — streaming off
		frappe.conf["chat_streaming"] = False
		buffered, buffered_row = _one_turn(_StreamingClient())
		sessions.append(buffered)
		print(f"{buffered.name} — streaming off")
		assert buffered_row.text == row.text, "the two paths disagree about the answer"
		assert not buffered_row.is_partial
		print("  identical text to the streamed turn")

		# 5 — a client that predates streaming, with the flag ON
		frappe.conf["chat_streaming"] = True
		legacy, legacy_row = _one_turn(_BufferedClient())
		sessions.append(legacy)
		print(f"{legacy.name} — client without stream(), flag on")
		assert legacy_row.text == row.text, "the fallback path produced a different answer"
		assert not legacy_row.is_partial
		print("  fell back to complete() cleanly")

		print("\nOK — streamed, finished clean, and both fallbacks match")
	finally:
		if original_flag is None:
			frappe.conf.pop("chat_streaming", None)
		else:
			frappe.conf["chat_streaming"] = original_flag
		if keep:
			print("\nkept: " + ", ".join(s.name for s in sessions))
		else:
			_cleanup(*sessions)
			print("\n(sessions deleted; pass --kwargs \"{'keep': True}\" to keep them)")


# ── Suggestions ──────────────────────────────────────────────────────────────
SUGGEST_REPLY = '["How did Royal Canin do last month?", "Which SKUs drove the lift?", "Show me the flat brands."]'
SUGGEST_EXPECTED = [
	"How did Royal Canin do last month?",
	"Which SKUs drove the lift?",
	"Show me the flat brands.",
]


class _SuggestClient(_BufferedClient):
	"""The scripted answer, then the scripted follow-ups.

	One client serves both calls of the turn because that is how the real one
	works — `chat/suggest.py` goes through the same `ai_client` seam as `_loop`,
	and a fake that could only answer once would hide the fact that the second
	call happens at all. They are told apart by the system prompt, which is the
	only thing that differs: the suggestion call carries `SUGGEST_PROMPT` and no
	tools.
	"""

	def __init__(self, session=None, delay=0, reply=None):
		super().__init__(session=session, delay=delay)
		self.reply = SUGGEST_REPLY if reply is None else reply
		self.suggest_calls = []

	def complete(self, model, system, messages, tools=None):
		if suggest.SUGGEST_PROMPT.split("\n")[0] not in (system or ""):
			return super().complete(model, system, messages, tools=tools)
		self.suggest_calls.append({"tools": tools, "text": messages[0]["content"][0]["text"]})
		return {
			"content": [{"type": "text", "text": self.reply}],
			"stop_reason": "end_turn",
			"usage": {"input_tokens": 30, "output_tokens": 20},
		}


def run_suggest(keep=False):
	"""The follow-up chips, end to end, with a scripted client instead of a model.

	Five things, in the order they can break:

	  1. the turn makes the extra call, with no tools and with the conversation
	     in it — a suggestion call that could reach data would be a second,
	     unaudited route to it;
	  2. the chips are stored on the newest assistant message;
	  3. `get_messages` returns them at the TOP LEVEL, to a caller whose cursor
	     is already past that message — which is the whole reason they are not a
	     field on it, and the one failure that would make the feature invisible
	     while every other assertion here still passed;
	  4. a Running session offers none, so last turn's chips never sit under a
	     question already being answered;
	  5. `chat_suggestions: false` leaves the turn byte-identical and silent.

	`_parse` is checked separately, on the payloads a real model actually
	produces: prose, a fenced array, objects, duplicates, an essay.
	"""
	_check_parse()

	original_flag = frappe.conf.get("chat_suggestions")
	sessions = []
	try:
		# 1 + 2 + 3 — on (the default)
		frappe.conf["chat_suggestions"] = True
		client = _SuggestClient()
		session, row = _one_turn(client)
		sessions.append(session)

		print(f"{session.name} — suggestions on")
		assert len(client.suggest_calls) == 1, f"expected one extra call, got {len(client.suggest_calls)}"
		call = client.suggest_calls[0]
		assert not call["tools"], "the suggestion call was given tools"
		assert "How many sales orders" in call["text"], "the question never reached the prompt"
		assert STREAM_ANSWER[:20] in call["text"], "the answer never reached the prompt"
		print(f"  one extra call, no tools, {len(call['text'])} chars of transcript")

		stored = frappe.db.get_value(
			"OS Chat Message",
			{"session": session.name, "role": "assistant"},
			["name", "suggestions"],
			order_by="seq desc",
			as_dict=True,
		)
		assert json.loads(stored.suggestions or "[]") == SUGGEST_EXPECTED, (
			f"stored suggestions are {stored.suggestions}"
		)
		print(f"  stored on {stored.name}")

		# 3 — read the way a poller reads them: cursor past the last message.
		last_seq = frappe.db.get_value(
			"OS Chat Message", {"session": session.name}, "seq", order_by="seq desc"
		)
		polled = chat_api.get_messages(session.name, after=last_seq, partial=1)
		assert not polled["messages"], "the cursor was not actually past everything"
		assert polled["suggestions"] == SUGGEST_EXPECTED, (
			"get_messages returned no suggestions to a poller past its cursor — "
			"which is every client, on the poll that sees the turn finish"
		)
		print("  get_messages served them with an empty message list")

		# 4 — nothing while a turn is in flight
		frappe.db.set_value("OS Chat Session", session.name, "status", "Running")
		running = chat_api.get_messages(session.name, after=0)
		assert running["suggestions"] == [], "a Running session offered last turn's chips"
		frappe.db.set_value("OS Chat Session", session.name, "status", "Idle")
		print("  none offered while Running")

		# 5 — off
		frappe.conf["chat_suggestions"] = False
		quiet_client = _SuggestClient()
		quiet, quiet_row = _one_turn(quiet_client)
		sessions.append(quiet)
		print(f"{quiet.name} — suggestions off")
		assert not quiet_client.suggest_calls, "the extra call was made anyway"
		assert quiet_row.text == row.text, "turning suggestions off changed the answer"
		assert chat_api.get_messages(quiet.name, after=0)["suggestions"] == []
		print("  no extra call, identical answer, no chips")

		print("\nOK — generated, stored, served past the cursor, and silent when off")
	finally:
		if original_flag is None:
			frappe.conf.pop("chat_suggestions", None)
		else:
			frappe.conf["chat_suggestions"] = original_flag
		if keep:
			print("\nkept: " + ", ".join(s.name for s in sessions))
		else:
			_cleanup(*sessions)
			print("\n(sessions deleted; pass --kwargs \"{'keep': True}\" to keep them)")


def _check_parse():
	"""What the parser must survive. No database, no client.

	Every case here is something a real model has done or will: wrap the array in
	a fence, explain itself first, return objects, repeat itself, or write a
	paragraph where a question was asked for. None of them may produce a chip,
	and none of them may raise — a suggestion is a nicety, and `run_turn` has
	already committed the answer by the time this code runs.
	"""
	cases = [
		('["a", "b"]', ["a", "b"]),
		('```json\n["a", "b"]\n```', ["a", "b"]),
		('["a", "b", "c", "d"]', ["a", "b", "c"]),  # capped
		('["a", "A", "b"]', ["a", "b"]),  # deduped, case-insensitively
		('["a", "", "  ", "b"]', ["a", "b"]),  # empties dropped
		(f'["{"x" * 200}", "b"]', ["b"]),  # over-long dropped, not truncated
		("[]", None),
		('[{"q": "a"}]', None),  # objects, not strings
		("Here are three ideas: ...", None),  # prose
		('{"suggestions": ["a"]}', None),  # keyed, not an array
		("", None),
		(None, None),
	]
	for payload, expected in cases:
		got = suggest._parse(payload)
		assert got == expected, f"_parse({payload!r}) -> {got!r}, expected {expected!r}"
	print(f"_parse: {len(cases)} payloads handled, none raised")


def run_stream_live(question=None):
	"""Does THIS site's provider actually stream? One real call, no session.

	`run_stream` proves the plumbing with a scripted client; this proves the
	provider, which the scripted one cannot: `ai_base_url` may point at a proxy
	that accepts `stream=True` and then returns the answer in one piece, and
	`runner._streaming_step` falls back to a buffered call without complaint. That
	silence is right for a live turn — better a whole answer than a failed one —
	and wrong for a deployment check, which is why this exists.

	Prints the chunk count. One chunk means no streaming, however well it worked.
	"""
	question = question or (
		"Count from one to twenty in words, one per line, with no other text."
	)
	if not llm.streaming_available():
		print("this site's ai_client has no stream() — every turn takes the buffered path")
		return

	chunks = []
	response = llm.stream(
		runner.default_model(),
		"You are a terse assistant.",
		[{"role": "user", "content": question}],
		on_text=chunks.append,
	)

	text = "".join(chunks)
	print(f"model: {runner.default_model()}")
	print(f"chunks: {len(chunks)}  chars: {len(text)}")
	print(f"stop_reason: {response.get('stop_reason')}  usage: {response.get('usage')}")
	print(f"first three: {chunks[:3]}")
	if len(chunks) > 1:
		print("\nOK — the provider streams. Turns on this site show text as it arrives.")
	else:
		print(
			"\nNOT STREAMING — the answer arrived in one piece. The turn will still "
			"work, but the UI gains nothing. Check ai_base_url: a proxy that buffers "
			"looks exactly like this."
		)
