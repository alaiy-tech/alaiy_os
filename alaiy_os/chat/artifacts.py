"""Files the assistant produced, and how they reach the user.

`exports.py` writes bytes. This module is the Frappe half: the `File` row, the
permission it inherits, and the meta dict that becomes a download chip in the
chat. Nothing here decides *what* to write.

## The channel

A tool's *result* never reaches the client — `api/chat._present` drops it on
purpose, because it is raw JSON the model has already summarised and can be
megabytes. So a `file_url` returned from a tool would be seen by the model and by
nobody else.

What `_present` does ship, per message, is the `attachments` column. It already
carries uploads, the React panel already draws a chip from one, and the shape has
room for a marker. So a generated file rides that column too:

    tool runs, calls create()  ──▶ record() on frappe.local
    runner._loop               ──▶ drain() ──▶ _append(assistant, attachments=…)
    api/chat._present          ──▶ the chip, with its file_url

The collector exists because the two events are one iteration of `_loop` apart. A
tool runs *after* the `stop_reason` check, so a drain is always followed by
another pass — which means the chip lands on the message where the model says
"here it is", rather than on the tool-result message, which is `role: user` and
would render as though the user had attached it.

## Why a collector and not a return convention

`engine/executor.py` reads `value["_content_blocks"]` off a batch tool's return,
and mirroring that here was the obvious move. It is worse: every tool that wants
to emit a file — tenant-provided ones included — becomes responsible for a key
`runner._run_tools` must remember to pop, and `_run_tools` json-dumps the whole
return value one line later. A missed pop ships the file's URL to the model as
tokens, which is exactly the hallucinated-link failure the system prompt is
fighting. A collector has one writer, one reader, and nothing to forget.

## Rollback

`runner.run_turn` rolls back on an exception, which unwinds the `File` row but not
the bytes on disk. That is the same litter `api/chat.upload_attachment` already
accepts by parsing before saving, and it is not worth a second commit inside a
tool to avoid.
"""

import frappe
from frappe.utils.file_manager import save_file

from alaiy_os.chat import exports, presentations

# A turn that produces a fourth file is a model looping, not a user with four
# questions — and each one is a `save_file` plus, for pdf, a subprocess. Both
# tools below share this one cap: a deck counts as a file exactly the way a
# spreadsheet does, so a turn that makes two of each is still "too many
# files," not "two files of each kind, fine."
MAX_PER_TURN = 3

TOOL = "create_download"
PRESENTATION_TOOL = "create_presentation"

_LOCAL = "chat_artifacts"
_LOCAL_SESSION = "chat_artifacts_session"


# ── The per-turn collector ───────────────────────────────────────────────────
def reset(session):
	"""Start a turn: no artifacts owed, and this is the session they belong to.

	Called once by `runner.run_turn`, after the worker has been pinned to the
	session's owner. Jobs on the `long` queue share a worker process, so a turn
	that died between `create()` and the drain would otherwise hand its file to
	the next session's first assistant message.
	"""
	frappe.local.chat_artifacts = []
	frappe.local.chat_artifacts_session = session


def session():
	"""The session the current turn is writing to, or None outside a turn.

	Bound through `frappe.local` rather than threaded down through
	`tools._surface` / `tool_specs` / `call_tool`, which are about permissions and
	have no business knowing what a chat session is. `api/chat.list_tools` calls
	`tool_specs()` with no session at all — under this binding it lists
	`create_download` and, correctly, could not run it.
	"""
	return getattr(frappe.local, _LOCAL_SESSION, None)


def record(meta):
	artifacts = getattr(frappe.local, _LOCAL, None)
	if artifacts is None:
		artifacts = frappe.local.chat_artifacts = []
	artifacts.append(meta)


def drain():
	"""Everything recorded since the last drain, and clear it.

	Returning *and* clearing in one call is what stops the same meta being
	attached to two messages if `_loop` runs another iteration.
	"""
	artifacts = getattr(frappe.local, _LOCAL, None) or []
	frappe.local.chat_artifacts = []
	return artifacts


