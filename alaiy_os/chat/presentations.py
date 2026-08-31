"""Turning a slide outline the model has written into a .pptx deck.

The presentation sibling of `exports.py`: a normalised structure in, bytes
out, no Frappe documents — so, like that module, it can be exercised without
a site. The Frappe side (the `File` row, the permission, the download chip)
lives in `artifacts.py`, in `create_presentation()`.

## Why a separate tool, not a fourth `create_download` format

`create_download`'s schema is a table: columns and rows. A presentation is
not a table — it's an ordered sequence of slides, each with its own shape
(a heading and a subtitle, or a heading and bullets, or a heading and a
table). Forcing that into columns/rows would mean encoding slide structure as
magic column names, which is exactly the kind of implicit contract this
codebase avoids everywhere else. One tool, one schema that matches what it
actually produces — the same reasoning `create_download`'s own docstring
gives for being one tool with a format enum rather than three.

## Slide types

    title:   heading, subtitle (optional) — meant for the first slide.
    bullets: heading, bullets (a list of strings).
    table:   heading, columns, rows — the same columns/rows shape
             `create_download` uses, so the model reuses what it already
             knows rather than learning a second way to describe a table.

Capped much smaller than a `create_download` table (`MAX_TABLE_ROWS` here vs.
`exports.MAX_ROWS`): a table on a slide is read at a glance, not scrolled —
past a dozen rows it stops being a slide and starts being a spreadsheet
someone pasted in, which is what `create_download` is for. Every throw below
says so.

A slide with an unrecognised type is refused outright, not skipped: silently
dropping content the user asked for is a worse failure than a visible error
the model can read and correct.
"""

import io
import os
import re

import frappe

MAX_SLIDES = 20
MAX_BULLETS_PER_SLIDE = 8
MAX_BULLET_CHARS = 200
MAX_HEADING_CHARS = 100

# A table slide is read at a glance, not scrolled -- see the module docstring.
MAX_TABLE_ROWS = 12
MAX_TABLE_COLUMNS = 6

# Checked after generation, the same way exports.MAX_BYTES is: embedded
# fonts/theme data make a .pptx's size a function of python-pptx's template,
# not just of how much text went in, so it's only knowable once written.
MAX_BYTES = 5 * 1024 * 1024

MAX_FILE_NAME_CHARS = 80

# Anything that is not plainly part of a file name. Mirrors
# exports._UNSAFE_NAME, duplicated rather than imported: that one is private
# to exports.py, and the two modules should stay free to diverge (e.g. if a
# future format needs a character this one doesn't).
_UNSAFE_NAME = re.compile(r"[^A-Za-z0-9 ._+-]+")

SLIDE_TYPES = ("title", "bullets", "table")


def safe_file_name(name):
	"""A file name from a language model, made safe -- no extension.

	Unlike `exports.safe_file_name`, which looks up the extension in
	`exports.EXTENSIONS`: pptx deliberately isn't one of those (see this
	module's own docstring), so the caller appends `.pptx` itself.
	"""
	base = os.path.basename(str(name or "").strip()) or "presentation"
	base = os.path.splitext(base)[0]
	base = _UNSAFE_NAME.sub("-", base).strip(" .-") or "presentation"
	return base[:MAX_FILE_NAME_CHARS]


def _text(value, limit):
	"""One value as a capped string. `None` is empty, not "None"."""
	if value is None:
		return ""
	text = value if isinstance(value, str) else str(value)
	if len(text) > limit:
		return text[:limit] + "…"
	return text


