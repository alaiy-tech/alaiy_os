"""Tool handlers for the Solist listing-generator agent.

Each function here is wired to an OS Agent Tool record (seeded by
setup/agents.py) and invoked by the executor's tool loop. Handlers either
return JSON-serializable data or — for vision — a dict with
``_content_blocks`` holding ready-made Anthropic content blocks (see
executor._dispatch_tools).

Tool failures may simply raise: the executor feeds the traceback back to
the LLM as an errored tool_result, so the agent can recover (e.g. fall back
to image briefs when image generation is not configured).
"""

import base64
import io

import frappe

REQUEST_TIMEOUT = 30
MAX_IMAGE_BYTES = 4 * 1024 * 1024  # Anthropic caps request images at ~5 MB base64
MAX_IMAGE_EDGE = 1568  # px — Anthropic's vision sweet spot; larger is wasted tokens
ANTHROPIC_MEDIA_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

BROWSER_HEADERS = {
	"User-Agent": (
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
		" (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
	),
	"Accept-Language": "en-US,en;q=0.9",
	"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}


# ── fetch_image ───────────────────────────────────────────────────────────────

def fetch_image(url):
	"""Download an image and hand it to the model as a vision block."""
	import requests

	response = requests.get(url, headers=BROWSER_HEADERS, timeout=REQUEST_TIMEOUT)
	response.raise_for_status()

	data, media_type = _prepare_for_vision(response.content)
	return {
		"_content_blocks": [
			{
				"type": "image",
				"source": {
					"type": "base64",
					"media_type": media_type,
					"data": base64.b64encode(data).decode(),
				},
			},
			{"type": "text", "text": f"Image fetched from {url}"},
		]
	}


def _prepare_for_vision(raw):
	"""Normalize arbitrary image bytes into something the Anthropic API accepts:
	a supported media type, RGB, and under the size cap."""
	from PIL import Image

	image = Image.open(io.BytesIO(raw))
	media_type = Image.MIME.get(image.format or "", "")

	if media_type in ANTHROPIC_MEDIA_TYPES and len(raw) <= MAX_IMAGE_BYTES and max(image.size) <= MAX_IMAGE_EDGE:
		return raw, media_type

	image = image.convert("RGB")
	if max(image.size) > MAX_IMAGE_EDGE:
		image.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE))
	buffer = io.BytesIO()
	image.save(buffer, format="JPEG", quality=85)
	return buffer.getvalue(), "image/jpeg"


# ── generate_product_images ───────────────────────────────────────────────────

def generate_product_images(briefs, reference_image_url=None):
	"""Generate product shots with gpt-image-1 and save each as a public File.

	Requires ``openai_api_key`` in site_config.json. When a reference image URL
	is given, uses the edits endpoint so generated shots stay faithful to the
	actual product instead of hallucinating one.
	"""
	import requests

	api_key = frappe.conf.get("openai_api_key")
	if not api_key:
		frappe.throw(
			"Image generation is not configured (set openai_api_key in "
			"site_config.json). Do NOT retry; return each image with url=null "
			"and its brief so the team can shoot or generate it manually."
		)

	reference = None
	if reference_image_url:
		fetched = requests.get(reference_image_url, headers=BROWSER_HEADERS, timeout=REQUEST_TIMEOUT)
		fetched.raise_for_status()
		reference = _prepare_for_vision(fetched.content)

	images = []
	for brief in briefs[:5]:
		b64 = _generate_one(api_key, brief["prompt"], reference)
		file_doc = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": f"listing-{brief['kind'].lower().replace(' ', '-')}-{frappe.generate_hash(length=8)}.png",
				"content": b64,
				"decode": True,
				"is_private": 0,
			}
		).insert(ignore_permissions=True)
		images.append({"kind": brief["kind"], "file_url": file_doc.file_url})
	frappe.db.commit()
	return {"images": images}


def _generate_one(api_key, prompt, reference):
	import requests

	if reference:
		data, media_type = reference
		response = requests.post(
			"https://api.openai.com/v1/images/edits",
			headers={"Authorization": f"Bearer {api_key}"},
			data={"model": "gpt-image-1", "prompt": prompt, "size": "1024x1024"},
			files={"image": ("reference.jpg", data, media_type)},
			timeout=180,
		)
	else:
		response = requests.post(
			"https://api.openai.com/v1/images/generations",
			headers={"Authorization": f"Bearer {api_key}"},
			json={"model": "gpt-image-1", "prompt": prompt, "size": "1024x1024"},
			timeout=180,
		)
	if response.status_code != 200:
		frappe.throw(f"Image generation failed ({response.status_code}): {response.text[:500]}")
	return response.json()["data"][0]["b64_json"]