# ── The tool ────────────────────────────────────────────────────────────────
def create(file_name=None, format=None, columns=None, rows=None, title=None):
	"""Write one table to a file and stage it as a download. The tool body.

	Argument names are the tool's schema, `format` shadowing the builtin
	included: they are what the model writes, so they read as the model sees
	them.
	"""
	target = session()
	if not target:
		# Reachable from `list_tools` or a hand-made call, never from a turn.
		frappe.throw(frappe._("Files can only be created inside a chat."))

	existing = getattr(frappe.local, _LOCAL, None) or []
	if len(existing) >= MAX_PER_TURN:
		frappe.throw(
			frappe._(
				"You have already made {0} files in this reply, which is the limit. "
				"Answer with what you have."
			).format(len(existing))
		)

	fmt = exports.check_format(format)
	columns, rows = exports.normalise(columns, rows, fmt)
	content = exports.write(
		fmt,
		columns,
		rows,
		title=title or file_name,
		# The clock is passed in, not read in `exports`: that module stays free of
		# anything needing a site, which is what makes the writers testable.
		generated=frappe.utils.now_datetime().strftime("%d %b %Y %H:%M"),
	)

	if len(content) > exports.MAX_BYTES:
		# Only knowable here. A pdf's size is not a function of its row count.
		frappe.throw(
			frappe._("That file came to {0} MB; the limit is {1} MB. Export fewer rows.").format(
				round(len(content) / 1024 / 1024, 1), round(exports.MAX_BYTES / 1024 / 1024, 1)
			)
		)

	name = exports.safe_file_name(file_name, fmt)
	# Two `sales.xlsx` in one session are indistinguishable in the chip rail, and
	# `save_file` de-duplicates by content hash — so the second upload of the
	# same name may not even get its own row.
	stem, extension = name[: -len(exports.EXTENSIONS[fmt])], exports.EXTENSIONS[fmt]
	name = f"{stem}-{frappe.generate_hash(length=6)}{extension}"

	# Private, and attached to the *session* — the same call as
	# `api/chat.upload_attachment`, for the same reason: `File.has_permission`
	# delegates to the attached document for private files, and `OS Chat Session`
	# grants the `All` role `if_owner` only, so attaching to the session IS the
	# permission. Never attach to the message: `OSChatSession.on_trash` deletes
	# messages with `frappe.db.delete`, which fires no cascade, so a File hung off
	# a message would never be unlinked.
	file_doc = save_file(name, content, "OS Chat Session", target, is_private=1)

	meta = {
		# The marker. `runner._elide_old_attachments` reads it to know this row is
		# not an upload and its positional contract does not apply.
		"kind": "artifact",
		"file_name": name,
		"file_url": file_doc.file_url,
		"file_size": len(content),
		"format": fmt,
		"rows": len(rows),
		"columns": len(columns),
	}
	record(meta)

	# URL-free AND name-free, the second on hard evidence. Told only that
	# "top-skus-8c7051.xlsx" exists, gemini-3.1-flash-lite wrote
	# "[top_skus.xlsx](sandbox:/tmp/top_skus-8c7051.xlsx)" — it took the name and
	# invented a plausible path around it, hash and all. Telling it not to in the
	# system prompt did not stop that, so the name is withheld instead: a path
	# cannot be reconstructed from a filename that was never supplied.
	#
	# Nothing is lost. The chip beneath the reply carries the name, which is where
	# the user reads it anyway, and prose refers to "the Excel file" perfectly
	# well without it. Two files in one reply are distinguishable by format and by
	# what the model put in them.
	return {
		"status": "done",
		"format": fmt,
		"rows": len(rows),
		"columns": len(columns),
		"size_kb": round(len(content) / 1024, 1),
		"delivered": (
			"The user can already see and download this file: a chip is attached "
			"beneath your reply automatically. You have not been told its name or "
			"location because you do not need them and must not repeat them. Say "
			"what the file contains, in prose. Do not write a link, a path, or a "
			"file name."
		),
	}