def normalise(slides):
	"""`slides`, validated and every cap applied. Throws when one is hit.

	Mirrors `exports.normalise`: every throw is written for the model to read
	back as a `tool_result` and act on, since that is its only route to
	recovering from a bad call.
	"""
	if not slides:
		frappe.throw(frappe._("A presentation needs at least one slide."))
	if len(slides) > MAX_SLIDES:
		frappe.throw(
			frappe._("{0} slides is more than the {1} a presentation can hold. Cut it down.").format(
				len(slides), MAX_SLIDES
			)
		)

	out = []
	for index, slide in enumerate(slides):
		position = index + 1
		if not isinstance(slide, dict):
			frappe.throw(
				frappe._("Slide {0} must be an object with at least a type and a heading.").format(position)
			)

		kind = slide.get("type")
		if kind not in SLIDE_TYPES:
			frappe.throw(
				frappe._('Slide {0} has type "{1}", which is not one of: {2}.').format(
					position, kind, ", ".join(SLIDE_TYPES)
				)
			)

		heading = _text(slide.get("heading"), MAX_HEADING_CHARS)
		if not heading:
			frappe.throw(frappe._("Slide {0} needs a heading.").format(position))

		if kind == "title":
			out.append(
				{
					"type": "title",
					"heading": heading,
					"subtitle": _text(slide.get("subtitle"), MAX_HEADING_CHARS),
				}
			)
			continue

		if kind == "bullets":
			bullets = [b for b in (_text(b, MAX_BULLET_CHARS) for b in (slide.get("bullets") or [])) if b]
			if not bullets:
				frappe.throw(
					frappe._('Slide {0} ("{1}") is type "bullets" but has no bullets.').format(position, heading)
				)
			if len(bullets) > MAX_BULLETS_PER_SLIDE:
				frappe.throw(
					frappe._(
						'Slide {0} ("{1}") has {2} bullets, more than the {3} that fit on one '
						"slide. Split it across slides."
					).format(position, heading, len(bullets), MAX_BULLETS_PER_SLIDE)
				)
			out.append({"type": "bullets", "heading": heading, "bullets": bullets})
			continue

		# table
		columns = [_text(c, MAX_HEADING_CHARS) for c in (slide.get("columns") or [])]
		if not columns:
			frappe.throw(
				frappe._('Slide {0} ("{1}") is type "table" but has no columns.').format(position, heading)
			)
		if len(columns) > MAX_TABLE_COLUMNS:
			frappe.throw(
				frappe._(
					'Slide {0} ("{1}") has {2} columns, more than the {3} that fit on one '
					'slide. Drop some, or use create_download for the full table.'
				).format(position, heading, len(columns), MAX_TABLE_COLUMNS)
			)

		rows = []
		for row in slide.get("rows") or []:
			if not isinstance(row, (list, tuple)):
				frappe.throw(
					frappe._('Slide {0} ("{1}"): every row must be a list of values, one per column.').format(
						position, heading
					)
				)
			values = [_text(v, MAX_HEADING_CHARS) for v in row[: len(columns)]]
			values += [""] * (len(columns) - len(values))
			rows.append(values)
		if not rows:
			frappe.throw(
				frappe._('Slide {0} ("{1}") is type "table" but has no rows.').format(position, heading)
			)
		if len(rows) > MAX_TABLE_ROWS:
			frappe.throw(
				frappe._(
					'Slide {0} ("{1}") has {2} rows, more than the {3} that fit on one slide. '
					"Summarise, or use create_download for the full table."
				).format(position, heading, len(rows), MAX_TABLE_ROWS)
			)

		out.append({"type": "table", "heading": heading, "columns": columns, "rows": rows})

	return out


def write_pptx(slides, deck_title=None):
	"""Bytes of one .pptx file. `slides` must have already been through `normalise`.

	`deck_title` is currently unused by the writer itself — python-pptx has no
	document-properties call cheap enough to be worth a second code path here —
	but is accepted for the same shape `exports.write` takes, and is where core
	properties (title/author) would go if a reader ever asked for them.
	"""
	from pptx import Presentation
	from pptx.util import Inches, Pt

	deck = Presentation()
	# 16:9, not python-pptx's 4:3 default -- every deck viewer opens widescreen
	# now, and a 4:3 export reads as a decade out of date.
	deck.slide_width = Inches(13.333)
	deck.slide_height = Inches(7.5)

	title_layout = deck.slide_layouts[0]
	bullet_layout = deck.slide_layouts[1]
	blank_layout = deck.slide_layouts[6]

	for slide in slides:
		if slide["type"] == "title":
			s = deck.slides.add_slide(title_layout)
			s.shapes.title.text = slide["heading"]
			if slide["subtitle"] and len(s.placeholders) > 1:
				s.placeholders[1].text = slide["subtitle"]
			continue

		if slide["type"] == "bullets":
			s = deck.slides.add_slide(bullet_layout)
			s.shapes.title.text = slide["heading"]
			body = s.placeholders[1].text_frame
			body.clear()
			for i, bullet in enumerate(slide["bullets"]):
				paragraph = body.paragraphs[0] if i == 0 else body.add_paragraph()
				paragraph.text = bullet
			continue

		# table -- built on a blank layout: the built-in "Title and Content"
		# layout's content placeholder is sized for text, not for
		# `add_table`, which wants explicit inches regardless.
		s = deck.slides.add_slide(blank_layout)
		heading_box = s.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(12.3), Inches(0.8))
		heading_frame = heading_box.text_frame
		heading_frame.text = slide["heading"]
		heading_frame.paragraphs[0].font.size = Pt(28)
		heading_frame.paragraphs[0].font.bold = True

		row_count, col_count = len(slide["rows"]) + 1, len(slide["columns"])
		table_shape = s.shapes.add_table(
			row_count, col_count, Inches(0.5), Inches(1.3), Inches(12.3), Inches(0.5 * row_count)
		)
		table = table_shape.table
		for col_index, heading in enumerate(slide["columns"]):
			cell = table.cell(0, col_index)
			cell.text = heading
			cell.text_frame.paragraphs[0].font.bold = True
		for row_index, row in enumerate(slide["rows"], start=1):
			for col_index, value in enumerate(row):
				table.cell(row_index, col_index).text = value

	buffer = io.BytesIO()
	deck.save(buffer)
	return buffer.getvalue()
