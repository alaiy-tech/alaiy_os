"""One full chat turn, synchronously, from the command line.

	bench --site <site> execute alaiy_os.chat.smoke.run
	bench --site <site> execute alaiy_os.chat.smoke.run --kwargs "{'question': '...'}"

Runs the loop in-process rather than enqueueing it, so it needs no worker and
you see the traceback rather than digging it out of the Error Log. It costs one
real LLM call and its tools touch live data — the default question is read-only,
so keep it that way unless you mean it.

`--kwargs "{'user': 'someone@example.com'}"` runs the turn as that user, which
is how you check that the tool list really does shrink for a non-manager.
"""

import json

import frappe

from alaiy_os.chat import runner, tools

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
		fields=["seq", "role", "text", "blocks"],
		order_by="seq asc",
	):
		blocks = json.loads(row.blocks)
		calls = [b["name"] for b in blocks if b.get("type") == "tool_use"]
		errors = sum(1 for b in blocks if b.get("type") == "tool_result" and b.get("is_error"))
		suffix = f" -> {', '.join(calls)}" if calls else (f" ({errors} failed)" if errors else "")
		print(f"[{row.seq}] {row.role}{suffix}")
		if row.text:
			print(f"    {row.text[:800]}")

	if keep:
		print(f"\nkept: {session.name}")
	else:
		frappe.delete_doc("OS Chat Session", session.name, force=True)
		frappe.db.commit()
		print("\n(session deleted; pass --kwargs \"{'keep': True}\" to keep it)")