#: The tool as `chat/tools.py` serves it — the same
#: `{name, description, input_schema, run}` shape a `chat_tool_sources` entry
#: uses, because one shape for provided tools is simpler than two.
#:
#: One tool with a format enum, not three tools. Three would repeat this schema
#: three times in every request — and the `rows` description is most of the token
#: cost — and would make the model choose a format before it has the data, which
#: is the moment the row count that should decide xlsx-vs-csv is still unknown.
#: The enum also lets an oversize throw name the format to switch to, which is
#: the model's only route out.
TOOL_SPEC = {
	"name": TOOL,
	"description": (
		"Write a table to a file the user can download: xlsx, csv or pdf. Pass the "
		"rows you have already retrieved with another tool — this tool reads no "
		"data of its own. The user is shown a download link automatically; do not "
		"write a URL yourself. Use it when someone asks for a file, an export, a "
		"spreadsheet or a report, and offer it when your answer is a long table "
		"they will want outside the chat."
	),
	"input_schema": {
		"type": "object",
		"properties": {
			"format": {
				"type": "string",
				"enum": list(exports.FORMATS),
				"description": (
					"xlsx for anything anyone will sort or total, csv when asked for one "
					"or when the table is very large, pdf only for a document to print "
					f"or forward (capped at {exports.MAX_PDF_ROWS} rows)."
				),
			},
			"file_name": {
				"type": "string",
				"description": "What to call it, without an extension. Descriptive, not generic.",
			},
			"title": {
				"type": "string",
				"description": "Heading inside the file. Defaults to the file name.",
			},
			"columns": {
				"type": "array",
				"items": {"type": "string"},
				"description": f"Column headings, in order. At most {exports.MAX_COLUMNS}.",
			},
			# A cell is declared as a single "string" type, not a union of
			# string/number/null. Gemini's function declarations are an OpenAPI
			# subset that rejects a type array outright — it reports the inner
			# `items` as having a missing field — and this schema has to survive
			# every provider the `ai_client` seam fronts, not just Anthropic.
			#
			# Nothing is lost by it. `exports.normalise` stringifies every cell
			# anyway for one comparable definition of "cell", and `exports._typed`
			# turns a figure back into a real number when writing xlsx, so a model
			# that sends 412000.5 and one that sends "412000.5" produce the same
			# spreadsheet.
			"rows": {
				"type": "array",
				"items": {"type": "array", "items": {"type": "string"}},
				"description": (
					"The data, one array per row, values in the same order as columns. "
					"Write a figure as a plain number with no currency symbol and no "
					"thousands separators, and an empty cell as an empty string, so the "
					f"file stays sortable. At most {exports.MAX_ROWS} rows."
				),
			},
		},
		"required": ["format", "file_name", "columns", "rows"],
	},
	"run": lambda args: create(**{k: args.get(k) for k in ("file_name", "format", "columns", "rows", "title")}),
}


