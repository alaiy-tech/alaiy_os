"""
Seeded agents + agent tools — single source of truth for the OS Agent /
OS Agent Tool records this app ships with.

Consumed by setup/agents.py:provision_agents(), which reconciles the site's
records to match these definitions on every install/migrate.

Handlers live in alaiy_os/tools/ (dotted paths below must import — OS Agent
Tool validates that at save time).
"""

import json

LISTING_AGENT_ID = "solist-listing-generator"

AGENT_TOOLS = [
    {
        "tool_id": "fetch_image",
        "description": (
            "Download a product image from a URL so you can actually see it. "
            "Returns the image as a vision block. Use it on the supplier image "
            "before writing copy or attributes."
        ),
        "handler": "alaiy_os.tools.listing.fetch_image",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "Publicly reachable image URL",
                },
            },
            "required": ["url"],
        },
    },
    {
        "tool_id": "generate_product_images",
        "description": (
            "Generate studio-quality product images from text briefs, optionally "
            "grounded on a reference photo of the real product. Saves each image "
            "and returns its file_url. Call once with all briefs. If it reports "
            "that image generation is not configured, do not retry — return the "
            "briefs with url set to null instead."
        ),
        "handler": "alaiy_os.tools.listing.generate_product_images",
        "parameters_schema": {
            "type": "object",
            "properties": {
                "briefs": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 5,
                    "items": {
                        "type": "object",
                        "properties": {
                            "kind": {
                                "type": "string",
                                "description": "Shot type, e.g. hero, lifestyle, detail, angle, scale",
                            },
                            "prompt": {
                                "type": "string",
                                "description": "Full image-generation prompt for this shot",
                            },
                        },
                        "required": ["kind", "prompt"],
                    },
                },
                "reference_image_url": {
                    "type": "string",
                    "description": "URL of the real product photo to stay faithful to",
                },
            },
            "required": ["briefs"],
        },
    },
]

LISTING_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {
            "type": "string",
            "description": "Brand + product type + key spec",
        },
        "description": {
            "type": "string",
            "description": "Editorial product description, HTML paragraphs allowed",
        },
        "bullet_points": {
            "type": "array",
            "minItems": 3,
            "maxItems": 7,
            "items": {"type": "string"},
        },
        "seo_keywords": {
            "type": "array",
            "items": {"type": "string"},
        },
        "tags": {
            "type": "array",
            "description": "Shopify tags",
            "items": {"type": "string"},
        },
        "category": {
            "type": "string",
            "enum": ["Jewelry", "Watches", "Accessories", "Other"],
        },
        "attributes": {
            "type": "object",
            "description": "Mandatory attributes for the category; null when not determinable",
            "additionalProperties": {"type": ["string", "null"]},
        },
        "images": {
            "type": "array",
            "minItems": 5,
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string"},
                    "brief": {"type": "string"},
                    "url": {
                        "type": ["string", "null"],
                        "description": "file_url of the generated image, or null when generation was unavailable",
                    },
                },
                "required": ["kind", "brief", "url"],
            },
        },
        "unenriched_fields": {
            "type": "array",
            "description": "Every field the admin must fill or verify manually",
            "items": {"type": "string"},
        },
    },
    "required": [
        "title",
        "description",
        "bullet_points",
        "seo_keywords",
        "tags",
        "category",
        "attributes",
        "images",
        "unenriched_fields",
    ],
}

LISTING_SYSTEM_PROMPT = """\
You are the listing generator for The Solist, a curated luxury boutique on
Shopify selling fine jewelry, watches and designer accessories. You turn raw
supplier data into a complete, Shopify-ready product listing that the admin
only needs to review and approve.

INPUT
The user message is a JSON payload from a supplier CSV row or manual entry.
Fields (any may be missing): title, description, price, cost,
reference_number, image_url.

WORKFLOW
1. If image_url is present, call fetch_image first and study the photo —
   copy and attributes must match what is actually visible.
2. Decide the category: Jewelry, Watches, Accessories, or Other.
3. Write the listing (rules below).
4. Call generate_product_images ONCE with 5 distinct briefs, passing
   image_url as reference_image_url when available. Standard shot set:
   hero (front, clean seamless white background), detail (macro of the
   defining craftsmanship), angle (three-quarter or profile view),
   lifestyle (worn or styled in an elegant editorial setting), and
   scale/packaging (in-hand or with brand packaging). If the tool reports
   generation is not configured, do not retry — output the 5 briefs with
   url null and add "images" to unenriched_fields.
5. Reply with the final JSON object only.

COPY RULES
- Title: Brand + Product Type + Key Spec (e.g. "Cartier Love Bracelet 18k
  Yellow Gold, Size 17"). Title Case, no ALL CAPS, no promo words, no
  trailing punctuation.
- Description: editorial and refined — the register of a luxury maison, not
  a marketplace. Two to three short paragraphs: what it is and why it
  matters; materials and craftsmanship; how it wears or styles. No emoji,
  no hype ("amazing", "must-have"), no invented heritage claims.
- Bullet points: 4-6 crisp, concrete facts (materials, dimensions,
  condition, what's included). One clause each.
- SEO keywords: 8-15 lowercase search phrases buyers actually type.
- Tags: Shopify tags — category, brand, material, gemstone, style, price
  tier. Short, reusable, Title Case.

ATTRIBUTES (mandatory per category — include every key)
- Jewelry: Style, Material, Measurement, Weight, Gemstones, Color & Clarity,
  Clasp Type, Back Type, Brand Packaging, Papers, Backstory
- Watches: Movement, Case Size, Dial Color, Water Resistance, Case Back,
  Strap, Complications, Manufactured In
- Accessories: Material, Dimensions, Features, Color
Fill each from the supplier text and the photo. NEVER invent factual specs
(weights, carats, sizes, water resistance, papers): if a value is not
stated or clearly visible, set it to null and list the attribute in
unenriched_fields.

HONESTY
unenriched_fields must name everything a human must confirm: null
attributes, guessed values, missing images. When the supplier data is too
thin to write confidently, still produce the best structured draft and flag
generously — the admin reviews everything before it goes live.\
"""

AGENTS = [
    {
        "agent_id": LISTING_AGENT_ID,
        "description": (
            "Generates a Shopify-ready Solist listing (title, description, "
            "bullets, tags, attributes, 5 product images) from raw supplier data."
        ),
        "model": "claude-sonnet-5",
        "max_turns": 8,
        "system_prompt": LISTING_SYSTEM_PROMPT,
        "output_format": "JSON",
        "output_schema": json.dumps(LISTING_OUTPUT_SCHEMA, indent=1),
        "tools": ["fetch_image", "generate_product_images"],
    },
]
