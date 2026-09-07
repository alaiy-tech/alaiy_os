"""Render a .pptx into one image per slide, so the file panel can show the
*actual* deck rather than a reconstruction of its content.

    api/chat.preview_file ──▶ render_slides(file_doc)
                                  │
                                  ├─ soffice --convert-to pdf   (LibreOffice)
                                  └─ PyMuPDF rasterises each page
                                          │
                                          ▼
                                  one File per slide, cached against
                                  the same OS Chat Session

Two things make this optional rather than load-bearing:

* **LibreOffice may not be installed.** `soffice_binary()` returns None then,
  and `api/chat.preview_file` falls back to the structural read
  (title/bullets/table/chart) that needs no system dependency. A deck still
  opens; it just isn't pixel-exact.
* **It is slow the first time.** A cold LibreOffice takes a few seconds, so
  the result is cached as real `File` rows and every later open is a plain
  read. See `_cached()`.

PyMuPDF does the rasterising because it is already installed in the bench env
and needs no poppler binaries.
"""

import os
import re
import shutil
import subprocess
import tempfile

import frappe
from frappe.utils.file_manager import save_file

#: Wide enough to look sharp on a full display without turning a 40-slide deck
#: into 40 megabytes. 110 DPI of a 13.33in slide is ~1467px.
SLIDE_DPI = 110

#: A deck past this is almost certainly not something anyone previews slide by
#: slide, and rendering it would tie up a worker for a long time.
MAX_SLIDES = 60

#: LibreOffice cold-starts, and a corrupt file can hang the filter rather than
#: fail it, so the conversion never gets to wait forever.
CONVERT_TIMEOUT = 120

#: Marks the rendered images so they can be found again (the cache) and told
#: apart from the deck itself in a chip list.
RENDER_PREFIX = "slide-render"


def soffice_binary():
	"""Path to a usable `soffice`, or None if this site can't render decks.

	Checked in order of how deliberate the choice is: an explicit
	`soffice_path` in site_config wins, then a `SOFFICE_BIN` env var, then
	whatever is on PATH. The first two exist because a box without root can
	only have LibreOffice somewhere non-standard — on this dev machine it is a
	relocated copy under `~/opt/lo` — while a production host installs the
	package properly and needs none of it.
	"""
	explicit = frappe.conf.get("soffice_path") or os.environ.get("SOFFICE_BIN")
	if explicit and os.path.isfile(explicit) and os.access(explicit, os.X_OK):
		return explicit

	for name in ("soffice", "libreoffice"):
		found = shutil.which(name)
		if found:
			return found
	return None


def _slide_name(base, index):
	return f"{RENDER_PREFIX}-{base}-{index:03d}.png"


def _cached(session, base, expected=None):
	"""Previously rendered slide URLs for this deck, in slide order.

	`expected` guards a half-finished render: if a previous attempt died
	part-way (worker restart, timeout) the cache would otherwise be served as
	if it were the whole deck.
	"""
	rows = frappe.get_all(
		"File",
		filters={
			"attached_to_doctype": "OS Chat Session",
			"attached_to_name": session,
			"file_name": ("like", f"{RENDER_PREFIX}-{base}-%"),
		},
		fields=["file_name", "file_url"],
	)
	if not rows:
		return None
	if expected is not None and len(rows) != expected:
		return None

	# Sort on the zero-padded index in the name, not creation order: the rows
	# come back in whatever order the query gives.
	rows.sort(key=lambda r: r.file_name)
	return [r.file_url for r in rows]


def render_slides(file_doc, session):
	"""One image URL per slide, or None if this site can't render.

	`file_doc` is the deck's `File`; `session` the chat it hangs off, which is
	what the rendered images get attached to so they inherit the same
	permission gate as everything else in the conversation.
	"""
	soffice = soffice_binary()
	if not soffice:
		return None

	# Strip the random suffix Frappe adds, and anything that isn't safe in a
	# file name, so the cache key is stable across opens.
	base = re.sub(r"[^A-Za-z0-9_-]+", "-", os.path.splitext(file_doc.file_name or "deck")[0])[:60]

	hit = _cached(session, base)
	if hit:
		return hit

	content = file_doc.get_content()

	with tempfile.TemporaryDirectory() as work:
		source = os.path.join(work, "deck.pptx")
		with open(source, "wb") as handle:
			handle.write(content)

		try:
			subprocess.run(
				[
					soffice,
					"--headless",
					"--norestore",
					# Its own profile per run, in the temp dir: two conversions
					# sharing one profile makes the second fail outright,
					# because LibreOffice takes a lock on it.
					f"-env:UserInstallation=file://{work}/profile",
					"--convert-to",
					"pdf",
					"--outdir",
					work,
					source,
				],
				capture_output=True,
				timeout=CONVERT_TIMEOUT,
				check=False,
			)
		except subprocess.TimeoutExpired:
			frappe.log_error(f"soffice timed out rendering {file_doc.name}", "Slide render")
			return None

		pdf = os.path.join(work, "deck.pdf")
		if not os.path.exists(pdf):
			# Not an exception: the caller falls back to the structural read,
			# which is a worse preview but still a preview.
			frappe.log_error(f"soffice produced no PDF for {file_doc.name}", "Slide render")
			return None

		import pymupdf

		document = pymupdf.open(pdf)
		try:
			count = min(document.page_count, MAX_SLIDES)
			urls = []
			for index in range(count):
				pixmap = document.load_page(index).get_pixmap(dpi=SLIDE_DPI)
				saved = save_file(
					_slide_name(base, index + 1),
					pixmap.tobytes("png"),
					"OS Chat Session",
					session,
					is_private=1,
				)
				urls.append(saved.file_url)
		finally:
			document.close()

	return urls
