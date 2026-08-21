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

`dump` prints a stored session in full — tool arguments AND tool results, which
`api/chat.get_messages` deliberately withholds and no client therefore shows. It
is the only way to see *why* a model retried a tool eleven times, so it is the
first thing to reach for when a turn went in circles.

	bench --site <site> execute alaiy_os.chat.smoke.dump
	bench --site <site> execute alaiy_os.chat.smoke.dump --kwargs "{'session': 'CHAT-2026-00107'}"
"""

import json

import frappe

from alaiy_os.chat import artifacts, runner, tools

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