# ── The presentation tool ───────────────────────────────────────────────────
def create_presentation(file_name=None, title=None, slides=None):
	"""Write a slide outline to a .pptx file and stage it as a download.

	Mirrors `create()` almost line for line — same session/cap/attach
	machinery, see that function's own comments for why each piece is shaped
	the way it is. The only real difference is the writer: `presentations.py`
	takes a slide outline instead of a table.
	"""
	target = session()
	if not target:
		frappe.throw(frappe._("Files can only be created inside a chat."))

	existing = getattr(frappe.local, _LOCAL, None) or []
	if len(existing) >= MAX_PER_TURN:
		frappe.throw(
			frappe._(
				"You have already made {0} files in this reply, which is the limit. "
				"Answer with what you have."
			).format(len(existing))
		)

	normalised = presentations.normalise(slides)
	content = presentations.write_pptx(normalised, deck_title=title or file_name)

	if len(content) > presentations.MAX_BYTES:
		frappe.throw(
			frappe._("That presentation came to {0} MB; the limit is {1} MB. Cut some slides.").format(
				round(len(content) / 1024 / 1024, 1), round(presentations.MAX_BYTES / 1024 / 1024, 1)
			)
		)

	# No `exports.safe_file_name`: that helper looks up the extension in
	# `exports.EXTENSIONS`, which pptx deliberately isn't part of -- see
	# `presentations.py`'s own module docstring for why this is a separate
	# tool rather than a fourth `create_download` format.
	name = presentations.safe_file_name(file_name) + ".pptx"
	stem = name[: -len(".pptx")]
	name = f"{stem}-{frappe.generate_hash(length=6)}.pptx"

	file_doc = save_file(name, content, "OS Chat Session", target, is_private=1)

	meta = {
		"kind": "artifact",
		"file_name": name,
		"file_url": file_doc.file_url,
		"file_size": len(content),
		"format": "pptx",
		"slides": len(normalised),
	}
	record(meta)

	return {
		"status": "done",
		"format": "pptx",
		"slides": len(normalised),
		"size_kb": round(len(content) / 1024, 1),
		"delivered": (
			"The user can already see and download this presentation: a chip is "
			"attached beneath your reply automatically. You have not been told its "
			"name or location because you do not need them and must not repeat "
			"them. Say what the deck contains, in prose. Do not write a link, a "
			"path, or a file name."
		),
	}


#: Same `{name, description, input_schema, run}` shape as `TOOL_SPEC` above.
PRESENTATION_TOOL_SPEC = {
	"name": PRESENTATION_TOOL,
	"description": (
		"Write an actual slide deck (.pptx) the user can download — a title "
		"slide, narrative sections, and/or a small data table per slide. Not for "
		"exporting a full dataset; use create_download for that. Use this when "
		"someone asks for a presentation, slides, or a deck."
	),
	"input_schema": {
		"type": "object",
		"properties": {
			"file_name": {
				"type": "string",
				"description": "What to call it, without an extension. Descriptive, not generic.",
			},
			"title": {
				"type": "string",
				"description": "The deck's title. Defaults to the file name.",
			},
			"slides": {
				"type": "array",
				"description": f"The slides, in order. At most {presentations.MAX_SLIDES}.",
				"items": {
					"type": "object",
					"properties": {
						"type": {
							"type": "string",
							"enum": list(presentations.SLIDE_TYPES),
							"description": (
								'"title" for a heading/subtitle slide (normally the first slide), '
								'"bullets" for a heading plus a short list of points, "table" for '
								"a heading plus a small data table."
							),
						},
						"heading": {"type": "string", "description": "Every slide needs one."},
						"subtitle": {
							"type": "string",
							"description": '"title" slides only.',
						},
						"bullets": {
							"type": "array",
							"items": {"type": "string"},
							"description": (
								f'"bullets" slides only. At most {presentations.MAX_BULLETS_PER_SLIDE} '
								"— split a longer list across more slides rather than shrinking "
								"the text to fit."
							),
						},
						"columns": {
							"type": "array",
							"items": {"type": "string"},
							"description": (
								f'"table" slides only. Column headings, in order. At most '
								f"{presentations.MAX_TABLE_COLUMNS} — a slide is read at a glance, "
								"not scrolled, so use create_download instead for a full table."
							),
						},
						"rows": {
							"type": "array",
							"items": {"type": "array", "items": {"type": "string"}},
							"description": (
								f'"table" slides only. One array per row, values in the same order '
								f"as columns. At most {presentations.MAX_TABLE_ROWS}."
							),
						},
					},
					"required": ["type", "heading"],
				},
			},
		},
		"required": ["file_name", "slides"],
	},
	"run": lambda args: create_presentation(
		**{k: args.get(k) for k in ("file_name", "title", "slides")}
	),
}
